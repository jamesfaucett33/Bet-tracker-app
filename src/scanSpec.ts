import { BET_TYPES, PLAYER_STATS } from './types';

/**
 * What a slip scan asks Claude for: the model, the instructions and the
 * JSON shape of the answer. Shared by the app (scanning with your own key) and
 * the Supabase scan-slip function (testers scanning on the owner's key), which
 * is generated from this file by scripts/build-scan-function.ts.
 */

export const SCAN_MODEL = 'claude-opus-5-5';

export const SYSTEM_PROMPT = `You read photos and screenshots of sports betting slips (printed retail tickets, sportsbook app screenshots, bet history pages) and extract each bet on them for a personal bet-tracking app.

How to fill each field (when something isn't on the slip, use "" for text, 0 for numbers and "none" for choices; never guess):
- sport: the league, using a short common name such as NFL, NBA, MLB, NHL, NCAAF, NCAAB, Soccer, UFC, Tennis, Golf. Infer it from team or player names when the slip only says "Football" or "Basketball" (e.g. Packers at Rams is NFL). Use "Other" if you can't tell.
- bet_type: Parlay for any multi-leg bet, including same game parlays; Teaser for teasers; Spread, Moneyline or Total for single game lines; Prop for player or game props; Future for futures; Other if none fit.
- pick: a short human-readable summary of the bet. For a single bet, the selection with its line (e.g. "Chiefs -3.5 vs Bills"). For a parlay, name the game(s) and leg count (e.g. "3-leg SGP: Packers @ Rams").
- odds: the bet's total American odds as an integer (e.g. -110, 550 for +550). If only decimal or fractional odds are shown, convert them. Use 0 if no odds are visible.
- stake: the amount wagered in dollars (ticket cost / risk / wager). 0 if not visible.
- to_win: the profit if it wins (not including the stake), in dollars. 0 if not visible. If only the total payout is shown, subtract the stake.
- sportsbook: the operator's brand name (e.g. Caesars, DraftKings, FanDuel), not the casino or venue. "" if unknown.
- placed_date: the date the bet was placed as YYYY-MM-DD, or the event date if no placement date is shown. "" if no date is visible.
- status: won, lost or push only if the slip clearly shows the bet was settled that way (e.g. "Won", "Paid", "Lost", a green check on every leg); otherwise pending.
- legs: for a parlay or teaser, one entry per leg with the selection (e.g. "Matthew Stafford 250+ passing + rushing yds") and that leg's American odds, or 0 when the slip doesn't show per-leg odds, plus that leg's game as away_team / home_team (full team names; important for multi-game parlays where each leg is a different game). Empty for single bets.
- ticket_id: the ticket or bet ID if printed, else "".
- away_team / home_team: full team names of the game when one game is shown (e.g. "Green Bay Packers" at "Los Angeles Rams"); "A at B" or "A @ B" means A is away. "" for multi-game parlays or futures.
- market (on each leg, and on the bet itself for single bets; kind "none" on parlays): how the outcome is graded.
  kind "player" for player props with player (full name), stat and line: "250+" means line 250; "over 249.5" means line 250. For an under prop set side "under" and line to the printed number (e.g. 249.5); otherwise side "over". Stats: passYds, rushYds, recYds, receptions, passRushYds, rushRecYds, passTd, anyTd (anytime TD = line 1), fgMade, points, rebounds, assists, threes, pra, passCompletions, passAttempts, rushAttempts (carries), interceptions (thrown), steals, blocks, sacks, tackles (tackles + assists), soloTackles.
  kind "moneyline" with team; kind "spread" with team and line (e.g. -3.5); kind "total" with side over/under and line for game totals (for a team total also set team, and keep "Team Total" in the pick text); kind "other" if none fit, including first-half / quarter / period bets, first or last TD scorer, longest plays, double-doubles and race-to markets (keep their wording in the pick text). Unused fields are "", 0 or "none".

Copy numbers exactly as printed; never invent odds, amounts or dates that aren't on the image. If the image contains no bet slip, return an empty bets list and say what you see in problem; otherwise problem is "".`;

// No nullable/union fields: the API limits how many a schema may have, so
// unknown values come back as "", 0 or "none" and are treated as missing.
export const MARKET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'player', 'stat', 'line', 'team', 'side'],
  properties: {
    kind: { type: 'string', enum: ['player', 'moneyline', 'spread', 'total', 'other', 'none'] },
    player: { type: 'string' },
    stat: { type: 'string', enum: [...Object.keys(PLAYER_STATS), 'none'] },
    line: { type: 'number' },
    team: { type: 'string' },
    side: { type: 'string', enum: ['over', 'under', 'none'] },
  },
};

export const SCHEMA = {
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
          odds: { type: 'integer' },
          stake: { type: 'number' },
          to_win: { type: 'number' },
          sportsbook: { type: 'string' },
          placed_date: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'won', 'lost', 'push'] },
          legs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['pick', 'odds', 'market', 'away_team', 'home_team'],
              properties: {
                pick: { type: 'string' },
                odds: { type: 'integer' },
                market: MARKET_SCHEMA,
                away_team: { type: 'string' },
                home_team: { type: 'string' },
              },
            },
          },
          ticket_id: { type: 'string' },
          away_team: { type: 'string' },
          home_team: { type: 'string' },
          market: MARKET_SCHEMA,
        },
      },
    },
    problem: { type: 'string' },
  },
} as const;
