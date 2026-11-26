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

/** Stats a player prop can be graded on. "+" lines mean at least `line`. */
export const PLAYER_STATS = {
  passYds: 'Passing yds',
  rushYds: 'Rushing yds',
  recYds: 'Receiving yds',
  receptions: 'Receptions',
  passRushYds: 'Pass + rush yds',
  rushRecYds: 'Rush + rec yds',
  passTd: 'Passing TDs',
  anyTd: 'Touchdowns',
  fgMade: 'Field goals',
  points: 'Points',
  rebounds: 'Rebounds',
  assists: 'Assists',
  threes: '3-pointers',
  pra: 'Pts + reb + ast',
  passCompletions: 'Passing completions',
  passAttempts: 'Passing attempts',
  rushAttempts: 'Rushing attempts',
  interceptions: 'Interceptions thrown',
  steals: 'Steals',
  blocks: 'Blocks',
  sacks: 'Sacks',
  tackles: 'Tackles + assists',
  soloTackles: 'Solo tackles',
  kickingPoints: 'Kicking points',
  ptsReb: 'Pts + reb',
  ptsAst: 'Pts + ast',
  rebAst: 'Reb + ast',
  stealsBlocks: 'Steals + blocks',
  turnovers: 'Turnovers',
  goals: 'Goals',
  shotsOnGoal: 'Shots on goal',
  saves: 'Saves',
  blockedShots: 'Blocked shots',
} as const;
export type PlayerStat = keyof typeof PLAYER_STATS;

/** What a leg (or a single bet) needs to happen, in a form live stats can grade. */
export type Market =
  /**
   * Player prop. Over: hits at `line` or more. Under (`under: true`): hits when
   * the final number stays below `line` ("Under 249.5" is stored as line 250).
   */
  | {
      kind: 'player';
      player: string;
      stat: PlayerStat;
      line: number;
      under?: boolean;
      /** Whole-number lines ("Over 250"): landing exactly on it is a push. */
      pushAt?: number;
    }
  | { kind: 'moneyline'; team: string }
  | { kind: 'spread'; team: string; line: number }
  /** Game total, or one team's points when `team` is set (team total). */
  | { kind: 'total'; side: 'over' | 'under'; line: number; team?: string }
  /** A leg you voided: it no longer counts (like a push). */
  | { kind: 'void' };

/** The game a bet is on, used to find live scores. */
export interface GameRef {
  league: string; // NFL, NBA, ...
  away: string; // team names as printed, e.g. "Green Bay Packers"
  home: string;
  eventId?: string; // ESPN event id once matched
}

export interface ParlayLeg {
  id: string;
  pick: string;
  odds: number | null; // American odds; null when the slip doesn't show per-leg odds
  market?: Market;
  /** The game this leg is on (multi-game parlays). */
  game?: GameRef;
  /** How the leg finished, from the final stats (kept after the ticket is dead). */
  result?: LegResult;
  /** You marked it void (e.g. the player was inactive): dropped from the ticket. */
  voided?: boolean;
}

/** void = couldn't be graded (e.g. the player didn't play); push = landed exactly on the line. */
export type LegResult = 'hit' | 'miss' | 'push' | 'void';

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
  /** For single bets: what has to happen. Parlays keep this on each leg. */
  market?: Market;
  game?: GameRef;
  /** The sportsbook's own ticket tracker page (from the slip's QR code). */
  trackerUrl?: string;
  /** Last change (ms), used to merge with cloud sync: newest edit wins. */
  updatedAt?: number;
  /** When the ticket was decided (won/lost/push), ms since epoch. */
  settledAt?: number;
  /**
   * Exact profit if it wins, as printed on the ticket. Books price parlays from
   * unrounded leg odds, so this can differ by cents from the American odds.
   */
  toWin?: number;
  /** 'auto' when the app settled it from the game's final stats. */
  settledBy?: 'auto';
}

export interface Settings {
  startingBankroll: number;
  unitSize: number;
  showUnits: boolean;
  books: string[];
  sports: string[];
  /** The user's own Anthropic API key for bet slip scanning. Never exported. */
  anthropicApiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  startingBankroll: 0,
  unitSize: 10,
  showUnits: false,
  books: ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'ESPN Bet', 'Fanatics'],
  sports: DEFAULT_SPORTS,
  anthropicApiKey: '',
};
