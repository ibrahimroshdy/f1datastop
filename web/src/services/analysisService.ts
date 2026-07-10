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
export async function getAnalysisCharts(
  season: number,
  round: number,
  session = "R",
): Promise<AnalysisChart[]> {
  if (!season || !round) return [];
  // analysis_charts isn't in the generated Database types; query untyped.
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => any;
  })
    .from("analysis_charts")
    .select("*")
    .eq("season", season)
    .eq("round", round)
    .eq("session", session)
    .order("chart_type");

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

/** Strip a format suffix to get the base chart type (e.g. `top_speed_story` → `top_speed`). */
export function baseChartType(chartType: string): string {
  return chartType.replace(/_(twitter|instagram|story)$/, "");
}

/** Which format a row belongs to. */
export function chartFormatOf(chartType: string): ChartFormat {
  const m = chartType.match(/_(twitter|instagram|story)$/);
  return m ? (m[1] as ChartFormat) : "landscape";
}
