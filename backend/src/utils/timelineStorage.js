const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getClient, isConnected } = require('../config/db');
const logger = require('./logger');

const LOCAL_STORAGE_PATH = path.join(__dirname, '..', '..', 'logs', 'symptom_timeline.json');

// Ensure the logs directory exists
const ensureDirExists = () => {
  const dir = path.dirname(LOCAL_STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Read local JSON file
const readLocalTimeline = () => {
  try {
    ensureDirExists();
    if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
      return {};
    }
    const data = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    logger.error('Failed to read local timeline file:', err.message);
    return {};
  }
};

// Write local JSON file
const writeLocalTimeline = (data) => {
  try {
    ensureDirExists();
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    logger.error('Failed to write local timeline file:', err.message);
    return false;
  }
};

/**
 * Add a new symptom timeline entry
 */
const addEntry = async (userId, entryData) => {
  const entryId = uuidv4();
  const newEntry = {
    id: entryId,
    user_id: userId,
    date: entryData.date,
    raw_symptom_text: entryData.raw_symptom_text || null,
    symptoms: entryData.symptoms,
    risk_level: entryData.risk_level || null,
    triage_score: entryData.triage_score || null,
    ai_summary: entryData.ai_summary || null,
    source: entryData.source || 'Manual',
    severity: entryData.severity,
    temperature: entryData.temperature || null,
    notes: entryData.notes || null,
    created_at: new Date().toISOString()
  };

  const db = getClient();

  // Check if Supabase is properly connected
  if (!isConnected()) {
    logger.warn('⚠️ Supabase not connected - saving to local storage instead');
    return addEntryLocal(userId, newEntry);
  }

  if (db) {
    try {
      logger.info('Attempting to save timeline entry to Supabase', { userId, entryId });
      const { data, error } = await db
        .from('symptom_timeline')
        .insert([newEntry])
        .select()
        .single();

      if (error) {
        // Check if the table doesn't exist (PGRST125 or 42P01)
        if (error.code === 'PGRST125' || error.code === '42P01' || error.message.includes('does not exist')) {
          logger.error('🚨 TABLE NOT FOUND: symptom_timeline does not exist in Supabase');
          logger.error('   Run schema.sql in Supabase SQL Editor');
          logger.error('   Falling back to local storage (data will be lost on restart)');
          return addEntryLocal(userId, newEntry);
        }
        // Check for RLS policy issues
        if (error.code === '42501' || error.message.includes('row-level security')) {
          logger.error('🚨 RLS POLICY ERROR: Cannot insert into symptom_timeline');
          logger.error('   Run schema.sql to create RLS policies');
          logger.error('   Falling back to local storage (data will be lost on restart)');
          return addEntryLocal(userId, newEntry);
        }
        throw error;
      }

      logger.info('✅ Timeline entry saved to Supabase', { entryId: data.id });
      return {
        success: true,
        data: {
          id: data.id,
          userId: data.user_id,
          date: data.date,
          raw_symptom_text: data.raw_symptom_text,
          symptoms: data.symptoms,
          risk_level: data.risk_level,
          triage_score: data.triage_score,
          ai_summary: data.ai_summary,
          source: data.source,
          severity: data.severity,
          temperature: data.temperature,
          notes: data.notes,
          createdAt: data.created_at
        },
        source: 'supabase'
      };
    } catch (err) {
      logger.error('🚨 Supabase timeline insertion failed:', err.message);
      logger.error('   Falling back to local storage (data will be lost on restart)');
      return addEntryLocal(userId, newEntry);
    }
  } else {
    logger.warn('⚠️ Supabase client not available. Saving to local storage.');
    return addEntryLocal(userId, newEntry);
  }
};

// Add to local storage
const addEntryLocal = (userId, entry) => {
  const localData = readLocalTimeline();
  if (!localData[userId]) {
    localData[userId] = [];
  }
  
  // Format mapped object for consistency
  const mappedEntry = {
    id: entry.id,
    userId: userId,
    date: entry.date,
    raw_symptom_text: entry.raw_symptom_text,
    symptoms: entry.symptoms,
    risk_level: entry.risk_level,
    triage_score: entry.triage_score,
    ai_summary: entry.ai_summary,
    source: entry.source,
    severity: entry.severity,
    temperature: entry.temperature,
    notes: entry.notes,
    createdAt: entry.created_at
  };

  localData[userId].push(mappedEntry);
  
  // Sort by date ascending to keep it clean
  localData[userId].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  writeLocalTimeline(localData);
  return {
    success: true,
    data: mappedEntry,
    source: 'local_json'
  };
};

/**
 * Get all timeline entries for a user (chronologically sorted)
 */
const getEntries = async (userId) => {
  const db = getClient();

  // Check if Supabase is properly connected
  if (!isConnected()) {
    logger.warn('⚠️ Supabase not connected - reading from local storage');
    return getEntriesLocal(userId);
  }

  if (db) {
    try {
      logger.info('Fetching timeline entries from Supabase', { userId });
      const { data, error } = await db
        .from('symptom_timeline')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) {
        if (error.code === 'PGRST125' || error.code === '42P01' || error.message.includes('does not exist')) {
          logger.warn('⚠️ symptom_timeline table not found. Reading from local JSON.');
          return getEntriesLocal(userId);
        }
        if (error.code === '42501' || error.message.includes('row-level security')) {
          logger.error('🚨 RLS POLICY ERROR: Cannot read symptom_timeline');
          return getEntriesLocal(userId);
        }
        throw error;
      }

      const mappedData = (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        date: item.date,
        raw_symptom_text: item.raw_symptom_text,
        symptoms: item.symptoms,
        risk_level: item.risk_level,
        triage_score: item.triage_score,
        ai_summary: item.ai_summary,
        source: item.source,
        severity: item.severity,
        temperature: item.temperature,
        notes: item.notes,
        createdAt: item.created_at
      }));

      logger.info('✅ Fetched timeline entries from Supabase', { count: mappedData.length });
      return {
        success: true,
        data: mappedData,
        source: 'supabase'
      };
    } catch (err) {
      logger.error('🚨 Failed to fetch from Supabase:', err.message);
      return getEntriesLocal(userId);
    }
  } else {
    return getEntriesLocal(userId);
  }
};

