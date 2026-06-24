import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, Phone, ArrowRight, ShieldCheck, Clock, Activity } from 'lucide-react';

const HospitalCard = ({ hospital, onClick }) => {
  const getNormalizedArray = (data) => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') return data.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (data && typeof data === 'object') return Object.values(data).filter(v => typeof v === 'string');
    return [];
  };

  const hospitalName = hospital?.name || hospital?.display_name || "Hospital";
  const hospitalType = hospital?.type || 'General';
  const hospitalRating = hospital?.rating || 'N/A';
  const hospitalDistance = hospital?.distance || 'Calculating...';
  const hospitalPhone = hospital?.phone || null;
  
  const rawSpecialties = hospital?.specialty || hospital?.specialties;
  const specialties = getNormalizedArray(rawSpecialties);
  const displaySpecialties = specialties.length > 0 ? specialties.join(', ') : 'Specialty information unavailable';

  const typeBg = hospitalType === 'Emergency' ? 'bg-red-100 text-red-600 border-red-300'
    : hospitalType === 'Clinic' ? 'bg-blue-100 text-blue-700 border-blue-300'
    : hospitalType === 'Nursing Home' ? 'bg-orange-100 text-orange-700 border-orange-300'
    : 'bg-slate-50 text-green-700 border-green-300';

  const hasPhone = hospitalPhone && hospitalPhone !== 'Phone number not available' && hospitalPhone.replace(/[^0-9+]/g, '').length > 0;
  const isOpen = hospital?.isOpen ?? (hospital?.emergency ? true : null);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white border border-slate-200 rounded-[24px] p-6 relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
      onClick={() => onClick(hospital)}
    >
      <div className="relative z-10 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${typeBg}`}>
            {hospitalType}
          </div>
          <div className="flex items-center gap-1.5 text-amber-spark">
            <Star size={16} fill="currentColor" className="shrink-0" />
            <span className="text-sm font-bold text-slate-900">{hospitalRating}</span>
          </div>
        </div>

        <h3 className="text-xl font-bold uppercase tracking-tight mb-4 group-hover:text-blue-600 transition-colors text-slate-900 line-clamp-2">
          {hospitalName}
        </h3>

        <p className="text-slate-500 text-xs mb-4 line-clamp-1">
          {hospital?.address || 'Address unavailable'}
        </p>

        <div className="flex flex-col gap-2 text-slate-500 text-xs font-bold mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-slate-700 shrink-0" />
            <span className="truncate">{hospitalDistance} {hospitalDistance !== 'Calculating...' ? 'driving distance' : ''}</span>
          </div>
          {hospital?.travelTime_text && (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-700 shrink-0" />
              <span className="truncate">{hospital.travelTime_text}</span>
            </div>
          )}
        </div>

        <div className="mb-4 text-xs">
          <div className="font-bold text-slate-900 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2">
            <Activity size={16} className="shrink-0" /> Core Specialties
          </div>
          <p className="text-slate-500 line-clamp-2">{displaySpecialties}</p>
        </div>
      </div>

      <div className="relative z-10 mt-auto pt-4 border-t border-black/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hospital?.emergency && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-tight bg-red-50 border border-red-200 px-2 py-1 rounded-md">
                <ShieldCheck size={16} className="shrink-0" />
                24/7
              </div>
            )}
            {isOpen !== null && (
              <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
                isOpen 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                {isOpen ? 'Open Now' : 'Closed'}
              </div>
            )}
            {hasPhone && (
              <a 
                href={`tel:${hospitalPhone.replace(/[^0-9+]/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[10px] font-bold text-green-700 uppercase tracking-tight bg-green-50 border border-green-200 hover:bg-green-100 px-2 py-1 rounded-md transition-colors"
                title="Call Hospital"
              >
                <Phone size={16} className="shrink-0" /> Call
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onClick(hospital); }}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-blue-600 group-hover:gap-3 transition-all cursor-pointer"
            >
              Details <ArrowRight size={16} className="shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HospitalCard;
