import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useDriverStandings } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";

const normalizeTeamId = (teamId: string) => {
  let id = (teamId || "").toLowerCase();
  if (id === "alphatauri") id = "rb";
  if (id === "alfa") id = "sauber";
  return id;
};

const DriverStandings = () => {
  const { data: driverStandings } = useDriverStandings();
  const drivers = driverStandings?.data || [];
  const leaderPoints = useMemo(() => Number(drivers?.[0]?.points || 0), [drivers]);
  const calcGaps = (idx: number) => {
    const pts = Number(drivers?.[idx]?.points || 0);
    const leader = Number(drivers?.[0]?.points || 0);
    const toLeader = Math.max(0, leader - pts);
    const aheadPts = idx === 0 ? Number(drivers?.[1]?.points || 0) : Number(drivers?.[idx - 1]?.points || 0);
    const toNext = idx === 0 ? Math.max(0, pts - aheadPts) : Math.max(0, aheadPts - pts);
    return { toLeader, toNext };
  };
  const teamTotals = useMemo(() => {
    return (drivers || []).reduce((acc: Record<string, number>, d: any) => {
      const cs = d.Constructors || [];
      const cc = cs.length ? cs[cs.length - 1] : null;
      const cid = normalizeTeamId(cc?.constructorId || "default");
      acc[cid] = (acc[cid] || 0) + Number(d.points || 0);
      return acc;
    }, {});
  }, [drivers]);

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Top Drivers (Compact)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 lg:space-y-3">
          {(drivers?.slice(0, 7) || []).map((standing: any, idx: number) => {
            const team = (standing.Constructors || [])[ (standing.Constructors || []).length - 1];
            const color = TEAM_COLORS[normalizeTeamId(team?.constructorId || "default")] || TEAM_COLORS.default;
            const points = Number(standing.points || 0);
            const leader = leaderPoints || points || 1;
            const name = `${standing.Driver?.givenName} ${standing.Driver?.familyName}`;
            const { toLeader, toNext } = calcGaps(idx);
            const teamTotal = teamTotals[normalizeTeamId(team?.constructorId || "default")] || 0;
            const contribPct = teamTotal > 0 ? Math.round((points / teamTotal) * 100) : 0;
            return (
              <div key={standing.position} className="space-y-1">
                <div className="flex justify-between text-xs lg:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{standing.position}</span>
                    <span className="font-medium">
                      <span className="hidden lg:inline">{name}</span>
                      <span className="lg:hidden">{standing.Driver?.familyName}</span>
                    </span>
                  </div>
                  <span className="font-medium">{standing.points}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-3 lg:h-4 rounded-sm" style={{ backgroundColor: color }} />
                  <Progress
                    value={(points / leader) * 100}
                    className="h-1.5 lg:h-2 bg-muted"
                    indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  {idx === 0 ? <div /> : (
                    <div className="flex flex-col gap-1 w-40">
                      <div>
                        <div>To Leader</div>
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="h-2 bg-purple-500/70" style={{ width: `${leader ? Math.round((toLeader / leader) * 100) : 0}%` }} />
                        </div>
                        <div className="text-right mt-0.5">{toLeader}</div>
                      </div>
                      <div>
                        <div>To P{Number(standing.position) - 1}</div>
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="h-2 bg-purple-400/70" style={{ width: `${points ? Math.round((toNext / points) * 100) : 0}%` }} />
                        </div>
                        <div className="text-right mt-0.5">{toNext}</div>
                      </div>
                    </div>
                  )}
                  <span className="font-medium">{contribPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default DriverStandings;
