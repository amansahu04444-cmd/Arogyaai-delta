import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Plus, Filter, Navigation, Phone, ArrowLeft, SlidersHorizontal, ArrowUpDown, ChevronDown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHospitalRecommendation } from '../hooks/useHospitalRecommendation';
import HospitalCard from '../components/HospitalCard';
import HospitalModal from '../components/HospitalModal';
import Navbar from '../components/Navbar';

const HospitalCardSkeleton = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-6 relative overflow-hidden shadow-md animate-pulse flex flex-col justify-between h-[280px]">
      <div className="relative z-10 flex-grow space-y-4">
        {/* Type & Rating Row */}
        <div className="flex justify-between items-center">
          <div className="h-6 w-20 bg-steel/20 border border-slate-200 rounded-full"></div>
          <div className="h-5 w-12 bg-steel/20 rounded"></div>
        </div>

        {/* Hospital Name */}
        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-steel/20 rounded"></div>
          <div className="h-6 w-1/2 bg-steel/20 rounded"></div>
        </div>

        {/* Distance / Travel Time */}
        <div className="space-y-2 pt-2">
          <div className="h-4 w-2/3 bg-steel/15 rounded"></div>
          <div className="h-4 w-1/2 bg-steel/15 rounded"></div>
        </div>

        {/* Core Specialties */}
        <div className="space-y-2">
          <div className="h-3 w-1/3 bg-steel/15 rounded"></div>
          <div className="h-4 w-full bg-steel/10 rounded"></div>
        </div>
      </div>

      {/* Buttons / Actions footer */}
      <div className="relative z-10 mt-auto pt-4 border-t border-black/10 flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-6 w-12 bg-steel/20 rounded-md"></div>
          <div className="h-6 w-12 bg-steel/20 rounded-md"></div>
        </div>
        <div className="h-6 w-20 bg-steel/20 rounded-md"></div>
      </div>
    </div>
  );
};

