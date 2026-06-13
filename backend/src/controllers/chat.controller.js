const { callTriage, callCopilot } = require('../services/ai.service');
const { executeTool, getTools, getToolDefinitionsForAI } = require('../services/copilotTools');
const logger = require('../utils/logger');
const { ValidationError } = require('../middleware/error.middleware');

/**
 * Detect which tool to use based on the message
 */
function detectToolIntent(message) {
  const msgLower = (message || '').toLowerCase();

  const toolPatterns = {
    get_timeline_data: ['timeline', 'symptom log', 'daily log', 'symptoms history', 'show my symptoms'],
    get_symptoms_history: ['symptoms history', 'symptom progression', 'symptom trend', 'analyze symptoms'],
    get_latest_triage: ['latest triage', 'recent triage', 'last assessment', 'current risk'],
    get_medical_reports: ['reports', 'medical reports', 'lab results', 'test results'],
    generate_doctor_summary: ['doctor summary', 'clinical summary', 'consultation summary', 'doctor report'],
    generate_medical_pdf: [
      'generate medical report',
      'generate report',
      'medical report',
      'generate pdf',
      'download pdf',
      'download report',
      'export report',
      'doctor report pdf',
      'clinical report pdf',
      'pdf'
    ],
    search_nearby_hospitals: ['hospital', 'hospitals', 'clinic', 'medical center', 'nearby hospital', 'nearest hospital', 'find hospital', 'hospitals near'],
    get_emergency_contacts: ['emergency contact', 'care circle', 'family contacts', 'who to call'],
    trigger_emergency_alert: ['emergency', 'sos', 'send alert', 'help me', 'emergency alert'],
    get_user_profile: ['profile', 'my info', 'my details', 'personal info'],
    get_qr_code_data: ['qr code', 'medical qr', 'qr card', 'emergency qr'],
    analyze_symptom_progression: ['analyze', 'progression', 'trend', 'worsening', 'improving']
  };

  for (const [toolName, patterns] of Object.entries(toolPatterns)) {
    if (patterns.some(p => msgLower.includes(p))) {
      return toolName;
    }
  }

  return null;
}

async function processChatMessage(req, res, next) {
  try {
    const { text, userId } = req.body;

    if (!text || typeof text !== 'string') {
      throw new ValidationError('Message text is required');
    }

    const triageResult = await callTriage({
      text: text.trim(),
      userId: userId || 'anonymous'
    });

    if (!triageResult.success && !triageResult.fallback) {
      return res.status(500).json({
        success: false,
        message: triageResult.error || 'AI service failed'
      });
    }

    res.status(200).json({
      success: true,
      data: triageResult.data || triageResult.fallback,
      isFallback: !!triageResult.fallback
    });
  } catch (error) {
    next(error);
  }
}

async function getTriageWithNearestHospital(req, res, next) {
  try {
    const { text, userId } = req.body;
    if (!text) throw new ValidationError('Text is required');

    const triageResult = await callTriage({ text, userId });
    
    res.status(200).json({
      success: true,
      data: triageResult.data || triageResult.fallback
    });
  } catch (error) {
    next(error);
  }
}

