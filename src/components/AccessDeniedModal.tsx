import React, { useState } from 'react';
import { Ban, Copy, Check, Send } from 'lucide-react';

interface AccessDeniedModalProps {
  gameId: string;
  onBackToLogin: () => void;
  language?: 'my' | 'en';
}

export const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  gameId,
  onBackToLogin,
  language = 'my'
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(gameId || '761699');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleContactTelegram = () => {
    // Open Telegram admin chat
    const telegramUrl = `https://t.me/trilionx2`;
    window.open(telegramUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      {/* Outer Card Container matching IMG_0254.png */}
      <div className="relative w-full max-w-sm rounded-[32px] bg-[#121319]/95 border-2 border-red-900/60 p-6 sm:p-7 shadow-[0_0_50px_rgba(220,38,38,0.25)] text-center backdrop-blur-xl overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Circular Red Icon with Prohibition Sign */}
        <div className="relative mx-auto w-20 h-20 rounded-full bg-gradient-to-b from-red-600 to-red-800 p-0.5 shadow-[0_0_25px_rgba(239,68,68,0.5)] flex items-center justify-center mb-5">
          <div className="w-full h-full rounded-full bg-[#1b0909] flex items-center justify-center">
            <Ban className="w-10 h-10 text-red-500 stroke-[2.5]" />
          </div>
        </div>

        {/* 2. ACCESS DENIED Header */}
        <h2 className="text-2xl sm:text-3xl font-black italic tracking-wider text-red-500 uppercase drop-shadow-md mb-3">
          ACCESS DENIED
        </h2>

        {/* 3. Description Message */}
        <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed max-w-[260px] mx-auto mb-6">
          {language === 'my'
            ? 'သင့် Game ID အား Bot အသုံးပြုရန် ခွင့်မပြုထားသေးပါ။ အသုံးပြုခွင့်ရရှိရန် Admin ထံ ဆက်သွယ်ပါ။'
            : 'Your Game ID is not allowed to use this bot. Please contact the admin to get access.'}
        </p>

        {/* 4. YOUR GAME ID Card Box with Copy button */}
        <div className="bg-[#181922] border border-red-950/80 rounded-2xl p-4 mb-6 relative">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            YOUR GAME ID
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-2xl sm:text-3xl font-black text-white tracking-wider">
              {gameId || '761699'}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-[#222430] hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer relative"
              title="Copy Game ID"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded font-bold whitespace-nowrap shadow">
                  Copied!
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 5. Bright Blue Action Button: CONTACT ADMIN (TELEGRAM) */}
        <button
          onClick={handleContactTelegram}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600 hover:from-blue-400 hover:to-sky-400 active:scale-98 text-white font-black text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(14,165,233,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer mb-4"
        >
          <Send className="w-4 h-4" />
          <span>CONTACT ADMIN (TELEGRAM)</span>
        </button>

        {/* 6. Back to login */}
        <button
          onClick={onBackToLogin}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {language === 'my' ? '← အကောင့်ဝင်ရန် စာမျက်နှာသို့ ပြန်သွားမည်' : 'Back to login'}
        </button>
      </div>
    </div>
  );
};
