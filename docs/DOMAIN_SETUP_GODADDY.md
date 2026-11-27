# Buying betkeyper.com and putting BetKeyper on it (GoDaddy + Cloudflare)

**For Claude, running on James's computer with a browser.** James is logged in to GoDaddy and GitHub. Your job: buy two domains on GoDaddy, then host the BetKeyper app on **Cloudflare Pages** (free) at betkeyper.com. Cloudflare is used instead of GitHub Pages because it runs the small "card page" that makes shared bets show up as a big tappable picture in texts. Work in the browser and check each screen.

## Ground rules

- **Ask James before any payment.** Before the final "Complete Purchase" / "Place Order", stop and show him the cart (items, years, total). Go ahead only after he says yes.
- **No upsells.** No paid email, website builder, Microsoft 365, SSL certificate, hosting or "Domain Protection" add-ons. Free privacy is fine.
- **Never type card numbers or change his payment or account settings.** If checkout needs payment info, stop and let James enter it.
- **Cloudflare stays on the Free plan.** Pick Free on every plan screen.
- If a screen doesn't match these steps, describe what you see and ask James before guessing.

## Step 1: Buy the domains (GoDaddy)

1. Search GoDaddy for **betkeyper.com** and add it to the cart, **1 year**.
2. Search **betkeyper.app** and add it, **1 year**.
3. Remove add-ons from the cart. Auto-renew **on** is good.
4. **Stop and show James the cart and total** (expect about $25–40). Buy only after he OKs it.

## Step 2: Create a free Cloudflare account and add betkeyper.com

1. Go to **dash.cloudflare.com/sign-up**. James enters his email and a password (let him type the password).
2. In Cloudflare: **Add a domain** → `betkeyper.com` → **Free** plan → continue. Let it import existing DNS records, then continue.
3. Cloudflare shows **two nameservers** (like `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`). Copy both exactly.
4. Back in GoDaddy: **My Products → Domains → betkeyper.com → DNS → Nameservers → Change nameservers → "I'll use my own nameservers"**. Enter the two Cloudflare nameservers, save, and confirm the warning.
5. Back in Cloudflare, click **Check nameservers**. It can take from a few minutes to a few hours to show **Active**. You can do Step 3 meanwhile.

## Step 3: Put the app on Cloudflare Pages

1. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
2. Connect **GitHub** (James approves the GitHub prompt) and choose the repository **jamesfaucett33/Bet-tracker-app** (only that one repository is needed).
3. Build settings:
   - Project name: `betkeyper`
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npm run build:web`
   - Build output directory: `dist`
   - **Environment variables** (Production): `EXPO_ROOT` = `1` and `NODE_VERSION` = `22`
4. **Save and Deploy.** Wait for the build to finish (a few minutes). It gives a `betkeyper.pages.dev` address; open it and check the BetKeyper app loads.
5. In the Pages project: **Custom domains → Set up a custom domain** → `betkeyper.com` → activate. Then add `www.betkeyper.com` too. (Cloudflare creates the DNS records itself.)

## Step 4: Send betkeyper.app to betkeyper.com

Easiest: in GoDaddy, **betkeyper.app → Forwarding → Add forwarding** → `https://betkeyper.com`, **Permanent (301)**, **forward only**. If GoDaddy won't allow it for .app, skip it and tell James; it isn't critical.

## Step 5: Report back

Tell James:
- What was bought and the total.
- Whether Cloudflare shows betkeyper.com as **Active**.
- Whether **https://betkeyper.com** opens the BetKeyper app.

Then James tells his BetKeyper Claude session **"domain's set up"**, and it finishes the move (Supabase login addresses, card sharing storage, invite links, forwarding the old GitHub address).
