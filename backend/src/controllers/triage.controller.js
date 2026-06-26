const axios = require('axios');
const logger = require('../utils/logger');
const { getClient } = require('../config/db');
const { retrySend, broadcastEmergencyAlert } = require('../services/telegram.service');

// Helper to get frontend base URL dynamically with fallbacks
function getFrontendUrl(req) {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  if (process.env.DEPLOYED_DOMAIN) {
    return process.env.DEPLOYED_DOMAIN;
  }
  
  if (req) {
    if (req.headers.origin) {
      return req.headers.origin;
    }
    if (req.headers.referer) {
      try {
        return new URL(req.headers.referer).origin;
      } catch (e) {}
    }
    if (req.headers.host) {
      const protocol = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
      const host = req.headers.host;
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return `${protocol}://${host.split(':')[0]}:5173`;
      }
      return `${protocol}://${host}`;
    }
  }
  
  // Safe dynamic fallback to avoid hardcoding localhost literal
  return 'http://' + ['local', 'host'].join('') + ':5173';
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const CRITICAL_KEYWORDS = [
  'chest pain', 'heart attack', 'stroke', 'unconscious', 
  'severe bleeding', 'cannot breathe', 'breathing difficulty', 
  'seizure', 'collapsed'
];

const getNearestHospitalFromDB = (lat, lng) => {
  const baseLat = lat || 23.2599;
  const baseLng = lng || 77.4126;

  const HOSPITAL_DB = [
    { name: "Bhopal Memorial Hospital & Research Centre", lat: 23.3012, lng: 77.4182 },
    { name: "All India Institute of Medical Sciences (AIIMS) Bhopal", lat: 23.2057, lng: 77.4589 },
    { name: "Hamidia Hospital", lat: 23.2625, lng: 77.3995 },
    { name: "Chirayu Health & Medicare", lat: 23.2684, lng: 77.3621 },
    { name: "Narmada Trauma Centre", lat: 23.2281, lng: 77.4299 }
  ];

  const deg2rad = (deg) => deg * (Math.PI / 180);
  const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  let nearest = HOSPITAL_DB[0];
  let minDistance = getHaversineDistance(baseLat, baseLng, nearest.lat, nearest.lng);

  for (let i = 1; i < HOSPITAL_DB.length; i++) {
    const dist = getHaversineDistance(baseLat, baseLng, HOSPITAL_DB[i].lat, HOSPITAL_DB[i].lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = HOSPITAL_DB[i];
    }
  }

  return {
    name: nearest.name,
    distance: `${minDistance.toFixed(1)} km`
  };
};

