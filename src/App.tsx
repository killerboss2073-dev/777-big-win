import React, { useState, useEffect } from 'react';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { LoginForm } from './components/LoginForm';
import { TelegramChat } from './components/TelegramChat';
import { LiveChartAnalysis } from './components/LiveChartAnalysis';
import { BotDashboard } from './components/BotDashboard';
import { SettingsPanel } from './components/SettingsPanel';
import { AdminPanel } from './components/AdminPanel';
import { Platform, UserSession, UserAppSettings } from './types';
import { apiGetIssue, apiGetBalance, apiCheckSession, apiPlaceBet, playSoundEffect } from './api';

const DEFAULT_SETTINGS: UserAppSettings = {
  language: 'my',
  soundEnabled: true,
  chatSound: true,
  winSound: true,
  voiceAnnounce: true,
  defaultAmount: 5000,
  chartOverlayChat: true,
  theme: 'neon-dark',
  customAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80',
  customName: 'User',
  userBadge: 'MEMBER'
};

export default function App() {
  // Load saved settings from localStorage & sanitize non-admin state
  const [settings, setSettings] = useState<UserAppSettings>(() => {
    try {
      const saved = localStorage.getItem('killerboss_settings');
      const loaded: UserAppSettings = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      const sessionSaved = localStorage.getItem('killerboss_session');
      const sess = sessionSaved ? JSON.parse(sessionSaved) : null;
      const isActuallyAdmin = Boolean(
        sess?.isLoggedIn && (
          sess?.isAdmin ||
          sess?.gameId === '761699' ||
          sess?.chartId === '8370471165' ||
          sess?.userId === '8370471165' ||
          sess?.userId === '761699' ||
          (sess?.phone && sess.phone.includes('9791111116'))
        )
      );

      if (!isActuallyAdmin) {
        if (loaded.customAvatar && (loaded.customAvatar.includes('itachi') || loaded.customAvatar.includes('hitachi'))) {
          loaded.customAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
        }
        if (loaded.userBadge === 'BOSS') {
          loaded.userBadge = 'MEMBER';
        }
        if (loaded.customName && loaded.customName.toUpperCase().includes('ADMIN')) {
          loaded.customName = 'User';
        }
      }
      return loaded;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [platform, setPlatform] = useState<Platform>('777');
  const [activeTab, setActiveTab] = useState<'chat' | 'chart' | 'bot' | 'settings' | 'login'>('chat');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // User session state
  const [session, setSession] = useState<UserSession>(() => {
    try {
      const saved = localStorage.getItem('killerboss_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        const isAdm = Boolean(
          parsed.isLoggedIn && (
            parsed.isAdmin ||
            parsed.gameId === '761699' ||
            parsed.chartId === '8370471165' ||
            parsed.userId === '8370471165' ||
            parsed.userId === '761699' ||
            (parsed.phone && parsed.phone.includes('9791111116'))
          )
        );
        return {
          ...parsed,
          isAdmin: isAdm,
          chartId: isAdm ? '8370471165' : (parsed.chartId || parsed.userId),
          gameId: isAdm ? '761699' : (parsed.gameId || parsed.userId)
        };
      }
      return {
        isLoggedIn: false,
        phone: '',
        token: '',
        userId: '',
        gameId: '',
        chartId: '',
        isAdmin: false,
        displayName: '',
        balance: 0,
        platform: '777'
      };
    } catch {
      return {
        isLoggedIn: false,
        phone: '',
        token: '',
        userId: '',
        gameId: '',
        chartId: '',
        isAdmin: false,
        displayName: '',
        balance: 0,
        platform: '777'
      };
    }
  });

  // Global game state (synchronized across Chat, Chart & Bot)
  const [currentIssue, setCurrentIssue] = useState<string>('20261007425');
  const [countdown, setCountdown] = useState<number>(45);

  // Save settings when changed
  const handleUpdateSettings = (newSettings: UserAppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('killerboss_settings', JSON.stringify(newSettings));
    } catch (e) {
      // ignore
    }
  };

  // Sync issue and countdown ticker
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const activeGameId = session.gameId || session.userId;
    const syncIssue = async () => {
      const data = await apiGetIssue(platform, session.token, activeGameId);
      if (data && data.success) {
        if (data.issueNumber) setCurrentIssue(data.issueNumber);
        if (data.data?.countdown) {
          setCountdown(data.data.countdown);
        }
      }
    };

    syncIssue();
    const issueInterval = setInterval(syncIssue, 8000);

    // Also connect to WebSocket to listen for instant Real Issue updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'chart:signal' && d.payload?.issue) {
          setCurrentIssue(d.payload.issue);
        }
        if (d.type === 'chat:message' && d.payload?.signal?.issue) {
          setCurrentIssue(d.payload.signal.issue);
        }
      } catch {}
    };

    // Countdown second ticker
    timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          syncIssue();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(issueInterval);
      clearInterval(timer);
      ws.close();
    };
  }, [platform, session.token, session.userId, session.gameId]);

  // Periodic Balance Sync
  useEffect(() => {
    if (!session.isLoggedIn || !session.token) return;

    const activeGameId = session.gameId || session.userId;
    const syncBal = async () => {
      const balRes = await apiGetBalance(session.token, session.platform, activeGameId);
      if (balRes.success && typeof balRes.amount === 'number') {
        setSession((prev) => {
          const updated = { ...prev, balance: balRes.amount };
          localStorage.setItem('killerboss_session', JSON.stringify(updated));
          return updated;
        });
      }
    };

    const interval = setInterval(syncBal, 15000);
    return () => clearInterval(interval);
  }, [session.isLoggedIn, session.token, session.platform, session.userId, session.gameId]);

  const handleLoginSuccess = (
    token: string,
    phone: string,
    userId: string,
    balance: number,
    extra?: { gameId?: string; chartId?: string; isAdmin?: boolean }
  ) => {
    const rawGameId = String(extra?.gameId || userId).trim();
    const isAdmin = Boolean(
      extra?.isAdmin ||
      rawGameId === '8370471165' ||
      userId === '8370471165' ||
      extra?.chartId === '8370471165' ||
      phone.includes('9791111116')
    );

    // Admin Chart ID is 8370471165 for Admin only. Regular users use their actual gameId/userId.
    const chartId = isAdmin ? '8370471165' : (extra?.chartId || userId);
    const gameId = rawGameId;

    if (isAdmin) {
      setSettings((prev) => ({
        ...prev,
        userBadge: 'BOSS',
        customName: prev.customName && prev.customName !== 'User' ? prev.customName : 'KILLERBOSS ADMIN 👑',
        customAvatar: '/assets/images/itachi_logo_avatar_1791120287312.jpg'
      }));
    }

    const newSession: UserSession = {
      isLoggedIn: true,
      phone,
      token,
      userId: gameId || '761699',
      gameId: gameId || '761699',
      chartId,
      isAdmin,
      badge: isAdmin ? 'BOSS' : (settings.userBadge || 'VIP'),
      displayName: isAdmin ? (settings.customName || 'KILLERBOSS ADMIN 👑') : (settings.customName || `VIP_${userId.slice(-4)}`),
      avatar: isAdmin ? '/assets/images/itachi_logo_avatar_1791120287312.jpg' : settings.customAvatar,
      balance,
      platform
    };
    setSession(newSession);
    try {
      localStorage.setItem('killerboss_session', JSON.stringify(newSession));
    } catch (e) {
      // ignore
    }
    setActiveTab('chat');
    playSoundEffect('win');
  };

  const handleLogout = () => {
    const cleanSession: UserSession = {
      isLoggedIn: false,
      phone: '',
      token: '',
      userId: '',
      gameId: '',
      chartId: '',
      isAdmin: false,
      displayName: '',
      balance: 0,
      platform: '777'
    };
    setSession(cleanSession);
    try {
      localStorage.removeItem('killerboss_session');
    } catch (e) {
      // ignore
    }

    // Reset settings to non-admin defaults
    setSettings((prev) => {
      const sanitized = {
        ...prev,
        customAvatar: (prev.customAvatar && (prev.customAvatar.includes('itachi') || prev.customAvatar.includes('hitachi')))
          ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80'
          : prev.customAvatar,
        customName: (prev.customName && prev.customName.toUpperCase().includes('ADMIN'))
          ? 'User'
          : prev.customName,
        userBadge: (prev.userBadge === 'BOSS')
          ? 'MEMBER'
          : prev.userBadge
      };
      try {
        localStorage.setItem('killerboss_settings', JSON.stringify(sanitized));
      } catch {}
      return sanitized;
    });

    setActiveTab('login');
  };

  const handleUpdateBalance = (newBalance: number) => {
    setSession((prev) => {
      const updated = { ...prev, balance: newBalance };
      try {
        localStorage.setItem('killerboss_session', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  };

  // Quick Bet Handler triggered from Telegram Chat Signal Cards ('ချက်ချင်းထိုးမည်' နှိပ်ရင် real bet ထိုးနိုင်သည်)
  const handleQuickBetFromChat = async (prediction: 'BIG' | 'SMALL', amount: number) => {
    if (!session.isLoggedIn) {
      setActiveTab('login');
      alert(settings.language === 'my' ? 'လောင်းကြေးတင်ရန် အကောင့် အရင်ဝင်ရောက်ပေးပါ!' : 'Please sign in to place real bets');
      return;
    }

    if (session.balance < amount) {
      alert(settings.language === 'my' ? `လက်ကျန်ငွေ မလုံလောက်ပါ! (လိုအပ်ငွေ: ${amount.toLocaleString()} K)` : `Insufficient balance! (Needed: ${amount.toLocaleString()} K)`);
      return;
    }

    // 777 Big Win WebAPI: selectType 13 = ကြီး (BIG), selectType 14 = သေး (SMALL)
    const betCode = prediction === 'BIG' ? 13 : 14;
    const res = await apiPlaceBet(session.token, amount, betCode, currentIssue, session.platform, session.gameId || session.userId);
    
    if (res.success) {
      const newBal = session.balance - amount;
      handleUpdateBalance(newBal);
      playSoundEffect('bet');
      
      // Dynamic import or direct confetti
      import('canvas-confetti').then((m) => {
        m.default({ particleCount: 50, spread: 70 });
      });

      alert(
        settings.language === 'my'
          ? `✅ Issue #${currentIssue} အတွက် ${prediction === 'BIG' ? 'ကြီး (BIG)' : 'သေး (SMALL)'} ${amount.toLocaleString()} MMK အောင်မြင်စွာ ထိုးပြီးပါပြီ!`
          : `✅ Bet #${currentIssue} ${prediction} ${amount.toLocaleString()} MMK placed successfully!`
      );
    } else {
      alert(res.message || 'Bet placement failed on 777 server');
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col justify-between selection:bg-red-600 selection:text-white font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background glow ambiance */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/25 via-[#0a0b12] to-[#050608] pointer-events-none" />

      {/* Main App Container */}
      <div className="relative w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#0b0d14] border-x border-slate-900 shadow-2xl pb-6">
        {/* Sticky Top Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          session={session}
          settings={settings}
          onLogout={handleLogout}
          onOpenAdmin={() => setShowAdminPanel(true)}
          language={settings.language}
        />

        {/* Compact Hero Section banner */}
        <HeroSection
          isLoggedIn={session.isLoggedIn}
          isAdmin={session.isAdmin}
          activeView={activeTab === 'bot' ? 'dashboard' : 'login'}
          onToggleView={() => setActiveTab(activeTab === 'bot' ? 'chat' : 'bot')}
          language={settings.language}
          onAdminClick={() => setShowAdminPanel(true)}
        />

        {/* Dynamic View Tab Rendering */}
        <main className="flex-1 px-3 py-2">
          {/* Tab 1: Telegram Live Group Chat */}
          {activeTab === 'chat' && (
            <TelegramChat
              session={session}
              settings={settings}
              currentIssue={currentIssue}
              onPlaceQuickBet={handleQuickBetFromChat}
              onNavigateToChart={() => setActiveTab('chart')}
              onUpdateBalance={handleUpdateBalance}
              language={settings.language}
            />
          )}

          {/* Tab 2: 777 Live Chart & Analysis with In-Chart Chat */}
          {activeTab === 'chart' && (
            <LiveChartAnalysis
              session={session}
              settings={settings}
              currentIssue={currentIssue}
              countdown={countdown}
              onUpdateBalance={handleUpdateBalance}
              language={settings.language}
            />
          )}

          {/* Tab 3: Killerboss Auto-Bet Bot */}
          {activeTab === 'bot' && (
            session.isLoggedIn ? (
              <BotDashboard
                session={session}
                onUpdateBalance={handleUpdateBalance}
                onLogout={handleLogout}
                language={settings.language}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="bg-[#141624] p-4 rounded-2xl border border-red-500/40 text-center flex flex-col items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  <h4 className="text-sm font-black text-white uppercase">
                    {settings.language === 'my' ? 'Killerboss Auto Bot အသုံးပြုရန်' : 'Access Auto Bot Engine'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {settings.language === 'my'
                      ? 'Auto-Betting, SL Layer နှင့် BS Formula အသုံးပြုရန် အကောင့်ဝင်ရောက်ပေးပါ'
                      : 'Please sign in or start a Demo session to activate automated bot strategies'}
                  </p>
                  <button
                    onClick={() => setActiveTab('login')}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-xs rounded-xl shadow hover:scale-105 transition-transform cursor-pointer"
                  >
                    {settings.language === 'my' ? 'လော့ဂ်အင် ဝင်ရောက်မည်' : 'Sign In Now'}
                  </button>
                </div>
              </div>
            )
          )}

          {/* Tab 4: Settings (Setting ရွေးမယ်) */}
          {activeTab === 'settings' && (
            <SettingsPanel
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              session={session}
              onOpenAdmin={() => setShowAdminPanel(true)}
              language={settings.language}
            />
          )}

          {/* Tab 5: Login / Account Switch */}
          {activeTab === 'login' && (
            <LoginForm
              platform={platform}
              onPlatformChange={setPlatform}
              onLoginSuccess={handleLoginSuccess}
              language={settings.language}
            />
          )}
        </main>
      </div>

      {/* Admin Panel Modal (Requires PIN) */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        language={settings.language}
      />
    </div>
  );
}
