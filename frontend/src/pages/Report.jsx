import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Share2,
  Calendar,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle,
  Plus,
  Loader2,
  Thermometer,
  Flame,
  FileSpreadsheet
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useHealth } from '../store/HealthContext';
import {
  addTimelineEntry,
  getTimelineEntries,
  analyzeTimeline,
  downloadTimelinePdf,
  updateTimelineEntry,
  deleteTimelineEntry
} from '../services/api';

const parseAiSummary = (summaryText, entries = []) => {
  let chiefComplaint = 'N/A';
  let timelineOverview = 'No timeline entries';
  let progression = summaryText || 'No progression data available';
  let riskAssessment = 'Mild';
  let recommendations = 'No recommendation details available';
  let duration = '';

  if (entries.length > 0) {
    const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    chiefComplaint = sorted[0]?.symptoms || 'N/A';

    const startDate = sorted[0]?.date;
    const endDate = sorted[sorted.length - 1]?.date;
    const formatDate = (dStr) => {
      try {
        return new Date(dStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return dStr;
      }
    };

    if (startDate && endDate) {
      if (startDate === endDate) {
        timelineOverview = `Single log on ${formatDate(startDate)}`;
      } else {
        timelineOverview = `${sorted.length} entries recorded between\n${formatDate(startDate)} – ${formatDate(endDate)}`;
      }
    }

    const severities = entries.map(e => e.severity || 'MILD');
    if (severities.includes('SEVERE')) riskAssessment = '🚨 High Risk (Severe symptoms reported)';
    else if (severities.includes('MODERATE')) riskAssessment = '⚠️ Moderate Risk';
    else riskAssessment = '✅ Low Risk (Mild symptoms)';
  }

  if (summaryText) {
    // Basic formatting cleanups
    let cleaned = summaryText.replace(/====+/g, '').replace(/----+/g, '').trim();

    const aiSummaryIdx = cleaned.indexOf('AI CLINICAL SUMMARY');
    const docSummaryIdx = cleaned.indexOf('DOCTOR CONSULTATION SUMMARY');

    if (aiSummaryIdx !== -1 && docSummaryIdx !== -1) {
      progression = cleaned.substring(aiSummaryIdx + 'AI CLINICAL SUMMARY'.length, docSummaryIdx).trim();
      const doctorPart = cleaned.substring(docSummaryIdx + 'DOCTOR CONSULTATION SUMMARY'.length).trim();

      const lines = doctorPart.split('\n');
      let complaints = [];
      let inComplaints = false;

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('Chief Complaints:')) {
          inComplaints = true;
        } else if (trimmed.startsWith('Duration:')) {
          inComplaints = false;
          duration = trimmed.replace('Duration:', '').trim();
        } else if (trimmed.startsWith('Progression:')) {
          inComplaints = false;
        } else if (trimmed.startsWith('Risk Assessment:')) {
          inComplaints = false;
          riskAssessment = trimmed.replace('Risk Assessment:', '').trim();
        } else if (trimmed.startsWith('Recommended Action:')) {
          inComplaints = false;
          recommendations = trimmed.replace('Recommended Action:', '').trim();
        } else if (inComplaints && trimmed) {
          complaints.push(trimmed.replace(/^-\s*/, '').replace(/^•\s*/, ''));
        }
      });

      if (complaints.length > 0) {
        chiefComplaint = complaints.join(', ');
      }
    } else {
      const focusIndex = cleaned.toLowerCase().indexOf('suggested clinical focus:');
      if (focusIndex !== -1) {
        progression = cleaned.substring(0, focusIndex).trim();
        recommendations = cleaned.substring(focusIndex + 'suggested clinical focus:'.length).trim();
      }
      progression = progression.replace(/patient timeline summary/gi, '').trim();
    }
  }

  // Clean progression text from raw formatting markers
  progression = progression.replace(/\*\*/g, '').replace(/\*/g, '').trim();
  // Better clinical language replacements
  progression = progression.replace(/On Day \d+/gi, "Subsequent symptom progression revealed");

  return {
    chiefComplaint,
    timelineOverview,
    progression,
    riskAssessment,
    recommendations,
    duration,
    generatedOn: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };
};

