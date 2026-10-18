import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { alertDialog } from './AppConfirmModal';
import { 
  X, Check, Loader2, CheckCircle2, AlertCircle, 
  Eye, EyeOff, ExternalLink, Globe, Sparkles, Unlink, Key, Compass
} from 'lucide-react';

interface SerpApiConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onConnected?: (account: any) => void;
}

const SerpApiConnectModal: React.FC<SerpApiConnectModalProps> = ({
  isOpen,
  onClose,
  user,
  onConnected
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [serpAccount, setSerpAccount] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const leadPulsePlan = (user?.plan || 'free').toLowerCase();
  const isPaidTier = leadPulsePlan === 'basic' || leadPulsePlan === 'pro';

  // Load active connection status on mount
  useEffect(() => {
    if (!isOpen || !user?._id) return;
    const fetchStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const res = await axios.get('http://localhost:3001/api/leads/serpapi/status', {
          headers: { userid: user._id }
        });
        if (res.data?.isConnected && res.data.account) {
          setSerpAccount(res.data.account);
          setApiKey(res.data.account.apiKey || '');
        } else {
          setSerpAccount(null);
        }
      } catch (err) {
        console.error('Failed to load SerpApi status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchStatus();
  }, [isOpen, user?._id]);

  if (!isOpen) return null;

  // Open small browser popup window for registration or login
  const handleOpenSerpApiWindow = (mode: 'register' | 'login') => {
    const width = 640;
    const height = 720;
    const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - height) / 2.5));
    const targetUrl = mode === 'register' 
      ? 'https://serpapi.com/users/sign_up' 
      : 'https://serpapi.com/manage-api-key';

    window.open(
      targetUrl, 
      'serpapi_popup_auth', 
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=yes,status=no,scrollbars=yes,resizable=yes`
    );
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setErrorMessage('Please enter your SerpApi API key.');
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await axios.post(
        'http://localhost:3001/api/leads/serpapi/connect',
        { apiKey: cleanKey },
        { headers: { userid: user?._id } }
      );

      if (res.data?.success) {
        setSerpAccount(res.data.account);
        setSuccessMessage(res.data.message || 'SerpApi connected successfully!');
        if (onConnected) onConnected(res.data.account);
      } else {
        setErrorMessage(res.data?.error || 'Failed to connect SerpApi.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to verify SerpApi key.';
      setErrorMessage(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await axios.delete('http://localhost:3001/api/leads/serpapi/disconnect', {
        headers: { userid: user?._id }
      });
      setSerpAccount(null);
      setApiKey('');
      setSuccessMessage(null);
      setErrorMessage(null);
      if (onConnected) onConnected(null);
      await alertDialog({
        title: 'SerpApi Disconnected',
        message: 'Your SerpApi key has been unlinked from this workspace.',
        variant: 'info'
      });
    } catch (err: any) {
      await alertDialog({
        title: 'Disconnection Error',
        message: err.response?.data?.error || 'Failed to disconnect SerpApi.',
        variant: 'error'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white flex items-start justify-between shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-white font-delight text-[11px] font-bold mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>Google Maps Extraction Engine</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-delight">
              Connect SerpApi Engine
            </h2>
            <p className="text-xs text-blue-100 mt-1 max-w-md leading-relaxed font-delight">
              Connect your SerpApi account for fast, automated Google Maps lead harvesting with zero IP blocks or CAPTCHA challenges.
            </p>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Connected Banner */}
        {serpAccount && (
          <div className="px-5 py-3.5 bg-emerald-50/90 border-b border-emerald-200/90 flex items-center justify-between gap-3 font-delight">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1.5">
                  <span>SerpApi Engine Active</span>
                  {/* Mention SerpApi tier only for Basic and Pro LeadPulse subscribers */}
                  {isPaidTier && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md">
                      {serpAccount.plan_name || 'Free'} Tier
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  {isPaidTier ? (
                    <span>
                      {serpAccount.plan_searches_left ?? 100} of {serpAccount.searches_per_month ?? 100} searches remaining this month
                    </span>
                  ) : (
                    <span>Google Maps extraction engine verified and ready for live searches</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
            >
              {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              <span>Disconnect</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Quick Launcher Buttons to open browser popup window */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2.5 font-delight">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Open SerpApi Portal (Popup Window)</span>
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                100 Free Searches / Mo
              </span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Register a new free account or sign in to copy your secret API key from your SerpApi dashboard.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleOpenSerpApiWindow('register')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <span>Register on SerpApi</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenSerpApiWindow('login')}
                className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <span>Sign In / Get API Key</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Simple 3-Step Instructions */}
          <div className="space-y-2 font-delight text-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Connection Instructions
            </div>
            <div className="grid grid-cols-1 gap-2 text-slate-600">
              <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <div>
                  <strong className="text-slate-800">Open SerpApi:</strong> Click <em>Register on SerpApi</em> or <em>Sign In</em> above to open the small browser window.
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <div>
                  <strong className="text-slate-800">Copy Your API Key:</strong> Once logged in, copy the private key displayed under your SerpApi account settings.
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <div>
                  <strong className="text-slate-800">Paste &amp; Verify:</strong> Paste your API key below and click <em>Verify &amp; Connect Engine</em>.
                </div>
              </div>
            </div>
          </div>

          {/* API Key Form */}
          <form onSubmit={handleConnect} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                SerpApi API Key <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. 849a9b1... (copy from SerpApi dashboard)"
                  className="w-full pl-9 pr-9 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error & Success Feedback */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 font-delight text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Connection Failed</div>
                  <div className="text-rose-700 mt-0.5 leading-relaxed">{errorMessage}</div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 font-delight text-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Verified Successfully</div>
                  <div className="text-emerald-700 mt-0.5 leading-relaxed">{successMessage}</div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 font-delight">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting || !apiKey.trim()}
            className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isConnecting || !apiKey.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200'
            }`}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Key with SerpApi...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Verify &amp; Connect Engine</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SerpApiConnectModal;
