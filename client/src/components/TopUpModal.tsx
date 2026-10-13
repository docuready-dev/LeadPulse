import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { alertDialog } from './AppConfirmModal';
import axios from 'axios';
import { 
  X, Check, Lock, Zap, Sparkles, 
  ArrowRight, CreditCard, ChevronRight, CheckCircle2 
} from 'lucide-react';

const TopUpModal = () => {
  const { 
    user, 
    isUpgradeModalOpen, 
    isTopUpOpen,
    setUpgradeModalOpen, 
    setTopUpOpen,
    upgradeTab, 
    setUpgradeTab, 
    setUser 
  } = useStore();

  const [loadingItem, setLoadingItem] = useState<string | null>(null);
  const [phonePeStep, setPhonePeStep] = useState<'idle' | 'processing' | 'success'>('idle');
  const [successItemName, setSuccessItemName] = useState('');

  const isOpen = Boolean(isUpgradeModalOpen || isTopUpOpen);

  const handleClose = () => {
    setPhonePeStep('idle');
    setUpgradeModalOpen(false);
    setTopUpOpen(false);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlan = user?.plan || 'free';

  // Process PhonePe Payment
  const handlePhonePeCheckout = async (itemKey: 'micro' | 'mega' | 'basic' | 'pro', itemName: string) => {
    if (!user?._id) return;
    setLoadingItem(itemKey);
    setPhonePeStep('processing');
    
    try {
      // 1. Initiate checkout session
      const checkoutRes = await axios.post('http://localhost:3001/api/billing/checkout', {
        userId: user._id,
        itemKey
      });

      const { transactionId } = checkoutRes.data;

      // 2. Simulate PhonePe Gateway redirection & Instant Webhook callback
      setTimeout(async () => {
        const webhookRes = await axios.post('http://localhost:3001/api/billing/webhook', {
          transactionId,
          userId: user._id,
          itemKey,
          status: 'SUCCESS'
        });

        // 3. Update local state
        setUser({
          ...user,
          lead_credits: webhookRes.data.credits,
          plan: webhookRes.data.plan || user.plan
        });

        setSuccessItemName(itemName);
        setPhonePeStep('success');
        setLoadingItem(null);
      }, 1800);

    } catch (err) {
      console.error('Payment failure', err);
      await alertDialog({
        title: 'Payment Verification Error',
        message: 'PhonePe Gateway verification error. Please try again.',
        variant: 'error'
      });
      setLoadingItem(null);
      setPhonePeStep('idle');
    }
  };

  return (
    <div 
      onClick={handleClose} 
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-hidden cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-white rounded-md border border-slate-200 w-full max-w-4xl h-[90vh] max-h-[850px] shadow-xl flex flex-col overflow-hidden cursor-default animate-in fade-in zoom-in-95 duration-150 relative z-10 my-auto"
      >
        
        {/* ======================================================== */}
        {/* PINNED MODAL HEADER (Never moves or gets clipped)        */}
        {/* ======================================================== */}
        <div className="shrink-0 p-5 sm:px-6 sm:py-5 bg-slate-950 text-white relative border-b border-slate-800">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }} 
            className="absolute top-5 right-5 w-7 h-7 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-20"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>

          <div className="max-w-2xl pr-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-blue-500/10 border border-blue-500/20 text-blue-400 font-delight text-[11px] font-semibold mb-2">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Email Marketing Suite & Tier Matrix</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
              Scale Your Email Marketing & Outreach Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Unlock all 8 Link Mobility frameworks, 50/50 A/B split testing, multi-step sequences, high-volume inbox dispatch, and bonus lead tokens.
            </p>
          </div>

          {/* Nav Tabs */}
          <div className="flex flex-wrap gap-2 mt-4 font-delight font-medium">
            <button
              onClick={() => { setUpgradeTab('plans'); setPhonePeStep('idle'); }}
              className={`px-3.5 py-1.5 rounded-md text-xs transition-all cursor-pointer ${upgradeTab === 'plans' ? 'bg-white text-slate-900 font-bold border border-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              Subscription Tiers (Monthly)
            </button>
            <button
              onClick={() => { setUpgradeTab('topup'); setPhonePeStep('idle'); }}
              className={`px-3.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${upgradeTab === 'topup' ? 'bg-white text-slate-900 font-bold border border-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>Lead Top-Up Bundles (PhonePe)</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SCROLLABLE MODAL BODY                                    */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">

        {/* ======================================================== */}
        {/* PHONEPE PROCESSING STATE                                 */}
        {/* ======================================================== */}
        {phonePeStep === 'processing' && (
          <div className="p-16 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Contacting PhonePe Gateway...</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Simulating secure UPI & Card payment webhook verification. Your credits and tier will update immediately.
            </p>
          </div>
        )}

        {phonePeStep === 'success' && (
          <div className="p-16 text-center space-y-4">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Payment Verified by PhonePe!</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Successfully activated <span className="font-bold text-slate-900">{successItemName}</span>. Your account email outreach limits and compute pool have been updated!
            </p>
            <button 
              onClick={handleClose}
              className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-5 rounded-md font-delight font-medium text-xs transition-colors border border-slate-900 cursor-pointer"
            >
              Back to Command Center
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: SUBSCRIPTION PLANS & EXCLUSION MATRIX             */}
        {/* ======================================================== */}
        {phonePeStep === 'idle' && upgradeTab === 'plans' && (
          <div className="space-y-6">
            
            {/* 3 Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1. FREE TIER */}
              <div className={`p-5 rounded-md border transition-all flex flex-col justify-between ${currentPlan === 'free' ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-delight uppercase tracking-wider text-slate-500 font-semibold">Free Explorer</span>
                    {currentPlan === 'free' && (
                      <span className="text-[10px] font-delight font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-sm">
                        Active Plan
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-delight text-slate-900 mb-0.5">₹0</div>
                  <p className="text-xs text-slate-400 mb-5">Forever Free</p>

                  <ul className="space-y-2.5 text-xs">
                    <li className="flex items-center gap-2 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>50 Test Emails / Month</strong> (Single relay)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>2 Standard Templates</strong> (Basic text)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>5 AI Pitches / Mo</strong> (Smart Copilot)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Single One-Off Blast</strong> (1 step)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>15 Bonus Lead Tokens</strong> (4-day refresh)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-400">
                      <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="line-through">50/50 A/B Split Testing</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-400">
                      <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="line-through">6 Advanced Link Mobility Frameworks</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-5">
                  <button 
                    disabled 
                    className="w-full h-8 rounded-md border border-slate-200 text-xs font-delight font-medium text-slate-400 bg-slate-100 cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                </div>
              </div>

              {/* 2. BASIC TIER */}
              <div className={`p-5 rounded-md border transition-all flex flex-col justify-between relative ${currentPlan === 'basic' ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-delight uppercase tracking-wider text-blue-600 font-bold">LeadPulse Basic</span>
                    {currentPlan === 'basic' && (
                      <span className="text-[10px] font-delight font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-sm">
                        Active Plan
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-delight text-slate-900 mb-0.5">
                    ₹699 <span className="text-xs font-sans font-normal text-slate-500">/ mo</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-5">For solo operators & agencies</p>

                  <ul className="space-y-2.5 text-xs">
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>1,500 Emails / Month</strong> (Up to 2 connected inboxes)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>All 8 Link Mobility Frameworks</strong> Unlocked</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>50/50 A/B Split Testing Enabled</strong></span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>250 AI Pitches / Mo</strong> Auto-Composition</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>2-Step Follow-Up Sequence</strong> (Initial + Follow-up)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>600 Bonus Lead Tokens</strong> & continuous harvest</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Unlimited CSV & Excel</strong> exports</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-5">
                  <button 
                    onClick={() => handlePhonePeCheckout('basic', 'LeadPulse Basic (₹699/mo)')}
                    disabled={currentPlan === 'basic' || loadingItem === 'basic'}
                    className="w-full h-8 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-delight font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border border-slate-900 cursor-pointer"
                  >
                    <span>{currentPlan === 'basic' ? 'Active' : 'Upgrade via PhonePe'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3. PRO TIER */}
              <div className={`p-5 rounded-md border transition-all flex flex-col justify-between relative ${currentPlan === 'pro' ? 'border-purple-600 bg-purple-50/20 ring-1 ring-purple-600' : 'border-slate-900 bg-white'}`}>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-delight font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> High Performance
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 pt-1">
                    <span className="text-[11px] font-delight uppercase tracking-wider text-purple-600 font-bold">LeadPulse Pro</span>
                    {currentPlan === 'pro' && (
                      <span className="text-[10px] font-delight font-semibold bg-purple-600 text-white px-2 py-0.5 rounded-sm">
                        Active Plan
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-delight text-slate-900 mb-0.5">
                    ₹1,999 <span className="text-xs font-sans font-normal text-slate-500">/ mo</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-5">For growth teams & sales teams</p>

                  <ul className="space-y-2.5 text-xs">
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>5,000+ Emails / Month</strong> (Unlimited inboxes & SMTPs)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>8 Frameworks + Custom Template Library</strong></span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>Multi-Variant A/B/C Testing</strong></span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>Unlimited AI Pitch Generations</strong></span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>Multi-Step Behavioral Journeys</strong> (WhatsApp bridge)</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>1,500 Bonus Lead Tokens</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-800">
                      <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span><strong>Dedicated Worker Node</strong> & Full API Access</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-5">
                  <button 
                    onClick={() => handlePhonePeCheckout('pro', 'LeadPulse Pro (₹1,999/mo)')}
                    disabled={currentPlan === 'pro' || loadingItem === 'pro'}
                    className="w-full h-8 rounded-md bg-purple-700 hover:bg-purple-800 text-white text-xs font-delight font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border border-purple-700 cursor-pointer"
                  >
                    <span>{currentPlan === 'pro' ? 'Active' : 'Get Pro via PhonePe'}</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

            {/* ======================================================== */}
            {/* FEATURE EXCLUSION COMPARISON MATRIX                      */}
            {/* ======================================================== */}
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h4 className="text-xs font-delight uppercase tracking-wider text-slate-700 font-bold">
                  Feature Exclusion & Conversion Comparison Matrix
                </h4>
                <span className="text-[11px] font-delight font-normal text-slate-400">All prices in INR. Instant activation via PhonePe.</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-slate-500 font-delight font-semibold text-[11px]">
                      <th className="p-3 pl-4">Capability / Dimension</th>
                      <th className="p-3 text-center">Free Explorer (₹0)</th>
                      <th className="p-3 text-center text-blue-600">Basic (₹699/mo)</th>
                      <th className="p-3 text-center text-purple-700">Pro (₹1,999/mo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">Email Dispatch Volume</td>
                      <td className="p-3 text-center font-delight font-medium text-slate-600">50 test emails/month</td>
                      <td className="p-3 text-center font-delight font-bold text-blue-600">1,500 emails/month (2 inboxes)</td>
                      <td className="p-3 text-center font-delight font-bold text-purple-700">5,000+ emails/month (unlimited inboxes)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">Link Mobility Frameworks</td>
                      <td className="p-3 text-center font-delight font-medium text-slate-600">2 Standard Templates</td>
                      <td className="p-3 text-center font-delight font-bold text-blue-600">All 8 Frameworks Unlocked</td>
                      <td className="p-3 text-center font-delight font-bold text-purple-700">8 Frameworks + Custom Reusable Library</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">A/B Split Testing</td>
                      <td className="p-3 text-center font-delight text-red-500 font-bold">Locked</td>
                      <td className="p-3 text-center font-delight text-emerald-600 font-bold">50/50 Split Testing Enabled</td>
                      <td className="p-3 text-center font-delight font-bold text-purple-700">Multi-Variant A/B/C Testing</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">AI Copilot Pitch Synthesis</td>
                      <td className="p-3 text-center font-delight font-medium text-slate-600">5 generations/month</td>
                      <td className="p-3 text-center font-delight font-bold text-blue-600">250 generations/month</td>
                      <td className="p-3 text-center font-delight font-bold text-purple-700">Unlimited AI Generations</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">Automated Sequence Depth</td>
                      <td className="p-3 text-center font-delight font-medium text-slate-600">Single one-off blast</td>
                      <td className="p-3 text-center font-delight text-emerald-600 font-bold">2-Step Sequence (Initial + Follow-up)</td>
                      <td className="p-3 text-center font-delight text-purple-700 font-bold">Multi-Step Behavioral Journeys + WhatsApp</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">Bonus Lead Token Pool</td>
                      <td className="p-3 text-center font-delight font-medium text-slate-600">15 Tokens (4-day pool)</td>
                      <td className="p-3 text-center font-delight font-bold text-blue-600">600 Tokens (bonus)</td>
                      <td className="p-3 text-center font-delight font-bold text-purple-700">1,500 Tokens (bonus)</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">Data Exports & CRM Sync</td>
                      <td className="p-3 text-center font-delight text-red-500 font-bold">In-app preview only</td>
                      <td className="p-3 text-center font-delight text-emerald-600 font-bold">Unlimited CSV & Excel Export</td>
                      <td className="p-3 text-center font-delight text-emerald-600 font-bold">Unlimited CSV + Webhooks + API</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">Dedicated Worker Priority</td>
                      <td className="p-3 text-center font-delight text-red-500 font-bold">Standard Queue</td>
                      <td className="p-3 text-center font-delight text-red-500 font-bold">Standard Queue</td>
                      <td className="p-3 text-center font-delight text-purple-700 font-bold">Dedicated Headless Worker Node</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-4 font-semibold text-slate-800">API Access & Webhooks</td>
                      <td className="p-3 text-center font-delight text-red-500 font-bold">Locked</td>
                      <td className="p-3 text-center font-delight text-red-500 font-bold">Locked</td>
                      <td className="p-3 text-center font-delight text-purple-700 font-bold">Full API Access & Webhooks</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: LEAD TOP-UP BUNDLES (PHONEPE INTEGRATED)          */}
        {/* ======================================================== */}
        {phonePeStep === 'idle' && upgradeTab === 'topup' && (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs text-slate-800 flex items-center gap-3">
              <Zap className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <strong>Need leads without a monthly commitment?</strong> Purchase one-time micro-transaction bundles processed instantly via PhonePe. Credits never expire and stack on top of your current pool!
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* MICRO PACK */}
              <div className="p-5 rounded-md border border-slate-200 hover:border-slate-400 bg-white transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-delight uppercase tracking-wider text-blue-600 font-bold">Micro Pack</span>
                    <span className="text-[10px] font-delight font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-sm">Instant UPI</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-delight text-slate-900 mb-0.5">₹50</div>
                  <p className="text-xs text-slate-400 mb-5">Micro-transaction top-up</p>

                  <div className="p-3 bg-slate-50 rounded-sm border border-slate-200 mb-5">
                    <div className="text-lg font-bold font-delight text-slate-900 mb-0.5">+20 Extra Leads</div>
                    <p className="text-[11px] text-slate-500">Perfect for a quick local niche query (₹2.5 / lead)</p>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 mb-5">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Never expires</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Usable on Quick or Deep harvest</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Instant PhonePe activation</li>
                  </ul>
                </div>

                <button 
                  onClick={() => handlePhonePeCheckout('micro', 'Micro Pack (20 Leads)')}
                  disabled={loadingItem === 'micro'}
                  className="w-full h-8 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-delight font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-900 cursor-pointer"
                >
                  <span>Pay ₹50 via PhonePe</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* MEGA PACK */}
              <div className="p-5 rounded-md border-2 border-emerald-600 bg-white transition-all flex flex-col justify-between relative">
                <div className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[9px] font-delight font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                  Best Value (₹1 / Lead)
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-delight uppercase tracking-wider text-emerald-600 font-bold">Mega Pack</span>
                    <span className="text-[10px] font-delight font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-sm">Power Bundle</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-delight text-slate-900 mb-0.5">₹1,000</div>
                  <p className="text-xs text-slate-400 mb-5">Volume lead acquisition bundle</p>

                  <div className="p-3 bg-emerald-50/50 rounded-sm border border-emerald-200 mb-5">
                    <div className="text-lg font-bold font-delight text-emerald-950 mb-0.5">+1,000 Extra Leads</div>
                    <p className="text-[11px] text-emerald-700">Highest discount rate available across LeadPulse</p>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 mb-5">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> 1,000 Verified Lead Credits</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Continuous extraction without cap</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Priority headless browser queue</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Instant PhonePe webhook settlement</li>
                  </ul>
                </div>

                <button 
                  onClick={() => handlePhonePeCheckout('mega', 'Mega Pack (1,000 Leads)')}
                  disabled={loadingItem === 'mega'}
                  className="w-full h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-delight font-bold transition-all flex items-center justify-center gap-1.5 border border-emerald-600 cursor-pointer"
                >
                  <span>Pay ₹1,000 via PhonePe</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-center text-[11px] font-delight font-normal text-slate-500">
              Secured by 256-bit PhonePe Gateway encryption • UPI, Cards, NetBanking, and Wallets accepted
            </div>
          </div>
        )}

        </div>

        {/* ======================================================== */}
        {/* PINNED STICKY FOOTER (Always accessible at bottom)       */}
        {/* ======================================================== */}
        <div className="shrink-0 px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-delight font-normal text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Secured by 256-bit PhonePe Gateway encryption • UPI, Cards & NetBanking</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-delight font-medium text-slate-700 transition-colors cursor-pointer"
          >
            Dismiss / Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default TopUpModal;
