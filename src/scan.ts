import Anthropic from '@anthropic-ai/sdk';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { todayISO } from './format';
import { parseMarket } from './markets';
import { decimalToAmerican, isValidAmerican } from './odds';
import {
  BET_TYPES,
  BetStatus,
  BetType,
  GameRef,
  Market,
  ParlayLeg,
  PLAYER_STATS,
  PlayerStat,
} from './types';

/**
 * Bet slip scanning: the user takes/chooses a photo or screenshot of a bet slip,
 * we shrink it, send it to Claude with a JSON schema, and turn the result into
 * draft bets the user reviews before saving.
 */

const MODEL = 'claude-opus-5-5';
const MAX_EDGE = 1568; // larger images are downscaled by the API anyway

export interface ScannedBet {
  sport: string;
  betType: BetType;
  pick: string;
  odds: number | null;
  stake: number | null;
  book: string;
  date: string;
  status: BetStatus;
  legs: ParlayLeg[];
  notes: string;
  game?: GameRef;
  market?: Market;
}

export type PickSource = 'camera' | 'library';

/** Opens the camera or photo library and returns a JPEG (base64) small enough to send. */
export async function pickSlipImage(source: PickSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to scan a bet slip.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  const { width = 0, height = 0 } = asset;
  if (Math.max(width, height) > MAX_EDGE || !width || !height) {
    ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Could not read that image.');
  return saved.base64.replace(/^data:image\/\w+;base64,/, '');
}

const SYSTEM_PROMPT = `You read photos and screenshots of sports betting slips (printed retail tickets, sportsbook app screenshots, bet history pages) and extract each bet on them for a personal bet-tracking app.

How to fill each field:
- sport: the league, using a short common name such as NFL, NBA, MLB, NHL, NCAAF, NCAAB, Soccer, UFC, Tennis, Golf. Infer it from team or player names when the slip only says "Football" or "Basketball" (e.g. Packers at Rams is NFL). Use "Other" if you can't tell.
- bet_type: Parlay for any multi-leg bet, including same game parlays; Teaser for teasers; Spread, Moneyline or Total for single game lines; Prop for player or game props; Future for futures; Other if none fit.
- pick: a short human-readable summary of the bet. For a single bet, the selection with its line (e.g. "Chiefs -3.5 vs Bills"). For a parlay, name the game(s) and leg count (e.g. "3-leg SGP: Packers @ Rams").
- odds: the bet's total American odds as an integer (e.g. -110, 550 for +550). If only decimal or fractional odds are shown, convert them. Use null if no odds are visible.
- stake: the amount wagered in dollars (ticket cost / risk / wager). Null if not visible.
- to_win: the profit if it wins (not including the stake), in dollars. Null if not visible. If only the total payout is shown, subtract the stake.
- sportsbook: the operator's brand name (e.g. Caesars, DraftKings, FanDuel), not the casino or venue. Null if unknown.
- placed_date: the date the bet was placed as YYYY-MM-DD, or the event date if no placement date is shown. Null if no date is visible.
- status: won, lost or push only if the slip clearly shows the bet was settled that way (e.g. "Won", "Paid", "Lost", a green check on every leg); otherwise pending.
- legs: for a parlay or teaser, one entry per leg with the selection (e.g. "Matthew Stafford 250+ passing + rushing yds") and that leg's American odds, or null when the slip doesn't show per-leg odds. Empty for single bets.
- ticket_id: the ticket or bet ID if printed, else null.
- away_team / home_team: full team names of the game when one game is shown (e.g. "Green Bay Packers" at "Los Angeles Rams"); "A at B" or "A @ B" means A is away. Null for multi-game parlays or futures.
- market (on each leg, and on the bet itself for single bets; null on parlays): how the outcome is graded.
  kind "player" for player props with player (full name), stat and line: "250+" means line 250; "over 249.5" means line 250. Stats: passYds, rushYds, recYds, receptions, passRushYds, rushRecYds, passTd, anyTd (anytime TD = line 1), fgMade, points, rebounds, assists, threes, pra.
  kind "moneyline" with team; kind "spread" with team and line (e.g. -3.5); kind "total" with side over/under and line for game totals; kind "other" if none fit. Unused fields are null.

Copy numbers exactly as printed; never invent odds, amounts or dates that aren't on the image. If the image contains no bet slip, return an empty bets list and say what you see in problem.`;

const MARKET_SCHEMA = {
  type: ['object', 'null'],
  additionalProperties: false,
  required: ['kind', 'player', 'stat', 'line', 'team', 'side'],
  properties: {
    kind: { type: 'string', enum: ['player', 'moneyline', 'spread', 'total', 'other'] },
    player: { type: ['string', 'null'] },
    stat: { type: ['string', 'null'], enum: [...Object.keys(PLAYER_STATS), null] },
    line: { type: ['number', 'null'] },
    team: { type: ['string', 'null'] },
    side: { type: ['string', 'null'], enum: ['over', 'under', null] },
  },
} as const;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bets', 'problem'],
  properties: {
    bets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'sport',
          'bet_type',
          'pick',
          'odds',
          'stake',
          'to_win',
          'sportsbook',
          'placed_date',
          'status',
          'legs',
          'ticket_id',
          'away_team',
          'home_team',
          'market',
        ],
        properties: {
          sport: { type: 'string' },
          bet_type: { type: 'string', enum: [...BET_TYPES] },
          pick: { type: 'string' },
          odds: { type: ['integer', 'null'] },
          stake: { type: ['number', 'null'] },
          to_win: { type: ['number', 'null'] },
          sportsbook: { type: ['string', 'null'] },
          placed_date: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['pending', 'won', 'lost', 'push'] },
          legs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['pick', 'odds', 'market'],
              properties: {
                pick: { type: 'string' },
                odds: { type: ['integer', 'null'] },
                market: MARKET_SCHEMA,
              },
            },
          },
          ticket_id: { type: ['string', 'null'] },
          away_team: { type: ['string', 'null'] },
          home_team: { type: ['string', 'null'] },
          market: MARKET_SCHEMA,
        },
      },
    },
    problem: { type: ['string', 'null'] },
  },
} as const;

