import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createServiceClient,
  proxyF1Request,
  purgeExpiredCache,
} from "../_shared/f1Cache.ts";

/**
 * Optional cron target (Phase 4.4): purge expired rows and pre-warm
 * current-season standings + schedule.
 *
 * Schedule via Supabase Dashboard → Edge Functions → f1-cache-warm → Cron,
 * e.g. `0 */6 * * *` (every 6 hours).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow POST from cron or service; reject other methods
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const admin = createServiceClient();
    const purged = await purgeExpiredCache(admin);
    const year = new Date().getFullYear();

    const warmTargets = [
      { source: "ergast" as const, path: `/f1/${year}/driverStandings.json` },
      { source: "ergast" as const, path: `/f1/${year}/constructorStandings.json` },
      { source: "ergast" as const, path: `/f1/${year}.json` },
      { source: "openf1" as const, path: "/sessions", params: { session_key: "latest" } },
    ];

    const results = [];
    for (const target of warmTargets) {
      const result = await proxyF1Request(admin, target);
      results.push({
        path: target.path,
        source: target.source,
        cached: result.cached,
        status: result.status,
        error: result.error,
      });
    }

    return jsonResponse({ purged, warmed: results, year });
  } catch (error) {
    console.error("f1-cache-warm error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
