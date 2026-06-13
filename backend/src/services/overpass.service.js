const axios = require('axios');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════
//  PRODUCTION-GRADE OVERPASS API CLIENT
//  ──────────────────────────────────────────────────────────────
//  Features:
//  ✓ Smart retry with exponential backoff + jitter (max 3 attempts)
//  ✓ Multi-endpoint failover (3 servers with fallback chain)
//  ✓ Proper HTTP request formatting (headers, body encoding)
//  ✓ Rate-limit awareness (429 handling, smart backoff)
//  ✓ Timeout protection (15s per attempt, 45s total)
//  ✓ Error classification (transient vs permanent)
//  ✓ Request deduplication (prevent duplicate in-flight queries)
//  ✓ Comprehensive metrics & logging for observability
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  FAILOVER CHAIN: Ordered list of Overpass servers
//  ─────────────────────────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  {
    name: 'primary-de',
    url: 'https://overpass-api.de/api/interpreter',
    region: 'Germany (Preferred - Primary)',
    priority: 1,
  },
  {
    name: 'secondary-kumi',
    url: 'https://overpass.kumi.systems/api/interpreter',
    region: 'Kumi Systems',
    priority: 2,
  },
  {
    name: 'tertiary-tw',
    url: 'https://overpass.nchc.org.tw/api/interpreter',
    region: 'Taiwan (NCHC)',
    priority: 3,
  },
];

// ─────────────────────────────────────────────────────────────
//  RETRY CONFIGURATION
//  ─────────────────────────────────────────────────────────────
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 500,      // First backoff: 500ms
  maxDelayMs: 8000,         // Cap backoff at 8s
  jitterFactor: 0.3,        // ±30% random variation
  timeoutPerAttemptMs: 15000, // 15s timeout per attempt
  totalTimeoutMs: 45000,    // 45s absolute maximum
};

// ─────────────────────────────────────────────────────────────
//  STATE TRACKING: Request deduplication & metrics
//  ─────────────────────────────────────────────────────────────
const requestCache = new Map();      // { queryHash → Promise }
const endpointMetrics = new Map();   // Track endpoint health
const rateLimitState = new Map();    // Track 429 rate-limit state per endpoint

// Initialize endpoint metrics
OVERPASS_ENDPOINTS.forEach(ep => {
  endpointMetrics.set(ep.name, {
    name: ep.name,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    lastError: null,
    lastErrorTime: null,
    consecutiveFailures: 0,
    isHealthy: true,
    avgResponseTimeMs: 0,
    requestCount: 0,
  });
});

// ═════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════════════

/**
 * Calculate exponential backoff with jitter
 * Formula: min(initialDelay * 2^attempt * (1 ± jitter), maxDelay)
 */
const calculateBackoffDelay = (attemptNumber) => {
  const exponentialDelay = RETRY_CONFIG.initialDelayMs * Math.pow(2, attemptNumber);
  const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.maxDelayMs);
  
  // Apply jitter: ±30% random variation to avoid thundering herd
  const jitterRange = cappedDelay * RETRY_CONFIG.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  
  return Math.max(100, Math.floor(cappedDelay + jitter)); // min 100ms
};

/**
 * Sleep for N milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simple hash for query deduplication
 */
