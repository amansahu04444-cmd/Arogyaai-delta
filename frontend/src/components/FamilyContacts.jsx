import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, User, Loader2, Users, Copy, ExternalLink, Send } from 'lucide-react';
import api from '../services/api';
import CardWrapper from './CardWrapper';

const CareCircleCard = ({ isOpen, onClose }) => {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', relation: '' });
  const [lastAlert, setLastAlert] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
      fetchLastAlert();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/user/family');
      if (response.success) {
        setContacts(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLastAlert = async () => {
    try {
      const response = await api.get('/api/emergency/last');
      if (response.success) {
        setLastAlert(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch last emergency alert:', error);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      setIsAdding(true);
      const response = await api.post('/api/user/family', formData);
      if (response.success) {
        setContacts([response.data, ...contacts]);
        setFormData({ name: '', relation: '' });
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      const response = await api.delete(`/api/user/family/${id}`);
      if (response.success) {
        setContacts(contacts.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to remove contact:', error);
    }
  };

  return (
    <CardWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex-1 overflow-y-auto max-h-[80vh] md:max-h-[90vh] p-8 md:p-12 text-slate-900 flex flex-col md:flex-row gap-10 bg-slate-50 rounded-t-3xl md:rounded-3xl">
        
        {/* Left Section: Info and Add Form */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
             <span className="px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200 bg-white text-slate-900 shadow-sm">
               Trusted Network
             </span>
          </div>

          <h2 className="text-5xl font-extrabold uppercase tracking-tight mb-4 leading-none text-slate-900">
            Care Circle
          </h2>
          <p className="text-slate-500 font-semibold mb-10 text-lg max-w-sm">
            Manage your emergency contacts. They will be alerted instantly in a crisis.
          </p>

          <form onSubmit={handleAdd} className="flex flex-col gap-5 mb-8">
            <div className="relative">
              <User size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                placeholder="Full Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 placeholder-steel transition-all shadow-sm text-lg"
              />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Relation (e.g. Brother, Parent)"
                value={formData.relation}
                onChange={e => setFormData({ ...formData, relation: e.target.value })}
                className="w-full px-6 py-5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 placeholder-steel transition-all shadow-sm text-lg"
              />
            </div>
            <motion.button
              type="submit"
              disabled={isAdding}
              whileTap={{ scale: 0.98 }}
              className="mt-2 w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-slate-900 font-extrabold uppercase tracking-widest rounded-2xl py-5 transition-transform hover:scale-105 active:translate-y-1 active:shadow-none border border-slate-200 shadow-md disabled:opacity-50 text-sm cursor-pointer"
            >
              {isAdding ? (
                <><Loader2 size={18} className="animate-spin" /> Adding...</>
              ) : (
                <><User size={18} /> Add Contact</>
              )}
            </motion.button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="text-xs text-slate-900 font-bold uppercase tracking-wider leading-relaxed">
              💡 <span className="text-slate-500">Instruction:</span> Share the "Connect" link with new members. They must click it and press <b>/start</b> in Telegram to receive emergency alerts.
            </p>
          </div>

          {lastAlert && (
            <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left">
              <h4 className="text-sm font-black uppercase tracking-wider text-red-600 mb-3 flex items-center gap-2">
                <span>🚨</span> Last Emergency Alert
              </h4>
              <div className="space-y-2 text-xs font-bold text-slate-900 uppercase tracking-wide">
                <div>
                  <span className="text-slate-500">Time:</span> {new Date(lastAlert.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Sent To:</span>
                  {lastAlert.members && lastAlert.members.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-slate-900 lowercase">
                      {lastAlert.members.map((m, idx) => (
                        <li key={idx} className="capitalize">{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="normal-case text-red-600 block">No members connected at that time</span>
                  )}
                </div>
                {lastAlert.symptoms && (
                  <div className="pt-2 border-t border-black/10">
                    <span className="text-slate-500">Symptoms:</span>
                    <p className="normal-case text-slate-900/80 font-medium mt-1 leading-normal">
                      {lastAlert.symptoms}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Contacts List */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-8 relative overflow-y-auto shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-extrabold uppercase tracking-tight flex items-center gap-3 text-slate-900">
                <Users size={24} className="text-slate-900" /> Member List
              </h3>
              <button 
                onClick={async () => {
                  try {
                    const res = await api.post('/api/emergency/test');
                    alert(res.message || 'Test alert sent!');
                  } catch (err) {
                    alert(err.message || 'Failed to send test alert');
                  }
                }}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all text-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <Send size={12} className="inline mr-1.5 -mt-0.5" />
                Test Alert
              </button>
           </div>

           {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
               <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                 <Users size={32} className="text-slate-500" />
               </div>
               <p className="text-slate-900 font-bold text-lg">No members added yet.</p>
               <p className="text-slate-500 text-sm mt-2 max-w-xs">Add trusted contacts to your care circle to keep them informed.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {contacts.map(contact => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-5 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-md hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-extrabold uppercase text-2xl shadow-sm">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xl leading-tight text-slate-900">{contact.name}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-slate-900 text-[10px] font-bold uppercase tracking-widest border border-slate-200 px-3 py-1 rounded-full bg-white shadow-sm">
                            {contact.relation || 'Family'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleRemove(contact.id)}
                      className="p-3 text-slate-500 hover:text-white hover:bg-red-500 rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer shadow-none hover:shadow-sm"
                    >
                      <Trash2 size={20} />
                    </motion.button>
                  </div>
                  
                  {/* Status & Actions Footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                    {contact.telegram_chat_id ? (
                      <span className="text-green-700 text-[10px] font-bold uppercase tracking-widest bg-slate-50 border border-green-300 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Telegram Linked
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 w-full">
                        <span className="text-amber-spark text-[10px] font-bold uppercase tracking-widest px-1 mr-auto flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-amber-spark animate-pulse" />
                           Pending Link
                        </span>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              const BOT_USERNAME = "arogyaai_emergency_bot";
                              const link = `https://t.me/${BOT_USERNAME}?start=${contact.id}`;
                              navigator.clipboard.writeText(link);
                              alert('Invite link copied!');
                            }}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Copy size={12} /> Copy
                          </button>
                          <a
                            href={`https://t.me/arogyaai_emergency_bot?start=${contact.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-slate-200 shadow-sm flex items-center justify-center gap-2"
                          >
                            <ExternalLink size={12} /> Connect
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CardWrapper>
  );
};

export default CareCircleCard;
