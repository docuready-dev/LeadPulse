import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { alertDialog } from './AppConfirmModal';
import axios from 'axios';
import { 
  MapPin, Tag, Sparkles, ArrowRight, ArrowLeft, 
  Clock, Compass, Loader2,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  RefreshCw, Check, Layers
} from 'lucide-react';

import SerpApiConnectModal from './SerpApiConnectModal';

interface WizardProps {
  onHarvestStarted: () => void;
}

interface ActiveJobInfo {
  id: string;
  keyword: string;
  location: string;
  scope: 'quick' | 'deep';
  limit: number;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  stageMessage: string;
  leadsFound: number;
  error?: string;
}

const LeadFinderWizard = ({ onHarvestStarted }: WizardProps) => {
  const { user, setUser, updateCredits, refreshUserProfile, setUpgradeModalOpen, setUpgradeTab } = useStore();

  // Step state: 1 (Location) -> 2 (Keyword) -> 3 (Scope Proficiency)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [location, setLocation] = useState((user as any)?.location || (user as any)?.city || '');
  const [keyword, setKeyword] = useState(user?.niche || user?.field_of_work || user?.target_audience || '');
  const [scope, setScope] = useState<'quick' | 'deep'>('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // SerpApi Connection Modal & Status State
  const [isSerpModalOpen, setIsSerpModalOpen] = useState(false);
  const [serpApiStatus, setSerpApiStatus] = useState<{ isConnected: boolean; account?: any } | null>(null);

  const fetchSerpStatus = async () => {
    if (!user?._id) return;
    try {
      const res = await axios.get('http://localhost:3001/api/leads/serpapi/status', {
        headers: { userid: user._id }
      });
      setSerpApiStatus(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchSerpStatus();
  }, [user?._id]);

  // Real-Time Progress Tracker State
  const [activeJob, setActiveJob] = useState<ActiveJobInfo | null>(null);
  const pollIntervalRef = useRef<any>(null);

  // 4-day refresh countdown calculation
  const [timeLeftStr, setTimeLeftStr] = useState('3d 21h');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const lastRefresh = user?.pool_refreshed_at 
        ? new Date(user.pool_refreshed_at).getTime() 
        : Date.now();
      const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
      const targetTime = lastRefresh + fourDaysMs;
      const remainingMs = Math.max(0, targetTime - Date.now());

      const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeftStr(`${days}d ${hours}h ${mins}m`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [user?.pool_refreshed_at]);

  // Check for running active job & sync user pool on mount
  useEffect(() => {
    const checkActiveJob = async () => {
      if (!user?._id) return;
      refreshUserProfile(user._id);
      try {
        const res = await axios.get('http://localhost:3001/api/leads/active-job', {
          headers: { userid: user._id }
        });
        if (res.data?.activeJob && (res.data.activeJob.status === 'in_progress' || res.data.activeJob.status === 'queued')) {
          startPollingJob(res.data.activeJob.id);
        }
      } catch {}
    };
    checkActiveJob();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user?._id]);

  const startPollingJob = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/leads/job-status/${jobId}`);
        const jobData = res.data;
        setActiveJob(jobData);

        if (jobData.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsSubmitting(false);
          if (typeof jobData.creditsRemaining === 'number') {
            updateCredits(jobData.creditsRemaining);
          } else if (user?._id) {
            refreshUserProfile(user._id);
          }
          onHarvestStarted();
        } else if (jobData.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsSubmitting(false);
          if (user?._id) {
            refreshUserProfile(user._id);
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 600);
  };

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isFree = currentPlan === 'free';
  const rawCredits = user?.lead_credits ?? 15;
  const credits = isFree && !(user as any)?.has_topup ? Math.max(0, Math.min(rawCredits, 15)) : Math.max(0, rawCredits);
  const maxPool = isFree ? '15' : (currentPlan === 'basic' ? '600' : 'Unlimited');
  const perQueryLimit = isFree ? 10 : 20;
  const isExhausted = credits < 1;

  // Cost Per Contact based on Scope:
  // Quick: 1 Token = 1 Contact
  // Deep: 2 Tokens = 1 Contact (strictly guarantees mobile/phone contact number)
  const costPerContact = scope === 'deep' ? 2 : 1;
  const quickContactsCount = Math.min(perQueryLimit, Math.max(0, credits));
  const deepContactsCount = Math.min(perQueryLimit, Math.max(0, Math.floor(credits / 2)));
  const deepTokensNeeded = deepContactsCount * 2;
  const cannotAffordDeep = scope === 'deep' && credits < 2;

  const batchContactsCount = scope === 'deep' ? deepContactsCount : quickContactsCount;
  const batchTokensCount = batchContactsCount * costPerContact;

  const locationPresets = ['Mumbai', 'Bengaluru', 'Delhi NCR', 'Hyderabad', 'Pune', 'New York', 'London', 'Dubai'];
  const keywordPresets = ['SaaS & Software', 'Real Estate Agencies', 'Healthcare Clinics', 'Digital Marketing', 'Legal & Advisory', 'Hospitality'];

  const handleLaunchHarvest = async () => {
    // Check if total token pool is exhausted
    if (credits < 1) {
      await alertDialog({
        title: 'Token Pool Exhausted',
        message: 'You have exhausted all available contact tokens in your Free Tier pool (0 / 15 remaining). Free tier tokens auto-refresh every 4 days, or you can top up / upgrade to Basic or Pro.',
        variant: 'warning'
      });
      setUpgradeTab('topup');
      setUpgradeModalOpen(true);
      return;
    }

    // Deep Harvest requires 2 tokens per contact (2 tokens = 1 contact)
    if (scope === 'deep' && credits < 2) {
      await alertDialog({
        title: 'Insufficient Tokens for Deep Harvest',
        message: 'Deep Harvest requires 2 tokens per contact (2 tokens = 1 contact) with verified phone/mobile numbers. You have 1 token remaining. Please switch to Quick Scan (1 token) or top up your pool.',
        variant: 'warning'
      });
      return;
    }

    // Require SerpApi connection
    if (!serpApiStatus?.isConnected) {
      await alertDialog({
        title: 'SerpApi Engine Required',
        message: 'To harvest live Google Maps business listings, please connect your SerpApi account (free tier includes 100 free searches/month).',
        variant: 'info'
      });
      setIsSerpModalOpen(true);
      return;
    }

    const expectedContacts = scope === 'deep' ? deepContactsCount : quickContactsCount;
    const expectedTokens = expectedContacts * costPerContact;

    setIsSubmitting(true);
    setActiveJob({
      id: 'init',
      keyword,
      location,
      scope,
      limit: expectedContacts,
      status: 'queued',
      progress: 5,
      stageMessage: scope === 'deep'
        ? `Initializing Deep Harvest for "${keyword}" in "${location}" (${expectedContacts} verified contacts = ${expectedTokens} tokens at 2 tokens/contact)...`
        : `Initializing extraction pipeline for "${keyword}" in "${location}" (${expectedContacts} contacts = ${expectedTokens} tokens)...`,
      leadsFound: 0
    });

    try {
      const res = await axios.post(
        'http://localhost:3001/api/leads/scrape',
        { keyword, location, scope },
        { headers: { userid: user?._id } }
      );

      setUser({
        ...user!,
        lead_credits: res.data.creditsRemaining,
        plan: res.data.plan || user?.plan
      });

      if (res.data.jobId) {
        startPollingJob(res.data.jobId);
      } else {
        onHarvestStarted();
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setActiveJob(null);
      if (err.response?.data?.needsSerpApi) {
        setIsSerpModalOpen(true);
        return;
      }
      if (err.response?.status === 403 || err.response?.data?.needsTopUp) {
        if (typeof err.response?.data?.creditsRemaining === 'number') {
          updateCredits(err.response.data.creditsRemaining);
        }
        await alertDialog({
          title: 'Token Pool Exhausted',
          message: err.response?.data?.error || 'Your token pool is exhausted (0 remaining). Please top up or upgrade to harvest additional leads.',
          variant: 'warning'
        });
        setUpgradeTab('topup');
        setUpgradeModalOpen(true);
        return;
      } else {
        await alertDialog({
          title: 'Harvesting Error',
          message: err.response?.data?.error || 'Failed to start lead harvesting.',
          variant: 'error'
        });
      }
    }
  };

  const handleResetForNewSearch = () => {
    setActiveJob(null);
    setCurrentStep(1);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
      
      {/* 1. COMPUTE STATUS RIBBON */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white border border-slate-200 rounded-sm text-xs font-delight font-bold text-slate-800">
            <Compass className="w-3.5 h-3.5 text-slate-900" />
            <span className="uppercase tracking-wider">
              {isFree ? 'Free Tier' : `${currentPlan.toUpperCase()}`}
            </span>
          </div>

          <div className="text-xs font-delight font-medium flex items-center gap-1.5">
            <span className="text-slate-500">Available Tokens: </span>
            <span className={`font-bold ${isExhausted ? 'text-rose-600' : 'text-slate-900'}`}>{credits}</span>
            <span className="text-slate-400"> / {maxPool}</span>
            {isExhausted && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                Pool Exhausted
              </span>
            )}
          </div>

          <div className="text-xs font-delight px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 border border-slate-200 font-semibold flex items-center gap-1.5">
            <span>Quick: 1 Token = 1 Contact</span>
            <span className="text-slate-300">•</span>
            <span className="text-purple-700 font-bold">Deep: 2 Tokens = 1 Contact (Mobile Guaranteed)</span>
          </div>

          {/* SerpApi Engine Connection Pill */}
          {serpApiStatus?.isConnected ? (
            <button
              type="button"
              onClick={() => setIsSerpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 transition-colors cursor-pointer"
              title="Click to view SerpApi engine settings"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>SerpApi: Connected</span>
              {/* Mention SerpApi tier only for Basic and Pro Strovr subscribers */}
              {!isFree && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.2 rounded-md">
                  {serpApiStatus.account?.plan_name || 'Free'} Tier ({serpApiStatus.account?.plan_searches_left ?? 100} left)
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSerpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 transition-colors cursor-pointer"
              title="SerpApi engine not connected. Click to link."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>SerpApi: Disconnected</span>
              <span className="underline font-bold ml-0.5">+ Connect</span>
            </button>
          )}

          {isFree && (
            <div className="flex items-center gap-1 text-xs text-slate-500 font-delight font-normal">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh: <strong className="text-slate-900">{timeLeftStr}</strong></span>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME PROGRESS TRACKER */}
      {activeJob && (
        <div className="p-5 bg-slate-50/70 border-b border-slate-200">
          <div className="max-w-xl mx-auto space-y-4">
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 tracking-tight">
                    {activeJob.status === 'completed' 
                      ? 'Harvest Task Finished'
                      : activeJob.status === 'failed'
                        ? 'Extraction Task Failed'
                        : 'Scraping Active Public Listings...'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-delight font-normal mt-0.5">{activeJob.stageMessage}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-delight font-bold text-slate-900">{activeJob.progress}%</span>
                {activeJob.status === 'completed' && (
                  <button
                    onClick={handleResetForNewSearch}
                    className="bg-slate-900 hover:bg-black text-white px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>New Query</span>
                  </button>
                )}
              </div>
            </div>

            {/* 1px Technical Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-xs overflow-hidden border border-slate-200">
              <div 
                className={`h-full transition-all duration-300 ${
                  activeJob.status === 'completed' 
                    ? 'bg-emerald-600' 
                    : activeJob.status === 'failed'
                      ? 'bg-rose-600'
                      : 'bg-slate-900'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, activeJob.progress))}%` }}
              />
            </div>

            {/* Metric Tags */}
            <div className="grid grid-cols-4 gap-2 pt-1 font-delight font-medium text-xs">
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase">Keyword</div>
                <div className="font-bold text-slate-900 truncate">{activeJob.keyword}</div>
              </div>
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase">Location</div>
                <div className="font-bold text-slate-900 truncate">{activeJob.location}</div>
              </div>
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase">Scope</div>
                <div className="font-bold text-purple-900 truncate">
                  {activeJob.scope === 'deep' ? 'Deep Harvest (2 tok)' : 'Quick Scan (1 tok)'}
                </div>
              </div>
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <div className="text-[9px] text-slate-400 uppercase">Found</div>
                <div className="font-bold text-slate-900">{activeJob.leadsFound}</div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. STRUCTURED CONFIGURATION WIZARD */}
      {!isCollapsed && !activeJob && (
        <div className="p-6">
          
          {/* Step Progression Tabs (Linear Style) */}
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto mb-6">
            <button 
              type="button"
              onClick={() => !isSubmitting && setCurrentStep(1)}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-delight font-semibold transition-all border text-center ${
                currentStep === 1 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : currentStep > 1 
                    ? 'bg-slate-100 text-slate-700 border-slate-200' 
                    : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              01 Geo Location
            </button>

            <button 
              type="button"
              onClick={() => !isSubmitting && setCurrentStep(2)}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-delight font-semibold transition-all border text-center ${
                currentStep === 2 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : currentStep > 2 
                    ? 'bg-slate-100 text-slate-700 border-slate-200' 
                    : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              02 Industry
            </button>

            <button 
              type="button"
              onClick={() => !isSubmitting && setCurrentStep(3)}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-delight font-semibold transition-all border text-center ${
                currentStep === 3 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              03 Scope
            </button>
          </div>

          {/* STEP 1: LOCATION INPUT */}
          {currentStep === 1 && (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-sm tracking-tight text-slate-900">Target Geographic Territory</h3>
                <p className="text-xs text-slate-500">Specify a geographic city, district, or metro territory (e.g. Mumbai, Bengaluru, New York, London).</p>
              </div>

              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Mumbai, Bengaluru, Delhi NCR, London, or Austin TX"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              {/* Quick Preset Location Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-delight font-semibold text-slate-400 uppercase tracking-wider">Suggested Cities &amp; Regions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {locationPresets.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                        location === loc 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!location.trim()}
                  className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: KEYWORD / CATEGORY INPUT */}
          {currentStep === 2 && (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-sm tracking-tight text-slate-900">Industry or Trade Keyword</h3>
                <p className="text-xs text-slate-500">Query term for localized public business profiles.</p>
              </div>

              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. Dentists, Cafes, Plumbers, Gyms"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-delight font-semibold text-slate-400 uppercase tracking-wider">Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {keywordPresets.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setKeyword(kw)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                        keyword === kw 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!keyword.trim()}
                  className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SCOPE & SUBMIT */}
          {currentStep === 3 && (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-sm tracking-tight text-slate-900">Execution Depth</h3>
                <p className="text-xs text-slate-500">Choose resource allocation for scraping passes.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div 
                  onClick={() => setScope('quick')}
                  className={`p-3.5 rounded-md border transition-all cursor-pointer ${
                    scope === 'quick' 
                      ? 'border-slate-900 bg-slate-50/70 shadow-xs' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900 tracking-tight">Quick Scan</span>
                    {scope === 'quick' && <span className="w-2 h-2 rounded-xs bg-slate-900"></span>}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Primary public business profile, verified phone, address, and ratings.
                  </p>
                  <div className={`text-[10px] font-delight font-semibold pt-2 mt-2 border-t border-slate-200 ${isExhausted ? 'text-rose-600' : 'text-slate-700'}`}>
                    {isExhausted ? '0 Tokens Available (Pool Exhausted)' : `1 Token = 1 Contact (${quickContactsCount} Tokens for ${quickContactsCount} Contacts)`}
                  </div>
                </div>

                <div 
                  onClick={() => setScope('deep')}
                  className={`p-3.5 rounded-md border transition-all cursor-pointer relative ${
                    scope === 'deep' 
                      ? 'border-purple-900 bg-purple-50/60 shadow-xs ring-1 ring-purple-900/20' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 tracking-tight">Deep Harvest</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                        2 Tokens = 1 Contact
                      </span>
                    </div>
                    {scope === 'deep' && <span className="w-2 h-2 rounded-xs bg-purple-900"></span>}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Exhaustive crawl with strict contact verification. Excludes listings without mobile numbers so you only pay for actionable prospects.
                  </p>
                  <div className={`text-[10px] font-delight font-semibold pt-2 mt-2 border-t border-slate-200 ${isExhausted || cannotAffordDeep ? 'text-amber-700' : 'text-purple-700'}`}>
                    {isExhausted 
                      ? '0 Tokens Available (Pool Exhausted)' 
                      : cannotAffordDeep
                        ? 'Requires 2 Tokens (1 available - switch to Quick)'
                        : `2 Tokens = 1 Contact (${deepTokensNeeded} Tokens for ${deepContactsCount} Contacts • Guaranteed Mobile)`}
                  </div>
                </div>
              </div>

              {/* Execution Summary Strip */}
              <div className={`p-3 rounded-md border flex items-center justify-between text-xs font-delight font-medium ${
                isExhausted || cannotAffordDeep ? 'bg-amber-50/70 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="truncate">{keyword || 'Selected Category'} in {location || 'Target Territory'}</span>
                <span className="font-bold">
                  {isExhausted 
                    ? '0 Tokens Available • Pool Exhausted' 
                    : cannotAffordDeep
                      ? '1 Token Left (Insufficient for Deep • Switch to Quick Scan)'
                      : scope === 'deep'
                        ? `${batchContactsCount} Contacts • ${batchTokensCount} Tokens (2 Tokens/Contact • Guaranteed Mobile)`
                        : `${batchContactsCount} Contacts • ${batchTokensCount} Tokens (1 Token/Contact)`}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button 
                  type="button"
                  onClick={handleLaunchHarvest}
                  disabled={isSubmitting || cannotAffordDeep}
                  className={`px-5 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                    isExhausted || cannotAffordDeep
                      ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                      : scope === 'deep'
                        ? 'bg-purple-900 hover:bg-purple-950 text-white disabled:opacity-50'
                        : 'bg-slate-900 hover:bg-black text-white disabled:opacity-50'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Task...</span>
                    </>
                  ) : isExhausted ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-white" />
                      <span>Tokens Exhausted (0/{maxPool}) • Top Up</span>
                    </>
                  ) : cannotAffordDeep ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-white" />
                      <span>Need 2 Tokens for Deep (Switch to Quick)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {scope === 'deep' 
                          ? `Dispatch Deep Harvest (${batchTokensCount} Tokens for ${batchContactsCount} Contacts)`
                          : `Dispatch Quick Scan (${batchTokensCount} Tokens for ${batchContactsCount} Contacts)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SerpApi Connection Modal */}
      <SerpApiConnectModal
        isOpen={isSerpModalOpen}
        onClose={() => setIsSerpModalOpen(false)}
        user={user}
        onConnected={() => fetchSerpStatus()}
      />
    </div>
  );
};

export default LeadFinderWizard;
