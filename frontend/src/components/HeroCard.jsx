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
        className="rounded-[20px] p-10 md:p-14 relative overflow-hidden border border-carbon-black bg-sky-wash text-carbon-black shadow-brutal-dark h-full"
      >
        <div className="relative z-10 h-full flex flex-col space-y-6">
          {/* Skeleton badges */}
          <div className="flex justify-between items-center mb-6">
            <div className="h-7 w-36 bg-steel/20 border border-carbon-black/20 rounded-full animate-pulse"></div>
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-steel/20 border border-carbon-black/20 rounded-full animate-pulse"></div>
              <div className="h-8 w-24 bg-steel/20 border border-carbon-black/20 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Animated skeleton title */}
          <div className="h-10 w-2/3 bg-steel/20 rounded-xl animate-pulse"></div>
          
          {/* Main content container */}
          <div className="bg-white border border-carbon-black rounded-2xl p-8 h-[450px] md:h-[500px] space-y-6">
            {/* Animated skeleton summary */}
            <div className="space-y-3">
              <div className="h-4 w-full bg-steel/15 rounded-lg animate-pulse"></div>
              <div className="h-4 w-5/6 bg-steel/15 rounded-lg animate-pulse"></div>
              <div className="h-4 w-4/5 bg-steel/15 rounded-lg animate-pulse"></div>
            </div>
            
            {/* Animated skeleton content blocks */}
            <div className="space-y-3 pt-6 border-t border-carbon-black/10">
              <div className="h-3 w-1/4 bg-steel/20 rounded-lg animate-pulse"></div>
              <div className="h-4 w-full bg-steel/10 rounded-lg animate-pulse"></div>
              <div className="h-4 w-5/6 bg-steel/10 rounded-lg animate-pulse"></div>
            </div>

            <div className="space-y-3 pt-6 border-t border-carbon-black/10">
              <div className="h-3 w-1/4 bg-steel/20 rounded-lg animate-pulse"></div>
              <div className="h-4 w-full bg-steel/10 rounded-lg animate-pulse"></div>
              <div className="h-4 w-4/5 bg-steel/10 rounded-lg animate-pulse"></div>
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
        return <strong key={index} className="font-extrabold text-carbon-black">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -4 }}
      className="rounded-[20px] p-10 md:p-14 relative overflow-hidden border border-carbon-black bg-sky-wash text-carbon-black shadow-brutal-dark h-full flex flex-col justify-between"
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
              <div className="px-5 py-2 rounded-full bg-white border border-carbon-black text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm text-carbon-black">
                Analysis Complete
              </div>
            </div>

            {/* Modern Metric Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-[20px] border-2 border-carbon-black shadow-brutal flex flex-col justify-center items-start ${
                triageResult.risk === 'HIGH' ? 'bg-red-100 text-red-900' :
                triageResult.risk === 'MODERATE' ? 'bg-orange-100 text-orange-900' :
                'bg-green-100 text-green-900'
              }`}>
                <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Risk Level</span>
                <span className="text-4xl md:text-5xl font-black tracking-tight">{triageResult.risk}</span>
              </div>

              <div className="p-6 rounded-[20px] border-2 border-carbon-black shadow-brutal flex flex-col justify-center items-start bg-blue-50 text-blue-900">
                <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Triage Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-black tracking-tight">{triageResult.score}</span>
                  <span className="text-xl font-bold opacity-70">/10</span>
                </div>
              </div>
            </div>

            {/* Header + Speaker */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[28px] md:text-[32px] font-bold uppercase tracking-tight text-carbon-black leading-none">
                AI Response
              </h3>
              <button 
                onClick={handleSpeechToggle}
                className="w-12 h-12 shrink-0 bg-white border border-carbon-black rounded-xl hover:bg-lime-pulse/20 transition-all shadow-brutal-sm relative flex items-center justify-center cursor-pointer"
                title={isSpeaking ? "Mute Speech" : "Speak Response"}
              >
                <Volume2 size={22} className="text-carbon-black" />
                {!isSpeaking && (
                  <div className="absolute w-[70%] h-[2.5px] bg-red-600 rotate-[135deg] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                )}
              </button>
            </div>

            {/* Scroll Container Fix */}
            <div className="bg-white border border-carbon-black rounded-2xl h-[450px] md:h-[500px] w-full overflow-y-auto custom-scrollbar flex flex-col shadow-brutal-sm">
              <div className="flex-1 p-6 space-y-5 text-[15px] md:text-[16px] leading-[1.6]">
                {typeof triageResult.recommendation === 'object' && triageResult.recommendation !== null ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[15px] md:text-[16px] leading-[1.6] font-medium text-carbon-black">
                        {renderMarkdownBold(triageResult.recommendation.summary)}
                      </p>
                    </div>
                    
                    {triageResult.recommendation.home_care?.length > 0 && (
                      <div className="pt-5 border-t border-carbon-black/10">
                        <h4 className="text-[18px] md:text-[22px] font-bold uppercase tracking-wider text-steel mb-2">🏠 Home Care Guidance</h4>
                        <ul className="list-disc pl-6 space-y-1.5 text-[15px] md:text-[16px] leading-[1.6] text-carbon-black font-medium">
                          {triageResult.recommendation.home_care.map((item, idx) => (
                            <li key={idx} className="pl-2">{renderMarkdownBold(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {triageResult.recommendation.doctor_visit?.length > 0 && (
                      <div className="pt-5 border-t border-carbon-black/10">
                        <h4 className="text-[18px] md:text-[22px] font-bold uppercase tracking-wider text-steel mb-2">🏥 Doctor Consultation</h4>
                        <ul className="list-disc pl-6 space-y-1.5 text-[15px] md:text-[16px] leading-[1.6] text-carbon-black font-medium">
                          {triageResult.recommendation.doctor_visit.map((item, idx) => (
                            <li key={idx} className="pl-2">{renderMarkdownBold(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {triageResult.recommendation.warning_signs?.length > 0 && (
                      <div className="p-5 bg-red-50 border border-red-200 rounded-xl mt-5">
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
                  <p className="text-[15px] md:text-[16px] leading-[1.6] font-medium text-carbon-black whitespace-pre-line">
                    {renderMarkdownBold(triageResult.recommendation)}
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col md:flex-row gap-4 w-full">
              <input 
                type="text" 
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                placeholder="Type your symptoms here..."
                className="flex-1 bg-white border border-carbon-black rounded-xl px-6 py-4 shadow-brutal-sm focus:outline-none focus:ring-2 focus:ring-lime-pulse font-medium text-carbon-black"
              />
              <div className="flex gap-4">
                <button 
                  type="submit"
                  className="w-14 h-14 bg-lime-pulse text-carbon-black border border-carbon-black rounded-xl flex items-center justify-center hover:bg-[#97d82f] shadow-brutal-sm transition-transform hover:scale-105 active:translate-y-1 active:shadow-none cursor-pointer"
                  title="Send symptoms"
                >
                  <Send size={20} />
                </button>
                <button 
                  type="button"
                  onClick={toggleListening}
                  className={`w-14 h-14 bg-white border border-carbon-black rounded-xl flex items-center justify-center text-carbon-black shadow-brutal-sm transition-colors cursor-pointer ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-lime-pulse/20'}`}
                >
                  <Mic size={20} />
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-6">
              <div className="px-5 py-2 rounded-full bg-white border border-carbon-black text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm text-carbon-black">
                AI Diagnostic Engine Active
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 justify-between items-stretch w-full mb-8">
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="text-6xl md:text-8xl font-bold leading-tight tracking-tight uppercase text-carbon-black mb-4">
                  VOICE<br />TRIAGE
                </h2>
                <p className="text-sm font-semibold text-steel max-w-sm">
                  Describe your symptoms in natural language. The AI diagnostic engine will analyze the risk level and provide triage recommendation.
                </p>
              </div>
              
              {/* Quick Suggestions & Suggested Questions on the right side */}
              <div className="flex-1 w-full flex flex-col justify-between space-y-6 bg-white/40 border border-carbon-black rounded-2xl p-8 shadow-brutal-sm">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-carbon-black mb-3">⚡ Quick Suggestions</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Fever', 'Headache', 'Cough', 'Cold', 'Chest Pain', 'Stomach Pain'].map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => setSymptomText(symptom)}
                        className="px-3 py-1.5 bg-white border border-carbon-black rounded-lg text-xs font-bold text-carbon-black hover:bg-lime-pulse transition-all shadow-brutal-sm hover:-translate-y-0.5 cursor-pointer"
                      >
                        • {symptom}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-carbon-black/10 pt-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-carbon-black mb-3">❓ Suggested Questions</h4>
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
                          className="text-left text-xs font-bold text-carbon-black/80 hover:text-carbon-black hover:underline transition-all cursor-pointer"
                        >
                          "{question}"
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 mt-auto w-full">
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 w-full">
                <input 
                  type="text" 
                  value={symptomText}
                  onChange={(e) => setSymptomText(e.target.value)}
                  placeholder="Type your symptoms here..."
                  className="flex-1 bg-white border border-carbon-black rounded-2xl px-6 py-5 shadow-brutal text-lg font-medium text-carbon-black focus:outline-none focus:ring-2 focus:ring-lime-pulse"
                />
                <div className="flex gap-4">
                  <button 
                    type="submit"
                    className="w-16 h-16 bg-lime-pulse text-carbon-black border border-carbon-black rounded-2xl flex items-center justify-center hover:bg-[#97d82f] shadow-brutal transition-transform hover:scale-105 active:translate-y-1 active:shadow-none cursor-pointer"
                    title="Send symptoms"
                  >
                    <Send size={24} />
                  </button>
                  <motion.button 
                    type="button"
                    onClick={toggleListening}
                    whileTap={{ scale: 0.9 }}
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-carbon-black shadow-brutal-dark hover:scale-105 transition-transform active:translate-y-1 active:shadow-none cursor-pointer ${isListening ? 'bg-red-500 text-white' : 'bg-lime-pulse text-carbon-black'}`}
                  >
                    <Mic size={32} className={isListening ? 'animate-pulse' : ''} />
                  </motion.button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default HeroCard;
