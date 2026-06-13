import { useState, useCallback } from 'react';
import { useHealth } from '../store/HealthContext';
import { processVoiceTriage } from '../services/api';
import { speakResponse } from '../services/voice';
import { supabase } from '../lib/supabase';

export const useChatHook = () => {
  const {
    messages,
    setMessages,
    isChatOpen,
    setIsChatOpen,
    setSelectedSymptoms,
    setTriageResult,
    loading: isProcessing,
    setLoading: setIsProcessing,
    saveToSupabase,
    fetchTimeline
  } = useHealth();

  // Helper to save conversation to Supabase
  const saveConversation = async (userMessage, botResponse) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn("⚠️ No user logged in - not saving conversation");
        return;
      }

      if (import.meta.env.DEV) {
        console.log("Authenticated User:", user);
      }
      const payload = {
        user_id: user.id,
        type: 'text',
        message: userMessage,
        response: botResponse,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'chat'
        }
      };
      if (import.meta.env.DEV) {
        console.log("Insert Payload:", payload);
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log("Supabase Response:", data);
        console.log("✅ Conversation saved:", data.id);
      }
    } catch (err) {
      console.error("🚨 Error saving conversation:", err);
      throw err;
    }
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    // Open chat window removed to keep dashboard updates silent
    // setIsChatOpen(true);

    const userMessage = { id: Date.now(), text, type: 'user' };
    setMessages(prev => [...prev, userMessage]);

    // Add symptom to context for dashboard cards to update if they map it
    setSelectedSymptoms(prev => {
        if (!prev.includes(text)) return [...prev, text];
        return prev;
    });

    setIsProcessing(true);

    try {
      const coords = await new Promise((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 3000 }
          );
        } else {
          resolve(null);
        }
      });

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user ? user.id : 'anonymous';

      const res = await processVoiceTriage(text, userId, coords?.lat, coords?.lng);

      // Handle both raw Axios response and unwrapped interceptor response
      const resultData = res?.data || res;

      if (import.meta.env.DEV) {
        console.log("API RAW RESPONSE:", res);
        console.log("PARSED DATA:", resultData);
      }

      if (!resultData || (!resultData.recommendation && !resultData.risk)) {
        throw new Error("No valid data received from API");
      }

      // Real-time update of Dashboard state
      setTriageResult({
        score: resultData.score,
        risk: resultData.risk,
        category: resultData.category,
        recommendation: resultData.recommendation,
        emergency: resultData.emergency,
        telegram_sent: resultData.telegram_sent,
        telegram_error: resultData.telegram_error
      });

      // Temporarily show AI response in chat for debugging
      const botMessage = {
        id: Date.now(),
        text: JSON.stringify(resultData, null, 2),
        type: "bot"
      };
      setMessages(prev => [...prev, botMessage]);

      // ========== SAVE CONVERSATION TO SUPABASE ==========
      await saveConversation(text, resultData);
      
      // ========== SAVE TRIAGE RESULT TO TIMELINE ==========
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const timelineData = {
            user_id: user.id,
            date: new Date().toISOString().split('T')[0],
            raw_symptom_text: text,
            symptoms: text,
            risk_level: resultData.risk,
            triage_score: resultData.score,
            ai_summary: typeof resultData.recommendation === 'object' ? resultData.recommendation.summary : resultData.recommendation,
            source: 'Chat Assistant',
            severity: resultData.risk === 'HIGH' ? 'SEVERE' : resultData.risk === 'MODERATE' ? 'MODERATE' : 'MILD',
            temperature: null,
            notes: 'Auto-logged from Chat Assistant'
          };
          
          if (saveToSupabase) {
            await saveToSupabase('symptom_timeline', timelineData);
            
            // Auto refresh the timeline view globally
            if (fetchTimeline) {
              await fetchTimeline();
            }
          }
        }
      } catch (timelineErr) {
        console.error("🚨 Error saving to symptom_timeline from chat:", timelineErr);
      }
      // ===================================================

      if (resultData.recommendation) {
        speakResponse(resultData.recommendation);
      }
    } catch (error) {
      console.error("FULL ERROR:", error.response || error);
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${error.message}. Please check console for full details.`,
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [setMessages, setIsChatOpen, setSelectedSymptoms, setTriageResult]);

  return {
    messages,
    isChatOpen,
    setIsChatOpen,
    sendMessage,
    isProcessing
  };
};
