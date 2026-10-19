import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Waypoints, Plus, Play, Pause, MoreHorizontal, ArrowRight, 
  Mail, MessageSquare, Clock, GitBranch, CheckCircle2, Trash2, 
  Sparkles, X, Edit3, Send, Layers, Zap, AlertCircle, RefreshCw, Eye,
  Check, ExternalLink, Calendar, ChevronRight, Search
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { confirmDialog, alertDialog } from '../components/AppConfirmModal';
import axios from 'axios';

interface JourneyStep {
  id: string;
  type: 'trigger' | 'delay' | 'email' | 'whatsapp' | 'condition' | 'crm_update' | 'integration';
  title: string;
  description: string;
  config: {
    delayDays?: number;
    delayHours?: number;
    emailSubject?: string;
    emailBody?: string;
    whatsappMessage?: string;
    targetStage?: string;
    conditionType?: string;
    integrationId?: string;
    integrationName?: string;
  };
}

interface Journey {
  _id: string;
  name: string;
  trigger: string;
  status: 'active' | 'paused';
  steps: JourneyStep[];
  totalEnrolled: number;
  conversions: number;
  createdAt?: string;
}

const TEMPLATE_PRESETS = [
  {
    name: 'Instant Inbound Lead Engagement',
    trigger: 'Inbound Form Submitted',
    desc: 'Immediately send welcome email and schedule automated WhatsApp follow-up.',
    steps: [
      {
        id: 's1',
        type: 'trigger' as const,
        title: 'Trigger: Inbound Form Submitted',
        description: 'Prospect filled out website embed form.',
        config: {}
      },
      {
        id: 's2',
        type: 'email' as const,
        title: 'Instant Confirmation & Value Deck',
        description: 'Send greeting within 60 seconds.',
        config: {
          emailSubject: 'Welcome! Here is your Strovr access deck',
          emailBody: 'Hi {{name}}, thanks for reaching out. Here is what you need to scale your outreach.'
        }
      },
      {
        id: 's3',
        type: 'delay' as const,
        title: 'Wait 1 Business Day',
        description: 'Allow review window.',
        config: { delayDays: 1 }
      },
      {
        id: 's4',
        type: 'whatsapp' as const,
        title: 'Direct WhatsApp Intro',
        description: 'Send friendly message to verified phone.',
        config: {
          whatsappMessage: 'Hi {{name}}, wanted to check if you had questions on the deck we emailed yesterday!'
        }
      }
    ]
  },
  {
    name: '3-Touch Cold Outreach Follow-up',
    trigger: 'Lead Scraped in Lead Finder',
    desc: 'Automate initial outreach plus 2 follow-ups spaced across 5 business days.',
    steps: [
      {
        id: 's1',
        type: 'trigger' as const,
        title: 'Trigger: Contact Added to Database',
        description: 'Harvested or imported into Strovr.',
        config: {}
      },
      {
        id: 's2',
        type: 'email' as const,
        title: 'Touch 1: Personalized Cold Pitch',
        description: 'AI-tailored hook on {{company}} niche.',
        config: {
          emailSubject: 'Quick question for {{company}}',
          emailBody: 'Hi {{name}}, saw what your team is building in {{location}} and wanted to share an idea.'
        }
      },
      {
        id: 's3',
        type: 'delay' as const,
        title: 'Wait 3 Days',
        description: 'Wait for reply.',
        config: { delayDays: 3 }
      },
      {
        id: 's4',
        type: 'email' as const,
        title: 'Touch 2: Soft Bump & Case Study',
        description: 'Bump thread with proof points.',
        config: {
          emailSubject: 'Re: Quick question for {{company}}',
          emailBody: 'Hi {{name}}, following up with a quick benchmark of how our clients booked 20+ meetings.'
        }
      }
    ]
  },
  {
    name: 'Post-Proposal Deal Closer',
    trigger: 'Stage updated to: Proposal Sent',
    desc: 'Keep decision-makers warm and advance pipeline to Closed Won.',
    steps: [
      {
        id: 's1',
        type: 'trigger' as const,
        title: 'Trigger: Proposal Sent',
        description: 'Deal card moved to Proposal stage in CRM.',
        config: {}
      },
      {
        id: 's2',
        type: 'delay' as const,
        title: 'Wait 2 Days',
        description: 'Allow internal review.',
        config: { delayDays: 2 }
      },
      {
        id: 's3',
        type: 'whatsapp' as const,
        title: 'WhatsApp Check-in',
        description: 'Direct ping to champion.',
        config: {
          whatsappMessage: 'Hi {{name}}, quick check-in on the proposal - happy to jump on a 5-min call to clarify anything.'
        }
      }
    ]
  }
];

