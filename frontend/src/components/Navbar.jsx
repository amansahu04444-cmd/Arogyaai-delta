import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, User, LogOut, LayoutDashboard, Bot, 
  HeartPulse, FileText, Users, Menu, X, Sparkles, TrendingUp 
} from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useHealth } from '../store/HealthContext';
import FamilyContactsModal from './FamilyContacts';

const Navbar = ({ isLanding = false, activeSection = '', scrollToSection = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isLoggedIn, user } = useUserStore();
  
  const [isOpen, setIsOpen] = useState(false); // Mobile sidebar drawer state
  const [isCareCircleOpen, setIsCareCircleOpen] = useState(false);
  const sidebarRef = useRef(null);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Click outside listener for mobile sidebar drawer
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        // Only trigger close on mobile when open
        if (window.innerWidth < 1024) {
          setIsOpen(false);
        }
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Add has-sidebar to body when mounted to shift page layouts
  useEffect(() => {
    document.body.classList.add('has-sidebar');
    return () => {
      document.body.classList.remove('has-sidebar');
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Patient';
  const userEmail = user?.email || '';

  return (
    <>
      {/* Mobile Top Navbar Header - Hidden on Desktop (lg) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 z-[90] flex items-center justify-between px-6 shadow-sm">
        <div 
          onClick={() => navigate(isLoggedIn ? '/dashboard' : '/')}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="bg-blue-600 p-1.5 rounded-[16px] border border-black/10 shadow-sm">
            <Activity size={16} className="text-slate-900" />
          </div>
          <span className="font-bold text-base tracking-tight uppercase italic text-slate-900">
            Arogya<span className="text-[#2563EB]">AI</span>
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 border border-black/10 rounded-[16px] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Menu size={20} className="text-slate-700" />
        </button>
      </div>

      {/* Sidebar Container */}
      <div 
        className={`fixed inset-y-0 left-0 z-[100] flex transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div 
          ref={sidebarRef}
          className="w-[280px] h-full bg-white rounded-r-[28px] border-r border-black/10 shadow-lg flex flex-col justify-between relative z-[101]"
        >
          {/* Mobile Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden absolute top-5 right-4 p-2 border border-black/10 rounded-[16px] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={16} className="text-slate-700" />
          </button>
          
          {/* Upper Sidebar: Logo & Nav items */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Logo area */}
            <div 
              onClick={() => navigate(isLoggedIn ? '/dashboard' : '/')}
              className="flex items-center gap-3 px-6 py-6 border-b border-black/5 shrink-0 cursor-pointer group select-none"
            >
              <div className="bg-blue-600 p-2 rounded-[16px] shadow-sm border border-white/20 group-hover:scale-105 transition-transform duration-300">
                <Activity size={20} className="text-slate-900" />
              </div>
              <span className="font-bold text-xl tracking-tight uppercase italic text-slate-900">
                Arogya<span className="text-[#2563EB]">AI</span>
              </span>
            </div>

            {/* Navigation links list */}
            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
              {isLanding ? (
                // Landing page marketing navigation
                <>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-3">Navigation</span>
                  {['solutions', 'features', 'insights', 'company'].map((sec) => {
                    const isActive = activeSection === sec;
                    return (
                      <a
                        key={sec}
                        href={`#${sec}`}
                        onClick={(e) => {
                          scrollToSection && scrollToSection(e, sec);
                          setIsOpen(false);
                        }}
                        className={`flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider cursor-pointer ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#2563EB] border-[#EFF6FF] shadow-sm font-extrabold'
                            : 'text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                        }`}
                      >
                        {sec === 'solutions' && <Sparkles size={16} />}
                        {sec === 'features' && <Activity size={16} />}
                        {sec === 'insights' && <TrendingUp size={16} />}
                        {sec === 'company' && <Users size={16} />}
                        <span className="capitalize">{sec}</span>
                      </a>
                    );
                  })}
                </>
              ) : (
                // Logged in dashboard navigation
                <>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-3">Health Workspace</span>
                  
                  <NavLink to="/dashboard" className={({ isActive }) => 
                    `flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#2563EB] border-[#EFF6FF] shadow-sm font-extrabold'
                        : 'text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                    }`
                  }>
                    <LayoutDashboard size={16} />
                    <span>Dashboard</span>
                  </NavLink>

                  <NavLink to="/consultation" className={({ isActive }) => 
                    `flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#2563EB] border-[#EFF6FF] shadow-sm font-extrabold'
                        : 'text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                    }`
                  }>
                    <Bot size={16} />
                    <span>Consultation</span>
                  </NavLink>

                  <NavLink to="/hospitals" className={({ isActive }) => 
                    `flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#2563EB] border-[#EFF6FF] shadow-sm font-extrabold'
                        : 'text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                    }`
                  }>
                    <HeartPulse size={16} />
                    <span>Hospitals</span>
                  </NavLink>

                  <NavLink to="/report" className={({ isActive }) => 
                    `flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#2563EB] border-[#EFF6FF] shadow-sm font-extrabold'
                        : 'text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                    }`
                  }>
                    <FileText size={16} />
                    <span>Reports</span>
                  </NavLink>

                  <button 
                    onClick={() => {
                      setIsCareCircleOpen(true);
                      setIsOpen(false);
                    }} 
                    className="w-full text-left flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB] cursor-pointer"
                  >
                    <Users size={16} />
                    <span>Care Circle</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Lower Sidebar: Profile / Auth */}
          <div className="shrink-0">
            {isLanding ? (
              // Marketing login/signup section
              <div className="p-6 border-t border-black/5 space-y-3 bg-slate-50/50">
                <button
                  onClick={() => {
                    navigate('/login');
                    setIsOpen(false);
                  }}
                  className="w-full py-3 border border-slate-200 hover:border-black/20 hover:bg-[#EFF6FF] hover:text-[#2563EB] text-slate-600 font-bold text-sm rounded-[16px] transition-all duration-300 cursor-pointer text-center bg-white shadow-sm"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    navigate('/signup');
                    setIsOpen(false);
                  }}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm rounded-[16px] shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] transition-all duration-300 cursor-pointer text-center"
                >
                  Signup
                </button>
              </div>
            ) : isLoggedIn && (
              // Authenticated user profile section
              <div className="border-t border-black/5 bg-slate-50/30 px-4 py-6">
                {/* User info */}
                <div className="px-5 mb-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-slate-100 border border-black/10 flex items-center justify-center shrink-0">
                    <User size={18} className="text-slate-600 stroke-[2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold text-slate-800 truncate tracking-tight">{userName}</p>
                    {userEmail && (
                      <p className="text-[12px] font-medium text-slate-500 truncate mt-0.5">{userEmail}</p>
                    )}
                  </div>
                </div>

                {/* Profile actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setIsOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider text-slate-600 border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB] cursor-pointer"
                  >
                    <User size={16} />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3.5 px-5 py-3 rounded-[16px] transition-all duration-300 transform hover:translate-x-1 border text-[13px] font-bold uppercase tracking-wider text-red-500 border-transparent hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile background dim overlay */}
        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-xs z-[99] transition-opacity duration-300"
          />
        )}
      </div>
      
      {/* Care Circle Modal */}
      <FamilyContactsModal isOpen={isCareCircleOpen} onClose={() => setIsCareCircleOpen(false)} />
    </>
  );
};

export default Navbar;
