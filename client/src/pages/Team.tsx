import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Users, UserPlus, Shield, Mail, CheckCircle2, Clock, 
  Trash2, X, Sparkles, AlertCircle, Check, Send, 
  Briefcase, Zap, Settings, Lock, Sliders, ArrowUpRight, 
  HelpCircle, Edit3
} from 'lucide-react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import API_URL from '../config/api';

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited';
  leadsAssigned: number;
  monthlyQuota: number;
  avatar?: string;
  createdAt?: string;
  inviteSentAt?: string;
}

interface TeamLimits {
  plan: 'free' | 'basic' | 'pro';
  seatsSelected: number;
  maxSeats: number;
  activeSeats: number;
  universalTokens: number;
  seatPercent: number | null;
}

const ROLES = [
  { 
    name: 'Admin', 
    badge: 'Full Access',
    desc: 'Full workspace access: CRM pipeline, billing, API keys, and team administration.' 
  },
  { 
    name: 'Sales Lead / SDR', 
    badge: 'Prospecting & Outreach',
    desc: 'Can scrape leads, run multi-channel outreach campaigns, and manage assigned CRM deals.' 
  },
  { 
    name: 'Account Executive', 
    badge: 'Deal Closer',
    desc: 'Manages advanced pipeline deals, proposals, WhatsApp conversations, and closed revenue.' 
  },
  { 
    name: 'Marketing Analyst', 
    badge: 'Campaigns & Insights',
    desc: 'Can build inbound forms, audience segments, export enriched lists, and view analytics.' 
  },
  { 
    name: 'Workspace Viewer', 
    badge: 'Read Only',
    desc: 'Observation-only privileges to view CRM deals and pipeline analytics without edit permissions.' 
  }
];

