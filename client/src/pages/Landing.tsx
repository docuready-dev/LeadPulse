import { 
  BarChart3, Database, Sparkles, Users, Zap, ShieldCheck, X, Check
} from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import MeshBackground from '../components/MeshBackground';
import { useStore } from '../store/useStore';
import docuReadyBlackLogo from '../assets/DocuReady-black.png';
import docuReadyWhiteLogo from '../assets/DocuReady-white.png';
import leadPulseLogo from '../assets/LeadPulse-logo.png';

const companies = [
  { name: 'Acme Corp', icon: Database },
  { name: 'Globex', icon: BarChart3 },
  { name: 'Soylent', icon: Users },
  { name: 'Initech', icon: Zap },
  { name: 'Umbrella', icon: ShieldCheck },
  { name: 'Massive Dynamic', icon: Sparkles },
];

const benchmarkProfiles = {
  solo: {
    label: 'Solo Founder (1 Seat)',
    seats: '1 Seat',
    leadsPerMo: '500 Leads/mo',
    marketTotal: '₹9,200',
    marketAnnual: '₹1,10,400',
    leadPulsePlan: 'Basic Plan',
    leadPulseTotal: '₹699',
    leadPulseAnnual: '₹8,388',
    annualSavings: '₹1,02,012',
    savingsPct: '92%',
    leadPulseBarPct: 8,
    instances: [
      {
        id: '01',
        title: 'B2B Lead Discovery & Spatial Extraction',
        replaces: 'Apollo / Lusha / ZoomInfo',
        scenario: 'Extracting 500 to 600 verified commercial prospects across targeted city zones every month.',
        marketPrice: '₹4,100 / mo',
        marketSub: '$49/mo static database credits',
        marketFlaw: 'Stale recycled lists & credit lock-in',
        ourPrice: '₹699 / mo',
        ourBadge: 'Or ₹1/lead Mega Pack',
        ourSub: '600 tokens/mo • Live Google Maps extraction',
        ourAdvantage: 'Real-time Quick & Deep multi-page scraping',
        savingsTag: 'Save ₹3,400/mo',
        barPct: 16,
      },
      {
        id: '02',
        title: 'AI Cold Email Studio, A/B Testing & Multi-Channel',
        replaces: 'Instantly / Lemlist',
        scenario: 'Synthesizing personalized outreach copy per lead, 50/50 A/B split tests, and inbox + WhatsApp dispatch.',
        marketPrice: '₹3,100 / mo',
        marketSub: '$37/mo for email sender only (0 leads)',
        marketFlaw: 'Separate subscription + no WhatsApp bridge',
        ourPrice: '₹0 Extra',
        ourBadge: 'Built Native',
        ourSub: 'AI Copilot + 8 Templates + SMTP & WhatsApp',
        ourAdvantage: 'Zero add-on fee inside your workspace',
        savingsTag: 'Save ₹3,100/mo',
        barPct: 4,
      },
      {
        id: '03',
        title: 'Kanban CRM, Automated Journeys & Team Pool',
        replaces: 'HubSpot / Pipedrive',
        scenario: 'Managing deal stages, automated follow-up sequences, Google Sheets mirroring, and webhook telemetry.',
        marketPrice: '₹2,000 / mo',
        marketSub: '$24/mo base CRM subscription',
        marketFlaw: 'Charges extra for automation & webhooks',
        ourPrice: '₹0 Extra',
        ourBadge: 'Included Free',
        ourSub: '6-Stage Resizable Kanban + Live Sheet Sync',
        ourAdvantage: 'Full CRM & automation included on every tier',
        savingsTag: 'Save ₹2,000/mo',
        barPct: 4,
      },
    ],
  },
  agency: {
    label: 'Growth Agency (5 Seats)',
    seats: '5 Seats',
    leadsPerMo: '600 to 1,500 Leads/mo',
    marketTotal: '₹24,500',
    marketAnnual: '₹2,94,000',
    leadPulsePlan: 'Basic / Pro Shared Pool',
    leadPulseTotal: '₹699 to ₹1,999',
    leadPulseAnnual: '₹8,388',
    annualSavings: '₹2,70,000+',
    savingsPct: '94%',
    leadPulseBarPct: 6,
    instances: [
      {
        id: '01',
        title: 'B2B Lead Discovery & Spatial Extraction',
        replaces: 'Apollo / Lusha / ZoomInfo',
        scenario: 'A digital agency extracting 600 to 1,500 verified local & B2B prospects across targeted metropolitan zones monthly.',
        marketPrice: '₹8,500 / mo',
        marketSub: '$99/mo multi-user scraping & export credits',
        marketFlaw: 'Strict export caps & per-credit overages',
        ourPrice: '₹699 / mo',
        ourBadge: 'Or ₹1/lead Mega Pack',
        ourSub: 'Live Quick (20) & Deep (60) spatial extraction',
        ourAdvantage: '100% public verified phones, ratings & domains',
        savingsTag: 'Save ~₹7,800/mo',
        barPct: 9,
      },
      {
        id: '02',
        title: 'AI Cold Email Studio, A/B Testing & Multi-Channel',
        replaces: 'Instantly / Lemlist',
        scenario: 'Running multi-client AI outreach campaigns with 50/50 A/B split testing across Gmail, Resend, SMTP & WhatsApp.',
        marketPrice: '₹6,000 / mo',
        marketSub: '$72/mo agency sender tier (zero leads)',
        marketFlaw: 'Manual CSV uploads between scraper & sender',
        ourPrice: '₹0 Extra',
        ourBadge: 'Built Native',
        ourSub: '8 Link Mobility Architectures + AI Copilot',
        ourAdvantage: '1-click synthesis & dispatch from scraped leads',
        savingsTag: 'Save ~₹6,000/mo',
        barPct: 4,
      },
      {
        id: '03',
        title: 'Kanban CRM, Automated Journeys & Multi-Seat Teams',
        replaces: 'HubSpot / Pipedrive',
        scenario: 'Managing a 5-person revenue squad with automated follow-up workflows, Google Sheets sync, and shared lead pools.',
        marketPrice: '₹10,000 / mo',
        marketSub: '₹2,000 × 5 seats per-user billing tax',
        marketFlaw: 'Penalizes agency growth with per-seat fees',
        ourPrice: 'Universal Pool',
        ourBadge: 'Zero Per-Seat Tax',
        ourSub: '50% seats on Basic (₹699) • 100% seats on Pro (₹1,999)',
        ourAdvantage: 'Share workspace tokens across registered seats',
        savingsTag: 'Save ~₹10,000/mo',
        barPct: 7,
      },
    ],
  },
  scale: {
    label: 'Revenue Squad (10 Seats)',
    seats: '10 Seats',
    leadsPerMo: '1,500+ Leads/mo',
    marketTotal: '₹44,900',
    marketAnnual: '₹5,38,800',
    leadPulsePlan: 'Pro Tier (100% Seats)',
    leadPulseTotal: '₹1,999',
    leadPulseAnnual: '₹23,988',
    annualSavings: '₹5,14,800+',
    savingsPct: '95%',
    leadPulseBarPct: 5,
    instances: [
      {
        id: '01',
        title: 'B2B Lead Discovery & Spatial Extraction',
        replaces: 'Apollo / Lusha / ZoomInfo',
        scenario: 'High-velocity commercial squad harvesting 1,500+ verified prospects monthly with Deep 60-lead pagination.',
        marketPrice: '₹12,500 / mo',
        marketSub: '$149/mo commercial data license',
        marketFlaw: 'Annual lock-in contracts & seat restrictions',
        ourPrice: '₹1,999 / mo',
        ourBadge: '1,500 Tokens/mo + Top-Ups',
        ourSub: 'Includes Deep 60-lead sweeps & ₹1/lead top-ups',
        ourAdvantage: 'Instant UPI top-ups anytime, zero lock-in',
        savingsTag: 'Save ~₹10,500/mo',
        barPct: 14,
      },
      {
        id: '02',
        title: 'AI Cold Email Studio, A/B Testing & Multi-Channel',
        replaces: 'Instantly / Lemlist',
        scenario: 'Full-scale A/B split testing, custom HTML & attachment dispatch, and direct WhatsApp bridge across 10 reps.',
        marketPrice: '₹7,900 / mo',
        marketSub: '$97/mo pro outreach automation tier',
        marketFlaw: 'Disconnected from CRM stage transitions',
        ourPrice: '₹0 Extra',
        ourBadge: 'Built Native',
        ourSub: 'Unlimited AI Copilot + Multi-Provider Relay',
        ourAdvantage: 'Native Gmail, Resend, SendGrid & Custom SMTP',
        savingsTag: 'Save ~₹7,900/mo',
        barPct: 4,
      },
      {
        id: '03',
        title: 'Kanban CRM, Automated Journeys & Multi-Seat Teams',
        replaces: 'HubSpot / Pipedrive',
        scenario: '10 sales reps collaborating on a shared token pool with live Google Sheets mirroring, Slack/Discord alerts & webhooks.',
        marketPrice: '₹24,500 / mo',
        marketSub: '₹2,450 × 10 seats CRM + workflow add-ons',
        marketFlaw: 'Massive per-seat bloat as headcount scales',
        ourPrice: '100% Seats Included',
        ourBadge: 'Zero Per-Seat Tax',
        ourSub: 'All 10 registered team seats share the Pro pool',
        ourAdvantage: 'One flat ₹1,999/mo bill for the entire squad',
        savingsTag: 'Save ~₹24,500/mo',
        barPct: 5,
      },
    ],
  },
} as const;

