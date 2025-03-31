
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import YearSelector from "@/components/common/YearSelector";
import { TEAM_COLORS } from "@/constants/f1Colors";

const Constructors = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: constructorStandings, isLoading } = useConstructorStandings(selectedYear);
  const { data: driverStandings } = useDriverStandings(selectedYear);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter constructors based on search query
  const filteredConstructors = constructorStandings?.data.filter((constructor: any) => {
    return constructor.Constructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      constructor.Constructor.nationality.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group drivers by constructor
  const getTeamDrivers = (constructorId: string) => {
    if (!driverStandings?.data) return [];
    return driverStandings.data.filter((driver: any) => 
      driver.Constructors.some((c: any) => c.constructorId === constructorId)
    );
  };

  // Determine if a constructor is the champion for the year
  const isChampion = (constructor: any, year: number) => {
    // If it's the current year, check if they're leading
    if (year === currentYear) {
      return constructor.position === "1";
    }
    
    // For past years, ideally we would have historical data
    // For now, we'll just check if they're listed as position 1
    return constructor.position === "1";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">F1 Teams</h1>
            <p className="text-muted-foreground">Formula 1 constructors for the {selectedYear} season</p>
          </div>
          <YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />
        </div>

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
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredConstructors?.map((constructor: any) => {
              const teamColor = TEAM_COLORS[constructor.Constructor.constructorId] || TEAM_COLORS.default;
              const teamDrivers = getTeamDrivers(constructor.Constructor.constructorId);
              const teamIsChampion = isChampion(constructor, selectedYear);

              return (
                <Card 
                  key={constructor.Constructor.constructorId} 
                  className="overflow-hidden border-t-4 hover:shadow-md transition-shadow"
                  style={{ borderTopColor: teamColor }}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: teamColor }}>
                        {constructor.Constructor.name.charAt(0)}
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">
                            {constructor.Constructor.name}
                          </CardTitle>
                          {teamIsChampion && selectedYear < currentYear && (
                            <Badge className="bg-yellow-500 text-black">Champion</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{constructor.Constructor.nationality}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-f1-dark">P{constructor.position}</Badge>
                  </CardHeader>
                  
                  <CardContent>
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
                        {teamDrivers.map((driver: any) => (
                          <div key={driver.Driver.driverId} className="flex items-center gap-2 p-2 rounded-md bg-gray-800/50">
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
                  </CardContent>
                  
                  <CardFooter>
                    <a 
                      href={constructor.Constructor.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-f1-red hover:underline"
                    >
                      View Team Profile
                    </a>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Constructors;
