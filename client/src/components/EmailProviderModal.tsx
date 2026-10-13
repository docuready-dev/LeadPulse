import { useState, useEffect } from 'react';
import axios from 'axios';
import { alertDialog } from './AppConfirmModal';
import { 
  X, Mail, ShieldCheck, Check, 
  Loader2, Sparkles, Send, CheckCircle2, AlertCircle
} from 'lucide-react';

interface EmailProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSaved?: () => void;
}

const EmailProviderModal = ({ isOpen, onClose, user, onSaved }: EmailProviderModalProps) => {
  if (!isOpen) return null;

  const [provider, setProvider] = useState<'gmail' | 'resend' | 'sendgrid' | 'custom' | 'test'>('gmail');
  
  // Gmail fields
  const [gmailUser, setGmailUser] = useState(user?.email || '');
  const [gmailAppPass, setGmailAppPass] = useState('');
  
  // Resend fields
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState(user?.email || 'onboarding@resend.dev');

  // SendGrid fields
  const [sendgridApiKey, setSendgridApiKey] = useState('');
  const [sendgridFromEmail, setSendgridFromEmail] = useState(user?.email || 'outreach@leadpulse.io');

  // Custom SMTP fields
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  // General fields
  const [fromName, setFromName] = useState(user?.name || 'LeadPulse Operator');
  const [fromEmail, setFromEmail] = useState(user?.email || 'outreach@leadpulse.io');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Load existing configuration
  useEffect(() => {
    const fetchConfig = async () => {
      if (!user?._id) return;
      try {
        const res = await axios.get('http://localhost:3001/api/outreach/smtp-config', {
          headers: { userid: user._id }
        });
        if (res.data) {
          if (res.data.provider) setProvider(res.data.provider);
          if (res.data.user) {
            setGmailUser(res.data.user);
            setSmtpUser(res.data.user);
          }
          if (res.data.pass) {
            setGmailAppPass(res.data.pass);
            setSmtpPass(res.data.pass);
          }
          if (res.data.resendApiKey) setResendApiKey(res.data.resendApiKey);
          if (res.data.sendgridApiKey) setSendgridApiKey(res.data.sendgridApiKey);
          if (res.data.host) setSmtpHost(res.data.host);
          if (res.data.port) setSmtpPort(String(res.data.port));
          if (res.data.fromName) setFromName(res.data.fromName);
          if (res.data.fromEmail) setFromEmail(res.data.fromEmail);
        }
      } catch (err) {
        console.error('Failed to load SMTP settings:', err);
      }
    };
    fetchConfig();
  }, [user?._id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payload: any = {
        provider,
        fromName,
        fromEmail
      };

      if (provider === 'gmail') {
        payload.user = gmailUser;
        payload.pass = gmailAppPass;
      } else if (provider === 'resend') {
        payload.resendApiKey = resendApiKey;
        payload.fromEmail = resendFromEmail;
      } else if (provider === 'sendgrid') {
        payload.sendgridApiKey = sendgridApiKey;
        payload.fromEmail = sendgridFromEmail;
      } else if (provider === 'custom') {
        payload.host = smtpHost;
        payload.port = parseInt(smtpPort) || 587;
        payload.user = smtpUser;
        payload.pass = smtpPass;
      }

      await axios.post('http://localhost:3001/api/outreach/smtp-config', payload, {
        headers: { userid: user?._id }
      });

      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      await alertDialog({
        title: 'Mail Gateway Error',
        message: err.response?.data?.error || 'Failed to save email gateway settings.',
        variant: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestToInbox = async () => {
    setIsSendingTest(true);
    setTestStatus(null);
    try {
      const customSmtp: any = { provider, fromName, fromEmail };
      if (provider === 'gmail') {
        customSmtp.user = gmailUser;
        customSmtp.pass = gmailAppPass;
      } else if (provider === 'resend') {
        customSmtp.resendApiKey = resendApiKey;
        customSmtp.fromEmail = resendFromEmail;
      } else if (provider === 'sendgrid') {
        customSmtp.sendgridApiKey = sendgridApiKey;
        customSmtp.fromEmail = sendgridFromEmail;
      } else if (provider === 'custom') {
        customSmtp.host = smtpHost;
        customSmtp.port = parseInt(smtpPort) || 587;
        customSmtp.user = smtpUser;
        customSmtp.pass = smtpPass;
      }

      const res = await axios.post('http://localhost:3001/api/outreach/dispatch-single', {
        templateId: 'one_column',
        templateData: {
          subject: '⚡ LeadPulse Live Inbox Delivery Test',
          headline: 'Real-Time Inbox Verification Succeeded!',
          body: `This test message was dispatched via your configured ${provider.toUpperCase()} mail transport directly into your inbox at ${user?.email || 'your email'}.`
        },
        customRecipientEmail: user?.email || 'ashleyghose64@gmail.com',
        fromName,
        fromEmail: provider === 'resend' ? resendFromEmail : provider === 'sendgrid' ? sendgridFromEmail : fromEmail,
        customSmtp
      }, {
        headers: { userid: user?._id }
      });

      if (res.data.success) {
        setTestStatus(`Delivered to ${res.data.recipient}! Check your real inbox.`);
      } else {
        setTestStatus(`Failed: ${res.data.result?.response || 'Delivery error'}`);
      }
    } catch (err: any) {
      setTestStatus(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-md w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Email Dispatch Provider Settings</h2>
              <p className="text-xs text-slate-500">Configure your real SMTP or API gateway for direct inbox placement.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Provider Selection Tabs */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-delight font-medium text-slate-600 uppercase tracking-wider">Select Mail Provider</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setProvider('gmail')}
                className={`p-2 rounded-md border text-center transition-all cursor-pointer font-delight font-medium ${
                  provider === 'gmail' 
                    ? 'border-slate-900 bg-slate-50 text-slate-900 font-bold ring-1 ring-slate-900' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">Gmail</div>
                <div className="text-[10px] text-slate-400">App Password</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('resend')}
                className={`p-2 rounded-md border text-center transition-all cursor-pointer font-delight font-medium ${
                  provider === 'resend' 
                    ? 'border-purple-600 bg-purple-50/50 text-purple-950 font-bold ring-1 ring-purple-600' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">Resend</div>
                <div className="text-[10px] text-slate-400">REST API</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('sendgrid')}
                className={`p-2 rounded-md border text-center transition-all cursor-pointer font-delight font-medium ${
                  provider === 'sendgrid' 
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold ring-1 ring-emerald-600' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">SendGrid</div>
                <div className="text-[10px] text-slate-400">High Volume</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('custom')}
                className={`p-2 rounded-md border text-center transition-all cursor-pointer font-delight font-medium ${
                  provider === 'custom' 
                    ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold ring-1 ring-blue-600' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">Custom</div>
                <div className="text-[10px] text-slate-400">SMTP Host</div>
              </button>
            </div>
          </div>

          {/* 1. GMAIL CONFIG */}
          {provider === 'gmail' && (
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  To send from Gmail, generate a 16-character <strong>App Password</strong> at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">myaccount.google.com/apppasswords</a>.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Gmail Address</label>
                <input 
                  type="email"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Gmail 16-Character App Password</label>
                <input 
                  type="password"
                  value={gmailAppPass}
                  onChange={(e) => setGmailAppPass(e.target.value)}
                  placeholder="abcd efgh ijkl mnop"
                  className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          )}

          {/* 2. RESEND CONFIG */}
          {provider === 'resend' && (
            <div className="p-3.5 rounded-md bg-purple-50/30 border border-purple-200 space-y-3">
              <div className="flex items-start gap-2 text-xs text-purple-900">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p>
                  Get your free API key from <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-purple-700 underline font-semibold">resend.com</a> for zero-config direct inbox delivery.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Resend API Key</label>
                <input 
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_123456789..."
                  className="w-full h-8 px-2.5 bg-white border border-purple-200 rounded-md text-xs font-delight font-medium text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Verified Sender Email</label>
                <input 
                  type="email"
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                  placeholder="onboarding@resend.dev or yourdomain.com"
                  className="w-full h-8 px-2.5 bg-white border border-purple-200 rounded-md text-xs font-delight font-medium text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>
          )}

          {/* 3. SENDGRID API CONFIG */}
          {provider === 'sendgrid' && (
            <div className="p-3.5 rounded-md bg-emerald-50/40 border border-emerald-200 space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  SendGrid Web API v3 bypasses port blocking and delivers directly through authenticated high-volume IP pools. Get your key at <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">app.sendgrid.com</a>.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">SendGrid API Key</label>
                <input 
                  type="password"
                  value={sendgridApiKey}
                  onChange={(e) => setSendgridApiKey(e.target.value)}
                  placeholder="SG.xxxxxxxxxxxx..."
                  className="w-full h-8 px-2.5 bg-white border border-emerald-200 rounded-md text-xs font-delight font-medium text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Sender Email</label>
                <input 
                  type="email"
                  value={sendgridFromEmail}
                  onChange={(e) => setSendgridFromEmail(e.target.value)}
                  placeholder="outreach@yourdomain.com"
                  className="w-full h-8 px-2.5 bg-white border border-emerald-200 rounded-md text-xs font-delight font-medium text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          {/* 4. CUSTOM SMTP */}
          {provider === 'custom' && (
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">SMTP Host</label>
                  <input 
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.sendgrid.net"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Port</label>
                  <input 
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">SMTP Username</label>
                  <input 
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="apikey / user"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">SMTP Password</label>
                  <input 
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sender Identity */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Sender Display Name</label>
              <input 
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name | Company"
                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">From Email Address</label>
              <input 
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="outreach@yourcompany.com"
                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testStatus && (
            <div className={`p-2.5 rounded-md text-xs font-delight font-medium flex items-center gap-2 ${
              testStatus.startsWith('Delivered') 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}>
              {testStatus.startsWith('Delivered') ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
              <span>{testStatus}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSendTestToInbox}
            disabled={isSendingTest}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 h-8 px-3 rounded-md text-xs font-delight font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-blue-600" />}
            <span>Send Live Test to My Inbox</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-md text-xs font-delight font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-4 rounded-md text-xs font-delight font-medium transition-all flex items-center gap-1.5 cursor-pointer border border-slate-900 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Provider Settings</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmailProviderModal;
