import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logoSrc, setLogoSrc] = useState('/logo.png');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate quick verification
    setTimeout(() => {
      const cleanUser = (username || '').trim().toLowerCase();
      const validUser = 'tkagent';
      const validPass = 'Asrat@2324';

      if (cleanUser === validUser && password === validPass) {
        try {
          localStorage.setItem('tk_auth_session', 'authenticated');
          localStorage.setItem('tk_auth_user', 'Tkagent');
          localStorage.setItem('tk_auth_time', Date.now().toString());
        } catch {
          // ignore localStorage error
        }
        setIsLoading(false);
        onLoginSuccess();
      } else {
        setIsLoading(false);
        if (cleanUser !== validUser && password !== validPass) {
          setError('Invalid username and password. Please check your credentials.');
        } else if (cleanUser !== validUser) {
          setError('Invalid username. Please check your administrative ID.');
        } else {
          setError('Invalid password. Passwords are case-sensitive.');
        }
      }
    }, 450);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#060515] overflow-hidden select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-pink-600/15 via-purple-600/20 to-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} 
      />

      {/* Main Login Card - matching requested layout and TK Agency luxury aesthetics */}
      <div className="relative z-10 w-full max-w-[460px] bg-[#0d0b24]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 sm:p-10 shadow-2xl shadow-black/80 flex flex-col items-center">
        
        {/* Logo Container - Clean pure white holder */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-lg overflow-hidden">
            <img 
              src={logoSrc} 
              alt="TK Agency Logo" 
              className="w-full h-full object-contain"
              onError={() => {
                if (logoSrc !== '/logo.png') {
                  setLogoSrc('/logo.png');
                }
              }}
            />
          </div>
        </div>

        {/* Agency Title & Subtitle */}
        <div className="text-center space-y-1.5 mb-8">
          <h1 className="text-3xl sm:text-[34px] font-serif font-bold text-white tracking-tight flex items-center justify-center">
            TK Agency<span className="text-pink-500 font-extrabold text-3xl leading-none">.</span>
          </h1>
          <p className="text-[11px] font-mono font-bold tracking-[0.22em] text-[#c59b58] uppercase">
            Management Portal Login
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full mb-6 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-3 animate-in fade-in zoom-in duration-200">
            <AlertCircle size={17} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-200 font-medium leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {/* Administrative Email / Username */}
          <div className="space-y-2">
            <label 
              htmlFor="username-input" 
              className="block text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-300 uppercase"
            >
              Administrative Email/Username
            </label>
            <div className="relative flex items-center">
              <input
                id="username-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full bg-[#070517] border border-white/10 rounded-xl py-3.5 px-4 text-sm font-medium text-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition"
              />
              <div className="absolute right-3.5 text-slate-500 pointer-events-none">
                <User size={16} />
              </div>
            </div>
          </div>

          {/* Secure Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="password-input" 
                className="block text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-300 uppercase"
              >
                Secure Password
              </label>
            </div>
            <div className="relative flex items-center">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full bg-[#070517] border border-white/10 rounded-xl py-3.5 px-4 pr-11 text-sm font-medium text-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1 text-slate-400 hover:text-white transition"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Sign In Button - matching gold/bronze luxury style in screenshot with TK polish */}
          <div className="pt-2">
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 sm:py-4 px-4 rounded-xl bg-[#c59b58] hover:bg-[#d6aa64] text-[#0a081a] font-extrabold text-xs sm:text-sm uppercase tracking-widest transition shadow-lg shadow-[#c59b58]/20 hover:shadow-[#c59b58]/40 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0a081a] border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock size={15} className="stroke-[2.5]" />
                  <span>Sign In To Dashboard</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Divider & Footer link */}
        <div className="w-full mt-7 pt-6 border-t border-white/10 flex flex-col items-center gap-3">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>&larr;</span>
            <span>Back to TK Agency Public Site</span>
          </a>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono pt-1">
            <ShieldCheck size={13} className="text-emerald-400/80" />
            <span>256-Bit Encrypted Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};
