import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS & Preflight handling
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '8682945050:AAFECoNO45TTYl8tFPXMkpWc287dlypdrJ8';
const ADMIN_USER_ID = '8370471165';
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Persistence Files (use /tmp on serverless environments like Vercel)
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'bot_data.json')
  : path.join(__dirname, 'bot_data.json');

const CHAT_DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'chat_data.json')
  : path.join(__dirname, 'chat_data.json');

// Memory Data Store
export interface UserSessionRecord {
  phone: string;
  gameId: string;
  token: string;
  balance: number;
  platform: string;
  loginTime: string;
  lastActive: string;
  isOnline: boolean;
}

export interface DeniedAttemptRecord {
  phone: string;
  gameId: string;
  platform: string;
  attemptTime: string;
  attemptsCount: number;
}

export interface AppData {
  allowedGameIds: string[];
  activeSessions: Record<string, UserSessionRecord>;
  deniedAttempts: Record<string, DeniedAttemptRecord>;
  userBadges?: Record<string, 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER'>;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userBadge: 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER' | 'BOT';
  text: string;
  timestamp: string;
  timeFormatted: string;
  reactions: Record<string, number>; // emoji -> count
  isBot?: boolean;
  isHonoraryApproved?: boolean;
  signal?: {
    issue: string;
    prediction: 'BIG' | 'SMALL' | 'RED' | 'GREEN' | 'VIOLET';
    confidence: number;
    recommendedAmount?: number;
    status?: 'PENDING' | 'WIN' | 'LOSE';
  };
  tipRain?: {
    id: string;
    amount: number;
    totalWinners: number;
    claimedBy: string[];
  };
  voiceAudio?: {
    duration: number;
    label: string;
  };
}

let appData: AppData = {
  allowedGameIds: ['864480', '102310', '761699', '8370471165', 'DEMO777', 'VIP_BOSS'],
  activeSessions: {},
  deniedAttempts: {},
  userBadges: {
    '8370471165': 'BOSS',
    'killerboss_official': 'BOSS',
    '864480': 'MASTER',
    '102310': 'VIP',
    'DEMO777': 'VIP'
  }
};

// Initial Seed Chat Messages
let chatMessages: ChatMessage[] = [
  {
    id: 'msg_seed_1',
    userId: 'killerboss_official',
    userName: 'KILLERBOSS VIP BOT 👑',
    userAvatar: '/assets/images/killerboss_avatar_1791104818892.jpg',
    userBadge: 'BOSS',
    text: '🚀 BET RESULT - WIN!',
    timestamp: new Date(Date.now() - 360000).toISOString(),
    timeFormatted: '12:00 PM',
    reactions: { '🔥': 24, '👑': 18, '🚀': 15 },
    isBot: true
  },
  {
    id: 'msg_seed_2',
    userId: 'killerboss_official',
    userName: 'KILLERBOSS VIP BOT 👑',
    userAvatar: '/assets/images/killerboss_avatar_1791104818892.jpg',
    userBadge: 'BOSS',
    text: '💡 20261007010420\n🧠 BIG\n⚡ 1000K',
    timestamp: new Date(Date.now() - 240000).toISOString(),
    timeFormatted: '12:05 PM',
    reactions: { '🔥': 32, '💰': 19 },
    isBot: true,
    signal: {
      issue: '20261007010420',
      prediction: 'BIG',
      confidence: 96.4,
      recommendedAmount: 1000,
      status: 'WIN'
    }
  },
  {
    id: 'msg_seed_3',
    userId: 'user_thant_zin',
    userName: 'Thant Zin (PRO Master)',
    userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
    userBadge: 'MASTER',
    text: 'Bot Signal အတိုင်း BIG လိုက်ထိုးလိုက်တာ အနိုင်ရသွားပြီ! 🥳🎉',
    timestamp: new Date(Date.now() - 45000).toISOString(),
    timeFormatted: '12:11 PM',
    reactions: { '🎉': 20, '💸': 14 }
  }
];

// Load saved data
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    appData = {
      allowedGameIds: parsed.allowedGameIds || ['864480', '102310', '761699', '8370471165', 'DEMO777', 'VIP_BOSS'],
      activeSessions: parsed.activeSessions || {},
      deniedAttempts: parsed.deniedAttempts || {},
      userBadges: parsed.userBadges || appData.userBadges || {}
    };
  }
} catch (e) {
  console.error('Error loading bot_data.json:', e);
}

try {
  if (fs.existsSync(CHAT_DATA_FILE)) {
    const raw = fs.readFileSync(CHAT_DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      chatMessages = parsed;
    }
  }
} catch (e) {
  console.error('Error loading chat_data.json:', e);
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving bot_data.json:', e);
  }
}

