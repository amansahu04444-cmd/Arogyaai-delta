const { getClient } = require('../config/db');
const { broadcastEmergencyAlert, retrySend } = require('../services/telegram.service');
const logger = require('../utils/logger');
const { ValidationError, AppError } = require('../middleware/error.middleware');

// In-memory cooldown tracker
const cooldowns = {};
const COOLDOWN_MS = 2 * 60 * 1000;

/**
 * POST /api/emergency
 * Trigger emergency alert to all linked family members via Telegram
 */
async function triggerEmergency(req, res, next) {
  try {
    const userId = req.userId;
    const { emergencyType, userName } = req.body;

    // Extract coordinates robustly from various possible payload formats
    let rawLat = req.body.latitude;
    let rawLng = req.body.longitude;
    let locationSource = 'body';

    if (rawLat === undefined || rawLat === null || rawLat === '') {
      if (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== '') {
        rawLat = req.body.lat;
        rawLng = req.body.lng;
        locationSource = 'body.lat/lng';
      } else if (req.body.location && typeof req.body.location === 'object') {
        rawLat = req.body.location.latitude !== undefined ? req.body.location.latitude : req.body.location.lat;
        rawLng = req.body.location.longitude !== undefined ? req.body.location.longitude : req.body.location.lng;
        locationSource = 'body.location';
      } else if (req.body.patientInfo && typeof req.body.patientInfo === 'object') {
        const pLoc = req.body.patientInfo.location;
        if (pLoc && typeof pLoc === 'string' && pLoc.includes(',')) {
          const parts = pLoc.split(',');
          if (parts.length === 2) {
            rawLat = parts[0].trim();
            rawLng = parts[1].trim();
            locationSource = 'body.patientInfo.location';
          }
        }
      }
    }

    let parsedLat = (rawLat !== undefined && rawLat !== null && rawLat !== '') ? parseFloat(rawLat) : null;
    let parsedLng = (rawLng !== undefined && rawLng !== null && rawLng !== '') ? parseFloat(rawLng) : null;

    if (isNaN(parsedLat)) parsedLat = null;
    if (isNaN(parsedLng)) parsedLng = null;

    console.log("=== EMERGENCY TRIGGER REQUEST ===");
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log(`[Emergency] Location Source Extracted: ${locationSource}`);
    console.log("================================");

    // Strict Logging in the requested format
    console.log("[Emergency]");
    console.log(`Received Latitude: ${parsedLat !== null ? parsedLat : 'None'}`);
    console.log(`Received Longitude: ${parsedLng !== null ? parsedLng : 'None'}`);

    const hasValidCoords = parsedLat !== null && parsedLng !== null;

    if (hasValidCoords) {
      console.log("Payload Valid");
      console.log("Generating Google Maps URL");
      console.log("Sending Telegram Alert");
    } else {
      console.log("Coordinates Missing or Invalid");
      const frontendSent = (req.body.latitude !== undefined || req.body.lat !== undefined || (req.body.patientInfo && req.body.patientInfo.location && req.body.patientInfo.location.includes(','))) ? "✓" : "✗";
      console.log(`Frontend sent coordinates: ${frontendSent}`);
      console.log("Backend received coordinates: ✗");
    }

    if (!emergencyType) {
      throw new ValidationError('Emergency type is required');
    }

    const now = Date.now();
    const isEmergency = true; // Manual trigger is always high-priority emergency

    if (cooldowns[userId] && (now - cooldowns[userId]) < COOLDOWN_MS && !isEmergency) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - cooldowns[userId])) / 1000);
      console.log(`⏳ [EMERGENCY COOLDOWN] Cooldown active for user ${userId}. Skipping.`);
      throw new AppError(`Cooldown active. Please wait ${remaining}s.`, 429);
    }

    if (cooldowns[userId] && (now - cooldowns[userId]) < COOLDOWN_MS && isEmergency) {
      console.log(`🚀 [EMERGENCY COOLDOWN] Cooldown Bypassed for user ${userId}. Reason: Manual emergency button click.`);
    } else {
      console.log(`✅ [EMERGENCY COOLDOWN] No recent local cooldown active for user ${userId}.`);
    }
    
    cooldowns[userId] = now;

    const supabase = getClient();
    if (!supabase) throw new AppError('Database connection error', 500);

    const { data: contacts, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error("❌ Failed to fetch family members:", error);
      throw new AppError('Failed to fetch contacts', 500);
    }

    // 🚨 STEP 4: FILTERING CONNECTED CONTACTS
    const linkedContacts = (contacts || []).filter(c => 
      c.telegram_chat_id && 
      c.telegram_chat_id !== null && 
      c.telegram_chat_id !== ''
    );

    console.log(`📡 EMERGENCY: Found ${linkedContacts.length} linked contacts out of ${contacts?.length || 0}`);

    if (linkedContacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No Telegram-connected family members found. Ask them to connect via /start."
      });
    }

    // Log emergency to Supabase BEFORE triggering Telegram alert to ensure it's saved first
    const mapsUrl = hasValidCoords ? `https://www.google.com/maps?q=${parsedLat},${parsedLng}` : null;
    const { data: dbLog, error: dbErr } = await supabase.from('emergency_logs').insert([{
      user_id: userId,
      emergency_type: emergencyType,
      action_taken: 'telegram_broadcast_initiated',
      symptoms_report: `Initiating broadcast to ${linkedContacts.length} contacts`,
      latitude: parsedLat,
      longitude: parsedLng,
      maps_url: mapsUrl,
      pdf_sent: false,
      telegram_sent: false,
      sent_at: new Date().toISOString()
    }]).select().single();

    if (dbErr) {
      console.error("❌ Failed to insert emergency log before broadcast:", dbErr);
    }

    const resolvedPatientName = userName || req.body.patientInfo?.name || null;

    // Use ONLY linkedContacts in broadcast and await it to prevent race conditions
    const result = await broadcastEmergencyAlert(linkedContacts, {
      userId,
      patientName: resolvedPatientName,
      riskLevel: emergencyType,
      symptoms: req.body.symptoms || 'Not Available',
      latitude: parsedLat,
      longitude: parsedLng,
      textLocation: req.body.patientInfo?.location || (typeof req.body.location === 'string' ? req.body.location : null)
    });

    // Update the existing log entry with broadcast stats
    if (dbLog && dbLog.id) {
      const { error: updateErr } = await supabase.from('emergency_logs').update({
        action_taken: 'telegram_broadcast_completed',
        symptoms_report: `Sent to ${result.sent} contacts`,
        pdf_sent: !!result.pdfSent,
        telegram_sent: result.sent > 0
      }).eq('id', dbLog.id);
      
      if (updateErr) {
        console.error("❌ Failed to update emergency log after broadcast:", updateErr);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        sent: result.sent,
        total: linkedContacts.length
      }
    });

  } catch (error) {
    // STEP 6: SAFE ERROR HANDLING
    console.error("❌ Emergency Trigger Error:", error);
    next(error);
  }
}

