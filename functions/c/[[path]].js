/**
 * Cloudflare Pages Function: the page behind a shared bet card.
 * betkeyper.com/c/<user id>/<card id>
 *
 * Text apps (iMessage, WhatsApp, Instagram DMs) read the og: tags to build the
 * preview, so the card itself is the big tappable picture. People who tap it
 * land in BetKeyper with the sharer's invite code.
 */
const SUPABASE = 'https://zielynjbewfhoerigbzm.supabase.co';
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function onRequest({ params, request }) {
  const [uid, id] = params.path || [];
  if (!/^[0-9a-f-]{36}$/i.test(uid || '') || !/^[A-Za-z0-9_-]{6,40}$/.test(id || '')) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  const base = `${SUPABASE}/storage/v1/object/public/cards/${uid}/${id}`;
  let meta = {};
  try {
    const r = await fetch(`${base}.json`, { cf: { cacheTtl: 3600 } });
    if (r.ok) meta = await r.json();
  } catch {
    // no details: still show the card
  }
  const ref = /^[A-Z0-9]{4,12}$/.test(meta.ref || '') ? meta.ref : '';
  const app = new URL(ref ? `/?ref=${ref}` : '/', request.url).toString();
  const title = meta.title || 'Check out my bet on BetKeyper';
  const desc =
    meta.description ||
    (ref
      ? `Keep track of all your bets in one place for free. Join with code ${ref} and we both get 25 free bet uploads.`
      : 'Keep track of all your bets in one place for free with BetKeyper.');
  const image = `${base}.png`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BetKeyper">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1350">
<meta property="og:url" content="${esc(request.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">
<meta name="apple-itunes-app" content="app-name=BetKeyper">
<style>
  body{margin:0;background:#061733;color:#F4F8FF;font-family:-apple-system,Helvetica,Arial,sans-serif;text-align:center}
  main{max-width:480px;margin:0 auto;padding:24px 16px 48px}
  img{width:100%;border-radius:20px}
  a.btn{display:block;margin-top:20px;padding:16px;border-radius:14px;background:#7BEA2B;color:#061733;font-weight:900;font-size:18px;text-decoration:none}
  p{color:#A9BCD9}
</style>
</head><body><main>
<img src="${esc(image)}" alt="${esc(title)}">
<a class="btn" href="${esc(app)}">${ref ? 'Join free: get 25 bet uploads' : 'Open BetKeyper'}</a>
<p>${esc(desc)}</p>
</main>
<script>setTimeout(function(){location.replace(${JSON.stringify(app)})},1800)</script>
</body></html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
