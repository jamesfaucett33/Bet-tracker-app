# BetKeyper: where we stopped (Nov 27, 2026, night)

## Live now (jamesfaucett33.github.io/Bet-tracker-app)
- **Brand:** BetKeyper, lime shield logo, slogan "Every ticket. Every book. One place." in the header on every tab.
- **Tabs:** Dashboard · Upcoming · Live · Past · **Profile** (menu: account, notifications, plans, invite friends, trips, team colors, bankroll, books & sports, backup, own AI key, delete data).
- **Adding bets:** **+** opens "Scan photo(s)" or "Enter bet manually". Manual entry follows the ticket: sportsbook → single or parlay → what you bet → **Wager / To win** (odds optional) → sport → **Placed: Today / Yesterday / Pick a date**. Futures stay open until a "decided by" date.
- **Dashboard:** Today / 7 Days / 30 Days / All Time with **Won / Lost / Net** (tap each to see the tickets); On the table (Live / Upcoming open those tabs); recent wins, close calls, bad beats & bad bets with labels; tapping a ticket opens a ticket view with Share and Edit.
- **Plans** (pretend checkout in beta, saves which plan testers picked): Rookie free · Starter $0.99 / 25 · Pro $2.99 / 75 · All-Pro $5.99 / 200 · MVP $9.99 / 400 bet uploads; yearly 15 / 20 / 25 / 30% off; upload pack $0.99 / 30. **Beta: everyone gets 50 uploads a month.** Every paid plan is profitable at 1¢ an upload (`docs/PRICING.md`).
- **Sharing:** every ticket, any time: LOCKED IN, SWEATING IT, CASHED!, BAD BEAT 😩 (one leg away), BAD BET 🤡 (nothing hit), BUSTED 💀, with jokes. "Give 25, get 25" invite codes on cards and in Profile → Invite friends.
- **Game-day pop-ups:** CASHED! / bust moments and leg banners, chosen in Profile → Notifications.
- **Extras:** team colors for all 124 NFL / NBA / MLB / NHL teams; Trips (Vegas weekend totals).
- **Sign-up:** full name, email, optional mobile, email / text opt-ins.

## Tomorrow, on the computer
Hand Claude on the computer **`docs/COMPUTER_TASKS.md`** (emailed). It covers, in order:
1. Domain: buy betkeyper.com + .app, Cloudflare account, Cloudflare Pages hosting.
2. Supabase: run the 5 setup files (they're safe to re-run).
3. Login addresses for betkeyper.com.
4. Resend email + Confirm email ON + branded templates.
5. Anthropic key (with a spend limit) + deploy the **scan-slip** function.
6. James's account set to `staff` (unlimited).

Then tell this session **"computer setup's done"** and paste Claude's report.

## Then this session does (code side)
- Test on betkeyper.com: sign-up email, uploads count down, shared card shows as the tappable preview in iMessage, invite rewards.
- Point invite links at betkeyper.com (`src/referral.ts` `appUrl`) and forward the old GitHub address.
- **Forgot password** link on the sign-in screen (email now works).
- **Test a cheaper scan model** on real tickets; goal: under 1¢ (must be under 1.5¢ for every plan to stay profitable).

## Still on the list (docs/TODO.md)
- **App Store:** in-app **Delete account** (Apple requires it), camera / photo permission text, privacy & support pages (can live on betkeyper.com), then `docs/APP_STORE_SUBMISSION.md` for the Mac.
- **Payments:** RevenueCat + App Store subscriptions; turn on Pro-only locks; set `BETA_SCANS` to 0 at launch.
- **Phone notifications:** the server sender + Apple push key (`docs/NOTIFICATIONS.md`).
- **Sign in with Google / Apple.**
- **Saved per device only for now:** trips, team color, notification on/off, dashboard period. Sync to the account, and use phone storage in the store app.
- **"Complete your profile"** prompt for older testers with no name.

## Known small issues from the audit (not fixed yet)
- A failed AI read still uses an upload (the upload is reserved before reading).
- Each share-card preview uploads the card even if you cancel; share links include the account ID. Fine for now; switch to short random links later.
- Changing a parlay leg's odds during an edit doesn't recalculate a saved to-win (wager / odds changes do).
- In the store app, pop-ups can be hidden behind an open screen, and the banners don't adjust for the notch yet.

## Test status (tonight)
- Live grading against real ESPN games: **39/39**. Ticket wording reader: **75/75**.
- Manual entry, plans counts (48 of 50), cash pop-up, bad beat / bad bet / busted cards, invite codes: all pass in the built app.
