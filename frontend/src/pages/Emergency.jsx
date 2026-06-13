import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Phone, MapPin, Clock, Activity, Loader2, CheckCircle } from 'lucide-react';
import { useHealth } from '../store/HealthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import api from '../services/api';

const Emergency = () => {
  const { selectedSymptoms, triageResult } = useHealth();
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'failed'
  const [telegramStatus, setTelegramStatus] = useState('idle');
  const [pdfStatus, setPdfStatus] = useState('idle');

  // Declared missing states
  const [formData, setFormData] = useState({
    emergencyType: 'general',
    contact: '',
    patientInfo: {
      name: '',
      age: '',
      location: ''
    }
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [emergencySent, setEmergencySent] = useState(false);

  // Save emergency to Supabase directly
  const saveEmergencyToSupabase = async (emergencyType, location, lat, lng) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("No user logged in");
        return;
      }

      if (import.meta.env.DEV) {
        console.log("Authenticated User:", user);
      }
      const payload = {
        user_id: user.id,
        emergency_type: emergencyType,
        symptoms_report: triageResult ? `Risk: ${triageResult.risk}, Score: ${triageResult.score}` : 'Emergency SOS Triggered',
        triage_score: triageResult?.score || null,
        action_taken: 'telegram_broadcast_initiated',
        contact_alerted: formData.contact || null,
        hospital_referred: null,
        triggered_at: new Date().toISOString(),
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        maps_url: lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null
      };
      if (import.meta.env.DEV) {
        console.log("Insert Payload:", payload);
      }

      const { data, error } = await supabase
        .from('emergency_logs')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log("Supabase Response:", data);
        console.log("✅ Emergency logged:", data.id);
      }
    } catch (err) {
      console.error("🚨 Error saving emergency:", err);
      throw err;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('patient.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        patientInfo: { ...prev.patientInfo, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const getCurrentLocationPromise = () => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleGetLocation = async () => {
    setError(null);
    setLocationStatus('loading');
    try {
      const coords = await getCurrentLocationPromise();
      setFormData(prev => ({
        ...prev,
        patientInfo: { ...prev.patientInfo, location: `${coords.latitude},${coords.longitude}` }
      }));
      setLocationStatus('success');
    } catch (err) {
      setLocationStatus('failed');
      setError('Location permission required for emergency alerts.');
      console.error("Location capture failed:", err);
    }
  };

  const handleTestAlert = async () => {
    setIsTestLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/emergency/test');
      if (response.success) {
        alert(response.message || 'Test alert sent successfully!');
      }
    } catch (err) {
      setError(err.message || 'Failed to send test alert.');
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmergencySent(false);

    setLocationStatus('loading');
    setTelegramStatus('idle');
    setPdfStatus('idle');

    let coords = null;
    try {
      console.log("📡 [GEOLOCATION] Capturing live coordinates for manual SOS...");
      coords = await getCurrentLocationPromise();
      console.log(`✅ [GEOLOCATION] Capture successful: ${coords.latitude}, ${coords.longitude}`);
      setLocationStatus('success');
      setFormData(prev => ({
        ...prev,
        patientInfo: { ...prev.patientInfo, location: `${coords.latitude},${coords.longitude}` }
      }));
    } catch (locErr) {
      console.warn("⚠️ [GEOLOCATION] Geolocation capture failed: ", locErr.message, " - Retrying location capture...");
      try {
        // Fallback retry
        coords = await getCurrentLocationPromise();
        console.log(`✅ [GEOLOCATION] Retry Capture successful: ${coords.latitude}, ${coords.longitude}`);
        setLocationStatus('success');
        setFormData(prev => ({
          ...prev,
          patientInfo: { ...prev.patientInfo, location: `${coords.latitude},${coords.longitude}` }
        }));
      } catch (retryErr) {
        console.error("❌ [GEOLOCATION] Geolocation retry failed:", retryErr.message);
        setLocationStatus('failed');
        setError('Location permission or GPS signal required for emergency alerts. Please enable location services and try again.');
        setIsLoading(false);
        return;
      }
    }

    setTelegramStatus('loading');
    setPdfStatus('loading');

    console.log("=== SUBMITTING EMERGENCY SOS ===");
    console.log("Coords Captured:", coords);

    try {
      await saveEmergencyToSupabase(formData.emergencyType, `${coords.latitude},${coords.longitude}`, coords.latitude, coords.longitude);

      const payload = {
        ...formData,
        latitude: coords.latitude,
        longitude: coords.longitude,
        patientInfo: {
          ...formData.patientInfo,
          location: `${coords.latitude},${coords.longitude}`
        }
      };
      
      console.log("Payload being sent to backend API:", JSON.stringify(payload, null, 2));

      const response = await api.emergencyTrigger(payload);

      if (response.success) {
        setTelegramStatus('success');
        setPdfStatus('success');
        setEmergencySent(true);
      } else {
        setTelegramStatus('failed');
        setPdfStatus('failed');
        throw new Error('Failed to send emergency alert');
      }
    } catch (err) {
      setTelegramStatus('failed');
      setPdfStatus('failed');
      setError(err.message || 'Failed to send emergency. Please call 102 directly.');
    } finally {
      setIsLoading(false);
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

  const emergencyTypes = [
    { id: 'cardiac', label: 'Cardiac Emergency', icon: '❤️' },
    { id: 'stroke', label: 'Stroke', icon: '🧠' },
    { id: 'trauma', label: 'Trauma/Injury', icon: '🩹' },
    { id: 'respiratory', label: 'Respiratory', icon: '🫁' },
    { id: 'general', label: 'General Emergency', icon: '🏥' }
  ];

  return (
    <div className="min-h-screen text-carbon-black font-sans bg-fog pb-20 selection:bg-lime-pulse/30">

      <Navbar />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-36 px-6 md:px-12 max-w-[1400px] mx-auto space-y-12"
      >
        {/* Emergency Header */}
        <motion.div variants={itemVariants} className="text-center py-10">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-white border border-carbon-black rounded-full mb-6 shadow-brutal-sm text-red-600"
          >
            <AlertCircle size={48} />
          </motion.div>
          <h1 className="text-6xl md:text-8xl font-bold uppercase tracking-tight mb-4 text-carbon-black">
            Emergency <span className="text-red-600">SOS</span>
          </h1>
          <p className="text-steel font-bold text-xl max-w-2xl mx-auto">
            Trigger emergency alert with your current triage data and location.
          </p>
        </motion.div>

        {/* Current Status */}
        {triageResult && (
          <motion.div
            variants={itemVariants}
            className="bg-white border border-carbon-black shadow-brutal-dark rounded-[20px] p-8 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="w-16 h-16 bg-fog rounded-2xl flex items-center justify-center border border-carbon-black shadow-brutal-sm">
                <Activity size={32} className="text-carbon-black" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-steel mb-1">Current Triage Status</p>
                <h3 className="text-2xl font-bold">
                  <span className={
                    triageResult.risk === 'HIGH' ? 'text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-200' :
                    triageResult.risk === 'MODERATE' ? 'text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-200' : 'text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-200'
                  }>
                    {triageResult.risk}
                  </span>
                  <span className="text-steel text-sm ml-4 uppercase tracking-widest">Score: {triageResult.score}</span>
                </h3>
              </div>
            </div>
            <div className="md:text-right w-full md:w-auto border-t md:border-t-0 border-carbon-black/10 pt-4 md:pt-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-steel mb-1">Category</p>
              <p className="font-bold text-lg capitalize text-carbon-black">{triageResult.category}</p>
            </div>
          </motion.div>
        )}

        {/* Success Message */}
        {emergencySent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-carbon-black shadow-brutal-dark rounded-[20px] p-10 text-center max-w-2xl mx-auto"
          >
            <div className="w-20 h-20 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-brutal-sm">
              <CheckCircle size={48} className="text-green-600" />
            </div>
            <h3 className="text-3xl font-bold uppercase tracking-tight mb-2 text-carbon-black">Emergency Alert Sent</h3>
            <p className="text-steel font-bold">
              Nearest hospital has been notified. Help is on the way.
            </p>
          </motion.div>
        )}

        {/* Emergency Form */}
        {!emergencySent && (
          <motion.div
            variants={itemVariants}
            className="max-w-2xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Emergency Type Selection */}
              <div className="bg-sky-wash border border-carbon-black shadow-brutal-dark rounded-[20px] p-8">
                <label className="block text-xs font-bold uppercase tracking-widest text-steel mb-6">
                  Emergency Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {emergencyTypes.map(type => (
                    <motion.button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, emergencyType: type.id }))}
                      whileTap={{ scale: 0.95 }}
                      className={`p-4 rounded-xl border transition-all ${
                        formData.emergencyType === type.id
                          ? 'border-carbon-black bg-white shadow-brutal-sm text-carbon-black'
                          : 'border-transparent bg-white/40 hover:bg-white hover:border-carbon-black text-steel hover:text-carbon-black'
                      }`}
                    >
                      <div className="text-2xl mb-2">{type.icon}</div>
                      <div className="font-bold text-xs">{type.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-white border border-carbon-black shadow-brutal-dark rounded-[20px] p-8 space-y-6">
                <label className="block text-xs font-bold uppercase tracking-widest text-steel">
                  Emergency Contact
                </label>
                <div className="relative">
                  <Phone size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-steel" />
                  <input
                    type="tel"
                    name="contact"
                    value={formData.contact}
                    onChange={handleInputChange}
                    placeholder="Emergency contact number"
                    required
                    className="w-full p-6 pl-14 bg-fog border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black placeholder-steel transition-shadow"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-steel mb-3">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      name="patient.name"
                      value={formData.patientInfo.name}
                      onChange={handleInputChange}
                      placeholder="Your name"
                      required
                      className="w-full p-5 bg-fog border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black placeholder-steel transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-steel mb-3">
                      Age
                    </label>
                    <input
                      type="number"
                      name="patient.age"
                      value={formData.patientInfo.age}
                      onChange={handleInputChange}
                      placeholder="Age"
                      required
                      className="w-full p-5 bg-fog border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black placeholder-steel transition-shadow"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-steel">
                      Current Location
                    </label>
                    <button type="button" onClick={handleGetLocation} className="text-[10px] font-bold text-carbon-black bg-lime-pulse px-3 py-1.5 rounded-full border border-carbon-black shadow-brutal-sm hover:shadow-brutal hover:-translate-y-0.5 transition-all uppercase tracking-wider">
                      📍 Get Live GPS
                    </button>
                  </div>
                  <div className="relative">
                    <MapPin size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-steel" />
                    <input
                      type="text"
                      name="patient.location"
                      value={formData.patientInfo.location}
                      onChange={handleInputChange}
                      placeholder="Describe your location"
                      required
                      className="w-full p-6 pl-14 bg-fog border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black placeholder-steel transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Status Steps Tracker */}
              {(locationStatus !== 'idle' || telegramStatus !== 'idle' || pdfStatus !== 'idle') && (
                <div className="bg-white border border-carbon-black rounded-[20px] p-6 shadow-brutal-dark space-y-4">
                  <h4 className="font-bold uppercase text-xs text-steel tracking-wider">SOS Transmission Status</h4>
                  <div className="space-y-3 font-bold text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-carbon-black">Location GPS Capture</span>
                      <span className={
                        locationStatus === 'success' ? 'text-green-600' :
                        locationStatus === 'failed' ? 'text-red-600' :
                        locationStatus === 'loading' ? 'text-blue-600 animate-pulse' : 'text-slate-400'
                      }>
                        {locationStatus === 'success' ? '✓ Location Captured' :
                         locationStatus === 'failed' ? '⚠ Location Failed' :
                         locationStatus === 'loading' ? 'Capturing Live coordinates...' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-carbon-black/5 pt-2">
                      <span className="text-carbon-black">Telegram Alert Dispatch</span>
                      <span className={
                        telegramStatus === 'success' ? 'text-green-600' :
                        telegramStatus === 'failed' ? 'text-red-600' :
                        telegramStatus === 'loading' ? 'text-blue-600 animate-pulse' : 'text-slate-400'
                      }>
                        {telegramStatus === 'success' ? '✓ Telegram Sent' :
                         telegramStatus === 'failed' ? '⚠ Telegram Failed' :
                         telegramStatus === 'loading' ? 'Broadcasting alerts...' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-carbon-black/5 pt-2">
                      <span className="text-carbon-black">Medical PDF Document Report</span>
                      <span className={
                        pdfStatus === 'success' ? 'text-green-600' :
                        pdfStatus === 'failed' ? 'text-red-600' :
                        pdfStatus === 'loading' ? 'text-blue-600 animate-pulse' : 'text-slate-400'
                      }>
                        {pdfStatus === 'success' ? '✓ Medical PDF Sent' :
                         pdfStatus === 'failed' ? '⚠ PDF Failed' :
                         pdfStatus === 'loading' ? 'Attaching timeline history report...' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 shadow-brutal-sm">
                  <AlertCircle size={20} className="text-red-600" />
                  <span className="text-red-600 font-bold text-sm">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={isTestLoading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-6 bg-white hover:bg-fog text-carbon-black font-bold text-xs uppercase tracking-widest rounded-2xl border border-carbon-black shadow-brutal hover:shadow-brutal-dark transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isTestLoading ? <Loader2 size={20} className="animate-spin" /> : '🔔 Test Telegram Alert'}
                </motion.button>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-6 bg-red-500 text-carbon-black font-bold text-xs uppercase tracking-widest rounded-2xl border border-carbon-black shadow-brutal hover:shadow-brutal-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Phone size={20} className="text-carbon-black" />
                      SOS Alert
                    </>
                  )}
                </motion.button>
              </div>

              {/* Backup Number */}
              <div className="text-center pt-4">
                <p className="text-steel font-bold text-[10px] uppercase tracking-widest mb-2">If this fails, call directly:</p>
                <a href="tel:102" className="text-2xl font-bold text-red-600 hover:text-red-500 transition-colors">
                  102 - Ambulance Service
                </a>
              </div>
            </form>
          </motion.div>
        )}

      </motion.main>
    </div>
  );
};

export default Emergency;