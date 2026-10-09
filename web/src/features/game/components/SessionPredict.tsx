import { useState } from "react";
import { Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Loader } from "@/components/f1";
import type { SeasonDriver, SessionType } from "../api/gameClient";
import { DriverPicker } from "./DriverPicker";

const SESSION_LABEL: Record<SessionType, string> = {
  Q: "Qualifying",
  R: "Race",
  S: "Sprint",
};
const SESSION_SUB: Record<SessionType, string> = {
  Q: "Predict the top 10",
  R: "Predict the top 10",
  S: "Predict the top 8",
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
  const [picks, setPicks] = useState<string[]>(() => initial.filter(Boolean).slice(0, depth));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setValue = (ids: string[]) => { setSaved(false); setPicks(ids); };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(picks);
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <F1Card>
      <F1CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <div>
          <F1CardTitle className="text-base">{SESSION_LABEL[sessionType]}</F1CardTitle>
          <p className="text-2xs text-muted-foreground">{SESSION_SUB[sessionType]}</p>
        </div>
        {editable ? (
          <span className="instrument-label rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
            {picks.length}/{depth}
          </span>
        ) : (
          <span className="instrument-label inline-flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
      </F1CardHeader>
      <F1CardContent className="flex flex-col gap-3">
        <DriverPicker
          depth={depth}
          drivers={drivers}
          value={picks}
          editable={editable}
          onChange={setValue}
        />
        {editable && (
          <div className="flex items-center gap-3">
            <Button className="min-h-11 gap-1.5" onClick={save} disabled={saving}>
              {saving ? <F1Loader size="sm" /> : saved ? <Check className="h-4 w-4" /> : null}
              {saved ? "Saved" : "Save picks"}
            </Button>
            {err ? <span className="text-xs text-destructive">{err}</span> : null}
          </div>
        )}
      </F1CardContent>
    </F1Card>
  );
}
