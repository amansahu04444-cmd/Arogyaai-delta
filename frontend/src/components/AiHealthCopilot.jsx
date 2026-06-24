import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useHealth } from '../store/HealthContext';
import { useHospitalRecommendation } from '../hooks/useHospitalRecommendation';
import api, { getUserProfile, queryCopilot, downloadTimelinePdf } from '../services/api';

const AiHealthCopilot = () => {
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
  const { timelineEntries, triageResult, fetchTimeline } = useHealth();
  const { recommendedHospitals } = useHospitalRecommendation();

  // Component states
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your **AI Health Copilot**. I can analyze your clinical history, summarize your symptom progression, evaluate chronic conditions, or find nearby medical facilities. What would you like me to inspect?'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [careCircleContacts, setCareCircleContacts] = useState([]);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Load backend context on mount - fetch FRESH timeline data from Supabase
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
      setContextLoaded(true); // Proceed anyway with available local data
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const handleResetCopilot = async () => {
    try {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I am your **AI Health Copilot**. I can analyze your clinical history, summarize your symptom progression, evaluate chronic conditions, or find nearby medical facilities. What would you like me to inspect?'
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

  const handleEmergencyTrigger = async (type = 'general') => {
    if (isEmergencyLoading) return;

    const confirmed = window.confirm('🚨 Are you sure you want to send an EMERGENCY ALERT to all your family members?');
    if (!confirmed) return;

    setIsEmergencyLoading(true);

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
        alert(`Alert sent to ${response.data.sent} contacts!`);
      } else {
        alert(response.message || 'Failed to send alert.');
      }
    } catch (error) {
      console.error('Emergency trigger failed:', error);
      alert('Failed to send emergency alert.');
    } finally {
      setIsEmergencyLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    // Clear input if submitted from input box
    if (!textToSend) {
      setInputMessage('');
    }

    // Append user message
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
        let sourceLabel = '';
        if (res.source === 'fallback') {
          sourceLabel = '\n\n⚠️ _Using offline mode_';
        }

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
          reportsData: res.reportsData || null
        };
        
        console.log("Adding Message", { type: res.type, hospitals: res.hospitals, answer: res.answer });
        
        setMessages(prev => [...prev, msgPayload]);
      } else {
        throw new Error(res?.message || 'Failed to get answer from copilot.');
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `⚠️ **Error**: Failed to consult AI Health Copilot. ${err.message}`
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
    // Format bold markdown (**text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const suggestions = [
    { label: '🔍 Analyze my health history', query: 'Analyze my health history and summarize my chronic conditions/medications.' },
    { label: '📋 Summarize symptoms', query: 'Summarize my symptom timeline logs.' },
    { label: '🏥 Find nearby hospitals', query: 'Find nearby recommended hospitals.' },
    { label: '🚨 Show emergency info', query: 'Show emergency information, emergency contact, and care circle.' },
    { label: '🩺 Doctor summary', query: 'Generate doctor summary based on my active reports and timeline.' },
    { label: '📈 Check risk progression', query: 'Check risk progression and symptom trends over my timeline.' }
  ];

  const renderHospitalCards = (hospitals) => {
    return (
      <div className="mt-4 space-y-4">
        <h4 className="font-bold text-slate-900 text-sm mb-3">🏥 Nearby Hospitals</h4>
        {hospitals.map((hospital, idx) => (
          <div key={idx} className="border border-slate-200 p-5 rounded-xl bg-white shadow-md hover:shadow-none hover:translate-y-1 transition-all">
            <h5 className="font-black text-lg text-slate-900 mb-3">{hospital.name}</h5>
            {hospital.rating && <p className="text-sm text-slate-900 font-bold mb-3 flex items-center gap-2">⭐ {hospital.rating}</p>}
            <p className="text-sm text-slate-900 font-medium mb-4 flex items-start gap-2">
              <span>📍</span> 
              <span>{hospital.address || 'Address not available'}</span>
            </p>
            {hospital.distance && <p className="text-sm text-slate-900 font-medium mb-4 flex items-center gap-2">📏 {hospital.distance.toFixed(1)} km</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + " " + hospital.address)}`, '_blank')}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-4 py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:translate-y-0.5 active:shadow-none"
              >
                Directions
              </button>
              {hospital.phone && (
                <button
                  onClick={() => window.location.href = `tel:${hospital.phone}`}
                  className="flex-1 bg-slate-800 hover:bg-slate-800/90 text-white border border-slate-200 px-4 py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:translate-y-0.5 active:shadow-none"
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
    if (!triageData || !triageData.score) return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No health summary data available.</div>;
    return (
      <div className="mt-4 border border-slate-200 p-5 rounded-xl bg-[#f4fae6] shadow-md text-slate-900">
        <h4 className="font-bold text-sm mb-4 uppercase tracking-wider border-b-2 border-slate-100 pb-2">Health Summary</h4>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-lg">
            <span className="font-bold text-sm">Risk Score</span>
            <span className="font-black text-xl">{triageData.score || 'N/A'}/10</span>
          </div>
          <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-lg">
            <span className="font-bold text-sm">Risk Level</span>
            <span className="font-black text-xl">{triageData.category || 'UNKNOWN'}</span>
          </div>
          <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-lg">
            <span className="font-bold text-sm">Symptoms</span>
            <span className="font-bold">{triageData.symptoms?.length || 0} Active</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = (timelineData) => {
    if (!timelineData?.entries || timelineData.entries.length === 0) return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No timeline entries available.</div>;
    return (
      <div className="mt-4 space-y-4 p-5 border border-slate-200 rounded-xl bg-slate-50 shadow-md">
        <h4 className="font-bold text-slate-900 text-sm mb-3">📋 Symptom Timeline</h4>
        <div className="pl-4 border-l-4 border-slate-200 space-y-6">
          {timelineData.entries.slice(-5).map((entry, idx) => (
            <div key={idx} className="relative">
              <div className="absolute -left-[26px] top-0 w-4 h-4 rounded-full border border-slate-200 bg-white" />
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <p className="text-xs font-bold text-slate-500 mb-2">{entry.date}</p>
                <p className="font-black text-sm mb-2">{entry.symptoms}</p>
                <span className={`inline-block px-3 py-1 text-xs font-bold rounded-md border border-slate-200 ${entry.risk_level === 'High' ? 'bg-red-400 text-white' : entry.risk_level === 'Medium' ? 'bg-yellow-400' : 'bg-blue-600'}`}>
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
    if (!summaryData || !summaryData.patientInfo) return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No doctor summary available.</div>;
    return (
      <div className="mt-4 bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
        <div className="bg-white border-b-2 border-slate-200 p-4">
          <h4 className="font-black text-lg text-slate-900">Doctor Consultation Card</h4>
          <p className="text-xs font-bold text-slate-500 mt-1">Patient: {summaryData.patientInfo?.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <details className="group border border-slate-200 rounded-lg bg-white overflow-hidden" open>
            <summary className="font-bold text-sm uppercase text-slate-900 p-3 bg-slate-50 cursor-pointer select-none border-b-2 border-transparent group-open:border-slate-200">
              Timeline Summary
            </summary>
            <div className="p-4 text-sm font-medium">
              {summaryData.statistics?.totalEntries} entries recorded.
            </div>
          </details>

          {summaryData.latestTriage && (
            <details className="group border border-slate-200 rounded-lg bg-white overflow-hidden" open>
              <summary className="font-bold text-sm uppercase text-slate-900 p-3 bg-red-50 cursor-pointer select-none border-b-2 border-transparent group-open:border-slate-200">
                Risk Assessment
              </summary>
              <div className="p-4 font-bold text-sm text-red-700">
                Current Risk Level: {summaryData.latestTriage.riskLevel}
              </div>
            </details>
          )}

          <details className="group border border-slate-200 rounded-lg bg-white overflow-hidden" open>
            <summary className="font-bold text-sm uppercase text-slate-900 p-3 bg-slate-50 cursor-pointer select-none border-b-2 border-transparent group-open:border-slate-200">
              Medical History
            </summary>
            <div className="p-4 flex flex-wrap gap-2">
              {summaryData.medicalHistory?.conditions?.map((c, i) => (
                <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold">{c}</span>
              ))}
              {!summaryData.medicalHistory?.conditions?.length && <span className="text-sm text-slate-500">None reported</span>}
            </div>
          </details>

          <button 
            type="button"
            onClick={handleExportPdf}
            className="w-full mt-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-4 py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:translate-y-0.5 active:shadow-none"
          >
            Export to PDF
          </button>
        </div>
      </div>
    );
  };

  const renderQR = (qrData) => {
    if (!qrData || !qrData.blood_type) return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No Medical QR data available.</div>;
    return (
      <div className="mt-4 bg-cyan-50 border border-slate-200 rounded-xl shadow-md p-5 text-center">
        <h4 className="font-black text-lg mb-4 text-slate-900">Medical Identity Card</h4>
        <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4 mx-auto w-32 h-32 flex items-center justify-center">
          <span className="text-4xl">🪪</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left mb-4">
          <div className="border border-slate-200 bg-white p-2 rounded">
            <p className="text-xs text-slate-500 font-bold uppercase">Blood Group</p>
            <p className="font-black text-slate-900">{qrData.blood_type || 'N/A'}</p>
          </div>
          <div className="border border-slate-200 bg-white p-2 rounded">
            <p className="text-xs text-slate-500 font-bold uppercase">Age</p>
            <p className="font-black text-slate-900">{qrData.age || 'N/A'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-3 py-2 rounded font-bold text-xs shadow-sm active:translate-y-0.5 active:shadow-none transition-all">View QR</button>
          <button className="flex-1 bg-slate-800 text-white px-3 py-2 rounded font-bold text-xs shadow-sm active:translate-y-0.5 active:shadow-none transition-all">Download</button>
        </div>
      </div>
    );
  };

  const renderInsights = (insightsData) => {
    if (!insightsData || !insightsData.analysis) {
      return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No meaningful trends detected yet.</div>;
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
      return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No meaningful trends detected yet.</div>;
    }

    return (
      <div className="mt-4 space-y-4 p-5 rounded-xl border border-slate-200 bg-blue-50 shadow-md text-slate-900">
        <h4 className="font-bold text-sm mb-2 uppercase tracking-wider">📈 Health Insights</h4>
        {cards.map((card, idx) => (
          <div key={idx} className={`p-4 rounded-xl border border-slate-200 ${card.bgClass} shadow-sm`}>
            <div className="font-black text-sm mb-1 flex items-center gap-2">
              <span>{card.icon}</span> {card.title}
            </div>
            <div className="text-sm font-medium text-slate-900">{card.message}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderReports = (reportsData) => {
    if (!reportsData || !reportsData.length) return <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-sm">No medical reports available.</div>;
    return (
      <div className="mt-4 space-y-3 p-5 border border-slate-200 rounded-xl bg-white shadow-md">
        <h4 className="font-bold text-slate-900 text-sm mb-3">📋 Medical Reports</h4>
        {reportsData.map((report, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-slate-500 mb-1">{report.date}</p>
            <h5 className="font-black text-sm mb-2 text-slate-900">{report.title}</h5>
            <p className="text-xs text-slate-900 font-medium mb-3">{report.summary}</p>
            <button className="text-xs font-bold underline text-slate-900">View Report</button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-2xl p-8 md:p-10 border border-slate-200 bg-white text-slate-900 shadow-md flex flex-col h-[70vh] min-h-[500px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-2xl font-bold uppercase tracking-tight flex items-center gap-2 text-slate-900">
            <Bot className="text-blue-600 animate-bounce" size={24} /> AI Health Copilot
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Reasoning Engine Over Dashboard Context
          </p>
        </div>
        <button
          onClick={handleResetCopilot}
          className="p-2 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          title="Reset Copilot Session"
        >
          <RefreshCw size={14} className={!contextLoaded ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto mb-6 p-4 border border-slate-100 bg-slate-50/20 rounded-xl space-y-4 custom-scrollbar">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl border text-sm leading-relaxed break-words whitespace-normal ${
                m.role === 'user'
                  ? 'bg-blue-600 text-slate-900 border-slate-200 shadow-sm'
                  : 'bg-white text-slate-900 border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {m.role === 'user' ? '👤 Patient Query' : '🤖 Copilot Clinical Reasoning'}
              </div>
              <p className="whitespace-pre-line font-medium break-words">{renderMarkdownBold(m.content)}</p>
              
              {m.type === 'pdf_ready' && m.downloadUrl && (
                <div className="mt-4 border border-slate-200 p-5 rounded-xl bg-white shadow-md text-center">
                  <div className="bg-blue-600 mx-auto w-16 h-16 rounded-full border border-slate-200 flex items-center justify-center mb-3">
                    <span className="text-2xl">📄</span>
                  </div>
                  <h5 className="font-black text-lg mb-2">Medical Report Ready</h5>
                  <div className="text-xs text-slate-900 font-medium space-y-1 mb-4">
                    <p>✅ Timeline Included</p>
                    <p>✅ Reports Included</p>
                    <p>✅ Summary Included</p>
                  </div>
                  <button 
                    onClick={() => downloadFile(m.downloadUrl)}
                    className="bg-slate-800 hover:bg-slate-800/90 text-white px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wider w-full shadow-sm active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
                <div className="mt-4 border border-slate-200 p-5 rounded-xl bg-red-50 shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-600 text-white p-2 rounded-lg border border-slate-200 font-black">SOS</div>
                    <h5 className="font-black text-red-600 text-lg tracking-tight">Emergency Action Panel</h5>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleEmergencyTrigger('general')}
                      className="col-span-2 bg-red-600 text-white hover:bg-red-700 p-4 rounded-xl border border-slate-200 font-black text-sm uppercase tracking-wider shadow-sm active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      🚨 Telegram SOS
                    </button>

                    {m.emergencyData.primaryContact && (
                      <button
                        onClick={() => window.location.href = `tel:${m.emergencyData.primaryContact.phone}`}
                        className="bg-white hover:bg-slate-50 text-slate-900 p-3 rounded-lg border border-slate-200 font-bold text-xs flex flex-col items-center justify-center text-center gap-1 shadow-sm active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        <span className="text-xl">📞</span>
                        <span>Call Emergency Contact</span>
                      </button>
                    )}

                    {m.emergencyData.emergencyServices?.[0] && (
                      <button
                        onClick={() => window.location.href = `tel:${m.emergencyData.emergencyServices[0].phone}`}
                        className="bg-white hover:bg-slate-50 text-slate-900 p-3 rounded-lg border border-slate-200 font-bold text-xs flex flex-col items-center justify-center text-center gap-1 shadow-sm active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        <span className="text-xl">🏥</span>
                        <span>Nearest Emergency Hospital</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleEmergencyTrigger('general')}
                      className="col-span-2 mt-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 p-3 rounded-lg border border-slate-200 font-black text-xs uppercase shadow-sm active:translate-y-0.5 active:shadow-none transition-all flex justify-center gap-2"
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
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm text-sm font-bold text-slate-500">
              <Loader2 className="animate-spin text-blue-600" size={16} />
              Reasoning over medical context...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions Chips */}
      <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar-horizontal shrink-0 select-none">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isProcessing}
            onClick={() => handleSendMessage(s.query)}
            className="shrink-0 px-3.5 py-2 bg-slate-50 hover:bg-blue-600 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 transition-all shadow-sm hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-3 mt-auto shrink-0"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask copilot to inspect reports, timeline, circle, etc..."
          disabled={isProcessing}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:opacity-75"
        />
        <button
          type="submit"
          disabled={isProcessing || !inputMessage.trim()}
          className="px-6 bg-blue-600 text-white border border-transparent rounded-xl font-bold uppercase tracking-widest text-xs shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
};

export default AiHealthCopilot;
