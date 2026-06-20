import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  createServiceClient,
  proxyF1Request,
  type F1Source,
  type ProxyRequest,
} from "../_shared/f1Cache.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as ProxyRequest;
    const source = body.source as F1Source;

    if (source !== "ergast" && source !== "openf1") {
      return jsonResponse({ error: "Invalid source" }, 400);
    }
    if (!body.path || typeof body.path !== "string") {
      return jsonResponse({ error: "path is required" }, 400);
    }

    const admin = createServiceClient();
    const result = await proxyF1Request(admin, {
      source,
      path: body.path,
      params: body.params,
    });

    if (result.error && result.status !== 200) {
      return jsonResponse(
        {
          data: result.data,
          cached: result.cached,
          cacheKey: result.cacheKey,
          error: result.error,
        },
        result.status,
      );
    }

    return jsonResponse({
      data: result.data,
      cached: result.cached,
      cacheKey: result.cacheKey,
      status: result.status,
    });
  } catch (error) {
    console.error("f1-proxy error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
