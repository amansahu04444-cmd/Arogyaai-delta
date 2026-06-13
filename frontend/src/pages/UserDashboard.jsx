import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Activity,
  AlertCircle,
  Calendar,
  FileText,
  MapPin,
  Users,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import { useHealth } from '../store/HealthContext';

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
    <div className="min-h-screen text-carbon-black font-sans bg-fog pb-20 selection:bg-lime-pulse/30">

      <Navbar />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-36 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        {/* Emergency Alert Status Banner */}
        {triageResult && (triageResult.risk === 'HIGH' || triageResult.emergency) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border-2 border-carbon-black flex items-center justify-between shadow-brutal-sm ${triageResult.telegram_sent ? 'bg-green-100 text-green-950 border-green-500' : 'bg-red-100 text-red-950 border-red-500'
              }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <span className="font-extrabold text-base block uppercase tracking-wide">
                  {triageResult.telegram_sent ? 'Emergency Alert: ✓ Sent Successfully' : 'Emergency Alert: ⚠ Failed'}
                </span>
                <span className="text-xs font-semibold opacity-80">
                  {triageResult.telegram_sent
                    ? 'Your connected Care Circle members have been automatically notified via Telegram.'
                    : triageResult.telegram_error || 'No active Care Circle members connected to Telegram Bot.'
                  }
                </span>
              </div>
            </div>
            <button
              onClick={() => setTriageResult(null)}
              className="text-xs font-bold uppercase tracking-wider underline hover:opacity-85"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Top Section: Main Layout */}
        <div className="w-full min-h-[70vh] flex flex-col">
          <HeroCard
            itemVariants={itemVariants}
            triageResult={triageResult}
            sendMessage={sendMessage}
            toggleListening={toggleListening}
            isListening={isListening}
            loading={loading}
          />
        </div>

        {/* Bottom Section: Priorities + Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Top Row: Priorities */}
          {[
            {
              id: 'hospitals',
              title: 'Hospitals & Centers',
              desc: 'Find nearby emergency rooms and trusted healthcare facilities.',
              color: 'text-blue-600',
              bgWash: 'bg-blue-50',
              icon: <MapPin size={28} />
            },
            {
              id: 'reports',
              title: 'Medical Reports',
              desc: 'Track your symptom progression and AI health summaries.',
              color: 'text-green-600',
              bgWash: 'bg-green-50',
              icon: <FileText size={28} />
            },
            {
              id: 'care_circle',
              title: 'Care Circle',
              desc: 'Manage your trusted emergency contacts and family network.',
              color: 'text-lime-pulse',
              bgWash: 'bg-lime-pulse/15',
              icon: <Users size={28} />
            }
          ].map((card, i) => (
            <motion.div
              key={i}
              onClick={() => {
                if (card.id === 'care_circle') {
                  setIsCareCircleModalOpen(true);
                } else if (card.id === 'hospitals') {
                  navigate('/hospitals');
                } else if (card.id === 'reports') {
                  navigate('/report');
                }
              }}
              variants={itemVariants}
              whileHover={{ y: -6, scale: 1.02 }}
              className="rounded-[20px] p-8 bg-white border border-carbon-black cursor-pointer group flex flex-col justify-between min-h-[220px] shadow-brutal hover:shadow-brutal-dark transition-all"
            >
              <div className="mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-carbon-black group-hover:scale-110 transition-transform shadow-brutal-sm ${card.bgWash} ${card.color}`}>
                  {card.icon}
                </div>
              </div>
              <div>
                <h5 className="font-bold text-xl tracking-tight uppercase mb-2 text-carbon-black">
                  {card.title}
                </h5>
                <p className="text-sm font-semibold text-steel leading-snug">
                  {card.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </motion.main>

      <HospitalModal hospital={selectedHospital} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <FamilyContactsModal isOpen={isCareCircleModalOpen} onClose={() => setIsCareCircleModalOpen(false)} />

      <ChatWindow />



    </div>
  );
};

export default ArogyaAI;
