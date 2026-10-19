import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, ArrowRight, ShieldCheck, Mail, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';
import API_URL from '../config/api';
import strovrLogo from '../assets/strovr-logo.png';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, setUser } = useStore();

  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!tokenParam || !emailParam) {
        setIsVerifying(false);
        setIsValidToken(false);
        setVerificationError('Missing password reset token or email address in link.');
        return;
      }

      try {
        const res = await axios.post(`${API_URL}/api/auth/verify-reset-token`, {
          email: emailParam,
          token: tokenParam
        });

        if (res.data.valid) {
          setIsValidToken(true);
        } else {
          setIsValidToken(false);
          setVerificationError(res.data.error || 'Invalid or expired password reset link.');
        }
      } catch (err: any) {
        setIsValidToken(false);
        setVerificationError(
          err.response?.data?.error || 'This password reset verification link is invalid, expired, or has already been used.'
        );
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [tokenParam, emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (newPassword.length < 6) {
      setSubmitError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match. Please verify and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password`, {
        email: emailParam,
        token: tokenParam,
        newPassword
      });

      if (res.data.success) {
        setIsSuccess(true);
        if (res.data.token && res.data.user) {
          setToken(res.data.token);
          setUser(res.data.user);
        }
        setTimeout(() => {
          navigate('/dashboard');
        }, 2200);
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to update password. Please request a fresh reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative font-sans text-slate-100">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#C85A32]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white text-slate-900 rounded-md shadow-2xl border border-slate-200 relative overflow-hidden z-10">
        
        {/* Header branding */}
        <div className="pt-8 pb-4 px-8 text-center border-b border-slate-100 bg-slate-50/50">
          <a
            href="/"
            className="inline-flex items-center gap-2.5 group cursor-pointer hover:opacity-85 transition-all mb-3 select-none"
            title="Return to Landing Page"
          >
            <div className="w-8 h-8 rounded-md overflow-hidden bg-[#191716] flex items-center justify-center p-1 border border-slate-200 shadow-2xs group-hover:border-[#C85A32] group-hover:scale-105 transition-all">
              <img src={strovrLogo} alt="Strovr Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-[#C85A32] transition-colors leading-none">
              Strovr
            </span>
            <span className="text-[9px] font-delight font-bold uppercase bg-slate-100 text-[#C85A32] border border-slate-200 px-1 py-0.5 rounded tracking-wider">
              Security
            </span>
          </a>

          <h1 className="text-xl font-bold font-delight tracking-tight text-slate-900">
            {isSuccess ? 'Password Reset Complete' : 'Reset Workspace Password'}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isSuccess
              ? 'Your password has been successfully updated.'
              : 'Secure verification link authenticated. Create your new password below.'}
          </p>
        </div>

        <div className="p-8">
          {/* State 1: Verifying link */}
          {isVerifying && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-3 border-slate-200 border-t-[#C85A32] rounded-full animate-spin mb-4" />
              <p className="text-sm font-semibold text-slate-700 font-delight">Verifying security token...</p>
              <p className="text-xs text-slate-400 mt-1">Validating your one-time verification link.</p>
            </div>
          )}

          {/* State 2: Invalid / Expired Token */}
          {!isVerifying && !isValidToken && !isSuccess && (
            <div className="py-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-200 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 font-delight mb-1">
                Link Invalid or Expired
              </h2>
              <p className="text-xs text-slate-600 mb-6 max-w-xs leading-relaxed">
                {verificationError || 'This password reset verification link is invalid, has expired, or has already been used.'}
              </p>

              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  Request New Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-delight font-medium text-xs py-2.5 rounded-sm transition-colors cursor-pointer"
                >
                  Return to Home
                </button>
              </div>
            </div>
          )}

          {/* State 3: Reset Successful */}
          {!isVerifying && isSuccess && (
            <div className="py-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200 shadow-xs animate-bounce">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 font-delight mb-1">
                All Set! Password Updated
              </h2>
              <p className="text-xs text-slate-600 mb-6 max-w-xs leading-relaxed">
                Your new password is now active and your session has been securely authenticated. Redirecting to your Strovr dashboard...
              </p>

              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                Go to Dashboard Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* State 4: Valid Token, Form Ready */}
          {!isVerifying && isValidToken && !isSuccess && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target Email Banner */}
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-sm">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-delight">
                    Resetting Password For
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate font-mono">
                    {emailParam}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-xs">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              </div>

              {submitError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-sm text-xs font-delight font-medium border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-sm text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-sm text-xs font-delight font-normal focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                    placeholder="Re-enter your new password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-delight leading-tight">
                Password must be at least 6 characters and will be securely encrypted.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-delight font-semibold text-xs py-2.5 rounded-sm transition-colors border border-[#B34D28] shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    Update Password &amp; Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs text-slate-500 hover:text-slate-800 hover:underline font-delight cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
