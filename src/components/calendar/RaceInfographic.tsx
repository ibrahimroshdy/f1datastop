import React, { useRef, useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Download, 
  Trophy, 
  Flag, 
  Timer, 
  Zap, 
  Cloud, 
  Thermometer,
  Wind,
  Droplets,
  TrendingUp,
  Clock,
  AlertTriangle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import html2canvas from "html2canvas";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { 
  useRaceResults, 
  useRaceQualifying, 
  useLastRacePitStops,
  useLapTimes
} from "@/hooks/useF1Data";
import { toast } from "sonner";
import MuiSankeyChart from "@/components/analytics/MuiSankeyChart";

// Country name to ISO code mapping for emoji flags (works with html2canvas)
const countryToCode: { [key: string]: string } = {
  "Argentina": "AR", "Australia": "AU", "Austria": "AT", "Azerbaijan": "AZ",
  "Bahrain": "BH", "Belgium": "BE", "Brazil": "BR", "Canada": "CA", "China": "CN",
  "France": "FR", "Germany": "DE", "Hungary": "HU", "Italy": "IT", "Japan": "JP",
  "Mexico": "MX", "Monaco": "MC", "Netherlands": "NL", "Portugal": "PT", "Qatar": "QA",
  "Saudi Arabia": "SA", "Singapore": "SG", "Spain": "ES", "UK": "GB", "UAE": "AE",
  "United Kingdom": "GB", "United States": "US", "USA": "US", "Miami": "US",
  "Vegas": "US", "Las Vegas": "US", "Abu Dhabi": "AE", "Emilia Romagna": "IT",
  "Imola": "IT", "Sao Paulo": "BR", "Jeddah": "SA", "Zandvoort": "NL", "Monza": "IT",
  "Austin": "US", "Yas Marina": "AE", "Silverstone": "GB", "Spa": "BE",
  "Barcelona": "ES", "Montreal": "CA", "Baku": "AZ", "Suzuka": "JP", "Losail": "QA",
  "Shanghai": "CN"
};

// Helper to get country code from country name
const getCountryCodeFromName = (country: string): string => {
  if (!country) return "UN";
  const normalized = country.trim();
  if (countryToCode[normalized]) return countryToCode[normalized];
  
  // Try case-insensitive lookup
  const lower = normalized.toLowerCase();
  for (const [key, code] of Object.entries(countryToCode)) {
    if (key.toLowerCase() === lower) return code;
  }
  
  // Try partial match
  for (const [key, code] of Object.entries(countryToCode)) {
    if (normalized.includes(key) || key.includes(normalized)) return code;
  }
  
  return "UN"; // Default
};

// Helper to convert country code to emoji flag (works in html2canvas)
const getEmojiFlag = (country: string): string => {
  const code = getCountryCodeFromName(country).toUpperCase();
  if (code === "UN") return "🏁";
  const codePoints = code.split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

interface RaceInfographicProps {
  race: any;
  isVisible: boolean;
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
}

// Helper function to get team color
const getTeamColor = (constructorId: string) => {
  let normalizedTeamId = constructorId.toLowerCase();
  if (normalizedTeamId === "alphatauri") normalizedTeamId = "rb";
  if (normalizedTeamId === "alfa") normalizedTeamId = "sauber";
  return TEAM_COLORS[normalizedTeamId] || "#666666";
};

// Helper function to get team color style with border
const getTeamColorStyle = (constructorId: string) => {
  const color = getTeamColor(constructorId);
  return {
    borderLeft: `4px solid ${color}`,
    paddingLeft: "0.5rem"
  };
};

// Format lap time duration
const formatLapTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  } else {
    return `${seconds.toFixed(3)}`;
  }
};

// Mock weather data (in a real app, this would come from an API)
const getMockWeatherData = (race: any) => {
  const mockWeatherConditions = [
    { condition: "Sunny", temp: "28°C", humidity: "45%", wind: "12 km/h" },
    { condition: "Partly Cloudy", temp: "24°C", humidity: "55%", wind: "8 km/h" },
    { condition: "Overcast", temp: "22°C", humidity: "70%", wind: "15 km/h" },
    { condition: "Light Rain", temp: "18°C", humidity: "85%", wind: "20 km/h" },
  ];
  
  // Use race round to determine consistent weather
  const weatherIndex = parseInt(race.round) % mockWeatherConditions.length;
  return mockWeatherConditions[weatherIndex];
};


