import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { alertDialog } from '../components/AppConfirmModal';
import axios from 'axios';
import { 
  User, Mail, Server, Shield, ShieldCheck,
  CreditCard, Download, Check, Send,
  Sparkles, Save, CheckCircle2, AlertCircle,
  MessageCircle, Zap, Lock, BookOpen,
  KeyRound, Eye, EyeOff
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import EmailProviderModal from '../components/EmailProviderModal';
import API_URL from '../config/api';

type SettingsTab = 'profile' | 'security' | 'smtp' | 'outreach' | 'billing' | 'data';

const Settings = () => {
  const { user, setUser, setTopUpOpen, setUpgradeModalOpen, setUpgradeTab } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [fieldOfWork, setFieldOfWork] = useState(user?.field_of_work || '');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [niche, setNiche] = useState(user?.niche || '');
  const [targetAudience, setTargetAudience] = useState(user?.target_audience || '');
  const [goals, setGoals] = useState(user?.goals || '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || '');

  // SendGrid & Mail Transport State
  const [sendgridApiKey, setSendgridApiKey] = useState((user as any)?.smtp_settings?.apiKey || '');
  const [fromName, setFromName] = useState((user as any)?.smtp_settings?.fromName || user?.name || 'LeadPulse Outreach');
  const [fromEmail, setFromEmail] = useState((user as any)?.smtp_settings?.fromEmail || user?.email || 'outreach@leadpulse.io');
  const [replyTo, setReplyTo] = useState((user as any)?.smtp_settings?.replyTo || '');
  const [complianceFooter, setComplianceFooter] = useState(true);

  // WhatsApp & Outreach Defaults State
  const [autoAdvanceStage, setAutoAdvanceStage] = useState(true);
  const [defaultFallbackBusiness, setDefaultFallbackBusiness] = useState('Business Owner');
  const [defaultFallbackLocation, setDefaultFallbackLocation] = useState('your area');

  // Test Outbox state
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);

  // Password Update Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setCompanyName(user.company_name || '');
      setFieldOfWork(user.field_of_work || '');
      setPhone((user as any)?.phone || '');
      setNiche(user.niche || '');
      setTargetAudience(user.target_audience || '');
      setGoals(user.goals || '');
      setProfilePicture(user.profile_picture || '');
      if ((user as any)?.smtp_settings) {
        const s = (user as any).smtp_settings;
        if (s.apiKey) setSendgridApiKey(s.apiKey);
        if (s.fromName) setFromName(s.fromName);
        if (s.fromEmail) setFromEmail(s.fromEmail);
        if (s.replyTo) setReplyTo(s.replyTo);
      }
    }
  }, [user]);

  // Save Settings handler
  const handleSaveSettings = async () => {
    if (!user?._id) return;
    setSaving(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      const payload = {
        name,
        company_name: companyName,
        field_of_work: fieldOfWork,
        phone,
        niche,
        target_audience: targetAudience,
        goals,
        profile_picture: profilePicture,
        smtp_settings: {
          provider: 'sendgrid',
          apiKey: sendgridApiKey,
          fromName,
          fromEmail,
          replyTo: replyTo || fromEmail,
          complianceFooter
        },
        outreach_defaults: {
          autoAdvanceStage,
          defaultFallbackBusiness,
          defaultFallbackLocation
        }
      };

      const res = await axios.patch('http://localhost:3001/api/auth/profile', payload, {
        headers: { userid: user._id }
      });

      setUser({
        ...user,
        ...res.data.user
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to persist settings changes.');
    } finally {
      setSaving(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match. Please verify and re-enter.');
      return;
    }

    setPasswordUpdating(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/change-password`, {
        userId: user?._id,
        currentPassword,
        newPassword
      }, {
        headers: {
          userid: user?._id
        }
      });

      setPasswordSuccess(res.data?.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to update password. Please check your current password.');
    } finally {
      setPasswordUpdating(false);
    }
  };

  // Test SendGrid HTTPS Dispatch
  const handleTestSmtp = async () => {
    const keyToTest = sendgridApiKey || (user as any)?.smtp_settings?.apiKey;
    if (!keyToTest) {
      setErrorMsg('Please enter your SendGrid API Key before sending a test message.');
      return;
    }
    if (!fromEmail) {
      setErrorMsg('Please enter your verified sender email address.');
      return;
    }

    setTestEmailSending(true);
    setTestEmailSuccess(false);
    setTestResultMsg(null);
    setErrorMsg('');

    try {
      const res = await axios.post('http://localhost:3001/api/outreach/verify-mailbox', {
        apiKey: keyToTest,
        fromEmail,
        fromName,
        replyTo: replyTo || fromEmail,
        sendTestPing: true,
        testRecipient: user?.email || fromEmail
      }, {
        headers: { userid: user?._id }
      });

      if (res.data?.success) {
        setTestEmailSuccess(true);
        setTestResultMsg(res.data.message || 'Real test message delivered via SendGrid HTTPS (Port 443)!');
        setTimeout(() => setTestEmailSuccess(false), 5000);
      } else {
        setErrorMsg(res.data?.error || 'Test delivery failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.response?.data?.details || err.message || 'Test delivery failed.');
    } finally {
      setTestEmailSending(false);
    }
  };

  // Export CSV
  const handleExportAll = async () => {
    if ((user?.plan || 'free') === 'free') {
      setUpgradeTab('plans');
      setUpgradeModalOpen(true);
      return;
    }

    try {
      const res = await axios.get('http://localhost:3001/api/leads', {
        headers: { userid: user?._id }
      });
      const leads = res.data || [];
      if (leads.length === 0) {
        await alertDialog({
          title: 'Nothing to Export',
          message: 'No leads are currently available in your workspace to export.',
          variant: 'warning'
        });
        return;
      }

      const headers = ['Business Name', 'Category', 'Phone', 'Email', 'Status', 'Rating', 'Location'];
      const rows = leads.map((l: any) => [
        `"${l.businessName || ''}"`,
        `"${l.category || ''}"`,
        `"${l.phone || ''}"`,
        `"${l.email || ''}"`,
        `"${l.status || ''}"`,
        `"${l.rating || ''}"`,
        `"${l.location || ''}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `LeadPulse_Full_CRM_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      await alertDialog({
        title: 'Export Error',
        message: 'Failed to export leads. Please try again.',
        variant: 'error'
      });
    }
  };

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isFree = currentPlan === 'free';
  const credits = isFree && !(user as any)?.has_topup ? Math.min(user?.lead_credits ?? 15, 15) : (user?.lead_credits ?? 15);

  return (
    <div className="flex w-full min-h-screen bg-transparent font-sans text-slate-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Platform Settings & Configurations" />

        <div className="p-6 sm:p-8 space-y-5 overflow-y-auto max-w-5xl">
          
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Account & System Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage your user profile, direct email SMTP transport, WhatsApp defaults, and billing tier.</p>
            </div>

            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-xs font-delight font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Settings saved successfully!</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs font-delight font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-md animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Settings Tabs Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-xs font-delight font-medium">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profile' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile & Workspace</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'security' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>Password & Security</span>
            </button>

            <button
              onClick={() => setActiveTab('smtp')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'smtp' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-blue-500" />
              <span>Outbox &amp; SendGrid (Render)</span>
            </button>

            <button
              onClick={() => setActiveTab('outreach')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'outreach' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp & Automation</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'billing' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              <span>Subscription & Compute</span>
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'data' ? 'bg-slate-900 text-white border border-slate-900 shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Data Management</span>
            </button>
          </div>

          {/* TAB 1: PROFILE & WORKSPACE */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6 shadow-none space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Profile & Workspace Details</h3>
                <p className="text-xs text-slate-500">Configure your business identity to automatically populate merge tags across outbound campaigns.</p>
              </div>

              <div className="p-4 border border-slate-200 rounded-md bg-slate-50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-md bg-slate-200 overflow-hidden border border-slate-300 flex-shrink-0">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Upload Profile Picture</label>
                  <input 
                    type="file"
                    accept="image/*"
                    className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-delight font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 256;
                            const MAX_HEIGHT = 256;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > height) {
                              if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                              }
                            } else {
                              if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                width = MAX_HEIGHT;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            setProfilePicture(dataUrl);
                          };
                          img.src = reader.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Target Audience</label>
                  <input 
                    type="text" 
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-semibold text-xs text-slate-900 outline-none focus:border-slate-400"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. Local Dentists"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Primary Goal</label>
                  <input 
                    type="text" 
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-semibold text-xs text-slate-900 outline-none focus:border-slate-400"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="e.g. Book demo calls"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Full Name / Operator</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Account Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full h-8 px-2.5 bg-slate-100 border border-slate-200 rounded-md font-delight font-normal text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Company / Agency Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Growth Media"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Broad Industry Category</label>
                  <input
                    type="text"
                    value={fieldOfWork}
                    onChange={(e) => setFieldOfWork(e.target.value)}
                    placeholder="e.g. Healthcare B2B Marketing"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Specific Niche</label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g. Vegan Restaurants, Luxury Real Estate"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-delight text-[11px] font-medium text-slate-600">Business WhatsApp Contact Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-4 rounded-md font-delight font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-900 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving Changes...' : 'Save Profile'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: PASSWORD & SECURITY */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6 shadow-none space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 font-delight">Update Account Password</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Authentication Security
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-delight">
                    Confirm your current password to authorize setting a new password for {user?.email}.
                  </p>
                </div>
              </div>

              {/* Feedback Messages */}
              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 font-delight flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-delight flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 font-delight">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full h-9 pl-3 pr-9 border border-slate-300 rounded-md text-xs font-delight focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 font-delight">
                    New Password (Min 6 Characters) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-9 pl-3 pr-9 border border-slate-300 rounded-md text-xs font-delight focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 font-delight">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full h-9 pl-3 pr-9 border border-slate-300 rounded-md text-xs font-delight focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {newPassword && confirmNewPassword && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-delight">
                      {newPassword === confirmNewPassword ? (
                        <span className="text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={passwordUpdating || !currentPassword || newPassword.length < 6 || newPassword !== confirmNewPassword}
                    className="bg-[#C85A32] hover:bg-[#B34D28] text-white h-9 px-4 rounded-md font-delight font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-[#B34D28] disabled:opacity-50 shadow-xs"
                  >
                    {passwordUpdating ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Security Best Practices Notice */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md max-w-lg space-y-2 text-xs text-slate-600 font-delight">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Password Security Recommendations</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
                  <li>Use a minimum of 6 characters (8+ recommended) with numbers and symbols.</li>
                  <li>Avoid reusing passwords across other software or work accounts.</li>
                  <li>Your password secures all your harvested leads, CRM pipelines, and SendGrid mail tokens.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: MAIL DELIVERY & SENDGRID (RENDER OPTIMIZED) */}
          {activeTab === 'smtp' && (
            <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6 shadow-none space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 font-delight">Outbox Mail Transport Configuration</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Render Cloud Ready (Port 443 HTTPS)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-delight mt-0.5">
                    Twilio SendGrid REST Web API over secure HTTPS. Zero socket timeouts, no port 587/465 blocks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-delight font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Interactive SendGrid Guide</span>
                </button>
              </div>

              {/* Render Cloud Architecture Alert */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 text-xs font-delight">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-900 block">Render Cloud Egress Architecture</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Render blocks standard SMTP ports 587 and 465 to prevent spam. LeadPulse routes all cold outreach campaigns through Twilio SendGrid's Web API over standard HTTPS (Port 443). Connect your free SendGrid API key below (includes 100 free emails per day).
                  </p>
                </div>
              </div>

              {testResultMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{testResultMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-delight">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 flex items-center justify-between">
                    <span>SendGrid API Key</span>
                    <span className="text-[10px] text-slate-400 font-mono">Starts with "SG."</span>
                  </label>
                  <input
                    type="password"
                    value={sendgridApiKey}
                    onChange={(e) => setSendgridApiKey(e.target.value)}
                    placeholder="e.g. SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-mono text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Verified Sender Email</label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="alex@yourdomain.com"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                  <span className="text-[10px] text-slate-400">Must be verified in SendGrid Single Sender Verification.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Sender Display Name</label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="Alex Rivera | LeadPulse"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                  <span className="text-[10px] text-slate-400">Name prospects see in their email inbox.</span>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 flex items-center justify-between">
                    <span>Reply-To Email Address</span>
                    <span className="text-[10px] text-slate-400">Defaults to sender email</span>
                  </label>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="replies@yourdomain.com"
                    className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {/* Compliance Checkbox */}
              <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <strong className="text-slate-900 block font-semibold">Mandatory CAN-SPAM / GDPR Compliance Footer</strong>
                    <span className="text-slate-500">Automatically inject one-click unsubscribe links and sender physical address to maintain high deliverability.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={complianceFooter}
                  onChange={(e) => setComplianceFooter(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 font-delight">
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testEmailSending}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 h-8 px-3.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>{testEmailSending ? 'Sending Test Message...' : testEmailSuccess ? 'Test Delivered to Inbox!' : 'Send Test SendGrid Ping'}</span>
                </button>

                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-4 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border border-slate-900 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save SendGrid Settings'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP & AUTOMATION */}
          {activeTab === 'outreach' && (
            <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6 shadow-none space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">WhatsApp & Outreach Automation Defaults</h3>
                <p className="text-xs text-slate-500">Configure fallback parameters and automatic stage advancing for high-speed multi-channel execution.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold font-delight text-xs">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Organic WhatsApp Convenience Framing Script</span>
                  </div>
                  <p className="text-slate-700 text-xs italic bg-white p-2.5 rounded-sm border border-slate-200 font-sans">
                    "Instead of cramming files into messy WhatsApp chat history, what is the best email address to drop this over to?"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-delight text-[11px] font-medium text-slate-600">Fallback for Business Name (`&#123;&#123;business_name&#125;&#125;`)</label>
                    <input
                      type="text"
                      value={defaultFallbackBusiness}
                      onChange={(e) => setDefaultFallbackBusiness(e.target.value)}
                      placeholder="e.g. Business Owner or Partner"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-delight text-[11px] font-medium text-slate-600">Fallback for Location (`&#123;&#123;location&#125;&#125;`)</label>
                    <input
                      type="text"
                      value={defaultFallbackLocation}
                      onChange={(e) => setDefaultFallbackLocation(e.target.value)}
                      placeholder="e.g. your locality or your area"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-900 outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900 block font-semibold">Auto-Advance Pipeline Stage on Outreach Launch</strong>
                    <span className="text-slate-500">Automatically advance lead from "New" to "WhatsApp Contacted" or "Proposal Sent" upon clicking dispatch.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAdvanceStage}
                    onChange={(e) => setAutoAdvanceStage(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-4 rounded-md font-delight font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-900 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Automation Defaults'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BILLING & COMPUTE */}
          {activeTab === 'billing' && (
            <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6 shadow-none space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Current Subscription & Compute Tier</h3>
                  <p className="text-xs text-slate-500">Manage your B2B harvesting limits, auto-refresh schedule, and PhonePe payment history.</p>
                </div>
                <span className="text-[10px] font-delight font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
                  {currentPlan.toUpperCase()} TIER
                </span>
              </div>

              {/* Plan Card Banner */}
              <div className="p-5 rounded-md bg-slate-950 border border-slate-800 text-white flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-delight">{isFree ? 'Free Tier Compute' : `LeadPulse ${currentPlan.toUpperCase()}`}</span>
                    <span className="text-[10px] font-delight font-bold bg-blue-600 text-white px-2 py-0.5 rounded-sm">
                      {isFree ? '₹0 / forever' : currentPlan === 'basic' ? '₹699 / mo' : '₹1,999 / mo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isFree 
                      ? '15 Tokens / Saved Leads Pool (Auto-refreshes every 4 days) • Max 10 leads / query'
                      : currentPlan === 'basic' 
                        ? '600 Saved Leads & continuous daily harvesting • Unlimited CSV exports'
                        : 'Unlimited Saved Leads & 1,000 daily velocity • Dedicated Priority Worker'
                    }
                  </p>
                </div>

                <button
                  onClick={() => {
                    setUpgradeTab('plans');
                    setUpgradeModalOpen(true);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-900 h-8 px-3.5 rounded-md text-xs font-delight font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isFree ? 'Upgrade to Basic / Pro' : 'Manage Subscription'}</span>
                </button>
              </div>

              {/* Compute Pool Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-delight font-medium">
                <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Lead Balance</span>
                  <div className="text-xl font-bold text-slate-900">{credits} Credits</div>
                  <span className="text-[11px] text-slate-500 font-sans">Available to harvest</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Saved Leads Limit</span>
                  <div className="text-xl font-bold text-purple-700">
                    {isFree ? '15 Tokens / Leads' : currentPlan === 'basic' ? '600 Leads' : 'Unlimited'}
                  </div>
                  <span className="text-[11px] text-slate-500 font-sans">CRM capacity</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">One-Time Top-Up</span>
                  <div>
                    <button
                      onClick={() => setTopUpOpen(true)}
                      className="mt-0.5 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>Buy Top-Up Pack (₹50) →</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 font-sans">Instant PhonePe UPI</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DATA MANAGEMENT */}
          {activeTab === 'data' && (
            <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6 shadow-none space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Data Portability & Database Operations</h3>
                <p className="text-xs text-slate-500">Export your complete prospect dataset or clean up stale CRM pipeline records.</p>
              </div>

              <div className="space-y-3">
                {/* Export Card */}
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <strong className="text-xs font-semibold text-slate-900 block">Export All Verified Leads (CSV / Excel)</strong>
                    <p className="text-xs text-slate-500 font-sans">Download all extracted business names, direct emails, phone numbers, and pipeline stages.</p>
                  </div>

                  <button
                    onClick={handleExportAll}
                    className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-3.5 rounded-md text-xs font-delight font-medium transition-all flex items-center gap-1.5 cursor-pointer border border-slate-900"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Full CRM (.CSV)</span>
                    {isFree && <Lock className="w-3 h-3 text-amber-400" />}
                  </button>
                </div>

                {/* Cloud Firestore Sync Status */}
                <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <strong className="text-xs font-semibold text-emerald-950 block">Google Cloud Firestore Synchronized</strong>
                      <span className="text-[11px] text-emerald-800 font-sans">Your CRM data is automatically backed up and persisted with production service account credentials.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Outbox Mail Settings & Domain Instructions Modal */}
      <EmailProviderModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        user={user}
        onSaved={() => {}}
      />
    </div>
  );
};

export default Settings;
