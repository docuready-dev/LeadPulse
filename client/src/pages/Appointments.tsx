import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { 
  Calendar, Clock, CheckCircle2, Copy, Check, 
  ExternalLink, Send, MessageCircle, Sparkles,
  Terminal, Database, Server, Settings, Users,
  FolderKanban, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BookingWidget from '../components/BookingWidget';

const Appointments = () => {
  const { user } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scheduler' | 'admin' | 'pipeline' | 'infrastructure'>('scheduler');
  const [leads, setLeads] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const bookingHost = (import.meta as any).env?.VITE_EASYAPPOINTMENTS_URL || 'http://localhost:8088';
  const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

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
    if (user) fetchLeads();
  }, [user]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingHost);
    setCopiedLink(true);
    showToast('Copied public Easy!Appointments booking link to clipboard');
    setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleSendWhatsAppInvite = (lead: any) => {
    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const message = `Hi ${lead.firstName || lead.businessName}! Let's lock in a brief walkthrough for ${lead.businessName}. You can pick any slot that suits your schedule right here: ${bookingHost}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Demo / Meeting eligible leads from CRM
  const pipelineProspects = leads.slice(0, 12);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-transparent font-sans text-slate-900">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header title="Easy!Appointments Booking Engine & Calendar Hub" />

        <div className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto custom-scrollbar space-y-6">
          
          {toastMessage && (
            <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-xl border border-slate-800 text-xs font-delight font-medium flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Top Stage Bar / KPI Progression Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Scheduler Engine</span>
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-bold text-slate-900">Easy!Appointments</div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{bookingHost}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Database Backend</span>
                <Database className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-bold text-slate-900">MySQL 8.0 Engine</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Port 3306 (Docker Service)</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Pipeline Integration</span>
                <FolderKanban className="w-4 h-4 text-[#C85A32]" />
              </div>
              <div className="text-base font-bold text-slate-900">{pipelineProspects.length} CRM Prospects</div>
              <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Auto-advances to Demo</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-delight">Public Booking URL</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-mono font-bold text-slate-900 truncate max-w-[130px]">{bookingHost}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1 bg-[#FAF8F5] border border-slate-200 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('scheduler')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'scheduler'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Live Booking View</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin & Services</span>
              </button>

              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'pipeline'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>CRM Lead Dispatch</span>
              </button>

              <button
                onClick={() => setActiveTab('infrastructure')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'infrastructure'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Docker & Architecture</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <a
                href={bookingHost}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Direct Window</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>
            </div>
          </div>

          {/* TAB 1: LIVE SCHEDULER VIEW */}
          {activeTab === 'scheduler' && (
            <BookingWidget initialMode="client" />
          )}

          {/* TAB 2: ADMIN & SERVICES VIEW */}
          {activeTab === 'admin' && (
            <BookingWidget initialMode="admin" />
          )}

          {/* TAB 3: PIPELINE CRM LEAD DISPATCH */}
          {activeTab === 'pipeline' && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-[#FAF8F5] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight">Active Pipeline Lead Dispatch</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1-Click invite prospects to book an Easy!Appointments session. Confirmed bookings automatically update stage to Demo.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/crm')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
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
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copy Link</span>
                            </button>

                            <button
                              onClick={() => navigate('/outreach')}
                              className="px-2.5 py-1 bg-[#C85A32] hover:bg-[#B04B25] text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
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

          {/* TAB 4: DOCKER & ARCHITECTURE GUIDE */}
          {activeTab === 'infrastructure' && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-2xs">
              <div>
                <h3 className="font-bold text-base text-slate-900 tracking-tight">Easy!Appointments Multi-Service Architecture</h3>
                <p className="text-xs text-slate-600 mt-1">
                  How LeadPulse orchestrates its Node.js and React stack alongside the Easy!Appointments PHP / MySQL container services.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-[#FAF8F5]">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#C85A32]" />
                    <span>Container Service Map</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700 font-mono">
                    <li className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span>easyappointments (PHP 8.2)</span>
                      <span className="font-bold text-emerald-700">Port 8088:80</span>
                    </li>
                    <li className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span>mysql (MySQL 8.0)</span>
                      <span className="font-bold text-blue-700">Port 3306:3306</span>
                    </li>
                    <li className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span>leadpulse-server (Express API)</span>
                      <span className="font-bold text-purple-700">Port 3001:3001</span>
                    </li>
                    <li className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span>leadpulse-client (React / Vite)</span>
                      <span className="font-bold text-amber-700">Port 5173:5173</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-900 text-white font-mono">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Quickstart Terminal Commands</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-slate-400 text-[10px]"># Start Easy!Appointments & MySQL in Background</div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800 text-emerald-300 select-all">
                        docker compose up -d easyappointments mysql
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]"># Start Full LeadPulse Stack (Client + Server + Scheduler)</div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800 text-emerald-300 select-all">
                        docker compose up -d
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]"># View Live MySQL & Easy!Appointments Logs</div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800 text-emerald-300 select-all">
                        docker compose logs -f easyappointments
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-400" />
                  <span>Config file: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">easyappointments/config.php</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Google Calendar Sync compatible via Easy!Appointments Admin Settings</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Appointments;
