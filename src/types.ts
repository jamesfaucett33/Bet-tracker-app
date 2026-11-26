export type BetStatus = 'pending' | 'won' | 'lost' | 'push';

export const BET_TYPES = [
  'Spread',
  'Moneyline',
  'Total',
  'Prop',
  'Parlay',
  'Teaser',
  'Future',
  'Other',
] as const;
export type BetType = (typeof BET_TYPES)[number];

export const DEFAULT_SPORTS = [
  'NFL',
  'NBA',
  'MLB',
  'NHL',
  'NCAAF',
  'NCAAB',
  'Soccer',
  'UFC',
  'Tennis',
  'Golf',
  'Other',
];

export interface ParlayLeg {
  id: string;
  pick: string;
  odds: number; // American odds
}

export interface Bet {
  id: string;
  createdAt: number;
  date: string; // YYYY-MM-DD
  sport: string;
  betType: BetType;
  pick: string;
  odds: number; // American odds, e.g. -110 or +150
  stake: number; // dollars
  book: string;
  status: BetStatus;
  notes?: string;
  legs?: ParlayLeg[];
}

export interface Settings {
  startingBankroll: number;
  unitSize: number;
  showUnits: boolean;
  books: string[];
  sports: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  startingBankroll: 0,
  unitSize: 10,
  showUnits: false,
  books: ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'ESPN Bet', 'Fanatics'],
  sports: DEFAULT_SPORTS,
};
