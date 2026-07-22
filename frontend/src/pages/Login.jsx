import React, { useEffect, useState } from 'react';
import { api, setToken, setUser } from '../utils/api';
import { Shield, Lock, User, UserPlus } from 'lucide-react';
import Captcha from '../components/Captcha';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [panelName, setPanelName] = useState('Orbiton');
  const [isVerified, setIsVerified] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch setup status & public panel settings on mount
  useEffect(() => {
    const initLogin = async () => {
      try {
        const setupData = await api('/auth/setup-status');
        setNeedsSetup(setupData.needsSetup);
      } catch (err) {
        console.error(err);
      }

      try {
        const publicSettings = await api('/auth/settings/public');
        if (publicSettings && publicSettings.panel_name) {
          setPanelName(publicSettings.panel_name);
          document.title = `${publicSettings.panel_name} — Sign In`;
        }
      } catch (_) {}
    };
    initLogin();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Validate anti-bot reCAPTCHA verification
    if (!isVerified) {
      setError('❌ Please check "I\'m not a robot" to complete anti-bot verification!');
      return;
    }

    setLoading(true);

    try {
      if (needsSetup) {
        // Setup initial admin
        await api('/auth/setup', 'POST', { username, password });
        setNeedsSetup(false);
        setSuccessMsg('Admin account created successfully! Please log in.');
        setUsername('');
        setPassword('');
      } else {
        // Normal login
        const data = await api('/auth/login', 'POST', { username, password });
        setToken(data.token);
        setUser(data.user);
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-accent opacity-[0.06] blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-accent2 opacity-[0.06] blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-surface border border-border backdrop-blur-md rounded-2xl p-8 shadow-2xl relative z-10 transition-all hover:border-border2">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-accent to-accent3 flex items-center justify-center shadow-lg shadow-accent/20 mb-4">
            {needsSetup ? (
              <UserPlus className="w-8 h-8 text-white" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            {needsSetup ? 'Set Up Admin' : panelName}
          </h1>
          <p className="text-sm text-muted mt-1 text-center">
            {needsSetup
              ? 'Create the primary administrator account to get started'
              : 'Universal App & Server Manager'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl text-center font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-text2 uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted pointer-events-none">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={needsSetup ? 'e.g. admin' : 'admin'}
                className="w-full bg-bg2 border border-border focus:border-accent text-text placeholder-muted/50 rounded-xl py-3 pl-10 pr-4 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text2 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted pointer-events-none">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg2 border border-border focus:border-accent text-text placeholder-muted/50 rounded-xl py-3 pl-10 pr-4 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Anti-Bot Verification reCAPTCHA Widget */}
          <div className="pt-2">
            <Captcha onVerifyChange={setIsVerified} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-accent to-accent3 hover:opacity-90 active:opacity-100 text-white font-medium py-3 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : needsSetup ? (
              'Create Admin Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
