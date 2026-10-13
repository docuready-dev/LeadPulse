import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, ExternalLink, RotateCcw, Copy, Check, 
  Terminal, ShieldCheck, Sparkles, AlertCircle, 
  Send, Layers, Settings, Globe, Clock, User, Mail, 
  Phone, Building, CheckCircle2, ArrowRight, Download, Plus
} from 'lucide-react';
import { useStore } from '../store/useStore';

interface BookingWidgetProps {
  initialMode?: 'client' | 'admin';
  customUrl?: string;
  leadContext?: any;
}

interface ServiceOption {
  id: string;
  name: string;
  duration: string;
  tag: string;
  description: string;
}

const AVAILABLE_SERVICES: ServiceOption[] = [
  {
    id: 'walkthrough',
    name: '15-Min LeadPulse Walkthrough',
    duration: '15 mins',
    tag: 'Quick Demo',
    description: 'High-speed overview of LeadPulse autonomous lead scraper and enrichment pipeline.'
  },
  {
    id: 'strategy',
    name: '30-Min Strategy Consultation',
    duration: '30 mins',
    tag: 'Most Popular',
    description: 'Deep dive into local market targeting, cold outreach deliverability, and CRM workflow.'
  },
  {
    id: 'technical',
    name: 'VIP Technical Demo & Q&A',
    duration: '45 mins',
    tag: 'Technical',
    description: 'Architecture review, custom webhook integrations, and multi-channel sequencing.'
  },
  {
    id: 'discovery',
    name: 'Executive Discovery Call',
    duration: '20 mins',
    tag: 'Executive',
    description: 'Strategic pipeline discussion with our growth leadership team.'
  }
];

const TIME_SLOTS = [
  '09:30 AM',
  '11:00 AM',
  '01:30 PM',
  '03:00 PM',
  '04:30 PM',
  '06:00 PM'
];

