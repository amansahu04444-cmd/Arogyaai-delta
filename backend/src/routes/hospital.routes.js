const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospital.controller');

// Get nearby hospitals (main API endpoint)
// Returns cached/local data instantly, enriches in background
router.get('/', hospitalController.getNearbyHospitals);

// Diagnostic endpoint: Check Overpass API endpoint health
// Shows success rate, response times, rate-limit status
// Useful for monitoring and debugging
router.get('/overpass/status', hospitalController.getOverpassStatus);

module.exports = router;
