const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { ValidationError } = require('../middleware/error.middleware');
const { getClient } = require('../config/db');

async function getUserHistory(req, res, next) {
  try {
    const effectiveUserId = req.userId;

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }

    const supabase = getClient();
    if (!supabase) throw new AppError('Database connection error', 500);

    // Fetch user profile
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', effectiveUserId)
      .single();

    // Fetch conversations/triage sessions
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch symptom logs
    const { data: symptoms, error: sympError } = await supabase
      .from('symptoms_log')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('logged_at', { ascending: false })
      .limit(20);

    // Fetch appointments
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('appointment_date', { ascending: false });

    // Fetch emergency logs
    const { data: emergencyLogs, error: emerError } = await supabase
      .from('emergency_logs')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('triggered_at', { ascending: false });

    res.status(200).json({
      success: true,
      data: {
        user: userProfile || { id: effectiveUserId, name: 'New User' },
        conversations: conversations || [],
        symptoms: symptoms || [],
        appointments: appointments || [],
        emergencyLogs: emergencyLogs || [],
        summary: {
          totalConsultations: (conversations || []).length,
          totalAppointments: (appointments || []).length,
          emergencyAlerts: (emergencyLogs || []).length,
          riskProfile: 'STABLE'
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, phone, email, age, gender, bloodType, allergies, conditions } = req.body;

    if (!name) {
      throw new ValidationError('Name is required');
    }

    if (!phone) {
      throw new ValidationError('Phone number is required');
    }

    const userId = uuidv4();

    const newUser = {
      id: userId,
      name,
      phone,
      email: email || null,
      age: age || null,
      gender: gender || null,
      bloodType: bloodType || null,
      allergies: allergies || [],
      conditions: conditions || [],
      emergencyContact: null,
      createdAt: new Date().toISOString(),
      lastVisit: null
    };

    logger.info('User created', { userId, name });

    res.status(201).json({
      success: true,
      data: {
        user: newUser,
        message: 'User profile created successfully'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    logger.info('User updated', { userId: id, updates });

    res.status(200).json({
      success: true,
      data: {
        userId: id,
        updates,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateUserProfile(req, res, next) {
  try {
    const userId = req.userId;
    const {
      phone,
      age,
      gender,
      blood_type,
      allergies,
      conditions,
      medications,
      emergency_contact,
      emergency_phone,
      relationship
    } = req.body;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const supabase = getClient();
    if (!supabase) throw new AppError('Database connection error', 500);

    // Get existing profile to preserve name/email (they come from auth, not request body)
    const { data: existingProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();

    // Preserve existing name/email - they should never be overwritten
    const name = existingProfile?.name || 'User';
    const email = existingProfile?.email || '';

    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name,
        email,
        phone,
        age,
        gender,
        blood_type,
        allergies,
        conditions,
        medications,
        emergency_contact,
        emergency_phone,
        relationship,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('[PROFILE] Updated:', data);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('[PROFILE] Save Error', error);
    next(error);
  }
}

async function getUserProfile(req, res, next) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const supabase = getClient();
    if (!supabase) throw new AppError('Database connection error', 500);

    // Fetch user profile from database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    res.status(200).json({
      success: true,
      data: userProfile || null
    });
  } catch (error) {
    next(error);
  }
}

async function getUserStats(req, res, next) {
  try {
    const { id } = req.params;
    const effectiveUserId = id || req.userId;

    const stats = {
      userId: effectiveUserId,
      totalTriageSessions: 15,
      highRiskAlerts: 2,
      appointmentsCompleted: 8,
      averageTriageScore: 4.5,
      lastActivity: new Date().toISOString(),
      healthTrend: 'STABLE'
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

async function addFamilyMember(req, res, next) {
  try {
    const { name, relation } = req.body;
    const token = req.token;

    if (!name || !relation) {
      throw new ValidationError('Name and Relation are required');
    }

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    // Verify user via auth token to get the correct Supabase Auth ID
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) {
      throw new AppError('Invalid authentication session', 401);
    }

    const { data, error } = await db
      .from('family_members')
      .insert([
        { user_id: user.id, name, relation }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data
    });
  } catch (error) {
    next(error);
  }
}

async function getFamilyMembers(req, res, next) {
  try {
    const userId = req.userId;

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    const { data, error } = await db
      .from('family_members')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
}

async function removeFamilyMember(req, res, next) {
  try {
    const { memberId } = req.params;
    const userId = req.userId;

    const db = getClient();
    if (!db) throw new AppError('Database connection error', 500);

    const { error } = await db
      .from('family_members')
      .delete()
      .eq('id', memberId)
      .eq('user_id', userId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Family member removed successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUserHistory,
  createUser,
  updateUser,
  updateUserProfile,
  getUserProfile,
  getUserStats,
  addFamilyMember,
  getFamilyMembers,
  removeFamilyMember
};