const Report = () => {
  // Use global timeline state from HealthContext
  const { timelineEntries, isLoadingTimeline, fetchTimeline } = useHealth();

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' or 'reports'
  const [selectedReport, setSelectedReport] = useState(null);

  // Local UI States
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  // Form States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState('MILD');
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Edit/Delete State
  const [editingEntry, setEditingEntry] = useState(null);
  const [editSymptoms, setEditSymptoms] = useState('');
  const [editSeverity, setEditSeverity] = useState('');
  const [editTemperature, setEditTemperature] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const reports = [
    {
      id: 'r1',
      title: 'Complete Blood Count (CBC)',
      date: '2026-04-15',
      doctor: 'Dr. Priya Sharma',
      status: 'completed',
      type: 'Lab Report',
      summary: 'All blood parameters within normal range. Hemoglobin: 14.2 g/dL, WBC: 7,500/μL, Platelets: 250,000/μL',
      details: {
        'Hemoglobin': '14.2 g/dL',
        'WBC Count': '7,500/μL',
        'RBC Count': '5.2 million/μL',
        'Platelets': '250,000/μL',
        'Hematocrit': '42%',
        'MCV': '88 fL'
      }
    },
    {
      id: 'r2',
      title: 'Cardiac Risk Assessment',
      date: '2026-04-20',
      doctor: 'Dr. Rajesh Kumar',
      status: 'completed',
      type: 'Diagnostic Report',
      summary: 'Low cardiac risk. ECG normal. No abnormalities detected in stress test.',
      details: {
        'ECG': 'Normal',
        'Cholesterol': '185 mg/dL',
        'HDL': '55 mg/dL',
        'LDL': '110 mg/dL',
        'Triglycerides': '130 mg/dL',
        'Risk Level': 'LOW'
      }
    },
    {
      id: 'r3',
      title: 'Triage Assessment - Chest Pain',
      date: '2026-04-28',
      doctor: 'AI Analysis',
      status: 'completed',
      type: 'AI Triage',
      summary: 'Moderate risk. AI recommended cardiac evaluation. Symptoms: chest pain, shortness of breath.',
      details: {
        'Risk Level': 'MODERATE',
        'Triage Score': '45/100',
        'Symptoms': 'Chest Pain, Shortness of Breath',
        'Recommendation': 'Cardiac evaluation within 24 hours'
      }
    },
    {
      id: 'r4',
      title: 'Blood Pressure Monitoring',
      date: '2026-04-28',
      doctor: 'Self-Monitored',
      status: 'pending',
      type: 'Vital Signs',
      summary: 'BP readings over the past week. Average: 125/82 mmHg. Slightly elevated.',
      details: {
        'Morning (Avg)': '128/84 mmHg',
        'Evening (Avg)': '122/80 mmHg',
        'Heart Rate': '76 bpm',
        'Status': 'Slightly Elevated'
      }
    }
  ];

  // Fetch timeline on mount using global context
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Escape key listener for closing symptom modal
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsLogModalOpen(false);
        setEditingEntry(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Disable background scroll when modal is open
  useEffect(() => {
    if (isLogModalOpen || editingEntry) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLogModalOpen, editingEntry]);

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) {
      setFormError('Symptoms text is required');
      return;
    }

    setIsSavingEntry(true);
    setFormError(null);

    try {
      const entryData = {
        date,
        symptoms: symptoms.trim(),
        severity,
        temperature: temperature.trim(),
        notes: notes.trim()
      };

      const res = await addTimelineEntry(entryData);
      if (res.success) {
        // Refresh timeline list
        await fetchTimeline();
        // Clear fields
        setSymptoms('');
        setTemperature('');
        setNotes('');
        setSeverity('MILD');
        // Set date to today
        setDate(new Date().toISOString().split('T')[0]);
        // Close modal
        setIsLogModalOpen(false);
      } else {
        throw new Error(res.error || 'Failed to save entry.');
      }
    } catch (err) {
      console.error('Error saving entry:', err);
      setFormError(err.message || 'Failed to save symptom entry.');
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleUpdateEntry = async (e) => {
    e.preventDefault();
    if (!editSymptoms.trim()) return;

    setIsUpdating(true);
    try {
      const res = await updateTimelineEntry(editingEntry.id, {
        symptoms: editSymptoms.trim(),
        severity: editSeverity,
        temperature: editTemperature.trim(),
        notes: editNotes.trim(),
        userId: 'me'
      });
      if (res.success) {
        setEditingEntry(null);
        await fetchTimeline();
      } else {
        throw new Error(res.error || 'Failed to update entry');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update entry: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Delete this timeline entry?')) return;

    try {
      const res = await deleteTimelineEntry(id, 'me');
      if (res.success) {
        await fetchTimeline();
      } else {
        throw new Error(res.error || 'Failed to delete entry');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete entry: ' + err.message);
    }
  };

  const handleGenerateSummary = async () => {
    if (timelineEntries.length === 0) {
      alert('Your symptom timeline is empty. Please add at least one day log first.');
      return;
    }

    setIsAnalyzing(true);
    setGeneralError(null);

    try {
      const res = await analyzeTimeline('me');
      if (res.success) {
        setAiSummary(res.summary);
      } else {
        throw new Error(res.summary || 'Failed to generate analysis.');
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setGeneralError(err.message || 'Failed to generate AI progression summary.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (timelineEntries.length === 0) {
      alert('Symptom timeline is empty. Please add logs to download.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const response = await downloadTimelinePdf('me', aiSummary);

      const file = new Blob([response], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);

      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `arogyaai-medical-timeline-report.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PDF Download failed:', err);
      alert('Failed to compile and download PDF: ' + err.message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const filteredEntries = timelineEntries.filter(entry => {
    let match = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      match = entry.symptoms.toLowerCase().includes(query) ||
        (entry.notes && entry.notes.toLowerCase().includes(query)) ||
        (entry.ai_summary && entry.ai_summary.toLowerCase().includes(query));
    }
    if (match && dateFilter !== 'all') {
      const entryDate = new Date(entry.date);
      const today = new Date();
      const diffTime = Math.abs(today - entryDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (dateFilter === '7' && diffDays > 7) match = false;
      if (dateFilter === '30' && diffDays > 30) match = false;
    }
    return match;
  });

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
              <FileText size={16} /> Medical Records
            </div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-none mb-4 text-carbon-black">
              Health<br />Reports
            </h1>
            <p className="text-steel font-bold text-lg max-w-xl">
              View reports, track symptom timelines day-by-day, and generate doctor-ready AI summaries.
            </p>
          </div>

        </motion.div>

        {generalError && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center gap-4 shadow-brutal-sm">
            <AlertCircle className="text-red-600 shrink-0" size={24} />
            <p className="text-red-600 font-bold text-sm">{generalError}</p>
          </motion.div>
        )}

        {/* Top Section - Summary & Export Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-10">
          {/* Left Side: AI Progression Summary */}
          <div className="md:col-span-1 xl:col-span-6 space-y-10">
            {/* AI Analysis Panel */}
            <motion.div
              variants={itemVariants}
              className="rounded-[20px] p-8 bg-white border border-carbon-black shadow-brutal-dark"
            >
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-6 flex items-center gap-3 text-carbon-black border-b border-carbon-black/10 pb-4">
                <Activity size={24} className="text-lime-500" /> AI Progression Summary
              </h3>

              <p className="text-xs font-bold text-steel mb-6">
                Transform your daily symptom records into a structured doctor-ready medical report with progression analysis and risk assessment.
              </p>

              <button
                onClick={handleGenerateSummary}
                disabled={isAnalyzing || timelineEntries.length === 0}
                className="w-full py-4 bg-lime-pulse text-carbon-black border border-carbon-black rounded-xl font-bold uppercase tracking-widest text-sm shadow-brutal hover:shadow-brutal-dark transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-6"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Generating Summary...
                  </>
                ) : (
                  'Generate Doctor Summary'
                )}
              </button>

              {isAnalyzing ? (
                <div className="p-6 bg-white border-2 border-carbon-black rounded-[20px] shadow-brutal-sm space-y-6 animate-pulse">
                  {/* Report title placeholder */}
                  <div className="h-6 w-1/2 bg-steel/20 rounded"></div>
                  <div className="h-4 w-1/3 bg-steel/15 rounded"></div>

                  {/* Section placeholders */}
                  <div className="space-y-3 pt-4 border-t border-carbon-black/10">
                    <div className="h-4 w-1/4 bg-steel/20 rounded"></div>
                    <div className="h-3 w-5/6 bg-steel/10 rounded"></div>
                    <div className="h-3 w-4/5 bg-steel/10 rounded"></div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-carbon-black/10">
                    <div className="h-4 w-1/3 bg-steel/20 rounded"></div>
                    <div className="h-3 w-full bg-steel/10 rounded flex gap-1"></div>
                    <div className="h-3 w-2/3 bg-steel/10 rounded"></div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-carbon-black/10">
                    <div className="h-4 w-1/4 bg-steel/20 rounded"></div>
                    <div className="h-3 w-5/6 bg-steel/10 rounded"></div>
                  </div>
                </div>
              ) : aiSummary ? (
                (() => {
                  const reportData = parseAiSummary(aiSummary, timelineEntries);
                  const complaintsArray = reportData.chiefComplaint.split(',').map(s => s.trim()).filter(Boolean);

                  const getRiskBadgeDetails = (riskStr) => {
                    const cleanRisk = String(riskStr).toUpperCase();
                    if (cleanRisk.includes('EMERGENCY')) {
                      return { text: 'EMERGENCY', colorClass: 'bg-red-600 text-white border-red-700' };
                    } else if (cleanRisk.includes('HIGH')) {
                      return { text: 'HIGH RISK', colorClass: 'bg-red-50 text-red-600 border-red-200' };
                    } else if (cleanRisk.includes('MEDIUM') || cleanRisk.includes('MODERATE')) {
                      return { text: 'MEDIUM RISK', colorClass: 'bg-orange-50 text-orange-600 border-orange-200' };
                    } else {
                      return { text: 'LOW RISK', colorClass: 'bg-green-50 text-green-600 border-green-200' };
                    }
                  };

                  const riskDetails = getRiskBadgeDetails(reportData.riskAssessment);

                  return (
                    <div className="bg-white border-2 border-carbon-black rounded-[20px] shadow-brutal-sm overflow-hidden text-left font-sans">
                      <div className="bg-carbon-black text-white px-6 py-4 flex justify-between items-center">
                        <h4 className="text-[20px] font-black uppercase tracking-wider flex items-center gap-2">
                          📋 Doctor Summary
                        </h4>
                        <span className="px-2.5 py-0.5 bg-lime-pulse text-carbon-black border border-white text-[9px] font-black uppercase tracking-wider rounded">
                          Report
                        </span>
                      </div>

                      <div className="p-6 space-y-6 text-carbon-black">
                        {/* Chief Complaints */}
                        <div>
                          <h5 className="text-[18px] font-bold uppercase tracking-wider text-steel mb-2">
                            Chief Complaints
                          </h5>
                          <ul className="list-none space-y-1 pl-2">
                            {complaintsArray.map((complaint, i) => (
                              <li key={i} className="text-[14px] font-bold flex items-center gap-2">
                                <span className="text-lime-600 font-extrabold text-lg">•</span> {complaint}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <hr className="border-t border-carbon-black/10" />

                        {/* Duration */}
                        <div>
                          <h5 className="text-[18px] font-bold uppercase tracking-wider text-steel mb-1">
                            Duration
                          </h5>
                          <p className="text-[14px] font-bold pl-2 border-l-2 border-lime-pulse">
                            {reportData.duration || `${timelineEntries.length} Days`}
                          </p>
                        </div>

                        <hr className="border-t border-carbon-black/10" />

                        {/* Timeline Overview */}
                        <div>
                          <h5 className="text-[18px] font-bold uppercase tracking-wider text-steel mb-1">
                            Timeline Overview
                          </h5>
                          <p className="text-[14px] font-semibold pl-2 border-l-2 border-blue-500 whitespace-pre-line leading-relaxed">
                            {reportData.timelineOverview}
                          </p>
                        </div>

                        <hr className="border-t border-carbon-black/10" />

                        {/* Clinical Progression Analysis */}
                        <div>
                          <h5 className="text-[18px] font-bold uppercase tracking-wider text-steel mb-1">
                            Clinical Progression Analysis
                          </h5>
                          <div className="text-[14px] font-medium pl-2 border-l-2 border-amber-500 whitespace-pre-line leading-relaxed text-carbon-black">
                            {reportData.progression}
                          </div>
                        </div>

                        <hr className="border-t border-carbon-black/10" />

                        {/* Risk Assessment */}
                        <div>
                          <h5 className="text-[18px] font-bold uppercase tracking-wider text-steel mb-2">
                            Risk Assessment
                          </h5>
                          <div className="pl-2">
                            <span className={`inline-block px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm ${riskDetails.colorClass}`}>
                              {riskDetails.text}
                            </span>
                          </div>
                        </div>

                        <hr className="border-t border-carbon-black/10" />

                        {/* Recommended Action */}
                        <div>
                          <h5 className="text-[18px] font-bold uppercase tracking-wider text-steel mb-2">
                            Recommended Action
                          </h5>
                          <div className="bg-lime-50/50 border border-lime-200 rounded-xl p-4 shadow-brutal-sm">
                            <p className="text-[14px] font-bold text-lime-900 leading-relaxed">
                              {reportData.recommendations}
                            </p>
                          </div>
                        </div>

                        <hr className="border-t border-carbon-black/20 pt-4" />

                        {/* Generated On */}
                        <div className="flex flex-col gap-1 text-[10px] text-steel font-bold uppercase tracking-wider">
                          <div className="flex justify-between items-center">
                            <span>Generated On:</span>
                            <span>{reportData.generatedOn}</span>
                          </div>
                          <div className="text-center mt-2 text-steel/60 normal-case font-medium">
                            Generated by ArogyaAI Clinical Timeline Engine
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="p-8 border border-dashed border-carbon-black/20 rounded-[20px] text-center text-steel/60 font-bold text-sm bg-fog/20">
                  <Flame className="mx-auto text-steel/20 mb-3" size={32} />
                  No summary generated yet. Click the button above to analyze your timeline.
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Side: Export Medical Report */}
          <div className="md:col-span-1 xl:col-span-4 space-y-10">
            {/* PDF Actions Panel */}
            <motion.div
              variants={itemVariants}
              className="rounded-[20px] p-8 bg-mint-wash border border-carbon-black shadow-brutal-dark"
            >
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-6 flex items-center gap-3 text-carbon-black border-b border-carbon-black/10 pb-4">
                <FileSpreadsheet size={24} className="text-carbon-black" /> Export Medical Report
              </h3>

              <p className="text-xs font-bold text-steel mb-6">
                Compile a complete doctor-ready PDF report including patient information, chronological timeline history, and the AI progression summary.
              </p>

              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf || timelineEntries.length === 0}
                className="w-full py-4 bg-white text-carbon-black border border-carbon-black rounded-xl font-bold uppercase tracking-widest text-sm shadow-brutal hover:shadow-brutal-dark transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Compiling PDF...
                  </>
                ) : (
                  <>
                    <Download size={16} /> Download Medical Report PDF
                  </>
                )}
              </button>

              <div className="mt-8 border border-dashed border-carbon-black/35 rounded-xl p-4 bg-white/40 text-[10px] text-steel font-bold uppercase tracking-widest leading-normal">
                <p className="mb-2 text-carbon-black">PDF Report includes:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Patient Name & UID</li>
                  <li>Symptom Timeline (Day 1 - Day N)</li>
                  <li>AI Assessment Progression Summary</li>
                  <li>Clinical Focus Advice</li>
                  <li>Blank Doctor Notes & Sign Block</li>
                </ul>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Section - Full Width Timeline View */}
        <div className="w-full">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-carbon-black/10 pb-4">
              <h3 className="text-2xl font-bold uppercase tracking-tight text-carbon-black flex items-center gap-3">
                <Activity size={24} /> Chronological Timeline View
              </h3>

              {/* Timeline Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search symptoms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 border border-carbon-black rounded-full text-xs font-bold shadow-brutal-sm focus:outline-none"
                />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-4 py-2 border border-carbon-black rounded-full text-xs font-bold shadow-brutal-sm focus:outline-none bg-white"
                >
                  <option value="all">All Time</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                </select>
              </div>
            </div>

            {isLoadingTimeline ? (
              <div className="flex justify-center py-10">
                <Loader2 size={32} className="animate-spin text-steel" />
              </div>
            ) : timelineEntries.length === 0 ? (
              <div className="bg-white border border-carbon-black rounded-[20px] p-10 text-center shadow-brutal-sm">
                <Calendar size={48} className="mx-auto text-steel/40 mb-4" />
                <h4 className="text-lg font-bold uppercase tracking-tight text-carbon-black mb-2">No Timeline Entries</h4>
                <p className="text-steel font-bold text-sm max-w-md mx-auto">
                  Start logging your symptoms day-by-day. Your progression timeline will appear chronologically here.
                </p>
              </div>
            ) : (() => {
              // Group entries by calendar date (newest date first)
              const grouped = {};
              filteredEntries.forEach(entry => {
                const dateKey = entry.date || (entry.created_at ? entry.created_at.split('T')[0] : 'Unknown');
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(entry);
              });
              const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

              const formatDateLabel = (dateStr) => {
                try {
                  const d = new Date(dateStr + 'T00:00:00');
                  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                } catch {
                  return dateStr;
                }
              };

              return (
                <div className="relative border-l border-carbon-black pl-8 ml-4 space-y-10 py-2">
                  {sortedDates.map((dateKey, dateIndex) => {
                    const entries = grouped[dateKey];
                    return (
                      <div key={dateKey} className="relative">
                        {/* Date dot connector */}
                        <div className="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full border-2 border-carbon-black bg-lime-pulse flex items-center justify-center shadow-brutal-sm">
                          <Calendar size={12} className="text-carbon-black" />
                        </div>

                        {/* Date header */}
                        <h4 className="text-lg font-bold uppercase tracking-tight text-carbon-black flex items-center gap-2 mb-4">
                          📅 {formatDateLabel(dateKey)}
                          <span className="px-2 py-0.5 bg-fog border border-carbon-black/10 text-[9px] rounded-full tracking-widest">
                            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                          </span>
                        </h4>

                        {/* Entries under this date */}
                        <div className="space-y-4">
                          {entries.map((entry, entryIndex) => {
                            let severityBadge = '';
                            if (entry.severity === 'SEVERE') severityBadge = 'bg-red-50 text-red-600 border-red-200';
                            else if (entry.severity === 'MODERATE') severityBadge = 'bg-orange-50 text-orange-600 border-orange-200';
                            else severityBadge = 'bg-green-50 text-green-600 border-green-200';

                            return (
                              <motion.div
                                key={entry.id || `${dateKey}-${entryIndex}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="relative"
                              >
                                <div className="rounded-[20px] p-6 bg-white border border-carbon-black shadow-brutal hover:shadow-brutal-dark transition-all">
                                  {/* Header row */}
                                  <div className="flex items-start justify-between gap-4 mb-3">
                                    <div>
                                      <h4 className="text-lg font-bold uppercase tracking-tight text-carbon-black flex items-center gap-2">
                                        {entry.symptoms?.substring(0, 40)}{entry.symptoms?.length > 40 ? '…' : ''}
                                        {entry.source && (
                                          <span className="px-2 py-0.5 bg-fog border border-carbon-black/10 text-[9px] rounded-full tracking-widest ml-2">
                                            {entry.source}
                                          </span>
                                        )}
                                      </h4>
                                      {entry.created_at && (
                                        <p className="text-xs font-bold text-steel flex items-center gap-1 mt-0.5">
                                          <Clock size={12} /> {new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </p>
                                      )}
                                    </div>

                                    {/* Action Buttons — top right */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button onClick={() => {
                                        setEditingEntry(entry);
                                        setEditSymptoms(entry.symptoms);
                                        setEditSeverity(entry.severity);
                                        setEditTemperature(entry.temperature || '');
                                        setEditNotes(entry.notes || '');
                                      }} className="text-[10px] font-bold uppercase tracking-widest text-carbon-black border border-carbon-black px-3 py-1.5 rounded-lg shadow-brutal-sm hover:shadow-brutal hover:-translate-y-0.5 transition-all bg-white cursor-pointer">
                                        ✏ Edit
                                      </button>
                                      <button onClick={() => handleDeleteEntry(entry.id)} className="text-[10px] font-bold uppercase tracking-widest text-red-600 border border-red-200 px-3 py-1.5 rounded-lg shadow-brutal-sm hover:shadow-brutal hover:-translate-y-0.5 transition-all bg-red-50 cursor-pointer">
                                        🗑 Delete
                                      </button>
                                    </div>
                                  </div>

                                  {/* Badges row: Temperature, Risk, Severity below title */}
                                  <div className="flex flex-wrap items-center gap-2 mb-4">
                                    {entry.temperature && (
                                      <span className="flex items-center gap-1 px-3 py-1 rounded-full border border-carbon-black bg-fog text-xs font-bold uppercase text-carbon-black shadow-brutal-sm">
                                        <Thermometer size={12} className="text-red-500" /> {entry.temperature}°F
                                      </span>
                                    )}
                                    {entry.risk_level && (
                                      <span className="px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm bg-blue-50 text-blue-600 border-blue-200">
                                        Risk: {entry.risk_level}
                                      </span>
                                    )}
                                    <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm ${severityBadge}`}>
                                      {entry.severity}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-sm font-bold text-carbon-black">
                                      <span className="text-steel uppercase tracking-wider text-xs block mb-1">Symptoms Reported:</span>
                                      {entry.symptoms}
                                    </p>
                                    {entry.ai_summary && (
                                      <p className="text-sm font-bold text-carbon-black/90 bg-lime-50 border border-lime-200 p-3 rounded-xl mt-2">
                                        <span className="text-lime-700 uppercase tracking-wider text-[10px] block mb-1">AI Triage Summary:</span>
                                        {entry.ai_summary}
                                      </p>
                                    )}
                                    {entry.notes && (
                                      <p className="text-sm italic font-bold text-carbon-black/80 bg-fog/50 border border-carbon-black/5 p-3 rounded-xl mt-2">
                                        <span className="text-steel uppercase tracking-wider text-[10px] block not-italic mb-1">Self-Care & Notes:</span>
                                        {entry.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

      </motion.main>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsLogModalOpen(true)}
        className="fixed bottom-4 right-[92px] md:bottom-6 md:right-[104px] z-40 w-14 h-14 rounded-full bg-lime-pulse border-2 border-carbon-black shadow-brutal hover:shadow-brutal-dark text-carbon-black flex items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-1 focus:outline-none"
        title="Log Daily Symptoms"
      >
        <Plus size={28} className="stroke-[3]" />
      </button>

      {/* Log Symptoms Modal */}
      {isLogModalOpen && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsLogModalOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[20px] border border-carbon-black shadow-brutal max-w-xl w-full relative z-[9999]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsLogModalOpen(false)}
              className="absolute top-4 right-4 text-carbon-black hover:scale-110 transition-transform font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold uppercase tracking-tight mb-6 flex items-center gap-3 text-carbon-black border-b border-carbon-black/10 pb-4">
              <Plus size={24} className="text-carbon-black" /> Log Daily Symptoms
            </h3>

            <form onSubmit={handleSaveEntry} className="space-y-6">
              {formError && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 shadow-brutal-sm">
                  <AlertCircle className="text-red-600" size={18} />
                  <span className="text-red-600 font-bold text-xs">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-steel block">Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-4 bg-white border border-carbon-black rounded-xl font-bold text-sm focus:outline-none focus:shadow-brutal-sm text-carbon-black"
                      required
                    />
                  </div>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-steel block">Temperature (°F)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="e.g. 98.6 or 101.2"
                      className="w-full p-4 bg-white border border-carbon-black rounded-xl font-bold text-sm focus:outline-none focus:shadow-brutal-sm text-carbon-black"
                    />
                  </div>
                </div>
              </div>

              {/* Symptoms Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-steel block">Symptoms Experiencing</label>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Dry cough, fever, throat pain, mild headache"
                  className="w-full p-4 bg-white border border-carbon-black rounded-xl font-bold text-sm focus:outline-none focus:shadow-brutal-sm text-carbon-black"
                  rows={2}
                  required
                />
              </div>

              {/* Severity Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-steel block">Severity</label>
                <div className="flex gap-4">
                  {['MILD', 'MODERATE', 'SEVERE'].map((sev) => {
                    let activeStyle = '';
                    if (severity === sev) {
                      if (sev === 'MILD') activeStyle = 'bg-green-100 text-green-600 shadow-brutal-sm ring-1 ring-green-500';
                      else if (sev === 'MODERATE') activeStyle = 'bg-orange-100 text-orange-600 shadow-brutal-sm ring-1 ring-orange-500';
                      else activeStyle = 'bg-red-100 text-red-600 shadow-brutal-sm ring-1 ring-red-500';
                    } else {
                      activeStyle = 'bg-white hover:bg-fog text-steel';
                    }
                    return (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSeverity(sev)}
                        className={`flex-1 p-4 border border-carbon-black rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer ${activeStyle}`}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-steel block">Notes & Self-Care Actions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Took paracetamol at 2 PM, fever reduced but throat pain persists"
                  className="w-full p-4 bg-white border border-carbon-black rounded-xl font-bold text-sm focus:outline-none focus:shadow-brutal-sm text-carbon-black"
                  rows={2}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSavingEntry}
                className="w-full py-4 bg-lime-pulse text-carbon-black border border-carbon-black rounded-xl font-bold uppercase tracking-widest text-sm shadow-brutal hover:shadow-brutal-dark transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingEntry ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Saving Entry...
                  </>
                ) : (
                  'Save Day Entry'
                )}
              </button>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {editingEntry && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditingEntry(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[20px] border border-carbon-black shadow-brutal max-w-lg w-full z-[9999]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">Edit Timeline Entry</h3>
            <form onSubmit={handleUpdateEntry} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-steel">Symptoms</label>
                <textarea
                  value={editSymptoms}
                  onChange={e => setEditSymptoms(e.target.value)}
                  className="w-full p-3 border border-carbon-black rounded-xl font-bold text-sm"
                  rows={2} required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-steel">Severity</label>
                  <select
                    value={editSeverity}
                    onChange={e => setEditSeverity(e.target.value)}
                    className="w-full p-3 border border-carbon-black rounded-xl font-bold text-sm bg-white"
                  >
                    <option value="MILD">MILD</option>
                    <option value="MODERATE">MODERATE</option>
                    <option value="SEVERE">SEVERE</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-steel">Temperature</label>
                  <input
                    type="text"
                    value={editTemperature}
                    onChange={e => setEditTemperature(e.target.value)}
                    className="w-full p-3 border border-carbon-black rounded-xl font-bold text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-steel">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full p-3 border border-carbon-black rounded-xl font-bold text-sm"
                  rows={2}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingEntry(null)} className="flex-1 py-3 bg-white border border-carbon-black font-bold uppercase tracking-widest rounded-xl shadow-brutal-sm hover:shadow-brutal transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isUpdating} className="flex-1 py-3 bg-lime-pulse border border-carbon-black font-bold uppercase tracking-widest rounded-xl shadow-brutal-sm hover:shadow-brutal transition-all flex justify-center gap-2 disabled:opacity-50">
                  {isUpdating ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Report;