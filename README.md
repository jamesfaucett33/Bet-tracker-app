# Bet Tracker

A mobile-first sports bet tracker built with **Expo (React Native)**. One codebase runs as:

- 📱 a native **iOS / Android app** (App Store-ready via EAS Build)
- 🌐 a **web app** you can add to your phone's home screen (hosted free on GitHub Pages)

## Features

- 📷 **Scan bet slips**: photograph a paper ticket or pick an app screenshot, and the bet is read
  and filled in for you (uses Claude — see [Bet slip scanning](#bet-slip-scanning))
- Log bets: sport, bet type, pick, American odds, stake ($ or units), sportsbook, date, notes
- **Parlays & teasers**: enter each leg and the combined odds are calculated automatically, or
  type the total odds printed on the slip (same game parlays)
- One-tap settle: **Won / Lost / Push** right from the bet card
- Dashboard: profit/loss, record, win rate, ROI, profit trend chart, pending exposure
- Filter by **7 days / 30 days / YTD / all time**
- Breakdown by **sport, bet type, and sportsbook**
- Search and filter your bet history
- Bankroll tracking and unit sizing (show everything in units if you prefer)
- Custom sportsbook and sport lists
- Export / import a JSON backup
- Data is stored on-device (no account or server required)

## Use it on your phone (free, no hosting needed)

The included GitHub Action publishes the web version to GitHub Pages whenever `main` is updated.

**One-time setup:**

1. Merge this branch into `main`.
2. On GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Go to **Actions → "Deploy web app to GitHub Pages" → Run workflow** (or just push to `main`).
4. Your app will be live at **https://jamesfaucett33.github.io/Bet-tracker-app/**

**Add it to your home screen:**

- **iPhone (Safari):** open the link → tap **Share** → **Add to Home Screen**
- **Android (Chrome):** open the link → **⋮ menu** → **Add to Home screen / Install app**

It opens full-screen with its own icon, just like an app. Bets are saved in that browser on
that device — use **Settings → Export Backup** occasionally.

> If you rename the repository, update `experiments.baseUrl` in `app.json` to match.

## Bet slip scanning

Tap **+** → **Take Photo** or **Choose Photo** on the New Bet screen. The photo is resized on the
phone and sent to Claude (Anthropic's AI), which reads the sport, bet type, pick, odds, stake,
sportsbook, date, parlay legs and ticket number. The form is filled in for you to check before
saving. If a screenshot has several bets, you can save them all at once.

**Setup:** create an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys)
(add a few dollars of credit — each scan costs roughly a cent), then paste it in
**Settings → Bet Slip Scanning**. The key is stored only on your device and is never included in
backups.

> **Before selling the app:** the key is currently used straight from the phone, which is fine for
> your own key on your own phone. A public version must send scans through a small server that
> holds the key (e.g. a Supabase or Cloudflare function) so customers never see it. The scanning
> code lives in `src/scan.ts`.

QR codes and barcodes on retail tickets only hold a ticket ID for the sportsbook's own systems, so
the app reads the printed slip instead — this works for every sportsbook, paper or app.

## Run it locally

```bash
npm install
npx expo start
```

- Press `w` to open in a web browser.
- Install **Expo Go** on your phone and scan the QR code to run the native app instantly.

## Ship to the App Store

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create a free [Expo account](https://expo.dev/signup), then:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build -p ios --profile production   # builds in the cloud — no Mac needed
   npx eas-cli@latest submit -p ios                       # uploads to App Store Connect / TestFlight
   ```

3. Test on your phone through **TestFlight**, then submit for App Store review.

Before submitting, change `ios.bundleIdentifier` / `android.package` in `app.json` if you want a
different ID (it can't be changed after the first release).

## Project structure

```
App.tsx                     App shell: header, tab bar, add-bet button, bet form modal
src/
  types.ts                  Bet & settings data model
  odds.ts                   American odds math (payouts, parlays, implied probability)
  stats.ts                  Win rate, ROI, breakdowns, profit series
  store.tsx                 State + on-device persistence (AsyncStorage)
  scan.ts                   Bet slip photo → Claude → draft bets
  format.ts, theme.ts       Formatting helpers and colors
  components/               BetCard, ProfitChart, shared UI
  screens/                  Dashboard, Bets, BetForm, Settings
public/                     Web-only files: index.html, manifest, home-screen icons
.github/workflows/          GitHub Pages deploy
```

## Roadmap ideas

- Accounts + cloud sync (Supabase / Firebase) so bets follow you across devices
- Premium tier via in-app purchase (RevenueCat): advanced charts, CSV export, unlimited history
- Closing line value (CLV) tracking
- Bet slip screenshot import
- Home-screen widget with today's P/L

---

_For personal record-keeping only. Please gamble responsibly — 1-800-GAMBLER._