function saveChatData() {
  try {
    // Keep max 120 messages in history
    if (chatMessages.length > 120) {
      chatMessages = chatMessages.slice(-120);
    }
    fs.writeFileSync(CHAT_DATA_FILE, JSON.stringify(chatMessages, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving chat_data.json:', e);
  }
}

// Myanmar Time helper
function getMyanmarTime(): string {
  const now = new Date();
  const myanmarOffset = 6.5 * 60 * 60 * 1000;
  const myanmarDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + myanmarOffset);
  const Y = myanmarDate.getFullYear();
  const M = String(myanmarDate.getMonth() + 1).padStart(2, '0');
  const D = String(myanmarDate.getDate()).padStart(2, '0');
  const h = String(myanmarDate.getHours()).padStart(2, '0');
  const m = String(myanmarDate.getMinutes()).padStart(2, '0');
  const s = String(myanmarDate.getSeconds()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function formatChatTime(date: Date = new Date()): string {
  const myanmarOffset = 6.5 * 60 * 60 * 1000;
  const myanmarDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + myanmarOffset);
  let hours = myanmarDate.getHours();
  const minutes = String(myanmarDate.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Send message to Telegram
async function sendTelegramMessage(chatId: string | number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });
    return await res.json();
  } catch (err: any) {
    console.error('Telegram sendMessage error:', err?.message);
    return null;
  }
}

// Telegram Bot polling for Admin commands (/aid, /rid, /ids, /users, /stats, /broadcast)
let lastTelegramUpdateId = 0;
async function pollTelegramUpdates() {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/getUpdates?offset=${lastTelegramUpdateId + 1}&timeout=10`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastTelegramUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;

        const chatId = String(msg.chat.id);
        const text = msg.text.trim();

        if (chatId === ADMIN_USER_ID || String(msg.from?.id) === ADMIN_USER_ID) {
          await handleAdminTelegramCommand(chatId, text);
        } else {
          if (text.startsWith('/start')) {
            await sendTelegramMessage(chatId, `Welcome to KillerBoss 777 Lottery Bot VIP Lounge!`);
          }
        }
      }
    }
  } catch (err) {
    // Ignore polling network errors
  }
}

if (!process.env.VERCEL) {
  setInterval(pollTelegramUpdates, 4000);
}

async function handleAdminTelegramCommand(chatId: string, text: string) {
  if (text.startsWith('/aid')) {
    const rawIds = text.replace('/aid', '').trim();
    if (!rawIds) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/aid game_id1,game_id2</code>\nExample: <code>/aid 761699,864480</code>');
      return;
    }
    const ids = rawIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
    const added: string[] = [];
    for (const id of ids) {
      if (!appData.allowedGameIds.includes(id)) {
        appData.allowedGameIds.push(id);
        added.push(id);
      }
    }
    saveData();
    await sendTelegramMessage(
      chatId,
      `✅ <b>Game IDs Added Successfully!</b>\n\nAdded: <code>${added.join(', ') || 'None (already exists)'}</code>\nTotal Allowed IDs: <b>${appData.allowedGameIds.length}</b>`
    );
    return;
  }

  if (text.startsWith('/rid')) {
    const rawId = text.replace('/rid', '').trim();
    if (!rawId) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/rid game_id</code>\nExample: <code>/rid 761699</code>');
      return;
    }
    appData.allowedGameIds = appData.allowedGameIds.filter((id) => id !== rawId);
    delete appData.activeSessions[rawId];
    saveData();
    await sendTelegramMessage(chatId, `🗑️ <b>Game ID '${rawId}' removed and session kicked out.</b>`);
    return;
  }

  if (text.startsWith('/ids')) {
    if (appData.allowedGameIds.length === 0) {
      await sendTelegramMessage(chatId, '📋 No allowed Game IDs found.');
      return;
    }
    const idList = appData.allowedGameIds.map((id, i) => `${i + 1}. <code>${id}</code>`).join('\n');
    await sendTelegramMessage(
      chatId,
      `📋 <b>Allowed Game IDs (${appData.allowedGameIds.length}):</b>\n\n${idList}\n\n<i>To add: /aid &lt;id&gt;\nTo remove: /rid &lt;id&gt;</i>`
    );
    return;
  }

  if (text.startsWith('/users') || text.startsWith('/stats')) {
    const activeList = Object.values(appData.activeSessions);
    const deniedList = Object.values(appData.deniedAttempts);

    let report = `📊 <b>KillerBoss Bot Users Report</b>\n⏰ <b>Time:</b> ${getMyanmarTime()}\n\n`;
    report += `🟢 <b>Logged In Users (${activeList.length}):</b>\n`;
    if (activeList.length === 0) {
      report += `<i>No active users logged in right now.</i>\n`;
    } else {
      activeList.forEach((u, i) => {
        report += `${i + 1}. 📱 <code>${u.phone}</code> | ID: <code>${u.gameId}</code> | 💰 ${u.balance.toLocaleString()} K\n`;
      });
    }

    report += `\n🔴 <b>Denied / Unauthorized Attempts (${deniedList.length}):</b>\n`;
    if (deniedList.length === 0) {
      report += `<i>No unauthorized attempts recorded.</i>\n`;
    } else {
      deniedList.forEach((u, i) => {
        report += `${i + 1}. 📱 <code>${u.phone}</code> | ID: <code>${u.gameId}</code> (${u.attemptsCount} tries) | <code>/aid ${u.gameId}</code>\n`;
      });
    }

    await sendTelegramMessage(chatId, report);
    return;
  }

  if (text.startsWith('/broadcast')) {
    const msg = text.replace('/broadcast', '').trim();
    if (!msg) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/broadcast Your message here</code>');
      return;
    }
    
    // Broadcast to WebSocket chatroom as Admin
    const broadcastMsg: ChatMessage = {
      id: `admin_bcast_${Date.now()}`,
      userId: 'admin_telegram',
      userName: 'KILLERBOSS ADMIN (TELEGRAM)',
      userAvatar: '/src/assets/images/killerboss_avatar_1791104818892.jpg',
      userBadge: 'BOSS',
      text: `📢 [OFFICIAL BROADCAST] ${msg}`,
      timestamp: new Date().toISOString(),
      timeFormatted: formatChatTime(),
      reactions: { '👑': 10, '🔥': 10 }
    };
    chatMessages.push(broadcastMsg);
    saveChatData();
    broadcastToAllClients({ type: 'chat:message', payload: broadcastMsg });

    await sendTelegramMessage(chatId, `📢 Broadcast message dispatched to Web Live Chat:\n\n${msg}`);
    return;
  }

  if (text.startsWith('/help') || text.startsWith('/start')) {
    await sendTelegramMessage(
      chatId,
      `👑 <b>Admin Control Menu - KillerBoss Bot</b>\n\n` +
      `<b>Commands:</b>\n` +
      `• <code>/aid &lt;id1,id2&gt;</code> - Add Allowed Game IDs\n` +
      `• <code>/rid &lt;id&gt;</code> - Remove Game ID\n` +
      `• <code>/ids</code> - List All Allowed Game IDs\n` +
      `• <code>/users</code> - View Logged-in & Denied Users\n` +
      `• <code>/broadcast &lt;msg&gt;</code> - Broadcast Message to Live Chat`
    );
  }
}

// API Endpoints for 777 Big Win & 6Lottery
const API_ENDPOINTS: Record<string, string> = {
  '777': 'https://api.bigwinqaz.com/api/webapi/',
  '6lottery': 'https://api.6lottery.net/api/webapi/'
};

function signMd5(data: Record<string, any>): string {
  const signData = { ...data };
  delete signData.signature;
  delete signData.timestamp;

  const sortedKeys = Object.keys(signData).sort();
  const sortedData: Record<string, any> = {};
  sortedKeys.forEach((key) => {
    sortedData[key] = signData[key];
  });

  const hashString = JSON.stringify(sortedData).replace(/\s/g, '');
  return crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();
}

function randomKey(): string {
  const template = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx';
  let result = '';
  for (const char of template) {
    if (char === 'x') {
      result += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    } else if (char === 'y') {
      result += '89a'[Math.floor(Math.random() * 3)];
    } else {
      result += char;
    }
  }
  return result;
}

function getHeaders(token?: string, platform = '777') {
  const origin = platform === '6lottery' ? 'https://www.6lottery.net' : 'https://www.bigwinqaz.com';
  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': origin,
    'Referer': `${origin}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  if (token) {
    headers['Authorization'] = token;
  }
  return headers;
}

// ================= WebSocket & Real-Time Setup =================
const connectedClients = new Map<WebSocket, { userId: string; userName: string; badge: string; isOnline: boolean }>();

function broadcastToAllClients(data: { type: string; payload: any }) {
  const msgStr = JSON.stringify(data);
  for (const [client, _meta] of connectedClients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msgStr);
      } catch (err) {
        // ignore client send error
      }
    }
  }
}

