import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
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
  const { user, token } = useStore();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <BrowserRouter>
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
            {/* Landing is always the root. */}
            <Route path="/" element={<Landing onLogin={() => {
              if (token) {
                window.location.href = '/dashboard';
              } else {
                setShowLogin(true);
              }
            }} />} />
            
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/finder" element={<ProtectedRoute><LeadFinder /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CrmPipeline /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
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
            <Route path="/login" element={<Login onBack={() => window.location.href = '/'} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
};

export default App;
