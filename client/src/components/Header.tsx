import { useEffect } from 'react';
import { Search, Bell, Plus, Layers, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

interface HeaderProps {
  title?: string;
}

const Header = ({ title: _title }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, integrations, fetchWorkspaceIntegrations, refreshUserProfile } = useStore();

  useEffect(() => {
    if (user?._id) {
      refreshUserProfile(user._id);
      fetchWorkspaceIntegrations(user._id);
    }
  }, [user?._id]);

  const connectedApps = integrations.filter(a => a.connected);
  const previewNames = connectedApps.slice(0, 2).map(a => a.name.split(' ')[0]).join(', ');
  const extraCount = Math.max(0, connectedApps.length - 2);
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN' || user?.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com';

  return (
    <header className="h-14 bg-[#FAF8F5] flex items-center justify-between px-8 border-b border-[#E5E0D5] select-none">
      
      {/* Search Input */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center w-full">
          <Search className="w-3.5 h-3.5 text-[#6E675F] absolute left-3.5" />
          <input 
            type="text" 
            placeholder="Search commands, leads, workflows..." 
            className="w-full bg-[#F5F2EB] border border-[#E5E0D5] rounded-lg pl-9 pr-14 py-2 text-xs text-[#191716] outline-none focus:bg-white transition-all placeholder:text-[#9C9488] font-delight font-normal"
          />
          <kbd className="absolute right-3 text-[10px] font-delight font-medium text-[#6E675F] bg-white border border-[#E5E0D5] rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {isSuperAdmin && (
          <button
            onClick={() => navigate('/admin')}
            title="Open Super Admin Control Room"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#191716] hover:bg-[#2A2624] text-white text-[11px] font-delight font-medium transition-all shadow-2xs border border-[#3A3532] cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#E07A5F]" />
            <span className="font-semibold text-white">Super Admin</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        )}

        {/* Global Connected Integrations Pill */}
        <button
          onClick={() => navigate('/integrations')}
          title="Manage Connected Integrations & Live Telemetry"
          className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F5F2EB] border border-[#E5E0D5] text-[11px] font-delight text-[#57514B] transition-all cursor-pointer"
        >
          <span className={`inline-flex rounded-full h-1.5 w-1.5 ${connectedApps.length > 0 ? 'bg-[#C85A32]' : 'bg-[#D6CFC2]'}`}></span>
          <span className="font-semibold text-[#191716]">{connectedApps.length} Active</span>
          <span className="text-[#6E675F] truncate max-w-[140px] font-delight font-normal">
            {connectedApps.length > 0 ? `${previewNames}${extraCount > 0 ? ` +${extraCount}` : ''}` : 'Connect Apps'}
          </span>
          <Layers className="w-3 h-3 text-[#6E675F] shrink-0" />
        </button>

        <button 
          onClick={() => navigate('/finder')}
          className="bg-[#C85A32] hover:bg-[#B04B25] text-white px-3.5 py-1.5 rounded-md text-xs font-delight font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-white/90" />
          <span>New Harvest</span>
        </button>

        <button 
          className="w-8 h-8 bg-white border border-[#E5E0D5] rounded-md flex items-center justify-center text-[#6E675F] hover:text-[#191716] hover:bg-[#F5F2EB] transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-3.5 h-3.5" />
        </button>

        {/* User Profile Avatar Button */}
        <button 
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-md overflow-hidden border border-[#D6CFC2] bg-white flex items-center justify-center hover:border-slate-400 hover:shadow-2xs transition-all cursor-pointer shrink-0"
          title={`Signed in as ${user?.name || 'User'} - Open Settings`}
        >
          {user?.profile_picture ? (
            <img src={user.profile_picture} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            <span className="text-[11px] font-bold text-[#191716] font-delight">
              {user?.name?.charAt(0) || 'U'}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;

