import React from 'react';
import { motion } from 'framer-motion';

const StatCard = ({ stat, itemVariants, glassEffect, cardShadow }) => {
  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -4 }}
      className="rounded-2xl p-12 relative overflow-hidden border border-slate-200 min-h-[200px] flex flex-col justify-center bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-center relative z-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">
            {stat.label}
          </p>
          <div className="flex items-baseline gap-4">
            <h5 
              className="text-6xl font-bold tracking-tight leading-none" 
              style={{ color: stat.color }}
            >
              {stat.value}
            </h5>
            <span className="text-xs font-bold uppercase tracking-tight text-slate-500">
              {stat.sub}
            </span>
          </div>
        </div>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-100 bg-slate-50" style={{ color: stat.color }}>
          {stat.icon}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