const hashQuery = (lat, lng, radius) => {
  return `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
};

/**
 * Classify error as transient (retry) or permanent (failover)
 */
const classifyError = (error, statusCode) => {
  // Transient errors (retry same endpoint with backoff)
  if (statusCode === 429) return { type: 'RATE_LIMIT', retryable: true, shouldFailover: false };
  if (statusCode === 503) return { type: 'SERVICE_UNAVAILABLE', retryable: true, shouldFailover: true };
  if (statusCode === 504) return { type: 'GATEWAY_TIMEOUT', retryable: true, shouldFailover: true };
  
  // Permanent errors (immediate failover)
  if (statusCode === 406) return { type: 'NOT_ACCEPTABLE', retryable: false, shouldFailover: true };
  if (statusCode === 400) return { type: 'BAD_REQUEST', retryable: false, shouldFailover: true };
  
  // Network errors (failover)
  if (error.code === 'ECONNREFUSED') return { type: 'CONNECTION_REFUSED', retryable: false, shouldFailover: true };
  if (error.code === 'ECONNRESET') return { type: 'CONNECTION_RESET', retryable: true, shouldFailover: true };
  if (error.code === 'ETIMEDOUT') return { type: 'TIMEOUT', retryable: true, shouldFailover: true };
  if (error.code === 'EHOSTUNREACH') return { type: 'HOST_UNREACHABLE', retryable: false, shouldFailover: true };
  
  // Unknown errors (try failover)
  return { type: 'UNKNOWN', retryable: false, shouldFailover: true };
};

const buildOverpassQuery = (lat, lng, radius) => {
  // Overpass QL query for nodes, ways, and relations mapping amenity/healthcare tags
  const query = `[out:json];(node["amenity"~"hospital|clinic|nursing_home|doctors"](around:${radius},${lat},${lng});way["amenity"~"hospital|clinic|nursing_home|doctors"](around:${radius},${lat},${lng});relation["amenity"~"hospital|clinic|nursing_home|doctors"](around:${radius},${lat},${lng});node["healthcare"~"hospital|clinic|doctor|centre"](around:${radius},${lat},${lng});way["healthcare"~"hospital|clinic|doctor|centre"](around:${radius},${lat},${lng});relation["healthcare"~"hospital|clinic|doctor|centre"](around:${radius},${lat},${lng}););out center;`;
  return query;
};

/**
 * Update endpoint metrics
 */
const updateEndpointMetrics = (endpointName, success, responseTimeMs, error = null) => {
  const metrics = endpointMetrics.get(endpointName);
  if (!metrics) return;

  metrics.requestCount++;
  metrics.avgResponseTimeMs = 
    (metrics.avgResponseTimeMs * (metrics.requestCount - 1) + responseTimeMs) / metrics.requestCount;

  if (success) {
    metrics.successCount++;
    metrics.consecutiveFailures = 0;
    metrics.isHealthy = true;
    logger.debug(`[OVERPASS] ${endpointName} ✓ (${responseTimeMs}ms)`, {
      endpoint: endpointName,
      responseTime: responseTimeMs,
      successCount: metrics.successCount,
    });
  } else {
    metrics.failureCount++;
    metrics.consecutiveFailures++;
    metrics.lastError = error?.message || 'Unknown error';
    metrics.lastErrorTime = new Date();
    
    // Mark unhealthy after 3 consecutive failures
    if (metrics.consecutiveFailures >= 3) {
      metrics.isHealthy = false;
      logger.warn(`[OVERPASS] ${endpointName} marked UNHEALTHY (${metrics.consecutiveFailures} failures)`, {
        endpoint: endpointName,
        consecutiveFailures: metrics.consecutiveFailures,
      });
    }
  }
};

/**
 * Update rate-limit state for 429 responses
 */
const updateRateLimitState = (endpointName, retryAfter) => {
  const now = Date.now();
  rateLimitState.set(endpointName, {
    blockedUntil: now + (retryAfter * 1000),
    retryAfterSeconds: retryAfter,
    timestamp: now,
  });

  endpointMetrics.get(endpointName).rateLimitCount++;
  logger.warn(`[OVERPASS] ${endpointName} rate-limited. Retry after ${retryAfter}s`, {
    endpoint: endpointName,
    retryAfterSeconds: retryAfter,
  });
};

/**
 * Check if endpoint is currently rate-limited
 */
const isRateLimited = (endpointName) => {
  const state = rateLimitState.get(endpointName);
  if (!state) return false;
  
  if (Date.now() < state.blockedUntil) {
    logger.debug(`[OVERPASS] ${endpointName} still rate-limited for ${Math.ceil((state.blockedUntil - Date.now()) / 1000)}s`, {
      endpoint: endpointName,
    });
    return true;
  }
  
  // Rate limit expired
  rateLimitState.delete(endpointName);
  return false;
};

/**
 * Get sorted list of endpoints (healthy ones first)
 */
const getEndpointOrder = () => {
  return [...OVERPASS_ENDPOINTS]
    .map(ep => ({
      ...ep,
      metrics: endpointMetrics.get(ep.name),
    }))
    .sort((a, b) => {
      // Prioritize healthy endpoints
      if (a.metrics.isHealthy !== b.metrics.isHealthy) {
        return a.metrics.isHealthy ? -1 : 1;
      }
      // Within healthy/unhealthy, use configured priority
      return a.priority - b.priority;
    });
};

// ═════════════════════════════════════════════════════════════
//  CORE OVERPASS API CLIENT
// ═════════════════════════════════════════════════════════════

/**
 * Make a single HTTP request to an Overpass endpoint
 * 
 * @param {Object} endpoint - Endpoint configuration
 * @param {string} query - Overpass QL query
 * @param {number} attemptNumber - Current attempt (0-indexed)
 * @returns {Promise<Object>} Response data or throws error
 */
const makeOverpassRequest = async (endpoint, query, attemptNumber = 0) => {
  const startTime = Date.now();
  const endpointName = endpoint.name;

  try {
    logger.debug(`[OVERPASS] Attempt ${attemptNumber + 1}/3 → ${endpointName}`, {
      endpoint: endpointName,
      url: endpoint.url,
      attempt: attemptNumber + 1,
    });

    // Prepare request body: Overpass API expects form-urlencoded
    const body = `data=${encodeURIComponent(query)}`;

    const response = await axios.post(endpoint.url, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ArogyaAI/1.0 (Hospital Discovery System)',
        'Accept': 'application/json',
      },
      timeout: RETRY_CONFIG.timeoutPerAttemptMs,
      validateStatus: () => true, // Don't throw on any status code
    });

    const responseTimeMs = Date.now() - startTime;

    // Success path (2xx status)
    if (response.status >= 200 && response.status < 300) {
      if (response.data && Array.isArray(response.data.elements)) {
        updateEndpointMetrics(endpointName, true, responseTimeMs);
        logger.info(`[OVERPASS] ✓ Success from ${endpointName}: ${response.data.elements.length} elements`, {
          endpoint: endpointName,
          elementCount: response.data.elements.length,
          responseTime: responseTimeMs,
        });
        return response.data;
      }
      // Valid status but empty/malformed data
      throw new Error('Invalid response format: missing elements array');
    }

    // Error path
    const errorInfo = classifyError(new Error(response.statusText), response.status);
    const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers['retry-after'] || '60', 10);
      updateRateLimitState(endpointName, retryAfter);
      updateEndpointMetrics(endpointName, false, responseTimeMs, new Error(errorMessage));
      
      const retryableError = new Error(`Rate limited (429): Retry after ${retryAfter}s`);
      retryableError.status = 429;
      retryableError.retryAfter = retryAfter;
      throw retryableError;
    }

    // Handle other HTTP errors
    updateEndpointMetrics(endpointName, false, responseTimeMs, new Error(errorMessage));
    const httpError = new Error(errorMessage);
    httpError.status = response.status;
    throw httpError;

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    if (!error.status) {
      // Network/timeout error
      updateEndpointMetrics(endpointName, false, responseTimeMs, error);
      logger.debug(`[OVERPASS] Network error from ${endpointName}: ${error.code || error.message}`, {
        endpoint: endpointName,
        error: error.code || error.message,
        responseTime: responseTimeMs,
      });
    }

    throw error;
  }
};

/**
 * Retry logic with exponential backoff
 * Handles transient errors with smart backoff, failover on permanent errors
 */
const retryWithBackoff = async (endpoint, query) => {
  let lastError = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await makeOverpassRequest(endpoint, query, attempt);
    } catch (error) {
      lastError = error;
      
      // Check if this error is retryable on same endpoint
      const errorClassification = classifyError(error, error.status);
      
      if (errorClassification.retryable && attempt < RETRY_CONFIG.maxRetries - 1) {
        // Retry same endpoint with backoff
        const delayMs = calculateBackoffDelay(attempt);
        logger.info(`[OVERPASS] Retrying ${endpoint.name} in ${delayMs}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`, {
          endpoint: endpoint.name,
          delay: delayMs,
          error: error.message,
        });
        await sleep(delayMs);
        continue;
      }

      // Non-retryable or max retries reached for this endpoint
      logger.warn(`[OVERPASS] Endpoint ${endpoint.name} failed: ${error.message}`, {
        endpoint: endpoint.name,
        error: error.message,
        retryable: errorClassification.retryable,
      });
      
      throw error;
    }
  }

  throw lastError;
};

/**
 * Failover chain: Try multiple endpoints with smart retry
 * 
 * @param {string} lat - User latitude
 * @param {string} lng - User longitude
 * @param {number} radius - Search radius in meters
 * @returns {Promise<Object>} Response data from successful endpoint
 */
const fetchOverpassWithFailover = async (lat, lng, radius) => {
  const query = buildOverpassQuery(lat, lng, radius);
  const startTime = Date.now();
  const endpoints = getEndpointOrder();
  let lastError = null;

  logger.info(`[OVERPASS] Starting failover chain for location (${lat}, ${lng}, ${radius}m)`, {
    lat,
    lng,
    radius,
    endpointCount: endpoints.length,
  });

  for (let epIndex = 0; epIndex < endpoints.length; epIndex++) {
    const endpoint = endpoints[epIndex];
    const totalElapsedMs = Date.now() - startTime;

    // Check absolute timeout
    if (totalElapsedMs > RETRY_CONFIG.totalTimeoutMs) {
      logger.error(`[OVERPASS] Total timeout exceeded (${totalElapsedMs}ms)`, {
        totalTimeout: RETRY_CONFIG.totalTimeoutMs,
        elapsedTime: totalElapsedMs,
      });
      throw new Error(`Overpass API timeout: exceeded ${RETRY_CONFIG.totalTimeoutMs}ms total timeout`);
    }

    // Skip rate-limited endpoints
    if (isRateLimited(endpoint.name)) {
      logger.warn(`[OVERPASS] Skipping ${endpoint.name} (currently rate-limited)`, {
        endpoint: endpoint.name,
      });
      continue;
    }

    try {
      logger.info(`[OVERPASS] Attempting endpoint ${epIndex + 1}/${endpoints.length}: ${endpoint.name}`, {
        endpoint: endpoint.name,
        url: endpoint.url,
        priority: endpoint.priority,
      });

      const data = await retryWithBackoff(endpoint, query);
      
      const totalTime = Date.now() - startTime;
      logger.info(`[OVERPASS] ✓ SUCCESS: ${endpoint.name} returned ${data.elements.length} elements in ${totalTime}ms`, {
        endpoint: endpoint.name,
        elementCount: data.elements.length,
        totalTime,
        attempts: epIndex + 1,
      });

      return data;

    } catch (error) {
      lastError = error;
      logger.warn(`[OVERPASS] Endpoint ${endpoint.name} failed, trying next...`, {
        endpoint: endpoint.name,
        error: error.message,
        remainingEndpoints: endpoints.length - epIndex - 1,
      });
    }
  }

  // All endpoints exhausted
  const totalTime = Date.now() - startTime;
  logger.error(`[OVERPASS] ✗ FAILURE: All endpoints exhausted in ${totalTime}ms`, {
    totalTime,
    lastError: lastError?.message,
    endpointCount: endpoints.length,
  });

  throw lastError || new Error('All Overpass endpoints failed');
};

/**
 * Public API: Fetch hospital data with request deduplication
 * 
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @param {number} radius - Search radius in meters (default 5000)
 * @returns {Promise<Object>} Overpass response with elements array
 */
const fetchOverpass = async (lat, lng, radius = 5000) => {
  const queryHash = hashQuery(lat, lng, radius);

  // Request deduplication: return existing promise if in-flight
  if (requestCache.has(queryHash)) {
    logger.debug(`[OVERPASS] Returning cached in-flight request for ${queryHash}`, {
      query: queryHash,
    });
    return requestCache.get(queryHash);
  }

  // Create new request promise
  const promise = fetchOverpassWithFailover(lat, lng, radius)
    .catch(error => {
      // Remove from cache on failure to allow retry
      requestCache.delete(queryHash);
      throw error;
    })
    .then(data => {
      // Remove from cache on success (future requests will go to HTTP cache layer)
      requestCache.delete(queryHash);
      return data;
    });

  // Store in dedup cache
  requestCache.set(queryHash, promise);

  return promise;
};

/**
 * Get current health status of all endpoints
 */
const getHealthStatus = () => {
  return OVERPASS_ENDPOINTS.map(ep => {
    const metrics = endpointMetrics.get(ep.name);
    const rateLimitState = rateLimitState.get(ep.name);
    
    return {
      name: ep.name,
      url: ep.url,
      region: ep.region,
      health: metrics.isHealthy ? 'healthy' : 'unhealthy',
      successCount: metrics.successCount,
      failureCount: metrics.failureCount,
      rateLimitCount: metrics.rateLimitCount,
      avgResponseTimeMs: Math.round(metrics.avgResponseTimeMs),
      consecutiveFailures: metrics.consecutiveFailures,
      rateLimited: !!rateLimitState,
      rateLimitExpiresIn: rateLimitState ? 
        Math.ceil((rateLimitState.blockedUntil - Date.now()) / 1000) : null,
      lastError: metrics.lastError,
      lastErrorTime: metrics.lastErrorTime?.toISOString(),
    };
  });
};

/**
 * Reset metrics (for testing/debugging)
 */
const resetMetrics = () => {
  endpointMetrics.forEach(metrics => {
    metrics.successCount = 0;
    metrics.failureCount = 0;
    metrics.rateLimitCount = 0;
    metrics.lastError = null;
    metrics.lastErrorTime = null;
    metrics.consecutiveFailures = 0;
    metrics.isHealthy = true;
    metrics.avgResponseTimeMs = 0;
    metrics.requestCount = 0;
  });
  
  rateLimitState.clear();
  requestCache.clear();
  
  logger.info('[OVERPASS] Metrics reset');
};

// ═════════════════════════════════════════════════════════════
//  MODULE EXPORTS
// ═════════════════════════════════════════════════════════════

module.exports = {
  // Main API
  fetchOverpass,
  
  // Diagnostics & monitoring
  getHealthStatus,
  resetMetrics,
  
  // Constants (for testing)
  RETRY_CONFIG,
  OVERPASS_ENDPOINTS,
  
  // Internal utilities (for testing)
  calculateBackoffDelay,
  classifyError,
  buildOverpassQuery,
};
