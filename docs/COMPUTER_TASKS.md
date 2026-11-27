# BetKeyper: setup checklist for Claude on James's computer

**Who this is for:** Claude running on James's computer, in a browser where James is logged in to his accounts. Do the parts in order. Each part says which website it uses, exactly what to click or enter, and how to check it worked. Tick the boxes as you go and give James a short report at the end of each part.

**Repository:** `jamesfaucett33/Bet-tracker-app` on GitHub (branch `main`). Every file mentioned below is in it. To copy a file, open it on github.com and press **Raw**, then copy everything.

**Supabase project:** `zielynjbewfhoerigbzm` (supabase.com → Dashboard → that project).

## Ground rules (read first)

1. **Money:** before anything that charges a card (buying domains, upgrading a plan), stop and show James the item and the total. Continue only after he says yes. Never type card numbers yourself.
2. **Passwords and keys:** let James type passwords. When a site shows an API key or secret, paste it **only** into the form named in these steps, never into a chat, a document, an email or a note.
3. **Free plans:** pick the Free plan on Cloudflare, Resend and Supabase whenever asked.
4. **Don't delete** anything that already exists (database tables, DNS records, projects) unless a step says to.
5. **If a screen doesn't match these steps** (sites change their layouts), describe what you see to James and ask before guessing.
6. **Stop and ask James** if anything asks for his phone, a verification code, or two-factor approval.

---

## Part 1: Domain and hosting (GoDaddy + Cloudflare)

Follow **`docs/DOMAIN_SETUP_GODADDY.md`** start to finish. In short:
- [ ] Buy **betkeyper.com** and **betkeyper.app** on GoDaddy (1 year each, show James the total first).
- [ ] Create a free **Cloudflare** account, add `betkeyper.com`, and switch GoDaddy's nameservers to Cloudflare's two.
- [ ] Cloudflare **Workers & Pages → Pages → Connect to Git** → `jamesfaucett33/Bet-tracker-app`, build command `npm run build:web`, output `dist`, environment variables `EXPO_ROOT=1` and `NODE_VERSION=22`.
- [ ] Add custom domains **betkeyper.com** and **www.betkeyper.com** to the Pages project.
- [ ] Forward **betkeyper.app** to `https://betkeyper.com` (GoDaddy forwarding).

✅ **Check:** https://betkeyper.com opens the BetKeyper app (it may take up to a few hours for the domain to go live; the `betkeyper.pages.dev` address works right away).

---

## Part 2: Database setup (Supabase SQL)

Supabase → the project → **SQL Editor → New query**. For each file below, in this order: open it on GitHub (Raw), copy all of it, paste it into a new query, press **Run**, and confirm it says **Success**.

- [ ] `supabase/setup-free-scans.sql` (upload usage log)
- [ ] `supabase/setup-plans.sql` (plans, upload packs, beta upgrade interest)
- [ ] `supabase/setup-referrals.sql` (invite codes, "Give 25, get 25" rewards)
- [ ] `supabase/setup-notifications.sql` (notification choices, phone tokens)
- [ ] `supabase/setup-cards.sql` (storage for shared bet cards)

If one says a table or policy **already exists**, that part was done before: note it and move on. Report any other error to James word for word.

✅ **Check:** Table Editor shows `scan_usage`, `subscriptions`, `scan_packs`, `upgrade_interest`, `referral_codes`, `referrals`, `notification_prefs`, `push_tokens`, `notifications_sent`. Storage shows a bucket named `cards`.

---

## Part 3: Login addresses (Supabase)

Supabase → **Authentication → URL Configuration**:
- [ ] **Site URL:** `https://betkeyper.com`
- [ ] **Redirect URLs**, add (keep any that are already there):
  - `https://betkeyper.com/**`
  - `https://www.betkeyper.com/**`
  - `https://betkeyper.pages.dev/**`
  - `https://jamesfaucett33.github.io/Bet-tracker-app/**`
- [ ] Save.

---

