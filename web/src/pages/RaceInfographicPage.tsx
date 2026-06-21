import { useState, useRef } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { F1Card, F1CardContent, F1CardHeader } from "@/components/f1";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Calendar, 
  Trophy, 
  Flag, 
  Timer, 
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { format, parseISO } from "date-fns";
import html2canvas from "html2canvas";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { 
  useRaceSchedule,
  useRaceResults, 
  useRaceQualifying, 
  useLastRacePitStops
} from "@/hooks/useF1Data";
import { toast } from "sonner";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

// Helper function to get team color
const getTeamHexColor = (constructorId: string): string => {
  let normalizedTeamId = (constructorId || "").toLowerCase();
  if (normalizedTeamId === "alphatauri") normalizedTeamId = "rb";
  if (normalizedTeamId === "alfa") normalizedTeamId = "sauber";
  return TEAM_COLORS[normalizedTeamId] || "#666666";
};

const RaceInfographicPage = () => {
  const { year, round } = useParams<{ year: string; round: string }>();
  const navigate = useNavigate();
  const infographicRef = useRef<HTMLDivElement>(null);
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const [isDownloading, setIsDownloading] = useState(false);

  // Parse year and round
  const selectedYear = parseInt(year || new Date().getFullYear().toString());
  const selectedRound = round || "1";

  // Fetch race schedule to get race details
  const { data: scheduleData, isLoading: isScheduleLoading } = useRaceSchedule(selectedYear);
  
  // Find the specific race
  const race = scheduleData?.data?.find((r: any) => r.round === selectedRound);

  // Fetch race data
  const { data: raceResults, isLoading: isResultsLoading } = useRaceResults(selectedYear, selectedRound);
  const { data: qualifyingResults, isLoading: isQualifyingLoading } = useRaceQualifying(selectedYear, selectedRound);
  const { data: pitStops, isLoading: isPitStopsLoading } = useLastRacePitStops(Number(selectedYear));

  const isLoading = isScheduleLoading || isResultsLoading || isQualifyingLoading || isPitStopsLoading;

  // Get race name and location
  const raceName = race ? getRaceNameWithoutEmoji(race.raceName) : "Race";
  const country = race?.Circuit?.Location?.country || "";
  const countryCode = getCountryCode(country) || "";
  const locality = race?.Circuit?.Location?.locality || "";
  const circuitName = race?.Circuit?.circuitName || "";
  const raceDate = race?.date ? parseISO(race.date) : new Date();

  // Get results data
  const results = raceResults?.data?.Results || [];
  const qualifying = qualifyingResults?.data?.QualifyingResults || [];
  const pitStopData = pitStops?.data || [];

  // Find fastest lap
  const fastestLap = results.find((r: any) => r.FastestLap?.rank === "1");

  // Download infographic as PNG
  const handleDownload = async () => {
    if (!infographicRef.current) return;
    
    setIsDownloading(true);
    toast.info("Generating infographic...");

    try {
      const canvas = await html2canvas(infographicRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `F1_${raceName.replace(/\s+/g, "_")}_${selectedYear}_Round${selectedRound}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Infographic downloaded!");
    } catch (error) {
      console.error("Error generating infographic:", error);
      toast.error("Failed to generate infographic");
    } finally {
      setIsDownloading(false);
    }
  };

  // Share functionality
  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${raceName} ${selectedYear} - F1 DataStop`,
          text: `Check out the ${raceName} race infographic!`,
          url: url,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (isScheduleLoading) {
    return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
    );
  }

  if (!race) {
    return (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate("/calendar")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Calendar
          </Button>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Race not found. Please check the year and round number.
            </AlertDescription>
          </Alert>
        </div>
    );
  }

  return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")} className="gap-1.5 h-8">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Back</span>
            </Button>
            <div className="flex items-center gap-2">
              {countryCode && (
                <ReactCountryFlag
                  countryCode={countryCode}
                  svg
                  style={{ width: "20px", height: "auto" }}
                  title={country}
                />
              )}
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{raceName}</h1>
            </div>
            <Badge variant="outline" className="text-xs">
              Round {selectedRound}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 h-8">
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Share</span>
            </Button>
            <Button 
              size="sm" 
              onClick={handleDownload} 
              disabled={isDownloading || isLoading}
              className="gap-1.5 h-8"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline text-xs">Download PNG</span>
            </Button>
          </div>
        </div>

        {/* Infographic Content */}
        <div ref={infographicRef} className="space-y-4">
          {/* Race Header Card */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
            <div className="h-1 w-full bg-gradient-to-r from-f1-red via-f1-red to-transparent" />
            <F1CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  {countryCode && (
                    <ReactCountryFlag
                      countryCode={countryCode}
                      svg
                      style={{ width: "32px", height: "auto" }}
                      title={country}
                    />
                  )}
                  <div>
                    <h2 className="text-lg font-bold">{raceName}</h2>
                    <p className="text-sm text-muted-foreground">{circuitName}</p>
                    <p className="text-xs text-muted-foreground">{locality}, {country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{format(raceDate, "dd MMM yyyy")}</span>
                </div>
              </div>
            </F1CardContent>
          </F1Card>

          {/* Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Race Results */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
              <F1CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Race Results</h3>
                </div>
                {/* Fastest Lap */}
                {fastestLap && (
                  <div className="mt-2 flex items-center justify-center">
                    <div className="border border-dashed border-purple-500/50 px-2 py-0.5 rounded inline-flex items-center gap-1.5 text-[10px]">
                      <span className="text-purple-500 font-medium">Fastest:</span>
                      <span 
                        className="font-mono font-bold" 
                        style={{ color: getTeamHexColor(fastestLap.Constructor?.constructorId) }}
                      >
                        {fastestLap.Driver?.code}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono">{fastestLap.FastestLap?.Time?.time}</span>
                    </div>
                  </div>
                )}
              </F1CardHeader>
              <F1CardContent className="px-2 pb-3">
                {isResultsLoading ? (
                  <div className="space-y-2 p-2">
                    {Array(10).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No results available</p>
                ) : (
                  <div className="space-y-1.5">
                    {results.slice(0, 10).map((result: any) => {
                      const position = Number(result.position);
                      const teamColor = getTeamHexColor(result.Constructor?.constructorId);
                      const isWinner = position === 1;
                      
                      return (
                        <div 
                          key={result.position}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                              position === 1 && "bg-yellow-500 text-yellow-950",
                              position === 2 && "bg-gray-300 text-gray-800",
                              position === 3 && "bg-amber-600 text-amber-50",
                              position > 3 && "bg-muted text-muted-foreground"
                            )}>
                              {position}
                            </div>
                            <div style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: '0.5rem' }}>
                              <div className="font-semibold text-sm">{result.Driver?.code}</div>
                              <div className="text-[10px] text-muted-foreground">{result.Constructor?.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xs">
                              {isWinner 
                                ? result.Time?.time 
                                : result.Time?.time?.startsWith('+') 
                                  ? result.Time.time 
                                  : result.status === "Finished" 
                                    ? "+" + result.Time?.time 
                                    : result.status
                              }
                            </div>
                            <div className="text-[10px] text-muted-foreground">+{result.points} pts</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </F1CardContent>
            </F1Card>

            {/* Qualifying Results */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
              <F1CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Qualifying Results</h3>
                </div>
                {/* Pole Position */}
                {qualifying[0] && (
                  <div className="mt-2 flex items-center justify-center">
                    <div className="border border-dashed border-f1-red/50 px-2 py-0.5 rounded inline-flex items-center gap-1.5 text-[10px]">
                      <span className="text-f1-red font-medium">Pole:</span>
                      <span 
                        className="font-mono font-bold" 
                        style={{ color: getTeamHexColor(qualifying[0].Constructor?.constructorId) }}
                      >
                        {qualifying[0].Driver?.code}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono">{qualifying[0].Q3 || qualifying[0].Q2 || qualifying[0].Q1}</span>
                    </div>
                  </div>
                )}
              </F1CardHeader>
              <F1CardContent className="px-2 pb-3">
                {isQualifyingLoading ? (
                  <div className="space-y-2 p-2">
                    {Array(10).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : qualifying.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No qualifying data available</p>
                ) : (
                  <div className="space-y-1.5">
                    {qualifying.slice(0, 10).map((result: any) => {
                      const position = Number(result.position);
                      const teamColor = getTeamHexColor(result.Constructor?.constructorId);
                      
                      return (
                        <div 
                          key={result.position}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                              position === 1 && "bg-yellow-500 text-yellow-950",
                              position === 2 && "bg-gray-300 text-gray-800",
                              position === 3 && "bg-amber-600 text-amber-50",
                              position > 3 && "bg-muted text-muted-foreground"
                            )}>
                              {position}
                            </div>
                            <div style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: '0.5rem' }}>
                              <div className="font-semibold text-sm">{result.Driver?.code}</div>
                              <div className="text-[10px] text-muted-foreground">{result.Constructor?.name}</div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-xs">
                            {result.Q3 || result.Q2 || result.Q1 || "-"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </F1CardContent>
            </F1Card>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Winner */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
              <F1CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs font-medium">Winner</span>
                </div>
                {results[0] ? (
                  <>
                    <p className="font-bold text-sm truncate">{results[0].Driver?.code}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{results[0].Constructor?.name}</p>
                    <p className="text-xs font-mono mt-1">{results[0].Time?.time}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">-</p>
                )}
              </F1CardContent>
            </F1Card>

            {/* Fastest Lap */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
              <F1CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium">Fastest Lap</span>
                </div>
                {fastestLap ? (
                  <>
                    <p className="font-bold text-sm">{fastestLap.Driver?.code}</p>
                    <p className="text-xs font-mono text-purple-500">{fastestLap.FastestLap?.Time?.time}</p>
                    <p className="text-[10px] text-muted-foreground">Lap {fastestLap.FastestLap?.lap}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">-</p>
                )}
              </F1CardContent>
            </F1Card>

            {/* Pole Position */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
              <F1CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Flag className="h-3.5 w-3.5 text-f1-red" />
                  <span className="text-xs font-medium">Pole Position</span>
                </div>
                {qualifying[0] ? (
                  <>
                    <p className="font-bold text-sm">{qualifying[0].Driver?.code}</p>
                    <p className="text-xs font-mono text-f1-red">{qualifying[0].Q3 || qualifying[0].Q2 || qualifying[0].Q1}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">-</p>
                )}
              </F1CardContent>
            </F1Card>

            {/* Fastest Pit Stop */}
          <F1Card
            variant={surfaceVariant}
            glassVariant={surfaceGlass}
            className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
          >
              <F1CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Timer className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium">Fastest Pit</span>
                </div>
                {pitStopData[0] ? (
                  <>
                    <p className="font-bold text-sm">{pitStopData[0].driver || pitStopData[0].driverId}</p>
                    <p className="text-xs font-mono text-green-500">{pitStopData[0].duration || pitStopData[0].time}</p>
                    <p className="text-[10px] text-muted-foreground">Lap {pitStopData[0].lap}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">-</p>
                )}
              </F1CardContent>
            </F1Card>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
            <span>Generated by F1 DataStop</span>
            <span>{format(new Date(), "dd MMM yyyy HH:mm")}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/race-analysis">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Race Analysis
            </Button>
          </Link>
          <Link to={`/race-analysis/${selectedYear}/${selectedRound}`}>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              Detailed Race Analysis
            </Button>
          </Link>
        </div>
      </div>
  );
};

export default RaceInfographicPage;
