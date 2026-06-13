const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getClient } = require('../config/db');

// ═══════════════════════════════════════════════════════════════
//  PRODUCTION-GRADE AUTHENTICATION SYSTEM
//  ──────────────────────────────────────────────────────────────
//  Features:
//  ✓ Hybrid Auth Strategy (JWT-first, Supabase-fallback)
//  ✓ Robust retry system with exponential backoff + jitter
//  ✓ Timeout protection (5-7s max per external call)
//  ✓ Graceful degradation (never crashes API)
//  ✓ Request deduplication (prevents duplicate auth calls)
//  ✓ Comprehensive error handling (network failures, timeouts)
//  ✓ Performance optimization (reduces external API calls)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  CONFIGURATION
//  ─────────────────────────────────────────────────────────────
const AUTH_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  supabaseTimeoutMs: 5000,        // 5s timeout for Supabase calls
  maxRetries: 2,                  // Max retries for Supabase calls
  initialRetryDelayMs: 300,       // Starting backoff delay
  maxRetryDelayMs: 2000,          // Cap on backoff delay
  jitterFactor: 0.2,              // ±20% random variation
  cacheTtlMs: 5 * 60 * 1000,      // 5 minutes user session cache
};

// ─────────────────────────────────────────────────────────────
//  STATE MANAGEMENT
//  ─────────────────────────────────────────────────────────────
const userSessionCache = new Map();    // { userId → { user, expiresAt } }
const inFlightAuthRequests = new Map(); // { tokenHash → Promise } (deduplication)

// ─────────────────────────────────────────────────────────────
//  UTILITY FUNCTIONS
//  ─────────────────────────────────────────────────────────────

/**
 * Calculate exponential backoff with jitter
 */
const calculateRetryDelay = (attemptNumber) => {
  const exponentialDelay = AUTH_CONFIG.initialRetryDelayMs * Math.pow(2, attemptNumber);
  const cappedDelay = Math.min(exponentialDelay, AUTH_CONFIG.maxRetryDelayMs);

  // Apply jitter: ±20% random variation
  const jitterRange = cappedDelay * AUTH_CONFIG.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.max(100, Math.floor(cappedDelay + jitter));
};

/**
 * Sleep for N milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simple hash for request deduplication
 */
const hashToken = (token) => {
  // Simple hash for deduplication (not cryptographically secure)
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString();
};

/**
 * Classify authentication errors
 */
const classifyAuthError = (error) => {
  if (!error) return { type: 'UNKNOWN', retryable: false };

  const message = error.message || '';
  const code = error.code || '';

  // Network errors (retryable)
  if (code === 'ECONNRESET') return { type: 'CONNECTION_RESET', retryable: true };
  if (code === 'UND_ERR_CONNECT_TIMEOUT') return { type: 'CONNECT_TIMEOUT', retryable: true };
  if (code === 'ENOTFOUND') return { type: 'DNS_FAILURE', retryable: true };
  if (code === 'ECONNREFUSED') return { type: 'CONNECTION_REFUSED', retryable: true };

  // Supabase-specific errors
  if (message.includes('JWT expired')) return { type: 'TOKEN_EXPIRED', retryable: false };
  if (message.includes('invalid JWT')) return { type: 'INVALID_TOKEN', retryable: false };
  if (message.includes('User not found')) return { type: 'USER_NOT_FOUND', retryable: false };

  // Timeout errors (retryable)
  if (message.includes('timeout')) return { type: 'TIMEOUT', retryable: true };

  // Default: assume retryable for unknown errors
  return { type: 'UNKNOWN', retryable: true };
};

/**
 * Check if user session is cached and valid
 */
const getCachedUser = (userId) => {
  const cached = userSessionCache.get(userId);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    userSessionCache.delete(userId);
    return null;
  }

  return cached.user;
};

/**
 * Cache user session
 */
const cacheUser = (userId, user) => {
  userSessionCache.set(userId, {
    user,
    expiresAt: Date.now() + AUTH_CONFIG.cacheTtlMs,
  });
};

/**
 * Decode JWT token locally (no network call)
 */
