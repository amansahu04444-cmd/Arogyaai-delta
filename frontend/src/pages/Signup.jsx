import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, User, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../store/userStore';

const Signup = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useUserStore();
  const [formData, setFormData] = useState({ 
    name: '',
    email: '', 
    password: '' 
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      return;
    }
    
    const success = await register(formData.name.trim(), formData.email.trim(), formData.password);
    if (success) {
      navigate('/dashboard');
    }
  };

  const inputStyle = "w-full bg-white border border-carbon-black rounded-xl px-4 py-4 text-carbon-black font-bold outline-none focus:shadow-brutal transition-all placeholder-steel";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-mint-wash text-carbon-black font-sans selection:bg-lime-pulse/30">
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-white border border-carbon-black rounded-[20px] p-8 md:p-10 relative z-10 shadow-brutal-dark"
      >
        
        {/* Header */}
        <div className="mb-10 relative z-10 flex flex-col items-center sm:items-start">
          <div className="bg-lime-pulse p-4 rounded-2xl border border-carbon-black mb-6 shadow-brutal-sm">
            <Activity size={32} className="text-carbon-black" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 uppercase text-carbon-black">
            Join Arogya<span className="text-lime-pulse">AI</span>
          </h1>
          <p className="text-steel font-bold text-xs uppercase tracking-widest">
            Start your medical command center
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

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-steel ml-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel" />
                <input
                  type="text"
                  required
                  className={`${inputStyle} pl-12`}
                  placeholder="username"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (error) clearError();
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-steel ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel" />
                <input
                  type="email"
                  required
                  className={`${inputStyle} pl-12`}
                  placeholder="name@email.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (error) clearError();
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-steel ml-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel" />
              <input
                type="password"
                required
                className={`${inputStyle} pl-12`}
                placeholder="Create password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (error) clearError();
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 py-2">
            <ShieldCheck className="w-5 h-5 text-carbon-black" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-steel">
              Your data is encrypted with AES-256
            </span>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            type="submit"
            className="w-full bg-carbon-black text-white py-4 rounded-xl font-bold text-sm uppercase tracking-widest border border-carbon-black shadow-brutal hover:shadow-brutal-dark active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Register <ArrowRight className="w-5 h-5" /></>
            )}
          </motion.button>
        </form>

        <div className="mt-8 pt-8 border-t border-carbon-black/10 flex flex-col sm:flex-row items-center justify-center gap-2 relative z-10">
          <p className="font-bold text-steel text-xs uppercase tracking-widest">
            Already a member?
          </p>
          <button 
            className="text-carbon-black font-bold hover:text-lime-pulse uppercase tracking-widest text-xs transition-colors"
            onClick={() => navigate('/login')}
          >
            Sign In Now
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
