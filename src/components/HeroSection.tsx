import React from 'react';
import { Bot, TrendingUp, ShieldCheck, Clock } from 'lucide-react';
import { LuffyAvatar } from './LuffyAvatar';

interface HeroSectionProps {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  activeView: 'login' | 'dashboard';
  onToggleView: () => void;
  language: 'my' | 'en';
  onAdminClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isLoggedIn,
  isAdmin = false,
  activeView,
  onToggleView,
  language,
  onAdminClick
}) => {
  return (
    <section className="relative pt-6 pb-2 text-center px-4 max-w-md mx-auto overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Avatar + Heading Lockup */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
        {/* Left: Avatar with secret Admin trigger (Admin only clickable) */}
        <div className="shrink-0">
          <LuffyAvatar size="lg" isAdmin={isAdmin} onAdminClick={onAdminClick} />
        </div>

        {/* Right: Titles updated to KILLERBOSS LOTTERY BOT */}
        <div className="text-left">
          <h2 className="text-2xl sm:text-3xl font-black italic tracking-wider text-white uppercase leading-none drop-shadow-md">
            KILLERBOSS
          </h2>
          <h3 className="text-2xl sm:text-3xl font-black italic tracking-wide text-red-600 uppercase leading-none mt-1 text-glow">
            LOTTERY BOT
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-4 h-[2px] bg-red-600" />
            <p className="text-[11px] font-semibold text-slate-300 tracking-wide">
              WinGo & TRX Game Platform
            </p>
          </div>
        </div>
      </div>

      {/* 4 Feature Badges (Matching Screenshot exactly) */}
      <div className="grid grid-cols-4 gap-2 my-5">
        {/* Feature 1 */}
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-[#1b1c24] border border-red-900/60 flex items-center justify-center text-red-500 shadow-inner group hover:scale-105 transition-transform">
            <Bot className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-[9px] font-bold text-slate-300 uppercase leading-tight mt-1.5 text-center">
            AI POWERED<br />PREDICTIONS
          </span>
        </div>

        {/* Feature 2 */}
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-[#1b1c24] border border-red-900/60 flex items-center justify-center text-red-500 shadow-inner group hover:scale-105 transition-transform">
            <TrendingUp className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-[9px] font-bold text-slate-300 uppercase leading-tight mt-1.5 text-center">
            HIGHER<br />WIN RATE
          </span>
        </div>

        {/* Feature 3 */}
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-[#1b1c24] border border-red-900/60 flex items-center justify-center text-red-500 shadow-inner group hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-[9px] font-bold text-slate-300 uppercase leading-tight mt-1.5 text-center">
            SECURE &<br />RELIABLE
          </span>
        </div>

        {/* Feature 4 */}
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-[#1b1c24] border border-red-900/60 flex items-center justify-center text-red-500 shadow-inner group hover:scale-105 transition-transform">
            <Clock className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-[9px] font-bold text-slate-300 uppercase leading-tight mt-1.5 text-center">
            24/7<br />ONLINE
          </span>
        </div>
      </div>
    </section>
  );
};
