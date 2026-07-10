import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Medal, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-xl", pageStack, "animate-fade-in")}>
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
                <Select value={wdc} onValueChange={(v) => { setWdc(v); setSaved(false); }} disabled={!canEdit}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pick a driver" /></SelectTrigger>
                  <SelectContent>
                    {drivers.data?.map((d) => (
                      <SelectItem key={d.driver_id} value={d.driver_id}>
                        <span className="font-mono text-xs font-semibold">{d.code}</span>
                        <span className="ml-2 text-muted-foreground">{d.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="instrument-label text-muted-foreground">Constructors' Champion</label>
                <Select value={wcc} onValueChange={(v) => { setWcc(v); setSaved(false); }} disabled={!canEdit}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pick a team" /></SelectTrigger>
                  <SelectContent>
                    {constructors.data?.map((c) => (
                      <SelectItem key={c.constructor_id} value={c.constructor_id}>
                        {c.constructor_name ?? c.constructor_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
