# BetKeyper: to-do list

Things to add once the core app is fine-tuned.

## Domain & email (start with these)
- [ ] **Buy betkeyper.com + betkeyper.app** on GoDaddy and add the DNS records (see `DOMAIN_SETUP_GODADDY.md`).
- [ ] **Move the app to betkeyper.com**: GitHub Pages custom domain + HTTPS, serve from the root instead of `/Bet-tracker-app`, update the Supabase Site URL and redirect URLs, forward the old github.io link. Remind testers to sign in first (bets saved only in the browser don't carry over).
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
- [ ] **At launch:** set `BETA_SCANS` to 0 in `src/plans.ts` (beta gives every account 50 bet uploads a month), re-run the scan-function build script and redeploy.
- [ ] Run `supabase/setup-plans.sql` and redeploy the `scan-slip` function (plan limits). Set your own account to `staff`.
- [ ] Test a smaller, cheaper scan model on real tickets (target about 1¢ a scan).
- [ ] Hook up payments: RevenueCat + Apple in-app purchase (+ Google Play, Stripe for web). Upgrade buttons currently run a pretend checkout ending in "not available in beta testing mode"; testers' picks are saved in `upgrade_interest`.
- [x] Built the Pro perks: NBA/MLB/NHL team colors, share cards, trip view.
- [ ] Turn on Pro-only gating at launch (all-league team colors already lock when the beta ends).
- [ ] Sync trips and team choice to the account (they're saved on the device for now).

## Features
- [ ] **Free AI scanning** for signed-in users: Anthropic API key, saved as a Supabase secret, deploy the scan function.
- [ ] Save the chosen team to the account, so it follows you to other devices.

## Marketing
- [ ] **BetKeyper landing page** on betkeyper.com.

## Cleanup
- [ ] Remove old test accounts from Supabase.
