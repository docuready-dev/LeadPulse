import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { 
  Calendar, Clock, CheckCircle2, Copy, Check, 
  Send, MessageCircle, Sparkles,
  Server, Settings, Users,
  FolderKanban, ArrowRight, Video,
  Key, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BookingWidget from '../components/BookingWidget';

const Appointments = () => {
  const { user } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scheduler' | 'appointments' | 'pipeline' | 'setup'>('scheduler');
  const [leads, setLeads] = useState<any[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [calendarStatus, setCalendarStatus] = useState<any>(null);

  const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  const publicBookingUrl = typeof window !== 'undefined' ? `${window.location.origin}/appointments` : '/appointments';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3600);
  };

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/leads`, {
          headers: { userid: user?._id }
        });
        setLeads(res.data || []);
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

  const pipelineProspects = leads.slice(0, 12);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-transparent font-sans text-slate-900">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <Header title="Google Calendar Booking Engine & Appointment Hub" />

        <main className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
          <div className="max-w-[1360px] mx-auto space-y-6 pb-24">
          
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
              <div className="text-base font-bold text-slate-900">Google Calendar</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {calendarStatus?.syncMode === 'google_schedule' 
                    ? 'Google Schedule Linked' 
                    : calendarStatus?.syncMode === 'service_account' && calendarStatus?.isConnected
                    ? 'API Synced'
                    : 'Smart Direct Mode (Active)'}
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

              <button
                onClick={() => setActiveTab('setup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'setup'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Calendar Linking Guide</span>
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
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight">Confirmed Google Calendar Sessions</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real meetings scheduled with prospects and synchronized to your Google Calendar.
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
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {appointmentsList.map((app, idx) => (
                        <tr key={app.id || idx} className="hover:bg-slate-50 transition-colors">
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
                          <td className="py-3 px-4">
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
                              <span className="text-[11px] text-slate-400 italic">Google Calendar Event</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {app.status || 'Confirmed'}
                            </span>
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
                    1-Click invite prospects to book a Google Calendar session. Confirmed bookings automatically advance stage to Demo.
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
                                onClick={() => handleSendWhatsAppInvite(lead)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Send booking link via WhatsApp"
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

          {/* TAB 4: GOOGLE CALENDAR LINKING GUIDE */}
          {activeTab === 'setup' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-2xs text-xs">
              <div>
                <h3 className="font-bold text-base text-slate-900 tracking-tight">Easy Google Calendar Linking Guide</h3>
                <p className="text-slate-600 mt-1">
                  Connect LeadPulse to your Google Calendar in seconds. Choose the method that best fits your workflow.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Method 1: Zero Setup Smart Scheduler */}
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider mb-2">
                      Active Now • 0 Setup
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Smart Direct Scheduler</span>
                    </h4>
                    <p className="text-slate-600 mt-2 text-[11px] leading-relaxed">
                      Works out of the box with zero API keys or developer console setup.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-[11px] text-slate-700 list-disc pl-4">
                      <li>Automated Google Meet room generation</li>
                      <li>1-Click &quot;Add to Google Calendar&quot; buttons</li>
                      <li>Auto-advances CRM leads to &quot;Demo&quot;</li>
                      <li>Instant email confirmations with .ics invites</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => setActiveTab('scheduler')}
                    className="w-full mt-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Open Live Scheduler
                  </button>
                </div>

                {/* Method 2: Google Appointment Schedule Link */}
                <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] uppercase tracking-wider mb-2">
                      Recommended • 10 Seconds
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>Google Schedule URL</span>
                    </h4>
                    <p className="text-slate-600 mt-2 text-[11px] leading-relaxed">
                      Link your official Google Calendar Appointment Schedule directly.
                    </p>
                    <ol className="mt-3 space-y-1.5 text-[11px] text-slate-700 list-decimal pl-4">
                      <li>In Google Calendar, click <strong>+ Create &gt; Appointment Schedule</strong>.</li>
                      <li>Copy your booking URL (ends in <code>/schedules/...</code>).</li>
                      <li>Click <strong>Calendar Settings</strong> above and paste your link.</li>
                      <li>Your official Google schedule embeds right into LeadPulse!</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('scheduler');
                      showToast('Open Calendar Settings in the top right to paste your link');
                    }}
                    className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Configure Schedule Link
                  </button>
                </div>

                {/* Method 3: Live iCal Feed Sync */}
                <div className="border border-slate-200 bg-[#FAF8F5] rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="inline-block px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] uppercase tracking-wider mb-2">
                      Universal Sync • 1 Click
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-700" />
                      <span>Google Calendar iCal Feed</span>
                    </h4>
                    <p className="text-slate-600 mt-2 text-[11px] leading-relaxed">
                      Subscribe your Google Calendar app to all LeadPulse appointments.
                    </p>
                    <ol className="mt-3 space-y-1.5 text-[11px] text-slate-700 list-decimal pl-4">
                      <li>Copy your personal feed URL from Calendar Settings.</li>
                      <li>In Google Calendar, click <strong>+ Other calendars &gt; From URL</strong>.</li>
                      <li>Paste the link and click <strong>Add calendar</strong>.</li>
                      <li>All LeadPulse bookings appear on your phone &amp; laptop automatically!</li>
                    </ol>
                  </div>
                  <div className="mt-3 p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-600 truncate">
                    {calendarStatus?.icalFeedUrl || `${apiBase}/api/booking/feed/${user?._id || 'default'}.ics`}
                  </div>
                </div>

              </div>

              {/* Advanced Developer Section (Collapsible Accordion) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-xs text-slate-800">Advanced Option: Google Cloud Service Account (For Developers)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Optional</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  If you require backend Google Calendar API SDK access: In Google Cloud Console, enable <strong>Google Calendar API</strong>, generate a <strong>Service Account Key (JSON)</strong>, and in Google Calendar settings, share your calendar with the service account email with <strong>&quot;Make changes to events&quot;</strong> permission.
                </p>
              </div>

            </div>
          )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default Appointments;
