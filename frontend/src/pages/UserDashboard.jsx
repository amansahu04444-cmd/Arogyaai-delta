import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mic,
  Activity,
  AlertCircle,
  Calendar,
  FileText,
  MapPin,
  Users,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { useHealth } from '../store/HealthContext';
import { useUserStore } from '../store/userStore';

import HospitalModal from '../components/HospitalModal';
import Navbar from '../components/Navbar';
import HeroCard from '../components/HeroCard';
import StatCard from '../components/StatCard';
import FamilyContactsModal from '../components/FamilyContacts';
import { initVoiceRecognition } from '../services/voice';
import { useChatHook } from '../hooks/useChatHook';
import ChatWindow from '../components/Chat/ChatWindow';
import api from '../services/api';

const ArogyaAI = () => {
  const navigate = useNavigate();
  const { selectedSymptoms, toggleSymptom, triageResult, setTriageResult, runTriage, error, loading } = useHealth();
  const { logout, user } = useUserStore();

  const { sendMessage, setIsChatOpen } = useChatHook();
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCareCircleModalOpen, setIsCareCircleModalOpen] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    const rec = initVoiceRecognition(
      async (transcript) => {
        setIsListening(false);
        sendMessage(transcript);
      },
      (err) => {
        console.error('Voice Error:', err);
        setIsListening(false);
        alert(err);
      },
      () => {
        setIsListening(false);
      }
    );
    setRecognition(rec);
  }, [sendMessage, setIsChatOpen]);

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleHospitalClick = (hospital) => {
    setSelectedHospital(hospital);
    setIsModalOpen(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans bg-slate-50 pb-20 selection:bg-blue-600/30">

      <Navbar />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-20 lg:pt-6 px-4 md:px-8 max-w-[1100px] mx-auto flex flex-col min-h-[calc(100vh-80px)] gap-4"
      >

        {/* Emergency Alert Status Banner */}
        {triageResult && (triageResult.risk === 'HIGH' || triageResult.emergency) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-[24px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${triageResult.telegram_sent ? 'bg-green-50 text-green-900 border-green-200' : 'bg-red-50 text-red-900 border-red-200'
              }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">🚨</span>
              <div className="min-w-0 flex-1">
                <span className="font-extrabold text-base block uppercase tracking-wide break-words">
                  {triageResult.telegram_sent ? 'Emergency Alert: ✓ Sent Successfully' : 'Emergency Alert: ⚠ Failed'}
                </span>
                <span className="text-xs font-semibold opacity-80 block break-words whitespace-normal mt-0.5">
                  {triageResult.telegram_sent
                    ? 'Your connected Care Circle members have been automatically notified via Telegram.'
                    : triageResult.telegram_error || 'No active Care Circle members connected to Telegram Bot.'
                  }
                </span>
              </div>
            </div>
            <button
              onClick={() => setTriageResult(null)}
              className="text-xs font-bold uppercase tracking-wider underline hover:opacity-85 self-end sm:self-auto shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Main Section: Voice Triage Full Width */}
        <div className="w-full min-h-[85vh] flex flex-col">
          <HeroCard
            itemVariants={itemVariants}
            triageResult={triageResult}
            sendMessage={sendMessage}
            toggleListening={toggleListening}
            isListening={isListening}
            loading={loading}
          />
        </div>

      </motion.main>

      <HospitalModal hospital={selectedHospital} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <FamilyContactsModal isOpen={isCareCircleModalOpen} onClose={() => setIsCareCircleModalOpen(false)} />

      <ChatWindow />

    </div>
  );
};

export default ArogyaAI;
