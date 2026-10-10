// BuyMeACoffee webhook → keep public.site_supporters.count live.
//
// Setup (one-time):
//   1. Deploy with JWT verification OFF (BMC calls it unauthenticated; the
//      HMAC signature is the auth):  supabase functions deploy bmc-webhook --no-verify-jwt
//   2. Set the signing secret:       supabase secrets set BMC_WEBHOOK_SECRET=<your BMC webhook secret>
//   3. In the BuyMeACoffee dashboard → Webhooks, add this function's URL:
//        https://<project-ref>.functions.supabase.co/bmc-webhook
//
// It verifies BMC's `X-Signature-Sha256` HMAC over the raw body, dedupes by
// event id (BMC retries), and atomically increments the count on supporter
// events. Anything else is acked with 200 so BMC doesn't retry forever.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("BMC_WEBHOOK_SECRET") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** HMAC-SHA256(rawBody, secret) === signature (hex), constant-timeish. */
async function verifySignature(raw: string, sig: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false; // fail-closed: do nothing until the secret is set
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = hex.toLowerCase();
  const b = sig.toLowerCase().replace(/^sha256=/, "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const raw = await req.text();
  const sig = req.headers.get("x-signature-sha256");
  if (!(await verifySignature(raw, sig))) return json({ error: "bad signature" }, 401);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const type = String(body.type ?? "");
  const data = (body.data ?? {}) as Record<string, unknown>;
  const eventId = String(body.event_id ?? data.id ?? "");
  // BMC support events: donation.created / recurring_donation.* / membership.*
  const isSupport = /donation|membership|recurring|coffee/i.test(type);
  if (!isSupport || !eventId) return json({ ok: true, skipped: true });

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Idempotency — process each event once (BMC retries on non-2xx).
  const { error: dedupeErr } = await supa.from("bmc_webhook_event").insert({ event_id: eventId });
  if (dedupeErr) return json({ ok: true, duplicate: true }); // PK conflict = already counted

  const { data: next, error } = await supa.rpc("bmc_increment_supporters");
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, count: next });
});
