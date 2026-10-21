import { useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BarChart3, Settings, 
  FolderKanban, HelpCircle, Search, Send, Users2, 
  Webhook, Waypoints, LogOut, Sparkles, Zap, ArrowUpRight,
  Calendar, ShieldCheck, Lock, Download
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { alertDialog } from './AppConfirmModal';
import TokenDisplay from './TokenDisplay';
import docuReadyBlackLogo from '../assets/DocuReady-black.png';
import strovrLogo from '../assets/strovr-logo.png';

interface NavItem {
  name: string;
  icon: any;
  path: string;
  requiredPlan?: 'basic' | 'pro';
  lockMessage?: string;
}

const mainNav: NavItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Outreach', icon: Send, path: '/outreach' },
  { 
    name: 'Automation', 
    icon: Waypoints, 
    path: '/automations', 
    requiredPlan: 'pro',
    lockMessage: 'Automations and autonomous sequence workflows are unavailable on Free and Basic tiers. Upgrade your workspace to Strovr Pro to unlock multi-step behavioral journeys, delays, and WhatsApp touchpoints.'
  },
  { name: 'Audience', icon: Users2, path: '/audience' },
];

const pipelineNav: NavItem[] = [
  { name: 'Lead Gen', icon: Search, path: '/finder' },
  { name: 'CRM Pipeline', icon: FolderKanban, path: '/crm' },
];

