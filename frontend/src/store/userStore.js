import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useUserStore = create((set) => ({
  isLoggedIn: false,
  user: null,
  session: null,
  isLoading: true,
  error: null,

  // Initialize and check for existing session
  checkSession: async () => {
    set({ isLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (session) {
        // Also get the user with metadata
        const { data: { user } } = await supabase.auth.getUser();
        
        if (import.meta.env.DEV) {
          console.log("Authenticated User session resolved");
        }
        const payload = {
          id: user.id,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
          email: user.email,
          updated_at: new Date().toISOString()
        };
        
        const { data: syncData, error: syncError } = await supabase
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .select();
          
        if (syncError) {
          console.error("Supabase Error:", syncError);
          throw syncError;
        }

        set({
          isLoggedIn: true,
          user: user || session.user,
          session,
          isLoading: false
        });
      } else {
        set({ isLoggedIn: false, user: null, session: null, isLoading: false });
      }
    } catch (err) {
      console.error('Session check failed:', err);
      set({ isLoggedIn: false, user: null, session: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    if (import.meta.env.DEV) {
      console.log("🔥 userStore.login called for email:", email);
    }
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || 'Login failed. Please check your credentials.');
      }

      // Get full user data
      const { data: { user: fullUser } } = await supabase.auth.getUser();
      const userRecord = fullUser || data?.user;

      if (userRecord) {
        const payload = {
          id: userRecord.id,
          name: userRecord.user_metadata?.full_name || userRecord.email?.split('@')[0] || 'Unknown',
          email: userRecord.email,
          updated_at: new Date().toISOString()
        };
        
        const { data: syncData, error: syncError } = await supabase
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .select();
          
        if (syncError) {
          console.error("Supabase Error:", syncError);
          throw syncError;
        }
      }

      set({
        isLoggedIn: Boolean(data?.session),
        user: userRecord,
        session: data?.session,
        isLoading: false
      });
      return true;
    } catch (err) {
      let message = err?.message || 'Login failed. Please check your credentials.';

      // Handle "Email not confirmed" error
      if (message.includes('Email not confirmed')) {
        message = 'Your email has not been confirmed. Please check your inbox for a verification link or disable "Confirm Email" in the Supabase Dashboard.';
      } else if (message.includes('Invalid login credentials')) {
        message = 'Account not found. Please sign up first.';
      }

      console.error('Login error:', err);
      set({
        error: message,
        isLoading: false
      });
      return false;
    }
  },

  register: async (name, email, password) => {
    if (import.meta.env.DEV) {
      console.log("🔥 userStore.register called for email:", email);
    }
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (error) {
        throw new Error(error.message || 'Registration failed.');
      }

      // Create user profile in users table
      if (data?.user) {
        if (import.meta.env.DEV) {
          console.log("🔧 Creating user profile in Supabase...", data.user.id);
        }
        
        const payload = {
          id: data.user.id,
          name: name,
          email: email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: syncData, error: profileError } = await supabase
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .select();

        if (profileError) {
          console.error("Supabase Error:", profileError);
          throw profileError;
        }
        if (import.meta.env.DEV) {
          console.log("✅ User profile created successfully");
        }
      }

      set({
        user: data?.user ?? null,
        session: data?.session ?? null,
        isLoggedIn: Boolean(data?.session),
        isLoading: false
      });
      return true;
    } catch (err) {
      let message = err?.message || 'Registration failed.';

      // Specifically handle the "Email signups are disabled" error from Supabase
      if (message.includes('Email signups are disabled')) {
        message = 'Registration is currently disabled in the Supabase dashboard. Please enable "Email Signups" in Authentication -> Providers -> Email.';
      }

      console.error('Register error:', err);
      set({
        error: message,
        isLoading: false
      });
      return false;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({
      isLoggedIn: false,
      user: null,
      session: null,
      error: null
    });
  },

  clearError: () => set({ error: null })
}));
