# BetKeyper: to-do list

Things to add once the core app is fine-tuned.

## Domain & email (start with these)
- [ ] **Buy betkeyper.com + betkeyper.app** on GoDaddy and host on Cloudflare Pages (see `DOMAIN_SETUP_GODADDY.md`).
- [ ] **Move the app to betkeyper.com** (Cloudflare Pages, built with EXPO_ROOT=1 so it serves from the root), update the Supabase Site URL and redirect URLs, forward the old github.io link. Remind testers to sign in first (bets saved only in the browser don't carry over).
- [ ] **Email verification**: Supabase → Confirm email ON. Send through Resend (free) from `noreply@betkeyper.com`; Resend's DNS records go in GoDaddy. The app already shows "check your email" after sign-up.
- [ ] **BetKeyper-branded email templates** (confirm email, reset password).
- [ ] **Forgot password** link on the sign-in screen (needs the email setup above).
- [ ] Add the Resend + Supabase steps to the GoDaddy instructions so Claude on the computer can do them.
- [ ] **Sign in with Google + Sign in with Apple** through Supabase (free). Apple requires its own sign-in if Google is offered; it comes with the $99/yr Apple Developer account. Google needs a free Google Cloud OAuth client.

## App Store
- [ ] In-app **Delete account** (Supabase Edge Function). Apple requires it.
- [ ] Camera / photo permission messages in `app.json`.
- [ ] **Privacy policy** and **support** pages (could live on betkeyper.com).
- [ ] Hand `APP_STORE_SUBMISSION.md` to Dad's Claude on the Mac.

## Plans & payments
- [ ] Once the server scanner (scan-slip) is live: stop using any Anthropic key saved on a device (src/readSlip.ts / BetFormScreen use `settings.anthropicApiKey`), so every scan counts as an upload. The Profile option is already gone.
- [ ] Run `supabase/setup-cards.sql` (storage for shared card links). Card links switch on automatically on betkeyper.com.
- [ ] Run `supabase/setup-referrals.sql` (invite codes + Give 25 / Get 25 rewards). Needs Confirm email ON to stop fake-account farming.
- [ ] Point invite links at betkeyper.com once the domain is live (src/referral.ts appUrl).
- [ ] **At launch:** set `BETA_SCANS` to 0 in `src/plans.ts` (beta gives every account 50 bet uploads a month), re-run the scan-function build script and redeploy.
- [ ] Run `supabase/setup-plans.sql` and redeploy the `scan-slip` function (plan limits). Set your own account to `staff`.
- [ ] Test a smaller, cheaper scan model on real tickets (target about 1¢ a scan).
- [ ] Hook up payments: RevenueCat + Apple in-app purchase (+ Google Play, Stripe for web). Upgrade buttons currently run a pretend checkout ending in "not available in beta testing mode"; testers' picks are saved in `upgrade_interest`.
- [x] Built the Pro perks: NBA/MLB/NHL team colors, share cards, trip view.
- [ ] Turn on Pro-only gating at launch (all-league team colors already lock when the beta ends).
- [ ] Sync trips and team choice to the account (they're saved on the device for now).

## Notifications
- [ ] Run `supabase/setup-notifications.sql`.
- [ ] Build the push sender (Edge Function on a 2-minute schedule) and add the APNs key at launch — plan in `docs/NOTIFICATIONS.md`.

## Features
- [ ] **Free AI scanning** for signed-in users: Anthropic API key, saved as a Supabase secret, deploy the scan function.
- [ ] Save the chosen team to the account, so it follows you to other devices.

## Marketing (owner: the marketing-manager agent, plan in docs/marketing/PLAN.md)
- [ ] **Facebook / Instagram and TikTok ads**: creative pack + copy sets before launch; small test campaigns at launch.
- [ ] **Launch ads** on Reddit, Facebook / Instagram, TikTok and Apple Search Ads (and more once those work).
- [ ] Check each platform's gambling-related ad rules and approvals before spending.
- [ ] **BetKeyper landing page** on betkeyper.com.

## Cleanup
- [ ] Remove old test accounts from Supabase.
