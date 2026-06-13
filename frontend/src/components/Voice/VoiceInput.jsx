import { motion } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useVoice } from '../../hooks/useVoice';

const VoiceInput = ({ onTranscript, disabled = false, size = 'md' }) => {
  const {
    isListening,
    transcript,
    startRecording,
    stopRecording,
  } = useVoice();

  const handleToggle = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const sizeClasses = {
    sm: { button: 'w-12 h-12', icon: 20 },
    md: { button: 'w-16 h-16', icon: 28 },
    lg: { button: 'w-24 h-24', icon: 40 },
    xl: { button: 'w-32 h-32', icon: 56 },
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        whileTap={{ scale: disabled ? 1 : 0.9 }}
        onClick={handleToggle}
        disabled={disabled}
        className={`
          ${sizeClasses[size].button}
          rounded-full brutal-border brutal-shadow
          flex items-center justify-center
          transition-all
          ${isListening
            ? 'bg-neo-red text-white'
            : 'bg-neo-yellow hover:bg-neo-yellow/90'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isListening ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Square className={`fill-white`} size={sizeClasses[size].icon * 0.5} />
          </motion.div>
        ) : (
          <Mic size={sizeClasses[size].icon} />
        )}
      </motion.button>

      {isListening && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-full brutal-border"
        >
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="w-2 h-2 bg-neo-red rounded-full"
          />
          <span className="text-sm font-bold text-neo-red">Listening...</span>
        </motion.div>
      )}

      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white px-4 py-2 rounded-2xl brutal-border max-w-xs"
        >
          <p className="text-sm font-medium text-center">{transcript}</p>
        </motion.div>
      )}
    </div>
  );
};

export default VoiceInput;
