const { v4: uuidv4 } = require('uuid');
const { getClient } = require('../config/db');
const { AppError, ValidationError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

// Helper to detect localhost/local URLs
function isLocalUrl(urlStr) {
  if (!urlStr) return true;
  const clean = urlStr.toLowerCase();
  
  if (clean.includes('localhost') || clean.includes('127.0.0.1') || clean.includes('0.0.0.0') || clean.includes('[::1]') || clean.includes('::1')) {
    return true;
  }
  
  if (clean.includes('192.168.') || clean.includes('10.')) {
    return true;
  }
  
  const privateIp172Pattern = /172\.(1[6-9]|2\d|3[0-1])\./;
  if (privateIp172Pattern.test(clean)) {
    return true;
  }
  
  return false;
}

// Helper to get frontend base URL dynamically with fallbacks
function getFrontendUrl(req) {
  // 1. process.env.FRONTEND_URL
  if (process.env.FRONTEND_URL && !isLocalUrl(process.env.FRONTEND_URL)) {
    return process.env.FRONTEND_URL;
  }
  
  // 2. process.env.DEPLOYED_DOMAIN
  if (process.env.DEPLOYED_DOMAIN && !isLocalUrl(process.env.DEPLOYED_DOMAIN)) {
    return process.env.DEPLOYED_DOMAIN;
  }
  
  // 3. req.headers.origin (if available)
  if (req && req.headers && req.headers.origin && !isLocalUrl(req.headers.origin)) {
    return req.headers.origin;
  }
  
  // 4. req.headers.referer origin (if valid)
  if (req && req.headers && req.headers.referer) {
    try {
      const refUrl = new URL(req.headers.referer).origin;
      if (!isLocalUrl(refUrl)) {
        return refUrl;
      }
    } catch (e) {}
  }
  
  // 5. req.headers.host
  if (req && req.headers && req.headers.host && !isLocalUrl(req.headers.host)) {
    const protocol = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
    return `${protocol}://${req.headers.host}`;
  }
  
  // 6. FINAL fallback - MUST be a configured production domain (NOT localhost)
  return 'https://arogyaai.com';
}

// Generate or recreate a Medical QR code
async function generateQr(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId || userId.startsWith('anonymous')) {
      throw new ValidationError('Authentication required to generate QR code');
    }

    logger.info(`[QR CREATE] Request received to generate/update QR for userId: ${userId}`);

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    const frontendUrl = getFrontendUrl(req);
    logger.info(`[QR GENERATE] Final FRONTEND_URL used: ${frontendUrl}`);
    const qr_id = uuidv4();
    const qr_url = `${frontendUrl.replace(/\/$/, '')}/medical-card/${qr_id}`;

    // Check if the user already has a QR code
    const { data: existing, error: checkError } = await db
      .from('medical_qr')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) throw checkError;

    let result;
    if (existing) {
      // Update existing record
      const { data, error } = await db
        .from('medical_qr')
        .update({
          qr_id,
          qr_url,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      logger.info(`[QR CREATE] Successfully updated existing QR record for userId: ${userId}, new qr_id: ${qr_id}`);
    } else {
      // Insert new record
      const { data, error } = await db
        .from('medical_qr')
        .insert([
          {
            user_id: userId,
            qr_id,
            qr_url,
            is_public: true
          }
        ])
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      logger.info(`[QR CREATE] Successfully inserted new QR record for userId: ${userId}, qr_id: ${qr_id}`);
    }

    res.status(200).json({
      qr_data: result.qr_url,
      status: 'success'
    });
  } catch (error) {
    logger.error(`[QR CREATE] Failed to generate/update QR for userId: ${req.userId || 'unknown'}: ${error.message}`);
    next(error);
  }
}

// Get the logged-in user's QR code info
async function getMyQr(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId || userId.startsWith('anonymous')) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    const { data, error } = await db
      .from('medical_qr')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data || null
    });
  } catch (error) {
    next(error);
  }
}

