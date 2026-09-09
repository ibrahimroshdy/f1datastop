import { supabase } from "@/integrations/supabase/client";
import type { AnalysisChart, ChartFormat, ChartTheme } from "./analysisService";
import { chartFormatOf, withChartUrls } from "./analysisService";

/** Charts where "pick your drivers" makes sense (they honour generate.py --drivers).
 *  `max` is the driver cap the chart is actually designed around — head-to-head layouts
 *  only have room for two, the rest read fine up to five. */
export const CUSTOMIZABLE_CHARTS = [
  { key: "driver_compare", label: "Head to Head", max: 2 },
  { key: "season_scorecard", label: "Season Scorecard", max: 2 },
  { key: "dominance_flat", label: "Track Dominance Map", max: 5 },
  { key: "track_dominance", label: "Dominance Stack (3D)", max: 5 },
  { key: "parallax_stack", label: "Parallax Stack", max: 5 },
  { key: "speed_trace", label: "Speed Trace", max: 5 },
  { key: "driver_radar", label: "Driver Radar", max: 5 },
] as const;

/** Driver cap for a chart key (defaults to 5 for anything unknown). */
export const maxDriversFor = (chart: string): number =>
  CUSTOMIZABLE_CHARTS.find((c) => c.key === chart)?.max ?? 5;

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
  // No codes = the standard (non-custom) chart: its variants have no "__key" suffix.
  // Exact match on every social-format variant. NOT `.like(...)` — `_` is a
  // single-char wildcard in SQL LIKE, and both the chart key (e.g. "parallax_stack")
  // and the "__" separator contain underscores, so a LIKE pattern over-matches and
  // could return a DIFFERENT driver set. generate.py names these:
  //   <chart>__<key> (landscape) · <chart>_twitter__<key> · _instagram · _story
  const types = ["", "_twitter", "_instagram", "_story"].map((f) => `${chart}${f}${key ? `__${key}` : ""}`);
  const { data, error } = await db
    .from("analysis_charts")
    .select("id,season,round,session,chart_type,title,description,storage_path,public_url,thumb_path")
    .eq("season", season)
    .eq("round", round)
    .eq("session", session)
    .in("chart_type", types)
    .order("chart_type");
  if (error) {
    console.warn("[chartRequest] getCustomChart:", error.message);
    return [];
  }
  return ((data ?? []) as AnalysisChart[]).map(withChartUrls);
}

/** Queue a custom chart. Returns done immediately if it already exists (dedup). */
export async function submitChartRequest(
  season: number,
  round: number,
  session: string,
  chart: string,
  codes: string[],
  format: ChartFormat = "landscape",
  theme: ChartTheme = "dark",
): Promise<ChartRequestState> {
  // Dedup against the exact variant asked for: bulk runs only pre-render the landscape
  // master, so a twitter/instagram/story request is new even when landscape exists.
  const existing = (await getCustomChart(season, round, session, chart, codes))
    .filter((c) => chartFormatOf(c.chart_type) === format);
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
    format,
    theme,
    requested_by: uid,
    status: "pending",
  });
  if (error) {
    // 23505 = a request for this exact set already exists. It may be a stale FAILED one
    // (the unique key has no status in it), and since we got here the chart itself is
    // still missing — so flip it back to pending to retry rather than leaving the user
    // staring at an old error they can never clear. The dispatch trigger fires on this
    // transition too, so the retry actually re-runs.
    if ((error as { code?: string }).code === "23505") {
      await db
        .from("f1_chart_requests")
        .update({ status: "pending", error: null, updated_at: new Date().toISOString() })
        .eq("season", season)
        .eq("round", round)
        .eq("session", session)
        .eq("chart", chart)
        .eq("driver_key", key)
        .neq("status", "processing"); // don't yank one mid-flight
      return { status: "queued" };
    }
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
  format: ChartFormat = "landscape",
  theme: ChartTheme = "dark",
): Promise<ChartRequestState> {
  const existing = (await getCustomChart(season, round, session, chart, codes))
    .filter((c) => chartFormatOf(c.chart_type) === format);
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
    .eq("format", format)
    .eq("theme", theme)
    .limit(1)
    .maybeSingle();
  if (!data) return { status: "idle" };
  if (data.status === "error") return { status: "error", error: data.error || "generation failed" };
  // A row marked done whose chart we couldn't find above means the artifact never landed
  // (or was named differently). Reporting "queued" here would spin the UI forever, so say
  // so plainly instead.
  if (data.status === "done") {
    return { status: "error", error: "chart finished but no image was found — try again" };
  }
  return { status: data.status === "processing" ? "processing" : "queued" };
}
