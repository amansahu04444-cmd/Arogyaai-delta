const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const {
  generateQr,
  getMyQr,
  updateSettings,
  getPublicCard
} = require('../controllers/medicalQr.controller');

// Protected routes (require valid JWT/session)
router.post('/generate', authMiddleware, generateQr);
router.get('/my', authMiddleware, getMyQr);
router.put('/settings', authMiddleware, updateSettings);

// Public route (accessible by any scanned QR link)
router.get('/public/:qrId', getPublicCard);

module.exports = router;
