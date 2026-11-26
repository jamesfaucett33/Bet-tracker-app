import { todayISO } from './format';
import { parseMarket } from './markets';
import { decimalToAmerican, isValidAmerican } from './odds';
import type { ScannedBet } from './scan';
import { BetType, GameRef, ParlayLeg } from './types';

/**
 * Turns rough on-device OCR text of a bet slip into a draft bet. OCR on
 * photos is noisy, so this leans on the parts printed reliably (ticket cost,
 * max win, team names, "250+" style lines) and leaves the rest for the user
 * to check. Used when no AI key is set up.
 */

const NFL: [string, string][] = [
  ['Cardinals', 'Arizona Cardinals'],
  ['Falcons', 'Atlanta Falcons'],
  ['Ravens', 'Baltimore Ravens'],
  ['Bills', 'Buffalo Bills'],
  ['Panthers', 'Carolina Panthers'],
  ['Bears', 'Chicago Bears'],
  ['Bengals', 'Cincinnati Bengals'],
  ['Browns', 'Cleveland Browns'],
  ['Cowboys', 'Dallas Cowboys'],
  ['Broncos', 'Denver Broncos'],
  ['Lions', 'Detroit Lions'],
  ['Packers', 'Green Bay Packers'],
  ['Texans', 'Houston Texans'],
  ['Colts', 'Indianapolis Colts'],
  ['Jaguars', 'Jacksonville Jaguars'],
  ['Chiefs', 'Kansas City Chiefs'],
  ['Raiders', 'Las Vegas Raiders'],
  ['Chargers', 'Los Angeles Chargers'],
  ['Rams', 'Los Angeles Rams'],
  ['Dolphins', 'Miami Dolphins'],
  ['Vikings', 'Minnesota Vikings'],
  ['Patriots', 'New England Patriots'],
  ['Saints', 'New Orleans Saints'],
  ['Giants', 'New York Giants'],
  ['Jets', 'New York Jets'],
  ['Eagles', 'Philadelphia Eagles'],
  ['Steelers', 'Pittsburgh Steelers'],
  ['49ers', 'San Francisco 49ers'],
  ['Seahawks', 'Seattle Seahawks'],
  ['Buccaneers', 'Tampa Bay Buccaneers'],
  ['Titans', 'Tennessee Titans'],
  ['Commanders', 'Washington Commanders'],
];
const NBA: [string, string][] = [
  ['Hawks', 'Atlanta Hawks'],
  ['Celtics', 'Boston Celtics'],
  ['Nets', 'Brooklyn Nets'],
  ['Hornets', 'Charlotte Hornets'],
  ['Bulls', 'Chicago Bulls'],
  ['Cavaliers', 'Cleveland Cavaliers'],
  ['Mavericks', 'Dallas Mavericks'],
  ['Nuggets', 'Denver Nuggets'],
  ['Pistons', 'Detroit Pistons'],
  ['Warriors', 'Golden State Warriors'],
  ['Rockets', 'Houston Rockets'],
  ['Pacers', 'Indiana Pacers'],
  ['Clippers', 'LA Clippers'],
  ['Lakers', 'Los Angeles Lakers'],
  ['Grizzlies', 'Memphis Grizzlies'],
  ['Heat', 'Miami Heat'],
  ['Bucks', 'Milwaukee Bucks'],
  ['Timberwolves', 'Minnesota Timberwolves'],
  ['Pelicans', 'New Orleans Pelicans'],
  ['Knicks', 'New York Knicks'],
  ['Thunder', 'Oklahoma City Thunder'],
  ['Magic', 'Orlando Magic'],
  ['76ers', 'Philadelphia 76ers'],
  ['Suns', 'Phoenix Suns'],
  ['Trail Blazers', 'Portland Trail Blazers'],
  ['Kings', 'Sacramento Kings'],
  ['Spurs', 'San Antonio Spurs'],
  ['Raptors', 'Toronto Raptors'],
  ['Jazz', 'Utah Jazz'],
  ['Wizards', 'Washington Wizards'],
];

