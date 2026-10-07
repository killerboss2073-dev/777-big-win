import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Wallet,
  Clock,
  TrendingUp,
  Settings,
  Layers,
  History,
  Activity,
  LogOut,
  Target,
  Sliders,
  Sparkles,
  ChevronRight,
  Shield,
  HelpCircle
} from 'lucide-react';
import {
  Platform,
  BetMode,
  GameResult,
  BetRecord,
  UserSession,
  BotSettings,
  BotStats
} from '../types';
import { apiGetIssue, apiGetBalance, apiPlaceBet, apiGetResults, apiCheckSession, generateFallbackResults } from '../api';

interface BotDashboardProps {
  session: UserSession;
  onUpdateBalance: (newBalance: number) => void;
  onLogout: () => void;
  language: 'my' | 'en';
}

const COLOUR_MAP: Record<string, { bg: string; text: string; code: number }> = {
  RED: { bg: 'bg-red-600', text: 'text-red-400', code: 10 },
  GREEN: { bg: 'bg-emerald-600', text: 'text-emerald-400', code: 11 },
  VIOLET: { bg: 'bg-purple-600', text: 'text-purple-400', code: 12 }
};

export const BotDashboard: React.FC<BotDashboardProps> = ({
  session,
  onUpdateBalance,
  onLogout,
  language
}) => {
  // Current game period & timer
  const [currentIssue, setCurrentIssue] = useState<string>('20261004100288');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [results, setResults] = useState<GameResult[]>([]);
  const [betHistory, setBetHistory] = useState<BetRecord[]>([]);

  // Bot Settings state matching Telegram Bot logic
  const [settings, setSettings] = useState<BotSettings>({
    mode: 'bot',
    betSequence: [1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000],
    currentBetIndex: 0,
    bsPattern: 'B,S,B,B',
    bsIndex: 0,
    colourPattern: 'G,R,V,R',
    colourIndex: 0,
    slPattern: '2,1,3',
    currentSl: 2,
    slIndex: 0,
    waitLossCount: 0,
    slBetCount: 0,
    isWaitMode: true,
    profitTarget: 50000,
    lossTarget: 30000,
    isRunning: false
  });

  // Bot Statistics
  const [stats, setStats] = useState<BotStats>({
    sessionProfit: 0,
    sessionLoss: 0,
    totalProfit: 0,
    totalBets: 0,
    wins: 0,
    losses: 0
  });

  // Manual betting
  const [manualAmount, setManualAmount] = useState<number>(100);
  const [isPlacingManual, setIsPlacingManual] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'bot' | 'manual' | 'patterns' | 'history'>('bot');
  const [notification, setNotification] = useState<string>('');

  // Modals for editing patterns
  const [showPatternModal, setShowPatternModal] = useState<boolean>(false);
  const [tempBsPattern, setTempBsPattern] = useState(settings.bsPattern);
  const [tempColourPattern, setTempColourPattern] = useState(settings.colourPattern);
  const [tempSlPattern, setTempSlPattern] = useState(settings.slPattern);
  const [tempSequence, setTempSequence] = useState(settings.betSequence.join(', '));
  const [tempProfitTarget, setTempProfitTarget] = useState(settings.profitTarget.toString());
  const [tempLossTarget, setTempLossTarget] = useState(settings.lossTarget.toString());

  // Ref tracking last processed issue to prevent duplicate bets per period
  const lastProcessedIssueRef = useRef<string>('');
  const isBettingRef = useRef<boolean>(false);

  // Mask phone helper (e.g. 9796572086 -> 979*****86)
  const maskPhone = (phone: string) => {
    const p = String(phone || '').trim();
    if (p.length <= 5) return p;
    return `${p.slice(0, 3)}*****${p.slice(-2)}`;
  };

  // Show banner alert
  const showAlert = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4500);
  };

  // 1. Initial Data Fetching & Periodic Refresh
  const fetchLiveData = async () => {
    try {
      // 1. Fetch Game Issue
      const issueRes = await apiGetIssue(session.platform, session.token, session.userId);
      if (issueRes?.sessionRevoked) {
        onLogout();
        return;
      }
      if (issueRes.success && issueRes.issueNumber) {
        setCurrentIssue(issueRes.issueNumber);
        if (issueRes.data?.endTime && issueRes.data?.serviceTime) {
          const end = new Date(issueRes.data.endTime.replace(' ', 'T')).getTime();
          const serv = new Date(issueRes.data.serviceTime.replace(' ', 'T')).getTime();
          const diffSec = Math.max(0, Math.floor((end - serv) / 1000));
          if (!isNaN(diffSec) && diffSec >= 0 && diffSec <= 60) {
            setSecondsRemaining(diffSec);
          }
        }
      }

      // 2. Fetch Results
      const resData = await apiGetResults(session.platform, 15, session.token);
      if (resData.success && resData.results && resData.results.length > 0) {
        setResults(resData.results);
      } else if (results.length === 0) {
        setResults(generateFallbackResults(15));
      }

      // 3. Fetch Balance
      if (session.token && !session.token.startsWith('DEMO')) {
        const balRes = await apiGetBalance(session.token, session.platform, session.userId);
        if (balRes?.sessionRevoked) {
          onLogout();
          return;
        }
        if (balRes.success && typeof balRes.amount === 'number') {
          onUpdateBalance(balRes.amount);
        }
      }
    } catch {
      if (results.length === 0) {
        setResults(generateFallbackResults(15));
      }
    }
  };

  // Real-time Session Check: Instantly kicks user out if Admin removed ID with /rid
  useEffect(() => {
    if (!session.userId || session.token.startsWith('DEMO')) return;

    const checkSessionStatus = async () => {
      try {
        const res = await apiCheckSession(session.userId);
        if (res.sessionRevoked || res.allowed === false) {
          onLogout();
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(checkSessionStatus, 3000);
    return () => clearInterval(interval);
  }, [session.userId, session.token, onLogout]);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 15000);
    return () => clearInterval(interval);
  }, [session.platform, session.token]);

  // 2. WinGo 60-Second Clock Synchronizer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentSeconds = now.getSeconds();
      const remaining = 60 - currentSeconds;
      setSecondsRemaining(remaining);

      // When remaining is 59, new period has just begun!
      if (remaining === 59) {
        fetchLiveData();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 3. Next Prediction calculation based on current Bot Mode
  const getNextPrediction = (): { label: string; type: number; colour?: string } => {
    const { mode, bsPattern, bsIndex, colourPattern, colourIndex } = settings;

    if (mode === 'big') {
      return { label: 'BIG', type: 13 };
    }
    if (mode === 'small') {
      return { label: 'SMALL', type: 14 };
    }
    if (mode === 'follow') {
      if (results.length > 0) {
        const last = results[0];
        const lastSize = last.size === 'BIG' ? 'BIG' : 'SMALL';
        return { label: `${lastSize} (Follow)`, type: lastSize === 'BIG' ? 13 : 14 };
      }
      return { label: 'BIG', type: 13 };
    }
    if (mode === 'bs_formula') {
      const pList = bsPattern.split(',').map((p) => p.trim().toUpperCase());
      const char = pList[bsIndex % pList.length] || 'B';
      return {
        label: `${char === 'B' ? 'BIG' : 'SMALL'} (Step ${bsIndex + 1}/${pList.length})`,
        type: char === 'B' ? 13 : 14
      };
    }
    if (mode === 'colour_formula') {
      const cList = colourPattern.split(',').map((p) => p.trim().toUpperCase());
      const char = cList[colourIndex % cList.length] || 'R';
      if (char === 'G') return { label: 'GREEN', type: 11, colour: 'text-emerald-400' };
      if (char === 'V') return { label: 'VIOLET', type: 12, colour: 'text-purple-400' };
      return { label: 'RED', type: 10, colour: 'text-red-400' };
    }
    if (mode === 'sl_layer') {
      if (settings.isWaitMode) {
        return { label: `WAIT BOT (SL ${settings.currentSl})`, type: 0 };
      }
      // In betting mode, use BS pattern or follow
      return { label: `BETTING (SL ${settings.currentSl})`, type: 13 };
    }
    // Random Bot
    return { label: Math.random() < 0.5 ? 'BIG' : 'SMALL', type: Math.random() < 0.5 ? 13 : 14 };
  };

  // 4. Auto-Betting Engine Loop (WinGo 1-Min)
  useEffect(() => {
    if (!settings.isRunning) return;

    // Bet between 15s and 50s into the round to ensure period is fresh and open
    if (secondsRemaining > 12 && secondsRemaining < 52) {
      if (lastProcessedIssueRef.current !== currentIssue && !isBettingRef.current) {
        handleExecuteAutoBet();
      }
    }
  }, [secondsRemaining, settings.isRunning, currentIssue]);

  // Execute Auto Bet with complete rules from Telegram Bot
  const handleExecuteAutoBet = async () => {
    isBettingRef.current = true;
    lastProcessedIssueRef.current = currentIssue;

    const prediction = getNextPrediction();
    const currentBetAmount = settings.betSequence[settings.currentBetIndex] || settings.betSequence[0];

    // Check Profit & Loss Targets
    const netProfit = stats.sessionProfit - stats.sessionLoss;
    if (settings.profitTarget > 0 && netProfit >= settings.profitTarget) {
      showAlert(`🎉 PROFIT TARGET REACHED (+${netProfit.toLocaleString()} K)! Auto Bot Stopped.`);
      setSettings((s) => ({ ...s, isRunning: false }));
      isBettingRef.current = false;
      return;
    }
    if (settings.lossTarget > 0 && stats.sessionLoss >= settings.lossTarget) {
      showAlert(`⚠️ LOSS TARGET REACHED (-${stats.sessionLoss.toLocaleString()} K)! Auto Bot Stopped.`);
      setSettings((s) => ({ ...s, isRunning: false }));
      isBettingRef.current = false;
      return;
    }

    // Check Balance
    if (!settings.isWaitMode && session.balance < currentBetAmount) {
      showAlert(`⚠️ Insufficient Balance (${session.balance.toLocaleString()} K) for bet (${currentBetAmount.toLocaleString()} K)`);
      setSettings((s) => ({ ...s, isRunning: false }));
      isBettingRef.current = false;
      return;
    }

    // SL Layer Wait Mode handling
    if (settings.mode === 'sl_layer' && settings.isWaitMode) {
      const waitRecord: BetRecord = {
        id: Math.random().toString(36).substring(2, 9),
        issue: currentIssue,
        betType: `WAIT (SL ${settings.currentSl})`,
        amount: 0,
        result: 'PENDING',
        profitLoss: 0,
        createdAt: new Date().toLocaleTimeString(),
        platform: session.platform,
        isWaitMode: true
      };
      setBetHistory((prev) => [waitRecord, ...prev.slice(0, 49)]);
      showAlert(`⏳ SL Bot Wait Mode: Monitoring issue ${currentIssue} (SL ${settings.currentSl})`);
      isBettingRef.current = false;
      return;
    }

    // Place Real or Simulated Bet
    let betSuccess = false;
    let betResponseMsg = '';

    if (session.token.startsWith('DEMO')) {
      // Simulator mode: deduct balance
      onUpdateBalance(Math.max(0, session.balance - currentBetAmount));
      betSuccess = true;
    } else {
      const res = await apiPlaceBet(
        session.token,
        currentBetAmount,
        prediction.type,
        currentIssue,
        session.platform,
        session.userId
      );
      if (res?.sessionRevoked) {
        onLogout();
        return;
      }
      if (res.success) {
        betSuccess = true;
        onUpdateBalance(Math.max(0, session.balance - currentBetAmount));
      } else {
        betResponseMsg = res.message || 'Bet failed';
      }
    }

    if (betSuccess) {
      const newRecord: BetRecord = {
        id: Math.random().toString(36).substring(2, 9),
        issue: currentIssue,
        betType: prediction.label,
        amount: currentBetAmount,
        result: 'PENDING',
        profitLoss: 0,
        createdAt: new Date().toLocaleTimeString(),
        platform: session.platform
      };

      setBetHistory((prev) => [newRecord, ...prev.slice(0, 49)]);
      showAlert(`✅ Auto Bet placed on ${prediction.label}: ${currentBetAmount.toLocaleString()} K (Step ${settings.currentBetIndex + 1})`);

      // Update BS or Colour index
      if (settings.mode === 'bs_formula') {
        const pList = settings.bsPattern.split(',');
        setSettings((s) => ({ ...s, bsIndex: (s.bsIndex + 1) % pList.length }));
      } else if (settings.mode === 'colour_formula') {
        const cList = settings.colourPattern.split(',');
        setSettings((s) => ({ ...s, colourIndex: (s.colourIndex + 1) % cList.length }));
      }

      // If SL Layer betting mode, increment slBetCount
      if (settings.mode === 'sl_layer') {
        setSettings((s) => ({ ...s, slBetCount: s.slBetCount + 1 }));
      }
    } else {
      showAlert(`❌ Auto Bet Failed: ${betResponseMsg}`);
    }

    isBettingRef.current = false;
  };

  // 5. Result Settlement Engine: evaluate pending bets when results change
  useEffect(() => {
    if (results.length === 0) return;
    const latestResult = results[0];

    // Check if there are pending bets for this or previous issues
    setBetHistory((prevHistory) => {
      let updated = false;
      const nextHistory = prevHistory.map((bet) => {
        if (bet.result === 'PENDING') {
          // Find matching result
          const matched = results.find((r) => r.issueNumber === bet.issue);
          if (matched) {
            updated = true;
            let isWin = false;
            const num = parseInt(matched.number, 10);

            if (bet.betType.includes('BIG') && num >= 5) isWin = true;
            else if (bet.betType.includes('SMALL') && num < 5) isWin = true;
            else if (bet.betType.includes('RED') && matched.colour === 'RED') isWin = true;
            else if (bet.betType.includes('GREEN') && matched.colour === 'GREEN') isWin = true;
            else if (bet.betType.includes('VIOLET') && matched.colour === 'VIOLET') isWin = true;

            const profit = isWin ? Math.floor(bet.amount * 0.96) : -bet.amount;

            // Update stats
            setStats((prevStats) => ({
              ...prevStats,
              totalBets: prevStats.totalBets + 1,
              totalProfit: prevStats.totalProfit + profit,
              sessionProfit: isWin ? prevStats.sessionProfit + profit : prevStats.sessionProfit,
              sessionLoss: !isWin ? prevStats.sessionLoss + bet.amount : prevStats.sessionLoss,
              wins: isWin ? prevStats.wins + 1 : prevStats.wins,
              losses: !isWin ? prevStats.losses + 1 : prevStats.losses
            }));

            // Credit balance on win
            if (isWin) {
              onUpdateBalance(session.balance + bet.amount + profit);
            }

            // Adjust Martingale sequence
            if (isWin) {
              setSettings((s) => ({ ...s, currentBetIndex: 0 }));
            } else {
              setSettings((s) => ({
                ...s,
                currentBetIndex: (s.currentBetIndex + 1) % s.betSequence.length
              }));
            }

            // SL Layer logic update matching Telegram bot
            if (settings.mode === 'sl_layer') {
              handleSlResultUpdate(isWin);
            }

            return {
              ...bet,
              result: isWin ? ('WIN' as const) : ('LOSE' as const),
              profitLoss: profit
            };
          }
        }
        return bet;
      });

      return updated ? nextHistory : prevHistory;
    });
  }, [results]);

  // SL Layer result handler matching Telegram bot
  const handleSlResultUpdate = (isWin: boolean) => {
    const slList = settings.slPattern.split(',').map((x) => parseInt(x.trim(), 10) || 1);
    const limit = slList[settings.slIndex] || slList[0];

    if (settings.isWaitMode) {
      if (isWin) {
        setSettings((s) => ({ ...s, waitLossCount: 0 }));
      } else {
        const nextLoss = settings.waitLossCount + 1;
        if (nextLoss >= limit) {
          // Switch to betting mode
          showAlert(`🔥 SL WAIT LIMIT REACHED (${nextLoss}/${limit})! Switching to BETTING MODE`);
          setSettings((s) => ({
            ...s,
            isWaitMode: false,
            waitLossCount: 0,
            slBetCount: 0
          }));
        } else {
          setSettings((s) => ({ ...s, waitLossCount: nextLoss }));
        }
      }
    } else {
      // In betting mode
      if (isWin) {
        // Reset back to SL 1
        showAlert(`🎉 SL BET WIN! Resetting to first SL`);
        setSettings((s) => ({
          ...s,
          slIndex: 0,
          currentSl: slList[0],
          isWaitMode: slList[0] >= 2,
          waitLossCount: 0,
          slBetCount: 0,
          currentBetIndex: 0
        }));
      } else {
        if (settings.slBetCount >= 3) {
          const nextIndex = (settings.slIndex + 1) % slList.length;
          const nextSl = slList[nextIndex];
          showAlert(`🔄 3 Bets completed. Moving to SL ${nextSl}`);
          setSettings((s) => ({
            ...s,
            slIndex: nextIndex,
            currentSl: nextSl,
            isWaitMode: nextSl >= 2,
            waitLossCount: 0,
            slBetCount: 0
          }));
        }
      }
    }
  };

  // Manual Bet Trigger
  const handleManualBet = async (type: number, label: string) => {
    if (manualAmount <= 0) {
      showAlert('Enter valid bet amount');
      return;
    }
    if (session.balance < manualAmount) {
      showAlert('Insufficient balance!');
      return;
    }

    setIsPlacingManual(true);
    let success = false;

    if (session.token.startsWith('DEMO')) {
      onUpdateBalance(session.balance - manualAmount);
      success = true;
    } else {
      const res = await apiPlaceBet(
        session.token,
        manualAmount,
        type,
        currentIssue,
        session.platform,
        session.userId
      );
      if (res?.sessionRevoked) {
        onLogout();
        return;
      }
      if (res.success) {
        onUpdateBalance(session.balance - manualAmount);
        success = true;
      } else {
        showAlert(res.message || 'Bet failed');
      }
    }

    if (success) {
      const newRecord: BetRecord = {
        id: Math.random().toString(36).substring(2, 9),
        issue: currentIssue,
        betType: label,
        amount: manualAmount,
        result: 'PENDING',
        profitLoss: 0,
        createdAt: new Date().toLocaleTimeString(),
        platform: session.platform
      };
      setBetHistory((prev) => [newRecord, ...prev.slice(0, 49)]);
      showAlert(`✅ Manual bet placed: ${label} (${manualAmount.toLocaleString()} K)`);
    }

    setIsPlacingManual(false);
  };

  // Save Settings Modal Handler
  const handleSaveModalSettings = () => {
    try {
      const seq = tempSequence
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((x) => !isNaN(x) && x > 0);

      const pTarget = parseInt(tempProfitTarget, 10) || 0;
      const lTarget = parseInt(tempLossTarget, 10) || 0;

      setSettings((s) => ({
        ...s,
        betSequence: seq.length > 0 ? seq : s.betSequence,
        bsPattern: tempBsPattern.toUpperCase(),
        colourPattern: tempColourPattern.toUpperCase(),
        slPattern: tempSlPattern,
        profitTarget: pTarget,
        lossTarget: lTarget
      }));

      setShowPatternModal(false);
      showAlert('⚙️ Settings saved successfully!');
    } catch {
      showAlert('Error saving settings. Check format.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-20 space-y-4">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 max-w-sm w-[92%] z-50 p-3 bg-red-950/95 border-2 border-red-500 rounded-2xl shadow-2xl text-xs font-bold text-white text-center animate-in fade-in slide-in-from-top-4 backdrop-blur-md">
          {notification}
        </div>
      )}

      {/* 1. Account Info Bar */}
      <div className="bg-[#14151e] border border-red-950/80 rounded-2xl p-3.5 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 p-0.5 flex items-center justify-center shadow-md">
            <div className="w-full h-full bg-[#111218] rounded-[10px] flex items-center justify-center text-red-500 font-black text-xs">
              777
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white">{maskPhone(session.phone)}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 font-mono">
                ID: {session.gameId || session.userId}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Wallet className="w-3 h-3 text-amber-400" />
              <span className="font-bold text-white text-xs font-mono">
                {session.balance.toLocaleString()} K
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveData}
            className="p-2 rounded-xl bg-[#1b1c28] hover:bg-[#252738] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Balance"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-[#1b1c28] hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. WinGo 1-Min Live Draw Timer Card */}
      <div className="bg-gradient-to-br from-[#1c0808] to-[#12131b] border-2 border-red-900/60 rounded-3xl p-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-red-950/60">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              WinGo 1-Min Period
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-amber-400">
            #{currentIssue}
          </span>
        </div>

        {/* Big Animated Countdown Gauge */}
        <div className="grid grid-cols-2 gap-3 items-center py-4">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#27272a"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke={secondsRemaining < 10 ? '#ef4444' : '#10b981'}
                  strokeWidth="8"
                  strokeDasharray={251}
                  strokeDashoffset={251 - (251 * secondsRemaining) / 60}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className={`font-mono text-3xl font-black ${secondsRemaining < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {String(secondsRemaining).padStart(2, '0')}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-400">SECONDS</span>
              </div>
            </div>
          </div>

          {/* Next AI Prediction & Status */}
          <div className="space-y-2">
            <div className="bg-[#111218]/90 rounded-2xl p-2.5 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                {language === 'my' ? 'နောက်ထွက်မည့် အထိုးခန့်မှန်းချက်' : 'Next Prediction'}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-yellow-400 animate-bounce" />
                <span className="text-base font-black text-amber-300 font-mono tracking-wide">
                  {getNextPrediction().label}
                </span>
              </div>
            </div>

            <div className="bg-[#111218]/90 rounded-2xl p-2 border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Bet Status:</span>
              <span className={`font-bold ${secondsRemaining < 10 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                {secondsRemaining < 10 ? 'Settling Draw...' : 'Open for Bets'}
              </span>
            </div>
          </div>
        </div>

        {/* Last Winning Ball Badge */}
        {results.length > 0 && (
          <div className="pt-2 border-t border-red-950/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Last Result ({results[0].issueNumber}):</span>
            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full text-white font-black flex items-center justify-center shadow-md font-mono text-sm ${
                  COLOUR_MAP[results[0].colour]?.bg || 'bg-slate-700'
                }`}
              >
                {results[0].number}
              </span>
              <span className="font-bold text-slate-200">
                {results[0].size}
              </span>
              <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${COLOUR_MAP[results[0].colour]?.bg || 'bg-slate-800'} text-white`}>
                {results[0].colour}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Navigation Sub-Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[#12131a] rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('bot')}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'bot'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Auto Bot
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Quick Bet
        </button>
        <button
          onClick={() => setActiveTab('patterns')}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'patterns'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Formula
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          History
        </button>
      </div>

      {/* TAB 1: AUTO BOT CONTROL CENTER */}
      {activeTab === 'bot' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Master Start / Stop Button */}
          <div className="bg-[#14151e] border-2 border-red-950/80 rounded-3xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-500" />
                  <span>{language === 'my' ? 'အော်တို ဘော့ အခြေအနေ' : 'BOT ENGINE STATUS'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {settings.isRunning
                    ? 'Bot is actively auto-betting on every issue'
                    : 'Bot is currently idle and waiting for activation'}
                </p>
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
                settings.isRunning
                  ? 'bg-emerald-950 border border-emerald-500 text-emerald-400 animate-pulse'
                  : 'bg-slate-900 border border-slate-700 text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${settings.isRunning ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>{settings.isRunning ? 'RUNNING' : 'STOPPED'}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (settings.isRunning) {
                  setSettings((s) => ({ ...s, isRunning: false }));
                  showAlert('🛑 Auto Bot Stopped!');
                } else {
                  setSettings((s) => ({ ...s, isRunning: true }));
                  showAlert('🚀 Auto Bot Started! Placing automated bets.');
                }
              }}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-2xl cursor-pointer ${
                settings.isRunning
                  ? 'bg-gradient-to-r from-red-700 to-rose-900 hover:from-red-600 hover:to-rose-800 text-white shadow-red-900/50'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-900/50'
              }`}
            >
              {settings.isRunning ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>{language === 'my' ? 'STOP BOT (ရပ်တန့်မည်)' : 'STOP AUTO BOT'}</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>{language === 'my' ? 'RUN BOT (အော်တို စတင်မည်)' : 'RUN AUTO BOT'}</span>
                </>
              )}
            </button>
          </div>

          {/* Mode Selector (The 7 Modes from Telegram Bot) */}
          <div className="bg-[#14151e] border border-red-950/70 rounded-3xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-red-500" />
                <span>{language === 'my' ? 'လောင်းကြေး မုဒ် ရွေးချယ်ပါ' : 'BETTING MODE'}</span>
              </label>

              <button
                onClick={() => setShowPatternModal(true)}
                className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>Configure</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'bot', name: 'Random Bot', desc: '50/50 BIG & SMALL' },
                { id: 'follow', name: 'Follow Bot', desc: 'Follows Last Result' },
                { id: 'big', name: 'Random BIG', desc: 'Always Bet BIG' },
                { id: 'small', name: 'Random SMALL', desc: 'Always Bet SMALL' },
                { id: 'bs_formula', name: 'BS Formula', desc: settings.bsPattern },
                { id: 'colour_formula', name: 'Colour Formula', desc: settings.colourPattern },
                { id: 'sl_layer', name: 'SL Layer Bot', desc: `Pattern: ${settings.slPattern}` }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSettings((s) => ({ ...s, mode: m.id as BetMode }))}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    settings.mode === m.id
                      ? 'bg-red-950/40 border-red-500 text-white shadow-md'
                      : 'bg-[#181922] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  } ${m.id === 'sl_layer' ? 'col-span-2' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">{m.name}</span>
                    {settings.mode === m.id && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate mt-0.5 font-mono">
                    {m.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Step & Sequence Card */}
          <div className="bg-[#14151e] border border-red-950/70 rounded-3xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-200 uppercase tracking-wider">
                Martingale Multiplier Sequence
              </span>
              <span className="font-mono text-amber-400 font-bold">
                Step {settings.currentBetIndex + 1} of {settings.betSequence.length}
              </span>
            </div>

            {/* Sequence Step Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {settings.betSequence.map((amount, idx) => (
                <div
                  key={idx}
                  className={`px-2.5 py-1.5 rounded-xl text-center shrink-0 font-mono text-xs font-bold border transition-all ${
                    idx === settings.currentBetIndex
                      ? 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)] scale-105'
                      : 'bg-[#181922] text-slate-400 border-slate-800'
                  }`}
                >
                  <div className="text-[8px] text-slate-400">#{idx + 1}</div>
                  <div>{amount >= 1000 ? `${amount / 1000}K` : amount}</div>
                </div>
              ))}
            </div>

            {/* Target Guards Status */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div className="bg-[#111218] p-2 rounded-xl border border-slate-850">
                <span className="text-slate-400 block">Profit Target:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {settings.profitTarget > 0 ? `+${settings.profitTarget.toLocaleString()} K` : 'Disabled'}
                </span>
              </div>
              <div className="bg-[#111218] p-2 rounded-xl border border-slate-850">
                <span className="text-slate-400 block">Loss Target:</span>
                <span className="font-mono font-bold text-rose-400">
                  {settings.lossTarget > 0 ? `-${settings.lossTarget.toLocaleString()} K` : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUICK MANUAL BET */}
      {activeTab === 'manual' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-[#14151e] border-2 border-red-950/80 rounded-3xl p-4 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-red-500" />
              <span>{language === 'my' ? 'လက်ဖြင့် တိုက်ရိုက် ထိုးမည်' : 'QUICK MANUAL BET'}</span>
            </h3>

            {/* Amount Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase">
                  {language === 'my' ? 'လောင်းကြေးပမာဏ ရွေးချယ်ပါ:' : 'Select Bet Amount:'}
                </label>
                <span className="text-[10px] font-mono text-amber-400 font-bold">
                  {manualAmount.toLocaleString()} K
                </span>
              </div>

              {/* 1,000 ~ 320,000 Series */}
              <div className="mb-1.5">
                <span className="text-[9px] text-slate-400 font-semibold block mb-1">
                  1,000 ~ 320,000 (8-Step Martingale):
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setManualAmount(amt)}
                      className={`py-1.5 rounded-xl font-mono text-[11px] font-black border transition-all cursor-pointer ${
                        manualAmount === amt
                          ? 'bg-red-600 text-white border-red-400 shadow-md scale-102'
                          : 'bg-[#181922] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 100 ~ 72,900 Series */}
              <div>
                <span className="text-[9px] text-slate-400 font-semibold block mb-1">
                  100 ~ 72,900 (7-Step 3X Formula):
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 300, 900, 2700, 8100, 24300, 72900].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setManualAmount(amt)}
                      className={`py-1.5 rounded-xl font-mono text-[11px] font-black border transition-all cursor-pointer ${
                        manualAmount === amt
                          ? 'bg-amber-600 text-white border-amber-400 shadow-md scale-102'
                          : 'bg-[#181922] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(Math.max(10, parseInt(e.target.value, 10) || 0))}
                className="w-full mt-2 bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
                placeholder="Custom Amount (min 10 K)"
              />
            </div>

            {/* BIG & SMALL Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                disabled={isPlacingManual}
                onClick={() => handleManualBet(13, 'BIG')}
                className="py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 text-white font-black text-base uppercase tracking-wider shadow-lg cursor-pointer disabled:opacity-50"
              >
                BET BIG (1.96x)
              </button>
              <button
                disabled={isPlacingManual}
                onClick={() => handleManualBet(14, 'SMALL')}
                className="py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-98 text-white font-black text-base uppercase tracking-wider shadow-lg cursor-pointer disabled:opacity-50"
              >
                BET SMALL (1.96x)
              </button>
            </div>

            {/* Colour Buttons (RED, GREEN, VIOLET) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                disabled={isPlacingManual}
                onClick={() => handleManualBet(10, 'RED')}
                className="py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-50"
              >
                RED (1.96x)
              </button>
              <button
                disabled={isPlacingManual}
                onClick={() => handleManualBet(11, 'GREEN')}
                className="py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-50"
              >
                GREEN (1.96x)
              </button>
              <button
                disabled={isPlacingManual}
                onClick={() => handleManualBet(12, 'VIOLET')}
                className="py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-50"
              >
                VIOLET (1.44x)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FORMULA & SL PATTERNS CONFIGURATION */}
      {activeTab === 'patterns' && (
        <div className="space-y-4 animate-in fade-in">
          {/* SL Layer Explanation Card */}
          <div className="bg-[#14151e] border-2 border-red-950/80 rounded-3xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-500" />
                <span>SL LAYER MULTI-TIER ENGINE</span>
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                settings.isWaitMode ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
              }`}>
                {settings.isWaitMode ? 'WAIT BOT MODE' : 'ACTIVE BETTING MODE'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              SL Layer uses intelligent loss-counting filters. In SL 2+, the bot enters{' '}
              <strong className="text-amber-400">Wait Mode</strong> without risking real money until{' '}
              <strong className="text-white">{settings.currentSl} consecutive losses</strong> occur, then activates{' '}
              <strong className="text-emerald-400">Betting Mode</strong> for up to 3 rounds!
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono">
              <div className="bg-[#111218] p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Current SL Level:</span>
                <span className="text-lg font-black text-white">SL {settings.currentSl}</span>
              </div>
              <div className="bg-[#111218] p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Wait Loss Count:</span>
                <span className="text-lg font-black text-amber-400">
                  {settings.waitLossCount} / {settings.currentSl}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowPatternModal(true)}
              className="w-full py-3 bg-[#1e202e] hover:bg-[#25283a] border border-red-900/50 rounded-2xl text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4 text-red-400" />
              <span>{language === 'my' ? 'SL & Formula ပြင်ဆင်မည်' : 'Customize SL & Formula Patterns'}</span>
            </button>
          </div>

          {/* Patterns Info */}
          <div className="bg-[#14151e] border border-red-950/70 rounded-3xl p-4 shadow-lg space-y-3">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">
              Formula Sequences
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#111218] rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">BS Formula Pattern:</span>
                  <span className="font-mono font-bold text-white tracking-widest">{settings.bsPattern}</span>
                </div>
                <span className="text-[11px] font-mono text-red-400">Step {settings.bsIndex + 1}</span>
              </div>
              <div className="p-3 bg-[#111218] rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Colour Formula Pattern:</span>
                  <span className="font-mono font-bold text-white tracking-widest">{settings.colourPattern}</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">Step {settings.colourIndex + 1}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BET HISTORY & STATS */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Stats Bar */}
          <div className="bg-[#14151e] border border-red-950/70 rounded-3xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Session Performance</span>
              </h3>
              <button
                onClick={() =>
                  setStats({
                    sessionProfit: 0,
                    sessionLoss: 0,
                    totalProfit: 0,
                    totalBets: 0,
                    wins: 0,
                    losses: 0
                  })
                }
                className="text-[10px] text-red-400 hover:text-red-300 font-bold"
              >
                Reset Stats
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-[#111218] p-2.5 rounded-2xl border border-slate-800">
                <span className="text-[9px] text-slate-400 block uppercase font-sans">Net Profit</span>
                <span className={`text-xs font-black ${
                  stats.sessionProfit - stats.sessionLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {(stats.sessionProfit - stats.sessionLoss).toLocaleString()} K
                </span>
              </div>
              <div className="bg-[#111218] p-2.5 rounded-2xl border border-slate-800">
                <span className="text-[9px] text-slate-400 block uppercase font-sans">Total Bets</span>
                <span className="text-xs font-black text-white">{stats.totalBets}</span>
              </div>
              <div className="bg-[#111218] p-2.5 rounded-2xl border border-slate-800">
                <span className="text-[9px] text-slate-400 block uppercase font-sans">Win Rate</span>
                <span className="text-xs font-black text-yellow-400">
                  {stats.totalBets > 0 ? `${Math.round((stats.wins / stats.totalBets) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* History List */}
          <div className="bg-[#14151e] border border-red-950/70 rounded-3xl p-4 shadow-lg space-y-2">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
              Recent Bets Log ({betHistory.length})
            </h4>

            {betHistory.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No bets placed in this session yet. Run the bot or place a quick bet!
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {betHistory.map((bet) => (
                  <div
                    key={bet.id}
                    className="p-3 bg-[#111218] border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>{bet.betType}</span>
                        <span className="text-[10px] text-slate-400 font-mono">#{bet.issue}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{bet.createdAt}</span>
                    </div>

                    <div className="text-right font-mono">
                      <div className="font-bold text-white">
                        {bet.amount > 0 ? `${bet.amount.toLocaleString()} K` : '0 K'}
                      </div>
                      <div
                        className={`text-[10px] font-black tracking-wider uppercase ${
                          bet.result === 'WIN'
                            ? 'text-emerald-400'
                            : bet.result === 'LOSE'
                            ? 'text-rose-400'
                            : 'text-amber-400 animate-pulse'
                        }`}
                      >
                        {bet.result === 'WIN'
                          ? `+${bet.profitLoss.toLocaleString()} K`
                          : bet.result}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Live Recent WinGo Lottery Draws (Always visible at bottom) */}
      <div className="bg-[#14151e] border border-red-950/70 rounded-3xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-red-500" />
            <span>Recent WinGo Results</span>
          </h4>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center">
          {results.slice(0, 10).map((r, i) => (
            <div
              key={r.issueNumber || i}
              className="bg-[#111218] border border-slate-850 p-2 rounded-2xl flex flex-col items-center justify-center gap-1"
            >
              <span
                className={`w-7 h-7 rounded-full text-white font-black flex items-center justify-center shadow-md font-mono text-xs ${
                  COLOUR_MAP[r.colour]?.bg || 'bg-slate-700'
                }`}
              >
                {r.number}
              </span>
              <span className="text-[10px] font-bold text-slate-300">
                {r.size}
              </span>
              <span className="text-[8px] font-mono text-slate-500 truncate w-full">
                {r.issueNumber.slice(-4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. MODAL: Customize Patterns & Targets */}
      {showPatternModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151e] border-2 border-red-800 max-w-sm w-full rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Configure Bot Patterns
              </h3>
              <button
                onClick={() => setShowPatternModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* BS Pattern Input */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                BS Formula Pattern (B for BIG, S for SMALL)
              </label>
              <input
                type="text"
                value={tempBsPattern}
                onChange={(e) => setTempBsPattern(e.target.value.toUpperCase())}
                placeholder="B,S,B,B"
                className="w-full bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            {/* Colour Pattern Input */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Colour Formula Pattern (R, G, V)
              </label>
              <input
                type="text"
                value={tempColourPattern}
                onChange={(e) => setTempColourPattern(e.target.value.toUpperCase())}
                placeholder="R,G,V,R"
                className="w-full bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            {/* SL Pattern Input */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                SL Layer Pattern (e.g. 2,1,3)
              </label>
              <input
                type="text"
                value={tempSlPattern}
                onChange={(e) => setTempSlPattern(e.target.value)}
                placeholder="2,1,3"
                className="w-full bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            {/* Bet Sequence Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Martingale Bet Sequence (K)
                </label>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => setTempSequence('1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000')}
                  className="flex-1 py-1 px-1.5 bg-red-950 text-red-300 border border-red-800 rounded-lg text-[10px] font-bold hover:bg-red-900 transition-all cursor-pointer"
                >
                  ⚡ 1000 ~ 320K (8L)
                </button>
                <button
                  type="button"
                  onClick={() => setTempSequence('100, 300, 900, 2700, 8100, 24300, 72900')}
                  className="flex-1 py-1 px-1.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-lg text-[10px] font-bold hover:bg-amber-900 transition-all cursor-pointer"
                >
                  🎯 100 ~ 72.9K (7L 3X)
                </button>
              </div>

              <input
                type="text"
                value={tempSequence}
                onChange={(e) => setTempSequence(e.target.value)}
                placeholder="1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000"
                className="w-full bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            {/* Profit & Loss Targets */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">
                  Profit Target (K)
                </label>
                <input
                  type="number"
                  value={tempProfitTarget}
                  onChange={(e) => setTempProfitTarget(e.target.value)}
                  className="w-full bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">
                  Loss Target (K)
                </label>
                <input
                  type="number"
                  value={tempLossTarget}
                  onChange={(e) => setTempLossTarget(e.target.value)}
                  className="w-full bg-[#111218] border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPatternModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalSettings}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
