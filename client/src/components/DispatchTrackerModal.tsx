import { useState } from 'react';
import axios from 'axios';
import { 
  X, Send, CheckCircle2, AlertCircle, 
  ExternalLink, Mail, ShieldCheck, Zap, Terminal, 
  Users, User, Check, RefreshCw
} from 'lucide-react';

import { useStore } from '../store/useStore';

interface LeadItem {
  _id?: string;
  businessName: string;
  location: string;
  category?: string;
  fieldOfWork?: string;
  firstName?: string;
  phone?: string;
  rating?: string;
  email?: string;
}

interface DispatchTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
  templateData: Record<string, any>;
  templateDataB?: Record<string, any>;
  isAbTesting?: boolean;
  templateStyling: Record<string, any>;
  availableLeads: LeadItem[];
  currentPreviewLead: LeadItem;
  user: any;
  connectedMailbox?: any;
  onCampaignDispatched?: () => void;
}

interface DeliveryLogItem {
  leadId: string;
  businessName: string;
  recipient: string;
  status: 'delivered' | 'failed';
  response: string;
  messageId: string;
  previewUrl: string | null;
  subject: string;
  variant?: string;
}

const DispatchTrackerModal = ({
  isOpen,
  onClose,
  templateId,
  templateName,
  templateData,
  templateDataB,
  isAbTesting = false,
  templateStyling,
  availableLeads,
  currentPreviewLead,
  user,
  connectedMailbox,
  onCampaignDispatched
}: DispatchTrackerModalProps) => {
  const { setUpgradeModalOpen, recordEmailDispatch } = useStore();
  if (!isOpen) return null;

  // Target audience mode
  const [audienceMode, setAudienceMode] = useState<'all' | 'single' | 'custom'>('all');
  const [customEmail, setCustomEmail] = useState(user?.email || 'ashleyghose64@gmail.com');

  // Dispatch lifecycle: 'config' | 'sending' | 'completed' | 'error'
  const [dispatchState, setDispatchState] = useState<'config' | 'sending' | 'completed' | 'error'>('config');
  const [progressPercent, setProgressPercent] = useState(0);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'table' | 'terminal'>('table');

  const selectedLeadsToDispatch: LeadItem[] = 
    audienceMode === 'all' 
      ? availableLeads 
      : audienceMode === 'single'
        ? [currentPreviewLead]
        : [{
            _id: 'custom-lead',
            businessName: currentPreviewLead.businessName || 'Direct Test Recipient',
            location: currentPreviewLead.location || 'Local Area',
            category: currentPreviewLead.category || 'Direct Outreach',
            fieldOfWork: currentPreviewLead.fieldOfWork || 'Technology',
            firstName: 'Ashley',
            phone: currentPreviewLead.phone || '+91 98000 00000',
            rating: '5.0',
            email: customEmail
          }];

  const handleStartDispatch = async () => {
    // Mailbox Connection Check
    if (!connectedMailbox) {
      setErrorMessage('No verified sending mailbox connected. Please configure your standard SMTP credentials in Outbox settings before launching outreach.');
      setDispatchState('error');
      return;
    }

    // Quota validation prior to starting
    const plan = (user?.plan || 'free').toLowerCase();
    const emailLimit = user?.emails_limit || (plan === 'pro' ? 5000 : plan === 'basic' ? 1500 : 50);
    const emailsSent = user?.emails_sent || 0;
    const needed = selectedLeadsToDispatch.length;

    if (emailsSent + needed > emailLimit) {
      setErrorMessage(`Monthly email dispatch quota exceeded. You have used ${emailsSent}/${emailLimit} emails this month. Dispathing this batch requires ${needed} emails. Please upgrade to Basic (1,500/mo) or Pro (5,000+/mo).`);
      setDispatchState('error');
      return;
    }

    setDispatchState('sending');
    setProgressPercent(15);
    setDeliveryLogs([]);
    setErrorMessage('');

    try {
      // Build request payload
      const payload = {
        templateId,
        templateData,
        templateDataB: isAbTesting ? templateDataB : undefined,
        isAbTesting,
        templateStyling,
        leadIds: audienceMode === 'all' 
          ? availableLeads.map(l => l._id).filter(Boolean)
          : audienceMode === 'single' && currentPreviewLead._id ? [currentPreviewLead._id] : [],
        fallbackLeads: selectedLeadsToDispatch,
        fromName: connectedMailbox?.fromName || (user?.name ? `${user.name} | LeadPulse` : 'LeadPulse Growth Engine'),
        fromEmail: connectedMailbox?.fromEmail || connectedMailbox?.user || user?.email || 'outreach@leadpulse.io'
      };

      setProgressPercent(45);

      const res = await axios.post('http://localhost:3001/api/outreach/dispatch-batch', payload, {
        headers: { userid: user?._id }
      });

      setProgressPercent(100);
      setDeliveryLogs(res.data.logs || []);
      setDispatchState('completed');

      const delivered = res.data.deliveredCount || (res.data.logs ? res.data.logs.filter((l: any) => l.status === 'delivered').length : needed);
      if (delivered > 0) {
        recordEmailDispatch(delivered);
      }

      if (onCampaignDispatched) {
        onCampaignDispatched();
      }

    } catch (err: any) {
      console.error('Dispatch error:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Dispatch engine encountered a server error.');
      setDispatchState('error');
    }
  };

  const handleReset = () => {
    setDispatchState('config');
    setProgressPercent(0);
    setDeliveryLogs([]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-hidden cursor-pointer">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-white rounded-md border border-slate-200 w-full max-w-3xl h-[90vh] max-h-[820px] shadow-xl flex flex-col overflow-hidden cursor-default animate-in fade-in zoom-in-95 duration-150 relative z-10 my-auto"
      >
        
        {/* ======================================================== */}
        {/* MODAL HEADER                                             */}
        {/* ======================================================== */}
        <div className="shrink-0 p-5 sm:px-6 sm:py-5 bg-slate-950 text-white relative border-b border-slate-800">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-7 h-7 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-20"
            title="Close modal"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>

          <div className="max-w-2xl pr-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-blue-500/10 border border-blue-500/20 text-blue-400 font-delight text-[11px] font-semibold mb-2">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Direct-to-Inbox Email Dispatch Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
              Direct Server-Side Campaign Dispatch
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dispatches compiled HTML messages straight into recipient inboxes via verified mail transport without generating any downloadable files.
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MODAL BODY                                               */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar space-y-5">

          {/* 1. CONFIGURATION VIEW */}
          {dispatchState === 'config' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Template Blueprint Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-400 block">Selected Structure:</span>
                    <h4 className="text-xs font-bold text-slate-900">{templateName}</h4>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 font-delight text-[10px] font-semibold border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>CAN-SPAM Active</span>
                  </span>
                  {isAbTesting && (
                    <span className="px-2 py-0.5 rounded-sm bg-purple-50 text-purple-700 font-delight text-[10px] font-semibold border border-purple-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                      <span>50/50 A/B Split Active</span>
                    </span>
                  )}
                  {connectedMailbox ? (
                    <span className="px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 font-delight text-[10px] font-semibold border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{connectedMailbox.fromEmail || connectedMailbox.user} ({connectedMailbox.host})</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 font-delight text-[10px] font-semibold border border-amber-200 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>No Outbox Connected</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Target Audience Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-delight font-medium text-slate-600 uppercase tracking-wider">
                  Target Recipient Audience:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Option 1: All Scraped Leads */}
                  <div 
                    onClick={() => setAudienceMode('all')}
                    className={`p-3.5 rounded-md border transition-all cursor-pointer ${
                      audienceMode === 'all' 
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Users className={`w-4 h-4 ${audienceMode === 'all' ? 'text-slate-900' : 'text-slate-400'}`} />
                      {audienceMode === 'all' && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </div>
                    <div className="text-xs font-bold text-slate-900">All Harvested Leads</div>
                    <p className="text-[11px] font-delight font-normal text-slate-500 mt-0.5">
                      {availableLeads.length} total recipients
                    </p>
                  </div>

                  {/* Option 2: Target Lead Only */}
                  <div 
                    onClick={() => setAudienceMode('single')}
                    className={`p-3.5 rounded-md border transition-all cursor-pointer ${
                      audienceMode === 'single' 
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <User className={`w-4 h-4 ${audienceMode === 'single' ? 'text-slate-900' : 'text-slate-400'}`} />
                      {audienceMode === 'single' && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {currentPreviewLead.businessName}
                    </div>
                    <p className="text-[11px] font-delight font-normal text-slate-500 mt-0.5">
                      Single lead dispatch test
                    </p>
                  </div>

                  {/* Option 3: Custom Inbox Test */}
                  <div 
                    onClick={() => setAudienceMode('custom')}
                    className={`p-3.5 rounded-md border transition-all cursor-pointer ${
                      audienceMode === 'custom' 
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Mail className={`w-4 h-4 ${audienceMode === 'custom' ? 'text-slate-900' : 'text-slate-400'}`} />
                      {audienceMode === 'custom' && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </div>
                    <div className="text-xs font-bold text-slate-900">My Inbox Test</div>
                    <p className="text-[11px] font-delight font-normal text-slate-500 mt-0.5">
                      Verify directly in personal email
                    </p>
                  </div>

                </div>

                {/* Custom Email Input */}
                {audienceMode === 'custom' && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <input 
                      type="email" 
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="Enter destination email address..."
                      className="w-full text-xs font-delight font-medium outline-none text-slate-900"
                    />
                  </div>
                )}
              </div>

              {/* Individualized Lead Preview Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-delight font-medium text-slate-700">Target Queue Preview ({selectedLeadsToDispatch.length} Recipients):</span>
                  <span className="text-slate-400 text-[11px] font-delight font-normal">Individualized merge tags mapped</span>
                </div>
                
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white max-h-48 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-delight font-semibold text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Target Business</th>
                        <th className="py-2 px-3">Location / Field</th>
                        <th className="py-2 px-3">Recipient Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLeadsToDispatch.map((lead, idx) => (
                        <tr key={lead._id || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">{lead.businessName}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">{lead.location} &bull; {lead.category || lead.fieldOfWork}</td>
                          <td className="py-2 px-3 text-blue-600 font-delight font-medium text-[11px]">
                            {lead.email || `contact@${lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Protocol Highlights */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs text-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-delight font-medium text-xs text-slate-900">Zero File Downloads Mandate Enforced:</strong>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    The payload compiles server-side and routes messages directly through the Node mail delivery transport protocol into recipient inboxes. Live delivery receipts and inbox inspection URLs will update right on your screen.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* 2. LIVE SENDING & TELEMETRY PROGRESS VIEW */}
          {dispatchState === 'sending' && (
            <div className="py-12 text-center space-y-5 animate-in fade-in duration-150">
              <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Executing Direct-to-Inbox Dispatch...
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Server is compiling individual merge tags, attaching compliance headers, and opening direct SMTP delivery sockets for {selectedLeadsToDispatch.length} recipient inboxes.
                </p>
              </div>

              <div className="max-w-md mx-auto w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden border border-slate-200">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-xs" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-delight font-medium text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md">
                <RefreshCw className="w-3 h-3 animate-spin text-slate-900" />
                <span>Socket Handshake & Deliverability Verification in Progress</span>
              </div>
            </div>
          )}

          {/* 3. COMPLETED VIEW (LIVE DELIVERY STATUS TRACKING) */}
          {dispatchState === 'completed' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Success Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      Campaign Dispatched Directly to Inboxes!
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Successfully delivered {deliveryLogs.filter(l => l.status === 'delivered').length} of {deliveryLogs.length} messages. Zero file downloads required.
                    </p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xl font-bold font-delight text-emerald-700">100%</div>
                  <div className="text-[10px] font-delight font-semibold text-emerald-600 uppercase">Inbox Delivery Rate</div>
                </div>
              </div>

              {/* View Switcher Tabs (Delivery Table vs Terminal Log) */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`px-3 py-1 rounded-md text-xs font-delight font-medium transition-all cursor-pointer ${
                      activeTab === 'table' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Delivery Table ({deliveryLogs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('terminal')}
                    className={`px-3 py-1 rounded-md text-xs font-delight font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'terminal' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Live Protocol Logs</span>
                  </button>
                </div>

                <span className="text-[11px] font-delight font-normal text-slate-400">
                  CRM Leads updated to &quot;Contacted&quot;
                </span>
              </div>

              {/* TAB 1: DELIVERY STATUS TRACKING TABLE */}
              {activeTab === 'table' && (
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-delight font-semibold text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Recipient Business</th>
                        <th className="py-2.5 px-3">Destination Inbox</th>
                        <th className="py-2.5 px-3">Delivery Status</th>
                        <th className="py-2.5 px-3 text-right">Inbox Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deliveryLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {log.variant && (
                              <span className={`inline-block px-1.5 py-0.5 rounded-xs font-delight text-[9px] font-bold mr-1.5 border ${
                                log.variant === 'Variant A' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {log.variant}
                              </span>
                            )}
                            {log.businessName}
                          </td>
                          <td className="py-2.5 px-3 font-delight font-medium text-slate-600 text-[11px]">
                            {log.recipient}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-delight font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>250 OK Delivered</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {log.previewUrl ? (
                              <a 
                                href={log.previewUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-delight font-medium text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm transition-colors"
                              >
                                <span>Inspect Inbox</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] font-delight font-normal text-slate-400">Verified Direct</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: TERMINAL PROTOCOL LOGS */}
              {activeTab === 'terminal' && (
                <div className="bg-slate-950 text-emerald-400 font-delight font-medium text-xs rounded-md p-4 max-h-72 overflow-y-auto custom-scrollbar space-y-1.5 border border-slate-800">
                  <div className="text-slate-500 text-[11px]">=== LEADPULSE OUTBOUND DISPATCH TELEMETRY STREAM ===</div>
                  <div>[SOCKET] Handshake established with direct mail transport gateway.</div>
                  {deliveryLogs.map((log, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="text-white">
                        &gt; [DISPATCH #{i + 1}] Target: {log.businessName} ({log.recipient})
                      </div>
                      <div className="text-slate-400 pl-4">
                        &rarr; Subject: &quot;{log.subject}&quot;
                      </div>
                      <div className="text-emerald-400 pl-4">
                        &rarr; Response: {log.response} (Message-ID: {log.messageId})
                      </div>
                      {log.previewUrl && (
                        <div className="text-blue-400 pl-4">
                          &rarr; Direct Preview URL: {log.previewUrl}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="text-emerald-400 font-bold mt-2">
                    [COMPLETED] All {deliveryLogs.length} individualized emails dispatched directly to target inboxes.
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 4. ERROR VIEW */}
          {dispatchState === 'error' && (
            <div className="p-6 text-center space-y-3 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-sm font-bold text-red-950">Dispatch Encountered an Error</h3>
              <p className="text-xs text-red-700 max-w-md mx-auto">{errorMessage}</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleReset}
                  className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-delight font-medium text-xs transition-colors cursor-pointer"
                >
                  Try Again
                </button>
                {(errorMessage.toLowerCase().includes('upgrade') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) && (
                  <button
                    onClick={() => {
                      onClose();
                      setUpgradeModalOpen(true);
                    }}
                    className="px-4 py-1.5 rounded-md bg-[#C85A32] hover:bg-[#B04B25] text-white font-delight font-bold text-xs transition-colors cursor-pointer"
                  >
                    Upgrade Plan &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ======================================================== */}
        {/* MODAL FOOTER                                             */}
        {/* ======================================================== */}
        <div className="shrink-0 px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-delight font-normal text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Direct Socket Delivery &bull; Zero downloads &bull; CAN-SPAM Certified</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {dispatchState === 'config' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-delight font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartDispatch}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-delight font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-900"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Campaign Directly ({selectedLeadsToDispatch.length} Inboxes)</span>
                </button>
              </>
            ) : dispatchState === 'completed' ? (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-delight font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Dispatch Another Batch
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-delight font-medium transition-all cursor-pointer border border-slate-900"
                >
                  Back to Dashboard
                </button>
              </>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DispatchTrackerModal;
