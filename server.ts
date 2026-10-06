import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

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

// URL Normalizer: Supports both /api/login and /login if rewritten on serverless hosts
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.includes('.')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '8682945050:AAFECoNO45TTYl8tFPXMkpWc287dlypdrJ8';
const ADMIN_USER_ID = '8370471165';
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Persistence File (use /tmp on serverless environments like Vercel)
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'bot_data.json')
  : path.join(__dirname, 'bot_data.json');

// Memory Data Store
interface UserSessionRecord {
  phone: string;
  gameId: string;
  token: string;
  balance: number;
  platform: string;
  loginTime: string;
  lastActive: string;
  isOnline: boolean;
}

interface DeniedAttemptRecord {
  phone: string;
  gameId: string;
  platform: string;
  attemptTime: string;
  attemptsCount: number;
}

interface AppData {
  allowedGameIds: string[];
  activeSessions: Record<string, UserSessionRecord>;
  deniedAttempts: Record<string, DeniedAttemptRecord>;
}

// Initial Data
let appData: AppData = {
  allowedGameIds: ['864480', '102310', '761699', '8370471165'],
  activeSessions: {},
  deniedAttempts: {}
};

// Load saved data if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    appData = {
      allowedGameIds: parsed.allowedGameIds || ['864480', '102310', '761699', '8370471165'],
      activeSessions: parsed.activeSessions || {},
      deniedAttempts: parsed.deniedAttempts || {}
    };
  }
} catch (e) {
  console.error('Error loading bot_data.json:', e);
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving bot_data.json:', e);
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

        // Check if message is from Admin
        if (chatId === ADMIN_USER_ID || String(msg.from?.id) === ADMIN_USER_ID) {
          await handleAdminTelegramCommand(chatId, text);
        } else {
          // Normal user start message
          if (text.startsWith('/start')) {
            await sendTelegramMessage(
              chatId,
              `Welcome to KillerBoss 777 Lottery Bot!`
            );
          }
        }
      }
    }
  } catch (err) {
    // Ignore polling network errors
  }
}

// Periodically poll telegram updates (when running as persistent Node process)
if (!process.env.VERCEL) {
  setInterval(pollTelegramUpdates, 4000);
}

async function handleAdminTelegramCommand(chatId: string, text: string) {
  // 1. Add Game IDs: /aid 761699,864480
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

  // 2. Remove Game ID: /rid 761699
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

  // 3. List Allowed Game IDs: /ids
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

  // 4. List Logged in / Active users & Denied users: /users or /stats
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

  // 5. Broadcast to all active users: /broadcast <message>
  if (text.startsWith('/broadcast')) {
    const msg = text.replace('/broadcast', '').trim();
    if (!msg) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/broadcast Your message here</code>');
      return;
    }
    await sendTelegramMessage(chatId, `📢 Broadcast message queued:\n\n${msg}`);
    return;
  }

  // 6. Help
  if (text.startsWith('/help') || text.startsWith('/start')) {
    await sendTelegramMessage(
      chatId,
      `👑 <b>Admin Control Menu - KillerBoss Bot</b>\n\n` +
      `<b>Commands:</b>\n` +
      `• <code>/aid &lt;id1,id2&gt;</code> - Add Allowed Game IDs\n` +
      `• <code>/rid &lt;id&gt;</code> - Remove Game ID\n` +
      `• <code>/ids</code> - List All Allowed Game IDs\n` +
      `• <code>/users</code> - View Logged-in & Denied Users\n` +
      `• <code>/broadcast &lt;msg&gt;</code> - Broadcast Message`
    );
  }
}

// API Endpoints from 777 bot
const API_ENDPOINTS: Record<string, string> = {
  '777': 'https://api.bigwinqaz.com/api/webapi/',
  '6lottery': 'https://api.6lottery.net/api/webapi/'
};

// Signature generator matching exactly the Python/Node bot implementation
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

