const express = require('express');
const router = express.Router();
const { processChatMessage, getTriageWithNearestHospital, queryCopilot } = require('../controllers/chat.controller');
const { getTools } = require('../services/copilotTools');

router.post('/', processChatMessage);

router.post('/with-hospital', getTriageWithNearestHospital);

router.post('/copilot', queryCopilot);

// Get available Copilot tools
router.get('/tools', (req, res) => {
  const tools = getTools();
  res.status(200).json({
    success: true,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  });
});

module.exports = router;
