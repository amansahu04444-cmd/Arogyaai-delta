import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, FileText, Search, Calendar, ChevronRight, Activity, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../services/api';

const History = () => {
  const [historyItems, setHistoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getHistory();
      if (response.success && response.data) {
        setHistoryItems(response.data);
      } else {
        // No mock data - show empty state
        setHistoryItems([]);
      }
    } catch (err) {
      setError('Failed to load history.');
      setHistoryItems([]); // No fallback mock data
    } finally {
      setIsLoading(false);
    }
  };

  // REMOVED: mockHistory - no longer using hardcoded demo data

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'HIGH': return 'bg-red-50 text-red-600 border-red-200';
      case 'MODERATE': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'LOW': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-fog text-carbon-black border-carbon-black/20';
    }
  };
  
  const getRiskBg = (risk) => {
    switch (risk) {
      case 'HIGH': return 'bg-red-500';
      case 'MODERATE': return 'bg-orange-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-steel';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Triage': return <Activity size={20} className="text-carbon-black" />;
      case 'Consultation': return <Search size={20} className="text-carbon-black" />;
      case 'Report': return <FileText size={20} className="text-carbon-black" />;
      default: return <Clock size={20} className="text-carbon-black" />;
    }
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
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-carbon-black/10 pb-10">
          <div>
            <div className="flex items-center gap-3 text-carbon-black font-bold uppercase tracking-widest text-xs mb-4">
              <Clock size={16} /> Medical Records
            </div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-none mb-4 text-carbon-black">
              Consultation<br />History
            </h1>
            <p className="text-steel font-bold text-lg max-w-xl">
              Your past assessments, consultations, and medical reports.
            </p>
          </div>

          <div className="flex gap-4">
            <button className="px-8 py-4 bg-white border border-carbon-black rounded-2xl font-bold uppercase tracking-widest text-xs shadow-brutal hover:shadow-brutal-dark transition-all text-carbon-black">
              Filter
            </button>
            <button className="px-8 py-4 bg-lime-pulse border border-carbon-black rounded-2xl font-bold uppercase tracking-widest text-xs shadow-brutal hover:shadow-brutal-dark transition-all text-carbon-black">
              Export
            </button>
          </div>
        </motion.div>

        {/* Error Banner */}
        {error && (
          <motion.div
            variants={itemVariants}
            className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 shadow-brutal-sm"
          >
            <AlertCircle size={20} className="text-orange-600" />
            <span className="text-orange-600 font-bold text-sm">{error}</span>
          </motion.div>
        )}

        {/* History List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-lime-pulse border-t-carbon-black rounded-full animate-spin shadow-brutal-sm" />
          </div>
        ) : (
          <div className="space-y-6">
            {historyItems.map((item, index) => (
              <motion.div
                key={item.id || index}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                className={`rounded-[20px] p-8 bg-white border border-carbon-black cursor-pointer transition-shadow hover:shadow-brutal-dark ${selectedItem === item.id ? 'shadow-brutal-dark ring-2 ring-carbon-black/10' : 'shadow-brutal'}`}
              >
                <div className="flex items-start gap-6">
                  {/* Icon */}
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-carbon-black shadow-brutal-sm ${item.risk ? getRiskColor(item.risk) : 'bg-fog'}`}
                  >
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-xl font-bold uppercase tracking-tight text-carbon-black leading-none mb-2">{item.title}</h3>
                        <div className="flex items-center gap-3 text-xs font-bold text-steel">
                          <span className="flex items-center gap-1 text-carbon-black">
                            <Calendar size={12} /> {item.date}
                          </span>
                          <span className="text-carbon-black">{item.time}</span>
                          <span className="px-3 py-1 bg-fog rounded-full border border-carbon-black/10">{item.type}</span>
                        </div>
                      </div>

                      {item.risk && (
                        <div
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-brutal-sm ${getRiskColor(item.risk)}`}
                        >
                          {item.risk} Risk
                        </div>
                      )}
                    </div>

                    <p className="text-carbon-black font-medium text-sm leading-relaxed mb-4">
                      {typeof item.recommendation === 'object' && item.recommendation !== null
                        ? item.recommendation.summary
                        : item.recommendation}
                    </p>

                    {item.score && (
                      <div className="flex items-center gap-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-steel">Triage Score</div>
                        <div className="flex-1 h-3 bg-fog rounded-full overflow-hidden max-w-xs border border-carbon-black/10">
                          <div
                            className={`h-full ${getRiskBg(item.risk)} border-r border-carbon-black/20`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-carbon-black">
                          {item.score}
                        </span>
                      </div>
                    )}

                    { selectedItem === item.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="mt-6 pt-6 border-t border-carbon-black/10"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-sky-wash border border-carbon-black p-4 rounded-[14px] shadow-brutal-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-steel mb-2">Category</p>
                            <p className="font-bold text-sm capitalize text-carbon-black">{item.category}</p>
                          </div>
                          <div className="bg-fog border border-carbon-black p-4 rounded-[14px] shadow-brutal-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-steel mb-2">Recorded</p>
                            <p className="font-bold text-sm text-carbon-black">{item.date} at {item.time}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <ChevronRight
                    size={24}
                    className={`text-carbon-black transition-transform ${selectedItem === item.id ? 'rotate-90' : ''}`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </motion.main>
    </div>
  );
};

export default History;