function getOnlineCount(): number {
  return Math.max(1, connectedClients.size);
}

// 1-Min WinGo Period & Countdown Helper
function get1MinWinGoPeriod(now = new Date()): { period: string; countdown: number } {
  const myanmarOffset = 6.5 * 60 * 60 * 1000;
  const myanmarDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + myanmarOffset);
  const Y = myanmarDate.getFullYear();
  const M = String(myanmarDate.getMonth() + 1).padStart(2, '0');
  const D = String(myanmarDate.getDate()).padStart(2, '0');
  const totalMinutes = myanmarDate.getHours() * 60 + myanmarDate.getMinutes() + 1;
  const periodIndex = String(totalMinutes).padStart(4, '0');
  const period = `${Y}${M}${D}01${periodIndex}`;
  const seconds = myanmarDate.getSeconds();
  const countdown = 60 - seconds;
  return { period, countdown };
}

// Martingale Sequence: [1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000]
const SIGNAL_SEQUENCE = [1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000];
let currentSignalSequenceIndex = 0;
let lastBotSignalIssue = '';
let lastBotPrediction: 'BIG' | 'SMALL' = 'BIG';
let lastCalculatedDrawIssue = '';

// Automated 1-Min Killerboss VIP Bot Signal Generator (Synchronized 100% with Real 777 API)
async function triggerKillerbossBotSignal() {
  const baseUrl = API_ENDPOINTS['777'];
  let realIssue = '';
  let realCountdown = 60;

  // 1. Fetch Real Issue from 777 WebAPI
  try {
    const issueBody: Record<string, any> = {
      typeId: 1,
      language: 0,
      random: 'b05034ba4a2642009350ee863f29e2e9',
      timestamp: Math.floor(Date.now() / 1000)
    };
    issueBody.signature = signMd5(issueBody);

    const apiRes = await fetch(`${baseUrl}GetGameIssue`, {
      method: 'POST',
      headers: getHeaders(undefined, '777'),
      body: JSON.stringify(issueBody)
    });
    const result = await apiRes.json();
    if (result.msgCode === 0 && result.data?.issueNumber) {
      realIssue = String(result.data.issueNumber).trim();
      if (typeof result.data.countdown === 'number') {
        realCountdown = result.data.countdown;
      }
    }
  } catch (err) {
    // ignore
  }

  // Fallback to computed 1-min issue if upstream network times out
  if (!realIssue) {
    const { period, countdown } = get1MinWinGoPeriod();
    realIssue = period;
    realCountdown = countdown;
  }

  if (realIssue === lastBotSignalIssue) return;
  lastBotSignalIssue = realIssue;

  // 2. Fetch Real Draw Results to verify Win / Loss on previous period
  let lastResultStatus = '';
  try {
    const resultsBody: Record<string, any> = {
      pageNo: 1,
      pageSize: 5,
      language: 0,
      typeId: 1,
      random: '6DEB0766860C42151A193692ED16D65A',
      timestamp: Math.floor(Date.now() / 1000)
    };
    resultsBody.signature = signMd5(resultsBody);

    const resultsRes = await fetch(`${baseUrl}GetNoaverageEmerdList`, {
      method: 'POST',
      headers: getHeaders(undefined, '777'),
      body: JSON.stringify(resultsBody)
    });
    const parsed = await resultsRes.json();
    const list = parsed?.data?.list || parsed?.data || [];
    
    if (Array.isArray(list) && list.length > 0) {
      const latestDraw = list[0];
      const drawIssue = String(latestDraw.issueNumber || latestDraw.period || '').trim();
      const numVal = parseInt(String(latestDraw.number), 10);
      const actualSize = numVal >= 5 ? 'BIG' : 'SMALL';

      if (drawIssue && drawIssue !== lastCalculatedDrawIssue) {
        lastCalculatedDrawIssue = drawIssue;
        const isWin = (lastBotPrediction === actualSize);

        if (isWin) {
          // REAL WIN -> Reset to Level 1 (1,000 MMK)
          currentSignalSequenceIndex = 0;
          const resultMsg: ChatMessage = {
            id: `res_win_${Date.now()}`,
            userId: 'killerboss_official',
            userName: 'KILLERBOSS VIP BOT 👑',
            userAvatar: '/assets/images/killerboss_avatar_1791104818892.jpg',
            userBadge: 'BOSS',
            text: '🚀 BET RESULT - WIN!',
            timestamp: new Date().toISOString(),
            timeFormatted: formatChatTime(),
            reactions: { '🔥': 20, '🎉': 18 },
            isBot: true
          };
          chatMessages.push(resultMsg);
          saveChatData();
          broadcastToAllClients({ type: 'chat:message', payload: resultMsg });
        } else {
          // REAL LOSS -> Advance in [1000, 3000, 7000, 16000, 32000, 76000, 160000, 320000]
          currentSignalSequenceIndex = (currentSignalSequenceIndex + 1) % SIGNAL_SEQUENCE.length;
          const resultMsg: ChatMessage = {
            id: `res_loss_${Date.now()}`,
            userId: 'killerboss_official',
            userName: 'KILLERBOSS VIP BOT 👑',
            userAvatar: '/assets/images/killerboss_avatar_1791104818892.jpg',
            userBadge: 'BOSS',
            text: '🚀 BET RESULT - LOSS!',
            timestamp: new Date().toISOString(),
            timeFormatted: formatChatTime(),
            reactions: { '⚡': 15, '💪': 12 },
            isBot: true
          };
          chatMessages.push(resultMsg);
          saveChatData();
          broadcastToAllClients({ type: 'chat:message', payload: resultMsg });
        }
      }
    }
  } catch (err) {
    // ignore
  }

  const recAmount = SIGNAL_SEQUENCE[currentSignalSequenceIndex];
  const predictions: ('BIG' | 'SMALL')[] = ['BIG', 'SMALL', 'BIG', 'BIG', 'SMALL'];
  const pred = predictions[Math.floor(Math.random() * predictions.length)];
  lastBotPrediction = pred;
  const confidence = Number((93 + Math.random() * 6.5).toFixed(1));

  const text = `💡 ${realIssue}\n🧠 ${pred}\n⚡ ${recAmount}K`;

  const botMsg: ChatMessage = {
    id: `bot_signal_${Date.now()}`,
    userId: 'killerboss_official',
    userName: 'KILLERBOSS VIP BOT 👑',
    userAvatar: '/assets/images/killerboss_avatar_1791104818892.jpg',
    userBadge: 'BOSS',
    text,
    timestamp: new Date().toISOString(),
    timeFormatted: formatChatTime(),
    reactions: { '🔥': 25, '🚀': 20, '💰': 18 },
    isBot: true,
    signal: {
      issue: realIssue,
      prediction: pred,
      confidence,
      recommendedAmount: recAmount,
      status: 'PENDING'
    }
  };

  chatMessages.push(botMsg);
  saveChatData();
  broadcastToAllClients({ type: 'chat:message', payload: botMsg });
  broadcastToAllClients({ type: 'chart:signal', payload: botMsg.signal });
}

