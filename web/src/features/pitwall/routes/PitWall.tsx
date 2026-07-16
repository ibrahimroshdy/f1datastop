import { useEffect, useMemo } from "react";
import { Flag, Gauge, Radio, Route, Users } from "lucide-react";
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
import { LapCards } from "../components/LapCards";
import { LapTrack } from "../components/LapTrack";
import { LiveInputs } from "../components/LiveInputs";
import { LapPlayBar } from "../components/LapPlayBar";
import { usePitWallState } from "../hooks/usePitWallState";
import { usePitWallData } from "../hooks/usePitWallData";
import { usePitWallTelemetry } from "../hooks/usePitWallTelemetry";
import { useLapPlayhead } from "../hooks/useLapPlayhead";
import { useConstructorByDriver } from "../hooks/useConstructorByDriver";
import { buildLapModel, idxAtTime } from "../lapModel";
import { PANELS, sessionsForRace, type PanelId } from "../pitwall.config";

export default function PitWall() {
  const { state, patch, toggleDriver, togglePanel } = usePitWallState();

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
  const telemetry = usePitWallTelemetry(
    state.year,
    state.round,
    session,
    viewDrivers,
    state.lap,
    data.telemetryIndex,
  );
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

  // ONE playhead (single lap, seconds). Drives the track dot, live inputs and every
  // chart crosshair. Reset on session/round change; retune when the lap set changes.
  const playhead = useLapPlayhead();
  const { setT, pause, setDuration } = playhead;
  useEffect(() => {
    setT(0);
    pause();
  }, [session, state.round, setT, pause]);
  useEffect(() => {
    setDuration(model.maxDur);
  }, [model.maxDur, setDuration]);

  // Sample index for each lap at the current playhead time (time-aligned dots/inputs).
  const indices = model.laps.map((l) => idxAtTime(l.time, playhead.t));
  // Crosshair fraction relative to the reference lap so it lands on the same sample the
  // TelemetryPanel plots (it maps frac·refLapTime back to an index).
  const refLap = model.laps.find((l) => l.code === state.ref) ?? model.laps[0];
  const crosshairFrac = refLap && refLap.dur > 0 ? Math.min(1, playhead.t / refLap.dur) : 0;

  // Static classification frame for the selector board (final order — no 2nd playhead).
  const boardFrame = Math.max(0, (data.blob?.frames ?? 1) - 1);
  const isRace = data.blob?.is_race !== false;
  const setRef = (c: string) => patch({ ref: c, drivers: state.drivers.includes(c) ? state.drivers : [...state.drivers, c] });

  return (
    <div className={cn("w-full px-3 sm:px-4 xl:px-6", pageStack, "animate-fade-in")}>
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
          {/* Header — one lap-card per selected driver */}
          <LapCards laps={model.laps} refCode={state.ref} constructorByDriver={constructorByDriver} onSetRef={setRef} />

          <div className="lg:grid lg:grid-cols-[260px_minmax(320px,360px)_minmax(0,1fr)] lg:items-start lg:gap-3">
            {/* LEFT — driver selector (final classification) */}
            <aside className="mb-3 lg:sticky lg:top-16 lg:mb-0 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
              <DriverBoard
                blob={data.blob}
                frame={boardFrame}
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
              <div className="rounded-2xl border border-border bg-card/40 p-2.5">
                <div className="instrument-label mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Route className="h-3 w-3" /> Track position
                </div>
                <div className="aspect-[4/3] w-full">
                  <LapTrack laps={model.laps} indices={indices} bounds={model.bounds} refCode={state.ref} />
                </div>
                <div className="mt-2">
                  <LapPlayBar playhead={playhead} />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/40 p-2.5">
                <div className="instrument-label mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="h-3 w-3" /> Live inputs
                </div>
                <LiveInputs laps={model.laps} indices={indices} refCode={state.ref} onSetRef={setRef} />
              </div>
              {hasDrivers && (
                <PanelShell title="Stints" icon={PANELS.find((p) => p.id === "stint")!.icon}>
                  <StintStrip blob={data.blob} drivers={data.drivers} selected={viewDrivers} />
                </PanelShell>
              )}
            </div>

            {/* RIGHT — synchronized telemetry chart stack */}
            <div className="min-w-0 space-y-3">
              {!hasDrivers ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Pick drivers from the list on the left to build the console.
                  </p>
                </div>
              ) : (
                <>
                  <PanelShell title="Telemetry" icon={PANELS.find((p) => p.id === "telemetry")!.icon}>
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
                              onSelectLap={(lap) => patch({ lap })}
                            />
                          ) : id === "position" ? (
                            <PositionChart blob={data.blob} selected={viewDrivers} />
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
