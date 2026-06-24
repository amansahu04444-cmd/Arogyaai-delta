import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const CardWrapper = ({ isOpen, onClose, children, maxWidth = 'max-w-5xl', hideCloseBtn = false }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative w-full ${maxWidth} bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md flex flex-col md:flex-row max-h-[90vh] overflow-y-auto`}
          >
            {!hideCloseBtn && (
              <button 
                onClick={onClose}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors z-[400]"
              >
                <X size={20} />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CardWrapper;