// Periodically run real API 1-min WinGo bot signals every 15 seconds
setInterval(() => {
  triggerKillerbossBotSignal();
}, 15000);

// ================= REST API Endpoints =================

// 1. Chat History & State
app.get('/api/chat/history', (_req: Request, res: Response) => {
  res.json({
    success: true,
    messages: chatMessages,
    onlineUsersCount: getOnlineCount(),
    serverTime: new Date().toISOString()
  });
});

// 2. Post Chat Message (REST endpoint, broadcast to WS) - Open to all users & guests
app.post('/api/chat/send', (req: Request, res: Response) => {
  const { userId, userName, userAvatar, userBadge, text, signal, tipRain, voiceAudio } = req.body;
  
  if (!text && !signal && !tipRain && !voiceAudio) {
    return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
  }

  const cleanUserId = String(userId || '').trim();
  const isSenderAdmin = 
    cleanUserId === '8370471165' || 
    cleanUserId === '761699' || 
    cleanUserId === 'killerboss_official' || 
    cleanUserId === 'admin_telegram' ||
    userBadge === 'BOSS';

  // Check if sender is logged in (has active session in appData or valid gameId)
  const isLoggedInUser = Boolean(
    cleanUserId && 
    !cleanUserId.startsWith('guest_') && 
    (appData.activeSessions[cleanUserId] || appData.allowedGameIds.includes(cleanUserId))
  );

  // User display name & avatar resolution
  let finalUserName: string;
  let finalAvatar: string;

  if (isSenderAdmin) {
    finalUserName = (userName && String(userName).trim() !== '') ? String(userName).trim() : 'KILLERBOSS ADMIN 👑';
    finalAvatar = (userAvatar && String(userAvatar).trim() !== '') ? String(userAvatar).replace('/src/', '/') : '/assets/images/itachi_logo_avatar_1791120287312.jpg';
  } else {
    finalUserName = (userName && String(userName).trim() !== '') ? String(userName).trim() : 'User';
    finalAvatar = (userAvatar && !userAvatar.includes('itachi') && !userAvatar.includes('hitachi'))
      ? userAvatar
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
  }

  // ရာထူးဂုဏ်ဆောင်နာမည်တွေက Admin ခွင့်ပြုမှသာပေါ်မယ် chart ထဲမှာပြမယ်
  const adminApprovedBadge = isSenderAdmin 
    ? 'BOSS' 
    : (cleanUserId ? appData.userBadges?.[cleanUserId] : null);

  const isHonoraryApproved = Boolean(adminApprovedBadge);
  const finalBadge = adminApprovedBadge || 'MEMBER';

  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: isSenderAdmin ? '8370471165' : (cleanUserId || `guest_${Math.random().toString(36).substring(2, 6)}`),
    userName: finalUserName,
    userAvatar: finalAvatar,
    userBadge: finalBadge,
    isHonoraryApproved,
    text: text || '',
    timestamp: new Date().toISOString(),
    timeFormatted: formatChatTime(),
    reactions: {},
    signal,
    tipRain,
    voiceAudio
  };

  chatMessages.push(newMsg);
  saveChatData();

  broadcastToAllClients({ type: 'chat:message', payload: newMsg });
  if (signal) {
    broadcastToAllClients({ type: 'chart:signal', payload: signal });
  }

  return res.json({ success: true, message: newMsg });
});

// 3. React to message
app.post('/api/chat/react', (req: Request, res: Response) => {
  const { messageId, emoji } = req.body;
  if (!messageId || !emoji) {
    return res.status(400).json({ success: false, message: 'messageId and emoji are required' });
  }

  const target = chatMessages.find((m) => m.id === messageId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Message not found' });
  }

  if (!target.reactions) target.reactions = {};
  target.reactions[emoji] = (target.reactions[emoji] || 0) + 1;
  saveChatData();

  broadcastToAllClients({
    type: 'chat:reaction',
    payload: { messageId, emoji, count: target.reactions[emoji] }
  });

  return res.json({ success: true, reactions: target.reactions });
});

// 4. Claim Tip Rain
app.post('/api/chat/claim-tip', (req: Request, res: Response) => {
  const { messageId, userId, userName } = req.body;
  if (!messageId || !userId) {
    return res.status(400).json({ success: false, message: 'messageId and userId are required' });
  }

  const target = chatMessages.find((m) => m.id === messageId);
  if (!target || !target.tipRain) {
    return res.status(404).json({ success: false, message: 'Tip Rain not found' });
  }

  if (target.tipRain.claimedBy.includes(userId)) {
    return res.json({ success: false, message: 'You have already claimed this tip rain!' });
  }

  if (target.tipRain.claimedBy.length >= target.tipRain.totalWinners) {
    return res.json({ success: false, message: 'All tip rain spots have already been claimed!' });
  }

  target.tipRain.claimedBy.push(userId);
  const rewardAmount = Math.floor(target.tipRain.amount / target.tipRain.totalWinners);
  saveChatData();

  // Broadcast system notice in chat
  const claimNotice: ChatMessage = {
    id: `claim_${Date.now()}`,
    userId: 'system',
    userName: '🎰 777 RAIN DROPPER',
    userAvatar: '/src/assets/images/kenji_doctor_logo_1791105325841.jpg',
    userBadge: 'BOT',
    text: `🎉 @${userName || 'User'} claimed ${rewardAmount.toLocaleString()} K from Tip Rain! (${target.tipRain.claimedBy.length}/${target.tipRain.totalWinners} claimed)`,
    timestamp: new Date().toISOString(),
    timeFormatted: formatChatTime(),
    reactions: { '💰': 6, '👏': 5 }
  };
  chatMessages.push(claimNotice);
  saveChatData();

  broadcastToAllClients({ type: 'chat:message', payload: claimNotice });
  broadcastToAllClients({
    type: 'chat:tip_claimed',
    payload: {
      messageId,
      userId,
      claimedCount: target.tipRain.claimedBy.length,
      rewardAmount
    }
  });

  return res.json({
    success: true,
    rewardAmount,
    claimedCount: target.tipRain.claimedBy.length,
    remaining: target.tipRain.totalWinners - target.tipRain.claimedBy.length
  });
});

// ================= 777 Big Win & 6Lottery Proxy Endpoints =================

