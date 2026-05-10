import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifySlackRequest {
  type: string;
  userData: {
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    provider?: string;
  };
}

// Basic in-memory rate limiter (per cold-start instance)
const rateBuckets = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 5; // requests
const RATE_WINDOW_MS = 60_000; // per minute

function rateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset < now) {
    rateBuckets.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SLACK_WEBHOOK_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    // Rate limit by client IP to prevent flooding
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    if (!rateLimit(clientIp)) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }

    const body = (await req.json()) as NotifySlackRequest;
    const { type, userData } = body;

    if (type !== "signup" || !userData?.email) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    // Verify the email belongs to a real, recently-created auth user.
    // This prevents anonymous abuse: only legitimate fresh signups trigger Slack.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.error("Failed to list users:", listErr);
      return jsonResponse({ error: "Verification failed" }, 500);
    }

    const match = list.users.find(
      (u) => (u.email || "").toLowerCase() === userData.email.toLowerCase(),
    );
    if (!match) {
      return jsonResponse({ error: "User not found" }, 403);
    }

    const createdAt = new Date(match.created_at).getTime();
    if (Date.now() - createdAt > 10 * 60_000) {
      // Only notify within 10 minutes of signup
      return jsonResponse({ error: "Signup window expired" }, 403);
    }

    const provider = userData.provider || "email";
    const headerText =
      provider === "twitter"
        ? "🐦 New Twitter/X User Signup!"
        : provider === "google"
        ? "🔍 New Google User Signup!"
        : "✉️ New Email User Signup!";

    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: headerText, emoji: true },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${userData.firstName || "Not provided"} ${userData.lastName || ""}`,
            },
            {
              type: "mrkdwn",
              text: `*Username:*\n${userData.username || "Not provided"}`,
            },
          ],
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Email:*\n${userData.email}` },
            { type: "mrkdwn", text: `*Auth Provider:*\n${provider}` },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Signup received from F1 DataStop application`,
            },
          ],
        },
      ],
    };

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Slack error:", response.status, text);
      return jsonResponse({ error: "Slack notification failed" }, 502);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("notify-slack error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
