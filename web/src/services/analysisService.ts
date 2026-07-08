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
  // Charts are uploaded in 4 social formats; only the landscape (16:9) variant
  // has a bare chart_type — the others are suffixed `_twitter|_instagram|_story`.
  // Show the landscape variant only so the web grid isn't 4x duplicated.
  const rows = (data ?? []) as AnalysisChart[];
  return rows.filter((c) => !/_(twitter|instagram|story)$/.test(c.chart_type));
}
