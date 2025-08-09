import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";

interface DriverStandingsTableProps {
  driverStandings: any;
  getTeamColor: (constructorId: string) => string;
  showAllDrivers: boolean;
}

const normalizeTeamId = (teamId: string) => {
  let id = (teamId || "").toLowerCase();
  if (id === "alphatauri") id = "rb";
  if (id === "alfa") id = "sauber";
  return id;
};

const DriverStandingsTable = ({ driverStandings, showAllDrivers }: DriverStandingsTableProps) => {
  const driversToShow = showAllDrivers ? driverStandings?.data : driverStandings?.data?.slice(0, 10);
  const leaderPoints = Number(driverStandings?.data?.[0]?.points || 0);

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="w-8 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
            <TableHead className="text-xs lg:text-sm">Driver</TableHead>
            <TableHead className="text-center text-xs lg:text-sm">Team</TableHead>
            <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
            <TableHead className="text-right text-xs lg:text-sm">Gap</TableHead>
            <TableHead className="text-right text-xs lg:text-sm">Contrib</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {driversToShow?.map((standing: any, idx: number) => {
            const constructors = standing.Constructors || [];
            const currentConstructor = constructors.length ? constructors[constructors.length - 1] : null;
            const teamId = currentConstructor?.constructorId || "default";
            const color = TEAM_COLORS[normalizeTeamId(teamId)] || TEAM_COLORS.default;
            const points = Number(standing.points || 0);
            const leader = leaderPoints || points || 1;
            const list = driverStandings?.data || [];
            const leaderPts = Number(list?.[0]?.points || 0);
            const toLeader = Math.max(0, leaderPts - points);
            const aheadPts = idx === 0 ? Number(list?.[1]?.points || 0) : Number(list?.[idx - 1]?.points || 0);
            const toNext = idx === 0 ? Math.max(0, points - aheadPts) : Math.max(0, aheadPts - points);
            const constructorsTotals: Record<string, number> = (driverStandings?.data || []).reduce((acc: Record<string, number>, d: any) => {
              const cs = d.Constructors || [];
              const cc = cs.length ? cs[cs.length - 1] : null;
              const cid = normalizeTeamId(cc?.constructorId || "default");
              acc[cid] = (acc[cid] || 0) + Number(d.points || 0);
              return acc;
            }, {});
            const teamTotal = constructorsTotals[normalizeTeamId(teamId)] || 0;
            const contribPct = teamTotal > 0 ? Math.round((points / teamTotal) * 100) : 0;
            return (
              <TableRow key={standing.position} className="border-border">
                <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{standing.position}</TableCell>
                <TableCell className="py-2 px-1 lg:p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ReactCountryFlag
                        countryCode={getCountryCode(standing.Driver?.nationality || "") || ""}
                        svg
                        style={{ width: 16, height: "auto" }}
                        title={standing.Driver?.nationality || ""}
                      />
                      <div
                        style={{ borderLeft: `4px solid ${color}`, paddingLeft: 8 }}
                        className="font-medium text-foreground text-xs lg:text-sm"
                      >
                        <span className="hidden lg:inline">{standing.Driver?.givenName} {standing.Driver?.familyName}</span>
                        <span className="lg:hidden">{standing.Driver?.familyName}</span>
                      </div>
                    </div>
                    <Progress
                      value={(points / leader) * 100}
                      className="h-2 bg-muted"
                      indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                    />
                  </div>
                </TableCell>
                <TableCell className="p-0 text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center w-full h-8 lg:h-12">
                          <TeamLogo constructorId={teamId} alt={currentConstructor?.name || "Unknown Team"} size="sm" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs lg:text-sm">{currentConstructor?.name || "Unknown Team"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{standing.points}</TableCell>
                <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                  {idx === 0 ? null : (
                    <div className="flex flex-col items-end gap-0.5">
                      <span>To Leader: {toLeader}</span>
                      <span>To P{Number(standing.position) - 1}: {toNext}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium text-[10px] lg:text-xs py-2 px-2 lg:p-4">{contribPct}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
      </div>
      {/* Mobile compact list */}
      <div className="lg:hidden space-y-2">
        {driversToShow?.map((standing: any, idx: number) => {
          const constructors = standing.Constructors || [];
          const currentConstructor = constructors.length ? constructors[constructors.length - 1] : null;
          const teamId = currentConstructor?.constructorId || "default";
          const color = TEAM_COLORS[normalizeTeamId(teamId)] || TEAM_COLORS.default;
          const points = Number(standing.points || 0);
          const list = driverStandings?.data || [];
          const leaderPts = Number(list?.[0]?.points || 0);
          const toLeader = Math.max(0, leaderPts - points);
          const aheadPts = idx === 0 ? Number(list?.[1]?.points || 0) : Number(list?.[idx - 1]?.points || 0);
          const toNext = idx === 0 ? Math.max(0, points - aheadPts) : Math.max(0, aheadPts - points);
          const constructorsTotals: Record<string, number> = (driverStandings?.data || []).reduce((acc: Record<string, number>, d: any) => {
            const cs = d.Constructors || [];
            const cc = cs.length ? cs[cs.length - 1] : null;
            const cid = normalizeTeamId(cc?.constructorId || "default");
            acc[cid] = (acc[cid] || 0) + Number(d.points || 0);
            return acc;
          }, {});
          const teamTotal = constructorsTotals[normalizeTeamId(teamId)] || 0;
          const contribPct = teamTotal > 0 ? Math.round((points / teamTotal) * 100) : 0;
          return (
            <div key={standing.position} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs text-muted-foreground w-5">{standing.position}</div>
                  <TeamLogo constructorId={teamId} alt={currentConstructor?.name || "Team"} size="sm" />
                  <ReactCountryFlag
                    countryCode={getCountryCode(standing.Driver?.nationality || "") || ""}
                    svg
                    style={{ width: 14, height: "auto" }}
                    title={standing.Driver?.nationality || ""}
                  />
                  <div className="font-medium truncate" style={{ borderLeft: `3px solid ${color}`, paddingLeft: 6 }}>
                    {standing.Driver?.givenName} {standing.Driver?.familyName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{standing.points}</div>
                  <div className="text-[10px] text-muted-foreground">{contribPct}%</div>
                </div>
              </div>
              {idx !== 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground text-right">
                  <div>To Leader: {toLeader}</div>
                  <div>To P{Number(standing.position) - 1}: {toNext}</div>
                </div>
              )}
              <div className="mt-2">
                <Progress
                  value={(points / (leaderPoints || points || 1)) * 100}
                  className="h-1.5 bg-muted"
                  indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriverStandingsTable;
