import { useState, useEffect } from 'react';
import axios from 'axios';
import { alertDialog } from './AppConfirmModal';
import { 
  X, Check, 
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff,
  Server, Lock, Unlink, Send, ShieldCheck, Mail
} from 'lucide-react';

interface EmailProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSaved?: () => void;
}

const EmailProviderModal = ({ isOpen, onClose, user, onSaved }: EmailProviderModalProps) => {
  if (!isOpen) return null;

  // Form Fields for Standard SMTP Outbox
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Load active mailbox status on open
  useEffect(() => {
    const fetchStatus = async () => {
      if (!user?._id) return;
      setIsLoadingStatus(true);
      try {
        const res = await axios.get('http://localhost:3001/api/outreach/mailbox', {
          headers: { userid: user._id }
        });
        if (res.data?.isConnected && res.data.mailbox) {
          const mb = res.data.mailbox;
          setConnectedMailbox(mb);
          setSmtpHost(mb.host || '');
          setSmtpPort(String(mb.port || '587'));
          setSmtpSecure(Boolean(mb.secure));
          setSmtpUser(mb.user || '');
          setFromName(mb.fromName || user?.name || '');
          setFromEmail(mb.fromEmail || mb.user || user?.email || '');
          setReplyTo(mb.replyTo || mb.fromEmail || mb.user || user?.email || '');
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
  }, [user?._id]);

  // Handle port quick presets
  const handlePortSelect = (portNum: string, secureVal: boolean) => {
    setSmtpPort(portNum);
    setSmtpSecure(secureVal);
  };

  const handleVerifyAndConnect = async () => {
    const cleanHost = smtpHost.trim();
    const cleanUser = smtpUser.trim();
    const cleanPass = smtpPass.trim();

    if (!cleanHost) {
      setVerificationError('Please enter your SMTP server host (e.g. mail.yourdomain.com).');
      return;
    }
    if (!cleanUser) {
      setVerificationError('Please enter your SMTP username or account email.');
      return;
    }
    if (!cleanPass && !connectedMailbox) {
      setVerificationError('Please enter your SMTP password.');
      return;
    }

    setIsVerifying(true);
    setVerificationSuccess(null);
    setVerificationError(null);

    try {
      const payload = {
        host: cleanHost,
        port: parseInt(smtpPort) || 587,
        secure: smtpSecure,
        user: cleanUser,
        pass: cleanPass || (connectedMailbox?.hasPassword ? undefined : ''),
        fromName: fromName.trim() || user?.name || 'Outreach Specialist',
        fromEmail: (fromEmail || cleanUser).trim(),
        replyTo: (replyTo || fromEmail || cleanUser).trim(),
        sendTestPing: sendTestEmail,
        testRecipient: testRecipient.trim() || cleanUser
      };

      const res = await axios.post('http://localhost:3001/api/outreach/verify-mailbox', payload, {
        headers: { userid: user?._id }
      });

      if (res.data.success) {
        setVerificationSuccess(res.data.message || 'SMTP outbox verified and connected successfully!');
        setConnectedMailbox(res.data.mailbox);
        setSmtpPass('');
        if (onSaved) onSaved();
      } else {
        setVerificationError(res.data.error || 'Failed to verify SMTP connection.');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'SMTP connection verification failed.';
      setVerificationError(errMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await axios.delete('http://localhost:3001/api/outreach/disconnect-mailbox', {
        headers: { userid: user?._id }
      });
      setConnectedMailbox(null);
      setSmtpPass('');
      setVerificationSuccess(null);
      setVerificationError(null);
      if (onSaved) onSaved();
      await alertDialog({
        title: 'SMTP Outbox Disconnected',
        message: 'Your sending mailbox has been unlinked. Live outreach dispatches will require an active SMTP outbox or direct webmail sending.',
        variant: 'info'
      });
    } catch (err: any) {
      await alertDialog({
        title: 'Disconnection Error',
        message: err.response?.data?.error || 'Failed to disconnect mailbox.',
        variant: 'error'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-start justify-between shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-white font-delight text-[11px] font-bold mb-2">
              <Server className="w-3.5 h-3.5" />
              <span>Standard SMTP Outbox</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-delight">
              Outbox Mail Settings
            </h2>
            <p className="text-xs text-indigo-100 mt-1 max-w-md leading-relaxed font-delight">
              Connect any standard SMTP server to dispatch live outreach emails. Dedicated outbound socket connection with zero inbox syncing or reading.
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

        {/* Active Outbox Banner if Connected */}
        {connectedMailbox ? (
          <div className="px-5 py-3.5 bg-emerald-50/80 border-b border-emerald-200/90 flex items-center justify-between gap-3 font-delight">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1.5">
                  <span>Outbox Active:</span>
                  <span className="font-semibold text-emerald-800">{connectedMailbox.fromEmail || connectedMailbox.user}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-md">
                    {connectedMailbox.host}:{connectedMailbox.port}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  Verified socket connection ready for automated dispatch
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
        ) : (
          <div className="px-5 py-3 bg-amber-50/70 border-b border-amber-200/80 flex items-center gap-2 text-xs font-delight text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>No SMTP outbox configured.</strong> Add your standard SMTP credentials below to enable live email delivery.
            </span>
          </div>
        )}

        {/* Body Form */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">

          {/* Form Fields: Host & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                SMTP Server / Host <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="e.g. mail.yourdomain.com or smtp.server.net"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Port Presets & SSL Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-delight">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Presets:</span>
              <button
                type="button"
                onClick={() => handlePortSelect('587', false)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  smtpPort === '587' && !smtpSecure
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
              >
                587 (STARTTLS)
              </button>
              <button
                type="button"
                onClick={() => handlePortSelect('465', true)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  smtpPort === '465' && smtpSecure
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
              >
                465 (SSL/TLS)
              </button>
              <button
                type="button"
                onClick={() => handlePortSelect('25', false)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  smtpPort === '25'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
              >
                25 (Standard)
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-[11px] font-medium text-slate-700">SSL/TLS Secure</span>
            </label>
          </div>

          {/* Form Fields: Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                SMTP Username / Account <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => {
                    setSmtpUser(e.target.value);
                    if (!fromEmail) setFromEmail(e.target.value);
                    if (!replyTo) setReplyTo(e.target.value);
                  }}
                  placeholder="e.g. outreach@yourdomain.com"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                SMTP Password {connectedMailbox && <span className="text-slate-400 font-normal">(Leave blank to keep existing)</span>} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={connectedMailbox?.hasPassword ? '••••••••••••••••' : 'Enter account password'}
                  className="w-full pl-9 pr-9 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Sender Identity Details */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-[11px] font-bold font-delight uppercase tracking-wider text-slate-400">
              Sender Identity &amp; Routing
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="e.g. John Doe | Outreach"
                  className="w-full px-3 py-2 text-xs font-delight rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="e.g. outreach@yourdomain.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-delight text-slate-700 mb-1">
                  Reply-To Email
                </label>
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="e.g. john@yourdomain.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Test Ping Options */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendTestEmail}
                  onChange={(e) => setSendTestEmail(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold font-delight text-slate-700">
                  Send real verification test email on save
                </span>
              </label>
            </div>

            {sendTestEmail && (
              <div className="pl-5">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Recipient email address for test ping"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Verification Feedback Alerts */}
          {verificationSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 font-delight text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Verification Succeeded</div>
                <div className="text-emerald-700 mt-0.5 leading-relaxed">{verificationSuccess}</div>
              </div>
            </div>
          )}

          {verificationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 font-delight text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Verification Failed</div>
                <div className="text-rose-700 mt-0.5 leading-relaxed">{verificationError}</div>
              </div>
            </div>
          )}

          {/* Security & Architecture Guarantee Footnote */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-[11px] font-delight text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Direct Outbox Architecture &amp; Privacy Guarantee</span>
            </div>
            <p>
              LeadPulse connects solely to your outbound SMTP socket to transmit authorized outreach campaigns. Your inbox, private conversations, and contacts are never accessed, read, or synchronized.
            </p>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 font-delight">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleVerifyAndConnect}
            disabled={isVerifying || !smtpHost.trim() || !smtpUser.trim() || (!smtpPass.trim() && !connectedMailbox)}
            className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isVerifying || !smtpHost.trim() || !smtpUser.trim() || (!smtpPass.trim() && !connectedMailbox)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-200'
            }`}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Socket Connection...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Verify &amp; Save Outbox</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EmailProviderModal;
