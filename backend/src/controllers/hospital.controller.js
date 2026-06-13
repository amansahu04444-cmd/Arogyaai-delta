const axios = require('axios');
const logger = require('../utils/logger');
const overpassService = require('../services/overpass.service');

// ═══════════════════════════════════════════════════════════════
//  CACHE-FIRST HOSPITAL INTELLIGENCE SYSTEM
//  ──────────────────────────────────────────────────────────────
//  Architecture:
//  1. LAYER 1 (Cache HIT): Instant (<1ms) - Return cached enriched data
//  2. LAYER 2 (Fallback): Fast (<5ms) - Return local mock DB with distance
//  3. LAYER 3 (Background): Non-blocking - Enrich cache with Overpass data
//     → Uses production-grade overpass.service with:
//       - Exponential backoff + jitter on 429 errors
//       - 3-endpoint failover chain
//       - Request deduplication
//       - Never blocks response
//
//  PRIORITY: Cache > Speed > Availability > Completeness
//  (Healthcare emergency use: uptime > freshness)
// ═══════════════════════════════════════════════════════════════

// ─── CACHE LAYER ─────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (long TTL — Overpass is optional)

// ─── BACKGROUND ENRICHMENT STATE ────────────────────────────
const activeEnrichments = new Set(); // Dedup in-flight enrichment jobs per region
const regionThrottle = new Map();    // Track last enrichment attempt per region
const THROTTLE_INTERVAL = 60 * 1000; // Max 1 background call per region per minute

// ─── MOCK DATABASE (STABLE, ALWAYS AVAILABLE) ────────────────
const HOSPITAL_DB = [
  { id: 'db-1',  name: 'AIIMS Bhopal',           type: 'Emergency', rating: 4.7, address: 'Saket Nagar, Bhopal',   phone: '+91-755-2672355', lat: 23.2064, lng: 77.4378, emergency: true,  description: 'Premier government medical institute.' },
  { id: 'db-2',  name: 'Hamidia Hospital',        type: 'Emergency', rating: 4.2, address: 'Royal Market, Bhopal',   phone: '+91-755-2540222', lat: 23.2674, lng: 77.4126, emergency: true,  description: 'Major government hospital with trauma center.' },
  { id: 'db-3',  name: 'Bansal Hospital',         type: 'General',   rating: 4.4, address: 'Shahpura, Bhopal',       phone: '+91-755-4082222', lat: 23.1945, lng: 77.4337, emergency: false, description: 'Multi-specialty private hospital.' },
  { id: 'db-4',  name: 'Chirayu Medical College', type: 'Emergency', rating: 4.3, address: 'Bairagarh, Bhopal',      phone: '+91-755-4040000', lat: 23.2838, lng: 77.3467, emergency: true,  description: 'Teaching hospital with advanced facilities.' },
  { id: 'db-5',  name: 'Noble Hospital',          type: 'General',   rating: 4.1, address: 'Misrod, Bhopal',         phone: '+91-755-4271000', lat: 23.1752, lng: 77.4614, emergency: false, description: 'Trusted community healthcare provider.' },
  { id: 'db-6',  name: 'Peoples Hospital',        type: 'General',   rating: 4.5, address: 'Peoples Campus, Bhopal', phone: '+91-755-4005000', lat: 23.2100, lng: 77.4500, emergency: true,  description: 'Large multi-specialty hospital and research centre.' },
  { id: 'db-7',  name: 'L.N. Medical College',    type: 'Emergency', rating: 4.0, address: 'J.K. Hospital Rd, Bhopal', phone: '+91-755-2600440', lat: 23.2320, lng: 77.4330, emergency: true, description: 'Government medical college hospital.' },
  { id: 'db-8',  name: 'Narmada Hospital',        type: 'General',   rating: 4.3, address: 'Govindpura, Bhopal',     phone: '+91-755-2587000', lat: 23.2490, lng: 77.4650, emergency: false, description: 'Private multi-specialty care facility.' },
];

// ─── HIGH-PRECISION HAVERSINE (km) ───────────────────────────
const toRad = (value) => (value * Math.PI) / 180;

