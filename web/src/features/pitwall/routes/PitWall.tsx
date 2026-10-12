import { useEffect, useMemo } from "react";
import { Flag, Gauge, Pin, Radio, Route, X } from "lucide-react";
import Seo from "@/components/common/Seo";
import { pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useRaceSchedule } from "@/hooks/f1/useSchedule";
import type { RaceContext } from "@/components/race-analysis/RaceAnalysisHeader";
import { ContextBar } from "../components/ContextBar";
import { PanelShell } from "../components/PanelShell";
import { LapTimePanel } from "../components/LapTimePanel";
import { TelemetryPanel } from "../components/TelemetryPanel";
import { PositionChart } from "../components/PositionChart";
import { WeatherStrip } from "../components/WeatherStrip";
import { StintStrip } from "../components/StintStrip";
import { DriverBoard } from "../components/DriverBoard";
import { CockpitTrack } from "../components/CockpitTrack";
import { LiveInputs } from "../components/LiveInputs";
import { RaceProgressBar } from "../components/RaceProgressBar";
import { usePitWallState } from "../hooks/usePitWallState";
import { usePitWallData } from "../hooks/usePitWallData";
import { usePitWallTelemetry } from "../hooks/usePitWallTelemetry";
import { F1Card, F1EmptyState } from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { useReplayPlayhead } from "../hooks/useReplayPlayhead";
import { useConstructorByDriver } from "../hooks/useConstructorByDriver";
import { buildLapModel, idxAtTime } from "../lapModel";
import { computeTiming, refLapFrac } from "../replayEngine";
import { PANELS, sessionsForRace, type PanelId } from "../pitwall.config";

