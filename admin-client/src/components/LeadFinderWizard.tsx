import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { 
  MapPin, Tag, Sparkles, ArrowRight, ArrowLeft, 
  Clock, Compass, Loader2,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  RefreshCw
} from 'lucide-react';

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
  const { user, setUser, setUpgradeModalOpen, setUpgradeTab } = useStore();

  // Step state: 1 (Location) -> 2 (Keyword) -> 3 (Scope Proficiency)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [location, setLocation] = useState('Kalyan West');
  const [keyword, setKeyword] = useState('Dentists');
  const [scope, setScope] = useState<'quick' | 'deep'>('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // Check for any currently running active job on mount
  useEffect(() => {
    const checkActiveJob = async () => {
      if (!user?._id) return;
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
          onHarvestStarted(); // Reload lead table in Dashboard
        } else if (jobData.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 600);
  };

  const currentPlan = user?.plan || 'free';
  const isFree = currentPlan === 'free';
  const credits = user?.lead_credits ?? 15;
  const maxPool = isFree ? '15' : (currentPlan === 'basic' ? '600' : 'Unlimited');
  const perQueryLimit = isFree ? 10 : 20;

  // Preset quick tags & locations
  const locationPresets = ['Kalyan West', 'Bandra West, Mumbai', 'Andheri East', 'Bangalore Indiranagar', 'South Delhi'];
  const keywordPresets = ['Dentists', 'Cafes & Bakeries', 'Plumbers', 'Gyms & Fitness', 'Real Estate Brokers', 'Digital Marketing'];

  const handleLaunchHarvest = async () => {
    const computeCost = scope === 'deep' ? 2 : 1;

    if (credits < computeCost) {
      setUpgradeTab('topup');
      setUpgradeModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setActiveJob({
      id: 'init',
      keyword,
      location,
      scope,
      limit: perQueryLimit,
      status: 'queued',
      progress: 5,
      stageMessage: `Initializing Headless Extraction Worker for "${keyword}" in "${location}"...`,
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
      if (err.response?.data?.needsTopUp) {
        setUpgradeTab('plans');
        setUpgradeModalOpen(true);
      } else {
        alert(err.response?.data?.error || 'Failed to start lead harvesting');
      }
    }
  };

  const handleResetForNewSearch = () => {
    setActiveJob(null);
    setCurrentStep(1);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl shadow-xs overflow-hidden">
      
      {/* ======================================================== */}
      {/* 1. FREE TIER COMPUTE LIMITS & REFRESH TIMER BANNER       */}
      {/* ======================================================== */}
      <div className="bg-[#FAFAFA] border-b border-[#E4E4E7] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tier Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E4E4E7] rounded-xl text-xs font-extrabold text-[#09090B]">
            <Compass className="w-3.5 h-3.5 text-accent" />
            <span className="uppercase tracking-wider">
              {isFree ? 'Free Tier Compute' : `${currentPlan.toUpperCase()} TIER`}
            </span>
          </div>

          {/* Credits Pool */}
          <div className="text-xs">
            <span className="text-gray-500">Saved Leads Pool: </span>
            <span className="font-extrabold text-[#09090B]">{credits}</span>
            <span className="text-gray-400"> / {maxPool} Leads</span>
          </div>

          {/* Per-Query Cap */}
          <div className="text-xs px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
            Max {perQueryLimit} Leads / Query
          </div>

          {/* 4-Day Auto Refresh Timer */}
          {isFree && (
            <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Pool Refreshes in: <strong className="text-charcoal font-bold">{timeLeftStr}</strong></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="bg-white hover:bg-gray-100 border border-[#E4E4E7] text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            title={isCollapsed ? "Expand Setup Wizard" : "Minimize Setup UI"}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                <span>Expand Wizard</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                <span>Minimize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. REAL-TIME PROGRESS BAR & LIVE EXTRACTION STATUS       */}
      {/* ======================================================== */}
      {activeJob && (
        <div className="p-6 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 border-b border-[#E4E4E7] animate-in fade-in duration-200">
          <div className="max-w-2xl mx-auto space-y-4">
            
            {/* Header / Status Title */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {activeJob.status === 'completed' ? (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : activeJob.status === 'failed' ? (
                  <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold shadow-xs">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center font-bold shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
                <div>
                  <h3 className="font-extrabold text-sm text-[#09090B]">
                    {activeJob.status === 'completed' 
                      ? 'Harvest Successfully Completed'
                      : activeJob.status === 'failed'
                        ? 'Extraction Issue Encountered'
                        : 'Real-Time Lead Extraction in Progress'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">{activeJob.stageMessage}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-accent">{activeJob.progress}%</span>
                {activeJob.status === 'completed' && (
                  <button
                    onClick={handleResetForNewSearch}
                    className="bg-accent hover:bg-accent-dark text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Harvest Another Niche</span>
                  </button>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-[#E4E4E7] h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  activeJob.status === 'completed' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm' 
                    : activeJob.status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-accent via-indigo-600 to-purple-600 animate-pulse'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, activeJob.progress))}%` }}
              />
            </div>

            {/* Live Metrics Pill Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-[#E4E4E7] shadow-xs">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Keyword</div>
                <div className="font-extrabold text-[#09090B] truncate">{activeJob.keyword}</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#E4E4E7] shadow-xs">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Location</div>
                <div className="font-extrabold text-[#09090B] truncate">{activeJob.location}</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#E4E4E7] shadow-xs">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Scope</div>
                <div className="font-extrabold text-purple-700">
                  {activeJob.scope === 'deep' ? 'Deep Multi-Tier' : 'Quick Scan'}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#E4E4E7] shadow-xs">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Leads Synced</div>
                <div className="font-black text-emerald-600">
                  {activeJob.status === 'completed' ? `${activeJob.leadsFound} Leads` : `${activeJob.leadsFound || 'Harvesting...'}`}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. STEP-BY-STEP COMPUTE SETUP WIZARD (WHEN EXPANDED)     */}
      {/* ======================================================== */}
      {!isCollapsed && !activeJob && (
        <div className="p-6">
          
          {/* Wizard Step Progression Header */}
          <div className="flex items-center justify-between max-w-xl mx-auto mb-6 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#E4E4E7] -translate-y-1/2 z-0" />
            
            {/* Step 1 Pill */}
            <div 
              onClick={() => !isSubmitting && setCurrentStep(1)}
              className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                currentStep === 1 
                  ? 'bg-accent text-white shadow-md shadow-accent/20 ring-4 ring-accent/10' 
                  : currentStep > 1 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white border border-[#E4E4E7] text-gray-400'
              }`}
            >
              <span>1</span>
              <span>Location</span>
            </div>

            {/* Step 2 Pill */}
            <div 
              onClick={() => !isSubmitting && setCurrentStep(2)}
              className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                currentStep === 2 
                  ? 'bg-accent text-white shadow-md shadow-accent/20 ring-4 ring-accent/10' 
                  : currentStep > 2 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white border border-[#E4E4E7] text-gray-400'
              }`}
            >
              <span>2</span>
              <span>Category</span>
            </div>

            {/* Step 3 Pill */}
            <div 
              onClick={() => !isSubmitting && setCurrentStep(3)}
              className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                currentStep === 3 
                  ? 'bg-accent text-white shadow-md shadow-accent/20 ring-4 ring-accent/10' 
                  : 'bg-white border border-[#E4E4E7] text-gray-400'
              }`}
            >
              <span>3</span>
              <span>Proficiency</span>
            </div>
          </div>

          {/* STEP 1: LOCATION INPUT */}
          {currentStep === 1 && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="space-y-1 text-center">
                <h3 className="font-black text-base text-[#09090B]">Where should we find your target businesses?</h3>
                <p className="text-xs text-gray-500">Enter a city, town, or neighborhood (e.g. Kalyan West, Mumbai, South Delhi).</p>
              </div>

              <div className="relative">
                <MapPin className="w-5 h-5 text-accent absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Kalyan West, Mumbai"
                  className="w-full pl-11 pr-4 py-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#09090B] focus:outline-none focus:border-accent focus:bg-white transition-all shadow-xs"
                />
              </div>

              {/* Quick Preset Location Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Popular Geographic Hubs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {locationPresets.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        location === loc 
                          ? 'bg-accent text-white font-bold shadow-xs' 
                          : 'bg-[#F4F4F5] text-gray-600 hover:bg-[#E4E4E7]'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex justify-end pt-3">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!location.trim()}
                  className="bg-accent hover:bg-accent-dark text-white px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md shadow-accent/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>Next: Select Category</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: KEYWORD / CATEGORY INPUT */}
          {currentStep === 2 && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="space-y-1 text-center">
                <h3 className="font-black text-base text-[#09090B]">What type of business are you looking for?</h3>
                <p className="text-xs text-gray-500">Enter a trade or service keyword to harvest direct contacts.</p>
              </div>

              <div className="relative">
                <Tag className="w-5 h-5 text-accent absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. Dentists, Cafes, Plumbers, Gyms"
                  className="w-full pl-11 pr-4 py-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#09090B] focus:outline-none focus:border-accent focus:bg-white transition-all shadow-xs"
                />
              </div>

              {/* Quick Preset Keyword Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Trending High-Conversion Niches:</span>
                <div className="flex flex-wrap gap-1.5">
                  {keywordPresets.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setKeyword(kw)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        keyword === kw 
                          ? 'bg-accent text-white font-bold shadow-xs' 
                          : 'bg-[#F4F4F5] text-gray-600 hover:bg-[#E4E4E7]'
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex justify-between pt-3">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-charcoal border border-[#E4E4E7] hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!keyword.trim()}
                  className="bg-accent hover:bg-accent-dark text-white px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md shadow-accent/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>Next: Scope Proficiency</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SCOPE / DEPTH PROFICIENCY SELECTOR */}
          {currentStep === 3 && (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="space-y-1 text-center">
                <h3 className="font-black text-base text-[#09090B]">Choose Harvest Scope & Depth</h3>
                <p className="text-xs text-gray-500">Select how deeply the extraction worker should crawl and verify data.</p>
              </div>

              {/* Two Proficiency Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Quick Scan Option */}
                <div 
                  onClick={() => setScope('quick')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    scope === 'quick' 
                      ? 'border-accent bg-accent/5 shadow-md' 
                      : 'border-[#E4E4E7] bg-white hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-[#09090B]">Quick Scan</span>
                      {scope === 'quick' && <span className="w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center text-xs font-bold">✔</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Fast-pass extraction of active public listings, phone numbers, ratings, and map locations.
                    </p>
                  </div>
                  <div className="text-[11px] text-gray-600 font-bold flex items-center gap-1 pt-2 border-t border-[#E4E4E7]">
                    <span>1 Compute Credit</span>
                  </div>
                </div>

                {/* 2. Deep Multi-Page Harvest Option */}
                <div 
                  onClick={() => setScope('deep')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    scope === 'deep' 
                      ? 'border-purple-600 bg-purple-50/60 shadow-md' 
                      : 'border-[#E4E4E7] bg-white hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-purple-900">Deep Harvest</span>
                      {scope === 'deep' && <span className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">✔</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Exhaustive multi-tier crawl: deep-crawls official websites, phone/mobile validation, and strictly excludes listings without contact info.
                    </p>
                  </div>
                  <div className="text-[11px] text-purple-700 font-bold flex items-center gap-1 pt-2 border-t border-purple-200">
                    <span>2 Credits = 1 Contact (Mobile Guaranteed)</span>
                  </div>
                </div>

              </div>

              {/* Compute Summary Pill */}
              <div className="p-3.5 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7] flex flex-wrap items-center justify-between text-xs gap-3">
                <div>
                  <span className="text-gray-400">Targeting: </span>
                  <strong className="text-charcoal font-bold">{keyword}</strong> in <strong className="text-charcoal font-bold">{location}</strong>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="text-gray-400">Limit: </span>
                  <strong className="text-amber-700 font-bold">{perQueryLimit} Leads Max</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Compute Cost:</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#09090B] text-white font-extrabold text-[11px]">
                    {scope === 'deep' ? '2 Credits' : '1 Credit'}
                  </span>
                </div>
              </div>

              {/* Launch Controls */}
              <div className="flex justify-between items-center pt-2">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-charcoal border border-[#E4E4E7] hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button 
                  type="button"
                  onClick={handleLaunchHarvest}
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent-dark text-white px-7 py-3 rounded-xl text-xs font-extrabold shadow-md shadow-accent/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Launching Headless Cluster...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Launch Lead Harvest</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default LeadFinderWizard;
