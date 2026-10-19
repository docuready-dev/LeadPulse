import { useState, useEffect } from 'react';
import axios from 'axios';
import { alertDialog } from './AppConfirmModal';
import { 
  X, Check, 
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff,
  Server, Lock, Unlink, Send, ShieldCheck, Mail,
  ExternalLink, Sparkles, Key, Terminal, Zap, Shield
} from 'lucide-react';

interface EmailProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSaved?: () => void;
}

const EmailProviderModal = ({ isOpen, onClose, user, onSaved }: EmailProviderModalProps) => {
  // Form Fields for SendGrid Web API on Render
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [fromName, setFromName] = useState(user?.name || '');
  const [fromEmail, setFromEmail] = useState(user?.email || '');
  const [replyTo, setReplyTo] = useState(user?.email || '');

  // Verification & Test Ping
  const [sendTestEmail, setSendTestEmail] = useState(true);
  const [testRecipient, setTestRecipient] = useState(user?.email || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Active connected mailbox state from backend
  const [connectedMailbox, setConnectedMailbox] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sendgrid' | 'render_env'>('sendgrid');

  // Load active mailbox status on open
  useEffect(() => {
    if (!isOpen || !user?._id) return;
    const fetchStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const res = await axios.get('http://localhost:3001/api/outreach/mailbox', {
          headers: { userid: user._id }
        });
        if (res.data?.isConnected && res.data.mailbox) {
          const mb = res.data.mailbox;
          setConnectedMailbox(mb);
          setFromName(mb.fromName || user?.name || '');
          setFromEmail(mb.fromEmail || user?.email || '');
          setReplyTo(mb.replyTo || mb.fromEmail || user?.email || '');
        } else {
          setConnectedMailbox(null);
        }
      } catch (err) {
        console.error('Failed to load mailbox status:', err);
        setConnectedMailbox(null);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchStatus();
  }, [isOpen, user?._id]);

  if (!isOpen) return null;

  const handleVerifyAndConnect = async () => {
    const cleanKey = apiKey.trim();
    const cleanFromEmail = fromEmail.trim();

    if (!cleanKey && !connectedMailbox) {
      setVerificationError('Please enter your SendGrid API Key (starts with "SG.").');
      return;
    }
    if (!cleanFromEmail) {
      setVerificationError('Please enter your Verified Sender Email address.');
      return;
    }

    setIsVerifying(true);
    setVerificationSuccess(null);
    setVerificationError(null);

    try {
      const payload = {
        apiKey: cleanKey || undefined,
        fromName: fromName.trim() || user?.name || 'Outreach Specialist',
        fromEmail: cleanFromEmail,
        replyTo: (replyTo || cleanFromEmail).trim(),
        sendTestPing: sendTestEmail,
        testRecipient: testRecipient.trim() || cleanFromEmail
      };

      const res = await axios.post('http://localhost:3001/api/outreach/verify-mailbox', payload, {
        headers: { userid: user?._id }
      });

      if (res.data.success) {
        setVerificationSuccess(res.data.message || 'SendGrid Web API verified and connected successfully!');
        setConnectedMailbox(res.data.mailbox);
        setApiKey('');
        if (onSaved) onSaved();
      } else {
        setVerificationError(res.data.error || 'Failed to verify SendGrid connection.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.details || err.message || 'Verification failed';
      setVerificationError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await alertDialog({
      title: 'Disconnect SendGrid Outbox?',
      message: 'Are you sure you want to unlink your SendGrid outbox? Live email campaigns will be paused until reconnected.',
      variant: 'danger',
      confirmText: 'Disconnect',
      cancelText: 'Keep Connected'
    });

    if (!confirmed) return;

    setIsDisconnecting(true);
    try {
      await axios.delete('http://localhost:3001/api/outreach/disconnect-mailbox', {
        headers: { userid: user?._id }
      });
      setConnectedMailbox(null);
      setVerificationSuccess(null);
      setVerificationError(null);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('Failed to disconnect mailbox:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Render x SendGrid Theme Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/10 shrink-0">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">Render &amp; SendGrid Cloud Outbox</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Port 443 HTTPS
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Render-approved Web API transport. Zero socket timeouts, no port 587/465 blocks.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Render Cloud Architecture Notice */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white font-medium">Render Cloud Egress Notice:</strong> Render blocks outbound SMTP ports 587 and 465. Strovr transmits cold outreach via SendGrid Web API over standard HTTPS (Port 443).
              </span>
            </div>
            <div className="shrink-0 hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>100 Free/Day</span>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 pb-2 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sendgrid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sendgrid'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>SendGrid Web API Setup</span>
          </button>
          <button
            onClick={() => setActiveTab('render_env')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'render_env'
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Render Environment Variables Guide</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">

          {/* Active Outbox Status Banner */}
          {isLoadingStatus ? (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-slate-400">Verifying live outbox connection...</span>
            </div>
          ) : connectedMailbox ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Outbox Active: {connectedMailbox.fromEmail || connectedMailbox.user}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SendGrid HTTPS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sender: <span className="text-slate-300">{connectedMailbox.fromName}</span> • Transport: <span className="text-slate-300 font-mono">api.sendgrid.com:443</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{isDisconnecting ? 'Unlinking...' : 'Disconnect'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-slate-300 text-xs">
                <strong className="text-white">No SendGrid outbox connected.</strong> Follow the 3-minute steps below to connect your free SendGrid account and launch live email campaigns on Render.
              </p>
            </div>
          )}

          {/* Verification Alert Messages */}
          {verificationSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{verificationSuccess}</span>
            </div>
          )}

          {verificationError && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-center gap-2.5 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{verificationError}</span>
            </div>
          )}

          {/* TAB 1: SENDGRID WEB API SETUP */}
          {activeTab === 'sendgrid' && (
            <div className="space-y-5">
              
              {/* Step by step guide */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                      SendGrid API Key
                    </span>
                    <a
                      href="https://app.sendgrid.com/settings/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium hover:underline"
                    >
                      <span>Open Keys</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Log in to SendGrid &gt; Settings &gt; API Keys &gt; Create API Key. Select "Full Access" (or "Mail Send"), then copy your key (starts with <code className="text-blue-300 font-mono">SG.</code>).
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                      Sender Verification
                    </span>
                    <a
                      href="https://app.sendgrid.com/settings/sender_auth/senders/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium hover:underline"
                    >
                      <span>Verify Sender</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    SendGrid requires a verified sender. Add your name and email under "Single Sender Verification", then click the confirmation link in your inbox.
                  </p>
                </div>
              </div>

              {/* Input Form */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>SendGrid API Key</span>
                    <span className="text-[10px] text-slate-500 font-mono">Starts with "SG."</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={connectedMailbox ? '••••••••••••••••••••••••••••••••' : 'e.g. SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                      className="w-full h-9 pl-3 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Verified Sender Email</label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="e.g. alex@yourdomain.com"
                      className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-[10px] text-slate-500">Must match your SendGrid verified single sender.</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Sender Display Name</label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="e.g. Alex Rivera | Strovr"
                      className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-[10px] text-slate-500">Name shown to email recipients.</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Reply-To Email Address (Optional)</span>
                    <span className="text-[10px] text-slate-500">Defaults to sender email</span>
                  </label>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="e.g. replies@yourdomain.com"
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Real Test Ping Box */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendTestEmail}
                      onChange={(e) => setSendTestEmail(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 font-medium">Send real verification test email on connect</span>
                  </label>

                  {sendTestEmail && (
                    <div className="pl-6 space-y-1">
                      <input
                        type="email"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        placeholder="Recipient email address for test message"
                        className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <span className="text-[10px] text-slate-500">A live test message will be delivered via SendGrid HTTPS API to verify end-to-end receipt.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RENDER ENVIRONMENT GUIDE */}
          {activeTab === 'render_env' && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Terminal className="w-4 h-4" />
                <span>Zero-Config Render Environment Variables</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                If you prefer not to enter your API key in the UI, you can inject it directly through your Render Dashboard. Strovr automatically detects system environment keys!
              </p>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
                <div className="text-slate-400"># In Render Dashboard &gt; Service &gt; Environment:</div>
                <div className="text-emerald-400">SENDGRID_API_KEY=<span className="text-slate-300">SG.your_sendgrid_api_key_here</span></div>
                <div className="text-emerald-400">SENDGRID_FROM_EMAIL=<span className="text-slate-300">your_verified_sender@domain.com</span></div>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <p><strong>Benefits on Render:</strong></p>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li>Never stored in browser storage.</li>
                  <li>Persistent across container redeploys.</li>
                  <li>Automatically used as default outbox for cold outreach and scheduler notifications.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>SSL encrypted via SendGrid Web API</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerifyAndConnect}
              disabled={isVerifying}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying via HTTPS (Port 443)...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>{connectedMailbox ? 'Update SendGrid Outbox' : 'Verify & Connect Outbox'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmailProviderModal;
