import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, MicOff, Send, Waves, ShieldCheck, Cpu, AlertTriangle, CheckCircle } from 'lucide-react';
import { streamToState } from '../../utils/streamMessage';

const VoiceChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello Health User, how can I help you today?", type: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [triageResult, setTriageResult] = useState(null);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const text = event.results[0][0].transcript;
        handleSendMessage(text);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = { id: Date.now(), text, type: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setTriageResult(null);

    try {
      // Call backend triage API
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/triage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          userId: "demo-user"
        })
      });

      const data = await response.json();
      if (import.meta.env.DEV) {
        console.log('Triage Response:', data);
      }

      if (data.success) {
        setTriageResult(data);

        // Format response message
        const riskEmoji = data.risk === 'HIGH' ? '🔴' : data.risk === 'MEDIUM' ? '🟡' : '🟢';
        const riskText = `${riskEmoji} Risk Level: ${data.risk} (Score: ${data.score}/10)`;

        let recText = '';
        const rec = data.recommendation;
        if (typeof rec === 'object' && rec !== null) {
          const parts = [];
          if (rec.summary) parts.push(`💡 ${rec.summary}`);
          if (rec.possible_causes?.length > 0) parts.push(`\n🔍 Possible Causes:\n• ${rec.possible_causes.join('\n• ')}`);
          if (rec.home_care?.length > 0) parts.push(`\n🏠 Home Care:\n• ${rec.home_care.join('\n• ')}`);
          if (rec.doctor_visit?.length > 0) parts.push(`\n📅 Doctor Visit:\n• ${rec.doctor_visit.join('\n• ')}`);
          if (rec.warning_signs?.length > 0) parts.push(`\n🚨 Warning Signs:\n• ${rec.warning_signs.join('\n• ')}`);
          recText = parts.join('\n');
        } else {
          recText = `💡 Recommendation:\n${rec}`;
        }

        // Determine text to speak
        const fullBotText = `${riskText}\n\n📋 Category: ${data.category}\n\n${recText}${data.emergency ? '\n\n⚠️ EMERGENCY DETECTED - Seek immediate medical attention!' : ''}`;
            
        const botMessageId = Date.now();
        const botMessage = {
          id: botMessageId,
          text: '', // Start empty
          type: 'bot',
          triage: data
        };
        setMessages(prev => [...prev, botMessage]);
        
        // Stream text progressively
        streamToState(fullBotText, botMessageId, setMessages, 'text');
      } else {
        throw new Error(data.error || 'Triage failed');
      }
    } catch (error) {
      console.error('Triage error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: `Sorry, I couldn't process your symptoms. Error: ${error.message}. Please try again or describe your symptoms in text.`,
        type: 'bot'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'HIGH': return 'text-red-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05, y: -5 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-12 right-12 w-28 h-28 bg-[#191919] rounded-[2.5rem] flex items-center justify-center z-[60] shadow-[0_20px_40px_rgba(0,0,0,0.3)] group overflow-hidden border border-white/10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#d4ff60]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
            <Mic className="w-12 h-12 text-[#d4ff60]" />
            <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -inset-6 bg-[#d4ff60]/10 rounded-full blur-xl"
            />
        </div>
      </motion.button>

      {/* Chat Panel Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[550px] max-w-full bg-[#1e1e1e] z-[80] flex flex-col shadow-[-20px_0_100px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="p-10 bg-[#121212] flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-[#191919] rounded-2xl flex items-center justify-center border border-white/10 relative overflow-hidden">
                        <Cpu className="w-7 h-7 text-[#d4ff60]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-white tracking-tight">ArogyaAI Agent</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 bg-[#d4ff60] rounded-full animate-pulse" />
                        <span className="text-[10px] text-gray-400 font-black tracking-[0.2em] uppercase">Active AI Intelligence</span>
                      </div>
                    </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-[#191919] scrollbar-hide">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-6 text-[17px] font-medium leading-relaxed tracking-tight ${
                      m.type === 'user'
                        ? 'bg-[#d4ff60] text-black rounded-3xl rounded-tr-none'
                        : 'bg-[#2a2a2a] text-white rounded-3xl rounded-tl-none'
                    }`}>
                      {m.text.split('\n').map((line, i) => (
                        <div key={i} className="min-h-[1.5em]">{line}</div>
                      ))}
                    </div>
                  </motion.div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-[#2a2a2a] text-white rounded-3xl rounded-tl-none p-6">
                      <div className="flex gap-2">
                        <motion.div
                          animate={{ y: [0, -10, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6 }}
                          className="w-2 h-2 bg-[#d4ff60] rounded-full"
                        />
                        <motion.div
                          animate={{ y: [0, -10, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}
                          className="w-2 h-2 bg-[#d4ff60] rounded-full"
                        />
                        <motion.div
                          animate={{ y: [0, -10, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                          className="w-2 h-2 bg-[#d4ff60] rounded-full"
                        />
                      </div>
                      <p className="text-sm mt-2 text-gray-400">Analyzing symptoms...</p>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Controls Area */}
              <div className="p-8 bg-[#121212] border-t border-white/5">
                <div className="flex items-center gap-4">
                    {/* Mic Button */}
                    <div className="relative">
                        <AnimatePresence>
                            {isListening && (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1.5, opacity: 0 }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="absolute inset-0 bg-[#d4ff60] rounded-full"
                                />
                            )}
                        </AnimatePresence>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={toggleListening}
                            className={`relative w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all ${
                                isListening ? 'bg-[#d4ff60] text-black' : 'bg-[#1e1e1e] text-[#d4ff60]'
                            } border border-white/10 shadow-2xl`}
                        >
                            {isListening ? (
                                <div className="flex gap-1">
                                    {[1,2,3].map(i => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: [12, 28, 12] }}
                                            transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                            className="w-1.5 bg-black rounded-full"
                                        />
                                    ))}
                                </div>
                            ) : <Mic className="w-10 h-10" />}
                        </motion.button>
                    </div>

                    {/* Text Input */}
                    <div className="flex-1 relative group h-20 flex items-center">
                        <input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                            className="w-full h-full bg-[#1e1e1e] pl-6 pr-16 rounded-2xl text-[16px] text-white outline-none font-medium placeholder:text-gray-600 border border-white/5 focus:border-[#d4ff60]/30 transition-all shadow-inner"
                            placeholder={isListening ? "Listening..." : "Describe symptoms..."}
                        />
                        <button
                            onClick={() => handleSendMessage(inputText)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#d4ff60] text-black rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceChatbot;
