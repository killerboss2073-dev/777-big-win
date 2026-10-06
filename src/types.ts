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