const Team = () => {
  const { user, setUpgradeModalOpen } = useStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [limits, setLimits] = useState<TeamLimits | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isSeatConfigOpen, setIsSeatConfigOpen] = useState(false);

  // Active Selected Member for Edit & Delete
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Sales Lead / SDR');
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [inviteQuota, setInviteQuota] = useState(250);
  const [inviteStatus, setInviteStatus] = useState<'active' | 'invited'>('active');
  const [inviteLeadsAssigned, setInviteLeadsAssigned] = useState(0);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Edit Role State
  const [editRole, setEditRole] = useState('');
  const [isEditCustomRole, setIsEditCustomRole] = useState(false);
  const [editCustomRoleInput, setEditCustomRoleInput] = useState('');
  const [editQuota, setEditQuota] = useState(250);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete State
  const [isDeleting, setIsDeleting] = useState(false);

  // Seat Configuration State
  const [seatsSelectedInput, setSeatsSelectedInput] = useState(6);
  const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    fetchTeamAndLimits();
  }, [user]);

  const fetchTeamAndLimits = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const [membersRes, limitsRes] = await Promise.all([
        axios.get(`${API_URL}/api/team`, { headers: { userid: user._id } }),
        axios.get(`${API_URL}/api/team/limits`, { headers: { userid: user._id } })
      ]);
      setMembers(membersRes.data);
      setLimits(limitsRes.data);
      setSeatsSelectedInput(limitsRes.data.seatsSelected || 6);
    } catch (err) {
      console.error('Failed to fetch team data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open Invite modal or Capacity Reached modal
  const handleOpenInvite = () => {
    if (limits && members.length >= limits.maxSeats) {
      setIsLimitModalOpen(true);
    } else {
      setInviteError('');
      setIsInviteModalOpen(true);
    }
  };

  // Handle Add / Invite Member
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id || !inviteEmail || !inviteName) return;

    const finalRole = isCustomRole && customRoleInput.trim() ? customRoleInput.trim() : inviteRole;

    setIsSendingInvite(true);
    setInviteError('');
    try {
      const res = await axios.post(`${API_URL}/api/team`, {
        name: inviteName,
        email: inviteEmail,
        role: finalRole,
        monthlyQuota: inviteQuota,
        status: inviteStatus,
        leadsAssigned: inviteLeadsAssigned
      }, {
        headers: { userid: user._id }
      });

      setMembers([...members, res.data]);
      setIsInviteModalOpen(false);
      const addedName = inviteName;
      setInviteName('');
      setInviteEmail('');
      setCustomRoleInput('');
      setIsCustomRole(false);
      setInviteLeadsAssigned(0);
      showToast(`Team member ${addedName} added successfully!`);
      // Refresh limits
      fetchTeamAndLimits();
    } catch (err: any) {
      console.error('Failed to add team member:', err);
      const errMsg = err.response?.data?.error || 'Failed to add team member.';
      setInviteError(errMsg);
      if (err.response?.data?.code === 'SEAT_LIMIT_REACHED') {
        setIsInviteModalOpen(false);
        setIsLimitModalOpen(true);
      }
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Open Edit Role Modal
  const handleOpenEditModal = (member: TeamMember) => {
    if (member.role === 'Workspace Owner') return;
    setActiveMember(member);
    const isPreset = ROLES.some(r => r.name === member.role);
    if (isPreset) {
      setIsEditCustomRole(false);
      setEditRole(member.role);
      setEditCustomRoleInput('');
    } else {
      setIsEditCustomRole(true);
      setEditRole('__CUSTOM__');
      setEditCustomRoleInput(member.role);
    }
    setEditQuota(member.monthlyQuota || 250);
    setIsEditModalOpen(true);
  };

  // Handle Update Role / Quota
  const handleUpdateMember = async () => {
    if (!activeMember || !user?._id) return;
    setIsUpdating(true);
    const finalEditRole = isEditCustomRole && editCustomRoleInput.trim() ? editCustomRoleInput.trim() : editRole;
    try {
      const res = await axios.patch(`${API_URL}/api/team/${activeMember._id}`, {
        role: finalEditRole,
        monthlyQuota: editQuota
      }, {
        headers: { userid: user._id }
      });

      setMembers(members.map(m => m._id === activeMember._id ? res.data : m));
      setIsEditModalOpen(false);
      showToast(`Updated role & permissions for ${activeMember.name}`);
    } catch (err) {
      console.error('Failed to update member:', err);
      showToast('Failed to update member role.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Remove Member Confirmation Modal
  const handleOpenDeleteModal = (member: TeamMember) => {
    if (member.role === 'Workspace Owner') return;
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  // Handle Remove Member Confirmation
  const handleConfirmRemoveMember = async () => {
    if (!memberToDelete || !user?._id) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/team/${memberToDelete._id}`, {
        headers: { userid: user._id }
      });
      setMembers(members.filter(m => m._id !== memberToDelete._id));
      setIsDeleteModalOpen(false);
      showToast(`${memberToDelete.name} was removed from workspace`);
      setMemberToDelete(null);
      // Refresh limits
      fetchTeamAndLimits();
    } catch (err) {
      console.error('Failed to remove member:', err);
      showToast('Failed to remove team member.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Update Registered Seats
  const handleSaveSeatsSelected = async () => {
    if (!user?._id) return;
    setIsUpdatingSeats(true);
    try {
      await axios.patch(`${API_URL}/api/team/seats`, {
        seats_selected: seatsSelectedInput
      }, {
        headers: { userid: user._id }
      });
      showToast(`Updated registered seat capacity to ${seatsSelectedInput}`);
      setIsSeatConfigOpen(false);
      fetchTeamAndLimits();
    } catch (err) {
      console.error('Failed to update seats:', err);
      showToast('Failed to update seat capacity.');
    } finally {
      setIsUpdatingSeats(false);
    }
  };

  const totalAssigned = members.reduce((acc, m) => acc + (m.leadsAssigned || 0), 0);
  const totalQuota = members.reduce((acc, m) => acc + (m.monthlyQuota || 0), 0);

  const maxSeats = limits ? limits.maxSeats : 2;
  const isAtCapacity = members.length >= maxSeats;
  const plan = limits?.plan || user?.plan || 'free';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto w-full space-y-5">
            
            {/* Toast Notification */}
            {toastMessage && (
              <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-xl border border-slate-800 text-xs font-delight font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">Team & Workspace</h1>
                <p className="text-slate-500 font-sans text-xs mt-0.5">
                  Manage team seats, assign prospect pipelines, and control role-based permissions with universal tokens.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSeatConfigOpen(!isSeatConfigOpen)}
                  className="h-8 px-3 bg-white text-slate-700 hover:text-slate-900 rounded-md font-delight font-medium text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>Seats & Tier Rules</span>
                </button>

                <button 
                  onClick={handleOpenInvite}
                  className="h-8 px-3.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-all flex items-center gap-1.5 border border-slate-900 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Team Member</span>
                </button>
              </div>
            </div>

            {/* Capacity Banner when at limit */}
            {isAtCapacity && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div>
                    <span className="font-bold text-amber-900 font-sans">Workspace Seat Limit Reached ({members.length}/{maxSeats} seats used)</span>
                    <p className="text-amber-800/80 font-sans text-[11px] mt-0.5">
                      {plan === 'free' && 'Free tier is fixed to 2 seats. Upgrade to Basic (50% registered seats) or Pro (100% registered seats) with universal tokens.'}
                      {plan === 'basic' && `Basic tier unlocks 50% of registered seats (${limits?.seatsSelected || 6} selected → ${maxSeats} seats). Upgrade to Pro for 100% capacity.`}
                      {plan === 'pro' && `Pro tier provides 100% of registered seats (${limits?.seatsSelected || 10} selected). Adjust your registered seat volume to add more.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setUpgradeModalOpen(true)}
                    className="h-7 px-2.5 bg-amber-900 text-white rounded-md font-delight font-medium text-[11px] hover:bg-amber-800 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Upgrade Plan</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Seat Configuration Drawer (Expandable) */}
            {isSeatConfigOpen && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-xs font-delight text-slate-900 uppercase tracking-wider">Tier Seat Allocation & Universal Token Rules</h3>
                  </div>
                  <button 
                    onClick={() => setIsSeatConfigOpen(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-delight font-medium cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-sans">
                  <div className={`p-3 rounded-md border ${plan === 'free' ? 'bg-white border-blue-500 shadow-xs' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold font-delight text-slate-900">Free Tier</span>
                      {plan === 'free' && <span className="text-[10px] font-delight font-medium bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm">Current</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2"><strong>2 Workspace Seats</strong> fixed allowance.</p>
                    <span className="text-[10px] font-delight font-normal text-slate-400">Fixed limit • 15 token trial pool</span>
                  </div>

                  <div className={`p-3 rounded-md border ${plan === 'basic' ? 'bg-white border-blue-500 shadow-xs' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold font-delight text-slate-900">Basic Tier</span>
                      {plan === 'basic' && <span className="text-[10px] font-delight font-medium bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm">Current</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2"><strong>50% of Seats</strong> selected at registration with universal tokens to use.</p>
                    <span className="text-[10px] font-delight font-medium text-blue-600">500 Universal Tokens Pool</span>
                  </div>

                  <div className={`p-3 rounded-md border ${plan === 'pro' ? 'bg-white border-blue-500 shadow-xs' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold font-delight text-slate-900">Pro Tier</span>
                      {plan === 'pro' && <span className="text-[10px] font-delight font-medium bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-sm">Current</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2"><strong>100% of Seats</strong> selected at registration with universal tokens to use.</p>
                    <span className="text-[10px] font-delight font-medium text-purple-600">2,500 Universal Tokens Pool</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-delight font-semibold text-slate-600">Registered Seats Baseline:</label>
                    <input 
                      type="number"
                      min={2}
                      max={100}
                      value={seatsSelectedInput}
                      onChange={(e) => setSeatsSelectedInput(Number(e.target.value))}
                      className="w-20 h-7 px-2 border border-slate-200 bg-white rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                    />
                    <button 
                      onClick={handleSaveSeatsSelected}
                      disabled={isUpdatingSeats || seatsSelectedInput === limits?.seatsSelected}
                      className="h-7 px-3 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      {isUpdatingSeats ? 'Saving...' : 'Update Seats'}
                    </button>
                  </div>

                  <div className="text-[11px] font-delight font-normal text-slate-500">
                    Allowed: <strong className="text-slate-900 font-bold">{maxSeats} Seats</strong> on {plan.toUpperCase()} tier
                  </div>
                </div>
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card 1: Active Workspace Seats */}
              <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-delight font-medium text-slate-400 uppercase tracking-wider">Active Workspace Seats</p>
                    <h3 className="text-2xl font-bold font-display text-slate-900 mt-1 tracking-tight">
                      {members.length} / {maxSeats} Seats
                    </h3>
                  </div>
                </div>
                
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-delight font-medium mb-1">
                    <span className="text-slate-500">
                      {plan === 'free' && 'Free Tier: 2 Seats Fixed'}
                      {plan === 'basic' && `Basic: 50% of ${limits?.seatsSelected || 6} Seats`}
                      {plan === 'pro' && `Pro: 100% of ${limits?.seatsSelected || 10} Seats`}
                    </span>
                    <span className={`font-semibold ${isAtCapacity ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {Math.round((members.length / maxSeats) * 100)}% Used
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${isAtCapacity ? 'bg-amber-500' : 'bg-slate-900'}`}
                      style={{ width: `${Math.min(100, (members.length / maxSeats) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Universal Tokens Pool */}
              <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-delight font-medium text-slate-400 uppercase tracking-wider">Universal Tokens Pool</p>
                    <h3 className="text-2xl font-bold font-display text-slate-900 mt-1 tracking-tight">
                      {limits ? limits.universalTokens.toLocaleString() : '0'} Tokens
                    </h3>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-sans">Shared pool for Scraping, AI & Outreach</span>
                  <span className="inline-flex items-center gap-1 font-delight font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
              </div>

              {/* Card 3: Assigned Leads & Quota */}
              <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-delight font-medium text-slate-400 uppercase tracking-wider">Assigned Prospects</p>
                    <h3 className="text-2xl font-bold font-display text-slate-900 mt-1 tracking-tight">
                      {totalAssigned} Leads
                    </h3>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-delight font-normal text-slate-500">
                  <span>Allocated Quota:</span>
                  <strong className="text-slate-900">{totalQuota} / mo</strong>
                </div>
              </div>

            </div>

            {/* Members Table */}
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-delight uppercase tracking-wider text-slate-700 font-semibold">Workspace Members</span>
                  <span className="text-[10px] font-delight font-medium bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm">
                    {members.length} of {maxSeats} seats
                  </span>
                  {!isAtCapacity && (
                    <button 
                      onClick={handleOpenInvite}
                      className="text-[11px] font-delight text-blue-600 hover:text-blue-800 hover:underline cursor-pointer ml-1 font-medium"
                    >
                      + Add Member
                    </button>
                  )}
                </div>
                <span className="text-xs font-delight font-normal text-slate-400">Manage roles and remove members below</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-delight font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                      <th className="px-4 py-2.5">Member</th>
                      <th className="px-4 py-2.5">Role</th>
                      <th className="px-4 py-2.5">Pipeline Leads</th>
                      <th className="px-4 py-2.5">Universal Tokens / Mo</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {members.map((member) => (
                      <tr key={member._id} className="hover:bg-slate-50/70 transition-colors group">
                        
                        {/* Member Identity */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-delight font-bold text-xs uppercase flex-shrink-0">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>{member.name}</span>
                                {member.role === 'Workspace Owner' && (
                                  <span className="text-[9px] font-delight bg-amber-100 text-amber-800 px-1 py-0.2 rounded-xs font-semibold">
                                    Owner
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-delight font-normal text-slate-400">{member.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Pill */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-delight font-semibold border ${
                            member.role === 'Workspace Owner' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                            member.role === 'Admin' ? 'bg-purple-50 text-purple-900 border-purple-200' :
                            member.role.includes('SDR') ? 'bg-blue-50 text-blue-900 border-blue-200' :
                            member.role.includes('Executive') ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            <Shield className="w-3 h-3 opacity-60" />
                            <span>{member.role}</span>
                          </span>
                        </td>

                        {/* Assigned Leads */}
                        <td className="px-4 py-3 font-delight font-medium text-xs text-slate-700">
                          {member.leadsAssigned || 0} leads
                        </td>

                        {/* Monthly Universal Tokens Quota */}
                        <td className="px-4 py-3 font-delight font-medium text-xs text-slate-700">
                          {member.monthlyQuota || 0} tokens
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {member.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-delight font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-delight font-semibold text-amber-600">
                              <Clock className="w-3.5 h-3.5" /> Invited (Pending)
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {member.role === 'Workspace Owner' ? (
                              <span className="text-[11px] font-delight font-normal text-slate-400 italic">
                                Primary Owner
                              </span>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleOpenEditModal(member)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3 text-slate-500" />
                                  <span>Manage Role</span>
                                </button>
                                
                                <button 
                                  onClick={() => handleOpenDeleteModal(member)}
                                  title="Remove Member"
                                  className="w-7 h-7 rounded-md bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 flex items-center justify-center transition-colors text-slate-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Role Permissions Matrix (RBAC) */}
            <div className="bg-white border border-slate-200 rounded-md p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold font-display text-slate-900 text-sm">Role-Based Access Control (RBAC)</h3>
                <span className="text-[11px] font-delight font-normal text-slate-400">Universal tokens access enabled for all roles</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {ROLES.map(role => (
                  <div key={role.name} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                        <span>{role.name}</span>
                      </h4>
                    </div>
                    <span className="inline-block text-[10px] font-delight font-normal text-slate-500 bg-white border border-slate-200 px-1 py-0.2 rounded-xs">
                      {role.badge}
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-sans pt-1">{role.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ================= MODAL: ADD TEAM MEMBER ================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold font-display text-slate-900">Add Team Member</h3>
                  <p className="text-[10px] font-delight font-normal text-slate-400">
                    Seat {members.length + 1} of {maxSeats} ({plan.toUpperCase()} Tier)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsInviteModalOpen(false)} 
                className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {inviteError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2 font-delight font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Full Name *</label>
                <input 
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. David Vance"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Work Email Address *</label>
                <input 
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="david@company.com"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-delight font-medium text-slate-600">Assigned Role *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomRole(!isCustomRole);
                      if (!isCustomRole && !customRoleInput) {
                        setCustomRoleInput('');
                      }
                    }}
                    className="text-[10px] font-delight text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                  >
                    {isCustomRole ? 'Choose standard preset' : 'Type custom role'}
                  </button>
                </div>

                {!isCustomRole ? (
                  <select 
                    value={inviteRole}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomRole(true);
                      } else {
                        setInviteRole(e.target.value);
                      }
                    }}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium bg-white outline-none cursor-pointer"
                  >
                    {ROLES.map(r => (
                      <option key={r.name} value={r.name}>{r.name} - {r.badge}</option>
                    ))}
                    <option value="__CUSTOM__">Custom Role (Type your own...)</option>
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input 
                      type="text"
                      required
                      value={customRoleInput}
                      onChange={(e) => setCustomRoleInput(e.target.value)}
                      placeholder="e.g. Growth Marketing Lead, Outbound Closer, RevOps..."
                      className="w-full h-8 px-2.5 border border-blue-400 bg-blue-50/20 rounded-md text-xs font-delight font-medium outline-none focus:border-blue-600 text-slate-900"
                      autoFocus
                    />
                    <p className="text-[10px] font-delight font-normal text-slate-400">
                      Type any custom job title or role name for this workspace member.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-delight font-medium text-slate-600">Universal Tokens Monthly Quota</label>
                  <span className="text-[10px] font-delight font-semibold text-slate-400">Tokens from pool (1 Token = 1 Contact)</span>
                </div>
                <input 
                  type="number"
                  min={1}
                  max={5000}
                  value={inviteQuota}
                  onChange={(e) => setInviteQuota(Number(e.target.value))}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
                
                {/* Presets */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-delight font-normal text-slate-400">Presets:</span>
                  {(plan === 'free' ? [5, 10, 15] : [100, 250, 500, 1000]).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setInviteQuota(val)}
                      className="px-2 py-0.5 border border-slate-200 rounded-xs text-[10px] font-delight font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-medium text-slate-600 mb-1">Member Activation Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteStatus('active')}
                    className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                      inviteStatus === 'active' 
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Active Now</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5">Immediate workspace access</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteStatus('invited')}
                    className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                      inviteStatus === 'invited' 
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Invite Pending</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5">Sends invitation link</p>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isSendingInvite}
                  className="w-full h-8 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 border border-slate-900 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isSendingInvite ? 'Adding Team Member...' : 'Add Team Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / MANAGE ROLE ================= */}
      {isEditModalOpen && activeMember && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold font-display text-slate-900">Manage Role & Permissions</h3>
                  <p className="text-[11px] font-delight font-normal text-slate-500">{activeMember.name} • {activeMember.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-delight font-medium text-slate-600">Workspace Role</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditCustomRole(!isEditCustomRole);
                      if (!isEditCustomRole && !editCustomRoleInput) {
                        setEditCustomRoleInput(editRole === '__CUSTOM__' ? '' : editRole);
                      }
                    }}
                    className="text-[10px] font-delight text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                  >
                    {isEditCustomRole ? 'Choose standard preset' : 'Type custom role'}
                  </button>
                </div>

                {!isEditCustomRole ? (
                  <>
                    <select 
                      value={editRole}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setIsEditCustomRole(true);
                        } else {
                          setEditRole(e.target.value);
                        }
                      }}
                      className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium bg-white outline-none cursor-pointer"
                    >
                      {ROLES.map(r => (
                        <option key={r.name} value={r.name}>{r.name} ({r.badge})</option>
                      ))}
                      <option value="__CUSTOM__">Custom Role (Type your own...)</option>
                    </select>
                    <p className="text-[11px] font-sans text-slate-500 mt-1">
                      {ROLES.find(r => r.name === editRole)?.desc}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <input 
                      type="text"
                      required
                      value={editCustomRoleInput}
                      onChange={(e) => setEditCustomRoleInput(e.target.value)}
                      placeholder="e.g. Growth Specialist, Outbound Lead, Closer..."
                      className="w-full h-8 px-2.5 border border-blue-400 bg-blue-50/20 rounded-md text-xs font-delight font-medium outline-none focus:border-blue-600 text-slate-900"
                      autoFocus
                    />
                    <p className="text-[10px] font-delight font-normal text-slate-400">
                      Type any custom job title or role name for this workspace member.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-delight font-medium text-slate-600">Universal Token Monthly Quota</label>
                  <span className="text-[10px] font-delight font-semibold text-slate-400">Tokens / month (1 Token = 1 Contact)</span>
                </div>
                <input 
                  type="number"
                  min={1}
                  max={5000}
                  value={editQuota}
                  onChange={(e) => setEditQuota(Number(e.target.value))}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
                
                {/* Presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-delight font-normal text-slate-400">Quick set:</span>
                  {(plan === 'free' ? [5, 10, 15] : [100, 250, 500, 1000]).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditQuota(val)}
                      className="px-2 py-0.5 border border-slate-200 rounded-xs text-[10px] font-delight font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-8 px-3.5 border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateMember}
                  disabled={isUpdating}
                  className="h-8 px-4 bg-slate-900 text-white rounded-md text-xs font-delight font-medium hover:bg-slate-800 border border-slate-900 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Role Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: REMOVE MEMBER CONFIRMATION ================= */}
      {isDeleteModalOpen && memberToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-display text-slate-900">Remove Team Member</h3>
              </div>
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <p className="text-slate-700 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900">{memberToDelete.name}</strong> (<span className="font-delight font-normal text-slate-500">{memberToDelete.email}</span>) from your workspace?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Pipeline Data Preserved</span>
                </div>
                <p className="text-amber-800">
                  Their workspace seat will be freed immediately. Any {memberToDelete.leadsAssigned || 0} assigned leads and deals will remain safely preserved in your workspace CRM pipeline for reassignment.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="h-8 px-3.5 border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Keep Member
                </button>
                <button 
                  onClick={handleConfirmRemoveMember}
                  disabled={isDeleting}
                  className="h-8 px-4 bg-red-600 text-white rounded-md text-xs font-delight font-medium hover:bg-red-700 border border-red-600 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isDeleting ? 'Removing...' : 'Confirm Removal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SEAT LIMIT REACHED / TIER UPGRADE ================= */}
      {isLimitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold font-display text-slate-900">Workspace Seat Limit Reached</h3>
                  <p className="text-[11px] font-delight font-normal text-slate-500">
                    {members.length} of {maxSeats} seats used • {plan.toUpperCase()} Tier
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsLimitModalOpen(false)} 
                className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <p className="text-slate-600">
                You have reached the maximum seat capacity for your current plan. Here are your workspace tier allowances:
              </p>

              <div className="space-y-2 font-sans">
                {/* Free */}
                <div className={`p-3 rounded-md border flex items-center justify-between ${plan === 'free' ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <div className="font-bold font-delight text-slate-900">Free Tier</div>
                    <div className="text-[11px] text-slate-500">Fixed limit of <strong>2 seats</strong> • <strong>15 tokens</strong> pool</div>
                  </div>
                  <span className="text-[10px] font-delight font-medium px-2 py-0.5 rounded-sm bg-slate-200 text-slate-700">2 Seats • 15 Tokens</span>
                </div>

                {/* Basic */}
                <div className={`p-3 rounded-md border flex items-center justify-between ${plan === 'basic' ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <div className="font-bold font-delight text-slate-900">Basic Tier</div>
                    <div className="text-[11px] text-slate-500">Add <strong>50% of seats selected at registration</strong> with universal tokens</div>
                  </div>
                  <span className="text-[10px] font-delight font-medium px-2 py-0.5 rounded-sm bg-blue-100 text-blue-800">50% Capacity</span>
                </div>

                {/* Pro */}
                <div className={`p-3 rounded-md border flex items-center justify-between ${plan === 'pro' ? 'bg-purple-50/50 border-purple-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <div className="font-bold font-delight text-slate-900">Pro Tier</div>
                    <div className="text-[11px] text-slate-500">Add <strong>100% of seats selected at registration</strong> with universal tokens</div>
                  </div>
                  <span className="text-[10px] font-delight font-medium px-2 py-0.5 rounded-sm bg-purple-100 text-purple-800">100% Capacity</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button 
                  onClick={() => setIsLimitModalOpen(false)}
                  className="h-8 px-3.5 border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    setIsLimitModalOpen(false);
                    setUpgradeModalOpen(true);
                  }}
                  className="h-8 px-4 bg-slate-900 text-white rounded-md text-xs font-delight font-medium hover:bg-slate-800 border border-slate-900 cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Upgrade Workspace Tier</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Team;
