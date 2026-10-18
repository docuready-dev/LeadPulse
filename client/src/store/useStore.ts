import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  lead_credits: number;
  onboarding_complete: boolean;
  company_name?: string;
  field_of_work?: string;
  plan?: 'free' | 'basic' | 'pro';
  pool_refreshed_at?: string;
  daily_leads_limit?: number;
  daily_leads_used?: number;
  target_audience?: string;
  niche?: string;
  goals?: string;
  profile_picture?: string;
  // Outreach & Email Marketing Quotas
  emails_limit?: number;
  emails_sent?: number;
  ai_pitches_limit?: number;
  ai_pitches_used?: number;
}

export interface WorkspaceIntegration {
  id: string;
  name: string;
  category: string;
  connected: boolean;
  logo: string;
  description: string;
  config: Record<string, string>;
  configFields?: any[];
  lastSync?: string | null;
}

export interface IntegrationLogEntry {
  id: string;
  appId: string;
  appName: string;
  eventType: 'sync' | 'enrich' | 'notify' | 'auth' | 'webhook';
  summary: string;
  status: string;
  latency: string;
  timestamp: string;
  payload?: any;
}

const INITIAL_WORKSPACE_INTEGRATIONS: WorkspaceIntegration[] = [];

const normalizeUserCredits = (user: User | null): User | null => {
  if (!user) return null;
  const plan = (user.plan || 'free').toLowerCase();
  
  // Lead Credits: respect actual user lead_credits balance
  const leadCredits = user.lead_credits !== undefined ? user.lead_credits : 15;

  // Email limits by tier
  const emailsLimit = plan === 'pro' ? 5000 : plan === 'basic' ? 1500 : 50;
  const aiPitchesLimit = plan === 'pro' ? -1 : plan === 'basic' ? 250 : 5;

  return {
    ...user,
    lead_credits: leadCredits,
    emails_limit: user.emails_limit || emailsLimit,
    emails_sent: user.emails_sent || 0,
    ai_pitches_limit: user.ai_pitches_limit !== undefined ? user.ai_pitches_limit : aiPitchesLimit,
    ai_pitches_used: user.ai_pitches_used || 0
  };
};

