import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const CardWrapper = ({ isOpen, onClose, children, maxWidth = 'max-w-5xl', hideCloseBtn = false }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
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
            className={`relative w-full ${maxWidth} bg-white border border-carbon-black rounded-[20px] overflow-hidden shadow-brutal-dark flex flex-col md:flex-row`}
          >
            {!hideCloseBtn && (
              <button 
                onClick={onClose}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white border border-carbon-black shadow-brutal flex items-center justify-center text-carbon-black hover:bg-fog transition-colors z-[400]"
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