// Get from local storage
const getEntriesLocal = (userId) => {
  const localData = readLocalTimeline();
  const userTimeline = localData[userId] || [];
  
  // Chronological sorting (ascending)
  userTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    success: true,
    data: userTimeline,
    source: 'local_json'
  };
};

/**
 * Update an existing symptom timeline entry
 */
const updateEntry = async (id, userId, entryData) => {
  const updates = {
    symptoms: entryData.symptoms,
    severity: entryData.severity,
    temperature: entryData.temperature || null,
    notes: entryData.notes || null,
  };

  const db = getClient();
  if (db) {
    try {
      logger.info('Attempting to update timeline entry in Supabase', { id, userId });
      const { data, error } = await db
        .from('symptom_timeline')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST125' || error.message.includes('does not exist') || error.code === 'PGRST116') {
          return updateEntryLocal(id, userId, updates);
        }
        throw error;
      }

      return {
        success: true,
        data: {
          id: data.id,
          userId: data.user_id,
          date: data.date,
          raw_symptom_text: data.raw_symptom_text,
          symptoms: data.symptoms,
          risk_level: data.risk_level,
          triage_score: data.triage_score,
          ai_summary: data.ai_summary,
          source: data.source,
          severity: data.severity,
          temperature: data.temperature,
          notes: data.notes,
          createdAt: data.created_at
        },
        source: 'supabase'
      };
    } catch (err) {
      logger.error('Supabase timeline update failed, using local fallback:', err.message);
      return updateEntryLocal(id, userId, updates);
    }
  } else {
    return updateEntryLocal(id, userId, updates);
  }
};

const updateEntryLocal = (id, userId, updates) => {
  const localData = readLocalTimeline();
  if (!localData[userId]) {
    throw new Error('Entry not found');
  }

  const index = localData[userId].findIndex(e => e.id === id);
  if (index === -1) {
    throw new Error('Entry not found');
  }

  localData[userId][index] = { ...localData[userId][index], ...updates };
  writeLocalTimeline(localData);

  return {
    success: true,
    data: localData[userId][index],
    source: 'local_json'
  };
};

/**
 * Delete a timeline entry
 */
const deleteEntry = async (id, userId) => {
  const db = getClient();
  if (db) {
    try {
      logger.info('Attempting to delete timeline entry from Supabase', { id, userId });
      const { error } = await db
        .from('symptom_timeline')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (error.code === 'PGRST125' || error.message.includes('does not exist')) {
          return deleteEntryLocal(id, userId);
        }
        throw error;
      }

      return { success: true, source: 'supabase' };
    } catch (err) {
      logger.error('Supabase timeline deletion failed, using local fallback:', err.message);
      return deleteEntryLocal(id, userId);
    }
  } else {
    return deleteEntryLocal(id, userId);
  }
};

const deleteEntryLocal = (id, userId) => {
  const localData = readLocalTimeline();
  if (!localData[userId]) {
    return { success: true, source: 'local_json' }; // Idempotent
  }

  localData[userId] = localData[userId].filter(e => e.id !== id);
  writeLocalTimeline(localData);

  return { success: true, source: 'local_json' };
};

module.exports = {
  addEntry,
  getEntries,
  updateEntry,
  deleteEntry
};
