const axios = require('axios');
const logger = require('../utils/logger');
const env = require('../config/env');

const AI_SERVICE_URL = env.aiService.url;

async function callTriage(input) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/triage`,
      {
        text: input.text,
        userId: input.userId
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${env.aiService.apiKey}`
        }
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    
    logger.error('AI Service Error:', {
      message: errorMessage,
      status: error.response?.status
    });

    return {
      success: false,
      error: errorMessage,
      fallback: getMockTriageResponse(input.text)
    };
  }
}

function getMockTriageResponse(text) {
  return {
    risk_level: 'MEDIUM',
    recommendation: 'Please consult a doctor for a professional evaluation.',
    emergency: false,
    is_mock: true
  };
}

/**
 * Retry wrapper with exponential backoff for AI service calls
 */
async function callWithRetry(fn, maxRetries = 3) {
  const delays = [2000, 5000, 10000]; // 2s, 5s, 10s

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = error.response?.status >= 500 || error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      logger.warn(`[RETRY] Attempt ${attempt} failed, waiting ${delays[attempt - 1]}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
    }
  }
}

async function callCopilot(message, context) {
  const startTime = Date.now();

  logger.info('[COPILOT] ═══════════════════════════════════════════');
  logger.info('[COPILOT] Incoming copilot request');
  logger.info(`[COPILOT] Message: "${message.substring(0, 100)}..."`);
  logger.info(`[COPILOT] Context keys: ${Object.keys(context).join(', ')}`);
  logger.info(`[COPILOT] Timeline entries: ${Array.isArray(context.timeline) ? context.timeline.length : 0}`);
  logger.info(`[COPILOT] Reports count: ${Array.isArray(context.reports) ? context.reports.length : 0}`);
  logger.info(`[COPILOT] Hospitals count: ${Array.isArray(context.hospitals) ? context.hospitals.length : 0}`);
  logger.info(`[COPILOT] Has medical QR: ${!!context.medicalQr}`);
  logger.info(`[COPILOT] Calling AI service at: ${AI_SERVICE_URL}/triage/copilot`);

  try {
    // Try with retry logic
    const response = await callWithRetry(async () => {
      return await axios.post(
        `${AI_SERVICE_URL}/triage/copilot`,
        {
          message,
          context
        },
        {
          timeout: 60000,
          headers: {
            'Authorization': `Bearer ${env.aiService.apiKey}`
          }
        }
      );
    }, 3);

    const elapsed = Date.now() - startTime;
    logger.info(`[COPILOT] ✅ AI service responded in ${elapsed}ms`);
    logger.info(`[COPILOT] Gemini success: true`);
    logger.info(`[COPILOT] Response success: ${response.data?.success}`);
    logger.info(`[COPILOT] Response answer length: ${response.data?.answer?.length || 0}`);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error.response?.data?.message || error.response?.data?.detail?.message || error.message;
    const statusCode = error.response?.status || 'N/A';

    logger.error(`[COPILOT] ✗ AI service failed after ${elapsed}ms`);
    logger.error(`[COPILOT] Status: ${statusCode}`);
    logger.error(`[COPILOT] Error: ${errorMessage}`);
    logger.error(`[COPILOT] Full error detail: ${JSON.stringify(error.response?.data || error.message)}`);
    logger.info('[COPILOT] Gemini fallback activated - using local clinical reasoning');

    // ── FALLBACK MODE (LOCAL CLINICAL REASONING) ─────────────────
    logger.info('[COPILOT] Activating FALLBACK mode — generating local summary');

    const fallbackAnswer = generateFallbackAnswer(message, context);

    return {
      success: true,
      data: {
        success: true,
        answer: fallbackAnswer,
        source: 'fallback',
        timelineCount: Array.isArray(context.timeline) ? context.timeline.length : 0,
        reportCount: Array.isArray(context.reports) ? context.reports.length : 0
      },
      isFallback: true
    };
  }
}

/**
 * Generate a local summary from available patient context when Gemini/AI service fails.
 */
function generateFallbackAnswer(message, context) {
  const msgLower = (message || '').toLowerCase();
  const timeline = context.timeline || [];
  const reports = context.reports || [];
  const hospitals = context.hospitals || [];
  const careCircle = context.careCircle || [];
  const medicalQr = context.medicalQr || {};
  const patientInfo = medicalQr.patient_info || {};
  const medicalInfo = medicalQr.medical_info || {};
  
  // ── Hospital query ──
  if (msgLower.includes('hospital') || msgLower.includes('nearby')) {
    if (hospitals.length > 0) {
      const hList = hospitals.slice(0, 5).map((h, i) => 
        `${i + 1}. ${h.name} — ${h.address || 'Nearby'} (Rating: ${h.rating || 'N/A'})`
      ).join('\n');
      return `Based on your location, here are the nearest recommended hospitals:\n\n${hList}\n\nPlease visit one of these facilities if you need immediate attention.\n\n⚠️ Note: This response was generated from cached data (AI service temporarily unavailable).`;
    }
    return 'No nearby hospitals data could be loaded. Please ensure location permissions are enabled.\n\n⚠️ Note: AI service temporarily unavailable.';
  }
  
  // ── Symptom / Timeline query ──
  if (msgLower.includes('symptom') || msgLower.includes('timeline') || msgLower.includes('summarize') || msgLower.includes('analyze')) {
    if (timeline.length > 0) {
      const tList = timeline.map(t => 
        `• ${t.date}: ${t.symptoms} (Severity: ${t.severity}, Risk: ${t.risk_level || 'N/A'})`
      ).join('\n');
      return `Symptom Timeline Summary (${timeline.length} entries):\n\n${tList}\n\nBased on your recorded entries, please continue monitoring symptoms and consult your healthcare provider if severity increases.\n\n⚠️ Note: This summary was generated from your local data (AI service temporarily unavailable).`;
    }
    return 'You have not logged any symptom entries yet. Use the Daily Log feature to record your symptoms.\n\n⚠️ Note: AI service temporarily unavailable.';
  }
  
  // ── Emergency / SOS query ──
  if (msgLower.includes('emergency') || msgLower.includes('sos') || msgLower.includes('contact')) {
    const contacts = careCircle.map(c => `• ${c.name} (${c.relation}): ${c.phone}`).join('\n');
    const emergencyContact = medicalQr.emergency_info?.emergency_contact || 'None provided';
    return `Emergency Information:\n\nPrimary Emergency Contact: ${emergencyContact}\n\nCare Circle:\n${contacts || 'No Care Circle contacts linked.'}\n\nIn case of critical urgency, dial 108 (Ambulance) or 102 (National Helpline).\n\n⚠️ Note: AI service temporarily unavailable.`;
  }
  
  // ── Doctor Summary query ──
  if (msgLower.includes('doctor') || msgLower.includes('summary') || msgLower.includes('clinical')) {
    const conditions = (medicalInfo.conditions || []).join(', ') || 'None logged';
    const medications = (medicalInfo.medications || []).join(', ') || 'None logged';
    const allergies = (medicalInfo.allergies || []).join(', ') || 'None logged';
    const recentSymptoms = timeline.length > 0 
      ? timeline.slice(-3).map(t => `${t.date}: ${t.symptoms}`).join('; ')
      : 'No recent symptoms recorded';
    
    return `Doctor Consultation Summary for ${patientInfo.name || 'Patient'}:\n\nBlood Group: ${patientInfo.blood_group || 'N/A'}\nChronic Conditions: ${conditions}\nActive Medications: ${medications}\nKnown Allergies: ${allergies}\n\nRecent Symptoms: ${recentSymptoms}\n\nPlease present this summary to your doctor at your next appointment.\n\n⚠️ Note: This summary was generated from your local data (AI service temporarily unavailable).`;
  }
  
  // ── Risk / Progress query ──
  if (msgLower.includes('risk') || msgLower.includes('progress')) {
    if (timeline.length > 0) {
      const latest = timeline[timeline.length - 1];
      return `Latest Risk Assessment:\n\nDate: ${latest.date}\nSymptoms: ${latest.symptoms}\nSeverity: ${latest.severity}\nRisk Level: ${latest.risk_level || 'N/A'}\n\nTotal logged entries: ${timeline.length}\nPlease continue monitoring daily.\n\n⚠️ Note: AI service temporarily unavailable.`;
    }
    return 'No symptom data available for risk assessment. Start logging daily symptoms to enable analysis.\n\n⚠️ Note: AI service temporarily unavailable.';
  }
  
  // ── General / Health History fallback ──
  const name = patientInfo.name || 'Patient';
  const bloodGroup = patientInfo.blood_group || 'N/A';
  const conditions = (medicalInfo.conditions || []).join(', ') || 'None logged';
  const medications = (medicalInfo.medications || []).join(', ') || 'None logged';
  const allergies = (medicalInfo.allergies || []).join(', ') || 'None logged';
  
  return `Health Overview for ${name}:\n\nBlood Group: ${bloodGroup}\nChronic Conditions: ${conditions}\nActive Medications: ${medications}\nKnown Allergies: ${allergies}\n\nTimeline Entries: ${timeline.length}\nMedical Reports: ${reports.length}\nNearby Hospitals: ${hospitals.length}\nCare Circle Contacts: ${careCircle.length}\n\nAll records appear up to date. Continue logging daily symptoms for comprehensive tracking.\n\n⚠️ Note: This response was generated from your local data (AI service temporarily unavailable).`;
}

module.exports = {
  callTriage,
  getMockTriageResponse,
  callCopilot
};
