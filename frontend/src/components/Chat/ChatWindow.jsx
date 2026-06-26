import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Cpu, Loader2 } from 'lucide-react';
import { useChatHook } from '../../hooks/useChatHook';

const ChatBubble = ({ message }) => {
  const isBot = message.type === 'bot';
  const isError = message.type === 'error';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isBot || isError ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`max-w-[85%] p-4 text-[15px] font-medium leading-relaxed tracking-tight whitespace-pre-line ${
        isBot ? 'bg-white text-slate-900 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm' 
        : isError ? 'bg-red-50 text-red-600 border border-red-200 rounded-2xl shadow-sm'
        : 'bg-blue-600 text-slate-900 rounded-2xl rounded-tr-none border border-slate-200 shadow-sm'
      }`}>
        {message.text}
      </div>
    </motion.div>
  );
};

const ChatWindow = () => {
  const { messages, isChatOpen, setIsChatOpen, sendMessage, isProcessing } = useChatHook();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, isChatOpen]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };


  return (
    <AnimatePresence>
      {isChatOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsChatOpen(false)}
            className="fixed inset-0 bg-black/30 z-[70] md:bg-transparent pointer-events-auto md:pointer-events-none"
          />
          
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[450px] bg-white z-[80] flex flex-col shadow-[-8px_0_30px_rgba(0,0,0,0.1)] border-l border-slate-200 pointer-events-auto"
          >
            {/* Header */}
            <div className="p-6 bg-slate-50 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center border border-slate-200">
                      <Cpu className="w-6 h-6 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 tracking-tight">AI Triage Chat</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Dashboard Synced</span>
                    </div>
                  </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)} 
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-white">
              {messages.map((m) => (
                <ChatBubble key={m.id} message={m} />
              ))}
              {isProcessing && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white text-slate-900 rounded-2xl rounded-tl-none border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-sm font-medium">Analyzing symptoms...</span>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-3 relative group">
                  <input 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      disabled={isProcessing}
                      className="w-full bg-white pl-6 pr-14 py-4 rounded-lg text-[15px] text-slate-900 outline-none font-medium placeholder:text-slate-500 border border-slate-200 focus:shadow-md transition-all disabled:opacity-50" 
                      placeholder="Type symptoms here..." 
                  />
                  <button 
                      onClick={handleSend}
                      disabled={isProcessing || !inputText.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-slate-900 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-[#97d82f] disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-sm"
                  >
                      <Send className="w-4 h-4" />
                  </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatWindow;