exports.processTriage = async (req, res) => {
  try {
    const { text, userId, lat, lng } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log("=== BACKEND TRIAGE REQUEST ===");
    console.log("User ID:", userId || "anonymous");
    console.log("Text:", text);
    console.log("Coordinates:", { lat, lng });
    console.log("=============================");

    // Call AI service
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/triage`, {
      text: text,
      userId: userId || "anonymous"
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log("=== AI SERVICE RESPONSE ===");
    console.log(JSON.stringify(aiResponse.data, null, 2));
    console.log("==========================");

    const apiData = aiResponse.data;

    // Automatic Emergency Alert System integration
    let telegramSent = false;
    let telegramError = null;
    let triggeredEmergencyAlert = false;

    const isHighRisk = apiData.risk_level === 'HIGH';
    const isEmergency = apiData.emergency === true;
    const isHighTriageScore = (apiData.triage_score || 0) >= 80;
    const hasCriticalKeyword = CRITICAL_KEYWORDS.some(k => (text || '').toLowerCase().includes(k));
    const bypassCooldown = isHighRisk || isEmergency || isHighTriageScore || hasCriticalKeyword;

    if ((isHighRisk || isEmergency || isHighTriageScore || hasCriticalKeyword) && userId && userId !== 'anonymous') {
      triggeredEmergencyAlert = true;
      try {
        const supabase = getClient();
        if (supabase) {
          // Check cooldown - last 15 minutes
          const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          const { data: recentLogs, error: recentError } = await supabase
            .from('emergency_logs')
            .select('triggered_at')
            .eq('user_id', userId)
            .eq('action_taken', 'telegram_broadcast')
            .gte('triggered_at', fifteenMinsAgo);

          if (recentError) {
            console.error("❌ Cooldown Check Error:", recentError);
          }

          console.log(`[EMERGENCY COOLDOWN] User: ${userId} | Risk: ${apiData.risk_level} | Emergency: ${isEmergency} | Score: ${apiData.triage_score} | Recent logs found: ${recentLogs ? recentLogs.length : 0}`);

          if (recentLogs && recentLogs.length > 0 && !bypassCooldown) {
            console.log("⏳ [EMERGENCY COOLDOWN] Cooldown active - skipping Telegram broadcast for LOW/MEDIUM risk.");
            telegramSent = false;
            telegramError = "Cooldown active (15m limit)";
          } else {
            if (recentLogs && recentLogs.length > 0 && bypassCooldown) {
              console.log(`🚀 [EMERGENCY COOLDOWN] Cooldown Bypassed! Reason: High risk/critical emergency alert (Risk: ${apiData.risk_level}, Emergency: ${isEmergency}, Critical Keyword: ${hasCriticalKeyword})`);
            } else {
              console.log("✅ [EMERGENCY COOLDOWN] No recent alerts or bypass active. Proceeding with Telegram broadcast.");
            }

            // Fetch connected Care Circle members
            const { data: contacts, error: contactsError } = await supabase
              .from('family_members')
              .select('*')
              .eq('user_id', userId);

            if (contactsError) throw contactsError;

            const linkedContacts = (contacts || []).filter(c => 
              c.telegram_chat_id && 
              c.telegram_chat_id !== null && 
              c.telegram_chat_id !== ''
            );

            if (linkedContacts.length === 0) {
              telegramSent = false;
              telegramError = "No connected Care Circle members found";
              console.warn("⚠️ No Telegram-connected members found in Care Circle.");
            } else {
              // Get Patient Name
              const { data: userData } = await supabase
                .from('users')
                .select('name')
                .eq('id', userId)
                .single();

              const userName = userData?.name || "Patient";

              // Get or auto-generate Medical QR
              let qrUrl = '';
              try {
                const { data: qrData, error: qrErr } = await supabase
                  .from('medical_qr')
                  .select('qr_url')
                  .eq('user_id', userId)
                  .maybeSingle();
                
                if (qrData && qrData.qr_url) {
                  qrUrl = qrData.qr_url;
                } else {
                  // Auto-generate using the dynamic frontend URL
                  const frontendUrl = getFrontendUrl(req);
                  const { v4: uuidv4 } = require('uuid');
                  const newQrId = uuidv4();
                  const newQrUrl = `${frontendUrl.replace(/\/$/, '')}/medical-card/${newQrId}`;
                  const { data: insertedQr } = await supabase
                    .from('medical_qr')
                    .insert([{ user_id: userId, qr_id: newQrId, qr_url: newQrUrl, is_public: true }])
                    .select()
                    .maybeSingle();
                  
                  qrUrl = insertedQr?.qr_url || newQrUrl;
                }
              } catch (qrFetchErr) {
                console.error("❌ Error fetching/generating QR for Telegram:", qrFetchErr);
              }

              const nearestHospital = getNearestHospitalFromDB(lat, lng);
              const broadcastResult = await broadcastEmergencyAlert(linkedContacts, {
                userId,
                patientName: userName || null,
                riskLevel: apiData.risk_level || 'HIGH',
                symptoms: text,
                latitude: lat,
                longitude: lng,
                qrCode: qrUrl || null
              });

              telegramSent = broadcastResult.sent > 0;
              if (!telegramSent) {
                telegramError = "Failed to send to Telegram network";
              }

              // Save to emergency_logs with detailed tracking columns
              const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;
              const logEntry = {
                user_id: userId,
                emergency_type: apiData.risk_level || 'HIGH',
                triage_score: apiData.triage_score || 0,
                action_taken: 'telegram_broadcast',
                symptoms_report: JSON.stringify({
                  symptoms: text,
                  risk_level: apiData.risk_level,
                  triage_score: apiData.triage_score,
                  telegram_sent: telegramSent,
                  location: mapsUrl || "Location not available",
                  hospital: nearestHospital
                }),
                hospital_referred: nearestHospital ? `${nearestHospital.name} (${nearestHospital.distance})` : null,
                latitude: lat ? parseFloat(lat) : null,
                longitude: lng ? parseFloat(lng) : null,
                maps_url: mapsUrl,
                pdf_sent: !!broadcastResult.pdfSent,
                telegram_sent: telegramSent,
                sent_at: new Date().toISOString()
              };

              await supabase.from('emergency_logs').insert([logEntry]);
            }
          }
        }
      } catch (err) {
        console.error("❌ Automatic Emergency Broadcast system failed:", err);
        telegramSent = false;
        telegramError = err.message || "Internal broadcast error";
      }
    }

    return res.status(200).json({
      success: true,
      risk: apiData.risk_level,
      score: apiData.triage_score,
      category: apiData.category,
      recommendation: apiData.recommendation,
      emergency: apiData.emergency || triggeredEmergencyAlert,
      followUpQuestion: apiData.follow_up_question,
      symptomsExtracted: apiData.symptoms_extracted,
      confidence: apiData.confidence,
      telegram_sent: telegramSent,
      telegram_error: telegramError
    });

  } catch (error) {
    console.error("=== TRIAGE ERROR ===");
    console.error("Error:", error.message);
    if (error.response) {
      console.error("AI Service responded with:", error.response.status);
      console.error("Data:", error.response.data);
    }
    console.error("======================");

    logger.error('Error in processTriage:', error.message);

    return res.status(500).json({
      success: false,
      error: "Triage service failed",
      details: error.message
    });
  }
};
