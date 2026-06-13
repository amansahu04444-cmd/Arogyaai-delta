const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergency.controller');

// Startup validation to prevent silent crashes due to missing controller exports
const requiredFunctions = ['triggerEmergency', 'getEmergencyProtocol', 'testAlert', 'getLastEmergencyAlert'];
requiredFunctions.forEach(fn => {
  if (typeof emergencyController[fn] !== 'function') {
    console.error(`🚨 CRITICAL STARTUP ERROR: Controller function "${fn}" is not defined or exported in emergency.controller.js!`);
    process.exit(1);
  }
});

const { triggerEmergency, getEmergencyProtocol, testAlert, getLastEmergencyAlert } = emergencyController;
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/', requireAuth, triggerEmergency);

router.post('/test', requireAuth, testAlert);

router.get('/last', requireAuth, getLastEmergencyAlert);

router.get('/protocol/:emergencyType', getEmergencyProtocol);

module.exports = router;
