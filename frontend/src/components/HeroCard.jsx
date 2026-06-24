import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Volume2, Send } from 'lucide-react';
import { speakResponse, stopSpeech } from '../services/voice';

const HeroCard = ({ itemVariants, triageResult, sendMessage, toggleListening, isListening, loading }) => {
  const [symptomText, setSymptomText] = React.useState('');
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  React.useEffect(() => {
    const handleSpeechChange = (e) => {
      setIsSpeaking(e.detail.speaking);
    };
    window.addEventListener('speechStateChange', handleSpeechChange);
    setIsSpeaking(window.speechSynthesis ? window.speechSynthesis.speaking : false);

    return () => {
      window.removeEventListener('speechStateChange', handleSpeechChange);
    };
  }, []);

  const handleSpeechToggle = () => {
    if (isSpeaking) {
      stopSpeech();
    } else {
      if (triageResult?.recommendation) {
        speakResponse(triageResult.recommendation);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (symptomText.trim()) {
      sendMessage(symptomText);
      setSymptomText('');
    }
  };

  // ── SKELETON LOADING EXPERIENCE ──
  if (loading) {
    return (
      <motion.div 
        variants={itemVariants}
        className="rounded-[24px] p-10 md:p-14 relative overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-md h-full"
      >
        <div className="relative z-10 h-full flex flex-col space-y-6">
          {/* Skeleton badges */}
          <div className="flex justify-between items-center mb-6">
            <div className="h-7 w-36 bg-slate-100 border border-slate-200 rounded-full animate-pulse"></div>
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-slate-100 border border-slate-200 rounded-full animate-pulse"></div>
              <div className="h-8 w-24 bg-slate-100 border border-slate-200 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Animated skeleton title */}
          <div className="h-10 w-2/3 bg-slate-100 rounded-[16px] animate-pulse"></div>
          
          {/* Main content container */}
          <div className="bg-white border border-slate-200 rounded-[24px] p-8 h-[450px] md:h-[500px] space-y-6">
            {/* Animated skeleton summary */}
            <div className="space-y-3">
              <div className="h-4 w-full bg-slate-100 rounded-[16px] animate-pulse"></div>
              <div className="h-4 w-5/6 bg-slate-100 rounded-[16px] animate-pulse"></div>
              <div className="h-4 w-4/5 bg-slate-100 rounded-[16px] animate-pulse"></div>
            </div>
            
            {/* Animated skeleton content blocks */}
            <div className="space-y-3 pt-6 border-t border-slate-100">
              <div className="h-3 w-1/4 bg-slate-200 rounded-[16px] animate-pulse"></div>
              <div className="h-4 w-full bg-slate-50 rounded-[16px] animate-pulse"></div>
              <div className="h-4 w-5/6 bg-slate-50 rounded-[16px] animate-pulse"></div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100">
              <div className="h-3 w-1/4 bg-slate-200 rounded-[16px] animate-pulse"></div>
              <div className="h-4 w-full bg-slate-50 rounded-[16px] animate-pulse"></div>
              <div className="h-4 w-4/5 bg-slate-50 rounded-[16px] animate-pulse"></div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const renderMarkdownBold = (text) => {
    if (!text || typeof text !== 'string') return text;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="w-full flex-1 flex flex-col gap-8 pb-6">
      {/* VOICE TRIAGE CARD */}
      <motion.div 
        variants={itemVariants}
        className="w-full flex-1 min-h-[400px] rounded-[28px] p-8 xl:p-10 relative overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col"
      >
        <div className="relative z-10 h-full flex flex-col">
        {triageResult ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1"
          >
            {/* Badges */}
            <div className="flex justify-between items-center mb-6">
              <div className="px-5 py-2 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase tracking-widest shadow-sm text-slate-700">
                Analysis Complete
              </div>
            </div>

            {/* Modern Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-[24px] border border-slate-200 shadow-sm flex flex-col justify-center items-start ${
                triageResult.risk === 'HIGH' ? 'bg-red-50 text-red-900' :
                triageResult.risk === 'MODERATE' ? 'bg-orange-50 text-orange-900' :
                'bg-green-50 text-green-900'
              }`}>
                <span className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Risk Level</span>
                <span className="text-4xl md:text-5xl font-black tracking-tight">{triageResult.risk}</span>
              </div>

              <div className="p-6 rounded-[24px] border border-slate-200 shadow-sm flex flex-col justify-center items-start bg-blue-50 text-blue-900">
                <span className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Triage Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-black tracking-tight">{triageResult.score}</span>
                  <span className="text-xl font-bold opacity-70">/10</span>
                </div>
              </div>
            </div>

            {/* Header + Speaker */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl lg:text-3xl font-bold uppercase tracking-tight text-slate-900 leading-none">
                AI Response
              </h3>
              <button 
                onClick={handleSpeechToggle}
                className="w-12 h-12 shrink-0 bg-white border border-slate-200 rounded-[16px] hover:bg-slate-50 transition-all shadow-sm relative flex items-center justify-center cursor-pointer"
                title={isSpeaking ? "Mute Speech" : "Speak Response"}
              >
                <Volume2 size={22} className="text-slate-700" />
                {!isSpeaking && (
                  <div className="absolute w-[70%] h-[2.5px] bg-red-500 rotate-[135deg] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                )}
              </button>
            </div>

            {/* Scroll Container Fix */}
            <div className="bg-slate-50/50 border border-slate-200 rounded-[24px] h-[45vh] min-h-[250px] w-full overflow-y-auto custom-scrollbar flex flex-col shadow-inner mb-4">
              <div className="flex-1 p-6 lg:p-8 space-y-6 text-[15px] md:text-[16px] leading-[1.6]">
                {typeof triageResult.recommendation === 'object' && triageResult.recommendation !== null ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[15px] md:text-[16px] leading-[1.6] font-medium text-slate-700">
                        {renderMarkdownBold(triageResult.recommendation.summary)}
                      </p>
                    </div>
                    
                    {triageResult.recommendation.home_care?.length > 0 && (
                      <div className="pt-5 border-t border-slate-100">
                        <h4 className="text-[18px] md:text-[22px] font-bold uppercase tracking-wider text-slate-600 mb-2">🏠 Home Care Guidance</h4>
                        <ul className="list-disc pl-6 space-y-1.5 text-[15px] md:text-[16px] leading-[1.6] text-slate-700 font-medium">
                          {triageResult.recommendation.home_care.map((item, idx) => (
                            <li key={idx} className="pl-2">{renderMarkdownBold(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {triageResult.recommendation.doctor_visit?.length > 0 && (
                      <div className="pt-5 border-t border-slate-100">
                        <h4 className="text-[18px] md:text-[22px] font-bold uppercase tracking-wider text-slate-600 mb-2">🏥 Doctor Consultation</h4>
                        <ul className="list-disc pl-6 space-y-1.5 text-[15px] md:text-[16px] leading-[1.6] text-slate-700 font-medium">
                          {triageResult.recommendation.doctor_visit.map((item, idx) => (
                            <li key={idx} className="pl-2">{renderMarkdownBold(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {triageResult.recommendation.warning_signs?.length > 0 && (
                      <div className="p-5 bg-red-50 border border-red-200 rounded-[16px] mt-5">
                        <h4 className="text-[18px] md:text-[22px] font-bold uppercase tracking-wider text-red-600 mb-2">🚨 Emergency Warning Signs</h4>
                        <ul className="list-disc pl-6 space-y-1.5 text-[15px] md:text-[16px] leading-[1.6] text-red-800 font-bold">
                          {triageResult.recommendation.warning_signs.map((item, idx) => (
                            <li key={idx} className="pl-2">{renderMarkdownBold(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[15px] md:text-[16px] leading-[1.6] font-medium text-slate-700 whitespace-pre-line">
                    {renderMarkdownBold(triageResult.recommendation)}
                  </p>
                )}
              </div>
            </div>

            {/* Input removed from here */}
          </motion.div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-6">
              <div className="px-5 py-2 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase tracking-widest shadow-sm text-slate-700">
                AI Diagnostic Engine Active
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 justify-between items-center w-full mb-8">
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <h2 className="text-5xl lg:text-7xl font-black leading-tight tracking-tight uppercase text-slate-900">
                  VOICE<br />TRIAGE
                </h2>
                <p className="text-base font-medium text-slate-500 max-w-sm leading-relaxed">
                  Describe your symptoms in natural language. The AI diagnostic engine will analyze the risk level and provide triage recommendation.
                </p>
              </div>
              
              {/* Quick Suggestions & Suggested Questions on the right side */}
              <div className="flex-1 w-full flex flex-col justify-between space-y-6 bg-slate-50/50 border border-slate-200 rounded-[24px] p-8 shadow-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">⚡ Quick Suggestions</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Fever', 'Headache', 'Cough', 'Cold', 'Chest Pain', 'Stomach Pain'].map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => setSymptomText(symptom)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-[16px] text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm cursor-pointer"
                      >
                        • {symptom}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">❓ Suggested Questions</h4>
                  <ul className="space-y-2">
                    {[
                      "What should I do for fever?",
                      "How dangerous is chest pain?",
                      "Can dehydration cause headache?"
                    ].map((question, idx) => (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() => setSymptomText(question)}
                          className="text-left text-xs font-semibold text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
                        >
                          "{question}"
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </motion.div>

    {/* CHAT INPUT SECTION */}
    <div className="w-full max-w-[1100px] mx-auto pr-24 lg:pr-[120px]">
      <form onSubmit={handleSubmit} className="relative flex items-center w-full bg-white border border-slate-200 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
        <input 
          type="text" 
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          placeholder="Type your symptoms..."
          className="flex-1 bg-transparent border-none px-6 py-4 text-[17px] font-medium text-slate-900 focus:outline-none focus:ring-0 placeholder-slate-400"
        />
        <div className="flex items-center gap-2 shrink-0 pr-1">
          <motion.button 
            type="button"
            onClick={toggleListening}
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
            disabled={!symptomText.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-[48px] h-[48px] bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send symptoms"
          >
            <Send size={22} className="ml-0.5" />
          </motion.button>
        </div>
      </form>
    </div>
  </div>
  );
};

export default HeroCard;