const Automations = () => {
  const { user, integrations, notifyIntegration, setUpgradeModalOpen } = useStore();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(false);

  const connectedWorkflowApps = integrations.filter(i => i.connected);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  // Selected journey for Canvas / Inspection
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);

  // Create Journey Inputs
  const [newJourneyName, setNewJourneyName] = useState('');
  const [newJourneyTrigger, setNewJourneyTrigger] = useState('Lead Created (Lead Finder or Form)');
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Dynamic API Base URL
  const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

  // View mode: 'journeys' or 'queue'
  const [viewTab, setViewTab] = useState<'journeys' | 'queue'>('journeys');
  const [queueData, setQueueData] = useState<{
    enrollments: any[];
    pendingTasks: any[];
    waitingDelays: any[];
    stats: { total: number; active: number; pendingTasks: number; completed: number; repliedExited: number };
  }>({
    enrollments: [],
    pendingTasks: [],
    waitingDelays: [],
    stats: { total: 0, active: 0, pendingTasks: 0, completed: 0, repliedExited: 0 }
  });
  const [queueLoading, setQueueLoading] = useState(false);
  const [isRunningTick, setIsRunningTick] = useState(false);
  const [selectedLogEnrollment, setSelectedLogEnrollment] = useState<any | null>(null);
  const [queueSearch, setQueueSearch] = useState('');

  useEffect(() => {
    fetchJourneys();
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchJourneys = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/automations`, {
        headers: { userid: user._id }
      });
      setJourneys(res.data);
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    if (!user?._id) return;
    setQueueLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/automations/queue`, {
        headers: { userid: user._id }
      });
      setQueueData(res.data);
    } catch (err) {
      console.warn('Failed to fetch automations queue:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleRunTick = async () => {
    if (!user?._id) return;
    setIsRunningTick(true);
    try {
      const res = await axios.post(`${apiBase}/api/automations/worker/run-now`, {}, {
        headers: { userid: user._id }
      });
      showToast(res.data.message || 'Automation drip engine evaluated!');
      fetchQueue();
      fetchJourneys();
    } catch (err: any) {
      console.error('Failed to trigger worker tick:', err);
      showToast('Worker execution failed.');
    } finally {
      setIsRunningTick(false);
    }
  };

  const handleCompleteWhatsAppTask = async (enr: any) => {
    if (!enr.pendingTask?.waLink) return;
    window.open(enr.pendingTask.waLink, '_blank');
    try {
      await axios.post(`${apiBase}/api/automations/queue/${enr._id}/complete-task`, {}, {
        headers: { userid: user?._id }
      });
      showToast(`WhatsApp outreach recorded for ${enr.leadName}!`);
      fetchQueue();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleCancelEnrollment = async (enrollmentId: string) => {
    const confirmed = await confirmDialog({
      title: 'Stop Drip Sequence?',
      message: 'Are you sure you want to cancel automated outreach for this prospect? Scheduled delay steps will not be sent.',
      confirmText: 'Stop Sequence',
      cancelText: 'Keep Running',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await axios.post(`${apiBase}/api/automations/queue/${enrollmentId}/cancel`, {}, {
        headers: { userid: user?._id }
      });
      showToast('Prospect removed from sequence.');
      fetchQueue();
    } catch (err) {
      console.error('Failed to cancel enrollment:', err);
    }
  };

  // Toggle active/paused
  const handleToggleStatus = async (journey: Journey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus = journey.status === 'active' ? 'paused' : 'active';
    try {
      await axios.patch(`${apiBase}/api/automations/${journey._id}`, {
        status: nextStatus
      }, {
        headers: { userid: user?._id }
      });

      setJourneys(journeys.map(j => j._id === journey._id ? { ...j, status: nextStatus } : j));
      if (activeJourney?._id === journey._id) {
        setActiveJourney({ ...activeJourney, status: nextStatus });
      }
      showToast(`Journey "${journey.name}" is now ${nextStatus.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Delete journey
  const handleDeleteJourney = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetJourney = journeys.find(j => j._id === id);
    const confirmed = await confirmDialog({
      title: 'Delete Automation Journey?',
      message: `Are you sure you want to delete "${targetJourney?.name || 'this automation journey'}"? All enrolled step sequences for this workflow will stop immediately.`,
      confirmText: 'Delete Journey',
      cancelText: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await axios.delete(`${apiBase}/api/automations/${id}`, {
        headers: { userid: user?._id }
      });
      setJourneys(journeys.filter(j => j._id !== id));
      if (activeJourney?._id === id) {
        setIsCanvasOpen(false);
        setActiveJourney(null);
      }
      showToast('Journey deleted.');
    } catch (err) {
      console.error('Failed to delete journey:', err);
    }
  };

  // Test Run / Trigger Journey
  const handleTestRun = async (journey: Journey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await axios.post(`${apiBase}/api/automations/${journey._id}/trigger`, {}, {
        headers: { userid: user?._id }
      });
      
      const newCount = res.data.totalEnrolled;
      setJourneys(journeys.map(j => j._id === journey._id ? { ...j, totalEnrolled: newCount } : j));
      if (activeJourney?._id === journey._id) {
        setActiveJourney({ ...activeJourney, totalEnrolled: newCount });
      }

      // Also fire outbound integration notifications for any connected integration steps or channels
      const integrationSteps = (journey.steps || []).filter(s => s.type === 'integration');
      const targetAppId = integrationSteps[0]?.config?.integrationId || connectedWorkflowApps[0]?.id;
      if (targetAppId) {
        await notifyIntegration(
          targetAppId,
          `Workflow "${journey.name}" executed (${journey.steps.length} steps)`,
          {
            journeyId: journey._id,
            journeyName: journey.name,
            stepsExecuted: journey.steps.map(s => s.title),
            integrationSteps: integrationSteps.map(s => s.config.integrationName)
          }
        );
        showToast(`Workflow "${journey.name}" executed & dispatched to connected apps [200 OK]!`);
      } else {
        showToast(res.data.message || 'Workflow test executed successfully!');
      }
      fetchQueue();
    } catch (err) {
      console.error('Failed to test run journey:', err);
      showToast('Simulation failed.');
    }
  };

  // Create Journey Submit
  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id || !newJourneyName) return;

    let stepsToUse = [];
    if (selectedTemplateIndex !== null && TEMPLATE_PRESETS[selectedTemplateIndex]) {
      const selectedPreset = TEMPLATE_PRESETS[selectedTemplateIndex];
      const plan = (user?.plan || 'free').toLowerCase();
      const presetActions = selectedPreset.steps.filter(s => s.type !== 'trigger');

      if (plan === 'free' && presetActions.length > 1) {
        await alertDialog({
          title: 'Automated Sequence Locked',
          message: 'The Free Explorer tier is limited to single one-off dispatches. Upgrade to Basic (₹699/mo) to unlock 2-step automated follow-up sequences, or Pro (₹1,999/mo) for unlimited multi-step journeys!',
          variant: 'info'
        });
        setUpgradeModalOpen(true);
        return;
      }
      if (plan === 'basic' && presetActions.length > 2) {
        await alertDialog({
          title: 'Multi-Step Sequence (Pro)',
          message: `This blueprint contains ${presetActions.length} sequence steps. Basic tier supports 2-step sequences (Initial + Follow-up). Upgrade to Pro for unlimited multi-step journeys.`,
          variant: 'info'
        });
        setUpgradeModalOpen(true);
        return;
      }
      stepsToUse = selectedPreset.steps;
    }

    try {
      const res = await axios.post(`${apiBase}/api/automations`, {
        name: newJourneyName,
        trigger: newJourneyTrigger,
        steps: stepsToUse
      }, {
        headers: { userid: user._id }
      });

      setJourneys([res.data, ...journeys]);
      setIsCreateModalOpen(false);
      setNewJourneyName('');
      setSelectedTemplateIndex(null);
      setActiveJourney(res.data);
      setIsCanvasOpen(true);
      showToast('Journey created! Edit steps below.');
    } catch (err) {
      console.error('Failed to create journey:', err);
      await alertDialog({
        title: 'Creation Error',
        message: 'Could not create automation journey. Please try again.',
        variant: 'error'
      });
    }
  };

  // Instantiate from template picker
  const handleUsePreset = async (preset: typeof TEMPLATE_PRESETS[0]) => {
    if (!user?._id) return;
    const plan = (user?.plan || 'free').toLowerCase();
    const presetActions = preset.steps.filter(s => s.type !== 'trigger');

    if (plan === 'free' && presetActions.length > 1) {
      await alertDialog({
        title: 'Automated Sequence Locked',
        message: `Template "${preset.name}" contains ${presetActions.length} sequence steps. Free Explorer is limited to single one-off dispatches. Upgrade to Basic (₹699/mo) to unlock 2-step sequences or Pro for unlimited multi-step journeys!`,
        variant: 'info'
      });
      setUpgradeModalOpen(true);
      return;
    }
    if (plan === 'basic' && presetActions.length > 2) {
      await alertDialog({
        title: 'Multi-Step Sequence (Pro)',
        message: `Template "${preset.name}" requires Pro Tier for deep multi-touchpoint workflows (${presetActions.length} steps). Basic tier includes 2-step sequences (Initial + Follow-up).`,
        variant: 'info'
      });
      setUpgradeModalOpen(true);
      return;
    }

    try {
      const res = await axios.post(`${apiBase}/api/automations`, {
        name: preset.name,
        trigger: preset.trigger,
        steps: preset.steps
      }, {
        headers: { userid: user._id }
      });

      setJourneys([res.data, ...journeys]);
      setIsTemplateModalOpen(false);
      setActiveJourney(res.data);
      setIsCanvasOpen(true);
      showToast(`Created journey from template "${preset.name}"!`);
    } catch (err) {
      console.error('Failed to use template:', err);
    }
  };

  // Add Step to active journey
  const handleAddStep = async (type: JourneyStep['type'], integrationApp?: { id: string; name: string }) => {
    if (!activeJourney || !user?._id) return;

    const plan = (user?.plan || 'free').toLowerCase();
    const currentActions = activeJourney.steps.filter(s => s.type !== 'trigger');

    if (plan === 'free' && currentActions.length >= 1) {
      await alertDialog({
        title: 'Sequence Limit Reached',
        message: 'The Free Explorer tier is limited to single one-off dispatches. Upgrade to Basic (₹699/mo) to unlock 2-step automated follow-up sequences, or Pro (₹1,999/mo) for unlimited multi-step journeys!',
        variant: 'info'
      });
      setUpgradeModalOpen(true);
      return;
    }

    if (plan === 'basic' && currentActions.length >= 2) {
      await alertDialog({
        title: 'Sequence Depth Limit Reached',
        message: 'Basic tier supports 2-Step Follow-Up Sequences (Initial + Follow-up). Upgrade to Pro (₹1,999/mo) to unlock unlimited multi-step behavioral journeys and WhatsApp bridges!',
        variant: 'info'
      });
      setUpgradeModalOpen(true);
      return;
    }

    let newStep: JourneyStep = {
      id: `step_${Date.now()}`,
      type,
      title: type === 'integration' && integrationApp
        ? `Push / Notify ${integrationApp.name}`
        : type === 'email' ? 'Follow-up Email' : type === 'whatsapp' ? 'WhatsApp Message' : type === 'delay' ? 'Wait 2 Days' : 'Advance CRM Stage',
      description: type === 'integration' && integrationApp
        ? `Automatically dispatch JSON payload to connected ${integrationApp.name} integration.`
        : type === 'email' ? 'Send follow-up template.' : type === 'whatsapp' ? 'Direct mobile outreach.' : type === 'delay' ? 'Wait interval before next step.' : 'Update deal stage.',
      config: type === 'integration' && integrationApp
        ? { integrationId: integrationApp.id, integrationName: integrationApp.name }
        : type === 'delay' ? { delayDays: 2 } : type === 'email' ? { emailSubject: 'Quick update', emailBody: 'Hi {{name}}, wanted to check in.' } : type === 'whatsapp' ? { whatsappMessage: 'Hey {{name}}, following up!' } : { targetStage: 'Proposal Sent' }
    };

    const updatedSteps = [...activeJourney.steps, newStep];
    try {
      const res = await axios.patch(`${apiBase}/api/automations/${activeJourney._id}`, {
        steps: updatedSteps
      }, {
        headers: { userid: user._id }
      });

      setActiveJourney(res.data);
      setJourneys(journeys.map(j => j._id === activeJourney._id ? res.data : j));
      showToast(integrationApp ? `Added ${integrationApp.name} action step to workflow!` : 'New step added to workflow.');
    } catch (err) {
      console.error('Failed to add step:', err);
    }
  };

  // Summary Metrics
  const activeCount = journeys.filter(j => j.status === 'active').length;
  const totalEnrolled = journeys.reduce((acc, j) => acc + (j.totalEnrolled || 0), 0);
  const totalConversions = journeys.reduce((acc, j) => acc + (j.conversions || 0), 0);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto px-7 py-7 lg:px-9 lg:py-8 custom-scrollbar">
          <div className="max-w-[1540px] 2xl:max-w-[1720px] mx-auto w-full space-y-6">
            
            {/* Toast Notification */}
            {toastMessage && (
              <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-xl border border-slate-800 text-xs font-delight font-medium flex items-center gap-2 animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Automations & Journeys</h1>
                <p className="text-slate-500 font-normal text-xs mt-0.5">Build multi-step automated outreach sequences, smart delays, and CRM stage transitions.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="h-8 px-3 bg-white border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-700 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>Templates Library</span>
                </button>

                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="h-8 px-3.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors flex items-center gap-1.5 border border-slate-900 cursor-pointer"
                >
                  <Waypoints className="w-3.5 h-3.5" />
                  <span>Create Journey</span>
                </button>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-md p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Active Sequences</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight">{activeCount} / {journeys.length}</h3>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-md p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Prospects Enrolled</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight">{totalEnrolled}</h3>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-md p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Automated Conversions</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight">{totalConversions}</h3>
                </div>
              </div>
            </div>

            {/* View Tabs: Journeys vs Live Queue */}
            <div className="flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setViewTab('journeys')}
                  className={`pb-2.5 text-xs font-delight flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                    viewTab === 'journeys'
                      ? 'border-slate-900 text-slate-900 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Waypoints className="w-3.5 h-3.5" />
                  <span>Journeys & Blueprints ({journeys.length})</span>
                </button>

                <button
                  onClick={() => setViewTab('queue')}
                  className={`pb-2.5 text-xs font-delight flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                    viewTab === 'queue'
                      ? 'border-slate-900 text-slate-900 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Live Drip Queue & Tasks</span>
                  {queueData.pendingTasks.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500 text-white">
                      {queueData.pendingTasks.length} Task
                    </span>
                  )}
                  {queueData.waitingDelays.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {queueData.waitingDelays.length} Waiting
                    </span>
                  )}
                </button>
              </div>

              {viewTab === 'queue' && (
                <button
                  onClick={handleRunTick}
                  disabled={isRunningTick}
                  className="mb-2 h-7 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-md font-delight font-medium text-xs text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                  title="Force background worker to evaluate due delays immediately"
                >
                  <RefreshCw className={`w-3 h-3 text-slate-500 ${isRunningTick ? 'animate-spin' : ''}`} />
                  <span>{isRunningTick ? 'Evaluating...' : 'Run Drips Now'}</span>
                </button>
              )}
            </div>

            {/* Main Automations Table */}
            {viewTab === 'journeys' && (
              <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
                <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <span className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-500">Configured Workflows</span>
                <span className="text-[11px] font-delight font-normal text-slate-400">Click any journey to inspect visual steps</span>
              </div>

              {journeys.length === 0 ? (
                <div className="p-12 text-center space-y-3 font-delight font-medium">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">No automation workflows configured</h3>
                    <p className="text-slate-500 text-xs max-w-sm mx-auto">
                      Create your first multi-step journey or choose an automated template from our library.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-delight font-medium rounded-md hover:bg-slate-800 transition-colors border border-slate-900 cursor-pointer"
                  >
                    Load Starter Templates
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-delight font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="px-4 py-2.5 w-[42%]">Journey Name</th>
                        <th className="px-4 py-2.5">Trigger Condition</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Enrolled</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journeys.map((j) => (
                        <tr 
                          key={j._id} 
                          onClick={() => {
                            setActiveJourney(j);
                            setIsCanvasOpen(true);
                          }}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-xs text-slate-900 group-hover:text-accent transition-colors flex items-center gap-1.5 tracking-tight">
                              <span>{j.name}</span>
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-[10px] font-delight font-normal text-slate-400 mt-0.5">
                              {(j.steps || []).length} steps • {j.conversions || 0} conversions
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-slate-100 text-[10px] font-delight font-medium text-slate-700 border border-slate-200">
                              <Zap className="w-3 h-3 text-slate-500" />
                              <span>{j.trigger}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3 font-delight font-medium">
                            {j.status === 'active' ? (
                              <div className="flex items-center gap-1.5 text-xs font-delight font-medium text-emerald-600">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>Running</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs font-delight font-normal text-slate-400">
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                <span>Paused</span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 font-delight font-medium text-xs text-slate-700">
                            {j.totalEnrolled || 0} contacts
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                              {/* Test Run Button */}
                              <button 
                                onClick={(e) => handleTestRun(j, e)}
                                title="Run Test Simulation"
                                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-xs font-delight font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Play className="w-3 h-3 text-emerald-600" /> Test
                              </button>

                              {/* Toggle Active / Paused Button */}
                              <button 
                                onClick={(e) => handleToggleStatus(j, e)}
                                title={j.status === 'active' ? 'Pause Journey' : 'Activate Journey'}
                                className="w-6 h-6 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors text-slate-600 cursor-pointer"
                              >
                                {j.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              </button>

                              {/* Delete Journey Button */}
                              <button 
                                onClick={(e) => handleDeleteJourney(j._id, e)}
                                title="Delete Journey"
                                className="w-6 h-6 rounded-md bg-white hover:bg-rose-50 border border-slate-200 flex items-center justify-center transition-colors text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW TAB 2: LIVE DRIP QUEUE & TASKS */}
          {viewTab === 'queue' && (
            <div className="space-y-4">
              {/* 4 Metrics Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Active In-Flight</p>
                  <h3 className="text-lg font-delight font-bold text-slate-900 mt-0.5">{queueData.stats.active}</h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <p className="text-[10px] font-delight font-semibold text-emerald-600 uppercase tracking-wider">WhatsApp Tasks Ready</p>
                  <h3 className="text-lg font-delight font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>{queueData.stats.pendingTasks}</span>
                  </h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <p className="text-[10px] font-delight font-semibold text-amber-600 uppercase tracking-wider">Delays Scheduled</p>
                  <h3 className="text-lg font-delight font-bold text-amber-700 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>{queueData.waitingDelays.length}</span>
                  </h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <p className="text-[10px] font-delight font-semibold text-purple-600 uppercase tracking-wider">Replied / Exited Safely</p>
                  <h3 className="text-lg font-delight font-bold text-purple-700 mt-0.5">{queueData.stats.repliedExited}</h3>
                </div>
              </div>

              {/* Queue Table */}
              <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
                <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={queueSearch}
                      onChange={(e) => setQueueSearch(e.target.value)}
                      placeholder="Search enrolled prospect or company..."
                      className="w-full h-8 pl-8 pr-3 text-xs font-delight bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <span className="text-[11px] font-delight text-slate-400">
                    Evaluates every 60 seconds. Delays skip weekends and land in 9 AM to 6 PM business hours.
                  </span>
                </div>

                {queueLoading && queueData.enrollments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading active queue...</div>
                ) : queueData.enrollments.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">No active drip enrollments</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Inbound form submissions, webhooks, or test simulations automatically enroll prospects here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-delight font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                          <th className="px-4 py-2.5">Prospect</th>
                          <th className="px-4 py-2.5">Journey</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Progress</th>
                          <th className="px-4 py-2.5">Next Run / Countdown</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queueData.enrollments
                          .filter(e => {
                            if (!queueSearch) return true;
                            const q = queueSearch.toLowerCase();
                            return (
                              (e.leadName || '').toLowerCase().includes(q) ||
                              (e.leadCompany || '').toLowerCase().includes(q) ||
                              (e.leadEmail || '').toLowerCase().includes(q) ||
                              (e.journeyName || '').toLowerCase().includes(q)
                            );
                          })
                          .map((enr) => {
                            return (
                              <tr key={enr._id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-xs text-slate-900">{enr.leadName}</div>
                                  <div className="text-[11px] text-slate-400">{enr.leadCompany || enr.leadEmail}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-medium text-xs text-slate-700">{enr.journeyName}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {enr.status === 'pending_task' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                                      <MessageSquare className="w-2.5 h-2.5" /> WhatsApp Task Ready
                                    </span>
                                  ) : enr.status === 'waiting_delay' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                      <Clock className="w-2.5 h-2.5 text-amber-600" /> Waiting Delay
                                    </span>
                                  ) : enr.status === 'replied_exited' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                      <Check className="w-2.5 h-2.5 text-purple-600" /> Exited: Replied / Advanced
                                    </span>
                                  ) : enr.status === 'completed' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                      Completed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                      Active
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs font-delight text-slate-600">
                                  Step {enr.currentStepIndex + 1}
                                </td>
                                <td className="px-4 py-3 text-xs font-delight text-slate-500">
                                  {enr.nextRunAt && enr.status === 'waiting_delay' ? (
                                    <span>{new Date(enr.nextRunAt).toLocaleDateString()} {new Date(enr.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  ) : enr.status === 'pending_task' ? (
                                    <span className="text-emerald-600 font-medium">Ready for dispatch</span>
                                  ) : enr.status === 'completed' || enr.status === 'replied_exited' ? (
                                    <span className="text-slate-400">Sequence ended</span>
                                  ) : (
                                    <span>Ready for evaluation</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {enr.status === 'pending_task' && enr.pendingTask && (
                                      <button
                                        onClick={() => handleCompleteWhatsAppTask(enr)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                                        title="Open WhatsApp web/app with pre-filled outreach message"
                                      >
                                        <MessageSquare className="w-3 h-3" />
                                        <span>1-Click Ping</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setSelectedLogEnrollment(enr)}
                                      className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-xs font-medium cursor-pointer"
                                    >
                                      Audit Log
                                    </button>
                                    {['active', 'waiting_delay', 'pending_task'].includes(enr.status) && (
                                      <button
                                        onClick={() => handleCancelEnrollment(enr._id)}
                                        className="px-2 py-1 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded text-xs font-medium cursor-pointer"
                                        title="Stop automated sequence for this prospect"
                                      >
                                        Stop
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

            {/* Template Presets Banner */}
            <div className="border border-dashed border-slate-300 rounded-md p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">Explore Pre-built Outreach Journeys</h3>
                <p className="text-xs text-slate-500 mt-0.5">Deploy proven sequences for cold acquisition, post-proposal follow-ups, and inbound conversions in 1 click.</p>
              </div>
              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="h-8 px-3.5 bg-white border border-slate-200 text-slate-700 font-delight font-medium text-xs rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer hover:border-slate-300"
              >
                Browse All Templates &rarr;
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ================= MODAL: VISUAL WORKFLOW CANVAS ================= */}
      {isCanvasOpen && activeJourney && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Canvas Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">{activeJourney.name}</h3>
                  <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-delight font-medium border ${
                    activeJourney.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {activeJourney.status}
                  </span>
                </div>
                <p className="text-[11px] font-delight font-normal text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span>Trigger: {activeJourney.trigger}</span>
                  <span>•</span>
                  <span>{activeJourney.totalEnrolled || 0} Contacts Enrolled</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleTestRun(activeJourney)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-xs font-delight font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 text-emerald-600" /> Test Simulation
                </button>

                <button 
                  onClick={() => handleToggleStatus(activeJourney)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-delight font-medium flex items-center gap-1 transition-colors border border-slate-900 cursor-pointer"
                >
                  {activeJourney.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{activeJourney.status === 'active' ? 'Pause' : 'Activate'}</span>
                </button>

                <button onClick={() => setIsCanvasOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visual Flowchart Canvas */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-3 custom-scrollbar">
              <div className="max-w-xl mx-auto flex flex-col items-center space-y-3">
                
                {activeJourney.steps.map((step, idx) => (
                  <div key={step.id || idx} className="w-full flex flex-col items-center">
                    
                    {/* Node Card */}
                    <div className="w-full bg-white rounded-md p-4 border border-slate-200 shadow-2xs hover:border-slate-400 transition-colors space-y-2.5 relative group">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-400">Step {idx + 1}</span>
                          <h4 className="font-bold text-xs text-slate-900 tracking-tight">{step.title}</h4>
                        </div>
                        {step.type === 'integration' && step.config.integrationName && (
                          <span className="text-[10px] font-delight font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-sm">
                            ✓ Connected App: {step.config.integrationName}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 font-normal">{step.description}</p>

                      {/* Config details */}
                      {step.config.emailSubject && (
                        <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-[11px] font-delight font-medium space-y-0.5">
                          <div className="font-medium text-slate-800">Subject: {step.config.emailSubject}</div>
                          <div className="text-slate-500 truncate">{step.config.emailBody}</div>
                        </div>
                      )}

                      {step.config.whatsappMessage && (
                        <div className="p-2.5 bg-emerald-50/60 rounded-md border border-emerald-200 text-[11px] font-delight font-medium text-emerald-900">
                          {step.config.whatsappMessage}
                        </div>
                      )}

                      {step.config.delayDays && (
                        <div className="text-[10px] font-delight font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm w-max">
                          Waits {step.config.delayDays} day(s) before advancing
                        </div>
                      )}
                    </div>

                    {/* Connecting Connector Arrow */}
                    {idx < activeJourney.steps.length - 1 && (
                      <div className="my-1.5 flex flex-col items-center">
                        <div className="w-px h-5 bg-slate-300"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                      </div>
                    )}

                  </div>
                ))}

                {/* Add Next Step Bar */}
                <div className="pt-2 w-full flex flex-col items-center space-y-2.5">
                  <div className="w-px h-5 bg-slate-300"></div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <button 
                      onClick={() => handleAddStep('email')}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-accent" /> + Email
                    </button>
                    <button 
                      onClick={() => handleAddStep('delay')}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3 text-blue-600" /> + Delay
                    </button>
                    <button 
                      onClick={() => handleAddStep('whatsapp')}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-600" /> + WhatsApp
                    </button>
                    <button 
                      onClick={() => handleAddStep('crm_update')}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3 text-purple-600" /> + Stage
                    </button>
                  </div>

                  {/* Connected Integration Step Actions */}
                  {connectedWorkflowApps.length > 0 && (
                    <div className="w-full pt-2 border-t border-slate-200/80 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-delight uppercase tracking-wider text-emerald-700 font-bold">
                        + Add Connected App Step ({connectedWorkflowApps.length} Active)
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {connectedWorkflowApps.map(app => (
                          <button
                            key={app.id}
                            onClick={() => handleAddStep('integration', { id: app.id, name: app.name })}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md text-xs font-delight font-medium text-emerald-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Waypoints className="w-3 h-3 text-emerald-600" /> + {app.name} Action
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Canvas Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between">
              <span className="text-[11px] font-delight font-medium text-slate-400">All workflow steps execute automatically in the background.</span>
              <button 
                onClick={() => setIsCanvasOpen(false)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-md text-xs font-delight font-medium hover:bg-slate-800 border border-slate-900 cursor-pointer"
              >
                Close Canvas
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE JOURNEY ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Create Automation Journey</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJourney} className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Journey Name *</label>
                <input 
                  type="text"
                  required
                  value={newJourneyName}
                  onChange={(e) => setNewJourneyName(e.target.value)}
                  placeholder="e.g. New B2B Lead 3-Day Nurture"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Starting Trigger Event</label>
                <select 
                  value={newJourneyTrigger}
                  onChange={(e) => setNewJourneyTrigger(e.target.value)}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none bg-white cursor-pointer"
                >
                  <option value="Lead Created (Lead Finder or Form)">Lead Created (Lead Finder or Inbound Form)</option>
                  <option value="CRM Stage Updated to 'Proposal Sent'">CRM Stage Updated to 'Proposal Sent'</option>
                  <option value="Contact Added to Segment: Verified Emails">Contact Added to Segment: Verified Emails</option>
                  <option value="No Reply after 3 Days">No Reply after 3 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1.5">Optional: Start with a Template Preset</label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                  {TEMPLATE_PRESETS.map((tpl, i) => (
                    <div 
                      key={tpl.name}
                      onClick={() => {
                        setSelectedTemplateIndex(i);
                        if (!newJourneyName) setNewJourneyName(tpl.name);
                      }}
                      className={`p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        selectedTemplateIndex === i ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900 tracking-tight">{tpl.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button 
                  type="submit"
                  className="w-full h-8 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 border border-slate-900 cursor-pointer"
                >
                  Create & Launch Visual Canvas &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXPLORE TEMPLATES LIBRARY ================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Journey Templates Library</h3>
                <p className="text-[11px] font-delight font-normal text-slate-400">Deploy battle-tested multi-channel workflows in 1 click.</p>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {TEMPLATE_PRESETS.map(tpl => (
                <div 
                  key={tpl.name}
                  className="p-4 border border-slate-200 rounded-md hover:border-slate-400 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm">
                      {tpl.steps.length} Steps Sequence
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 tracking-tight">{tpl.name}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{tpl.desc}</p>
                  </div>
                  <button 
                    onClick={() => handleUsePreset(tpl)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors whitespace-nowrap border border-slate-900 cursor-pointer"
                  >
                    Deploy Flow
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button 
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-delight font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: AUDIT LOG ================= */}
      {selectedLogEnrollment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Sequence Execution Audit Log</h3>
                <p className="text-xs text-slate-500 font-delight">
                  {selectedLogEnrollment.leadName} ({selectedLogEnrollment.journeyName})
                </p>
              </div>
              <button
                onClick={() => setSelectedLogEnrollment(null)}
                className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
              {(selectedLogEnrollment.logs || []).map((log: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{log.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-delight leading-relaxed">{log.details}</p>
                  {log.actionUrl && (
                    <a
                      href={log.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 mt-1"
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>Open Pre-filled WhatsApp Chat</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLogEnrollment(null)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md text-xs font-delight font-medium hover:bg-slate-800 cursor-pointer"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Automations;