const BOOKS: [RegExp, string][] = [
  [/caesars|c\s*a\s*e\s*s\s*a\s*r|track\s*bets\s*live|spokane\s*tribe/i, 'Caesars'],
  [/draft\s*kings/i, 'DraftKings'],
  [/fan\s*duel/i, 'FanDuel'],
  [/bet\s*mgm/i, 'BetMGM'],
  [/espn\s*bet/i, 'ESPN Bet'],
  [/fanatics/i, 'Fanatics'],
  [/bet365/i, 'bet365'],
  [/hard\s*rock/i, 'Hard Rock Bet'],
  [/bet\s*rivers/i, 'BetRivers'],
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const money = (s: string) => Number(s.replace(/[,\s]/g, ''));

/** Common OCR slips in stat words ("Recejving" -> "Receiving"). */
function fixWords(s: string): string {
  return s
    .replace(/\bre[cс][a-z]{0,3}[iíj1l]?v[a-z]{0,2}ng\b/gi, 'Receiving')
    .replace(/\bru[s5]h[a-z]{0,3}ng\b/gi, 'Rushing')
    .replace(/\bpa[s5]{1,2}[a-z]{0,3}ng\b/gi, 'Passing')
    .replace(/\by[a-z]rds?\b/gi, 'Yards')
    .replace(/\brecep[a-z]{0,4}ns?\b/gi, 'Receptions')
    // "hed Goals", "Fieid Goals", "eld Goals" -> "Field Goals"
    .replace(/\b[a-z]{0,2}[il1]?e?[il1]?[a-z]?d\s+goals?\b/gi, 'Field Goals')
    .replace(/\bmo[a-z]{1,3}y\s*l[il1]n[e€]\b|\bmoneyline\b/gi, 'Money Line');
}

/** Drops OCR junk before the first capitalized word and after the last stat word. */
function cleanDescription(line: string): string {
  const words = fixWords(
    line
      // junk glued between words: "Stafford¥Passing", "Golden S'Receptions"
      .replace(/([a-z])[^A-Za-z0-9\s+]+(?=[A-Z])/g, '$1 ')
      .replace(/\b[A-Z]'(?=[A-Z])/g, ''),
  )
    .split(/\s+/)
    // tokens with no letters ("=", "|", "£4") aren't words
    .filter((w) => /[A-Za-z]/.test(w) || /^\+$/.test(w) || /^\d+(\.\d)?\+?$/.test(w));
  while (words.length && !/^[A-Z][a-zA-Z'.]+$/.test(words[0])) words.shift();
  let text = words.join(' ');
  const end =
    /^(.*\b(?:Yards|Receptions|Goals|Points|Rebounds|Assists|Touchdowns?|TDs?|Line|Hits|Strikeouts|Saves|Shots|Completions|Attempts|Interceptions))\b/i.exec(
      text,
    );
  if (end) text = end[1];
  return (
    text
      .replace(/\s*[|]\s*/g, ' ')
      // keep "+" only between stat words ("Passing + Rushing"), drop OCR strays
      .replace(/\s\+\s(?!(?:Rushing|Receiving|Rebounds|Assists|Reb|Ast)\b)/gi, ' ')
      .trim()
  );
}

function findTeams(text: string): { league: string; away: string; home: string } | null {
  for (const [league, list] of [
    ['NFL', NFL],
    ['NBA', NBA],
  ] as const) {
    const found = list
      .map(([nick, full]) => ({ full, idx: text.search(new RegExp(`\\b${nick}\\b`)) }))
      .filter((t) => t.idx >= 0)
      .sort((a, b) => a.idx - b.idx);
    if (found.length >= 2) {
      // "Away at Home": the first-listed team is the visitor.
      return { league, away: found[0].full, home: found[1].full };
    }
  }
  return null;
}

function parseDate(rawText: string): string | null {
  // "202¢" / "202c": a smudged last digit of this decade's year
  const year = String(new Date().getFullYear());
  const text = rawText.replace(/\b(20\d)[^\d\s|]/g, (m, p) => (year.startsWith(p) ? year : m));
  const m =
    /(?:issued|placed|date)\W{0,3}\s*([A-Z][a-z]{2})\w*\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(text) ??
    /\b([A-Z][a-z]{2})\w*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/.exec(text);
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mo >= 0) return `${m[3]}-${`${mo + 1}`.padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  const us = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(text);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return null;
}

function parseLegs(lines: string[]): ParlayLeg[] {
  // Legs sit between the event line and the "voided"/"Ticket Cost" footer.
  let start = lines.findIndex((l) => /event\s*time|\bat\b.*\b(?:[A-Z][a-z]+)\b/i.test(l));
  start = start < 0 ? 0 : start + 1;
  if (/event\s*time/i.test(lines[start] ?? '')) start++;
  let end = lines.findIndex(
    (l, i) => i >= start && /legs are|voided|ticket\s*cost|max\s*win|total\s*wager/i.test(l),
  );
  if (end < 0) end = lines.length;
  const region = lines.slice(start, end);

  const legs: ParlayLeg[] = [];
  let pendingLine: number | null = null;
  for (let i = 0; i < region.length; i++) {
    const raw = region[i];
    // "250+" (OCR sometimes drops the "+" on a line holding only the number)
    // "250+"; OCR can drop the "+" or turn it into "-4" / "4" ("60-4")
    const threshold =
      /(?:^|\s)(\d{1,3}(?:\.\d)?)\s*\+(?:\s|$)/.exec(raw) ??
      /^\W*(\d{1,3}(?:\.\d)?)\s*(?:-\s*4|-|\+)?\W*$/.exec(raw);
    const words = cleanDescription(raw);
    const hasStat = /Yards|Receptions|Goals|Points|Rebounds|Assists|Touchdown|TD/i.test(words);
    if (threshold && !hasStat) {
      pendingLine = Number(threshold[1]);
      continue;
    }
    if (/^Money Line$/i.test(words) && legs.length) {
      continue; // handled when the team line was read
    }
    if (/Money Line/i.test(fixWords(region[i + 1] ?? '')) && words.split(' ').length >= 2) {
      legs.push(leg(`${words} ML`, legs.length));
      pendingLine = null;
      continue;
    }
    if (hasStat && words.split(' ').length >= 3) {
      const inline = threshold ? Number(threshold[1]) : pendingLine;
      const text = inline !== null ? `${words.replace(/\s+-\s+/, ' ')} ${inline}+` : words;
      legs.push(leg(text, legs.length));
      pendingLine = null;
    }
  }
  return legs;
}

function leg(text: string, i: number): ParlayLeg {
  let market = parseMarket(text);
  // "0+" or a name with no real words is a misread, not a leg.
  if (market?.kind === 'player') {
    const words = market.player.split(' ');
    const nameOk = words.length >= 2 && words.every((w) => /^[A-Z][A-Za-z'.-]+$/.test(w));
    if (market.line <= 0 || !nameOk) market = undefined;
  }
  return { id: `ocr${Date.now().toString(36)}${i}`, pick: text, odds: null, market };
}

export function parseSlipText(raw: string, qrUrl?: string | null): ScannedBet {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const text = lines.join('\n');

  const stakeM =
    /(?:ticket\s*cost|wager|risk|stake|bet\s*amount)\W{0,3}\s*\$?\s*([\d,]+\.\d{2})/i.exec(text) ??
    /bet\s*@\s*\$\s*([\d,]+\.\d{2})/i.exec(text);
  const winM =
    /(?:max\s*win|to\s*win|potential\s*win(?:nings)?)\W{0,3}\s*\$?\s*([\d,]+\.\d{2})/i.exec(text);
  const payM = /(?:payout|to\s*return|potential\s*payout)\W{0,3}\s*\$?\s*([\d,]+\.\d{2})/i.exec(
    text,
  );
  const stake = stakeM ? money(stakeM[1]) : null;
  let toWin = winM ? money(winM[1]) : null;
  if (toWin === null && payM && stake) toWin = money(payM[1]) - stake;

  // Odds: computed from cost and win when both are printed (exact), else the printed odds.
  let odds: number | null = null;
  if (stake && toWin && stake > 0 && toWin > 0) {
    const derived = decimalToAmerican(1 + toWin / stake);
    if (isValidAmerican(derived)) odds = derived;
  }
  if (odds === null) {
    const printed = /(?<![\d-])([+-])\s?(\d{3,5})(?![\d-])/.exec(
      text.replace(/(\d)\s(\d{2})\b/g, '$1$2'),
    );
    if (printed && isValidAmerican(Number(printed[1] + printed[2])))
      odds = Number(printed[1] + printed[2]);
  }

  const qrTicket = qrUrl ? /\/ticket\/(\d{12,})/.exec(qrUrl)?.[1] : undefined;
  const compact = text.replace(/(\d)[ \t]+(?=\d)/g, '$1');
  const ticketM = /\b(\d{6}-\d{4}-\d{4}-\d{4})\b/.exec(compact);
  const ticket =
    ticketM?.[1] ??
    (qrTicket ? qrTicket.replace(/^(\d{6})(\d{4})(\d{4})(\d{4})$/, '$1-$2-$3-$4') : undefined);

  let book = BOOKS.find(([re]) => re.test(text))?.[1] ?? '';
  if (qrUrl && !book) book = BOOKS.find(([re]) => re.test(qrUrl))?.[1] ?? '';

  const legCount = Number(/(\d+)\s*Leg/i.exec(text)?.[1] ?? 0);
  const sgp = /same\s*game\s*parlay|\bsgp\b/i.test(text);
  let betType: BetType = 'Other';
  if (/parlay|\d+\s*leg/i.test(text)) betType = 'Parlay';
  else if (/teaser/i.test(text)) betType = 'Teaser';
  else if (/money\s*l[il1]ne|\bml\b/i.test(text)) betType = 'Moneyline';
  else if (/spread|point\s*spread/i.test(text)) betType = 'Spread';
  else if (/total|over|under/i.test(text)) betType = 'Total';

  const teams = findTeams(text);
  const sport =
    teams?.league ?? (/basketball/i.test(text) ? 'NBA' : /football/i.test(text) ? 'NFL' : 'Other');
  const game: GameRef | undefined = teams
    ? { league: teams.league, away: teams.away, home: teams.home }
    : undefined;
  const nick = (full: string) => full.split(' ').slice(-1)[0];

  const legs = betType === 'Parlay' || betType === 'Teaser' ? parseLegs(lines) : [];
  const n = legCount || legs.length;
  const pick = teams
    ? `${n ? `${n}-leg ` : ''}${sgp ? 'SGP' : betType}: ${nick(teams.away)} @ ${nick(teams.home)}`
    : legs.length
      ? `${n}-leg ${betType.toLowerCase()}`
      : '';

  return {
    sport,
    betType,
    pick,
    odds,
    stake,
    book,
    date: parseDate(text) ?? '', // filled in by mergeReads / the caller
    status: 'pending',
    legs,
    notes: ticket ? `Ticket ${ticket}` : '',
    game,
    market: undefined,
    expectedLegs: legCount || undefined,
  };
}

/**
 * What's missing from an on-device read. Anything here means the photo
 * should be retaken rather than saving a ticket with a dropped leg.
 */
export function slipProblems(sb: ScannedBet): string[] {
  const readableLegs = sb.legs.filter((l) => l.market).length;
  if (sb.expectedLegs && readableLegs > sb.expectedLegs)
    return [`the legs (found ${readableLegs}, ticket says ${sb.expectedLegs})`];
  const problems: string[] = [];
  if (sb.stake === null) problems.push('the stake');
  if (sb.odds === null) problems.push('the odds');
  if (sb.betType === 'Parlay' || sb.betType === 'Teaser') {
    const readable = sb.legs.filter((l) => l.market).length;
    const expected = sb.expectedLegs ?? sb.legs.length;
    if (!expected || readable < expected)
      problems.push(expected ? `${expected - readable} of ${expected} legs` : 'the legs');
  }
  return problems;
}

/** The better of two reads of the same slip (fewer problems wins). */
export function betterRead(a: ScannedBet, b: ScannedBet): ScannedBet {
  const pa = slipProblems(a).length;
  const pb = slipProblems(b).length;
  if (pa !== pb) return pa < pb ? a : b;
  return b.legs.filter((l) => l.market).length > a.legs.filter((l) => l.market).length ? b : a;
}

const legKey = (l: ParlayLeg) => {
  const m = l.market;
  if (!m) return null;
  if (m.kind === 'player') return `p|${m.player.toLowerCase()}|${m.stat}`;
  if (m.kind === 'moneyline' || m.kind === 'spread') return `t|${m.kind}|${m.team.toLowerCase()}`;
  return `o|${m.side}`;
};

/**
 * Combines several reads of the same photo: the best read supplies the
 * ticket details, and each leg only has to come out clean in one read.
 * When reads disagree on a leg's line, the most common value wins.
 */
export function mergeReads(reads: ScannedBet[]): ScannedBet {
  const base = reads.reduce((a, b) => betterRead(a, b));
  const ordered = [base, ...reads.filter((r) => r !== base)];
  const seen = new Map<string, { leg: ParlayLeg; lines: number[] }>();
  for (const r of ordered) {
    for (const l of r.legs) {
      const k = legKey(l);
      if (!k) continue;
      const entry = seen.get(k);
      const line = l.market?.kind === 'player' ? l.market.line : NaN;
      if (entry) entry.lines.push(line);
      else seen.set(k, { leg: l, lines: [line] });
    }
  }
  const legs = [...seen.values()].map(({ leg, lines }) => {
    if (leg.market?.kind !== 'player') return leg;
    const counts = new Map<number, number>();
    lines.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
    const line = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (line === leg.market.line) return leg;
    return {
      ...leg,
      market: { ...leg.market, line },
      pick: leg.pick.replace(/\d+(?:\.\d)?\+/, `${line}+`),
    };
  });
  const pick = (k: keyof ScannedBet) =>
    ordered.map((r) => r[k]).find((v) => v !== null && v !== '' && v !== undefined);
  return {
    ...base,
    legs: legs.length ? legs : base.legs,
    stake: (pick('stake') as number | null) ?? null,
    odds: (pick('odds') as number | null) ?? null,
    book: (pick('book') as string) ?? '',
    notes: (pick('notes') as string) ?? '',
    date: (pick('date') as string) || todayISO(),
    game: pick('game') as ScannedBet['game'],
    expectedLegs: (pick('expectedLegs') as number | undefined) ?? undefined,
  };
}
