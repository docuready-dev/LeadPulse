import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Layout, ArrowRight, TrendingUp, Users, Compass, Activity,
  Clock, Calendar as CalendarIcon, GripVertical, Check, Plus,
  Trash2, RotateCcw, Eye, EyeOff, Play, Pause, Sparkles,
  ChevronLeft, ChevronRight, CheckSquare, Square, Sliders,
  Maximize2, Zap, ShieldCheck, BookOpen
} from 'lucide-react';

type WidgetId =
  | 'kpi-ledger'
  | 'world-clock'
  | 'calendar-schedule'
  | 'token-pool'
  | 'prospect-cohorts'
  | 'funnel-progression'
  | 'scratchpad-notes'
  | 'operator-actions';

type ColSpan = 4 | 6 | 8 | 12;

interface WidgetConfig {
  id: WidgetId;
  title: string;
  subtitle: string;
  colSpan: ColSpan;
  visible: boolean;
}

interface PrebuiltLayout {
  id: string;
  name: string;
  badge: string;
  description: string;
  widgets: { id: WidgetId; colSpan: ColSpan; visible: boolean }[];
}

const WIDGET_META: Record<WidgetId, { title: string; subtitle: string }> = {
  'kpi-ledger': {
    title: 'KPI Telemetry Ledger',
    subtitle: '4-column verified pipeline & quota metrics'
  },
  'world-clock': {
    title: 'World Clock & Sprint Timer',
    subtitle: 'Live B2B timezone radar & 25m outreach Pomodoro'
  },
  'calendar-schedule': {
    title: 'Follow-Up & Campaign Calendar',
    subtitle: 'Interactive monthly schedule & call reminders'
  },
  'token-pool': {
    title: 'Token Pool & Quota Meter',
    subtitle: '1 Token = 1 Contact live pool & instant refill'
  },
  'prospect-cohorts': {
    title: 'Harvested Prospect Cohorts',
    subtitle: 'Recently queried industry segments'
  },
  'funnel-progression': {
    title: 'Pipeline Progression',
    subtitle: 'Stage conversion flow telemetry'
  },
  'scratchpad-notes': {
    title: 'Operator Scratchpad & Checklist',
    subtitle: 'Daily outreach tasks & persistent call notes'
  },
  'operator-actions': {
    title: 'Operator & Direct Actions',
    subtitle: 'Authenticated session & 1-click module dispatch'
  }
};

const PREBUILT_LAYOUTS: PrebuiltLayout[] = [
  {
    id: 'executive',
    name: 'Executive Command',
    badge: 'Default',
    description: 'Balanced 12-column overview with KPIs, Clock, Calendar, Pipeline & Cohorts',
    widgets: [
      { id: 'kpi-ledger', colSpan: 12, visible: true },
      { id: 'world-clock', colSpan: 4, visible: true },
      { id: 'calendar-schedule', colSpan: 4, visible: true },
      { id: 'token-pool', colSpan: 4, visible: true },
      { id: 'prospect-cohorts', colSpan: 8, visible: true },
      { id: 'operator-actions', colSpan: 4, visible: true },
      { id: 'funnel-progression', colSpan: 8, visible: true },
      { id: 'scratchpad-notes', colSpan: 4, visible: true }
    ]
  },
  {
    id: 'chrono',
    name: 'Time & Schedule Focus',
    badge: 'Planner',
    description: 'Prioritizes World Clock, Follow-Up Calendar & Daily Checklist at the top',
    widgets: [
      { id: 'world-clock', colSpan: 6, visible: true },
      { id: 'calendar-schedule', colSpan: 6, visible: true },
      { id: 'scratchpad-notes', colSpan: 6, visible: true },
      { id: 'token-pool', colSpan: 6, visible: true },
      { id: 'kpi-ledger', colSpan: 12, visible: true },
      { id: 'funnel-progression', colSpan: 8, visible: true },
      { id: 'operator-actions', colSpan: 4, visible: true },
      { id: 'prospect-cohorts', colSpan: 12, visible: true }
    ]
  },
  {
    id: 'velocity',
    name: 'Sales Velocity & Funnel',
    badge: 'Revenue',
    description: 'Pipeline conversion funnel, harvested cohorts & token quota front-and-center',
    widgets: [
      { id: 'kpi-ledger', colSpan: 12, visible: true },
      { id: 'funnel-progression', colSpan: 8, visible: true },
      { id: 'token-pool', colSpan: 4, visible: true },
      { id: 'prospect-cohorts', colSpan: 8, visible: true },
      { id: 'operator-actions', colSpan: 4, visible: true },
      { id: 'world-clock', colSpan: 6, visible: true },
      { id: 'calendar-schedule', colSpan: 6, visible: true },
      { id: 'scratchpad-notes', colSpan: 12, visible: true }
    ]
  },
  {
    id: 'bento',
    name: 'Compact Bento Grid',
    badge: '3×2 Grid',
    description: 'Architectural 3-column symmetrical bento cards across the workspace',
    widgets: [
      { id: 'kpi-ledger', colSpan: 12, visible: true },
      { id: 'world-clock', colSpan: 4, visible: true },
      { id: 'calendar-schedule', colSpan: 4, visible: true },
      { id: 'scratchpad-notes', colSpan: 4, visible: true },
      { id: 'token-pool', colSpan: 4, visible: true },
      { id: 'funnel-progression', colSpan: 4, visible: true },
      { id: 'operator-actions', colSpan: 4, visible: true },
      { id: 'prospect-cohorts', colSpan: 12, visible: true }
    ]
  },
  {
    id: 'cockpit',
    name: 'Outbound SDR Cockpit',
    badge: 'High-Tempo',
    description: 'Built for live cold outreach sprints: Pomodoro timer, scratchpad & quick dispatch',
    widgets: [
      { id: 'world-clock', colSpan: 4, visible: true },
      { id: 'scratchpad-notes', colSpan: 4, visible: true },
      { id: 'operator-actions', colSpan: 4, visible: true },
      { id: 'kpi-ledger', colSpan: 12, visible: true },
      { id: 'prospect-cohorts', colSpan: 6, visible: true },
      { id: 'calendar-schedule', colSpan: 6, visible: true },
      { id: 'funnel-progression', colSpan: 8, visible: true },
      { id: 'token-pool', colSpan: 4, visible: true }
    ]
  },
  {
    id: 'minimal',
    name: 'Minimalist Focus',
    badge: 'Clean',
    description: 'Distraction-free essentials: KPI Ledger, World Clock, Calendar & Pipeline',
    widgets: [
      { id: 'kpi-ledger', colSpan: 12, visible: true },
      { id: 'world-clock', colSpan: 6, visible: true },
      { id: 'calendar-schedule', colSpan: 6, visible: true },
      { id: 'funnel-progression', colSpan: 12, visible: true },
      { id: 'token-pool', colSpan: 4, visible: false },
      { id: 'prospect-cohorts', colSpan: 8, visible: false },
      { id: 'scratchpad-notes', colSpan: 6, visible: false },
      { id: 'operator-actions', colSpan: 6, visible: false }
    ]
  }
];

