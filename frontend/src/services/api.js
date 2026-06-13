import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error('Failed to attach auth token:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // For blob responses (like PDF downloads), error.response.data is a Blob, not JSON
    const isBlob = error.response?.data instanceof Blob;
    const message = isBlob
      ? 'Download failed. Please try again.'
      : (error.response?.data?.message || error.message || 'An error occurred');
    return Promise.reject(new Error(message));
  }
);

// Symptom Triage API
export const sendSymptoms = async (data) => {
  return api.post('/api/chat', data);
};

export const queryCopilot = async (message, context) => {
  return api.post('/api/chat/copilot', { message, context });
};

// Get Triage Result (from AI service - FastAPI)
export const getTriageFromAI = async (text, userId = 'anonymous', lat = null, lng = null) => {
  return api.post('/api/triage', {
    text,
    userId,
    lat,
    lng
  });
};

// Process Voice Triage
export const processVoiceTriage = async (text, userId = 'anonymous', lat = null, lng = null) => {
  return api.post('/api/triage', { text, userId, lat, lng });
};

// Symptom Timeline API
export const addTimelineEntry = async (data) => {
  return api.post('/api/timeline/add', data);
};

export const getTimelineEntries = async (userId) => {
  return api.get(`/api/timeline/${userId}`);
};

export const updateTimelineEntry = async (id, data) => {
  return api.put(`/api/timeline/${id}`, data);
};

export const deleteTimelineEntry = async (id, userId) => {
  return api.delete(`/api/timeline/${id}`, { data: { userId } });
};

export const analyzeTimeline = async (userId) => {
  return api.post('/api/timeline/analyze', { userId });
};

export const downloadTimelinePdf = async (userId, analysis) => {
  return api.post('/api/timeline/pdf', { userId, analysis }, { responseType: 'blob' });
};

// Get Hospitals
export const getNearbyHospitals = async (lat, lng, radius = 50000) => {
  return api.get('/api/hospitals', { params: { lat, lng, radius } });
};

// Create Appointment
export const createAppointment = async (appointmentData) => {
  return api.post('/api/appointment', appointmentData);
};

// Get Appointments
export const getAppointments = async (params = {}) => {
  return api.get('/api/appointment', { params });
};

// Cancel Appointment
export const cancelAppointment = async (appointmentId, reason = '') => {
  return api.put(`/api/appointment/${appointmentId}/cancel`, { reason });
};

// Reschedule Appointment
export const rescheduleAppointment = async (appointmentId, newDate, newTime, reason = '') => {
  return api.put(`/api/appointment/${appointmentId}/reschedule`, { newDate, newTime, reason });
};

// Emergency Trigger
export const emergencyTrigger = async (emergencyData) => {
  return api.post('/api/emergency', emergencyData);
};

// Get Emergency Protocol
export const getEmergencyProtocol = async (emergencyType) => {
  return api.get(`/api/emergency/protocol/${emergencyType}`);
};

// Get History (consultations/triage history)
export const getHistory = async (userId = null) => {
  return api.get('/api/chat/history', { params: { userId } });
};

// Get User Profile
export const getUserProfile = async () => {
  return api.get('/api/user/profile');
};

// Update User Profile
export const updateUserProfile = async (profileData) => {
  return api.put('/api/user/profile', profileData);
};

export default api;