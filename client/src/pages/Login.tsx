import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { X, ArrowLeft, Mail, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config/api';
import leadPulseLogo from '../assets/LeadPulse-logo.png';

interface LoginProps {
  onBack?: () => void;
}

type ViewMode = 'signin' | 'signup' | 'forgot';

const Login = ({ onBack }: LoginProps) => {
  const { token, setToken, setUser } = useStore();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password specific states
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [previewLink, setPreviewLink] = useState('');

  // If already logged in via browser memory, automatically route to dashboard
  useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (viewMode === 'signup') {
        const res = await axios.post(`${API_URL}/api/auth/register`, { email, password, name });
        setToken(res.data.token);
        setUser(res.data.user);
      } else {
        const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
        setToken(res.data.token);
        setUser(res.data.user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setForgotSuccess('');
    setPreviewLink('');

    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setForgotSuccess(
        res.data.message || 'Password reset verification link has been dispatched to your email address.'
      );
      if (res.data.previewUrl) {
        setPreviewLink(res.data.previewUrl);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to dispatch password reset link. Please check the email and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
      <div className="w-full max-w-md bg-white rounded-md shadow-xl flex flex-col overflow-hidden border border-slate-200 relative">
        
        {onBack && (
          <button 
            type="button"
            onClick={onBack} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-8 flex flex-col justify-center">
          <div className="max-w-sm w-full mx-auto">
            <div className="text-center mb-6">
              <a 
                href="/" 
                className="inline-flex items-center gap-2.5 group cursor-pointer hover:opacity-85 transition-all mb-3 select-none"
                title="Return to Landing Page"
              >
                <div className="w-8 h-8 rounded-md overflow-hidden bg-[#191716] flex items-center justify-center p-1 border border-slate-200 shadow-2xs group-hover:border-[#C85A32] group-hover:scale-105 transition-all">
                  <img src={leadPulseLogo} alt="LeadPulse Logo" className="w-full h-full object-contain" />
                </div>
                <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-[#C85A32] transition-colors leading-none">
                  LeadPulse
                </span>
                <span className="text-[9px] font-delight font-bold uppercase bg-slate-100 text-[#C85A32] border border-slate-200 px-1 py-0.5 rounded tracking-wider">
                  v1.0
                </span>
              </a>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-sm text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-600">
                  {viewMode === 'forgot' ? 'Account Recovery' : 'Access Gateway'}
                </span>
              </div>
              <h2 className="text-xl font-bold font-delight tracking-tight text-slate-900 mt-2">
                {viewMode === 'signup'
                  ? 'Create Workspace Account'
                  : viewMode === 'forgot'
                  ? 'Reset Workspace Password'
                  : 'Authenticate Session'}
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                {viewMode === 'signup'
                  ? 'Initialize your multi-channel prospecting engine.'
                  : viewMode === 'forgot'
                  ? 'Enter your work email to receive a secure password reset link.'
                  : 'Enter your credentials to access your LeadPulse workspace.'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-sm text-xs font-delight font-medium mb-5 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* View Mode: Forgot Password */}
            {viewMode === 'forgot' ? (
              <div className="space-y-4">
                {forgotSuccess ? (
                  <div className="space-y-4 text-center">
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-sm text-xs font-delight border border-emerald-200">
                      <div className="flex items-center justify-center gap-2 font-bold mb-1.5 text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Verification Link Dispatched
                      </div>
                      <p className="leading-relaxed text-emerald-700">
                        {forgotSuccess}
                      </p>
                      <p className="mt-2 text-[11px] text-emerald-600 font-mono">
                        Link expires in 1 hour.
                      </p>
                    </div>

                    {previewLink && (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-sm text-left">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                          Direct Verification Link (Dev Preview):
                        </div>
                        <a
                          href={previewLink}
                          className="text-xs text-blue-600 hover:text-blue-800 underline font-mono break-all block"
                        >
                          {previewLink}
                        </a>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('signin');
                          setForgotSuccess('');
                          setPreviewLink('');
                          setError('');
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-950 text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors border border-slate-800 shadow-xs cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Sign In
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForgotSuccess('');
                          setPreviewLink('');
                        }}
                        className="w-full text-xs text-slate-500 hover:text-slate-800 font-delight py-1 cursor-pointer"
                      >
                        Send to a different email
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5" autoComplete="on">
                    <div>
                      <label htmlFor="forgot-email" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                        Registered Work Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="forgot-email"
                          name="email"
                          type="email"
                          autoComplete="username email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                          placeholder="name@company.com"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors border border-[#B34D28] shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending Verification Link...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send Verification Link
                        </>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('signin');
                          setError('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-delight inline-flex items-center gap-1.5 cursor-pointer hover:underline"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Remember your password? Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* View Mode: Sign In or Sign Up */
              <>
                <form onSubmit={handleEmailSubmit} className="space-y-3.5" autoComplete="on">
                  {viewMode === 'signup' && (
                    <div>
                      <label htmlFor="name" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                        Full Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border border-slate-300 rounded-sm px-3 py-2 text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="email" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                      Work Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-slate-300 rounded-sm px-3 py-2 text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="name@company.com"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="block text-[11px] font-delight font-semibold text-slate-600 uppercase tracking-wider">
                        Password
                      </label>
                      {viewMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode('forgot');
                            setError('');
                            setForgotSuccess('');
                            setPreviewLink('');
                          }}
                          className="text-[11px] font-delight text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={viewMode === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-sm px-3 py-2 text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors border border-slate-800 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isLoading
                      ? 'Authenticating...'
                      : viewMode === 'signup'
                      ? 'Create Workspace'
                      : 'Sign In with Email'}
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-500">
                  {viewMode === 'signup' ? 'Already provisioned?' : 'Need a workspace?'}{' '}
                  <button 
                    type="button"
                    onClick={() => {
                      setViewMode(viewMode === 'signup' ? 'signin' : 'signup');
                      setError('');
                    }}
                    className="text-blue-600 font-medium hover:underline ml-1 cursor-pointer"
                  >
                    {viewMode === 'signup' ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
