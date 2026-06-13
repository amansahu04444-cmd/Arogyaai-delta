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

  const inputStyle = "w-full bg-white border border-carbon-black rounded-xl px-4 py-4 text-carbon-black font-bold outline-none focus:shadow-brutal transition-all placeholder-steel";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-sky-wash text-carbon-black font-sans selection:bg-lime-pulse/30">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-carbon-black rounded-[20px] p-8 md:p-10 relative z-10 shadow-brutal-dark"
      >
        
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 relative z-10">
          <div className="bg-lime-pulse p-4 rounded-2xl border border-carbon-black mb-6 shadow-brutal-sm">
            <Activity size={32} className="text-carbon-black" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight uppercase text-carbon-black">
            Arogya<span className="text-lime-pulse">AI</span>
          </h1>
          <p className="text-steel font-bold mt-2 text-center uppercase tracking-widest text-xs">
            Digital Health Command Center
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10" noValidate>
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-steel ml-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel" />
              <input
                type="email"
                required
                className={`${inputStyle} pl-12`}
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (error) clearError();
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-steel">
                Password
              </label>
              <button 
                type="button" 
                className="text-[10px] font-bold uppercase tracking-widest text-carbon-black hover:text-lime-pulse transition-colors"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel" />
              <input
                type="password"
                required
                className={`${inputStyle} pl-12`}
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
            className="w-full bg-lime-pulse text-carbon-black py-4 rounded-xl font-bold text-sm uppercase tracking-widest border border-carbon-black shadow-brutal hover:shadow-brutal-dark active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Sign In <ArrowRight className="w-5 h-5" /></>
            )}
          </motion.button>
        </form>

        <p className="mt-10 text-center font-bold text-steel text-xs uppercase tracking-widest relative z-10">
          New to ArogyaAI?{' '}
          <button 
            className="text-carbon-black hover:text-lime-pulse ml-1 transition-colors" 
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