interface RawMarket {
  kind: string;
  player: string | null;
  stat: string | null;
  line: number | null;
  team: string | null;
  side: string | null;
}
interface RawLeg {
  pick: string;
  odds: number | null;
  market: RawMarket | null;
}
interface RawBet {
  sport: string;
  bet_type: string;
  pick: string;
  odds: number | null;
  stake: number | null;
  to_win: number | null;
  sportsbook: string | null;
  placed_date: string | null;
  status: string;
  legs: RawLeg[];
  ticket_id: string | null;
  away_team: string | null;
  home_team: string | null;
  market: RawMarket | null;
}
interface RawResult {
  bets: RawBet[];
  problem: string | null;
}

export class ScanError extends Error {}

/** Sends the slip image to Claude and returns the bets it found. */
export async function readBetSlip(apiKey: string, imageBase64: string): Promise<ScannedBet[]> {
  if (!apiKey.trim()) throw new ScanError('Add your Anthropic API key in Settings to scan slips.');

  // The key is the user's own and lives only on their device, so calling the
  // API straight from the app is acceptable here. A version sold to other
  // people must route this call through a server that holds the key instead.
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: `Extract the bets from this slip. Today is ${todayISO()}.` },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      throw new ScanError('Your API key was rejected. Check it in Settings.');
    if (e instanceof Anthropic.PermissionDeniedError)
      throw new ScanError('Your API key does not have access to this model.');
    if (e instanceof Anthropic.RateLimitError)
      throw new ScanError('Too many scans at once — wait a moment and try again.');
    if (e instanceof Anthropic.BadRequestError)
      throw new ScanError(`The scan request was rejected: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError)
      throw new ScanError('Could not reach the scanning service. Check your connection.');
    if (e instanceof Anthropic.APIError)
      throw new ScanError(`Scanning failed (error ${e.status}). Try again.`);
    throw e;
  }

  if (response.stop_reason === 'refusal')
    throw new ScanError('That image could not be processed. Try a different photo.');
  if (response.stop_reason === 'max_tokens')
    throw new ScanError('That slip had too much to read at once. Try a tighter photo.');

  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  let raw: RawResult;
  try {
    raw = JSON.parse(text) as RawResult;
  } catch {
    throw new ScanError('Could not understand the scan result. Try again.');
  }
  if (!raw.bets?.length) {
    throw new ScanError(raw.problem || 'No bets were found in that image.');
  }
  return raw.bets.map(normalize);
}

function toMarket(m: RawMarket | null | undefined, fallbackText: string): Market | undefined {
  if (m) {
    if (m.kind === 'player' && m.player && m.stat && m.stat in PLAYER_STATS && m.line !== null)
      return { kind: 'player', player: m.player, stat: m.stat as PlayerStat, line: m.line };
    if (m.kind === 'moneyline' && m.team) return { kind: 'moneyline', team: m.team };
    if (m.kind === 'spread' && m.team && m.line !== null)
      return { kind: 'spread', team: m.team, line: m.line };
    if (m.kind === 'total' && (m.side === 'over' || m.side === 'under') && m.line !== null)
      return { kind: 'total', side: m.side, line: m.line };
  }
  return parseMarket(fallbackText);
}

function normalize(b: RawBet): ScannedBet {
  let odds = b.odds !== null && isValidAmerican(b.odds) ? b.odds : null;
  // Derive odds from stake and to-win when the slip doesn't print them.
  if (odds === null && b.stake && b.to_win && b.stake > 0 && b.to_win > 0) {
    const derived = decimalToAmerican(1 + b.to_win / b.stake);
    if (isValidAmerican(derived)) odds = derived;
  }
  const betType = (BET_TYPES as readonly string[]).includes(b.bet_type)
    ? (b.bet_type as BetType)
    : 'Other';
  const status: BetStatus = ['pending', 'won', 'lost', 'push'].includes(b.status)
    ? (b.status as BetStatus)
    : 'pending';
  const date =
    b.placed_date && /^\d{4}-\d{2}-\d{2}$/.test(b.placed_date) ? b.placed_date : todayISO();
  return {
    sport: b.sport?.trim() || 'Other',
    betType,
    pick: b.pick?.trim() ?? '',
    odds,
    stake: b.stake !== null && b.stake > 0 ? Math.round(b.stake * 100) / 100 : null,
    book: b.sportsbook?.trim() ?? '',
    date,
    status,
    legs: (b.legs ?? []).map((l, i) => ({
      id: `scan${Date.now().toString(36)}${i}`,
      pick: l.pick?.trim() ?? '',
      odds: l.odds !== null && isValidAmerican(l.odds) ? l.odds : null,
      market: toMarket(l.market, l.pick ?? ''),
    })),
    notes: b.ticket_id ? `Ticket ${b.ticket_id}` : '',
    game:
      b.away_team && b.home_team
        ? { league: b.sport?.trim() || 'Other', away: b.away_team, home: b.home_team }
        : undefined,
    market: b.legs?.length ? undefined : toMarket(b.market, b.pick ?? ''),
  };
}
