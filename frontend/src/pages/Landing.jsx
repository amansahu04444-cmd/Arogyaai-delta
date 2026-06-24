import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Activity, ShieldAlert, ArrowRight,
  Stethoscope, FileText, HeartPulse, Sparkles, AlertTriangle, ArrowUpRight,
  Menu, X, MapPin, Navigation
} from 'lucide-react';

const CountUp = ({ to, duration = 1.5, decimals = 1, suffix = "" }) => {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) {
      let start = 0;
      const end = parseFloat(to);
      if (start === end) return;

      const totalMiliseconds = duration * 1000;
      const intervalTime = 30;
      const totalSteps = Math.round(totalMiliseconds / intervalTime);
      const increment = (end - start) / totalSteps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        const val = start + increment * currentStep;
        if (currentStep >= totalSteps) {
          setValue(end);
          clearInterval(timer);
        } else {
          setValue(val);
        }
      }, intervalTime);

      return () => clearInterval(timer);
    }
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
      {suffix}
    </span>
  );
};

const FadeIn = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ 
      type: "spring",
      stiffness: 70,
      damping: 15,
      delay 
    }}
    className={className}
  >
    {children}
  </motion.div>
);

const WaveDivider = ({ fill, bg, isFlipped = false }) => {
  return (
    <div className="w-full overflow-hidden leading-[0] select-none pointer-events-none" style={{ backgroundColor: bg }}>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className={`relative block w-full h-[40px] md:h-[60px] ${isFlipped ? 'rotate-180' : ''}`}
        style={{ fill: fill }}
      >
        <path d="M0,0 C150,90 350,90 500,60 C650,30 850,30 1000,60 C1150,90 1200,90 1200,0 L1200,120 L0,120 Z" />
      </svg>
    </div>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      const sections = ['solutions', 'features', 'insights', 'smart-map', 'company'];
      const scrollPosition = window.scrollY + 250;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const top = element.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };


  return (
    <div className="min-h-screen bg-sky-wash font-sans text-carbon-black relative overflow-x-hidden">
      
      {/* NAVBAR CONTAINER */}
      <div className="fixed top-4 md:top-5 left-0 right-0 w-full z-[1000] flex justify-center px-4 sm:px-6 pointer-events-none">
        <nav className={`pointer-events-auto w-full max-w-[1400px] flex items-center justify-between px-6 md:px-8 h-[72px] md:h-[80px] rounded-[24px] border border-black/5 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.08)]' 
            : 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]'
        }`}>
          {/* Logo */}
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 transition-transform hover:scale-102 duration-200 cursor-pointer group shrink-0"
          >
            <div className="bg-blue-500 p-2 rounded-xl shadow-sm shadow-blue-500/10 border border-white/20">
              <Activity size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight uppercase italic hidden sm:block">
              Arogya<span className="text-blue-500">AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 justify-center flex-1">
            {['solutions', 'features', 'insights', 'company'].map((sec) => {
              const isActive = activeSection === sec;
              return (
                <a
                  key={sec}
                  href={`#${sec}`}
                  onClick={(e) => scrollToSection(e, sec)}
                  className={`relative cursor-pointer text-sm font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-colors duration-300 z-10 ${
                    isActive ? 'text-carbon-black' : 'text-iron hover:text-carbon-black'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-blue-500 border border-slate-200 shadow-sm rounded-full -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {sec}
                </a>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03, y: -1, boxShadow: "0 4px 6px -1px rgba(59,130,246,0.15)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="bg-white hover:bg-white text-carbon-black font-bold text-sm px-5 py-2 rounded-full border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200"
            >
              Login
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, y: -1, boxShadow: "0 4px 6px -1px rgba(59,130,246,0.15)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm px-5 py-2 rounded-full border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200"
            >
              Signup
            </motion.button>
          </div>

          <button className="md:hidden p-2 text-carbon-black" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Mobile dropdown */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 flex flex-col gap-4 overflow-hidden"
              >
                {['solutions', 'features', 'insights', 'company'].map((sec) => (
                  <a
                    key={sec}
                    href={`#${sec}`}
                    onClick={(e) => scrollToSection(e, sec)}
                    className="font-bold text-lg text-iron hover:bg-blue-500/10 p-2 rounded-xl transition-all"
                  >
                    {sec.charAt(0).toUpperCase() + sec.slice(1)}
                  </a>
                ))}
                <div className="flex gap-3 mt-2 border-t border-black/10 pt-4">
                  <button
                    onClick={() => navigate('/login')}
                    className="flex-1 bg-white hover:bg-white text-carbon-black font-bold text-sm py-3 rounded-full border border-slate-200 shadow-md shadow-slate-200/50"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm py-3 rounded-full border border-slate-200 shadow-md shadow-slate-200/50"
                  >
                    Signup
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>

      <main className="w-full pt-[80px]">

        {/* HERO SECTION */}
        <section className="bg-sky-wash pt-16 pb-20 md:pt-24 md:pb-28 relative w-full overflow-hidden">
          
          {/* Subtle floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-full bg-white/40 border border-white/50 pointer-events-none"
              style={{
                top: `${20 + i * 12}%`,
                left: `${8 + (i * 21) % 84}%`,
              }}
              animate={{
                y: [0, -30, 0],
                x: [0, (i % 2 === 0 ? 15 : -15), 0],
                scale: [1, 1.15, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 7 + i * 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Floating Sticker Elements */}
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [-4, 4, -4] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[20%] left-[8%] hidden lg:flex items-center justify-center w-14 h-14 bg-white border border-slate-200 rounded-full shadow-md shadow-slate-200/50 z-20"
          >
            <Stethoscope className="w-6 h-6 text-carbon-black stroke-[2]" />
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0], rotate: [6, -6, 6] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute top-[30%] right-[10%] hidden lg:flex items-center justify-center w-12 h-12 bg-white border border-slate-200 rounded-full shadow-md shadow-slate-200/50 z-20"
          >
            <HeartPulse className="w-6 h-6 text-carbon-black stroke-[2]" />
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0], rotate: [-8, 8, -8] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[25%] left-[12%] hidden lg:flex items-center justify-center w-12 h-12 bg-white border border-slate-200 rounded-full shadow-md shadow-slate-200/50 z-20"
          >
            <ShieldAlert className="w-6 h-6 text-carbon-black stroke-[2]" />
          </motion.div>

          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 12, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[15%] right-[25%] hidden lg:flex items-center justify-center w-10 h-10 bg-white border border-slate-200 rounded-full shadow-md shadow-slate-200/50 z-20"
          >
            <Sparkles className="w-5 h-5 text-amber-spark fill-amber-spark stroke-[2]" />
          </motion.div>

          <motion.div 
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } }
            }}
            initial="hidden"
            animate="visible"
            className="max-w-7xl mx-auto px-6 text-center z-10 relative flex flex-col items-center"
          >
            
            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 25 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } }
              }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 text-carbon-black leading-[1.05]"
              style={{ letterSpacing: "-1.5px" }}
            >
              AI-Powered <br /> Healthcare for <br /> Every Indian
            </motion.h1>

            <motion.p 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
              }}
              className="text-lg md:text-xl font-medium text-slate max-w-2xl mb-10 leading-relaxed"
            >
              We provide instant risk analysis, emergency detection, and actionable health steps through a simple voice interface tailored for India.
            </motion.p>

            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } }
              }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.03, y: -2, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/signup')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200 relative group"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Mic className="w-5 h-5 text-carbon-black group-hover:scale-105 transition-transform" />
                </motion.div>
                Try with Voice
                
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-5 -right-5 bg-amber-spark w-11 h-11 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-bold uppercase text-center leading-tight shadow-sm"
                >
                  <span className="opacity-95 text-carbon-black">Beta</span>
                </motion.div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03, y: -2, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/dashboard')}
                className="bg-white hover:bg-white text-carbon-black px-8 py-4 rounded-full font-bold text-lg border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200"
              >
                Open App
              </motion.button>
            </motion.div>
          </motion.div>
        </section>

        {/* WAVE HERO -> SOLUTIONS */}
        <WaveDivider fill="#b7eaf6" bg="#ffffff" />

        {/* SOLUTIONS SECTION */}
        <section id="solutions" className="bg-white py-16 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              
              {/* Card 1: Voice Assistant (Buttercream Yellow Wash) */}
              <FadeIn delay={0.1}>
                <motion.div 
                  whileHover={{ y: -6, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)", borderColor: "#93c5fd" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="bg-buttercream rounded-xl p-8 md:p-10 border border-slate-200 shadow-md shadow-slate-200/50 flex flex-col h-full text-carbon-black cursor-pointer"
                >
                  <div className="mb-auto">
                    <div className="bg-white w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center mb-6">
                      <Mic className="w-6 h-6 text-carbon-black stroke-[2]" />
                    </div>
                    <h2
                      className="text-3xl font-bold mb-4 tracking-tight leading-none uppercase italic"
                    >
                      Voice Assistant
                    </h2>
                    <p className="text-base font-medium text-carbon-black leading-snug">
                      Speak your symptoms in Hindi, Hinglish, or English.
                    </p>
                  </div>
                </motion.div>
              </FadeIn>

              {/* Card 2: AI Triage (Mint Wash) */}
              <FadeIn delay={0.2}>
                <motion.div 
                  whileHover={{ y: -6, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)", borderColor: "#93c5fd" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="bg-blue-50 rounded-xl p-8 md:p-10 border border-slate-200 shadow-md shadow-slate-200/50 flex flex-col h-full text-carbon-black cursor-pointer"
                >
                  <div className="mb-auto">
                    <div className="bg-white w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center mb-6">
                      <Activity className="w-6 h-6 text-carbon-black stroke-[2]" />
                    </div>
                    <h2
                      className="text-3xl font-bold mb-4 tracking-tight leading-none uppercase italic"
                    >
                      AI Triage
                    </h2>
                    <p className="text-base font-medium text-carbon-black leading-snug">
                      Get instant risk analysis and clear, actionable next steps.
                    </p>
                  </div>
                </motion.div>
              </FadeIn>

              {/* Card 3: Emergency System (Bubblegum Pink Wash) */}
              <FadeIn delay={0.3}>
                <motion.div 
                  whileHover={{ y: -6, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)", borderColor: "#93c5fd" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="bg-bubblegum rounded-xl p-8 md:p-10 border border-slate-200 shadow-md shadow-slate-200/50 flex flex-col h-full text-carbon-black cursor-pointer"
                >
                  <div className="mb-auto">
                    <div className="bg-white w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center mb-6">
                      <ShieldAlert className="w-6 h-6 text-carbon-black stroke-[2]" />
                    </div>
                    <h2
                      className="text-3xl font-bold mb-4 tracking-tight leading-none uppercase italic"
                    >
                      Emergency System
                    </h2>
                    <p className="text-base font-medium text-carbon-black leading-snug">
                      Detects critical cases and triggers instant alerts.
                    </p>
                  </div>
                </motion.div>
              </FadeIn>

            </div>
          </div>
        </section>

        {/* WAVE SOLUTIONS -> FEATURES */}
        <WaveDivider fill="#ffffff" bg="#eff6ff" />

        {/* FEATURES SECTION */}
        <section id="features" className="bg-blue-50 py-20 scroll-mt-24 border-t border-b border-slate-200/5 relative">
          <div className="absolute top-10 right-10 opacity-5 pointer-events-none">
            <Stethoscope className="w-80 h-80 text-carbon-black" />
          </div>
          
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="mb-16 text-center md:text-left">
              <h2
                className="text-5xl md:text-6xl font-bold mb-6 tracking-tight uppercase italic text-carbon-black"
              >
                How Arogya Works
              </h2>
              <p className="text-lg font-bold text-slate max-w-2xl uppercase tracking-wider">
                4 simple steps to access world-class AI diagnostic intelligence from anywhere in India.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: 1, title: 'Speak', desc: 'Describe how you feel naturally.', icon: Mic, color: 'bg-amber-spark' },
                { step: 2, title: 'Analyze', desc: 'AI processes medical logic quickly.', icon: Activity, color: 'bg-bubblegum' },
                { step: 3, title: 'Score', desc: 'Generates a triage risk score.', icon: FileText, color: 'bg-sky-wash' },
                { step: 4, title: 'Action', desc: 'Get directed to a doctor or remedy.', icon: ArrowRight, color: 'bg-blue-400' }
              ].map((item, i) => (
                <FadeIn key={item.step} delay={i * 0.1}>
                  <motion.div 
                    whileHover={{ y: -6, boxShadow: "0 20px 25px -5px rgba(59,130,246,0.15)", borderColor: "#93c5fd" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="bg-white border border-slate-200 rounded-2xl p-8 h-full shadow-xl shadow-slate-200/50 relative flex flex-col text-carbon-black cursor-pointer"
                  >
                    <div className={`absolute -top-4 -right-4 w-10 h-10 rounded-full ${item.color} border border-slate-200 flex items-center justify-center font-bold text-lg z-20 shadow-md shadow-slate-200/50 text-carbon-black`}>
                      {item.step}
                    </div>
                    <div className="bg-[#f5f5f5] w-12 h-12 rounded-full border border-slate-200/20 flex items-center justify-center mb-6">
                      <item.icon className="w-6 h-6 text-carbon-black stroke-[2]" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 uppercase italic text-carbon-black">{item.title}</h3>
                    <p className="font-medium text-slate text-sm leading-relaxed">{item.desc}</p>
                  </motion.div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* WAVE FEATURES -> INSIGHTS */}
        <WaveDivider fill="#eff6ff" bg="#ffffff" />

        {/* INSIGHTS SECTION */}
        <section id="insights" className="bg-white py-16 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Live Example Card */}
              <FadeIn delay={0.1} className="h-full">
                <motion.section 
                  whileHover={{ y: -6, boxShadow: "0 20px 25px -5px rgba(59,130,246,0.15)", borderColor: "#93c5fd" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 relative flex flex-col justify-between h-[500px] shadow-xl shadow-slate-200/50 text-carbon-black cursor-pointer transition-colors duration-300"
                >
                  <h3 className="text-3xl font-bold mb-8 uppercase italic">Live Example</h3>
                  
                  <div className="w-full flex-grow flex flex-col justify-center">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 w-5/6 mb-6 shadow-md shadow-slate-200/50 relative z-10 text-carbon-black font-medium">
                      <p className="text-base">"Mujhe bohot tez chest pain ho raha hai aur saans lene mein dikkat hai."</p>
                    </div>
                    
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="bg-[#f87171] border border-slate-200 rounded-2xl p-6 text-carbon-black ml-auto relative z-10 shadow-xl shadow-slate-200/50 w-5/6"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            <AlertTriangle className="w-6 h-6 text-carbon-black fill-yellow-400 stroke-[2]" />
                          </motion.div>
                          <span className="text-xl font-bold uppercase tracking-wide">Emergency Detected</span>
                        </div>
                        <p className="font-bold text-sm">High risk of Cardiac Event. Please visit the ER immediately.</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.section>
              </FadeIn>

              {/* Instant Triage Report Card (Lilac Wash) */}
              <FadeIn delay={0.2} className="h-full">
                <motion.section 
                  whileHover={{ y: -6, boxShadow: "0 20px 25px -5px rgba(59,130,246,0.15)", borderColor: "#93c5fd" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="bg-blue-50 border border-slate-200 rounded-2xl p-8 md:p-12 flex flex-col justify-between h-[500px] shadow-xl shadow-slate-200/50 text-carbon-black cursor-pointer transition-colors duration-300"
                >
                  <h3 className="text-3xl font-bold mb-6 uppercase italic">Instant Triage Report</h3>
                  
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-200/50 flex flex-col gap-4 text-carbon-black">
                    <div className="flex justify-between items-end border-b border-black/10 pb-4">
                      <div>
                        <span className="text-slate font-bold text-xs uppercase tracking-wider">Risk Level</span>
                        <h4 className="text-4xl font-bold text-red-500 tracking-tight">CRITICAL</h4>
                      </div>
                      <div className="bg-carbon-black text-white w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl border-2 border-red-500 shadow-sm">
                        <CountUp to={9} decimals={0} duration={1.2} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate font-bold text-xs uppercase tracking-wider">Recommendation</span>
                      <p className="text-lg font-bold mt-1 leading-snug">Immediate Medical Attention Required.</p>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-blue-500 hover:bg-blue-600 w-full py-3 border border-slate-200 rounded-xl font-bold text-white mt-2 transition-all duration-200 shadow-md shadow-slate-200/50 flex items-center justify-center gap-2"
                    >
                      <Activity className="w-5 h-5 text-carbon-black stroke-[2]" /> View Full Report
                    </motion.button>
                  </div>
                </motion.section>
              </FadeIn>

            </div>
          </div>
        </section>

        {/* WAVE INSIGHTS -> SMART MAP */}
        <WaveDivider fill="#ffffff" bg="#b7eaf6" />

        {/* SMART MAP SECTION */}
        <section id="smart-map" className="bg-sky-wash py-16 scroll-mt-24 border-t border-slate-200/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-12 items-center">
              
              {/* Left Column: Interactive Map Mockup */}
              <div className="w-full lg:w-1/2">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 h-[400px] relative overflow-hidden shadow-xl shadow-slate-200/50 text-carbon-black">
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#000_1px,_transparent_1px)] bg-[length:20px_20px]"></div>
                  
                  <svg className="absolute inset-0 w-full h-full text-slate/30" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0,50 Q100,20 200,60 T400,50 T600,80 T800,40 L800,400 L0,400 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5,5" />
                    <path d="M100,0 L100,400 M300,0 L300,400 M500,0 L500,400 M700,0 L700,400" stroke="currentColor" strokeWidth="0.5" />
                    <path d="M0,100 L800,100 M0,200 L800,200 M0,300 L800,300" stroke="currentColor" strokeWidth="0.5" />
                  </svg>
                  
                  <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute w-10 h-10 bg-blue-500/25 rounded-full"></motion.div>
                    <div className="w-4 h-4 bg-blue-600 border border-slate-200 rounded-full z-10 border-white border-[2px] shadow-sm"></div>
                    <div className="mt-2 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm whitespace-nowrap">You are here</div>
                  </motion.div>
                  
                  <motion.div initial={{ y: -20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="absolute top-1/4 left-1/4 flex flex-col items-center z-10">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>
                      <MapPin className="w-7 h-7 fill-red-500 text-carbon-black stroke-[1.5]" />
                    </motion.div>
                    <div className="bg-white border border-slate-200 px-2 py-0.5 flex flex-col items-center rounded-lg text-[10px] font-bold shadow-sm mt-1">
                      <span>City ER</span>
                      <span className="text-red-500 font-bold">
                        <CountUp to={2.1} decimals={1} suffix=" km" />
                      </span>
                    </div>
                  </motion.div>
                  
                  <motion.div initial={{ y: -20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="absolute bottom-1/3 right-1/4 flex flex-col items-center z-10">
                    <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: 0.5 }}>
                      <MapPin className="w-6 h-6 fill-blue-400 text-carbon-black stroke-[1.5]" />
                    </motion.div>
                    <div className="bg-white border border-slate-200 px-2 py-0.5 flex flex-col items-center rounded-lg text-[10px] font-bold shadow-sm mt-1">
                      <span>General Care</span>
                      <span className="text-slate">
                        <CountUp to={4.5} decimals={1} suffix=" km" />
                      </span>
                    </div>
                  </motion.div>
                  
                  <div className="absolute top-4 left-4 right-4 bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between z-20 shadow-md shadow-slate-200/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-steel uppercase">Triage Filter Active</span>
                      <span className="font-bold text-sm">"Chest pain"</span>
                    </div>
                    <div className="bg-red-500 text-carbon-black px-3 py-1 rounded-full border border-slate-200 text-xs font-bold shadow-sm">
                      ER Mode
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column: Text & Features List */}
              <div className="w-full lg:w-1/2 space-y-6 text-carbon-black">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-none mb-4">Find the Right Hospital Near You</h2>
                <p className="text-lg font-medium text-slate">Based on your symptoms and risk level, ArogyaAI suggests the most relevant nearby hospitals instantly.</p>
                
                <ul className="space-y-4 my-6">
                  <li className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full border border-slate-200 flex items-center justify-center w-9 h-9 shadow-none">
                      <MapPin className="w-4 h-4 text-carbon-black stroke-[2]" />
                    </div>
                    <span className="text-base font-bold text-carbon-black">Shows nearest hospitals</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full border border-slate-200 flex items-center justify-center w-9 h-9 shadow-none">
                      <Activity className="w-4 h-4 text-carbon-black stroke-[2]" />
                    </div>
                    <span className="text-base font-bold text-carbon-black">AI filters based on symptoms</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full border border-slate-200 flex items-center justify-center w-9 h-9 shadow-none">
                      <AlertTriangle className="w-4 h-4 text-carbon-black stroke-[2]" />
                    </div>
                    <span className="text-base font-bold text-carbon-black">Emergency prioritization</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full border border-slate-200 flex items-center justify-center w-9 h-9 shadow-none">
                      <Navigation className="w-4 h-4 text-carbon-black stroke-[2]" />
                    </div>
                    <span className="text-base font-bold text-carbon-black">Distance-based sorting</span>
                  </li>
                </ul>
                
                <div className="flex flex-wrap gap-4 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.03, y: -1, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)" }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-carbon-black hover:bg-carbon-black/95 text-white px-8 py-3.5 rounded-full font-bold text-lg border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200"
                  >
                    View Hospitals
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03, y: -1, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)" }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-white hover:bg-white text-carbon-black px-8 py-3.5 rounded-full font-bold text-lg border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200 flex items-center gap-2"
                  >
                    <Navigation className="w-5 h-5 text-carbon-black" /> Get Directions
                  </motion.button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* WAVE MAP -> COMPANY */}
        <WaveDivider fill="#b7eaf6" bg="#eff6ff" />

        {/* COMPANY SECTION ( Meadow Green Background ) */}
        <section id="company" className="bg-blue-50 py-20 text-center relative overflow-hidden border-t border-b border-slate-200/5 text-carbon-black scroll-mt-24">
          <div className="relative z-10 flex flex-col items-center max-w-7xl mx-auto px-6">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8 max-w-4xl">
              Healthcare is now <br /> one voice away.
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
              <motion.button
                whileHover={{ scale: 1.03, y: -2, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/signup')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-5 rounded-full font-bold text-xl border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200"
              >
                Try ArogyaAI Now
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03, y: -2, boxShadow: "0 10px 15px -3px rgba(59,130,246,0.15)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                className="bg-white hover:bg-white text-carbon-black px-10 py-5 rounded-full font-bold text-xl border border-slate-200 shadow-md shadow-slate-200/50 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Launch Demo <ArrowUpRight className="w-6 h-6 text-carbon-black" />
              </motion.button>
            </div>
          </div>
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-32 -left-32 opacity-10 pointer-events-none"
          >
            <Stethoscope className="w-[350px] h-[350px] text-carbon-black" />
          </motion.div>
        </section>

        {/* WAVE COMPANY -> FOOTER */}
        <WaveDivider fill="#eff6ff" bg="#f5f5f5" />

      </main>

      {/* FOOTER */}
      <footer className="bg-fog border-t border-slate-200/10 py-16 text-carbon-black relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            
            <div className="flex flex-col gap-4 col-span-1">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-1.5 rounded-full border border-slate-200">
                  <Stethoscope className="w-5 h-5 text-carbon-black stroke-[2]" />
                </div>
                <span className="text-2xl font-bold tracking-tight">Arogya<span className="text-blue-500">AI</span></span>
              </div>
              <p className="text-slate font-medium leading-relaxed text-sm">
                AI-powered healthcare assistant for fast, accessible triage and hospital discovery.
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-lg text-carbon-black tracking-wide">PRODUCT</h4>
              <a href="#" className="text-slate hover:text-blue-500 font-medium text-sm transition-colors">Voice Assistant</a>
              <a href="#" className="text-slate hover:text-blue-500 font-medium text-sm transition-colors">AI Triage</a>
              <a href="#" className="text-slate hover:text-blue-500 font-medium text-sm transition-colors">Emergency System</a>
              <a href="#" className="text-slate hover:text-blue-500 font-medium text-sm transition-colors">Smart Map</a>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-lg text-carbon-black tracking-wide">RESOURCES</h4>
              <a href="#" className="text-slate hover:underline font-medium text-sm transition-colors">Docs</a>
              <a href="#" className="text-slate hover:underline font-medium text-sm transition-colors">API</a>
              <a href="#" className="text-slate hover:underline font-medium text-sm transition-colors">Support</a>
              <a href="#" className="text-slate hover:underline font-medium text-sm transition-colors">Community</a>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-lg text-carbon-black tracking-wide">LEGAL</h4>
              <a href="#" className="text-slate hover:text-carbon-black font-medium text-sm transition-colors">Privacy Policy</a>
              <a href="#" className="text-slate hover:text-carbon-black font-medium text-sm transition-colors">Terms & Conditions</a>
              <a href="#" className="text-slate hover:text-carbon-black font-medium text-sm transition-colors">Disclaimer</a>
            </div>

          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-200/10 text-slate font-medium text-sm gap-4 text-center md:text-left">
            <span>© 2026 ArogyaAI.</span>
            <span>Not a replacement for professional diagnosis.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
