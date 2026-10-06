import React, { useState } from 'react';
import itachiLogoImg from '../assets/images/itachi_logo_avatar_1791120287312.jpg';

interface LuffyAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPulse?: boolean;
  onAdminClick?: () => void;
}

export const LuffyAvatar: React.FC<LuffyAvatarProps> = ({
  size = 'lg',
  showPulse = true,
  onAdminClick
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-32 h-32'
  }[size];

  return (
    <div className={`relative ${sizeClasses} mx-auto flex items-center justify-center`}>
      {/* Outer lightning & red aura glow */}
      {showPulse && (
        <>
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-600/50 via-red-500/30 to-amber-500/30 blur-md animate-pulse pointer-events-none" />
          <div className="absolute -inset-1 rounded-full border border-red-500/40 animate-ping opacity-30 pointer-events-none" />
        </>
      )}

      {/* Circular Avatar Border Frame */}
      <div
        onClick={onAdminClick}
        className="relative w-full h-full rounded-full p-[3px] bg-gradient-to-b from-red-500 via-red-600 to-red-950 shadow-[0_0_25px_rgba(220,38,38,0.6)] overflow-hidden flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1a1b24] to-[#0a0000] flex items-center justify-center overflow-hidden relative">
          {!imageError ? (
            <img
              src={itachiLogoImg}
              alt="Itachi Uchiha Logo"
              className="w-full h-full object-cover scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            /* Stylized Anime Sharingan Fallback */
            <svg viewBox="0 0 160 160" className="w-full h-full object-cover">
              <defs>
                <radialGradient id="itachiAura" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0.95" />
                </radialGradient>
              </defs>
              <rect width="160" height="160" fill="url(#itachiAura)" />
              {/* Sharingan circle */}
              <circle cx="80" cy="80" r="50" fill="#dc2626" stroke="#450a0a" strokeWidth="4" />
              <circle cx="80" cy="80" r="16" fill="#09090b" />
              {/* Tomoe */}
              <circle cx="80" cy="46" r="6" fill="#09090b" />
              <circle cx="50" cy="98" r="6" fill="#09090b" />
              <circle cx="110" cy="98" r="6" fill="#09090b" />
            </svg>
          )}
        </div>
      </div>

      {/* Decorative mini badge at bottom right */}
      <div
        onClick={onAdminClick}
        className="absolute -bottom-1 -right-1 bg-red-600 text-[10px] font-black tracking-wider text-white px-2.5 py-0.5 rounded-full border-2 border-white shadow-lg cursor-pointer hover:bg-red-500 active:scale-95 transition-all"
        title="Admin Access"
      >
        MOD
      </div>
    </div>
  );
};
