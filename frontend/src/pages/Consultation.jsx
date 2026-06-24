import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, Send, Mic, MicOff, AlertCircle, Loader2 } from 'lucide-react';
import api, { addTimelineEntry } from '../services/api';
import Navbar from '../components/Navbar';
import { initVoiceRecognition } from '../services/voice';
import { useUserStore } from '../store/userStore';

// Format recommendation object into a clean structured string for copy/fallback
const formatAIResponse = (data) => {
  if (!data) return 'No recommendation received.';
  const rec = data.recommendation;
  if (!rec) {
    return typeof data === 'string' ? data : 'No recommendation received.';
  }

  let formattedText = '';

  if (rec.summary) {
    formattedText += `${rec.summary}\n\n`;
  }

  if (rec.possible_causes && rec.possible_causes.length > 0) {
    formattedText += `Possible Causes:\n${rec.possible_causes.map(item => `• ${item}`).join('\n')}\n\n`;
  }

  if (rec.home_care && rec.home_care.length > 0) {
    formattedText += `Home Care:\n${rec.home_care.map(item => `• ${item}`).join('\n')}\n\n`;
  }

  if (rec.doctor_visit && rec.doctor_visit.length > 0) {
    formattedText += `Doctor Visit:\n${rec.doctor_visit.map(item => `• ${item}`).join('\n')}\n\n`;
  }

  if (rec.warning_signs && rec.warning_signs.length > 0) {
    formattedText += `Warning Signs:\n${rec.warning_signs.map(item => `• ${item}`).join('\n')}\n\n`;
  }

  if (data.followUpQuestion) {
    formattedText += `Follow-up:\n${data.followUpQuestion}`;
  }

  return formattedText.trim();
};

