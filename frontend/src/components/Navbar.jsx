import React, { useState, useEffect } from 'react';
import { Activity, User, LogOut } from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useHealth } from '../store/HealthContext';
import { motion, AnimatePresence } from 'framer-motion';
import FamilyContactsModal from './FamilyContacts';
import api from '../services/api';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useUserStore();
  const { triageResult, setTriageResult } = useHealth();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCareCircleOpen, setIsCareCircleOpen] = useState(false);

  const navItemClass = ({ isActive }) =>
    `px-6 py-2.5 rounded-full transition-all text-xs font-bold uppercase tracking-wider border ${isActive
      ? 'bg-lime-pulse text-carbon-black border-carbon-black shadow-brutal-sm'
      : 'text-iron border-transparent hover:bg-lime-pulse/15 hover:border-carbon-black hover:shadow-brutal-sm'
    }`;

  const buttonClass = "px-6 py-2.5 rounded-full transition-all text-xs font-bold uppercase tracking-wider border text-iron border-transparent hover:bg-lime-pulse/15 hover:border-carbon-black hover:shadow-brutal-sm cursor-pointer";

  const dropdownRef = React.useRef(null);

  // Close dropdown on click outside or Escape
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <div className="w-full flex justify-center mt-6 fixed top-0 left-0 z-[100] pointer-events-none">
        <div
          className="flex items-center justify-between w-[92%] max-w-7xl px-8 py-4 rounded-full pointer-events-auto bg-white border border-carbon-black shadow-brutal text-carbon-black"
        >
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 transition-transform hover:scale-102 duration-200 cursor-pointer"
          >
            <div className="bg-lime-pulse p-2 rounded-xl shadow-[3px_3px_0px_black] border border-white/20">
              <Activity size={20} className="text-carbon-black" />
            </div>
            <span className="font-bold text-xl tracking-tight uppercase italic hidden sm:block">
              Arogya<span className="text-lime-pulse">AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <NavLink to="/dashboard" className={navItemClass}>Dashboard</NavLink>
            <NavLink to="/consultation" className={navItemClass}>Consultation</NavLink>
            <NavLink to="/hospitals" className={navItemClass}>Hospitals</NavLink>
            <NavLink to="/report" className={navItemClass}>Reports</NavLink>
            <button onClick={() => setIsCareCircleOpen(true)} className={buttonClass}>Care Circle</button>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 rounded-full border border-black p-0.5 shadow-brutal overflow-hidden transition-all hover:scale-105 flex items-center justify-center cursor-pointer bg-white"
              >
                <User size={20} className="text-carbon-black stroke-[2.5]" />
              </div>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-56 bg-white border border-black rounded-2xl shadow-brutal-dark p-2 z-[110]"
                  >
                    <button
                      onClick={() => { navigate('/profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-carbon-black hover:bg-lime-pulse/15 rounded-xl transition-all"
                    >
                      <User size={18} />
                      Profile
                    </button>
                    <div className="h-[1px] bg-black/10 my-2 mx-2"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      
      <FamilyContactsModal isOpen={isCareCircleOpen} onClose={() => setIsCareCircleOpen(false)} />
    </>
  );
};

export default Navbar;
