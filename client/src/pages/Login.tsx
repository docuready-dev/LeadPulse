import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { 
  X, 
  ArrowLeft, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Phone, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config/api';
import strovrLogo from '../assets/strovr-logo.png';

interface LoginProps {
  onBack?: () => void;
}

type ViewMode = 'signin' | 'signup' | 'forgot' | 'reset_otp';

const Login = ({ onBack }: LoginProps) => {
  const { token, setToken, setUser } = useStore();
  const navigate = useNavigate();
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
  
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('signin');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Account Recovery OTP states (Password Reset)
  const [phoneMasked, setPhoneMasked] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Feedback states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const completeLoginRedirect = () => {
    try {
      const pendingCheckout = sessionStorage.getItem('strovr_pending_checkout');
      if (pendingCheckout) {
        useStore.getState().setUpgradeTab('plans');
        useStore.getState().setUpgradeModalOpen(true);
      }
    } catch (_) {}
    navigate('/dashboard');
  };

  // If already logged in via browser memory, automatically route to dashboard
  useEffect(() => {
    if (token) {
      completeLoginRedirect();
    }
  }, [token, navigate]);

  // Resend countdown timer ticker
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Reset errors and transients when switching view modes
  const switchViewMode = (mode: ViewMode) => {
    if (isDesktop && mode === 'signup') {
      window.open('https://strovr.space/', '_blank');
      return;
    }
    setViewMode(mode);
    setError('');
    setSuccess('');
    setDevOtp('');
    setOtp('');
  };

  // Handle Primary Email / Password Submit (Sign In or Direct Sign Up)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (viewMode === 'signup') {
        if (!name || !name.trim()) {
          setError('Please provide your full name.');
          setIsLoading(false);
          return;
        }
        if (!email || !email.trim()) {
          setError('Please provide your work email address.');
          setIsLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setIsLoading(false);
          return;
        }

        const res = await axios.post(`${API_URL}/api/auth/register`, {
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim() || undefined
        });
        
        setToken(res.data.token);
        setUser(res.data.user);
        completeLoginRedirect();
      } else {
        // Sign In - Direct Session Authentication (No 2FA)
        const res = await axios.post(`${API_URL}/api/auth/login`, {
          email: email.trim(),
          password
        });

        setToken(res.data.token);
        setUser(res.data.user);
        completeLoginRedirect();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Forgot Password (Send Mobile OTP)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = phone.trim() || email.trim();
    if (!identifier) {
      setError('Please enter your registered mobile number or email address.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password-otp`, { identifier });
      setPhone(res.data.phone);
      setPhoneMasked(res.data.phoneMasked || res.data.phone);
      if (res.data.devOtp) setDevOtp(res.data.devOtp);
      setResendTimer(45);
      setOtp('');
      setViewMode('reset_otp');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to locate account. Please verify your mobile number.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Handle Reset Password with OTP Submit
  const handleResetPasswordOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter to confirm.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password-otp`, {
        phone: phone.trim(),
        otp: otp.trim(),
        newPassword
      });

      setSuccess('Password updated successfully! Redirecting to workspace...');
      setToken(res.data.token);
      setUser(res.data.user);
      setTimeout(() => {
        completeLoginRedirect();
      }, 1400);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please verify the code.');
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
            
            {/* Desktop Mode Local DB Notice */}
            {isDesktop && (
              <div className="mb-5 p-3 rounded-md bg-[#FDF9F5] border border-[#E8DCCF] text-[#4A433E] text-xs font-delight leading-relaxed shadow-2xs text-left">
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-[#C85A32] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] animate-pulse" />
                  Local DB Setup Only
                </div>
                <p className="text-[11.5px] text-[#5C534C] leading-normal">
                  This version is only for <strong className="text-[#191716]">local db setup</strong> (saved to <code className="bg-[#EBE5D8] text-[#191716] px-1 py-0.5 rounded text-[10px] font-mono">Documents\Strovr</code>). For cloud db, please visit{' '}
                  <a 
                    href="https://strovr.space/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-bold text-[#C85A32] hover:text-[#B04B25] underline underline-offset-2"
                  >
                    strovr.space
                  </a>.
                </p>
              </div>
            )}

            {/* Strovr Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex flex-col items-center mb-3 select-none">
                <div className="flex items-center gap-2">
                  <a 
                    href="/" 
                    className="inline-flex items-center gap-2 group cursor-pointer hover:opacity-85 transition-all select-none"
                    title={isDesktop ? "Strovr Desktop" : "Return to Landing Page"}
                  >
                    <img src={strovrLogo} alt="Strovr Logo" className="h-12 md:h-14 w-auto object-contain" />
                  </a>
                  {isDesktop ? (
                    <span className="text-[10px] font-delight font-extrabold uppercase bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/30 px-2 py-0.5 rounded tracking-wider">
                      Desktop
                    </span>
                  ) : (
                    <span className="text-[9px] font-delight font-bold uppercase bg-slate-100 text-[#C85A32] border border-slate-200 px-1.5 py-0.5 rounded tracking-wider">
                      v1.0
                    </span>
                  )}
                </div>
                {isDesktop && (
                  <span className="text-[10px] font-delight font-extrabold text-[#78716A] uppercase tracking-widest mt-1">
                    Desktop
                  </span>
                )}
              </div>

              {/* View Mode Badge */}
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-sm text-[10px] font-delight font-medium uppercase tracking-wider text-slate-600">
                  {viewMode === 'forgot' || viewMode === 'reset_otp'
                    ? 'Account Recovery'
                    : 'Access Gateway'}
                </span>
              </div>

              {/* Title & Subtitle */}
              <h2 className="text-xl font-medium font-delight tracking-tight text-slate-900 mt-2">
                {viewMode === 'signup'
                  ? 'Create Workspace Account'
                  : viewMode === 'forgot'
                  ? 'Recover with Mobile OTP'
                  : viewMode === 'reset_otp'
                  ? 'Set New Password'
                  : 'Authenticate Session'}
              </h2>
              <p className="text-slate-500 text-xs mt-1 font-delight font-normal">
                {viewMode === 'signup'
                  ? 'Provide your details to initialize your Strovr workspace.'
                  : viewMode === 'forgot'
                  ? 'Enter your registered mobile number or email to receive a reset code.'
                  : viewMode === 'reset_otp'
                  ? `Enter code sent to ${phoneMasked} and choose a new password.`
                  : 'Enter your credentials to access your Strovr workspace.'}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-sm text-xs font-delight font-medium mb-4 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {success && (
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-sm text-xs font-delight font-medium mb-4 border border-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* DEV OTP Helper Pill (Only for password reset recovery) */}
            {devOtp && (viewMode === 'forgot' || viewMode === 'reset_otp') && (
              <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 rounded-sm flex items-center justify-between text-xs">
                <div className="text-amber-900 font-medium flex items-center gap-1.5 font-delight">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dev OTP: <strong className="font-mono text-amber-950 font-medium">{devOtp}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setOtp(devOtp)}
                  className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-[11px] font-medium cursor-pointer transition-colors font-delight"
                >
                  Auto-fill
                </button>
              </div>
            )}

            {/* ========================================================
                VIEW MODE: FORGOT PASSWORD (Enter Mobile Number)
               ======================================================== */}
            {viewMode === 'forgot' && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="forgot-phone" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    You can also enter your work email to look up your registered mobile.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !phone.trim()}
                  className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors border border-[#B34D28] shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Send Reset OTP
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchViewMode('signin')}
                    className="text-xs text-slate-500 hover:text-slate-800 font-delight inline-flex items-center gap-1.5 cursor-pointer hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Remember your password? Sign In
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================
                VIEW MODE: RESET_OTP (Enter OTP + Set New Password)
               ======================================================== */}
            {viewMode === 'reset_otp' && (
              <form onSubmit={handleResetPasswordOtpSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="reset-otp-input" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="reset-otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full text-center tracking-[0.3em] font-mono text-sm font-bold py-2 border border-slate-300 rounded-sm focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                    placeholder="••••••"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    New Password (Min 6 Characters)
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-sm pl-3 pr-9 py-2 text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-sm px-3 py-2 text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6 || newPassword.length < 6}
                  className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors border border-[#B34D28] shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      Update Password & Sign In
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => switchViewMode('signin')}
                    className="text-slate-500 hover:text-slate-800 font-delight inline-flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back to Sign In
                  </button>

                  <button
                    type="button"
                    disabled={resendTimer > 0 || isLoading}
                    onClick={handleForgotPasswordSubmit}
                    className="text-blue-600 hover:text-blue-800 font-delight inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================
                VIEW MODE: SIGN IN OR SIGN UP
               ======================================================== */}
            {(viewMode === 'signin' || viewMode === 'signup') && (
              <>
                <form onSubmit={handleAuthSubmit} className="space-y-3.5" autoComplete="on">
                  
                  {/* Full Name (Sign Up only) */}
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
                  
                  {/* Work Email */}
                  <div>
                    <label htmlFor="email" className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                      Work Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="email"
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

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="block text-[11px] font-delight font-semibold text-slate-600 uppercase tracking-wider">
                        Password
                      </label>
                      {viewMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => switchViewMode('forgot')}
                          className="text-[11px] font-delight text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={viewMode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-sm text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Optional Mobile Number (Sign Up only) */}
                  {viewMode === 'signup' && (
                    <div className="pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="phone" className="block text-[11px] font-delight font-medium text-slate-700 uppercase tracking-wider">
                          Mobile Number
                        </label>
                        <span className="text-[10px] text-slate-400 font-delight font-normal">Optional</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                          placeholder="+91 98765 43210 (Optional)"
                        />
                      </div>
                    </div>
                  )}

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || (viewMode === 'signup' && (!name.trim() || !email.trim() || password.length < 6))}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-delight font-medium text-xs py-2.5 rounded-sm transition-colors border border-slate-800 shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {viewMode === 'signup' ? 'Creating Account...' : 'Authenticating...'}
                      </>
                    ) : viewMode === 'signup' ? (
                      'Create Free Workspace'
                    ) : (
                      'Sign In with Email'
                    )}
                  </button>
                </form>

                {/* Toggle between Sign In and Sign Up */}
                <p className="mt-6 text-center text-xs text-slate-500">
                  {viewMode === 'signup' ? 'Already have an account?' : 'Need a workspace?'}{' '}
                  <button 
                    type="button"
                    onClick={() => {
                      if (isDesktop && viewMode !== 'signup') {
                        window.open('https://strovr.space/', '_blank');
                        return;
                      }
                      switchViewMode(viewMode === 'signup' ? 'signin' : 'signup');
                    }}
                    className="text-blue-600 font-medium hover:underline ml-1 cursor-pointer"
                  >
                    {isDesktop ? 'Sign Up at strovr.space' : (viewMode === 'signup' ? 'Sign In' : 'Sign Up')}
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
