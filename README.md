# Bet Tracker

A mobile-first sports bet tracker built with **Expo (React Native)**. One codebase runs as:

- 📱 a native **iOS / Android app** (App Store-ready via EAS Build)
- 🌐 a **web app** you can add to your phone's home screen (hosted free on GitHub Pages)

## Features

- Log bets: sport, bet type, pick, American odds, stake ($ or units), sportsbook, date, notes
- **Parlays & teasers**: enter each leg and the combined odds are calculated automatically
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
