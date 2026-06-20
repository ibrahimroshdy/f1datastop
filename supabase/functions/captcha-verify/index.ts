import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Only POST requests are supported" }, 405);
  }

  // Secret comes from environment only. Set with:
  //   supabase secrets set RECAPTCHA_SECRET_KEY=...
  const RECAPTCHA_SECRET_KEY = Deno.env.get("RECAPTCHA_SECRET_KEY");
  if (!RECAPTCHA_SECRET_KEY) {
    console.error("RECAPTCHA_SECRET_KEY not configured");
    return json({ error: "Server misconfigured" }, 500);
  }

  let token: string | undefined;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    return json({ error: "Invalid JSON in request body" }, 400);
  }
  if (!token) {
    return json({ error: "Missing token in request" }, 400);
  }

  try {
    const form = new URLSearchParams();
    form.append("secret", RECAPTCHA_SECRET_KEY);
    form.append("response", token);

    const res = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      { method: "POST", body: form },
    );
    const verification = await res.json();

    if (!verification.success) {
      return json(
        {
          success: false,
          error: "CAPTCHA verification failed",
          details: verification["error-codes"] || [],
        },
        400,
      );
    }

    // reCAPTCHA v3: enforce a score threshold. v2: success is enough.
    if (verification.score !== undefined) {
      const SCORE_THRESHOLD = 0.5;
      if (verification.score < SCORE_THRESHOLD) {
        return json(
          { success: false, error: "CAPTCHA score too low", score: verification.score },
          400,
        );
      }
      return json({ success: true, score: verification.score });
    }

    return json({ success: true });
  } catch (error) {
    console.error("captcha-verify error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
