# Phone notifications plan

## What's built
- **Profile → Notifications**: people choose what they hear about — a ticket
  cashes, busts, legs hit or miss, one leg away, games starting, a daily
  recap, offers & news — plus an on/off switch for in-app pop-ups.
- The in-app pop-ups (CASHED!, BUSTED, leg banners) already follow those
  choices.
- Choices are saved to the account (`public.notification_prefs`).
- In the App Store / Play Store app, **Turn on phone notifications** asks
  permission and registers the phone (`public.push_tokens`, Expo push token).
  `expo-notifications` is installed and in `app.json` plugins.
- Tables: `supabase/setup-notifications.sql`.

## What's left (App Store phase)
Phone notifications must come from a server, because a closed app can't
watch games. The sender:

1. **Supabase Edge Function `notify`**, run every 2 minutes on game days
   (Supabase Cron: `select cron.schedule('notify', '*/2 * * * *', ...)`).
2. Loads open bets for users who have a push token (`bets` table, status
   pending) and their `notification_prefs`.
3. Fetches the ESPN scoreboards / box scores for those games and grades each
   leg with the same rules as the app (reuse `src/live.tsx` grading: bundle it
   into the function like `scripts/build-scan-function.ts` does for the
   scanner).
4. For each new event (ticket cashed / busted, leg hit / missed, one leg
   away, kickoff in 15 minutes) not yet in `notifications_sent`, and allowed
   by the person's prefs, sends an Expo push
   (`POST https://exp.host/--/api/v2/push/send` with the tokens), then records
   it in `notifications_sent`.
5. Settles the ticket in the `bets` table too, so the app shows the result
   the moment it opens.
6. Daily recap: one more scheduled run each evening summing the day.
7. Offers: sent by hand (or from a marketing tool) only to people with
   `offers: true` — Apple requires marketing pushes to be opt-in.

Apple setup: an APNs key in the Apple Developer account, uploaded to Expo
(EAS credentials), so Expo can deliver to iPhones.