// 5. Login Proxy with Game ID Permission Verification
app.post('/api/login', async (req: Request, res: Response) => {
  try {
    const { phone, password, platform = '777' } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }

    const cleanPhone = String(phone).trim().replace(/^(\+?95|0)/, '');

    // Instant VIP Demo mode for quick testing if requested
    if (cleanPhone === 'demo' || cleanPhone === '777' || password === 'demo777') {
      const demoId = 'DEMO777';
      const demoToken = 'DEMO_VIP_TOKEN_' + Date.now();
      appData.activeSessions[demoId] = {
        phone: '09777999888',
        gameId: demoId,
        token: demoToken,
        balance: 500000,
        platform,
        loginTime: getMyanmarTime(),
        lastActive: getMyanmarTime(),
        isOnline: true
      };
      saveData();

      return res.json({
        success: true,
        message: 'VIP Demo Login Successful',
        token: demoToken,
        gameId: demoId,
        balance: 500000,
        data: { userId: demoId, username: 'VIP Guest Bettor', balance: 500000 }
      });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const baseUrl = API_ENDPOINTS[platform] || API_ENDPOINTS['777'];

    const body: Record<string, any> = {
      phonetype: -1,
      language: 0,
      logintype: 'mobile',
      random: '9078efc98754430e92e51da59eb2563c',
      username: `95${cleanPhone}`,
      pwd: password,
      timestamp: Math.floor(Date.now() / 1000)
    };
    body.signature = signMd5(body);

    const apiRes = await fetch(`${baseUrl}Login`, {
      method: 'POST',
      headers: getHeaders(undefined, platform),
      body: JSON.stringify(body)
    });

    const result = await apiRes.json();
    if (result.msgCode === 0) {
      const tokenData = result.data || {};
      const fullToken = `${tokenData.tokenHeader || ''}${tokenData.token || ''}`;

      let userGameId = '';
      try {
        const userBody: Record<string, any> = {
          language: 0,
          random: '9078efc98754430e92e51da59eb2563c',
          timestamp: Math.floor(Date.now() / 1000)
        };
        userBody.signature = signMd5(userBody);

        const userInfoRes = await fetch(`${baseUrl}GetUserInfo`, {
          method: 'POST',
          headers: getHeaders(fullToken, platform),
          body: JSON.stringify(userBody)
        });
        const uData = await userInfoRes.json();
        if (uData.msgCode === 0 && uData.data) {
          userGameId = String(uData.data.userId || uData.data.user_id || uData.data.username || '').trim();
        }
      } catch (e) {
        console.error('Error fetching user info in login:', e);
      }

      if (!userGameId) {
        userGameId = String(tokenData.userId || tokenData.user_id || cleanPhone);
      }

      const isAdmin = String(userGameId).trim() === '8370471165' || cleanPhone.includes('9791111116');
      const chartId = isAdmin ? '8370471165' : userGameId;

      if (isAdmin) {
        if (!appData.userBadges) appData.userBadges = {};
        appData.userBadges['8370471165'] = 'BOSS';
        if (!appData.allowedGameIds.includes('8370471165')) appData.allowedGameIds.push('8370471165');
      }

      // Auto-register Game ID (Unrestricted access as requested)
      if (!appData.allowedGameIds.includes(String(userGameId).trim())) {
        appData.allowedGameIds.push(String(userGameId).trim());
      }

      let userBalance = 0;
      try {
        const balBody: Record<string, any> = {
          language: 0,
          random: '9078efc98754430e92e51da59eb2563c',
          timestamp: Math.floor(Date.now() / 1000)
        };
        balBody.signature = signMd5(balBody);
        const balRes = await fetch(`${baseUrl}GetBalance`, {
          method: 'POST',
          headers: getHeaders(fullToken, platform),
          body: JSON.stringify(balBody)
        });
        const bData = await balRes.json();
        if (bData.msgCode === 0 && bData.data) {
          userBalance = bData.data.amount || 0;
        }
      } catch (e) {
        // ignore
      }

      appData.activeSessions[userGameId] = {
        phone: cleanPhone,
        gameId: userGameId,
        token: fullToken,
        balance: userBalance,
        platform,
        loginTime: getMyanmarTime(),
        lastActive: getMyanmarTime(),
        isOnline: true
      };

      delete appData.deniedAttempts[userGameId];
      saveData();

      const notifyMsg =
        `✅ <b>User Logged In Successfully</b>\n\n` +
        `📱 <b>Phone:</b> <code>95${cleanPhone}</code>\n` +
        `🆔 <b>Game ID:</b> <code>${userGameId}</code> ${isAdmin ? '👑 <b>(ADMIN)</b>' : ''}\n` +
        `💬 <b>Chart ID:</b> <code>${chartId}</code>\n` +
        `💰 <b>Balance:</b> ${userBalance.toLocaleString()} K\n` +
        `⏰ <b>Time:</b> ${getMyanmarTime()}`;
      sendTelegramMessage(ADMIN_USER_ID, notifyMsg);

      return res.json({
        success: true,
        message: 'Login successful',
        token: fullToken,
        gameId: isAdmin ? '761699' : userGameId,
        chartId: isAdmin ? '8370471165' : userGameId,
        isAdmin,
        userBadge: isAdmin ? 'BOSS' : (appData.userBadges?.[userGameId] || 'VIP'),
        balance: userBalance,
        data: tokenData
      });
    } else {
      return res.json({
        success: false,
        message: result.msg || 'Login failed',
        code: result.msgCode
      });
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Login request failed' });
  }
});

// 6. Admin APIs for Web UI
app.get('/api/admin/data', (_req: Request, res: Response) => {
  res.json({
    success: true,
    adminId: ADMIN_USER_ID,
    botToken: TELEGRAM_BOT_TOKEN,
    allowedGameIds: appData.allowedGameIds,
    activeSessions: Object.values(appData.activeSessions),
    deniedAttempts: Object.values(appData.deniedAttempts),
    userBadges: appData.userBadges || {}
  });
});

app.post('/api/admin/set-user-badge', (req: Request, res: Response) => {
  const { gameId, badge } = req.body;
  if (!gameId || !badge) {
    return res.status(400).json({ success: false, message: 'gameId and badge required' });
  }

  if (!appData.userBadges) appData.userBadges = {};
  appData.userBadges[String(gameId).trim()] = badge;
  saveData();

  // Broadcast system notice to chatroom
  const badgeNotice: ChatMessage = {
    id: `badge_promote_${Date.now()}`,
    userId: 'admin_telegram',
    userName: 'KILLERBOSS ADMIN (OFFICIAL)',
    userAvatar: '/assets/images/itachi_logo_avatar_1791120287312.jpg',
    userBadge: 'BOSS',
    text: `👑 [OFFICIAL PROMOTION] User ID ${gameId} has been officially awarded the [${badge}] Badge by Admin!`,
    timestamp: new Date().toISOString(),
    timeFormatted: formatChatTime(),
    reactions: { '👑': 12, '👏': 15 }
  };
  chatMessages.push(badgeNotice);
  saveChatData();
  broadcastToAllClients({ type: 'chat:message', payload: badgeNotice });
  broadcastToAllClients({ type: 'badge:updated', payload: { gameId, badge } });

  return res.json({
    success: true,
    gameId,
    badge,
    userBadges: appData.userBadges
  });
});

app.post('/api/admin/send-voice-signal', (req: Request, res: Response) => {
  const { text, audioLabel = 'Killerboss Official Voice Call' } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, message: 'Voice text required' });
  }

  const voiceMsg: ChatMessage = {
    id: `admin_voice_${Date.now()}`,
    userId: ADMIN_USER_ID,
    userName: 'KILLERBOSS ADMIN (VOICE) 👑',
    userAvatar: '/assets/images/itachi_logo_avatar_1791120287312.jpg',
    userBadge: 'BOSS',
    text: `🎙️ [ADMIN OFFICIAL VOICE SIGNAL]: ${text}`,
    timestamp: new Date().toISOString(),
    timeFormatted: formatChatTime(),
    reactions: { '🔥': 20, '👑': 18 },
    isBot: true,
    voiceAudio: {
      duration: 4.5,
      label: audioLabel
    }
  };

  chatMessages.push(voiceMsg);
  saveChatData();
  broadcastToAllClients({ type: 'chat:message', payload: voiceMsg });

  return res.json({ success: true, message: voiceMsg });
});