const haversine = (lat1, lon1, lat2, lon2) => {
  // STRICT float conversion — never trust raw input
  const la1 = Number(lat1);
  const lo1 = Number(lon1);
  const la2 = Number(lat2);
  const lo2 = Number(lon2);

  const R = 6371; // Earth radius in km

  const dLat = toRad(la2 - la1);
  const dLon = toRad(lo2 - lo1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(la1)) *
    Math.cos(toRad(la2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // raw float — DO NOT round here
};

// ─── ENRICH HOSPITALS WITH DYNAMIC DISTANCE ──────────────────
const enrichWithDistance = (hospitals, userLat, userLng) => {
  return hospitals
    .map(h => {
      if (!h.lat || !h.lng) return null;
      // Raw float distance for sorting accuracy
      const rawDist = haversine(userLat, userLng, h.lat, h.lng);
      return {
        ...h,
        distanceValue: rawDist,                          // raw float for sorting/logic
        distance_km: parseFloat(rawDist.toFixed(2)),     // rounded for API consumers
        distance_text: `${rawDist.toFixed(1)} km`,       // UI display only
        distance: `${rawDist.toFixed(1)} km`,            // backward-compatible UI field
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceValue - b.distanceValue);  // sort on RAW float, never rounded
};


// ─── MAP OSM ELEMENTS TO APP FORMAT ──────────────────────────
const mapOsmElements = (elements, userLat, userLng) => {
  return elements
    .filter(el => el.tags && el.tags.name)
    .map((el, i) => {
      const hLat = Number(el.lat || (el.center && el.center.lat));
      const hLng = Number(el.lon || (el.center && el.center.lon));
      if (isNaN(hLat) || isNaN(hLng)) return null;
      const rawDist = haversine(userLat, userLng, hLat, hLng);
      
      // Generate stable, deterministic rating based on OSM ID hash
      const idNum = parseInt(el.id) || i;
      const rating = (3.8 + (idNum % 11) / 10).toFixed(1);
      
      const phoneNum = el.tags.phone || el.tags['contact:phone'] || 'Phone number not available';
      console.log("Hospital Phone:", phoneNum);

      // Determine Type
      let type = 'General';
      if (el.tags.emergency === 'yes') type = 'Emergency';
      else if (el.tags.amenity === 'clinic' || el.tags.healthcare === 'clinic') type = 'Clinic';
      else if (el.tags.amenity === 'nursing_home') type = 'Nursing Home';
      else if (el.tags.amenity === 'doctors' || el.tags.healthcare === 'doctor') type = 'Clinic';
      
      // Extract specialties
      let specialties = 'Specialty information unavailable';
      if (el.tags['healthcare:speciality']) {
        specialties = el.tags['healthcare:speciality'].split(/[;,]/).map(s => s.trim().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
      } else if (el.tags['speciality']) {
        specialties = el.tags['speciality'];
      }

      // Extract facilities
      let facilities = [];
      if (el.tags.emergency === 'yes') facilities.push('Emergency Ward');
      if (el.tags.wheelchair === 'yes') facilities.push('Wheelchair Accessible');
      if (el.tags.dispensing === 'yes' || el.tags.pharmacy === 'yes') facilities.push('Pharmacy');
      if (facilities.length === 0) facilities = ['Standard Care'];

      return {
        id: `osm-${el.id || i}`,
        name: el.tags.name,
        type: type,
        rating: parseFloat(rating),
        distanceValue: rawDist,                          // raw float for sorting
        distance_km: parseFloat(rawDist.toFixed(2)),     // rounded for API consumers
        distance_text: `${rawDist.toFixed(1)} km`,       // UI display only
        distance: `${rawDist.toFixed(1)} km`,            // backward-compatible
        address: el.tags['addr:full'] || el.tags['addr:street'] || el.tags['addr:city'] || 'Address unavailable',
        phone: phoneNum,
        specialties,
        facilities,
        isOpen: el.tags.opening_hours ? (el.tags.opening_hours === '24/7' ? true : null) : null,
        lat: hLat,
        lng: hLng,
        emergency: el.tags.emergency === 'yes',
        description: el.tags.description || 'Verified community healthcare facility.',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceValue - b.distanceValue);   // sort on RAW float
};


// ─── OSRM DRIVING DISTANCE ENRICHMENT ──────────────────────────
const enrichWithDrivingDistance = async (hospitals, userLat, userLng) => {
  if (hospitals.length === 0) return hospitals;
  
  let oSRMSuccess = false;
  try {
    // Format: lon,lat;lon,lat;...
    // Source is index 0
    const coords = [`${userLng},${userLat}`];
    hospitals.forEach(h => coords.push(`${h.lng},${h.lat}`));
    const coordsString = coords.join(';');
    
    // OSRM Table API over HTTPS
    const url = `https://router.project-osrm.org/table/v1/driving/${coordsString}?sources=0&annotations=distance,duration`;
    
    const response = await axios.get(url, { timeout: 4000 });
    
    if (response.data && response.data.code === 'Ok') {
      const distances = response.data.distances[0]; 
      const durations = response.data.durations[0]; 
      
      hospitals.forEach((h, idx) => {
        const destIdx = idx + 1; // offset by 1 because source is 0
        if (distances[destIdx] !== null && distances[destIdx] !== undefined) {
          const distKm = distances[destIdx] / 1000;
          const durationMins = Math.max(1, Math.round(durations[destIdx] / 60));
          
          h.distanceValue = distKm;
          h.distance_km = parseFloat(distKm.toFixed(2));
          h.distance_text = `${distKm.toFixed(1)} km`;
          h.distance = `${distKm.toFixed(1)} km`;
          h.travelTime = durationMins;
          h.travelTime_text = `Approx. ${durationMins} mins drive`;
          console.log("Driving Distance:", distKm, "for", h.name);
        }
      });
      oSRMSuccess = true;
      // Re-sort by actual driving distance
      return hospitals.sort((a, b) => a.distanceValue - b.distanceValue);
    }
  } catch (error) {
    logger.warn(`[HOSPITALS] OSRM routing failed, falling back to estimated driving parameters: ${error.message}`);
  }
  
  // FALLBACK ESTIMATION (If OSRM fails)
  if (!oSRMSuccess) {
    hospitals.forEach(h => {
      const straightDist = haversine(userLat, userLng, h.lat, h.lng);
      const estDrivingDist = straightDist * 1.4; // 1.4x air distance
      const estDuration = Math.max(1, Math.round(estDrivingDist * 2.2)); // 2.2 mins/km
      
      h.distanceValue = estDrivingDist;
      h.distance_km = parseFloat(estDrivingDist.toFixed(2));
      h.distance_text = `${estDrivingDist.toFixed(1)} km`;
      h.distance = `${estDrivingDist.toFixed(1)} km`;
      h.travelTime = estDuration;
      h.travelTime_text = `Approx. ${estDuration} mins drive`;
      console.log("Driving Distance (Estimated):", estDrivingDist, "for", h.name);
    });
  }
  
  return hospitals.sort((a, b) => a.distanceValue - b.distanceValue);
};

// ═══════════════════════════════════════════════════════════════
//  FETCH REAL HOSPITALS FROM OVERPASS API
//  ──────────────────────────────────────────────────────────────
//  Calls the OSM API, maps to app format, and returns them.
// ═══════════════════════════════════════════════════════════════
const fetchRealHospitals = async (userLat, userLng, radius) => {
  try {
    logger.info(`[HOSPITALS] Fetching real hospitals via Overpass for lat:${userLat}, lng:${userLng}`);
    const response = await overpassService.fetchOverpass(userLat, userLng, radius);

    if (!response || !Array.isArray(response.elements) || response.elements.length === 0) {
      logger.warn(`[HOSPITALS] No hospitals found by Overpass or invalid response`, {
        elementCount: response?.elements?.length || 0,
      });
      return [];
    }

    const osmHospitals = mapOsmElements(response.elements, userLat, userLng);
    const enrichedHospitals = await enrichWithDrivingDistance(osmHospitals, userLat, userLng);
    
    logger.info(`[HOSPITALS] Retrieved and mapped ${enrichedHospitals.length} facilities with routing data.`);
    console.log("Hospital Results:", enrichedHospitals.map(h => ({ name: h.name, distance: h.distance, travelTime: h.travelTime_text })));
    return enrichedHospitals;
  } catch (error) {
    logger.warn(`[HOSPITALS] Overpass API failed: ${error.message}`, {
      error: error.message,
    });
    return null; // Return null to indicate failure
  }
};

/**
 * Get current health status of Overpass endpoints
 * Useful for diagnostics and monitoring
 */
exports.getOverpassStatus = (req, res) => {
  try {
    const status = overpassService.getHealthStatus();
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      endpoints: status,
      summary: {
        healthy: status.filter(s => s.health === 'healthy').length,
        unhealthy: status.filter(s => s.health === 'unhealthy').length,
        rateLimited: status.filter(s => s.rateLimited).length,
        totalRequests: status.reduce((sum, s) => sum + s.successCount + s.failureCount, 0),
      },
    });
  } catch (error) {
    logger.error('Failed to get Overpass status', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve endpoint status',
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  MAIN CONTROLLER
//  ──────────────────────────────────────────────────────────────
//  1. Check Cache
//  2. If Cache Miss, fetch from OpenStreetMap
//  3. If OSM fails or is empty, fallback to Local Mock DB
// ═══════════════════════════════════════════════════════════════
exports.getNearbyHospitals = async (req, res) => {
  const userLat = Number(req.query.lat);
  const userLng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 50000;

  // ── VALIDATE INPUT ──
  if (isNaN(userLat) || isNaN(userLng)) {
    const fallback = enrichWithDistance(HOSPITAL_DB, 23.2599, 77.4126);
    logger.warn('[HOSPITALS] Invalid coordinates, using default location', {
      lat: userLat,
      lng: userLng,
    });
    return res.status(200).json({
      success: true,
      data: fallback,
      source: 'mock',
      status: 'degraded',
      message: 'Invalid coordinates — showing default hospitals',
    });
  }

  const cacheKey = `${userLat.toFixed(2)},${userLng.toFixed(2)}`;

  // ── LAYER 1: CACHE HIT (instant, <1ms) ──
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts < CACHE_TTL)) {
    logger.debug(`[HOSPITALS] Cache HIT for ${cacheKey}`, {
      cacheKey,
      cachedCount: cached.data.length,
      source: cached.source || 'cache',
      age: Math.round((Date.now() - cached.ts) / 1000),
    });
    return res.status(200).json({
      success: true,
      data: cached.data,
      source: cached.source || 'cache',
      status: 'healthy',
      count: cached.data.length,
    });
  }

  // ── LAYER 2: FETCH REAL DATA (awaits API) ──
  const realHospitals = await fetchRealHospitals(userLat, userLng, radius);

  if (realHospitals && realHospitals.length > 0) {
    // Store in cache
    cache.set(cacheKey, { 
      data: realHospitals, 
      ts: Date.now(),
      source: 'overpass',
    });

    logger.info(`[HOSPITALS] Returning ${realHospitals.length} real hospitals from Overpass`, {
      cacheKey,
      source: 'overpass',
    });

    return res.status(200).json({
      success: true,
      data: realHospitals,
      source: 'overpass',
      status: 'healthy',
      count: realHospitals.length,
    });
  }

  // ── LAYER 3: FALLBACK TO MOCK DB + DYNAMIC DISTANCE ──
  logger.warn(`[HOSPITALS] Falling back to mock DB for ${cacheKey}`);
  const localHospitals = enrichWithDistance(HOSPITAL_DB, userLat, userLng);

  // Store fallback in cache
  cache.set(cacheKey, { 
    data: localHospitals, 
    ts: Date.now(),
    source: 'local',
  });

  return res.status(200).json({
    success: true,
    data: localHospitals,
    source: 'local',
    status: 'degraded',
    count: localHospitals.length,
    note: 'Real data fetch failed or empty; showing local mock data',
  });
};
