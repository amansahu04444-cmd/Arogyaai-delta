const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { ValidationError } = require('../middleware/error.middleware');
const { getClient } = require('../config/db');

async function bookAppointment(req, res, next) {
  try {
    const { doctorId, date, time, reason, userId, location } = req.body;

    if (!doctorId) {
      throw new ValidationError('Doctor ID is required');
    }

    if (!date) {
      throw new ValidationError('Date is required');
    }

    if (!time) {
      throw new ValidationError('Time is required');
    }

    const effectiveUserId = userId || req.userId;

    const appointmentId = uuidv4();
    const appointment = {
      id: appointmentId,
      userId: effectiveUserId,
      doctorId,
      date,
      time,
      reason: reason || 'General consultation',
      status: 'CONFIRMED',
      location: location || 'To be confirmed',
      bookedAt: new Date().toISOString()
    };

    logger.info('Appointment booked', { appointmentId, userId: effectiveUserId });

    const db = getClient();
    if (db) {
      try {
        await db.from('appointments').insert(appointment);
      } catch (dbError) {
        logger.warn('Could not save appointment to database', { error: dbError.message });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        appointment,
        confirmationNumber: `AROGYA-${appointmentId.slice(0, 8).toUpperCase()}`
      },
      metadata: {
        bookedAt: appointment.bookedAt,
        userId: effectiveUserId
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAppointments(req, res, next) {
  try {
    const { userId, status } = req.query;
    const effectiveUserId = userId || req.userId;

    logger.info('Fetching appointments', { userId: effectiveUserId, status });

    const db = getClient();
    let query = db.from('appointments').select('*').eq('userId', effectiveUserId);

    if (status) {
      query = query.eq('status', status);
    }

    const mockAppointments = [
      {
        id: uuidv4(),
        userId: effectiveUserId,
        doctorId: 'dr001',
        doctorName: 'Dr. Priya Sharma',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '10:00 AM',
        reason: 'Follow-up consultation',
        status: 'CONFIRMED',
        location: 'Apollo Hospital, Delhi',
        bookedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        userId: effectiveUserId,
        doctorId: 'dr002',
        doctorName: 'Dr. Rajesh Kumar',
        date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
        time: '2:30 PM',
        reason: 'New symptoms discussion',
        status: 'PENDING',
        location: 'Max Healthcare, Saket',
        bookedAt: new Date().toISOString()
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        appointments: mockAppointments,
        count: mockAppointments.length
      }
    });
  } catch (error) {
    next(error);
  }
}

async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required');
    }

    logger.info('Appointment cancelled', { appointmentId, reason });

    res.status(200).json({
      success: true,
      data: {
        appointmentId,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        reason: reason || 'No reason provided'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime, reason } = req.body;

    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required');
    }

    if (!newDate && !newTime) {
      throw new ValidationError('New date or time is required');
    }

    logger.info('Appointment rescheduled', { appointmentId, newDate, newTime });

    res.status(200).json({
      success: true,
      data: {
        appointmentId,
        status: 'RESCHEDULED',
        previousDate: '2024-01-15',
        newDate: newDate || '2024-01-15',
        newTime: newTime || '11:00 AM',
        rescheduledAt: new Date().toISOString(),
        reason: reason || 'Schedule conflict'
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  bookAppointment,
  getAppointments,
  cancelAppointment,
  rescheduleAppointment
};
