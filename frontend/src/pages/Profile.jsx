import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Calendar, Heart, Save, AlertCircle, Edit3,
  X, Shield, Droplets, Pill, Activity, CheckCircle, Loader2,
  Clock, QrCode, Download, Printer, RefreshCw
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';
import api from '../services/api';

/* ─────────────────────────────────────────────
   Shimmer / Skeleton Loading Component
───────────────────────────────────────────── */
const Shimmer = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded-lg bg-slate-200 ${className}`}>
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
        animation: 'shimmer 1.5s infinite'
      }}
    />
  </div>
);

const ProfileSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    {/* Header skeleton */}
    <div className="flex items-center gap-5">
      <Shimmer className="w-20 h-20 !rounded-full" />
      <div className="space-y-3 flex-1">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>
    </div>
    {/* Cards skeleton */}
    <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
      <Shimmer className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
      <Shimmer className="h-5 w-48" />
      <div className="grid grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   Toast Notification Component
───────────────────────────────────────────── */
const Toast = ({ message, type, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: -30, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -30, scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="fixed top-6 right-6 z-[100] max-w-sm"
  >
    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border backdrop-blur-sm ${
      type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      {type === 'success' ? (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
        >
          <CheckCircle size={22} className="text-emerald-500" />
        </motion.div>
      ) : (
        <AlertCircle size={22} className="text-red-500" />
      )}
      <span className="font-semibold text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  </motion.div>
);

/* ─────────────────────────────────────────────
   Info Row Component (View Mode)
───────────────────────────────────────────── */
const InfoRow = ({ icon: Icon, label, value, iconColor = 'text-slate-400' }) => (
  <div className="flex items-start gap-3 py-3">
    <div className={`mt-0.5 ${iconColor}`}>
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[15px] font-semibold text-slate-800 truncate">
        {value || <span className="text-slate-300 italic font-normal">Not provided</span>}
      </p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   Tag Chip Component
───────────────────────────────────────────── */
const TagChip = ({ label, color = 'bg-slate-100 text-slate-600' }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
    {label}
  </span>
);

/* ─────────────────────────────────────────────
   Main Profile Component
───────────────────────────────────────────── */
const Profile = () => {
  const { user, checkSession } = useUserStore();

  const getResolvedQrUrl = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const appUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_FRONTEND_URL;
      if (appUrl) {
        return `${appUrl.replace(/\/$/, '')}${parsed.pathname}`;
      }
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return `${window.location.origin.replace(/\/$/, '')}${parsed.pathname}`;
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  // Profile data state
  const [profileData, setProfileData] = useState({
    name: '', email: '', phone: '', age: '', gender: '',
    blood_type: '', emergency_contact: '', allergies: [], conditions: [], medications: []
  });
  const [editData, setEditData] = useState(null); // Snapshot for edit mode

  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // QR states
  const [qrData, setQrData] = useState(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  /* ───── Data Fetching ───── */
  const fetchProfile = useCallback(async () => {
    try {
      if (!user?.id) return;
      const res = await api.get('/api/user/profile');
      
      const isSuccess = res?.success === true || res?.data;
      
      if (isSuccess && res.data) {
        const d = res.data;
        const freshData = {
          name: d.name || user?.user_metadata?.full_name || user?.name || 'User',
          email: d.email || user?.email || '',
          phone: d.phone || '',
          age: d.age || '',
          gender: d.gender || '',
          blood_type: d.blood_type || '',
          emergency_contact: d.emergency_contact || '',
          allergies: d.allergies || [],
          conditions: d.conditions || [],
          medications: d.medications || []
        };
        setProfileData(freshData);
        if (d.updated_at) {
          setLastUpdated(new Date(d.updated_at));
        }
      } else {
        // Fallback to auth data
        setProfileData({
          name: user?.user_metadata?.full_name || user?.name || 'User',
          email: user?.email || '',
          phone: '', age: '', gender: '', blood_type: '',
          emergency_contact: '',
          allergies: [], conditions: [], medications: []
        });
      }
    } catch (err) {
      console.warn('Could not fetch profile', err);
      setProfileData({
        name: user?.user_metadata?.full_name || user?.name || 'User',
        email: user?.email || '',
        phone: '', age: '', gender: '', blood_type: '',
        emergency_contact: '',
        allergies: [], conditions: [], medications: []
      });
    }
  }, [user]);

  const fetchQrCode = useCallback(async () => {
    try {
      const res = await api.get('/api/medical-qr/my');
      if (res.success && res.data) {
        setQrData(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch QR code', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setIsPageLoading(true);
      Promise.all([fetchProfile(), fetchQrCode()])
        .finally(() => setIsPageLoading(false));
    }
  }, [user, fetchProfile, fetchQrCode]);

  /* ───── Edit Mode Handlers ───── */
  const enterEditMode = () => {
    setEditData({ ...profileData });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditData(null);
    setIsEditing(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditArrayChange = (name, value) => {
    const arr = value.split(',').map(item => item.trim()).filter(Boolean);
    setEditData(prev => ({ ...prev, [name]: arr }));
  };

  /* ───── Save Handler ───── */
  const handleSave = async () => {
    setIsSaving(true);
    console.log('[PROFILE] Save started');
    console.log('[PROFILE] Payload:', editData);
    try {
      const res = await api.put('/api/user/profile', editData);
      console.log('[PROFILE] Save response:', res);

      const isSuccess =
        res?.success === true ||
        res?.data ||
        res?.user ||
        res?.status === 200;

      if (!isSuccess) {
        throw new Error("Failed to Save Changes");
      }

      // Show skeleton shimmer during refetch
      setIsPageLoading(true);

      // Re-fetch fresh data from backend (source of truth)
      const freshProfileRes = await api.get('/api/user/profile');
      console.log('[PROFILE] Fresh profile:', freshProfileRes);

      if (freshProfileRes?.success && freshProfileRes?.data) {
        const d = freshProfileRes.data;
        const freshData = {
          name: d.name || user?.user_metadata?.full_name || user?.name || 'User',
          email: d.email || user?.email || '',
          phone: d.phone || '',
          age: d.age || '',
          gender: d.gender || '',
          blood_type: d.blood_type || '',
          emergency_contact: d.emergency_contact || '',
          allergies: d.allergies || [],
          conditions: d.conditions || [],
          medications: d.medications || []
        };
        setProfileData(freshData);
      }

      checkSession();
      setLastUpdated(new Date());

      // Success flow
      showToast('Profile Updated Successfully', 'success', 2000);
      setIsEditing(false);
      setEditData(null);
    } catch (err) {
      console.error('[PROFILE] Save error:', err);
      showToast(err.message || 'Failed to Save Changes', 'error');
    } finally {
      setIsSaving(false);
      setIsPageLoading(false);
    }
  };

  /* ───── Toast Helper ───── */
  const showToast = (message, type, duration = 3000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  };

  const handleGenerateQr = async () => {
    setIsGeneratingQr(true);
    try {
      const res = await api.post('/api/medical-qr/generate');
      const isSuccess = res.success === true || res.status === 'success';
      const responseData = res.data || (res.qr_data ? { qr_url: res.qr_data, qr_id: res.qr_id || 'unknown', is_public: true } : null);
      if (isSuccess && responseData) {
        setQrData(responseData);
        showToast('Medical QR generated successfully!', 'success');
      } else {
        showToast('Failed to generate Medical QR.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error generating QR code.', 'error');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handlePrivacyChange = async (isPublicSetting) => {
    try {
      const res = await api.put('/api/medical-qr/settings', { is_public: isPublicSetting });
      if (res.success && res.data) {
        setQrData(res.data);
        showToast(`Privacy updated to ${isPublicSetting ? 'Public' : 'Private'}`, 'success');
      }
    } catch {
      showToast('Failed to update privacy settings.', 'error');
    }
  };

  const handleDownloadQr = async () => {
    if (!qrData) return;
    try {
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getResolvedQrUrl(qrData.qr_url))}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical_qr_${qrData.qr_id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading QR:', err);
    }
  };

  const handlePrintQr = () => {
    if (!qrData) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Emergency Medical QR Card</title>
          <style>
            body { font-family: 'Inter', sans-serif; text-align: center; padding: 40px; }
            .card { border: 2px solid #e2e8f0; padding: 30px; display: inline-block; border-radius: 20px; max-width: 400px; }
            .logo { font-weight: 700; font-size: 20px; margin-bottom: 20px; color: #1e293b; }
            .qr { margin: 20px 0; }
            .info { font-weight: 600; font-size: 16px; margin-top: 15px; color: #334155; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">🚨 AROGYAAI EMERGENCY CARD</div>
            <div class="info">${profileData.name}</div>
            <div class="qr">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getResolvedQrUrl(qrData.qr_url))}" alt="QR Code"/>
            </div>
            <div style="font-size: 12px; color: #94a3b8;">Scan to view emergency medical profile</div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  /* ───── Helpers ───── */
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(date);
  };

  /* ───── Styles ───── */
  const inputStyle = "w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-slate-800 font-medium text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const labelStyle = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";
  const sectionCardStyle = "bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow";

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-lime-200">
      <Navbar />

      {/* Shimmer keyframes (injected once) */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <main className="pt-28 pb-20 px-4 md:px-8 max-w-4xl mx-auto">

        {isPageLoading ? (
          <ProfileSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* ───── Profile Header Card ───── */}
            <div className={sectionCardStyle}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0">
                  {getInitials(profileData.name)}
                </div>
                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-slate-800 truncate">{profileData.name || 'User'}</h1>
                  <p className="text-sm text-slate-400 font-medium mt-0.5">{profileData.email}</p>
                  {lastUpdated && (
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                      <Clock size={12} /> Last updated: {formatDate(lastUpdated)}
                    </p>
                  )}
                </div>
                {/* Edit / Cancel button */}
                {!isEditing ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={enterEditMode}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    <Edit3 size={15} /> Edit Profile
                  </motion.button>
                ) : (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    <X size={15} /> Cancel
                  </button>
                )}
              </div>
            </div>

            {/* ───── Personal Information Card ───── */}
            <div className={sectionCardStyle}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <User size={16} className="text-blue-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Personal Information</h2>
              </div>

              <AnimatePresence mode="wait">
                {!isEditing ? (
                  /* ──── VIEW MODE ──── */
                  <motion.div
                    key="view-personal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 divide-slate-100"
                  >
                    <div className="space-y-1">
                      <InfoRow icon={User} label="Full Name" value={profileData.name} iconColor="text-blue-400" />
                      <InfoRow icon={Mail} label="Email" value={profileData.email} iconColor="text-purple-400" />
                      <InfoRow icon={Phone} label="Phone" value={profileData.phone} iconColor="text-emerald-400" />
                    </div>
                    <div className="space-y-1 pt-3 md:pt-0">
                      <InfoRow icon={Calendar} label="Age" value={profileData.age ? `${profileData.age} years` : ''} iconColor="text-amber-400" />
                      <InfoRow icon={User} label="Gender" value={profileData.gender} iconColor="text-pink-400" />
                      <InfoRow icon={Droplets} label="Blood Group" value={profileData.blood_type} iconColor="text-red-400" />
                    </div>
                    <div className="col-span-1 md:col-span-2 pt-3">
                      <InfoRow icon={AlertCircle} label="Emergency Contact" value={profileData.emergency_contact} iconColor="text-rose-500" />
                    </div>
                  </motion.div>
                ) : (
                  /* ──── EDIT MODE ──── */
                  <motion.div
                    key="edit-personal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-5"
                  >
                    <div>
                      <label className={labelStyle}>Full Name</label>
                      <input type="text" value={editData?.name || ''} className={`${inputStyle} bg-slate-100 cursor-not-allowed`} readOnly disabled />
                      <p className="text-[11px] text-slate-400 mt-1">Name is linked to your account</p>
                    </div>
                    <div>
                      <label className={labelStyle}>Email</label>
                      <input type="email" value={editData?.email || ''} className={`${inputStyle} bg-slate-100 cursor-not-allowed`} readOnly disabled />
                      <p className="text-[11px] text-slate-400 mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className={labelStyle}>Phone Number</label>
                      <input type="tel" name="phone" value={editData?.phone || ''} onChange={handleEditChange} className={inputStyle} placeholder="+91 9876543210" disabled={isSaving} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyle}>Age</label>
                        <input type="number" name="age" value={editData?.age || ''} onChange={handleEditChange} className={inputStyle} placeholder="25" disabled={isSaving} />
                      </div>
                      <div>
                        <label className={labelStyle}>Gender</label>
                        <select name="gender" value={editData?.gender || ''} onChange={handleEditChange} className={`${inputStyle} appearance-none`} disabled={isSaving}>
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>Blood Group</label>
                      <select name="blood_type" value={editData?.blood_type || ''} onChange={handleEditChange} className={`${inputStyle} appearance-none`} disabled={isSaving}>
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelStyle}>Emergency Contact</label>
                      <input
                        type="tel"
                        name="emergency_contact"
                        value={editData?.emergency_contact || ''}
                        onChange={handleEditChange}
                        className={inputStyle}
                        placeholder="Enter emergency contact number"
                        disabled={isSaving}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ───── Medical Information Card ───── */}
            <div className={sectionCardStyle}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <Heart size={16} className="text-rose-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Medical Information</h2>
              </div>

              <AnimatePresence mode="wait">
                {!isEditing ? (
                  /* ──── VIEW MODE ──── */
                  <motion.div
                    key="view-medical"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Allergies */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Shield size={15} className="text-orange-400" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Allergies</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profileData.allergies?.length > 0
                          ? profileData.allergies.map((a, i) => <TagChip key={i} label={a} color="bg-orange-50 text-orange-700 border border-orange-200" />)
                          : <span className="text-sm text-slate-300 italic">No allergies recorded</span>
                        }
                      </div>
                    </div>
                    {/* Conditions */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Activity size={15} className="text-blue-400" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Medical Conditions</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profileData.conditions?.length > 0
                          ? profileData.conditions.map((c, i) => <TagChip key={i} label={c} color="bg-blue-50 text-blue-700 border border-blue-200" />)
                          : <span className="text-sm text-slate-300 italic">No conditions recorded</span>
                        }
                      </div>
                    </div>
                    {/* Medications */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Pill size={15} className="text-emerald-400" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Medications</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profileData.medications?.length > 0
                          ? profileData.medications.map((m, i) => <TagChip key={i} label={m} color="bg-emerald-50 text-emerald-700 border border-emerald-200" />)
                          : <span className="text-sm text-slate-300 italic">No medications recorded</span>
                        }
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ──── EDIT MODE ──── */
                  <motion.div
                    key="edit-medical"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className={labelStyle}>Allergies <span className="text-slate-300 normal-case">(comma separated)</span></label>
                      <input
                        type="text"
                        value={editData?.allergies?.join(', ') || ''}
                        onChange={(e) => handleEditArrayChange('allergies', e.target.value)}
                        className={inputStyle}
                        placeholder="Peanuts, Penicillin, Dust..."
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>Medical Conditions <span className="text-slate-300 normal-case">(comma separated)</span></label>
                      <input
                        type="text"
                        value={editData?.conditions?.join(', ') || ''}
                        onChange={(e) => handleEditArrayChange('conditions', e.target.value)}
                        className={inputStyle}
                        placeholder="Asthma, Diabetes, Hypertension..."
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>Current Medications <span className="text-slate-300 normal-case">(comma separated)</span></label>
                      <input
                        type="text"
                        value={editData?.medications?.join(', ') || ''}
                        onChange={(e) => handleEditArrayChange('medications', e.target.value)}
                        className={inputStyle}
                        placeholder="Metformin 500mg, Albuterol..."
                        disabled={isSaving}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ───── Save / Cancel Bar (Edit Mode Only) ───── */}
            <AnimatePresence>
              {isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="sticky bottom-6 z-50"
                >
                  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-200 shadow-lg px-6 py-4 flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500 font-medium hidden sm:block">
                      You have unsaved changes
                    </p>
                    <div className="flex gap-3 ml-auto">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: isSaving ? 1 : 1.02 }}
                        whileTap={{ scale: isSaving ? 1 : 0.98 }}
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-sm"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Save size={16} /> Save Changes
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ───── Medical QR Card Section ───── */}
            <div className={sectionCardStyle}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <QrCode size={16} className="text-violet-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Emergency Medical QR</h2>
              </div>

              {qrData ? (
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  {/* QR Image */}
                  <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center flex-shrink-0">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getResolvedQrUrl(qrData.qr_url))}`}
                      alt="Medical QR Code"
                      className="w-[180px] h-[180px] object-contain rounded-lg"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-3">
                      ID: {qrData.qr_id?.substring(0, 8)}...
                    </span>
                  </div>

                  {/* QR Details */}
                  <div className="flex-1 space-y-5 w-full">
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Your unique Emergency Medical QR is generated. Emergency responders or family members can scan this to quickly view your essential profile.
                    </p>

                    {/* Privacy toggle */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Privacy Level</p>
                      <div className="flex flex-col gap-2.5">
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                          <input type="radio" name="privacy_access" checked={qrData.is_public === true} onChange={() => handlePrivacyChange(true)} className="w-4 h-4 accent-emerald-500" />
                          <span className="font-semibold text-sm text-slate-700">Public Access <span className="text-slate-400 font-normal">— Show all medical details</span></span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                          <input type="radio" name="privacy_access" checked={qrData.is_public === false} onChange={() => handlePrivacyChange(false)} className="w-4 h-4 accent-emerald-500" />
                          <span className="font-semibold text-sm text-slate-700">Private Access <span className="text-slate-400 font-normal">— Show essentials only</span></span>
                        </label>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button type="button" onClick={handleDownloadQr} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <Download size={15} /> Download
                      </button>
                      <button type="button" onClick={handlePrintQr} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <Printer size={15} /> Print Card
                      </button>
                      <button type="button" onClick={handleGenerateQr} disabled={isGeneratingQr} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                        <RefreshCw size={15} className={isGeneratingQr ? 'animate-spin' : ''} /> Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto">
                    <QrCode size={28} className="text-violet-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto">
                    Generate your Emergency Medical QR to enable quick access to your health profile in emergencies.
                  </p>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGenerateQr}
                    disabled={isGeneratingQr}
                    className="px-6 py-3 bg-violet-600 text-white font-semibold text-sm rounded-xl hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isGeneratingQr ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : 'Generate QR Code'}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Profile;