async function queryCopilot(req, res, next) {
  const requestId = `cop-${Date.now()}`;
  const userId = req.user?.id || 'unknown';

  try {
    const { message, context } = req.body;

    const timelineCount = Array.isArray(context?.timeline) ? context.timeline.length : 0;
    const reportsCount = Array.isArray(context?.reports) ? context.reports.length : 0;

    // Detailed debug logging
    logger.info(`[COPILOT][${requestId}] ═════════════════════════════════════════════════`);
    logger.info(`[COPILOT][${requestId}] === COPILOT DEBUG ===`);
    logger.info(`[COPILOT][${requestId}] User: ${userId}`);
    logger.info(`[COPILOT][${requestId}] Timeline Count: ${timelineCount}`);
    logger.info(`[COPILOT][${requestId}] Symptoms Count: ${reportsCount}`);
    logger.info(`[COPILOT][${requestId}] Reports Count: ${reportsCount}`);
    logger.info(`[COPILOT][${requestId}] Consultations Count: 0`);
    logger.info(`[COPILOT][${requestId}] Has medical QR: ${!!context?.medicalQr}`);
    if (timelineCount > 0) {
      logger.info(`[COPILOT][${requestId}] Timeline Sample:`, context.timeline.slice(0, 2));
    }
    logger.info(`[COPILOT][${requestId}] ====================`);
    logger.info(`[COPILOT][${requestId}] Message: "${(message || '').substring(0, 80)}..."`);

    if (!message) throw new ValidationError('Message is required');

    // ═══════════════════════════════════════════════════════════════════════
    // TOOL DETECTION & EXECUTION
    // ═══════════════════════════════════════════════════════════════════════
    const detectedTool = detectToolIntent(message);
    logger.info(`[COPILOT][${requestId}] Detected tool intent: ${detectedTool || 'none'}`);

    let toolResult = null;
    let answer = '';
    let source = 'gemini';

    if (detectedTool) {
      // Execute the detected tool with full context (Phase 4 - Hospital tool needs context)
      logger.info(`[COPILOT][${requestId}] Executing tool: ${detectedTool}`);
      logger.info(`[COPILOT][${requestId}] Timeline fetched: ${timelineCount}`);
      logger.info(`[COPILOT][${requestId}] Reports fetched: ${reportsCount}`);
      logger.info(`[COPILOT][${requestId}] Hospitals fetched: ${context?.hospitals?.length || 0}`);

      toolResult = await executeTool(detectedTool, userId, { context });

      if (toolResult?.success) {
        logger.info(`[COPILOT][${requestId}] Tool executed successfully`);
        
        // Return raw JSON instead of text-formatted answers for UI Widgets
        const toolPayload = {
          success: true,
          source: 'tool',
          timelineCount: Array.isArray(context?.timeline) ? context.timeline.length : 0,
          reportCount: Array.isArray(context?.reports) ? context.reports.length : 0
        };

        if (detectedTool === "search_nearby_hospitals") {
          return res.status(200).json({
            ...toolPayload,
            type: "hospital_cards",
            title: "Nearby Hospitals",
            answer: "🏥 **Nearby Hospitals Found**",
            hospitals: toolResult.data.hospitals || []
          });
        }
        
        if (detectedTool === "get_timeline_data" || detectedTool === "get_symptoms_history") {
          return res.status(200).json({
            ...toolPayload,
            type: "timeline",
            answer: "📋 **SYMPTOM TIMELINE**",
            timelineData: toolResult.data || null
          });
        }

        if (detectedTool === "get_latest_triage") {
          return res.status(200).json({
            ...toolPayload,
            type: "health_summary",
            answer: "📊 **HEALTH SUMMARY**",
            triageData: toolResult.data || null
          });
        }

        if (detectedTool === "generate_doctor_summary") {
          return res.status(200).json({
            ...toolPayload,
            type: "doctor_summary",
            answer: "🩺 **DOCTOR SUMMARY**",
            summaryData: toolResult.data || null
          });
        }

        if (detectedTool === "get_qr_code_data") {
          return res.status(200).json({
            ...toolPayload,
            type: "qr",
            answer: "🪪 **MEDICAL IDENTITY CARD**",
            qrData: toolResult.data || null
          });
        }

        if (detectedTool === "analyze_symptom_progression") {
          return res.status(200).json({
            ...toolPayload,
            type: "insights",
            answer: "📈 **HEALTH INSIGHTS**",
            insightsData: toolResult.data || null
          });
        }

        if (detectedTool === "get_medical_reports") {
          return res.status(200).json({
            ...toolPayload,
            type: "reports",
            answer: "📋 **MEDICAL REPORTS**",
            reportsData: toolResult.data || null
          });
        }

        if (detectedTool === "get_emergency_contacts" || detectedTool === "trigger_emergency_alert") {
          return res.status(200).json({
            ...toolPayload,
            type: "emergency_panel",
            answer: "🚨 **EMERGENCY ASSISTANCE**",
            emergencyData: toolResult.data || null
          });
        }

        if (detectedTool === "generate_medical_pdf") {
          return res.status(200).json({
            ...toolPayload,
            type: "pdf_ready",
            answer: "📄 **MEDICAL REPORT READY**",
            downloadUrl: toolResult.data.pdfUrl || null
          });
        }
        
        // Format the tool result into a structured response
        answer = formatToolResult(detectedTool, toolResult.data);
        source = 'tool';
      } else {
        logger.warn(`[COPILOT][${requestId}] Tool execution failed: ${toolResult?.error}`);
        // Fall through to normal AI processing
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AI COPILOT PROCESSING (if no tool or tool failed)
    // ═══════════════════════════════════════════════════════════════════════
    if (!answer) {
      const copilotResult = await callCopilot(message, context || {});

      logger.info(`[COPILOT][${requestId}] Service responded: success=${copilotResult.success}, isFallback=${!!copilotResult.isFallback}`);

      if (!copilotResult.success) {
        logger.error(`[COPILOT][${requestId}] ✗ Copilot failed: ${copilotResult.error}`);
        return res.status(500).json({
          success: false,
          message: copilotResult.error || 'AI copilot service failed',
          source: 'error',
          timelineCount: Array.isArray(context?.timeline) ? context.timeline.length : 0,
          reportCount: Array.isArray(context?.reports) ? context.reports.length : 0
        });
      }

      // Build the standardized response
      const responseData = copilotResult.data || {};
      answer = responseData.answer || responseData;
      source = copilotResult.isFallback ? 'fallback' : (responseData.source || 'gemini');
    }

    logger.info(`[COPILOT][${requestId}] ✅ Sending response. Source: ${source}, Answer length: ${typeof answer === 'string' ? answer.length : 'N/A'}`);

    // Phase 6: Clean output - remove internal tool names from user-facing response
    // Phase 8: Ensure professional medical assistant style responses
    const cleanAnswer = ensureProfessionalResponse(answer, source, context);

    const payload = {
      success: true,
      answer: cleanAnswer,
      source,
      toolExecuted: detectedTool, // Keep for debugging but don't show to user
      toolData: toolResult?.data || null,
      timelineCount: Array.isArray(context?.timeline) ? context.timeline.length : 0,
      reportCount: Array.isArray(context?.reports) ? context.reports.length : 0
    };

    if (detectedTool === 'generate_medical_pdf' && toolResult?.data?.pdfGenerated) {
      payload.type = 'pdf_ready';
      payload.downloadUrl = toolResult.data.pdfUrl;
    }

    if (detectedTool === 'search_nearby_hospitals' && toolResult?.data?.hospitals) {
      payload.type = 'hospital_cards';
      payload.hospitals = toolResult.data.hospitals;
    }

    if (detectedTool === 'get_emergency_contacts' || detectedTool === 'trigger_emergency_alert') {
      payload.type = 'emergency_panel';
      payload.emergencyData = toolResult?.data || null;
    }

    res.status(200).json(payload);
  } catch (error) {
    logger.error(`[COPILOT][${requestId}] ✗ Exception: ${error.message}`);
    logger.error(`[COPILOT][${requestId}] Stack: ${error.stack}`);
    next(error);
  }
}

/**
 * Format tool execution result into a readable response
 */
function formatToolResult(toolName, data) {
  if (!data) return 'No data available';

  switch (toolName) {
    case 'get_timeline_data':
    case 'get_symptoms_history':
      return formatTimelineResponse(data);

    case 'get_latest_triage':
      return formatTriageResponse(data);

    case 'generate_doctor_summary':
      return formatDoctorSummary(data);

    case 'generate_medical_pdf':
      return formatPdfResponse(data);

    case 'get_emergency_contacts':
      return formatEmergencyContacts(data);

    case 'get_user_profile':
      return formatProfileResponse(data);

    case 'get_qr_code_data':
      return formatQRData(data);

    case 'analyze_symptom_progression':
      return formatProgressionAnalysis(data);

    case 'get_medical_reports':
      return formatMedicalReports(data);

    case 'search_nearby_hospitals':
      return formatHospitalsResponse(data);

    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatPdfResponse(data) {
  if (data.pdfGenerated) {
    return [
      '📄 **Medical Report Ready**\n',
      'Your comprehensive medical report has been generated.\n',
      'Includes:',
      '• Symptom Timeline',
      '• Risk Assessments',
      '• Medical Reports',
      '• Clinical Summary'
    ].join('\n');
  }
  return 'Unable to generate PDF at this time.';
}

function formatTimelineResponse(data) {
  if (data.entries && Array.isArray(data.entries)) {
    const entries = data.entries.slice(-10); // Last 10 entries
    const lines = ['📋 **SYMPTOM TIMELINE**\n'];

    if (data.trends) {
      lines.push(`Total Entries: ${data.trends.totalEntries}`);
      if (data.trends.dateRange?.start && data.trends.dateRange?.end) {
        lines.push(`Period: ${data.trends.dateRange.start} to ${data.trends.dateRange.end}`);
      }
      lines.push('');
    }

    entries.forEach(e => {
      lines.push(`📅 **${e.date}**`);
      lines.push(`   Symptoms: ${e.symptoms}`);
      lines.push(`   Severity: ${e.severity} | Risk: ${e.risk_level || 'N/A'}`);
      if (e.ai_summary) {
        lines.push(`   Summary: ${e.ai_summary.substring(0, 100)}...`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }
  return 'No timeline data available';
}

function formatTriageResponse(data) {
  const lines = ['🩺 **LATEST TRIAGE ASSESSMENT**\n'];
  lines.push(`Date: ${data.date}`);
  lines.push(`Symptoms: ${data.symptoms}`);
  lines.push(`Risk Level: ${data.riskLevel}`);
  lines.push(`Severity: ${data.severity}`);
  if (data.triageScore) {
    lines.push(`Triage Score: ${data.triageScore}/100`);
  }
  lines.push('');
  lines.push('**Recommendation:**');
  lines.push(data.recommendation || data.aiSummary || 'No recommendation available');

  return lines.join('\n');
}

function formatDoctorSummary(data) {
  const lines = ['📋 **DOCTOR CONSULTATION SUMMARY**\n'];

  if (data.patientInfo) {
    lines.push('**Patient Information:**');
    lines.push(`Name: ${data.patientInfo.name}`);
    lines.push(`Age: ${data.patientInfo.age} | Gender: ${data.patientInfo.gender}`);
    lines.push(`Blood Group: ${data.patientInfo.bloodGroup}`);
    lines.push('');
  }

  if (data.medicalHistory) {
    lines.push('**Medical History:**');
    lines.push(`Allergies: ${data.medicalHistory.allergies?.join(', ') || 'None'}`);
    lines.push(`Conditions: ${data.medicalHistory.conditions?.join(', ') || 'None'}`);
    lines.push(`Medications: ${data.medicalHistory.medications?.join(', ') || 'None'}`);
    lines.push('');
  }

  if (data.recentSymptoms && data.recentSymptoms.length > 0) {
    lines.push('**Recent Symptoms:**');
    data.recentSymptoms.forEach(s => {
      lines.push(`• ${s.date}: ${s.symptoms} (${s.severity})`);
    });
    lines.push('');
  }

  if (data.statistics) {
    lines.push(`**Timeline Statistics:**`);
    lines.push(`Total Entries: ${data.statistics.totalEntries}`);
    if (data.statistics.dateRange?.first) {
      lines.push(`Period: ${data.statistics.dateRange.first} to ${data.statistics.dateRange.last}`);
    }
  }

  return lines.join('\n');
}

function formatEmergencyContacts(data) {
  const lines = ['🚨 **EMERGENCY CONTACTS**\n'];

  if (data.primaryContact) {
    lines.push('**Primary Contact:**');
    lines.push(`📱 ${data.primaryContact.phone} (${data.primaryContact.relation})`);
    lines.push('');
  }

  if (data.careCircle && data.careCircle.length > 0) {
    lines.push('**Care Circle (Emergency):**');
    data.careCircle.forEach(c => {
      lines.push(`• ${c.name} (${c.relation}): ${c.phone}`);
    });
    lines.push('');
  }

  if (data.emergencyServices) {
    lines.push('**Emergency Services:**');
    data.emergencyServices.forEach(s => {
      lines.push(`📞 ${s.name}: ${s.phone} - ${s.description}`);
    });
  }

  return lines.join('\n');
}

function formatProfileResponse(data) {
  const lines = ['👤 **USER PROFILE**\n'];
  lines.push(`Name: ${data.name}`);
  lines.push(`Age: ${data.age} | Gender: ${data.gender}`);
  lines.push(`Blood Type: ${data.bloodType}`);
  lines.push('');
  lines.push('**Medical Information:**');
  lines.push(`Allergies: ${data.allergies?.join(', ') || 'None recorded'}`);
  lines.push(`Conditions: ${data.conditions?.join(', ') || 'None recorded'}`);
  lines.push(`Medications: ${data.medications?.join(', ') || 'None recorded'}`);
  lines.push('');
  lines.push(`Emergency Contact: ${data.emergencyContact || 'Not configured'}`);

  return lines.join('\n');
}

function formatQRData(data) {
  const lines = ['🪪 **MEDICAL QR CODE DATA**\n'];

  if (data.patientInfo) {
    lines.push('**Patient:**');
    lines.push(`${data.patientInfo.name} | ${data.patientInfo.age}yrs | ${data.patientInfo.gender}`);
    lines.push(`Blood Group: ${data.patientInfo.bloodGroup}`);
    lines.push('');
  }

  if (data.medicalInfo) {
    lines.push('**Medical Info:**');
    lines.push(`Allergies: ${data.medicalInfo.allergies?.join(', ') || 'None'}`);
    lines.push(`Conditions: ${data.medicalInfo.conditions?.join(', ') || 'None'}`);
    lines.push(`Medications: ${data.medicalInfo.medications?.join(', ') || 'None'}`);
    lines.push('');
  }

  if (data.emergencyInfo) {
    lines.push(`**Emergency Contact:** ${data.emergencyInfo.emergencyContact || 'None'}`);
  }

  return lines.join('\n');
}

function formatProgressionAnalysis(data) {
  const lines = ['📈 **SYMPTOM PROGRESSION ANALYSIS**\n'];

  if (data.summary) {
    lines.push(`**Period:** ${data.summary.dateRange?.start} to ${data.summary.dateRange?.end}`);
    lines.push(`Total Entries: ${data.summary.totalEntries}`);
    lines.push(`Progression: ${data.summary.progression?.toUpperCase() || 'Unknown'}`);
    lines.push('');
  }

  if (data.topSymptoms && data.topSymptoms.length > 0) {
    lines.push('**Most Frequent Symptoms:**');
    data.topSymptoms.forEach(s => {
      lines.push(`• ${s.symptom}: ${s.occurrences} occurrences`);
    });
    lines.push('');
  }

  if (data.analysis) {
    lines.push('**Analysis:**');
    lines.push(`Frequent: ${data.analysis.frequentSymptoms}`);
    lines.push(`Status: ${data.analysis.progressionStatus}`);
    lines.push('');
    lines.push(`**Recommendation:** ${data.analysis.recommendation}`);
  }

  return lines.join('\n');
}

function formatMedicalReports(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return 'No medical reports available. Start recording symptoms to generate reports.';
  }

  const lines = ['📋 **MEDICAL REPORTS**\n'];
  data.slice(0, 10).forEach(r => {
    lines.push(`📅 **${r.date}** - ${r.title}`);
    lines.push(`   Doctor: ${r.doctor}`);
    lines.push(`   Summary: ${r.summary}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Phase 4: Format hospitals for professional display
 */
function formatHospitalsResponse(data) {
  if (!data || !data.hospitals || data.hospitals.length === 0) {
    return 'No nearby hospitals found. Please ensure location access is enabled.';
  }
  return '🏥 **Nearby Hospitals Found**';
}

/**
 * Phase 6 & 8: Ensure professional, clean output without internal tool names
 */
function ensureProfessionalResponse(answer, source, context) {
  let cleanAnswer = answer;

  // If answer is not a string, convert it
  if (typeof answer !== 'string') {
    cleanAnswer = JSON.stringify(answer, null, 2);
  }

  // Phase 6: Remove any internal tool references from output
  // Replace patterns like "Response from get_timeline_data" with clean text
  cleanAnswer = cleanAnswer.replace(/_Response from \w+\s*\(live data\)_/g, '');
  cleanAnswer = cleanAnswer.replace(/_Response generated from.*?_/g, '');

  // Phase 8: If no data available, provide professional message
  const hasTimeline = Array.isArray(context?.timeline) && context.timeline.length > 0;
  const hasReports = Array.isArray(context?.reports) && context.reports.length > 0;

  if (!hasTimeline && !hasReports) {
    if (cleanAnswer.includes('No data') || cleanAnswer.includes('not available') || cleanAnswer.includes('empty')) {
      return 'No medical data available yet. Start recording symptoms to generate insights.';
    }
  }

  // Phase 8: Add source indicator only for fallback (not for tool executions)
  if (source === 'fallback' && !cleanAnswer.includes('AI service is temporarily busy')) {
    cleanAnswer = cleanAnswer.trim() + '\n\n_AI service is temporarily busy. Using local clinical reasoning._';
  }

  return cleanAnswer.trim();
}

module.exports = {
  processChatMessage,
  getTriageWithNearestHospital,
  queryCopilot
};
