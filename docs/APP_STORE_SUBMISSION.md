# Submitting BetKeyper to the Apple App Store

**Who this is for:** a Claude Code session running on a Mac, helping submit this app to the App Store, together with the person at the Mac. Read the whole file first, then work through it **in order**. Stop and ask the person whenever a step needs their Apple ID, a password, a payment, a 2-factor code, or a decision. Never type passwords or codes yourself, and never commit secrets to the repository.

**What BetKeyper is:** a personal sports-bet *tracker* (no real-money betting). Users sign up with email and password and scan or enter their tickets from any sportsbook or casino. The app tracks live games from ESPN's public feeds and keeps a win-loss record. It's built with **Expo (React Native) SDK 58**, uses **Supabase** for accounts and sync, and uses an optional AI scanner.

- Repository: `jamesfaucett33/Bet-tracker-app` (branch `main`)
- Web version (already live): https://jamesfaucett33.github.io/Bet-tracker-app/
- Bundle ID already set in `app.json`: `com.jamesfaucett.bettracker` (can't be changed after the first upload, so keep it)
- App name: **BetKeyper**. App Store title: **BetKeyper: Sports Bet Tracker**

---

## Part 0: Must be done BEFORE submitting (Apple will reject without these)

Check each item. Items marked **(code)** are changes to the app. If they're not in the repo yet, ask the owner (James) to have them added in his Claude session, or add them here carefully, test them, and commit to a branch for him to review.

- [ ] **(code) Delete account inside the app.** Apple guideline 5.1.1(v) requires any app with account sign-up to offer account deletion in the app. This needs a "Delete account" button in Settings → Account that deletes the user's bets and their Supabase auth user. Deleting an auth user requires the service role key, so it must run in a Supabase Edge Function, never in the app.
- [ ] **(code) Camera and photo-library permission text** in `app.json`, through the `expo-image-picker` config plugin:
  ```json
  "plugins": [
    ["expo-image-picker", {
      "photosPermission": "BetKeyper reads your bet slip photos so it can log your tickets.",
      "cameraPermission": "BetKeyper uses the camera to scan your bet slips."
    }]
  ]
  ```
- [ ] **(code) Scanning works in the native app.** The free "read on the phone" scanner (Tesseract) only runs in the web version. In the iPhone app, scanning uses the AI scanner: either the user's own Anthropic key (Settings) or the shared free-scan service. Confirm the Supabase Edge Function `scan-slip` is deployed and the `ANTHROPIC_API_KEY` secret is set (see `supabase/README.md`). Otherwise a reviewer who tries to scan will see an error. Typing a bet in by hand works without it.
- [ ] **Privacy policy URL** (a public web page). It must cover: email for sign-in; bets saved to the user's account (Supabase); bet-slip photos sent to the AI scanner (Anthropic) to read them, and not kept by the app; no selling of data; how to delete the account. A simple page on the GitHub Pages site is fine.
- [ ] **Support URL** (a public page with a contact email).
- [ ] **A demo account for Apple's reviewer**, with a few tickets loaded (some upcoming, some settled). Create it in the app; the owner keeps the password.

---

## Part 1: Accounts (the person does these; Claude explains)

1. **Apple Developer Program**, $99/year: https://developer.apple.com/programs/enroll/
   - Recommended: **James enrolls under his own Apple ID**, or under a business if he has an LLC (that needs a free D-U-N-S number and takes a few days). Then in **App Store Connect → Users and Access** he adds the person at this Mac as a team member with the **App Manager** role. That way the app belongs to James, and this Mac can still build and submit.
   - Approval can take from a few hours to two days.
2. **Expo account** (free): https://expo.dev/signup. Expo's build service (EAS) builds the iPhone app in the cloud and uploads it to Apple.
   - In the app's Expo project, the account should be James's (or invite this person to his Expo organization).

## Part 2: Set up the Mac

Run these in Terminal, one at a time, and check each one worked:

```bash
xcode-select --install          # Apple command line tools (if not installed)
# Install Xcode from the Mac App Store, open it once, accept the license.
# Install Node.js 20 LTS or newer if missing: https://nodejs.org
node -v                         # should print v20 or newer
npm install -g eas-cli          # Expo's build/submit tool
git clone https://github.com/jamesfaucett33/Bet-tracker-app.git
cd Bet-tracker-app
npm install
```

## Part 3: Check the app runs as a native app

1. `npx expo-doctor`: fix anything it reports as an error.
2. `npx expo start`, then press `i` to open it in the iPhone Simulator (needs Xcode). Or install **Expo Go** on an iPhone and scan the QR code.
3. Click through every tab (Dashboard, Upcoming, Live, Past, Settings), add a bet by hand, sign in, and try a scan. Write down anything broken or missing and report it to James; don't submit a broken build. The app has mostly been run on the web so far, so this is where native-only problems would show up. Watch for anything that uses browser-only features: `document`, `window.location`, `localStorage`. Those parts are wrapped in `Platform.OS === 'web'` checks, but verify.

## Part 4: Build and upload with EAS

```bash
eas login                       # the person signs in to Expo
eas build:configure             # only the first time; keeps the existing eas.json
eas build --platform ios --profile production
```
- EAS asks to sign in to the Apple Developer account and offers to create the certificates and provisioning profile. Say **yes**: let EAS manage them. The person types the Apple ID and any 2-factor code.
- The build runs in the cloud (about 10–30 minutes) and gives a link to the finished `.ipa`.

Then upload it to App Store Connect:
```bash
eas submit --platform ios --latest
```
- First time: EAS creates the app record in App Store Connect if it doesn't exist (name **BetKeyper**, bundle ID `com.jamesfaucett.bettracker`, primary language English (U.S.)). If the name "BetKeyper" is taken on the App Store, stop and ask James for a fallback (e.g. "BetKeyper – Bet Tracker").

## Part 5: TestFlight first

In App Store Connect → the app → **TestFlight**:
1. Wait for the build to finish "Processing" (it can take up to an hour).
2. Answer the export-compliance question: the app only uses standard HTTPS encryption, so choose **None of the algorithms mentioned above** / exempt. You can also add `"ITSAppUsesNonExemptEncryption": false` under `ios.infoPlist` in `app.json` for future builds.
3. Add James and the testers as **internal testers** and install through the TestFlight app. Test on real iPhones for a few days before submitting for review.

## Part 6: The App Store listing

App Store Connect → the app → **App Store** tab. Ready-to-paste text:

- **Name** (30): `BetKeyper: Sports Bet Tracker`
- **Subtitle** (30): `Every ticket. Every book.`
- **Category:** Primary **Sports**; Secondary **Utilities** or **Lifestyle**
- **Keywords** (100, commas, no spaces, don't repeat words from the name):
  `parlay,sportsbook,slip,scanner,vegas,casino,odds,nfl,nba,props,sgp,live,scores,bankroll,record,wager`
- **Promotional text:** `Every ticket. Every book. One place. Track every bet you place, free: scan any slip, sweat it live and see your real record.`
- **Description:**
  ```
  Every ticket. Every book. One place.

  BetKeyper is your personal scoreboard for every bet you make — at any sportsbook, any casino, any app. Snap a photo of a paper ticket from the window or a screenshot from your app, and BetKeyper logs it: odds, wager, to-win and every leg.

  • One login, every book — Caesars, MGM, Circa, DraftKings, FanDuel and more, all in one place
  • Live sweats — scores, clocks and your legs updating in real time, with the leg in play highlighted
  • Upcoming, Live and Past — see what's riding, what's playing and how it all finished
  • Your real record — won, lost and net for today, 7 days, 30 days and all time, with bad beats and close calls
  • Auto-settles from the final stats, leg by leg, with CASHED! and bad-beat moments
  • Share any ticket as a card — locked in, sweating it live, cashed or a bad beat
  • Trips — track a Vegas weekend as one trip
  • Your team's colors — NFL, NBA, MLB and NHL
  • Alerts when tickets cash, legs hit or you're one leg away
  • Synced to your account on every device

  Typing in bets is free and unlimited. Plans add more bet uploads (slips read for you) each month.

  BetKeyper does not accept wagers or offer betting. It's a tracker for bets you've already placed. 21+. Please gamble responsibly. If you or someone you know has a gambling problem, call 1-800-GAMBLER.
  ```
- **Support URL / Privacy Policy URL:** from Part 0.
- **Screenshots:** required for the 6.9" iPhone size (1320×2868 or 1290×2796). Take them in the Simulator (iPhone 16 Pro Max) with the demo account: Dashboard, Live (a game in progress), Upcoming, Past, a ticket opened, and the scan screen. 3–6 screenshots.
- **App icon:** comes from the build (`assets/icon.png`, the lime shield with a keyhole on navy).
- **Age rating questionnaire:** answer honestly. There's no simulated gambling and no real-money gambling in the app, but it's about sports betting. Answer "Gambling" questions as **None** unless asked about references, and pick **17+** if Apple's questionnaire allows, or set the age to 17+ manually. Include "21+" in the description, as above.
- **App Privacy** ("nutrition label"): Data collected and linked to the user: **Contact Info: Name, Email address, Phone number (optional)** (account; used for App Functionality, and for Developer's Marketing only when the person opted in), **User Content: other user content** (bets, photos sent for scanning), **Identifiers: Device ID** (push notification token, App Functionality), **Purchases** (subscriptions, App Functionality). **No tracking.**
- **Sign-In required:** yes. Give the **demo account** username and password in **App Review Information**.
- **Review notes** (paste):
  ```
  BetKeyper is a personal tracker for sports bets the user has already placed elsewhere. It does not accept wagers, process payments, or link to any sportsbook. Users log tickets by photo or by hand; live scores come from public ESPN feeds. Demo account provided above has sample tickets. Account deletion: Profile → Account & password → Delete Account.
  ```

## Part 7: Submit for review

1. Select the TestFlight build under **Build** on the version page.
2. Pricing: **Free** (with in-app subscriptions: Starter, Pro, All-Pro, MVP, monthly and yearly, plus the Upload pack; set these up under **Monetization → Subscriptions / In-App Purchases** with the prices in `docs/PRICING.md`, and connect RevenueCat first — see `docs/TODO.md`). Availability: **United States** to start.
3. **Add for Review → Submit.** Reviews usually take 1–3 days. If Apple rejects it, read the message to James. Common ones for this app: missing account deletion (5.1.1(v)), gambling concerns (5.3; the answer is that it doesn't accept wagers, it's a tracker), or a missing demo account. Fix, rebuild (`eas build`, `eas submit`), and resubmit.

## Notes for the Claude on the Mac

- Ask before every step that costs money, changes an account, or submits anything to Apple.
- Don't change the bundle ID, the Supabase URL/key in `src/sync.tsx`, or anything under `supabase/` unless James asks.
- Commit code changes on a new branch, not on `main`, and tell James what changed so he can review.
- The web app at GitHub Pages keeps working the whole time; the App Store version is an extra, not a replacement.
