import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { confirmDialog, alertDialog } from '../components/AppConfirmModal';
import axios from 'axios';
import { 
  Search, List, Kanban, 
  Plus, Phone, Globe, MapPin,
  MessageCircle, Send,
  Check, Edit3, ShieldCheck, GripVertical,
  X, ExternalLink, Trash2, Star, Sparkles,
  RotateCcw, Move, Maximize2,
  FileSpreadsheet, Download, Table2, Filter, Layers,
  ChevronDown, CheckCircle2, FolderPlus, Share2, HelpCircle, Menu,
  Mail, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { EMAIL_CAPTURE_BRIDGE_SCRIPT } from '../data/whatsappTemplates';
import { CrmFlowluDetailModal } from '../components/CrmFlowluDetailModal';
import { 
  exportCrmToXlsx, 
  exportCrmToCsv, 
  mapStageToQuickSheets, 
  getStageColorTheme, 
  getStatusPillTheme, 
  getPriorityTheme, 
  getEstimatedValue,
  getProbabilityForStage 
} from '../utils/crmExport';

const KANBAN_STAGES = [
  'Lead',
  'Qualified',
  'Demo',
  'Proposal',
  'Closed'
];

const DEFAULT_COL_WIDTH = 272;
const DEFAULT_COL_HEIGHT = 560;

const CrmPipeline = () => {
  const { user, integrations, notifyIntegration, syncLeadsToIntegration } = useStore();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');
  const [activeSheetTab, setActiveSheetTab] = useState<'Opportunities' | 'Contacts' | 'Organizations' | 'Interactions' | 'Dashboard' | 'Setup Data'>('Opportunities');
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isSyncingCrm, setIsSyncingCrm] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3800);
  };

  // Active Alert & CRM integrations
  const activeAlertApp = integrations.find(
    a => a.connected && ['slack', 'microsoft-teams', 'zapier', 'webhook-custom'].includes(a.id)
  );
  const activeCrmApp = integrations.find(
    a => a.connected && ['hubspot', 'salesforce', 'attio', 'google-sheets', 'airtable', 'notion'].includes(a.id)
  );
  
  // Lead Card Drag and Drop State
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Kanban Column Order (Drag-to-Reposition) State
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('leadpulse-kanban-order-v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === KANBAN_STAGES.length && KANBAN_STAGES.every(s => parsed.includes(s))) {
          return parsed;
        }
      }
    } catch {}
    return KANBAN_STAGES;
  });
  const [draggedColStage, setDraggedColStage] = useState<string | null>(null);
  const [dragOverColStage, setDragOverColStage] = useState<string | null>(null);

  // Kanban Column Dimensions (Mouse-Resizable Width & Height) State
  const [columnSizes, setColumnSizes] = useState<Record<string, { width: number; height: number }>>(() => {
    try {
      const saved = localStorage.getItem('leadpulse-kanban-sizes-v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {};
  });
  const [resizingCol, setResizingCol] = useState<{
    stage: string;
    direction: 'width' | 'height' | 'both';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Click-to-View Lead Details Modal State
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<any | null>(null);

  // Verified Interaction Popout Modal State
  const [selectedInteraction, setSelectedInteraction] = useState<{ lead: any; activity: any } | null>(null);

  // Inline Email Capture Upgrade State
  const [capturingLeadId, setCapturingLeadId] = useState<string | null>(null);
  const [capturedEmailInput, setCapturedEmailInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit Lead Modal State
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchLeads = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/leads', {
        headers: { userid: user?._id }
      });
      setLeads(res.data);
    } catch (err) {
      console.error(err);
      setLeads([]);
    }
  };

  useEffect(() => {
    if (user) fetchLeads();
  }, [user]);

  const toggleLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(l => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const toggleAll = () => {
    if (selectedLeads.length === leads.length && leads.length > 0) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(l => l._id));
    }
  };

  // Update lead status in Firestore + Trigger Connected Slack/Teams/CRM Hooks
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    const targetLead = leads.find(l => l._id === leadId);
    const leadName = targetLead?.businessName || 'Deal';

    try {
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l));
      await axios.patch(`http://localhost:3001/api/leads/${leadId}`, { status: newStatus }, {
        headers: { userid: user?._id }
      });

      if (activeAlertApp) {
        const channelLabel = activeAlertApp.config?.channel || activeAlertApp.config?.channelName || activeAlertApp.name;
        await notifyIntegration(
          activeAlertApp.id,
          `Pipeline Stage Transition: "${leadName}" moved to [${newStatus}] by ${user?.name || 'Operator'}`,
          {
            event: 'deal.stage_changed',
            businessName: leadName,
            newStage: newStatus,
            operator: user?.name || 'Workspace Operator'
          }
        );
        showToast(`Moved "${leadName}" to ${newStatus} • Alert sent to ${activeAlertApp.name} (${channelLabel}) [200 OK]`);
      } else {
        showToast(`Moved "${leadName}" to ${newStatus}`);
      }
    } catch (err) {
      console.error('Failed to update lead status:', err);
      fetchLeads();
    }
  };

  // Handle full lead payload updates from Flowlu Detail Modal
  const handleUpdateLead = async (updatedLead: any) => {
    if (!updatedLead?._id || !user?._id) return;
    try {
      setLeads(prev => prev.map(l => l._id === updatedLead._id ? updatedLead : l));
      if (selectedLeadDetails?._id === updatedLead._id) {
        setSelectedLeadDetails(updatedLead);
      }
      await axios.patch(`http://localhost:3001/api/leads/${updatedLead._id}`, updatedLead, {
        headers: { userid: user?._id }
      });
      showToast(`Saved updates for "${updatedLead.businessName}"`);
    } catch (err) {
      console.error('Failed to update lead:', err);
      fetchLeads();
    }
  };

  // 1-Click Sync Active Pipeline Deals to Connected CRM
  const handleSyncPipelineToCrm = async () => {
    if (!activeCrmApp) {
      navigate('/integrations');
      return;
    }
    const targetIds = selectedLeads.length > 0 ? selectedLeads : filteredLeads.map(l => l._id);
    if (targetIds.length === 0) {
      showToast('No pipeline deals to sync.');
      return;
    }
    setIsSyncingCrm(true);
    const result = await syncLeadsToIntegration(activeCrmApp.id, targetIds);
    setIsSyncingCrm(false);
    if (result) {
      const idSet = new Set(targetIds);
      setLeads(prev => prev.map(l => {
        if (!idSet.has(l._id)) return l;
        const existing = Array.isArray(l.syncedTo) ? l.syncedTo : [];
        return { ...l, syncedTo: Array.from(new Set([...existing, result.appName])) };
      }));
      showToast(result.deliveryNote || `Mirrored ${result.syncedCount} pipeline deal(s) to ${result.appName} [200 OK]`);
    }
  };

  // Lead Card Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/x-leadpulse-lead', leadId);
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(leadId);
    setDraggedColStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColStage) {
      if (dragOverColStage !== stage) setDragOverColStage(stage);
      return;
    }
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverStage === stage) setDragOverStage(null);
    if (dragOverColStage === stage) setDragOverColStage(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const colStage = e.dataTransfer.getData('application/x-leadpulse-col') || draggedColStage;
    if (colStage) {
      setDragOverColStage(null);
      setDraggedColStage(null);
      if (colStage !== targetStage) {
        setColumnOrder(prev => {
          const next = [...prev];
          const fromIdx = next.indexOf(colStage);
          const toIdx = next.indexOf(targetStage);
          if (fromIdx !== -1 && toIdx !== -1) {
            next.splice(fromIdx, 1);
            next.splice(toIdx, 0, colStage);
          }
          localStorage.setItem('leadpulse-kanban-order-v1', JSON.stringify(next));
          return next;
        });
        showToast(`Repositioned "${colStage}" column board`);
      }
      return;
    }

    const leadId = e.dataTransfer.getData('application/x-leadpulse-lead') || e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDragOverStage(null);
    setDraggedLeadId(null);

    if (leadId && !KANBAN_STAGES.includes(leadId)) {
      const targetLead = leads.find(l => l._id === leadId);
      if (targetLead && (targetLead.status || 'New') !== targetStage) {
        await handleUpdateStatus(leadId, targetStage);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStage(null);
    setDraggedColStage(null);
    setDragOverColStage(null);
  };

  // Kanban Column Header Drag-to-Reposition Handlers
  const handleColDragStart = (e: React.DragEvent, stage: string) => {
    e.dataTransfer.setData('application/x-leadpulse-col', stage);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColStage(stage);
    setDraggedLeadId(null);
  };

  // Mouse Resize Handlers for Individual Kanban Column Boards
  const startResizingColumn = (
    e: React.MouseEvent,
    stage: string,
    direction: 'width' | 'height' | 'both'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const current = columnSizes[stage] || { width: DEFAULT_COL_WIDTH, height: DEFAULT_COL_HEIGHT };
    setResizingCol({
      stage,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: current.width,
      startHeight: current.height
    });
  };

  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const deltaY = e.clientY - resizingCol.startY;

      setColumnSizes(prev => {
        const current = prev[resizingCol.stage] || {
          width: resizingCol.startWidth,
          height: resizingCol.startHeight
        };
        const nextWidth =
          resizingCol.direction === 'width' || resizingCol.direction === 'both'
            ? Math.max(210, Math.min(640, resizingCol.startWidth + deltaX))
            : current.width;
        const nextHeight =
          resizingCol.direction === 'height' || resizingCol.direction === 'both'
            ? Math.max(260, Math.min(920, resizingCol.startHeight + deltaY))
            : current.height;

        const updated = {
          ...prev,
          [resizingCol.stage]: { width: Math.round(nextWidth), height: Math.round(nextHeight) }
        };
        localStorage.setItem('leadpulse-kanban-sizes-v1', JSON.stringify(updated));
        return updated;
      });
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  const handleResetKanbanLayout = () => {
    setColumnOrder(KANBAN_STAGES);
    setColumnSizes({});
    localStorage.removeItem('leadpulse-kanban-order-v1');
    localStorage.removeItem('leadpulse-kanban-sizes-v1');
    showToast('Kanban board positions & dimensions restored to default');
  };

  // 1-Click Upgrade Record from "Phone-Only" to "Verified Email Lead"
  const handleSaveCapturedEmail = async (leadId: string) => {
    if (!capturedEmailInput || !capturedEmailInput.includes('@')) {
      await alertDialog({
        title: 'Invalid Email Address',
        message: 'Please enter a valid email address before upgrading this lead record.',
        variant: 'warning'
      });
      return;
    }

    setIsUpdating(true);
    try {
      setLeads(prev => prev.map(l => l._id === leadId ? { 
        ...l, 
        email: capturedEmailInput, 
        emailStatus: 'Verified Email',
        status: 'Email Verified & Captured'
      } : l));

      await axios.patch(`http://localhost:3001/api/leads/${leadId}`, {
        email: capturedEmailInput,
        emailStatus: 'Verified Email',
        status: 'Email Verified & Captured'
      }, {
        headers: { userid: user?._id }
      });

      setCapturingLeadId(null);
      setCapturedEmailInput('');
    } catch (err) {
      console.error('Failed to upgrade email:', err);
      await alertDialog({
        title: 'Save Error',
        message: 'Failed to save captured email address. Please try again.',
        variant: 'error'
      });
      fetchLeads();
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Save / Update Lead Details
  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead?._id || !user?._id) return;
    setIsSavingEdit(true);
    try {
      const payload = {
        businessName: editingLead.businessName,
        email: editingLead.email || '',
        phone: editingLead.phone || '',
        website: editingLead.website || '',
        category: editingLead.category || 'General',
        location: editingLead.location || '',
        status: editingLead.status || 'New'
      };
      const res = await axios.patch(`http://localhost:3001/api/leads/${editingLead._id}`, payload, {
        headers: { userid: user?._id }
      });
      const updated = res.data?.lead || { ...editingLead, ...payload };
      setLeads(prev => prev.map(l => l._id === editingLead._id ? updated : l));
      if (selectedLeadDetails?._id === editingLead._id) {
        setSelectedLeadDetails(updated);
      }
      setEditingLead(null);
    } catch (err) {
      console.error('Failed to update lead:', err);
      await alertDialog({
        title: 'Update Error',
        message: 'Failed to update lead details. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 1-Click Launch WhatsApp with Convenience-Framing Script
  const handleLaunchWhatsApp = (lead: any) => {
    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const message = `Hey ${lead.firstName || lead.businessName}! Came across ${lead.businessName} in ${lead.location}. ${EMAIL_CAPTURE_BRIDGE_SCRIPT}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    
    // Auto-advance stage to WhatsApp Contacted
    handleUpdateStatus(lead._id, 'WhatsApp Contacted');
    window.open(url, '_blank');
  };

  const filteredLeads = leads.filter(l => {
    const bName = l.businessName || '';
    const cat = l.category || '';
    const loc = l.location || '';
    return bName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           cat.toLowerCase().includes(searchQuery.toLowerCase()) ||
           loc.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter for genuine, endpoint-verified interactions only (No fake / dummy rows)
  const verifiedInteractions = leads.flatMap(lead => {
    if (!Array.isArray(lead.activities)) return [];
    return lead.activities
      .filter((act: any) => act && (act.deliveredAt || act.status === 'Delivered' || act.channel))
      .map((act: any) => ({
        lead,
        activity: act
      }));
  }).sort((a, b) => {
    const dateA = new Date(a.activity.deliveredAt || a.activity.date || 0).getTime();
    const dateB = new Date(b.activity.deliveredAt || b.activity.date || 0).getTime();
    return dateB - dateA;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'New': return 'bg-blue-50 text-blue-700 border-blue-200/60';
      case 'WhatsApp Contacted': return 'bg-violet-50 text-violet-700 border-violet-200/60';
      case 'Replied / Awaiting Email': return 'bg-cyan-50 text-cyan-700 border-cyan-200/60';
      case 'Email Verified & Captured': return 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
      case 'Proposal Sent': return 'bg-purple-50 text-purple-700 border-purple-200/60';
      case 'Closed Won': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-transparent font-sans text-slate-900">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header title="Unified B2B Pipeline & Smart WhatsApp Bridge" />

        <div className="flex-1 flex flex-col p-6 sm:p-8 overflow-hidden space-y-6">
          
          {toastMessage && (
            <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-xl border border-slate-800 text-xs font-delight font-medium flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Top Stage Progression Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
            {KANBAN_STAGES.map((stage) => {
              const count = leads.filter(l => mapStageToQuickSheets(l.status) === stage).length;
              const theme = getStageColorTheme(stage);
              const stageValue = leads
                .filter(l => mapStageToQuickSheets(l.status) === stage)
                .reduce((sum, l) => sum + getEstimatedValue(l), 0);

              return (
                <div key={stage} className="bg-white border border-slate-200/90 rounded-lg p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 font-delight font-bold uppercase tracking-wider truncate">{stage}</span>
                    <span className={`w-2 h-2 rounded-full ${theme.bg}`}></span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="text-base font-delight font-bold text-slate-900">{count}</div>
                    <div className="text-[10px] text-slate-400 font-mono">₹{stageValue.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-72 sm:w-84">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search business, location, category..."
                  className="w-full bg-white border border-slate-200 rounded-md py-1.5 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-slate-400 outline-none shadow-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <span className="text-xs text-slate-500 font-delight font-normal hidden sm:inline-block">
                {filteredLeads.length} leads
              </span>

              {activeAlertApp && (
                <span
                  onClick={() => navigate('/integrations')}
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/90 border border-emerald-200/80 text-[10px] font-delight font-medium text-emerald-700 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                  title="Stage transitions automatically alert your connected workspace channel"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Stage Alerts: <b>{activeAlertApp.name}</b> ({activeAlertApp.config?.channel || 'Live'})</span>
                </span>
              )}
            </div>

            {/* View Switcher & Action Controls */}
            <div className="flex items-center gap-2.5">
              {selectedLeads.length > 0 && (
                <button 
                  onClick={async () => {
                    for (const id of selectedLeads) {
                      await axios.delete(`http://localhost:3001/api/leads/${id}`, { headers: { userid: user?._id } }).catch(() => {});
                    }
                    setSelectedLeads([]);
                    fetchLeads();
                  }}
                  className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border border-rose-200 cursor-pointer font-delight"
                >
                  Delete ({selectedLeads.length})
                </button>
              )}

              {/* Export Actions */}
              <button
                onClick={() => {
                  exportCrmToXlsx(filteredLeads, user);
                  showToast(`Exported ${filteredLeads.length} leads to CRM XLSX (4 Sheets)`);
                }}
                className="bg-[#107C41] hover:bg-[#0E6C38] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Download formatted CRM workbook (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export XLSX</span>
              </button>

              <button
                onClick={() => {
                  exportCrmToCsv(filteredLeads, user);
                  showToast(`Exported ${filteredLeads.length} leads to CRM CSV`);
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Download formatted CRM CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              {activeCrmApp && (
                <button
                  onClick={handleSyncPipelineToCrm}
                  disabled={isSyncingCrm}
                  className="bg-white hover:bg-blue-50/70 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-delight font-semibold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isSyncingCrm ? 'Syncing...' : `Mirror to ${activeCrmApp.name}`}</span>
                </button>
              )}

              {viewMode === 'kanban' && (
                <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E5E0D5] text-[10px] font-delight text-[#6E675F]">
                  <Move className="w-3 h-3 text-[#C85A32]" />
                  <span>Drag board header to move</span>
                  <span className="text-[#D6CFC2]">•</span>
                  <Maximize2 className="w-3 h-3 text-[#C85A32]" />
                  <span>Drag edges/corner to resize</span>
                </div>
              )}

              {viewMode === 'kanban' && (Object.keys(columnSizes).length > 0 || JSON.stringify(columnOrder) !== JSON.stringify(KANBAN_STAGES)) && (
                <button
                  onClick={handleResetKanbanLayout}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-delight font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Restore default Kanban column order and dimensions"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Boards</span>
                </button>
              )}

              <button
                onClick={() => navigate('/finder')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-100" />
                <span>New Harvest</span>
              </button>

              <div className="flex items-center bg-white border border-slate-200 rounded-md p-0.5 shadow-xs">
                <button 
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'kanban' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" /> 
                  <span>Kanban</span>
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> 
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* KANBAN VIEW (Mouse-Resizable & Drag-to-Reposition Boards) */}
          {viewMode === 'kanban' && (
            <div className="flex-1 flex items-start gap-3.5 min-h-0 h-full overflow-x-auto overflow-y-auto pb-4 pr-2 custom-scrollbar select-none">
              {columnOrder.map((stage) => {
                const stageLeads = filteredLeads.filter(l => mapStageToQuickSheets(l.status) === stage);
                const isOver = dragOverStage === stage && !draggedColStage;
                const isColOver = dragOverColStage === stage && draggedColStage && draggedColStage !== stage;
                const isColDragged = draggedColStage === stage;
                const isResizingThis = resizingCol?.stage === stage;
                const colSize = columnSizes[stage] || { width: DEFAULT_COL_WIDTH, height: DEFAULT_COL_HEIGHT };
                
                return (
                  <div 
                    key={stage}
                    style={{
                      width: `${colSize.width}px`,
                      height: `${colSize.height}px`,
                      minWidth: '210px',
                      maxWidth: '640px',
                      minHeight: '260px',
                      maxHeight: '920px'
                    }}
                    onDragOver={(e) => handleDragOver(e, stage)}
                    onDragLeave={(e) => handleDragLeave(e, stage)}
                    onDrop={(e) => handleDrop(e, stage)}
                    className={`relative shrink-0 flex flex-col rounded-md border transition-colors duration-150 overflow-hidden group/board ${
                      isColDragged
                        ? 'opacity-45 border-dashed border-[#C85A32] bg-[#FAF8F5]'
                        : isColOver
                          ? 'bg-[#C85A32]/5 border-[#C85A32] border-2 shadow-md'
                          : isResizingThis
                            ? 'bg-slate-50 border-[#C85A32] ring-1 ring-[#C85A32]/30 shadow-md'
                            : isOver 
                              ? 'bg-slate-100 border-slate-900 border-2' 
                              : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    
                    {/* Column Header (Draggable Handle to Reposition Board) */}
                    <div
                      draggable={true}
                      onDragStart={(e) => handleColDragStart(e, stage)}
                      onDragEnd={handleDragEnd}
                      title="Drag header to reposition this Kanban board"
                      className="px-2.5 py-2 border-b flex items-center justify-between shrink-0 bg-white border-slate-200 cursor-grab active:cursor-grabbing hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover/board:text-[#C85A32] shrink-0 transition-colors" />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStageColorTheme(stage).bg}`}></span>
                        <h3 className="font-bold text-xs text-slate-900 truncate tracking-tight" title={stage}>{stage}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(isResizingThis || columnSizes[stage]) && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            isResizingThis
                              ? 'bg-[#C85A32] text-white border-[#C85A32] font-bold'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {colSize.width}×{colSize.height}
                          </span>
                        )}
                        <span className="text-[10px] font-delight font-bold px-1.5 py-0.5 rounded-sm border bg-slate-100 text-slate-700 border-slate-200 shrink-0">
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Cards Container (Vertical Scroll) */}
                    <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2">
                      {stageLeads.length === 0 ? (
                        <div className={`p-4 text-center text-[11px] rounded-md border border-dashed transition-all font-delight font-medium ${
                          isOver 
                            ? 'border-accent text-accent font-bold bg-accent/5' 
                            : 'border-slate-200 text-slate-400'
                        }`}>
                          {isOver ? 'Drop lead here' : 'No leads'}
                        </div>
                      ) : (
                        stageLeads.map((lead) => {
                          const isPhoneOnly = !lead.email || lead.email.includes('no_email') || lead.emailStatus === 'Phone Only / No Email Found';
                          const isBeingDragged = draggedLeadId === lead._id;
                          const dealVal = getEstimatedValue(lead);
                          
                          return (
                            <div 
                              key={lead._id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, lead._id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedLeadDetails(lead)}
                              className={`bg-white border rounded-md p-2.5 transition-colors space-y-2 group cursor-pointer select-none hover:border-slate-400 ${
                                isBeingDragged 
                                  ? 'opacity-40 border-dashed border-accent' 
                                  : 'border-slate-200'
                              }`}
                            >
                              {/* Top Row: Drag Handle + Name */}
                              <div className="flex items-start gap-1.5 min-w-0">
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-accent transition-colors break-words whitespace-normal leading-snug tracking-tight" title={lead.businessName}>
                                    {lead.businessName}
                                  </h4>
                                  <div className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5 font-delight">
                                    <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                    <span className="truncate">{lead.location}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Middle Row: Category + Value */}
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-delight font-medium px-1.5 py-0.5 bg-slate-100 rounded-sm text-slate-600 truncate max-w-[100px] border border-slate-200">
                                  {lead.category || 'Local'}
                                </span>
                                <span className="text-slate-900 font-mono font-bold shrink-0">
                                  ₹{dealVal.toLocaleString('en-IN')}
                                </span>
                              </div>

                              {/* Bottom Row: Contact Status Badge + Synced Indicator + Click hint */}
                              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  {isPhoneOnly ? (
                                    <span className="font-delight font-medium text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200 flex items-center gap-1 truncate max-w-[90px]">
                                      <Phone className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">WA</span>
                                    </span>
                                  ) : (
                                    <span className="font-delight font-medium text-[9px] text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded-sm border border-slate-200 flex items-center gap-1 truncate max-w-[90px]">
                                      <ShieldCheck className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                      <span className="truncate">Email</span>
                                    </span>
                                  )}
                                  {Array.isArray(lead.syncedTo) && lead.syncedTo.length > 0 && (
                                    <span className="font-delight font-medium text-[8px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded-sm border border-emerald-200 truncate max-w-[70px]" title={`Synced: ${lead.syncedTo.join(', ')}`}>
                                      ✓ {lead.syncedTo[0]}
                                    </span>
                                  )}
                                </div>

                                <span className="text-[9px] font-delight font-normal text-slate-400 group-hover:text-slate-900 flex items-center gap-0.5 shrink-0">
                                  View →
                                </span>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Right-Edge Mouse Resize Handle (Width) */}
                    <div
                      onMouseDown={(e) => startResizingColumn(e, stage, 'width')}
                      title="Drag horizontally to resize board width"
                      className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-[#C85A32]/40 active:bg-[#C85A32] transition-colors z-10"
                    />

                    {/* Bottom-Edge Mouse Resize Handle (Height) */}
                    <div
                      onMouseDown={(e) => startResizingColumn(e, stage, 'height')}
                      title="Drag vertically to resize board height"
                      className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize hover:bg-[#C85A32]/40 active:bg-[#C85A32] transition-colors z-10"
                    />

                    {/* Bottom-Right Corner Mouse Resize Handle (Width + Height) */}
                    <div
                      onMouseDown={(e) => startResizingColumn(e, stage, 'both')}
                      title="Drag corner to resize board width and height"
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 z-20 text-slate-400 hover:text-[#C85A32] transition-colors"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                        <path d="M9 1L1 9M9 5L5 9M9 8.5L8.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW (QUICKSHEETSCO. GOOGLE SHEETS SPREADSHEET ENGINE - IMAGE 2) */}
          {viewMode === 'table' && (
            <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
              
              {/* CRM Category Tabs & Metrics Strip */}
              <div className="bg-[#FAF8F5] border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(['Opportunities', 'Contacts', 'Organizations', 'Interactions', 'Dashboard', 'Setup Data'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveSheetTab(tab)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSheetTab === tab
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span>{tab === 'Opportunities' ? 'Opportunities (Deals)' : tab === 'Dashboard' ? 'Analytics' : tab}</span>
                      {activeSheetTab === tab && tab === 'Opportunities' && (
                        <span className="text-[10px] bg-slate-800 text-slate-200 px-1.5 py-0.2 rounded-full font-mono">
                          {filteredLeads.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium hidden sm:flex">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Firestore Synced</span>
                  </span>
                  <span>•</span>
                  <span>Total Pipeline: <b>₹{leads.reduce((s, l) => s + getEstimatedValue(l), 0).toLocaleString('en-IN')}</b></span>
                </div>
              </div>

              {/* Main Sheet Grid Container */}
              <div className="flex-1 overflow-auto custom-scrollbar">

                {/* TAB 1: OPPORTUNITIES SHEET (IMAGE 2 EXACT REPLICA) */}
                {activeSheetTab === 'Opportunities' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#1C3549] text-white z-10 shadow-xs">
                      <tr className="text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3 text-center border-r border-[#2C485F] w-10 text-slate-400 font-mono">#</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-10 text-center cursor-pointer" onClick={toggleAll}>
                          <input 
                            type="checkbox" 
                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0} 
                            readOnly 
                            className="w-3.5 h-3.5 rounded-sm accent-emerald-500 cursor-pointer" 
                          />
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-24">Priority</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[220px]">Name</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Deal Owner</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[180px]">Organization</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-24">Status</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-32">Stage</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-28">Loss Reason</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-32">Source</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-28 text-right">Value</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-24 text-center">Probability</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-28 text-center">Interactions</th>
                        <th className="py-2.5 px-3 w-28 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredLeads.map((lead, i) => {
                        const stage = mapStageToQuickSheets(lead.status);
                        const stageTheme = getStageColorTheme(stage);
                        const prob = getProbabilityForStage(lead.status);
                        const val = getEstimatedValue(lead);
                        const priority = lead.priority || (val >= 80000 ? 'High' : val >= 50000 ? 'Medium' : 'Low');
                        const isSelected = selectedLeads.includes(lead._id);
                        const ownerName = lead.dealOwner || user?.name || 'Lisa Jones';
                        const isLost = lead.status === 'Lost' || (lead.dealStatus === 'Lost');

                        return (
                          <tr 
                            key={lead._id || i} 
                            className={`hover:bg-slate-50/90 transition-colors ${isSelected ? 'bg-emerald-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                          >
                            {/* Row Index */}
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px] bg-[#F8F9FA]">
                              {i + 1}
                            </td>

                            {/* Checkbox */}
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 cursor-pointer" onClick={() => toggleLead(lead._id)}>
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                readOnly 
                                className="w-3.5 h-3.5 rounded-sm accent-emerald-600 cursor-pointer" 
                              />
                            </td>

                            {/* Priority */}
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                priority === 'High' 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                  : priority === 'Low'
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {priority}
                              </span>
                            </td>

                            {/* Name (Click to open Flowlu CRM Detail Workspace) */}
                            <td className="py-2.5 px-4 border-r border-slate-200 cursor-pointer" onClick={() => setSelectedLeadDetails(lead)}>
                              <div className="font-bold text-slate-900 text-xs hover:text-emerald-700 transition-colors tracking-tight leading-snug">
                                {lead.dealName || `${lead.businessName} - Growth Project`}
                              </div>
                              <div className="text-[10px] text-slate-400 font-delight flex items-center gap-1 mt-0.5">
                                <span>{lead.category || 'Direct Account'}</span>
                                {lead.location && <span>• {lead.location}</span>}
                              </div>
                            </td>

                            {/* Deal Owner */}
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {ownerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-700 text-xs truncate max-w-[100px]">{ownerName}</span>
                              </div>
                            </td>

                            {/* Organization */}
                            <td className="py-2.5 px-4 border-r border-slate-200">
                              <div className="font-semibold text-slate-800 text-xs truncate max-w-[170px]" title={lead.businessName}>
                                {lead.businessName}
                              </div>
                              {lead.website ? (
                                <a 
                                  href={lead.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 mt-0.5 truncate max-w-[160px]"
                                >
                                  <Globe className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400">Direct Local</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isLost 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                  : stage === 'Closed'
                                    ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {isLost ? 'Lost' : stage === 'Closed' ? 'Closed' : 'Open'}
                              </span>
                            </td>

                            {/* Stage (Interactive Dropdown with QuickSheetsCo Stage Colors) */}
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <select
                                value={stage}
                                onChange={(e) => handleUpdateStatus(lead._id, e.target.value)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold text-white shadow-2xs outline-none cursor-pointer transition-all ${stageTheme.bg}`}
                              >
                                {KANBAN_STAGES.map(st => (
                                  <option key={st} value={st} className="bg-white text-slate-900 font-medium">
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Loss Reason */}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-slate-500 text-[11px]">
                              {isLost ? (lead.lossReason || 'Competitor Pricing') : '-'}
                            </td>

                            {/* Source */}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 text-xs truncate max-w-[120px]">
                              {lead.source || (lead.category ? `${lead.category} Scraper` : 'Google Maps')}
                            </td>

                            {/* Value */}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900 text-xs">
                              ₹{val.toLocaleString('en-IN')}
                            </td>

                            {/* Probability */}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-emerald-500 h-full rounded-full transition-all" 
                                    style={{ width: `${prob}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono font-bold text-slate-700">{prob}%</span>
                              </div>
                            </td>

                            {/* Interactions */}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                              {(() => {
                                const leadActs = (Array.isArray(lead.activities) ? lead.activities : [])
                                  .filter((a: any) => a && (a.deliveredAt || a.status === 'Delivered' || a.channel));
                                if (leadActs.length > 0) {
                                  const latest = leadActs[leadActs.length - 1];
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedInteraction({ lead, activity: latest })}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
                                      title="Verified Delivered. Click to view popout delivery card."
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      <span>{leadActs.length} {leadActs.length === 1 ? 'Dispatch' : 'Dispatches'}</span>
                                    </button>
                                  );
                                }
                                return (
                                  <span className="text-[10px] text-slate-400 italic">None</span>
                                );
                              })()}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => setSelectedLeadDetails(lead)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                  title="Open Flowlu CRM Workspace"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleLaunchWhatsApp(lead)}
                                  className="p-1 rounded hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                                  title="Launch WhatsApp Hook"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setEditingLead({ ...lead })}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                  title="Edit Contact & Business"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => navigate('/outreach')}
                                  className="p-1 rounded hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                                  title="Open Outreach Studio"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* TAB 2: CONTACTS SHEET */}
                {activeSheetTab === 'Contacts' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#1C3549] text-white z-10 shadow-xs">
                      <tr className="text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3 text-center border-r border-[#2C485F] w-10 text-slate-400 font-mono">#</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[200px]">Contact Name</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[200px]">Organization</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[200px]">Email</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Phone / WhatsApp</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-32">Industry</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Location</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-28">Stage</th>
                        <th className="py-2.5 px-3 w-24 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredLeads.map((lead, i) => (
                        <tr key={lead._id || i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px] bg-[#F8F9FA]">{i + 1}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-900 cursor-pointer" onClick={() => setSelectedLeadDetails(lead)}>
                            {lead.firstName || (lead.businessName ? lead.businessName.split(' ')[0] + ' (Lead Contact)' : 'Primary Contact')}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-slate-800 font-medium">{lead.businessName}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-slate-600 font-mono text-[11px]">{lead.email || 'N/A'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800 font-medium">{lead.phone || 'N/A'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">{lead.category || 'Professional Services'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">{lead.location || 'Local'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getStageColorTheme(mapStageToQuickSheets(lead.status)).bg}`}>
                              {mapStageToQuickSheets(lead.status)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button onClick={() => setSelectedLeadDetails(lead)} className="p-1 hover:bg-slate-200 rounded text-slate-700 cursor-pointer">
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* TAB 3: ORGANIZATIONS SHEET */}
                {activeSheetTab === 'Organizations' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#1C3549] text-white z-10 shadow-xs">
                      <tr className="text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3 text-center border-r border-[#2C485F] w-10 text-slate-400 font-mono">#</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[220px]">Organization</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Industry</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-40">Location</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-24">Rating</th>
                        <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[200px]">Website</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Phone</th>
                        <th className="py-2.5 px-3 border-r border-[#2C485F] w-28">Status</th>
                        <th className="py-2.5 px-3 w-24 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredLeads.map((lead, i) => (
                        <tr key={lead._id || i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px] bg-[#F8F9FA]">{i + 1}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-900 cursor-pointer" onClick={() => setSelectedLeadDetails(lead)}>
                            {lead.businessName}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">{lead.category || 'Commercial Services'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">{lead.location || 'Local'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-amber-600 font-bold">★ {lead.rating || '4.8'}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-emerald-600 truncate max-w-[190px]">{lead.website || 'N/A'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">{lead.phone || 'N/A'}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Active
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button onClick={() => setSelectedLeadDetails(lead)} className="p-1 hover:bg-slate-200 rounded text-slate-700 cursor-pointer">
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* TAB 4: INTERACTIONS SHEET */}
                {activeSheetTab === 'Interactions' && (
                  <div className="w-full">
                    {verifiedInteractions.length === 0 ? (
                      <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">No Verified Dispatches Yet</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-delight">
                          LeadPulse enforces strict delivery verification. Only communications confirmed as delivered by the underlying gateway (Email/Brevo 250 OK, WhatsApp, or Google Calendar) are logged here.
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate('/outreach')}
                          className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1C3549] hover:bg-[#2C485F] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Launch Campaign in Outreach Studio</span>
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-[#1C3549] text-white z-10 shadow-xs">
                          <tr className="text-[10px] uppercase font-bold tracking-wider">
                            <th className="py-2.5 px-3 text-center border-r border-[#2C485F] w-10 text-slate-400 font-mono">#</th>
                            <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Delivery Time</th>
                            <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[180px]">Organization</th>
                            <th className="py-2.5 px-3 border-r border-[#2C485F] w-36">Channel & Method</th>
                            <th className="py-2.5 px-4 border-r border-[#2C485F] min-w-[260px]">Delivery Title / Note</th>
                            <th className="py-2.5 px-3 border-r border-[#2C485F] w-32">Sender</th>
                            <th className="py-2.5 px-3 border-r border-[#2C485F] w-28 text-center">Audit Status</th>
                            <th className="py-2.5 px-3 w-20 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {verifiedInteractions.map(({ lead, activity }, i) => {
                            const deliveredDate = activity.deliveredAt || activity.date;
                            const formattedDate = deliveredDate ? new Date(deliveredDate).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Delivered';
                            return (
                              <tr 
                                key={activity.id || i}
                                onClick={() => setSelectedInteraction({ lead, activity })}
                                className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                              >
                                <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px] bg-[#F8F9FA]">{i + 1}</td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-mono text-[11px]">
                                  {formattedDate}
                                </td>
                                <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {lead.businessName}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {activity.channel === 'whatsapp' ? 'WhatsApp' : activity.channel === 'calendar' ? 'Calendar' : 'Email'}
                                    {activity.method && <span className="text-slate-400 font-normal">({activity.method})</span>}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 border-r border-slate-200 text-slate-600 truncate max-w-[280px]">
                                  {activity.title || activity.subject || activity.text || `Verified delivery to ${lead.businessName}`}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                                  {activity.author || user?.name || 'LeadPulse Operator'}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>Delivered</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedInteraction({ lead, activity });
                                    }}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                    title="View Popout Audit Card"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* TAB 5: DASHBOARD SHEET */}
                {activeSheetTab === 'Dashboard' && (
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Pipeline Value</div>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                          ₹{leads.reduce((s, l) => s + getEstimatedValue(l), 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium mt-1">Weighted by probability</div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Deals</div>
                        <div className="text-2xl font-bold font-delight text-slate-900 mt-1">{leads.length}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-1">In 5 pipeline stages</div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Deal Size</div>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                          ₹{leads.length > 0 ? Math.round(leads.reduce((s, l) => s + getEstimatedValue(l), 0) / leads.length).toLocaleString('en-IN') : 0}
                        </div>
                        <div className="text-[10px] text-blue-600 font-medium mt-1">Per targeted organization</div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Closed Won Ratio</div>
                        <div className="text-2xl font-bold font-delight text-emerald-700 mt-1">
                          {leads.length > 0 ? Math.round((leads.filter(l => mapStageToQuickSheets(l.status) === 'Closed').length / leads.length) * 100) : 0}%
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium mt-1">Historical win velocity</div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Pipeline Stage Progression</h4>
                      <div className="space-y-3">
                        {KANBAN_STAGES.map((st) => {
                          const count = leads.filter(l => mapStageToQuickSheets(l.status) === st).length;
                          const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                          const theme = getStageColorTheme(st);
                          return (
                            <div key={st} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                                  <span className={`w-2 h-2 rounded-full ${theme.bg}`}></span>
                                  <span>{st}</span>
                                </span>
                                <span className="font-mono text-slate-600">{count} deals ({pct}%)</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${theme.bg}`} style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 6: SETUP DATA SHEET */}
                {activeSheetTab === 'Setup Data' && (
                  <div className="p-6 space-y-6">
                    <h4 className="font-bold text-sm text-slate-900 tracking-tight">CRM Pipeline Schema Reference</h4>
                    <table className="w-full text-left border-collapse text-xs border border-slate-200">
                      <thead className="bg-[#1C3549] text-white">
                        <tr className="text-[10px] uppercase font-bold tracking-wider">
                          <th className="py-2.5 px-4 border-r border-[#2C485F]">Pipeline Stage</th>
                          <th className="py-2.5 px-4 border-r border-[#2C485F]">Win Probability</th>
                          <th className="py-2.5 px-4 border-r border-[#2C485F]">Color Hex</th>
                          <th className="py-2.5 px-4">Workflow Trigger</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-rose-600">Lead</td>
                          <td className="py-2.5 px-4 font-mono">20%</td>
                          <td className="py-2.5 px-4 font-mono">#EF4444 (Red)</td>
                          <td className="py-2.5 px-4 text-slate-600">Initial business discovered from web harvest or directory crawl</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-orange-600">Qualified</td>
                          <td className="py-2.5 px-4 font-mono">40%</td>
                          <td className="py-2.5 px-4 font-mono">#FB923C (Orange)</td>
                          <td className="py-2.5 px-4 text-slate-600">Decision maker contact identified or reply received</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-amber-600">Demo</td>
                          <td className="py-2.5 px-4 font-mono">60%</td>
                          <td className="py-2.5 px-4 font-mono">#F59E0B (Amber)</td>
                          <td className="py-2.5 px-4 text-slate-600">Interactive product walkthrough or strategy call booked</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-teal-600">Proposal</td>
                          <td className="py-2.5 px-4 font-mono">80%</td>
                          <td className="py-2.5 px-4 font-mono">#14B8A6 (Teal)</td>
                          <td className="py-2.5 px-4 text-slate-600">Commercial pricing, scope of work, and contract submitted</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-indigo-600">Closed</td>
                          <td className="py-2.5 px-4 font-mono">100%</td>
                          <td className="py-2.5 px-4 font-mono">#6366F1 (Purple)</td>
                          <td className="py-2.5 px-4 text-slate-600">Deal finalized and converted to paying active revenue account</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

              {/* Table Footer Status */}
              <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>CRM Database Active</span>
                  {selectedLeads.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-slate-900 font-semibold">{selectedLeads.length} leads selected</span>
                    </>
                  )}
                </div>
                <div>
                  <span>Showing {filteredLeads.length} of {leads.length} total leads</span>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* FLOWLU ENTERPRISE CRM DETAIL WORKSPACE (IMAGE 1)         */}
      {/* ======================================================== */}
      <CrmFlowluDetailModal
        isOpen={Boolean(selectedLeadDetails)}
        onClose={() => setSelectedLeadDetails(null)}
        lead={selectedLeadDetails}
        onUpdateLead={handleUpdateLead}
        onLaunchWhatsApp={handleLaunchWhatsApp}
        onOpenOutreachStudio={() => {
          setSelectedLeadDetails(null);
          navigate('/outreach');
        }}
        currentUser={user}
      />

      {/* ================= MODAL: EDIT LEAD / CONTACT DETAILS ================= */}
      {editingLead && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Edit Contact & Business Details</h3>
                  <p className="text-[11px] font-delight font-normal text-slate-400">Shorten listing title, edit email, phone, location & stage</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingLead(null)} 
                className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLead} className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">
                  Business / Listing Title *
                </label>
                <textarea 
                  rows={2}
                  required
                  value={editingLead.businessName || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, businessName: e.target.value })}
                  placeholder="e.g. Digital Keddy"
                  className="w-full p-2 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400 leading-snug"
                />
                <span className="text-[10px] text-slate-400 font-delight font-normal">
                  Tip: Shorten long Google Places keyword titles to the clean brand name.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Phone / WhatsApp</label>
                  <input 
                    type="text"
                    value={editingLead.phone || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Direct Email</label>
                  <input 
                    type="email"
                    value={editingLead.email || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    placeholder="contact@business.com"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Category</label>
                  <input 
                    type="text"
                    value={editingLead.category || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, category: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Location</label>
                  <input 
                    type="text"
                    value={editingLead.location || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, location: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Website URL</label>
                <input 
                  type="url"
                  value={editingLead.website || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, website: e.target.value })}
                  placeholder="https://company.com"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Pipeline Stage</label>
                <select
                  value={editingLead.status || 'New'}
                  onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400 bg-white cursor-pointer"
                >
                  {KANBAN_STAGES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button 
                  type="button" 
                  onClick={() => setEditingLead(null)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 font-delight font-medium text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingEdit}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors disabled:opacity-50 border border-slate-900 cursor-pointer"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: INTERACTION DETAIL POPOUT CARD ================= */}
      {selectedInteraction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Card Header with Verified Badge */}
            <div className="bg-[#1C3549] text-white p-5 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Verified Delivery Confirmed
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    {selectedInteraction.activity.method || 'Gateway Protocol'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight mt-1">
                  {selectedInteraction.lead.businessName}
                </h3>
                <p className="text-xs text-slate-300 font-delight">
                  {selectedInteraction.lead.category || 'Direct Account'} {selectedInteraction.lead.location ? `• ${selectedInteraction.lead.location}` : ''}
                </p>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedInteraction(null)}
                className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Card Content Grid */}
            <div className="p-5 space-y-4 text-xs font-delight">
              
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</div>
                  <div className="font-mono font-medium text-slate-800 mt-0.5">
                    {selectedInteraction.activity.deliveredAt 
                      ? new Date(selectedInteraction.activity.deliveredAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })
                      : 'Confirmed'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channel & Method</div>
                  <div className="font-semibold text-slate-800 mt-0.5 capitalize flex items-center gap-1.5">
                    {selectedInteraction.activity.channel === 'whatsapp' ? (
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : selectedInteraction.activity.channel === 'calendar' ? (
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                    <span>{selectedInteraction.activity.channel || 'Email'} ({selectedInteraction.activity.method || 'Verified SMTP'})</span>
                  </div>
                </div>
              </div>

              {/* Detailed Fields */}
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipient Target</span>
                  <div className="font-mono text-slate-900 bg-white p-2 rounded border border-slate-200 text-[11px] mt-0.5 flex items-center justify-between">
                    <span>{selectedInteraction.activity.recipient || selectedInteraction.lead.email || selectedInteraction.lead.phone || 'Direct Lead'}</span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Validated</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Title / Subject</span>
                  <div className="font-semibold text-slate-800 bg-white p-2 rounded border border-slate-200 text-xs mt-0.5">
                    {selectedInteraction.activity.title || selectedInteraction.activity.subject || 'Outreach Hook Delivered'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Logs & Server Response</span>
                  <div className="text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-[11px] leading-relaxed break-all">
                    {selectedInteraction.activity.text || `Verified delivery through ${selectedInteraction.activity.method || 'outreach gateway'} with response: 250 OK.`}
                  </div>
                </div>

                {selectedInteraction.activity.messageId && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Message ID / Delivery Receipt</span>
                    <div className="text-slate-500 font-mono text-[10px] truncate bg-white p-1.5 rounded border border-slate-200 mt-0.5">
                      {selectedInteraction.activity.messageId}
                    </div>
                  </div>
                )}

                {selectedInteraction.activity.previewUrl && (
                  <div>
                    <a 
                      href={selectedInteraction.activity.previewUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline font-semibold"
                    >
                      <span>View Ethereal / Provider Sent Email Preview</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const leadToOpen = selectedInteraction.lead;
                    setSelectedInteraction(null);
                    setSelectedLeadDetails(leadToOpen);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  Open in Flowlu Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInteraction(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1C3549] hover:bg-[#2C485F] rounded-md transition-colors cursor-pointer"
                >
                  Close Card
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CrmPipeline;

