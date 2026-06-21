import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import { StandingsSkeleton } from "@/components/f1/F1Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import { Caravan, Calendar, Flag, Trophy, Users } from "lucide-react";
import CombinedStandingsTab from "@/components/standings/CombinedStandingsTab";
import ConstructorStandingsCard from "@/components/standings/ConstructorStandingsCard";
import DriverStandingsCard from "@/components/standings/DriverStandingsCard";
import {
  DEFAULT_CONSTRUCTORS_VISIBLE,
  DEFAULT_DRIVERS_VISIBLE,
} from "@/components/standings/standingsUtils";

export interface CombinedStandingsCardProps {
  driverStandings: any;
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
  onExpandChange?: (expanded: boolean) => void;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

type StandingsTab = "combined" | "drivers" | "constructors";

const underlineTabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-2 py-1.5 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none lg:px-3 lg:py-2 lg:text-sm";

const CombinedStandingsCard = ({
  driverStandings,
  constructorStandings,
  getTeamColor: _getTeamColor,
  onExpandChange,
  isLoading = false,
  error = null,
  onRetry,
}: CombinedStandingsCardProps) => {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();
  const [tab, setTab] = useState<StandingsTab>("drivers");
  const [showAll, setShowAll] = useState(false);

  const hasSeasonStarted = useMemo(
    () => (driverStandings?.data || []).some((d: any) => Number(d.points || 0) > 0),
    [driverStandings?.data],
  );

  const hasData = useMemo(
    () => (driverStandings?.data?.length > 0) || (constructorStandings?.data?.length > 0),
    [driverStandings?.data, constructorStandings?.data],
  );

  const toggleShowAll = () => {
    setShowAll((prev) => {
      const next = !prev;
      onExpandChange?.(next);
      return next;
    });
  };

  const titleIcon = tab === "drivers"
    ? <Users className="h-5 w-5 text-primary" />
    : <Trophy className="h-5 w-5 text-primary" />;

  const toggleText = (() => {
    if (tab === "drivers") {
      return showAll ? `Show Top ${DEFAULT_DRIVERS_VISIBLE}` : "Show All Drivers";
    }
    const totalTeams = constructorStandings?.data?.length || 0;
    if (totalTeams <= DEFAULT_CONSTRUCTORS_VISIBLE) {
      return showAll ? "Collapse" : "Show All Teams";
    }
    return showAll ? `Show Top ${DEFAULT_CONSTRUCTORS_VISIBLE}` : "Show All Teams";
  })();

  const showContent = !isLoading && !error && hasData && hasSeasonStarted;

  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("h-full p-0", isGlass && "border-white/10")}
    >
      <F1CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <F1CardTitle icon={titleIcon} className="text-base font-semibold">
            Standings
          </F1CardTitle>
          <button
            onClick={toggleShowAll}
            className="text-xs lg:text-sm text-muted-foreground hover:text-foreground"
          >
            {toggleText}
          </button>
        </div>

        <div className="mt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as StandingsTab)}>
            <div className="w-full flex justify-center lg:justify-end">
              <TabsList className="inline-flex h-auto mx-auto lg:mx-0 gap-0 rounded-none border-b border-border bg-transparent p-0">
                <TabsTrigger value="combined" className={cn(underlineTabTrigger, "gap-1")}>
                  <Caravan className="h-4 w-4" /> Combined
                </TabsTrigger>
                <TabsTrigger value="drivers" className={cn(underlineTabTrigger, "gap-1")}>
                  <Users className="h-4 w-4" /> Drivers
                </TabsTrigger>
                <TabsTrigger value="constructors" className={cn(underlineTabTrigger, "gap-1")}>
                  <Caravan className="h-4 w-4" /> Constructors
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </F1CardHeader>

      <F1CardContent className="pt-0">
        {isLoading && <StandingsSkeleton rows={8} />}

        {error && !isLoading && (
          <F1EmptyState
            type="loading-failed"
            title="Failed to Load"
            description="Couldn't load standings."
            actionText={onRetry ? "Retry" : undefined}
            onAction={onRetry}
            size="sm"
          />
        )}

        {!isLoading && !error && hasData && !hasSeasonStarted && (
          <div className="py-4">
            <F1EmptyState
              type="season-start"
              title="Season Starting"
              description="All drivers at 0 points."
              icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              size="sm"
              showDecoration={false}
            />
          </div>
        )}

        {!isLoading && !error && !hasData && (
          <F1EmptyState
            type="no-data"
            title="No Data"
            description="Standings not available."
            icon={<Flag className="h-8 w-8 text-muted-foreground" />}
            size="sm"
          />
        )}

        {showContent && (
          <Tabs value={tab}>
            <TabsContent value="combined" className="mt-0">
              <CombinedStandingsTab
                driverStandings={driverStandings}
                constructorStandings={constructorStandings}
                showAll={showAll}
              />
            </TabsContent>
            <TabsContent value="drivers" className="mt-0">
              <DriverStandingsCard
                driverStandings={driverStandings}
                constructorStandings={constructorStandings}
                showAll={showAll}
              />
            </TabsContent>
            <TabsContent value="constructors" className="mt-0">
              <ConstructorStandingsCard
                constructorStandings={constructorStandings}
                showAll={showAll}
              />
            </TabsContent>
          </Tabs>
        )}

        <div className="pt-3 border-t border-border mt-3">
          <Link
            to="/standings"
            className="text-xs lg:text-sm text-primary hover:underline"
          >
            View full standings →
          </Link>
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default CombinedStandingsCard;
