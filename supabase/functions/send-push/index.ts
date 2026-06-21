import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Sends a Web Push notification to all stored subscriptions.
// Protected by a shared admin token (header x-admin-token).
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_ADMIN_TOKEN.
serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const ADMIN = Deno.env.get("PUSH_ADMIN_TOKEN");
  if (!ADMIN || req.headers.get("x-admin-token") !== ADMIN) {
    return new Response("Forbidden", { status: 403 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const PUB = Deno.env.get("VAPID_PUBLIC_KEY");
  const PRIV = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!SUPABASE_URL || !SERVICE || !PUB || !PRIV) {
    return new Response("Server misconfigured (missing VAPID/secret env)", { status: 500 });
  }

  webpush.setVapidDetails("mailto:admin@f1datastop.com", PUB, PRIV);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  const payload = JSON.stringify({
    title: body.title || "F1 DataStop",
    body: body.body || "",
    url: body.url || "/",
    icon: "/icon-192.png",
  });

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: subs, error } = await admin.from("push_subscriptions").select("*");
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e: any) {
      // 404/410 = subscription gone; prune it.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      } else {
        console.error("send-push error:", e?.statusCode, e?.message);
      }
    }
  }
  return new Response(JSON.stringify({ sent, removed, total: subs?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
