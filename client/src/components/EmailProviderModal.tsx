import { useState, useEffect } from 'react';
import axios from 'axios';
import { alertDialog } from './AppConfirmModal';
import { 
  X, Check, 
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff,
  Server, Lock, Unlink, Send, ShieldCheck, Mail,
  Globe, ExternalLink, ChevronDown, ChevronUp,
  Sparkles, Info, Key, BookOpen
} from 'lucide-react';

interface EmailProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSaved?: () => void;
}

interface DomainPreset {
  id: 'custom' | 'google' | 'microsoft' | 'zoho' | 'relay';
  name: string;
  shortName: string;
  subtitle: string;
  icon: any;
  defaultHost: (email: string) => string;
  defaultPort: string;
  defaultSecure: boolean;
  usernameHint: string;
  passwordType: string;
  appPasswordUrl?: string;
  steps: string[];
  troubleshooting: string;
}

const DOMAIN_PRESETS: DomainPreset[] = [
  {
    id: 'custom',
    name: 'Custom Domain / cPanel',
    shortName: 'Custom Domain',
    subtitle: 'Private business domains, cPanel, Webmail, Hostinger, GoDaddy, Namecheap',
    icon: Globe,
    defaultHost: (email: string) => {
      const domain = email.includes('@') ? email.split('@')[1] : 'yourdomain.com';
      return `mail.${domain}`;
    },
    defaultPort: '587',
    defaultSecure: false,
    usernameHint: 'Full email address (e.g. name@yourdomain.com)',
    passwordType: 'Standard email account password (or webmail password)',
    steps: [
      'Enter your mail server host, typically mail.yourdomain.com (or the server hostname provided by your hosting provider, such as cpanelXXX.hostingprovider.com).',
      'Port 587 with STARTTLS is recommended. If your hosting provider requires explicit SSL, choose Port 465 with SSL/TLS checked.',
      'Enter your full email address as the username (e.g. alex@yourdomain.com). Do not enter just the username prefix.',
      'Enter your standard email account password. If your domain uses custom DNS, verify SPF (v=spf1...) and DKIM records for optimal inbox delivery.'
    ],
    troubleshooting: 'If port 587 times out, switch to port 465 with SSL/TLS checked. Many home and cloud networks block port 25 or 587.'
  },
  {
    id: 'google',
    name: 'Google Workspace / Gmail',
    shortName: 'Google / Gmail',
    subtitle: 'Personal @gmail.com or business domain hosted on Google Workspace',
    icon: Mail,
    defaultHost: () => 'smtp.gmail.com',
    defaultPort: '587',
    defaultSecure: false,
    usernameHint: 'Full Google address (e.g. you@yourcompany.com or you@gmail.com)',
    passwordType: '16-character Google App Password (NOT your normal password)',
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    steps: [
      'Server Host is smtp.gmail.com on Port 587 (STARTTLS) or Port 465 (SSL/TLS).',
      'Username must be your complete Google email address (including @yourcompany.com or @gmail.com).',
      'CRITICAL: You MUST use a 16-character Google App Password. Your regular Google login password will be rejected with error 535.',
      'How to generate your App Password: Go to Google Account > Security > Turn 2-Step Verification ON > Go to App Passwords > Create a new password named "LeadPulse Outbox" > Copy the 16 letters and paste into the password field below.'
    ],
    troubleshooting: 'If verification fails with 535 Authentication Failed, 2-Step Verification is required to generate a dedicated App Password. Regular passwords are blocked by Google.'
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365 / Outlook',
    shortName: 'Microsoft 365',
    subtitle: 'Office 365, Exchange Online, Hotmail, Outlook.com',
    icon: Server,
    defaultHost: (email: string) => {
      const lower = email.toLowerCase();
      return (lower.includes('@outlook.com') || lower.includes('@hotmail.com') || lower.includes('@live.com')) 
        ? 'smtp-mail.outlook.com' 
        : 'smtp.office365.com';
    },
    defaultPort: '587',
    defaultSecure: false,
    usernameHint: 'Full Microsoft email (e.g. you@company.com)',
    passwordType: 'Account password (or App Password if MFA is active)',
    steps: [
      'For Microsoft 365 business accounts, use smtp.office365.com on Port 587 (STARTTLS, SSL unchecked).',
      'For personal Outlook or Hotmail accounts, use smtp-mail.outlook.com on Port 587.',
      'Enter your complete Microsoft email address as the username.',
      'Tenant Admin Note: If sending fails, ensure Authenticated Client SMTP is enabled in Microsoft 365 Admin Center > Users > Active Users > Mail > Manage email apps.'
    ],
    troubleshooting: 'If rejected, check that modern Authenticated Client SMTP is enabled for your mailbox in your Microsoft 365 tenant settings.'
  },
  {
    id: 'zoho',
    name: 'Zoho Mail',
    shortName: 'Zoho Mail',
    subtitle: 'Custom business domain hosted on Zoho or personal @zoho.com',
    icon: ShieldCheck,
    defaultHost: (email: string) => {
      return email.toLowerCase().includes('@zoho.com') ? 'smtp.zoho.com' : 'smtppro.zoho.com';
    },
    defaultPort: '465',
    defaultSecure: true,
    usernameHint: 'Full Zoho address (e.g. contact@yourdomain.com)',
    passwordType: 'Application-Specific Password from Zoho Security',
    appPasswordUrl: 'https://accounts.zoho.com/#security/app_password',
    steps: [
      'For custom domain organizations on Zoho, use smtppro.zoho.com on Port 465 (SSL/TLS checked).',
      'For personal @zoho.com accounts, use smtp.zoho.com on Port 465 (SSL) or Port 587 (STARTTLS).',
      'Enter your full registered Zoho email as the username.',
      'Zoho requires an Application-Specific Password: Log in to accounts.zoho.com > Security > App Passwords > Generate New Password and paste it into the password field below.'
    ],
    troubleshooting: 'Do not use your main Zoho login password if Two-Factor Authentication (TFA) is enabled on your Zoho account.'
  },
  {
    id: 'relay',
    name: 'Cloud SMTP Relay',
    shortName: 'Cloud Relay',
    subtitle: 'Amazon SES, SendGrid, Mailgun, Postmark, Brevo, or custom relays',
    icon: Sparkles,
    defaultHost: () => 'smtp.sendgrid.net',
    defaultPort: '587',
    defaultSecure: false,
    usernameHint: 'Provided SMTP username (e.g. "apikey" for SendGrid)',
    passwordType: 'SMTP API Key or Secret provided by your relay',
    steps: [
      'Enter the outbound SMTP endpoint provided by your service (e.g. smtp.sendgrid.net, smtp.mailgun.org, or email-smtp.us-east-1.amazonaws.com).',
      'Port 587 with STARTTLS is standard for almost all cloud relay platforms.',
      'Enter the designated username (for SendGrid this is the word "apikey"; for AWS SES this is your generated SMTP username).',
      'Enter your secret API key as the password, and ensure your "From Email" domain is verified in your cloud provider dashboard.'
    ],
    troubleshooting: 'Ensure the sender domain or "From Email" is pre-verified in your relay provider dashboard to avoid bounce or rejection.'
  }
];

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

  // Domain Guide State
  const [selectedDomainPreset, setSelectedDomainPreset] = useState<'custom' | 'google' | 'microsoft' | 'zoho' | 'relay'>('custom');
  const [showInstructions, setShowInstructions] = useState(true);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

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

          // Infer active domain preset
          const hostLower = (mb.host || '').toLowerCase();
          if (hostLower.includes('gmail.com') || hostLower.includes('google')) {
            setSelectedDomainPreset('google');
          } else if (hostLower.includes('office365') || hostLower.includes('outlook')) {
            setSelectedDomainPreset('microsoft');
          } else if (hostLower.includes('zoho')) {
            setSelectedDomainPreset('zoho');
          } else if (hostLower.includes('sendgrid') || hostLower.includes('mailgun') || hostLower.includes('amazonaws')) {
            setSelectedDomainPreset('relay');
          } else {
            setSelectedDomainPreset('custom');
          }
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

  // Apply domain preset settings
  const handleApplyPreset = (preset: DomainPreset) => {
    setSelectedDomainPreset(preset.id);
    const hostVal = preset.defaultHost(fromEmail || smtpUser || user?.email || '');
    setSmtpHost(hostVal);
    setSmtpPort(preset.defaultPort);
    setSmtpSecure(preset.defaultSecure);
    setAppliedToast(`Applied ${preset.shortName} host (${hostVal}:${preset.defaultPort})`);
    setTimeout(() => setAppliedToast(null), 3000);
  };

  // Detect domain from input email address
  const detectedPresetId = (() => {
    const email = (fromEmail || smtpUser || '').trim().toLowerCase();
    if (!email.includes('@')) return null;
    if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com')) return 'google';
    if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com') || email.endsWith('@live.com')) return 'microsoft';
    if (email.endsWith('@zoho.com') || email.endsWith('@zohomail.com')) return 'zoho';
    const domain = email.split('@')[1];
    if (domain && domain.includes('.') && !domain.endsWith('local')) return 'custom';
    return null;
  })();

  const activePreset = DOMAIN_PRESETS.find(p => p.id === selectedDomainPreset) || DOMAIN_PRESETS[0];

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
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto">
        
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
            <p className="text-xs text-indigo-100 mt-1 max-w-lg leading-relaxed font-delight">
              Connect any standard email account or custom domain to dispatch live outreach emails. Dedicated outbound socket connection with zero inbox syncing or reading.
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

        {/* Body Form & Instructions */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">

          {/* INTERACTIVE DOMAIN INSTRUCTIONS & PRESET SELECTOR */}
          <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-b from-indigo-50/50 to-white overflow-hidden shadow-2xs font-delight">
            <div className="p-3.5 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Domain Setup Guide &amp; Instructions</h4>
                  <p className="text-[11px] text-indigo-700">Select your email provider or domain type below for tailored step-by-step instructions.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200/80 shadow-2xs"
              >
                <span>{showInstructions ? 'Hide Instructions' : 'Show Instructions'}</span>
                {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showInstructions && (
              <div className="p-3.5 space-y-3">
                {/* Domain Category Selector Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {DOMAIN_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isActive = selectedDomainPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedDomainPreset(preset.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{preset.shortName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Preset Instructions Card */}
                {activePreset && (
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{activePreset.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({activePreset.subtitle})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {appliedToast && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md animate-in fade-in">
                            {appliedToast}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(activePreset)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>Auto-Fill Host &amp; Port</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Specifications Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Host / Server</span>
                        <span className="font-mono font-bold text-slate-800 break-all">
                          {activePreset.defaultHost(fromEmail || smtpUser || user?.email || '')}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Port &amp; Security</span>
                        <span className="font-mono font-bold text-slate-800">
                          {activePreset.defaultPort} ({activePreset.defaultSecure ? 'SSL/TLS' : 'STARTTLS'})
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Username</span>
                        <span className="font-medium text-slate-800">Full email address</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Password Type</span>
                        <span className="font-medium text-slate-800 truncate block" title={activePreset.passwordType}>
                          {activePreset.passwordType}
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Step-by-Step Instructions
                      </span>
                      <div className="space-y-1.5">
                        {activePreset.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-slate-600 leading-relaxed text-[11px]">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* External Link if app password generator exists */}
                    {activePreset.appPasswordUrl && (
                      <div className="pt-1">
                        <a
                          href={activePreset.appPasswordUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Open {activePreset.shortName} App Password Generator</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Troubleshooting Tip */}
                    <div className="p-2.5 bg-amber-50/70 rounded-lg border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Troubleshooting Tip: </strong>
                        <span>{activePreset.troubleshooting}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Auto-Detect Hint */}
          {detectedPresetId && detectedPresetId !== selectedDomainPreset && (
            <div className="p-2.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl flex items-center justify-between gap-2 font-delight text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-indigo-900">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  Detected email domain: <strong>{DOMAIN_PRESETS.find(p => p.id === detectedPresetId)?.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = DOMAIN_PRESETS.find(p => p.id === detectedPresetId);
                  if (target) handleApplyPreset(target);
                }}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer shrink-0"
              >
                Switch to this guide &amp; auto-fill
              </button>
            </div>
          )}

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
              <span className="text-[11px] font-bold text-slate-500 uppercase">Port Presets:</span>
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
              <p className="text-[10px] text-slate-400 font-delight mt-1">
                Always enter your complete email address (including domain).
              </p>
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
                  placeholder={
                    connectedMailbox?.hasPassword 
                      ? '••••••••••••••••' 
                      : activePreset.id === 'google' 
                        ? '16-character Google App Password' 
                        : activePreset.id === 'zoho'
                          ? 'Zoho Application Password'
                          : 'Enter account password'
                  }
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
              <p className="text-[10px] text-slate-400 font-delight mt-1">
                {activePreset.id === 'google' ? 'Requires 16-character Google App Password (not login password).' : 'Never shared. Kept encrypted for outbound transport.'}
              </p>
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
