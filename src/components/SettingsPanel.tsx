import React, { useState } from 'react';
import { 
  Settings, 
  Globe, 
  Volume2, 
  User, 
  Check, 
  Save, 
  Lock, 
  MessageSquare,
  Crown,
  ShieldAlert
} from 'lucide-react';
import { UserAppSettings, UserSession } from '../types';
import { playSoundEffect } from '../api';
import itachiLogoImg from '../assets/images/itachi_logo_avatar_1791120287312.jpg';

interface SettingsPanelProps {
  settings: UserAppSettings;
  onUpdateSettings: (newSettings: UserAppSettings) => void;
  session: UserSession;
  onOpenAdmin: () => void;
  language: 'my' | 'en';
}

// User Avatars: Boy, Girl, and Admin Hitachi Logo
const AVATAR_LIST = [
  { 
    id: 'hitachi_admin', 
    name: 'Hitachi Logo', 
    category: 'Admin', 
    src: itachiLogoImg, 
    isAdminOnly: true 
  },
  { 
    id: 'boy_1', 
    name: 'Anime Boy', 
    category: 'Boy', 
    src: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80',
    isAdminOnly: false 
  },
  { 
    id: 'girl_1', 
    name: 'Anime Girl', 
    category: 'Girl', 
    src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140&auto=format&fit=crop&q=80',
    isAdminOnly: false 
  },
  { 
    id: 'boy_2', 
    name: 'Cyber Boy', 
    category: 'Boy', 
    src: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=140&auto=format&fit=crop&q=80',
    isAdminOnly: false 
  },
  { 
    id: 'girl_2', 
    name: 'Cyber Girl', 
    category: 'Girl', 
    src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140&auto=format&fit=crop&q=80',
    isAdminOnly: false 
  },
  { 
    id: 'boy_3', 
    name: 'Gamer Boy', 
    category: 'Boy', 
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140&auto=format&fit=crop&q=80',
    isAdminOnly: false 
  },
  { 
    id: 'girl_3', 
    name: 'Gamer Girl', 
    category: 'Girl', 
    src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=140&auto=format&fit=crop&q=80',
    isAdminOnly: false 
  }
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  session,
  onOpenAdmin,
  language
}) => {
  const [localSettings, setLocalSettings] = useState<UserAppSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<'All' | 'Boy' | 'Girl' | 'Admin'>('All');
  const [adminLockNotice, setAdminLockNotice] = useState<string | null>(null);

  // Strict Admin Check - User must be logged in with verified Admin credentials
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

  // Clean and sanitize non-admin user avatar and settings
  React.useEffect(() => {
    if (!isAdminUser) {
      setLocalSettings((prev) => {
        let changed = false;
        let newAvatar = prev.customAvatar;
        let newName = prev.customName;
        let newBadge = prev.userBadge;

        if (prev.customAvatar && (prev.customAvatar.includes('itachi') || prev.customAvatar.includes('hitachi'))) {
          newAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
          changed = true;
        }
        if (prev.customName && prev.customName.toUpperCase().includes('ADMIN')) {
          newName = 'User';
          changed = true;
        }
        if (prev.userBadge === 'BOSS') {
          newBadge = 'MEMBER';
          changed = true;
        }

        if (changed) {
          const sanitized = { ...prev, customAvatar: newAvatar, customName: newName, userBadge: newBadge };
          onUpdateSettings(sanitized);
          return sanitized;
        }
        return prev;
      });

      if (avatarCategory === 'Admin') {
        setAvatarCategory('All');
      }
    }
  }, [isAdminUser, avatarCategory]);

  const handleSave = () => {
    // Prevent non-admin saving hitachi avatar
    let cleanSettings = { ...localSettings };
    if (!isAdminUser) {
      if (cleanSettings.customAvatar && (cleanSettings.customAvatar.includes('itachi') || cleanSettings.customAvatar.includes('hitachi'))) {
        cleanSettings.customAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
      }
      if (cleanSettings.userBadge === 'BOSS') {
        cleanSettings.userBadge = 'MEMBER';
      }
    }
    setLocalSettings(cleanSettings);
    onUpdateSettings(cleanSettings);
    setSavedSuccess(true);
    playSoundEffect('win');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSelectAvatar = (av: typeof AVATAR_LIST[0]) => {
    if (av.isAdminOnly && !isAdminUser) {
      setAdminLockNotice(
        language === 'my'
          ? 'Hitachi Logo ကို Admin သာလျှင် အသုံးပြုခွင့်ရှိပါသည် (Admin Only)'
          : 'Hitachi Logo is reserved for Admin only'
      );
      playSoundEffect('click');
      setTimeout(() => setAdminLockNotice(null), 3500);
      return;
    }

    setLocalSettings((prev) => ({ ...prev, customAvatar: av.src }));
    setAdminLockNotice(null);
    playSoundEffect('click');
  };

  // If not admin, completely filter out Admin avatars (Hitachi Logo)
  const availableAvatars = isAdminUser
    ? AVATAR_LIST
    : AVATAR_LIST.filter((a) => !a.isAdminOnly);

  const filteredAvatars = avatarCategory === 'All' 
    ? availableAvatars 
    : availableAvatars.filter((a) => a.category === avatarCategory);

  const availableCategories = isAdminUser
    ? (['All', 'Boy', 'Girl', 'Admin'] as const)
    : (['All', 'Boy', 'Girl'] as const);

  return (
    <div className="flex flex-col gap-4 bg-[#0d0f17] p-4 rounded-2xl border border-slate-800 shadow-2xl text-slate-100 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white uppercase tracking-wide">
              {language === 'my' ? 'စနစ်ဆက်တင်များ ရွေးချယ်မှု' : 'Settings & Preferences'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {language === 'my' ? 'ဘာသာစကား၊ အသံ၊ Boy/Girl ပရိုဖိုင် ဆက်တင်များ' : 'Language, Audio, Boy/Girl Profile Controls'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{language === 'my' ? 'သိမ်းမည်' : 'Save'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{language === 'my' ? 'ဆက်တင်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ!' : 'Settings saved successfully!'}</span>
        </div>
      )}

      {/* 1. Language Selection */}
      <div className="bg-[#141624] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>{language === 'my' ? 'ဘာသာစကား ရွေးချယ်မှု (Language):' : 'Language:'}</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setLocalSettings((prev) => ({ ...prev, language: 'my' }));
              playSoundEffect('click');
            }}
            className={`py-2.5 rounded-xl font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
              localSettings.language === 'my'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white border-red-500 shadow-md'
                : 'bg-[#1b1e2e] text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <span>🇲🇲</span>
            <span>မြန်မာစာ (Myanmar)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLocalSettings((prev) => ({ ...prev, language: 'en' }));
              playSoundEffect('click');
            }}
            className={`py-2.5 rounded-xl font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
              localSettings.language === 'en'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white border-red-500 shadow-md'
                : 'bg-[#1b1e2e] text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <span>🇺🇸</span>
            <span>English</span>
          </button>
        </div>
      </div>

      {/* 2. Custom Profile & Avatar Selection (Hitachi / Boy / Girl) */}
      <div className="bg-[#141624] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <User className="w-4 h-4 text-cyan-400" />
          <span>{language === 'my' ? 'ကိုယ်ပွားရုပ်ပုံနှင့် အမည် (Boy / Girl Avatar):' : 'Boy / Girl Profile & Avatar:'}</span>
        </label>

        <div>
          <span className="text-[11px] text-slate-400 block mb-1">
            {language === 'my' ? 'အမည် (Display Name):' : 'Display Name:'}
          </span>
          <input
            type="text"
            value={localSettings.customName}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, customName: e.target.value }))}
            placeholder="Your Nickname"
            className="w-full bg-[#0c0e16] border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          />
        </div>

        {/* Lock Warning Toast if regular user clicks Hitachi */}
        {adminLockNotice && (
          <div className="p-2.5 bg-red-950/90 border border-red-500 rounded-xl text-xs text-red-200 font-bold flex items-center gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>{adminLockNotice}</span>
          </div>
        )}

        {/* Category Filters (Clean text without emoji) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-400 font-semibold">
              {language === 'my' ? 'ကိုယ်ပွားရုပ်ပုံ ရွေးချယ်ပါ (Avatar):' : 'Select Avatar:'}
            </span>
            <div className="flex gap-1">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAvatarCategory(cat)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    avatarCategory === cat
                      ? 'bg-red-600 text-white'
                      : 'bg-[#1b1e2e] text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'All' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Avatars */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {filteredAvatars.map((av) => {
              const isSelected = localSettings.customAvatar === av.src;
              return (
                <div
                  key={av.id}
                  onClick={() => handleSelectAvatar(av)}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-red-950/70 border-red-500 shadow-md ring-2 ring-red-500/80 scale-102 cursor-pointer'
                      : 'bg-[#1b1e2e] border-slate-800 hover:border-slate-600 cursor-pointer'
                  }`}
                >
                  {/* Avatar Image */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-600 shadow-md flex items-center justify-center bg-[#10121d]">
                    <img 
                      src={av.src} 
                      alt={av.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Safe fallback image
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>

                  {/* Avatar Name Label (Clean, No Emojis) */}
                  <span className="text-[10px] font-bold text-slate-300 truncate max-w-full text-center">
                    {av.name}
                  </span>

                  {/* Badge Label */}
                  {av.isAdminOnly && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5 bg-amber-950 text-amber-300 border border-amber-600">
                      👑 ADMIN
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Avatar Guide Notice */}
          <p className="text-[10px] text-slate-400 mt-2 pl-1">
            {isAdminUser
              ? (language === 'my'
                  ? '* Hitachi Logo သည် Admin သီးသန့် အထူး Logo ဖြစ်ပါသည်'
                  : '* Hitachi Logo is reserved for Admin use only')
              : (language === 'my'
                  ? '* ပရိုဖိုင်အတွက် Boy / Girl Avatar များကို လွတ်လပ်စွာ ရွေးချယ်နိုင်ပါသည်'
                  : '* Choose your desired Boy / Girl avatar for your profile')}
          </p>
        </div>
      </div>

      {/* 4. Audio & Sound FX */}
      <div className="bg-[#141624] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-emerald-400" />
          <span>{language === 'my' ? 'အသံဆိုင်ရာ ဆက်တင်များ (Audio & Sound FX):' : 'Audio & Sound FX:'}</span>
        </label>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#1b1e2e]">
            <span className="text-slate-300 font-medium">
              {language === 'my' ? 'ပင်မအသံ (Master Sound):' : 'Master Sound FX:'}
            </span>
            <input
              type="checkbox"
              checked={localSettings.soundEnabled}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
              className="w-4 h-4 accent-red-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[#1b1e2e]">
            <span className="text-slate-300 font-medium">
              {language === 'my' ? 'Telegram Chat မက်ဆေ့ခ်ျအသံ:' : 'Chat Message Chime:'}
            </span>
            <input
              type="checkbox"
              checked={localSettings.chatSound}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, chatSound: e.target.checked }))}
              className="w-4 h-4 accent-red-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[#1b1e2e]">
            <span className="text-slate-300 font-medium">
              {language === 'my' ? 'နိုင်ပွဲ အောင်သံ (Win Fanfare & Confetti):' : 'Win Celebration Sounds:'}
            </span>
            <input
              type="checkbox"
              checked={localSettings.winSound}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, winSound: e.target.checked }))}
              className="w-4 h-4 accent-red-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 5. In-Chart Chat Overlay Display */}
      <div className="bg-[#141624] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span>{language === 'my' ? 'Chart ထဲတွင် Chat ပြသမှု ဆက်တင်:' : 'In-Chart Chat Display:'}</span>
        </label>

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1b1e2e] text-xs">
          <div>
            <span className="text-slate-200 font-bold block">
              {language === 'my' ? 'Chart ထဲတွင် Chat ပြသခြင်း:' : 'In-Chart Live Chat Overlay:'}
            </span>
            <span className="text-[10px] text-slate-400">
              {language === 'my' ? 'Chart ကြည့်နေစဉ် တိုက်ရိုက် စကားပြောဆိုနိုင်သည်' : 'Show live chat stream inside live chart view'}
            </span>
          </div>
          <input
            type="checkbox"
            checked={localSettings.chartOverlayChat}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, chartOverlayChat: e.target.checked }))}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
