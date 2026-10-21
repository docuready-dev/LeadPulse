import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useStore } from './store/useStore';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CrmPipeline from './pages/CrmPipeline';
import OutreachCenter from './pages/OutreachCenter';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import Onboarding from './components/Onboarding';
import TopUpModal from './components/TopUpModal';
import LeadFinder from './pages/LeadFinder';
import Audience from './pages/Audience';
import Automations from './pages/Automations';
import Integrations from './pages/Integrations';
import Team from './pages/Team';
import Appointments from './pages/Appointments';
import AdminPanel from './pages/AdminPanel';

import MeshBackground from './components/MeshBackground';
import ErrorBoundary from './components/ErrorBoundary';
import AppConfirmModal from './components/AppConfirmModal';
import { ZoomController } from './components/ZoomController';
import zoomManager from './utils/zoomManager';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useStore();
  if (!token) return <Navigate to="/" replace />;
  return <div className="saas-platform min-h-screen w-full relative">{children}</div>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, user } = useStore();
  if (!token) return <Navigate to="/" replace />;

  const roleClean = (user?.role || '').toUpperCase();
  const emailClean = (user?.email || '').toLowerCase().trim();
  const isSuper = roleClean === 'SUPER_ADMIN' || emailClean === 'ashleyghose64@gmail.com';

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF8F5]">
        <div className="flex items-center gap-2 text-xs font-delight font-semibold text-[#191716]">
          <span className="w-4 h-4 border-2 border-[#C85A32] border-t-transparent rounded-full animate-spin" />
          <span>Authenticating Super Admin...</span>
        </div>
      </div>
    );
  }

  if (!isSuper) return <Navigate to="/dashboard" replace />;
  return <div className="saas-platform min-h-screen w-full relative">{children}</div>;
};

const App = () => {
  const { user, token, refreshUserProfile, setUpgradeModalOpen, setUpgradeTab } = useStore();
  const [showLogin, setShowLogin] = useState(false);
  const isDesktop = (() => {
    if (typeof window === 'undefined') return false;
    if (/Electron|StrovrDesktop/i.test(navigator.userAgent)) return true;
    if (window.location.search.includes('desktop=true')) {
      try { sessionStorage.setItem('strovr_desktop_mode', 'true'); } catch (_) {}
      return true;
    }
    if (sessionStorage.getItem('strovr_desktop_mode') === 'true') return true;
    return false;
  })();

  // Handle external checkout funneling (e.g. from desktop EXE or marketing campaigns)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      const plan = urlParams.get('plan');
      const billing = urlParams.get('billing');

      if (action === 'upgrade' || action === 'checkout') {
        const payload = { action, plan: plan || 'basic', billing: billing || 'monthly' };
        sessionStorage.setItem('strovr_pending_checkout', JSON.stringify(payload));
        
        if (token) {
          setUpgradeTab('plans');
          setUpgradeModalOpen(true);
        } else {
          // If logged out, funnel directly into login
          setShowLogin(true);
        }
      } else if (token) {
        const pending = sessionStorage.getItem('strovr_pending_checkout');
        if (pending) {
          setUpgradeTab('plans');
          setUpgradeModalOpen(true);
        }
      }
    } catch (_) {}
  }, [token, setUpgradeTab, setUpgradeModalOpen]);

  useEffect(() => {
    zoomManager.init();
  }, []);

  useEffect(() => {
    if (token) {
      refreshUserProfile();
    }
    const handleFocus = () => {
      if (token) {
        refreshUserProfile();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token, refreshUserProfile]);

  return (
    <BrowserRouter>
      {isDesktop && (
        <aside 
          role="banner" 
          className="w-full bg-[#191716] text-[#FAF8F5] border-b border-[#3A3531] px-4 py-1.5 text-xs font-delight flex items-center justify-between z-50 select-none shadow-sm shrink-0"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#C85A32] shrink-0 animate-pulse" />
            <p className="text-[#E7E2DA] leading-normal text-xs font-medium">
              This version is only for <strong className="text-white font-medium">local db setup</strong>. For cloud db, please visit{' '}
              <a 
                href="https://strovr.space/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#E07A5F] hover:text-[#FFA07A] font-medium underline underline-offset-2 transition-colors ml-0.5"
              >
                strovr.space
              </a>.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <ZoomController variant="banner" />
            <a 
              href="https://strovr.space/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#C85A32] hover:bg-[#B04B25] text-white text-[11px] font-medium rounded transition-colors uppercase tracking-wider shrink-0 cursor-pointer"
              title="Open Cloud DB at strovr.space"
            >
              <span>strovr.space</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </aside>
      )}
      <div className="saas-platform">
        <AppConfirmModal />
      </div>
      {showLogin && !token && (
        <div className="saas-platform">
          <Login onBack={() => setShowLogin(false)} />
        </div>
      )}
      <div className="min-h-screen w-full max-w-full overflow-x-hidden font-sans text-charcoal relative">
        {token && <MeshBackground variant="platform" />}
        {user && !user.onboarding_complete && token && (
          <div className="saas-platform">
            <Onboarding />
          </div>
        )}
        {token && (
          <div className="saas-platform">
            <TopUpModal />
          </div>
        )}
        
        <ErrorBoundary>
          <Routes>
            {/* Landing is root on web; on Desktop, pull up Login or Dashboard directly */}
            <Route path="/" element={
              isDesktop ? (
                <Navigate to={token ? "/dashboard" : "/login"} replace />
              ) : (
                <Landing onLogin={() => {
                  if (token) {
                    window.location.href = '/dashboard';
                  } else {
                    setShowLogin(true);
                  }
                }} />
              )
            } />
            
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/finder" element={<ProtectedRoute><LeadFinder /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CrmPipeline /></ProtectedRoute>} />
            <Route path="/appointments" element={<Navigate to="/crm" replace />} />
            <Route path="/outreach" element={<ProtectedRoute><OutreachCenter /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            
            <Route path="/audience" element={<ProtectedRoute><Audience /></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
            
            <Route path="/help" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Login onBack={isDesktop ? undefined : () => window.location.href = '/'} />} />
            <Route path="*" element={<Navigate to={isDesktop ? (token ? "/dashboard" : "/login") : "/"} replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
};

export default App;
