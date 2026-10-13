import { useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BarChart3, Settings, 
  FolderKanban, HelpCircle, Search, Send, Users2, 
  Webhook, Waypoints, LogOut, Sparkles, Zap, ArrowUpRight
} from 'lucide-react';
import { useStore } from '../store/useStore';
import docuReadyBlackLogo from '../assets/DocuReady-black.png';

const mainNav = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Outreach', icon: Send, path: '/outreach' },
  { name: 'Automation', icon: Waypoints, path: '/automations' },
  { name: 'Audience', icon: Users2, path: '/audience' },
];

const pipelineNav = [
  { name: 'Lead Gen', icon: Search, path: '/finder' },
  { name: 'CRM Pipeline', icon: FolderKanban, path: '/crm' },
];

const toolsNav = [
  { name: 'Analytics', icon: BarChart3, path: '/analytics' },
  { name: 'Integrations', icon: Webhook, path: '/integrations' },
  { name: 'Team', icon: Users, path: '/team' },
  { name: 'Settings', icon: Settings, path: '/settings' },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setToken, setUser, setUpgradeModalOpen, setUpgradeTab, setTopUpOpen } = useStore();

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isTopTier = currentPlan === 'pro';
  const rawCredits = user?.lead_credits ?? 15;
  const displayCredits = currentPlan === 'free' && !(user as any)?.has_topup ? Math.min(rawCredits, 15) : rawCredits;
  const maxPoolLabel = currentPlan === 'free' ? '15' : currentPlan === 'basic' ? '600' : '∞';

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

  const renderNavSection = (title: string, items: any[]) => (
    <div className="mb-5">
      <p className="px-2.5 text-[10px] font-semibold text-[#6E675F] font-delight uppercase tracking-wider mb-1.5">{title}</p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link 
              key={item.name} 
              to={item.path} 
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-delight transition-all group ${
                isActive 
                  ? 'bg-[#191716] text-white font-semibold shadow-2xs' 
                  : 'text-[#57514B] hover:text-[#191716] hover:bg-[#EBE5D8]/60 font-medium'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? 'text-[#E07A5F]' : 'text-[#6E675F] group-hover:text-[#191716]'}`} /> 
              <span className="flex-1 truncate">{item.name}</span>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] shrink-0" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <aside className="w-[224px] flex flex-col h-screen border-r border-[#E5E0D5] bg-[#F5F2EB] text-[#191716] shrink-0 select-none">
      
      {/* Brand & Workspace Header */}
      <div className="h-13 px-4 flex items-center justify-between border-b border-[#E5E0D5] bg-[#F5F2EB]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#C85A32] text-white flex items-center justify-center font-bold font-delight text-xs">
            L
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-[#191716] font-delight leading-none">LeadPulse</span>
            <span className="text-[9px] font-delight font-medium text-[#6E675F] uppercase tracking-wider mt-0.5">Workspace</span>
          </div>
        </div>
        <div className="w-6 h-6 rounded-md overflow-hidden border border-[#D6CFC2] bg-white">
           {user?.profile_picture ? (
             <img src={user?.profile_picture} className="w-full h-full object-cover" alt="Profile" />
           ) : (
             <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[#191716] font-delight">
               {user?.name?.charAt(0) || 'U'}
             </div>
           )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-4">
        {renderNavSection('Main', mainNav)}
        {renderNavSection('Lead Gen & CRM', pipelineNav)}
        {renderNavSection('Tools', toolsNav)}
      </div>

      {/* Plan Quota & Dynamic Upgrade / Top-Up Box */}
      <div className="px-2.5 pb-2">
        <div className="p-2.5 rounded-lg bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
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
            <span className="font-semibold text-[#191716]">{displayCredits} / {maxPoolLabel} tokens</span>
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
             <span className="text-[#191716] font-semibold uppercase tracking-wider text-[9px]">v3.0</span>
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
