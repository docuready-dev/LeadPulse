import { useState, useEffect } from 'react';
import axios from 'axios';
import { alertDialog } from './AppConfirmModal';
import { 
  X, ShieldCheck, Check, 
  Loader2, Sparkles, Send, CheckCircle2, AlertCircle, Eye, EyeOff,
  Globe, Server, Lock, Unlink
} from 'lucide-react';

interface EmailProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSaved?: () => void;
}

export type MailProviderType = 'gmail' | 'brevo' | 'outlook' | 'yahoo' | 'zoho' | 'icloud' | 'custom' | 'resend';

const EmailProviderModal = ({ isOpen, onClose, user, onSaved }: EmailProviderModalProps) => {
  if (!isOpen) return null;

  const [provider, setProvider] = useState<MailProviderType>('gmail');
  
  // Credentials
  const [emailAccount, setEmailAccount] = useState(user?.email || '');
  const [accountPassword, setAccountPassword] = useState('');
  const [fromName, setFromName] = useState(user?.name || 'LeadPulse Growth Director');
  const [showPassword, setShowPassword] = useState(false);

  // Custom SMTP settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);

  // Resend API
  const [resendApiKey, setResendApiKey] = useState('');

  // Verification & test states
  const [sendTestEmail, setSendTestEmail] = useState(true);
  const [testRecipient, setTestRecipient] = useState(user?.email || 'ashleyghose64@gmail.com');
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
          setConnectedMailbox(res.data.mailbox);
          setProvider(res.data.mailbox.provider || 'gmail');
          setEmailAccount(res.data.mailbox.user || user?.email || '');
          setFromName(res.data.mailbox.fromName || user?.name || '');
          if (res.data.mailbox.host) setSmtpHost(res.data.mailbox.host);
          if (res.data.mailbox.port) setSmtpPort(String(res.data.mailbox.port));
        }
      } catch (err) {
        console.error('Failed to load mailbox status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchStatus();
  }, [user?._id]);

  // Automatic provider detection based on email domain (Mail App behavior)
  const handleEmailChange = (val: string) => {
    setEmailAccount(val);
    const domain = val.toLowerCase().split('@')[1] || '';
    if (domain.includes('gmail.com') || domain.includes('googlemail.com')) {
      setProvider('gmail');
    } else if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('office365.com')) {
      setProvider('outlook');
    } else if (domain.includes('yahoo.com') || domain.includes('ymail.com')) {
      setProvider('yahoo');
    } else if (domain.includes('zoho.com') || domain.includes('zohomail.com')) {
      setProvider('zoho');
    } else if (domain.includes('icloud.com') || domain.includes('me.com') || domain.includes('mac.com')) {
      setProvider('icloud');
    } else if (domain.includes('brevo.com') || domain.includes('sendinblue.com')) {
      setProvider('brevo');
    }
  };

  const handleVerifyAndConnect = async () => {
    setIsVerifying(true);
    setVerificationSuccess(null);
    setVerificationError(null);

    try {
      const payload: any = {
        provider,
        user: emailAccount.trim(),
        pass: accountPassword.trim(),
        fromName: fromName.trim() || 'LeadPulse Growth Director',
        fromEmail: emailAccount.trim(),
        sendTestPing: sendTestEmail,
        testRecipient: testRecipient.trim() || emailAccount.trim()
      };

      if (provider === 'custom') {
        payload.host = smtpHost.trim();
        payload.port = parseInt(smtpPort) || 587;
        payload.secure = smtpSecure;
      } else if (provider === 'resend') {
        payload.resendApiKey = resendApiKey.trim();
      }

      const res = await axios.post('http://localhost:3001/api/outreach/verify-mailbox', payload, {
        headers: { userid: user?._id }
      });

      if (res.data.success) {
        setVerificationSuccess(res.data.message || 'Mailbox verified and connected successfully!');
        setConnectedMailbox(res.data.mailbox);
        if (onSaved) onSaved();
      } else {
        setVerificationError(res.data.error || 'Failed to verify mailbox.');
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
      setAccountPassword('');
      setVerificationSuccess(null);
      setVerificationError(null);
      if (onSaved) onSaved();
      await alertDialog({
        title: 'Mailbox Disconnected',
        message: 'Your sending mailbox has been unlinked. You can connect another email account whenever you are ready.',
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-start justify-between shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-white font-delight text-[11px] font-bold mb-2">
              <Server className="w-3.5 h-3.5" />
              <span>Mail App Architecture (Send-Only Outbox)</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-delight">
              Connect Sending Mailbox
            </h2>
            <p className="text-xs text-indigo-100 mt-1 max-w-md leading-relaxed font-delight">
              Connect any email account to dispatch live outreach. Dedicated outbox connection with zero inbox syncing or reading.
            </p>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Mailbox Banner if Connected */}
        {connectedMailbox && (
          <div className="px-5 py-3 bg-emerald-50/70 border-b border-emerald-200/80 flex items-center justify-between gap-3 font-delight">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1.5">
                  <span>Connected:</span>
                  <span className="font-semibold text-emerald-800">{connectedMailbox.fromEmail || connectedMailbox.user}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-emerald-200/60 text-emerald-900 rounded-md">
                    {connectedMailbox.provider}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  Verified & Ready to deliver real outreach emails
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

        {/* Body Form */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Provider Selection Tiles */}
          <div>
            <label className="block text-[11px] font-delight font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Email Service
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'gmail', label: 'Gmail', sub: 'Google Workspace', highlight: 'Featured (500/day)' },
                { id: 'brevo', label: 'Brevo Free', sub: 'Single Free Platform', highlight: '300/Day Free' },
                { id: 'outlook', label: 'Outlook', sub: 'Office 365 / Hotmail', highlight: 'Microsoft' },
                { id: 'yahoo', label: 'Yahoo Mail', sub: 'App Password', highlight: 'Yahoo SMTP' },
                { id: 'zoho', label: 'Zoho Mail', sub: 'App Password', highlight: 'Business Email' },
                { id: 'icloud', label: 'iCloud', sub: 'Apple ID Password', highlight: 'iCloud SMTP' },
                { id: 'custom', label: 'Custom SMTP', sub: 'Any Domain Host', highlight: 'Standard SMTP' },
                { id: 'resend', label: 'Resend API', sub: 'Cloud REST API', highlight: 'Developer API' }
              ].map((p) => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id as MailProviderType)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-delight flex flex-col justify-between ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-indigo-200 text-slate-700 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold truncate flex items-center justify-between">
                        <span>{p.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.sub}</div>
                    </div>
                    <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.2 rounded-md mt-1.5 self-start">
                      {p.highlight}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider Specific Helper Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-delight leading-relaxed space-y-1.5">
            {provider === 'gmail' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Gmail &amp; Google Workspace Setup Guide</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Google requires a 16-character <strong>App Password</strong> instead of your personal login password.
                </p>
                <div className="pt-1">
                  <a 
                    href="https://myaccount.google.com/apppasswords" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    <span>Generate Google App Password</span>
                    <span>&rarr;</span>
                  </a>
                </div>
              </>
            )}

            {provider === 'brevo' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Single Most Trustful &amp; Free Platform (300 Free Emails / Day)</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Brevo gives you 300 free delivered emails every day forever (9,000/mo) with zero credit card required.
                </p>
                <div className="pt-1">
                  <a 
                    href="https://app.brevo.com/settings/keys/smtp" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    <span>Get Free Brevo SMTP Key (app.brevo.com)</span>
                    <span>&rarr;</span>
                  </a>
                </div>
              </>
            )}

            {provider === 'outlook' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Microsoft Outlook &amp; Office 365 Setup</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Enter your Outlook/Hotmail/Office 365 email and password. If 2-Step Verification is enabled, generate an App Password in your Microsoft Account Security settings.
                </p>
              </>
            )}

            {provider === 'yahoo' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Lock className="w-4 h-4 text-purple-600" />
                  <span>Yahoo Mail App Password Setup</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Yahoo requires an App Password. Generate one in Yahoo Account Security &rarr; Manage App Passwords.
                </p>
              </>
            )}

            {provider === 'zoho' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>Zoho Mail App Password Setup</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Generate an Application-Specific Password in Zoho Accounts &rarr; Security &rarr; App Passwords.
                </p>
              </>
            )}

            {provider === 'icloud' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Lock className="w-4 h-4 text-slate-800" />
                  <span>Apple iCloud Mail Setup</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Generate an App-Specific Password at appleid.apple.com under Sign-In and Security.
                </p>
              </>
            )}

            {provider === 'custom' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Server className="w-4 h-4 text-slate-800" />
                  <span>Custom Business SMTP Gateway</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Connect your company's private mail server or custom hosting email (cPanel, Namecheap, Hostinger, GoDaddy).
                </p>
              </>
            )}

            {provider === 'resend' && (
              <>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Resend Cloud REST API</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Modern developer API delivering over HTTPS on port 443. Enter your API key from resend.com.
                </p>
              </>
            )}
          </div>

          {/* Core Credentials Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-delight font-bold text-slate-700 mb-1">
                Sender Display Name
              </label>
              <input 
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Ashley Ghose | LeadPulse"
                className="w-full h-9 px-3 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-delight font-medium text-slate-900 outline-none transition-all"
              />
            </div>

            {provider !== 'resend' ? (
              <>
                <div>
                  <label className="block text-xs font-delight font-bold text-slate-700 mb-1">
                    {provider === 'brevo' ? 'Brevo SMTP Login Email' : 'Email Address'}
                  </label>
                  <input 
                    type="email"
                    value={emailAccount}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder={provider === 'gmail' ? 'yourname@gmail.com' : provider === 'outlook' ? 'yourname@outlook.com' : 'contact@yourdomain.com'}
                    className="w-full h-9 px-3 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-delight font-medium text-slate-900 outline-none transition-all"
                  />
                  <span className="text-[10px] text-slate-400 font-delight mt-1 block">
                    Typing your email automatically preconfigures server endpoints for you.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-delight font-bold text-slate-700 mb-1">
                    {provider === 'brevo' ? 'Brevo SMTP Master Key' : provider === 'gmail' ? 'Google 16-Character App Password' : 'Password / App Password'}
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder={provider === 'brevo' ? 'xsmtpsib-...' : provider === 'gmail' ? 'abcd efgh ijkl mnop' : '••••••••••••'}
                      className="w-full h-9 pl-3 pr-10 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-sans font-medium text-slate-900 outline-none transition-all"
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
              </>
            ) : (
              <div>
                <label className="block text-xs font-delight font-bold text-slate-700 mb-1">
                  Resend API Key
                </label>
                <input 
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_123456789..."
                  className="w-full h-9 px-3 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-sans font-medium text-slate-900 outline-none transition-all"
                />
              </div>
            )}

            {/* Custom SMTP host & port fields */}
            {provider === 'custom' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-delight font-bold text-slate-600 mb-1">SMTP Host</label>
                    <input 
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.yourdomain.com"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-delight outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-delight font-bold text-slate-600 mb-1">Port</label>
                    <input 
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-delight outline-none"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input 
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-delight text-slate-700">Use SSL (Port 465) instead of STARTTLS (Port 587)</span>
                </label>
              </div>
            )}
          </div>

          {/* Test Email Verification Checkbox */}
          <div className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox"
                checked={sendTestEmail}
                onChange={(e) => setSendTestEmail(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 cursor-pointer"
              />
              <span className="text-xs font-delight font-bold text-slate-800">
                Dispatch a real test verification email upon connecting
              </span>
            </label>

            {sendTestEmail && (
              <div className="pl-6">
                <input 
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Recipient inbox for verification test"
                  className="w-full h-8 px-2.5 bg-white border border-indigo-200 rounded-lg text-xs font-delight text-slate-800 outline-none"
                />
                <span className="text-[10px] text-slate-500 font-delight mt-1 block">
                  A live test email will be sent to this address to verify real deliverability.
                </span>
              </div>
            )}
          </div>

          {/* Live Feedback Messages */}
          {verificationSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-delight text-emerald-900 flex items-start gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Mailbox Verified &amp; Active!</strong>
                <p className="mt-0.5">{verificationSuccess}</p>
              </div>
            </div>
          )}

          {verificationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-delight text-rose-900 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Verification Failed</strong>
                <p className="mt-0.5">{verificationError}</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 font-delight">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleVerifyAndConnect}
            disabled={isVerifying || !emailAccount || (provider !== 'resend' && !accountPassword)}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-delight font-bold transition-all flex items-center gap-2 shadow-sm shadow-indigo-200 cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying &amp; Delivering Test...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Verify &amp; Connect Mailbox</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EmailProviderModal;