interface CalendarEventItem {
  id: string;
  dateKey: string; // YYYY-MM-DD
  time: string;
  title: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

const buildWidgetsFromPreset = (presetId: string): WidgetConfig[] => {
  const found = PREBUILT_LAYOUTS.find(p => p.id === presetId) || PREBUILT_LAYOUTS[0];
  return found.widgets.map(w => ({
    id: w.id,
    title: WIDGET_META[w.id].title,
    subtitle: WIDGET_META[w.id].subtitle,
    colSpan: w.colSpan,
    visible: w.visible
  }));
};

const Dashboard = () => {
  const { user, setTopUpOpen, setUpgradeTab } = useStore();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3200);
  };

  // Layout & Drag-and-Drop State
  const [activePresetId, setActivePresetId] = useState<string>(() => {
    return localStorage.getItem('leadpulse-dashboard-preset-v1') || 'executive';
  });

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem('leadpulse-dashboard-layout-v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === Object.keys(WIDGET_META).length) {
          return parsed;
        }
      }
    } catch {}
    return buildWidgetsFromPreset('executive');
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<WidgetId | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<WidgetId | null>(null);

  // Live World Clock & Outreach Sprint Pomodoro State
  const [now, setNow] = useState(new Date());
  const [sprintSeconds, setSprintSeconds] = useState(25 * 60);
  const [sprintRunning, setSprintRunning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sprintRunning) return;
    const interval = setInterval(() => {
      setSprintSeconds(prev => {
        if (prev <= 1) {
          setSprintRunning(false);
          showToast('25-Minute Outreach Sprint Complete!');
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sprintRunning]);

  // Interactive Calendar State
  const today = new Date();
  const formatDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [calMonth, setCalMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(today));
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('11:00');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>(() => {
    try {
      const saved = localStorage.getItem('leadpulse-dashboard-calendar-v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    const todayKey = formatDateKey(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = formatDateKey(tomorrow);
    return [
      { id: 'ev-1', dateKey: todayKey, time: '10:30', title: 'Follow up with WhatsApp replied leads' },
      { id: 'ev-2', dateKey: todayKey, time: '15:00', title: 'Dispatch cold email batch (Verified Cohort)' },
      { id: 'ev-3', dateKey: tomorrowKey, time: '11:00', title: 'Pipeline review & CRM sync' }
    ];
  });

  // Operator Scratchpad & Checklist State
  const [scratchpadText, setScratchpadText] = useState<string>(() => {
    return (
      localStorage.getItem('leadpulse-dashboard-scratchpad-v1') ||
      '• Focus Niche: B2B SaaS & Healthcare Clinics\n• Use WhatsApp Bridge template #1 before sending PDF deck.'
    );
  });
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem('leadpulse-dashboard-checklist-v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'chk-1', text: 'Harvest 10 high-intent local prospects', done: true },
      { id: 'chk-2', text: 'Capture verified emails in Kanban pipeline', done: false },
      { id: 'chk-3', text: 'Trigger multi-channel Outreach sequence', done: false }
    ];
  });
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  const fetchLeads = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/leads', {
        headers: { userid: user?._id }
      });
      setLeads(res.data);
    } catch (err) {
      console.error('Failed to fetch leads', err);
    }
  };

  // Save layout helper
  const persistWidgets = (next: WidgetConfig[], presetId = activePresetId) => {
    setWidgets(next);
    localStorage.setItem('leadpulse-dashboard-layout-v1', JSON.stringify(next));
    localStorage.setItem('leadpulse-dashboard-preset-v1', presetId);
  };

  const handleSelectPreset = (presetId: string) => {
    const next = buildWidgetsFromPreset(presetId);
    setActivePresetId(presetId);
    persistWidgets(next, presetId);
    const preset = PREBUILT_LAYOUTS.find(p => p.id === presetId);
    showToast(`Applied "${preset?.name}" layout`);
  };

  const handleWidgetDragStart = (e: React.DragEvent, id: WidgetId) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWidgetId(id);
  };

  const handleWidgetDragOver = (e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleWidgetDrop = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    const sourceId = (e.dataTransfer.getData('text/plain') as WidgetId) || draggedWidgetId;
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);

    if (!sourceId || sourceId === targetId) return;

    const next = [...widgets];
    const fromIdx = next.findIndex(w => w.id === sourceId);
    const toIdx = next.findIndex(w => w.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setActivePresetId('custom');
      persistWidgets(next, 'custom');
      showToast(`Moved "${moved.title}" widget`);
    }
  };

  const handleChangeWidgetSpan = (id: WidgetId, span: ColSpan) => {
    const next = widgets.map(w => (w.id === id ? { ...w, colSpan: span } : w));
    setActivePresetId('custom');
    persistWidgets(next, 'custom');
  };

  const handleToggleWidgetVisibility = (id: WidgetId) => {
    const next = widgets.map(w => (w.id === id ? { ...w, visible: !w.visible } : w));
    setActivePresetId('custom');
    persistWidgets(next, 'custom');
  };

  // Calendar Helpers
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay(); // 0 = Sun
  const monthLabel = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleAddCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    const item: CalendarEventItem = {
      id: `ev-${Date.now()}`,
      dateKey: selectedDateKey,
      time: newEventTime || '11:00',
      title: newEventTitle.trim()
    };
    const updated = [...calendarEvents, item];
    setCalendarEvents(updated);
    localStorage.setItem('leadpulse-dashboard-calendar-v1', JSON.stringify(updated));
    setNewEventTitle('');
    showToast('Scheduled reminder saved to calendar');
  };

  const handleDeleteCalendarEvent = (id: string) => {
    const updated = calendarEvents.filter(ev => ev.id !== id);
    setCalendarEvents(updated);
    localStorage.setItem('leadpulse-dashboard-calendar-v1', JSON.stringify(updated));
  };

  // Checklist & Scratchpad Helpers
  const handleToggleChecklist = (id: string) => {
    const updated = checklist.map(item => (item.id === id ? { ...item, done: !item.done } : item));
    setChecklist(updated);
    localStorage.setItem('leadpulse-dashboard-checklist-v1', JSON.stringify(updated));
  };

  const handleAddChecklistTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const updated = [...checklist, { id: `chk-${Date.now()}`, text: newTaskText.trim(), done: false }];
    setChecklist(updated);
    localStorage.setItem('leadpulse-dashboard-checklist-v1', JSON.stringify(updated));
    setNewTaskText('');
  };

  const handleDeleteChecklistTask = (id: string) => {
    const updated = checklist.filter(item => item.id !== id);
    setChecklist(updated);
    localStorage.setItem('leadpulse-dashboard-checklist-v1', JSON.stringify(updated));
  };

  // Derived Telemetry
  const totalLeads = leads.length;
  const categories = Array.from(new Set(leads.map(l => l.category).filter(Boolean))).slice(0, 6);
  const newLeads = leads.filter(l => (l.status || 'New') === 'New').length;
  const contactedLeads = leads.filter(
    l => l.status === 'WhatsApp Contacted' || l.status === 'Email Verified & Captured' || l.status === 'Replied / Awaiting Email'
  ).length;
  const proposalLeads = leads.filter(l => l.status === 'Proposal Sent').length;
  const wonLeads = leads.filter(l => l.status === 'Closed Won').length;

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isProTier = currentPlan === 'pro';
  const maxPlanTokens = currentPlan === 'pro' ? 1000 : currentPlan === 'basic' ? 400 : 15;
  const availableTokens =
    currentPlan === 'free' && !(user as any)?.has_topup
      ? Math.min(user?.lead_credits ?? 15, 15)
      : user?.lead_credits ?? maxPlanTokens;
  const tokenPercent = Math.min(100, Math.round((availableTokens / maxPlanTokens) * 100));

  // Clock calculations
  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours();
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const getZoneStatus = (timeZone: string) => {
    try {
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const hour24 = parseInt(
        now.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', hour12: false }),
        10
      );
      const isBusinessHours = hour24 >= 9 && hour24 < 18;
      return { timeStr, isBusinessHours };
    } catch {
      return { timeStr: '--:--', isBusinessHours: true };
    }
  };

  const zones = [
    { label: 'IST • Bengaluru / Mumbai', tz: 'Asia/Kolkata' },
    { label: 'GMT • London / UK', tz: 'Europe/London' },
    { label: 'EST • New York / US East', tz: 'America/New_York' }
  ];

  const colSpanClassMap: Record<ColSpan, string> = {
    4: 'col-span-12 lg:col-span-6 xl:col-span-4',
    6: 'col-span-12 lg:col-span-6 xl:col-span-6',
    8: 'col-span-12 lg:col-span-12 xl:col-span-8',
    12: 'col-span-12'
  };

  const renderWidgetBody = (widget: WidgetConfig) => {
    switch (widget.id) {
      case 'kpi-ledger':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#E5E0D5]">
            <div className="p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-delight uppercase tracking-wider font-semibold text-[#6E675F]">Verified Leads</span>
                <Users className="w-3.5 h-3.5 text-[#9C9488]" />
              </div>
              <div className="text-2xl font-bold font-delight tracking-tight text-[#191716] tabular-nums mt-2">{totalLeads}</div>
              <div className="text-[11px] mt-1.5 flex items-center gap-1.5 font-delight font-medium text-[#6E675F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span>
                <span className="text-[#191716] font-semibold">+100%</span>
                <span>active pool</span>
              </div>
            </div>

            <div className="p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-delight uppercase tracking-wider font-semibold text-[#6E675F]">Active Sequence</span>
                <Activity className="w-3.5 h-3.5 text-[#9C9488]" />
              </div>
              <div className="text-2xl font-bold font-delight tracking-tight text-[#191716] tabular-nums mt-2">{contactedLeads}</div>
              <div className="text-[11px] mt-1.5 flex items-center gap-1.5 font-delight font-medium text-[#6E675F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span>
                <span className="text-[#191716] font-semibold">Multi-Channel</span>
                <span>cadence</span>
              </div>
            </div>

            <div className="p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-delight uppercase tracking-wider font-semibold text-[#6E675F]">Proposals &amp; Won</span>
                <TrendingUp className="w-3.5 h-3.5 text-[#9C9488]" />
              </div>
              <div className="text-2xl font-bold font-delight tracking-tight text-[#191716] tabular-nums mt-2">{proposalLeads + wonLeads}</div>
              <div className="text-[11px] mt-1.5 flex items-center gap-1.5 font-delight font-medium text-[#6E675F]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span className="text-[#191716] font-semibold">{wonLeads} Closed Won</span>
                <span>converted</span>
              </div>
            </div>

            <div className="p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-delight uppercase tracking-wider font-semibold text-[#6E675F]">Available Tokens</span>
                <Compass className="w-3.5 h-3.5 text-[#9C9488]" />
              </div>
              <div className="text-2xl font-bold font-delight tracking-tight text-[#191716] tabular-nums mt-2">
                {availableTokens}
                <span className="text-sm font-normal text-[#6E675F]"> / {maxPlanTokens}</span>
              </div>
              <div className="text-[11px] mt-1.5 flex items-center gap-1.5 font-delight font-medium text-[#6E675F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span>
                <span className="text-[#191716] font-semibold uppercase">Tier: {user?.plan || 'Free'}</span>
                <span>• 1 Token = 1 Contact</span>
              </div>
            </div>
          </div>
        );

      case 'world-clock':
        return (
          <div className="p-4 space-y-4">
            {/* Top Digital + Analog Clock Face */}
            <div className="flex items-center justify-between gap-4 bg-[#FAF8F5] border border-[#E5E0D5] rounded-md p-3.5">
              <div>
                <div className="text-[10px] font-delight uppercase tracking-wider font-bold text-[#C85A32]">
                  Local Operator Time
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight text-[#191716] tabular-nums mt-0.5">
                  {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-[11px] font-delight text-[#6E675F] mt-0.5">
                  {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* SVG Precision Analog Clock */}
              <div className="w-14 h-14 shrink-0 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#191716" strokeWidth="3" />
                  {[...Array(12)].map((_, idx) => {
                    const angle = (idx * 30 * Math.PI) / 180;
                    const x1 = 50 + 38 * Math.sin(angle);
                    const y1 = 50 - 38 * Math.cos(angle);
                    const x2 = 50 + 43 * Math.sin(angle);
                    const y2 = 50 - 43 * Math.cos(angle);
                    return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9C9488" strokeWidth="2" />;
                  })}
                  {/* Hour Hand */}
                  <line
                    x1="50"
                    y1="50"
                    x2={50 + 22 * Math.sin((hourAngle * Math.PI) / 180)}
                    y2={50 - 22 * Math.cos((hourAngle * Math.PI) / 180)}
                    stroke="#191716"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Minute Hand */}
                  <line
                    x1="50"
                    y1="50"
                    x2={50 + 32 * Math.sin((minuteAngle * Math.PI) / 180)}
                    y2={50 - 32 * Math.cos((minuteAngle * Math.PI) / 180)}
                    stroke="#191716"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Second Hand */}
                  <line
                    x1="50"
                    y1="50"
                    x2={50 + 35 * Math.sin((secondAngle * Math.PI) / 180)}
                    y2={50 - 35 * Math.cos((secondAngle * Math.PI) / 180)}
                    stroke="#C85A32"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="50" cy="50" r="3" fill="#C85A32" />
                </svg>
              </div>
            </div>

            {/* Global Calling Window Radar */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-delight uppercase tracking-wider font-semibold text-[#6E675F]">
                B2B Calling Windows (9 AM - 6 PM)
              </div>
              <div className="divide-y divide-[#E5E0D5] border border-[#E5E0D5] rounded-md bg-white">
                {zones.map(z => {
                  const info = getZoneStatus(z.tz);
                  return (
                    <div key={z.tz} className="px-3 py-2 flex items-center justify-between text-xs font-delight">
                      <span className="font-medium text-[#191716] truncate">{z.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] font-semibold text-[#191716]">{info.timeStr}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-xs border uppercase ${
                            info.isBusinessHours
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {info.isBusinessHours ? 'Open' : 'Quiet'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 25-Min Outreach Sprint Pomodoro Timer */}
            <div className="pt-1 flex items-center justify-between gap-2 bg-[#F5F2EB] border border-[#E5E0D5] rounded-md px-3 py-2">
              <div>
                <div className="text-[10px] font-delight uppercase font-bold text-[#191716]">Outreach Sprint Timer</div>
                <div className="text-sm font-mono font-bold text-[#C85A32] tabular-nums">
                  {String(Math.floor(sprintSeconds / 60)).padStart(2, '0')}:
                  {String(sprintSeconds % 60).padStart(2, '0')}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSprintRunning(!sprintRunning)}
                  className="px-2.5 py-1 rounded bg-[#191716] hover:bg-[#C85A32] text-white text-[11px] font-delight font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {sprintRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{sprintRunning ? 'Pause' : 'Start'}</span>
                </button>
                <button
                  onClick={() => {
                    setSprintRunning(false);
                    setSprintSeconds(25 * 60);
                  }}
                  className="p-1 rounded bg-white border border-[#E5E0D5] text-[#6E675F] hover:text-[#191716] cursor-pointer"
                  title="Reset 25m Sprint"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        );

      case 'calendar-schedule': {
        const selectedEvents = calendarEvents.filter(ev => ev.dateKey === selectedDateKey);
        return (
          <div className="p-4 space-y-3.5">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-delight text-[#191716]">{monthLabel}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  className="p-1 rounded border border-[#E5E0D5] bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#191716] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const nowDate = new Date();
                    setCalMonth(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));
                    setSelectedDateKey(formatDateKey(nowDate));
                  }}
                  className="px-2 py-0.5 rounded border border-[#E5E0D5] bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[10px] font-delight font-semibold text-[#191716] cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  className="p-1 rounded border border-[#E5E0D5] bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#191716] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 7-Day Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-[10px] font-delight font-bold text-[#6E675F] py-0.5">
                  {d}
                </div>
              ))}
              {[...Array(firstDayOfWeek)].map((_, emptyIdx) => (
                <div key={`empty-${emptyIdx}`} className="h-7" />
              ))}
              {[...Array(daysInMonth)].map((_, idx) => {
                const dayNum = idx + 1;
                const dObj = new Date(calMonth.getFullYear(), calMonth.getMonth(), dayNum);
                const dKey = formatDateKey(dObj);
                const isToday = dKey === formatDateKey(today);
                const isSelected = dKey === selectedDateKey;
                const hasEvents = calendarEvents.some(ev => ev.dateKey === dKey);

                return (
                  <button
                    key={dKey}
                    onClick={() => setSelectedDateKey(dKey)}
                    className={`h-7 rounded text-[11px] font-delight font-semibold relative flex flex-col items-center justify-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#191716] text-white'
                        : isToday
                          ? 'bg-[#C85A32]/15 text-[#C85A32] border border-[#C85A32]'
                          : 'hover:bg-[#F5F2EB] text-[#191716]'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasEvents && (
                      <span
                        className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                          isSelected ? 'bg-[#C85A32]' : 'bg-[#C85A32]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Date Agenda + Quick Add */}
            <div className="pt-2 border-t border-[#E5E0D5] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-delight font-bold uppercase tracking-wider text-[#6E675F]">
                <span>Schedule for {selectedDateKey}</span>
                <span>{selectedEvents.length} item(s)</span>
              </div>

              <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                {selectedEvents.length === 0 ? (
                  <div className="text-[11px] text-[#9C9488] font-delight py-1.5 text-center bg-[#FAF8F5] rounded border border-dashed border-[#E5E0D5]">
                    No follow-ups scheduled for this date
                  </div>
                ) : (
                  selectedEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#FAF8F5] border border-[#E5E0D5] text-xs font-delight"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-[#E5E0D5] text-[#C85A32] shrink-0">
                          {ev.time}
                        </span>
                        <span className="text-[#191716] font-medium truncate">{ev.title}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteCalendarEvent(ev.id)}
                        className="text-[#9C9488] hover:text-rose-600 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddCalendarEvent} className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={newEventTime}
                  onChange={e => setNewEventTime(e.target.value)}
                  className="px-2 py-1 text-[11px] font-mono bg-[#FAF8F5] border border-[#E5E0D5] rounded text-[#191716] focus:outline-none focus:border-[#C85A32]"
                />
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  placeholder="Add call or follow-up..."
                  className="flex-1 min-w-0 px-2.5 py-1 text-xs font-delight bg-[#FAF8F5] border border-[#E5E0D5] rounded text-[#191716] focus:outline-none focus:border-[#C85A32]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-[#191716] hover:bg-[#C85A32] text-white rounded text-xs font-delight font-semibold cursor-pointer transition-colors shrink-0"
                >
                  Add
                </button>
              </form>
            </div>
          </div>
        );
      }

      case 'token-pool':
        return (
          <div className="p-4.5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-delight uppercase font-bold tracking-wider text-[#6E675F]">
                  Strict Contact Deduction
                </div>
                <div className="text-2xl font-bold font-delight text-[#191716] tabular-nums mt-0.5">
                  {availableTokens}{' '}
                  <span className="text-xs font-normal text-[#6E675F]">/ {maxPlanTokens} tokens</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-delight font-bold uppercase tracking-wider bg-[#FAF8F5] border border-[#E5E0D5] text-[#C85A32]">
                {currentPlan} Tier
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-2 bg-[#F5F2EB] rounded-full overflow-hidden border border-[#E5E0D5]">
                <div
                  className={`h-full transition-all duration-500 ${
                    availableTokens <= 3 ? 'bg-rose-600' : 'bg-[#C85A32]'
                  }`}
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-delight text-[#6E675F]">
                <span>Rule: 1 Token = 1 Scraped Contact</span>
                <span className="font-semibold text-[#191716]">{tokenPercent}% Available</span>
              </div>
            </div>

            <div className="p-3 rounded-md bg-[#FAF8F5] border border-[#E5E0D5] text-[11px] font-delight text-[#57514B] space-y-1">
              <div className="font-semibold text-[#191716] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>4-Day Rolling Pool Replenishment</span>
              </div>
              <p className="text-[10px] text-[#6E675F] leading-relaxed">
                Scraping 10 verified contacts deducts 10 tokens. Need higher volume?{' '}
                {isProTier ? 'Top up instant overage tokens anytime.' : 'Upgrade your workspace tier or top up.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setUpgradeTab(isProTier ? 'topup' : 'plans');
                  setTopUpOpen(true);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-delight font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isProTier ? 'bg-[#C85A32] hover:bg-[#B04B25]' : 'bg-[#191716] hover:bg-[#C85A32]'
                }`}
              >
                {isProTier ? <Plus className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />}
                <span>{isProTier ? 'Top-Up Instant Tokens' : currentPlan === 'basic' ? 'Upgrade to Pro' : 'Upgrade Plan'}</span>
              </button>
              {!isProTier && (
                <button
                  onClick={() => {
                    setUpgradeTab('topup');
                    setTopUpOpen(true);
                  }}
                  className="py-2 px-3 rounded-md text-xs font-delight font-semibold bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#191716] border border-[#E5E0D5] cursor-pointer transition-colors"
                >
                  Top-Up
                </button>
              )}
            </div>
          </div>
        );

      case 'prospect-cohorts':
        return (
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {categories.length > 0 ? (
                categories.map((cat, i) => (
                  <div
                    key={i}
                    onClick={() => navigate('/crm')}
                    className="rounded-md border border-[#E5E0D5] bg-[#FAF8F5] hover:bg-white hover:border-[#C85A32] p-3.5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span>
                      <span className="text-[10px] font-delight font-normal text-[#6E675F]">Cohort #{i + 1}</span>
                    </div>
                    <div className="text-xs font-bold font-delight text-[#191716] group-hover:text-[#C85A32] transition-colors truncate">
                      {cat}
                    </div>
                    <div className="text-[11px] text-[#6E675F] font-delight font-normal mt-1">
                      {leads.filter(l => l.category === cat).length} leads mapped
                    </div>
                  </div>
                ))
              ) : (
                <div
                  onClick={() => navigate('/finder')}
                  className="col-span-3 rounded-md border border-dashed border-[#D6CFC2] bg-[#FAF8F5] p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#C85A32] transition-colors text-center"
                >
                  <p className="text-xs font-semibold font-delight text-[#191716]">No lead lists created yet</p>
                  <p className="text-[11px] text-[#6E675F] mt-0.5">
                    Launch the Lead Finder to scrape targeted business contacts.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'funnel-progression':
        return (
          <div>
            <div className="p-4.5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-delight font-medium text-[#57514B]">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#191716]"></span>
                    <span>Uncontacted Ingest ({newLeads})</span>
                  </span>
                  <span className="font-semibold text-[#191716] tabular-nums">
                    {totalLeads > 0 ? Math.round((newLeads / totalLeads) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-[#F5F2EB] h-1.5 rounded-xs overflow-hidden border border-[#E5E0D5]">
                  <div
                    className="bg-[#191716] h-full rounded-xs transition-all duration-500"
                    style={{ width: `${totalLeads > 0 ? (newLeads / totalLeads) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-delight font-medium text-[#57514B]">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span>
                    <span>Contacted &amp; Outreach Dispatched ({contactedLeads})</span>
                  </span>
                  <span className="font-semibold text-[#191716] tabular-nums">
                    {totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-[#F5F2EB] h-1.5 rounded-xs overflow-hidden border border-[#E5E0D5]">
                  <div
                    className="bg-[#C85A32] h-full rounded-xs transition-all duration-500"
                    style={{ width: `${totalLeads > 0 ? (contactedLeads / totalLeads) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-delight font-medium text-[#57514B]">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    <span>Closed Deals &amp; Converted ({wonLeads})</span>
                  </span>
                  <span className="font-semibold text-[#191716] tabular-nums">
                    {totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-[#F5F2EB] h-1.5 rounded-xs overflow-hidden border border-[#E5E0D5]">
                  <div
                    className="bg-emerald-600 h-full rounded-xs transition-all duration-500"
                    style={{ width: `${totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="px-4.5 py-3 bg-[#FAF8F5] border-t border-[#E5E0D5] flex items-center justify-between">
              <span className="text-[11px] text-[#6E675F] font-delight font-medium">
                Synchronized with Resizable Kanban CRM stages
              </span>
              <button
                onClick={() => navigate('/crm')}
                className="px-3 py-1.5 bg-white hover:bg-[#F5F2EB] border border-[#E5E0D5] text-[#191716] rounded-md text-xs font-delight font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Open Kanban Board</span>
                <ArrowRight className="w-3 h-3 text-[#6E675F]" />
              </button>
            </div>
          </div>
        );

      case 'scratchpad-notes':
        return (
          <div className="p-4 space-y-3.5">
            {/* Action Checklist */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-delight uppercase tracking-wider font-bold text-[#6E675F]">
                Operator Sprint Checklist
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                {checklist.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#FAF8F5] border border-[#E5E0D5] text-xs font-delight"
                  >
                    <button
                      onClick={() => handleToggleChecklist(item.id)}
                      className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                    >
                      {item.done ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-[#9C9488] shrink-0" />
                      )}
                      <span className={`truncate ${item.done ? 'line-through text-[#9C9488]' : 'text-[#191716]'}`}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteChecklistTask(item.id)}
                      className="text-[#9C9488] hover:text-rose-600 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddChecklistTask} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  placeholder="Add sprint task..."
                  className="flex-1 min-w-0 px-2.5 py-1 text-xs font-delight bg-[#FAF8F5] border border-[#E5E0D5] rounded text-[#191716] focus:outline-none focus:border-[#C85A32]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-[#191716] hover:bg-[#C85A32] text-white rounded text-xs font-delight font-semibold cursor-pointer transition-colors"
                >
                  +
                </button>
              </form>
            </div>

            {/* Persistent Call Scratchpad */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-delight uppercase tracking-wider font-bold text-[#6E675F]">
                <span>Quick Call Notes</span>
                <span className="text-[9px] text-emerald-700 font-normal">Auto-saved</span>
              </div>
              <textarea
                rows={3}
                value={scratchpadText}
                onChange={e => {
                  setScratchpadText(e.target.value);
                  localStorage.setItem('leadpulse-dashboard-scratchpad-v1', e.target.value);
                }}
                placeholder="Jot down objection notes, script tweaks, or target cities..."
                className="w-full p-2.5 text-xs font-delight bg-[#FAF8F5] border border-[#E5E0D5] rounded-md text-[#191716] focus:outline-none focus:border-[#C85A32] resize-none"
              />
            </div>
          </div>
        );

      case 'operator-actions':
        return (
          <div className="divide-y divide-[#E5E0D5]">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#191716] text-white flex items-center justify-center font-bold text-xs shrink-0 font-delight">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-[#191716] font-delight truncate tracking-tight">
                    {user?.name || 'Ashley G.'}
                  </div>
                  <div className="text-[11px] text-[#6E675F] font-delight font-normal truncate">
                    {user?.email || 'operator@leadpulse.io'}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[9px] font-delight bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-[#E5E0D5] border border-[#E5E0D5] rounded-md bg-[#FAF8F5] text-center font-delight">
                <div className="p-2">
                  <div className="text-[10px] text-[#6E675F] uppercase font-semibold">Role</div>
                  <div className="text-xs font-bold text-[#191716] mt-0.5">{user?.role || 'Super Admin'}</div>
                </div>
                <div className="p-2">
                  <div className="text-[10px] text-[#6E675F] uppercase font-semibold">Plan</div>
                  <div className="text-xs font-bold text-[#C85A32] uppercase mt-0.5">{user?.plan || 'Free'}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/finder')}
              className="w-full p-3.5 bg-white hover:bg-[#FAF8F5] text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold font-delight text-[#191716] group-hover:text-[#C85A32] transition-colors">
                  Launch Lead Harvester
                </div>
                <div className="text-[11px] text-[#6E675F]">Scrape geo-targeted B2B listings</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#9C9488] group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => navigate('/outreach')}
              className="w-full p-3.5 bg-white hover:bg-[#FAF8F5] text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold font-delight text-[#191716] group-hover:text-[#C85A32] transition-colors">
                  Outreach Studio
                </div>
                <div className="text-[11px] text-[#6E675F]">Launch email or WhatsApp campaign</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#9C9488] group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => navigate('/help')}
              className="w-full p-3.5 bg-white hover:bg-[#FAF8F5] text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-bold font-delight text-[#191716] group-hover:text-[#C85A32] transition-colors">
                  Interactive Help Center
                </div>
                <div className="text-[11px] text-[#6E675F]">Full platform docs &amp; setup guides</div>
              </div>
              <BookOpen className="w-3.5 h-3.5 text-[#9C9488] group-hover:text-[#C85A32] transition-all" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />

        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#191716] text-white px-4 py-2.5 rounded-md shadow-lg border border-[#2C2825] text-xs font-delight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C85A32]" />
            <span>{toastMsg}</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-[1360px] mx-auto space-y-5 pb-12">
            {/* Dashboard Command & Layout Bar */}
            <div className="bg-white border border-[#E5E0D5] rounded-lg p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Prebuilt Layouts Strip (6 Prebuilt Layouts) */}
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                <div className="flex items-center gap-1.5 text-[11px] font-delight font-bold uppercase tracking-wider text-[#6E675F] shrink-0 pr-1">
                  <Layout className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Prebuilt Layouts:</span>
                </div>
                {PREBUILT_LAYOUTS.map(preset => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset.id)}
                      title={preset.description}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-delight font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                        isActive
                          ? 'bg-[#191716] text-white border-[#191716]'
                          : 'bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#57514B] border-[#E5E0D5]'
                      }`}
                    >
                      <span>{preset.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-xs font-mono ${
                          isActive ? 'bg-[#C85A32] text-white' : 'bg-white text-[#6E675F] border border-[#E5E0D5]'
                        }`}
                      >
                        {preset.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Edit Layout & Reset Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-delight font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ${
                    isEditMode
                      ? 'bg-[#C85A32] text-white border-[#C85A32] shadow-xs'
                      : 'bg-white hover:bg-[#FAF8F5] text-[#191716] border-[#E5E0D5]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Done Editing Layout' : 'Edit Layout'}</span>
                </button>
                <button
                  onClick={() => handleSelectPreset('executive')}
                  title="Reset Dashboard to Default Executive Command Layout"
                  className="p-1.5 rounded-md bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#6E675F] hover:text-[#191716] border border-[#E5E0D5] cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive Edit Layout Tray (Visible when Edit Layout is active) */}
            {isEditMode && (
              <div className="bg-[#FAF8F5] border-2 border-dashed border-[#C85A32] rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold font-delight text-[#191716] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#C85A32]" />
                      <span>Interactive Layout Studio Active - Drag Widgets to Rearrange or Resize Column Spans</span>
                    </div>
                    <p className="text-[11px] font-delight text-[#6E675F] mt-0.5">
                      Drag any widget card by its header to reorder it, choose width spans (1/3, 1/2, 2/3, Full), or toggle widgets below.
                    </p>
                  </div>
                </div>

                {/* Widget Visibility Toggle Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-delight uppercase font-bold text-[#6E675F] mr-1">
                    Active Widgets:
                  </span>
                  {widgets.map(w => (
                    <button
                      key={w.id}
                      onClick={() => handleToggleWidgetVisibility(w.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-delight font-semibold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                        w.visible
                          ? 'bg-white text-[#191716] border-[#191716]'
                          : 'bg-[#F5F2EB] text-[#9C9488] border-[#E5E0D5] line-through'
                      }`}
                    >
                      {w.visible ? <Eye className="w-3 h-3 text-[#C85A32]" /> : <EyeOff className="w-3 h-3" />}
                      <span>{w.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic 12-Column Draggable Widget Grid */}
            <div className="grid grid-cols-12 gap-5">
              {widgets
                .filter(w => w.visible)
                .map(widget => {
                  const isDragged = draggedWidgetId === widget.id;
                  const isDragOver = dragOverWidgetId === widget.id && draggedWidgetId !== widget.id;

                  return (
                    <div
                      key={widget.id}
                      draggable={isEditMode}
                      onDragStart={e => handleWidgetDragStart(e, widget.id)}
                      onDragOver={e => handleWidgetDragOver(e, widget.id)}
                      onDrop={e => handleWidgetDrop(e, widget.id)}
                      onDragEnd={() => {
                        setDraggedWidgetId(null);
                        setDragOverWidgetId(null);
                      }}
                      className={`${colSpanClassMap[widget.colSpan]} bg-white border rounded-lg overflow-hidden transition-all flex flex-col ${
                        isDragged
                          ? 'opacity-40 border-dashed border-[#C85A32]'
                          : isDragOver
                            ? 'border-[#C85A32] border-2 ring-2 ring-[#C85A32]/20'
                            : isEditMode
                              ? 'border-[#C85A32]/60 shadow-xs'
                              : 'border-[#E5E0D5]'
                      }`}
                    >
                      {/* Widget Header */}
                      <div
                        className={`px-4.5 py-3 bg-[#F5F2EB] border-b border-[#E5E0D5] flex items-center justify-between gap-2 ${
                          isEditMode ? 'cursor-grab active:cursor-grabbing' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isEditMode && <GripVertical className="w-4 h-4 text-[#C85A32] shrink-0" />}
                          <div className="min-w-0">
                            <h2 className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716] truncate">
                              {widget.title}
                            </h2>
                            <p className="text-[11px] text-[#6E675F] font-delight font-normal truncate">
                              {widget.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Edit Mode Span Controls OR Normal Context Action */}
                        {isEditMode ? (
                          <div className="flex items-center gap-1 shrink-0">
                            {([
                              { span: 4 as ColSpan, label: '1/3' },
                              { span: 6 as ColSpan, label: '1/2' },
                              { span: 8 as ColSpan, label: '2/3' },
                              { span: 12 as ColSpan, label: 'Full' }
                            ]).map(opt => (
                              <button
                                key={opt.span}
                                onClick={() => handleChangeWidgetSpan(widget.id, opt.span)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                  widget.colSpan === opt.span
                                    ? 'bg-[#191716] text-white border-[#191716]'
                                    : 'bg-white text-[#6E675F] border-[#E5E0D5] hover:border-[#191716]'
                                }`}
                                title={`Set widget width to ${opt.label}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                            <button
                              onClick={() => handleToggleWidgetVisibility(widget.id)}
                              className="p-1 rounded bg-white border border-[#E5E0D5] text-[#6E675F] hover:text-rose-600 cursor-pointer ml-1"
                              title="Hide widget"
                            >
                              <EyeOff className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="shrink-0">
                            {widget.id === 'prospect-cohorts' && (
                              <Link
                                to="/crm"
                                className="text-xs font-delight font-semibold text-[#C85A32] hover:text-[#B04B25] flex items-center gap-1"
                              >
                                <span>View in CRM</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}
                            {widget.id === 'world-clock' && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-delight font-semibold bg-white text-[#191716] px-2 py-0.5 rounded border border-[#E5E0D5]">
                                <Clock className="w-3 h-3 text-[#C85A32]" />
                                <span>Live Sync</span>
                              </span>
                            )}
                            {widget.id === 'calendar-schedule' && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-delight font-semibold bg-white text-[#191716] px-2 py-0.5 rounded border border-[#E5E0D5]">
                                <CalendarIcon className="w-3 h-3 text-[#C85A32]" />
                                <span>Planner</span>
                              </span>
                            )}
                            {widget.id === 'funnel-progression' && (
                              <span className="text-[10px] font-delight font-semibold bg-white text-[#191716] px-2 py-0.5 rounded border border-[#E5E0D5] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                                <span>Live Telemetry</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Widget Body */}
                      <div className="flex-1">{renderWidgetBody(widget)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