interface AppState {
  user: User | null;
  token: string | null;
  activeFilter: string;
  isTopUpOpen: boolean;
  isUpgradeModalOpen: boolean;
  upgradeTab: 'plans' | 'topup';
  integrations: WorkspaceIntegration[];
  integrationLogs: IntegrationLogEntry[];
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setActiveFilter: (filter: string) => void;
  updateCredits: (credits: number) => void;
  recordEmailDispatch: (count: number) => void;
  recordAiGeneration: () => void;
  refreshUserProfile: (userId?: string) => Promise<void>;
  setTopUpOpen: (isOpen: boolean) => void;
  setUpgradeModalOpen: (isOpen: boolean) => void;
  setUpgradeTab: (tab: 'plans' | 'topup') => void;
  setIntegrations: (integrations: WorkspaceIntegration[]) => void;
  setIntegrationLogs: (logs: IntegrationLogEntry[]) => void;
  fetchWorkspaceIntegrations: (userId?: string) => Promise<void>;
  syncLeadsToIntegration: (appId: string, leadIds: string[]) => Promise<{
    syncedCount: number;
    appName: string;
    deliveryMode?: string;
    externalUrl?: string;
    deliveryNote?: string;
  } | null>;
  enrichLeadViaIntegration: (leadId: string, appId?: string) => Promise<any>;
  notifyIntegration: (appId: string, summary: string, payload?: any) => Promise<any>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      activeFilter: 'All',
      isTopUpOpen: false,
      isUpgradeModalOpen: false,
      upgradeTab: 'plans',
      integrations: INITIAL_WORKSPACE_INTEGRATIONS,
      integrationLogs: [],
      setUser: (user) => set({ user: normalizeUserCredits(user) }),
      setToken: (token) => set({ token }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      updateCredits: (credits) => set((state) => ({ 
        user: state.user ? normalizeUserCredits({ ...state.user, lead_credits: credits, has_topup: true }) : null 
      })),
      recordEmailDispatch: (count: number) => set((state) => ({
        user: state.user ? { ...state.user, emails_sent: (state.user.emails_sent || 0) + count } : null
      })),
      recordAiGeneration: () => set((state) => ({
        user: state.user ? { ...state.user, ai_pitches_used: (state.user.ai_pitches_used || 0) + 1 } : null
      })),
      refreshUserProfile: async (overrideUserId?: string) => {
        const uid = overrideUserId || get().user?._id;
        const token = get().token;
        if (!uid && !token) return;
        try {
          const headers: Record<string, string> = {};
          if (uid) headers.userid = uid;
          if (token) headers.authorization = `Bearer ${token}`;
          const res = await axios.get('http://localhost:3001/api/auth/me', { headers });
          if (res.data?.user) {
            set({ user: normalizeUserCredits(res.data.user) });
          }
        } catch (err) {
          console.error('Failed to sync user profile & token pool:', err);
        }
      },
      setTopUpOpen: (isOpen) => set({ isTopUpOpen: isOpen, isUpgradeModalOpen: isOpen, upgradeTab: 'topup' }),
      setUpgradeModalOpen: (isOpen) => set({ isUpgradeModalOpen: isOpen, isTopUpOpen: isOpen }),
      setUpgradeTab: (tab) => set({ upgradeTab: tab }),
      setIntegrations: (integrations) => set({ integrations }),
      setIntegrationLogs: (integrationLogs) => set({ integrationLogs }),
      fetchWorkspaceIntegrations: async (overrideUserId?: string) => {
        const uid = overrideUserId || get().user?._id;
        if (!uid) return;
        try {
          const res = await axios.get('http://localhost:3001/api/integrations', {
            headers: { userid: uid }
          });
          if (res.data?.integrations) {
            set({ integrations: res.data.integrations });
          }
          if (res.data?.logs) {
            set({ integrationLogs: res.data.logs });
          }
        } catch (err) {
          console.error('Failed to sync workspace integrations:', err);
        }
      },
      syncLeadsToIntegration: async (appId: string, leadIds: string[]) => {
        const uid = get().user?._id;
        if (!uid) return null;
        try {
          const res = await axios.post(
            'http://localhost:3001/api/integrations/sync-leads',
            { appId, leadIds },
            { headers: { userid: uid } }
          );
          if (res.data?.integrations) set({ integrations: res.data.integrations });
          if (res.data?.logs) set({ integrationLogs: res.data.logs });

          // If syncing to Google Sheets or Microsoft Excel, copy rows to clipboard BEFORE opening the sheet tab
          if (appId === 'google-sheets' || appId === 'microsoft-excel') {
            if (res.data?.tsvContent) {
              try {
                const ta = document.createElement('textarea');
                ta.value = res.data.tsvContent;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
              } catch {}
              if (navigator?.clipboard?.writeText) {
                try {
                  await navigator.clipboard.writeText(res.data.tsvContent);
                } catch {}
              }
            }
            if (res.data?.externalUrl) {
              window.open(res.data.externalUrl, '_blank', 'noopener,noreferrer');
            }
          }

          return {
            syncedCount: res.data.syncedCount,
            appName: res.data.appName,
            deliveryMode: res.data.deliveryMode,
            externalUrl: res.data.externalUrl,
            deliveryNote: res.data.deliveryNote
          };
        } catch (err) {
          console.error('Sync leads failed:', err);
          return null;
        }
      },
      enrichLeadViaIntegration: async (leadId: string, appId = 'apollo') => {
        const uid = get().user?._id;
        if (!uid) return null;
        try {
          const res = await axios.post(
            'http://localhost:3001/api/integrations/enrich-lead',
            { appId, leadId },
            { headers: { userid: uid } }
          );
          if (res.data?.logs) set({ integrationLogs: res.data.logs });
          return res.data?.lead || null;
        } catch (err) {
          console.error('Enrich lead failed:', err);
          return null;
        }
      },
      notifyIntegration: async (appId: string, summary: string, payload: any = {}) => {
        const uid = get().user?._id;
        if (!uid) return null;
        try {
          const res = await axios.post(
            'http://localhost:3001/api/integrations/notify',
            { appId, eventType: 'notify', summary, payload },
            { headers: { userid: uid } }
          );
          if (res.data?.integrations) set({ integrations: res.data.integrations });
          if (res.data?.logs) set({ integrationLogs: res.data.logs });
          return res.data?.log || null;
        } catch (err) {
          console.error('Notify integration failed:', err);
          return null;
        }
      }
    }),
    {
      name: 'leadpulse-storage',
      partialize: (state) => ({
        user: normalizeUserCredits(state.user),
        token: state.token,
        activeFilter: state.activeFilter,
        integrations: state.integrations,
        integrationLogs: state.integrationLogs,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.setUser(normalizeUserCredits(state.user));
        }
      },
    }
  )
);

