import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, RefreshCw, X, ShieldAlert, Siren } from 'lucide-react';
import { useHealth } from '../store/HealthContext';
import { useHospitalRecommendation } from '../hooks/useHospitalRecommendation';
import { useUserStore } from '../store/userStore';
import api, { getUserProfile, queryCopilot, downloadTimelinePdf } from '../services/api';

const GlobalCopilot = () => {
  const downloadFile = async (url, filename = 'medical-report.pdf') => {
    try {
      const response = await downloadTimelinePdf('me', '');
      const file = new Blob([response], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(file);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PDF Download failed:', err);
      alert('Failed to compile and download PDF: ' + err.message);
    }
  };

  const handleExportPdf = async (e) => {
    e?.preventDefault();
    console.log("PDF Export Clicked");
    await downloadFile();
  };
  const { isLoggedIn } = useUserStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { timelineEntries, triageResult, setTriageResult, fetchTimeline } = useHealth();
  const { recommendedHospitals } = useHospitalRecommendation();

  const [isOpen, setIsOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your AI Health Copilot. I can analyze your clinical history, summarize your symptom progression, evaluate chronic conditions, or find nearby medical facilities. What would you like me to inspect?'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [careCircleContacts, setCareCircleContacts] = useState([]);
  const [contextLoaded, setContextLoaded] = useState(false);

  const messagesEndRef = useRef(null);

  // Load backend context when drawer opens - fetch FRESH timeline data from Supabase
  const loadContext = async () => {
    try {
      setContextLoaded(false);

      // CRITICAL: Fetch fresh timeline entries from Supabase
      console.log('[Copilot] Fetching fresh timeline from Supabase...');
      await fetchTimeline();
      console.log('[Copilot] Timeline entries after fetch:', timelineEntries.length);

      const profileRes = await getUserProfile();
      if (profileRes?.success && profileRes?.data) {
        const profile = profileRes.data.user || profileRes.data;
        setUserProfile(profile);
        console.log('[Copilot] User profile loaded:', profile?.name);
      }
      const familyRes = await api.get('/api/user/family');
      if (familyRes?.success && familyRes?.data) {
        setCareCircleContacts(familyRes.data);
        console.log('[Copilot] Family contacts loaded:', familyRes.data.length);
      }
      setContextLoaded(true);
      console.log('[Copilot] Context fully loaded');
    } catch (err) {
      console.error('Failed to load copilot context:', err);
      setContextLoaded(true); // Proceed with local data
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContext();
    }
  }, [isOpen]);

  const handleResetCopilot = async () => {
    try {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I am your AI Health Copilot. I can analyze your clinical history, summarize your symptom progression, evaluate chronic conditions, or find nearby medical facilities. What would you like me to inspect?'
      }]);
      await loadContext();
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Escape key to close
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Background scroll locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Format context for payload - use REAL timeline data from Supabase
  const buildContextPayload = () => {
    const timelineData = timelineEntries.map(e => ({
      date: e.date,
      symptoms: e.symptoms,
      severity: e.severity,
      temperature: e.temperature || 'N/A',
      risk_level: e.risk_level || 'N/A',
      ai_summary: e.ai_summary || '',
      notes: e.notes || ''
    }));

    // Debug: Log timeline data being sent
    console.log('[Copilot] Timeline entries sent to backend:', timelineData.length);
    console.log('[Copilot] Timeline sample:', timelineData.slice(0, 2));

    return {
      timeline: timelineData,
      reports: timelineData, // Use timeline entries as reports (no separate reports table)
      doctorSummary: triageResult?.recommendation || "No triage recommendation generated yet.",
      hospitals: recommendedHospitals.slice(0, 5).map(h => ({
        name: h.name,
        rating: h.rating || 'N/A',
        address: h.address || 'Nearby',
        phone: h.phone || 'N/A'
      })),
      careCircle: careCircleContacts.map(c => ({
        name: c.name,
        relation: c.relation,
        phone: c.phone || 'N/A'
      })),
      emergencyAlerts: triageResult ? {
        risk: triageResult.risk,
        score: triageResult.score,
        emergency: triageResult.emergency,
        telegram_sent: triageResult.telegram_sent
      } : null,
      medicalQr: userProfile ? {
        patient_info: {
          name: userProfile.name,
          blood_group: userProfile.blood_type || 'Unknown',
          age: userProfile.age || 'Unknown',
          gender: userProfile.gender || 'Unknown'
        },
        medical_info: {
          allergies: userProfile.allergies || [],
          conditions: userProfile.conditions || [],
          medications: userProfile.medications || []
        },
        emergency_info: {
          emergency_contact: userProfile.emergency_contact || 'None'
        }
      } : null
    };
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    if (!textToSend) {
      setInputMessage('');
    }

    const userMsg = { id: Date.now(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);

    setIsProcessing(true);

    try {
      const context = buildContextPayload();
      console.log('[Copilot] Sending query to backend:', query);
      console.log('[Copilot] Context timeline count:', context.timeline.length);

      const res = await queryCopilot(query, context);

      console.log('[Copilot] Backend Response:', res);
      console.log('FULL COPILOT RESPONSE', res);
      console.log("Copilot Type:", res?.type);
      console.log("Hospitals:", res?.hospitals);
      console.log('[Copilot] Response source:', res?.source);
      console.log('[Copilot] Timeline count from backend:', res?.timelineCount);
      console.log('[Copilot] Report count from backend:', res?.reportCount);

      if (res?.success && (res?.answer || res?.type === 'hospital_cards')) {
        console.log('[Copilot] Rendered Answer length:', res.answer?.length || 0);
        console.log('[Copilot] Tool Executed:', res.toolExecuted);

        // Phase 6: Clean output - don't show internal tool names to users
        // Only show subtle indicator for fallback mode
        let sourceLabel = '';
        if (res.source === 'fallback') {
          sourceLabel = '\n\n⚠️ _Using offline mode_';
        } else if (res.source === 'gemini') {
          // Don't show anything for normal AI responses
        }
        // Don't show tool names to users

        let cleanContent = res.answer || '';
        cleanContent = cleanContent
          .replace(/Download:\s*\/api\/timeline\/pdf/gi, '')
          .replace(/\/api\/timeline\/pdf/gi, '')
          .trim();

        const msgPayload = {
          id: Date.now() + 1,
          role: 'assistant',
          content: cleanContent + sourceLabel,
          source: res.source || 'gemini',
          type: res.type,
          downloadUrl: res.downloadUrl,
          toolExecuted: res.toolExecuted || null,
          toolData: res.toolData || null,
          hospitals: res.hospitals || null,
          emergencyData: res.emergencyData || null,
          timelineData: res.timelineData || null,
          triageData: res.triageData || null,
          summaryData: res.summaryData || null,
          qrData: res.qrData || null,
          insightsData: res.insightsData || null,
          reportsData: res.reportsData || null,
          timelineCount: res.timelineCount,
          reportCount: res.reportCount
        };
        
        console.log("Adding Message", { type: res.type, hospitals: res.hospitals, answer: res.answer });
        
        setMessages(prev => [...prev, msgPayload]);
      } else {
        const errorDetail = res?.message || res?.error || 'Unknown error occurred';
        throw new Error(errorDetail);
      }
    } catch (err) {
      console.error('[Copilot Error]', err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `⚠️ **Error**: ${err.message}\n\nPlease check:\n• Is the backend server running? (port 5000)\n• Is the AI service running? (port 8000)\n• Check browser console for CORS errors.`
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMarkdownBold = (text) => {
    if (!text || typeof text !== 'string') return text;
    if (text.includes('/api/timeline/pdf')) {
      text = text.replace(/\/api\/timeline\/pdf/gi, '');
    }
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-extrabold text-carbon-black">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const suggestions = [
    { label: '🔍 Analyze My Symptoms', query: 'Analyze my health history and summarize my symptoms.' },
    { label: '🩺 Generate Doctor Summary', query: 'Generate a clinical doctor summary based on my records.' },
    { label: '🏥 Find Nearby Hospitals', query: 'Find nearest recommended hospitals from my context.' },
    { label: '🚨 Emergency Help', query: 'Show emergency helpline contacts and Care Circle information.' }
  ];

  const renderHospitalCards = (hospitals) => {
    return (
      <div className="mt-4 space-y-4">
        <h4 className="font-bold text-carbon-black text-sm mb-3">🏥 Nearby Hospitals</h4>
        {hospitals.map((hospital, idx) => (
          <div key={idx} className="border-2 border-carbon-black p-5 rounded-xl bg-white shadow-brutal hover:shadow-none hover:translate-y-1 transition-all">
            <h5 className="font-black text-lg text-carbon-black mb-3">{hospital.name}</h5>
            {hospital.rating && <p className="text-sm text-carbon-black font-bold mb-3 flex items-center gap-2">⭐ {hospital.rating}</p>}
            <p className="text-sm text-carbon-black font-medium mb-4 flex items-start gap-2">
              <span>📍</span> 
              <span>{hospital.address || 'Address not available'}</span>
            </p>
            {hospital.distance && <p className="text-sm text-carbon-black font-medium mb-4 flex items-center gap-2">📏 {hospital.distance.toFixed(1)} km</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + " " + hospital.address)}`, '_blank')}
                className="flex-1 bg-white hover:bg-fog text-carbon-black border-2 border-carbon-black px-4 py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-brutal-sm active:translate-y-0.5 active:shadow-none"
              >
                Directions
              </button>
              {hospital.phone && (
                <button
                  onClick={() => window.location.href = `tel:${hospital.phone}`}
                  className="flex-1 bg-carbon-black hover:bg-carbon-black/90 text-white border-2 border-carbon-black px-4 py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-brutal-sm active:translate-y-0.5 active:shadow-none"
                >
                  Call
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHealthSummary = (triageData) => {
    if (!triageData || !triageData.score) return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No health summary data available.</div>;
    return (
      <div className="mt-4 border-2 border-carbon-black p-5 rounded-xl bg-[#f4fae6] shadow-brutal text-carbon-black">
        <h4 className="font-bold text-sm mb-4 uppercase tracking-wider border-b-2 border-carbon-black/10 pb-2">Health Summary</h4>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-white p-3 border-2 border-carbon-black rounded-lg">
            <span className="font-bold text-sm">Risk Score</span>
            <span className="font-black text-xl">{triageData.score || 'N/A'}/10</span>
          </div>
          <div className="flex justify-between items-center bg-white p-3 border-2 border-carbon-black rounded-lg">
            <span className="font-bold text-sm">Risk Level</span>
            <span className="font-black text-xl">{triageData.category || 'UNKNOWN'}</span>
          </div>
          <div className="flex justify-between items-center bg-white p-3 border-2 border-carbon-black rounded-lg">
            <span className="font-bold text-sm">Symptoms</span>
            <span className="font-bold">{triageData.symptoms?.length || 0} Active</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = (timelineData) => {
    if (!timelineData?.entries || timelineData.entries.length === 0) return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No timeline entries available.</div>;
    return (
      <div className="mt-4 space-y-4 p-5 border-2 border-carbon-black rounded-xl bg-sky-wash shadow-brutal">
        <h4 className="font-bold text-carbon-black text-sm mb-3">📋 Symptom Timeline</h4>
        <div className="pl-4 border-l-4 border-carbon-black space-y-6">
          {timelineData.entries.slice(-5).map((entry, idx) => (
            <div key={idx} className="relative">
              <div className="absolute -left-[26px] top-0 w-4 h-4 rounded-full border-2 border-carbon-black bg-white" />
              <div className="bg-white border-2 border-carbon-black p-4 rounded-xl shadow-brutal-sm">
                <p className="text-xs font-bold text-steel mb-2">{entry.date}</p>
                <p className="font-black text-sm mb-2">{entry.symptoms}</p>
                <span className={`inline-block px-3 py-1 text-xs font-bold rounded-md border-2 border-carbon-black ${entry.risk_level === 'High' ? 'bg-red-400 text-white' : entry.risk_level === 'Medium' ? 'bg-yellow-400' : 'bg-lime-pulse'}`}>
                  {entry.risk_level} Risk
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDoctorSummary = (summaryData) => {
    if (!summaryData || !summaryData.patientInfo) return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No doctor summary available.</div>;
    return (
      <div className="mt-4 bg-white border-2 border-carbon-black rounded-xl shadow-brutal overflow-hidden">
        <div className="bg-white border-b-2 border-carbon-black p-4">
          <h4 className="font-black text-lg text-carbon-black">Doctor Consultation Card</h4>
          <p className="text-xs font-bold text-steel mt-1">Patient: {summaryData.patientInfo?.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <details className="group border-2 border-carbon-black rounded-lg bg-white overflow-hidden" open>
            <summary className="font-bold text-sm uppercase text-carbon-black p-3 bg-fog cursor-pointer select-none border-b-2 border-transparent group-open:border-carbon-black">
              Timeline Summary
            </summary>
            <div className="p-4 text-sm font-medium">
              {summaryData.statistics?.totalEntries} entries recorded.
            </div>
          </details>

          {summaryData.latestTriage && (
            <details className="group border-2 border-carbon-black rounded-lg bg-white overflow-hidden" open>
              <summary className="font-bold text-sm uppercase text-carbon-black p-3 bg-red-50 cursor-pointer select-none border-b-2 border-transparent group-open:border-carbon-black">
                Risk Assessment
              </summary>
              <div className="p-4 font-bold text-sm text-red-700">
                Current Risk Level: {summaryData.latestTriage.riskLevel}
              </div>
            </details>
          )}

          <details className="group border-2 border-carbon-black rounded-lg bg-white overflow-hidden" open>
            <summary className="font-bold text-sm uppercase text-carbon-black p-3 bg-fog cursor-pointer select-none border-b-2 border-transparent group-open:border-carbon-black">
              Medical History
            </summary>
            <div className="p-4 flex flex-wrap gap-2">
              {summaryData.medicalHistory?.conditions?.map((c, i) => (
                <span key={i} className="px-3 py-1 bg-white border-2 border-carbon-black rounded-full text-xs font-bold">{c}</span>
              ))}
              {!summaryData.medicalHistory?.conditions?.length && <span className="text-sm text-steel">None reported</span>}
            </div>
          </details>

          <button 
            type="button"
            onClick={handleExportPdf}
            className="w-full mt-2 bg-white hover:bg-fog text-carbon-black border-2 border-carbon-black px-4 py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all shadow-brutal-sm active:translate-y-0.5 active:shadow-none"
          >
            Export to PDF
          </button>
        </div>
      </div>
    );
  };

  const renderQR = (qrData) => {
    if (!qrData || !qrData.blood_type) return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No Medical QR data available.</div>;
    return (
      <div className="mt-4 bg-cyan-50 border-2 border-carbon-black rounded-xl shadow-brutal p-5 text-center">
        <h4 className="font-black text-lg mb-4 text-carbon-black">Medical Identity Card</h4>
        <div className="bg-white p-4 rounded-lg border-2 border-carbon-black mb-4 mx-auto w-32 h-32 flex items-center justify-center">
          <span className="text-4xl">🪪</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left mb-4">
          <div className="border border-carbon-black/20 bg-white p-2 rounded">
            <p className="text-xs text-steel font-bold uppercase">Blood Group</p>
            <p className="font-black text-carbon-black">{qrData.blood_type || 'N/A'}</p>
          </div>
          <div className="border border-carbon-black/20 bg-white p-2 rounded">
            <p className="text-xs text-steel font-bold uppercase">Age</p>
            <p className="font-black text-carbon-black">{qrData.age || 'N/A'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 bg-white hover:bg-fog text-carbon-black border-2 border-carbon-black px-3 py-2 rounded font-bold text-xs shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all">View QR</button>
          <button className="flex-1 bg-carbon-black text-white px-3 py-2 rounded font-bold text-xs shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all">Download</button>
        </div>
      </div>
    );
  };

  const renderInsights = (insightsData) => {
    if (!insightsData || !insightsData.analysis) {
      return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No meaningful trends detected yet.</div>;
    }

    const cards = [];

    // Progression Status Card
    if (insightsData.analysis.progressionStatus) {
      const isWorsening = insightsData.analysis.progressionStatus === 'worsening';
      const isStable = insightsData.analysis.progressionStatus === 'stable';
      cards.push({
        icon: isWorsening ? '🔴' : isStable ? '🟢' : '🟡',
        title: "Symptom Progression",
        message: insightsData.analysis.recommendation || `Symptoms are ${insightsData.analysis.progressionStatus}.`,
        bgClass: isWorsening ? 'bg-red-100' : isStable ? 'bg-[#f4fae6]' : 'bg-yellow-100'
      });
    }

    // Top Symptoms Card
    if (insightsData.topSymptoms && insightsData.topSymptoms.length > 0) {
      cards.push({
        icon: '🟡',
        title: "Frequent Symptoms",
        message: `Your most frequent symptom is ${insightsData.topSymptoms[0].symptom}, occurring ${insightsData.topSymptoms[0].occurrences} times.`,
        bgClass: 'bg-yellow-100'
      });
    }

    if (cards.length === 0) {
      return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No meaningful trends detected yet.</div>;
    }

    return (
      <div className="mt-4 space-y-4 p-5 rounded-xl border-2 border-carbon-black bg-blue-50 shadow-brutal text-carbon-black">
        <h4 className="font-bold text-sm mb-2 uppercase tracking-wider">📈 Health Insights</h4>
        {cards.map((card, idx) => (
          <div key={idx} className={`p-4 rounded-xl border-2 border-carbon-black ${card.bgClass} shadow-brutal-sm`}>
            <div className="font-black text-sm mb-1 flex items-center gap-2">
              <span>{card.icon}</span> {card.title}
            </div>
            <div className="text-sm font-medium text-carbon-black">{card.message}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderReports = (reportsData) => {
    if (!reportsData || !reportsData.length) return <div className="mt-4 p-4 border-2 border-carbon-black rounded-xl bg-white text-carbon-black text-sm font-bold shadow-brutal-sm">No medical reports available.</div>;
    return (
      <div className="mt-4 space-y-3 p-5 border-2 border-carbon-black rounded-xl bg-white shadow-brutal">
        <h4 className="font-bold text-carbon-black text-sm mb-3">📋 Medical Reports</h4>
        {reportsData.map((report, idx) => (
          <div key={idx} className="bg-fog border-2 border-carbon-black p-4 rounded-xl shadow-brutal-sm">
            <p className="text-xs font-bold text-steel mb-1">{report.date}</p>
            <h5 className="font-black text-sm mb-2 text-carbon-black">{report.title}</h5>
            <p className="text-xs text-carbon-black font-medium mb-3">{report.summary}</p>
            <button className="text-xs font-bold underline text-carbon-black">View Report</button>
          </div>
        ))}
      </div>
    );
  };

  const handleEmergencyClick = (name, callback) => {
    const confirmed = window.confirm(`🚨 Are you sure you want to proceed with: ${name}?`);
    if (confirmed) {
      setIsEmergencyModalOpen(false);
      callback();
    }
  };

  const handleEmergencyTrigger = async (type = 'general') => {
    if (isEmergencyLoading) return;

    const confirmed = window.confirm('🚨 Are you sure you want to send an EMERGENCY ALERT to all your family members?');
    if (!confirmed) return;

    setIsEmergencyLoading(true);
    setEmergencyResult(null);

    try {
      let latitude = null;
      let longitude = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (locErr) {
        console.warn('Location not available:', locErr.message);
      }

      const response = await api.post('/api/emergency', {
        emergencyType: type,
        latitude,
        longitude
      });

      if (response.success) {
        setEmergencyResult({
          success: true,
          message: `Alert sent to ${response.data.sent} contacts!`
        });
        setTriageResult({
          ...triageResult,
          emergency: true,
          telegram_sent: true
        });
      }
    } catch (error) {
      setEmergencyResult({
        success: false,
        message: error.message || 'Failed to send alerts'
      });
      setTriageResult({
        ...triageResult,
        emergency: true,
        telegram_sent: false,
        telegram_error: error.message || 'Failed to send alert'
      });
    } finally {
      setIsEmergencyLoading(false);
      setTimeout(() => setEmergencyResult(null), 5000);
    }
  };

  // 2. Perform conditional early exit checks at the bottom, after all hooks are evaluated
  const isPublicPage = ['/', '/login', '/signup'].includes(location.pathname);
  if (!isLoggedIn && !location.pathname.startsWith('/medical-card')) return null;
  if (isPublicPage) return null;

  return (
    <>
      {/* Floating Action Buttons Stack */}
      {!isOpen && (
        <div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 z-[10005] flex flex-col gap-4 md:gap-[22px] pointer-events-none">
          {/* Emergency SOS Button */}
          <div className="group relative flex items-center justify-end pointer-events-auto">
            <div className="absolute right-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 translate-x-2 scale-95 transition-all duration-200 ease-out bg-white border-2 border-carbon-black text-carbon-black font-black text-xs uppercase tracking-wide py-2 px-3.5 rounded-xl whitespace-nowrap shadow-brutal-sm">
              Emergency SOS
            </div>
            <motion.button
              onClick={() => setIsEmergencyModalOpen(true)}
              className="relative w-16 h-16 rounded-full border-2 border-carbon-black bg-red-600 flex items-center justify-center cursor-pointer text-white focus:outline-none shadow-[3px_3px_0px_#000000]"
              whileHover={{
                scale: 1.08,
                boxShadow: "5px 5px 0px #000000, 0 0 20px rgba(220,38,38,0.7)"
              }}
              whileTap={{
                scale: 0.95,
                boxShadow: "1px 1px 0px #000000"
              }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {/* Background SOS sonar pulse */}
              <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping pointer-events-none z-[-1] [animation-duration:3s]" />
              <Siren size={30} className="stroke-[2.25]" />
            </motion.button>
          </div>

          {/* AI Health Copilot Button */}
          <div className="group relative flex items-center justify-end pointer-events-auto">
            <div className="absolute right-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 translate-x-2 scale-95 transition-all duration-200 ease-out bg-white border-2 border-carbon-black text-carbon-black font-black text-xs uppercase tracking-wide py-2 px-3.5 rounded-xl whitespace-nowrap shadow-brutal-sm">
              AI Health Copilot
            </div>
            <motion.button
              onClick={() => setIsOpen(true)}
              className="relative w-16 h-16 rounded-full border-2 border-carbon-black bg-lime-pulse flex items-center justify-center cursor-pointer text-carbon-black focus:outline-none shadow-[3px_3px_0px_#000000]"
              whileHover={{
                scale: 1.08,
                boxShadow: "5px 5px 0px #000000, 0 0 20px rgba(163,230,53,0.7)"
              }}
              whileTap={{
                scale: 0.95,
                boxShadow: "1px 1px 0px #000000"
              }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {/* Background AI ping pulse */}
              <div className="absolute inset-0 rounded-full bg-lime-pulse/45 animate-ping pointer-events-none z-[-1] [animation-duration:4s]" />
              <Bot size={30} className="stroke-[2.25]" />
            </motion.button>
          </div>
        </div>
      )}

      {/* Slide-in Drawer / Modal panel */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[10001] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001]"
            />

            {/* Content Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="relative w-full md:w-[460px] bg-white border-l-2 border-carbon-black h-full flex flex-col shadow-brutal-dark z-[10002] text-carbon-black"
            >
              {/* Header */}
              <div className="p-6 border-b border-carbon-black/10 flex justify-between items-center bg-sky-wash">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2 text-carbon-black">
                    <Bot className="text-blue-600" size={28} /> AI Health Copilot
                  </h3>
                  <p className="text-[10px] font-black text-steel uppercase tracking-widest mt-1">
                    Your personal healthcare assistant
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetCopilot}
                    className="p-2 border border-carbon-black rounded-lg shadow-brutal-sm hover:bg-fog active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    title="Reset Copilot Session"
                  >
                    <RefreshCw size={14} className={!contextLoaded ? "animate-spin" : ""} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 border border-carbon-black rounded-lg shadow-brutal-sm hover:bg-fog active:translate-y-0.5 active:shadow-none transition-all cursor-pointer bg-white"
                    title="Close Copilot"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-fog/20 custom-scrollbar">
                {messages.length === 1 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-white border border-carbon-black/10 rounded-2xl p-6 shadow-sm mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-sky-wash border border-carbon-black flex items-center justify-center shadow-brutal-sm">
                      <Bot size={36} className="text-blue-600 animate-bounce" />
                    </div>
                    <h4 className="text-lg font-bold uppercase tracking-tight text-carbon-black">AI Health Copilot</h4>
                    <p className="text-xs font-semibold text-steel max-w-[280px] leading-relaxed">
                      Ask questions about your symptom history, reports, hospitals, or health timeline.
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl border text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-lime-pulse text-carbon-black border-carbon-black shadow-brutal-sm'
                          : 'bg-white text-carbon-black border-carbon-black/15 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[9px] font-bold uppercase tracking-wider text-steel">
                        {m.role === 'user' ? '👤 Patient Query' : '🤖 Copilot Clinical Reasoner'}
                      </div>
                      <p className="whitespace-pre-line font-semibold">{renderMarkdownBold(m.content)}</p>
                      
                      {m.type === 'pdf_ready' && m.downloadUrl && (
                        <div className="mt-4 border-2 border-carbon-black p-5 rounded-xl bg-white shadow-brutal text-center">
                          <div className="bg-lime-pulse mx-auto w-16 h-16 rounded-full border-2 border-carbon-black flex items-center justify-center mb-3">
                            <span className="text-2xl">📄</span>
                          </div>
                          <h5 className="font-black text-lg mb-2">Medical Report Ready</h5>
                          <div className="text-xs text-carbon-black font-medium space-y-1 mb-4">
                            <p>✅ Timeline Included</p>
                            <p>✅ Reports Included</p>
                            <p>✅ Summary Included</p>
                          </div>
                          <button 
                            onClick={() => downloadFile(m.downloadUrl)}
                            className="bg-carbon-black hover:bg-carbon-black/90 text-white px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wider w-full shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                          >
                            Download PDF
                          </button>
                        </div>
                      )}

                      {m.type === 'hospital_cards' && m.hospitals && renderHospitalCards(m.hospitals)}
                      
                      {m.type === 'timeline' && renderTimeline(m.timelineData)}
                      {m.type === 'health_summary' && renderHealthSummary(m.triageData)}
                      {m.type === 'doctor_summary' && renderDoctorSummary(m.summaryData)}
                      {m.type === 'qr' && renderQR(m.qrData)}
                      {m.type === 'insights' && renderInsights(m.insightsData)}
                      {m.type === 'reports' && renderReports(m.reportsData)}

                      {m.type === 'emergency_panel' && m.emergencyData && (
                        <div className="mt-4 border-2 border-carbon-black p-5 rounded-xl bg-red-50 shadow-brutal">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="bg-red-600 text-white p-2 rounded-lg border-2 border-carbon-black font-black">SOS</div>
                            <h5 className="font-black text-red-600 text-lg tracking-tight">Emergency Action Panel</h5>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => handleEmergencyTrigger('general')}
                              className="col-span-2 bg-red-600 text-white hover:bg-red-700 p-4 rounded-xl border-2 border-carbon-black font-black text-sm uppercase tracking-wider shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                              🚨 Telegram SOS
                            </button>

                            {m.emergencyData.primaryContact && (
                              <button
                                onClick={() => window.location.href = `tel:${m.emergencyData.primaryContact.phone}`}
                                className="bg-white hover:bg-fog text-carbon-black p-3 rounded-lg border-2 border-carbon-black font-bold text-xs flex flex-col items-center justify-center text-center gap-1 shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all"
                              >
                                <span className="text-xl">📞</span>
                                <span>Call Emergency Contact</span>
                              </button>
                            )}

                            {m.emergencyData.emergencyServices?.[0] && (
                              <button
                                onClick={() => window.location.href = `tel:${m.emergencyData.emergencyServices[0].phone}`}
                                className="bg-white hover:bg-fog text-carbon-black p-3 rounded-lg border-2 border-carbon-black font-bold text-xs flex flex-col items-center justify-center text-center gap-1 shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all"
                              >
                                <span className="text-xl">🏥</span>
                                <span>Nearest Emergency Hospital</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleEmergencyTrigger('general')}
                              className="col-span-2 mt-2 bg-yellow-400 hover:bg-yellow-500 text-carbon-black p-3 rounded-lg border-2 border-carbon-black font-black text-xs uppercase shadow-brutal-sm active:translate-y-0.5 active:shadow-none transition-all flex justify-center gap-2"
                            >
                              📍 Share Location
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-carbon-black/20 p-4 rounded-2xl flex items-center gap-3 shadow-sm text-xs font-bold text-steel">
                      <Loader2 className="animate-spin text-lime-500" size={14} />
                      Reasoning over medical context...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions Chips */}
              <div className="px-6 py-3 border-t border-carbon-black/5 bg-white shrink-0 select-none">
                <div className="text-[10px] font-bold text-steel uppercase tracking-widest mb-2">Suggested Actions</div>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar-horizontal">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleSendMessage(s.query)}
                      className="shrink-0 px-3 py-2 bg-fog hover:bg-lime-pulse border border-carbon-black rounded-xl text-[10px] font-bold text-carbon-black transition-all shadow-brutal-sm hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-6 border-t border-carbon-black/10 bg-white shrink-0 flex gap-2.5"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about symptoms, timeline, QR, etc..."
                  disabled={isProcessing}
                  className="flex-1 bg-white border border-carbon-black rounded-xl px-4 py-3 text-xs font-semibold text-carbon-black focus:outline-none focus:ring-2 focus:ring-lime-pulse disabled:opacity-75"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !inputMessage.trim()}
                  className="px-5 bg-lime-pulse text-carbon-black border border-carbon-black rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-brutal hover:bg-[#97d82f] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={12} /> Send
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Emergency Modal */}
      <AnimatePresence>
        {isEmergencyModalOpen && (
          <div className="fixed inset-0 z-[10006] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmergencyModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white border-2 border-carbon-black rounded-[20px] overflow-hidden shadow-brutal-dark p-8 text-carbon-black z-[10007]"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border bg-red-50 text-red-600 border-red-200">
                  SOS ACTIVE
                </span>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight mb-2 leading-none text-red-600">
                EMERGENCY PORTAL
              </h2>
              <p className="text-steel font-bold text-sm mb-6">
                Select an emergency service. You will be prompted to confirm before dialing or sending alerts.
              </p>

              <div className="space-y-4">
                {[
                  { label: '📞 Call Ambulance (108)', action: () => handleEmergencyClick('Ambulance (108)', () => window.open('tel:108')) },
                  { label: '📞 Call National Helpline (102)', action: () => handleEmergencyClick('National Helpline (102)', () => window.open('tel:102')) },
                  { label: '🏥 Nearest Hospital', action: () => handleEmergencyClick('Find Nearest Hospital', () => navigate('/hospitals')) },
                  { label: '🚨 Alert Family Contacts', action: () => handleEmergencyClick('Alert Family Contacts', () => handleEmergencyTrigger('general')) }
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={opt.action}
                    className="w-full text-left p-4 bg-fog hover:bg-red-50 hover:text-red-600 border border-carbon-black rounded-xl font-bold uppercase text-xs tracking-wider transition-colors shadow-brutal-sm hover:shadow-brutal cursor-pointer flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    <span className="text-lg">➔</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="mt-6 w-full py-4 bg-white hover:bg-fog border border-carbon-black font-bold uppercase tracking-widest rounded-xl text-xs transition-colors shadow-brutal-sm cursor-pointer"
              >
                Cancel / Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalCopilot;
