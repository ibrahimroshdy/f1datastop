import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useGameActivation } from "../hooks/useGameActivation";
import {
  getMyProfile, updateMyProfile, getSeasonDrivers, getSeasonConstructors, getMyTotal,
  type GameProfile,
} from "../api/gameClient";

const EMPTY: GameProfile = {
  username: null, avatar_url: null, bio: null, favorite_driver_id: null, favorite_constructor_id: null, country: null,
};

export default function GameProfilePage() {
  const { user } = useAuth();
  const uid = user?.id as string;
  const qc = useQueryClient();
  const { entryId } = useGameActivation();

  const profile = useQuery({ queryKey: ["game", "profile", uid], queryFn: () => getMyProfile(uid), enabled: !!uid });
  const drivers = useQuery({ queryKey: ["game", "drivers"], queryFn: () => getSeasonDrivers() });
  const constructors = useQuery({ queryKey: ["game", "constructors"], queryFn: () => getSeasonConstructors() });
  const total = useQuery({ queryKey: ["game", "total", entryId], queryFn: () => getMyTotal(entryId as string), enabled: !!entryId });

  const [form, setForm] = useState<GameProfile>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (profile.data) setForm(profile.data); }, [profile.data]);

  const set = (k: keyof GameProfile, v: string) => { setSaved(false); setForm((f) => ({ ...f, [k]: v || null })); };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await updateMyProfile(uid, {
        avatar_url: form.avatar_url, bio: form.bio, country: form.country,
        favorite_driver_id: form.favorite_driver_id, favorite_constructor_id: form.favorite_constructor_id,
      });
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["game", "profile", uid] });
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <UserCircle className="h-3 w-3" /> Profile
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            {profile.data?.username ?? "Your profile"}
          </h1>
          {total.data && (
            <p className="text-sm text-muted-foreground">
              <span className="readout text-primary">{Number(total.data.total_points)}</span> points ·{" "}
              {total.data.exact_hits} exact hits
            </p>
          )}
        </div>

        {profile.isLoading ? (
          <F1Skeleton variant="card" className="h-72" />
        ) : (
          <F1Card>
            <F1CardHeader><F1CardTitle className="text-base">Customize</F1CardTitle></F1CardHeader>
            <F1CardContent className="flex flex-col gap-3">
              <div className="space-y-1">
                <label className="instrument-label text-muted-foreground">Avatar URL</label>
                <Input value={form.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value)} className="h-11" placeholder="https://…" />
              </div>
              <div className="space-y-1">
                <label className="instrument-label text-muted-foreground">Bio</label>
                <Input value={form.bio ?? ""} onChange={(e) => set("bio", e.target.value)} className="h-11" placeholder="Say something" />
              </div>
              <div className="space-y-1">
                <label className="instrument-label text-muted-foreground">Country</label>
                <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} className="h-11" placeholder="e.g. United Kingdom" />
              </div>
              <div className="space-y-1">
                <label className="instrument-label text-muted-foreground">Favourite driver</label>
                <Select value={form.favorite_driver_id ?? ""} onValueChange={(v) => set("favorite_driver_id", v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pick a driver" /></SelectTrigger>
                  <SelectContent>
                    {drivers.data?.map((d) => (
                      <SelectItem key={d.driver_id} value={d.driver_id}>{d.code} · {d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="instrument-label text-muted-foreground">Favourite team</label>
                <Select value={form.favorite_constructor_id ?? ""} onValueChange={(v) => set("favorite_constructor_id", v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pick a team" /></SelectTrigger>
                  <SelectContent>
                    {constructors.data?.map((c) => (
                      <SelectItem key={c.constructor_id} value={c.constructor_id}>{c.constructor_name ?? c.constructor_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button className="min-h-11" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save profile"}
                </Button>
                {err ? <span className="text-xs text-destructive">{err}</span> : null}
              </div>
            </F1CardContent>
          </F1Card>
        )}
      </div>
    </div>
  );
}
