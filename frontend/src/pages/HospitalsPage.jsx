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
    <div className="bg-white border border-carbon-black rounded-2xl p-6 relative overflow-hidden shadow-brutal-dark animate-pulse flex flex-col justify-between h-[280px]">
      <div className="relative z-10 flex-grow space-y-4">
        {/* Type & Rating Row */}
        <div className="flex justify-between items-center">
          <div className="h-6 w-20 bg-steel/20 border border-carbon-black/20 rounded-full"></div>
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
    <div className="min-h-screen text-carbon-black font-sans bg-fog pb-20 selection:bg-lime-pulse/30">
      
      <Navbar />

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-36 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-carbon-black/10 pb-10">
          <div>
            <div className="flex items-center gap-3 text-carbon-black font-bold uppercase tracking-widest text-xs mb-4">
              <MapPin size={16} /> Care Network
            </div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-none mb-4 text-carbon-black">
              Recommended<br />Facilities
            </h1>
            <p className="text-steel font-bold text-lg max-w-xl">
              Based on your {triageResult ? triageResult.category : 'general'} analysis.
            </p>
          </div>

          <div className="flex gap-4 relative" ref={filterRef}>
            {/* Filter Button */}
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-8 py-4 bg-white border border-carbon-black rounded-2xl font-bold uppercase tracking-widest text-xs shadow-brutal hover:shadow-brutal-dark transition-all text-carbon-black flex items-center gap-2 cursor-pointer ${isFilterOpen ? 'shadow-brutal-dark bg-fog' : ''}`}
            >
              <SlidersHorizontal size={14} />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-lime-pulse border border-carbon-black text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter Dropdown Panel */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-3 w-80 bg-white border-2 border-carbon-black rounded-2xl shadow-brutal-dark p-6 z-50"
                >
                  <div className="flex items-center justify-between mb-5 border-b border-carbon-black/10 pb-3">
                    <h4 className="font-bold uppercase tracking-widest text-xs text-carbon-black flex items-center gap-2">
                      <Filter size={14} /> Filters
                    </h4>
                  </div>

                  {/* Distance Filter */}
                  <div className="mb-5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-steel block mb-3">
                      <Navigation size={12} className="inline mr-1.5 -mt-0.5" />
                      Distance Limit
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { key: '5', label: '5 KM' },
                        { key: '10', label: '10 KM' },
                        { key: '15', label: '15 KM' },
                        { key: '20', label: '20 KM' },
                        { key: '30', label: '30 KM' },
                        { key: '40', label: '40 KM' },
                        { key: '50', label: '50 KM' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setPendingDistance(opt.key)}
                          className={`py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all cursor-pointer ${
                            pendingDistance === opt.key
                              ? 'bg-lime-pulse border-carbon-black shadow-brutal-sm text-carbon-black'
                              : 'bg-white border-carbon-black/20 text-steel hover:border-carbon-black hover:bg-fog'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rating Filter */}
                  <div className="mb-6">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-steel block mb-3">
                      <ArrowUpDown size={12} className="inline mr-1.5 -mt-0.5" />
                      Minimum Rating
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: '0', label: 'Any Rating' },
                        { key: '4', label: '4+ Stars' },
                        { key: '4.5', label: '4.5+ Stars' },
                        { key: '5', label: '5.0 Stars' }
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setPendingRating(opt.key)}
                          className={`py-2 rounded-xl font-bold text-xs uppercase tracking-widest border transition-all cursor-pointer ${
                            pendingRating === opt.key
                              ? 'bg-lime-pulse border-carbon-black shadow-brutal-sm text-carbon-black'
                              : 'bg-white border-carbon-black/20 text-steel hover:border-carbon-black hover:bg-fog'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPendingDistance('50');
                        setPendingRating('0');
                        setDistanceRadius('50');
                        setRatingFilter('0');
                        setIsFilterOpen(false);
                      }}
                      className="flex-1 py-3 bg-white text-carbon-black border border-carbon-black rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-y-0 active:shadow-none transition-all cursor-pointer"
                    >
                      Clear Filters
                    </button>
                    <button
                      onClick={() => {
                        setDistanceRadius(pendingDistance);
                        setRatingFilter(pendingRating);
                        setIsFilterOpen(false);
                      }}
                      className="flex-1 py-3 bg-lime-pulse text-carbon-black border border-carbon-black rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-y-0 active:shadow-none transition-all cursor-pointer"
                    >
                      Apply Filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={() => navigate('/map')}
              className="px-8 py-4 bg-lime-pulse border border-carbon-black text-carbon-black rounded-2xl font-bold uppercase tracking-widest text-xs shadow-brutal hover:shadow-brutal-dark transition-all cursor-pointer"
            >
              Map View
            </button>
          </div>
        </motion.div>

        {/* Content Section */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="text-sm font-bold text-steel tracking-wider animate-pulse">
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
            <div className="w-32 h-32 bg-white rounded-[20px] flex items-center justify-center border border-carbon-black shadow-brutal-sm">
              <Search size={48} className="text-steel" />
            </div>
            <div>
              <h3 className="text-3xl font-bold uppercase tracking-tight mb-2 text-carbon-black">
                {recommendedHospitals.length > 0 ? 'No matches for filters' : 'No facilities found'}
              </h3>
              <p className="text-steel font-bold max-w-md mx-auto">
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
                className="px-10 py-5 bg-white text-carbon-black border border-carbon-black rounded-2xl font-bold uppercase tracking-widest shadow-brutal hover:-translate-y-1 hover:shadow-brutal-dark active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-10 py-5 bg-lime-pulse text-carbon-black border border-carbon-black rounded-2xl font-bold uppercase tracking-widest shadow-brutal hover:-translate-y-1 hover:shadow-brutal-dark active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                Start Consultation
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm font-bold text-steel tracking-wider">
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
