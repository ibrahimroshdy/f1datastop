import React, { useState, useEffect, useMemo } from "react";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { Loader2, BarChart3 } from "lucide-react";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getTeamColorById } from "@/constants/f1Colors";
import { F1_API } from "@/constants/apiConfig";
import CountryFlag from "@/components/common/CountryFlag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface PointsDistributionViewProps {
  selectedYear: number;
  raceSchedule: any[];
  isLoading: boolean;
  isGlass: boolean;
}

const PointsDistributionView = ({
  raceSchedule,
  isLoading,
  isGlass,
}: PointsDistributionViewProps) => {
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const [raceResultsData, setRaceResultsData] = useState<Record<string, any>>({});
  const [sprintResultsData, setSprintResultsData] = useState<Record<string, any>>({});
  const [loadingRaces, setLoadingRaces] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!raceSchedule.length) return;

    const fetchAllResults = async () => {
      const results: Record<string, any> = {};
      const sprints: Record<string, any> = {};
      const loading = new Set<string>();

      for (const race of raceSchedule) {
        const raceKey = `${race.season}-${race.round}`;
        loading.add(raceKey);

        try {
          const raceRes = await fetch(
            `${F1_API.ERGAST}/${race.season}/${race.round}/results.json`
          );
          if (raceRes.ok) {
            const raceData = await raceRes.json();
            results[raceKey] = raceData.MRData?.RaceTable?.Races?.[0] || null;
          }

          if (race.Sprint) {
            const sprintRes = await fetch(
              `${F1_API.ERGAST}/${race.season}/${race.round}/sprint.json`
            );
            if (sprintRes.ok) {
              const sprintData = await sprintRes.json();
              sprints[raceKey] = sprintData.MRData?.RaceTable?.Races?.[0] || null;
            }
          }
        } catch (error) {
          console.error(`Failed to fetch results for ${raceKey}:`, error);
        } finally {
          loading.delete(raceKey);
        }
      }

      setRaceResultsData(results);
      setSprintResultsData(sprints);
      setLoadingRaces(loading);
    };

    fetchAllResults();
  }, [raceSchedule]);

  const distributionData = useMemo(() => {
    if (!raceSchedule.length) return [];

    const raceData: Array<{
      country: string;
      raceName: string;
      round: string;
      constructors: Array<{ name: string; points: number; color: string }>;
      totalPoints: number;
    }> = [];

    raceSchedule.forEach((race) => {
      const raceKey = `${race.season}-${race.round}`;
      const raceResults = raceResultsData[raceKey];
      const sprintResults = sprintResultsData[raceKey];

      if (!raceResults?.Results) return;

      const country = race.Circuit?.Location?.country || "";
      const raceName = getRaceNameWithoutEmoji(race.raceName);
      const round = race.round;

      const constructorPointsForRace: Record<
        string,
        { name: string; points: number; color: string }
      > = {};
      let totalPoints = 0;

      raceResults.Results.forEach((result: any) => {
        const constructorId = result.Constructor.constructorId;
        const points = parseFloat(result.points) || 0;

        if (!constructorPointsForRace[constructorId]) {
          constructorPointsForRace[constructorId] = {
            name: result.Constructor.name,
            points: 0,
            color: getTeamColorById(constructorId),
          };
        }
        constructorPointsForRace[constructorId].points += points;
        totalPoints += points;
      });

      if (sprintResults?.SprintResults) {
        sprintResults.SprintResults.forEach((result: any) => {
          const constructorId = result.Constructor.constructorId;
          const points = parseFloat(result.points) || 0;

          if (!constructorPointsForRace[constructorId]) {
            constructorPointsForRace[constructorId] = {
              name: result.Constructor.name,
              points: 0,
              color: getTeamColorById(constructorId),
            };
          }
          constructorPointsForRace[constructorId].points += points;
          totalPoints += points;
        });
      }

      const constructors = Object.values(constructorPointsForRace)
        .filter((c) => c.points > 0)
        .sort((a, b) => b.points - a.points);

      raceData.push({
        country,
        raceName,
        round,
        constructors,
        totalPoints,
      });
    });

    return raceData;
  }, [raceSchedule, raceResultsData, sprintResultsData]);

  const uniqueConstructors = useMemo(() => {
    if (distributionData.length === 0) return [];
    const constructorMap = new Map<string, { name: string; color: string }>();
    distributionData.forEach((race) => {
      race.constructors.forEach((constructor) => {
        if (constructor.points > 0 && !constructorMap.has(constructor.name)) {
          constructorMap.set(constructor.name, {
            name: constructor.name,
            color: constructor.color,
          });
        }
      });
    });
    return Array.from(constructorMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [distributionData]);

  const isDataLoading = loadingRaces.size > 0 || isLoading;

  if (isDataLoading && Object.keys(raceResultsData).length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border p-6",
          isGlass && "border-white/10 bg-white/5"
        )}
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading points distribution...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (distributionData.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border p-6",
          isGlass && "border-white/10 bg-white/5"
        )}
      >
        <p className="text-sm text-muted-foreground text-center">
          No distribution data available yet.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("w-full p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader>
          <F1CardTitle icon={<BarChart3 className="h-5 w-5" />}>
            Points Distribution
          </F1CardTitle>
        </F1CardHeader>
        <F1CardContent>
          {uniqueConstructors.length > 0 && (
            <div className="mb-4 pb-4 border-b border-border">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-xs font-medium text-muted-foreground">
                  Teams:
                </span>
                {uniqueConstructors.map((constructor) => (
                  <div
                    key={constructor.name}
                    className="flex items-center gap-1.5"
                  >
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: constructor.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {constructor.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {distributionData.map((race) => (
              <div
                key={`${race.country}-${race.round}`}
                className="flex items-center gap-3"
              >
                <CountryFlag
                  country={race.country}
                  size={24}
                 
                  className="shrink-0"
                />

                <div className="relative flex-1 h-8 bg-muted/30 rounded overflow-hidden">
                  <div className="absolute inset-0 flex">
                    {race.constructors
                      .filter((c) => c.points > 0)
                      .map((constructor, idx, arr) => {
                        const width =
                          (constructor.points / race.totalPoints) * 100;
                        const isLast = idx === arr.length - 1;
                        return (
                          <Tooltip
                            key={`${race.round}-${constructor.name}-${idx}`}
                          >
                            <TooltipTrigger asChild>
                              <div
                                className="h-full transition-all cursor-pointer hover:opacity-80 relative z-10"
                                style={{
                                  width: `${width}%`,
                                  backgroundColor: constructor.color,
                                  minWidth:
                                    constructor.points > 0 ? "2px" : "0",
                                  borderRight: isLast
                                    ? "none"
                                    : "1px solid rgba(255, 255, 255, 0.4)",
                                  boxShadow: isLast
                                    ? "none"
                                    : "inset -1px 0 0 rgba(0, 0, 0, 0.3)",
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs z-50">
                              <div className="font-semibold">
                                {constructor.name}
                              </div>
                              <div className="text-muted-foreground">
                                {constructor.points} points
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </div>
                </div>

                <span className="text-sm font-bold text-primary shrink-0 min-w-[3rem] text-right">
                  {race.totalPoints}
                </span>
              </div>
            ))}
          </div>
        </F1CardContent>
      </F1Card>
    </TooltipProvider>
  );
};

export default React.memo(PointsDistributionView);
