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
      return <p className="font-bold text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>;
    }

    const triage = msg.triage;
    const rec = triage?.recommendation;

    if (!triage || !rec || typeof rec === 'string') {
      return <p className="font-bold text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>;
    }

    return (
      <div className="space-y-4 text-carbon-black">
        {rec.summary && (
          <p className="font-bold text-sm leading-relaxed">{rec.summary}</p>
        )}

        {rec.possible_causes && rec.possible_causes.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-steel">Possible Causes:</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold">
              {rec.possible_causes.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rec.home_care && rec.home_care.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-steel">Home Care:</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold">
              {rec.home_care.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rec.doctor_visit && rec.doctor_visit.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-steel">Doctor Visit:</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold">
              {rec.doctor_visit.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rec.warning_signs && rec.warning_signs.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
              <AlertCircle size={14} /> Warning Signs:
            </h4>
            <ul className="list-disc pl-5 space-y-0.5 text-sm font-bold text-red-600">
              {rec.warning_signs.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {triage.followUpQuestion && (
          <div className="pt-2 border-t border-carbon-black/10 mt-2 text-carbon-black/80 font-bold italic text-sm">
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
    <div className="min-h-screen text-carbon-black font-sans bg-fog pb-20 selection:bg-lime-pulse/30">
      <Navbar />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-36 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-carbon-black/10 pb-10">
          <div>
            <div className="flex items-center gap-3 text-carbon-black font-bold uppercase tracking-widest text-xs mb-4">
              <Activity size={16} /> AI Consultation
            </div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-none mb-4 text-carbon-black">
              Medical<br />Consultation
            </h1>
            <p className="text-steel font-bold text-lg max-w-xl">
              Describe your symptoms in any language for AI-powered triage assessment.
            </p>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Chat Section */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 rounded-[20px] p-8 bg-white border border-carbon-black shadow-brutal-dark min-h-[600px] max-h-[800px] flex flex-col"
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
                  <div className={`max-w-[85%] p-6 rounded-[20px] border border-carbon-black shadow-brutal-sm ${
                    msg.role === 'user'
                      ? 'bg-lime-pulse rounded-tr-none text-carbon-black'
                      : 'bg-fog rounded-tl-none text-carbon-black'
                  }`}>
                    {renderMessageContent(msg)}
                    
                    {msg.triage && (
                      <div className="mt-4 pt-4 border-t border-carbon-black/10">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest">
                          <span className={`px-3 py-1 rounded-full border border-carbon-black shadow-brutal-sm ${
                            msg.triage.risk === 'HIGH' ? 'bg-red-100 text-red-600' :
                            msg.triage.risk === 'MEDIUM' ? 'bg-orange-100 text-orange-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {msg.triage.risk} Risk
                          </span>
                          {(msg.triage.score !== undefined || msg.triage.triage_score !== undefined) && (
                            <span className="text-steel">
                              Score: {msg.triage.score ?? msg.triage.triage_score}
                            </span>
                          )}
                          {msg.triage.category && (
                            <span className="text-steel border border-carbon-black/15 px-2 py-0.5 rounded bg-white/70 shadow-brutal-sm">
                              {msg.triage.category}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-steel/60 mt-3 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-fog border border-carbon-black p-4 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-brutal-sm">
                    <Loader2 size={20} className="text-carbon-black animate-spin" />
                    <span className="text-carbon-black font-bold text-sm">Analyzing symptoms...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 shadow-brutal-sm">
                    <AlertCircle size={20} className="text-red-600" />
                    <span className="text-red-600 font-bold text-sm">{error}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-carbon-black/10 pt-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1 relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type symptoms here..."
                    className="w-full p-6 bg-white border border-carbon-black rounded-2xl resize-none focus:outline-none focus:shadow-brutal transition-all font-bold text-sm text-carbon-black placeholder-steel"
                    rows={2}
                  />
                </div>
                <motion.button
                  onClick={toggleMic}
                  whileTap={{ scale: 0.95 }}
                  className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center border border-carbon-black transition-all shadow-brutal hover:shadow-brutal-dark cursor-pointer ${
                    isListening
                      ? 'bg-red-500 animate-pulse text-white'
                      : 'bg-white text-carbon-black'
                  }`}
                  title="Voice Input"
                >
                  {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                </motion.button>
                <motion.button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 shrink-0 bg-lime-pulse border border-carbon-black rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-brutal hover:shadow-brutal-dark transition-all text-carbon-black cursor-pointer"
                  title="Send Message"
                >
                  <Send size={24} />
                </motion.button>
              </div>

              {/* Voice settings */}
              <div className="flex items-center gap-2 mt-3 px-1">
                <input
                  type="checkbox"
                  id="auto-send-voice"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-lime-pulse rounded border border-carbon-black"
                />
                <label htmlFor="auto-send-voice" className="text-[10px] font-bold uppercase tracking-widest text-steel cursor-pointer select-none">
                  Auto-send after speech recognition
                </label>
              </div>
            </div>
          </motion.div>

          {/* Sidebar - Quick Symptoms Suggestions */}
          <motion.div
            variants={itemVariants}
            className="rounded-[20px] p-8 bg-sky-wash border border-carbon-black shadow-brutal-dark h-fit"
          >
            <h3 className="text-xl font-bold uppercase tracking-tight mb-6 flex items-center gap-3 text-carbon-black">
              <Activity /> Quick Symptoms
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
                    className={`w-full p-4 rounded-xl border transition-all text-left font-bold text-sm cursor-pointer ${
                      isActive
                        ? 'border-carbon-black bg-lime-pulse shadow-brutal-sm text-carbon-black'
                        : 'border-transparent bg-white/40 hover:bg-white hover:border-carbon-black text-steel hover:text-carbon-black'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{symptom.label}</span>
                      {isActive && (
                        <div className="w-3 h-3 bg-white border border-carbon-black rounded-full shadow-brutal-sm animate-pulse" />
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