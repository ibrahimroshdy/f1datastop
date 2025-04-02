import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults } from "@/hooks/useF1Data";
import { Loader2, Trophy, Flag, Calendar, Clock, AlertCircle, Users, Building2 } from "lucide-react";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import PageSelector from "@/components/navigation/PageSelector";
import MainLayout from "@/components/layout/MainLayout";

const Index = () => {
  const { data: driverStandings, isLoading: isDriversLoading } = useDriverStandings();
  const { data: constructorStandings, isLoading: isConstructorsLoading } = useConstructorStandings();
  const { data: raceSchedule, isLoading: isScheduleLoading } = useRaceSchedule();
  const { data: lastRaceResults, isLoading: isResultsLoading } = useLastRaceResults();
  
  const isLoading = isDriversLoading || isConstructorsLoading || isScheduleLoading || isResultsLoading;
  const [isOffline, setIsOffline] = useState(false);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  
  useEffect(() => {
    if (
      driverStandings?.error || 
      constructorStandings?.error || 
      raceSchedule?.error || 
      lastRaceResults?.error
    ) {
      setIsOffline(true);
    }
  }, [driverStandings, constructorStandings, raceSchedule, lastRaceResults]);
  
  const getTeamColor = (constructorId: string) => {
    const teamColors: Record<string, string> = {
      "red_bull": "bg-redbull",
      "ferrari": "bg-ferrari",
      "mercedes": "bg-mercedes",
      "mclaren": "bg-mclaren",
      "aston_martin": "bg-aston-martin",
      "alpine": "bg-alpine",
      "alphatauri": "bg-alphatauri",
      "haas": "bg-haas",
      "williams": "bg-williams",
      "alfa": "bg-alfa-romeo"
    };
    return teamColors[constructorId] || "bg-gray-600";
  };
  
  const getCountryFlag = (location: string) => {
    const countryFlags: Record<string, string> = {
      "Monte Carlo": "🇲🇨",
      "Monza": "🇮🇹",
      "Melbourne": "🇦🇺",
      "Sakhir": "🇧🇭",
      "Jeddah": "🇸🇦",
      "Shanghai": "🇨🇳",
      "Miami": "🇺🇸",
      "Imola": "🇮🇹",
      "Monaco": "🇲🇨",
      "Montreal": "🇨🇦",
      "Barcelona": "🇪🇸",
      "Spielberg": "🇦🇹",
      "Silverstone": "🇬🇧",
      "Budapest": "🇭🇺",
      "Spa": "🇧🇪",
      "Zandvoort": "🇳🇱",
      "Baku": "🇦🇿",
      "Singapore": "🇸🇬",
      "Suzuka": "🇯🇵",
      "Losail": "🇶🇦",
      "Austin": "🇺🇸",
      "Mexico City": "🇲🇽",
      "Sao Paulo": "🇧🇷",
      "Las Vegas": "🇺🇸",
      "Yas Marina": "🇦🇪",
    };
    
    for (const [key, value] of Object.entries(countryFlags)) {
      if (location?.includes(key)) {
        return value;
      }
    }
    return "🏁"; // Default racing flag
  };
  
  const nextRace = raceSchedule?.data?.find(race => {
    const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
    return raceDate > new Date();
  });
  
  const removeFlag = (raceName: string) => {
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };
  
  const formatRaceDate = (dateStr: string, timeStr: string) => {
    const raceDate = new Date(dateStr + "T" + (timeStr || "00:00:00Z"));
    return {
      date: raceDate.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
      time: raceDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      fromNow: formatDistance(raceDate, new Date(), { addSuffix: true })
    };
  };
  
  const topDrivers = driverStandings?.data?.slice(0, 3) || [];
  const maxPoints = driverStandings?.data?.length > 0 ? Number(driverStandings.data[0].points) : 0;
  
  const driversToShow = showAllDrivers 
    ? driverStandings?.data 
    : driverStandings?.data?.slice(0, 10);
  
  return (
    <MainLayout>
      <div className="min-h-screen bg-f1-dark text-white p-4 md:p-8">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
                <span className="h-8 w-8 bg-f1-red rounded-full flex items-center justify-center font-bold">F1</span>
                Formula 1 Season {new Date().getFullYear()}
              </h1>
              <p className="text-gray-400 mt-1">Live race data, standings and schedule</p>
            </div>
            {nextRace && (
              <div className="mt-4 md:mt-0 bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                <span className="text-xl">{getCountryFlag(nextRace.Circuit.Location.country)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-f1-red text-white border-0">NEXT RACE</Badge>
                    <span className="font-medium">{removeFlag(nextRace.raceName)}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatRaceDate(nextRace.date, nextRace.time || "").fromNow}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <PageSelector />
        </header>
        
        {isOffline && (
          <Alert className="mb-6 bg-yellow-900/20 border-yellow-600 text-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertTitle>API Connection Issue</AlertTitle>
            <AlertDescription>
              Unable to connect to the F1 API. Showing offline data instead. Some information might not be up to date.
            </AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-12 h-12 animate-spin text-f1-red" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="col-span-2 bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-f1-red" />
                      Driver Standings
                    </CardTitle>
                    <button 
                      onClick={() => setShowAllDrivers(!showAllDrivers)}
                      className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      <Users className="h-4 w-4" />
                      {showAllDrivers ? 'Show Top 10' : 'Show All Drivers'}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="w-12">Pos</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {driversToShow?.map((driver) => (
                        <TableRow key={driver.position} className="border-gray-800">
                          <TableCell className="font-medium">{driver.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-6 ${getTeamColor(driver.Constructors[0].constructorId)} rounded-sm`}></div>
                              <span>{driver.Driver.givenName} {driver.Driver.familyName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{driver.Constructors[0].name}</TableCell>
                          <TableCell className="text-right font-medium">{driver.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              <div className="space-y-6">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-f1-red" />
                      Constructor Standings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {constructorStandings?.data?.slice(0, 5).map((team) => (
                        <div key={team.position} className="flex items-center gap-3">
                          <span className="text-lg font-medium w-6">{team.position}</span>
                          <div className={`w-2 h-8 ${getTeamColor(team.Constructor.constructorId)} rounded-sm`}></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium">{team.Constructor.name}</span>
                              <span className="font-medium">{team.points} pts</span>
                            </div>
                            <Progress 
                              value={(Number(team.points) / Number(constructorStandings.data[0].points)) * 100} 
                              className="h-2 bg-gray-800" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-f1-red" />
                      Last Race Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2">
                      <h3 className="font-bold text-lg">
                        {lastRaceResults?.data?.raceName ? removeFlag(lastRaceResults.data.raceName) : "No race data"}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {lastRaceResults?.data?.results?.slice(0, 5).map((result) => (
                        <div key={result.position} className="flex justify-between items-center border-b border-gray-800 pb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-medium w-6">{result.position}</span>
                            <div className={`w-1.5 h-6 ${getTeamColor(result.Constructor.constructorId)} rounded-sm`}></div>
                            <span>{result.Driver.code}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{result.Time?.time || "DNF"}</div>
                            <div className="text-xs text-gray-400">{result.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <Tabs defaultValue="schedule">
              <TabsList className="bg-gray-800">
                <TabsTrigger value="schedule" className="data-[state=active]:bg-f1-red">Race Schedule</TabsTrigger>
                <TabsTrigger value="constructors" className="data-[state=active]:bg-f1-red">Constructor Standings</TabsTrigger>
              </TabsList>
              <TabsContent value="schedule" className="bg-gray-900 rounded-lg border border-gray-800 p-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {raceSchedule?.data?.slice(0, 6).map((race) => {
                    const raceTime = formatRaceDate(race.date, race.time || "");
                    const isPast = new Date(race.date) < new Date();
                    
                    return (
                      <Card key={race.round} className={`bg-gray-900 border-gray-800 ${isPast ? 'opacity-70' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getCountryFlag(race.Circuit.Location.country)}</span>
                              <div>
                                <h3 className="font-bold">{removeFlag(race.raceName)}</h3>
                                <p className="text-sm text-gray-400">{race.Circuit.circuitName}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`${isPast ? 'bg-gray-600' : 'bg-f1-red'} text-white border-0`}>
                              {isPast ? 'COMPLETED' : 'UPCOMING'}
                            </Badge>
                          </div>
                          <div className="mt-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Date:</span>
                              <span>{raceTime.date}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Time:</span>
                              <span>{raceTime.time}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-400">Round:</span>
                              <span className="font-medium">{race.round} / {raceSchedule.data.length}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="constructors" className="bg-gray-900 rounded-lg border border-gray-800 p-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                  {constructorStandings?.data?.map((team) => (
                    <div key={team.position} className="flex items-center gap-4">
                      <span className="text-lg font-medium w-6">{team.position}</span>
                      <div className={`w-2 h-10 ${getTeamColor(team.Constructor.constructorId)} rounded-sm`}></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{team.Constructor.name}</span>
                          <span className="font-medium">{team.points} pts</span>
                        </div>
                        <Progress 
                          value={(Number(team.points) / Number(constructorStandings.data[0].points)) * 100} 
                          className="h-2 bg-gray-800" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Index;
