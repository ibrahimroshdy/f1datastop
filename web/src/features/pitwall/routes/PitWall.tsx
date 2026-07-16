import { useEffect, useMemo } from "react";
import { Flag, Radio, Users } from "lucide-react";
import { pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useRaceSchedule } from "@/hooks/f1/useSchedule";
import type { RaceContext } from "@/components/race-analysis/RaceAnalysisHeader";
import { ContextBar } from "../components/ContextBar";
import { DriverRail } from "../components/DriverRail";
import { PanelShell } from "../components/PanelShell";
import { LapTimePanel } from "../components/LapTimePanel";
import { TelemetryPanel } from "../components/TelemetryPanel";
import { TimingPanel } from "../components/TimingPanel";
import { WeatherStrip } from "../components/WeatherStrip";
import { StintStrip } from "../components/StintStrip";
import { DriverDossier } from "../components/DriverDossier";
import { ReplayStage } from "../components/ReplayStage";
import { usePitWallState } from "../hooks/usePitWallState";
import { usePitWallData } from "../hooks/usePitWallData";
import { usePitWallTelemetry } from "../hooks/usePitWallTelemetry";
import { useReplayPlayhead } from "../hooks/useReplayPlayhead";
import { refLapFrac } from "../replayEngine";
import { PANELS, sessionsForRace, type PanelId } from "../pitwall.config";

function Placeholder({ hint }: { hint: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
      {hint}
    </div>
  );
}

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

  // ONE playhead for the whole console — the Race Control replay. Its frame drives the
  // track dots + timing board AND, via the reference car's position on its lap, the
  // crosshair that sweeps every telemetry chart. Reset when the session/round changes.
  const replay = useReplayPlayhead(data.blob?.frames ?? 1);
  useEffect(() => {
    replay.setFrame(0);
    replay.setPlaying(false);
  }, [session, state.round, replay.setFrame, replay.setPlaying]);
  const crosshairFrac = data.blob
    ? refLapFrac(data.blob, state.ref ?? viewDrivers[0] ?? null, replay.frame)
    : 0;

  return (
    <div className={cn("mx-auto w-full max-w-[1800px] px-3 sm:px-4 xl:px-6", pageStack, "animate-fade-in")}>
      <div className="space-y-1">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <Radio className="h-3 w-3" /> Pit Wall
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
          The Pit Wall
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          A race engineer's console — telemetry, replay, gaps, sectors, tyres and weather
          for any driver, any lap. Pick a Grand Prix and your drivers to begin.
        </p>
      </div>

      <ContextBar state={{ ...state, session }} patch={patch} />

      {!state.round ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Flag className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a Grand Prix above to load the session.</p>
        </div>
      ) : (
        <>
          {/* Race Control — whole-race replay: track + live timing board + RC feed */}
          <PanelShell title="Race Control" icon={Radio}>
            <ReplayStage
              year={state.year}
              round={state.round}
              blob={data.blob}
              selected={state.drivers}
              playhead={replay}
            />
          </PanelShell>

          <div className="lg:grid lg:grid-cols-[minmax(190px,230px)_minmax(0,1fr)] lg:gap-3">
          {/* Driver rail */}
          <aside className="mb-3 lg:mb-0">
            <div className="lg:sticky lg:top-16">
              <div className="mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="instrument-label text-muted-foreground">
                  Drivers {hasDrivers ? `· ${state.drivers.length}` : ""}
                </span>
              </div>
              <DriverRail
                year={state.year}
                drivers={data.drivers}
                selected={state.drivers}
                refCode={state.ref}
                mode={state.mode}
                onToggle={toggleDriver}
                onSetRef={(c) => patch({ ref: c })}
                isLoading={data.isLoading}
              />
            </div>
          </aside>

          {/* Panels */}
          <div className="min-w-0 space-y-3">
            {hasDrivers && (
              <DriverDossier
                year={state.year}
                blob={data.blob}
                drivers={data.drivers}
                selected={viewDrivers}
                refCode={state.ref}
              />
            )}
            {/* Panel visibility toggles */}
            <div className="flex flex-wrap gap-1.5">
              {PANELS.map((p) => {
                const on = state.panels.includes(p.id);
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePanel(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors",
                      on
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" /> {p.label}
                  </button>
                );
              })}
            </div>

            {!hasDrivers ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
                <Users className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Pick one or more drivers from the rail to build the console.
                </p>
              </div>
            ) : (
              (state.panels as PanelId[]).map((id) => {
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
                    ) : id === "telemetry" ? (
                      <TelemetryPanel
                        telemetry={telemetry}
                        drivers={data.drivers}
                        refCode={state.ref}
                        mode={state.mode}
                        crosshairFrac={crosshairFrac}
                      />
                    ) : id === "tower" ? (
                      <TimingPanel blob={data.blob} selected={viewDrivers} />
                    ) : id === "stint" ? (
                      <StintStrip blob={data.blob} drivers={data.drivers} selected={viewDrivers} />
                    ) : id === "weather" ? (
                      <WeatherStrip year={state.year} round={state.round} session={session} />
                    ) : (
                      <Placeholder hint={`${def.label} — wiring in progress`} />
                    )}
                  </PanelShell>
                );
              })
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
