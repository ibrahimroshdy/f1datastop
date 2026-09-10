import { supabase } from "@/integrations/supabase/client";
import { blobUrl } from "@/lib/blobUrl";
import { cdnJson } from "@/lib/cdnJson";

/** Resolve a chart row's image URLs from its storage paths (R2 host from env). */
export function withChartUrls<T extends { storage_path?: string | null; public_url: string; thumb_path?: string | null }>(row: T): T & { thumb_url?: string } {
  return {
    ...row,
    public_url: blobUrl("charts", row.storage_path, row.public_url),
    thumb_url: row.thumb_path ? blobUrl("charts", row.thumb_path) : undefined,
  };
}

export interface AnalysisChart {
  id: string;
  season: number;
  round: number;
  session: string;
  chart_type: string;
  title: string;
  description: string | null;
  /** host-free key inside the charts bucket; public_url is derived from it */
  storage_path?: string | null;
  public_url: string;
  /** small WebP for grids/lists (null on rows rendered before thumbnails existed) */
  thumb_path?: string | null;
  thumb_url?: string;
}

/** Pre-generated FastF1 charts for a race (from the analysis pipeline). */
/** Chart render theme. Maps from the app's ThemeMode: light→light; dark AND dark-glass
 *  both → dark (glass mode shows the dark chart on its frosted card). */
export type ChartTheme = "dark" | "light";

export async function getAnalysisCharts(
  season: number,
  round: number,
  session = "R",
  theme: ChartTheme = "dark",
): Promise<AnalysisChart[]> {
  if (!season || !round) return [];

  // CDN first: analysis/index_export.py derives this file from the R2 bucket listing
  // after every chart render, so it needs no database at all. Falls through to the
  // analysis_charts table only when the file isn't there (session never rendered).
  const rr = String(round).padStart(2, "0");
  const indexed = await cdnJson<(AnalysisChart & { theme: ChartTheme })[]>(
    `index/charts/${season}/${rr}/${session}.json`,
  );
  if (indexed && indexed.length) {
    const pick = (t: ChartTheme) => indexed.filter((c) => c.theme === t);
    let rows = pick(theme);
    // Fall back to the dark set when the requested theme hasn't been generated yet, so a
    // light viewer still sees charts instead of an empty tab before a full regen.
    if (!rows.length && theme !== "dark") rows = pick("dark");
    return rows
      .slice()
      .sort((a, b) => a.chart_type.localeCompare(b.chart_type))
      .map(withChartUrls);
  }

  const db = (supabase as unknown as { from: (t: string) => any });
  // analysis_charts isn't in the generated Database types; query untyped.
  const query = (t: ChartTheme) =>
    db
      .from("analysis_charts")
      .select("id,season,round,session,chart_type,title,description,storage_path,public_url,thumb_path")
      .eq("season", season)
      .eq("round", round)
      .eq("session", session)
      .eq("theme", t)
      .order("chart_type");

  let { data, error } = await query(theme);
  if (!error && theme !== "dark" && (!data || data.length === 0)) {
    ({ data, error } = await query("dark"));
  }

  if (error) {
    console.warn("[analysisService] getAnalysisCharts:", error.message);
    return [];
  }
  // Charts are uploaded in 4 social formats: the landscape (16:9) variant has a
  // bare chart_type, the others are suffixed `_twitter|_instagram|_story`. Return
  // every variant — the UI groups them by base type and lets the user pick a format.
  return ((data ?? []) as AnalysisChart[]).map(withChartUrls);
}

/** Social export formats. `landscape` = bare chart_type; others carry a suffix. */
export const CHART_FORMATS = ["landscape", "twitter", "instagram", "story"] as const;
export type ChartFormat = (typeof CHART_FORMATS)[number];

/** Strip the format suffix to get the base chart type. Handles a trailing
 *  driver-pair key (e.g. `driver_compare_story__HAM-LEC` → `driver_compare__HAM-LEC`)
 *  so teammate compares stay distinct cards with a working format toggle. */
export function baseChartType(chartType: string): string {
  return chartType.replace(/_(twitter|instagram|story)(?=__|$)/, "");
}

/** Which format a row belongs to (the format suffix may precede a `__pair` key). */
export function chartFormatOf(chartType: string): ChartFormat {
  const m = chartType.match(/_(twitter|instagram|story)(?=__|$)/);
  return m ? (m[1] as ChartFormat) : "landscape";
}
