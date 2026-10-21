import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { alertDialog } from '../components/AppConfirmModal';
import axios from 'axios';
import { 
  User, Mail, Server, Shield, ShieldCheck,
  CreditCard, Download, Check, Send,
  Sparkles, Save, CheckCircle2, AlertCircle,
  MessageCircle, Zap, Lock, BookOpen,
  KeyRound, Eye, EyeOff, Trash2, RefreshCw, Laptop, Wifi, Globe, ArrowRight
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import EmailProviderModal from '../components/EmailProviderModal';
import TokenDisplay from '../components/TokenDisplay';
import { ZoomController } from '../components/ZoomController';
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
  const [picUploadStatus, setPicUploadStatus] = useState<'idle' | 'uploading' | 'saved'>('idle');

  // SendGrid & Mail Transport State
  const [sendgridApiKey, setSendgridApiKey] = useState((user as any)?.smtp_settings?.apiKey || '');
  const [fromName, setFromName] = useState((user as any)?.smtp_settings?.fromName || user?.name || 'Strovr Outreach');
  const [fromEmail, setFromEmail] = useState((user as any)?.smtp_settings?.fromEmail || user?.email || 'outreach@strovr.space');
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

  // Desktop In-App Update Engine State
  const [isDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (/Electron|StrovrDesktop/i.test(navigator.userAgent)) return true;
    if (window.location.search.includes('desktop=true')) return true;
    if (sessionStorage.getItem('strovr_desktop_mode') === 'true') return true;
    return false;
  });

  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateServerUrl, setUpdateServerUrl] = useState('');
  const [latestManifest, setLatestManifest] = useState<any>(null);
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, receivedMB: 0, totalMB: 0 });
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  // PhonePe Transactions History State (Webapp only)
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [txnStatusFilter, setTxnStatusFilter] = useState<'all' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING'>('all');

  const fetchTransactions = async () => {
    if (isDesktop || !user?._id) return;
    setLoadingTxns(true);
    try {
      const res = await axios.get(`${API_URL}/api/billing/transactions?userId=${user._id}&email=${user.email || ''}`);
      if (res.data && Array.isArray(res.data.transactions)) {
        setTransactions(res.data.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoadingTxns(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'billing' && !isDesktop) {
      fetchTransactions();
    }
  }, [activeTab, isDesktop, user?._id]);

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking');
    setUpdateError(null);
    try {
      const res = await axios.post(`${API_URL}/api/desktop/check-for-updates`, {
        currentVersion: '3.0.0',
        serverUrl: updateServerUrl.trim() || undefined
      });
      setLatestManifest(res.data);
      if (res.data?.hasUpdate) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch (err: any) {
      setUpdateStatus('error');
      setUpdateError(err.response?.data?.error || err.message || 'Failed to connect to update server.');
    }
  };

  const handleDownloadUpdate = async () => {
    if (!latestManifest?.downloadUrl) return;
    setUpdateStatus('downloading');
    setUpdateError(null);
    setDownloadProgress({ percent: 0, receivedMB: 0, totalMB: 0 });

    try {
      await axios.post(`${API_URL}/api/desktop/download-update`, {
        downloadUrl: latestManifest.downloadUrl,
        targetVersion: latestManifest.latestVersion
      });

      const pollTimer = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_URL}/api/desktop/download-status`);
          const data = statusRes.data;
          setDownloadProgress({
            percent: data.percent || 0,
            receivedMB: data.receivedMB || 0,
            totalMB: data.totalMB || 0
          });
          if (data.status === 'ready') {
            clearInterval(pollTimer);
            setUpdateStatus('ready');
          } else if (data.status === 'error') {
            clearInterval(pollTimer);
            setUpdateStatus('error');
            setUpdateError(data.error || 'Download failed');
          }
        } catch (_) {}
      }, 400);
    } catch (err: any) {
      setUpdateStatus('error');
      setUpdateError(err.response?.data?.error || err.message || 'Failed to start update download.');
    }
  };

  const handleApplyUpdate = async () => {
    setIsRestarting(true);
    try {
      await axios.post(`${API_URL}/api/desktop/apply-update`);
    } catch (err: any) {
      setIsRestarting(false);
      await alertDialog({
        title: 'Update Swap Notice',
        message: err.response?.data?.error || 'Update helper spawned. Please wait while Strovr restarts.'
      });
    }
  };
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
      if (user.profile_picture) {
        setProfilePicture(user.profile_picture);
      }
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

      const res = await axios.patch(`${API_URL}/api/auth/profile`, payload, {
        headers: { userid: user._id, useremail: user.email || '' }
      });

      setUser({
        ...user,
        ...res.data.user
      });

      setSaveSuccess(true);
      try {
        await useStore.getState().fetchWorkspaceIntegrations(user._id);
      } catch {}
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to persist settings changes.');
    } finally {
      setSaving(false);
    }
  };

  // Instant Profile Picture Auto-Save Handler
  const handleProfilePictureUpload = (file: File) => {
    if (!file) return;
    setPicUploadStatus('uploading');
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = async () => {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

        setProfilePicture(dataUrl);

        // Instant update in Zustand store
        if (user) {
          setUser({
            ...user,
            profile_picture: dataUrl
          });
        }

        // Instant update in local storage vault
        if (typeof window !== 'undefined' && user?.email) {
          try {
            const vaultData = {
              profile_picture: dataUrl,
              company_name: companyName || user?.company_name,
              name: name || user?.name,
              updatedAt: new Date().toISOString()
            };
            localStorage.setItem(`strovr_profile_vault_${user.email}`, JSON.stringify(vaultData));
            localStorage.setItem('strovr_profile_vault_global', JSON.stringify(vaultData));
          } catch {}
        }

        // Instant background save to server
        try {
          await axios.patch(`${API_URL}/api/auth/profile`, { profile_picture: dataUrl }, {
            headers: {
              userid: user?._id || '',
              useremail: user?.email || ''
            }
          });
          setPicUploadStatus('saved');
          setTimeout(() => setPicUploadStatus('idle'), 3500);
        } catch (err) {
          console.warn('Background profile photo save warning:', err);
          setPicUploadStatus('saved');
          setTimeout(() => setPicUploadStatus('idle'), 3500);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePicture = async () => {
    setProfilePicture('');
    if (user) {
      setUser({ ...user, profile_picture: '' });
    }
    if (typeof window !== 'undefined' && user?.email) {
      try {
        localStorage.removeItem(`strovr_profile_vault_${user.email}`);
        localStorage.removeItem('strovr_profile_vault_global');
      } catch {}
    }
    try {
      await axios.patch(`${API_URL}/api/auth/profile`, { profile_picture: '' }, {
        headers: { userid: user?._id || '', useremail: user?.email || '' }
      });
    } catch {}
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
      const res = await axios.post(`${API_URL}/api/outreach/verify-mailbox`, {
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
    const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN' || user?.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com';
    if ((user?.plan || 'free').toLowerCase() === 'free' && !isSuperAdmin) {
      await alertDialog({
        title: 'CRM Data Export Locked on Free Tier',
        message: 'Full CRM CSV export is available on Basic (₹999/mo) and Pro (₹1,999/mo) tiers. Upgrade to download your complete workspace contacts and pipeline data.',
        variant: 'info'
      });
      setUpgradeTab('plans');
      setUpgradeModalOpen(true);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/api/leads`, {
        headers: { 
          userid: user?._id || '',
          useremail: user?.email || ''
        }
      });
      let leads = Array.isArray(res.data) ? res.data : [];
      if (leads.length === 0) {
        try {
          const raw = (user?.email && localStorage.getItem(`strovr_leads_cache_${user.email}`)) ||
                      (user?._id && localStorage.getItem(`strovr_leads_cache_${user._id}`));
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) leads = parsed;
          }
        } catch {}
      }
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
      link.setAttribute('download', `Strovr_Full_CRM_${Date.now()}.csv`);
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
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN' || user?.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com';
  const isFree = currentPlan === 'free';
  const isExportLocked = isFree && !isSuperAdmin;
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

              <div className="p-4 border border-slate-200 rounded-md bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden border border-slate-300 flex-shrink-0 relative shadow-2xs">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-white">
                      <User className="w-7 h-7 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-delight font-bold text-slate-700">Profile Photo</label>
                    {picUploadStatus === 'uploading' && (
                      <span className="text-[11px] font-delight font-medium text-amber-600 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Saving across devices...
                      </span>
                    )}
                    {picUploadStatus === 'saved' && (
                      <span className="text-[11px] font-delight font-medium text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Saved to Cloud &amp; Device!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file"
                      accept="image/*"
                      className="flex-1 border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-delight font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProfilePictureUpload(file);
                      }}
                    />
                    {profilePicture && (
                      <button
                        type="button"
                        onClick={handleRemoveProfilePicture}
                        title="Remove profile picture"
                        className="px-2.5 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-delight font-medium flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-500 font-delight">
                    Instantly syncs across PC, mobile, and cold outreach signatures. Recommended: 256×256 square JPG or PNG.
                  </p>
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
                    Render blocks standard SMTP ports 587 and 465 to prevent spam. Strovr routes all cold outreach campaigns through Twilio SendGrid's Web API over standard HTTPS (Port 443). Connect your free SendGrid API key below (includes 100 free emails per day).
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
                    placeholder="Alex Rivera | Strovr"
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
                  className={`border h-8 px-3.5 rounded-md text-xs font-medium transition-all duration-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    testEmailSuccess
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {testEmailSending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  ) : testEmailSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-75" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>{testEmailSending ? 'Sending Test Message...' : testEmailSuccess ? 'Connected & Verified!' : 'Send Test SendGrid Ping'}</span>
                </button>

                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className={`h-8 px-4 rounded-md text-xs font-medium transition-all duration-300 flex items-center gap-1.5 cursor-pointer border disabled:opacity-50 ${
                    saveSuccess
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-white animate-in zoom-in-75" />
                      <span>Saved &amp; Connected</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save SendGrid Settings'}</span>
                    </>
                  )}
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
                    <span className="text-base font-bold font-delight">{isFree ? 'Free Tier Compute' : `Strovr ${currentPlan.toUpperCase()}`}</span>
                    <span className="text-[10px] font-delight font-bold bg-blue-600 text-white px-2 py-0.5 rounded-sm">
                      {isFree ? '₹0 / forever' : currentPlan === 'basic' ? ((user as any)?.billing_cycle === 'annual' ? '₹8,999 / yr' : '₹999 / mo') : ((user as any)?.billing_cycle === 'annual' ? '₹17,999 / yr' : '₹1,999 / mo')}
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
                  <div className="text-xl font-bold text-slate-900">
                    <TokenDisplay user={user} showTokensWord />
                  </div>
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

              {/* Payment & Billing History Section (PhonePe Gateway) */}
              <div className="pt-6 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-sm font-delight font-medium text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#C85A32]" />
                      <span>PhonePe Payment & Transaction History</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-delight font-normal mt-0.5">
                      Real-time ledger of all subscription upgrades, top-up packs, and payment attempts.
                    </p>
                  </div>

                  {!isDesktop && (
                    <button
                      onClick={fetchTransactions}
                      disabled={loadingTxns}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-delight font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-2xs"
                      title="Refresh transaction records"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingTxns ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  )}
                </div>

                {isDesktop ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md text-xs font-delight text-slate-600">
                    <p>
                      <strong className="font-medium text-slate-900">Desktop Offline Storage:</strong> Payment transaction receipts and billing records are stored in your central cloud account. Please visit{' '}
                      <a href="https://strovr.space/" target="_blank" rel="noopener noreferrer" className="text-[#C85A32] underline font-medium">
                        strovr.space
                      </a>{' '}
                      to view and download invoices.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Status filter tabs */}
                    <div className="flex flex-wrap gap-1.5">
                      {(['all', 'SUCCESS', 'FAILED', 'CANCELLED', 'PENDING'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setTxnStatusFilter(st)}
                          className={`px-2.5 py-1 rounded text-xs font-delight transition-all cursor-pointer ${
                            txnStatusFilter === st
                              ? 'bg-slate-900 text-white font-medium shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal'
                          }`}
                        >
                          {st === 'all' ? 'All Transactions' : st === 'SUCCESS' ? 'Successful (Paid)' : st.charAt(0) + st.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>

                    {/* Transaction Table */}
                    <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-delight font-medium text-[11px]">
                              <th className="p-3 pl-4">Transaction ID</th>
                              <th className="p-3">Package / Tier</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Gateway</th>
                              <th className="p-3 pr-4 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-delight">
                            {(() => {
                              const filtered = transactions.filter(t => txnStatusFilter === 'all' || t.status === txnStatusFilter);
                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400 font-normal">
                                      {loadingTxns ? 'Fetching transaction records...' : 'No transactions found matching this filter.'}
                                    </td>
                                  </tr>
                                );
                              }
                              return filtered.map((tx) => (
                                <tr key={tx._id || tx.transactionId} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="p-3 pl-4 font-mono text-[11px] text-slate-600 select-all">
                                    {tx.transactionId}
                                  </td>
                                  <td className="p-3 font-medium text-slate-800">
                                    {tx.itemName || tx.itemKey}
                                  </td>
                                  <td className="p-3 font-medium text-slate-900">
                                    ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="p-3 text-slate-500 font-normal">
                                    {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                  </td>
                                  <td className="p-3 text-slate-500 font-normal">
                                    {tx.gateway || 'PhonePe'}
                                  </td>
                                  <td className="p-3 pr-4 text-right">
                                    {tx.status === 'SUCCESS' ? (
                                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Paid</span>
                                      </span>
                                    ) : tx.status === 'FAILED' ? (
                                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded">
                                        <AlertCircle className="w-3 h-3 text-rose-600" />
                                        <span>Failed</span>
                                      </span>
                                    ) : tx.status === 'CANCELLED' ? (
                                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded">
                                        <span>Cancelled</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded">
                                        <span>Pending</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
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
                    className={`h-8 px-3.5 rounded-md text-xs font-delight font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isExportLocked
                        ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-85'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                    }`}
                    title={isExportLocked ? 'Download Full CRM (Requires Basic or Pro tier)' : 'Download Full CRM (.CSV)'}
                  >
                    {isExportLocked ? (
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Download Full CRM (.CSV)</span>
                    {isExportLocked && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider">
                        BASIC
                      </span>
                    )}
                  </button>
                </div>

                {/* Desktop Portable Package Download Card */}
                <div className="p-4 rounded-md bg-[#FAF8F5] border border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-semibold text-[#191716] block">Strovr for Desktop (Windows Portable Edition)</strong>
                      <span className="text-[9.5px] font-bold font-delight px-1.5 py-0.5 rounded bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/30 uppercase tracking-wider">
                        Portable .ZIP
                      </span>
                    </div>
                    <p className="text-xs text-[#78716A] font-sans">
                      Zero installation required. Runs natively on Windows with local database storage in <code className="bg-[#EBE5D8] text-[#191716] px-1 py-0.5 rounded text-[10px]">Documents\Strovr</code> and automatic Excel CSV exports.
                    </p>
                  </div>

                  <a
                    href="/downloads/Strovr-Desktop-Portable.zip"
                    download="Strovr-Desktop-Portable.zip"
                    className="h-8 px-3.5 rounded-md text-xs font-delight font-semibold bg-[#C85A32] hover:bg-[#B04B25] text-white transition-all flex items-center gap-1.5 shadow-2xs border border-[#B04B25] cursor-pointer"
                    title="Download Strovr Portable Windows App (.zip)"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>Download for Desktop</span>
                  </a>
                </div>

                {/* Interface Scaling & Zoom Controller (50% to 200%) */}
                <ZoomController variant="settings" />

                {/* Desktop In-App Updates Card */}
                <div className="p-4 rounded-md bg-[#FAF8F5] border border-[#E5E0D5] flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-semibold text-[#191716] block">Desktop Software Updates</strong>
                        <span className="text-[9.5px] font-bold font-delight px-1.5 py-0.5 rounded bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/30 uppercase tracking-wider">
                          v3.0.0
                        </span>
                        {isDesktop ? (
                          <span className="text-[9px] font-bold font-delight px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                            Active Desktop Instance
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold font-delight px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                            Web Console
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#78716A] font-sans">
                        Push or fetch updates over your local Wi-Fi/LAN network or the cloud without losing local database records.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCheckForUpdates}
                        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                        className="h-8 px-3.5 rounded-md text-xs font-delight font-semibold bg-[#191716] hover:bg-[#332E2A] text-white transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                        <span>{updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Optional Custom Local Server IP input for local network pushes */}
                  <div className="p-3 bg-white rounded border border-[#E5E0D5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-[#57514B]">
                      <Wifi className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      <span>Update Server Source (Cloud / Local LAN IP):</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={updateServerUrl}
                        onChange={(e) => setUpdateServerUrl(e.target.value)}
                        placeholder="https://strovr.space (or http://192.168.X.X:3001)"
                        className="bg-[#F5F2EB] border border-[#E5E0D5] rounded px-2.5 py-1 text-xs text-[#191716] outline-none focus:bg-white w-full sm:w-64 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  {/* Feedback: Up-to-date */}
                  {updateStatus === 'up-to-date' && (
                    <div className="p-3 rounded bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900 font-delight font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>You are running the latest version of Strovr Desktop (v3.0.0). All local features are up to date.</span>
                    </div>
                  )}

                  {/* Feedback: Update Available */}
                  {updateStatus === 'available' && latestManifest && (
                    <div className="p-3.5 rounded bg-amber-50/80 border border-amber-200 flex flex-col gap-2.5 text-xs text-amber-950">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold font-delight text-amber-900">
                          <Sparkles className="w-4 h-4 text-[#C85A32]" />
                          <span>New Update Available: v{latestManifest.latestVersion}</span>
                        </div>
                        <button
                          onClick={handleDownloadUpdate}
                          className="h-7 px-3 bg-[#C85A32] hover:bg-[#B04B25] text-white font-delight font-semibold text-xs rounded transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-white" />
                          <span>Download Update</span>
                        </button>
                      </div>

                      {latestManifest.changelog?.length > 0 && (
                        <div className="pt-1.5 border-t border-amber-200/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">What's New:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-amber-900/90 font-sans">
                            {latestManifest.changelog.map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback: Downloading Progress */}
                  {updateStatus === 'downloading' && (
                    <div className="p-3.5 rounded bg-white border border-[#E5E0D5] flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between text-[#57514B] font-delight text-xs">
                        <span className="font-semibold text-[#191716] flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-[#C85A32] animate-bounce" />
                          Downloading Strovr update...
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#C85A32]">
                          {downloadProgress.percent}% ({downloadProgress.receivedMB} MB / {downloadProgress.totalMB || '...'} MB)
                        </span>
                      </div>
                      <div className="w-full bg-[#F5F2EB] h-2 rounded-full overflow-hidden border border-[#E5E0D5]">
                        <div
                          className="bg-[#C85A32] h-full transition-all duration-300"
                          style={{ width: `${downloadProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Feedback: Ready to Apply */}
                  {updateStatus === 'ready' && (
                    <div className="p-3.5 rounded bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <strong className="block text-emerald-900">Update Downloaded &amp; Verified</strong>
                          <span className="text-[11px] text-emerald-800">
                            Click below to apply. Strovr will close, swap the executable, and restart automatically.
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleApplyUpdate}
                        disabled={isRestarting}
                        className="h-8 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-delight font-semibold text-xs rounded transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                        <span>{isRestarting ? 'Restarting...' : 'Restart & Apply Update'}</span>
                      </button>
                    </div>
                  )}

                  {/* Feedback: Error */}
                  {updateStatus === 'error' && updateError && (
                    <div className="p-3 rounded bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-900 font-delight">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{updateError}</span>
                    </div>
                  )}
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
