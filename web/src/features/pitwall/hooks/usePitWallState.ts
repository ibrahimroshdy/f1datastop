import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_PANELS,
  MAX_DRIVERS,
  PANELS,
  PITWALL_SEASONS,
  type CompareMode,
  type PanelId,
  type SessionCode,
} from "../pitwall.config";

export interface PitWallState {
  year: number;
  round: number | null;
  session: SessionCode;
  drivers: string[];
  mode: CompareMode;
  /** Reference driver for delta / overlay comparison. */
  ref: string | null;
  /** Active lap under telemetry review. */
  lap: number | null;
  panels: PanelId[];
}

const VALID_SESSIONS: SessionCode[] = ["FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R"];
const VALID_PANELS = new Set<PanelId>(PANELS.map((p) => p.id));

function parseParams(sp: URLSearchParams): PitWallState {
  const year = Number(sp.get("year")) || PITWALL_SEASONS[0];
  const roundRaw = Number(sp.get("round"));
  const round = roundRaw > 0 ? roundRaw : null;
  const sessRaw = sp.get("session") as SessionCode | null;
  const session = sessRaw && VALID_SESSIONS.includes(sessRaw) ? sessRaw : "R";
  const drivers = (sp.get("drivers") || "")
    .split(",")
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_DRIVERS);
  const mode: CompareMode = sp.get("mode") === "focus" ? "focus" : "overlay";
  const ref = sp.get("ref")?.trim().toUpperCase() || null;
  const lapRaw = Number(sp.get("lap"));
  const lap = lapRaw > 0 ? lapRaw : null;
  const panelsRaw = sp.get("panels");
  const panels = panelsRaw
    ? (panelsRaw.split(",").filter((p) => VALID_PANELS.has(p as PanelId)) as PanelId[])
    : DEFAULT_PANELS;
  return { year, round, session, drivers, mode, ref, lap, panels };
}

function serialize(p: URLSearchParams, s: PitWallState): void {
  p.set("year", String(s.year));
  if (s.round) p.set("round", String(s.round));
  else p.delete("round");
  p.set("session", s.session);
  if (s.drivers.length) p.set("drivers", s.drivers.join(","));
  else p.delete("drivers");
  p.set("mode", s.mode);
  if (s.ref) p.set("ref", s.ref);
  else p.delete("ref");
  if (s.lap != null) p.set("lap", String(s.lap));
  else p.delete("lap");
  const isDefaultPanels =
    s.panels.length === DEFAULT_PANELS.length && DEFAULT_PANELS.every((d) => s.panels.includes(d));
  if (isDefaultPanels) p.delete("panels");
  else p.set("panels", s.panels.join(","));
}

/**
 * Shareable Pit Wall selection, entirely in the URL query string
 * (`?year=&round=&session=&drivers=&mode=&ref=&lap=&panels=`).
 */
export function usePitWallState() {
  const [sp, setSp] = useSearchParams();
  const state = useMemo(() => parseParams(sp), [sp]);

  const patch = useCallback(
    (next: Partial<PitWallState>) => {
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev);
          serialize(p, { ...parseParams(p), ...next });
          return p;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const toggleDriver = useCallback(
    (code: string) => {
      const c = code.trim().toUpperCase();
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev);
          const cur = parseParams(p);
          const has = cur.drivers.includes(c);
          const drivers = has
            ? cur.drivers.filter((d) => d !== c)
            : [...cur.drivers, c].slice(0, MAX_DRIVERS);
          // Keep the reference driver valid; default it to the first selected.
          let ref = cur.ref;
          if (ref && !drivers.includes(ref)) ref = drivers[0] ?? null;
          if (!ref && drivers.length) ref = drivers[0];
          serialize(p, { ...cur, drivers, ref });
          return p;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const togglePanel = useCallback(
    (id: PanelId) => {
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev);
          const cur = parseParams(p);
          const has = cur.panels.includes(id);
          const panels = has
            ? cur.panels.filter((x) => x !== id)
            : (PANELS.map((pp) => pp.id).filter((x) => cur.panels.includes(x) || x === id) as PanelId[]);
          serialize(p, { ...cur, panels });
          return p;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  return { state, patch, toggleDriver, togglePanel };
}
