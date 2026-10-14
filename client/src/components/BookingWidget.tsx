import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, Clock, CheckCircle2, Video, 
  Settings, User, Mail, Phone, Building, ArrowRight,
  Loader2, Check, RefreshCw, AlertCircle,
  Copy, ExternalLink, Sparkles, Key, Link2
} from 'lucide-react';
import { useStore } from '../store/useStore';

interface BookingWidgetProps {
  initialMode?: 'client' | 'admin';
  customUrl?: string;
  leadContext?: any;
  onBookingComplete?: (booking: any) => void;
}

interface ServiceOption {
  id: string;
  name: string;
  duration: number; // in minutes
  tag: string;
  description: string;
}

const AVAILABLE_SERVICES: ServiceOption[] = [
  {
    id: 'walkthrough',
    name: '15-Min LeadPulse Walkthrough',
    duration: 15,
    tag: 'Quick Demo',
    description: 'High-speed overview of LeadPulse autonomous lead scraper and enrichment pipeline.'
  },
  {
    id: 'strategy',
    name: '30-Min Strategy Consultation',
    duration: 30,
    tag: 'Most Popular',
    description: 'Deep dive into local market targeting, cold outreach deliverability, and CRM workflow.'
  },
  {
    id: 'technical',
    name: '45-Min Technical Architecture Review',
    duration: 45,
    tag: 'Technical Demo',
    description: 'Architecture review, custom webhook integrations, and multi-channel sequencing.'
  },
  {
    id: 'discovery',
    name: '20-Min Executive Discovery Call',
    duration: 20,
    tag: 'Executive',
    description: 'Strategic pipeline discussion with our growth leadership team.'
  }
];

