import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Check,
  KeyRound,
  Bot,
  Lock,
  Crown,
  Volume2,
  Send,
  Sparkles,
  Award
} from 'lucide-react';
import { playSoundEffect } from '../api';
import itachiLogoImg from '../assets/images/itachi_logo_avatar_1791120287312.jpg';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  language?: 'my' | 'en';
}

interface ActiveUser {
  phone: string;
  gameId: string;
  balance: number;
  loginTime: string;
  lastActive: string;
  isOnline: boolean;
}

interface DeniedUser {
  phone: string;
  gameId: string;
  attemptTime: string;
  attemptsCount: number;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  language = 'my'
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<'ids' | 'online' | 'denied' | 'badges' | 'voice' | 'bot'>('badges');
  const [allowedIds, setAllowedIds] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [deniedUsers, setDeniedUsers] = useState<DeniedUser[]>([]);
  const [userBadges, setUserBadges] = useState<Record<string, 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER'>>({});
  const [newGameIdsInput, setNewGameIdsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // VIP Badge assignment form state
  const [badgeTargetId, setBadgeTargetId] = useState('');
  const [badgeTargetRole, setBadgeTargetRole] = useState<'BOSS' | 'VIP' | 'MASTER' | 'MEMBER'>('VIP');

  // Admin Voice Signal form state
  const [voiceSignalText, setVoiceSignalText] = useState('777 Big Win Killerboss Signal Big လိုက်ထိုးရန် အကြံပြုပါသည်!');
  const [sendingVoice, setSendingVoice] = useState(false);

  const adminId = '8370471165';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === adminId || pinInput.trim() === 'admin8370471165') {
      setIsAuthenticated(true);
      setPinError('');
      fetchAdminData();
    } else {
      setPinError(language === 'my' ? 'Admin ID / PIN မှားယွင်းနေပါသည်' : 'Invalid Admin PIN / ID');
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data');
      const data = await res.json();
      if (data.success) {
        setAllowedIds(data.allowedGameIds || []);
        setActiveUsers(data.activeSessions || []);
        setDeniedUsers(data.deniedAttempts || []);
        if (data.userBadges) setUserBadges(data.userBadges);
      }
    } catch {
      showToast('Error loading admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchAdminData();
    }
  }, [isOpen, isAuthenticated]);

  const handleAddGameIds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameIdsInput.trim()) return;

    const ids = newGameIdsInput
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) return;

    try {
      const res = await fetch('/api/admin/add-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIds: ids })
      });
      const data = await res.json();
      if (data.success) {
        setAllowedIds(data.allowedGameIds);
        setNewGameIdsInput('');
        showToast(`✅ Added ${ids.length} Game ID(s) successfully!`);
        fetchAdminData();
      }
    } catch {
      showToast('Error adding Game IDs');
    }
  };

  const handleRemoveGameId = async (id: string) => {
    try {
      const res = await fetch('/api/admin/remove-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: id })
      });
      const data = await res.json();
      if (data.success) {
        setAllowedIds(data.allowedGameIds);
        showToast(`🗑️ Game ID ${id} removed`);
      }
    } catch {
      showToast('Error removing Game ID');
    }
  };

  // Assign VIP Badge to user
  const handleAssignBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTargetId.trim()) return;

    try {
      const res = await fetch('/api/admin/set-user-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: badgeTargetId.trim(),
          badge: badgeTargetRole
        })
      });
      const data = await res.json();
      if (data.success) {
        setUserBadges(data.userBadges || {});
        showToast(`👑 Assigned ${badgeTargetRole} badge to ${badgeTargetId}!`);
        setBadgeTargetId('');
        playSoundEffect('win');
      }
    } catch {
      showToast('Error assigning badge');
    }
  };

  // Broadcast Admin Voice Signal
  const handleSendVoiceSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceSignalText.trim()) return;

    setSendingVoice(true);
    try {
      const res = await fetch('/api/admin/send-voice-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voiceSignalText.trim(),
          audioLabel: 'Official Admin Voice Call'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎙️ Voice Signal broadcasted to VIP chat room!');
        playSoundEffect('win');

        // Play local preview speech
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(voiceSignalText.trim());
          u.rate = 1.05;
          window.speechSynthesis.speak(u);
        }
      }
    } catch {
      showToast('Error broadcasting voice signal');
    } finally {
      setSendingVoice(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#12131b] border-2 border-red-900/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#181924] border-b border-red-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={itachiLogoImg}
              alt="Admin Logo"
              className="w-9 h-9 rounded-full object-cover border-2 border-red-500 shadow-md"
            />
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Admin Control Dashboard
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={fetchAdminData}
                className="p-2 rounded-xl bg-[#222432] hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setPinInput('');
                onClose();
              }}
              className="p-2 rounded-xl bg-[#222432] hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PIN Verification Screen if Not Authenticated */}
        {!isAuthenticated ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-500 mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <h4 className="text-base font-black text-white uppercase tracking-wider">
                {language === 'my' ? 'Admin သီးသန့် ဝင်ရောက်ရန်' : 'Admin Security Verification'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'my'
                  ? 'Admin ID / လျှို့ဝှက်ကုဒ် ရိုက်ထည့်ပါ'
                  : 'Enter Admin ID / PIN to unlock dashboard'}
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-3 max-w-xs mx-auto pt-2">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Admin PIN"
                className="w-full bg-[#181924] border border-slate-700 focus:border-red-500 rounded-xl px-4 py-3 text-center text-sm font-mono text-white placeholder-slate-600 focus:outline-none tracking-widest"
                autoFocus
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-semibold">{pinError}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
              >
                {language === 'my' ? 'အတည်ပြုမည်' : 'Unlock Dashboard'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Toast */}
            {toastMsg && (
              <div className="bg-red-900/90 text-white text-xs px-4 py-2 font-bold text-center animate-in fade-in">
                {toastMsg}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="grid grid-cols-5 gap-1 p-2 bg-[#151620] border-b border-slate-800 text-[10px] font-bold">
              <button
                onClick={() => setActiveTab('badges')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'badges'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Crown className="w-3 h-3 text-yellow-300" />
                <span>VIP Badges</span>
              </button>

              <button
                onClick={() => setActiveTab('voice')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'voice'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Volume2 className="w-3 h-3 text-cyan-300" />
                <span>Voice Signal</span>
              </button>

              <button
                onClick={() => setActiveTab('ids')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'ids'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3 h-3" />
                <span>Allowed ({allowedIds.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('online')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'online'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span>Online ({activeUsers.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('denied')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'denied'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserX className="w-3 h-3 text-rose-400" />
                <span>Denied ({deniedUsers.length})</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: VIP BADGES MANAGEMENT (Admin Exclusive) */}
              {activeTab === 'badges' && (
                <div className="space-y-4">
                  <form onSubmit={handleAssignBadge} className="p-3.5 bg-[#181924] border border-amber-500/40 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>{language === 'my' ? 'VIP ရာထူးတံဆိပ် ခန့်အပ်ရန် (Admin Only)' : 'Assign VIP Role Badge'}</span>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        {language === 'my' ? 'User ID သို့မဟုတ် Game ID:' : 'User ID / Game ID:'}
                      </label>
                      <input
                        type="text"
                        value={badgeTargetId}
                        onChange={(e) => setBadgeTargetId(e.target.value)}
                        placeholder="e.g. 761699, 864480, DEMO777"
                        className="w-full bg-[#10121d] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        {language === 'my' ? 'ခန့်အပ်မည့် ရာထူးတံဆိပ် (Role Badge):' : 'Select Badge:'}
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['BOSS', 'VIP', 'MASTER', 'MEMBER'] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setBadgeTargetRole(role)}
                            className={`py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                              badgeTargetRole === role
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                                : 'bg-[#10121d] text-slate-400 border-slate-700'
                            }`}
                          >
                            {role === 'BOSS' ? '👑 BOSS' : role === 'VIP' ? '💎 VIP' : role === 'MASTER' ? '⚡ MASTER' : '👤 MEMBER'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow hover:scale-102 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Crown className="w-3.5 h-3.5 text-slate-950" />
                      <span>{language === 'my' ? 'ရာထူးတံဆိပ် ခန့်အပ်မည်' : 'Grant Official Badge'}</span>
                    </button>
                  </form>

                  {/* List of currently assigned user badges */}
                  <div>
                    <span className="text-xs font-black uppercase text-slate-400 block mb-2">
                      Official Assigned Badges List ({Object.keys(userBadges).length})
                    </span>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {Object.entries(userBadges).map(([uid, badge]) => (
                        <div
                          key={uid}
                          className="p-2.5 bg-[#181924] border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white font-bold">ID: {uid}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              badge === 'BOSS' ? 'bg-red-950 text-red-300 border border-red-700' :
                              badge === 'VIP' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' :
                              badge === 'MASTER' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {badge}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-bold">Verified</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ADMIN VOICE MESSAGE SENDER */}
              {activeTab === 'voice' && (
                <div className="space-y-4">
                  <form onSubmit={handleSendVoiceSignal} className="p-4 bg-[#181924] border border-red-500/40 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs">
                      <Volume2 className="w-4 h-4 text-red-400" />
                      <span>{language === 'my' ? 'Admin သီးသန့် Voice စာပို့စနစ် (Admin Voice Broadcast)' : 'Admin Voice Signal Broadcast'}</span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {language === 'my'
                        ? 'Admin တစ်ဦးတည်းသာ Voice စာပို့ခွင့်ရှိသည်။ အသံစာသားကို ရိုက်ထည့်၍ Telegram VIP Lounge ထဲသို့ တိုက်ရိုက်ထုတ်လွှင့်ပါ။'
                        : 'Only Admin is authorized to dispatch Voice Signals. Enter voice call text to broadcast live commentary.'}
                    </p>

                    <div>
                      <textarea
                        value={voiceSignalText}
                        onChange={(e) => setVoiceSignalText(e.target.value)}
                        rows={3}
                        className="w-full bg-[#10121d] border border-slate-700 focus:border-red-500 rounded-xl p-3 text-xs text-white focus:outline-none"
                        placeholder="Type voice announcement..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sendingVoice}
                      className="w-full py-2.5 bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-xs rounded-xl shadow hover:scale-102 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{sendingVoice ? 'ထုတ်လွှင့်နေပါသည်...' : language === 'my' ? 'Voice Signal တိုက်ရိုက်ထုတ်လွှင့်မည်' : 'Broadcast Voice Signal'}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: ALLOWED GAME IDS */}
              {activeTab === 'ids' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddGameIds} className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      {language === 'my'
                        ? 'Game ID အသစ်ထည့်သွင်းခွင့်ပြုရန် (ကော်မာခြား၍ အများအပြားထည့်နိုင်သည်)'
                        : 'Add Allowed Game IDs (comma-separated for multiple)'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGameIdsInput}
                        onChange={(e) => setNewGameIdsInput(e.target.value)}
                        placeholder="e.g. 761699, 864480, 102310"
                        className="flex-1 bg-[#181924] border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{language === 'my' ? 'ထည့်မည်' : 'Add ID'}</span>
                      </button>
                    </div>
                  </form>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase text-slate-400">
                        Allowed IDs List ({allowedIds.length})
                      </span>
                    </div>

                    {allowedIds.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500 bg-[#161722] rounded-2xl">
                        No Game IDs authorized yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                        {allowedIds.map((id) => (
                          <div
                            key={id}
                            className="p-2.5 bg-[#181924] border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono group"
                          >
                            <span className="font-bold text-white">{id}</span>
                            <button
                              onClick={() => handleRemoveGameId(id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ONLINE LOGGED IN USERS */}
              {activeTab === 'online' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-300">
                      {language === 'my' ? 'လောလောဆယ် Login ဝင်ထားသူများ' : 'Currently Logged In Users'}
                    </span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      {activeUsers.length} Online
                    </span>
                  </div>

                  {activeUsers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-[#161722] rounded-2xl">
                      {language === 'my' ? 'လောလောဆယ် မည်သူမျှ Login မဝင်ထားသေးပါ။' : 'No users currently logged in.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {activeUsers.map((u, i) => (
                        <div
                          key={u.gameId || i}
                          className="p-3 bg-[#181924] border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>Phone: {u.phone}</span>
                                <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">
                                  ID: {u.gameId}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                Logged in: {u.loginTime}
                              </span>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-emerald-400 font-black">
                              {u.balance?.toLocaleString() || 0} K
                            </span>
                            <span className="block text-[9px] text-slate-500">Balance</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: DENIED USERS */}
              {activeTab === 'denied' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-300">
                      {language === 'my'
                        ? 'Login ဝင်ရန်ကြိုးစားထားပြီး ခွင့်မပြုရသေးသူများ'
                        : 'Denied / Unauthorized Login Attempts'}
                    </span>
                    <span className="text-[10px] bg-rose-950 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                      {deniedUsers.length} Attempts
                    </span>
                  </div>

                  {deniedUsers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-[#161722] rounded-2xl">
                      {language === 'my'
                        ? 'ခွင့်မပြုထားသော Login ကြိုးပမ်းမှု မရှိသေးပါ။'
                        : 'No unauthorized login attempts recorded.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {deniedUsers.map((u, i) => (
                        <div
                          key={u.gameId || i}
                          className="p-3 bg-[#181924] border border-red-950 rounded-2xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>Phone: {u.phone}</span>
                              <span className="font-mono text-red-400 font-bold">
                                ID: {u.gameId}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Last attempt: {u.attemptTime} ({u.attemptsCount} tries)
                            </span>
                          </div>

                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/admin/add-id', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ gameIds: [u.gameId] })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setAllowedIds(data.allowedGameIds);
                                  setDeniedUsers((prev) => prev.filter((d) => d.gameId !== u.gameId));
                                  showToast(`✅ Approved Game ID ${u.gameId}!`);
                                }
                              } catch {
                                showToast('Error approving ID');
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{language === 'my' ? 'ခွင့်ပြုမည်' : 'Approve'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
