/**
 * ArogyaAI Copilot Tools Registry
 *
 * This module defines all available tools/functions that the Copilot can call.
 * Each tool has:
 * - name: Unique identifier
 * - description: What the tool does
 * - parameters: Input parameters expected
 * - handler: Async function to execute the tool
 */

const timelineStorage = require('../utils/timelineStorage');
const { getClient } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Get Supabase client for database operations
 */
const getDb = () => {
  try {
    const { getClient } = require('../config/db');
    return getClient();
  } catch (e) {
    return null;
  }
};

/**
 * Tool Definitions - These are sent to the AI to know what functions are available
 */
const toolDefinitions = [
  {
    name: 'get_timeline_data',
    description: 'Get all symptom timeline entries for the current user. Returns date, symptoms, severity, risk level, and notes for each entry.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of entries to return (default: 50)' }
      }
    }
  },
  {
    name: 'get_symptoms_history',
    description: 'Get detailed symptoms history with progression analysis. Includes symptom trends over time.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default: 30)' }
      }
    }
  },
  {
    name: 'get_latest_triage',
    description: 'Get the most recent triage assessment result including risk score, category, and recommendation.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_medical_reports',
    description: 'Get all medical reports and lab results. Returns report titles, dates, and summaries.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'generate_doctor_summary',
    description: 'Generate a comprehensive doctor consultation summary based on patient records, symptoms, and medical history.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'generate_medical_pdf',
    description: 'Generate and return a downloadable PDF medical report with all patient data, timeline, and AI analysis.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'search_nearby_hospitals',
    description: 'Search for nearby hospitals based on user location. Returns hospital name, address, rating, phone, and distance.',
    parameters: {
      type: 'object',
      properties: {
        specialty: { type: 'string', description: 'Filter by specialty (e.g., cardiology, emergency, general)' },
        limit: { type: 'number', description: 'Number of results (default: 10)' }
      }
    }
  },
  {
    name: 'get_emergency_contacts',
    description: 'Get all emergency contacts including Care Circle members and primary emergency contact.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'trigger_emergency_alert',
    description: 'Trigger an emergency alert to all Care Circle members with current location.',
    parameters: {
      type: 'object',
      properties: {
        emergencyType: { type: 'string', description: 'Type of emergency (general, cardiac, respiratory, etc.)' }
      }
    }
  },
  {
    name: 'get_user_profile',
    description: 'Get complete user profile including name, age, gender, blood type, allergies, conditions, and medications.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_qr_code_data',
    description: 'Get Medical QR code data including patient info, medical conditions, allergies, and emergency contacts.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'analyze_symptom_progression',
    description: 'Analyze symptom progression over time, detect patterns, and provide trend analysis.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Tool Handlers - Actual implementation of each tool
 * These fetch data from Supabase and other sources
 */
const toolHandlers = {
  /**
   * Get timeline data from Supabase
   */
  get_timeline_data: async (userId, params = {}) => {
    try {
      const limit = params.limit || 50;
      const result = await timelineStorage.getEntries(userId);

      if (result.success) {
        const entries = (result.data || []).slice(-limit);
        return {
          success: true,
          data: entries,
          count: entries.length,
          message: `Found ${entries.length} timeline entries`
        };
      }
      return { success: false, error: 'Failed to fetch timeline' };
    } catch (error) {
      logger.error('[Tools] get_timeline_data error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get symptoms history with trends
   */
  get_symptoms_history: async (userId, params = {}) => {
    try {
      const days = params.days || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await timelineStorage.getEntries(userId);

      if (result.success) {
        const entries = (result.data || []).filter(e => new Date(e.date) >= cutoffDate);

        // Calculate trends
        const symptomsCount = {};
        const severityCount = { SEVERE: 0, MODERATE: 0, MILD: 0 };

        entries.forEach(e => {
          const symptom = (e.symptoms || '').split(',')[0].trim();
          if (symptom) symptomsCount[symptom] = (symptomsCount[symptom] || 0) + 1;
          if (e.severity) severityCount[e.severity] = (severityCount[e.severity] || 0) + 1;
        });

        const topSymptoms = Object.entries(symptomsCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([symptom, count]) => ({ symptom, count }));

        return {
          success: true,
          data: {
            entries,
            trends: {
              totalEntries: entries.length,
              topSymptoms,
              severityBreakdown: severityCount,
              dateRange: entries.length > 0 ? {
                start: entries[0]?.date,
                end: entries[entries.length - 1]?.date
              } : null
            }
          },
          count: entries.length
        };
      }
      return { success: false, error: 'Failed to fetch symptoms history' };
    } catch (error) {
      logger.error('[Tools] get_symptoms_history error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get latest triage result
   */
  get_latest_triage: async (userId, params = {}) => {
    try {
      const db = getClient();
      if (!db) {
        return { success: false, error: 'Database not available' };
      }

      const { data, error } = await db
        .from('symptom_timeline')
        .select('id, date, symptoms, risk_level, severity, ai_summary, triage_score')
        .eq('user_id', userId)
        .not('risk_level', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error('[Tools] get_latest_triage error:', error.message);
        return { success: false, error: error.message };
      }

      if (data) {
        return {
          success: true,
          data: {
            date: data.date,
            symptoms: data.symptoms,
            riskLevel: data.risk_level,
            severity: data.severity,
            triageScore: data.triage_score,
            aiSummary: data.ai_summary,
            recommendation: data.ai_summary
          }
        };
      }

      return { success: false, error: 'No triage results found' };
    } catch (error) {
      logger.error('[Tools] get_latest_triage error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get medical reports (timeline entries treated as reports)
   */
  get_medical_reports: async (userId, params = {}) => {
    try {
      const result = await timelineStorage.getEntries(userId);

      if (result.success) {
        const entries = (result.data || []).map(e => ({
          id: e.id,
          title: e.symptoms || 'Medical Entry',
          date: e.date,
          summary: e.ai_summary || `${e.severity} severity - ${e.risk_level || 'Unknown'} risk`,
          type: 'Timeline Entry',
          doctor: 'AI Assessment'
        }));

        return {
          success: true,
          data: entries,
          count: entries.length
        };
      }
      return { success: false, error: 'Failed to fetch reports' };
    } catch (error) {
      logger.error('[Tools] get_medical_reports error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate doctor summary
   */
  generate_doctor_summary: async (userId, params = {}) => {
    try {
      const db = getClient();

      // Get user profile
      let profile = null;
      if (db) {
        const { data: userData } = await db
          .from('users')
          .select('name, age, gender, blood_type, allergies, conditions, medications, emergency_contact')
          .eq('id', userId)
          .maybeSingle();
        profile = userData;
      }

      // Get timeline entries
      const timelineResult = await timelineStorage.getEntries(userId);
      const entries = timelineResult.success ? timelineResult.data || [] : [];

      // Get latest triage
      let latestTriage = null;
      if (db) {
        const { data: triageData } = await db
          .from('symptom_timeline')
          .select('date, symptoms, risk_level, severity, ai_summary')
          .eq('user_id', userId)
          .not('risk_level', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        latestTriage = triageData;
      }

      // Get care circle
      let careCircle = [];
      if (db) {
        const { data: circleData } = await db
          .from('family_members')
          .select('name, relation, phone')
          .eq('user_id', userId);
        careCircle = circleData || [];
      }

      // Build comprehensive summary
      const summary = {
        patientInfo: {
          name: profile?.name || 'Unknown',
          age: profile?.age || 'N/A',
          gender: profile?.gender || 'N/A',
          bloodGroup: profile?.blood_type || 'Unknown'
        },
        medicalHistory: {
          allergies: profile?.allergies || [],
          conditions: profile?.conditions || [],
          medications: profile?.medications || []
        },
        recentSymptoms: entries.slice(-5).map(e => ({
          date: e.date,
          symptoms: e.symptoms,
          severity: e.severity,
          risk: e.risk_level
        })),
        latestTriage: latestTriage ? {
          date: latestTriage.date,
          symptoms: latestTriage.symptoms,
          riskLevel: latestTriage.risk_level,
          recommendation: latestTriage.ai_summary
        } : null,
        careCircle: careCircle.map(c => ({
          name: c.name,
          relation: c.relation,
          phone: c.phone
        })),
        statistics: {
          totalEntries: entries.length,
          dateRange: entries.length > 0 ? {
            first: entries[0]?.date,
            last: entries[entries.length - 1]?.date
          } : null
        }
      };

      return {
        success: true,
        data: summary,
        message: 'Doctor summary generated successfully'
      };
    } catch (error) {
      logger.error('[Tools] generate_doctor_summary error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate medical PDF
   */
  generate_medical_pdf: async (userId, params = {}) => {
    try {
      return {
        success: true,
        data: {
          pdfGenerated: true,
          pdfUrl: `/api/timeline/pdf`
        },
        message: 'Medical report generated successfully.'
      };
    } catch (error) {
      logger.error('[Tools] generate_medical_pdf error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Search nearby hospitals (uses context from frontend)
   * Phase 4: Always use live hospital data from context
   */
  search_nearby_hospitals: async (userId, params = {}) => {
    const context = params.context || {};
    const hospitals = context.hospitals || [];
    const specialty = params.specialty;

    // Phase 4: Never use hardcoded hospitals - use live data only
    if (hospitals.length === 0) {
      return {
        success: false,
        error: 'No hospital data available. Please ensure location access is enabled.',
        data: []
      };
    }

    // Filter by specialty if provided
    let filtered = hospitals;
    if (specialty) {
      filtered = hospitals.filter(h =>
        h.type?.toLowerCase().includes(specialty.toLowerCase()) ||
        h.name?.toLowerCase().includes(specialty.toLowerCase())
      );
    }

    // Sort by distance if available
    const sorted = filtered.sort((a, b) => {
      const distA = a.distance || 999999;
      const distB = b.distance || 999999;
      return distA - distB;
    });

    const limit = params.limit || 10;
    return {
      success: true,
      data: {
        hospitals: sorted.slice(0, limit),
        count: sorted.slice(0, limit).length,
        source: 'live'
      }
    };
  },

  /**
   * Get emergency contacts
   */
  get_emergency_contacts: async (userId, params = {}) => {
    try {
      const db = getClient();
      if (!db) {
        return { success: false, error: 'Database not available' };
      }

      // Get user profile for primary emergency contact
      let profile = null;
      let primaryContact = null;

      const { data: userData } = await db
        .from('users')
        .select('name, emergency_contact')
        .eq('id', userId)
        .maybeSingle();

      profile = userData;
      if (profile?.emergency_contact) {
        primaryContact = {
          name: 'Primary Contact',
          phone: profile.emergency_contact,
          relation: 'Designated Emergency Contact'
        };
      }

      // Get care circle members
      const { data: circleData } = await db
        .from('family_members')
        .select('name, relation, phone, is_emergency_contact')
        .eq('user_id', userId);

      const emergencyContacts = (circleData || [])
        .filter(c => c.is_emergency_contact)
        .map(c => ({
          name: c.name,
          relation: c.relation,
          phone: c.phone
        }));

      return {
        success: true,
        data: {
          primaryContact,
          careCircle: emergencyContacts,
          emergencyServices: [
            { name: 'Ambulance', phone: '108', description: 'National Emergency' },
            { name: 'Medical Helpline', phone: '102', description: 'National Medical Helpline' }
          ]
        }
      };
    } catch (error) {
      logger.error('[Tools] get_emergency_contacts error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Trigger emergency alert
   */
  trigger_emergency_alert: async (userId, params = {}) => {
    try {
      const emergencyType = params.emergencyType || 'general';

      logger.info(`[Tools] Emergency alert triggered by ${userId}, type: ${emergencyType}`);

      // Note: Actual alert sending is handled by the emergency controller
      // This tool just confirms the action can be performed
      return {
        success: true,
        data: {
          status: 'alert_triggered',
          emergencyType,
          message: `Emergency alert (${emergencyType}) can be sent to Care Circle`,
          note: 'Use /api/emergency endpoint to send actual alerts'
        }
      };
    } catch (error) {
      logger.error('[Tools] trigger_emergency_alert error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get user profile
   */
  get_user_profile: async (userId, params = {}) => {
    try {
      const db = getClient();
      if (!db) {
        return { success: false, error: 'Database not available' };
      }

      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('[Tools] get_user_profile error:', error.message);
        return { success: false, error: error.message };
      }

      if (data) {
        return {
          success: true,
          data: {
            name: data.name,
            email: data.email,
            age: data.age,
            gender: data.gender,
            bloodType: data.blood_type,
            allergies: data.allergies || [],
            conditions: data.conditions || [],
            medications: data.medications || [],
            emergencyContact: data.emergency_contact
          }
        };
      }

      return { success: false, error: 'Profile not found' };
    } catch (error) {
      logger.error('[Tools] get_user_profile error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get QR code data
   */
  get_qr_code_data: async (userId, params = {}) => {
    try {
      const db = getClient();
      if (!db) {
        return { success: false, error: 'Database not available' };
      }

      const { data, error } = await db
        .from('users')
        .select('name, age, gender, blood_type, allergies, conditions, medications, emergency_contact')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('[Tools] get_qr_code_data error:', error.message);
        return { success: false, error: error.message };
      }

      if (data) {
        return {
          success: true,
          data: {
            patientInfo: {
              name: data.name || 'Unknown',
              bloodGroup: data.blood_type || 'Unknown',
              age: data.age || 'N/A',
              gender: data.gender || 'N/A'
            },
            medicalInfo: {
              allergies: data.allergies || [],
              conditions: data.conditions || [],
              medications: data.medications || []
            },
            emergencyInfo: {
              emergencyContact: data.emergency_contact || 'None'
            }
          }
        };
      }

      return { success: false, error: 'Profile not found' };
    } catch (error) {
      logger.error('[Tools] get_qr_code_data error:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Analyze symptom progression
   */
  analyze_symptom_progression: async (userId, params = {}) => {
    try {
      const result = await timelineStorage.getEntries(userId);

      if (!result.success || !result.data || result.data.length === 0) {
        return { success: false, error: 'No timeline data available for analysis' };
      }

      const entries = result.data;

      // Analyze trends
      const symptomMap = {};
      const severityTrend = [];
      const riskTrend = [];

      entries.forEach((e, idx) => {
        // Track symptoms
        const symptoms = (e.symptoms || '').split(',').map(s => s.trim());
        symptoms.forEach(s => {
          if (s) symptomMap[s] = (symptomMap[s] || 0) + 1;
        });

        // Track severity trend
        if (e.severity) {
          severityTrend.push({ date: e.date, severity: e.severity });
        }

        // Track risk trend
        if (e.risk_level) {
          riskTrend.push({ date: e.date, risk: e.risk_level });
        }
      });

      // Find patterns
      const topSymptoms = Object.entries(symptomMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([symptom, count]) => ({ symptom, occurrences: count }));

      // Determine progression
      let progression = 'stable';
      if (severityTrend.length >= 2) {
        const latest = severityTrend[severityTrend.length - 1]?.severity;
        const previous = severityTrend[severityTrend.length - 2]?.severity;

        const severityOrder = { SEVERE: 3, MODERATE: 2, MILD: 1 };
        if (severityOrder[latest] > severityOrder[previous]) {
          progression = 'worsening';
        } else if (severityOrder[latest] < severityOrder[previous]) {
          progression = 'improving';
        }
      }

      return {
        success: true,
        data: {
          summary: {
            totalEntries: entries.length,
            dateRange: {
              start: entries[0]?.date,
              end: entries[entries.length - 1]?.date
            },
            progression
          },
          topSymptoms,
          severityTrend: severityTrend.slice(-10),
          riskTrend: riskTrend.slice(-10),
          analysis: {
            frequentSymptoms: topSymptoms.slice(0, 3).map(s => s.symptom).join(', ') || 'None',
            progressionStatus: progression,
            recommendation: progression === 'worsening'
              ? 'Your symptoms appear to be worsening. Consider consulting a doctor.'
              : progression === 'improving'
              ? 'Your symptoms show improvement. Continue current management.'
              : 'Your symptoms remain stable. Continue monitoring.'
          }
        }
      };
    } catch (error) {
      logger.error('[Tools] analyze_symptom_progression error:', error.message);
      return { success: false, error: error.message };
    }
  }
};

/**
 * Execute a tool by name
 */
async function executeTool(toolName, userId, params = {}) {
  const handler = toolHandlers[toolName];

  if (!handler) {
    return { success: false, error: `Tool '${toolName}' not found` };
  }

  try {
    return await handler(userId, params);
  } catch (error) {
    logger.error(`[Tools] Error executing ${toolName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all available tools
 */
function getTools() {
  return toolDefinitions;
}

/**
 * Get tool definitions formatted for AI consumption
 */
function getToolDefinitionsForAI() {
  return toolDefinitions;
}

module.exports = {
  toolDefinitions,
  toolHandlers,
  executeTool,
  getTools,
  getToolDefinitionsForAI
};