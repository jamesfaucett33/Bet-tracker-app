import Anthropic from '@anthropic-ai/sdk';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { todayISO } from './format';
import { SCAN_MODEL, SCHEMA, SYSTEM_PROMPT } from './scanSpec';
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

const MAX_EDGE = 1568; // larger images are downscaled by the API anyway

export interface ScannedBet {
  sport: string;
  betType: BetType;
  pick: string;
  odds: number | null;
  stake: number | null;
  /** Profit if it wins, exactly as printed on the slip. */
  toWin?: number | null;
  book: string;
  date: string;
  status: BetStatus;
  legs: ParlayLeg[];
  notes: string;
  game?: GameRef;
  market?: Market;
  /** Leg count printed on the slip ("3 Leg Same Game Parlay"), when known. */
  expectedLegs?: number;
}

export type PickSource = 'camera' | 'library';

/** Shrinks a picked photo to a JPEG (base64) small enough to send and read. */
async function toJpeg(asset: ImagePicker.ImagePickerAsset): Promise<string> {
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

export interface PickedImage {
  /** JPEG, base64 */
  data: string;
  /** A screenshot (website / app), not a camera photo of a paper ticket. */
  screenshot: boolean;
}

/**
 * Screenshots are sharp, flat images of a website or app, which the phone can
 * read for free. Tells them apart from camera photos of paper tickets: iPhone
 * and Android screenshots are PNGs (or named "Screenshot..."), and are shaped
 * like the screen (tall and thin), while camera photos are about 4:3.
 */
export function looksLikeScreenshot(asset: ImagePicker.ImagePickerAsset, source: PickSource): boolean {
  if (source === 'camera') return false;
  const name = (asset.fileName ?? '').toLowerCase();
  const type = (asset.mimeType ?? '').toLowerCase();
  if (type.includes('png') || /\.png$/.test(name) || asset.uri.startsWith('data:image/png')) return true;
  if (/screen ?shot|screen_shot|screen-shot/.test(name)) return true;
  const { width = 0, height = 0 } = asset;
  if (width && height) {
    const ratio = Math.max(width, height) / Math.min(width, height);
    if (ratio >= 1.85) return true; // phone-screen shaped
  }
  return false;
}

/**
 * Opens the camera (one photo) or the photo library (pick as many as you
 * like) and returns each photo as a JPEG (base64), marked when it's a screenshot.
 */
export async function pickSlipImages(source: PickSource): Promise<PickedImage[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to scan a bet slip.');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsMultipleSelection: true,
          selectionLimit: 25,
        });
  if (result.canceled || !result.assets?.length) return [];
  const out: PickedImage[] = [];
  for (const asset of result.assets)
    out.push({ data: await toJpeg(asset), screenshot: looksLikeScreenshot(asset, source) });
  return out;
}

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
  away_team?: string;
  home_team?: string;
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

export class ScanError extends Error {
  constructor(
    message: string,
    /** 'limit' = free AI scans used up; 'auth' / 'unavailable' = cloud problems. */
    public code?: 'limit' | 'auth' | 'unavailable',
  ) {
    super(message);
  }
}

/** Removes spaces, line breaks and quotes that sneak in when pasting a key. */
export const cleanKey = (key: string) => key.replace(/[\s"'`\u200B-\u200D\uFEFF]/g, '');

/**
 * Sends the key in the `x-api-key` header, exactly as the Console's own
 * example does.
 */
function makeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey: null,
    authToken: null,
    defaultHeaders: { 'x-api-key': cleanKey(apiKey) },
    dangerouslyAllowBrowser: true,
  });
}

/** Checks a key with a free request (listing models); returns null if it works. */
export async function testKey(apiKey: string): Promise<string | null> {
  const key = cleanKey(apiKey);
  if (key.startsWith('apikey_'))
    return 'That\'s the key\'s ID, not the key itself. The key starts with "sk-ant-" and is shown only once, right after you tap Create Key — create a new one and tap the copy icon next to it.';
  if (!key.startsWith('sk-ant-'))
    return 'That doesn\'t look like an Anthropic key — it should start with "sk-ant-".';
  try {
    await makeClient(key).models.list({ limit: 1 });
    return null;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      return `Rejected (401): ${e.message}. The key was likely copied incompletely or has been deleted — create a new one and paste it right away.`;
    if (e instanceof Anthropic.PermissionDeniedError) return `No permission (403): ${e.message}`;
    if (e instanceof Anthropic.APIConnectionError)
      return 'Could not reach Anthropic. Check your connection.';
    if (e instanceof Anthropic.APIError) return `Error ${e.status}: ${e.message}`;
    return e instanceof Error ? e.message : 'Unknown error';
  }
}

/** Sends the slip image to Claude and returns the bets it found. */
export async function readBetSlip(apiKey: string, imageBase64: string): Promise<ScannedBet[]> {
  if (!apiKey.trim()) throw new ScanError('Add your Anthropic API key in Settings to scan slips.');

  // The key is the user's own and lives only on their device, so calling the
  // API straight from the app is acceptable here. A version sold to other
  // people must route this call through a server that holds the key instead.
  const client = makeClient(apiKey);

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: SCAN_MODEL,
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
      throw new ScanError(
        `Your API key was rejected (${e.message}). Use Settings → Test Key to check it.`,
      );
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

  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  return parseScanAnswer(text, response.stop_reason ?? '');
}

/** Turns Claude's JSON answer (from either scan path) into draft bets. */
export function parseScanAnswer(text: string, stopReason: string): ScannedBet[] {
  if (stopReason === 'refusal')
    throw new ScanError('That image could not be processed. Try a different photo.');
  if (stopReason === 'max_tokens')
    throw new ScanError('That slip had too much to read at once. Try a tighter photo.');
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
    if (m.kind === 'player' && m.player && m.stat && m.stat in PLAYER_STATS && m.line && m.line > 0)
      return { kind: 'player', player: m.player, stat: m.stat as PlayerStat, line: m.line };
    if (m.kind === 'moneyline' && m.team) return { kind: 'moneyline', team: m.team };
    if (m.kind === 'spread' && m.team && m.line !== null)
      return { kind: 'spread', team: m.team, line: m.line };
    if (m.kind === 'total' && (m.side === 'over' || m.side === 'under') && m.line && m.line > 0)
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
    toWin: b.to_win !== null && b.to_win > 0 ? Math.round(b.to_win * 100) / 100 : null,
    book: b.sportsbook?.trim() ?? '',
    date,
    status,
    legs: (b.legs ?? []).map((l, i) => ({
      id: `scan${Date.now().toString(36)}${i}`,
      pick: l.pick?.trim() ?? '',
      odds: l.odds !== null && isValidAmerican(l.odds) ? l.odds : null,
      market: toMarket(l.market, l.pick ?? ''),
      game:
        l.away_team && l.home_team
          ? { league: b.sport?.trim() || 'Other', away: l.away_team, home: l.home_team }
          : undefined,
    })),
    notes: b.ticket_id ? `Ticket ${b.ticket_id}` : '',
    game:
      b.away_team && b.home_team
        ? { league: b.sport?.trim() || 'Other', away: b.away_team, home: b.home_team }
        : undefined,
    market: b.legs?.length ? undefined : toMarket(b.market, b.pick ?? ''),
  };
}
