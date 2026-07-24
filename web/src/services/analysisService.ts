import { supabase } from "@/integrations/supabase/client";

export interface AnalysisChart {
  id: string;
  season: number;
  round: number;
  session: string;
  chart_type: string;
  title: string;
  description: string | null;
  public_url: string;
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
  const db = (supabase as unknown as { from: (t: string) => any });
  // analysis_charts isn't in the generated Database types; query untyped.
  const query = (t: ChartTheme) =>
    db
      .from("analysis_charts")
      .select("*")
      .eq("season", season)
      .eq("round", round)
      .eq("session", session)
      .eq("theme", t)
      .order("chart_type");

  let { data, error } = await query(theme);
  // Fall back to the dark set when the requested theme hasn't been generated yet, so a
  // light viewer still sees charts instead of an empty tab before a full regen.
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
  return (data ?? []) as AnalysisChart[];
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