// Update settings (Public/Private)
async function updateSettings(req, res, next) {
  try {
    const userId = req.userId;
    const { is_public } = req.body;

    if (!userId || userId.startsWith('anonymous')) {
      throw new ValidationError('Authentication required');
    }

    if (typeof is_public !== 'boolean') {
      throw new ValidationError('is_public setting must be a boolean');
    }

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    const { data, error } = await db
      .from('medical_qr')
      .update({
        is_public,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Medical QR privacy settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

// Public endpoint to scan and retrieve the medical card information
async function getPublicCard(req, res, next) {
  try {
    const { qrId } = req.params;
    logger.info(`[QR LOOKUP] Scan query received for qr_id: ${qrId}`);

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    // 1. Fetch QR record
    const { data: qrRecord, error: qrError } = await db
      .from('medical_qr')
      .select('*')
      .eq('qr_id', qrId)
      .maybeSingle();

    if (qrError) {
      logger.error(`[QR LOOKUP] Supabase query failed for qr_id ${qrId}: ${qrError.message}`);
      throw qrError;
    }
    
    if (!qrRecord) {
      logger.warn(`[QR LOOKUP] Scanned qr_id ${qrId} not found in database`);
      throw new AppError('Emergency medical card not found', 404);
    }

    const userId = qrRecord.user_id;

    // 2. Fetch User Profile
    const { data: userProfile, error: userError } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw userError;
    if (!userProfile) {
      logger.error(`[QR LOOKUP] User profile ${userId} linked to qr_id ${qrId} not found`);
      throw new AppError('Patient profile not found', 404);
    }

    // 3. Fetch Care Circle (family_members)
    const { data: familyMembers, error: familyError } = await db
      .from('family_members')
      .select('name, relation, phone')
      .eq('user_id', userId);

    const careCircle = familyMembers || [];

    // 4. Fetch Latest AI info from symptom_timeline
    const { data: timelineData, error: timelineError } = await db
      .from('symptom_timeline')
      .select('risk_level, triage_score, ai_summary, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    let latestTriage = null;
    if (timelineError) {
      const { data: retryData, error: retryError } = await db
        .from('symptom_timeline')
        .select('risk_level, triage_score, ai_summary, date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1);
      
      if (!retryError && retryData && retryData.length > 0) {
        latestTriage = retryData[0];
      }
    } else if (timelineData && timelineData.length > 0) {
      latestTriage = timelineData[0];
    }

    // Apply security/privacy filtering based on is_public settings
    const isPublic = qrRecord.is_public;
    
    let responseData = {
      is_public: isPublic,
      patient_info: {
        name: userProfile.name,
        blood_group: userProfile.blood_type || 'Unknown'
      },
      medical_info: {
        allergies: userProfile.allergies || [],
        conditions: userProfile.conditions || []
      },
      emergency_info: {
        emergency_contact: userProfile.emergency_contact || 'None provided',
        care_circle: careCircle
      },
      ai_info: null
    };

    if (isPublic) {
      responseData.patient_info.age = userProfile.age || 'Unknown';
      responseData.patient_info.gender = userProfile.gender || 'Unknown';
      responseData.medical_info.medications = userProfile.medications || [];
      
      if (latestTriage) {
        responseData.ai_info = {
          risk_level: latestTriage.risk_level || 'STABLE',
          triage_score: latestTriage.triage_score || 0,
          ai_summary: latestTriage.ai_summary || 'No recent assessment summary.'
        };
      }
    } else {
      responseData.patient_info.age = 'CONFIDENTIAL';
      responseData.patient_info.gender = 'CONFIDENTIAL';
      responseData.medical_info.medications = ['CONFIDENTIAL'];
      
      if (latestTriage) {
        responseData.ai_info = {
          risk_level: latestTriage.risk_level || 'STABLE',
          triage_score: 'CONFIDENTIAL',
          ai_summary: 'CONFIDENTIAL'
        };
      }
    }

    logger.info(`[QR LOOKUP] Successfully retrieved details for patient user_id: ${userId}, name: ${userProfile.name}, is_public: ${isPublic}`);

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error(`[QR LOOKUP] Lookup failed for qr_id ${req.params.qrId}: ${error.message}`);
    next(error);
  }
}

module.exports = {
  generateQr,
  getMyQr,
  updateSettings,
  getPublicCard
};
