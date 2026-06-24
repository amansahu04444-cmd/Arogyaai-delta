import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useUserStore } from '../store/userStore';

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useUserStore();
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '' 
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email.trim() || !formData.password.trim()) {
      return;
    }
    
    const success = await login(formData.email.trim(), formData.password);
    if (success) {
      navigate('/dashboard');
    }
  };

  const inputStyle = "w-full bg-white border border-slate-200 rounded-[16px] h-[56px] pl-[52px] pr-[16px] text-slate-900 font-medium outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-slate-400";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900 font-sans selection:bg-blue-600/30">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[560px] bg-white border border-slate-200 rounded-[24px] p-[40px] md:p-[48px] relative z-10 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
      >
        
        {/* Logo */}
        <div className="flex flex-col items-center mb-[40px] relative z-10">
          <div className="bg-blue-600 p-4 rounded-2xl border border-slate-200 mb-[20px] shadow-sm">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-normal uppercase text-slate-900 leading-none">
            Arogya<span className="text-blue-600">AI</span>
          </h1>
          <p className="text-slate-500 font-semibold mt-[12px] text-center uppercase tracking-[2px] text-[14px]">
            Digital Health Command Center
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="relative z-10 flex flex-col" noValidate>
          <div className="mb-[24px]">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={22} className="absolute left-[16px] top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="email"
                required
                className={inputStyle}
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (error) clearError();
                }}
              />
            </div>
          </div>

          <div className="mb-[32px]">
            <div className="flex justify-between items-center ml-1 mb-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Password
              </label>
              <button 
                type="button" 
                className="text-[14px] font-medium text-slate-900 hover:text-blue-600 transition-colors"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock size={22} className="absolute left-[16px] top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="password"
                required
                className={inputStyle}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (error) clearError();
                }}
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            type="submit"
            className="w-full h-[56px] bg-blue-600 text-white rounded-[16px] font-semibold text-[16px] shadow-sm hover:shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-[12px] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>Sign In <ArrowRight size={24} /></>
            )}
          </motion.button>
        </form>

        <p className="mt-[32px] text-center font-bold text-slate-500 text-xs uppercase tracking-widest relative z-10">
          New to ArogyaAI?{' '}
          <button 
            className="text-slate-900 hover:text-blue-600 ml-1 transition-colors" 
            onClick={() => navigate('/signup')}
          >
            Create Account
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
