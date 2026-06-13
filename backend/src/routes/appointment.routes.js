const express = require('express');
const router = express.Router();
const { bookAppointment, getAppointments, cancelAppointment, rescheduleAppointment } = require('../controllers/appointment.controller');

router.post('/', bookAppointment);

router.get('/', getAppointments);

router.put('/:appointmentId/cancel', cancelAppointment);

router.put('/:appointmentId/reschedule', rescheduleAppointment);

module.exports = router;
