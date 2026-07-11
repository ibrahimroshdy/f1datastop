import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useGameActivation } from "../hooks/useGameActivation";
import {
  getGameSchedule,
  getSeasonDrivers,
  getRoundPicks,
  isPickEditable,
  saveRacePick,
  ACTIVE_GAME_SEASON,
  type SessionType,
} from "../api/gameClient";
import { SessionPredict } from "../components/SessionPredict";
import { Countdown } from "../components/Countdown";

export default function PredictRound() {
  const { round: roundParam } = useParams<{ round: string }>();
  const round = parseInt(roundParam ?? "0", 10);
  const { entryId } = useGameActivation();
  const qc = useQueryClient();

  const schedule = useQuery({ queryKey: ["game", "schedule", ACTIVE_GAME_SEASON], queryFn: () => getGameSchedule() });
  const drivers = useQuery({ queryKey: ["game", "drivers", ACTIVE_GAME_SEASON], queryFn: () => getSeasonDrivers() });
  const picks = useQuery({
    queryKey: ["game", "picks", entryId, round],
    queryFn: () => getRoundPicks(entryId as string, round),
    enabled: !!entryId,
  });
  const editable = useQuery({
    queryKey: ["game", "editable", entryId, round],
    queryFn: () => isPickEditable(entryId as string, round),
    enabled: !!entryId,
  });

  const meta = schedule.data?.find((r) => r.round === round);
  const loading = schedule.isLoading || drivers.isLoading || picks.isLoading || editable.isLoading || !entryId;

  const onSave = async (sessionType: SessionType, driverIds: string[]) => {
    await saveRacePick(round, sessionType, driverIds);
    qc.invalidateQueries({ queryKey: ["game", "picks", entryId, round] });
    qc.invalidateQueries({ queryKey: ["game", "history"] });
  };

  const sessions: { type: SessionType; depth: number }[] = [
    { type: "Q", depth: 10 },
    { type: "R", depth: 10 },
    ...(meta?.is_sprint ? [{ type: "S" as SessionType, depth: 8 }] : []),
  ];

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>

        <div className="space-y-1.5">
          <div className="instrument-label text-primary">
            Round {round}{meta?.is_sprint ? " · Sprint weekend" : ""}
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            {meta?.race_name ?? `Round ${round}`}
          </h1>
          {meta?.deadline && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {editable.data ? (
                <>
                  Locks {format(parseISO(meta.deadline), "EEE dd MMM, HH:mm")} UTC ·{" "}
                  <Countdown to={meta.deadline} className="readout font-semibold" />
                </>
              ) : (
                "Picks are locked for this weekend"
              )}
            </div>
          )}
        </div>

        {loading ? (
          <>
            <F1Skeleton variant="card" className="h-64" />
            <F1Skeleton variant="card" className="h-64" />
          </>
        ) : (
          sessions.map((s) => (
            <SessionPredict
              key={s.type}
              sessionType={s.type}
              depth={s.depth}
              drivers={drivers.data ?? []}
              initial={picks.data?.[s.type] ?? []}
              editable={!!editable.data}
              onSave={(ids) => onSave(s.type, ids)}
            />
          ))
        )}

        {!loading && (drivers.data?.length ?? 0) === 0 && (
          <F1Card>
            <F1CardContent className="py-6 text-sm text-muted-foreground">
              No driver list yet for this season — driver options appear once the grid has run at least one race.
            </F1CardContent>
          </F1Card>
        )}
      </div>
    </div>
  );
}
