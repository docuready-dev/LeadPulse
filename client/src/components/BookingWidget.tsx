import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, ExternalLink, RotateCcw, Copy, Check, 
  Terminal, ShieldCheck, Sparkles, AlertCircle, 
  Send, Layers, Settings, Globe
} from 'lucide-react';

interface BookingWidgetProps {
  initialMode?: 'client' | 'admin';
  customUrl?: string;
  leadContext?: any;
}

export const BookingWidget: React.FC<BookingWidgetProps> = ({
  initialMode = 'client',
  customUrl,
  leadContext
}) => {
  const defaultHost = (import.meta as any).env?.VITE_EASYAPPOINTMENTS_URL || 'http://localhost:8080';
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

  const clientUrl = hostUrl.replace(/\/+$/, '');
  const adminUrl = `${clientUrl}/index.php/backend`;
  const currentIframeSrc = viewMode === 'admin' ? adminUrl : clientUrl;

  const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const res = await axios.get(`${apiBase}/api/booking/status`, { timeout: 4000 });
      setIsOnline(Boolean(res.data?.online));
    } catch {
      // Fallback: check direct host connectivity if server route failed
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

  useEffect(() => {
    checkStatus();
  }, [hostUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(clientUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleCopyEmbed = () => {
    const snippet = `<iframe src="${clientUrl}" width="100%" height="750" frameborder="0" style="border:0;width:100%;height:750px;"></iframe>`;
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

  return (
    <div className="w-full flex flex-col bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden font-sans">
      
      {/* Top Utility Control Header */}
      <div className="bg-[#FAF8F5] border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Mode Switcher + Live Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('client')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'client'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Public Scheduler</span>
            </button>

            <button
              onClick={() => setViewMode('admin')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Admin Backend</span>
            </button>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-1.5 text-xs">
            {isChecking ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Checking...</span>
              </span>
            ) : isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Live Connected (Easy!Appointments)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Backend Offline (Port 8080)</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Configure Easy!Appointments URL endpoint"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Endpoint Settings</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Copy public booking link to clipboard"
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

          <a
            href={currentIframeSrc}
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
      {showConfig && (
        <form onSubmit={handleSaveCustomHost} className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex-1 min-w-[280px] flex items-center gap-2">
            <label className="font-semibold text-slate-700 shrink-0">Easy!Appointments URL:</label>
            <input 
              type="url"
              value={customInputUrl}
              onChange={(e) => setCustomInputUrl(e.target.value)}
              placeholder="e.g. http://localhost:8080 or https://appointments.yourdomain.com"
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
              Reset to Default (8080)
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

      {/* Frame Container */}
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
                    Easy!Appointments Backend Waiting to Start
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    The Easy!Appointments PHP and MySQL engine is installed inside the LeadPulse repository at <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">easyappointments/</code>.
                  </p>
                </div>
              </div>

              {/* Docker Quickstart Box */}
              <div className="bg-slate-900 rounded-lg p-3.5 text-white font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Run in project root:</span>
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

    </div>
  );
};

export default BookingWidget;
