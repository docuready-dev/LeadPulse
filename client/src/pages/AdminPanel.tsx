import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import API_URL from '../config/api';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Users, Activity, DollarSign, RefreshCw, Cpu, 
  Trash2, CheckCircle2, AlertTriangle, Download, Search, 
  Zap, Server, Database, ShieldCheck, Shield,
  CreditCard, RotateCcw, ArrowUpDown, ChevronDown, Check,
  X, Lock, Mail, ExternalLink, Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdminTab = 'overview' | 'users' | 'payments' | 'scraper' | 'credits' | 'leads';

interface StatsState {
  totalUsers: number;
  totalLeads: number;
  totalRevenue: number;
  scraper: {
    activeWorkers: number;
    queuedJobs: number;
    status: string;
  };
  system: {
    database: string;
    uptime: number;
    nodeVersion: string;
    memoryUsage: string;
  };
}

interface PlatformSettings {
  freeCreditsOnSignup: number;
  creditCostPerSearch: number;
  scraperConcurrency: number;
  scrapeTimeoutSecs: number;
  proxyRotation: boolean;
  deepEnrichment: boolean;
  smtpProvider: string;
  maxOutreachPerHour: number;
  complianceFooterEnforced: boolean;
  suppressionList: string[];
}

const AdminPanel = () => {
  const { user, token } = useStore();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Stats State
  const [stats, setStats] = useState<StatsState>({
    totalUsers: 0,
    totalLeads: 0,
    totalRevenue: 0,
    scraper: { activeWorkers: 0, queuedJobs: 0, status: 'IDLE' },
    system: { database: 'Google Cloud Firestore', uptime: 0, nodeVersion: '', memoryUsage: '0 MB' }
  });

  // 2. Users State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'SUPER_ADMIN' | 'USER'>('ALL');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<'ALL' | 'free' | 'basic' | 'pro'>('ALL');

  // 3. Transactions / Payments State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txSearch, setTxSearch] = useState('');

  // 4. System Settings State
  const [settings, setSettings] = useState<PlatformSettings>({
    freeCreditsOnSignup: 15,
    creditCostPerSearch: 1,
    scraperConcurrency: 2,
    scrapeTimeoutSecs: 30,
    proxyRotation: false,
    deepEnrichment: true,
    smtpProvider: 'System Nodemailer / SendGrid',
    maxOutreachPerHour: 50,
    complianceFooterEnforced: true,
    suppressionList: ['test@example.com', 'spam@domain.com']
  });
  const [newSuppressionItem, setNewSuppressionItem] = useState('');

  // 5. Global Leads State
  const [globalLeads, setGlobalLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState('');

  // Modals state
  const [creditModalUser, setCreditModalUser] = useState<any | null>(null);
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState('100');
  const [creditAdjustmentMode, setCreditAdjustmentMode] = useState<'add' | 'set'>('add');

  const [tierModalUser, setTierModalUser] = useState<any | null>(null);
  const [selectedTier, setSelectedTier] = useState<'free' | 'basic' | 'pro'>('free');

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4500);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4500);
    }
  };

  const getHeaders = () => {
    const uid = user?._id || (user as any)?.id || user?.email || 'user_ashleyghose64';
    const h: Record<string, string> = {
      userid: uid,
    };
    if (token) {
      h.authorization = `Bearer ${token}`;
    }
    const gw = (import.meta as any).env?.VITE_ADMIN_GATEWAY_SECRET;
    if (gw) {
      h['x-admin-gateway-token'] = gw;
    }
    return h;
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [statsRes, usersRes, txRes, settingsRes, leadsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { headers }).catch((err) => {
          console.warn('[Admin] Failed to fetch stats:', err?.response?.data || err.message);
          return { data: stats };
        }),
        axios.get(`${API_URL}/api/admin/users`, { headers }).catch((err) => {
          console.warn('[Admin] Failed to fetch users:', err?.response?.data || err.message);
          return { data: [] };
        }),
        axios.get(`${API_URL}/api/admin/transactions`, { headers }).catch((err) => {
          console.warn('[Admin] Failed to fetch transactions:', err?.response?.data || err.message);
          return { data: [] };
        }),
        axios.get(`${API_URL}/api/admin/settings`, { headers }).catch((err) => {
          console.warn('[Admin] Failed to fetch settings:', err?.response?.data || err.message);
          return { data: settings };
        }),
        axios.get(`${API_URL}/api/admin/leads`, { headers }).catch((err) => {
          console.warn('[Admin] Failed to fetch leads:', err?.response?.data || err.message);
          return { data: [] };
        })
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (Array.isArray(usersRes.data)) setUsers(usersRes.data);
      if (Array.isArray(txRes.data)) setTransactions(txRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
      if (Array.isArray(leadsRes.data)) setGlobalLeads(leadsRes.data);
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to sync admin telemetry', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user?._id, user?.email, token]);

  // Adjust User Credits
  const handleUpdateCredits = async (userId: string, amount: number, mode: 'add' | 'set' = 'add') => {
    try {
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/credits`,
        { amount, mode },
        { headers: getHeaders() }
      );
      showNotification('Successfully updated credits balance.');
      setCreditModalUser(null);
      fetchAllData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to update credits', true);
    }
  };

  // Change Tier / Plan
  const handleChangeTier = async (userId: string, newPlan: 'free' | 'basic' | 'pro') => {
    try {
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/tier`,
        { plan: newPlan },
        { headers: getHeaders() }
      );
      showNotification(`User plan successfully updated to ${newPlan.toUpperCase()}.`);
      setTierModalUser(null);
      fetchAllData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to update plan tier', true);
    }
  };

  // Change Role
  const handleChangeRole = async (userId: string, newRole: 'SUPER_ADMIN' | 'USER') => {
    try {
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/role`,
        { role: newRole },
        { headers: getHeaders() }
      );
      showNotification(`User role updated to ${newRole}.`);
      fetchAllData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to update role', true);
    }
  };

  // Reset Onboarding
  const handleResetOnboarding = async (userId: string) => {
    try {
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/reset-onboarding`,
        {},
        { headers: getHeaders() }
      );
      showNotification('Onboarding lifecycle reset for target account.');
      fetchAllData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to reset onboarding', true);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account ${email}? This action is irreversible.`)) return;
    try {
      await axios.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: getHeaders()
      });
      showNotification(`User ${email} deleted successfully.`);
      fetchAllData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to delete user', true);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      await axios.post(`${API_URL}/api/admin/settings`, settings, {
        headers: getHeaders()
      });
      showNotification('Platform economics and workflow settings saved successfully!');
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to save settings', true);
    }
  };

  // Flush Scraper Queue
  const handleClearScraperQueue = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/admin/scraper/clear`, {}, {
        headers: getHeaders()
      });
      showNotification(`Scraper queue cleared. Dropped ${res.data.droppedJobs} pending jobs.`);
      fetchAllData();
    } catch (err: any) {
      showNotification('Failed to clear queue', true);
    }
  };

  // Purge All Leads
  const handlePurgeLeads = async () => {
    if (!window.confirm('DANGER: This will delete ALL leads across the entire platform database. Are you absolutely certain?')) return;
    try {
      const res = await axios.delete(`${API_URL}/api/admin/leads/purge`, {
        headers: getHeaders()
      });
      showNotification(`Purged ${res.data.deletedCount} leads from master database.`);
      fetchAllData();
    } catch (err: any) {
      showNotification('Failed to purge leads', true);
    }
  };

  // Export Leads to CSV
  const handleExportCSV = () => {
    if (globalLeads.length === 0) {
      showNotification('No leads available to export', true);
      return;
    }
    const headers = ['Business Name', 'Category', 'Phone', 'Email', 'Website', 'Rating', 'Location', 'Created At'];
    const rows = globalLeads.map((l) => [
      `"${l.businessName || ''}"`,
      `"${l.category || ''}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${l.website || ''}"`,
      `"${l.rating || ''}"`,
      `"${l.location || ''}"`,
      `"${l.createdAt || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LeadPulse_Master_Leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Master JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(globalLeads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `LeadPulse_Database_Dump_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch = 
        !q ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u._id || '').toLowerCase().includes(q) ||
        (u.company_name || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q);

      const roleClean = (u.role || '').toUpperCase();
      const isSuper = roleClean === 'SUPER_ADMIN' || roleClean === 'SUPERADMIN' || (u.email && u.email.toLowerCase().trim() === 'ashleyghose64@gmail.com');
      const matchesRole = 
        selectedRoleFilter === 'ALL' || 
        (selectedRoleFilter === 'SUPER_ADMIN' ? isSuper : !isSuper);

      const planClean = (u.plan || 'free').toLowerCase();
      const matchesPlan = selectedPlanFilter === 'ALL' || planClean === selectedPlanFilter.toLowerCase();
      return matchesSearch && matchesRole && matchesPlan;
    });
  }, [users, userSearch, selectedRoleFilter, selectedPlanFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      return (
        (t.transactionId || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        (t.userEmail || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        (t.itemName || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        (t.gateway || '').toLowerCase().includes(txSearch.toLowerCase())
      );
    });
  }, [transactions, txSearch]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return globalLeads.filter((l) => 
      (l.businessName || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.category || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.phone || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(leadSearch.toLowerCase())
    );
  }, [globalLeads, leadSearch]);

  return (
    <div className="flex h-screen bg-[#FAF8F5] overflow-hidden text-[#191716] font-sans antialiased">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
          <div className="max-w-[1540px] 2xl:max-w-[1720px] mx-auto space-y-6">

            {/* ======================================================== */}
            {/* 1. TOP HEADER & TELEMETRY RIBBON                          */}
            {/* ======================================================== */}
            <div className="bg-white rounded-2xl border border-[#E5E0D5] p-6 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#191716] flex items-center justify-center text-[#E07A5F] shadow-2xs border border-[#D6CFC2]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-[#191716] font-delight">
                        Super Admin Control Room
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E07A5F]/15 text-[#C85A32] border border-[#E07A5F]/30 flex items-center gap-1 font-delight uppercase tracking-wider">
                        <Lock className="w-3 h-3" /> Root Access Only
                      </span>
                    </div>
                    <p className="text-xs text-[#6E675F] font-delight mt-0.5">
                      Authoritative platform management strictly assigned to <span className="font-semibold text-[#191716]">{user?.email}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={fetchAllData}
                    disabled={loading}
                    className="flex items-center gap-2 bg-[#F5F2EB] hover:bg-[#EBE5D8] border border-[#E5E0D5] text-[#191716] px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Synchronizing...' : 'Refresh Telemetry'}</span>
                  </button>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200/80 text-xs font-semibold font-delight">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>System Online</span>
                  </div>
                </div>
              </div>

              {/* Toast Alerts */}
              {successMsg && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold font-delight flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mt-4 p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs font-semibold font-delight flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* 2. NAVIGATION TABS                                       */}
              {/* ======================================================== */}
              <div className="flex items-center gap-2 mt-6 overflow-x-auto no-scrollbar border-t border-[#E5E0D5] pt-4">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all cursor-pointer ${
                    activeTab === 'overview' 
                      ? 'bg-[#191716] text-white shadow-2xs' 
                      : 'text-[#6E675F] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>Overview & Health</span>
                </button>
                
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all cursor-pointer ${
                    activeTab === 'users' 
                      ? 'bg-[#191716] text-white shadow-2xs' 
                      : 'text-[#6E675F] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>User Governance ({users.length})</span>
                </button>

                <button 
                  onClick={() => setActiveTab('payments')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all cursor-pointer ${
                    activeTab === 'payments' 
                      ? 'bg-[#191716] text-white shadow-2xs' 
                      : 'text-[#6E675F] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>Payments Received ({transactions.length})</span>
                </button>

                <button 
                  onClick={() => setActiveTab('scraper')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all cursor-pointer ${
                    activeTab === 'scraper' 
                      ? 'bg-[#191716] text-white shadow-2xs' 
                      : 'text-[#6E675F] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>Scraper Engine</span>
                </button>

                <button 
                  onClick={() => setActiveTab('credits')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all cursor-pointer ${
                    activeTab === 'credits' 
                      ? 'bg-[#191716] text-white shadow-2xs' 
                      : 'text-[#6E675F] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>Platform Economics</span>
                </button>

                <button 
                  onClick={() => setActiveTab('leads')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-delight transition-all cursor-pointer ${
                    activeTab === 'leads' 
                      ? 'bg-[#191716] text-white shadow-2xs' 
                      : 'text-[#6E675F] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>Global Leads ({globalLeads.length})</span>
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: OVERVIEW & TELEMETRY                              */}
            {/* ======================================================== */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F] font-delight">Registered Accounts</span>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-[#191716] font-delight">{stats.totalUsers}</div>
                    <p className="text-[11px] text-[#6E675F] font-delight mt-1">Platform user accounts</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F] font-delight">Global Leads</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Database className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-[#191716] font-delight">{stats.totalLeads}</div>
                    <p className="text-[11px] text-[#6E675F] font-delight mt-1">Extracted & verified leads</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F] font-delight">Payments Received</span>
                      <div className="w-8 h-8 rounded-lg bg-[#E07A5F]/15 text-[#C85A32] flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-[#191716] font-delight">₹{stats.totalRevenue.toLocaleString()}</div>
                    <p className="text-[11px] text-emerald-600 font-semibold font-delight mt-1">Total revenue collected</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F] font-delight">Scraper Status</span>
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Cpu className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-[#191716] font-delight">
                      {stats.scraper?.queuedJobs} <span className="text-xs font-normal text-[#6E675F]">queued</span>
                    </div>
                    <p className="text-[11px] text-[#6E675F] font-delight mt-1">
                      Engine status: <span className="font-bold text-[#191716]">{stats.scraper?.status}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cloud Telemetry */}
                  <div className="bg-white p-6 rounded-2xl border border-[#E5E0D5] shadow-2xs space-y-4">
                    <h3 className="text-sm font-bold text-[#191716] font-delight flex items-center gap-2">
                      <Server className="w-4 h-4 text-[#C85A32]" />
                      <span>Server & Cloud Telemetry</span>
                    </h3>
                    <div className="space-y-3 text-xs font-delight">
                      <div className="flex justify-between py-2 border-b border-[#E5E0D5]">
                        <span className="text-[#6E675F]">Database Engine</span>
                        <span className="font-semibold text-[#191716]">{stats.system?.database}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[#E5E0D5]">
                        <span className="text-[#6E675F]">Node.js Runtime</span>
                        <span className="font-semibold text-[#191716]">{stats.system?.nodeVersion || 'v24.11.1'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[#E5E0D5]">
                        <span className="text-[#6E675F]">Heap Memory Usage</span>
                        <span className="font-semibold text-[#191716]">{stats.system?.memoryUsage}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[#E5E0D5]">
                        <span className="text-[#6E675F]">Server Uptime</span>
                        <span className="font-semibold text-[#191716]">{Math.floor(stats.system?.uptime / 60)} minutes</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[#6E675F]">Worker Concurrency Pool</span>
                        <span className="font-semibold text-emerald-700">Headless Chromium Cluster</span>
                      </div>
                    </div>
                  </div>

                  {/* Root Shortcuts */}
                  <div className="bg-white p-6 rounded-2xl border border-[#E5E0D5] shadow-2xs flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#191716] font-delight mb-1 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#C85A32]" />
                        <span>Master Operational Actions</span>
                      </h3>
                      <p className="text-xs text-[#6E675F] font-delight mb-4">
                        Perform platform-wide maintenance routines directly from root command.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-delight">
                      <button 
                        onClick={handleClearScraperQueue}
                        className="p-3.5 bg-[#F5F2EB] hover:bg-[#EBE5D8] border border-[#E5E0D5] text-[#191716] rounded-xl text-xs font-semibold transition-all text-left flex flex-col justify-between h-22 cursor-pointer shadow-2xs"
                      >
                        <span className="text-[10.5px] text-[#6E675F]">Job Queue</span>
                        <span className="font-bold text-sm">Flush Scraper</span>
                      </button>

                      <button 
                        onClick={handleExportCSV}
                        className="p-3.5 bg-[#F5F2EB] hover:bg-[#EBE5D8] border border-[#E5E0D5] text-[#191716] rounded-xl text-xs font-semibold transition-all text-left flex flex-col justify-between h-22 cursor-pointer shadow-2xs"
                      >
                        <span className="text-[10.5px] text-[#6E675F]">Master Backup</span>
                        <span className="font-bold text-sm">Export CSV</span>
                      </button>

                      <button 
                        onClick={handleExportJSON}
                        className="p-3.5 bg-[#F5F2EB] hover:bg-[#EBE5D8] border border-[#E5E0D5] text-[#191716] rounded-xl text-xs font-semibold transition-all text-left flex flex-col justify-between h-22 cursor-pointer shadow-2xs"
                      >
                        <span className="text-[10.5px] text-[#6E675F]">Database Dump</span>
                        <span className="font-bold text-sm">Export JSON</span>
                      </button>

                      <button 
                        onClick={handlePurgeLeads}
                        className="p-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-semibold transition-all text-left flex flex-col justify-between h-22 cursor-pointer shadow-2xs"
                      >
                        <span className="text-[10.5px] text-red-500">Master Purge</span>
                        <span className="font-bold text-sm">Purge All Leads</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: USERS & ACCESS GOVERNANCE                         */}
            {/* ======================================================== */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-2xl border border-[#E5E0D5] shadow-2xs overflow-hidden">
                {/* Search & Filter Ribbon */}
                <div className="p-5 border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5]">
                  <div className="flex-1 min-w-[280px] relative">
                    <Search className="w-4 h-4 text-[#6E675F] absolute left-3.5 top-3" />
                    <input 
                      type="text" 
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Filter accounts by name, email, company, or phone..."
                      className="w-full bg-white border border-[#E5E0D5] rounded-xl pl-10 pr-4 py-2 text-xs font-delight font-medium outline-none focus:border-[#C85A32] transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3 font-delight text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#6E675F] font-semibold">Tier:</span>
                      <select 
                        value={selectedPlanFilter}
                        onChange={(e: any) => setSelectedPlanFilter(e.target.value)}
                        className="bg-white border border-[#E5E0D5] rounded-xl px-2.5 py-1.5 font-bold outline-none cursor-pointer"
                      >
                        <option value="ALL">All Tiers</option>
                        <option value="free">Free</option>
                        <option value="basic">Basic (₹699)</option>
                        <option value="pro">Pro (₹1,999)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[#6E675F] font-semibold">Role:</span>
                      <select 
                        value={selectedRoleFilter}
                        onChange={(e: any) => setSelectedRoleFilter(e.target.value)}
                        className="bg-white border border-[#E5E0D5] rounded-xl px-2.5 py-1.5 font-bold outline-none cursor-pointer"
                      >
                        <option value="ALL">All Roles</option>
                        <option value="SUPER_ADMIN">Super Admins Only</option>
                        <option value="USER">Standard Users</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-delight">
                    <thead>
                      <tr className="bg-[#F5F2EB] border-b border-[#E5E0D5] text-[#6E675F] font-semibold uppercase tracking-wider text-[10.5px]">
                        <th className="p-4">User Details</th>
                        <th className="p-4">Company & Niche</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Plan / Tier</th>
                        <th className="p-4">Lead Credits</th>
                        <th className="p-4">Emails Quota</th>
                        <th className="p-4">Onboarding</th>
                        <th className="p-4 text-right">Root Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D5]">
                      {filteredUsers.map((u) => {
                        const isSuperAshley = u._id === 'user_ashleyghose64' || u.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com';
                        return (
                          <tr key={u._id} className="hover:bg-[#FAF8F5] transition-colors">
                            <td className="p-4">
                              <div className="font-bold text-[#191716] flex items-center gap-1.5">
                                <span>{u.name || 'LeadPulse User'}</span>
                                {isSuperAshley && (
                                  <span className="text-[9.5px] font-bold bg-[#E07A5F]/20 text-[#C85A32] px-1.5 py-0.2 rounded border border-[#E07A5F]/40">
                                    IMMUTABLE
                                  </span>
                                )}
                              </div>
                              <div className="text-[#6E675F] text-[11px]">{u.email}</div>
                              {u.phone && <div className="text-[10px] text-[#9C9488]">{u.phone}</div>}
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-[#191716]">{u.company_name || 'Individual'}</div>
                              <div className="text-[11px] text-[#6E675F]">{u.field_of_work || 'General B2B'}</div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                u.role === 'SUPER_ADMIN' 
                                  ? 'bg-[#191716] text-[#E07A5F] border border-[#E07A5F]/30' 
                                  : 'bg-[#F5F2EB] text-[#57514B] border border-[#E5E0D5]'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold uppercase tracking-wider ${
                                (u.plan || 'free') === 'pro' 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                  : (u.plan || 'free') === 'basic'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {(u.plan || 'free')}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-[#191716]">
                              <span className="text-sm font-delight">{u.lead_credits ?? 0}</span>
                              <span className="text-[10px] text-[#6E675F] ml-1 font-normal">tokens</span>
                            </td>
                            <td className="p-4 text-[#191716]">
                              <span className="font-semibold">{u.emails_sent || 0}</span>
                              <span className="text-[#6E675F]"> / {u.emails_limit || 50}</span>
                            </td>
                            <td className="p-4">
                              {u.onboarding_complete ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold text-[11px]">Pending</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Token Adjuster */}
                                <button 
                                  onClick={() => {
                                    setCreditModalUser(u);
                                    setCreditAdjustmentAmount('100');
                                    setCreditAdjustmentMode('add');
                                  }}
                                  className="bg-white border border-[#E5E0D5] hover:bg-[#F5F2EB] text-[#191716] px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                                  title="Adjust token balance"
                                >
                                  Tokens
                                </button>

                                {/* Change Tier */}
                                <button 
                                  onClick={() => {
                                    setTierModalUser(u);
                                    setSelectedTier((u.plan || 'free').toLowerCase());
                                  }}
                                  disabled={isSuperAshley}
                                  className="bg-white border border-[#E5E0D5] hover:bg-[#F5F2EB] disabled:opacity-40 text-[#191716] px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                                  title="Change subscription tier"
                                >
                                  Tier
                                </button>

                                {/* Change Role */}
                                <button 
                                  onClick={() => handleChangeRole(u._id, u.role === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN')}
                                  disabled={isSuperAshley}
                                  className={`px-2 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer border ${
                                    isSuperAshley
                                      ? 'opacity-30 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                                      : 'bg-white border-[#E5E0D5] hover:bg-[#F5F2EB] text-[#57514B]'
                                  }`}
                                  title={isSuperAshley ? 'Super Admin is immutable' : 'Toggle between USER and SUPER_ADMIN'}
                                >
                                  Role
                                </button>

                                {/* Reset Onboarding */}
                                <button 
                                  onClick={() => handleResetOnboarding(u._id)}
                                  className="p-1 rounded-lg border border-[#E5E0D5] hover:bg-[#F5F2EB] text-[#6E675F] hover:text-[#191716] transition-colors cursor-pointer"
                                  title="Reset onboarding walkthrough"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete User */}
                                <button 
                                  onClick={() => handleDeleteUser(u._id, u.email)}
                                  disabled={isSuperAshley}
                                  className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                                    isSuperAshley
                                      ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                                      : 'border-red-200 hover:bg-red-50 text-red-600'
                                  }`}
                                  title={isSuperAshley ? 'Protected Account' : 'Permanently Delete User'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[#6E675F]">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Users className="w-8 h-8 text-[#9C9488]" />
                              <p className="font-semibold text-sm text-[#191716]">No users found</p>
                              <p className="text-xs text-[#6E675F]">
                                {userSearch ? `No accounts match "${userSearch}".` : 'No registered accounts detected or loaded.'}
                              </p>
                              <button
                                onClick={fetchAllData}
                                className="mt-2 px-3 py-1.5 bg-[#C85A32] text-white text-xs font-semibold rounded-lg hover:bg-[#B04B25] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                <span>{loading ? 'Scanning Database...' : 'Rescan & Detect Users'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: PAYMENTS RECEIVED & FINANCIAL LEDGER              */}
            {/* ======================================================== */}
            {activeTab === 'payments' && (
              <div className="space-y-6 font-delight">
                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F]">Gross Revenue Collected</span>
                    <div className="text-3xl font-extrabold text-[#191716] mt-2">
                      ₹{stats.totalRevenue.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">100% Verified settlements</span>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F]">Processed Transactions</span>
                    <div className="text-3xl font-extrabold text-[#191716] mt-2">
                      {transactions.length}
                    </div>
                    <span className="text-[11px] text-[#6E675F] mt-1 inline-block">Gateway webhooks confirmed</span>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F]">Paying Subscriptions</span>
                    <div className="text-3xl font-extrabold text-[#191716] mt-2">
                      {users.filter(u => u.plan === 'pro' || u.plan === 'basic').length}
                    </div>
                    <span className="text-[11px] text-[#6E675F] mt-1 inline-block">Active recurring tiers</span>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#E5E0D5] shadow-2xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E675F]">Average Order Value</span>
                    <div className="text-3xl font-extrabold text-[#191716] mt-2">
                      ₹{transactions.length > 0 ? Math.round(stats.totalRevenue / transactions.length) : 0}
                    </div>
                    <span className="text-[11px] text-[#6E675F] mt-1 inline-block">Per checkout transaction</span>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-white rounded-2xl border border-[#E5E0D5] shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5]">
                    <div>
                      <h3 className="text-base font-bold text-[#191716]">Live Payment Stream</h3>
                      <p className="text-xs text-[#6E675F] mt-0.5">Real-time incoming revenues from PhonePe, Stripe, and subscription billing.</p>
                    </div>

                    <div className="w-full sm:w-72 relative">
                      <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        placeholder="Search by transaction ID, customer, item..."
                        className="w-full bg-white border border-[#E5E0D5] rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:border-[#C85A32]"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F5F2EB] border-b border-[#E5E0D5] text-[#6E675F] font-semibold uppercase tracking-wider text-[10.5px]">
                          <th className="p-4">Transaction ID</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Purchased Item</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Gateway</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E0D5]">
                        {filteredTransactions.map((tx) => (
                          <tr key={tx._id || tx.transactionId} className="hover:bg-[#FAF8F5] transition-colors">
                            <td className="p-4 font-mono font-semibold text-[#191716] text-[11px]">
                              {tx.transactionId}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-[#191716]">{tx.userName || 'Customer'}</div>
                              <div className="text-[#6E675F] text-[11px]">{tx.userEmail || tx.userId}</div>
                            </td>
                            <td className="p-4 font-medium text-[#191716]">
                              {tx.itemName}
                            </td>
                            <td className="p-4 font-extrabold text-[#191716] text-sm">
                              ₹{tx.amount?.toLocaleString()}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tx.type === 'subscription' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="p-4 text-[#57514B] font-semibold">
                              {tx.gateway || 'PhonePe'}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {tx.status || 'SUCCESS'}
                              </span>
                            </td>
                            <td className="p-4 text-[#6E675F] text-[11px]">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: SCRAPER ENGINE ORCHESTRATION                      */}
            {/* ======================================================== */}
            {activeTab === 'scraper' && (
              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-6 lg:p-8 shadow-2xs space-y-8 font-delight">
                <div>
                  <h2 className="text-lg font-bold text-[#191716]">Headless Puppeteer Scraper Configuration</h2>
                  <p className="text-xs text-[#6E675F] mt-0.5">
                    Tune Google Maps navigation speed, browser worker limits, and anti-blocking countermeasures.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#191716] mb-1">
                        Browser Concurrency Limit (Workers)
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        value={settings.scraperConcurrency}
                        onChange={(e) => setSettings({ ...settings, scraperConcurrency: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#C85A32]"
                      />
                      <p className="text-[11px] text-[#6E675F] mt-1">Recommended: 2 to 4 workers for optimal CPU balance.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#191716] mb-1">
                        Map Search Timeout (Seconds)
                      </label>
                      <input 
                        type="number"
                        min="5"
                        max="120"
                        value={settings.scrapeTimeoutSecs}
                        onChange={(e) => setSettings({ ...settings, scrapeTimeoutSecs: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#C85A32]"
                      />
                      <p className="text-[11px] text-[#6E675F] mt-1">Timeout duration before safely releasing scraper lock.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#FAF8F5] flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#191716]">Rotating Proxy Gateway</h4>
                        <p className="text-[11px] text-[#6E675F]">Distribute queries across residential IP gateways.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={settings.proxyRotation}
                        onChange={(e) => setSettings({ ...settings, proxyRotation: e.target.checked })}
                        className="w-4.5 h-4.5 accent-[#C85A32] cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#FAF8F5] flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#191716]">Deep Lead Enrichment</h4>
                        <p className="text-[11px] text-[#6E675F]">Crawl business websites for verified emails & social profiles.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={settings.deepEnrichment}
                        onChange={(e) => setSettings({ ...settings, deepEnrichment: e.target.checked })}
                        className="w-4.5 h-4.5 accent-[#C85A32] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E5E0D5] pt-6 flex items-center justify-between">
                  <button 
                    onClick={handleClearScraperQueue}
                    className="bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border border-red-200 cursor-pointer"
                  >
                    Flush Pending Scraper Queue
                  </button>
                  <button 
                    onClick={handleSaveSettings}
                    className="bg-[#C85A32] hover:bg-[#B04B25] text-white px-6 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Save Scraper Settings
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 5: PLATFORM ECONOMICS & RULES                        */}
            {/* ======================================================== */}
            {activeTab === 'credits' && (
              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-6 lg:p-8 shadow-2xs space-y-8 font-delight">
                <div>
                  <h2 className="text-lg font-bold text-[#191716]">Credit Economics & Monetization Rules</h2>
                  <p className="text-xs text-[#6E675F] mt-0.5">
                    Configure registration rewards, token burn rates, and global suppression policies.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#191716] mb-1">
                        Free Trial Tokens on Account Registration
                      </label>
                      <input 
                        type="number"
                        value={settings.freeCreditsOnSignup}
                        onChange={(e) => setSettings({ ...settings, freeCreditsOnSignup: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#C85A32]"
                      />
                      <p className="text-[11px] text-[#6E675F] mt-1">Default is 15 free leads allocated to new signups.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#191716] mb-1">
                        Token Burn Cost Per Lead Search
                      </label>
                      <input 
                        type="number"
                        value={settings.creditCostPerSearch}
                        onChange={(e) => setSettings({ ...settings, creditCostPerSearch: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#C85A32]"
                      />
                      <p className="text-[11px] text-[#6E675F] mt-1">Deducted from balance per discovered business contact.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#191716] mb-1">
                        Max Outreach Dispatches per Hour
                      </label>
                      <input 
                        type="number"
                        value={settings.maxOutreachPerHour}
                        onChange={(e) => setSettings({ ...settings, maxOutreachPerHour: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#C85A32]"
                      />
                      <p className="text-[11px] text-[#6E675F] mt-1">Anti-spam rate limit per user outbox.</p>
                    </div>
                  </div>

                  {/* Suppression Blocklist */}
                  <div className="bg-[#FAF8F5] border border-[#E5E0D5] p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#191716] mb-1">Global Suppression Blocklist</h4>
                      <p className="text-[11px] text-[#6E675F] mb-3">
                        Domains and email addresses strictly excluded from batch dispatch.
                      </p>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {settings.suppressionList.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E5E0D5] text-xs">
                            <span className="font-mono text-[11px] text-[#191716]">{item}</span>
                            <button 
                              onClick={() => {
                                const updated = settings.suppressionList.filter((_, i) => i !== idx);
                                setSettings({ ...settings, suppressionList: updated });
                              }}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#E5E0D5]">
                      <input 
                        type="text"
                        placeholder="Add email or domain..."
                        value={newSuppressionItem}
                        onChange={(e) => setNewSuppressionItem(e.target.value)}
                        className="flex-1 bg-white border border-[#E5E0D5] rounded-xl px-3 py-1.5 text-xs outline-none"
                      />
                      <button 
                        onClick={() => {
                          if (!newSuppressionItem.trim()) return;
                          setSettings({
                            ...settings,
                            suppressionList: [...settings.suppressionList, newSuppressionItem.trim().toLowerCase()]
                          });
                          setNewSuppressionItem('');
                        }}
                        className="bg-[#191716] hover:bg-[#2F2B28] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E5E0D5] pt-6 flex justify-end">
                  <button 
                    onClick={handleSaveSettings}
                    className="bg-[#C85A32] hover:bg-[#B04B25] text-white px-6 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Save Economics Configuration
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 6: MASTER LEADS DATABASE                             */}
            {/* ======================================================== */}
            {activeTab === 'leads' && (
              <div className="bg-white rounded-2xl border border-[#E5E0D5] shadow-2xs overflow-hidden font-delight">
                {/* Header ribbon */}
                <div className="p-5 border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5]">
                  <div>
                    <h3 className="text-base font-bold text-[#191716]">Master Database Leads ({globalLeads.length})</h3>
                    <p className="text-xs text-[#6E675F] mt-0.5">Comprehensive lead records accumulated across all platform discovery operations.</p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-64 relative">
                      <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        placeholder="Search leads..."
                        className="w-full bg-white border border-[#E5E0D5] rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:border-[#C85A32]"
                      />
                    </div>
                    <button 
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F2EB] hover:bg-[#EBE5D8] border border-[#E5E0D5] rounded-xl text-xs font-semibold text-[#191716] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#C85A32]" />
                      <span>CSV</span>
                    </button>
                    <button 
                      onClick={handleExportJSON}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F2EB] hover:bg-[#EBE5D8] border border-[#E5E0D5] rounded-xl text-xs font-semibold text-[#191716] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#C85A32]" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#F5F2EB] z-10 shadow-2xs">
                      <tr className="border-b border-[#E5E0D5] text-[#6E675F] font-semibold uppercase tracking-wider text-[10.5px]">
                        <th className="p-4">Business Name</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Phone Number</th>
                        <th className="p-4">Email Address</th>
                        <th className="p-4">Rating</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Harvest Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D5]">
                      {filteredLeads.map((l) => (
                        <tr key={l._id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="p-4 font-bold text-[#191716]">
                            {l.businessName}
                          </td>
                          <td className="p-4 text-[#57514B]">
                            {l.category || l.fieldOfWork || 'General B2B'}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-[#191716]">
                            {l.phone || 'None recorded'}
                          </td>
                          <td className="p-4 text-[#191716]">
                            {l.email ? (
                              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {l.email}
                              </span>
                            ) : (
                              <span className="text-[#9C9488]">No email found</span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-[#191716]">
                            ⭐ {l.rating || '4.8'}
                          </td>
                          <td className="p-4 text-[#6E675F]">
                            {l.location || 'Local Area'}
                          </td>
                          <td className="p-4 text-[#6E675F] text-[11px]">
                            {l.source || 'Scraper Engine'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: ADJUST TOKENS & CREDITS                             */}
      {/* ============================================================ */}
      {creditModalUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-delight">
          <div className="bg-white rounded-2xl border border-[#E5E0D5] p-6 max-w-md w-full shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#191716]">Adjust User Tokens</h3>
                <p className="text-xs text-[#6E675F] mt-0.5">{creditModalUser.email}</p>
              </div>
              <button onClick={() => setCreditModalUser(null)} className="text-[#6E675F] hover:text-[#191716]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E0D5] flex items-center justify-between text-xs">
              <span className="text-[#6E675F]">Current Token Balance:</span>
              <span className="font-bold text-base text-[#191716]">{creditModalUser.lead_credits ?? 0}</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#191716]">Quick Adjust Pack</label>
              <div className="grid grid-cols-4 gap-2">
                {['+50', '+100', '+500', '+1000'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setCreditAdjustmentAmount(val.replace('+', ''));
                      setCreditAdjustmentMode('add');
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      creditAdjustmentMode === 'add' && creditAdjustmentAmount === val.replace('+', '')
                        ? 'bg-[#191716] text-white border-[#191716]'
                        : 'bg-[#FAF8F5] hover:bg-[#F5F2EB] border-[#E5E0D5] text-[#191716]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-[#191716] mb-1">Exact Token Amount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={creditAdjustmentAmount}
                    onChange={(e) => setCreditAdjustmentAmount(e.target.value)}
                    className="flex-1 bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl p-2.5 text-xs font-bold outline-none"
                  />
                  <select
                    value={creditAdjustmentMode}
                    onChange={(e: any) => setCreditAdjustmentMode(e.target.value)}
                    className="bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="add">Add (+)</option>
                    <option value="set">Set Exact (=)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E0D5]">
              <button
                type="button"
                onClick={() => setCreditModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E5E0D5] text-[#6E675F] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateCredits(creditModalUser._id, Number(creditAdjustmentAmount), creditAdjustmentMode)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#C85A32] hover:bg-[#B04B25] text-white shadow-2xs cursor-pointer"
              >
                Save Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: CHANGE SUBSCRIPTION TIER                            */}
      {/* ============================================================ */}
      {tierModalUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-delight">
          <div className="bg-white rounded-2xl border border-[#E5E0D5] p-6 max-w-md w-full shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#191716]">Change Subscription Tier</h3>
                <p className="text-xs text-[#6E675F] mt-0.5">{tierModalUser.email}</p>
              </div>
              <button onClick={() => setTierModalUser(null)} className="text-[#6E675F] hover:text-[#191716]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {[
                { key: 'free', label: 'Free Tier', quota: '15 Tokens • 50 Emails/mo', price: '₹0' },
                { key: 'basic', label: 'Basic Growth', quota: '600 Tokens • 1,500 Emails/mo', price: '₹699/mo' },
                { key: 'pro', label: 'Pro Sovereign', quota: '1,500 Tokens • 5,000 Emails/mo', price: '₹1,999/mo' }
              ].map((tier) => (
                <div 
                  key={tier.key}
                  onClick={() => setSelectedTier(tier.key as any)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedTier === tier.key 
                      ? 'border-[#C85A32] bg-[#E07A5F]/10 shadow-2xs' 
                      : 'border-[#E5E0D5] bg-[#FAF8F5] hover:bg-[#F5F2EB]'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs text-[#191716]">{tier.label}</span>
                    <p className="text-[11px] text-[#6E675F]">{tier.quota}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-xs text-[#C85A32]">{tier.price}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E0D5]">
              <button
                type="button"
                onClick={() => setTierModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E5E0D5] text-[#6E675F] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleChangeTier(tierModalUser._id, selectedTier)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#C85A32] hover:bg-[#B04B25] text-white shadow-2xs cursor-pointer"
              >
                Update Tier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
