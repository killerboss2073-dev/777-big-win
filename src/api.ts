import { GameResult, Platform } from './types';

// API Client for the Express proxy
export async function apiLogin(phone: string, password: string, platform: Platform = '777') {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, platform })
    });
    return await res.json();
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
    return await res.json();
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
    return await res.json();
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
    return await res.json();
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
    return await res.json();
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
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
  }
}

export async function apiGetResults(platform: Platform = '777', count = 15, token?: string): Promise<{ success: boolean; results?: GameResult[]; message?: string }> {
  try {
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, count, token })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network error' };
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
