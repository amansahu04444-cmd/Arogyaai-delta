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
      default: return 'bg-slate-50 text-slate-900 border-slate-200';
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
      case 'Triage': return <Activity size={20} className="text-slate-900" />;
      case 'Consultation': return <Search size={20} className="text-slate-900" />;
      case 'Report': return <FileText size={20} className="text-slate-900" />;
      default: return <Clock size={20} className="text-slate-900" />;
    }
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans bg-slate-50 pb-20 selection:bg-blue-600/30">

      <Navbar />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-24 lg:pt-10 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-100 pb-10">
          <div>
            <div className="flex items-center gap-3 text-slate-900 font-bold uppercase tracking-widest text-xs mb-4">
              <Clock size={20} /> Medical Records
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-none mb-4 text-slate-900">
              Consultation<br />History
            </h1>
            <p className="text-slate-500 font-bold text-lg max-w-xl">
              Your past assessments, consultations, and medical reports.
            </p>
          </div>

          <div className="flex gap-4">
            <button className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-md hover:shadow-md transition-all text-slate-900">
              Filter
            </button>
            <button className="px-8 py-4 bg-blue-600 border border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-md hover:shadow-md transition-all text-slate-900">
              Export
            </button>
          </div>
        </motion.div>

        {/* Error Banner */}
        {error && (
          <motion.div
            variants={itemVariants}
            className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm"
          >
            <AlertCircle size={20} className="text-orange-600" />
            <span className="text-orange-600 font-bold text-sm">{error}</span>
          </motion.div>
        )}

        {/* History List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-carbon-black rounded-full animate-spin shadow-sm" />
          </div>
        ) : (
          <div className="space-y-6">
            {historyItems.map((item, index) => (
              <motion.div
                key={item.id || index}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                className={`rounded-2xl p-8 bg-white border border-slate-200 cursor-pointer transition-shadow hover:shadow-md ${selectedItem === item.id ? 'shadow-md ring-2 ring-carbon-black/10' : 'shadow-md'}`}
              >
                <div className="flex items-start gap-6">
                  {/* Icon */}
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm ${item.risk ? getRiskColor(item.risk) : 'bg-slate-50'}`}
                  >
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold uppercase tracking-tight text-slate-900 leading-none mb-2 break-words whitespace-normal">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                          <span className="flex items-center gap-1 text-slate-900 shrink-0">
                            <Calendar size={16} /> {item.date}
                          </span>
                          <span className="text-slate-900 shrink-0">{item.time}</span>
                          <span className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100 shrink-0">{item.type}</span>
                        </div>
                      </div>

                      {item.risk && (
                        <div
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm ${getRiskColor(item.risk)}`}
                        >
                          {item.risk} Risk
                        </div>
                      )}
                    </div>

                    <p className="text-slate-900 font-medium text-sm leading-relaxed mb-4">
                      {typeof item.recommendation === 'object' && item.recommendation !== null
                        ? item.recommendation.summary
                        : item.recommendation}
                    </p>

                    {item.score && (
                      <div className="flex items-center gap-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Triage Score</div>
                        <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden max-w-xs border border-slate-100">
                          <div
                            className={`h-full ${getRiskBg(item.risk)} border-r border-slate-200`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {item.score}
                        </span>
                      </div>
                    )}

                    { selectedItem === item.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="mt-6 pt-6 border-t border-slate-100"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-[14px] shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Category</p>
                            <p className="font-bold text-sm capitalize text-slate-900">{item.category}</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-[14px] shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Recorded</p>
                            <p className="font-bold text-sm text-slate-900">{item.date} at {item.time}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <ChevronRight
                    size={24}
                    className={`text-slate-900 transition-transform ${selectedItem === item.id ? 'rotate-90' : ''}`}
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