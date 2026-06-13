import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ShieldAlert, User, Heart, Phone, Brain, CheckCircle, AlertTriangle } from 'lucide-react';

const MedicalCardPage = () => {
  const { qrId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchPublicMedicalCard = async () => {
      try {
        setLoading(true);
        // Use direct axios call to avoid any auth interceptor redirection/headers issues for public scans
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/medical-qr/public/${qrId}`);
        if (res.data?.success && res.data?.data) {
          setData(res.data.data);
        } else {
          setError('Failed to load emergency medical card.');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Emergency medical card not found or database is unreachable.');
      } finally {
        setLoading(false);
      }
    };

    if (qrId) {
      fetchPublicMedicalCard();
    }
  }, [qrId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border-2 border-black p-8 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="font-bold text-slate-800">Retrieving Emergency Medical Profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border-2 border-red-600 p-8 rounded-2xl shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] max-w-md w-full text-center space-y-4">
          <div className="bg-red-100 text-red-600 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-red-600 uppercase">Access Error</h2>
          <p className="font-semibold text-slate-700">{error || 'Medical card details could not be retrieved.'}</p>
          <div className="pt-2">
            <a 
              href="/"
              className="inline-block px-6 py-2.5 bg-black text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors"
            >
              Go to Home Page
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { patient_info, medical_info, emergency_info, ai_info, is_public } = data;

  return (
    <div className="min-h-screen bg-slate-50 text-black font-sans pb-16">
      {/* Header Banner */}
      <div className="bg-red-600 text-white py-4 px-6 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="animate-pulse" size={28} />
          <div>
            <h1 className="font-extrabold text-lg md:text-xl uppercase tracking-wider leading-none">
              AROGYAAI EMERGENCY HUB
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-100">
              Verified Medical Information
            </p>
          </div>
        </div>
        <div className="bg-white text-red-600 px-3 py-1 rounded-full font-bold text-xs uppercase shadow-sm">
          {is_public ? 'Public Access' : 'Restricted Access'}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
        
        {/* Alert Alert banner for emergency responders */}
        <div className="bg-red-50 border-2 border-red-600 p-5 rounded-2xl flex gap-4 items-start shadow-[2px_2px_0px_0px_rgba(220,38,38,1)]">
          <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="font-bold text-red-800 text-md uppercase">Responder Notice</h3>
            <p className="text-sm font-medium text-red-700 mt-1">
              This card contains medical profiles, care circle contacts, and the latest symptoms history of this patient. Proceed with care.
            </p>
          </div>
        </div>

        {/* 1. PATIENT INFORMATION */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-slate-100 pb-3 flex items-center gap-2 text-slate-800">
            <User className="text-blue-600" size={20} /> Patient Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</span>
              <span className="font-bold text-lg text-slate-800">{patient_info.name}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blood Group</span>
              <span className="font-extrabold text-lg text-red-600">{patient_info.blood_group}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age</span>
              <span className="font-bold text-lg text-slate-800">{patient_info.age}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</span>
              <span className="font-bold text-lg text-slate-800">{patient_info.gender}</span>
            </div>
          </div>
        </section>

        {/* 2. MEDICAL INFORMATION */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-slate-100 pb-3 flex items-center gap-2 text-slate-800">
            <Heart className="text-blue-600" size={20} /> Medical Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Known Allergies</span>
              {medical_info.allergies && medical_info.allergies.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 font-semibold text-slate-700">
                  {medical_info.allergies.map((allergy, i) => (
                    <li key={i}>{allergy}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 text-sm font-semibold">No known allergies.</span>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Medical Conditions</span>
              {medical_info.conditions && medical_info.conditions.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 font-semibold text-slate-700">
                  {medical_info.conditions.map((condition, i) => (
                    <li key={i}>{condition}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 text-sm font-semibold">No active chronic conditions.</span>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Medications</span>
              {medical_info.medications && medical_info.medications.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 font-semibold text-slate-700">
                  {medical_info.medications.map((med, i) => (
                    <li key={i} className={med === 'CONFIDENTIAL' ? 'text-slate-400 italic' : ''}>{med}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 text-sm font-semibold">No active medications logged.</span>
              )}
            </div>
          </div>
        </section>

        {/* 3. EMERGENCY INFORMATION */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-slate-100 pb-3 flex items-center gap-2 text-slate-800">
            <Phone className="text-blue-600" size={20} /> Emergency Information
          </h2>
          <div className="space-y-6">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Emergency Primary Contact</span>
              <a 
                href={`tel:${emergency_info.emergency_contact}`}
                className="inline-flex items-center gap-2 font-bold text-lg text-blue-600 hover:underline bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl"
              >
                <Phone size={18} /> {emergency_info.emergency_contact}
              </a>
            </div>
            
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Care Circle Contacts</span>
              {emergency_info.care_circle && emergency_info.care_circle.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {emergency_info.care_circle.map((member, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 flex justify-between items-center bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-800 block">{member.name}</span>
                        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{member.relation}</span>
                      </div>
                      {member.phone && (
                        <a 
                          href={`tel:${member.phone}`}
                          className="bg-white border border-slate-300 p-2.5 rounded-full hover:bg-slate-100 transition-colors text-blue-600"
                        >
                          <Phone size={18} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm font-semibold">No Care Circle contacts connected.</p>
              )}
            </div>
          </div>
        </section>

        {/* 4. AI INFORMATION */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-slate-100 pb-3 flex items-center gap-2 text-slate-800">
            <Brain className="text-blue-600" size={20} /> AI Triage Assessment
          </h2>
          {ai_info ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-6 items-center">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Latest Risk Level</span>
                  <span className={`inline-block px-4 py-1.5 rounded-full font-bold text-xs uppercase ${
                    ai_info.risk_level === 'HIGH' || ai_info.risk_level === 'CRITICAL'
                      ? 'bg-red-100 text-red-600 border border-red-200' 
                      : ai_info.risk_level === 'MEDIUM' 
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        : 'bg-green-100 text-green-700 border border-green-200'
                  }`}>
                    {ai_info.risk_level}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Triage Score</span>
                  <span className="font-extrabold text-lg text-slate-800">
                    {ai_info.triage_score === 'CONFIDENTIAL' ? (
                      <span className="text-slate-400 italic text-sm">CONFIDENTIAL</span>
                    ) : (
                      `${ai_info.triage_score} / 100`
                    )}
                  </span>
                </div>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Latest Triage AI Summary</span>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 font-semibold text-slate-700 leading-relaxed">
                  {ai_info.ai_summary === 'CONFIDENTIAL' ? (
                    <span className="text-slate-400 italic">Restricted under Private Access policy.</span>
                  ) : (
                    ai_info.ai_summary
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500 font-semibold text-sm">
              No recent AI Triage assessments recorded for this profile.
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default MedicalCardPage;
