import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw, Trash2, LogOut, Crown } from "lucide-react";
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
import {
  getLeague, getLeagueMembers, updateLeague, rotateInvite, removeMember, leaveLeague,
} from "../api/leaguesClient";

export default function LeagueManage() {
  const { id } = useParams<{ id: string }>();
  const leagueId = id as string;
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

  const league = useQuery({ queryKey: ["game", "league", leagueId], queryFn: () => getLeague(leagueId) });
  const members = useQuery({ queryKey: ["game", "leagueMembers", leagueId], queryFn: () => getLeagueMembers(leagueId) });

  const [name, setName] = useState("");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["game", "league", leagueId] });
    qc.invalidateQueries({ queryKey: ["game", "leagueMembers", leagueId] });
    qc.invalidateQueries({ queryKey: ["game", "myLeagues"] });
  };

  const patch = useMutation({ mutationFn: (p: { name?: string; isPublic?: boolean; reveal?: string }) => updateLeague(leagueId, p), onSuccess: invalidate });
  const rotate = useMutation({ mutationFn: () => rotateInvite(leagueId), onSuccess: invalidate });
  const kick = useMutation({ mutationFn: (uid: string) => removeMember(leagueId, uid), onSuccess: invalidate });
  const leave = useMutation({ mutationFn: () => leaveLeague(leagueId), onSuccess: () => { invalidate(); nav("/game/leagues"); } });

  if (league.isLoading) {
    return <div className={cn(pageShell, pageStack)}><F1Skeleton variant="card" className="h-64" /></div>;
  }
  const l = league.data;

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to={`/game/leagues/${leagueId}`}>{l?.name ?? "League"}</BackLink>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Manage League</h1>

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

        {/* Members */}
        <F1Card className="overflow-hidden p-0">
          <F1CardHeader className="px-4 pt-3"><F1CardTitle className="text-base">Members</F1CardTitle></F1CardHeader>
          <ul className="divide-y divide-border">
            {members.data?.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 px-4 py-2.5">
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