app.post('/api/admin/add-id', (req: Request, res: Response) => {
  const { gameIds } = req.body;
  if (!gameIds || !Array.isArray(gameIds)) {
    return res.status(400).json({ success: false, message: 'gameIds array required' });
  }

  const added: string[] = [];
  for (const raw of gameIds) {
    const id = String(raw).trim();
    if (id && !appData.allowedGameIds.includes(id)) {
      appData.allowedGameIds.push(id);
      added.push(id);
      delete appData.deniedAttempts[id];
    }
  }
  saveData();

  return res.json({
    success: true,
    added,
    allowedGameIds: appData.allowedGameIds
  });
});

app.post('/api/admin/remove-id', (req: Request, res: Response) => {
  const { gameId } = req.body;
  if (!gameId) {
    return res.status(400).json({ success: false, message: 'gameId required' });
  }

  const cleanId = String(gameId).trim();
  appData.allowedGameIds = appData.allowedGameIds.filter((id) => id !== cleanId);
  delete appData.activeSessions[cleanId];
  saveData();

  return res.json({
    success: true,
    removed: gameId,
    allowedGameIds: appData.allowedGameIds
  });
});

// 7. Session Status Check
app.post('/api/session-status', (req: Request, res: Response) => {
  const { gameId } = req.body;
  if (!gameId) {
    return res.json({ success: true, allowed: false, sessionRevoked: true });
  }
  const isAllowed = appData.allowedGameIds.map((id) => String(id).trim()).includes(String(gameId).trim());
  return res.json({
    success: true,
    allowed: isAllowed,
    sessionRevoked: !isAllowed
  });
});

// 8. Current Game Issue Proxy
app.post('/api/issue', async (req: Request, res: Response) => {
  try {
    const { platform = '777', token, gameId } = req.body;
    if (gameId && !appData.allowedGameIds.map((id) => String(id).trim()).includes(String(gameId).trim())) {
      return res.json({
        success: false,
        sessionRevoked: true,
        accessDenied: true,
        message: 'Your Game ID access has been revoked by admin.'
      });
    }

    const baseUrl = API_ENDPOINTS[platform] || API_ENDPOINTS['777'];

    const body: Record<string, any> = {
      typeId: 1,
      language: 0,
      random: 'b05034ba4a2642009350ee863f29e2e9',
      timestamp: Math.floor(Date.now() / 1000)
    };
    body.signature = signMd5(body);

    const apiRes = await fetch(`${baseUrl}GetGameIssue`, {
      method: 'POST',
      headers: getHeaders(token, platform),
      body: JSON.stringify(body)
    });

    const result = await apiRes.json();
    if (result.msgCode === 0 && result.data) {
      return res.json({
        success: true,
        issueNumber: result.data.issueNumber || '',
        data: result.data
      });
    } else {
      // Fallback issue number generator if upstream API returns error or is unreachable
      const now = new Date();
      const fallbackIssue = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(now.getTime() / 60000)}`;
      return res.json({
        success: true,
        issueNumber: fallbackIssue,
        data: { issueNumber: fallbackIssue, countdown: 60 - now.getSeconds() }
      });
    }
  } catch (error: any) {
    const now = new Date();
    const fallbackIssue = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(now.getTime() / 60000)}`;
    return res.json({
      success: true,
      issueNumber: fallbackIssue,
      data: { issueNumber: fallbackIssue, countdown: 60 - now.getSeconds() }
    });
  }
});

