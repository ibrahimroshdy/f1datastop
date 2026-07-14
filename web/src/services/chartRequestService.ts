import { supabase } from "@/integrations/supabase/client";
import type { AnalysisChart } from "./analysisService";

/** Charts where "pick your drivers" makes sense (they honour generate.py --drivers). */
export const CUSTOMIZABLE_CHARTS = [
  { key: "driver_compare", label: "Head to Head (pick 2)" },
  { key: "season_scorecard", label: "Season Scorecard (pick 2)" },
  { key: "dominance_flat", label: "Track Dominance Map" },
  { key: "track_dominance", label: "Dominance Stack (3D)" },
  { key: "parallax_stack", label: "Parallax Stack" },
  { key: "speed_trace", label: "Speed Trace" },
  { key: "driver_radar", label: "Driver Radar" },
] as const;

export type ChartRequestState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "queued" }
  | { status: "processing" }
  | { status: "done"; charts: AnalysisChart[] }
  | { status: "error"; error: string }
  | { status: "unauthenticated" };

/** Stable driver key: unique, uppercased, sorted, '-'-joined — matches generate.py. */
export const driverKeyOf = (codes: string[]) =>
  [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].sort().join("-");

// analysis_charts / f1_chart_requests aren't in the generated Database types.
const db = supabase as unknown as {
  from: (t: string) => any;
  auth: typeof supabase.auth;
};

/** Existing custom-chart rows (all social formats) for a driver set, or []. */
export async function getCustomChart(
  season: number,
  round: number,
  session: string,
  chart: string,
  codes: string[],
): Promise<AnalysisChart[]> {
  const key = driverKeyOf(codes);
  if (!key) return [];
  // Exact match on every social-format variant. NOT `.like(...)` — `_` is a
  // single-char wildcard in SQL LIKE, and both the chart key (e.g. "parallax_stack")
  // and the "__" separator contain underscores, so a LIKE pattern over-matches and
  // could return a DIFFERENT driver set. generate.py names these:
  //   <chart>__<key> (landscape) · <chart>_twitter__<key> · _instagram · _story
  const types = ["", "_twitter", "_instagram", "_story"].map((f) => `${chart}${f}__${key}`);
  const { data, error } = await db
    .from("analysis_charts")
    .select("*")
    .eq("season", season)
    .eq("round", round)
    .eq("session", session)
    .in("chart_type", types)
    .order("chart_type");
  if (error) {
    console.warn("[chartRequest] getCustomChart:", error.message);
    return [];
  }
  return (data ?? []) as AnalysisChart[];
}

/** Queue a custom chart. Returns done immediately if it already exists (dedup). */
export async function submitChartRequest(
  season: number,
  round: number,
  session: string,
  chart: string,
  codes: string[],
): Promise<ChartRequestState> {
  const existing = await getCustomChart(season, round, session, chart, codes);
  if (existing.length) return { status: "done", charts: existing };

  const { data: userData } = await db.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return { status: "unauthenticated" };

  const key = driverKeyOf(codes);
  const drivers = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].sort();
  const { error } = await db.from("f1_chart_requests").insert({
    season,
    round,
    session,
    chart,
    driver_key: key,
    drivers,
    requested_by: uid,
    status: "pending",
  });
  if (error) {
    // 23505 = a request for this exact set already exists → just poll it.
    if ((error as { code?: string }).code === "23505") return { status: "queued" };
    return { status: "error", error: error.message };
  }
  return { status: "queued" };
}

/** Poll: done (chart exists) → processing/queued → error → idle. */
export async function getRequestState(
  season: number,
  round: number,
  session: string,
  chart: string,
  codes: string[],
): Promise<ChartRequestState> {
  const existing = await getCustomChart(season, round, session, chart, codes);
  if (existing.length) return { status: "done", charts: existing };

  const key = driverKeyOf(codes);
  const { data } = await db
    .from("f1_chart_requests")
    .select("status,error")
    .eq("season", season)
    .eq("round", round)
    .eq("session", session)
    .eq("chart", chart)
    .eq("driver_key", key)
    .limit(1)
    .maybeSingle();
  if (!data) return { status: "idle" };
  if (data.status === "error") return { status: "error", error: data.error || "generation failed" };
  return { status: data.status === "processing" ? "processing" : "queued" };
}