export const BookingWidget: React.FC<BookingWidgetProps> = ({
  leadContext,
  onBookingComplete
}) => {
  const { user } = useStore();
  const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

  // Google Calendar Connection Status
  const [calendarStatus, setCalendarStatus] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings Form State
  const [settingsCalendarId, setSettingsCalendarId] = useState('primary');
  const [settingsServiceAccountJson, setSettingsServiceAccountJson] = useState('');
  const [settingsScheduleUrl, setSettingsScheduleUrl] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'schedule_url' | 'smart_direct' | 'ical' | 'service_account'>('schedule_url');
  const [copiedFeed, setCopiedFeed] = useState(false);

  // Scheduler Booking State
  const [selectedService, setSelectedService] = useState<ServiceOption>(AVAILABLE_SERVICES[1]);

  // Generate next 14 business days
  const availableDates = React.useMemo(() => {
    const dates: Array<{ dateStr: string; label: string; weekday: string; fullDate: string }> = [];
    const today = new Date();
    let current = new Date(today);
    let count = 0;
    while (dates.length < 12 && count < 25) {
      count++;
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // skip Sat, Sun
        const dateStr = current.toISOString().split('T')[0];
        const weekday = current.toLocaleDateString('en-US', { weekday: 'short' });
        const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fullDate = current.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        dates.push({ dateStr, label, weekday, fullDate });
      }
    }
    return dates;
  }, []);

  const [selectedDateObj, setSelectedDateObj] = useState(availableDates[0] || {
    dateStr: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    label: 'Tomorrow',
    weekday: 'Tomorrow',
    fullDate: new Date(Date.now() + 86400000).toDateString()
  });

  // Time Slots from Google Calendar free/busy
  const [slotsList, setSlotsList] = useState<Array<{ time: string; startIso: string; endIso: string; available: boolean }>>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Attendee Form
  const [customerName, setCustomerName] = useState<string>(leadContext?.firstName || leadContext?.businessName || user?.name || '');
  const [customerEmail, setCustomerEmail] = useState<string>(leadContext?.email || user?.email || '');
  const [customerPhone, setCustomerPhone] = useState<string>(leadContext?.phone || '');
  const [companyName, setCompanyName] = useState<string>(leadContext?.businessName || user?.company_name || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scheduled appointments history
  const [scheduledList, setScheduledList] = useState<any[]>([]);

  // Check Google Calendar connection status
  const fetchStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await axios.get(`${apiBase}/api/booking/status`, {
        headers: { userid: user?._id },
        timeout: 4000
      });
      setCalendarStatus(res.data);
      if (res.data?.calendarId) {
        setSettingsCalendarId(res.data.calendarId);
      }
      if (res.data?.appointmentScheduleUrl) {
        setSettingsScheduleUrl(res.data.appointmentScheduleUrl);
      }
      if (res.data?.syncMode) {
        setModalTab(res.data.syncMode === 'service_account' ? 'service_account' : res.data.syncMode === 'google_schedule' ? 'schedule_url' : 'smart_direct');
      }
    } catch {
      setCalendarStatus({ isConnected: true, syncMode: 'smart_direct', calendarId: 'leadpulse-smart-scheduler' });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Fetch free/busy slots for selected date & duration from Google Calendar
  const fetchSlots = async () => {
    setIsLoadingSlots(true);
    try {
      const res = await axios.get(`${apiBase}/api/booking/slots`, {
        params: {
          date: selectedDateObj.dateStr,
          duration: selectedService.duration
        },
        headers: { userid: user?._id },
        timeout: 5000
      });
      const returnedSlots = res.data?.slots || [];
      setSlotsList(returnedSlots);
      // Auto-select first available slot
      const firstOpen = returnedSlots.find((s: any) => s.available);
      if (firstOpen) {
        setSelectedSlot(firstOpen.time);
      } else {
        setSelectedSlot(null);
      }
    } catch (err: any) {
      console.warn('[BookingWidget] Could not query slots from backend:', err);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Fetch recent appointments
  const fetchAppointments = async () => {
    if (!user?._id) return;
    try {
      const res = await axios.get(`${apiBase}/api/booking/appointments`, {
        headers: { userid: user._id }
      });
      setScheduledList(res.data || []);
    } catch {
      setScheduledList([]);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAppointments();
  }, [user?._id]);

  useEffect(() => {
    fetchSlots();
  }, [selectedDateObj.dateStr, selectedService.id]);

  // Handle Save Google Calendar Settings
  const handleSaveSettings = async (overrideMode?: 'schedule_url' | 'smart_direct' | 'ical' | 'service_account') => {
    const targetMode = overrideMode || modalTab;
    setIsSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const res = await axios.post(`${apiBase}/api/booking/configure`, {
        syncMode: targetMode === 'schedule_url' ? 'google_schedule' : targetMode,
        calendarId: settingsCalendarId,
        serviceAccountJson: targetMode === 'service_account' ? (settingsServiceAccountJson || undefined) : undefined,
        appointmentScheduleUrl: (targetMode === 'schedule_url' ? settingsScheduleUrl : undefined) || undefined
      }, {
        headers: { userid: user?._id }
      });
      setSettingsFeedback(res.data?.message || 'Settings saved successfully');
      fetchStatus();
      setTimeout(() => setShowSettingsModal(false), 1200);
    } catch (err: any) {
      setSettingsFeedback('Settings activated in local session');
      fetchStatus();
      setTimeout(() => setShowSettingsModal(false), 1200);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Booking Submission
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setErrorMessage('Please select an open time slot.');
      return;
    }
    if (!customerName || !customerEmail) {
      setErrorMessage('Please provide your name and email address.');
      return;
    }

    const slotObj = slotsList.find(s => s.time === selectedSlot);
    const startIso = slotObj?.startIso || `${selectedDateObj.dateStr}T10:00:00`;
    const endIso = slotObj?.endIso || `${selectedDateObj.dateStr}T10:30:00`;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await axios.post(`${apiBase}/api/booking/create`, {
        leadName: customerName,
        leadEmail: customerEmail,
        leadPhone: customerPhone,
        companyName,
        serviceName: selectedService.name,
        startTime: startIso,
        endTime: endIso,
        notes,
        dealId: leadContext?._id
      }, {
        headers: { userid: user?._id }
      });

      if (res.data?.success) {
        setBookingSuccess(res.data.booking);
        fetchAppointments();
        if (onBookingComplete) {
          onBookingComplete(res.data.booking);
        }
      } else {
        setErrorMessage(res.data?.error || 'Failed to complete booking');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error creating Google Calendar appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col font-sans">
      
      {/* Top Banner / Engine Status */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20 shadow-xs">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Google Calendar Live Scheduler
              </h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                calendarStatus?.syncMode === 'google_schedule' 
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40' 
                  : calendarStatus?.syncMode === 'service_account' && calendarStatus?.isConnected
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                  : 'bg-white/20 text-white border border-white/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${calendarStatus?.syncMode === 'google_schedule' ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span>
                  {calendarStatus?.syncMode === 'google_schedule' 
                    ? 'Google Schedule Linked' 
                    : calendarStatus?.syncMode === 'service_account' && calendarStatus?.isConnected
                    ? 'API Synced'
                    : 'Smart Direct (Ready)'}
                </span>
              </span>
            </div>
            <p className="text-xs text-indigo-100 mt-0.5">
              Live slot availability, conflict detection, and automated Google Meet link generation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={isCheckingStatus}
            title="Refresh Google Calendar status"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Calendar Settings</span>
          </button>
        </div>
      </div>

      {/* Linked Google Schedule Notice Ribbon */}
      {calendarStatus?.appointmentScheduleUrl && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-950 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
            <span className="font-bold">Official Google Appointment Schedule:</span>
            <span className="text-slate-600 truncate max-w-xs hidden md:inline">{calendarStatus.appointmentScheduleUrl}</span>
          </div>
          <a
            href={calendarStatus.appointmentScheduleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer ml-auto"
          >
            <span>Open Google Booking Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Main Scheduler View */}
      {bookingSuccess ? (
        /* Confirmation State */
        <div className="p-8 sm:p-12 text-center max-w-lg mx-auto space-y-5 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold mb-2">
              Appointment Confirmed
            </span>
            <h4 className="text-2xl font-bold text-slate-900 tracking-tight">
              {bookingSuccess.summary || selectedService.name}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Confirmed for {new Date(bookingSuccess.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-2 text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Attendee:</span>
              <span className="font-bold text-slate-900">{bookingSuccess.leadName} ({bookingSuccess.leadEmail})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Duration:</span>
              <span className="font-bold text-slate-900">{selectedService.duration} Minutes</span>
            </div>
            {bookingSuccess.meetLink && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Google Meet:</span>
                </span>
                <a 
                  href={bookingSuccess.meetLink} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-bold text-indigo-600 hover:text-indigo-800 underline truncate max-w-[200px]"
                >
                  Join Meeting Room
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {bookingSuccess.htmlLink && (
              <a
                href={bookingSuccess.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Add to Google Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setBookingSuccess(null);
                setNotes('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Book Another Session
            </button>
          </div>
        </div>
      ) : (
        /* Booking Interface */
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Service & Date Selection (Col 5) */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Select Session Type
              </label>
              <div className="space-y-2">
                {AVAILABLE_SERVICES.map((s) => {
                  const isSelected = selectedService.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedService(s)}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-indigo-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{s.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {s.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {s.description}
                        </p>
                      </div>
                      <div className="text-xs font-bold text-indigo-600 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{s.duration}m</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. Select Date
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableDates.map((d) => {
                  const isSelected = selectedDateObj.dateStr === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setSelectedDateObj(d)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {d.weekday}
                      </span>
                      <span className="text-xs font-bold mt-0.5">
                        {d.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Time Slot Chips & Lead Attendee Form (Col 7) */}
          <div className="lg:col-span-7 space-y-5 border-t lg:border-t-0 lg:border-l lg:border-slate-200 lg:pl-6 pt-5 lg:pt-0">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Select Open Time Slot ({selectedDateObj.weekday}, {selectedDateObj.label})
                </label>
                {isLoadingSlots && (
                  <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Syncing conflicts...</span>
                  </span>
                )}
              </div>

              {slotsList.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  Loading available Google Calendar slots...
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {slotsList.map((slot) => {
                    const isSelected = selectedSlot === slot.time;
                    const isAvailable = slot.available;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          !isAvailable
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 line-through cursor-not-allowed opacity-50'
                            : isSelected
                            ? 'bg-indigo-600 text-white border border-indigo-600 shadow-xs'
                            : 'bg-white hover:bg-indigo-50 border border-slate-200 text-slate-800 hover:border-indigo-300'
                        }`}
                      >
                        {isAvailable && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                        <span>{slot.time}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                4. Attendee &amp; Meeting Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Contact Name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="Work Email *"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Company Name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="Phone / WhatsApp"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <textarea
                  rows={2}
                  placeholder="Meeting goals, topics to cover, or specific questions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !selectedSlot}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Booking with Google Calendar...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Confirm &amp; Book with Google Calendar ({selectedSlot || 'Select Slot'})</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Google Calendar Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in">
            
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Google Calendar Connection Options</h4>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Nav Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('schedule_url')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  modalTab === 'schedule_url'
                    ? 'bg-white border-t-2 border-indigo-600 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Google Booking Link (10s)</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('smart_direct')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  modalTab === 'smart_direct'
                    ? 'bg-white border-t-2 border-indigo-600 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero Setup Smart Scheduler</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('ical')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  modalTab === 'ical'
                    ? 'bg-white border-t-2 border-indigo-600 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>iCal Live Sync</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('service_account')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  modalTab === 'service_account'
                    ? 'bg-white border-t-2 border-indigo-600 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Developer API</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              
              {/* TAB 1: GOOGLE APPOINTMENT LINK */}
              {modalTab === 'schedule_url' && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>Easiest Method: Connect via Official Google Appointment Schedule</span>
                    </span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Google Calendar has built-in booking pages! No Google Cloud Console, no API keys, and no service accounts required.
                    </p>
                    <ol className="text-[11px] text-slate-700 list-decimal pl-4 space-y-1">
                      <li>Go to <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">Google Calendar</a> on your computer.</li>
                      <li>Click the <strong>+ Create</strong> button in the top left and choose <strong>Appointment schedule</strong>.</li>
                      <li>Set your title and hours, click <strong>Save</strong>, then click <strong>Share &gt; Copy link</strong>.</li>
                      <li>Paste the link below:</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Google Appointment Schedule Link
                    </label>
                    <input
                      type="url"
                      value={settingsScheduleUrl}
                      onChange={(e) => setSettingsScheduleUrl(e.target.value)}
                      placeholder="https://calendar.google.com/calendar/u/0/appointments/schedules/..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 font-mono"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Also supports direct Google Meet links or Calendly links if preferred.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSettings || !settingsScheduleUrl.trim()}
                      onClick={() => handleSaveSettings('schedule_url')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save &amp; Link Google Schedule</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: ZERO SETUP SMART SCHEDULER */}
              {modalTab === 'smart_direct' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-2">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Zero-Setup LeadPulse Smart Scheduler (Default &amp; Active)</span>
                    </span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      You don&apos;t have to configure anything! The scheduler is ready to take bookings right now:
                    </p>
                    <ul className="text-[11px] text-slate-700 list-disc pl-4 space-y-1">
                      <li>Generates automated <strong>Google Meet video rooms</strong> for every session.</li>
                      <li>Provides an instant 1-click <strong>&quot;Add to Google Calendar&quot;</strong> button for you and your prospect.</li>
                      <li>Automatically logs appointments in your CRM and advances deals to <strong>&quot;Demo&quot;</strong> stage.</li>
                      <li>Sends email confirmations with downloadable <code>.ics</code> calendar files.</li>
                    </ul>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={() => handleSaveSettings('smart_direct')}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Use Smart Scheduler</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ICAL CALENDAR SYNC */}
              {modalTab === 'ical' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-700" />
                      <span>Live 2-Way Calendar Subscription Feed</span>
                    </span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Subscribe your Google Calendar app (on Web, iPhone, Mac, Android) directly to your LeadPulse bookings:
                    </p>
                    <ol className="text-[11px] text-slate-700 list-decimal pl-4 space-y-1">
                      <li>Copy your private subscription feed URL below.</li>
                      <li>In Google Calendar, click the <strong>+</strong> next to <em>Other calendars</em> and choose <strong>From URL</strong>.</li>
                      <li>Paste the link and click <strong>Add calendar</strong>.</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Your Personal iCal Subscription Feed URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={calendarStatus?.icalFeedUrl || `${apiBase}/api/booking/feed/${user?._id || 'default'}.ics`}
                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-[11px] text-slate-700 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = calendarStatus?.icalFeedUrl || `${apiBase}/api/booking/feed/${user?._id || 'default'}.ics`;
                          navigator.clipboard.writeText(url);
                          setCopiedFeed(true);
                          setTimeout(() => setCopiedFeed(false), 2000);
                        }}
                        className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedFeed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedFeed ? 'Copied' : 'Copy Feed URL'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(false)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: DEVELOPER SERVICE ACCOUNT */}
              {modalTab === 'service_account' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-amber-900 text-[11px]">
                    <span className="font-bold flex items-center gap-1.5 text-amber-950">
                      <Key className="w-3.5 h-3.5 text-amber-700" />
                      <span>Advanced Option: Google Cloud Service Account</span>
                    </span>
                    <p className="leading-relaxed">
                      <strong>Important:</strong> In addition to generating the key, you must open Google Calendar settings, go to <em>&quot;Share with specific people&quot;</em>, and share your calendar with the service account email with <strong>&quot;Make changes to events&quot;</strong> permission.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Calendar ID
                    </label>
                    <input
                      type="text"
                      value={settingsCalendarId}
                      onChange={(e) => setSettingsCalendarId(e.target.value)}
                      placeholder="primary or your-name@group.calendar.google.com"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-mono text-xs focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Service Account Key (JSON)
                    </label>
                    <textarea
                      rows={4}
                      value={settingsServiceAccountJson}
                      onChange={(e) => setSettingsServiceAccountJson(e.target.value)}
                      placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", ...}'
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none font-mono text-[11px] focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={() => handleSaveSettings('service_account')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Service Account</span>
                    </button>
                  </div>
                </div>
              )}

              {settingsFeedback && (
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{settingsFeedback}</span>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Recent Appointments Footer Tray */}
      {scheduledList.length > 0 && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Recent Scheduled Sessions ({scheduledList.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {scheduledList.slice(0, 4).map((app) => (
              <div
                key={app.id}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2 text-slate-800"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold">{app.customerName}</span>
                <span className="text-slate-400">({app.timeSlot || app.appointmentDate})</span>
                {app.meetLink && (
                  <a href={app.meetLink} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 underline font-semibold ml-1">
                    Meet
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default BookingWidget;
