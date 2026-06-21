import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  F1Card,
  F1CardContent,
  F1CardFooter,
  F1CardHeader,
  F1CardTitle,
  PageHeader,
} from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import TeamLogo from "@/components/common/TeamLogo";
import YearSelector from "@/components/common/YearSelector";
import { cn } from "@/lib/utils";
import TeamHeritagePanel from "@/components/constructors/TeamHeritagePanel";

type ConstructorListEntry = {
  position: string;
  points: string;
  wins: string;
  Constructor: {
    constructorId: string;
    name: string;
    nationality: string;
    url?: string;
  };
};

type DriverStandingForTeam = {
  position: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code: string;
    permanentNumber?: string;
  };
  Constructors: Array<{ constructorId: string }>;
};

const Constructors = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: constructorStandings, isLoading } = useConstructorStandings(selectedYear);
  const { data: driverStandings } = useDriverStandings(selectedYear);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter constructors based on search query
  const filteredConstructors = constructorStandings?.data.filter((constructor: ConstructorListEntry) => {
    return constructor.Constructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      constructor.Constructor.nationality.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group drivers by constructor
  const getTeamDrivers = (constructorId: string) => {
    if (!driverStandings?.data) return [];
    return driverStandings.data.filter((driver: DriverStandingForTeam) =>
      driver.Constructors.some((c) => c.constructorId === constructorId)
    );
  };

  // Determine if a constructor is the champion for the year
  const isChampion = (constructor: ConstructorListEntry, year: number) => {
    // If it's the current year, check if they're leading
    if (year === currentYear) {
      return constructor.position === "1";
    }
    
    // For past years, ideally we would have historical data
    // For now, we'll just check if they're listed as position 1
    return constructor.position === "1";
  };

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          title="F1 Teams"
          description={`Formula 1 constructors for the ${selectedYear} season`}
          actions={<YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />}
        />

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array(10).fill(0).map((_, i) => (
              <F1Card
                key={i}
                variant={cardVariant}
                glassVariant={glassVariant}
                className="overflow-hidden"
              >
                <F1CardHeader>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </F1CardHeader>
                <F1CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </F1CardContent>
              </F1Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredConstructors?.map((constructor: ConstructorListEntry) => {
              const teamColor = TEAM_COLORS[constructor.Constructor.constructorId] || TEAM_COLORS.default;
              const teamDrivers = getTeamDrivers(constructor.Constructor.constructorId);
              const teamIsChampion = isChampion(constructor, selectedYear);

              return (
                <F1Card
                  key={constructor.Constructor.constructorId}
                  variant={cardVariant}
                  glassVariant={glassVariant}
                  className={cn(
                    "overflow-hidden border-t-4 p-0 hover:shadow-md transition-shadow",
                    isGlass ? "border-white/10" : "border-border"
                  )}
                  style={{ borderTopColor: teamColor }}
                >
                  <F1CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar
                              className="h-14 w-14 rounded-md flex items-center justify-center overflow-hidden border-2 bg-neutral-950"
                              style={{ borderColor: teamColor }}
                            >
                              <div className="flex h-full w-full items-center justify-center px-1.5">
                                <TeamLogo
                                  constructorId={constructor.Constructor.constructorId}
                                  alt={constructor.Constructor.name}
                                  className="max-h-9 max-w-[7rem] object-contain"
                                  noBackground
                                />
                              </div>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{constructor.Constructor.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div>
                        <div className="flex items-center gap-2">
                          <F1CardTitle className="text-xl !font-semibold">
                            {constructor.Constructor.name}
                          </F1CardTitle>
                          {teamIsChampion && selectedYear < currentYear && (
                            <Badge className="bg-yellow-500 text-black">Champion</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{constructor.Constructor.nationality}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-secondary text-secondary-foreground">P{constructor.position}</Badge>
                  </F1CardHeader>
                  
                  <F1CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-muted-foreground text-sm">Points</p>
                        <p className="font-semibold text-lg">{constructor.points}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">Wins</p>
                        <p className="font-semibold text-lg">{constructor.wins}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Drivers</h4>
                      <div className="space-y-2">
                        {teamDrivers.map((driver: DriverStandingForTeam) => (
                          <div key={driver.Driver.driverId} className="flex items-center gap-2 p-2 rounded-md bg-accent/30">
                            <div className="w-1 h-full rounded-full" style={{ backgroundColor: teamColor }}></div>
                            <div>
                              <p className="font-medium">{driver.Driver.givenName} {driver.Driver.familyName}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <span>{driver.Driver.code}</span>
                                <span className="text-xs">#{driver.Driver.permanentNumber || 'N/A'}</span>
                              </div>
                            </div>
                            <Badge className="ml-auto" variant="outline">P{driver.position}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </F1CardContent>
                  
                  <F1CardFooter className="border-t pt-4">
                    <TeamHeritagePanel
                      constructorId={constructor.Constructor.constructorId}
                      teamName={constructor.Constructor.name}
                      teamColor={teamColor}
                      compact
                      className="w-full"
                    />
                  </F1CardFooter>
                </F1Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Constructors;