const HospitalsPage = () => {
  const navigate = useNavigate();
  const { selectedSymptoms, recommendedHospitals, triageResult, isLoading, userLocation } = useHospitalRecommendation();
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Applied filters
  const [distanceRadius, setDistanceRadius] = useState('50');
  const [ratingFilter, setRatingFilter] = useState('0'); // 0 = Any Rating
  
  // Pending filters
  const [pendingDistance, setPendingDistance] = useState('50');
  const [pendingRating, setPendingRating] = useState('0');

  const filterRef = useRef(null);

  // Sync pending filters with applied filters when panel is opened
  useEffect(() => {
    if (isFilterOpen) {
      setPendingDistance(distanceRadius);
      setPendingRating(ratingFilter);
    }
  }, [isFilterOpen, distanceRadius, ratingFilter]);

  // Close filter panel on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHospitalClick = (hospital) => {
    setSelectedHospital(hospital);
    setIsModalOpen(true);
  };

  // Parse distance string to number (e.g., "2.3 km" -> 2.3)
  const parseDistance = (distStr) => {
    if (!distStr) return 999;
    const num = parseFloat(distStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 999 : num;
  };

  // Filtered and sorted hospitals
  const processedHospitals = useMemo(() => {
    let result = [...recommendedHospitals];

    // Distance filter
    const maxDist = parseFloat(distanceRadius);
    result = result.filter(h => (h.distanceValue || parseDistance(h.distance)) <= maxDist);

    // Rating filter
    const minRating = parseFloat(ratingFilter);
    if (minRating > 0) {
      result = result.filter(h => (h.rating || 0) >= minRating);
    }

    // Default sort by driving distance
    result.sort((a, b) => {
      const distA = a.distanceValue !== undefined ? a.distanceValue : parseDistance(a.distance);
      const distB = b.distanceValue !== undefined ? b.distanceValue : parseDistance(b.distance);
      return distA - distB;
    });

    return result;
  }, [recommendedHospitals, distanceRadius, ratingFilter]);

  const activeFilterCount = (distanceRadius !== '50' ? 1 : 0) + (ratingFilter !== '0' ? 1 : 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans bg-slate-50 pb-20 selection:bg-blue-600/30 overflow-x-hidden">
      
      <Navbar />

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-24 lg:pt-10 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-100 pb-10">
          <div>
            <div className="flex items-center gap-3 text-slate-900 font-bold uppercase tracking-widest text-xs mb-4">
              <MapPin size={16} /> Care Network
            </div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-none mb-4 text-slate-900">
              Recommended<br />Facilities
            </h1>
            <p className="text-slate-500 font-bold text-lg max-w-xl">
              Based on your {triageResult ? triageResult.category : 'general'} analysis.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            {/* Filter Button + Dropdown — scoped relative wrapper */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-6 py-3 bg-white border border-slate-200 rounded-[24px] font-bold uppercase tracking-widest text-xs shadow-sm hover:shadow-md transition-all text-slate-900 flex items-center gap-2 cursor-pointer ${isFilterOpen ? 'shadow-md bg-slate-50' : ''}`}
              >
                <SlidersHorizontal size={16} />
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filter Dropdown Panel — opens leftward via right-0 */}
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{ width: '360px', minWidth: '340px', maxWidth: 'calc(100vw - 32px)' }}
                    className="absolute top-full right-0 mt-3 bg-white border border-slate-200 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.10)] z-[9999] flex flex-col overflow-y-auto overflow-x-hidden"
                  >
                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                        <Filter size={15} /> Filters
                      </h4>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="w-7 h-7 flex items-center justify-center rounded-[16px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex flex-col gap-6 px-6 py-5">

                      {/* Distance Filter */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Navigation size={14} className="text-slate-400 shrink-0" />
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Distance Limit</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: '5',  label: '5 km'  },
                            { key: '10', label: '10 km' },
                            { key: '15', label: '15 km' },
                            { key: '20', label: '20 km' },
                            { key: '30', label: '30 km' },
                            { key: '40', label: '40 km' },
                            { key: '50', label: '50 km' },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setPendingDistance(opt.key)}
                              className={`px-4 py-2 rounded-[16px] text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                                pendingDistance === opt.key
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-100 w-full" />

                      {/* Rating Filter */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown size={14} className="text-slate-400 shrink-0" />
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Minimum Rating</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { key: '0',   label: 'Any Rating'  },
                            { key: '4',   label: '4+ Stars'    },
                            { key: '4.5', label: '4.5+ Stars'  },
                            { key: '5',   label: '5.0 Stars'   }
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setPendingRating(opt.key)}
                              className={`w-full text-left px-4 py-2.5 rounded-[16px] text-sm font-medium border transition-all cursor-pointer flex items-center gap-3 ${
                                pendingRating === opt.key
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                pendingRating === opt.key ? 'border-blue-600' : 'border-slate-300'
                              }`}>
                                {pendingRating === opt.key && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                                )}
                              </span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
                      <button
                        onClick={() => {
                          setPendingDistance('50');
                          setPendingRating('0');
                          setDistanceRadius('50');
                          setRatingFilter('0');
                          setIsFilterOpen(false);
                        }}
                        className="flex-1 py-3 bg-white text-slate-700 border border-slate-200 rounded-[16px] text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer text-center"
                      >
                        Clear Filters
                      </button>
                      <button
                        onClick={() => {
                          setDistanceRadius(pendingDistance);
                          setRatingFilter(pendingRating);
                          setIsFilterOpen(false);
                        }}
                        className="flex-1 py-3 bg-blue-600 text-white border border-blue-600 rounded-[16px] text-sm font-semibold hover:bg-blue-700 transition-all cursor-pointer shadow-[0_4px_14px_rgba(37,99,235,0.25)] text-center"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => navigate('/map')}
              className="px-6 py-3 bg-blue-600 text-white rounded-[24px] font-bold uppercase tracking-widest text-xs shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
            >
              Map View
            </button>
          </div>
        </motion.div>

        {/* Content Section */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="text-sm font-bold text-slate-500 tracking-wider animate-pulse">
              Locating nearby healthcare facilities...
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {[...Array(6)].map((_, i) => (
                <HospitalCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : processedHospitals.length === 0 ? (
          <motion.div 
            variants={itemVariants}
            className="flex flex-col items-center justify-center py-20 text-center space-y-8"
          >
            <div className="w-32 h-32 bg-white rounded-[24px] flex items-center justify-center border border-slate-200 shadow-sm">
              <Search size={48} className="text-slate-500" />
            </div>
            <div>
              <h3 className="text-3xl font-bold uppercase tracking-tight mb-2 text-slate-900">
                {recommendedHospitals.length > 0 ? 'No matches for filters' : 'No facilities found'}
              </h3>
              <p className="text-slate-500 font-bold max-w-md mx-auto">
                {recommendedHospitals.length > 0
                  ? 'Try adjusting the distance limit or minimum rating.'
                  : triageResult
                    ? "No facilities match your exact symptoms nearby."
                    : "Start a consultation to get personalized hospital recommendations."
                }
              </p>
            </div>
            {recommendedHospitals.length > 0 ? (
              <button 
                onClick={() => { 
                  setDistanceRadius('50'); 
                  setRatingFilter('0'); 
                  setPendingDistance('50');
                  setPendingRating('0');
                }}
                className="px-10 py-5 bg-white text-slate-900 border border-slate-200 rounded-[24px] font-bold uppercase tracking-widest shadow-md hover:-translate-y-1 hover:shadow-md active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-10 py-5 bg-blue-600 text-slate-900 border border-slate-200 rounded-[24px] font-bold uppercase tracking-widest shadow-md hover:-translate-y-1 hover:shadow-md active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                Start Consultation
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm font-bold text-slate-500 tracking-wider">
              Showing {processedHospitals.length} hospitals within {distanceRadius} KM
              {ratingFilter !== '0' ? ` with ${ratingFilter}+ stars` : ''}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {processedHospitals.map(hospital => (
                <HospitalCard 
                  key={hospital.id}
                  hospital={hospital} 
                  onClick={handleHospitalClick} 
                />
              ))}
            </div>
          </div>
        )}

      </motion.main>

      <HospitalModal 
        hospital={selectedHospital}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userLocation={userLocation}
      />

    </div>
  );
};

export default HospitalsPage;
