import { useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  Flag,
  Calendar,
  Target,
  List,
  BarChart3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import type { ErgastDriverStandingRow } from "@/lib/f1/types";
import type { DriverRaceResult } from "./driverCardTypes";
import DriverPositionChart from "./DriverPositionChart";
import DriverCareerPanel from "./DriverCareerPanel";

interface DriverStatsPanelProps {
  driver: ErgastDriverStandingRow;
  pointsHistory: DriverRaceResult[];
  season: number;
  teamColor: string;
  teamName: string;
  displayDriverNumber: string | number;
  age: string | number;
  contributionPercent: number | null;
  teamPoints: number;
  wins: number;
}

const DriverStatsPanel = ({
  driver,
  pointsHistory,
  season,
  teamColor,
  teamName,
  displayDriverNumber,
  age,
  contributionPercent,
  teamPoints,
  wins,
}: DriverStatsPanelProps) => {
  const { isGlass } = useThemeVariant();

  const totalRaces = pointsHistory.length;
  const podiums = pointsHistory.filter(
    (r) => r.position && Number(r.position) <= 3,
  ).length;
  const avgPosition =
    totalRaces > 0
      ? (
          pointsHistory.reduce(
            (sum, r) => sum + (Number(r.position) || 20),
            0,
          ) / totalRaces
        ).toFixed(1)
      : "N/A";

  const bestPosition = useMemo(() => {
    const validPositions = pointsHistory
      .filter((r) => r.position)
      .map((r) => Number(r.position));
    return validPositions.length > 0 ? Math.min(...validPositions) : null;
  }, [pointsHistory]);

  const worstPosition = useMemo(() => {
    const validPositions = pointsHistory
      .filter((r) => r.position)
      .map((r) => Number(r.position));
    return validPositions.length > 0 ? Math.max(...validPositions) : null;
  }, [pointsHistory]);

  const dnfCount = useMemo(
    () => pointsHistory.filter((r) => r.isDNF === true).length,
    [pointsHistory],
  );

  const mutedSurface = isGlass ? "bg-white/5" : "bg-muted";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <div className={cn("text-center p-2 rounded-md", mutedSurface)}>
          <Trophy className="h-3 w-3 mx-auto mb-0.5 text-yellow-500" />
          <p className="text-sm font-bold">{wins}</p>
          <p className="text-[8px] text-muted-foreground">Wins</p>
        </div>
        <div className={cn("text-center p-2 rounded-md", mutedSurface)}>
          <Flag className="h-3 w-3 mx-auto mb-0.5 text-orange-500" />
          <p className="text-sm font-bold">{podiums}</p>
          <p className="text-[8px] text-muted-foreground">Podiums</p>
        </div>
        <div className={cn("text-center p-2 rounded-md", mutedSurface)}>
          <Target className="h-3 w-3 mx-auto mb-0.5 text-blue-500" />
          <p className="text-sm font-bold">{avgPosition}</p>
          <p className="text-[8px] text-muted-foreground">Avg Pos</p>
        </div>
        <div className={cn("text-center p-2 rounded-md", mutedSurface)}>
          <TrendingUp className="h-3 w-3 mx-auto mb-0.5 text-green-500" />
          <p className="text-sm font-bold">{driver.points}</p>
          <p className="text-[8px] text-muted-foreground">Points</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div
          className={cn(
            "p-1.5 rounded-md flex items-center justify-around",
            mutedSurface,
          )}
        >
          <div className="text-center">
            <p className="text-[7px] text-muted-foreground">Best</p>
            <p className="text-xs font-bold text-green-500">
              P{bestPosition || "-"}
            </p>
          </div>
          <div className="w-px h-5 bg-border/30" />
          <div className="text-center">
            <p className="text-[7px] text-muted-foreground">Worst</p>
            <p className="text-xs font-bold text-orange-500/70">
              P{worstPosition || "-"}
            </p>
          </div>
          <div className="w-px h-5 bg-border/30" />
          <div className="text-center">
            <p className="text-[7px] text-muted-foreground">DNF</p>
            <p className="text-xs font-bold text-red-500">{dnfCount}</p>
          </div>
        </div>

        {contributionPercent !== null ? (
          <div className={cn("p-1.5 rounded-md", mutedSurface)}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[7px] text-muted-foreground">
                Team ({teamPoints} pts)
              </span>
              <span className="text-[10px] font-bold">{contributionPercent}%</span>
            </div>
            <Progress
              value={contributionPercent}
              className="h-1"
              indicatorStyle={{ backgroundColor: teamColor }}
            />
          </div>
        ) : (
          <div
            className={cn(
              "p-1.5 rounded-md flex items-center justify-center",
              mutedSurface,
            )}
          >
            <span className="text-[7px] text-muted-foreground">No team data</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-2">
            Personal
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Born:</span>
              <span>
                {driver.Driver.dateOfBirth || "Unknown"} ({age})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nationality:</span>
              <span>{driver.Driver.nationality}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number:</span>
              <span>#{displayDriverNumber}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-2">
            Season {season}
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-semibold">P{driver.position}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Races:</span>
              <span>{totalRaces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Team:</span>
              <span className="truncate max-w-[100px]">{teamName}</span>
            </div>
          </div>
        </div>
      </div>

      {pointsHistory.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Race History ({totalRaces} races)
            </span>
          </div>
          <Tabs defaultValue="chart">
            <TabsList className="w-full h-7 p-0.5">
              <TabsTrigger
                value="chart"
                className="flex-1 text-[10px] h-6 gap-1 px-2"
              >
                <BarChart3 className="h-2.5 w-2.5" />
                Chart
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="flex-1 text-[10px] h-6 gap-1 px-2"
              >
                <List className="h-2.5 w-2.5" />
                List
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="mt-1">
              <DriverPositionChart history={pointsHistory} teamColor={teamColor} />
            </TabsContent>

            <TabsContent value="list" className="mt-2">
              <div
                className={cn(
                  "max-h-48 overflow-auto rounded-lg p-2 space-y-1.5",
                  isGlass ? "bg-white/5" : "bg-muted/50",
                )}
              >
                {pointsHistory.map((race) => {
                  const pos = Number(race.position);
                  const isPodium = pos <= 3;
                  const isWin = pos === 1;
                  const displayName = getRaceNameWithoutEmoji(race.raceName);

                  return (
                    <div
                      key={`${race.round}-${race.raceName}`}
                      className={cn(
                        "flex items-center justify-between text-sm p-2 rounded",
                        isGlass ? "hover:bg-white/5" : "hover:bg-muted",
                        isPodium && "border-l-2",
                        isWin && "border-l-yellow-500",
                        pos === 2 && "border-l-gray-400",
                        pos === 3 && "border-l-amber-600",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CountryFlag country={race.country || ""} size={14} />
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0",
                            isWin && "bg-yellow-500 text-yellow-950",
                            pos === 2 && "bg-gray-300 text-gray-800",
                            pos === 3 && "bg-amber-600 text-amber-50",
                            pos > 3 && "bg-muted text-muted-foreground",
                          )}
                        >
                          {race.round}
                        </span>
                        <div className="truncate">
                          <p className="truncate font-medium text-xs">{displayName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {race.date}
                            {race.position ? ` • P${race.position}` : ""}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "ml-2 shrink-0 font-semibold text-xs",
                          race.points > 0
                            ? "text-green-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {race.points > 0 ? `+${race.points}` : "0"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <DriverCareerPanel
        ergastId={driver.Driver.driverId}
        compact
        className="pt-1 border-t border-border/40"
      />
    </div>
  );
};

export default DriverStatsPanel;
