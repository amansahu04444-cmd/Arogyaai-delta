import React, { createContext, useContext, useState, useCallback } from 'react';
import api, { addTimelineEntry, getTimelineEntries } from '../services/api';
import { supabase } from '../lib/supabase';
import { useUserStore } from './userStore';

const HealthContext = createContext();

export const HealthProvider = ({ children }) => {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [triageResult, setTriageResult] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I am your AI assistant. Please describe your symptoms.", type: 'bot' }
  ]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Global Timeline State
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoadingTimeline(true);
      const res = await getTimelineEntries('me');
      if (res.success) {
        setTimelineEntries(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load timeline in Context:', err);
    } finally {
      setIsLoadingTimeline(false);
    }
  }, []);

  // Get user from store
  const { user } = useUserStore();

  // Helper to save directly to Supabase
  const saveToSupabase = async (table, data) => {
    try {
      if (import.meta.env.DEV) {
        console.log(`Saving payload to ${table}...`);
      }
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error(`Supabase Error on ${table}:`, error);
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log(`✅ Saved successfully to ${table}`);
      }
      return { success: true, data: result };
    } catch (err) {
      console.error(`🚨 Error saving to ${table}:`, err);
      throw err;
    }
  };

  const toggleSymptom = useCallback((symptom) => {
    setSelectedSymptoms(prev => {
      const newSymptoms = prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom];
      setTriageResult(null); // Reset triage when symptoms change
      return newSymptoms;
    });
  }, []);

  const runTriage = useCallback(async () => {
    if (selectedSymptoms.length === 0) {
      setTriageResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call Express backend (which then calls FastAPI)
      const symptomsText = selectedSymptoms.join(', ');
      const response = await api.processVoiceTriage(symptomsText);

      // Express backend returns { risk, score, category, recommendation }
      if (response.risk) {
        setTriageResult({
          score: response.score,
          risk: response.risk,
          category: response.category,
          recommendation: response.recommendation,
          message: response.recommendation,
          emergency: response.risk === 'HIGH'
        });

        // Also fetch hospitals based on category
        const hospResponse = await api.getHospitals(response.category);
        if (hospResponse.success && hospResponse.data) {
          setHospitals(hospResponse.data);
        }

        // Get user ID for direct Supabase save
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (import.meta.env.DEV) {
          console.log("Authenticated User status checked");
        }
        const userId = authUser?.id;

        // ========== SAVE DIRECTLY TO SUPABASE ==========
        if (userId) {
          // 1. Save to symptom_timeline (for timeline/history)
          const timelineData = {
            user_id: userId,
            date: new Date().toISOString().split('T')[0],
            raw_symptom_text: symptomsText,
            symptoms: symptomsText,
            risk_level: response.risk,
            triage_score: response.score,
            ai_summary: typeof response.recommendation === 'object' ? response.recommendation.summary : response.recommendation,
            source: 'Dashboard',
            severity: response.risk === 'HIGH' ? 'SEVERE' : response.risk === 'MODERATE' ? 'MODERATE' : 'MILD',
            temperature: null,
            notes: 'Auto-logged from Dashboard Triage'
          };

          await saveToSupabase('symptom_timeline', timelineData);

          // 2. Save to symptoms_log (for quick access)
          await saveToSupabase('symptoms_log', {
            user_id: userId,
            symptoms: selectedSymptoms, // Passed as object/array directly
            severity: response.risk,
            triage_result: response, // Passed as object directly
            logged_at: new Date().toISOString()
          });
        } else {
          console.warn("⚠️ No user ID - falling back to backend API for timeline");
        }
        // ===============================================

        // Auto-log to Symptom Timeline (backend API - backup)
        try {
          await addTimelineEntry({
            date: new Date().toISOString().split('T')[0],
            raw_symptom_text: symptomsText,
            symptoms: symptomsText,
            risk_level: response.risk,
            triage_score: response.score,
            ai_summary: typeof response.recommendation === 'object' ? response.recommendation.summary : response.recommendation,
            source: 'Dashboard',
            severity: response.risk === 'HIGH' ? 'SEVERE' : response.risk === 'MODERATE' ? 'MODERATE' : 'MILD',
            temperature: null,
            notes: 'Auto-logged from Dashboard Triage'
          });
        } catch (logErr) {
          console.error('Failed to auto-log timeline entry:', logErr);
        }
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (err) {
      console.error('AI triage failed:', err.message);
      setError(`AI assessment failed: ${err.message}`);
      setTriageResult(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSymptoms]);

  const clearSymptoms = useCallback(() => {
    setSelectedSymptoms([]);
    setTriageResult(null);
    setHospitals([]);
    setError(null);
    setMessages([
      { id: 1, text: "Hello! I am your AI assistant. Please describe your symptoms.", type: 'bot' }
    ]);
  }, []);

  return (
    <HealthContext.Provider value={{
      selectedSymptoms,
      setSelectedSymptoms,
      toggleSymptom,
      triageResult,
      setTriageResult,
      runTriage,
      hospitals,
      setHospitals,
      userLocation,
      setUserLocation,
      loading,
      setLoading,
      error,
      clearSymptoms,
      messages,
      setMessages,
      isChatOpen,
      setIsChatOpen,
      saveToSupabase,
      timelineEntries,
      setTimelineEntries,
      isLoadingTimeline,
      fetchTimeline
    }}>
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
};
