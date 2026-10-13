import React, { useState } from 'react';
import { 
  X, Globe, Mail, Phone, ExternalLink, Calendar,
  Clock, CheckCircle2, MessageCircle, Send, MoreVertical,
  Plus, Edit3, Trash2, Building, Star, Check, Sparkles,
  ArrowRight, FileText, ChevronDown, CheckSquare, Heart
} from 'lucide-react';
import { mapStageToQuickSheets, getStageColorTheme, getPriorityTheme, getStatusPillTheme, getEstimatedValue } from '../utils/crmExport';

export interface CrmFlowluModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onUpdateLead: (updatedLead: any) => Promise<void>;
  onLaunchWhatsApp: (lead: any) => void;
  onOpenOutreachStudio: (lead: any) => void;
  currentUser?: any;
}

export const CrmFlowluDetailModal: React.FC<CrmFlowluModalProps> = ({
  isOpen,
  onClose,
  lead,
  onUpdateLead,
  onLaunchWhatsApp,
  onOpenOutreachStudio,
  currentUser
}) => {
  if (!isOpen || !lead) return null;

  const [activeTab, setActiveTab] = useState<'Main' | 'Tasks' | 'Documents' | 'Opportunities' | 'Events' | 'Calls' | 'Notes' | 'Email'>('Main');
  const [activityFilter, setActivityFilter] = useState<'All' | 'Tasks' | 'Email' | 'Comments' | 'Events' | 'Calls' | 'Documents' | 'Interactions'>('All');
  
  // Local state for editable fields
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editEmail, setEditEmail] = useState(lead.email || '');
  const [editPhone, setEditPhone] = useState(lead.phone || '');
  const [editWebsite, setEditWebsite] = useState(lead.website || '');
  const [editStage, setEditStage] = useState(lead.status || 'New');
  const [editPriority, setEditPriority] = useState(lead.priority || 'Medium');
  const [editValue, setEditValue] = useState(lead.dealValue || getEstimatedValue(lead));

  // Requirements List state
  const defaultReqs = Array.isArray(lead.requirements) && lead.requirements.length > 0 
    ? lead.requirements 
    : ['promotional outreach sequence', 'high-deliverability inbox routing', 'social & review enrichment'];
  const [requirements, setRequirements] = useState<string[]>(defaultReqs);
  const [newReqInput, setNewReqInput] = useState('');
  const [isAddingReq, setIsAddingReq] = useState(false);

  // Activity Creator state
  const [activityType, setActivityType] = useState<'Comments' | 'Tasks' | 'Calls' | 'Events'>('Comments');
  const [activityText, setActivityText] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [isPostingActivity, setIsPostingActivity] = useState(false);

  // Timeline Activities
  const defaultActivities = [
    {
      id: 'act-1',
      type: 'Events',
      title: 'Appointment: Initial strategy session',
      date: 'Tomorrow, 02:00 pm - 02:30 pm',
      status: 'Planned',
      badge: 'Planned',
      isPlanned: true
    },
    {
      id: 'act-2',
      type: 'Tasks',
      title: 'Send outreach proposal & ROI benchmark brief',
      date: 'In 3 business days',
      status: 'Planned',
      badge: 'Planned',
      isPlanned: true
    },
    {
      id: 'act-3',
      type: 'Calls',
      title: 'Call: Discuss target customer acquisition in local market',
      date: 'Yesterday at 11:45 am (Duration: 14 mins)',
      author: currentUser?.name || 'Lisa Jones',
      status: 'Completed',
      notes: 'Client reviewed local map rankings. Highly receptive to autonomous lead pipeline.',
      isPlanned: false
    },
    {
      id: 'act-4',
      type: 'Comments',
      title: 'Internal Pipeline Note',
      date: '2 days ago',
      author: currentUser?.name || 'Lisa Jones',
      status: 'Logged',
      notes: `${lead.businessName} has strong existing reputation with ${lead.rating || '4.8'} stars. Ideal candidate for the ₹699/mo Basic Growth tier.`,
      isPlanned: false
    }
  ];

  const [activities, setActivities] = useState<any[]>(
    Array.isArray(lead.activities) && lead.activities.length > 0 ? lead.activities : defaultActivities
  );

  const contactName = lead.firstName || (lead.businessName ? lead.businessName.split(' ')[0] : 'Decision Maker');
  const ownerName = lead.dealOwner || currentUser?.name || 'Molly Bates';
  const stageTheme = getStageColorTheme(editStage);
  const priorityTheme = getPriorityTheme(editPriority);
  const statusTheme = getStatusPillTheme(lead.dealStatus);

  const handleAddRequirement = async () => {
    if (!newReqInput.trim()) return;
    const updated = [...requirements, newReqInput.trim()];
    setRequirements(updated);
    setNewReqInput('');
    setIsAddingReq(false);
    await onUpdateLead({ ...lead, requirements: updated });
  };

  const handleRemoveRequirement = async (idx: number) => {
    const updated = requirements.filter((_, i) => i !== idx);
    setRequirements(updated);
    await onUpdateLead({ ...lead, requirements: updated });
  };

  const handlePostActivity = async () => {
    if (!activityText.trim()) return;
    setIsPostingActivity(true);

    const newAct = {
      id: `act-${Date.now()}`,
      type: activityType,
      title: activityType === 'Calls' 
        ? `Call: ${activityText.trim()}`
        : activityType === 'Tasks'
          ? `Task: ${activityText.trim()}`
          : activityType === 'Events'
            ? `Appointment: ${activityText.trim()}`
            : 'Team Note',
      date: activityDate ? activityDate : 'Just now',
      author: currentUser?.name || 'Workspace Operator',
      status: activityType === 'Tasks' || activityType === 'Events' ? 'Planned' : 'Completed',
      badge: activityType === 'Tasks' || activityType === 'Events' ? 'Planned' : undefined,
      notes: activityText.trim(),
      isPlanned: activityType === 'Tasks' || activityType === 'Events'
    };

    const nextActivities = [newAct, ...activities];
    setActivities(nextActivities);
    setActivityText('');
    setActivityDate('');
    setIsPostingActivity(false);

    await onUpdateLead({ ...lead, activities: nextActivities });
  };

  const handleSaveContactChanges = async () => {
    await onUpdateLead({
      ...lead,
      email: editEmail,
      phone: editPhone,
      website: editWebsite,
      status: editStage,
      priority: editPriority,
      dealValue: editValue
    });
    setIsEditingContact(false);
  };

  const filteredActivities = activities.filter(act => {
    if (activityFilter === 'All') return true;
    return act.type === activityFilter;
  });

  const plannedActivities = filteredActivities.filter(a => a.isPlanned);
  const historyActivities = filteredActivities.filter(a => !a.isPlanned);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ======================================================== */}
        {/* FLOWLU-STYLE CRM HEADER                                  */}
        {/* ======================================================== */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-bold text-sm">
              {contactName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                  {contactName}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityTheme.bg} ${priorityTheme.border}`}>
                  {priorityTheme.label} Priority
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTheme.bg} ${statusTheme.border}`}>
                  {statusTheme.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-delight">
                <span>Organization:</span>
                <strong className="text-slate-800 font-semibold">{lead.businessName}</strong>
                <span>&bull;</span>
                <span>{lead.location || 'Local Territory'}</span>
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenOutreachStudio(lead)}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              title="Compose Email"
            >
              <Mail className="w-4 h-4" />
            </button>

            <button
              onClick={() => onLaunchWhatsApp(lead)}
              className="p-2 rounded-lg border border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              title="WhatsApp Hook"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            {/* Blue Primary Create Button */}
            <div className="relative inline-block">
              <button 
                onClick={() => setActivityType('Tasks')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
                <ChevronDown className="w-3 h-3 text-blue-200" />
              </button>
            </div>

            <button
              onClick={() => setIsEditingContact(!isEditingContact)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingContact ? 'Cancel' : 'Edit'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SUB-NAVIGATION TABS (Matching Flowlu CRM Screen)         */}
        {/* ======================================================== */}
        <div className="px-6 bg-slate-50/70 border-b border-slate-200 flex items-center gap-6 overflow-x-auto text-xs shrink-0 custom-scrollbar">
          {(['Main', 'Tasks', 'Documents', 'Opportunities', 'Events', 'Calls', 'Notes', 'Email'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 font-semibold text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ======================================================== */}
        {/* 2-COLUMN MAIN CONTENT WORKSPACE                          */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/40">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ====================================================== */}
            {/* LEFT COLUMN: CONTACT & ORG PROFILE (~38% Width)        */}
            {/* ====================================================== */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Profile Attributes Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Website</span>
                    {lead.website ? (
                      <a 
                        href={lead.website} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-medium truncate block flex items-center gap-1 mt-0.5"
                      >
                        <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Industry / Category</span>
                    <span className="font-semibold text-slate-800 block mt-0.5 truncate">{lead.category || 'Local Business'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Category</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">Prospect</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Owner</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">
                        {ownerName[0]}
                      </div>
                      <span className="font-semibold text-slate-800 text-xs truncate">{ownerName}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Contact Information */}
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Email (Work)</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-semibold text-slate-900 select-all">{lead.email || 'No email on file'}</span>
                      {lead.email && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Phone (Work)</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-semibold text-slate-900 font-mono">{lead.phone || 'No phone on file'}</span>
                      <button 
                        onClick={() => onLaunchWhatsApp(lead)}
                        className="text-[10px] text-emerald-600 font-bold hover:underline"
                      >
                        WhatsApp &rarr;
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Editing Controls */}
                {isEditingContact && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 bg-slate-50 p-3 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Edit Quick Fields</span>
                    <input 
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email Address"
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none"
                    />
                    <input 
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Phone Number"
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button 
                        onClick={() => setIsEditingContact(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveContactChanges}
                        className="px-3 py-1 bg-blue-600 text-white font-bold text-xs rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Organization Card (Flowlu Organizations Box) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Organizations</span>
                  <button className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3 h-3" />
                    <span>Add relation</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{lead.businessName}</h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{lead.phone || 'N/A'}</p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{lead.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    <button onClick={() => onOpenOutreachStudio(lead)} className="p-1 hover:text-blue-600">
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onLaunchWhatsApp(lead)} className="p-1 hover:text-emerald-600">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Opportunity Economics & Stage (QuickSheetsCo Integration) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Opportunity Economics</span>
                  <span className="text-[10px] font-mono text-slate-400">QuickSheetsCo Sync</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-medium block">Deal Stage</span>
                    <select
                      value={editStage}
                      onChange={async (e) => {
                        const newStage = e.target.value;
                        setEditStage(newStage);
                        await onUpdateLead({ ...lead, status: newStage });
                      }}
                      className="w-full mt-1 bg-white border border-slate-200 rounded px-2 py-1 font-bold text-xs outline-none cursor-pointer"
                    >
                      {['Lead', 'Qualified', 'Demo', 'Proposal', 'Closed'].map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-medium block">Estimated Value</span>
                    <div className="font-extrabold text-sm text-slate-900 mt-1">
                      ₹{editValue.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-medium block">Priority Level</span>
                    <select
                      value={editPriority}
                      onChange={async (e) => {
                        const nextP = e.target.value as any;
                        setEditPriority(nextP);
                        await onUpdateLead({ ...lead, priority: nextP });
                      }}
                      className="w-full mt-1 bg-white border border-slate-200 rounded px-2 py-1 font-bold text-xs outline-none cursor-pointer"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-medium block">Win Probability</span>
                    <div className="font-extrabold text-sm text-emerald-700 mt-1">
                      {mapStageToQuickSheets(editStage) === 'Closed' ? '100%' : mapStageToQuickSheets(editStage) === 'Proposal' ? '80%' : mapStageToQuickSheets(editStage) === 'Demo' ? '60%' : mapStageToQuickSheets(editStage) === 'Qualified' ? '40%' : '20%'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirements & Notes Section (Flowlu Bio Card) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Project Requirements & Notes</span>
                  <button 
                    onClick={() => setIsAddingReq(true)}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add point</span>
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  {lead.notes || `${contactName} operates in the ${lead.category || 'commercial'} sector across ${lead.location || 'the target area'}. Key growth focus is expanding inbound inquiries with verified multi-channel dispatches.`}
                </p>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Scope Items:</span>
                  {requirements.map((req, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-md group">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                        <span>{req}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveRequirement(idx)}
                        className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {isAddingReq && (
                    <div className="flex items-center gap-2 pt-1">
                      <input 
                        type="text"
                        value={newReqInput}
                        onChange={(e) => setNewReqInput(e.target.value)}
                        placeholder="e.g. appointment booking flow"
                        className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs outline-none"
                        autoFocus
                      />
                      <button 
                        onClick={handleAddRequirement}
                        className="bg-blue-600 text-white font-bold text-xs px-2.5 py-1 rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                      <button 
                        onClick={() => setIsAddingReq(false)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ====================================================== */}
            {/* RIGHT COLUMN: FLOWLU ACTIVITY FEED (~62% Width)        */}
            {/* ====================================================== */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Activity Creator Box (Flowlu "Comment or schedule an activity") */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                    {ownerName[0]}
                  </div>
                  <span>Comment or schedule an activity</span>
                </div>

                {/* Interactive Filter / Type Chips (Matching Image 1) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {(['Tasks', 'Email', 'Comments', 'Events', 'Calls', 'Documents', 'Interactions'] as const).map(chip => (
                    <button
                      key={chip}
                      onClick={() => {
                        setActivityFilter(chip);
                        if (['Tasks', 'Comments', 'Events', 'Calls'].includes(chip)) {
                          setActivityType(chip as any);
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        activityFilter === chip
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                  {activityFilter !== 'All' && (
                    <button
                      onClick={() => setActivityFilter('All')}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-700 px-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Activity Composer Textarea */}
                <div className="pt-2 space-y-2">
                  <textarea 
                    rows={2}
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                    placeholder={
                      activityType === 'Calls'
                        ? 'Log client call notes and outcomes...'
                        : activityType === 'Tasks'
                          ? 'Enter task title or deliverables...'
                          : activityType === 'Events'
                            ? 'Meeting agenda and calendar booking notes...'
                            : 'Write an internal team comment or update...'
                    }
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:border-blue-400 transition-colors"
                  />
                  <div className="flex items-center justify-between">
                    <input 
                      type="text"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      placeholder="Due / Date (e.g. Next Tuesday 2:00 PM)"
                      className="w-64 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs outline-none"
                    />
                    <button
                      onClick={handlePostActivity}
                      disabled={isPostingActivity || !activityText.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post {activityType}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Planned Section (Upcoming Events & Tasks) */}
              {plannedActivities.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Planned Schedule</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      Planned
                    </span>
                  </div>

                  <div className="space-y-2">
                    {plannedActivities.map(act => (
                      <div 
                        key={act.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            {act.type === 'Events' ? <Calendar className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900">{act.title}</h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{act.date}</span>
                            </p>
                            {act.notes && (
                              <p className="text-xs text-slate-600 mt-1 font-sans">{act.notes}</p>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 shrink-0">
                          {act.badge || 'Planned'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History & Activity Log Timeline */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Timeline & Activity History</span>
                  <span className="text-[11px] font-mono text-slate-400">{historyActivities.length} items</span>
                </div>

                <div className="space-y-2.5">
                  {historyActivities.map(act => (
                    <div 
                      key={act.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            act.type === 'Calls' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {act.type === 'Calls' ? <Phone className="w-3.5 h-3.5" /> : (act.author ? act.author[0] : 'U')}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900">{act.author || act.title}</span>
                            <span className="text-[11px] text-slate-400 ml-2">{act.date}</span>
                          </div>
                        </div>

                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {act.type}
                        </span>
                      </div>

                      {act.title && act.type === 'Calls' && (
                        <h5 className="font-bold text-xs text-blue-900">{act.title}</h5>
                      )}

                      {act.notes && (
                        <p className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                          {act.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <button className="flex items-center gap-1 hover:text-slate-600 cursor-pointer">
                          <Heart className="w-3 h-3" />
                          <span>Like</span>
                        </button>
                        <span>&bull;</span>
                        <button className="hover:text-slate-600 cursor-pointer">Reply</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Flowlu Enterprise Workspace Layout Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
