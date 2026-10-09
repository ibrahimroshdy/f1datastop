import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw, Trash2, LogOut, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton, F1Avatar, PageHeader } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  getLeague, getLeagueMembers, updateLeague, rotateInvite, removeMember, leaveLeague, updateLeagueIdentity,
} from "../api/leaguesClient";
import { LeagueCrest } from "../components/pitwall/LeagueCrest";
import { leagueAccent } from "../utils/leagueIdentity";

const initials = (n?: string | null) => (n ?? "").trim().slice(0, 2).toUpperCase() || undefined;

export default function LeagueManage() {
  const { id } = useParams<{ id: string }>();
  const leagueId = id as string;
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

  const league = useQuery({ queryKey: ["game", "league", leagueId], queryFn: () => getLeague(leagueId) });
  const members = useQuery({ queryKey: ["game", "leagueMembers", leagueId], queryFn: () => getLeagueMembers(leagueId) });

  const [name, setName] = useState("");
  const [crest, setCrest] = useState("");
  const [accent, setAccent] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (league.data) {
      setCrest(league.data.crest ?? "");
      setAccent(league.data.accent ?? "");
      setDescription(league.data.description ?? "");
    }
  }, [league.data]);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["game", "league", leagueId] });
    qc.invalidateQueries({ queryKey: ["game", "leagueMembers", leagueId] });
    qc.invalidateQueries({ queryKey: ["game", "myLeagues"] });
  };

  const patch = useMutation({ mutationFn: (p: { name?: string; isPublic?: boolean; reveal?: string }) => updateLeague(leagueId, p), onSuccess: invalidate });
  const rotate = useMutation({ mutationFn: () => rotateInvite(leagueId), onSuccess: invalidate });
  const kick = useMutation({ mutationFn: (uid: string) => removeMember(leagueId, uid), onSuccess: invalidate });
  const leave = useMutation({ mutationFn: () => leaveLeague(leagueId), onSuccess: () => { invalidate(); nav("/game/leagues"); } });
  const identity = useMutation({
    mutationFn: () => updateLeagueIdentity(leagueId, {
      crest: crest.trim() || null,
      accent: accent.trim() || null,
      description: description.trim() || null,
    }),
    onSuccess: invalidate,
  });

  if (league.isLoading) {
    return <div className={cn(pageShell, pageStack)}><F1Skeleton variant="card" className="h-64" /></div>;
  }
  const l = league.data;

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <BackLink to={`/game/leagues/${leagueId}`}>{l?.name ?? "League"}</BackLink>
        <PageHeader
          eyebrow="League"
          title="Manage League"
        />

        {/* Invite */}
        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">Invite code</F1CardTitle></F1CardHeader>
          <F1CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-lg tracking-widest">
                {l?.invite_code ?? "——"}
              </code>
              <Button variant="outline" className="h-11 w-11 p-0"
                onClick={() => l?.invite_code && navigator.clipboard.writeText(l.invite_code)} aria-label="Copy code">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="h-11 w-11 p-0" onClick={() => rotate.mutate()} aria-label="New code">
                <RefreshCw className={cn("h-4 w-4", rotate.isPending && "animate-spin")} />
              </Button>
            </div>
            <p className="text-2xs text-muted-foreground">Share this code, or the link /join/{l?.invite_code}</p>
          </F1CardContent>
        </F1Card>

        {/* Settings */}
        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">Settings</F1CardTitle></F1CardHeader>
          <F1CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input placeholder={l?.name} value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              <Button variant="outline" className="min-h-11" disabled={name.trim().length < 2}
                onClick={() => { patch.mutate({ name: name.trim() }); setName(""); }}>Rename</Button>
            </div>
            <label className="flex items-center justify-between text-sm">
              <span>Public (discoverable)</span>
              <input type="checkbox" checked={!!l?.is_public}
                onChange={(e) => patch.mutate({ isPublic: e.target.checked })} />
            </label>
            <div className="flex items-center justify-between text-sm">
              <span>Reveal picks after lock</span>
              <Select value={l?.pick_reveal_policy ?? "after_lock"} onValueChange={(v) => patch.mutate({ reveal: v })}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_lock">After lock</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {patch.error ? <p className="text-xs text-destructive">{(patch.error as Error).message}</p> : null}
          </F1CardContent>
        </F1Card>

        {/* League identity */}
        <F1Card>
          <F1CardHeader><F1CardTitle className="text-base">League identity</F1CardTitle></F1CardHeader>
          <F1CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <LeagueCrest league={{ id: leagueId, name: l?.name, crest: crest || null, accent: accent || null }} size="lg" />
              <p className="text-2xs text-muted-foreground">
                A crest and accent colour make your league its own thing — shown on lists, the header, and activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="instrument-label text-muted-foreground">Crest</span>
                <Input value={crest} onChange={(e) => setCrest(e.target.value)} maxLength={4}
                  placeholder="PW" className="h-11 w-24 text-center text-lg" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="instrument-label text-muted-foreground">Accent</span>
                <div className="flex items-center gap-2">
                  <input type="color" value={accent || leagueAccent({ id: leagueId })}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
                    aria-label="Accent colour" />
                  <Input value={accent} onChange={(e) => setAccent(e.target.value)} maxLength={7}
                    placeholder="#e10600" className="h-11 w-28 font-mono" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="instrument-label text-muted-foreground">Description</span>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280}
                placeholder="What's this league about?" />
            </div>
            <Button variant="outline" className="min-h-11 self-start" disabled={identity.isPending}
              onClick={() => identity.mutate()}>
              {identity.isPending ? "Saving…" : "Save identity"}
            </Button>
            {identity.error ? <p className="text-xs text-destructive">{(identity.error as Error).message}</p> : null}
          </F1CardContent>
        </F1Card>

        {/* Members */}
        <F1Card className="overflow-hidden p-0">
          <F1CardHeader className="px-4 pt-3"><F1CardTitle className="text-base">Members</F1CardTitle></F1CardHeader>
          <ul className="divide-y divide-border">
            {members.data?.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 px-4 py-2.5">
                <F1Avatar src={m.avatar_url ?? undefined} fallback={initials(m.username)} alt={m.username ?? "Player"} size="sm" />
                <span className="flex-1 truncate text-sm">
                  {m.username ?? "—"}
                  {m.role === "captain" && <Crown className="ml-1 inline h-3 w-3 text-position-gold" />}
                </span>
                {m.role !== "captain" && m.user_id !== user?.id && (
                  <Button variant="ghost" size="sm" className="h-9 text-destructive"
                    onClick={() => kick.mutate(m.user_id)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        </F1Card>

        {l?.slug !== "global" && (
          <Button variant="outline" className="min-h-11 gap-1.5 text-destructive" onClick={() => leave.mutate()}>
            <LogOut className="h-4 w-4" /> Leave league
          </Button>
        )}
      </div>
    </div>
  );
}
