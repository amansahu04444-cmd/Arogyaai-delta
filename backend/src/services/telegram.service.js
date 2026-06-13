const { telegram } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Send a Telegram document (like medical report PDF)
 */
const sendTelegramDocument = async (chatId, pdfBuffer, caption) => {
  try {
    if (!chatId || isNaN(chatId) || chatId.toString().length < 5) {
      console.error(`❌ INVALID CHAT ID SKIPPED: "${chatId}"`);
      return false;
    }

    const formData = new FormData();
    formData.append('chat_id', chatId);
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('document', blob, 'Medical_Report.pdf');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const res = await fetch(
      `https://api.telegram.org/bot${telegram.botToken}/sendDocument`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (!data.ok) {
      console.error(`❌ Telegram sendDocument API Error for ${chatId}:`, data.description);
      return false;
    }

    console.log(`✅ Telegram document sent successfully to ${chatId}`);
    return true;
  } catch (err) {
    console.error(`❌ Error sending document to ${chatId}:`, err.message);
    return false;
  }
};

/**
 * Send a Telegram message with accurate success/failure detection and retry logic
 */
const sendTelegramMessage = async (chatId, message) => {
  try {
    if (!chatId || isNaN(chatId) || chatId.toString().length < 5) {
      console.error(`❌ INVALID CHAT ID SKIPPED: "${chatId}"`);
      return false;
    }

    console.log(`📡 SENDING TO CHAT_ID: ${chatId}...`);

    const res = await fetch(
      `https://api.telegram.org/bot${telegram.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      console.error(`❌ Telegram API Error for ${chatId}:`, data.description);
      return false;
    }

    console.log(`✅ Telegram message sent successfully to ${chatId}`);
    return true;

  } catch (err) {
    console.error(`❌ Network/Internal Error sending to ${chatId}:`, err.message);
    return false;
  }
};

/**
 * Retry logic for Telegram messages
 */
const retrySend = async (chatId, message) => {
  if (!chatId || isNaN(chatId) || chatId.toString().length < 5) {
    return false;
  }

  for (let i = 0; i < 3; i++) {
    const success = await sendTelegramMessage(chatId, message);

    if (success) return true;

    console.warn(`⚠️ Retry attempt ${i + 1}/3 for ${chatId}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.error(`❌ Final Telegram send failure after 3 attempts: ${chatId}`);
  return false;
};

/**
 * Build a formatted emergency alert message
 */
function buildEmergencyMessage({ userName, emergencyType, latitude, longitude, timestamp }) {
  const locationLink = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : 'Location Unavailable';

  return [
    '🚨 <b>EMERGENCY ALERT</b> 🚨',
    '',
    `👤 <b>Patient:</b> ${userName || 'Unknown'}`,
    `⚠️ <b>Type:</b> ${emergencyType || 'General Emergency'}`,
    `🕐 <b>Time:</b> ${timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    '',
    locationLink,
    '',
    '⚡ <i>Please respond immediately. This is an automated alert from ArogyaAI.</i>'
  ].join('\n');
}

/**
 * Broadcast emergency alert to all linked family members with PDF report attached
 */
async function broadcastEmergencyAlert(contacts, alertData) {
  const { userId, userName, emergencyType, latitude, longitude, qrUrl, symptoms, hospital } = alertData;

  console.log(`[TELEGRAM PAYLOAD] userId: ${userId} | Name: ${userName} | Type: ${emergencyType} | Lat: ${latitude} | Lng: ${longitude} | QR: ${qrUrl} | Hospital: ${hospital}`);

  const locationLink = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : 'Location Unavailable';

  const captionLines = [
    '🚨 <b>AROGYAAI EMERGENCY ALERT</b>',
    '',
    `<b>Patient:</b> ${userName || 'Patient'}`,
    `<b>Risk Level:</b> ${emergencyType || 'HIGH'}`
  ];

  if (symptoms) {
    captionLines.push(`<b>Symptoms:</b> ${symptoms}`);
  }

  if (qrUrl) {
    captionLines.push(`<b>Medical QR:</b> ${qrUrl}`);
  }

  captionLines.push(`<b>Location:</b> ${locationLink}`);

  if (hospital) {
    captionLines.push(`<b>Nearest Hospital:</b> ${hospital}`);
  }

  captionLines.push('', 'Medical Report Attached.');

  const caption = captionLines.join('\n');

  let pdfBuffer = null;
  let pdfGenerated = false;
  try {
    const { buildPdfBuffer } = require('../controllers/timeline.controller');
    pdfBuffer = await buildPdfBuffer(userId);
    pdfGenerated = true;
  } catch (pdfErr) {
    console.error('❌ Failed to generate PDF for emergency broadcast:', pdfErr.message);
  }

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const contact of contacts) {
    let success = false;
    if (pdfGenerated && pdfBuffer) {
      success = await sendTelegramDocument(contact.telegram_chat_id, pdfBuffer, caption);
      if (!success) {
        console.warn(`⚠️ PDF document send failed for ${contact.telegram_chat_id}, falling back to text`);
        success = await retrySend(contact.telegram_chat_id, caption);
      }
    } else {
      success = await retrySend(contact.telegram_chat_id, caption);
    }

    if (success) {
      sent++;
    } else {
      failed++;
    }
    results.push({
      name: contact.name,
      telegram_chat_id: contact.telegram_chat_id,
      status: success ? 'sent' : 'failed'
    });
  }

  return { sent, failed, total: contacts.length, results, pdfSent: pdfGenerated };
}

module.exports = {
  sendTelegramMessage,
  sendTelegramDocument,
  retrySend,
  buildEmergencyMessage,
  broadcastEmergencyAlert
};
