import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, User, Phone, Plus, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../services/api';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({
    doctorId: '',
    date: '',
    time: '',
    reason: ''
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getAppointments();
      if (response.success && response.data) {
        setAppointments(response.data.appointments || []);
      } else {
        setAppointments(mockAppointments);
      }
    } catch (err) {
      setError('Failed to load appointments');
      setAppointments(mockAppointments);
    } finally {
      setIsLoading(false);
    }
  };

  const mockAppointments = [
    {
      id: 'apt1',
      doctorId: 'dr001',
      doctorName: 'Dr. Priya Sharma',
      doctorSpecialty: 'Cardiologist',
      date: '2026-05-02',
      time: '10:00 AM',
      reason: 'Follow-up consultation',
      status: 'CONFIRMED',
      location: 'Apollo Hospital, Delhi',
      phone: '+91 98765 43210'
    },
    {
      id: 'apt2',
      doctorId: 'dr002',
      doctorName: 'Dr. Rajesh Kumar',
      doctorSpecialty: 'General Physician',
      date: '2026-05-05',
      time: '2:30 PM',
      reason: 'New symptoms discussion',
      status: 'PENDING',
      location: 'Max Healthcare, Saket',
      phone: '+91 98765 43211'
    },
    {
      id: 'apt3',
      doctorId: 'dr003',
      doctorName: 'Dr. Anita Desai',
      doctorSpecialty: 'Neurologist',
      date: '2026-04-28',
      time: '11:00 AM',
      reason: 'Headache assessment',
      status: 'COMPLETED',
      location: 'Medanta, Gurgaon',
      phone: '+91 98765 43212'
    }
  ];

  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setError(null);

    try {
      const response = await api.createAppointment(bookingData);
      if (response.success) {
        setBookingSuccess(true);
        setTimeout(() => {
          setShowBookingModal(false);
          setBookingSuccess(false);
          setBookingData({ doctorId: '', date: '', time: '', reason: '' });
          fetchAppointments();
        }, 2000);
      } else {
        throw new Error('Booking failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      const response = await api.cancelAppointment(appointmentId, 'User requested cancellation');
      if (response.success) {
        setAppointments(prev => prev.map(apt =>
          apt.id === appointmentId ? { ...apt, status: 'CANCELLED' } : apt
        ));
      }
    } catch (err) {
      setError('Failed to cancel appointment');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-50 text-green-600 border-green-200';
      case 'PENDING': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'COMPLETED': return 'bg-mint-wash text-green-700 border-green-200';
      case 'CANCELLED': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-fog text-steel border-carbon-black/20';
    }
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
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-carbon-black/10 pb-10">
          <div>
            <div className="flex items-center gap-3 text-carbon-black font-bold uppercase tracking-widest text-xs mb-4">
              <Calendar size={16} /> Scheduling
            </div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-none mb-4 text-carbon-black">
              My<br />Appointments
            </h1>
            <p className="text-steel font-bold text-lg max-w-xl">
              Manage your upcoming and past medical appointments.
            </p>
          </div>

          <motion.button
            onClick={() => setShowBookingModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-lime-pulse text-carbon-black rounded-2xl font-bold uppercase tracking-widest text-xs shadow-brutal border border-carbon-black flex items-center gap-3 hover:shadow-brutal-dark transition-all"
          >
            <Plus size={20} /> Book New
          </motion.button>
        </motion.div>

        {/* Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 shadow-brutal-sm"
          >
            <AlertCircle size={20} className="text-orange-600" />
            <span className="text-orange-600 font-bold text-sm">{error}</span>
          </motion.div>
        )}

        {/* Appointments List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-lime-pulse border-t-carbon-black rounded-full animate-spin shadow-brutal-sm" />
          </div>
        ) : appointments.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center justify-center py-20 text-center space-y-6"
          >
            <div className="w-24 h-24 bg-white rounded-[20px] border border-carbon-black flex items-center justify-center shadow-brutal-sm">
              <Calendar size={48} className="text-steel" />
            </div>
            <div>
              <h3 className="text-3xl font-bold uppercase tracking-tight mb-2 text-carbon-black">No Appointments</h3>
              <p className="text-steel font-bold max-w-md mx-auto">
                You don't have any scheduled appointments. Book one now to consult with a specialist.
              </p>
            </div>
            <motion.button
              onClick={() => setShowBookingModal(true)}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-5 bg-lime-pulse text-carbon-black border border-carbon-black rounded-2xl font-bold uppercase tracking-widest shadow-brutal hover:shadow-brutal-dark hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all"
            >
              Book Appointment
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {appointments.map((appointment, index) => {
              const statusClass = getStatusColor(appointment.status);
              return (
                <motion.div
                  key={appointment.id || index}
                  variants={itemVariants}
                  whileHover={{ y: -4 }}
                  className={`rounded-[20px] p-8 bg-white border border-carbon-black shadow-brutal transition-shadow hover:shadow-brutal-dark`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Date Box */}
                    <div className="w-24 h-24 bg-sky-wash rounded-[20px] flex flex-col items-center justify-center border border-carbon-black shadow-brutal-sm">
                      <span className="text-3xl font-bold text-carbon-black leading-none mb-1">{new Date(appointment.date).getDate()}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-carbon-black">
                        {new Date(appointment.date).toLocaleString('en', { month: 'short' })}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 w-full">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-xl font-bold uppercase tracking-tight text-carbon-black leading-none mb-2">{appointment.doctorName}</h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-steel bg-fog border border-carbon-black/10 px-2 py-1 rounded-md inline-block">{appointment.doctorSpecialty}</p>
                        </div>
                        <span
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${statusClass}`}
                        >
                          {appointment.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-steel">
                        <span className="flex items-center gap-2 text-carbon-black">
                          <Clock size={14} className="text-carbon-black" /> {appointment.time}
                        </span>
                        <span className="flex items-center gap-2 text-carbon-black">
                          <MapPin size={14} className="text-carbon-black" /> {appointment.location}
                        </span>
                      </div>

                      {appointment.reason && (
                        <p className="mt-4 text-xs font-bold text-steel bg-fog p-3 rounded-xl border border-carbon-black/10">
                          <span className="text-carbon-black">Reason:</span> {appointment.reason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-4 md:mt-0 w-full md:w-auto">
                      {appointment.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCancel(appointment.id)}
                          className="flex-1 md:flex-none px-6 py-4 bg-white border border-carbon-black rounded-[14px] font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-colors shadow-brutal-sm"
                        >
                          Cancel
                        </button>
                      )}
                      <button className="w-12 h-12 shrink-0 bg-lime-pulse rounded-[14px] flex items-center justify-center border border-carbon-black hover:bg-[#97d82f] transition-colors shadow-brutal-sm">
                        <Phone size={18} className="text-carbon-black" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </motion.main>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
            onClick={() => !bookingLoading && setShowBookingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-white border border-carbon-black rounded-[20px] p-8 md:p-10 shadow-brutal-dark relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold uppercase tracking-tight text-carbon-black">Book Appointment</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  disabled={bookingLoading}
                  className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white border border-carbon-black shadow-brutal flex items-center justify-center text-carbon-black hover:bg-fog transition-colors z-[400] disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {bookingSuccess ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-10"
                >
                  <div className="w-20 h-20 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-brutal-sm">
                    <CheckCircle size={48} className="text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold uppercase tracking-tight mb-2 text-carbon-black">Booking Confirmed!</h4>
                  <p className="text-steel font-bold">You will receive a confirmation shortly.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleBooking} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-steel mb-3">
                      Doctor
                    </label>
                    <select
                      value={bookingData.doctorId}
                      onChange={e => setBookingData(prev => ({ ...prev, doctorId: e.target.value }))}
                      required
                      className="w-full p-5 bg-white border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black text-sm transition-shadow appearance-none"
                    >
                      <option value="">Select a doctor</option>
                      <option value="dr001">Dr. Priya Sharma - Cardiologist</option>
                      <option value="dr002">Dr. Rajesh Kumar - General Physician</option>
                      <option value="dr003">Dr. Anita Desai - Neurologist</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-steel mb-3">
                        Date
                      </label>
                      <input
                        type="date"
                        value={bookingData.date}
                        onChange={e => setBookingData(prev => ({ ...prev, date: e.target.value }))}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-5 bg-white border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black text-sm transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-steel mb-3">
                        Time
                      </label>
                      <input
                        type="time"
                        value={bookingData.time}
                        onChange={e => setBookingData(prev => ({ ...prev, time: e.target.value }))}
                        required
                        className="w-full p-5 bg-white border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black text-sm transition-shadow"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-steel mb-3">
                      Reason (Optional)
                    </label>
                    <textarea
                      value={bookingData.reason}
                      onChange={e => setBookingData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Brief description of your concern"
                      className="w-full p-5 bg-white border border-carbon-black rounded-xl focus:outline-none focus:shadow-brutal font-bold text-carbon-black text-sm transition-shadow resize-none"
                      rows={3}
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={bookingLoading}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-5 bg-lime-pulse text-carbon-black border border-carbon-black rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-brutal hover:shadow-brutal-dark hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4"
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Booking...
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Appointments;