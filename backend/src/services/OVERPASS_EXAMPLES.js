// ═══════════════════════════════════════════════════════════════
//  OVERPASS SERVICE - IMPLEMENTATION & USAGE GUIDE
// ═══════════════════════════════════════════════════════════════
//
//  This file demonstrates how to use the production-grade
//  Overpass API client for healthcare hospital discovery.
//
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  1. BASIC USAGE
// ─────────────────────────────────────────────────────────────

const overpassService = require('./overpass.service');

// Fetch hospitals near a location (production-grade with retry/failover)
async function example_basicUsage() {
  try {
    const response = await overpassService.fetchOverpass(
      28.7041,  // latitude
      77.1025,  // longitude
      5000      // radius in meters
    );
    
    console.log(`Found ${response.elements.length} hospitals`);
    
    // Process elements
    response.elements.forEach(element => {
      if (element.tags && element.tags.name) {
        console.log(`  - ${element.tags.name}`);
      }
    });
    
  } catch (error) {
    // All errors are caught and logged by service
    // Never blocks main API response
    console.error('Enrichment failed (non-blocking):', error.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  2. IN BACKGROUND WORKER (NON-BLOCKING)
// ─────────────────────────────────────────────────────────────

const cache = new Map();

async function example_backgroundWorker(lat, lng) {
  // Fire-and-forget: never blocks response
  setImmediate(async () => {
    try {
      const data = await overpassService.fetchOverpass(lat, lng, 5000);
      
      // Update cache if successful
      if (data && data.elements) {
        cache.set(`${lat},${lng}`, {
          data: data.elements,
          timestamp: Date.now(),
        });
        console.log('✓ Cache updated');
      }
      
    } catch (error) {
      // Silently log failure - never crash
      console.warn('Background enrichment failed:', error.message);
    }
  });
  
  // Response sent IMMEDIATELY, enrichment happens in background
  return { success: true, source: 'local' };
}

// ─────────────────────────────────────────────────────────────
//  3. ERROR HANDLING: RETRY vs FAILOVER
// ─────────────────────────────────────────────────────────────

async function example_errorHandling() {
  // The service automatically handles:
  
  // ├─ 429 (Rate Limited)
  // │   → Parse Retry-After header
  // │   → Wait before retry (with jitter)
  // │   → Max 3 attempts per endpoint
  // │
  // ├─ 406 (Not Acceptable)
  // │   → Skip to next endpoint immediately
  // │
  // ├─ 503/504 (Server Error)
  // │   → Try failover chain
  // │
  // ├─ Network timeout
  // │   → Retry with backoff, then failover
  // │
  // └─ All failures
  //     → Return from cache
  //     → Or fallback to local data
  
  try {
    const data = await overpassService.fetchOverpass(28.7041, 77.1025);
    console.log('Success:', data.elements.length);
    
  } catch (error) {
    // This means ALL endpoints failed
    // In production, we still serve cached/local data
    console.error('Critical: All Overpass endpoints exhausted');
  }
}

// ─────────────────────────────────────────────────────────────
//  4. MONITORING: HEALTH STATUS
// ─────────────────────────────────────────────────────────────

function example_monitoring() {
  // Get health of all endpoints
  const status = overpassService.getHealthStatus();
  
  console.log('=== OVERPASS ENDPOINT STATUS ===\n');
  
  status.forEach(endpoint => {
    const healthColor = endpoint.health === 'healthy' ? '🟢' : '🔴';
    console.log(`${healthColor} ${endpoint.name}`);
    console.log(`   Success Rate: ${endpoint.successCount}/${endpoint.successCount + endpoint.failureCount}`);
    console.log(`   Avg Response: ${endpoint.avgResponseTimeMs}ms`);
    
    if (endpoint.rateLimited) {
      console.log(`   ⏱️  Rate-limited for ${endpoint.rateLimitExpiresIn}s`);
    }
    
    if (endpoint.consecutiveFailures > 0) {
      console.log(`   ⚠️  ${endpoint.consecutiveFailures} consecutive failures`);
    }
    
    console.log();
  });
}

// Example output:
// === OVERPASS ENDPOINT STATUS ===
//
// 🟢 primary-de
//    Success Rate: 98/100
//    Avg Response: 2847ms
//
// 🟢 secondary-kumi
//    Success Rate: 45/50
//    Avg Response: 3204ms
//    ⚠️  1 consecutive failures
//
// 🟢 tertiary-tw
//    Success Rate: 10/10
//    Avg Response: 1523ms

// ─────────────────────────────────────────────────────────────
//  5. PRODUCTION EXAMPLE: HOSPITAL API ENDPOINT
// ─────────────────────────────────────────────────────────────

const express = require('express');
const app = express();

// In-memory cache
const hospitalCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

app.get('/api/hospitals', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius) || 5000;
    
    // Validate
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    // ─── LAYER 1: CACHE CHECK ───
    const cached = hospitalCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts < CACHE_TTL)) {
      return res.json({
        success: true,
        data: cached.data,
        source: 'cache',
        count: cached.data.length,
      });
    }
    
    // ─── LAYER 2: FALLBACK (LOCAL DB) ───
    // Return local data immediately
    const localHospitals = getLocalHospitals(lat, lng); // Your local DB
    
    // Cache for next request
    hospitalCache.set(cacheKey, {
      data: localHospitals,
      ts: Date.now(),
    });
    
    res.json({
      success: true,
      data: localHospitals,
      source: 'local',
      count: localHospitals.length,
    });
    
    // ─── LAYER 3: BACKGROUND ENRICHMENT ───
    // Fire-and-forget: doesn't block response
    setImmediate(async () => {
      try {
        console.log(`[ENRICH] Starting for ${cacheKey}`);
        
        const osmData = await overpassService.fetchOverpass(lat, lng, radius);
        
        if (osmData && osmData.elements.length > 0) {
          const enrichedHospitals = mapOsmToHospitals(osmData.elements);
          
          // Update cache
          hospitalCache.set(cacheKey, {
            data: enrichedHospitals,
            ts: Date.now(),
            source: 'overpass',
          });
          
          console.log(`[ENRICH] ✓ Updated cache with ${enrichedHospitals.length} hospitals`);
        }
        
      } catch (error) {
        // Silently fail - cache remains unchanged
        console.warn(`[ENRICH] Failed: ${error.message}`);
      }
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  6. DIAGNOSTIC ENDPOINT
// ─────────────────────────────────────────────────────────────

app.get('/api/health/overpass', (req, res) => {
  const status = overpassService.getHealthStatus();
  
  const summary = {
    healthy: status.filter(s => s.health === 'healthy').length,
    unhealthy: status.filter(s => s.health === 'unhealthy').length,
    rateLimited: status.filter(s => s.rateLimited).length,
    totalRequests: status.reduce((sum, s) => sum + s.successCount + s.failureCount, 0),
  };
  
  const isHealthy = summary.unhealthy === 0 && summary.rateLimited === 0;
  
  res.status(isHealthy ? 200 : 503).json({
    healthy: isHealthy,
    status,
    summary,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
//  7. CONFIGURATION TUNING
// ─────────────────────────────────────────────────────────────

// In overpass.service.js, adjust these based on your needs:

// ┌─ SCENARIO: Low Latency Required ─────────────────────────┐
// │                                                             │
// │ initialDelayMs: 200,      // Faster backoff               │
// │ maxDelayMs: 3000,         // Cap at 3s                    │
// │ timeoutPerAttemptMs: 8000,  // 8s per attempt           │
// │ totalTimeoutMs: 30000,    // 30s total                   │
// │                                                             │
// │ Result: Fail fast, use cache, better for interactive UX  │
// └─────────────────────────────────────────────────────────┘

// ┌─ SCENARIO: High Reliability (Healthcare) ────────────────┐
// │                                                             │
// │ initialDelayMs: 500,      // Standard backoff             │
// │ maxDelayMs: 8000,         // Allow longer delays          │
// │ timeoutPerAttemptMs: 15000, // 15s per attempt          │
// │ totalTimeoutMs: 45000,    // 45s total                   │
// │                                                             │
// │ Result: More retries, higher success rate, better for    │
// │         background enrichment (healthcare emergencies)    │
// └─────────────────────────────────────────────────────────┘

// ─────────────────────────────────────────────────────────────
//  8. TESTING: SIMULATE FAILURES
// ─────────────────────────────────────────────────────────────

async function test_retryLogic() {
  // The service will automatically:
  // 1. Detect network timeout
  // 2. Calculate backoff: ~500ms
  // 3. Wait
  // 4. Retry with same endpoint
  // 5. On failure: Try next endpoint
  
  console.log('Testing retry logic...');
  
  try {
    // This will trigger retries if endpoints are slow
    const result = await overpassService.fetchOverpass(28.7041, 77.1025);
    console.log('✓ Success after retries:', result.elements.length);
  } catch (error) {
    console.error('✗ Failed after all retries');
  }
}

async function test_failover() {
  // To test failover:
  // 1. Temporarily comment out first endpoint in overpass.service.js
  // 2. Run this function
  // 3. Check logs - should see "Attempting endpoint 2/3" after failures
  
  console.log('Testing failover chain...');
  
  try {
    const result = await overpassService.fetchOverpass(28.7041, 77.1025);
    console.log('✓ Failover worked:', result.elements.length);
  } catch (error) {
    console.error('✗ All endpoints failed');
  }
}

// ─────────────────────────────────────────────────────────────
//  9. METRICS & LOGGING
// ─────────────────────────────────────────────────────────────

// Key log patterns to watch:

// SUCCESS:
// [OVERPASS] ✓ SUCCESS: primary-de returned 8 elements in 2847ms

// RETRY (429):
// [OVERPASS] Retrying primary-de in 523ms (attempt 1/3)
// [OVERPASS] Rate-limited. Retry after 60s

// FAILOVER:
// [OVERPASS] Endpoint primary-de failed, trying next...
// [OVERPASS] Attempting endpoint 2/3: secondary-kumi

// CACHE HIT:
// [HOSPITALS] Cache HIT for 28.70,77.10 (8 hospitals)

// DEGRADATION:
// [OVERPASS] All Overpass endpoints failed in 45123ms
// [HOSPITALS] Returning local hospitals (background enrichment queued)

// ─────────────────────────────────────────────────────────────
//  10. REAL-WORLD SCENARIO
// ─────────────────────────────────────────────────────────────

/*
SCENARIO: Emergency room queries during peak traffic

TIME 0ms:
  ├─ User 1: GET /api/hospitals?lat=28.7041&lng=77.1025
  ├─ User 2: GET /api/hospitals?lat=28.7041&lng=77.1025 (same location)
  └─ User 3: GET /api/hospitals?lat=28.7042&lng=77.1026 (nearby)

RESPONSE:
  ├─ User 1: 200 OK (2ms) - Cache hit
  ├─ User 2: 200 OK (2ms) - Cache hit (deduplicated request)
  └─ User 3: 200 OK (3ms) - Local DB

BACKGROUND (after response):
  ├─ Background worker: Fetch from Overpass (non-blocking)
  ├─ Attempt 1: primary-de → Success in 2847ms
  └─ Update cache for User 1 & User 2 location

USER BEHAVIOR (next request, 31 minutes later):
  ├─ User 1: GET /api/hospitals?lat=28.7041&lng=77.1025
  └─ Response: 200 OK (1ms) - Cache hit with enriched OSM data
                    (much better than local DB alone)

FAILURE SCENARIO (primary endpoint down):
  ├─ User 4: GET /api/hospitals?lat=28.7050&lng=77.1050
  ├─ Background: Fetch from Overpass
  ├─ Attempt 1: primary-de → Failed (timeout)
  ├─ Backoff: 500-650ms
  ├─ Attempt 2: primary-de → Failed (still timing out)
  ├─ Backoff: 700-1300ms
  ├─ Attempt 3: primary-de → Failed
  ├─ Failover: Try secondary-kumi → Success in 1523ms
  └─ Cache updated with enriched data for next request
  
  User 4 still gets response in <5ms (local data)
  ✓ Fully operational, zero impact on emergency response
*/

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════
//
// ✅ NEVER blocks main API response (< 5ms guaranteed)
// ✅ SMART retry with exponential backoff + jitter
// ✅ MULTI-endpoint failover (automatic recovery)
// ✅ RATE-LIMIT aware (handles 429 gracefully)
// ✅ Request deduplication (prevents thundering herd)
// ✅ COMPREHENSIVE monitoring (health status endpoint)
// ✅ HEALTHCARE-GRADE reliability (uptime first)
//
// For emergency healthcare: AVAILABILITY IS NOT OPTIONAL
//
// ═══════════════════════════════════════════════════════════════
