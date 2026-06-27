const { telegram } = require('../config/env');
const logger = require('../utils/logger');
const { getClient } = require('../config/db');

/**
 * Normalizes risk levels to LOW, MEDIUM, HIGH, CRITICAL.
 */
function normalizeRiskLevel(level) {
  if (!level || typeof level !== 'string') return 'HIGH';
  const clean = level.toUpperCase().trim();
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(clean)) {
    return clean;
  }
  if (clean.includes('CRIT') || clean.includes('EMERGENCY')) return 'CRITICAL';
  if (clean.includes('HIGH')) return 'HIGH';
  if (clean.includes('MED')) return 'MEDIUM';
  if (clean.includes('LOW')) return 'LOW';
  return 'HIGH';
}

/**
 * Standardizes symptoms formatting into clean bullet points.
 */
function formatSymptoms(symptoms) {
  if (!symptoms) return 'Not Available';
  
  let list = [];
  if (Array.isArray(symptoms)) {
    list = symptoms;
  } else if (typeof symptoms === 'string') {
    list = symptoms
      .split(/[,\n•*]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  if (list.length === 0) return 'Not Available';
  return list.map(item => `• ${item}`).join('\n');
}

/**
 * Resolves patient name using fallback order (no emails, no generic placeholders).
 */
async function resolvePatientName({ userId, patientName, patient, profile, family_member, supabase }) {
  const isValidName = (name) => {
    if (!name || typeof name !== 'string') return false;
    const val = name.trim();
    return val.length > 0 && !val.includes('@') && val.toLowerCase() !== 'user' && val.toLowerCase() !== 'patient';
  };

  if (patient && isValidName(patient.full_name)) {
    return patient.full_name.trim();
  }
  if (profile && isValidName(profile.name)) {
    return profile.name.trim();
  }
  if (family_member && isValidName(family_member.name)) {
    return family_member.name.trim();
  }
  if (isValidName(patientName)) {
    return patientName.trim();
  }

  if (userId && supabase) {
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .maybeSingle();
      if (dbUser && isValidName(dbUser.name)) {
        return dbUser.name.trim();
      }
    } catch (e) {
      // Ignore
    }
  }

  return 'Unknown Patient';
}

/**
 * Resolves location link, falling back to last log coordinates if inputs are missing.
 */
async function resolveLocation({ userId, latitude, longitude, textLocation, supabase }) {
  console.log(`[Emergency] Resolving location. Inputs: Lat=${latitude}, Lng=${longitude}, textLocation=${textLocation}`);

  // 1. Direct input coordinates check (strict, non-simple truthy checks)
  if (latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(parseFloat(latitude)) &&
      longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(parseFloat(longitude))) {
    console.log(`[Emergency] GPS Coordinates valid. Generating Google Maps URL.`);
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  // 2. Fallback to last known location in database
  if (userId && supabase) {
    try {
      console.log(`[Emergency] Attempting fallback: Querying last known location from database...`);
      const { data: lastLog } = await supabase
        .from('emergency_logs')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastLog && 
          lastLog.latitude !== undefined && lastLog.latitude !== null && lastLog.latitude !== '' && !isNaN(parseFloat(lastLog.latitude)) &&
          lastLog.longitude !== undefined && lastLog.longitude !== null && lastLog.longitude !== '' && !isNaN(parseFloat(lastLog.longitude))) {
        console.log(`[Emergency] Last known location found in database: ${lastLog.latitude}, ${lastLog.longitude}`);
        return `https://www.google.com/maps?q=${lastLog.latitude},${lastLog.longitude} (Last Known Location)`;
      }
    } catch (e) {
      console.error(`[Emergency] Error fetching last known location:`, e.message);
    }

    // 3. Fallback to stored location (e.g. last appointment location)
    try {
      console.log(`[Emergency] Attempting fallback: Querying stored location from appointments...`);
      const { data: lastAppt } = await supabase
        .from('appointments')
        .select('location')
        .eq('user_id', userId)
        .not('location', 'is', null)
        .order('booked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAppt && lastAppt.location && lastAppt.location.trim() !== '') {
        console.log(`[Emergency] Stored location found in appointments: ${lastAppt.location}`);
        return `${lastAppt.location} (Stored Location)`;
      }
    } catch (e) {
      console.error(`[Emergency] Error fetching stored location from appointments:`, e.message);
    }
  }

  // 4. Fallback to emergency profile location / textLocation passed from frontend
  if (textLocation && typeof textLocation === 'string' && textLocation.trim() !== '' && textLocation !== 'Location Description Unavailable') {
    console.log(`[Emergency] Attempting fallback: Using emergency form location text: ${textLocation}`);
    return `${textLocation} (Emergency Profile Location)`;
  }

  console.log(`[Emergency] All location fallbacks failed. Location Unavailable.`);
  return 'Location Unavailable';
}

/**
 * Resolves medical QR link, querying database if not passed.
 */
async function resolveQrCode({ userId, qrCode, qrUrl, supabase }) {
  const code = qrCode || qrUrl;
  if (code && typeof code === 'string' && code.trim().length > 0 && code.toLowerCase() !== 'not available') {
    return code.trim();
  }

  if (userId && supabase) {
    try {
      const { data: qrData } = await supabase
        .from('medical_qr')
        .select('qr_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (qrData && qrData.qr_url) {
        return qrData.qr_url.trim();
      }
    } catch (e) {
      // Ignore
    }
  }

  return 'Not Available';
}

/**
 * Sends a Telegram document (report PDF) with a caption.
 */
const sendTelegramDocument = async (chatId, pdfBuffer, caption) => {
  try {
    if (!chatId || isNaN(chatId) || chatId.toString().length < 5) {
      return false;
    }

    const formData = new FormData();
    formData.append('chat_id', chatId);
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('document', blob, 'Medical_Report.pdf');
    formData.append('caption', caption);

    const res = await fetch(
      `https://api.telegram.org/bot${telegram.botToken}/sendDocument`,
      {
        method: 'POST',
        body: formData
      }
    );

    const data = await res.json();
    return !!data.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Sends a raw Telegram message text.
 */
const sendTelegramMessage = async (chatId, message) => {
  try {
    if (!chatId || isNaN(chatId) || chatId.toString().length < 5) {
      return false;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      }
    );

    const data = await res.json();
    return !!data.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Retries sending message using exponential delay (3 attempts maximum).
 */
const retrySend = async (chatId, message) => {
  if (!chatId || isNaN(chatId) || chatId.toString().length < 5) {
    return false;
  }

  // Attempt 1
  let success = await sendTelegramMessage(chatId, message);
  if (success) return true;

  // Attempt 2
  console.log('[Telegram] Retry 1');
  await new Promise(r => setTimeout(r, 1000));
  success = await sendTelegramMessage(chatId, message);
  if (success) return true;

  // Attempt 3
  console.log('[Telegram] Retry 2');
  await new Promise(r => setTimeout(r, 2000));
  success = await sendTelegramMessage(chatId, message);
  if (success) return true;

  return false;
};

/**
 * Backwards compatible message builder (unused in unified flow, but kept).
 */
function buildEmergencyMessage({ userName, emergencyType, latitude, longitude }) {
  const hasLat = latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(parseFloat(latitude));
  const hasLng = longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(parseFloat(longitude));
  const mapsUrl = (hasLat && hasLng) ? `https://www.google.com/maps?q=${latitude},${longitude}` : 'Location Unavailable';
  return [
    '🚨 AROGYAAI EMERGENCY ALERT',
    '',
    `👤 Patient\n${userName || 'Unknown'}`,
    '',
    `⚠ Risk Level\n${normalizeRiskLevel(emergencyType)}`,
    '',
    `📍 Live Location\n${mapsUrl}`
  ].join('\n');
}

/**
 * Centralized broadcaster for emergency alerts.
 */
async function broadcastEmergencyAlert(contacts, alertData) {
  console.log('[Telegram] Preparing Alert');
  
  const supabase = getClient();
  
  const {
    userId,
    userName,
    patientName,
    patient,
    profile,
    family_member,
    emergencyType,
    riskLevel,
    symptoms,
    qrUrl,
    qrCode,
    latitude,
    longitude,
    textLocation
  } = alertData;

  // 1. Resolve Patient Name
  const resolvedName = await resolvePatientName({
    userId,
    patientName: patientName || userName,
    patient,
    profile,
    family_member,
    supabase
  });

  // 2. Resolve Risk Level
  const resolvedRisk = normalizeRiskLevel(riskLevel || emergencyType);

  // 3. Resolve Symptoms
  const resolvedSymptoms = formatSymptoms(symptoms);

  // 4. Resolve Location Link
  const locationLink = await resolveLocation({
    userId,
    latitude,
    longitude,
    textLocation,
    supabase
  });

  // 5. Resolve QR Code Link
  const qrCodeLink = await resolveQrCode({
    userId,
    qrCode: qrCode || qrUrl,
    supabase
  });

  console.log('[Telegram] Formatting Message');

  // Unified Alert Format
  const message = [
    '🚨 AROGYAAI EMERGENCY ALERT',
    '',
    '👤 Patient',
    resolvedName,
    '',
    '⚠ Risk Level',
    resolvedRisk,
    '',
    '🩺 Symptoms',
    resolvedSymptoms,
    '',
    '📍 Live Location',
    locationLink,
    '',
    '🏥 Medical QR',
    qrCodeLink,
    '',
    '📄 Medical Report',
    'Attached'
  ].join('\n');

  console.log('[Telegram] Generating PDF');
  let pdfBuffer = null;
  let pdfGenerated = false;

  if (userId) {
    try {
      const { buildPdfBuffer } = require('../controllers/timeline.controller');
      pdfBuffer = await buildPdfBuffer(userId);
      pdfGenerated = !!pdfBuffer;
    } catch (pdfErr) {
      // Keep going, notification must not fail
    }
  }

  let sent = 0;
  let failed = 0;
  const results = [];

  const targetContacts = Array.isArray(contacts) ? contacts : [contacts];

  for (const contact of targetContacts) {
    const chatId = contact.telegram_chat_id || contact.chatId || 
      (typeof contact === 'string' || typeof contact === 'number' ? contact.toString() : null);

    if (!chatId) continue;

    console.log('[Telegram] Sending');
    let success = false;

    if (pdfGenerated && pdfBuffer) {
      success = await sendTelegramDocument(chatId, pdfBuffer, message);
      if (!success) {
        // PDF delivery failed, fallback to text-only with retries
        success = await retrySend(chatId, message);
      }
    } else {
      success = await retrySend(chatId, message);
    }

    if (success) {
      console.log('[Telegram] Delivered');
      sent++;
    } else {
      console.log('[Telegram] Failed');
      failed++;
    }

    results.push({
      chatId,
      status: success ? 'sent' : 'failed'
    });
  }

  return {
    sent,
    failed,
    total: targetContacts.length,
    results,
    pdfSent: pdfGenerated
  };
}

module.exports = {
  sendTelegramMessage,
  sendTelegramDocument,
  retrySend,
  buildEmergencyMessage,
  broadcastEmergencyAlert
};
