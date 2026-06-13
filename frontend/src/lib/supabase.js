import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation helper to prevent crash on initialization
const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.endsWith('.supabase.co') &&
      parsed.pathname === '/'
    );
  } catch (e) {
    return false;
  }
};

let supabaseInstance;

if (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-key-here') {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // Verify connection on init
  supabaseInstance.from('users').select('id').limit(1).then(({ data, error }) => {
    if (error) {
      console.error("🚨 SUPABASE CONNECTION ERROR:", error.message);
      console.error("   This usually means:");
      console.error("   1. Tables not created - Run schema.sql in Supabase SQL Editor");
      console.error("   2. RLS blocking access - Check Row Level Security policies");
      console.error("   3. Wrong table names - Verify table names match schema");
    } else {
      if (import.meta.env.DEV) {
        console.log("✅ Supabase Connected - Database tables accessible");
      }
    }
  });

  if (import.meta.env.DEV) {
    console.log("✅ Supabase client initialized successfully");
  }
} else {
  console.error(
    'CRITICAL: Supabase configuration is invalid or missing in .env. ' +
    'Ensure VITE_SUPABASE_URL is the Supabase project base URL and VITE_SUPABASE_ANON_KEY is the public anon key.'
  );
  console.error("Current status:", { supabaseUrl: supabaseUrl ? "SET" : "NOT SET", supabaseAnonKey: supabaseAnonKey ? "SET" : "NOT SET" });
  // Provide a safe "null-object" proxy to prevent runtime crashes during import/initialization
  supabaseInstance = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: {}, error: new Error('Supabase not configured') }),
      signUp: async () => ({ data: {}, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
        })
      })
    })
  };
}

export const supabase = supabaseInstance;
