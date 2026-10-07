import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Flame, 
  Sparkles, 
  Radio, 
  Volume2, 
  VolumeX, 
  CheckCheck, 
  TrendingUp, 
  Coins, 
  ShieldAlert, 
  Smile, 
  Zap, 
  Share2, 
  Users, 
  Pin, 
  Award,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ChatMessage, ChatSignal, UserSession, UserAppSettings } from '../types';
import { apiGetChatHistory, apiSendChatMessage, apiReactToMessage, playSoundEffect } from '../api';

interface TelegramChatProps {
  session: UserSession;
  settings: UserAppSettings;
  currentIssue: string;
  onPlaceQuickBet?: (prediction: 'BIG' | 'SMALL', amount: number) => void;
  onNavigateToChart?: () => void;
  onUpdateBalance?: (newBal: number) => void;
  language: 'my' | 'en';
}

const EMOJI_REACTIONS = ['🔥', '🚀', '💰', '👍', '❤️', '👏', '🤑', '🎯'];

export const TelegramChat: React.FC<TelegramChatProps> = ({
  session,
  settings,
  currentIssue,
  onPlaceQuickBet,
  onNavigateToChart,
  onUpdateBalance,
  language
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState<number>(342);
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPlayingVoiceId, setIsPlayingVoiceId] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Admin Chart ID is 8370471165, Game ID is 761699 (Must be logged in)
  const isAdmin = Boolean(
    session.isLoggedIn && (
      session.isAdmin ||
      session.userId === '8370471165' ||
      session.chartId === '8370471165' ||
      session.gameId === '761699' ||
      session.userId === '761699' ||
      (session.phone && session.phone.includes('9791111116'))
    )
  );

  // Signal Creator state
  const [signalPred, setSignalPred] = useState<'BIG' | 'SMALL'>('BIG');
  const [signalAmount, setSignalAmount] = useState<number>(5000);
  const [signalConfidence, setSignalConfidence] = useState<number>(95);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll handler
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setHasNewMessages(false);
  };

  // Check scroll position
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    if (isNearBottom) {
      setHasNewMessages(false);
    }
  };

  // Initialize WebSocket & Fetch Initial History
  useEffect(() => {
    // 1. Fetch initial REST history
    apiGetChatHistory().then((data) => {
      if (data && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages);
        if (data.onlineUsersCount) setOnlineCount(data.onlineUsersCount + 280);
        setTimeout(() => scrollToBottom(false), 200);
      }
    });

    // 2. Setup WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send join info
        ws.send(JSON.stringify({
          type: 'user:join',
          payload: {
            userId: session.userId || `user_${Math.random().toString(36).substring(2, 6)}`,
            userName: settings.customName || session.displayName || 'VIP Bettor',
            badge: settings.userBadge || 'VIP'
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'init:state') {
            if (Array.isArray(data.payload.messages)) {
              setMessages(data.payload.messages);
              setTimeout(() => scrollToBottom(false), 200);
            }
            if (data.payload.onlineCount) {
              setOnlineCount(data.payload.onlineCount + 280);
            }
          }

          if (data.type === 'presence:update') {
            if (data.payload.onlineCount) {
              setOnlineCount(data.payload.onlineCount + 280);
            }
          }

          if (data.type === 'chat:message') {
            const incomingMsg: ChatMessage = data.payload;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) return prev;
              return [...prev, incomingMsg];
            });

            if (settings.chatSound) {
              playSoundEffect('chat');
            }

            // If user is near bottom, scroll automatically
            if (chatScrollContainerRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
              if (isNearBottom) {
                setTimeout(() => scrollToBottom(true), 50);
              } else {
                setHasNewMessages(true);
              }
            }
          }

          if (data.type === 'chat:reaction') {
            const { messageId, emoji, count } = data.payload;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === messageId) {
                  return {
                    ...m,
                    reactions: { ...m.reactions, [emoji]: count }
                  };
                }
                return m;
              })
            );
          }

          if (data.type === 'chat:tip_claimed') {
            const { messageId, userId } = data.payload;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === messageId && m.tipRain) {
                  const claimedSet = new Set([...m.tipRain.claimedBy, userId]);
                  return {
                    ...m,
                    tipRain: { ...m.tipRain, claimedBy: Array.from(claimedSet) }
                  };
                }
                return m;
              })
            );
          }
        } catch (err) {
          console.error('Error handling WS event:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WS connection notice:', err);
      };
    } catch (err) {
      console.error('WS init failed:', err);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [session.userId, settings.customName, settings.userBadge]);

  // Send Chat Message (Open to all users & guests, even without login)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    let senderUserId = session.userId;
    let senderUserName = settings.customName || session.displayName;
    let senderAvatar = settings.customAvatar;
    let senderBadge: 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER' | 'BOT' = (settings.userBadge as any) || 'MEMBER';

    if (isAdmin) {
      senderUserId = '8370471165';
      senderUserName = settings.customName || session.displayName || 'KILLERBOSS ADMIN 👑';
      senderAvatar = (settings.customAvatar && settings.customAvatar.length > 0)
        ? settings.customAvatar.replace('/src/', '/')
        : '/assets/images/itachi_logo_avatar_1791120287312.jpg';
      senderBadge = 'BOSS';
    } else {
      senderUserId = session.userId || `guest_${Math.random().toString(36).substring(2, 7)}`;
      senderUserName = settings.customName || session.displayName || 'User';
      senderAvatar = (settings.customAvatar && !settings.customAvatar.includes('itachi') && !settings.customAvatar.includes('hitachi'))
        ? settings.customAvatar
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
      senderBadge = (session.badge as any) || (settings.userBadge as any) || 'MEMBER';
    }

    const payload = {
      userId: senderUserId || 'guest_user',
      userName: senderUserName || 'User',
      userAvatar: senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80',
      userBadge: senderBadge,
      text: inputText.trim()
    };

    setInputText('');
    setShowEmojiPicker(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat:send', payload }));
    } else {
      await apiSendChatMessage(payload);
    }

    if (settings.chatSound) {
      playSoundEffect('chat');
    }
  };

  // Broadcast User / Admin VIP Signal
  const handleBroadcastSignal = async () => {
    let senderUserId = session.userId || `guest_${Math.random().toString(36).substring(2, 7)}`;
    let senderUserName = settings.customName || session.displayName || 'User';
    let senderAvatar = settings.customAvatar;
    let senderBadge: 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER' | 'BOT' = (settings.userBadge as any) || 'VIP';

    if (isAdmin) {
      senderUserId = '8370471165';
      senderUserName = settings.customName || session.displayName || 'KILLERBOSS ADMIN 👑';
      senderAvatar = (settings.customAvatar && settings.customAvatar.length > 0)
        ? settings.customAvatar.replace('/src/', '/')
        : '/assets/images/itachi_logo_avatar_1791120287312.jpg';
      senderBadge = 'BOSS';
    } else {
      senderAvatar = (settings.customAvatar && !settings.customAvatar.includes('itachi') && !settings.customAvatar.includes('hitachi'))
        ? settings.customAvatar
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
      senderBadge = (session.badge as any) || (settings.userBadge as any) || 'VIP';
    }

    const payload = {
      userId: senderUserId,
      userName: senderUserName,
      userAvatar: senderAvatar,
      userBadge: senderBadge,
      text: `💡 ${currentIssue || '20261007'}\n🧠 ${signalPred}\n⚡ ${signalAmount}K`,
      signal: {
        issue: currentIssue || '20261007',
        prediction: signalPred,
        confidence: signalConfidence,
        recommendedAmount: signalAmount,
        status: 'PENDING' as const
      }
    };

    setShowSignalModal(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat:send', payload }));
    } else {
      await apiSendChatMessage(payload);
    }

    confetti({ particleCount: 70, spread: 80 });
    playSoundEffect('win');
  };

  // React to Message
  const handleReact = (messageId: string, emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat:react',
        payload: { messageId, emoji }
      }));
    } else {
      apiReactToMessage(messageId, emoji);
    }
    playSoundEffect('click');
  };

  // Simulate Voice note announcement audio
  const handlePlayVoice = (msgId: string, text: string) => {
    if (isPlayingVoiceId === msgId) {
      setIsPlayingVoiceId(null);
      return;
    }
    setIsPlayingVoiceId(msgId);
    playSoundEffect('win');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[🔥⚡🎯👑➡️]/g, ''));
      utterance.rate = 1.05;
      utterance.pitch = 1.1;
      utterance.onend = () => setIsPlayingVoiceId(null);
      utterance.onerror = () => setIsPlayingVoiceId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingVoiceId(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-[640px] max-h-[85vh] bg-[#0e1017] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative">
      {/* 1. Telegram Group Header */}
      <div className="bg-gradient-to-r from-[#171924] via-[#1b1e2e] to-[#171924] px-4 py-3 border-b border-slate-800 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="/src/assets/images/killerboss_avatar_1791104818892.jpg"
              alt="Telegram VIP Group"
              className="w-10 h-10 rounded-full object-cover border-2 border-red-500 shadow-lg"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#171924] rounded-full animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-sm text-white tracking-wide uppercase">
                777 BIG WIN ✕ KILLERBOSS VIP
              </h3>
              <span className="bg-blue-500 text-white rounded-full p-0.5" title="Verified Group">
                <CheckCheck className="w-2.5 h-2.5" />
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Users className="w-3 h-3" />
                {onlineCount.toLocaleString()} {language === 'my' ? 'ဦး တိုက်ရိုက်အွန်လိုင်း' : 'Online'}
              </span>
              <span>•</span>
              <span className="text-amber-400 flex items-center gap-0.5">
                <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
                98.4% Win Rate
              </span>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSignalModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:scale-105 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            title={language === 'my' ? 'VIP Signal ထုတ်ပြန်မည်' : 'Broadcast VIP Signal'}
          >
            <Flame className="w-3.5 h-3.5 fill-white text-white" />
            <span className="hidden sm:inline">{language === 'my' ? 'Signal ပေး' : 'Signal'}</span>
          </button>
        </div>
      </div>

      {/* 2. Pinned Killerboss Signal Banner */}
      <div className="bg-[#141724] border-b border-red-900/30 px-3 py-1.5 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <Pin className="w-3.5 h-3.5 text-red-500 shrink-0 rotate-45" />
          <span className="font-bold text-red-400 shrink-0">
            {language === 'my' ? 'ပင်ထိုးထားသော Signal:' : 'Pinned Signal:'}
          </span>
          <span className="truncate text-slate-200 text-[11px]">
            🔥 Issue #{currentIssue || '20261007'} ➡️ <b className="text-emerald-400">BIG (ကြီး)</b> 96.8% Confidence!
          </span>
        </div>

        <button
          onClick={onNavigateToChart}
          className="shrink-0 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline flex items-center gap-0.5 ml-2 cursor-pointer"
        >
          <TrendingUp className="w-3 h-3" />
          {language === 'my' ? 'Chart ကြည့်မည်' : 'View Chart'}
        </button>
      </div>

      {/* 3. Telegram Live Messages Stream */}
      <div
        ref={chatScrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#0a0b10] bg-[radial-gradient(#1e2235_1px,transparent_1px)] [background-size:16px_16px]"
      >
        {messages.map((msg) => {
          const isMe = msg.userId === session.userId;
          const isSenderAdminMsg = 
            msg.userId === '8370471165' || 
            msg.userId === '761699' || 
            msg.userId === 'killerboss_official' || 
            Boolean(msg.isBot);

          // ရာထူးဂုဏ်ဆောင်နာမည်တွေက Admin ခွင့်ပြုမှသာပေါ်မယ်
          const hasHonoraryApproved = Boolean(isSenderAdminMsg || msg.isHonoraryApproved);
          const isBoss = (msg.userBadge === 'BOSS' || isSenderAdminMsg) && hasHonoraryApproved;
          const isMaster = msg.userBadge === 'MASTER' && hasHonoraryApproved;
          const isVip = msg.userBadge === 'VIP' && hasHonoraryApproved;

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-[90%] sm:max-w-[85%] group ${
                isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* User Avatar */}
              <img
                src={msg.userAvatar || (isBoss ? '/assets/images/itachi_logo_avatar_1791120287312.jpg' : '/assets/images/killerboss_avatar_1791104818892.jpg')}
                alt={msg.userName}
                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0 shadow-sm mt-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = isBoss
                    ? '/assets/images/itachi_logo_avatar_1791120287312.jpg'
                    : '/assets/images/killerboss_avatar_1791104818892.jpg';
                }}
              />

              {/* Message Bubble Box */}
              <div
                className={`rounded-2xl px-3.5 py-2.5 shadow-md relative text-xs flex flex-col gap-1.5 border transition-all ${
                  isBoss
                    ? 'bg-gradient-to-br from-[#241318] via-[#1c1827] to-[#161826] border-red-500/40 text-slate-100'
                    : isMe
                    ? 'bg-gradient-to-br from-[#1e2a44] to-[#151f33] border-blue-600/40 text-slate-100 rounded-tr-none'
                    : 'bg-[#161824] border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Header: User Name + VIP Badge */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-700/40 pb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`font-bold text-[11px] truncate ${
                        isBoss
                          ? 'text-red-400'
                          : isMaster
                          ? 'text-amber-400'
                          : isVip
                          ? 'text-cyan-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {msg.userName}
                    </span>

                    {/* Badge Pill */}
                    {isBoss && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-red-950 text-red-300 border border-red-700">
                        👑 BOSS
                      </span>
                    )}
                    {isMaster && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-950 text-amber-300 border border-amber-700">
                        ⚡ MASTER
                      </span>
                    )}
                    {isVip && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-950 text-cyan-300 border border-cyan-700">
                        💎 VIP
                      </span>
                    )}
                  </div>

                  <span className="text-[9px] text-slate-400 shrink-0">
                    {msg.timeFormatted || '12:00 PM'}
                  </span>
                </div>

                {/* Message Text Content */}
                {msg.text && (
                  <p className={`leading-relaxed text-[13px] whitespace-pre-wrap break-words font-medium ${
                    msg.text.includes('💡')
                      ? 'font-mono font-bold text-amber-300 bg-[#0d0f1a] p-2.5 rounded-xl border border-amber-500/30'
                      : msg.text.includes('ထိုးကြေးစတင်လောင်းလိုက်ပါပြီ!') || msg.text.includes('🚀')
                      ? 'font-mono font-bold text-emerald-300 bg-[#0b141a] p-2.5 rounded-xl border border-emerald-500/30'
                      : msg.text.includes('BET RESULT - WIN!')
                      ? 'font-black text-emerald-400 bg-emerald-950/60 p-2 rounded-xl border border-emerald-500/40 text-center tracking-wide'
                      : msg.text.includes('BET RESULT - LOSS!')
                      ? 'font-black text-rose-400 bg-rose-950/60 p-2 rounded-xl border border-rose-500/40 text-center tracking-wide'
                      : ''
                  }`}>
                    {msg.text}
                  </p>
                )}

                {/* Signal Fast Bet Action Card (if present) */}
                {msg.signal && (
                  <div className="bg-[#0b0d14] rounded-xl p-2.5 border border-red-500/30 flex items-center justify-between my-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold tracking-wider">PREDICTION</span>
                      <span
                        className={`text-sm font-black tracking-wider ${
                          msg.signal.prediction === 'BIG'
                            ? 'text-emerald-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        {msg.signal.prediction}
                      </span>
                    </div>

                    {onPlaceQuickBet && (
                      <button
                        onClick={() => {
                          if (msg.signal) {
                            onPlaceQuickBet(
                              msg.signal.prediction === 'BIG' ? 'BIG' : 'SMALL',
                              msg.signal.recommendedAmount || 1000
                            );
                            confetti({ particleCount: 40, spread: 60 });
                          }
                        }}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-green-500 text-white font-black text-[11px] rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>{language === 'my' ? `လိုက်ထိုးမည် (${(msg.signal.recommendedAmount || 1000).toLocaleString()} K)` : `Follow Bet (${(msg.signal.recommendedAmount || 1000).toLocaleString()} K)`}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Reactions Display & Quick React Bar */}
                <div className="flex items-center justify-between gap-1 mt-1 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(msg.reactions || {}).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className="px-1.5 py-0.5 rounded-full bg-[#1e2133] hover:bg-slate-700 text-[10px] font-bold text-slate-200 border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Reaction trigger */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#1c1f30] px-1.5 py-0.5 rounded-full border border-slate-700 shadow">
                    {EMOJI_REACTIONS.slice(0, 4).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className="hover:scale-125 transition-transform text-[11px] cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating "New Messages" badge if scrolled up */}
      {hasNewMessages && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-16 right-4 bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1 hover:bg-red-500 animate-bounce cursor-pointer z-10"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>{language === 'my' ? 'မက်ဆေ့ခ်ျအသစ်များ' : 'New Messages'}</span>
        </button>
      )}

      {/* 4. Telegram Chat Input Bar */}
      <div className="bg-[#141622] p-2.5 border-t border-slate-800 shrink-0 relative">
        {/* Emoji Quick Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-3 bg-[#1b1e2e] border border-slate-700 rounded-xl p-2 shadow-2xl flex gap-2 z-20">
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-lg hover:scale-125 transition-transform cursor-pointer p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-slate-400 hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            title="Add Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              language === 'my'
                ? 'Killerboss VIP Group ထဲတွင် စကားပြောရန်...'
                : 'Send message to 777 Killerboss VIP Chat...'
            }
            className="flex-1 bg-[#0b0c12] border border-slate-700 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`p-2.5 rounded-xl font-bold transition-all shadow-md cursor-pointer flex items-center justify-center ${
              inputText.trim()
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white hover:scale-105 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 5. Create Signal Modal */}
      {showSignalModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#171926] border border-red-500/50 rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-red-500 font-extrabold text-sm">
                <Flame className="w-4 h-4 fill-red-500" />
                <span>{language === 'my' ? 'VIP Signal ထုတ်ပြန်မည်' : 'Broadcast VIP Signal'}</span>
              </div>
              <button
                onClick={() => setShowSignalModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  {language === 'my' ? 'ဂိမ်းအကြိမ် (Issue Number):' : 'Issue Period:'}
                </label>
                <div className="bg-[#0e1017] px-3 py-2 rounded-lg text-white font-mono border border-slate-800">
                  #{currentIssue || '20261007425'}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  {language === 'my' ? 'ခန့်မှန်းချက် (Prediction):' : 'Prediction:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignalPred('BIG')}
                    className={`py-2 rounded-lg font-black tracking-wide border transition-all cursor-pointer ${
                      signalPred === 'BIG'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950'
                        : 'bg-[#12141f] text-slate-300 border-slate-800'
                    }`}
                  >
                    ကြီး (BIG)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignalPred('SMALL')}
                    className={`py-2 rounded-lg font-black tracking-wide border transition-all cursor-pointer ${
                      signalPred === 'SMALL'
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-950'
                        : 'bg-[#12141f] text-slate-300 border-slate-800'
                    }`}
                  >
                    သေး (SMALL)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-semibold text-[11px]">
                    {language === 'my' ? 'လောင်းကြေးပမာဏ ရွေးချယ်ပါ:' : 'Recommended Bet (MMK):'}
                  </label>
                  <span className="text-amber-400 font-mono font-bold text-xs">
                    {signalAmount.toLocaleString()} K
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    {[1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSignalAmount(amt)}
                        className={`py-1 rounded-lg font-bold text-[10px] font-mono border transition-all cursor-pointer ${
                          signalAmount === amt
                            ? 'bg-red-600 text-white border-red-400'
                            : 'bg-[#12141f] text-slate-300 border-slate-800'
                        }`}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {[100, 300, 900, 2700, 8100, 24300, 72900].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSignalAmount(amt)}
                        className={`py-1 rounded-lg font-bold text-[10px] font-mono border transition-all cursor-pointer ${
                          signalAmount === amt
                            ? 'bg-amber-600 text-white border-amber-400'
                            : 'bg-[#12141f] text-slate-300 border-slate-800'
                        }`}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  {language === 'my' ? 'သေချာမှု ရာခိုင်နှုန်း (Confidence):' : 'Confidence Level:'} {signalConfidence}%
                </label>
                <input
                  type="range"
                  min="80"
                  max="99"
                  value={signalConfidence}
                  onChange={(e) => setSignalConfidence(Number(e.target.value))}
                  className="w-full accent-red-600"
                />
              </div>

              <button
                type="button"
                onClick={handleBroadcastSignal}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-amber-600 text-white font-extrabold rounded-xl shadow-lg hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>{language === 'my' ? 'Telegram & Chart သို့ တင်မည်' : 'Broadcast to Chat & Chart'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
