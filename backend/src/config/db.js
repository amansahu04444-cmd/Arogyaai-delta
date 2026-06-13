const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const logger = require('../utils/logger');

let supabase = null;
let isConnecting = false;
let isSupabaseConnected = false;

async function connectDB() {
  if (supabase) return supabase;
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { url, key } = env.supabase;
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      // Check if it's a table doesn't exist error
      if (error.code === 'PGRST125' || error.code === '42P01' || error.message.includes('does not exist')) {
        logger.warn('⚠️ Supabase connected but tables may not exist');
        logger.warn('⚠️ Run schema.sql in Supabase SQL Editor to create tables');
        isSupabaseConnected = true;
        return supabase;
      }
      // Check for RLS policy issues
      if (error.code === '42501' || error.message.includes('row-level security')) {
        logger.error('🚨 RLS POLICY ERROR: ' + error.message);
        logger.error('   Run schema.sql to create RLS policies');
      }
      throw error;
    }

    logger.info('✅ Database connected successfully');
    isSupabaseConnected = true;
    return supabase;
  } catch (error) {
    logger.error(`🚨 DB CONNECTION FAILED: ${error.message}`);
    logger.error('   This is a CRITICAL error - data will NOT be saved to Supabase');
    logger.error('   Please check:');
    logger.error('   1. SUPABASE_URL in .env is correct');
    logger.error('   2. SUPABASE_SERVICE_KEY is correct');
    logger.error('   3. Tables exist - run schema.sql in Supabase SQL Editor');
    supabase = null;
    // Don't throw - let the server start but data won't save
    return createMockClient();
  } finally {
    isConnecting = false;
  }
}

function isConnected() {
  return isSupabaseConnected;
}

module.exports = { connectDB, getClient: () => supabase, isConnected };