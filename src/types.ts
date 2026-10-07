export type Platform = '777' | '6lottery';

export type BetMode = 
  | 'big' 
  | 'small' 
  | 'bot' 
  | 'follow' 
  | 'bs_formula' 
  | 'colour_formula' 
  | 'sl_layer';

export interface GameResult {
  issueNumber: string;
  number: string;
  colour: 'RED' | 'GREEN' | 'VIOLET' | 'UNKNOWN';
  size: 'BIG' | 'SMALL' | 'UNKNOWN';
  openTime?: string;
  premium?: string;
}

export interface BetRecord {
  id: string;
  issue: string;
  betType: string;
  amount: number;
  result: 'WIN' | 'LOSE' | 'PENDING' | 'WAIT';
  profitLoss: number;
  createdAt: string;
  platform: Platform;
  isWaitMode?: boolean;
}

export interface UserSession {
  isLoggedIn: boolean;
  phone: string;
  token: string;
  userId: string;
  gameId?: string;
  chartId?: string;
  isAdmin?: boolean;
  displayName?: string;
  avatar?: string;
  badge?: 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER' | 'BOT';
  balance: number;
  platform: Platform;
}

export interface BotSettings {
  mode: BetMode;
  betSequence: number[];
  currentBetIndex: number;
  bsPattern: string;
  bsIndex: number;
  colourPattern: string;
  colourIndex: number;
  slPattern: string;
  currentSl: number;
  slIndex: number;
  waitLossCount: number;
  slBetCount: number;
  isWaitMode: boolean;
  profitTarget: number;
  lossTarget: number;
  isRunning: boolean;
}

export interface BotStats {
  sessionProfit: number;
  sessionLoss: number;
  totalProfit: number;
  totalBets: number;
  wins: number;
  losses: number;
}

export interface ChatSignal {
  issue: string;
  prediction: 'BIG' | 'SMALL' | 'RED' | 'GREEN' | 'VIOLET';
  confidence: number;
  recommendedAmount?: number;
  status?: 'PENDING' | 'WIN' | 'LOSE';
}

export interface TipRain {
  id: string;
  amount: number;
  totalWinners: number;
  claimedBy: string[];
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
  reactions: Record<string, number>;
  isBot?: boolean;
  isHonoraryApproved?: boolean;
  signal?: ChatSignal;
  tipRain?: TipRain;
  voiceAudio?: {
    duration: number;
    label: string;
  };
}

export interface UserAppSettings {
  language: 'my' | 'en';
  soundEnabled: boolean;
  chatSound: boolean;
  winSound: boolean;
  voiceAnnounce: boolean;
  defaultAmount: number;
  chartOverlayChat: boolean;
  theme: 'neon-dark' | 'gold-luxury' | 'cyber-red';
  customAvatar: string;
  customName: string;
  userBadge: 'BOSS' | 'VIP' | 'MASTER' | 'MEMBER';
}