const Landing = ({ onLogin }: { onLogin: () => void }) => {
  const { token } = useStore();
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5], [60, 0]);

  // Modal states for footer
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [benchmarkScale, setBenchmarkScale] = useState<'solo' | 'agency' | 'scale'>('agency');
  const activeBenchmark = benchmarkProfiles[benchmarkScale];

  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.15 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 75, damping: 16 } }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden font-sans text-[#191716] bg-[#FAF8F5] flex flex-col selection:bg-[#C85A32] selection:text-white relative">
      
      {/* Warm Linen & Editorial Paper Architectural Canvas */}
      <MeshBackground variant="landing" />

      {/* ================= 1. NAVBAR ================= */}
      <header className="sticky top-0 z-50 border-b border-[#E5E0D5] bg-[#FAF8F5]/90 backdrop-blur-md">
        <motion.nav 
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between px-6 md:px-12 py-4 max-w-7xl mx-auto w-full"
        >
          <a 
            href="/" 
            className="flex items-center gap-2.5 group cursor-pointer hover:opacity-90 transition-all select-none"
            title="LeadPulse Home"
          >
            <div className="w-8 h-8 rounded-[6px] overflow-hidden bg-[#191716] flex items-center justify-center p-1 border border-[#E5E0D5] shadow-2xs group-hover:border-[#C85A32] group-hover:scale-105 transition-all shrink-0">
              <img 
                src={leadPulseLogo} 
                alt="LeadPulse Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[17px] tracking-tight text-[#191716] group-hover:text-[#C85A32] transition-colors leading-none">
                  LeadPulse
                </span>
                <span className="text-[9.5px] font-delight font-bold uppercase bg-[#F5F2EB] text-[#C85A32] border border-[#E5E0D5] px-1.5 py-0.5 rounded-[4px] tracking-wider leading-none">
                  v1.0
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9.5px] font-delight font-semibold text-[#78716A] uppercase tracking-wider">A</span>
                <img src={docuReadyBlackLogo} alt="DocuReady" className="h-3 w-auto object-contain opacity-85" />
                <span className="text-[9.5px] font-delight font-semibold text-[#78716A] uppercase tracking-wider">Entity</span>
              </div>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-7 text-[11px] font-delight font-bold tracking-widest uppercase text-[#57524B]">
            <a href="#product" className="hover:text-[#C85A32] transition-colors">Platform</a>
            <a href="#features" className="hover:text-[#C85A32] transition-colors">Capabilities</a>
            <a href="#docuready" className="hover:text-[#C85A32] transition-colors">Why DocuReady</a>
            <a href="#pricing" className="hover:text-[#C85A32] transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-xs font-delight font-semibold text-[#57524B] hover:text-[#191716] transition-colors px-2.5 py-1.5 cursor-pointer"
            >
              {token ? 'Dashboard' : 'Sign In'}
            </button>
            <button
              onClick={onLogin}
              className="h-8.5 px-4 bg-[#191716] text-[#FAF8F5] rounded-[5px] font-delight font-semibold text-xs hover:bg-[#C85A32] transition-colors border border-[#191716] hover:border-[#C85A32] shadow-xs cursor-pointer"
            >
              {token ? 'Go to Console' : 'Launch Console'} &rarr;
            </button>
          </div>
        </motion.nav>
      </header>

      {/* ================= 2. HERO SECTION (2-COLUMN LEFT ALIGNED) ================= */}
      <section className="relative pt-14 pb-24 px-6 md:px-12 max-w-7xl mx-auto w-full z-10">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          
          {/* Left Column: Editorial Typography */}
          <motion.div 
            variants={containerVars}
            initial="hidden"
            animate="show"
            className="flex flex-col items-start text-left z-10"
          >
            <motion.div
              variants={itemVars}
              className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-[5px] border border-[#E5E0D5] bg-[#F5F2EB] text-[11px] font-delight font-bold text-[#57524B] tracking-wide"
            >
              <span>LEADPULSE 3.0 // ARCHITECTURE RELEASE</span>
              <span className="w-1 h-1 rounded-full bg-[#D6CFC2] mx-0.5"></span>
              <a href="#product" className="text-[#C85A32] hover:underline flex items-center gap-1">
                Specs &rarr;
              </a>
            </motion.div>

            <motion.h1 
              variants={itemVars}
              className="text-4xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight text-[#191716] leading-[1.07] mb-5"
            >
              The intelligent <br /> revenue operating engine for{' '}
              <span className="text-[#C85A32] font-serif italic font-normal">
                commercial sales teams.
              </span>
            </motion.h1>

            <motion.p
              variants={itemVars}
              className="text-sm md:text-[15.5px] text-[#57524B] font-normal max-w-lg mb-8 leading-relaxed"
            >
              Consolidate disconnected prospecting point solutions. LeadPulse unifies precision entity discovery, generative AI message synthesis, and multi-channel pipeline dispatch in one developer-grade console.
            </motion.p>

            <motion.div variants={itemVars} className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onLogin}
                className="w-full sm:w-auto h-11 px-6 bg-[#C85A32] text-white rounded-[6px] font-delight font-bold text-[13px] hover:bg-[#B04B25] transition-all flex items-center justify-center gap-2 border border-[#B04B25] shadow-xs cursor-pointer"
              >
                {token ? 'Go to Dashboard' : 'Launch Workspace'} &rarr;
              </button>
              <a
                href="#product"
                className="w-full sm:w-auto h-11 px-5 bg-[#F5F2EB] border border-[#D6CFC2] text-[#191716] rounded-[6px] font-delight font-semibold text-[13px] hover:bg-[#EFECE4] transition-colors flex items-center justify-center gap-1"
              >
                Inspect Platform &rarr;
              </a>
            </motion.div>

            <motion.div variants={itemVars} className="mt-4 flex items-center gap-2 text-[11px] font-delight font-semibold text-[#78716A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span>
              <span>Instant access • Application Default Credentials • Zero bloat</span>
            </motion.div>
          </motion.div>

          {/* Right Column: Technical Composition */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, type: "spring" }}
            className="relative w-full h-[460px] lg:h-[500px]"
          >
            {/* Main Architectural Frame */}
            <motion.div 
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-lg overflow-hidden shadow-lg border border-[#D6CFC2] ml-6 lg:ml-9 mt-8 bg-[#191716]"
            >
              <img 
                src="https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop" 
                alt="Sales team collaborating" 
                className="w-full h-full object-cover opacity-75 mix-blend-luminosity"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(25, 23, 22, 0.82) 0%, rgba(25, 23, 22, 0.25) 55%, rgba(200, 90, 50, 0.32) 100%)'
                }}
              />
              <div className="absolute top-4 right-4 bg-[#191716]/80 backdrop-blur-xs border border-white/15 text-[#F5F2EB] px-2.5 py-1 rounded-[4px] text-[10px] font-delight font-semibold tracking-wider uppercase">
                WORKSPACE // LIVE STREAM
              </div>
            </motion.div>

            {/* Floating Vector UI 1: Telemetry Card */}
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="absolute top-2 left-0 w-72 bg-white rounded-lg shadow-xl border border-[#D6CFC2] overflow-hidden z-20 text-[#191716]"
            >
              <div className="h-8.5 bg-[#F5F2EB] border-b border-[#E5E0D5] flex items-center px-3 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#C85A32]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#D6CFC2]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#D6CFC2]"></div>
                </div>
                <div className="ml-auto text-[10px] font-delight font-bold text-[#78716A] uppercase tracking-wider">
                  TELEMETRY_FEED
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-delight font-bold text-[#191716]">MQL Conversion Rate</div>
                    <div className="text-[10.5px] font-delight text-[#78716A]">+24.8% vs prior cohort</div>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 h-20 mt-2">
                  {[42, 68, 50, 92, 74].map((h, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.9, delay: 0.8 + (i * 0.1) }}
                      className={`flex-1 rounded-t-[3px] transition-colors ${
                        i === 3 ? 'bg-[#C85A32]' : 'bg-[#191716] hover:bg-[#C85A32]'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#E5E0D5] flex items-center justify-between text-[11px] font-delight">
                  <span className="text-[#78716A]">Verified Domain Match</span>
                  <span className="font-bold text-[#191716] tabular-nums">94.2%</span>
                </div>
              </div>
            </motion.div>

            {/* Floating Vector UI 2: Dispatch Notification */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="absolute bottom-5 left-5 bg-[#191716] p-3.5 rounded-[7px] shadow-xl flex items-center gap-3 z-30 text-[#FAF8F5] border border-[#332E2B]"
            >
              <div>
                <div className="text-xs font-delight font-bold text-white">Campaign Dispatched</div>
                <div className="text-[10.5px] font-delight text-[#A8A096] tabular-nums">
                  Variant B • 68.4% open rate • SMTP 200 OK
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* ================= 3. PLATFORM ARCHITECTURE SHOWCASE (id="product") ================= */}
      <section id="product" className="py-22 px-6 md:px-12 max-w-7xl mx-auto w-full relative z-10 scroll-mt-20 border-t border-[#E5E0D5]">
        <div className="text-left mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[5px] border border-[#E5E0D5] bg-[#F5F2EB] text-[11px] font-delight font-bold text-[#57524B] mb-3.5">
            <span>UNIFIED ARCHITECTURE // THREE ENGINES</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#191716] mb-3.5">
            Three core engines. One integrated workspace.
          </h2>
          <p className="text-sm md:text-[15px] text-[#57524B] font-normal leading-relaxed">
            Eliminate fragmented tools. LeadPulse connects precision prospect harvesting, generative AI email &amp; WhatsApp delivery, and visual CRM pipeline automation into an interconnected ledger.
          </p>
        </div>

        {/* Unified 3-Column 1px Divided Architectural Ledger */}
        <div className="bg-white border border-[#E5E0D5] rounded-lg grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E5E0D5] overflow-hidden shadow-2xs">
          
          {/* Engine 1 */}
          <div className="p-8 hover:bg-[#FAF8F5]/70 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="text-[10.5px] font-delight font-bold uppercase tracking-wider text-[#C85A32] block">
                Discovery
              </span>
              <h3 className="text-lg font-extrabold tracking-tight text-[#191716]">
                Lead Finder &amp; Geo-Database
              </h3>
              <p className="text-[13px] text-[#57524B] leading-relaxed">
                Extract verified local and commercial business records in seconds. Access real-time public registries, validated websites, and physical locations with zero synthetic or spoofed emails.
              </p>
            </div>
            <div className="pt-4 border-t border-[#E5E0D5] flex items-center justify-between text-xs font-delight font-semibold text-[#78716A]">
              <span>Spatial Extraction</span>
              <button
                onClick={onLogin}
                className="text-[#191716] hover:text-[#C85A32] flex items-center gap-1 font-delight font-bold text-xs cursor-pointer transition-colors"
              >
                Explore Finder &rarr;
              </button>
            </div>
          </div>

          {/* Engine 2 */}
          <div className="p-8 hover:bg-[#FAF8F5]/70 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="text-[10.5px] font-delight font-bold uppercase tracking-wider text-[#C85A32] block">
                Dispatch
              </span>
              <h3 className="text-lg font-extrabold tracking-tight text-[#191716]">
                Outreach Studio &amp; AI Copilot
              </h3>
              <p className="text-[13px] text-[#57524B] leading-relaxed">
                Generate high-converting personalized pitches via AI hook strategies. Dispatch production-grade cold emails via custom SMTP relays or initiate 1-click WhatsApp web conversations.
              </p>
            </div>
            <div className="pt-4 border-t border-[#E5E0D5] flex items-center justify-between text-xs font-delight font-semibold text-[#78716A]">
              <span>Email &amp; WhatsApp Relays</span>
              <button
                onClick={onLogin}
                className="text-[#191716] hover:text-[#C85A32] flex items-center gap-1 font-delight font-bold text-xs cursor-pointer transition-colors"
              >
                Explore Studio &rarr;
              </button>
            </div>
          </div>

          {/* Engine 3 */}
          <div className="p-8 hover:bg-[#FAF8F5]/70 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="text-[10.5px] font-delight font-bold uppercase tracking-wider text-[#C85A32] block">
                Pipeline
              </span>
              <h3 className="text-lg font-extrabold tracking-tight text-[#191716]">
                Kanban Pipeline &amp; Journeys
              </h3>
              <p className="text-[13px] text-[#57524B] leading-relaxed">
                Organize commercial prospects across interactive Kanban stages. Track deal momentum, configure automated multi-step journeys, and advance conversion stages seamlessly.
              </p>
            </div>
            <div className="pt-4 border-t border-[#E5E0D5] flex items-center justify-between text-xs font-delight font-semibold text-[#78716A]">
              <span>Behavioral Triggers</span>
              <button
                onClick={onLogin}
                className="text-[#191716] hover:text-[#C85A32] flex items-center gap-1 font-delight font-bold text-xs cursor-pointer transition-colors"
              >
                Explore Pipeline &rarr;
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ================= 5. BENTO GRID CAPABILITIES (id="features") ================= */}
      <section id="features" ref={targetRef} className="py-16 px-6 md:px-12 max-w-7xl mx-auto w-full relative z-10 scroll-mt-20">
        <motion.div style={{ opacity, y }} className="text-left mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[5px] border border-[#E5E0D5] bg-[#F5F2EB] text-[11px] font-delight font-bold text-[#57524B] mb-3.5">
            <span>PRODUCTION TELEMETRY // BENTO SPECIFICATIONS</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#191716] mb-3.5">
            Engineered capabilities for predictable pipeline growth.
          </h2>
          <p className="text-sm md:text-[15px] text-[#57524B] font-normal leading-relaxed">
            By fusing spatial audience data with AI-assisted delivery, LeadPulse ensures outbound messages are targeted, context-rich, and free from automated spam markers.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-min">
          
          {/* Feature 1 - Large spanning 2 cols */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="md:col-span-2 bg-white border border-[#E5E0D5] rounded-lg overflow-hidden relative flex flex-col justify-between p-8 hover:border-[#D6CFC2] transition-colors"
          >
            <div>
              <h3 className="text-xl font-extrabold text-[#191716] mb-2 tracking-tight">Real-Time Lead Harvesting</h3>
              <p className="text-[13.5px] text-[#57524B] leading-relaxed max-w-xl">
                Query verified commercial listings on demand. Filter by targeted metropolitan regions, industry categories, and operational status without relying on stale third-party databases.
              </p>
            </div>

            {/* Mini Harvested Entity Ledger */}
            <div className="mt-6 border border-[#E5E0D5] rounded-[6px] overflow-hidden bg-white font-delight text-xs">
              <div className="px-3.5 py-2 bg-[#F5F2EB] border-b border-[#E5E0D5] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#78716A]">
                <span>Harvested Entity</span>
                <span className="hidden sm:inline">Domain &amp; MX Verification</span>
                <span>Rating</span>
              </div>
              <div className="px-3.5 py-2.5 border-b border-[#E5E0D5] flex items-center justify-between">
                <span className="font-bold text-[#191716]">Meridian Cloud Systems • Austin, TX</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  hello@meridiancloud.io (Verified)
                </span>
                <span className="font-bold text-[#C85A32] tabular-nums">★ 4.9 (214)</span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="font-bold text-[#191716]">Vanguard Logistics • Dallas, TX</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  ops@vanguardfreight.com (Verified)
                </span>
                <span className="font-bold text-[#C85A32] tabular-nums">★ 4.8 (162)</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 - Small (Warm Linen Surface) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="bg-[#F5F2EB] border border-[#E5E0D5] rounded-lg p-8 relative overflow-hidden flex flex-col justify-between hover:border-[#D6CFC2] transition-colors"
          >
            <div>
              <h3 className="text-xl font-extrabold text-[#191716] mb-2 tracking-tight">Automated Journeys</h3>
              <p className="text-[13px] text-[#57524B] leading-relaxed">
                Design multi-stage nurturing sequences triggered by prospect engagement, status transitions, and custom delays.
              </p>
            </div>

            <div className="mt-6 border border-[#E5E0D5] rounded-[6px] overflow-hidden bg-white font-delight text-[11.5px]">
              <div className="px-3.5 py-2.5 border-b border-[#E5E0D5] flex items-center justify-between">
                <span className="text-[#78716A] font-semibold">01. WHEN</span>
                <span className="font-bold text-[#191716]">Lead Harvested (★ &ge; 4.5)</span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[#C85A32] font-bold">02. THEN</span>
                <span className="font-bold text-[#C85A32]">Dispatch AI Pitch + Slack</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 3 - Small (Warm Linen Surface) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-[#F5F2EB] border border-[#E5E0D5] rounded-lg p-8 relative overflow-hidden flex flex-col justify-between hover:border-[#D6CFC2] transition-colors"
          >
            <div>
              <h3 className="text-xl font-extrabold text-[#191716] mb-2 tracking-tight">Multi-Channel Delivery</h3>
              <p className="text-[13px] text-[#57524B] leading-relaxed">
                Reach decision-makers via verified corporate email relays and direct WhatsApp conversational frameworks.
              </p>
            </div>

            <div className="mt-6 border border-[#E5E0D5] rounded-[6px] overflow-hidden bg-white font-delight text-[11.5px]">
              <div className="px-3.5 py-2.5 border-b border-[#E5E0D5] flex items-center justify-between">
                <span className="text-[#57524B]">Custom SMTP Relay</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> TLS 1.3 Active
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[#57524B]">WhatsApp Direct Bridge</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#C85A32]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]"></span> Instant Sync
                </span>
              </div>
            </div>
          </motion.div>

          {/* Feature 4 - Large spanning 2 cols */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="md:col-span-2 bg-white border border-[#E5E0D5] rounded-lg p-8 relative overflow-hidden flex flex-col justify-between hover:border-[#D6CFC2] transition-colors"
          >
            <div>
              <h3 className="text-xl font-extrabold text-[#191716] mb-2 tracking-tight">
                Contextual AI Copilot (Delight Auto-Fill Engine)
              </h3>
              <p className="text-[13.5px] text-[#57524B] leading-relaxed max-w-xl">
                Synthesize customized email copy and conversation starters tailored to your prospect's business profile without generic AI buzzwords or spam triggers.
              </p>
            </div>

            <div className="mt-6 bg-[#191716] border border-[#2E2A27] rounded-[6px] p-4 text-[#FAF8F5] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-delight font-bold text-white">AI Email Copilot • Auto-Fill Studio Card</div>
                <div className="text-[10.5px] font-delight text-[#A8A096]">
                  Tone: Direct Executive • Hook: Google Maps Reputation + Audit
                </div>
              </div>
              <button
                onClick={onLogin}
                className="text-[11px] font-delight font-bold px-3 py-1.5 rounded-[4px] bg-[#C85A32]/20 border border-[#E07A5F]/40 text-[#E07A5F] hover:bg-[#C85A32] hover:text-white transition-colors cursor-pointer"
              >
                1-Click Synthesize &rarr;
              </button>
            </div>
          </motion.div>
        </div>

        {/* Unified 4-Column Divided Telemetry Benchmark Bar */}
        <div
          id="benchmarks"
          className="mt-6 bg-[#F5F2EB] border border-[#E5E0D5] rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E0D5] overflow-hidden scroll-mt-24"
        >
          <div className="p-5.5">
            <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#78716A]">
              Spatial Extraction Speed
            </div>
            <div className="text-2xl font-delight font-extrabold text-[#191716] mt-1 tabular-nums">&lt; 1.8s</div>
          </div>
          <div className="p-5.5">
            <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#78716A]">
              Zero Spoofed Records
            </div>
            <div className="text-2xl font-delight font-extrabold text-[#191716] mt-1 tabular-nums">100% Public</div>
          </div>
          <div className="p-5.5">
            <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#78716A]">
              Pipeline Stages
            </div>
            <div className="text-2xl font-delight font-extrabold text-[#191716] mt-1 tabular-nums">6 Kanban</div>
          </div>
          <div className="p-5.5">
            <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#78716A]">
              Avg. Reply Velocity
            </div>
            <div className="text-2xl font-delight font-extrabold text-[#C85A32] mt-1 tabular-nums">3.4x Faster</div>
          </div>
        </div>
      </section>

      {/* ================= MARQUEE SECTION (BEFORE WHY DOCUREADY) ================= */}
      <section className="py-10 border-y border-[#E5E0D5] bg-[#F5F2EB] overflow-hidden w-full relative z-10">
        <p className="text-center text-[11px] font-delight font-bold text-[#78716A] mb-7 uppercase tracking-[0.14em]">
          Powering revenue teams at modern commercial organizations
        </p>
        <div className="w-full inline-flex flex-nowrap overflow-hidden pointer-events-none select-none [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
          <div className="flex items-center shrink-0 w-max gap-16 pr-16 animate-marquee">
            {[...companies, ...companies].map((company, i) => {
              const Icon = company.icon;
              return (
                <div key={i} className="flex items-center gap-3 opacity-85">
                  <div className="w-7 h-7 rounded-[5px] bg-white border border-[#D6CFC2] flex items-center justify-center text-[#C85A32]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-extrabold tracking-tight text-[#191716]">{company.name}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center shrink-0 w-max gap-16 pr-16 animate-marquee" aria-hidden="true">
            {[...companies, ...companies].map((company, i) => {
              const Icon = company.icon;
              return (
                <div key={i + 'dup'} className="flex items-center gap-3 opacity-85">
                  <div className="w-7 h-7 rounded-[5px] bg-white border border-[#D6CFC2] flex items-center justify-center text-[#C85A32]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-extrabold tracking-tight text-[#191716]">{company.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 6. WHY DOCUREADY ENGINEERED LEADPULSE (id="docuready") ================= */}
      <section id="docuready" className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full relative z-10 scroll-mt-20">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column (5 Cols): DocuReady Entity Story & What We Offer */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-[5px] border border-[#E5E0D5] bg-[#F5F2EB]">
              <img src={docuReadyBlackLogo} alt="DocuReady" className="h-4 w-auto object-contain" />
              <span className="w-1 h-1 rounded-full bg-[#C85A32]"></span>
              <span className="text-[10.5px] font-delight font-bold uppercase tracking-wider text-[#57524B]">
                Engineering Manifesto
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#191716] leading-[1.12]">
              How we as <span className="text-[#C85A32] font-serif italic font-normal">DocuReady</span> focused on making LeadPulse genuinely worth it.
            </h2>

            <p className="text-sm md:text-[14.5px] text-[#57524B] leading-relaxed">
              When our engineering team at <strong>DocuReady</strong> audited the modern B2B sales stack, we saw agencies, founders, and commercial teams paying <strong>₹12,000 to ₹45,000+ every single month</strong> across four disconnected subscriptions: one for scraping leads, another for email warmup, a third for AI copywriting, and a fourth per-seat CRM.
            </p>

            <p className="text-sm md:text-[14.5px] text-[#57524B] leading-relaxed">
              We engineered <strong>LeadPulse</strong> as a flagship <strong>DocuReady Entity</strong> with one uncompromising mandate: collapse that entire fragmented stack into a single, self-contained revenue operating system, priced so transparently that a single closed deal pays for an entire year of compute.
            </p>

            {/* What We Offer Pillar Box */}
            <div className="bg-white border border-[#E5E0D5] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-3">
                <span className="text-[11px] font-delight font-bold uppercase tracking-wider text-[#191716]">
                  What DocuReady Delivers Inside LeadPulse
                </span>
                <img src={docuReadyBlackLogo} alt="DocuReady" className="h-3.5 w-auto object-contain opacity-80" />
              </div>

              <ul className="space-y-2.5 text-xs text-[#57524B]">
                <li className="flex items-start gap-2.5">
                  <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                  <span><strong>Live Spatial Lead Harvesting:</strong> Direct geo-targeted business extraction with verified websites, ratings, and phones with zero recycled lists.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                  <span><strong>8 Link Mobility Email Architectures + AI Copilot:</strong> Synthesize personalized pitches and dispatch via Gmail, Resend, or custom SMTP with 50/50 A/B split testing.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                  <span><strong>WhatsApp Direct Bridge &amp; Behavioral Journeys:</strong> Trigger multi-step follow-ups and 1-click WhatsApp conversations alongside email.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                  <span><strong>6-Stage Kanban CRM &amp; Universal Team Tokens:</strong> Share your workspace token pool across registered seats without per-seat price gouging.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column (7 Cols): Repolished Intuitive Real-World Cost Benchmarking Studio */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#D6CFC2] rounded-xl overflow-hidden shadow-sm">
              
              {/* Studio Header + Interactive Team Size Switcher */}
              <div className="p-5 sm:p-6 bg-[#F5F2EB] border-b border-[#E5E0D5] space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-delight font-bold uppercase tracking-widest text-[#C85A32] mb-1">
                      <span>REAL-WORLD COST BENCHMARKING // LIVE STACK AUDIT</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[#191716] tracking-tight">
                      Fragmented Market Stack vs. DocuReady&apos;s LeadPulse
                    </h3>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-delight font-bold shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>Save {activeBenchmark.savingsPct} ({activeBenchmark.annualSavings}/yr)</span>
                  </div>
                </div>

                {/* Interactive Scenario Preset Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] font-delight font-semibold text-[#78716A]">
                    <span>SELECT YOUR TEAM PROFILE TO COMPARE MONTHLY BURN:</span>
                    <span className="text-[#191716] font-bold">{activeBenchmark.seats} • {activeBenchmark.leadsPerMo}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-[7px] bg-[#EAE5DA] border border-[#D6CFC2]">
                    {(['solo', 'agency', 'scale'] as const).map((key) => {
                      const prof = benchmarkProfiles[key];
                      const isActive = benchmarkScale === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setBenchmarkScale(key)}
                          className={`py-2 px-2.5 rounded-[5px] text-center transition-all cursor-pointer font-delight ${
                            isActive
                              ? 'bg-[#191716] text-white shadow-xs'
                              : 'text-[#57524B] hover:text-[#191716] hover:bg-white/60'
                          }`}
                        >
                          <div className="text-[11px] font-bold leading-tight">{prof.label}</div>
                          <div className={`text-[9.5px] mt-0.5 ${isActive ? 'text-[#E07A5F]' : 'text-[#78716A]'}`}>
                            {prof.leadsPerMo}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Visual Total Monthly Burn Meter (Instant At-A-Glance Bar) */}
                <div className="p-4 rounded-lg bg-white border border-[#E5E0D5] space-y-3">
                  {/* Market Burn Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-delight">
                      <span className="font-semibold text-[#57524B] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-[#9C9488]"></span>
                        3 Separate Market Subscriptions (Scraper + Sender + CRM)
                      </span>
                      <span className="font-bold text-[#78716A] line-through tabular-nums">
                        {activeBenchmark.marketTotal} / mo
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#F5F2EB] overflow-hidden border border-[#E5E0D5]">
                      <div className="h-full bg-[#9C9488]/65 rounded-full w-full transition-all duration-500"></div>
                    </div>
                  </div>

                  {/* LeadPulse Burn Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-delight">
                      <span className="font-extrabold text-[#191716] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-[#C85A32]"></span>
                        LeadPulse Unified OS ({activeBenchmark.leadPulsePlan})
                      </span>
                      <span className="font-extrabold text-[#C85A32] tabular-nums">
                        {activeBenchmark.leadPulseTotal} / mo
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#FDF3EF] overflow-hidden border border-[#F2D0C2]">
                      <div
                        className="h-full bg-[#C85A32] rounded-full transition-all duration-500"
                        style={{ width: `${activeBenchmark.leadPulseBarPct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Stack Breakdown Cards */}
              <div className="divide-y divide-[#E5E0D5]">
                {activeBenchmark.instances.map((item) => {
                  return (
                    <div key={item.id} className="p-5 sm:p-6 hover:bg-[#FAF8F5]/70 transition-colors space-y-3.5">
                      {/* Top Row: Title + Replaced Tools + Savings Pill */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-[#191716] tracking-tight">
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#57524B] leading-relaxed">
                            {item.scenario}
                          </p>
                        </div>
                        <span className="text-[10.5px] font-delight font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-[4px] shrink-0">
                          {item.savingsTag}
                        </span>
                      </div>

                      {/* Side-by-Side Comparison Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-delight">
                        {/* Legacy Market Card */}
                        <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E5E0D5] flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-[#78716A] font-semibold">
                              <span>Legacy Stack ({item.replaces})</span>
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#EAE5DA] text-[#57524B]">External Tool</span>
                            </div>
                            <div className="text-base font-extrabold text-[#78716A] line-through mt-1 tabular-nums">
                              {item.marketPrice}
                            </div>
                            <div className="text-[11px] text-[#78716A] mt-0.5">
                              {item.marketSub}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#E5E0D5] flex items-center gap-1.5 text-[11px] text-[#78716A]">
                            <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{item.marketFlaw}</span>
                          </div>
                        </div>

                        {/* LeadPulse Native Card */}
                        <div className="p-3.5 rounded-lg bg-[#FDF6F3] border border-[#C85A32]/40 flex flex-col justify-between space-y-2 relative overflow-hidden">
                          <div>
                            <div className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-[#C85A32] font-bold">
                              <span>LeadPulse by DocuReady</span>
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#C85A32] text-white font-bold">
                                {item.ourBadge}
                              </span>
                            </div>
                            <div className="text-base font-extrabold text-[#191716] mt-1 tabular-nums">
                              {item.ourPrice}
                            </div>
                            <div className="text-[11px] text-[#57524B] mt-0.5 font-medium">
                              {item.ourSub}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#F2D0C2] flex items-center gap-1.5 text-[11px] text-[#191716] font-semibold">
                            <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                            <span>{item.ourAdvantage}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Espresso Total Scoreboard Bar with White DocuReady Logo */}
              <div className="p-5 sm:p-6 bg-[#191716] text-[#FAF8F5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img src={docuReadyWhiteLogo} alt="DocuReady" className="h-5 w-auto object-contain shrink-0" />
                  <div className="border-l border-white/20 pl-3.5 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-delight font-bold text-white">
                      <span>Market Stack: <span className="line-through text-[#A8A096]">{activeBenchmark.marketTotal}/mo</span></span>
                      <span className="text-[#C85A32]">&rarr;</span>
                      <span>LeadPulse: <span className="text-[#E07A5F]">{activeBenchmark.leadPulseTotal}/mo</span></span>
                    </div>
                    <div className="text-[11px] font-delight text-[#A8A096]">
                      Keep <strong className="text-emerald-400">{activeBenchmark.annualSavings} every year</strong> inside your business, or start right now with 15 free tokens.
                    </div>
                  </div>
                </div>
                <button
                  onClick={onLogin}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-[5px] bg-[#C85A32] hover:bg-[#B04B25] text-white text-xs font-delight font-bold transition-colors shrink-0 cursor-pointer text-center shadow-xs"
                >
                  Claim 15 Free Tokens &rarr;
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= 7. DETAILED PRICING & BIFURCATION SECTION (id="pricing") ================= */}
      <section id="pricing" className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full relative z-10 scroll-mt-20 border-t border-[#E5E0D5]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[5px] border border-[#E5E0D5] bg-[#F5F2EB] text-[11px] font-delight font-bold text-[#57524B] mb-3.5">
              <span>TRANSPARENT PRICING // DETAILED COST BIFURCATION</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#191716] mb-3">
              Engineered to cost less than your daily coffee.
            </h2>
            <p className="text-sm md:text-[15px] text-[#57524B] font-normal leading-relaxed">
              Step inside with <strong>15 free lead tokens</strong> waiting in your workspace with no credit card and no lock-in. When you&apos;re ready to scale, upgrade for just <strong>₹23/day</strong> or top up on demand starting at <strong>₹50</strong>.
            </p>
          </div>

          <div className="bg-[#F5F2EB] border border-[#E5E0D5] rounded-md px-4 py-3 flex items-center gap-3 shrink-0">
            <img src={docuReadyBlackLogo} alt="DocuReady" className="h-4 w-auto object-contain" />
            <div className="text-xs font-delight">
              <div className="font-bold text-[#191716]">DocuReady Fair-Pricing Guarantee</div>
              <div className="text-[11px] text-[#78716A]">Instant UPI / PhonePe • Cancel or top-up anytime</div>
            </div>
          </div>
        </div>

        {/* 3 Subscription Tier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* TIER 1: FREE EXPLORER */}
          <div className="bg-white border border-[#E5E0D5] rounded-lg p-7 flex flex-col justify-between hover:border-[#D6CFC2] transition-all shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-delight font-bold uppercase tracking-wider text-[#78716A]">
                  Free Explorer
                </span>
                <span className="text-[10px] font-delight font-bold px-2 py-0.5 rounded-[4px] bg-[#F5F2EB] text-[#191716] border border-[#E5E0D5]">
                  Instant Check-In
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl md:text-4xl font-extrabold font-delight text-[#191716]">₹0</span>
                <span className="text-xs font-delight text-[#78716A]">/ forever free</span>
              </div>
              <p className="text-xs text-[#57524B] mb-6 pb-5 border-b border-[#E5E0D5]">
                Test your email marketing copy with direct test relays, 2 standard frameworks, AI pitch synthesis, and 15 bonus leads.
              </p>

              {/* Bifurcation Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#78716A]">
                  Tier Allocation &amp; Bifurcation
                </div>
                <ul className="space-y-2.5 text-xs text-[#191716]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>50 Test Emails / Month</strong> via verified direct mail transport</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>2 Standard Templates</strong> (Plain Text &amp; Single-Column)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>5 AI Pitch Generations / Mo</strong> with dynamic merge tags</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Single One-Off Blast</strong> + 15 Bonus Leads (4-day pool)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E0D5]">
              <button
                onClick={onLogin}
                className="w-full h-10 rounded-[5px] bg-[#F5F2EB] hover:bg-[#191716] text-[#191716] hover:text-white border border-[#D6CFC2] hover:border-[#191716] font-delight font-bold text-xs transition-all cursor-pointer"
              >
                Check In Free (15 Tokens Ready) &rarr;
              </button>
              <p className="text-[10.5px] font-delight text-center text-[#78716A] mt-2">
                Takes 15 seconds • No card required
              </p>
            </div>
          </div>

          {/* TIER 2: LEADPULSE BASIC (HIGHLIGHTED SWEET SPOT) */}
          <div className="bg-white border-2 border-[#C85A32] rounded-lg p-7 flex flex-col justify-between relative shadow-md">
            <div className="absolute -top-3 left-6 bg-[#C85A32] text-white text-[10px] font-delight font-bold px-3 py-0.5 rounded-[4px] uppercase tracking-wider">
              Most Popular • Just ₹23 / Day
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 pt-1">
                <span className="text-[11px] font-delight font-bold uppercase tracking-wider text-[#C85A32]">
                  LeadPulse Basic
                </span>
                <span className="text-[10px] font-delight font-bold px-2 py-0.5 rounded-[4px] bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/25">
                  1,500 Emails + 600 Leads
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl md:text-4xl font-extrabold font-delight text-[#191716]">₹699</span>
                <span className="text-xs font-delight text-[#78716A]">/ month</span>
                <span className="text-xs font-delight text-slate-400 line-through ml-1">₹4,100+ market</span>
              </div>
              <p className="text-xs text-[#57524B] mb-6 pb-5 border-b border-[#E5E0D5]">
                Built for solo operators and growing agencies running daily email campaigns with all 8 Link Mobility frameworks.
              </p>

              {/* Bifurcation Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#C85A32]">
                  Tier Allocation &amp; Bifurcation
                </div>
                <ul className="space-y-2.5 text-xs text-[#191716]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                    <span><strong>1,500 Emails / Month</strong> (Up to 2 connected inboxes)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                    <span><strong>All 8 Link Mobility Frameworks</strong> Unlocked</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                    <span><strong>50/50 A/B Split Testing Enabled</strong> for subject &amp; copy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                    <span><strong>250 AI Pitch Generations / Mo</strong> + 2-Step Sequences</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                    <span><strong>600 Bonus Lead Tokens</strong> + Unlimited CSV &amp; Excel Exports</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E0D5]">
              <button
                onClick={onLogin}
                className="w-full h-10 rounded-[5px] bg-[#C85A32] hover:bg-[#B04B25] text-white border border-[#B04B25] font-delight font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                Start Basic Workspace (₹699/mo) &rarr;
              </button>
              <p className="text-[10.5px] font-delight text-center text-[#78716A] mt-2">
                Start free first, upgrade inside console anytime
              </p>
            </div>
          </div>

          {/* TIER 3: LEADPULSE PRO */}
          <div className="bg-[#191716] text-[#FAF8F5] border border-[#2E2A27] rounded-lg p-7 flex flex-col justify-between relative shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-delight font-bold uppercase tracking-wider text-[#E07A5F]">
                  LeadPulse Pro
                </span>
                <span className="text-[10px] font-delight font-bold px-2 py-0.5 rounded-[4px] bg-white/10 text-[#FAF8F5] border border-white/15">
                  5,000+ Emails / mo
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl md:text-4xl font-extrabold font-delight text-white">₹1,999</span>
                <span className="text-xs font-delight text-[#A8A096]">/ month</span>
                <span className="text-xs font-delight text-[#78716A] line-through ml-1">₹16,500+ market</span>
              </div>
              <p className="text-xs text-[#B8B0A4] mb-6 pb-5 border-b border-white/10">
                Unrestricted commercial email infrastructure for high-velocity teams running multi-variant campaigns and behavioral workflows.
              </p>

              {/* Bifurcation Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#E07A5F]">
                  Tier Allocation &amp; Bifurcation
                </div>
                <ul className="space-y-2.5 text-xs text-[#FAF8F5]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#E07A5F] shrink-0 mt-0.5" />
                    <span><strong>5,000+ Emails / Month</strong> (Unlimited inboxes &amp; custom SMTPs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#E07A5F] shrink-0 mt-0.5" />
                    <span><strong>8 Frameworks + Custom Reusable Template Library</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#E07A5F] shrink-0 mt-0.5" />
                    <span><strong>Multi-Variant A/B/C Testing</strong> + Unlimited AI Pitch Copilot</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#E07A5F] shrink-0 mt-0.5" />
                    <span><strong>Multi-Step Behavioral Journeys</strong> (Email + WhatsApp bridge)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#E07A5F] shrink-0 mt-0.5" />
                    <span><strong>1,500 Bonus Lead Tokens / Mo</strong> + Dedicated Worker Node</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={onLogin}
                className="w-full h-10 rounded-[5px] bg-white hover:bg-[#C85A32] text-[#191716] hover:text-white font-delight font-bold text-xs transition-all cursor-pointer"
              >
                Launch Pro Console (₹1,999/mo) &rarr;
              </button>
              <p className="text-[10.5px] font-delight text-center text-[#A8A096] mt-2">
                Replaces ₹16,500+/mo of fragmented SaaS tools
              </p>
            </div>
          </div>

        </div>

        {/* Pay-As-You-Go Micro Top-Up Bifurcation Strip */}
        <div className="bg-[#F5F2EB] border border-[#E5E0D5] rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-md">
              <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#C85A32] block mb-1">
                ON-DEMAND ELASTICITY // ZERO MONTHLY COMMITMENT
              </span>
              <h3 className="text-lg font-extrabold text-[#191716] tracking-tight">
                Just need a quick batch of leads? Use Instant Top-Up Packs.
              </h3>
              <p className="text-xs text-[#57524B] mt-1 leading-relaxed">
                Even on the <strong>₹0 Free Tier</strong>, you can purchase non-expiring credit bundles via PhonePe / UPI whenever a campaign spikes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
              {/* Micro Pack */}
              <div className="bg-white border border-[#E5E0D5] rounded-[6px] p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-delight font-bold text-[#191716]">Micro Pack</span>
                    <span className="text-[9.5px] font-delight font-bold px-1.5 py-0.5 rounded bg-[#F5F2EB] text-[#57524B] border border-[#E5E0D5]">
                      ₹2.50 / lead
                    </span>
                  </div>
                  <div className="text-lg font-extrabold font-delight text-[#191716] mt-1">
                    ₹50 <span className="text-xs font-semibold text-[#C85A32]">&rarr; +20 Extra Leads</span>
                  </div>
                  <div className="text-[10.5px] font-delight text-[#78716A]">Never expires • Instant UPI activation</div>
                </div>
                <button
                  onClick={onLogin}
                  className="px-3 py-1.5 rounded-[4px] bg-[#191716] hover:bg-[#C85A32] text-white text-[11px] font-delight font-bold transition-colors shrink-0 cursor-pointer"
                >
                  Try ₹50 Pack
                </button>
              </div>

              {/* Mega Pack */}
              <div className="bg-white border border-[#C85A32]/40 rounded-[6px] p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-delight font-bold text-[#191716]">Mega Pack</span>
                    <span className="text-[9.5px] font-delight font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Best Value • ₹1 / lead
                    </span>
                  </div>
                  <div className="text-lg font-extrabold font-delight text-[#191716] mt-1">
                    ₹1,000 <span className="text-xs font-semibold text-[#C85A32]">&rarr; +1,000 Extra Leads</span>
                  </div>
                  <div className="text-[10.5px] font-delight text-[#78716A]">Never expires • Priority queue access</div>
                </div>
                <button
                  onClick={onLogin}
                  className="px-3 py-1.5 rounded-[4px] bg-[#C85A32] hover:bg-[#B04B25] text-white text-[11px] font-delight font-bold transition-colors shrink-0 cursor-pointer"
                >
                  Get 1,000 Leads
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Architectural & Cost Bifurcation Ledger Table */}
        <div className="bg-white border border-[#E5E0D5] rounded-lg overflow-hidden shadow-2xs">
          <div className="px-6 py-4 bg-[#F5F2EB] border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-delight font-bold uppercase tracking-wider text-[#191716]">
                Detailed Capability &amp; Unit-Economics Bifurcation Matrix
              </h4>
              <p className="text-[11px] font-delight text-[#78716A]">
                Every feature, compute quota, and unit cost broken down across LeadPulse tiers vs. current market rates.
              </p>
            </div>
            <button
              onClick={onLogin}
              className="text-xs font-delight font-bold text-[#C85A32] hover:underline cursor-pointer"
            >
              Inspect inside live console &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E0D5] bg-[#FAF8F5] font-delight text-[11px] text-[#78716A] uppercase">
                  <th className="py-3.5 px-5 font-bold text-[#191716]">Architecture &amp; Cost Dimension</th>
                  <th className="py-3.5 px-4 text-center font-bold">Free Explorer (₹0)</th>
                  <th className="py-3.5 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">Basic (₹699/mo)</th>
                  <th className="py-3.5 px-4 text-center font-bold text-[#191716]">Pro (₹1,999/mo)</th>
                  <th className="py-3.5 px-4 text-center font-semibold text-slate-400">Market Avg.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5] font-delight">
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">Monthly Email Dispatch Volume</td>
                  <td className="py-3 px-4 text-center text-[#57524B]">50 test emails / mo</td>
                  <td className="py-3 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">1,500 emails / mo (2 inboxes)</td>
                  <td className="py-3 px-4 text-center font-bold text-[#191716]">5,000+ emails / mo (unlimited inboxes)</td>
                  <td className="py-3 px-4 text-center text-slate-400 line-through">₹3,200+/mo</td>
                </tr>
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">Outreach Templates Suite</td>
                  <td className="py-3 px-4 text-center text-[#57524B]">2 Standard Templates</td>
                  <td className="py-3 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">All 8 Link Mobility Frameworks</td>
                  <td className="py-3 px-4 text-center font-bold text-[#191716]">8 Frameworks + Custom Reusable Library</td>
                  <td className="py-3 px-4 text-center text-slate-400 line-through">₹4,900+/mo</td>
                </tr>
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">A/B Split Testing Capabilities</td>
                  <td className="py-3 px-4 text-center text-red-500 font-bold">Locked</td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-700 bg-[#C85A32]/5">50/50 Split Testing Enabled</td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-700">Multi-Variant A/B/C Testing</td>
                  <td className="py-3 px-4 text-center text-slate-400">Locked / Add-on</td>
                </tr>
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">AI Copilot Pitch Synthesis</td>
                  <td className="py-3 px-4 text-center text-[#57524B]">5 pitches / mo</td>
                  <td className="py-3 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">250 pitches / mo</td>
                  <td className="py-3 px-4 text-center font-bold text-[#191716]">Unlimited AI Generations</td>
                  <td className="py-3 px-4 text-center text-slate-400 line-through">₹3,800+/mo</td>
                </tr>
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">Automated Sequence Depth</td>
                  <td className="py-3 px-4 text-center text-[#57524B]">Single one-off blast</td>
                  <td className="py-3 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">2-Step Sequence (Initial + Follow-up)</td>
                  <td className="py-3 px-4 text-center font-bold text-[#191716]">Multi-Step Journeys + WhatsApp Bridge</td>
                  <td className="py-3 px-4 text-center text-slate-400 line-through">₹3,500+/mo</td>
                </tr>
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">Bonus Lead Token Pool</td>
                  <td className="py-3 px-4 text-center text-[#57524B]">15 Tokens (4-day refresh)</td>
                  <td className="py-3 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">600 Bonus Tokens</td>
                  <td className="py-3 px-4 text-center font-bold text-[#191716]">1,500 Bonus Tokens</td>
                  <td className="py-3 px-4 text-center text-slate-400 line-through">₹4,000+/mo</td>
                </tr>
                <tr>
                  <td className="py-3 px-5 font-bold text-[#191716]">Registered Team Seats &amp; Token Sharing</td>
                  <td className="py-3 px-4 text-center text-[#57524B]">2 Fixed Seats</td>
                  <td className="py-3 px-4 text-center font-bold text-[#C85A32] bg-[#C85A32]/5">50% Seats Share Pool</td>
                  <td className="py-3 px-4 text-center font-bold text-[#191716]">100% Seats Share Pool</td>
                  <td className="py-3 px-4 text-center text-slate-400 line-through">₹2,000/seat</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================= 8. CTA SECTION (ESPRESSO & TERRACOTTA) ================= */}
      <section className="py-22 px-6 md:px-12 bg-[#191716] border-t border-[#2E2A27] text-[#FAF8F5] text-left relative overflow-hidden z-10 mt-8">
        <div
          className="absolute right-[-8%] top-[-30%] w-[520px] h-[520px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(200, 90, 50, 0.22) 0%, transparent 65%)'
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-start">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-[4px] border border-[#E07A5F]/35 bg-[#C85A32]/20 text-[11px] font-delight font-bold text-[#E07A5F] tracking-wider mb-4">
            <img src={docuReadyWhiteLogo} alt="DocuReady" className="h-3.5 w-auto object-contain" />
            <span>•</span>
            <span>15 FREE TOKENS WAITING IN YOUR CONSOLE</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-[#FAF8F5]">
            Check in and test your first harvest in 30 seconds.
          </h2>
          <p className="text-sm md:text-base text-[#B8B0A4] mb-8 max-w-xl leading-relaxed">
            See why teams are replacing ₹12,000+/month of bloated outreach tools with DocuReady&apos;s unified LeadPulse engine. Start free and upgrade only when you see the pipeline results.
          </p>
          <button
            onClick={onLogin}
            className="h-11 px-7 bg-[#C85A32] text-white rounded-[6px] font-delight font-bold text-[13px] hover:bg-[#B04B25] transition-colors border border-[#B04B25] shadow-xs flex items-center gap-2 cursor-pointer"
          >
            Check In &amp; Launch Free Workspace &rarr;
          </button>
          <p className="mt-4 text-xs font-delight text-[#8C8479]">
            15 Free Tokens • ₹50 Instant Micro Top-Ups • ₹699/mo Basic Tier
          </p>
        </div>
      </section>

      {/* ================= 9. FOOTER (A DOCUREADY ENTITY) ================= */}
      <footer className="py-10 px-6 md:px-12 border-t border-[#E5E0D5] bg-[#F5F2EB] relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Brand + DocuReady Entity Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <a 
                href="/" 
                className="flex items-center gap-2 group cursor-pointer hover:opacity-90 transition-all select-none"
                title="LeadPulse Home"
              >
                <div className="w-6 h-6 rounded overflow-hidden bg-[#191716] flex items-center justify-center p-0.5 border border-[#E5E0D5] group-hover:border-[#C85A32] transition-all shrink-0">
                  <img src={leadPulseLogo} alt="LeadPulse Logo" className="w-full h-full object-contain" />
                </div>
                <span className="font-extrabold tracking-tight text-[#191716] group-hover:text-[#C85A32] transition-colors text-base">
                  LeadPulse
                </span>
                <span className="text-[9px] font-delight font-bold uppercase bg-[#FAF8F5] text-[#C85A32] border border-[#E5E0D5] px-1 py-0.5 rounded tracking-wider">
                  v1.0
                </span>
              </a>
              <span className="text-[#D6CFC2]">|</span>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[5px] bg-white border border-[#E5E0D5]">
                <span className="text-[10.5px] font-delight font-bold uppercase tracking-wider text-[#57524B]">
                  A
                </span>
                <img src={docuReadyBlackLogo} alt="DocuReady" className="h-4 w-auto object-contain" />
                <span className="text-[10.5px] font-delight font-bold uppercase tracking-wider text-[#57524B]">
                  Entity
                </span>
              </div>
            </div>

            {/* Interactive Footer Menu */}
            <div className="flex flex-wrap gap-6 text-xs font-delight font-semibold text-[#57524B]">
              <a href="#docuready" className="hover:text-[#C85A32] transition-colors">
                Why DocuReady
              </a>
              <a href="#pricing" className="hover:text-[#C85A32] transition-colors">
                Pricing &amp; Bifurcation
              </a>
              <button onClick={() => setIsPrivacyOpen(true)} className="hover:text-[#C85A32] transition-colors cursor-pointer">
                Privacy Policy
              </button>
              <button onClick={() => setIsTermsOpen(true)} className="hover:text-[#C85A32] transition-colors cursor-pointer">
                Terms of Service
              </button>
              <button onClick={() => setIsContactOpen(true)} className="hover:text-[#C85A32] transition-colors cursor-pointer">
                Contact &amp; Support
              </button>
            </div>
          </div>

          <div className="pt-5 border-t border-[#E5E0D5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-delight text-[#78716A]">
            <p>
              LeadPulse is a <strong>DocuReady Entity</strong>. Engineered to deliver enterprise B2B discovery, AI outreach synthesis, and pipeline automation at a fraction of current market rates.
            </p>
            <p className="shrink-0">
              &copy; {new Date().getFullYear()} DocuReady / LeadPulse Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ================= MODAL: PRIVACY POLICY ================= */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 bg-[#191716]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-lg shadow-xl border border-[#D6CFC2] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-[#191716]">
            <div className="p-5 border-b border-[#E5E0D5] flex items-center justify-between bg-[#F5F2EB]">
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-[#191716]">LeadPulse Privacy Policy</h3>
                <p className="text-[11px] font-delight text-[#78716A]">Effective Date: October 2026 • GDPR &amp; CCPA Compliant</p>
              </div>
              <button onClick={() => setIsPrivacyOpen(false)} className="text-[#78716A] hover:text-[#191716] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#57524B] leading-relaxed">
              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">1. Information We Collect</h4>
                <p>
                  LeadPulse collects account credentials (name, email address), workspace profile configurations, and outreach preferences. In order to power your B2B prospect discovery, we access verified public professional records adhering strictly to data protection guidelines.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">2. How We Use and Protect Data</h4>
                <p>
                  We use collected telemetry solely to provide, refine, and secure the LeadPulse service. All CRM contacts, email templates, and automated workflows are encrypted both in transit (TLS 1.3) and at rest via Google Cloud Firestore. We never sell or rent your private database to third parties.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">3. B2B Outreach &amp; Compliance Rights</h4>
                <p>
                  Prospect data is processed on the basis of legitimate business interest for professional commercial communication. You maintain the right to delete, export, or modify any contact records at any time directly through your Audience Hub.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">4. Data Inquiries &amp; Contact</h4>
                <p>
                  For any privacy questions or data deletion requests, contact our Data Protection Officer at <a href="mailto:privacy@leadpulse.io" className="text-[#C85A32] font-delight font-semibold underline">privacy@leadpulse.io</a>.
                </p>
              </section>
            </div>

            <div className="p-4 border-t border-[#E5E0D5] bg-[#F5F2EB] flex justify-end">
              <button onClick={() => setIsPrivacyOpen(false)} className="px-4 py-1.5 bg-[#191716] text-white rounded-[5px] font-delight font-semibold text-xs hover:bg-[#C85A32] transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TERMS OF SERVICE ================= */}
      {isTermsOpen && (
        <div className="fixed inset-0 bg-[#191716]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-lg shadow-xl border border-[#D6CFC2] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-[#191716]">
            <div className="p-5 border-b border-[#E5E0D5] flex items-center justify-between bg-[#F5F2EB]">
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-[#191716]">Terms of Service</h3>
                <p className="text-[11px] font-delight text-[#78716A]">Master Subscription Agreement • LeadPulse Inc.</p>
              </div>
              <button onClick={() => setIsTermsOpen(false)} className="text-[#78716A] hover:text-[#191716] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#57524B] leading-relaxed">
              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">1. Acceptance of Terms</h4>
                <p>
                  By launching your workspace or accessing the LeadPulse platform, you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company, you represent that you have authority to bind that entity.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">2. Acceptable Outreach &amp; CAN-SPAM Policy</h4>
                <p>
                  You agree to use LeadPulse outreach tools (Email, WhatsApp, SMS) strictly for lawful, legitimate B2B communication. Sending unsolicited deceptive spam, phishing, harassment, or violating national anti-spam statutes (CAN-SPAM, CASL, PECR) will result in immediate workspace termination.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">3. Lead Credits &amp; Subscription Quotas</h4>
                <p>
                  Lead tokens and credits are consumed when harvesting or enriching verified contact records. Free tier plans receive 15 Lead Tokens / Credits with automated 4-day pool refreshes. Paid tiers provide expanded quotas, team seat allocation, and high-frequency scraper execution.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#191716] font-delight">4. Limitation of Liability</h4>
                <p>
                  LeadPulse provides AI suggestions and contact intelligence on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not guarantee specific sales outcomes, conversion rates, or email inbox placement rates which depend on external recipient mail servers.
                </p>
              </section>
            </div>

            <div className="p-4 border-t border-[#E5E0D5] bg-[#F5F2EB] flex justify-end">
              <button onClick={() => setIsTermsOpen(false)} className="px-4 py-1.5 bg-[#191716] text-white rounded-[5px] font-delight font-semibold text-xs hover:bg-[#C85A32] transition-colors cursor-pointer">
                Acknowledge Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONTACT & SUPPORT ================= */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-[#191716]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-lg shadow-xl border border-[#D6CFC2] max-w-md w-full p-5 space-y-5 text-[#191716]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D5]">
              <div>
                <h3 className="text-sm font-extrabold tracking-tight text-[#191716]">Technical Support &amp; Inquiries</h3>
                <p className="text-[10px] font-delight text-[#78716A]">LeadPulse Engineering Relay • A DocuReady Entity</p>
              </div>
              <button onClick={() => setIsContactOpen(false)} className="text-[#78716A] hover:text-[#191716] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {contactSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <h4 className="text-sm font-bold text-[#191716]">Dispatch Successful</h4>
                <p className="text-xs text-[#57524B]">Telemetry ticket opened. Our team will follow up via your email address.</p>
              </div>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                setContactSubmitted(true);
                setTimeout(() => {
                  setContactSubmitted(false);
                  setIsContactOpen(false);
                }, 2000);
              }} className="space-y-3">
                <div>
                  <label className="block text-[10.5px] font-delight font-bold text-[#57524B] mb-1 uppercase tracking-wider">Your Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Alex Rivera"
                    className="w-full h-8.5 px-2.5 border border-[#D6CFC2] rounded-[5px] text-xs font-delight outline-none focus:ring-1 focus:ring-[#C85A32] focus:border-[#C85A32]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-delight font-bold text-[#57524B] mb-1 uppercase tracking-wider">Work Email</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="alex@company.com"
                    className="w-full h-8.5 px-2.5 border border-[#D6CFC2] rounded-[5px] text-xs font-delight outline-none focus:ring-1 focus:ring-[#C85A32] focus:border-[#C85A32]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-delight font-bold text-[#57524B] mb-1 uppercase tracking-wider">Message</label>
                  <textarea 
                    rows={3} 
                    required
                    placeholder="Describe your inquiry..."
                    className="w-full p-2.5 border border-[#D6CFC2] rounded-[5px] text-xs font-delight outline-none focus:ring-1 focus:ring-[#C85A32] focus:border-[#C85A32]"
                  />
                </div>
                <button type="submit" className="w-full h-9 bg-[#C85A32] text-white rounded-[5px] font-delight font-bold text-xs hover:bg-[#B04B25] transition-colors border border-[#B04B25] shadow-xs cursor-pointer">
                  Submit Support Ticket
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-[#E5E0D5] flex items-center justify-between text-[11px] font-delight text-[#78716A]">
              <span>support@leadpulse.io</span>
              <span>SLA: &lt; 2 hrs</span>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default Landing;
