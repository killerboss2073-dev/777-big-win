import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Flame, 
  Zap, 
  MessageSquare, 
  Eye, 
  EyeOff, 
  Send, 
  Coins, 
  BarChart3, 
  RefreshCw,
  Layers,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameResult, UserSession, UserAppSettings, ChatMessage } from '../types';
import { apiGetResults, apiPlaceBet, apiSendChatMessage, apiGetChatHistory, playSoundEffect } from '../api';

interface LiveChartAnalysisProps {
  session: UserSession;
  settings: UserAppSettings;
  currentIssue: string;
  countdown: number;
  onUpdateBalance?: (newBal: number) => void;
  language: 'my' | 'en';
}

// 2 Multiplier/Ladder Series requested by user:
// Series 1: 1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000
const SERIES_1000 = [1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000];
// Series 2: 100, 300, 900, 2700, 8100, 24300, 72900
const SERIES_100 = [100, 300, 900, 2700, 8100, 24300, 72900];

export const LiveChartAnalysis: React.FC<LiveChartAnalysisProps> = ({
  session,
  settings,
  currentIssue,
  countdown,
  onUpdateBalance,
  language
}) => {
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<'trend' | 'candlestick' | 'roadmap'>('trend');
  const [showInChartChat, setShowInChartChat] = useState<boolean>(true);
  const [inChartChatInput, setInChartChatInput] = useState('');
  const [chartMessages, setChartMessages] = useState<ChatMessage[]>([]);
  
  // Stake Amount state
  const [selectedLadder, setSelectedLadder] = useState<'1000' | '100'>('1000');
  const [selectedBetAmount, setSelectedBetAmount] = useState<number>(1000);
  const [bettingStatus, setBettingStatus] = useState<string | null>(null);

  // Live Killerboss Signal state (Synced with Admin broadcasts & AI)
  const [liveSignal, setLiveSignal] = useState<{
    prediction: 'BIG' | 'SMALL';
    confidence: number;
    issue?: string;
  }>({
    prediction: 'BIG',
    confidence: 97.2
  });

  const isAdminUser = Boolean(
    session.isLoggedIn && (
      session.isAdmin ||
      session.userId === '8370471165' ||
      session.chartId === '8370471165' ||
      session.gameId === '761699' ||
      session.userId === '761699' ||
      (session.phone && session.phone.includes('9791111116'))
    )
  );

  // Listen to live WebSocket signals & chat stream
  useEffect(() => {
    // Initial load of chat history for in-chart display
    apiGetChatHistory().then((data) => {
      if (data && data.success && Array.isArray(data.messages)) {
        setChartMessages(data.messages.slice(-8));
      }
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chart:signal' && data.payload) {
          setLiveSignal({
            prediction: data.payload.prediction || 'BIG',
            confidence: data.payload.confidence || 96,
            issue: data.payload.issue
          });
        }
        if (data.type === 'chat:message' && data.payload) {
          setChartMessages((prev) => [...prev.slice(-9), data.payload]);
          if (data.payload.signal) {
            setLiveSignal({
              prediction: data.payload.signal.prediction || 'BIG',
              confidence: data.payload.signal.confidence || 96,
              issue: data.payload.signal.issue
            });
          }
        }
      } catch {}
    };

    return () => ws.close();
  }, []);

  // Fetch results and setup live stream
  const fetchRecentResults = async () => {
    setLoading(true);
    const data = await apiGetResults(session.platform || '777', 25, session.token);
    if (data.success && data.results) {
      setResults(data.results);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecentResults();
    const interval = setInterval(fetchRecentResults, 12000);
    return () => clearInterval(interval);
  }, [session.platform, session.token]);

  // Handle In-Chart Chat submission (Clean Text Chat - No Emoji Picker)
  const handleSendInChartMessage = async (textToSend?: string) => {
    const text = textToSend || inChartChatInput.trim();
    if (!text) return;

    const isSenderAdmin = isAdminUser;
    // Login မဝင်ရသေးဘဲ chart တင်တဲ့အခါ User နာမည်နဲ့သာတင်ပေးပါ
    const senderName = !session.isLoggedIn
      ? 'User'
      : (isSenderAdmin ? 'KILLERBOSS ADMIN 👑' : (settings.customName || session.displayName || 'User'));

    const senderBadge = isSenderAdmin ? 'BOSS' : (session.isLoggedIn ? (settings.userBadge || 'MEMBER') : 'MEMBER');

    const payload = {
      userId: session.userId || `guest_${Math.random().toString(36).substring(2, 7)}`,
      userName: senderName,
      userAvatar: isSenderAdmin
        ? (settings.customAvatar || '/assets/images/itachi_logo_avatar_1791120287312.jpg')
        : ((settings.customAvatar && !settings.customAvatar.includes('itachi') && !settings.customAvatar.includes('hitachi'))
          ? settings.customAvatar
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80'),
      userBadge: senderBadge,
      text
    };

    if (!textToSend) setInChartChatInput('');
    await apiSendChatMessage(payload);
    if (settings.chatSound) {
      playSoundEffect('chat');
    }
  };

  // Fast bet directly from chart
  const handleChartQuickBet = async (type: 'BIG' | 'SMALL') => {
    if (!session.isLoggedIn) {
      alert(language === 'my' ? 'လောင်းကြေးတင်ရန် လော့ဂ်အင် အရင်ဝင်ပေးပါ!' : 'Please login first to place bets!');
      return;
    }
    if (session.balance < selectedBetAmount) {
      alert(language === 'my' ? 'လက်ကျန်ငွေ မလုံလောက်ပါ!' : 'Insufficient balance!');
      return;
    }

    setBettingStatus(language === 'my' ? 'လောင်းကြေးတင်နေသည်...' : 'Placing bet...');
    // 777 Big Win WebAPI: selectType 13 = ကြီး (BIG), selectType 14 = သေး (SMALL)
    const betCode = type === 'BIG' ? 13 : 14;
    
    const res = await apiPlaceBet(
      session.token,
      selectedBetAmount,
      betCode,
      currentIssue,
      session.platform,
      session.gameId || session.userId
    );

    if (res.success) {
      setBettingStatus(language === 'my' ? `✅ ${type} ${selectedBetAmount.toLocaleString()} K အောင်မြင်ပါသည်!` : `✅ Bet ${type} placed!`);
      if (onUpdateBalance) {
        onUpdateBalance(session.balance - selectedBetAmount);
      }
      confetti({ particleCount: 60, spread: 80 });
      playSoundEffect('bet');

      // Auto share bet signal into chat cleanly
      apiSendChatMessage({
        userId: session.userId,
        userName: settings.customName || session.displayName || 'VIP Bettor',
        userAvatar: (settings.customAvatar && !settings.customAvatar.includes('itachi') && !settings.customAvatar.includes('hitachi'))
          ? settings.customAvatar
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80',
        userBadge: settings.userBadge || 'VIP',
        text: `ထိုးကြေးစတင်လောင်းလိုက်ပါပြီ!\n\n🚀 ${currentIssue}\n🚀 ${type}`,
        signal: {
          issue: currentIssue,
          prediction: type,
          confidence: 96,
          recommendedAmount: selectedBetAmount,
          status: 'PENDING'
        }
      });
    } else {
      setBettingStatus(`❌ ${res.message || 'Bet failed'}`);
    }

    setTimeout(() => setBettingStatus(null), 4000);
  };

  // Calculate stats
  const bigCount = results.filter((r) => r.size === 'BIG').length;
  const smallCount = results.filter((r) => r.size === 'SMALL').length;
  const redCount = results.filter((r) => r.colour === 'RED').length;
  const greenCount = results.filter((r) => r.colour === 'GREEN').length;
  const totalCount = results.length || 1;

  const bigPercentage = Math.round((bigCount / totalCount) * 100);
  const smallPercentage = 100 - bigPercentage;

  const activeAmounts = selectedLadder === '1000' ? SERIES_1000 : SERIES_100;

  return (
    <div className="flex flex-col gap-3 bg-[#0d0f17] p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-2xl text-slate-100">
      {/* 1. Header with Live Countdown & Stats */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#161826] to-[#12141f] p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-500 shadow-inner">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-sm text-white tracking-wide uppercase">
                777 BIG WIN LIVE CHART
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800">
                LIVE SYNC
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Issue #{currentIssue || '20261007425'}
            </p>
          </div>
        </div>

        {/* Live Timer Ring */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">
              {language === 'my' ? 'အချိန်ကျန်:' : 'Next Draw:'}
            </span>
            <span
              className={`text-base font-black font-mono tracking-wider ${
                countdown <= 10 ? 'text-red-500 animate-pulse' : 'text-emerald-400'
              }`}
            >
              00:{String(countdown).padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={fetchRecentResults}
            disabled={loading}
            className="p-2 rounded-lg bg-[#1e2133] hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Refresh Chart"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Chart Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#12141f] p-2 rounded-xl border border-slate-800/80 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChartMode('trend')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              chartMode === 'trend'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
                : 'bg-[#181a29] text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{language === 'my' ? 'Trend လိုင်း' : 'Trend Line'}</span>
          </button>

          <button
            onClick={() => setChartMode('candlestick')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              chartMode === 'candlestick'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
                : 'bg-[#181a29] text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{language === 'my' ? 'Candle တိုင်' : 'Candle'}</span>
          </button>

          <button
            onClick={() => setChartMode('roadmap')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              chartMode === 'roadmap'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
                : 'bg-[#181a29] text-slate-400 hover:text-white'
            }`}
          >
            <span>Road</span>
          </button>
        </div>

        <button
          onClick={() => setShowInChartChat(!showInChartChat)}
          className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-[11px] border transition-all cursor-pointer ${
            showInChartChat
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              : 'bg-[#181a29] border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>{language === 'my' ? 'Chart ထဲတွင် Chat' : 'In-Chart Chat'}</span>
          {showInChartChat ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      </div>

      {/* 3. Live Statistics Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-[#141624] p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">
            {language === 'my' ? 'အကြီး (BIG) ရာခိုင်နှုန်း' : 'BIG Ratio'}
          </span>
          <span className="text-base font-black text-emerald-400 font-mono">
            {bigPercentage}% ({bigCount})
          </span>
        </div>

        <div className="bg-[#141624] p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">
            {language === 'my' ? 'အသေး (SMALL) ရာခိုင်နှုန်း' : 'SMALL Ratio'}
          </span>
          <span className="text-base font-black text-cyan-400 font-mono">
            {smallPercentage}% ({smallCount})
          </span>
        </div>

        <div className="bg-[#141624] p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">
            {language === 'my' ? 'အနီ (RED) အကြိမ်' : 'RED Count'}
          </span>
          <span className="text-base font-black text-red-500 font-mono">
            {redCount} wins
          </span>
        </div>

        <div className="bg-[#141624] p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">
            {language === 'my' ? 'အစိမ်း (GREEN) အကြိမ်' : 'GREEN Count'}
          </span>
          <span className="text-base font-black text-emerald-400 font-mono">
            {greenCount} wins
          </span>
        </div>
      </div>

      {/* 4. Interactive Live Chart Canvas */}
      <div className="relative bg-[#090a10] rounded-2xl border border-slate-800 overflow-hidden min-h-[260px] p-3 flex flex-col justify-between">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2438_1px,transparent_1px),linear-gradient(to_bottom,#1f2438_1px,transparent_1px)] bg-[size:28px_28px] opacity-25 pointer-events-none" />

        {/* Dynamic Visualization */}
        {chartMode === 'trend' && (
          <div className="relative z-10 flex-1 flex flex-col justify-between py-2">
            <div className="flex items-end justify-between gap-1 overflow-x-auto pb-4 pt-6 px-2">
              {results.slice(0, 16).map((item, idx) => {
                const num = parseInt(item.number, 10);
                const heightPercent = Math.max(18, (num / 9) * 100);
                const isBig = item.size === 'BIG';
                const isRed = item.colour === 'RED';
                const isViolet = item.colour === 'VIOLET';

                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 group shrink-0 min-w-[32px]">
                    <span
                      className={`text-[9px] font-black px-1 py-0.2 rounded shadow ${
                        isBig ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                      }`}
                    >
                      {item.size}
                    </span>

                    <div className="h-28 w-4 sm:w-5 bg-slate-900 rounded-full flex flex-col justify-end p-0.5 relative">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-full transition-all duration-500 shadow-md ${
                          isViolet
                            ? 'bg-gradient-to-t from-purple-600 to-indigo-400'
                            : isRed
                            ? 'bg-gradient-to-t from-red-600 to-rose-400'
                            : 'bg-gradient-to-t from-emerald-600 to-green-400'
                        }`}
                      />
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black text-white">
                        {item.number}
                      </span>
                    </div>

                    <span className="text-[8px] font-mono text-slate-500 truncate max-w-[32px]">
                      {item.issueNumber.slice(-3)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Killerboss AI Trend Line Forecast & Live Signal Display */}
            <div className="bg-[#121524]/90 backdrop-blur-sm border border-red-500/30 rounded-xl p-2.5 flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500 animate-pulse fill-red-500" />
                <span className="text-xs font-black text-slate-200">
                  {language === 'my' ? 'KILLERBOSS VIP SIGNAL:' : 'KILLERBOSS VIP SIGNAL:'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-white font-black text-xs shadow-md ${
                  liveSignal.prediction === 'BIG' ? 'bg-emerald-600' : 'bg-cyan-600'
                }`}>
                  {liveSignal.prediction}
                </span>
              </div>
              <span className="text-[11px] font-bold text-amber-400 font-mono">
                {liveSignal.confidence}% Confidence
              </span>
            </div>
          </div>
        )}

        {chartMode === 'candlestick' && (
          <div className="relative z-10 flex-1 flex items-center justify-around py-4 overflow-x-auto">
            {results.slice(0, 14).map((item, idx) => {
              const num = parseInt(item.number, 10);
              const isUp = num >= 5;
              return (
                <div key={idx} className="flex flex-col items-center gap-1 min-w-[28px]">
                  <div className="w-[1.5px] h-4 bg-slate-600" />
                  <div
                    className={`w-4 sm:w-5 h-16 rounded-sm flex items-center justify-center font-black text-xs text-white shadow-lg ${
                      isUp ? 'bg-emerald-500 border border-emerald-400' : 'bg-red-500 border border-red-400'
                    }`}
                  >
                    {item.number}
                  </div>
                  <div className="w-[1.5px] h-4 bg-slate-600" />
                  <span className="text-[8px] font-mono text-slate-400">
                    {item.issueNumber.slice(-3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {chartMode === 'roadmap' && (
          <div className="relative z-10 flex-1 grid grid-flow-col auto-cols-[28px] grid-rows-5 gap-1.5 p-2 overflow-x-auto max-h-40">
            {results.slice(0, 35).map((item, idx) => {
              const isRed = item.colour === 'RED';
              const isViolet = item.colour === 'VIOLET';
              const isBig = item.size === 'BIG';

              return (
                <div
                  key={idx}
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] text-white shadow-md border ${
                    isViolet
                      ? 'bg-purple-600 border-purple-400'
                      : isRed
                      ? 'bg-red-600 border-red-400'
                      : 'bg-emerald-600 border-emerald-400'
                  }`}
                  title={`Period: ${item.issueNumber} - ${item.size} (${item.number})`}
                >
                  {isBig ? 'B' : 'S'}
                </div>
              );
            })}
          </div>
        )}

        {/* 5. In-Chart Live Chat (Chart ထဲတွင် ပြသမည့် စကားပြောခန်း) */}
        {showInChartChat && (
          <div className="relative z-20 mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col gap-2 bg-[#0d101a]/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-800">
            {/* Header info */}
            <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-800">
              <span className="font-extrabold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'my' ? 'Chart တိုက်ရိုက် စာပို့ခန်း' : 'In-Chart Live Chat'}</span>
              </span>
            </div>

            {/* Chat Messages Stream inside Chart */}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {chartMessages.length === 0 ? (
                <div className="text-center py-2.5 text-[11px] text-slate-500">
                  {language === 'my' ? 'Chart စာပို့မှုများ မရှိသေးပါ' : 'No in-chart messages yet'}
                </div>
              ) : (
                chartMessages.slice(-10).map((msg) => {
                  const isSenderAdminMsg = 
                    msg.userId === '8370471165' || 
                    msg.userId === '761699' || 
                    msg.userId === 'killerboss_official' || 
                    Boolean(msg.isBot);

                  // ရာထူးဂုဏ်ဆောင်နာမည်တွေက Admin ခွင့်ပြုမှသာပေါ်မယ် chart ထဲမှာပြမယ်
                  const hasHonoraryApproved = Boolean(isSenderAdminMsg || msg.isHonoraryApproved);
                  const isBoss = (msg.userBadge === 'BOSS' || isSenderAdminMsg) && hasHonoraryApproved;
                  const isMaster = msg.userBadge === 'MASTER' && hasHonoraryApproved;
                  const isVip = msg.userBadge === 'VIP' && hasHonoraryApproved;

                  return (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-xl border text-xs flex flex-col gap-0.5 ${
                        isBoss
                          ? 'bg-[#1e1319] border-red-500/40 text-slate-100'
                          : 'bg-[#131625] border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`font-bold text-[11px] truncate ${
                            isBoss ? 'text-red-400' : isMaster ? 'text-amber-400' : isVip ? 'text-cyan-400' : 'text-slate-300'
                          }`}>
                            {msg.userName}
                          </span>

                          {/* ရာထူးဂုဏ်ဆောင်နာမည် Badge - Admin ခွင့်ပြုမှသာ chart ထဲတွင် ပြမည် */}
                          {isBoss && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-red-950 text-red-300 border border-red-700">
                              👑 BOSS
                            </span>
                          )}
                          {isMaster && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-amber-950 text-amber-300 border border-amber-700">
                              ⚡ MASTER
                            </span>
                          )}
                          {isVip && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-cyan-950 text-cyan-300 border border-cyan-700">
                              💎 VIP
                            </span>
                          )}
                        </div>

                        <span className="text-[9px] text-slate-500 shrink-0 font-mono">
                          {msg.timeFormatted || '12:00'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-200 leading-snug whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-Chart Chat Input Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendInChartMessage();
              }} 
              className="flex items-center gap-2 pt-1 border-t border-slate-800"
            >
              <input
                type="text"
                value={inChartChatInput}
                onChange={(e) => setInChartChatInput(e.target.value)}
                placeholder={
                  !session.isLoggedIn
                    ? (language === 'my' ? 'User အမည်ဖြင့် စာပို့မည်...' : 'Posting as User...')
                    : (language === 'my' ? 'Chart ထဲတွင် စကားပြော စာတို ရေးသားရန်...' : 'Chat inside chart view...')
                }
                className="flex-1 bg-[#07080d] border border-slate-700 focus:border-red-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inChartChatInput.trim()}
                className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-xs rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{language === 'my' ? 'ပို့မည်' : 'Send'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 6. Quick Betting Action Dock with Exact Requested Presets */}
      <div className="bg-[#121522] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
        {/* Header & Balance */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{language === 'my' ? 'လောင်းကြေးပမာဏ ရွေးချယ်ပါ:' : 'လောင်းကြေးပမာဏ ရွေးချယ်ပါ:'}</span>
          </span>
          <span className="font-mono text-slate-300 text-xs">
            {language === 'my' ? 'လက်ကျန်:' : 'Balance:'} <b className="text-amber-400 font-bold">{session.balance.toLocaleString()} K</b>
          </span>
        </div>

        {/* Series / Pattern Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => {
              setSelectedLadder('1000');
              if (!SERIES_1000.includes(selectedBetAmount)) {
                setSelectedBetAmount(1000);
              }
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              selectedLadder === '1000'
                ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md'
                : 'bg-[#181a29] text-slate-400 hover:text-white'
            }`}
          >
            <span>1,000 ~ 320,000 (8 Levels)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedLadder('100');
              if (!SERIES_100.includes(selectedBetAmount)) {
                setSelectedBetAmount(100);
              }
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              selectedLadder === '100'
                ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white shadow-md'
                : 'bg-[#181a29] text-slate-400 hover:text-white'
            }`}
          >
            <span>100 ~ 72,900 (7 Levels 3X)</span>
          </button>
        </div>

        {/* Amount Selector Chips (Exact User-Requested Values) */}
        <div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {activeAmounts.map((amt) => {
              const isSelected = selectedBetAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSelectedBetAmount(amt)}
                  className={`py-2 px-1 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer text-center ${
                    isSelected
                      ? selectedLadder === '1000'
                        ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950 scale-105'
                        : 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-950 scale-105'
                      : 'bg-[#181b2b] text-slate-300 border-slate-700/60 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <div>{amt.toLocaleString()}</div>
                  <div className="text-[9px] text-slate-400 font-sans font-normal">K</div>
                </button>
              );
            })}
          </div>

          {/* Quick Active Amount Display */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 bg-[#0c0e18] px-3 py-1.5 rounded-lg border border-slate-800">
            <span>{language === 'my' ? 'ရွေးချယ်ထားသော လောင်းကြေး:' : 'Selected Stake:'}</span>
            <span className="font-mono font-black text-amber-400 text-xs">
              {selectedBetAmount.toLocaleString()} MMK
            </span>
          </div>
        </div>

        {/* Big / Small Bet Triggers */}
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          <button
            type="button"
            onClick={() => handleChartQuickBet('BIG')}
            className="py-3.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black rounded-xl shadow-lg shadow-emerald-950/60 hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center"
          >
            <span className="text-base tracking-wider font-extrabold">ကြီး</span>
          </button>

          <button
            type="button"
            onClick={() => handleChartQuickBet('SMALL')}
            className="py-3.5 bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 text-white font-black rounded-xl shadow-lg shadow-cyan-950/60 hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center"
          >
            <span className="text-base tracking-wider font-extrabold">သေး</span>
          </button>
        </div>

        {bettingStatus && (
          <div className="text-center text-xs font-bold text-amber-300 animate-pulse mt-1">
            {bettingStatus}
          </div>
        )}
      </div>
    </div>
  );
};
