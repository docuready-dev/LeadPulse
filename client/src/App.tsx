import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from './store/useStore';
import Login from './pages/Login';
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

import MeshBackground from './components/MeshBackground';
import ErrorBoundary from './components/ErrorBoundary';
import AppConfirmModal from './components/AppConfirmModal';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useStore();
  if (!token) return <Navigate to="/" replace />;
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
};

export default App;
