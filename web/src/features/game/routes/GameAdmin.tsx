import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { isGameAdmin } from "../utils/isGameAdmin";
import { ACTIVE_GAME_SEASON } from "../api/gameClient";
import {
  adminStats, adminListPlayers, adminListLeagues, adminRegrade, adminUpdateSeason,
  openSeason, getAuditLog, getSeasonConfig, adminBroadcast,
} from "../api/adminClient";

type Tab = "overview" | "players" | "leagues" | "settings" | "logs";
const TABS: Tab[] = ["overview", "players", "leagues", "settings", "logs"];

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="instrument-label text-muted-foreground">{label}</div>
      <div className="readout mt-1 text-xl tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export default function GameAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const season = ACTIVE_GAME_SEASON;
  const [tab, setTab] = useState<Tab>("overview");

  const stats = useQuery({ queryKey: ["admin", "stats", season], queryFn: () => adminStats(season), enabled: isGameAdmin(user) });
  const players = useQuery({ queryKey: ["admin", "players", season], queryFn: () => adminListPlayers(season), enabled: isGameAdmin(user) && tab === "players" });
  const leagues = useQuery({ queryKey: ["admin", "leagues"], queryFn: () => adminListLeagues(), enabled: isGameAdmin(user) && tab === "leagues" });
  const config = useQuery({ queryKey: ["admin", "config", season], queryFn: () => getSeasonConfig(season), enabled: isGameAdmin(user) && tab === "settings" });
  const logs = useQuery({ queryKey: ["admin", "logs"], queryFn: () => getAuditLog(), enabled: isGameAdmin(user) && tab === "logs" });

  const regrade = useMutation({
    mutationFn: () => adminRegrade(season),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["game"] }); },
  });
  const patchSeason = useMutation({
    mutationFn: (p: Parameters<typeof adminUpdateSeason>[1]) => adminUpdateSeason(season, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "config", season] }),
  });
  const newSeason = useMutation({
    mutationFn: (yr: number) => openSeason(yr, `${yr} F1 League`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });

  const [rulesText, setRulesText] = useState("");
  const [rulesErr, setRulesErr] = useState<string | null>(null);
  const [newYear, setNewYear] = useState(season + 1);
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const broadcast = useMutation({
    mutationFn: () => adminBroadcast(bcTitle.trim(), bcBody.trim()),
    onSuccess: () => { setBcTitle(""); setBcBody(""); },
  });
  useEffect(() => { if (config.data) setRulesText(JSON.stringify(config.data.scoring_rules, null, 2)); }, [config.data]);

  if (!isGameAdmin(user)) {
    return (
      <div className={cn(pageShell, pageStack)}>
        <F1Card>
          <F1CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Admin access only.
          </F1CardContent>
        </F1Card>
      </div>
    );
  }

  const saveRules = () => {
    setRulesErr(null);
    let parsed: unknown;
    try { parsed = JSON.parse(rulesText); } catch { setRulesErr("Invalid JSON"); return; }
    patchSeason.mutate({ scoringRules: parsed });
  };

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-3xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1.5">
            <div className="instrument-label flex items-center gap-1.5 text-primary">
              <ShieldAlert className="h-3 w-3" /> Admin · {season}
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Game Admin</h1>
          </div>
          <Button variant="outline" className="min-h-11 gap-1.5" onClick={() => regrade.mutate()} disabled={regrade.isPending}>
            <RefreshCw className={cn("h-4 w-4", regrade.isPending && "animate-spin")} /> Regrade
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card/40 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("min-h-9 flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          stats.isLoading ? <F1Skeleton variant="card" className="h-32" /> : stats.data && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Players" value={stats.data.players} />
              <Stat label="Total users" value={stats.data.total_users} />
              <Stat label="Leagues" value={stats.data.leagues_total} />
              <Stat label="Public / Private" value={`${stats.data.leagues_public} / ${stats.data.leagues_private}`} />
              <Stat label="Predictions made" value={stats.data.predictions_made} />
              <Stat label="Graded rounds" value={stats.data.graded_rounds} />
              <Stat label="Pick rows" value={stats.data.pick_rows} />
              <Stat label="Champion picks" value={stats.data.champion_picks} />
            </div>
          )
        )}

        {tab === "players" && (
          players.isLoading ? <F1Skeleton variant="card" className="h-48" /> : (
            <F1Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">Player</th><th className="px-3 py-2 text-right">Picks</th>
                    <th className="px-4 py-2 text-right">Points</th></tr></thead>
                  <tbody>
                    {players.data?.map((p) => (
                      <tr key={p.user_id} className="border-b border-border/60">
                        <td className="px-4 py-2">{p.username ?? p.user_id.slice(0, 8)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.pick_rows}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{Number(p.total_points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </F1Card>
          )
        )}

        {tab === "leagues" && (
          leagues.isLoading ? <F1Skeleton variant="card" className="h-48" /> : (
            <F1Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">League</th><th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Members</th><th className="px-4 py-2">Owner</th></tr></thead>
                  <tbody>
                    {leagues.data?.map((l) => (
                      <tr key={l.id} className="border-b border-border/60">
                        <td className="px-4 py-2">{l.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{l.slug === "global" ? "Global" : l.is_public ? "Public" : "Private"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.member_count}</td>
                        <td className="px-4 py-2 text-muted-foreground">{l.created_by_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </F1Card>
          )
        )}

        {tab === "settings" && (
          config.isLoading ? <F1Skeleton variant="card" className="h-64" /> : config.data && (
            <>
              <F1Card>
                <F1CardHeader><F1CardTitle className="text-base">Season {season}</F1CardTitle></F1CardHeader>
                <F1CardContent className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Status: <strong>{config.data.status}</strong></span>
                    <div className="flex gap-1.5">
                      {["upcoming", "active", "complete"].map((s) => (
                        <Button key={s} size="sm" variant={config.data?.status === s ? "default" : "outline"}
                          className="h-9 capitalize" onClick={() => patchSeason.mutate({ status: s })}>{s}</Button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between">
                    <span>Globally locked</span>
                    <input type="checkbox" checked={config.data.globally_locked}
                      onChange={(e) => patchSeason.mutate({ globallyLocked: e.target.checked })} />
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <span>Champion lock round</span>
                    <Input type="number" className="h-9 w-24" defaultValue={config.data.champion_lock_round ?? ""}
                      onBlur={(e) => patchSeason.mutate({ championLockRound: parseInt(e.target.value, 10) || undefined })} />
                  </div>
                </F1CardContent>
              </F1Card>

              <F1Card>
                <F1CardHeader><F1CardTitle className="text-base">Scoring rules (JSON)</F1CardTitle></F1CardHeader>
                <F1CardContent className="flex flex-col gap-2">
                  <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)}
                    className="min-h-48 w-full rounded-md border border-border bg-muted/30 p-3 font-mono text-xs" spellCheck={false} />
                  <div className="flex items-center gap-3">
                    <Button className="min-h-11" onClick={saveRules} disabled={patchSeason.isPending}>Save rules</Button>
                    {rulesErr ? <span className="text-xs text-destructive">{rulesErr}</span> : null}
                  </div>
                </F1CardContent>
              </F1Card>

              <F1Card>
                <F1CardHeader><F1CardTitle className="text-base">Open a new season</F1CardTitle></F1CardHeader>
                <F1CardContent className="flex items-center gap-2">
                  <Input type="number" className="h-11 w-28" value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value, 10))} />
                  <Button variant="outline" className="min-h-11" onClick={() => newSeason.mutate(newYear)} disabled={newSeason.isPending}>
                    Open {newYear} (carries all league members)
                  </Button>
                </F1CardContent>
              </F1Card>

              <F1Card>
                <F1CardHeader><F1CardTitle className="text-base">Broadcast notification</F1CardTitle></F1CardHeader>
                <F1CardContent className="flex flex-col gap-2">
                  <Input placeholder="Title" value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} className="h-11" />
                  <Input placeholder="Message" value={bcBody} onChange={(e) => setBcBody(e.target.value)} className="h-11" />
                  <div className="flex items-center gap-3">
                    <Button className="min-h-11" disabled={bcTitle.trim().length === 0 || broadcast.isPending}
                      onClick={() => broadcast.mutate()}>
                      {broadcast.isPending ? "Sending…" : broadcast.isSuccess ? "Sent ✓" : "Send to all players"}
                    </Button>
                    {broadcast.error ? <span className="text-xs text-destructive">{(broadcast.error as Error).message}</span> : null}
                  </div>
                  <p className="text-2xs text-muted-foreground">Push notification to everyone who enabled reminders.</p>
                </F1CardContent>
              </F1Card>
            </>
          )
        )}

        {tab === "logs" && (
          logs.isLoading ? <F1Skeleton variant="card" className="h-48" /> : (
            <F1Card className="overflow-hidden p-0">
              <ul className="divide-y divide-border text-sm">
                {logs.data?.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="font-medium">{l.action}</span>
                    <span className="text-2xs text-muted-foreground">{format(parseISO(l.created_at), "dd MMM HH:mm")}</span>
                  </li>
                ))}
                {(logs.data?.length ?? 0) === 0 && <li className="px-4 py-6 text-muted-foreground">No admin actions yet.</li>}
              </ul>
            </F1Card>
          )
        )}
      </div>
    </div>
  );
}