// 1. Login Proxy with Game ID Permission Verification
app.post('/api/login', async (req: Request, res: Response) => {
  try {
    const { phone, password, platform = '777' } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required' });
    }

    const cleanPhone = String(phone).trim().replace(/^(\+?95|0)/, '');
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

      // Fetch User Info to check real Game ID
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

      // 🔴 CHECK: Game ID Restriction Check
      const isAllowed = appData.allowedGameIds.map((id) => String(id).trim()).includes(String(userGameId).trim());

      if (!isAllowed) {
        // Record denied attempt
        const existing = appData.deniedAttempts[userGameId] || {
          phone: cleanPhone,
          gameId: userGameId,
          platform,
          attemptTime: getMyanmarTime(),
          attemptsCount: 0
        };
        existing.attemptsCount += 1;
        existing.attemptTime = getMyanmarTime();
        appData.deniedAttempts[userGameId] = existing;
        saveData();

        // 🚨 Send Telegram Alert to Admin
        const alertMsg =
          `🚨 <b>Access Denied (Unauthorized Login)</b>\n\n` +
          `📱 <b>Phone:</b> <code>95${cleanPhone}</code>\n` +
          `🆔 <b>Game ID:</b> <code>${userGameId}</code>\n` +
          `⏰ <b>Time:</b> ${getMyanmarTime()}\n` +
          `⚠️ <b>Status:</b> NOT ALLOWED\n\n` +
          `👉 <i>To approve this Game ID, tap / copy:</i>\n` +
          `<code>/aid ${userGameId}</code>`;

        sendTelegramMessage(ADMIN_USER_ID, alertMsg);

        return res.json({
          success: false,
          accessDenied: true,
          gameId: userGameId,
          message: 'Your Game ID is not allowed to use this bot. Please contact the admin to get access.'
        });
      }

      // ✅ Fetch Balance
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

      // Record active logged-in session
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

      // Remove from denied if was previously denied
      delete appData.deniedAttempts[userGameId];
      saveData();

      // Notify Admin on success login
      const notifyMsg =
        `✅ <b>User Logged In Successfully</b>\n\n` +
        `📱 <b>Phone:</b> <code>95${cleanPhone}</code>\n` +
        `🆔 <b>Game ID:</b> <code>${userGameId}</code>\n` +
        `💰 <b>Balance:</b> ${userBalance.toLocaleString()} K\n` +
        `⏰ <b>Time:</b> ${getMyanmarTime()}`;
      sendTelegramMessage(ADMIN_USER_ID, notifyMsg);

      return res.json({
        success: true,
        message: 'Login successful',
        token: fullToken,
        gameId: userGameId,
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

// 2. Admin APIs for Web UI
app.get('/api/admin/data', (_req: Request, res: Response) => {
  res.json({
    success: true,
    adminId: ADMIN_USER_ID,
    botToken: TELEGRAM_BOT_TOKEN,
    allowedGameIds: appData.allowedGameIds,
    activeSessions: Object.values(appData.activeSessions),
    deniedAttempts: Object.values(appData.deniedAttempts)
  });
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
      // Remove from denied attempts if present
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

// Session Status Check (Instant kick out if /rid removed)
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

// Current Game Issue Proxy
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
      return res.json({
        success: false,
        message: result.msg || 'Failed to fetch issue'
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Issue request failed' });
  }
});

// Balance Proxy
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

// User Info Proxy
app.post('/api/user-info', async (req: Request, res: Response) => {
  try {
    const { token, platform = '777' } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
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

// Betting Proxy
app.post('/api/bet', async (req: Request, res: Response) => {
  try {
    const { token, platform = '777', amount, betType, issueId: providedIssue, gameId } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    // Verify game ID is still allowed
    if (gameId && !appData.allowedGameIds.map((id) => String(id).trim()).includes(String(gameId).trim())) {
      return res.status(403).json({
        success: false,
        accessDenied: true,
        message: 'Your Game ID is not authorized to place bets.'
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
    const baseAmount = numAmount < 10000 ? 10 : Math.pow(10, numAmount.toString().length - 2);
    const betCount = Math.floor(numAmount / baseAmount);
    const isColourBet = [10, 11, 12].includes(Number(betType));

    const requestBody: Record<string, any> = {
      typeId: 1,
      issuenumber: issueNumber,
      language: 0,
      gameType: isColourBet ? 0 : 2,
      amount: baseAmount,
      betCount: betCount,
      selectType: Number(betType),
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

// Recent Results Proxy
app.post('/api/results', async (req: Request, res: Response) => {
  try {
    const { platform = '777', count = 15, token } = req.body;
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
    return res.status(500).json({ success: false, message: error?.message || 'Results request failed' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    allowedCount: appData.allowedGameIds.length,
    activeUsersCount: Object.keys(appData.activeSessions).length
  });
});

// Vite middleware integration for local dev / static serving in prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`KillerBoss Server listening on port ${PORT}`);
    console.log(`Admin Telegram ID: ${ADMIN_USER_ID}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