const decodeJwtLocally = (token) => {
  try {
    // Verify JWT signature and decode payload
    const decoded = jwt.verify(token, AUTH_CONFIG.jwtSecret);

    // Basic validation
    if (!decoded.userId && !decoded.sub) {
      return null;
    }

    // Return minimal user object from JWT
    return {
      id: decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user',
      // Note: This is a minimal user object from JWT
      // Full user data will be fetched from Supabase if needed
      _source: 'jwt',
    };
  } catch (error) {
    // JWT verification failed
    logger.debug(`JWT verification failed: ${error.message}`);
    return null;
  }
};

/**
 * Fetch user from Supabase with retry logic
 */
const fetchUserFromSupabase = async (token, attemptNumber = 0) => {
  const supabase = getClient();
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    logger.debug(`[AUTH] Attempting Supabase auth (attempt ${attemptNumber + 1})`);

    // Create a promise that will timeout
    const authPromise = supabase.auth.getUser(token);

    // Race between auth call and timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase auth timeout')), AUTH_CONFIG.supabaseTimeoutMs);
    });

    const { data: { user }, error } = await Promise.race([authPromise, timeoutPromise]);

    if (error) {
      throw error;
    }

    if (!user) {
      throw new Error('User not found');
    }

    logger.debug(`[AUTH] Supabase auth successful for user ${user.id}`);
    return user;

  } catch (error) {
    const errorInfo = classifyAuthError(error);

    logger.warn(`[AUTH] Supabase auth failed (attempt ${attemptNumber + 1}): ${error.message}`, {
      errorType: errorInfo.type,
      retryable: errorInfo.retryable,
      attempt: attemptNumber + 1,
    });

    // If this is retryable and we haven't exceeded max retries
    if (errorInfo.retryable && attemptNumber < AUTH_CONFIG.maxRetries) {
      const delayMs = calculateRetryDelay(attemptNumber);
      logger.info(`[AUTH] Retrying Supabase auth in ${delayMs}ms`);

      await sleep(delayMs);
      return fetchUserFromSupabase(token, attemptNumber + 1);
    }

    // Max retries exceeded or non-retryable error
    throw error;
  }
};

/**
 * Hybrid authentication: JWT-first, Supabase-fallback
 */
const authenticateUser = async (token) => {
  const tokenHash = hashToken(token);

  // Check if there's already an in-flight request for this token
  if (inFlightAuthRequests.has(tokenHash)) {
    logger.debug(`[AUTH] Returning in-flight auth request for token hash ${tokenHash}`);
    return inFlightAuthRequests.get(tokenHash);
  }

  // Create authentication promise
  const authPromise = (async () => {
    try {
      // PHASE 1: Try JWT verification (fast, no network)
      logger.debug(`[AUTH] Phase 1: JWT verification`);
      const jwtUser = decodeJwtLocally(token);

      if (jwtUser) {
        // Check if we have cached full user data
        const cachedUser = getCachedUser(jwtUser.id);
        if (cachedUser) {
          logger.debug(`[AUTH] Using cached user data for ${jwtUser.id}`);
          return cachedUser;
        }

        // JWT valid but no cached data - try Supabase for full user info
        logger.debug(`[AUTH] Phase 2: JWT valid, fetching full user from Supabase`);
        try {
          const fullUser = await fetchUserFromSupabase(token);
          cacheUser(fullUser.id, fullUser);
          return fullUser;
        } catch (supabaseError) {
          // Supabase failed, but JWT was valid - return JWT user with warning
          logger.warn(`[AUTH] Supabase failed, using JWT-only user data`, {
            userId: jwtUser.id,
            error: supabaseError.message,
          });
          return jwtUser;
        }
      }

      // PHASE 2: JWT invalid/expired, try Supabase directly
      logger.debug(`[AUTH] Phase 2: JWT invalid, trying Supabase`);
      const supabaseUser = await fetchUserFromSupabase(token);
      cacheUser(supabaseUser.id, supabaseUser);
      return supabaseUser;

    } catch (error) {
      const errorInfo = classifyAuthError(error);

      // PHASE 3: Both JWT and Supabase failed - graceful degradation
      logger.error(`[AUTH] All auth methods failed`, {
        error: error.message,
        errorType: errorInfo.type,
        tokenHash,
      });

      // For healthcare system, we might want to allow anonymous access
      // with limited functionality rather than complete failure
      throw new Error(`Authentication failed: ${error.message}`);

    } finally {
      // Clean up in-flight request
      inFlightAuthRequests.delete(tokenHash);
    }
  })();

  // Store in-flight request for deduplication
  inFlightAuthRequests.set(tokenHash, authPromise);

  return authPromise;
};

