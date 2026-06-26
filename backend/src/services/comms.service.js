const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

const smsLog = [];
const callLog = [];

async function sendSMS(to, message, metadata = {}) {
  const logEntry = {
    id: uuidv4(),
    type: 'SMS',
    to,
    message,
    metadata,
    status: 'SENT',
    sentAt: new Date().toISOString(),
    provider: 'MOCK_TWILIO'
  };

  logger.info('SMS sent', { to, messageId: logEntry.id });

  await simulateLatency(200);

  smsLog.push(logEntry);

  return {
    success: true,
    data: {
      messageId: logEntry.id,
      status: 'DELIVERED',
      to,
      sentAt: logEntry.sentAt
    }
  };
}

async function makeCall(to, message, metadata = {}) {
  const logEntry = {
    id: uuidv4(),
    type: 'CALL',
    to,
    message,
    metadata,
    status: 'CONNECTED',
    connectedAt: new Date().toISOString(),
    duration: 0,
    provider: 'MOCK_TWILIO'
  };

  logger.info('Call initiated', { to, callId: logEntry.id });

  await simulateLatency(500);

  logEntry.duration = Math.floor(Math.random() * 60) + 30;
  logEntry.status = 'COMPLETED';
  logEntry.completedAt = new Date().toISOString();

  callLog.push(logEntry);

  return {
    success: true,
    data: {
      callId: logEntry.id,
      status: logEntry.status,
      to,
      duration: logEntry.duration,
      connectedAt: logEntry.connectedAt
    }
  };
}

async function sendEmergencyAlert(contact, emergencyType, patientInfo, userId) {
  const { getClient } = require('../config/db');
  const { broadcastEmergencyAlert } = require('./telegram.service');
  const supabase = getClient();
  
  const googleMapsLink = patientInfo.location 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(patientInfo.location)}` 
    : 'Location not available';

  const message = `🚨 <b>EMERGENCY ALERT</b> 🚨\n` +
    `<b>Patient:</b> ${patientInfo.name || 'Unknown'}\n` +
    `<b>Location:</b> <a href="${googleMapsLink}">${patientInfo.location || 'Unknown location'}</a>\n` +
    `<b>Emergency Type:</b> ${emergencyType}\n` +
    `<b>Time:</b> ${new Date().toLocaleString()}`;

  const results = {
    sms: await sendSMS(contact, message, { emergency: true, type: emergencyType }),
    call: await makeCall(contact, `Emergency alert: ${emergencyType} for patient at ${patientInfo.location || 'unknown location'}`, { emergency: true, type: emergencyType }),
    telegramSentCount: 0
  };

  if (userId && supabase) {
    try {
      const { data: familyMembers, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', userId);
        
      if (!error && familyMembers && familyMembers.length > 0) {
        const broadcastResult = await broadcastEmergencyAlert(familyMembers, {
          userId,
          patientName: patientInfo.name,
          riskLevel: emergencyType,
          symptoms: 'Not Available'
        });
        results.telegramSentCount = broadcastResult.sent;
      }
    } catch (err) {
      logger.error('Failed to send Telegram alerts to family', { error: err.message, userId });
    }
  }

  logger.warn('EMERGENCY ALERT SENT', { contact, emergencyType, patientInfo, results });

  return {
    success: true,
    data: {
      alerted: true,
      emergencyType,
      contact,
      timestamp: new Date().toISOString(),
      notifications: results
    }
  };
}

async function sendAppointmentReminder(to, appointmentDetails) {
  const message = `Reminder: You have an appointment with Dr. ${appointmentDetails.doctorName} ` +
    `on ${appointmentDetails.date} at ${appointmentDetails.time}. ` +
    `Location: ${appointmentDetails.location}. - ArogyaAI`;

  return await sendSMS(to, message, {
    type: 'APPOINTMENT_REMINDER',
    appointmentId: appointmentDetails.id
  });
}

async function sendTriageResult(to, triageResult) {
  const recText = typeof triageResult.recommendation === 'object' && triageResult.recommendation !== null
    ? (triageResult.recommendation.summary || '')
    : String(triageResult.recommendation || '');

  const message = `Your health assessment: ${triageResult.category}. ` +
    `Risk Level: ${triageResult.risk_level}. ` +
    `Recommendation: ${recText}. ` +
    `For emergencies, call ambulance immediately. - ArogyaAI`;

  return await sendSMS(to, message, {
    type: 'TRIAGE_RESULT',
    riskLevel: triageResult.risk_level
  });
}

function getSMSLog() {
  return smsLog;
}

function getCallLog() {
  return callLog;
}

function simulateLatency(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  sendSMS,
  makeCall,
  sendEmergencyAlert,
  sendAppointmentReminder,
  sendTriageResult,
  getSMSLog,
  getCallLog
};