const Consultation = () => {
  const { user } = useUserStore();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm ArogyaAI. Please tell me your symptoms or health concern.",
      timestamp: new Date()
    }
  ]);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);

  // Auto-scroll to the bottom of the conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isLoading, error]);

  // Pre-fetch location on component mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      if (import.meta.env.DEV) {
        console.log("📡 [GEOLOCATION] Pre-fetching location on load...");
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          if (import.meta.env.DEV) {
            console.log(`✅ [GEOLOCATION] Pre-fetch successful: ${position.coords.latitude}, ${position.coords.longitude}`);
          }
        },
        (err) => console.warn('❌ [GEOLOCATION] Pre-fetching location failed:', err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSendMessage = async (textToSend = inputText) => {
    const textVal = textToSend.trim();
    if (!textVal || isLoading) return;

    setIsLoading(true);
    setError(null);
    setInputText('');

    const userMessage = { role: 'user', text: textVal, timestamp: new Date() };
    setConversationHistory(prev => [...prev, userMessage]);

    let lat = userLocation?.lat || null;
    let lng = userLocation?.lng || null;

    // Capture location before alert creation
    if (!lat || !lng) {
      try {
        if (import.meta.env.DEV) {
          console.log("📡 [GEOLOCATION] Attempting sync capture before triage...");
        }
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        if (import.meta.env.DEV) {
          console.log(`✅ [GEOLOCATION] Sync capture successful: ${lat}, ${lng}`);
        }
      } catch (err) {
        console.error("❌ [GEOLOCATION] Geolocation capture failed:", err.message);
        setError('Location permission required for emergency alerts.');
        setIsLoading(false);
        return; // Halt transmission until coordinates exist
      }
    }

    try {
      const payload = { 
        text: textVal,
        userId: user?.id || 'anonymous',
        lat,
        lng
      };
      if (import.meta.env.DEV) {
        console.log("=== FRONTEND TRIAGE PAYLOAD ===", payload);
      }

      // Direct call to Express Backend passing coordinates
      const response = await api.post('/api/triage', payload);
      
      if (response.success) {
        const aiMessage = {
          role: 'assistant',
          text: formatAIResponse(response),
          triage: response,
          timestamp: new Date()
        };
        setConversationHistory(prev => [...prev, aiMessage]);

        // Auto-log to Symptom Timeline
        try {
          await addTimelineEntry({
            date: new Date().toISOString().split('T')[0],
            raw_symptom_text: textVal,
            symptoms: textVal,
            risk_level: response.risk,
            triage_score: response.score,
            ai_summary: typeof response.recommendation === 'object' ? response.recommendation.summary : response.recommendation,
            source: 'Consultation Chat',
            severity: response.risk === 'HIGH' ? 'SEVERE' : response.risk === 'MODERATE' ? 'MODERATE' : 'MILD',
            temperature: null,
            notes: 'Auto-logged from Consultation'
          });
        } catch (logErr) {
          console.error('Failed to auto-log timeline entry:', logErr);
        }
      } else {
        throw new Error(response.error || 'Failed to analyze symptoms.');
      }
    } catch (err) {
      setError(err.message || 'Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startListening = () => {
    setError(null);
    const rec = initVoiceRecognition(
      (transcript) => {
        setIsListening(false);
        if (autoSend) {
          handleSendMessage(transcript);
        } else {
          setInputText(prev => {
            return prev ? `${prev.trim()} ${transcript}` : transcript;
          });
        }
      },
      (err) => {
        console.error('Speech recognition error:', err);
        setError(err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (rec) {
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSymptomClick = (symptomLabel) => {
    setInputText(prev => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return symptomLabel;
      }
      // Avoid duplicate quick suggestions in prompt
      const words = trimmed.split(/[\s,]+/);
      const exists = words.some(w => w.toLowerCase() === symptomLabel.toLowerCase());
      if (exists) {
        return prev;
      }
      return `${trimmed}, ${symptomLabel}`;
    });
  };

  // Render formatted components for triage results inside the chat message bubble
  const renderMessageContent = (msg) => {
    if (msg.role === 'user') {
      return <p className="font-bold text-sm leading-relaxed whitespace-pre-line break-words">{msg.text}</p>;
    }

    const triage = msg.triage;
    const rec = triage?.recommendation;

    if (!triage || !rec || typeof rec === 'string') {
      return <p className="font-bold text-sm leading-relaxed whitespace-pre-line break-words">{msg.text}</p>;
    }

    return (
      <div className="space-y-4 text-slate-900">
        {rec.summary && (
          <p className="font-bold text-sm leading-relaxed">{rec.summary}</p>
        )}

        {rec.possible_causes && rec.possible_causes.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Possible Causes:</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold">
              {rec.possible_causes.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rec.home_care && rec.home_care.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Home Care:</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold">
              {rec.home_care.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rec.doctor_visit && rec.doctor_visit.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Doctor Visit:</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold">
              {rec.doctor_visit.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rec.warning_signs && rec.warning_signs.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-[16px] space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
              <AlertCircle size={16} /> Warning Signs:
            </h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold text-red-600">
              {rec.warning_signs.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {triage.followUpQuestion && (
          <div className="pt-2 border-t border-slate-100 mt-2 text-slate-900/80 font-bold italic text-sm">
            {triage.followUpQuestion}
          </div>
        )}
      </div>
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans bg-slate-50 pb-20 selection:bg-blue-600/30">
      <Navbar />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-24 lg:pt-32 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        <div className="flex flex-col mb-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            AI Medical Consultation
          </h1>
          <p className="text-base lg:text-lg text-slate-500 leading-7 max-w-2xl mx-auto">
            Describe your symptoms to our intelligent triage assistant for immediate clinical evaluation and recommended next steps.
          </p>
        </div>
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Chat Section */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 rounded-[24px] p-6 md:p-8 bg-white border border-slate-200 shadow-sm min-h-[600px] max-h-[800px] flex flex-col"
          >
            {/* Conversation */}
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6 mb-6 pr-2">
              {conversationHistory.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 md:p-5 rounded-[24px] shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-med-primary text-white rounded-tr-none'
                      : 'bg-slate-50 border border-slate-100 rounded-tl-none text-slate-900'
                  }`}>
                    {renderMessageContent(msg)}
                    
                    {msg.triage && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider">
                          <span className={`px-3 py-1 rounded-full shadow-sm ${
                            msg.triage.risk === 'HIGH' ? 'bg-red-50 text-red-600 border border-red-100' :
                            msg.triage.risk === 'MEDIUM' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                            'bg-green-50 text-green-600 border border-green-100'
                          }`}>
                            {msg.triage.risk} Risk
                          </span>
                          {(msg.triage.score !== undefined || msg.triage.triage_score !== undefined) && (
                            <span className="text-slate-500">
                              Score: {msg.triage.score ?? msg.triage.triage_score}
                            </span>
                          )}
                          {msg.triage.category && (
                            <span className="text-slate-500 border border-slate-200 px-2 py-0.5 rounded bg-white shadow-sm">
                              {msg.triage.category}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mt-3 text-right ${msg.role === 'user' ? 'text-white/80' : 'text-slate-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-[24px] rounded-tl-none flex items-center gap-3 shadow-sm">
                    <Loader2 size={20} className="text-slate-600 animate-spin" />
                    <span className="text-slate-600 font-medium text-sm">Analyzing symptoms...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-red-50 border border-red-200 p-4 rounded-[24px] flex items-center gap-3 shadow-sm">
                    <AlertCircle size={20} className="text-red-600" />
                    <span className="text-red-600 font-bold text-sm">{error}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-100 pt-5">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                className="relative flex items-center w-full bg-white border border-slate-200 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all"
              >
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type symptoms here..."
                  className="flex-1 bg-transparent border-none px-4 py-3 text-[17px] font-medium text-slate-900 focus:outline-none focus:ring-0 placeholder-slate-400 resize-none min-h-[48px] max-h-[140px] custom-scrollbar"
                  rows={1}
                />
                <div className="flex items-center gap-2 shrink-0 pr-1">
                  <motion.button 
                    type="button"
                    onClick={toggleMic}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isListening
                        ? 'bg-red-50 text-red-500 animate-pulse'
                        : 'bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Voice Input"
                  >
                    {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-[48px] h-[48px] bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send Message"
                  >
                    <Send size={22} className="ml-0.5" />
                  </motion.button>
                </div>
              </form>

              {/* Voice settings */}
              <div className="flex items-center gap-2 mt-3 px-1">
                <input
                  type="checkbox"
                  id="auto-send-voice"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-blue-600 rounded border border-slate-200"
                />
                <label htmlFor="auto-send-voice" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                  Auto-send after speech recognition
                </label>
              </div>
            </div>
          </motion.div>

          {/* Sidebar - Quick Symptoms Suggestions */}
          <motion.div
            variants={itemVariants}
            className="rounded-[24px] p-6 md:p-8 bg-white border border-slate-200 shadow-sm h-fit"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity size={20} className="text-med-primary" /> Quick Symptoms
            </h3>

            <div className="space-y-4">
              {[
                { label: 'Chest Pain', color: '#ef4444' },
                { label: 'Shortness of Breath', color: '#ef4444' },
                { label: 'Fever', color: '#fb923c' },
                { label: 'Fatigue', color: '#fb923c' },
                { label: 'Headache', color: '#fb923c' },
                { label: 'Dizziness', color: '#34d399' },
                { label: 'Nausea', color: '#34d399' },
                { label: 'Cough', color: '#34d399' },
              ].map((symptom) => {
                const isActive = inputText.toLowerCase().includes(symptom.label.toLowerCase());
                return (
                  <motion.button
                    key={symptom.label}
                    onClick={() => handleSymptomClick(symptom.label)}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full p-3 md:p-4 rounded-[16px] border transition-all text-left font-medium text-sm cursor-pointer ${
                      isActive
                        ? 'border-med-primary bg-med-primary/5 text-med-primary shadow-sm'
                        : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{symptom.label}</span>
                      {isActive && (
                        <div className="w-2.5 h-2.5 bg-med-primary rounded-full shadow-sm animate-pulse" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
};

export default Consultation;