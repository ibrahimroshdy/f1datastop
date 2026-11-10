import { useState } from "react";
import { Link } from "react-router-dom";
import { F1Card } from "@/components/f1";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import { StandingsSkeleton } from "@/components/f1/F1Skeleton";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { TeamName } from "@/components/f1/TeamName";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTeamColorById } from "@/constants/f1Colors";
import { currentSeason, seasonSearch, teamHref } from "@/lib/links";
import { CompactRow } from "./CompactRow";
import { gapInWords } from "./gapInWords";

interface DriverStanding {
  position?: string;
  points?: string;
  wins?: string;
  Driver?: { driverId: string; givenName?: string; familyName: string; nationality?: string };
  Constructors?: { constructorId: string; name: string }[];
}

interface TeamStanding {
  position?: string;
  points?: string;
  wins?: string;
  Constructor?: { constructorId: string; name: string };
}

export interface CombinedStandingsCardProps {
  driverStandings: { data?: DriverStanding[] | null } | null | undefined;
  constructorStandings: { data?: TeamStanding[] | null } | null | undefined;
  season: number;
  isLoading?: boolean;
}

const DRIVERS_SHOWN = 5;
const TEAMS_SHOWN = 3;

/**
 * Home's standings card: the top five drivers and the top three teams as uniform compact rows,
 * the gap in words, every name a link (D19, D29). "Show all" goes to the standings page.
 */
const CombinedStandingsCard = ({ driverStandings, constructorStandings, season, isLoading = false }: CombinedStandingsCardProps) => {
  const [tab, setTab] = useState<"drivers" | "teams">("drivers");
  const drivers = driverStandings?.data ?? [];
  const teams = constructorStandings?.data ?? [];
  const started = drivers.some((d) => Number(d.points || 0) > 0);
  const leaderPts = Number(drivers[0]?.points || 0);
  const leaderTeamPts = Number(teams[0]?.points || 0);

  return (
    <F1Card className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl">Standings{season !== currentSeason() ? ` ${season}` : ""}</h2>
        <Link to={`/standings${seasonSearch(season)}`} className="text-sm font-medium text-primary hover:underline">
          Show all
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "drivers" | "teams")} className="mt-3">
        <TabsList>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <StandingsSkeleton rows={DRIVERS_SHOWN} />
        ) : !started ? (
          <F1EmptyState
            type="season-start"
            title="Season starting"
            description={drivers.length ? "Every driver is on 0 points." : "Standings appear after the first race."}
            size="sm"
            showDecoration={false}
          />
        ) : (
          <>
            <TabsContent value="drivers">
              <ul className="divide-y divide-border">
                {drivers.slice(0, DRIVERS_SHOWN).map((s, i) => {
                  if (!s.Driver) return null;
                  const team = s.Constructors?.[s.Constructors.length - 1];
                  const pts = Number(s.points || 0);
                  return (
                    <CompactRow key={s.Driver.driverId} pos={s.position ?? i + 1} figure={pts} note={gapInWords(leaderPts, pts, i)}>
                      <DriverIdentity
                        compact
                        size={32}
                        driverId={s.Driver.driverId}
                        givenName={s.Driver.givenName}
                        familyName={s.Driver.familyName}
                        nationality={s.Driver.nationality}
                        constructorId={team?.constructorId}
                        teamName={team?.name}
                      />
                    </CompactRow>
                  );
                })}
              </ul>
            </TabsContent>
            <TabsContent value="teams">
              <ul className="divide-y divide-border">
                {teams.slice(0, TEAMS_SHOWN).map((t, i) => {
                  if (!t.Constructor) return null;
                  const pts = Number(t.points || 0);
                  const wins = Number(t.wins || 0);
                  return (
                    <CompactRow key={t.Constructor.constructorId} pos={t.position ?? i + 1} figure={pts} note={gapInWords(leaderTeamPts, pts, i)}>
                      <span className="flex items-stretch gap-2.5">
                        <span
                          aria-hidden="true"
                          className="w-1.5 shrink-0 rounded-full"
                          style={{ background: getTeamColorById(t.Constructor.constructorId) }}
                        />
                        <span className="flex min-w-0 flex-col">
                          <TeamName
                            constructorId={t.Constructor.constructorId}
                            name={t.Constructor.name}
                            to={teamHref(t.Constructor.constructorId, season)}
                            size={18}
                            className="font-semibold text-heading"
                          />
                          <span className="mt-0.5 text-[13px] text-muted-foreground">
                            {wins === 1 ? "1 win" : `${wins} wins`}
                          </span>
                        </span>
                      </span>
                    </CompactRow>
                  );
                })}
              </ul>
            </TabsContent>
          </>
        )}
      </Tabs>
    </F1Card>
  );
};

export default CombinedStandingsCard;