export default function PitWall() {
  const { state, patch, toggleDriver, togglePanel } = usePitWallState();
  const { cardVariant, glassVariant } = useThemeVariant();

  const schedule = useRaceSchedule(state.year);
  const races = (schedule.data?.data ?? []) as (RaceContext & { date?: string })[];
  const currentRace = useMemo(
    () => races.find((r) => Number(r.round) === state.round) ?? null,
    [races, state.round],
  );
  // Clamp the session to what this weekend actually has (URL may carry a stale S).
  const session = sessionsForRace(currentRace).some((s) => s.code === state.session)
    ? state.session
    : "R";

  const data = usePitWallData(state.year, state.round, session);
  // Focus mode = deep-dive the reference (starred) driver; Overlay = compare all selected.
  const viewDrivers =
    state.mode === "focus"
      ? state.ref && state.drivers.includes(state.ref)
        ? [state.ref]
        : state.drivers.slice(0, 1)
      : state.drivers;

  // ONE transport — the whole-race player. Its frame drives the live driver order, the
  // telemetry crosshair (via the reference car's within-lap fraction) and the cockpit.
  const replay = useReplayPlayhead(data.blob?.frames ?? 1);
  const { setFrame, setPlaying } = replay;
  useEffect(() => {
    setFrame(0);
    setPlaying(false);
  }, [session, state.round, setFrame, setPlaying]);

  // Leader's current lap at this frame — the auto-follow lap for telemetry + chart markers.
  const leaderLap = useMemo(
    () => (data.blob ? computeTiming(data.blob, Math.round(replay.frame)).leaderLap : 0),
    [data.blob, replay.frame],
  );
  // Telemetry lap: Fastest mode = each driver's fastest lap (lap=null resolves to it);
  // else a pinned lap (clicked on the Lap Times chart) wins; else auto-follow the leader.
  const pinned = state.lap != null && !state.fastest;
  const effectiveLap = state.fastest ? null : state.lap ?? (leaderLap > 0 ? leaderLap : null);

  const telemetry = usePitWallTelemetry(
    state.year,
    state.round,
    session,
    viewDrivers,
    effectiveLap,
    data.telemetryIndex,
  );
  // Honesty flag: the requested lap wasn't exported, so a driver's trace fell back to its
  // fastest lap (per-lap telemetry isn't seeded yet).
  const shownLap = telemetry.find((t) => t.state?.status === "done")?.lap ?? null;
  const usingFastest = !pinned && !state.fastest && shownLap != null && leaderLap > 0 && shownLap !== leaderLap;
  const hasDrivers = state.drivers.length > 0;
  const constructorByDriver = useConstructorByDriver(state.year);

  // The synchronized single-lap model — one racing line + a time base per driver.
  const model = useMemo(
    () => buildLapModel(telemetry, data.drivers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      telemetry
        .map((t) => (t.state?.status === "done" ? `${t.code}:${t.lap}` : `${t.code}:_`))
        .join("|"),
      data.drivers,
    ],
  );

  // Where the reference car sits on its current lap → 0–1 crosshair fraction.
  const crosshairFrac = data.blob
    ? refLapFrac(data.blob, state.ref ?? viewDrivers[0] ?? null, replay.frame)
    : 0;
  // Each lap's sample at that same within-lap fraction (time-aligned dots + inputs).
  const indices = model.laps.map((l) => idxAtTime(l.time, crosshairFrac * l.dur));
  // Fractional current lap → the chart markers glide smoothly instead of jumping per lap.
  const currentLapF = leaderLap > 0 ? leaderLap + Math.min(0.999, crosshairFrac) : crosshairFrac;
  const isRace = data.blob?.is_race !== false;
  const setRef = (c: string) => patch({ ref: c, drivers: state.drivers.includes(c) ? state.drivers : [...state.drivers, c] });

  return (
    <div className={cn("w-full px-3 sm:px-4 xl:px-6", pageStack, "animate-fade-in")}>
      <Seo
        title="Pit Wall — Telemetry Console"
        path="/pit-wall"
        description="Race-engineer console: any-lap telemetry, track map, sector times and side-by-side driver traces."
      />
      <div className="space-y-1">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <Radio className="h-3 w-3" /> Pit Wall
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">The Pit Wall</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          A race engineer's console — telemetry, gaps and inputs synchronized on one lap.
          Pick a Grand Prix and your drivers, then press play.
        </p>
      </div>

      <ContextBar state={{ ...state, session }} patch={patch} />

      {!state.round ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Flag className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a Grand Prix above to load the session.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* The race player — lap counter, VSC/SC/overtake timeline, scrub + speed */}
          {data.blob && <RaceProgressBar blob={data.blob} playhead={replay} />}

          <div className="lg:grid lg:grid-cols-[260px_minmax(320px,360px)_minmax(0,1fr)] lg:items-start lg:gap-3">
            {/* LEFT — live driver selector */}
            <aside className="mb-3 lg:sticky lg:top-16 lg:mb-0 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
              <DriverBoard
                blob={data.blob}
                frame={replay.frame}
                isRace={isRace}
                drivers={data.drivers}
                selected={state.drivers}
                refCode={state.ref}
                year={state.year}
                constructorByDriver={constructorByDriver}
                onToggle={toggleDriver}
                onSetRef={(c) => patch({ ref: c })}
              />
            </aside>

            {/* MIDDLE — cockpit: track + transport + live inputs + stints */}
            <div className="mb-3 space-y-2.5 lg:sticky lg:top-16 lg:mb-0">
              <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm" className="rounded-2xl p-2.5">
                <div className="instrument-label mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Route className="h-3 w-3" /> Track position
                </div>
                <div className="aspect-4/3 w-full">
                  {data.blob ? (
                    <CockpitTrack blob={data.blob} geom={data.geom} frame={replay.frame} selected={state.drivers} />
                  ) : (
                    <div className="grid h-full place-items-center text-2xs text-muted-foreground">Track loads with the session</div>
                  )}
                </div>
              </F1Card>
              <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm" className="rounded-2xl p-2.5">
                <div className="instrument-label mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="h-3 w-3" /> Live inputs
                </div>
                <LiveInputs laps={model.laps} indices={indices} refCode={state.ref} onSetRef={setRef} />
              </F1Card>
              {hasDrivers && (
                <PanelShell title="Stints" icon={PANELS.find((p) => p.id === "stint")!.icon}>
                  <StintStrip blob={data.blob} drivers={data.drivers} selected={viewDrivers} />
                </PanelShell>
              )}
            </div>

            {/* RIGHT — synchronized telemetry chart stack */}
            <div className="min-w-0 space-y-3">
              {!hasDrivers ? (
                <F1EmptyState
                  type="no-drivers"
                  title="No drivers selected"
                  description="Pick drivers from the list on the left to build the console."
                  size="sm"
                  className="rounded-2xl border border-dashed border-border"
                />
              ) : (
                <>
                  <PanelShell title="Telemetry" icon={PANELS.find((p) => p.id === "telemetry")!.icon}>
                    {/* Lap mode: Auto-follow · each driver's Fastest lap · or a pinned lap */}
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <div className="flex overflow-hidden rounded-full border border-border text-2xs font-semibold">
                        <button
                          type="button"
                          onClick={() => patch({ fastest: false, lap: null })}
                          className={cn("px-2.5 py-0.5 transition-colors", !state.fastest && !pinned ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => patch({ fastest: true, lap: null })}
                          className={cn("flex items-center gap-1 px-2.5 py-0.5 transition-colors", state.fastest ? "bg-fastest-lap text-black" : "text-muted-foreground hover:text-foreground")}
                        >
                          <Gauge className="h-3 w-3" /> Fastest lap
                        </button>
                      </div>
                      {state.fastest ? (
                        <span className="text-2xs text-muted-foreground">each driver's fastest lap · compare</span>
                      ) : pinned ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
                          <Pin className="h-3 w-3" /> Lap {state.lap} pinned
                          <button type="button" onClick={() => patch({ lap: null })} className="ml-0.5 hover:text-foreground" aria-label="Unpin — auto-follow">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground"
                          title={usingFastest ? "Per-lap telemetry isn't in the database yet, so each trace shows that driver's fastest lap." : undefined}
                        >
                          following lap {leaderLap || "—"}
                          {usingFastest && <span className="text-muted-foreground">· <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-fastest-lap align-middle" aria-hidden />fastest-lap shown (per-lap not synced)</span>}
                        </span>
                      )}
                    </div>
                    <TelemetryPanel
                      telemetry={telemetry}
                      drivers={data.drivers}
                      refCode={state.ref}
                      mode={state.mode}
                      crosshairFrac={crosshairFrac}
                    />
                  </PanelShell>

                  {/* Optional analysis panels (lap chart, positions, weather) */}
                  <div className="flex flex-wrap gap-1.5">
                    {PANELS.filter((p) => !["telemetry", "stint"].includes(p.id)).map((p) => {
                      const on = state.panels.includes(p.id);
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePanel(p.id)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors",
                            on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3 w-3" /> {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {(state.panels as PanelId[])
                    .filter((id) => !["telemetry", "stint"].includes(id))
                    .map((id) => {
                      const def = PANELS.find((p) => p.id === id);
                      if (!def) return null;
                      return (
                        <PanelShell key={id} title={def.label} icon={def.icon} onHide={() => togglePanel(id)}>
                          {id === "lap" ? (
                            <LapTimePanel
                              blob={data.blob}
                              selected={viewDrivers}
                              activeLap={state.lap}
                              currentLap={currentLapF}
                              onSelectLap={(lap) => patch({ lap: state.lap === lap ? null : lap })}
                            />
                          ) : id === "position" ? (
                            <PositionChart blob={data.blob} selected={viewDrivers} currentLap={currentLapF} />
                          ) : id === "weather" ? (
                            <WeatherStrip year={state.year} round={state.round} session={session} />
                          ) : null}
                        </PanelShell>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
