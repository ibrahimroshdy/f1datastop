import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Streaming passthrough for F1's livetiming CDN.
//
// Why: CloudFront 403s requests from Azure ranges, which is every GitHub-hosted runner.
// Supabase Edge egresses from AWS, which CloudFront allows. FastF1 fetches session data
// through exactly one line (fastf1/_api.py:1768, `base_url + path + page`), so pointing
// base_url here routes the blocked fetches through an allowed IP.
//
// Auth: a token as the path segment immediately before /static/, because FastF1 appends
// its own path to base_url and gives us no way to inject a header. This only proxies
// public F1 data, so the token guards bandwidth/abuse rather than secrets.
//
// Routing-agnostic: we anchor on "/static/" rather than assuming how the platform
// presents pathname (with or without the /functions/v1/<slug> prefix).

// Set with: supabase secrets set F1_PROXY_TOKEN=<token>
const TOKEN = Deno.env.get("F1_PROXY_TOKEN");
const ORIGIN = "https://livetiming.formula1.com";

Deno.serve(async (req: Request) => {
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "F1_PROXY_TOKEN is not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const path = url.pathname;
  const idx = path.indexOf("/static/");

  if (idx === -1) {
    return new Response(JSON.stringify({ error: "only /static/ is proxied", saw: path }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const target = path.slice(idx);               // /static/2026/...
  const before = path.slice(0, idx);            // .../<TOKEN>
  if (!before.endsWith("/" + TOKEN)) {
    return new Response(JSON.stringify({ error: "forbidden", saw: before }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(ORIGIN + target + url.search, {
      headers: { "User-Agent": "FastF1/3.8.3", "Accept": "*/*" },
    });
    // Stream straight through — car_data/position are tens of MB and must not be buffered.
    const h = new Headers();
    for (const k of ["content-type", "content-length", "etag", "last-modified"]) {
      const v = upstream.headers.get(k);
      if (v) h.set(k, v);
    }
    h.set("x-proxied-from", "livetiming.formula1.com");
    return new Response(upstream.body, { status: upstream.status, headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }
});
