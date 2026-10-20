import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import API_URL from '../config/api';
import { 
  Calendar, Clock, CheckCircle2, Copy, Check, 
  Send, MessageCircle, Sparkles,
  Server, Settings, Users,
  FolderKanban, ArrowRight, Video,
  Key, ShieldCheck, Pencil, Trash2, X, Save,
  Phone, User, Mail, Building, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BookingWidget from '../components/BookingWidget';
import AppointmentMobileWhatsAppModal from '../components/AppointmentMobileWhatsAppModal';
import { confirmDialog } from '../components/AppConfirmModal';

const Appointments = () => {
  const { user } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scheduler' | 'appointments' | 'pipeline'>('scheduler');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedAppointmentForModal, setSelectedAppointmentForModal] = useState<any | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [calendarStatus, setCalendarStatus] = useState<any>(null);

  // Edit Booking Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const apiBase = API_URL;
  const publicBookingUrl = typeof window !== 'undefined' ? `${window.location.origin}/appointments` : '/appointments';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3600);
  };

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/leads`, {
          headers: { 
            userid: user?._id || '',
            useremail: user?.email || ''
          }
        });
        let rawLeads = Array.isArray(res.data) ? res.data : [];
        if (rawLeads.length === 0) {
          try {
            const raw = (user?.email && localStorage.getItem(`strovr_leads_cache_${user.email}`)) ||
                        (user?._id && localStorage.getItem(`strovr_leads_cache_${user._id}`));
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) rawLeads = parsed;
            }
          } catch {}
        }
        setLeads(rawLeads);
      } catch {
        setLeads([]);
      }
    };

    const fetchCalendarStatus = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/booking/status`, {
          headers: { userid: user?._id }
        });
        setCalendarStatus(res.data);
      } catch {
        setCalendarStatus({ isConnected: false });
      }
    };

    const fetchAppointments = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/booking/appointments`, {
          headers: { userid: user?._id }
        });
        setAppointmentsList(res.data || []);
      } catch {
        setAppointmentsList([]);
      }
    };

    if (user) {
      fetchLeads();
      fetchCalendarStatus();
      fetchAppointments();
    }
  }, [user?._id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    setCopiedLink(true);
    showToast('Copied Google Calendar booking link to clipboard');
    setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleSendWhatsAppInvite = (lead: any) => {
    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const message = `Hi ${lead.firstName || lead.businessName}! Let's lock in a brief walkthrough for ${lead.businessName}. You can pick any open Google Calendar slot right here: ${publicBookingUrl}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleOpenEditModal = (app: any) => {
    setEditingBooking({
      ...app,
      serviceName: app.serviceName || app.title || '30-Min Strategy Consultation',
      customerName: app.customerName || app.businessName || '',
      businessName: app.businessName || app.customerName || '',
      customerEmail: app.customerEmail || '',
      customerPhone: app.customerPhone || '',
      appointmentDate: app.appointmentDate ? app.appointmentDate.split('T')[0] : new Date().toISOString().split('T')[0],
      timeSlot: app.timeSlot || '10:00 AM',
      notes: app.notes || '',
      status: app.status || 'Confirmed',
      meetLink: app.meetLink || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking?.id) return;
    setIsSavingEdit(true);

    try {
      const res = await axios.put(`${apiBase}/api/booking/appointments/${editingBooking.id}`, editingBooking, {
        headers: { userid: user?._id }
      });

      if (res.data?.success) {
        showToast('Appointment booking updated successfully!');
        setAppointmentsList(prev => prev.map(a => a.id === editingBooking.id ? { ...a, ...res.data.appointment } : a));
        setIsEditModalOpen(false);
        setEditingBooking(null);
      }
    } catch (err: any) {
      console.error('Failed to update booking:', err);
      showToast(err.response?.data?.error || 'Failed to update booking');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteBooking = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Confirmed Booking?',
      message: `Are you sure you want to permanently delete the confirmed booking with "${name}"? This will cancel the session and remove it from your calendar records.`,
      confirmText: 'Delete Booking',
      cancelText: 'Keep Booking',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      await axios.delete(`${apiBase}/api/booking/appointments/${id}`, {
        headers: { userid: user?._id }
      });
      setAppointmentsList(prev => prev.filter(a => a.id !== id));
      showToast('Confirmed booking deleted successfully');
    } catch (err: any) {
      console.error('Failed to delete booking:', err);
      showToast('Failed to delete booking');
    }
  };

  const pipelineProspects = leads.slice(0, 12);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-transparent font-sans text-slate-900">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <Header title="Strovr Calendar &amp; Appointments Hub" />

        <main className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 custom-scrollbar overscroll-y-contain">
          <div className="max-w-[1360px] mx-auto space-y-6 pb-28">
          
          {toastMessage && (
            <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-xl border border-slate-800 text-xs font-delight font-medium flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Top Stage Bar / KPI Progression Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Calendar Engine</span>
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-base font-bold text-slate-900">Strovr Calendar</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {calendarStatus?.syncMode === 'google_schedule' 
                    ? 'Google Schedule Linked' 
                    : 'Strovr Active (Zero-Setup)'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Video Conferencing</span>
                <Video className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-bold text-slate-900">Google Meet</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Automated Room Links</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Pipeline Integration</span>
                <FolderKanban className="w-4 h-4 text-[#C85A32]" />
              </div>
              <div className="text-base font-bold text-slate-900">{pipelineProspects.length} CRM Prospects</div>
              <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Auto-advances to Demo</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Confirmed Sessions</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-slate-900">{appointmentsList.length} Bookings</span>
                <button
                  onClick={handleCopyLink}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1 bg-[#FAF8F5] border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('scheduler')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'scheduler'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Live Scheduler</span>
              </button>

              <button
                onClick={() => setActiveTab('appointments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'appointments'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Confirmed Bookings ({appointmentsList.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'pipeline'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>CRM Lead Invites</span>
              </button>
            </div>
          </div>

          {/* TAB 1: LIVE SCHEDULER VIEW */}
          {activeTab === 'scheduler' && (
            <BookingWidget />
          )}

          {/* TAB 2: CONFIRMED BOOKINGS LIST */}
          {activeTab === 'appointments' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-[#FAF8F5] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight">Confirmed Strovr Calendar Sessions</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real meetings scheduled with prospects and synchronized to your calendar. Click any session to preview and send via WhatsApp in Mobile View.
                  </p>
                </div>
              </div>

              {appointmentsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No appointments booked yet. Open the Live Scheduler to create your first session.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Attendee &amp; Company</th>
                        <th className="py-2.5 px-4">Contact</th>
                        <th className="py-2.5 px-4">Session Date &amp; Slot</th>
                        <th className="py-2.5 px-4">Meeting Room</th>
                        <th className="py-2.5 px-4 text-center">WhatsApp Mobile View</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {appointmentsList.map((app, idx) => (
                        <tr 
                          key={app.id || idx} 
                          onClick={() => {
                            setSelectedAppointmentForModal(app);
                            setShowWhatsAppModal(true);
                          }}
                          className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {app.customerName || app.businessName}
                            <div className="text-[10px] text-slate-400 font-normal">{app.businessName}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                            <div>{app.customerEmail}</div>
                            {app.customerPhone && <div className="text-slate-400 text-[10px]">{app.customerPhone}</div>}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <span className="font-bold">{app.timeSlot || 'Scheduled'}</span>
                            <div className="text-[10px] text-slate-400">{new Date(app.appointmentDate).toLocaleDateString()}</div>
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {app.meetLink ? (
                              <a
                                href={app.meetLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition-colors"
                              >
                                <Video className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Join Google Meet</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Scheduled Event</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAppointmentForModal(app);
                                setShowWhatsAppModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer group-hover:scale-105"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Send WhatsApp</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              app.status === 'Completed'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : app.status === 'Cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : app.status === 'Rescheduled'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {app.status || 'Confirmed'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(app)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                                title="Edit Booking Details"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBooking(app.id, app.customerName || app.businessName)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                                title="Delete Booking"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PIPELINE CRM LEAD DISPATCH */}
          {activeTab === 'pipeline' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-[#FAF8F5] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight">Active Pipeline Lead Dispatch</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1-Click invite prospects to book a Strovr Calendar session. Confirmed bookings automatically advance stage to Demo.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/crm')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Open CRM Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Deal / Business</th>
                      <th className="py-2.5 px-4">Contact Detail</th>
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4">Current Stage</th>
                      <th className="py-2.5 px-4 text-right">Instant Booking Dispatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pipelineProspects.map((lead, i) => (
                      <tr key={lead._id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {lead.businessName}
                          <div className="text-[10px] text-slate-400 font-normal">{lead.category || 'Direct Account'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                          {lead.phone || lead.email || 'Contact on request'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{lead.location || 'Local'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {lead.status || 'Lead'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {lead.phone && (
                              <button
                                onClick={() => {
                                  setSelectedAppointmentForModal({
                                    customerName: lead.firstName || lead.businessName,
                                    customerEmail: lead.email,
                                    customerPhone: lead.phone,
                                    businessName: lead.businessName,
                                    appointmentDate: new Date(Date.now() + 86400000).toISOString(),
                                    timeSlot: '11:00 AM',
                                    serviceName: '15-Min Strovr Walkthrough',
                                    meetLink: 'https://meet.google.com/new',
                                    notes: `Strovr walkthrough invitation for ${lead.businessName}`
                                  });
                                  setShowWhatsAppModal(true);
                                }}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Send booking link via WhatsApp in Mobile View"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>WhatsApp Invite</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                handleCopyLink();
                                showToast(`Copied booking link for ${lead.businessName}`);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copy Link</span>
                            </button>

                            <button
                              onClick={() => navigate('/outreach')}
                              className="px-2.5 py-1 bg-[#C85A32] hover:bg-[#B04B25] text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Send Email Template"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Email Template</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          </div>
        </main>
      </div>

      {/* Mobile-View WhatsApp Confirmation Modal */}
      <AppointmentMobileWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false);
          setSelectedAppointmentForModal(null);
        }}
        appointment={selectedAppointmentForModal}
        user={user}
      />

      {/* Edit Booking Modal */}
      {isEditModalOpen && editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Confirmed Booking</h3>
                  <p className="text-[11px] text-slate-400">Modify attendee details, session date, or meeting status.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingBooking(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEditBooking} className="p-6 overflow-y-auto space-y-4 custom-scrollbar text-xs">
              
              {/* Service Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-delight">
                  Service / Consultation Topic
                </label>
                <select
                  value={editingBooking.serviceName || '30-Min Strategy Consultation'}
                  onChange={(e) => setEditingBooking({ ...editingBooking, serviceName: e.target.value })}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="15-Min Strovr Walkthrough">15-Min Strovr Walkthrough</option>
                  <option value="30-Min Strategy Consultation">30-Min Strategy Consultation</option>
                  <option value="45-Min Technical Architecture Review">45-Min Technical Architecture Review</option>
                  <option value="20-Min Executive Discovery Call">20-Min Executive Discovery Call</option>
                  <option value="Product Demonstration">Product Demonstration</option>
                  <option value="Growth Strategy Call">Growth Strategy Call</option>
                </select>
              </div>

              {/* Attendee Name & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Attendee Name</label>
                  <input
                    type="text"
                    required
                    value={editingBooking.customerName || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, customerName: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder="Full Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Company / Business</label>
                  <input
                    type="text"
                    value={editingBooking.businessName || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, businessName: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder="Company Name"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editingBooking.customerEmail || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, customerEmail: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={editingBooking.customerPhone || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, customerPhone: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder="+91 98000 00000"
                  />
                </div>
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Session Date</label>
                  <input
                    type="date"
                    required
                    value={editingBooking.appointmentDate || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, appointmentDate: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Time Slot</label>
                  <input
                    type="text"
                    required
                    value={editingBooking.timeSlot || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, timeSlot: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 10:00 AM"
                  />
                </div>
              </div>

              {/* Status & Google Meet Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Booking Status</label>
                  <select
                    value={editingBooking.status || 'Confirmed'}
                    onChange={(e) => setEditingBooking({ ...editingBooking, status: e.target.value })}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Google Meet URL</label>
                  <input
                    type="url"
                    value={editingBooking.meetLink || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, meetLink: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Booking Notes</label>
                <textarea
                  rows={2}
                  value={editingBooking.notes || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, notes: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 leading-relaxed"
                  placeholder="Notes from consultation or prospect requirements..."
                />
              </div>

              {/* Modal Bottom Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = editingBooking.id;
                    const nameToDelete = editingBooking.customerName || editingBooking.businessName;
                    setIsEditModalOpen(false);
                    setEditingBooking(null);
                    handleDeleteBooking(idToDelete, nameToDelete);
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Booking</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingBooking(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
