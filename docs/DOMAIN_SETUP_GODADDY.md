# Buying and setting up betkeyper.com on GoDaddy

**For Claude, running on James's computer with GoDaddy open in the browser.** James is logged in to GoDaddy. Your job is to buy two domains and set up their DNS so the BetKeyper app can move to betkeyper.com. Work in the browser. Take your time and check each screen.

## Ground rules

- **Ask James before any payment.** Before you click the final "Complete Purchase" / "Place Order", stop and show him the cart (items, years, total). Go ahead only after he says yes.
- **Don't add upsells.** No paid email, website builder, Microsoft 365, SSL certificate, hosting or "Domain Protection" add-ons. Remove them if the cart adds them on its own. Free privacy is fine to keep.
- **Don't change his payment details or account settings**, and never type in a card number yourself. If checkout needs payment info, stop and let James enter it.
- If a screen doesn't match these steps (GoDaddy changes its layout), describe what you see and ask James before guessing.

## Step 1: Buy the domains

1. Search GoDaddy for **betkeyper.com** and add it to the cart, **1 year** term.
2. Search for **betkeyper.app** and add it to the cart, **1 year** term.
3. In the cart, remove any add-ons (see the ground rules). Auto-renew **on** is good, so the names aren't lost.
4. **Stop and show James the cart and total.** Expect about $25–40 for both in the first year. Buy only after he OKs it.

## Step 2: DNS for betkeyper.com

Go to **My Products → Domains → betkeyper.com → DNS** (or "Manage DNS").

**Delete** these default GoDaddy records if they're there:
- The **A** record for `@` that points to "Parked" or to a GoDaddy IP address.
- The **CNAME** record for `www` that points to `@`. It gets replaced below.
- Any **Forwarding** set up on betkeyper.com. This domain must **not** forward anywhere.

Leave the **NS** and **SOA** records alone, along with anything named `_domainconnect`.

**Add** these 5 records, with TTL on the default or 1 hour:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | jamesfaucett33.github.io |

The CNAME value is `jamesfaucett33.github.io` exactly: no `https://` and nothing after `.io`.

When you're done, the A records for `@` should be exactly those four, with nothing else.

## Step 3: Forward betkeyper.app to the .com

Go to **My Products → Domains → betkeyper.app → Forwarding** (sometimes under "Domain Settings").

- Forward to: `https://betkeyper.com`
- Type: **Permanent (301)**
- Settings: **Forward only** (not "masking")

If GoDaddy won't let you forward the .app domain, leave it as is and tell James. It isn't critical.

## Step 4: Report back

Tell James:
- Which domains were bought, and the total charged.
- A list of the DNS records now on betkeyper.com.
- Whether the .app forwarding worked.

Then James should tell his BetKeyper Claude session **"domain's set up."** It will connect GitHub Pages to betkeyper.com and move the app over.

DNS can take anywhere from a few minutes to a few hours to take effect. Seeing a GoDaddy page or an error at betkeyper.com right away is normal.