## Part 4: Email sending and verification (Resend + Supabase)

**Resend** (resend.com):
- [ ] Sign up free (James enters his email and password).
- [ ] **Domains → Add domain** → `betkeyper.com`. If Resend offers **"Auto configure" with Cloudflare**, use it. Otherwise add each DNS record it lists in **Cloudflare → betkeyper.com → DNS → Records** (same Type, Name and Value; proxy status **DNS only** / grey cloud).
- [ ] Wait until Resend shows the domain as **Verified**.
- [ ] **API Keys → Create API key** (name `supabase-smtp`, permission **Sending access**). Keep this page open; the key goes straight into the next step.

**Supabase** → **Authentication → Emails → SMTP Settings** → turn on **Custom SMTP**:
- [ ] Sender email: `noreply@betkeyper.com`, Sender name: `BetKeyper`
- [ ] Host: `smtp.resend.com`, Port: `465`, Username: `resend`, Password: *the Resend API key*
- [ ] Save.

**Branded emails**, Supabase → **Authentication → Emails → Templates**:
- [ ] **Confirm signup:** subject `Confirm your BetKeyper account`, body = all of `supabase/email-templates/confirm-signup.html`.
- [ ] **Reset password:** subject `Reset your BetKeyper password`, body = all of `supabase/email-templates/reset-password.html`.

**Turn on verification**, Supabase → **Authentication → Sign In / Providers → Email**:
- [ ] **Confirm email: ON.** Save.

✅ **Check:** on https://betkeyper.com, Profile → Create account with a test address James can open (e.g. `jamesfaucett33+test1@gmail.com`). The branded "Confirm your BetKeyper account" email arrives. Tap the button, then sign in.

---

## Part 5: The bet slip reader (Anthropic + Supabase)

**Anthropic** (console.anthropic.com, James signs in or signs up):
- [ ] **Settings → Billing:** add a payment method if needed (**show James first**) and set a **monthly spend limit** (suggest $25 to start).
- [ ] **API Keys → Create key**, name `betkeyper-scan-slip`. Keep the page open.

**Supabase** → **Edge Functions → Secrets** (or Project Settings → Edge Functions):
- [ ] Add secret **`ANTHROPIC_API_KEY`** = *the key*. Save.

**Supabase** → **Edge Functions → Deploy a new function → Via Editor**:
- [ ] Name: `scan-slip`
- [ ] Code: all of `supabase/functions/scan-slip/index.ts` (replace the sample code completely).
- [ ] Deploy. (If `scan-slip` already exists, open it, replace its code with the file, and deploy again.)

✅ **Check:** on betkeyper.com, signed in, + → Scan photo(s) → choose a clear photo of a paper ticket. It reads the ticket and the header count goes from 50 to 49 uploads left.

---

## Part 6: James's own account (unlimited uploads for testing)

- [ ] Supabase → **Authentication → Users** → find James's account → copy its **User UID**.
- [ ] **Table Editor → subscriptions → Insert row:** `user_id` = that UID, `plan` = `staff`, leave `renews_at` empty. Save.

✅ **Check:** the app header shows **Unlimited** for James.

---

## Part 7: Report back

Give James a short summary: each part ✅ done, ⚠️ done with a note, or ❌ blocked (and why). Then James tells his BetKeyper Claude session **"computer setup's done"** and pastes the summary, and that session finishes the code side (see `docs/SESSION_NOTES.md`).

---

## Later (not tomorrow)

These need accounts that aren't set up yet. Each will get its own instructions when it's time:
- **Apple Developer account** ($99/year) and App Store submission: `docs/APP_STORE_SUBMISSION.md` (James's dad on the Mac).
- **Sign in with Google / Apple:** Google Cloud OAuth client + Apple Services ID, then Supabase providers.
- **Payments:** RevenueCat + App Store subscriptions (prices in `docs/PRICING.md`).
- **Phone notifications:** APNs key + the push sender (`docs/NOTIFICATIONS.md`).