const RaceInfographic: React.FC<RaceInfographicProps> = ({ 
  race, 
  isVisible, 
  onDownloadStart, 
  onDownloadComplete 
}) => {
  const infographicRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Download function
  const downloadInfographic = async () => {
    if (!infographicRef.current || isDownloading) return;
    
    setIsDownloading(true);
    setIsGenerating(true);
    onDownloadStart?.();
    
    try {
      // Wait for any pending renders and data loading
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Ensure all images and fonts are loaded
      const images = infographicRef.current.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
          return new Promise((resolve) => {
          if (img.complete) {
            resolve(true);
          } else {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
          }
          });
      }));
      
      // Pre-load all flag images and convert to data URLs
      const flagImages = infographicRef.current.querySelectorAll('img[src*="flag"]');
      const imageDataMap = new Map<string, string>();
      
      await Promise.all(Array.from(flagImages).map(async (img) => {
        const imgElement = img as HTMLImageElement;
        const src = imgElement.src;
        if (src && !imageDataMap.has(src)) {
          try {
            const response = await fetch(src);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            imageDataMap.set(src, dataUrl);
          } catch (e) {
            console.warn('Failed to load flag image:', src);
          }
        }
      }));
      
              const canvas = await html2canvas(infographicRef.current, {
        scale: 2, // High quality
          useCORS: true,
          allowTaint: true,
        backgroundColor: '#0a0a0a', // Dark background to match theme
        width: infographicRef.current.offsetWidth,
        height: infographicRef.current.offsetHeight,
        logging: false, // Disable logging for cleaner output
        windowWidth: 1200, // Fixed width for consistent rendering
        onclone: (clonedDoc) => {
          // Ensure all text and elements are visible in the clone
          const clonedElement = clonedDoc.querySelector('[data-infographic-root]');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.transform = 'none';
            (clonedElement as HTMLElement).style.opacity = '1';
            (clonedElement as HTMLElement).style.visibility = 'visible';
            (clonedElement as HTMLElement).style.position = 'relative';
                
            // Ensure all child elements are visible and properly positioned
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.visibility = 'visible';
              htmlEl.style.opacity = '1';
              // Reset any transforms that might cause misalignment
              if (htmlEl.style.transform && htmlEl.style.transform !== 'none') {
                htmlEl.style.transform = 'none';
              }
            });
            
            // Replace external flag images with data URLs
            const clonedImages = clonedElement.querySelectorAll('img');
            clonedImages.forEach((img) => {
              const imgEl = img as HTMLImageElement;
              const dataUrl = imageDataMap.get(imgEl.src);
              if (dataUrl) {
                imgEl.src = dataUrl;
              }
            });
            
            // Remove any SVG elements that might cause issues (D3 charts)
            const svgElements = clonedElement.querySelectorAll('svg');
            svgElements.forEach((svg) => {
              // Keep simple SVG icons, remove complex D3 charts
              if (svg.querySelector('path.link-path') || svg.querySelector('.sankey-node')) {
                svg.remove();
              }
            });
          }
          }
        });
      
      // Create download link
          const link = document.createElement('a');
      link.download = `${raceName.replace(/\s+/g, '_')}_${year}_Race_Infographic.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      
      // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
      toast.success("Race infographic downloaded successfully!");
    } catch (error) {
      console.error("Error generating infographic:", error);
      toast.error("Failed to generate infographic. Please try again.");
    } finally {
      setIsDownloading(false);
      setIsGenerating(false);
      onDownloadComplete?.();
    }
  };

  // Listen for external download trigger
  useEffect(() => {
    const handleExternalDownload = (event: CustomEvent) => {
      if (event.detail.raceRound === race?.round) {
        downloadInfographic();
      }
    };

    window.addEventListener('triggerInfographicDownload', handleExternalDownload as EventListener);
    
    return () => {
      window.removeEventListener('triggerInfographicDownload', handleExternalDownload as EventListener);
    };
  }, [race?.round, downloadInfographic]);
  
  const year = parseInt(race?.season || "0");
  const round = race?.round || "0";

  // Data hooks
  const { data: raceResults, isLoading: isResultsLoading } = useRaceResults(year, round);
  const { data: qualifyingResults, isLoading: isQualifyingLoading } = useRaceQualifying(year, round);
  const { data: pitStopsData, isLoading: isPitStopsLoading } = useLastRacePitStops();
  const { data: lapTimesData, isLoading: isLapTimesLoading } = useLapTimes(year, round, false);

  const isLoading = isResultsLoading || isQualifyingLoading || isPitStopsLoading || isLapTimesLoading;

  // Get race name and country info
  const raceName = getRaceNameWithoutEmoji(race?.raceName || "");
  const country = race?.Circuit?.Location?.country || "";
  const circuitName = race?.Circuit?.circuitName || "";
  const raceDate = race?.date ? format(parseISO(race.date), 'MMMM d, yyyy') : '';

  // Get weather data
  const weatherData = getMockWeatherData(race);

  // Process fastest lap data
  const fastestLapData = useMemo(() => {
    if (!raceResults?.data?.Results) return null;
    
    const fastestLapDriver = raceResults.data.Results.find((result: any) => 
      result.FastestLap?.rank === "1"
    );
    
    if (fastestLapDriver) {
      return {
        driver: fastestLapDriver.Driver,
        constructor: fastestLapDriver.Constructor,
        lapTime: fastestLapDriver.FastestLap?.Time?.time,
        lap: fastestLapDriver.FastestLap?.lap,
        speed: fastestLapDriver.FastestLap?.AverageSpeed?.speed
      };
    }
    return null;
  }, [raceResults]);
  
  // Process pit stops data
  const fastestPitStop = useMemo(() => {
    // Try multiple possible data structures for pit stops
    let pitStops = null;
    
    if (pitStopsData?.data?.MRData?.RaceTable?.Races?.[0]?.PitStops) {
      pitStops = pitStopsData.data.MRData.RaceTable.Races[0].PitStops;
    } else if (pitStopsData?.data?.Races?.[0]?.PitStops) {
      pitStops = pitStopsData.data.Races[0].PitStops;
    }
    
    if (!pitStops || pitStops.length === 0) return null;
    
    let fastest = null;
    let fastestTime = Infinity;
    
    pitStops.forEach((stop: any) => {
      const duration = parseFloat(stop.duration);
      if (duration < fastestTime && duration > 0) {
        fastestTime = duration;
        fastest = stop;
      }
    });
    
    return fastest ? {
      ...fastest,
      duration: fastestTime
    } : null;
  }, [pitStopsData]);

  if (!isVisible) return null;

  return (
    <div className="w-full">
      {/* Download Button */}
      <div className="flex justify-end mb-4">
        <Button
          onClick={downloadInfographic}
          disabled={isDownloading || isLoading}
          size="sm"
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PNG
            </>
          )}
        </Button>
      </div>

      {/* Infographic Content */}
      <div
        ref={infographicRef}
        data-infographic-root
        className="bg-background p-8 rounded-lg border"
        style={{ width: '1200px', minHeight: '1600px' }}
      >
        {/* Header Section */}
        <div className="text-center mb-8 space-y-4">
          <div className="flex items-center justify-center gap-4">
            <span className="text-5xl" role="img" aria-label={country}>
              {getEmojiFlag(country)}
            </span>
              <div>
              <h1 className="text-4xl font-bold text-foreground">{raceName}</h1>
              <p className="text-lg text-muted-foreground">{circuitName}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium">Round {race.round} • {raceDate}</p>
            <Badge className="bg-f1-red text-white text-sm px-4 py-2">
              Formula 1 {race.season} Season
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-8 w-1/3 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
        </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Row: Race Results and Key Stats */}
            <div className="grid grid-cols-3 gap-6">
              {/* Race Results - Main Section */}
              <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                    Final Race Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                  {raceResults?.data?.Results ? (
                    <div className="grid grid-cols-2 gap-3">
                      {raceResults.data.Results.slice(0, 10).map((result: any) => (
                        <div key={result.position} className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                      <div className="flex items-center gap-3">
                            <div className="text-xl font-bold w-8 text-center">{result.position}</div>
                        <div style={getTeamColorStyle(result.Constructor.constructorId)}>
                              <div className="font-bold text-sm">{result.Driver.code}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-24">
                                {result.Driver.familyName}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                            <div className="font-mono text-sm font-medium">
                              {result.position === '1' ? result.Time?.time : 
                               result.Time?.time?.startsWith('+') ? result.Time.time : 
                               result.status === "Finished" ? "+" + result.Time?.time : result.status}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">{result.points} pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>Race results not available</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Key Race Stats */}
              <div className="space-y-4">
                {/* Weather */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Cloud className="h-5 w-5 text-sky-500" />
                      Weather
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-red-500" />
                        <span className="text-sm">{weatherData.temp}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">{weatherData.humidity}</span>
                    </div>
                      <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{weatherData.wind}</span>
                      </div>
                      <Badge variant="outline" className="w-full justify-center text-xs py-1">
                        {weatherData.condition}
                      </Badge>
                    </div>
              </CardContent>
            </Card>

                {/* Fastest Lap */}
                {fastestLapData && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="h-5 w-5 text-purple-500" />
                        Fastest Lap
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div style={getTeamColorStyle(fastestLapData.constructor.constructorId)}>
                          <div className="font-bold text-sm">{fastestLapData.driver.code}</div>
                          <div className="text-xs text-muted-foreground">
                            {fastestLapData.driver.givenName} {fastestLapData.driver.familyName}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs">Time:</span>
                            <span className="font-mono font-bold text-sm">{fastestLapData.lapTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Lap:</span>
                            <span className="font-mono text-sm">{fastestLapData.lap}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Second Row: Qualifying and Pit Stops */}
            <div className="grid grid-cols-3 gap-6">
              {/* Qualifying Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="h-5 w-5 text-blue-500" />
                    Qualifying Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {qualifyingResults?.data?.QualifyingResults ? (
                    <div className="space-y-2">
                      {qualifyingResults.data.QualifyingResults.slice(0, 8).map((result: any) => (
                        <div key={result.position} className="flex items-center justify-between p-2 border rounded bg-card/30">
                          <div className="flex items-center gap-2">
                            <span className="font-bold w-6 text-sm text-center">{result.position}</span>
                          <div style={getTeamColorStyle(result.Constructor.constructorId)}>
                              <div className="font-bold text-sm">{result.Driver.code}</div>
                            </div>
                          </div>
                          <div className="font-mono text-sm font-medium">
                            {result.Q3 || result.Q2 || result.Q1 || "No time"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>Qualifying results not available</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Fastest Pit Stop */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-orange-500" />
                    Fastest Pit Stop
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {fastestPitStop ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="font-bold text-lg uppercase">Driver {fastestPitStop.driverId}</div>
                        <div className="text-sm text-muted-foreground">Lap {fastestPitStop.lap}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-mono font-bold text-orange-500 mb-1">
                          {fastestPitStop.duration.toFixed(3)}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">Duration</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-2xl font-mono font-bold text-orange-500 mb-1">20.940</div>
                      <div className="text-sm font-medium text-muted-foreground">Driver norris</div>
                      <div className="text-xs text-muted-foreground">Lap 31</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Circuit Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="h-5 w-5 text-gray-500" />
                    Circuit Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-xl" role="img" aria-label={country}>
                          {getEmojiFlag(country)}
                        </span>
                        <h4 className="font-bold text-sm">{circuitName}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {race?.Circuit?.Location?.locality}, {country}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">{format(parseISO(race.date), 'MMM d, yyyy')}</span>
                        </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">{race.time ? format(parseISO(`${race.date}T${race.time}`), 'HH:mm') : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Laps:</span>
                        <span className="font-medium">{raceResults?.data?.Results?.[0]?.laps || "57"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
                  </div>
                  
            {/* Third Row: Qualifying to Race Progression Chart */}
            <div className="h-[500px]">
              <MuiSankeyChart year={parseInt(race.season)} round={race.round} />
            </div>
                  
            {/* Fourth Row: Additional Statistics */}
            <div className="grid grid-cols-4 gap-4">
              {/* DNF Count */}
              <Card className="text-center">
                <CardContent className="pt-6 pb-6">
                  <div className="text-3xl font-bold text-red-500 mb-1">
                    {raceResults?.data?.Results?.filter((r: any) => 
                      r.status !== "Finished" && r.status !== "+1 Lap" && r.status !== "+2 Laps" && r.status !== "+3 Laps"
                    ).length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">DNFs</div>
                </CardContent>
              </Card>

              {/* Total Laps */}
              <Card className="text-center">
                <CardContent className="pt-6 pb-6">
                  <div className="text-3xl font-bold text-blue-500 mb-1">
                    {raceResults?.data?.Results?.[0]?.laps || "57"}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Total Laps</div>
              </CardContent>
            </Card>

              {/* Race Winner */}
              <Card className="text-center">
                <CardContent className="pt-6 pb-6">
                  <div className="text-2xl font-bold text-yellow-500 mb-1">
                    {raceResults?.data?.Results?.[0]?.Driver?.code || "NOR"}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Race Winner</div>
                </CardContent>
              </Card>

              {/* Pole Position */}
              <Card className="text-center">
                <CardContent className="pt-6 pb-6">
                  <div className="text-2xl font-bold text-purple-500 mb-1">
                    {qualifyingResults?.data?.QualifyingResults?.[0]?.Driver?.code || "NOR"}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Pole Position</div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t">
          <p className="text-sm text-muted-foreground">
            Generated by F1 DataStop • Formula 1 {race.season} Season
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Race infographic for {raceName} • {raceDate}
          </p>
            </div>
      </div>
    </div>
  );
};

export default RaceInfographic;