const toolsNav: NavItem[] = [
  { name: 'Analytics', icon: BarChart3, path: '/analytics' },
  { name: 'Integrations', icon: Webhook, path: '/integrations' },
  { name: 'Team', icon: Users, path: '/team' },
  { name: 'Settings', icon: Settings, path: '/settings' },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setToken, setUser, setUpgradeModalOpen, setUpgradeTab, setTopUpOpen } = useStore();

  const isDesktop = (() => {
    if (typeof window === 'undefined') return false;
    if (/Electron|StrovrDesktop/i.test(navigator.userAgent)) return true;
    if (window.location.search.includes('desktop=true')) return true;
    if (sessionStorage.getItem('strovr_desktop_mode') === 'true') return true;
    return false;
  })();

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN' || user?.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com';
  const isTopTier = currentPlan === 'pro';
  const rawCredits = user?.lead_credits ?? 15;
  const displayCredits = rawCredits;
  const maxPoolLabel = currentPlan === 'free' ? '15' : currentPlan === 'basic' ? '600' : '∞';

  const isItemLocked = (item: NavItem) => {
    if (isSuperAdmin) return false;
    if (!item.requiredPlan) return false;
    if (item.requiredPlan === 'pro') {
      return currentPlan !== 'pro';
    }
    if (item.requiredPlan === 'basic') {
      return currentPlan === 'free';
    }
    return false;
  };

  const handleNavClick = async (e: React.MouseEvent, item: NavItem) => {
    if (isItemLocked(item)) {
      e.preventDefault();
      e.stopPropagation();
      await alertDialog({
        title: `${item.name} is Locked on ${currentPlan.toUpperCase()} Tier`,
        message: item.lockMessage || `${item.name} requires an upgraded subscription plan. Upgrade your workspace to unlock this capability.`,
        variant: 'info'
      });
      setUpgradeTab('plans');
      setUpgradeModalOpen(true);
      return;
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    navigate('/');
  };

  const handleTierAction = () => {
    if (isTopTier) {
      setUpgradeTab('topup');
      setTopUpOpen(true);
    } else {
      setUpgradeTab('plans');
      setUpgradeModalOpen(true);
    }
  };

  const renderNavSection = (title: string, items: NavItem[]) => (
    <div className="mb-6">
      <p className="px-3 text-[10.5px] font-semibold text-[#6E675F] font-delight uppercase tracking-wider mb-2">{title}</p>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          const locked = isItemLocked(item);

          return (
            <Link 
              key={item.name} 
              to={locked ? '#' : item.path}
              onClick={(e) => handleNavClick(e, item)}
              title={locked ? `${item.name} (Requires ${item.requiredPlan?.toUpperCase()} tier)` : item.name}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-delight transition-all group ${
                locked
                  ? 'opacity-55 hover:opacity-85 text-[#8A8277] hover:bg-[#EBE5D8]/50 cursor-pointer'
                  : isActive 
                    ? 'bg-[#191716] text-white font-semibold shadow-2xs' 
                    : 'text-[#57514B] hover:text-[#191716] hover:bg-[#EBE5D8]/70 font-medium'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                locked 
                  ? 'text-[#8A8277]' 
                  : isActive 
                    ? 'text-[#E07A5F]' 
                    : 'text-[#6E675F] group-hover:text-[#191716]'
              }`} /> 
              <span className="flex-1 truncate">{item.name}</span>
              {locked ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                    {item.requiredPlan}
                  </span>
                  <Lock className="w-3.5 h-3.5 text-amber-600/90 shrink-0" />
                </div>
              ) : (
                isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <aside className="w-[244px] flex flex-col h-screen border-r border-[#E5E0D5] bg-[#F5F2EB] text-[#191716] shrink-0 select-none">
      
      {/* Brand & Workspace Header */}
      <div className={`${isDesktop ? 'h-20' : 'h-18'} px-4 flex items-center justify-between border-b border-[#E5E0D5] bg-[#F5F2EB]`}>
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-2">
            <Link 
              to="/" 
              className="flex items-center group cursor-pointer hover:opacity-90 transition-all select-none"
              title={isDesktop ? "Strovr Desktop" : "Go to Landing Page"}
            >
              <img 
                src={strovrLogo} 
                alt="Strovr Logo" 
                className="h-10 md:h-11 w-auto object-contain shrink-0 group-hover:scale-102 transition-transform" 
              />
            </Link>
            {isDesktop && (
              <span className="text-[9.5px] font-delight font-extrabold uppercase bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/30 px-1.5 py-0.5 rounded tracking-wider">
                Desktop
              </span>
            )}
          </div>
          {isDesktop && (
            <span className="text-[9.5px] font-delight font-extrabold text-[#78716A] uppercase tracking-widest pl-1 mt-0.5">
              Desktop
            </span>
          )}
        </div>
        <div className="w-8 h-8 rounded-md overflow-hidden border border-[#D6CFC2] bg-white shrink-0">
           {user?.profile_picture ? (
             <img src={user?.profile_picture} className="w-full h-full object-cover" alt="Profile" />
           ) : (
             <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-[#191716] font-delight">
               {user?.name?.charAt(0) || 'U'}
             </div>
           )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-5">
        {isSuperAdmin && (
          <div className="mb-5 pb-4 border-b border-[#E5E0D5]">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-bold text-[#C85A32] font-delight uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C85A32]" />
                Root Command
              </span>
              <span className="text-[8.5px] font-semibold bg-[#C85A32]/10 text-[#C85A32] px-1.5 py-0.5 rounded border border-[#C85A32]/20 font-mono">
                SUPER_ADMIN
              </span>
            </div>
            <Link 
              to="/admin" 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-delight transition-all group ${
                location.pathname.startsWith('/admin')
                  ? 'bg-[#191716] text-white font-semibold shadow-2xs' 
                  : 'bg-white hover:bg-[#EBE5D8]/80 text-[#191716] border border-[#D6CFC2] font-semibold shadow-2xs'
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 shrink-0 transition-colors ${location.pathname.startsWith('/admin') ? 'text-[#E07A5F]' : 'text-[#C85A32]'}`} /> 
              <span className="flex-1 truncate">Control Room</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] shrink-0" />
            </Link>
          </div>
        )}

        {renderNavSection('Main', mainNav)}
        {renderNavSection('Lead Gen & CRM', pipelineNav)}
        {renderNavSection('Tools', toolsNav)}
      </div>

      {/* Plan Quota & Dynamic Upgrade / Top-Up Box */}
      <div className="px-3 pb-3">
        <div className="p-3 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-[#191716] flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isTopTier ? 'bg-emerald-600' : 'bg-[#C85A32]'}`} />
              {currentPlan.toUpperCase()} TIER
            </span>
            <span className="text-[10px] font-delight font-bold text-[#C85A32] tabular-nums">
              {user?.emails_sent || 0} / {currentPlan === 'pro' ? '5k' : currentPlan === 'basic' ? '1.5k' : '50'} Emails
            </span>
          </div>

          <div className="w-full bg-[#F5F2EB] h-1.5 rounded-full overflow-hidden border border-[#E5E0D5]">
            <div 
              className="h-full bg-[#C85A32] transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round(((user?.emails_sent || 0) / Math.max(1, user?.emails_limit || (currentPlan === 'pro' ? 5000 : currentPlan === 'basic' ? 1500 : 50))) * 100))}%`
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[9.5px] font-delight text-[#6E675F] pt-0.5">
            <span>Bonus Leads:</span>
            <TokenDisplay 
              user={user} 
              className="text-[10px] text-[#191716]" 
              topupColorClass="text-slate-600 font-bold"
              showTokensWord 
            />
          </div>

          <button
            type="button"
            onClick={handleTierAction}
            className={`w-full py-1.5 px-2.5 rounded-md text-[11px] font-delight font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
              isTopTier
                ? 'bg-[#191716] hover:bg-[#2F2B28] text-white'
                : 'bg-[#C85A32] hover:bg-[#B04B25] text-white'
            }`}
          >
            {isTopTier ? (
              <>
                <Zap className="w-3 h-3 text-[#E07A5F] fill-current" />
                <span>Top-Up Tokens</span>
                <ArrowUpRight className="w-3 h-3 opacity-80" />
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-white" />
                <span>{currentPlan === 'basic' ? 'Upgrade to Pro' : 'Upgrade Plan'}</span>
                <ArrowUpRight className="w-3 h-3 opacity-80" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer Area */}
      <div className="p-3 border-t border-[#E5E0D5] bg-[#F5F2EB] space-y-1">
         {!isDesktop && (
           <a 
             href="/downloads/Strovr-Desktop-Portable.zip" 
             download="Strovr-Desktop-Portable.zip"
             className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-delight font-semibold text-[#191716] hover:bg-[#EBE5D8]/80 hover:text-[#C85A32] transition-colors"
             title="Download Windows Portable Desktop Package (.zip)"
           >
             <Download className="w-3.5 h-3.5 text-[#C85A32]" /> 
             <span>Download for Desktop</span>
           </a>
         )}
         <Link to="/help" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-delight font-medium text-[#57514B] hover:text-[#191716] hover:bg-[#EBE5D8]/60 transition-colors">
           <HelpCircle className="w-3.5 h-3.5 text-[#6E675F]" /> 
           <span>Documentation</span>
         </Link>
         <div className="flex items-center justify-between px-2 py-1 text-[10px] text-[#6E675F] font-delight font-normal">
           <div className="flex items-center gap-1">
             <span>A</span>
             <img src={docuReadyBlackLogo} alt="DocuReady" className="h-2.5 w-auto object-contain opacity-80" />
             <span>Entity</span>
           </div>
           <span className="flex items-center gap-1.5">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
             <span className="text-[#191716] font-semibold uppercase tracking-wider text-[9px]">v1.0</span>
           </span>
         </div>
         <button 
           onClick={handleSignOut} 
           className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-delight text-[#6E675F] hover:text-red-700 hover:bg-red-50/60 transition-colors font-medium text-left cursor-pointer"
         >
           <LogOut className="w-3.5 h-3.5 text-[#6E675F]" />
           <span>Sign Out</span>
         </button>
      </div>

    </aside>
  );
};

export default Sidebar;
