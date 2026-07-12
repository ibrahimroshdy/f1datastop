import type { DbRaceControlRow } from "@/services/warehouseEnrichment";

/**
 * Safety-car / VSC / red-flag periods derived from FastF1 race-control messages
 * (the `f1_race_control` table). Each period is a lap range so charts with a lap
 * x-axis can shade it. There is no dedicated track-status feed ingested — the
 * message text + flag column carry the events, so we parse them here.
 */
export type SafetyPeriodKind = "SC" | "VSC" | "RED";

export interface SafetyPeriod {
  kind: SafetyPeriodKind;
  startLap: number;
  endLap: number;
  label: string; // "Safety Car" | "Virtual SC" | "Red Flag"
}

const KIND_LABEL: Record<SafetyPeriodKind, string> = {
  SC: "Safety Car",
  VSC: "Virtual SC",
  RED: "Red Flag",
};

/** Short tag for a band overlay. */
export const kindTag = (k: SafetyPeriodKind): string =>
  k === "SC" ? "SC" : k === "VSC" ? "VSC" : "RED";

/**
 * Parse race-control rows into SC/VSC/red-flag lap ranges.
 *
 * FastF1 message conventions we rely on:
 *  - Safety car:  "SAFETY CAR DEPLOYED" … "SAFETY CAR IN THIS LAP" (withdraws)
 *  - Virtual SC:  "VIRTUAL SAFETY CAR DEPLOYED" … "VIRTUAL SAFETY CAR ENDING"
 *  - Red flag:    Flag = "RED" / "RED FLAG"  … cleared by a GREEN flag / "TRACK CLEAR"
 *
 * An event left open (no explicit end) is closed at the last known lap.
 */
export function deriveSafetyPeriods(rows: DbRaceControlRow[] | undefined | null): SafetyPeriod[] {
  if (!rows || rows.length === 0) return [];

  const withLap = rows.filter((r) => r.lap_number != null);
  if (withLap.length === 0) return [];

  const maxLap = Math.max(1, ...withLap.map((r) => r.lap_number as number));
  const ordered = [...withLap].sort(
    (a, b) =>
      (a.lap_number as number) - (b.lap_number as number) ||
      String(a.time_utc ?? "").localeCompare(String(b.time_utc ?? "")),
  );

  const periods: SafetyPeriod[] = [];
  let openSC: SafetyPeriod | null = null;
  let openVSC: SafetyPeriod | null = null;
  let openRed: SafetyPeriod | null = null;
  const open = (kind: SafetyPeriodKind, lap: number): SafetyPeriod => ({
    kind,
    startLap: lap,
    endLap: lap,
    label: KIND_LABEL[kind],
  });
  const close = (p: SafetyPeriod, lap: number) => {
    p.endLap = Math.max(p.startLap, lap);
    periods.push(p);
  };

  for (const m of ordered) {
    const lap = m.lap_number as number;
    const msg = (m.message ?? "").toUpperCase();
    const flag = (m.flag ?? "").toUpperCase();
    const isVirtual = msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC");
    const isDeploy = msg.includes("DEPLOY");
    const isEnd = msg.includes("ENDING") || msg.includes("IN THIS LAP");

    // Red flag — flag column is the reliable signal.
    if (flag === "RED" || msg.includes("RED FLAG")) {
      if (!openRed) openRed = open("RED", lap);
      continue;
    }
    if ((flag === "GREEN" || msg.includes("GREEN") || msg.includes("TRACK CLEAR")) && openRed) {
      close(openRed, lap);
      openRed = null;
      // a green also clears SC/VSC that never got an explicit "ending"
      if (openVSC) { close(openVSC, lap); openVSC = null; }
      if (openSC) { close(openSC, lap); openSC = null; }
      continue;
    }

    // Virtual safety car
    if (isVirtual) {
      if (isDeploy && !openVSC) openVSC = open("VSC", lap);
      else if (isEnd && openVSC) { close(openVSC, lap); openVSC = null; }
      continue;
    }

    // Safety car (non-virtual)
    if (msg.includes("SAFETY CAR")) {
      if (isDeploy && !openSC) openSC = open("SC", lap);
      else if (isEnd && openSC) { close(openSC, lap); openSC = null; }
      continue;
    }
  }

  // Close anything still open at the end of the data.
  for (const p of [openSC, openVSC, openRed]) if (p) close(p, maxLap);

  return periods.sort((a, b) => a.startLap - b.startLap);
}
