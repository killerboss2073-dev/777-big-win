import React, { useState } from 'react';
import { HeroSection } from './components/HeroSection';
import { LoginForm } from './components/LoginForm';
import { BotDashboard } from './components/BotDashboard';
import { AdminPanel } from './components/AdminPanel';
import { Platform, UserSession } from './types';

export default function App() {
  const [language, setLanguage] = useState<'my' | 'en'>('my');
  const [platform, setPlatform] = useState<Platform>('777');
  const [activeView, setActiveView] = useState<'login' | 'dashboard'>('login');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [session, setSession] = useState<UserSession>({
    isLoggedIn: false,
    phone: '',
    token: '',
    userId: '',
    balance: 0,
    platform: '777'
  });

  const handleLoginSuccess = (token: string, phone: string, userId: string, balance: number) => {
    setSession({
      isLoggedIn: true,
      phone,
      token,
      userId,
      balance,
      platform
    });
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    setSession({
      isLoggedIn: false,
      phone: '',
      token: '',
      userId: '',
      balance: 0,
      platform: '777'
    });
    setActiveView('login');
  };

  const handleUpdateBalance = (newBalance: number) => {
    setSession((prev) => ({ ...prev, balance: newBalance }));
  };

  const handleToggleView = () => {
    if (session.isLoggedIn) {
      setActiveView(activeView === 'dashboard' ? 'login' : 'dashboard');
    } else {
      setActiveView('login');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 flex flex-col justify-between selection:bg-red-600 selection:text-white">
      {/* Background glow effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/20 via-[#0d0e14] to-[#07070a] pointer-events-none" />

      {/* Main Container - centered phone frame style on desktop */}
      <div className="relative w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#0f1016] border-x border-slate-900 shadow-2xl">
        {/* Top Controls: Language switch toggle only (Admin button hidden from public) */}
        <div className="flex items-center justify-end px-4 pt-3 pb-1">
          <button
            onClick={() => setLanguage(language === 'my' ? 'en' : 'my')}
            className="px-2.5 py-1 rounded-full bg-[#181924] border border-slate-850 text-[11px] font-bold text-slate-300 hover:text-white hover:border-red-900/60 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>🌐</span>
            <span>{language === 'my' ? 'မြန်မာ' : 'English'}</span>
          </button>
        </div>

        {/* Hero Section with Logo, Heading & 4 Feature Badges */}
        <HeroSection
          isLoggedIn={session.isLoggedIn}
          activeView={activeView}
          onToggleView={handleToggleView}
          language={language}
          onAdminClick={() => setShowAdminPanel(true)}
        />

        {/* Dynamic View: Login Form vs Bot Dashboard */}
        <main className="flex-1 pb-6">
          {session.isLoggedIn && activeView === 'dashboard' ? (
            <BotDashboard
              session={session}
              onUpdateBalance={handleUpdateBalance}
              onLogout={handleLogout}
              language={language}
            />
          ) : (
            <LoginForm
              platform={platform}
              onPlatformChange={setPlatform}
              onLoginSuccess={handleLoginSuccess}
              language={language}
            />
          )}
        </main>
      </div>

      {/* Protected Admin Panel Modal (Requires Admin PIN to unlock) */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        language={language}
      />
    </div>
  );
}