export const BookingWidget: React.FC<BookingWidgetProps> = ({
  initialMode = 'client',
  customUrl,
  leadContext
}) => {
  const { user } = useStore();
  const defaultHost = (import.meta as any).env?.VITE_EASYAPPOINTMENTS_URL || 'http://localhost:8088';
  
  // High-level engine selector: 'native' (built-in LeadPulse) vs 'easyappointments'
  const [engineType, setEngineType] = useState<'native' | 'easyappointments'>('native');

  // Easy!Appointments specific states
  const [hostUrl, setHostUrl] = useState<string>(() => {
    return customUrl || localStorage.getItem('leadpulse_booking_host') || defaultHost;
  });
  const [viewMode, setViewMode] = useState<'client' | 'admin'>(initialMode);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [customInputUrl, setCustomInputUrl] = useState(hostUrl);

  // Native Scheduler states
  const [selectedService, setSelectedService] = useState<ServiceOption>(AVAILABLE_SERVICES[1]);
  
  // Generate next 14 business days
  const availableDates = React.useMemo(() => {
    const dates: Array<{ dateStr: string; label: string; weekday: string; fullDate: string }> = [];
    const today = new Date();
    let current = new Date(today);
    // Start tomorrow or today
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
    dateStr: new Date().toISOString().split('T')[0],
    label: 'Today',
    weekday: 'Today',
    fullDate: new Date().toDateString()
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(TIME_SLOTS[1]);

  // Attendee Form
  const [customerName, setCustomerName] = useState<string>(leadContext?.firstName || leadContext?.businessName || '');
  const [customerEmail, setCustomerEmail] = useState<string>(leadContext?.email || '');
  const [customerPhone, setCustomerPhone] = useState<string>(leadContext?.phone || '');
  const [companyName, setCompanyName] = useState<string>(leadContext?.businessName || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  // Booked appointments list from CRM
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [showAppointmentsDrawer, setShowAppointmentsDrawer] = useState(false);

  const clientUrl = hostUrl.replace(/\/+$/, '');
  const adminUrl = `${clientUrl}/index.php/backend`;
  const currentIframeSrc = viewMode === 'admin' ? adminUrl : clientUrl;
  const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

  // Check Easy!Appointments status on 8088
  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const res = await axios.get(`${apiBase}/api/booking/status`, { timeout: 4000 });
      setIsOnline(Boolean(res.data?.online));
    } catch {
      try {
        await fetch(clientUrl, { mode: 'no-cors' });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const fetchBookings = async () => {
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
    checkStatus();
    fetchBookings();
  }, [hostUrl, user]);

  const handleCopyLink = () => {
    const link = engineType === 'native' ? window.location.href : clientUrl;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleCopyEmbed = () => {
    const embedUrl = engineType === 'native' ? window.location.href : clientUrl;
    const snippet = `<iframe src="${embedUrl}" width="100%" height="750" frameborder="0" style="border:0;width:100%;height:750px;"></iframe>`;
    navigator.clipboard.writeText(snippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2400);
  };

  const handleSaveCustomHost = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInputUrl.trim().replace(/\/+$/, '');
    if (clean) {
      setHostUrl(clean);
      localStorage.setItem('leadpulse_booking_host', clean);
      setShowConfig(false);
      setIframeKey(k => k + 1);
    }
  };

  // Submit native booking
  const handleNativeBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) {
      alert('Please provide an email address for confirmation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim() || companyName.trim() || 'Prospect',
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        serviceName: selectedService.name,
        appointmentDate: selectedDateObj.dateStr,
        timeSlot: selectedTimeSlot,
        notes: notes.trim() ? `${notes} (Company: ${companyName})` : `Company: ${companyName}`,
        dealId: leadContext?._id
      };

      const res = await axios.post(`${apiBase}/api/booking/sync`, payload, {
        headers: { userid: user?._id || 'default-user' }
      });

      setBookingSuccess({
        ...payload,
        fullDate: selectedDateObj.fullDate,
        leadId: res.data?.leadId || leadContext?._id
      });
      fetchBookings();
    } catch (err: any) {
      console.error('Booking failed:', err);
      alert(`Booking submission failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGoogleCalendarUrl = () => {
    if (!bookingSuccess) return '#';
    const title = encodeURIComponent(`${bookingSuccess.serviceName} with LeadPulse`);
    const details = encodeURIComponent(
      `Appointment scheduled with ${bookingSuccess.customerName}.\nTime Slot: ${bookingSuccess.timeSlot}\nNotes: ${bookingSuccess.notes || 'Introductory session'}`
    );
    const dateFormatted = bookingSuccess.appointmentDate.replace(/-/g, '');
    const dates = `${dateFormatted}T090000Z/${dateFormatted}T100000Z`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
  };

  const handleDownloadIcs = () => {
    if (!bookingSuccess) return;
    const cleanDate = bookingSuccess.appointmentDate.replace(/-/g, '');
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LeadPulse//Appointment Scheduler//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${bookingSuccess.serviceName} with LeadPulse`,
      `DESCRIPTION:${bookingSuccess.notes || 'LeadPulse Meeting Session'}`,
      `DTSTART:${cleanDate}T090000Z`,
      `DTEND:${cleanDate}T094500Z`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leadpulse-appointment-${bookingSuccess.appointmentDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden font-sans">
      
      {/* Top Engine & Utility Header */}
      <div className="bg-[#FAF8F5] border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Engine Selection Toggle + Live Status */}
        <div className="flex items-center flex-wrap gap-3">
          
          {/* Main Engine Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
            <button
              onClick={() => setEngineType('native')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                engineType === 'native'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>LeadPulse Native Calendar</span>
            </button>

            <button
              onClick={() => {
                setEngineType('easyappointments');
                checkStatus();
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                engineType === 'easyappointments'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Easy!Appointments (Port 8088)</span>
            </button>
          </div>

          {/* Submode for Easy!Appointments */}
          {engineType === 'easyappointments' && (
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('client')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  viewMode === 'client' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Public Client
              </button>
              <button
                onClick={() => setViewMode('admin')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  viewMode === 'admin' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Admin Panel
              </button>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center gap-1.5 text-xs">
            {engineType === 'native' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Native Engine Active (Zero Setup Required)</span>
              </span>
            ) : isChecking ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Checking Port 8088...</span>
              </span>
            ) : isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Live Connected (Easy!Appointments)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Port 8088 Waiting (Docker PHP)</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {scheduledList.length > 0 && (
            <button
              onClick={() => setShowAppointmentsDrawer(!showAppointmentsDrawer)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Booked Meetings ({scheduledList.length})</span>
            </button>
          )}

          {engineType === 'easyappointments' && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Configure Easy!Appointments URL endpoint"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Endpoint</span>
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Copy booking link to clipboard"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
          </button>

          <button
            onClick={handleCopyEmbed}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Copy iframe HTML embed snippet"
          >
            {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Layers className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedEmbed ? 'Copied Embed!' : 'Embed Code'}</span>
          </button>

          {engineType === 'easyappointments' && (
            <button
              onClick={() => {
                setIframeKey(k => k + 1);
                checkStatus();
              }}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-md transition-colors cursor-pointer shadow-2xs"
              title="Reload Frame"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <a
            href={engineType === 'native' ? window.location.href : currentIframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Open in new browser tab"
          >
            <span>Open Tab</span>
            <ExternalLink className="w-3.5 h-3.5 text-white/80" />
          </a>
        </div>

      </div>

      {/* Optional: Host Config Modal Strip */}
      {showConfig && engineType === 'easyappointments' && (
        <form onSubmit={handleSaveCustomHost} className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex-1 min-w-[280px] flex items-center gap-2">
            <label className="font-semibold text-slate-700 shrink-0">Easy!Appointments URL:</label>
            <input 
              type="url"
              value={customInputUrl}
              onChange={(e) => setCustomInputUrl(e.target.value)}
              placeholder="e.g. http://localhost:8088 or https://appointments.yourdomain.com"
              className="flex-1 px-3 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-slate-500 font-mono"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCustomInputUrl(defaultHost);
                setHostUrl(defaultHost);
                localStorage.removeItem('leadpulse_booking_host');
                setShowConfig(false);
              }}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
            >
              Reset to Default (8088)
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-[#C85A32] hover:bg-[#B04B25] text-white font-semibold rounded cursor-pointer transition-colors shadow-2xs"
            >
              Save Endpoint
            </button>
          </div>
        </form>
      )}

      {/* Booked Meetings Drawer Strip */}
      {showAppointmentsDrawer && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 animate-in fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Calendar className="w-4 h-4 text-[#C85A32]" />
              <span>Scheduled CRM Meetings ({scheduledList.length})</span>
            </div>
            <button
              onClick={() => setShowAppointmentsDrawer(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
            {scheduledList.map((app, idx) => (
              <div key={app.id || idx} className="bg-white border border-slate-200 rounded p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{app.customerName || app.businessName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {app.status || 'Confirmed'}
                  </span>
                </div>
                <div className="text-slate-600 text-[11px] flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{app.appointmentDate} {app.timeSlot ? `• ${app.timeSlot}` : ''}</span>
                </div>
                <div className="text-slate-500 text-[10px] truncate">{app.title || 'Consultation Session'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead Context Notification Bar (if passed from CRM) */}
      {leadContext && (
        <div className="bg-emerald-50/70 border-b border-emerald-200/80 px-4 py-2 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Scheduling for active pipeline deal: <b>{leadContext.businessName}</b> ({leadContext.email || leadContext.phone || 'Contact'})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-700">Stage: {leadContext.status || 'Lead'}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {engineType === 'native' ? (
        // NATIVE LEADPULSE APPOINTMENT SCHEDULER
        <div className="w-full p-6 sm:p-8 bg-[#FAF8F5]/30">
          {bookingSuccess ? (
            // BOOKING CONFIRMATION SCREEN
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Appointment Confirmed
                </span>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Your Meeting is Scheduled!
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  A calendar confirmation has been registered in your LeadPulse CRM pipeline and advanced to the Demo stage.
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-left text-xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Session Type:</span>
                  <span className="font-bold text-slate-900">{bookingSuccess.serviceName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Date & Time:</span>
                  <span className="font-bold text-slate-900">{bookingSuccess.fullDate} at {bookingSuccess.timeSlot}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Attendee:</span>
                  <span className="font-bold text-slate-900">{bookingSuccess.customerName} ({bookingSuccess.customerEmail})</span>
                </div>
                {bookingSuccess.customerPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Phone / WhatsApp:</span>
                    <span className="font-mono text-slate-900">{bookingSuccess.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Add to Google Calendar</span>
                </a>

                <button
                  onClick={handleDownloadIcs}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ics Invite</span>
                </button>

                <button
                  onClick={() => {
                    setBookingSuccess(null);
                    setNotes('');
                  }}
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#B04B25] text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule Another Session</span>
                </button>
              </div>
            </div>
          ) : (
            // INTERACTIVE SCHEDULER FORM
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Header Description */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Book a Consultation or Product Walkthrough
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your preferred session type, pick a day and time slot, and lock in the appointment.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Timezone: Local System Time</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Column 1: Service Type & Date/Time (7 cols) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* 1. Service Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      1. Select Meeting Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {AVAILABLE_SERVICES.map(service => {
                        const isSelected = selectedService.id === service.id;
                        return (
                          <div
                            key={service.id}
                            onClick={() => setSelectedService(service)}
                            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-white border-[#C85A32] ring-1 ring-[#C85A32] shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C85A32]">
                                {service.tag}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {service.duration}
                              </span>
                            </div>
                            <div className="font-bold text-xs text-slate-900">{service.name}</div>
                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {service.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Date Selection (Next 12 business days) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      2. Choose a Date
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {availableDates.map(dateObj => {
                        const isSelected = selectedDateObj.dateStr === dateObj.dateStr;
                        return (
                          <button
                            key={dateObj.dateStr}
                            type="button"
                            onClick={() => setSelectedDateObj(dateObj)}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                              {dateObj.weekday}
                            </div>
                            <div className="text-xs font-extrabold mt-0.5">
                              {dateObj.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Time Slot Chips */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      3. Select Time Slot
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TIME_SLOTS.map(slot => {
                        const isSelected = selectedTimeSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`py-2 px-3 rounded-md border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#C85A32] text-white border-[#C85A32] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <Clock className="w-3 h-3 opacity-80" />
                            <span>{slot}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Column 2: Attendee Details Form (5 cols) */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Attendee & Booking Details
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Selected: <b>{selectedDateObj.label}</b> at <b>{selectedTimeSlot}</b>
                    </p>
                  </div>

                  <form onSubmit={handleNativeBookingSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Full Name / Contact *
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Sarah Jenkins"
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs outline-none focus:border-slate-600 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Work Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="email"
                          required
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="sarah@acmeindustries.com"
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs outline-none focus:border-slate-600 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Phone or WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+1 (555) 019-2834"
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs outline-none focus:border-slate-600 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Company or Business Name
                      </label>
                      <div className="relative">
                        <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Acme Industries LLC"
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs outline-none focus:border-slate-600 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Topics or Specific Questions
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Tell us what you'd like to discuss..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs outline-none focus:border-slate-600 font-medium resize-none"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-md text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                      >
                        {isSubmitting ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                            <span>Confirming Appointment...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Confirm Appointment</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 text-center leading-normal">
                      Automatically logs session into LeadPulse CRM pipeline and tags deal as Demo.
                    </p>
                  </form>
                </div>

              </div>

            </div>
          )}
        </div>
      ) : (
        // EASYAPPOINTMENTS IFRAME / DIAGNOSTIC SCREEN
        <div className="relative w-full h-[760px] bg-slate-50">
          
          {/* If Backend Offline Warning Screen */}
          {isOnline === false && (
            <div className="absolute inset-0 bg-[#FAF8F5]/95 z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 overflow-y-auto">
              <div className="max-w-lg w-full bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Easy!Appointments Waiting to Start on Port 8088
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      LeadPulse mapped Easy!Appointments to port 8088 because port 8080 is reserved by local motion controller services (Mint HTTP Server).
                    </p>
                  </div>
                </div>

                {/* Instant Switch Recommendation */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>No Docker? Use Built-in LeadPulse Scheduler!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    You can schedule appointments immediately using the built-in LeadPulse Calendar engine with zero Docker or PHP required.
                  </p>
                  <button
                    onClick={() => setEngineType('native')}
                    className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>Switch to Built-in Scheduler</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Docker Quickstart Box */}
                <div className="bg-slate-900 rounded-lg p-3.5 text-white font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Start via Docker Compose on Port 8088:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Terminal Command</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-emerald-300 font-bold select-all overflow-x-auto">
                    docker compose up -d easyappointments mysql
                  </div>
                </div>

                {/* Status and Action Row */}
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span>Scheduler Endpoint:</span>
                    <span className="font-mono font-bold text-slate-800">{clientUrl}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span>MySQL Database:</span>
                    <span className="font-mono text-slate-800">easyappointments (Port 3306)</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span>Admin Credentials:</span>
                    <span className="font-mono text-slate-800">Configured on first launch</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    onClick={() => checkStatus()}
                    disabled={isChecking}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>{isChecking ? 'Verifying Connection...' : 'Check Connection Again'}</span>
                  </button>

                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Configure Custom URL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Easy!Appointments Iframe */}
          <iframe
            key={iframeKey}
            src={currentIframeSrc}
            title="Easy!Appointments Scheduler"
            className="w-full h-full border-0 bg-white"
            allow="calendar *; camera *; microphone *"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />

        </div>
      )}

    </div>
  );
};

export default BookingWidget;
