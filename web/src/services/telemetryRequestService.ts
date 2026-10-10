import { supabase } from "@/integrations/supabase/client";
import {
  fetchTelemetryBlob,
  getTelemetryIndex,
  type TelemetryBlob,
  type TelemetryIndexRow,
} from "./telemetryService";

/**
 * On-demand "any-lap" telemetry. Fastest laps per driver are pre-exported and public;
 * any OTHER lap is generated on demand by the CircleCI exporter (telemetry_export.py --lap,
 * drained by process_telemetry_requests). Requests are anonymous, like custom charts
 * (f1_chart_requests).
 */
export type LapTelemetryState =
  | { status: "idle" }
  | { status: "queued" } // request row exists, waiting for the drainer
  | { status: "processing" } // drainer is exporting it now
  | { status: "done"; blob: TelemetryBlob }
  | { status: "error"; error: string };

// f1_telemetry_requests isn't in the generated Database types — untyped cast, mirrors
// services/chartRequestService.ts.
const db = supabase as unknown as {
  from: (t: string) => any;
};

const codeOf = (driver: string) => driver.trim().toUpperCase();

/** Already-exported telemetry row for a specific driver+lap (else null). */
export async function findLapIndexRow(
  season: number,
  round: number,
  session: string,
  driver: string,
  lap: number,
): Promise<TelemetryIndexRow | null> {
  // Must be the full index: this answers "does lap N already exist", and the caller
  // queues an export when the answer is no. A fastest-only index reports every other
  // lap as missing and re-queues work that is already on disk.
  const rows = await getTelemetryIndex(season, round, session, "all");
  const code = codeOf(driver);
  return rows.find((r) => r.driver_code === code && r.lap_number === lap) ?? null;
}

/** Queue an on-demand any-lap export (anonymous). */
export async function submitTelemetryLap(
  season: number,
  round: number,
  session: string,
  driver: string,
  lap: number,
): Promise<LapTelemetryState> {
  const { error } = await db.from("f1_telemetry_requests").insert({
    season,
    round,
    session,
    driver: codeOf(driver),
    lap_number: lap,
    status: "pending",
  });
  if (error) {
    // 23505 = a request for this exact lap already exists → just poll it.
    if ((error as { code?: string }).code === "23505") return { status: "queued" };
    return { status: "error", error: error.message };
  }
  return { status: "queued" };
}

/** Status of a queued request (after the index check misses). "idle" = no row yet. */
export async function getLapRequestState(
  season: number,
  round: number,
  session: string,
  driver: string,
  lap: number,
): Promise<LapTelemetryState> {
  const { data } = await db
    .from("f1_telemetry_requests")
    .select("status,error")
    .eq("season", season)
    .eq("round", round)
    .eq("session", session)
    .eq("driver", codeOf(driver))
    .eq("lap_number", lap)
    .limit(1)
    .maybeSingle();
  if (!data) return { status: "idle" };
  if (data.status === "error") return { status: "error", error: data.error || "generation failed" };
  if (data.status === "processing") return { status: "processing" };
  // pending OR done-but-index-not-visible-yet → keep polling; the index read wins next tick.
  return { status: "queued" };
}

/**
 * One tick of resolving a driver+lap: return the blob if exported, else enqueue (once)
 * and report the queue status. Suitable as a react-query queryFn with polling.
 */
export async function resolveLapTelemetry(
  season: number,
  round: number,
  session: string,
  driver: string,
  lap: number,
): Promise<LapTelemetryState> {
  const row = await findLapIndexRow(season, round, session, driver, lap);
  if (row) return { status: "done", blob: await fetchTelemetryBlob(row.public_url) };
  const st = await getLapRequestState(season, round, session, driver, lap);
  if (st.status === "idle") return submitTelemetryLap(season, round, session, driver, lap);
  return st;
}