// 9. Balance Proxy
app.post('/api/balance', async (req: Request, res: Response) => {
  try {
    const { token, platform = '777', gameId } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    if (gameId && !appData.allowedGameIds.map((id) => String(id).trim()).includes(String(gameId).trim())) {
      return res.json({
        success: false,
        sessionRevoked: true,
        accessDenied: true,
        message: 'Your Game ID access has been revoked by admin.'
      });
    }

    if (token.startsWith('DEMO_VIP_TOKEN')) {
      return res.json({
        success: true,
        amount: appData.activeSessions[gameId || 'DEMO777']?.balance || 500000
      });
    }

    const baseUrl = API_ENDPOINTS[platform] || API_ENDPOINTS['777'];
    const body: Record<string, any> = {
      language: 0,
      random: '9078efc98754430e92e51da59eb2563c',
      timestamp: Math.floor(Date.now() / 1000)
    };
    body.signature = signMd5(body);

    const apiRes = await fetch(`${baseUrl}GetBalance`, {
      method: 'POST',
      headers: getHeaders(token, platform),
      body: JSON.stringify(body)
    });

    const result = await apiRes.json();
    if (result.msgCode === 0) {
      const amount = result.data?.amount ?? 0;
      if (gameId && appData.activeSessions[gameId]) {
        appData.activeSessions[gameId].balance = amount;
        appData.activeSessions[gameId].lastActive = getMyanmarTime();
        saveData();
      }

      return res.json({
        success: true,
        amount,
        data: result.data
      });
    } else {
      return res.json({
        success: false,
        message: result.msg || 'Failed to get balance'
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Balance request failed' });
  }
});

// 10. User Info Proxy
app.post('/api/user-info', async (req: Request, res: Response) => {
  try {
    const { token, platform = '777' } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    if (token.startsWith('DEMO_VIP_TOKEN')) {
      return res.json({
        success: true,
        data: { userId: 'DEMO777', username: 'VIP Guest Bettor', balance: 500000 }
      });
    }

    const baseUrl = API_ENDPOINTS[platform] || API_ENDPOINTS['777'];
    const body: Record<string, any> = {
      language: 0,
      random: '9078efc98754430e92e51da59eb2563c',
      timestamp: Math.floor(Date.now() / 1000)
    };
    body.signature = signMd5(body);

    const apiRes = await fetch(`${baseUrl}GetUserInfo`, {
      method: 'POST',
      headers: getHeaders(token, platform),
      body: JSON.stringify(body)
    });

    const result = await apiRes.json();
    if (result.msgCode === 0) {
      return res.json({
        success: true,
        data: result.data || {}
      });
    } else {
      return res.json({
        success: false,
        message: result.msg || 'Failed to get user info'
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'User info request failed' });
  }
});

// 11. Betting Proxy
app.post('/api/bet', async (req: Request, res: Response) => {
  try {
    const { token, platform = '777', amount, betType, issueId: providedIssue, gameId } = req.body;
    const effectiveGameId = String(gameId).trim() === '8370471165' ? '761699' : gameId;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    if (effectiveGameId && !appData.allowedGameIds.map((id) => String(id).trim()).includes(String(effectiveGameId).trim())) {
      return res.status(403).json({
        success: false,
        accessDenied: true,
        message: 'Your Game ID is not authorized to place bets.'
      });
    }

    // Handle Demo VIP betting simulation
    if (token.startsWith('DEMO_VIP_TOKEN')) {
      const isColourBet = [10, 11, 12].includes(Number(betType));
      const potentialProfit = Math.floor(Number(amount) * 0.96);
      return res.json({
        success: true,
        message: 'Demo Bet placed successfully',
        issueId: providedIssue || 'DEMO_ISSUE',
        amount: Number(amount),
        potentialProfit,
        data: { success: true, gameType: isColourBet ? 0 : 2 }
      });
    }

    const baseUrl = API_ENDPOINTS[platform] || API_ENDPOINTS['777'];

    let issueNumber = providedIssue;
    if (!issueNumber) {
      const issueBody: Record<string, any> = {
        typeId: 1,
        language: 0,
        random: 'b05034ba4a2642009350ee863f29e2e9',
        timestamp: Math.floor(Date.now() / 1000)
      };
      issueBody.signature = signMd5(issueBody);

      const issueRes = await fetch(`${baseUrl}GetGameIssue`, {
        method: 'POST',
        headers: getHeaders(token, platform),
        body: JSON.stringify(issueBody)
      });
      const issueData = await issueRes.json();
      issueNumber = issueData?.data?.issueNumber;
    }

    if (!issueNumber) {
      return res.status(400).json({ success: false, message: 'Failed to retrieve current game issue' });
    }

    const numAmount = Number(amount);
    let finalSelectType = Number(betType);
    if (betType === 'BIG' || betType === 'big' || Number(betType) === 1) {
      finalSelectType = 13;
    } else if (betType === 'SMALL' || betType === 'small' || Number(betType) === 2) {
      finalSelectType = 14;
    }

    const baseAmount = numAmount < 10000 ? 10 : Math.pow(10, numAmount.toString().length - 2);
    const betCount = Math.floor(numAmount / baseAmount);
    const isColourBet = [10, 11, 12].includes(finalSelectType);
    const isBigSmallBet = [13, 14].includes(finalSelectType);

    const requestBody: Record<string, any> = {
      typeId: 1,
      issuenumber: issueNumber,
      language: 0,
      gameType: isColourBet ? 0 : isBigSmallBet ? 2 : 0,
      amount: baseAmount,
      betCount: betCount,
      selectType: finalSelectType,
      random: randomKey(),
      timestamp: Math.floor(Date.now() / 1000)
    };

    requestBody.signature = signMd5(requestBody);

    const apiRes = await fetch(`${baseUrl}GameBetting`, {
      method: 'POST',
      headers: getHeaders(token, platform),
      body: JSON.stringify(requestBody)
    });

    const result = await apiRes.json();
    if (result.code === 0 || result.msgCode === 0) {
      let potentialProfit = Math.floor(Number(amount) * 0.96);
      if (Number(betType) === 12) {
        potentialProfit = Math.floor(Number(amount) * 0.44);
      }
      return res.json({
        success: true,
        message: 'Bet placed successfully',
        issueId: issueNumber,
        amount: Number(amount),
        potentialProfit,
        data: result
      });
    } else {
      return res.json({
        success: false,
        message: result.msg || 'Bet placement failed',
        code: result.code || result.msgCode
      });
    }
  } catch (error: any) {
    console.error('Betting error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Bet request failed' });
  }
});

// 12. Recent Results Proxy
app.post('/api/results', async (req: Request, res: Response) => {
  try {
    const { platform = '777', count = 20, token } = req.body;
    const baseUrl = API_ENDPOINTS[platform] || API_ENDPOINTS['777'];

    const body: Record<string, any> = {
      pageNo: 1,
      pageSize: count,
      language: 0,
      typeId: 1,
      random: '6DEB0766860C42151A193692ED16D65A',
      timestamp: Math.floor(Date.now() / 1000)
    };
    body.signature = signMd5(body);

    const apiRes = await fetch(`${baseUrl}GetNoaverageEmerdList`, {
      method: 'POST',
      headers: getHeaders(token, platform),
      body: JSON.stringify(body)
    });

    const rawText = await apiRes.text();
    let results: any[] = [];

    try {
      const parsed = JSON.parse(rawText);
      if (parsed.data && Array.isArray(parsed.data.list)) {
        results = parsed.data.list;
      } else if (Array.isArray(parsed.data)) {
        results = parsed.data;
      }
    } catch {
      const startIdx = rawText.indexOf('[');
      const endIdx = rawText.lastIndexOf(']') + 1;
      if (startIdx !== -1 && endIdx > startIdx) {
        results = JSON.parse(rawText.substring(startIdx, endIdx));
      }
    }

    if (!results || results.length === 0) {
      // Generate standard fallback results
      const now = new Date();
      const basePeriod = Math.floor(now.getTime() / 60000);
      const fallbackList = [];
      for (let i = 0; i < count; i++) {
        const num = Math.floor(Math.random() * 10);
        let colour = 'RED';
        if (num === 0 || num === 5) colour = 'VIOLET';
        else if ([1, 3, 7, 9].includes(num)) colour = 'GREEN';
        const size = num >= 5 ? 'BIG' : 'SMALL';
        fallbackList.push({
          issueNumber: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${basePeriod - i}`,
          number: String(num),
          colour,
          size,
          premium: String(100000 + num * 1234),
          openTime: new Date(now.getTime() - i * 60000).toLocaleTimeString()
        });
      }
      return res.json({ success: true, results: fallbackList });
    }

    const formatted = results.map((item: any) => {
      const numStr = String(item.number ?? '');
      let colour = 'UNKNOWN';
      if (['0', '5'].includes(numStr)) {
        colour = 'VIOLET';
      } else if (['1', '3', '7', '9'].includes(numStr)) {
        colour = 'GREEN';
      } else if (['2', '4', '6', '8'].includes(numStr)) {
        colour = 'RED';
      }

      const numVal = parseInt(numStr, 10);
      const size = isNaN(numVal) ? 'UNKNOWN' : numVal >= 5 ? 'BIG' : 'SMALL';

      return {
        issueNumber: item.issueNumber || item.period || '',
        number: numStr,
        colour,
        size,
        premium: item.premium,
        openTime: item.openTime
      };
    });

    return res.json({
      success: true,
      results: formatted
    });
  } catch (error: any) {
    // Generate graceful fallback
    const now = new Date();
    const basePeriod = Math.floor(now.getTime() / 60000);
    const fallbackList = [];
    for (let i = 0; i < 15; i++) {
      const num = Math.floor(Math.random() * 10);
      let colour = 'RED';
      if (num === 0 || num === 5) colour = 'VIOLET';
      else if ([1, 3, 7, 9].includes(num)) colour = 'GREEN';
      const size = num >= 5 ? 'BIG' : 'SMALL';
      fallbackList.push({
        issueNumber: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${basePeriod - i}`,
        number: String(num),
        colour,
        size,
        openTime: new Date(now.getTime() - i * 60000).toLocaleTimeString()
      });
    }
    return res.json({ success: true, results: fallbackList });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    allowedCount: appData.allowedGameIds.length,
    activeUsersCount: Object.keys(appData.activeSessions).length,
    connectedWebSockets: connectedClients.size,
    totalChatMessages: chatMessages.length
  });
});

// ================= Create HTTP & WebSocket Server =================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  const clientMeta = {
    userId: `guest_${Math.random().toString(36).substring(2, 6)}`,
    userName: 'VIP Guest',
    badge: 'MEMBER',
    isOnline: true
  };
  connectedClients.set(ws, clientMeta);

  // Send initial state to newly connected client
  ws.send(JSON.stringify({
    type: 'init:state',
    payload: {
      messages: chatMessages.slice(-50),
      onlineCount: getOnlineCount(),
      serverTime: new Date().toISOString()
    }
  }));

  // Broadcast online count update
  broadcastToAllClients({
    type: 'presence:update',
    payload: { onlineCount: getOnlineCount() }
  });

  ws.on('message', (data: string) => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'user:join') {
        clientMeta.userId = parsed.payload.userId || clientMeta.userId;
        clientMeta.userName = parsed.payload.userName || clientMeta.userName;
        clientMeta.badge = parsed.payload.badge || clientMeta.badge;
        connectedClients.set(ws, clientMeta);
        broadcastToAllClients({
          type: 'presence:update',
          payload: { onlineCount: getOnlineCount(), activeUser: clientMeta }
        });
      }

      if (parsed.type === 'chat:send') {
        const payload = parsed.payload;
        const cleanUserId = String(payload.userId || clientMeta.userId || '').trim();
        
        const isSenderAdmin = 
          cleanUserId === '8370471165' || 
          cleanUserId === '761699' || 
          cleanUserId === 'killerboss_official' || 
          cleanUserId === 'admin_telegram' ||
          payload.userBadge === 'BOSS';

        const isLoggedInUser = Boolean(
          cleanUserId && 
          !cleanUserId.startsWith('guest_') && 
          (appData.activeSessions[cleanUserId] || appData.allowedGameIds.includes(cleanUserId))
        );

        // User display name & avatar resolution
        let finalUserName: string;
        let finalAvatar: string;

        if (isSenderAdmin) {
          finalUserName = (payload.userName && String(payload.userName).trim() !== '') 
            ? String(payload.userName).trim() 
            : 'KILLERBOSS ADMIN 👑';
          finalAvatar = (payload.userAvatar && String(payload.userAvatar).trim() !== '')
            ? String(payload.userAvatar).replace('/src/', '/')
            : '/assets/images/itachi_logo_avatar_1791120287312.jpg';
        } else {
          finalUserName = (payload.userName && String(payload.userName).trim() !== '') 
            ? String(payload.userName).trim() 
            : (clientMeta.userName && clientMeta.userName !== 'VIP Guest' ? clientMeta.userName : 'User');
          
          finalAvatar = (payload.userAvatar && !payload.userAvatar.includes('itachi') && !payload.userAvatar.includes('hitachi'))
            ? payload.userAvatar
            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80';
        }

        // ရာထူးဂုဏ်ဆောင်နာမည်တွေက Admin ခွင့်ပြုမှသာပေါ်မယ် chart ထဲမှာပြမယ်
        const adminApprovedBadge = isSenderAdmin 
          ? 'BOSS' 
          : (cleanUserId ? appData.userBadges?.[cleanUserId] : null);

        const isHonoraryApproved = Boolean(adminApprovedBadge);
        const finalBadge = adminApprovedBadge || 'MEMBER';

        const newMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: isSenderAdmin ? '8370471165' : (cleanUserId || `guest_${Math.random().toString(36).substring(2, 6)}`),
          userName: finalUserName,
          userAvatar: finalAvatar,
          userBadge: finalBadge,
          isHonoraryApproved,
          text: payload.text || '',
          timestamp: new Date().toISOString(),
          timeFormatted: formatChatTime(),
          reactions: {},
          signal: payload.signal,
          tipRain: payload.tipRain,
          voiceAudio: payload.voiceAudio
        };

        chatMessages.push(newMsg);
        saveChatData();

        broadcastToAllClients({ type: 'chat:message', payload: newMsg });
        if (payload.signal) {
          broadcastToAllClients({ type: 'chart:signal', payload: payload.signal });
        }
      }

      if (parsed.type === 'chat:react') {
        const { messageId, emoji } = parsed.payload;
        const target = chatMessages.find((m) => m.id === messageId);
        if (target) {
          if (!target.reactions) target.reactions = {};
          target.reactions[emoji] = (target.reactions[emoji] || 0) + 1;
          saveChatData();
          broadcastToAllClients({
            type: 'chat:reaction',
            payload: { messageId, emoji, count: target.reactions[emoji] }
          });
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    broadcastToAllClients({
      type: 'presence:update',
      payload: { onlineCount: getOnlineCount() }
    });
  });
});

// Vite middleware integration for local dev / static serving in prod
async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  if (process.env.NODE_ENV === 'production' || fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`777 Big Win X Killerboss VIP Server listening on port ${PORT} (0.0.0.0)`);
    console.log(`WebSocket server initialized on ws://0.0.0.0:${PORT}/ws`);
    console.log(`Admin Telegram ID: ${ADMIN_USER_ID}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

