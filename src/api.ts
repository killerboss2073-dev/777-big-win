import { GameResult, Platform, ChatMessage, ChatSignal, TipRain } from './types';

async function safeJson(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: `Server error (${res.status}): ${text.slice(0, 100)}` };
  }
}

// API Client for the Express proxy
export async function apiLogin(phone: string, password: string, platform: Platform = '777') {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, platform })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error connecting to proxy' };
  }
}

export async function apiGetIssue(platform: Platform = '777', token?: string, gameId?: string) {
  try {
    const res = await fetch('/api/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, token, gameId })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

export async function apiGetBalance(token: string, platform: Platform = '777', gameId?: string) {
  try {
    const res = await fetch('/api/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform, gameId })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

export async function apiCheckSession(gameId: string) {
  try {
    const res = await fetch('/api/session-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

export async function apiGetUserInfo(token: string, platform: Platform = '777') {
  try {
    const res = await fetch('/api/user-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

export async function apiPlaceBet(
  token: string,
  amount: number,
  betType: number,
  issueId: string,
  platform: Platform = '777',
  gameId?: string
) {
  try {
    const res = await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, amount, betType, issueId, platform, gameId })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

export async function apiGetResults(platform: Platform = '777', count = 20, token?: string): Promise<{ success: boolean; results?: GameResult[]; message?: string }> {
  try {
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, count, token })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

// Chat API Endpoints
export async function apiGetChatHistory(): Promise<{ success: boolean; messages: ChatMessage[]; onlineUsersCount: number }> {
  try {
    const res = await fetch('/api/chat/history');
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, messages: [], onlineUsersCount: 1 };
  }
}

export async function apiSendChatMessage(payload: {
  userId: string;
  userName: string;
  userAvatar: string;
  userBadge: string;
  text?: string;
  signal?: ChatSignal;
  tipRain?: TipRain;
  voiceAudio?: { duration: number; label: string };
}) {
  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error sending message' };
  }
}

export async function apiReactToMessage(messageId: string, emoji: string) {
  try {
    const res = await fetch('/api/chat/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, emoji })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error reacting' };
  }
}

export async function apiClaimTipRain(messageId: string, userId: string, userName: string) {
  try {
    const res = await fetch('/api/chat/claim-tip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, userId, userName })
    });
    return await safeJson(res);
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error claiming tip' };
  }
}

// Sound FX Audio synthesis helper
export function playSoundEffect(type: 'win' | 'bet' | 'chat' | 'click' | 'claim' | 'voice') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === 'chat') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'win' || type === 'claim') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } else if (type === 'bet') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (e) {
    // ignore audio block
  }
}

// Generate realistic simulated issues & results if offline or testing
export function generateFallbackResults(count = 10): GameResult[] {
  const list: GameResult[] = [];
  const now = new Date();
  const basePeriod = Math.floor(now.getTime() / 60000);

  for (let i = 0; i < count; i++) {
    const num = Math.floor(Math.random() * 10);
    const numStr = num.toString();
    let colour: 'RED' | 'GREEN' | 'VIOLET' = 'RED';
    if (num === 0 || num === 5) colour = 'VIOLET';
    else if ([1, 3, 7, 9].includes(num)) colour = 'GREEN';
    else colour = 'RED';

    const size = num >= 5 ? 'BIG' : 'SMALL';
    const periodStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${basePeriod - i}`;

    list.push({
      issueNumber: periodStr,
      number: numStr,
      colour,
      size,
      openTime: new Date(now.getTime() - i * 60000).toLocaleTimeString()
    });
  }

  return list;
}