/**
 * POST /api/emergency/test
 */
async function testAlert(req, res, next) {
  try {
    const supabase = getClient();
    const { data: contacts, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', req.userId);

    if (error) throw error;

    const linkedContacts = (contacts || []).filter(c => c.telegram_chat_id);

    if (linkedContacts.length === 0) {
      throw new AppError('No connected family members found to test.', 400);
    }

    const message = `🔔 <b>TEST ALERT</b>\nYour connection is working ✅\n<i>Sent at ${new Date().toLocaleTimeString()}</i>`;

    let sentCount = 0;
    for (const member of linkedContacts) {
      const success = await retrySend(member.telegram_chat_id, message);
      if (success) sentCount++;
    }

    res.status(200).json({
      success: true,
      message: `Test alert sent to ${sentCount} members.`
    });
  } catch (error) {
    console.error("❌ Test Alert Error:", error);
    next(error);
  }
}

async function getLastEmergencyAlert(req, res, next) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('emergency_logs')
      .select('*')
      .eq('user_id', req.userId)
      .eq('action_taken', 'telegram_broadcast')
      .order('triggered_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const log = data[0];
      let details = {};
      try {
        details = JSON.parse(log.symptoms_report);
      } catch (e) {
        details = { symptoms: log.symptoms_report };
      }

      const { data: contacts } = await supabase
        .from('family_members')
        .select('name')
        .eq('user_id', req.userId)
        .not('telegram_chat_id', 'is', null);

      return res.status(200).json({
        success: true,
        data: {
          timestamp: log.triggered_at,
          members: contacts ? contacts.map(c => c.name) : [],
          symptoms: details.symptoms || log.symptoms_report,
          risk_level: log.emergency_type,
          triage_score: log.triage_score,
          telegram_sent: details.telegram_sent
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: null
    });
  } catch (error) {
    console.error("❌ Get Last Emergency Alert Error:", error);
    next(error);
  }
}

async function getEmergencyProtocol(req, res, next) {
  try {
    const { emergencyType } = req.params;
    
    let steps = [
      "Call emergency services (108/102)",
      "Stay calm and try to slow down your breathing",
      "Share your live location with family members",
      "Ensure someone is ready to guide first responders",
      "Prepare your medical reports / ID cards"
    ];

    if (emergencyType === 'cardiac' || emergencyType?.toLowerCase()?.includes('chest')) {
      steps = [
        "Call 108 for emergency cardiac ambulance immediately",
        "Sit in a comfortable position, slightly upright with knees bent",
        "Take a low-dose aspirin if advised by a doctor and not allergic",
        "Loosen any tight clothing and stay warm",
        "Keep your door unlocked and notify your Care Circle immediately"
      ];
    } else if (emergencyType === 'stroke' || emergencyType?.toLowerCase()?.includes('stroke')) {
      steps = [
        "Call 108 immediately and state potential stroke",
        "Note the exact time symptoms started",
        "Do NOT give the patient food, drink, or aspirin",
        "Have the patient lie down on their side if breathing is difficult",
        "Monitor breathing and responsiveness closely"
      ];
    } else if (emergencyType === 'breathing' || emergencyType?.toLowerCase()?.includes('breath')) {
      steps = [
        "Call 108 immediately for respiratory emergency",
        "Help the person sit upright and lean forward slightly",
        "Loosen tight clothing around their neck and chest",
        "Assist them in using any prescribed inhaler or oxygen",
        "Remain calm; panic can make breathing more difficult"
      ];
    }

    res.status(200).json({ 
      success: true, 
      protocol: {
        title: `${emergencyType ? emergencyType.toUpperCase() : 'General'} Emergency Protocol`,
        steps
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  triggerEmergency,
  getEmergencyProtocol,
  testAlert,
  getLastEmergencyAlert
};
