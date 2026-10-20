import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Search, Filter, Plus, Users, LayoutTemplate, Tag, Mail, 
  Phone, CheckCircle2, Trash2, Send, Download, ExternalLink, 
  Code, Eye, Check, X, Sparkles, Building2, Globe, Copy, AlertCircle, Edit3,
  Webhook, Zap, ArrowUpDown, ArrowUp, ArrowDown, Calendar, MapPin, Star,
  Lock
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { confirmDialog, alertDialog } from '../components/AppConfirmModal';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';

interface FormTemplate {
  id: string;
  title: string;
  type: 'Embedded' | 'Popup' | 'Landing Link';
  submissions: number;
  status: 'Active' | 'Paused';
  buttonText: string;
  themeColor: string;
  headline: string;
  subheadline: string;
}

const DEFAULT_FORMS: FormTemplate[] = [
  {
    id: 'newsletter-footer',
    title: 'Newsletter Footer Embed',
    type: 'Embedded',
    submissions: 0,
    status: 'Active',
    headline: 'Subscribe to our B2B Growth Dispatch',
    subheadline: 'Get weekly high-converting outreach tactics directly in your inbox.',
    buttonText: 'Subscribe Now',
    themeColor: '#191716'
  },
  {
    id: 'lead-magnet-popup',
    title: 'Exit-Intent Lead Magnet Popup',
    type: 'Popup',
    submissions: 0,
    status: 'Active',
    headline: 'Claim 15 Free Verified B2B Leads',
    subheadline: 'Leave your email and our AI will deliver curated prospects instantly.',
    buttonText: 'Unlock 15 Leads',
    themeColor: '#C85A32'
  },
  {
    id: 'demo-booking-embed',
    title: 'Book a Demo Inbound Form',
    type: 'Embedded',
    submissions: 0,
    status: 'Active',
    headline: 'See Strovr in Action',
    subheadline: 'Schedule a 15-minute walkthrough tailored to your sales process.',
    buttonText: 'Request Demo Walkthrough',
    themeColor: '#191716'
  }
];

