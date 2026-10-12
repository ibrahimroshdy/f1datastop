import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { F1Card, F1Skeleton, DriverAvatar } from "@/components/f1";
import { normalizeTeamId, getTeamHexColor } from "@/components/standings/standingsUtils";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";

interface Edition {
  season: number;
  round: number;
  race_name?: string;
  winner?: string;
  winner_name?: string;
  winner_id?: string;
  winner_team?: string;
  winner_team_id?: string;
  pole?: string;
}

const headshot = (id?: string) => {
  const p = id ? getF1PortraitPathForErgastDriverId(id) : undefined;
  return p ? buildF1DriverHeadshotUrl(p) : undefined;
};
const teamHex = (teamId?: string) => getTeamHexColor(normalizeTeamId(teamId || "default"));

/**
 * "This track across the years" — every edition's winner + pole, and a most-wins
 * tally. Interactive twin of the `circuit_history` poster. Warehouse-backed via
 * get_circuit_history_by_circuit. Renders nothing until there are ≥2 editions.
 */
export default function CircuitHistoryCard({ circuitId }: { circuitId?: string }) {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();

  const { data, isLoading } = useQuery({
    queryKey: ["circuitHistory", circuitId],
    enabled: !!circuitId,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: object,
        ) => Promise<{ data: Edition[] | null; error: unknown }>
      )("get_circuit_history_by_circuit", { p_circuit_id: circuitId });
      if (error) return [] as Edition[];
      return (data ?? []) as Edition[];
    },
  });

  const eds = useMemo(() => (data ?? []).filter((e) => e.winner), [data]);

  const wins = useMemo(() => {
    const m = new Map<string, { n: number; teamId?: string }>();
    for (const e of eds) {
      const cur = m.get(e.winner!) ?? { n: 0, teamId: e.winner_team_id };
      m.set(e.winner!, { n: cur.n + 1, teamId: cur.teamId ?? e.winner_team_id });
    }
    return [...m.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [eds]);

  if (isLoading) {
    return <F1Skeleton variant="card" className="h-56" />;
  }
  if (eds.length < 2) return null;
  const maxWins = wins[0]?.n ?? 1;

  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <History className="h-3 w-3" />
          Circuit History
        </div>
        <span className="timing text-2xs text-muted-foreground">{eds.length} editions</span>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.4fr_1fr] md:divide-x md:divide-border">
        {/* editions timeline */}
        <ul className="divide-y divide-border">
          {eds.map((e) => (
            <li key={`${e.season}-${e.round}`} className="flex items-center gap-3 px-4 py-2">
              <span className="timing w-10 shrink-0 text-sm text-muted-foreground">{e.season}</span>
              <span
                className="h-7 w-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: teamHex(e.winner_team_id) }}
                aria-hidden
              />
              <DriverAvatar
                driverCode={e.winner ?? ""}
                driverName={e.winner_name ?? e.winner ?? ""}
                teamColor={teamHex(e.winner_team_id)}
                size="sm"
                src={headshot(e.winner_id)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight">
                  {e.winner_name ?? e.winner}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="timing font-medium">{e.winner}</span>
                  <span className="opacity-40">·</span>
                  <span className="truncate">{e.winner_team}</span>
                </div>
              </div>
              {e.pole && (
                <span className="timing shrink-0 text-2xs text-muted-foreground">
                  pole {e.pole}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* most wins here */}
        <div className="p-4">
          <div className="instrument-label mb-3 flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="h-3 w-3" />
            Most wins here
          </div>
          <div className="space-y-2">
            {wins.map((w) => (
              <div key={w.code} className="flex items-center gap-2.5">
                <span className="timing w-9 shrink-0 text-xs font-semibold">{w.code}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(w.n / maxWins) * 100}%`, backgroundColor: teamHex(w.teamId) }}
                  />
                </div>
                <span className="timing w-4 shrink-0 text-right text-xs tabular-nums">{w.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </F1Card>
  );
}