// ═══════════════════════════════════════════════════════════════
//  PRODUCTION-GRADE AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

/**
 * Enhanced authentication middleware with fault tolerance
 */
async function authMiddleware(req, res, next) {
  const startTime = Date.now();

  try {
    // Allow public routes
    const publicRoutes = ['/health', '/api/health', '/api/auth/login', '/api/auth/register'];
    if (publicRoutes.includes(req.path)) {
      req.userId = `anonymous-${req.ip || 'unknown'}`;
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // Anonymous access allowed for healthcare system
      req.userId = `anonymous-${req.ip || 'unknown'}`;
      req.user = null;
      req.token = null;
      req.authSource = 'anonymous';
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn(`[AUTH] Invalid authorization format: ${authHeader.substring(0, 50)}...`);
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT'
      });
    }

    const token = parts[1];

    if (!token || token.length < 10) {
      logger.warn(`[AUTH] Invalid token format`);
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Perform hybrid authentication
    const user = await authenticateUser(token);

    // Set request context
    req.userId = user.id;
    req.user = user;
    req.token = token;
    req.authSource = user._source || 'supabase';

    const duration = Date.now() - startTime;
    logger.debug(`[AUTH] Authentication successful`, {
      userId: user.id,
      authSource: req.authSource,
      durationMs: duration,
    });

    next();

  } catch (error) {
    const duration = Date.now() - startTime;

    // NEVER crash the API - return controlled error response
    logger.error(`[AUTH] Middleware error: ${error.message}`, {
      path: req.path,
      method: req.method,
      ip: req.ip,
      durationMs: duration,
      error: error.message,
    });

    // For healthcare system, allow anonymous access on auth failures
    // This prevents the entire API from becoming unusable
    req.userId = `anonymous-${req.ip || 'unknown'}`;
    req.user = null;
    req.token = null;
    req.authSource = 'degraded';
    req.authError = error.message;

    logger.warn(`[AUTH] Auth failed, allowing anonymous access`, {
      path: req.path,
      error: error.message,
      userId: req.userId,
    });

    // Continue with anonymous access instead of failing
    next();
  }
}

/**
 * Require authentication for protected routes
 */
function requireAuth(req, res, next) {
  if (!req.userId || req.userId.startsWith('anonymous')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      authSource: req.authSource || 'unknown',
    });
  }

  // Check if we had an auth error (degraded mode)
  if (req.authError) {
    return res.status(401).json({
      success: false,
      message: 'Authentication service temporarily unavailable',
      code: 'AUTH_SERVICE_DEGRADED',
      details: 'Using anonymous access due to authentication service issues',
    });
  }

  next();
}

/**
 * Get authentication health status
 */
function getAuthHealth() {
  const now = Date.now();
  const cachedUsers = Array.from(userSessionCache.values()).filter(c => c.expiresAt > now).length;
  const inFlightRequests = inFlightAuthRequests.size;

  return {
    healthy: true, // Auth system is always "healthy" (graceful degradation)
    cachedUsers,
    inFlightRequests,
    cacheSize: userSessionCache.size,
    config: {
      jwtEnabled: true,
      supabaseTimeoutMs: AUTH_CONFIG.supabaseTimeoutMs,
      maxRetries: AUTH_CONFIG.maxRetries,
      cacheTtlMinutes: AUTH_CONFIG.cacheTtlMs / (60 * 1000),
    },
  };
}

/**
 * Clean up expired cache entries (call periodically)
 */
function cleanupExpiredCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [userId, cached] of userSessionCache.entries()) {
    if (now > cached.expiresAt) {
      userSessionCache.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`[AUTH] Cleaned up ${cleaned} expired cache entries`);
  }

  return cleaned;
}

// Periodic cleanup (every 10 minutes)
setInterval(cleanupExpiredCache, 10 * 60 * 1000);

module.exports = {
  authMiddleware,
  requireAuth,
  getAuthHealth,
  cleanupExpiredCache,
  // Export for testing
  authenticateUser,
  decodeJwtLocally,
  fetchUserFromSupabase,
  calculateRetryDelay,
  classifyAuthError,
};