const Audience = () => {
  const { user, integrations, syncLeadsToIntegration, enrichLeadViaIntegration, setUpgradeModalOpen, setUpgradeTab } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'contacts' | 'segments' | 'forms'>('contacts');

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN' || user?.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com';
  const isExportLocked = currentPlan === 'free' && !isSuperAdmin;

  // Contacts state with resilient cache loading across device reloads
  const [leads, setLeads] = useState<any[]>(() => {
    try {
      const activeId = user?._id || 'default';
      const cached = localStorage.getItem(`strovr_leads_cache_${activeId}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Sorting state (date, city, name, category, rating, status)
  type SortOption = 
    | 'date_desc' 
    | 'date_asc' 
    | 'city_asc' 
    | 'city_desc' 
    | 'name_asc' 
    | 'name_desc' 
    | 'rating_desc' 
    | 'rating_asc' 
    | 'category_asc' 
    | 'category_desc' 
    | 'status_asc';

  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  
  // Integration Sync & Enrich state
  const [isSyncDropdownOpen, setIsSyncDropdownOpen] = useState(false);
  const [syncingAppId, setSyncingAppId] = useState<string | null>(null);
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Connected Sync Destinations (CRMs, Spreadsheets, Warehouses)
  const connectedSyncApps = integrations.filter(
    a => a.connected && ['CRM', 'Productivity', 'Marketing & Forms', 'Data & Warehouses'].includes(a.category)
  );
  // Connected Enrichment Provider (Apollo, Firecrawl, LinkedIn)
  const activeEnrichApp = integrations.find(
    a => a.connected && ['apollo', 'firecrawl', 'linkedin'].includes(a.id)
  ) || { id: 'apollo', name: 'Apollo' };

  // Modals state
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isCreateSegmentOpen, setIsCreateSegmentOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEmbedCodeOpen, setIsEmbedCodeOpen] = useState(false);
  const [isTestFormOpen, setIsTestFormOpen] = useState(false);
  
  // Active form being edited / previewed
  const [formsList, setFormsList] = useState<FormTemplate[]>(DEFAULT_FORMS);
  const [activeForm, setActiveForm] = useState<FormTemplate>(DEFAULT_FORMS[0]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // New Contact form inputs
  const [newContact, setNewContact] = useState({
    businessName: '',
    email: '',
    phone: '',
    category: 'B2B Sales',
    location: '',
    city: '',
    status: 'New',
    tags: 'VIP'
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Test form submission inputs
  const [testSubmission, setTestSubmission] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  // Custom Segments
  const [customSegments, setCustomSegments] = useState<{ title: string; desc: string; filterKey: string }[]>([
    { title: 'Verified Emails', desc: 'Contacts with confirmed deliverable email addresses.', filterKey: 'has_email' },
    { title: 'WhatsApp Outreach Ready', desc: 'Contacts with mobile numbers ready for direct WhatsApp dispatch.', filterKey: 'has_phone' },
    { title: 'Hot Pipeline Opportunities', desc: 'Prospects with proposals sent or closed won status.', filterKey: 'hot_leads' },
    { title: 'Fresh Harvests', desc: 'New uncontacted leads recently generated from the database.', filterKey: 'new_leads' }
  ]);
  const [newSegmentTitle, setNewSegmentTitle] = useState('');
  const [newSegmentDesc, setNewSegmentDesc] = useState('');

  // Helper deduplication merge
  const mergeLeads = (localList: any[], serverList: any[]) => {
    const map = new Map<string, any>();
    for (const l of localList) {
      if (!l) continue;
      if (l._id) map.set(l._id, l);
      const nameKey = (l.businessName || '').toLowerCase().trim();
      if (nameKey && l.email) map.set(`${nameKey}__${l.email.toLowerCase().trim()}`, l);
      if (nameKey && l.phone) map.set(`${nameKey}__${l.phone.replace(/[^0-9]/g, '')}`, l);
    }
    for (const s of serverList) {
      if (!s) continue;
      if (s._id && map.has(s._id)) {
        map.set(s._id, { ...map.get(s._id), ...s });
      } else {
        const nameKey = (s.businessName || '').toLowerCase().trim();
        const emailKey = s.email ? `${nameKey}__${s.email.toLowerCase().trim()}` : '';
        const phoneKey = s.phone ? `${nameKey}__${s.phone.replace(/[^0-9]/g, '')}` : '';
        if (emailKey && map.has(emailKey)) {
          map.set(emailKey, { ...map.get(emailKey), ...s });
        } else if (phoneKey && map.has(phoneKey)) {
          map.set(phoneKey, { ...map.get(phoneKey), ...s });
        } else {
          map.set(s._id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, s);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const timeB = new Date(b.harvestedAt || b.createdAt || 0).getTime();
      const timeA = new Date(a.harvestedAt || a.createdAt || 0).getTime();
      return timeB - timeA;
    });
  };

  // Persist leads helper
  const updateLocalLeads = (newLeadsList: any[]) => {
    setLeads(newLeadsList);
    try {
      if (user?.email) localStorage.setItem(`strovr_leads_cache_${user.email}`, JSON.stringify(newLeadsList));
      if (user?._id) localStorage.setItem(`strovr_leads_cache_${user._id}`, JSON.stringify(newLeadsList));
    } catch {}
  };

  useEffect(() => {
    if (user?._id || user?.email) {
      // Re-hydrate cache for this user immediately
      try {
        const raw = (user?.email && localStorage.getItem(`strovr_leads_cache_${user.email}`)) ||
                    (user?._id && localStorage.getItem(`strovr_leads_cache_${user._id}`));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLeads(parsed);
          }
        }
      } catch {}
      fetchLeads();
    }
  }, [user?._id, user?.email]);

  const fetchLeads = async () => {
    if (!user?._id && !user?.email) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/leads`, {
        headers: { 
          userid: user._id || '',
          useremail: user.email || ''
        }
      });
      const serverLeads = Array.isArray(res.data) ? res.data : [];

      let localCached: any[] = [];
      try {
        const raw = (user?.email && localStorage.getItem(`strovr_leads_cache_${user.email}`)) ||
                    (user?._id && localStorage.getItem(`strovr_leads_cache_${user._id}`));
        if (raw) localCached = JSON.parse(raw);
      } catch {}

      // CRITICAL: If server returned 0 leads after container restart but local vault has leads, auto-rehydrate!
      if (serverLeads.length === 0 && localCached.length > 0) {
        try {
          const syncRes = await axios.post(`${API_URL}/api/leads/sync-vault`, {
            leads: localCached
          }, {
            headers: { 
              userid: user._id || '',
              useremail: user.email || ''
            }
          });
          if (syncRes.data?.leads) {
            updateLocalLeads(syncRes.data.leads);
            return;
          }
        } catch {}
        updateLocalLeads(localCached);
        return;
      }

      // Merge server and local vault so leads permanently pile up across all devices
      const merged = mergeLeads(localCached, serverLeads);
      updateLocalLeads(merged);

      // If client has extra leads (e.g. added offline or before wake-up), sync to server in background
      if (localCached.length > serverLeads.length) {
        axios.post(`${API_URL}/api/leads/sync-vault`, {
          leads: merged
        }, {
          headers: { 
            userid: user._id || '',
            useremail: user.email || ''
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper extraction functions
  const getLeadCity = (lead: any): string => {
    if (lead.city && typeof lead.city === 'string' && lead.city.trim()) {
      return lead.city.trim();
    }
    const loc = (lead.location || lead.address || '').trim();
    if (!loc) return 'Unknown';
    const parts = loc.split(',').map((p: string) => p.trim()).filter(Boolean);
    return parts[0] || 'Unknown';
  };

  const getLeadDateNumber = (lead: any): number => {
    const d = lead.harvestedAt || lead.createdAt || lead.created_at || lead.timestamp || lead.date;
    if (!d) return 0;
    const time = new Date(d).getTime();
    return isNaN(time) ? 0 : time;
  };

  const formatHarvestDate = (leadOrDate: any): string => {
    const dateVal = typeof leadOrDate === 'object' && leadOrDate !== null
      ? (leadOrDate.harvestedAt || leadOrDate.createdAt || leadOrDate.created_at)
      : leadOrDate;
    if (!dateVal) return 'Recently';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const toggleSortField = (field: 'date' | 'city' | 'name' | 'category' | 'rating' | 'status') => {
    if (sortOption === `${field}_asc`) {
      setSortOption(`${field}_desc` as SortOption);
    } else if (sortOption === `${field}_desc`) {
      setSortOption(`${field}_asc` as SortOption);
    } else {
      if (field === 'date' || field === 'rating') {
        setSortOption(`${field}_desc` as SortOption);
      } else {
        setSortOption(`${field}_asc` as SortOption);
      }
    }
  };

  const renderSortIcon = (field: 'date' | 'city' | 'name' | 'category' | 'rating' | 'status') => {
    if (sortOption === `${field}_asc`) {
      return <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" />;
    }
    if (sortOption === `${field}_desc`) {
      return <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />;
    }
    return <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 group-hover:text-slate-400 shrink-0" />;
  };

  // Filter contacts
  const filteredContacts = leads.filter(lead => {
    const city = getLeadCity(lead);
    const matchesSearch = 
      (lead.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.phone || '').includes(searchQuery) ||
      (lead.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      city.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (stageFilter === 'All') return true;
    if (stageFilter === 'has_email') return Boolean(lead.email);
    if (stageFilter === 'has_phone') return Boolean(lead.phone);
    if (stageFilter === 'hot_leads') return lead.status === 'Proposal Sent' || lead.status === 'Closed Won';
    if (stageFilter === 'new_leads') return lead.status === 'New';
    return lead.status === stageFilter;
  });

  // Comprehensive multi-way sorting
  const sortedAndFilteredContacts = [...filteredContacts].sort((a, b) => {
    switch (sortOption) {
      case 'date_desc':
        return getLeadDateNumber(b) - getLeadDateNumber(a);
      case 'date_asc':
        return getLeadDateNumber(a) - getLeadDateNumber(b);
      case 'city_asc':
        return getLeadCity(a).localeCompare(getLeadCity(b));
      case 'city_desc':
        return getLeadCity(b).localeCompare(getLeadCity(a));
      case 'name_asc':
        return (a.businessName || '').localeCompare(b.businessName || '');
      case 'name_desc':
        return (b.businessName || '').localeCompare(a.businessName || '');
      case 'rating_desc':
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      case 'rating_asc':
        return (Number(a.rating) || 0) - (Number(b.rating) || 0);
      case 'category_asc':
        return (a.category || '').localeCompare(b.category || '');
      case 'category_desc':
        return (b.category || '').localeCompare(a.category || '');
      case 'status_asc':
        return (a.status || '').localeCompare(b.status || '');
      default:
        return getLeadDateNumber(b) - getLeadDateNumber(a);
    }
  });

  // Push selected or filtered leads to a connected CRM / Spreadsheet
  const handlePushToIntegration = async (appId: string, appName: string) => {
    const targetIds = selectedLeadIds.length > 0
      ? selectedLeadIds
      : filteredContacts.map(l => l._id);

    if (targetIds.length === 0) {
      showToast('No contacts available to sync.');
      setIsSyncDropdownOpen(false);
      return;
    }

    setSyncingAppId(appId);
    const result = await syncLeadsToIntegration(appId, targetIds);
    setSyncingAppId(null);
    setIsSyncDropdownOpen(false);

    if (result) {
      const idSet = new Set(targetIds);
      setLeads(prev => prev.map(l => {
        if (!idSet.has(l._id)) return l;
        const existing = Array.isArray(l.syncedTo) ? l.syncedTo : [];
        return { ...l, syncedTo: Array.from(new Set([...existing, result.appName])) };
      }));
      showToast(`Pushed ${result.syncedCount} lead(s) to ${result.appName} [200 OK]`);
    } else {
      showToast(`Failed to sync leads to ${appName}.`);
    }
  };

  // 1-Click Enrich Lead Email via Apollo / Firecrawl
  const handleEnrichContact = async (lead: any) => {
    setEnrichingLeadId(lead._id);
    const updatedLead = await enrichLeadViaIntegration(lead._id, activeEnrichApp.id);
    setEnrichingLeadId(null);
    if (updatedLead) {
      setLeads(prev => prev.map(l => l._id === lead._id ? { ...l, ...updatedLead } : l));
      showToast(`Enriched ${lead.businessName} (${updatedLead.email}) via ${activeEnrichApp.name} [200 OK]`);
    }
  };

  const getFormSubmissionsCount = (formId: string) => {
    return leads.filter(l => 
      l.source === `Form: ${formId}` || 
      (Array.isArray(l.tags) && l.tags.includes(formId)) ||
      (l.formId === formId)
    ).length;
  };

  // Handle Add Contact Submit
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id && !user?.email) return;
    setIsSubmittingContact(true);
    try {
      const res = await axios.post(`${API_URL}/api/leads`, {
        ...newContact,
        location: newContact.location || newContact.city || '',
        city: newContact.city || newContact.location || '',
        harvestedAt: new Date().toISOString(),
        tags: newContact.tags ? [newContact.tags] : []
      }, {
        headers: { 
          userid: user?._id || '',
          useremail: user?.email || ''
        }
      });

      const updated = [res.data, ...leads];
      updateLocalLeads(updated);
      setIsAddContactOpen(false);
      setNewContact({
        businessName: '',
        email: '',
        phone: '',
        category: 'B2B Sales',
        location: '',
        city: '',
        status: 'New',
        tags: 'VIP'
      });
      showToast('New lead added to your Audience database.');
    } catch (err) {
      console.error('Failed to add contact', err);
      await alertDialog({
        title: 'Save Error',
        message: 'Failed to save contact. Please check details and try again.',
        variant: 'error'
      });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Handle Save / Update Contact (e.g. shortening business name, editing coordinates)
  const handleSaveEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?._id || (!user?._id && !user?.email)) return;
    setIsSavingEdit(true);
    try {
      const payload = {
        businessName: editingContact.businessName,
        email: editingContact.email || '',
        phone: editingContact.phone || '',
        website: editingContact.website || '',
        category: editingContact.category || 'General',
        location: editingContact.location || '',
        city: editingContact.city || (editingContact.location ? editingContact.location.split(',')[0].trim() : ''),
        status: editingContact.status || 'New'
      };
      const res = await axios.patch(`${API_URL}/api/leads/${editingContact._id}`, payload, {
        headers: { 
          userid: user?._id || '',
          useremail: user?.email || ''
        }
      });
      const updated = res.data?.lead || { ...editingContact, ...payload };
      const nextLeads = leads.map(l => l._id === editingContact._id ? updated : l);
      updateLocalLeads(nextLeads);
      setEditingContact(null);
      showToast('Contact details updated.');
    } catch (err) {
      console.error('Failed to update contact:', err);
      await alertDialog({
        title: 'Update Error',
        message: 'Failed to update contact. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete Contact
  const handleDeleteContact = async (id: string) => {
    const targetLead = leads.find(l => l._id === id);
    const confirmed = await confirmDialog({
      title: 'Delete Contact?',
      message: `Are you sure you want to permanently remove "${targetLead?.businessName || 'this contact'}" from your Audience database?`,
      confirmText: 'Delete Contact',
      cancelText: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await axios.delete(`${API_URL}/api/leads/${id}`, {
        headers: { 
          userid: user?._id || '',
          useremail: user?.email || ''
        }
      });
      const nextLeads = leads.filter(l => l._id !== id);
      updateLocalLeads(nextLeads);
      setSelectedLeadIds(selectedLeadIds.filter(i => i !== id));
      showToast('Contact removed from database.');
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  // Batch Delete
  const handleBatchDelete = async () => {
    const confirmed = await confirmDialog({
      title: `Delete ${selectedLeadIds.length} Selected Contacts?`,
      message: `Are you sure you want to permanently remove ${selectedLeadIds.length} selected contacts from your workspace? This action cannot be undone.`,
      confirmText: `Delete ${selectedLeadIds.length} Contacts`,
      cancelText: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await axios.post(`${API_URL}/api/leads/batch-delete`, {
        ids: selectedLeadIds
      }, {
        headers: { 
          userid: user?._id || '',
          useremail: user?.email || ''
        }
      });
      const nextLeads = leads.filter(l => !selectedLeadIds.includes(l._id));
      updateLocalLeads(nextLeads);
      setSelectedLeadIds([]);
      showToast(`Removed ${selectedLeadIds.length} contacts from database.`);
    } catch (err) {
      console.error('Failed to batch delete leads:', err);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (isExportLocked) {
      await alertDialog({
        title: 'CSV Data Export Locked on Free Tier',
        message: 'Unlimited CSV & Excel data exports are available on Basic (₹699/mo) and Pro (₹1,999/mo) tiers. Upgrade to download your full verified prospect leads.',
        variant: 'info'
      });
      setUpgradeTab('plans');
      setUpgradeModalOpen(true);
      return;
    }

    const listToExport = selectedLeadIds.length > 0 
      ? leads.filter(l => selectedLeadIds.includes(l._id))
      : sortedAndFilteredContacts;

    if (listToExport.length === 0) {
      await alertDialog({
        title: 'Nothing to Export',
        message: 'No contacts match your current selection or filter criteria.',
        variant: 'warning'
      });
      return;
    }

    const headers = ['Business Name', 'Harvest Date', 'City / Location', 'Email', 'Phone', 'Category', 'Rating', 'Status', 'Tags'];
    const rows = listToExport.map(l => [
      `"${l.businessName || ''}"`,
      `"${formatHarvestDate(l.createdAt || l.harvestedAt || l.created_at || l.timestamp)}"`,
      `"${getLeadCity(l) || ''}"`,
      `"${l.email || ''}"`,
      `"${l.phone || ''}"`,
      `"${l.category || ''}"`,
      `"${l.rating || ''}"`,
      `"${l.status || ''}"`,
      `"${(l.tags || []).join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Strovr_Audience_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic API Base URL (works seamlessly in localhost and on Render)
  const apiBase = API_URL;

  // Test Inbound Form Submission
  const handleTestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id) return;
    setTestSubmitting(true);
    try {
      await axios.post(`${apiBase}/api/leads/form-submit/${user._id}`, {
        ...testSubmission,
        formId: activeForm.id
      });
      setTestSuccess(true);
      fetchLeads(); // refresh real contacts list
      showToast('Form submission received! New lead created.');
      setTimeout(() => {
        setTestSuccess(false);
        setIsTestFormOpen(false);
        setTestSubmission({ name: '', email: '', phone: '', company: '' });
      }, 1500);
    } catch (err) {
      console.error('Test form failed:', err);
      await alertDialog({
        title: 'Submission Error',
        message: 'Form submission failed. Please verify the endpoint and try again.',
        variant: 'error'
      });
    } finally {
      setTestSubmitting(false);
    }
  };

  // Test Universal Webhook Ingestion
  const handleTestWebhookSubmit = async () => {
    if (!user?._id) return;
    setIsTestingWebhook(true);
    try {
      await axios.post(`${apiBase}/api/leads/webhook/${user._id}`, {
        name: 'Sarah Jenkins',
        email: 'sarah.jenkins@nexussolutions.io',
        phone: '+1 (555) 392-8172',
        company: 'Nexus Cloud Solutions',
        category: 'B2B SaaS',
        source: 'Zapier Webhook Test',
        notes: 'Requested product walkthrough via automated webhook zap'
      });
      fetchLeads();
      showToast('Webhook lead ingested successfully! Created in CRM & triggered automations.');
    } catch (err: any) {
      console.error('Webhook test error:', err);
      await alertDialog({
        title: 'Webhook Test Error',
        message: err.response?.data?.error || 'Failed to trigger test webhook.',
        variant: 'error'
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    const webhookUrl = `${apiBase}/api/leads/webhook/${user?._id || 'USER_ID'}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    showToast('Webhook URL copied to clipboard!');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Toggle Form Active/Paused
  const handleToggleFormStatus = (formId: string) => {
    setFormsList(formsList.map(f => f.id === formId ? {
      ...f,
      status: f.status === 'Active' ? 'Paused' : 'Active'
    } : f));
  };

  // Copy embed HTML code with seamless AJAX submission
  const getEmbedHtmlCode = (form: FormTemplate) => {
    const endpoint = `${apiBase}/api/leads/form-submit/${user?._id || 'USER_ID'}`;
    return `<!-- Strovr Inbound Capture Form: ${form.title} -->
<div id="lp-capture-container" style="font-family: system-ui, -apple-system, sans-serif; max-width: 440px; padding: 24px; border-radius: 12px; background: #ffffff; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
  <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #191716;">${form.headline}</h3>
  <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748B;">${form.subheadline}</p>
  <form onsubmit="event.preventDefault(); var b=this.querySelector('button'); b.disabled=true; b.innerText='Submitting...'; fetch('${endpoint}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:this.name.value, email:this.email.value, company:this.company.value, phone:this.phone.value, formId:'${form.id}'})}).then(function(r){return r.json()}).then(function(d){document.getElementById('lp-capture-container').innerHTML='<div style=\\'text-align:center;padding:24px;color:#16a34a;font-weight:600;\\'>&#10004; Thank you! Your request has been received.</div>'}).catch(function(){b.disabled=false; b.innerText='${form.buttonText}'; alert('Submission failed. Please try again.');});" style="display: flex; flex-direction: column; gap: 12px;">
    <input type="text" name="name" placeholder="Full Name" required style="padding: 10px 14px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 14px; outline: none;" />
    <input type="email" name="email" placeholder="Work Email" required style="padding: 10px 14px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 14px; outline: none;" />
    <input type="tel" name="phone" placeholder="Phone or WhatsApp (Optional)" style="padding: 10px 14px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 14px; outline: none;" />
    <input type="text" name="company" placeholder="Company Name" style="padding: 10px 14px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 14px; outline: none;" />
    <button type="submit" style="padding: 12px; background: ${form.themeColor}; color: #ffffff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
      ${form.buttonText}
    </button>
  </form>
</div>`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getEmbedHtmlCode(activeForm));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Metrics
  const totalContacts = leads.length;
  const verifiedEmails = leads.filter(l => Boolean(l.email)).length;
  const phoneContacts = leads.filter(l => Boolean(l.phone)).length;
  const hotLeads = leads.filter(l => l.status === 'Proposal Sent' || l.status === 'Closed Won').length;

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
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audience & CRM Hub</h1>
                <p className="text-slate-500 font-normal text-xs mt-0.5">Manage contacts, push to connected CRMs/Sheets, enrich missing emails, and capture inbound leads.</p>
              </div>

              <div className="flex items-center gap-2.5">
                {activeTab === 'contacts' && (
                  <>
                    {/* Push to Connected App Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsSyncDropdownOpen(prev => !prev)}
                        className="h-8 px-3 bg-blue-50/90 hover:bg-blue-100/80 border border-blue-200 rounded-md font-delight text-xs text-blue-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          {selectedLeadIds.length > 0
                            ? `Push (${selectedLeadIds.length}) to App`
                            : 'Push to Connected App'}
                        </span>
                      </button>

                      {isSyncDropdownOpen && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-40 p-1.5 space-y-1 animate-in fade-in">
                          <div className="px-2 py-1 text-[10px] font-delight font-semibold uppercase text-slate-400 border-b border-slate-100">
                            Connected Sync Targets ({connectedSyncApps.length})
                          </div>
                          {connectedSyncApps.length > 0 ? (
                            connectedSyncApps.map(app => (
                              <button
                                key={app.id}
                                type="button"
                                disabled={syncingAppId === app.id}
                                onClick={() => handlePushToIntegration(app.id, app.name)}
                                className="w-full px-2.5 py-2 text-left rounded-md hover:bg-blue-50/60 text-xs font-delight font-medium text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="font-semibold">{app.name}</span>
                                <span className="text-[10px] text-blue-600 font-bold">
                                  {syncingAppId === app.id ? 'Syncing...' : 'Push →'}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="p-2 text-[11px] text-slate-500">
                              No CRM or Spreadsheet connected yet.
                            </div>
                          )}
                          <div className="pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => navigate('/integrations')}
                              className="w-full px-2.5 py-1.5 text-left rounded-md hover:bg-slate-50 text-[11px] font-delight font-medium text-slate-500 hover:text-blue-600 flex items-center justify-between cursor-pointer"
                            >
                              <span>+ Connect Sheets / CRM</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handleExportCSV}
                      className={`h-8 px-3 rounded-md font-delight font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isExportLocked
                          ? 'bg-slate-100 border border-slate-200 text-slate-400 opacity-60 hover:opacity-85'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                      title={isExportLocked ? 'CSV Export (Requires Basic or Pro tier)' : 'Export to CSV'}
                    >
                      {isExportLocked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Export CSV</span>
                      {isExportLocked && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider">
                          BASIC
                        </span>
                      )}
                    </button>
                  </>
                )}

                <button 
                  onClick={() => {
                    if (activeTab === 'contacts') setIsAddContactOpen(true);
                    else if (activeTab === 'segments') setIsCreateSegmentOpen(true);
                    else setIsFormModalOpen(true);
                  }}
                  className="h-8 px-3.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-900"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {activeTab === 'contacts' && 'Add Contact'}
                    {activeTab === 'segments' && 'Create Segment'}
                    {activeTab === 'forms' && 'Create Form'}
                  </span>
                </button>
              </div>
            </div>

            {/* Unified 4-Column Divided Audience Ledger */}
            <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Total Audience</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight tabular-nums">{totalContacts}</h3>
                </div>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Email Verified</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight tabular-nums">{verifiedEmails}</h3>
                </div>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">WhatsApp Ready</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight tabular-nums">{phoneContacts}</h3>
                </div>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider">Hot Pipeline</p>
                  <h3 className="text-xl font-delight font-bold text-slate-900 mt-1 tracking-tight tabular-nums">{hotLeads}</h3>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-200">
              <button 
                onClick={() => { setActiveTab('contacts'); setStageFilter('All'); }}
                className={`pb-2.5 text-xs font-delight transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${activeTab === 'contacts' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>All Contacts ({totalContacts})</span>
              </button>
              <button 
                onClick={() => setActiveTab('segments')}
                className={`pb-2.5 text-xs font-delight transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${activeTab === 'segments' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Segments & Filters</span>
              </button>
              <button 
                onClick={() => setActiveTab('forms')}
                className={`pb-2.5 text-xs font-delight transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${activeTab === 'forms' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>Inbound Forms ({formsList.length})</span>
              </button>
            </div>

            {/* TAB 1: ALL CONTACTS */}
            {activeTab === 'contacts' && (
              <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
                
                {/* Search & Filter Bar */}
                <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, phone, tag..." 
                      className="w-full h-8 pl-8 pr-3 text-xs font-delight font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 transition-colors shadow-2xs placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {selectedLeadIds.length > 0 && (
                      <button 
                        onClick={handleBatchDelete}
                        className="h-8 px-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-delight font-medium hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete ({selectedLeadIds.length})</span>
                      </button>
                    )}

                    {/* Multi-Way Sort Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <select 
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                        className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 outline-none cursor-pointer"
                        title="Sort audience list"
                      >
                        <option value="date_desc">Sort: Harvest Date (Newest)</option>
                        <option value="date_asc">Sort: Harvest Date (Oldest)</option>
                        <option value="city_asc">Sort: City / Location (A-Z)</option>
                        <option value="city_desc">Sort: City / Location (Z-A)</option>
                        <option value="name_asc">Sort: Business Name (A-Z)</option>
                        <option value="name_desc">Sort: Business Name (Z-A)</option>
                        <option value="rating_desc">Sort: Rating (Highest First)</option>
                        <option value="rating_asc">Sort: Rating (Lowest First)</option>
                        <option value="category_asc">Sort: Category (A-Z)</option>
                        <option value="category_desc">Sort: Category (Z-A)</option>
                        <option value="status_asc">Sort: Pipeline Stage (A-Z)</option>
                      </select>
                    </div>

                    {/* Stage Filter Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select 
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="All">All Stages</option>
                        <option value="New">Stage: New</option>
                        <option value="WhatsApp Contacted">Stage: WhatsApp Contacted</option>
                        <option value="Email Verified & Captured">Stage: Email Captured</option>
                        <option value="Proposal Sent">Stage: Proposal Sent</option>
                        <option value="Closed Won">Stage: Closed Won</option>
                        <option value="has_email">Filter: Has Email</option>
                        <option value="has_phone">Filter: Has Phone</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contacts Table */}
                {sortedAndFilteredContacts.length === 0 ? (
                  <div className="p-12 text-center space-y-3 font-delight font-medium">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">No contacts found</h3>
                      <p className="text-slate-500 text-xs max-w-sm mx-auto">
                        {searchQuery ? 'No contacts match your active search filters.' : 'Your audience is currently empty. Add contacts manually or run the Lead Finder to scrape prospects.'}
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsAddContactOpen(true)}
                      className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors cursor-pointer border border-slate-900"
                    >
                      Add First Contact
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-delight font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3.5 w-10">
                            <input 
                              type="checkbox" 
                              checked={selectedLeadIds.length === sortedAndFilteredContacts.length && sortedAndFilteredContacts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedLeadIds(sortedAndFilteredContacts.map(l => l._id));
                                else setSelectedLeadIds([]);
                              }}
                              className="w-3.5 h-3.5 rounded-sm border-slate-300 text-accent cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => toggleSortField('name')}
                              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase cursor-pointer group"
                            >
                              <span>Contact / Business</span>
                              {renderSortIcon('name')}
                            </button>
                          </th>
                          <th className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => toggleSortField('date')}
                              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase cursor-pointer group"
                            >
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>Harvest Date</span>
                              {renderSortIcon('date')}
                            </button>
                          </th>
                          <th className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => toggleSortField('city')}
                              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase cursor-pointer group"
                            >
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>City / Location</span>
                              {renderSortIcon('city')}
                            </button>
                          </th>
                          <th className="py-2.5 px-3.5">Email</th>
                          <th className="py-2.5 px-3.5">Phone</th>
                          <th className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => toggleSortField('category')}
                              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase cursor-pointer group"
                            >
                              <span>Category</span>
                              {renderSortIcon('category')}
                            </button>
                          </th>
                          <th className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => toggleSortField('rating')}
                              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase cursor-pointer group"
                            >
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                              <span>Rating</span>
                              {renderSortIcon('rating')}
                            </button>
                          </th>
                          <th className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => toggleSortField('status')}
                              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors uppercase cursor-pointer group"
                            >
                              <span>Stage &amp; Sync</span>
                              {renderSortIcon('status')}
                            </button>
                          </th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedAndFilteredContacts.map(lead => (
                          <tr key={lead._id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-3 px-3.5">
                              <input 
                                type="checkbox" 
                                checked={selectedLeadIds.includes(lead._id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedLeadIds([...selectedLeadIds, lead._id]);
                                  else setSelectedLeadIds(selectedLeadIds.filter(i => i !== lead._id));
                                }}
                                className="w-3.5 h-3.5 rounded-sm border-slate-300 text-accent cursor-pointer"
                              />
                            </td>

                            {/* Contact / Business */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-sm bg-slate-100 text-slate-700 flex items-center justify-center font-delight font-bold text-xs uppercase flex-shrink-0 border border-slate-200">
                                  {(lead.businessName || 'C').charAt(0)}
                                </div>
                                <div className="min-w-0 max-w-[240px] sm:max-w-[300px]">
                                  <div className="font-bold text-slate-900 break-words whitespace-normal leading-snug tracking-tight">{lead.businessName || 'Unnamed Contact'}</div>
                                  {lead.source && (
                                    <div className="text-[10px] text-slate-400 font-delight font-normal flex items-center gap-1 mt-0.5">
                                      <span className="bg-slate-100 text-slate-600 px-1 rounded-sm border border-slate-200">{lead.source}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Harvest Date */}
                            <td className="py-3 px-3.5 font-delight text-slate-700 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-xs">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-800">{formatHarvestDate(lead.createdAt || lead.harvestedAt || lead.created_at || lead.timestamp)}</span>
                              </div>
                            </td>

                            {/* City / Location */}
                            <td className="py-3 px-3.5 font-delight text-slate-700">
                              <div className="flex items-center gap-1.5 text-xs max-w-[170px]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-800 truncate" title={getLeadCity(lead)}>
                                  {getLeadCity(lead) || 'Local'}
                                </span>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3 px-3.5 font-delight font-medium">
                              {lead.email ? (
                                <div className="flex items-center gap-1.5 group/email">
                                  <a href={`mailto:${lead.email}`} className="text-slate-800 hover:text-accent hover:underline flex items-center gap-1 font-medium">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate max-w-[180px]">{lead.email}</span>
                                  </a>
                                  <button 
                                    onClick={() => setEditingContact({ ...lead })}
                                    className="opacity-0 group-hover/email:opacity-100 text-slate-400 hover:text-slate-900 p-1 transition-opacity cursor-pointer"
                                    title="Edit email"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => setEditingContact({ ...lead })}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                                    title="Add email manually"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Phone */}
                            <td className="py-3 px-3.5 font-delight font-medium whitespace-nowrap">
                              {lead.phone ? (
                                <a 
                                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{lead.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300 italic text-[11px]">No phone</span>
                              )}
                            </td>

                            {/* Category */}
                            <td className="py-3 px-3.5 font-medium text-slate-600 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-200 text-[10px] font-delight font-medium text-slate-600">
                                {lead.category || 'General'}
                              </span>
                            </td>

                            {/* Rating */}
                            <td className="py-3 px-3.5 font-delight whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                                <span className="font-bold text-slate-800 text-xs">{lead.rating ? Number(lead.rating).toFixed(1) : 'N/A'}</span>
                              </div>
                            </td>

                            {/* Stage & Sync */}
                            <td className="py-3 px-3.5 font-delight font-medium">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-delight font-medium border ${
                                  lead.status === 'Closed Won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  lead.status === 'Proposal Sent' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  lead.status === 'WhatsApp Contacted' ? 'bg-green-50 text-green-700 border-green-200' :
                                  lead.status === 'Email Verified & Captured' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {lead.status || 'New'}
                                </span>
                                {Array.isArray(lead.syncedTo) && lead.syncedTo.map((appBadge: string) => (
                                  <span
                                    key={appBadge}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 text-[9px] font-delight font-bold"
                                    title={`Synced to ${appBadge}`}
                                  >
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>{appBadge}</span>
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                                <button 
                                  onClick={() => setEditingContact({ ...lead })}
                                  title="Edit Contact & Email"
                                  className="w-6 h-6 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors text-slate-600 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => navigate('/outreach')}
                                  title="Send Outreach"
                                  className="w-6 h-6 rounded-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors text-slate-600 cursor-pointer"
                                >
                                  <Send className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteContact(lead._id)}
                                  title="Delete"
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

            {/* TAB 2: SEGMENTS & TAGS */}
            {activeTab === 'segments' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customSegments.map(seg => {
                    let count = 0;
                    if (seg.filterKey === 'has_email') count = verifiedEmails;
                    else if (seg.filterKey === 'has_phone') count = phoneContacts;
                    else if (seg.filterKey === 'hot_leads') count = hotLeads;
                    else if (seg.filterKey === 'new_leads') count = leads.filter(l => l.status === 'New').length;
                    else count = leads.filter(l => (l.category || '').toLowerCase().includes(seg.title.toLowerCase())).length;

                    return (
                      <div 
                        key={seg.title}
                        onClick={() => {
                          setStageFilter(seg.filterKey);
                          setActiveTab('contacts');
                        }}
                        className="p-5 bg-white border border-slate-200 rounded-md hover:border-slate-400 transition-colors cursor-pointer group space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm group-hover:text-accent transition-colors tracking-tight">{seg.title}</h3>
                              <p className="text-[11px] font-delight font-normal text-slate-400">Click to filter contacts</p>
                            </div>
                          </div>
                          <span className="text-xs font-delight font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm text-slate-700">
                            {count} contacts
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-normal leading-relaxed">{seg.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: SIGN-UP FORMS & EMBEDS */}
            {activeTab === 'forms' && (
              <div className="space-y-4">
                {/* Universal Inbound Webhook Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#191716] flex items-center justify-center text-white shrink-0 shadow-xs">
                        <Webhook className="w-5 h-5 text-[#E07A5F]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Universal Inbound Webhook</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active & Ready
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Stream inbound leads automatically into Strovr CRM from Zapier, Make, Typeform, Webflow, Calendly, or custom apps.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTestWebhookSubmit}
                        disabled={isTestingWebhook}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin text-amber-500' : 'text-amber-500'}`} />
                        <span>{isTestingWebhook ? 'Sending Ping...' : 'Test Webhook Ping'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 rounded text-center shrink-0">
                      POST
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={`${apiBase}/api/leads/webhook/${user?._id || 'USER_ID'}`}
                      className="flex-1 bg-transparent text-xs font-mono text-slate-700 outline-none select-all px-1"
                    />
                    <button
                      onClick={handleCopyWebhookUrl}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium flex items-center justify-center gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Create New Form Card Trigger */}
                  <div 
                    onClick={() => {
                      setActiveForm({
                        id: `form_${Date.now()}`,
                        title: 'New Custom Inbound Form',
                        type: 'Embedded',
                        submissions: 0,
                        status: 'Active',
                        headline: 'Join Our Exclusive Community',
                        subheadline: 'Enter your credentials to receive immediate VIP access.',
                        buttonText: 'Submit Request',
                        themeColor: '#191716'
                      });
                      setIsFormModalOpen(true);
                    }}
                    className="border border-dashed border-slate-300 hover:border-slate-400 rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-white hover:bg-slate-50/50 transition-colors min-h-[240px] group"
                  >
                    <h3 className="font-bold text-slate-900 text-sm mb-1 tracking-tight">+ Create New Form</h3>
                    <p className="text-xs text-slate-500 font-normal">Popup, Embedded, or Landing Page</p>
                  </div>

                  {/* Existing Active Forms */}
                  {formsList.map(form => (
                    <div 
                      key={form.id} 
                      className="bg-white border border-slate-200 rounded-md overflow-hidden hover:border-slate-400 transition-colors flex flex-col min-h-[240px]"
                    >
                      {/* Visual Header */}
                      <div className="h-28 bg-slate-50 p-4 flex flex-col justify-between border-b border-slate-200 relative">
                        <div className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-delight font-medium border ${
                            form.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {form.status}
                          </span>
                          <span className="text-[10px] font-delight font-normal text-slate-500 bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                            {form.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-delight font-medium text-xs text-slate-600">
                          <LayoutTemplate className="w-4 h-4 text-slate-400" />
                          <span>{getFormSubmissionsCount(form.id)} Submissions</span>
                        </div>
                      </div>

                      {/* Content & Actions */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-xs text-slate-900 mb-1 tracking-tight">{form.title}</h3>
                          <p className="text-xs text-slate-500 line-clamp-2">{form.headline}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <button 
                            onClick={() => {
                              setActiveForm(form);
                              setIsEmbedCodeOpen(true);
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-delight font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Code className="w-3 h-3" /> Code
                          </button>

                          <button 
                            onClick={() => {
                              setActiveForm(form);
                              setIsTestFormOpen(true);
                            }}
                            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-delight font-medium flex items-center gap-1 cursor-pointer border border-slate-900"
                          >
                            <Eye className="w-3 h-3" /> Test
                          </button>

                          <button 
                            onClick={() => {
                              setActiveForm(form);
                              setIsFormModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs font-delight font-medium text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                          >
                            Edit Design
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ================= MODAL: ADD CONTACT ================= */}
      {isAddContactOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Add New Contact</h3>
              </div>
              <button onClick={() => setIsAddContactOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Business / Full Name *</label>
                <input 
                  type="text"
                  required
                  value={newContact.businessName}
                  onChange={(e) => setNewContact({ ...newContact, businessName: e.target.value })}
                  placeholder="e.g. Apex Dynamics or John Doe"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Email Address</label>
                  <input 
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input 
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Category / Niche</label>
                  <input 
                    type="text"
                    value={newContact.category}
                    onChange={(e) => setNewContact({ ...newContact, category: e.target.value })}
                    placeholder="e.g. Dental Clinic"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">City / Location</label>
                  <input 
                    type="text"
                    value={newContact.location}
                    onChange={(e) => setNewContact({ ...newContact, location: e.target.value, city: e.target.value })}
                    placeholder="e.g. Austin, TX"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Pipeline Stage</label>
                  <select 
                    value={newContact.status}
                    onChange={(e) => setNewContact({ ...newContact, status: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none bg-white cursor-pointer"
                  >
                    <option value="New">New</option>
                    <option value="WhatsApp Contacted">WhatsApp Contacted</option>
                    <option value="Email Verified & Captured">Email Verified</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Closed Won">Closed Won</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Segment Tag</label>
                  <input 
                    type="text"
                    value={newContact.tags}
                    onChange={(e) => setNewContact({ ...newContact, tags: e.target.value })}
                    placeholder="e.g. VIP, Inbound"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button 
                  type="button"
                  onClick={() => setIsAddContactOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-delight font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingContact}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 border border-slate-900 cursor-pointer"
                >
                  {isSubmittingContact ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE / EDIT FORM ================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Design Inbound Form</h3>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Form Internal Title</label>
                <input 
                  type="text"
                  value={activeForm.title}
                  onChange={(e) => setActiveForm({ ...activeForm, title: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Form Type</label>
                  <select 
                    value={activeForm.type}
                    onChange={(e: any) => setActiveForm({ ...activeForm, type: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none bg-white cursor-pointer"
                  >
                    <option value="Embedded">Embedded HTML</option>
                    <option value="Popup">Exit-Intent Popup</option>
                    <option value="Landing Link">Standalone Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Accent Color</label>
                  <input 
                    type="color"
                    value={activeForm.themeColor}
                    onChange={(e) => setActiveForm({ ...activeForm, themeColor: e.target.value })}
                    className="w-full h-8 p-0.5 border border-slate-200 rounded-md cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Headline Text</label>
                <input 
                  type="text"
                  value={activeForm.headline}
                  onChange={(e) => setActiveForm({ ...activeForm, headline: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Subheadline / Pitch</label>
                <textarea 
                  rows={2}
                  value={activeForm.subheadline}
                  onChange={(e) => setActiveForm({ ...activeForm, subheadline: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Button Text</label>
                <input 
                  type="text"
                  value={activeForm.buttonText}
                  onChange={(e) => setActiveForm({ ...activeForm, buttonText: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium focus:border-slate-400 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button 
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-delight font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    const exists = formsList.some(f => f.id === activeForm.id);
                    if (exists) {
                      setFormsList(formsList.map(f => f.id === activeForm.id ? activeForm : f));
                    } else {
                      setFormsList([...formsList, activeForm]);
                    }
                    setIsFormModalOpen(false);
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md text-xs font-delight font-medium hover:bg-slate-800 border border-slate-900 cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EMBED CODE ================= */}
      {isEmbedCodeOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Embed Form on Your Website</h3>
                  <p className="text-[11px] font-delight font-normal text-slate-400">Paste this HTML snippet into any Webflow, WordPress, Shopify, or React app.</p>
                </div>
              </div>
              <button onClick={() => setIsEmbedCodeOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-delight font-normal rounded-md overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                {getEmbedHtmlCode(activeForm)}
              </pre>
              <button 
                onClick={handleCopyCode}
                className="absolute top-3 right-3 px-2.5 py-1 bg-white text-slate-900 border border-slate-200 rounded-md font-delight font-medium text-xs flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 font-delight font-normal">
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Inbound endpoint active
              </span>
              <button 
                onClick={() => setIsEmbedCodeOpen(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md text-xs font-delight font-medium hover:bg-slate-800 border border-slate-900 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TEST LIVE FORM ================= */}
      {isTestFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Test Live Form Submission</h3>
              </div>
              <button onClick={() => setIsTestFormOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {testSuccess ? (
              <div className="py-6 text-center space-y-2 font-delight font-medium">
                <h4 className="text-sm font-bold text-emerald-700 tracking-tight">Lead Captured Successfully!</h4>
                <p className="text-xs text-slate-500">Contact has been added to your Strovr database.</p>
              </div>
            ) : (
              <form onSubmit={handleTestFormSubmit} className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-0.5">
                  <h4 className="font-bold text-xs text-slate-900 tracking-tight">{activeForm.headline}</h4>
                  <p className="text-[11px] text-slate-500">{activeForm.subheadline}</p>
                </div>

                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={testSubmission.name}
                    onChange={(e) => setTestSubmission({ ...testSubmission, name: e.target.value })}
                    placeholder="Jane Smith"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Work Email *</label>
                  <input 
                    type="email" 
                    required
                    value={testSubmission.email}
                    onChange={(e) => setTestSubmission({ ...testSubmission, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Company / Organization</label>
                  <input 
                    type="text" 
                    value={testSubmission.company}
                    onChange={(e) => setTestSubmission({ ...testSubmission, company: e.target.value })}
                    placeholder="Apex Tech Ventures"
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button 
                    type="submit"
                    disabled={testSubmitting}
                    style={{ backgroundColor: activeForm.themeColor }}
                    className="w-full h-8 text-white rounded-md font-delight font-medium text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {testSubmitting ? 'Capturing Lead...' : activeForm.buttonText}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE CUSTOM SEGMENT ================= */}
      {isCreateSegmentOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Create Audience Segment</h3>
              </div>
              <button onClick={() => setIsCreateSegmentOpen(false)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Segment Name *</label>
                <input 
                  type="text"
                  required
                  value={newSegmentTitle}
                  onChange={(e) => setNewSegmentTitle(e.target.value)}
                  placeholder="e.g. Decision Makers or High LTV"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Description / Intent</label>
                <textarea 
                  rows={2}
                  value={newSegmentDesc}
                  onChange={(e) => setNewSegmentDesc(e.target.value)}
                  placeholder="Describe what prospects qualify for this cohort..."
                  className="w-full p-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button 
                  type="button"
                  onClick={() => setIsCreateSegmentOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-delight font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (!newSegmentTitle) return;
                    setCustomSegments([
                      ...customSegments,
                      {
                        title: newSegmentTitle,
                        desc: newSegmentDesc || 'Custom filtered user cohort.',
                        filterKey: newSegmentTitle.toLowerCase().replace(/\s+/g, '_')
                      }
                    ]);
                    setIsCreateSegmentOpen(false);
                    setNewSegmentTitle('');
                    setNewSegmentDesc('');
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors border border-slate-900 cursor-pointer"
                >
                  Create Segment Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT CONTACT (ADD/UPDATE EMAIL) ================= */}
      {editingContact && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Edit Contact & Direct Email</h3>
                  <p className="text-[11px] font-delight font-normal text-slate-400">Update verified contact coordinates</p>
                </div>
              </div>
              <button onClick={() => setEditingContact(null)} className="w-7 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditContact} className="space-y-3">
              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Business / Contact Name *</label>
                <textarea 
                  rows={2}
                  required
                  value={editingContact.businessName || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, businessName: e.target.value })}
                  placeholder="e.g. Digital Keddy"
                  className="w-full p-2 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400 leading-snug"
                />
                <span className="text-[10px] text-slate-400 font-delight font-normal">
                  Tip: Shorten long Google Places keyword titles to the clean brand name.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">
                  Direct Email Address
                  <span className="text-slate-400 font-normal ml-1 font-delight text-[10px]">(Saved securely in your contacts)</span>
                </label>
                <input 
                  type="email"
                  value={editingContact.email || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  placeholder="e.g. founder@company.com"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Phone / WhatsApp</label>
                  <input 
                    type="text"
                    value={editingContact.phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Category / Tag</label>
                  <input 
                    type="text"
                    value={editingContact.category || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, category: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Website URL</label>
                <input 
                  type="url"
                  value={editingContact.website || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, website: e.target.value })}
                  placeholder="https://company.com"
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">City / Location</label>
                  <input 
                    type="text"
                    value={editingContact.location || editingContact.city || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, location: e.target.value, city: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1">Pipeline Stage</label>
                  <select
                    value={editingContact.status || 'New'}
                    onChange={(e) => setEditingContact({ ...editingContact, status: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-md text-xs font-delight font-medium outline-none focus:border-slate-400 bg-white cursor-pointer"
                  >
                    <option value="New">New</option>
                    <option value="WhatsApp Contacted">WhatsApp Contacted</option>
                    <option value="Replied / Awaiting Email">Replied / Awaiting Email</option>
                    <option value="Email Verified & Captured">Email Verified & Captured</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Closed Won">Closed Won</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button 
                  type="button" 
                  onClick={() => setEditingContact(null)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 font-delight font-medium text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingEdit}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-md font-delight font-medium text-xs hover:bg-slate-800 transition-colors disabled:opacity-50 border border-slate-900 cursor-pointer"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Audience;
