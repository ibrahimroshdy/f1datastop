import { useMemo, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import type { SeasonDriver, SessionType } from "../api/gameClient";
import { DriverSelect } from "./DriverSelect";

const SESSION_LABEL: Record<SessionType, string> = {
  Q: "Qualifying — Top 10",
  R: "Race — Top 10",
  S: "Sprint — Top 8",
};

/** Editable (or locked read-only) ordered picks for one session of one round. */
export function SessionPredict({
  sessionType,
  depth,
  drivers,
  initial,
  editable,
  onSave,
}: {
  sessionType: SessionType;
  depth: number;
  drivers: SeasonDriver[];
  initial: string[];
  editable: boolean;
  onSave: (driverIds: string[]) => Promise<void>;
}) {
  const [picks, setPicks] = useState<string[]>(() => {
    const arr = new Array<string>(depth).fill("");
    initial.forEach((id, i) => { if (i < depth) arr[i] = id; });
    return arr;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const driverById = useMemo(() => {
    const m = new Map<string, SeasonDriver>();
    for (const d of drivers) m.set(d.driver_id, d);
    return m;
  }, [drivers]);
  const chosen = useMemo(() => new Set(picks.filter(Boolean)), [picks]);

  const setSlot = (i: number, id: string) => {
    setSaved(false);
    setPicks((prev) => {
      const next = [...prev];
      next[i] = id;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(picks.filter(Boolean));
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <F1Card>
      <F1CardHeader className="flex-row items-center justify-between gap-2">
        <F1CardTitle className="text-base">{SESSION_LABEL[sessionType]}</F1CardTitle>
        {!editable && (
          <span className="instrument-label inline-flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
      </F1CardHeader>
      <F1CardContent className="flex flex-col gap-2">
        {editable ? (
          <>
            {Array.from({ length: depth }).map((_, i) => (
              <DriverSelect
                key={i}
                position={i + 1}
                value={picks[i] || undefined}
                drivers={drivers}
                disabledIds={chosen}
                editable={editable}
                onChange={(id) => setSlot(i, id)}
              />
            ))}
            <div className="mt-1 flex items-center gap-3">
              <Button className="min-h-11 gap-1.5" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saved ? "Saved ✓" : "Save picks"}
              </Button>
              {err ? <span className="text-xs text-destructive">{err}</span> : null}
            </div>
          </>
        ) : (
          <ol className="flex flex-col gap-1">
            {Array.from({ length: depth }).map((_, i) => {
              const d = picks[i] ? driverById.get(picks[i]) : undefined;
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="timing w-6 text-right text-xs font-semibold text-muted-foreground">
                    P{i + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold">{d?.code ?? "—"}</span>
                  <span className="text-muted-foreground">{d?.name ?? "No pick"}</span>
                </li>
              );
            })}
          </ol>
        )}
      </F1CardContent>
    </F1Card>
  );
}
