import React from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  Bot, 
  Settings, 
  User, 
  LogOut, 
  Wallet, 
  Users, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { UserSession, UserAppSettings } from '../types';

interface NavbarProps {
  activeTab: 'chat' | 'chart' | 'bot' | 'settings' | 'login';
  onTabChange: (tab: 'chat' | 'chart' | 'bot' | 'settings' | 'login') => void;
  session: UserSession;
  settings: UserAppSettings;
  onLogout: () => void;
  onOpenAdmin: () => void;
  language: 'my' | 'en';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  session,
  settings,
  onLogout,
  onOpenAdmin,
  language
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0c0e17]/95 backdrop-blur-md border-b border-slate-800 px-3 py-2.5 shadow-xl">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand & Logo (Admin only clickable, regular users cannot click) */}
        <div 
          onClick={session.isAdmin ? () => onTabChange('chat') : undefined}
          className={`flex items-center gap-2 select-none ${
            session.isAdmin 
              ? 'cursor-pointer group' 
              : 'cursor-default pointer-events-none'
          }`}
          title={session.isAdmin ? "Admin Logo" : "777 Big Win"}
        >
          <div className="relative">
            <img
              src="/assets/images/killerboss_avatar_1791104818892.jpg"
              alt="777 Big Win Killerboss"
              className={`w-8 h-8 rounded-full object-cover border-2 border-red-500 shadow-md transition-transform ${
                session.isAdmin ? 'group-hover:scale-105' : ''
              }`}
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0c0e17] rounded-full" />
          </div>

          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1">
              <span className="font-black text-xs text-white tracking-wider">777 BIG WIN</span>
              <span className="text-[9px] font-black bg-red-600 text-white px-1 py-0.2 rounded">X</span>
              <span className="font-black text-xs text-red-500">KILLERBOSS</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
              <span>VIP Official Lounge</span>
            </span>
          </div>
        </div>

        {/* User Balance & Fast Switch */}
        <div className="flex items-center gap-2">
          {session.isLoggedIn ? (
            <div className="flex items-center gap-1.5 bg-[#171926] border border-amber-500/40 px-2.5 py-1 rounded-full shadow-inner">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-xs font-black text-amber-300">
                {session.balance.toLocaleString()} K
              </span>
            </div>
          ) : (
            <button
              onClick={() => onTabChange('login')}
              className="px-2.5 py-1 rounded-full bg-gradient-to-r from-red-600 to-amber-600 text-white text-[11px] font-black shadow hover:scale-105 transition-transform cursor-pointer"
            >
              {language === 'my' ? 'လော့ဂ်အင်' : 'Sign In'}
            </button>
          )}

          {/* Settings button shortcut */}
          <button
            onClick={() => onTabChange('settings')}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-red-600 border-red-400 text-white'
                : 'bg-[#151724] border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 4 View Navigation Tab Bar */}
      <nav className="max-w-md mx-auto grid grid-cols-4 gap-1 pt-2.5">
        <button
          onClick={() => onTabChange('chat')}
          className={`py-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'chat'
              ? 'bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-lg shadow-red-950/60 scale-102'
              : 'bg-[#131522] text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] tracking-tight">ai Chart</span>
          {activeTab === 'chat' && (
            <span className="absolute -top-1 right-2 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </button>

        <button
          onClick={() => onTabChange('chart')}
          className={`py-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'chart'
              ? 'bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-lg shadow-red-950/60 scale-102'
              : 'bg-[#131522] text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-[10px] tracking-tight">777 Live</span>
        </button>

        <button
          onClick={() => onTabChange('bot')}
          className={`py-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'bot'
              ? 'bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-lg shadow-red-950/60 scale-102'
              : 'bg-[#131522] text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span className="text-[10px] tracking-tight">{language === 'my' ? 'Auto Bot' : 'Strategy Bot'}</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`py-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'settings'
              ? 'bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-lg shadow-red-950/60 scale-102'
              : 'bg-[#131522] text-slate-400 hover:text-slate-200 border border-slate-800/80'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[10px] tracking-tight">{language === 'my' ? 'ဆက်တင်များ' : 'Settings'}</span>
        </button>
      </nav>
    </header>
  );
};
