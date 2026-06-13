const express = require('express');
const router = express.Router();
const triageController = require('../controllers/triage.controller');

router.post('/', triageController.processTriage);
router.post('', triageController.processTriage);

module.exports = router;
