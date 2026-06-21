import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useDriverStandings } from "@/hooks/useF1Data";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { Users } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import TeamLogo from "@/components/common/TeamLogo";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";

const normalizeTeamId = (teamId: string) => {
  let id = (teamId || "").toLowerCase();
  if (id === "alphatauri") id = "rb";
  if (id === "alfa") id = "sauber";
  return id;
};

const DriverStandings = () => {
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
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
    <F1Card
      variant={surfaceVariant}
      glassVariant={surfaceGlass}
      className="h-full border-border bg-card p-0"
    >
      <F1CardHeader className="pb-2">
        <F1CardTitle icon={<Users className="h-5 w-5" />} className="text-base font-semibold">
          Top Drivers (Compact)
        </F1CardTitle>
      </F1CardHeader>
      <F1CardContent>
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground">{standing.position}</span>
                    <TeamLogo constructorId={team?.constructorId || "default"} alt={team?.name} size="sm" />
                    <ReactCountryFlag
                      countryCode={getCountryCode(standing.Driver?.nationality || "") || ""}
                      svg
                      style={{ width: 14, height: "auto" }}
                      title={standing.Driver?.nationality || ""}
                    />
                    <span className="font-medium truncate">
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
                    indicatorClassName="bg-gradient-to-r from-primary to-primary/70"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  {idx === 0 ? <div /> : (
                    <div className="flex flex-col gap-0.5">
                      <span>To Leader: {toLeader}</span>
                      <span>To P{Number(standing.position) - 1}: {toNext}</span>
                    </div>
                  )}
                  <span className="font-medium">{contribPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default DriverStandings;
