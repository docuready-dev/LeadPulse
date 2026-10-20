import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { alertDialog } from '../components/AppConfirmModal';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import LeadFinderWizard from '../components/LeadFinderWizard';
import SerpApiConnectModal from '../components/SerpApiConnectModal';
import { 
  Building2, Phone, MapPin, Star, Globe, 
  ExternalLink, ArrowRight, Search, Users2, Check,
  Edit3, X, Mail, Sparkles, Compass
} from 'lucide-react';

const LeadFinder = () => {
  const { user, integrations, syncLeadsToIntegration, enrichLeadViaIntegration } = useStore();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // SerpApi Engine State
  const [isSerpModalOpen, setIsSerpModalOpen] = useState(false);
  const [serpApiStatus, setSerpApiStatus] = useState<{ isConnected: boolean; account?: any } | null>(null);

  const isFree = (user?.plan || 'free').toLowerCase() === 'free';

  const fetchSerpStatus = async () => {
    if (!user?._id && !user?.email) return;
    const vaultKey = user?.email || user?._id || 'global';
    const storedVault = localStorage.getItem(`strovr_serpapi_vault_${vaultKey}`) || 
                        localStorage.getItem('strovr_serpapi_vault_global');
    try {
      const res = await axios.get(`${API_URL}/api/leads/serpapi/status`, {
        headers: { 
          userid: user._id || '',
          useremail: user.email || ''
        }
      });
      if (res.data?.isConnected) {
        setSerpApiStatus(res.data);
      } else if (storedVault) {
        try {
          const reRes = await axios.post(
            `${API_URL}/api/leads/serpapi/connect`,
            { apiKey: storedVault },
            { headers: { userid: user._id || '', useremail: user.email || '' } }
          );
          if (reRes.data?.success) {
            setSerpApiStatus({ isConnected: true, account: reRes.data.account });
          } else {
            setSerpApiStatus(res.data);
          }
        } catch {
          setSerpApiStatus(res.data);
        }
      } else {
        setSerpApiStatus(res.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSerpStatus();
  }, [user?._id, user?.email]);

  // Integration Sync & Enrich state
  const [isSyncDropdownOpen, setIsSyncDropdownOpen] = useState(false);
  const [syncingAppId, setSyncingAppId] = useState<string | null>(null);
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const connectedSyncApps = integrations.filter(
    a => a.connected && ['CRM', 'Productivity', 'Marketing & Forms', 'Data & Warehouses'].includes(a.category)
  );
  const activeEnrichApp = integrations.find(
    a => a.connected && ['apollo', 'firecrawl', 'linkedin'].includes(a.id)
  ) || { id: 'apollo', name: 'Apollo' };

  // Edit contact modal state
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Helper deduplication merge
  const mergeLeads = (localList: any[], serverList: any[]) => {
    const map = new Map<string, any>();
    for (const l of localList) {
      if (l._id) map.set(l._id, l);
      const nameKey = (l.businessName || '').toLowerCase().trim();
      if (nameKey && l.email) map.set(`${nameKey}__${l.email.toLowerCase().trim()}`, l);
      if (nameKey && l.phone) map.set(`${nameKey}__${l.phone.replace(/[^0-9]/g, '')}`, l);
    }
    for (const s of serverList) {
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

  const updateCache = (list: any[]) => {
    setLeads(list);
    try {
      if (user?.email) localStorage.setItem(`strovr_leads_cache_${user.email}`, JSON.stringify(list));
      if (user?._id) localStorage.setItem(`strovr_leads_cache_${user._id}`, JSON.stringify(list));
    } catch {}
  };

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

      if (serverLeads.length === 0 && localCached.length > 0) {
        // Auto-rehydrate Render server
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
            updateCache(syncRes.data.leads);
            return;
          }
        } catch {}
        updateCache(localCached);
        return;
      }

      const merged = mergeLeads(localCached, serverLeads);
      updateCache(merged);

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
      console.error('Failed to fetch harvested leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Immediate hydration from cache
    try {
      const raw = (user?.email && localStorage.getItem(`strovr_leads_cache_${user.email}`)) ||
                  (user?._id && localStorage.getItem(`strovr_leads_cache_${user._id}`));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setLeads(parsed);
      }
    } catch {}
    fetchLeads();
  }, [user?._id, user?.email]);

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead?._id || !user?._id) return;
    setIsSavingEdit(true);
    try {
      await axios.patch(`${API_URL}/api/leads/${editingLead._id}`, {
        businessName: editingLead.businessName,
        email: editingLead.email || '',
        phone: editingLead.phone || '',
        category: editingLead.category || 'General',
        location: editingLead.location || '',
        website: editingLead.website || '',
        status: editingLead.status || 'New'
      }, {
        headers: { 
          userid: user._id || '',
          useremail: user.email || ''
        }
      });

      const nextLeads = leads.map(l => l._id === editingLead._id ? { ...l, ...editingLead } : l);
      updateCache(nextLeads);
      setEditingLead(null);
    } catch (err) {
      console.error('Failed to update lead:', err);
      await alertDialog({
        title: 'Update Error',
        message: 'Failed to update contact details. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredLeads = leads.filter(l => 
    (l.businessName || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (l.category || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (l.location || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (l.phone || '').includes(filterQuery)
  );

  const handlePushHarvestToIntegration = async (appId: string, appName: string) => {
    const targetIds = filteredLeads.map(l => l._id);
    if (targetIds.length === 0) {
      showToast('No harvested leads available to sync.');
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
      showToast(result.deliveryNote || `Pushed ${result.syncedCount} harvested lead(s) to ${result.appName} [200 OK]`);
    } else {
      showToast(`Failed to sync leads to ${appName}.`);
    }
  };

  const handleEnrichHarvestedLead = async (lead: any) => {
    setEnrichingLeadId(lead._id);
    const updatedLead = await enrichLeadViaIntegration(lead._id, activeEnrichApp.id);
    setEnrichingLeadId(null);
    if (updatedLead) {
      setLeads(prev => prev.map(l => l._id === lead._id ? { ...l, ...updatedLead } : l));
      showToast(`Enriched ${lead.businessName} (${updatedLead.email}) via ${activeEnrichApp.name} [200 OK]`);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 flex justify-center custom-scrollbar">
          <div className="max-w-[1240px] w-full space-y-8 pb-16">
            
            {toastMessage && (
              <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-md shadow-xl border border-slate-800 text-xs font-delight font-medium flex items-center gap-2 animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-charcoal tracking-tight">Lead Finder & Geo-Search</h1>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Harvest verified public listings, enrich missing decision-maker emails, and push directly to connected CRMs/Sheets.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsSerpModalOpen(true)}
                  className={`px-3 py-2 rounded-md border text-xs font-medium flex items-center gap-2 shadow-2xs transition-colors cursor-pointer ${
                    serpApiStatus?.isConnected
                      ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-800'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  title="SerpApi Google Maps extraction engine settings"
                >
                  <Compass className={`w-4 h-4 ${serpApiStatus?.isConnected ? 'text-emerald-600' : 'text-slate-600'}`} />
                  <span>
                    {serpApiStatus?.isConnected ? 'SerpApi Engine: Active' : 'Connect SerpApi'}
                  </span>
                  {serpApiStatus?.isConnected && !isFree && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-emerald-200/70 text-emerald-900 rounded">
                      {serpApiStatus.account?.plan_name || 'Free'} Tier
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => navigate('/audience')}
                  className="px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <Users2 className="w-4 h-4 text-blue-600" />
                  <span>Audience &amp; Contacts Hub &rarr;</span>
                </button>
              </div>
            </div>

            {/* Extraction Wizard */}
            <LeadFinderWizard onHarvestStarted={fetchLeads} />

            {/* HARVESTED SEARCH RESULTS */}
            <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider font-delight text-slate-500">Harvested Listings</h2>
                    <span className="px-2 py-0.5 bg-slate-900 text-white rounded-sm text-[10px] font-delight font-bold">
                      {filteredLeads.length} Total
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Multi-line name wrapping enabled. Push harvested batches to connected apps or enrich emails in 1 click.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Push Harvest to Connected App */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSyncDropdownOpen(prev => !prev)}
                      className="h-8 px-3 bg-blue-50/90 hover:bg-blue-100/80 border border-blue-200 rounded-md font-delight text-xs text-blue-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Push to Connected App</span>
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
                              onClick={() => handlePushHarvestToIntegration(app.id, app.name)}
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

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Filter harvested listings..."
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium outline-none focus:border-slate-400 w-56 font-sans text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center text-xs text-gray-400 font-bold">
                  Loading harvested search listings...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <p className="text-xs font-bold text-gray-500">No leads found for this search yet.</p>
                  <p className="text-[11px] text-gray-400">Launch the Harvest Wizard above to scrape verified business listings.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider font-delight">
                      <tr>
                        <th className="py-3 px-5 min-w-[260px] max-w-[380px]">Business Name, Website &amp; Email</th>
                        <th className="py-3 px-4">Direct Phone / WhatsApp</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Rating</th>
                        <th className="py-3 px-4">Status &amp; Sync</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLeads.map((lead) => (
                        <tr key={lead._id} className="hover:bg-indigo-50/30 transition-colors">
                          {/* Business Name with natural wrapping */}
                          <td className="py-3.5 px-5 min-w-[260px] max-w-[380px]">
                            <div className="font-bold text-slate-900 text-xs break-words whitespace-normal leading-snug tracking-tight">
                              {lead.businessName}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {lead.website ? (
                                <a 
                                  href={lead.website} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                >
                                  <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No website</span>
                              )}

                              {lead.email ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-delight font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/70">
                                  <Mail className="w-2.5 h-2.5" />
                                  <span>{lead.email}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={enrichingLeadId === lead._id}
                                  onClick={() => handleEnrichHarvestedLead(lead)}
                                  className="inline-flex items-center gap-1 text-[10px] font-delight font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-1.5 py-0.2 rounded border border-violet-200/80 cursor-pointer transition-colors"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-violet-600" />
                                  <span>{enrichingLeadId === lead._id ? 'Enriching...' : `Enrich (${activeEnrichApp.name})`}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-semibold text-charcoal">
                            {lead.phone ? (
                              <a 
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-emerald-700 hover:underline flex items-center gap-1.5"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{lead.phone}</span>
                              </a>
                            ) : (
                              <span className="text-gray-300 italic text-[11px]">No phone listed</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-bold">
                              {lead.category || 'Local B2B'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-gray-600 text-[11px] font-medium">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{lead.location}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              <span>{lead.rating || '4.8'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="px-2 py-0.5 rounded-sm text-[10px] font-delight font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                {lead.status || 'New'}
                              </span>
                              {Array.isArray(lead.syncedTo) && lead.syncedTo.map((appBadge: string) => (
                                <span
                                  key={appBadge}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-delight font-bold"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>{appBadge}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingLead({ ...lead })}
                                className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-delight font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Edit contact name & coordinates"
                              >
                                <Edit3 className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>
                              
                              <button
                                onClick={() => navigate('/audience')}
                                className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-delight font-medium transition-colors inline-flex items-center gap-1 cursor-pointer border border-slate-900"
                                title="Manage in Contacts Hub"
                              >
                                <span>Contacts</span>
                                <ArrowRight className="w-3 h-3" />
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

          </div>
        </main>
      </div>

      {/* ================= MODAL: EDIT HARVESTED LEAD ================= */}
      {editingLead && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Edit Contact Details</h3>
                  <p className="text-[11px] font-delight font-normal text-slate-400">Shorten long titles or add direct contact info</p>
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
                  Tip: Shorten long Google Places keyword titles to the core brand name.
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
                  <option value="New">New</option>
                  <option value="WhatsApp Contacted">WhatsApp Contacted</option>
                  <option value="Replied / Awaiting Email">Replied / Awaiting Email</option>
                  <option value="Email Verified & Captured">Email Verified & Captured</option>
                  <option value="Proposal Sent">Proposal Sent</option>
                  <option value="Closed Won">Closed Won</option>
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
                  {isSavingEdit ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SerpApi Engine Connection Modal */}
      <SerpApiConnectModal
        isOpen={isSerpModalOpen}
        onClose={() => setIsSerpModalOpen(false)}
        user={user}
        onConnected={() => fetchSerpStatus()}
      />
    </div>
  );
};

export default LeadFinder;
