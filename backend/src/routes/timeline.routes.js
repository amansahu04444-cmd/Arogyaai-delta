const express = require('express');
const router = express.Router();
const timelineController = require('../controllers/timeline.controller');

router.post('/add', timelineController.addEntry);
router.get('/:userId', timelineController.getEntries);
router.put('/:id', timelineController.updateEntry);
router.delete('/:id', timelineController.deleteEntry);
router.post('/analyze', timelineController.analyzeTimeline);
router.post('/pdf', timelineController.generatePdf);
router.get('/pdf', timelineController.generatePdf);

module.exports = router;
