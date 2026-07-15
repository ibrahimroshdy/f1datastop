import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Medal, Lock, Trophy } from "lucide-react";
import { getTeamColorById } from "@/constants/f1Colors";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useGameActivation } from "../hooks/useGameActivation";
import {
  getSeasonDrivers, getSeasonConstructors, getChampionPick, isChampionEditable, saveChampionPick,
} from "../api/gameClient";

export default function Champions() {
  const { entryId } = useGameActivation();
  const qc = useQueryClient();
  const drivers = useQuery({ queryKey: ["game", "drivers"], queryFn: () => getSeasonDrivers() });
  const constructors = useQuery({ queryKey: ["game", "constructors"], queryFn: () => getSeasonConstructors() });
  const pick = useQuery({ queryKey: ["game", "champion", entryId], queryFn: () => getChampionPick(entryId as string), enabled: !!entryId });
  const editable = useQuery({ queryKey: ["game", "championEditable", entryId], queryFn: () => isChampionEditable(entryId as string), enabled: !!entryId });

  const [wdc, setWdc] = useState("");
  const [wcc, setWcc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (pick.data) { setWdc(pick.data.wdc_driver_id ?? ""); setWcc(pick.data.wcc_constructor_id ?? ""); }
  }, [pick.data]);

  const canEdit = !!editable.data;
  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await saveChampionPick(wdc, wcc);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["game", "champion", entryId] });
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  const loading = drivers.isLoading || constructors.isLoading || pick.isLoading || editable.isLoading || !entryId;

  const wdcDriver = drivers.data?.find((d) => d.driver_id === wdc);
  const wccTeam = constructors.data?.find((c) => c.constructor_id === wcc);
  const wdcColor = wdcDriver?.constructor_id ? getTeamColorById(wdcDriver.constructor_id) : "hsl(var(--position-gold))";
  const wccColor = wcc ? getTeamColorById(wcc) : "hsl(var(--position-gold))";

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Medal className="h-3 w-3" /> Season picks
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Champions</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit ? "Editable until the mid-season lock." : "Champion picks are locked for the season."}
          </p>
        </div>

        {/* Prestige showcase — current champions picks */}
        {!loading && (wdcDriver || wccTeam) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-xl border border-position-gold/30 bg-gradient-to-br from-position-gold/[0.1] to-transparent p-3">
              <div className="instrument-label flex items-center gap-1 text-[10px] text-position-gold">
                <Trophy className="h-3 w-3" /> Drivers' Champ
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: wdcColor }} />
                <div className="min-w-0">
                  <div className="font-heading text-lg font-bold leading-none">{wdcDriver?.code ?? "—"}</div>
                  <div className="mt-0.5 truncate text-2xs text-muted-foreground">{wdcDriver?.name ?? "Not picked"}</div>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-position-gold/30 bg-gradient-to-br from-position-gold/[0.1] to-transparent p-3">
              <div className="instrument-label flex items-center gap-1 text-[10px] text-position-gold">
                <Trophy className="h-3 w-3" /> Constructors' Champ
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: wccColor }} />
                <div className="min-w-0">
                  <div className="truncate font-heading text-base font-bold leading-tight">{wccTeam?.constructor_name ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <F1Skeleton variant="card" className="h-48" />
        ) : (
          <F1Card>
            <F1CardHeader className="flex-row items-center justify-between">
              <F1CardTitle className="text-base">Your champions</F1CardTitle>
              {!canEdit && <Lock className="h-4 w-4 text-muted-foreground" />}
            </F1CardHeader>
            <F1CardContent className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="instrument-label text-muted-foreground">World Drivers' Champion</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label="Drivers' Champion">
                  {drivers.data?.map((d) => {
                    const active = wdc === d.driver_id;
                    const color = d.constructor_id ? getTeamColorById(d.constructor_id) : "hsl(var(--muted-foreground))";
                    return (
                      <button
                        key={d.driver_id}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={active}
                        onClick={() => { setWdc(d.driver_id); setSaved(false); }}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-60",
                          active ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]" : "border-border bg-card/40 hover:border-primary/40",
                        )}
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <span className="font-mono text-sm font-bold">{d.code}</span>
                        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{d.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="instrument-label text-muted-foreground">Constructors' Champion</label>
                <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Constructors' Champion">
                  {constructors.data?.map((c) => {
                    const active = wcc === c.constructor_id;
                    const color = getTeamColorById(c.constructor_id);
                    return (
                      <button
                        key={c.constructor_id}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={active}
                        onClick={() => { setWcc(c.constructor_id); setSaved(false); }}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-60",
                          active ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]" : "border-border bg-card/40 hover:border-primary/40",
                        )}
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.constructor_name ?? c.constructor_id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-3">
                  <Button className="min-h-11" onClick={save} disabled={saving || !wdc || !wcc}>
                    {saving ? "Saving…" : saved ? "Saved ✓" : "Save champions"}
                  </Button>
                  {err ? <span className="text-xs text-destructive">{err}</span> : null}
                </div>
              )}
            </F1CardContent>
          </F1Card>
        )}
      </div>
    </div>
  );
}
