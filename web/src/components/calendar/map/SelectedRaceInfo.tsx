import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { Race } from "@/components/calendar/map/types";
import { X, Calendar, Map, Info, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface SelectedRaceInfoProps {
  race: Race;
  onClose: () => void;
}

const SelectedRaceInfo = ({ race, onClose }: SelectedRaceInfoProps) => {
  const [activeTab, setActiveTab] = useState<"info" | "stats" | "weather">("info");
  const { isGlass } = useTheme();
  const variant = isGlass ? ("glass" as const) : ("default" as const);
  const glassVariant = isGlass ? ("panel" as const) : ("default" as const);
  
  const getLocalTime = () => {
    try {
      const raceTimeString = race.time || "14:00:00Z";
      const raceDate = parseISO(`${race.date}T${raceTimeString}`);
      return format(raceDate, "HH:mm");
    } catch {
      return "14:00";
    }
  };
  
  const getTrackInfo = () => {
    const tracks: Record<string, { length: string; laps: number; turns: number }> = {
      "Bahrain International Circuit": { length: "5.412 km", laps: 57, turns: 15 },
      "Jeddah Corniche Circuit": { length: "6.174 km", laps: 50, turns: 27 },
      "Albert Park Circuit": { length: "5.278 km", laps: 58, turns: 14 },
      "Suzuka Circuit": { length: "5.807 km", laps: 53, turns: 18 },
      "Shanghai International Circuit": { length: "5.451 km", laps: 56, turns: 16 },
      "Miami International Autodrome": { length: "5.412 km", laps: 57, turns: 19 },
      "Autodromo Enzo e Dino Ferrari": { length: "4.909 km", laps: 63, turns: 19 },
      "Circuit de Monaco": { length: "3.337 km", laps: 78, turns: 19 },
      "Circuit Gilles Villeneuve": { length: "4.361 km", laps: 70, turns: 14 },
      "Circuit de Barcelona-Catalunya": { length: "4.675 km", laps: 66, turns: 16 },
      "Red Bull Ring": { length: "4.318 km", laps: 71, turns: 10 },
      "Silverstone Circuit": { length: "5.891 km", laps: 52, turns: 18 },
      "Hungaroring": { length: "4.381 km", laps: 70, turns: 14 },
      "Circuit de Spa-Francorchamps": { length: "7.004 km", laps: 44, turns: 19 },
      "Circuit Zandvoort": { length: "4.259 km", laps: 72, turns: 14 },
      "Monza Circuit": { length: "5.793 km", laps: 53, turns: 11 },
      "Baku City Circuit": { length: "6.003 km", laps: 51, turns: 20 },
      "Marina Bay Street Circuit": { length: "5.063 km", laps: 62, turns: 19 },
      "Circuit of the Americas": { length: "5.513 km", laps: 56, turns: 20 },
      "Autódromo Hermanos Rodríguez": { length: "4.304 km", laps: 71, turns: 17 },
      "Interlagos Circuit": { length: "4.309 km", laps: 71, turns: 15 },
      "Las Vegas Strip Circuit": { length: "6.120 km", laps: 50, turns: 17 },
      "Losail International Circuit": { length: "5.380 km", laps: 57, turns: 16 },
      "Yas Marina Circuit": { length: "5.281 km", laps: 58, turns: 16 },
    };
    
    return tracks[race.Circuit.circuitName] || { length: "~5.0 km", laps: 50, turns: 15 };
  };

  const trackInfo = getTrackInfo();
  const tabBtn = (id: typeof activeTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={cn(
        "border-b-2 px-3 py-2 text-sm transition-colors",
        activeTab === id
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
  
  return (
    <F1Card
      variant={variant}
      glassVariant={glassVariant}
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 mx-auto max-h-[min(55vh,520px)] overflow-y-auto rounded-t-xl border shadow-xl sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:rounded-xl",
        isGlass && "border-white/10"
      )}
    >
      <F1CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <CountryFlag country={race.Circuit.Location.country} size={24} className="shrink-0" />
          <F1CardTitle className="text-left text-base font-semibold leading-tight">
            {getRaceNameWithoutEmoji(race.raceName)}
          </F1CardTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Close race details"
        >
          <X className="h-4 w-4" />
        </Button>
      </F1CardHeader>

      <F1CardContent className="space-y-0 px-4 pb-4 pt-0">
        <div className="mb-3 flex border-b border-border">
          {tabBtn("info", "Info")}
          {tabBtn("stats", "Track")}
          {tabBtn("weather", "Weather")}
        </div>

        {activeTab === "info" && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/80" />
              <div>
                <div className="font-semibold text-foreground">Round {race.round}</div>
                <div>{format(parseISO(race.date), "d MMMM yyyy")}</div>
                <div>Race start (local): {getLocalTime()}</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Map className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/80" />
              <div>
                <div className="font-semibold text-foreground">{race.Circuit.circuitName}</div>
                <div>{race.Circuit.Location.locality}, {race.Circuit.Location.country}</div>
                <div className="mt-1 text-xs opacity-80">
                  {race.Circuit.Location.lat}°, {race.Circuit.Location.long}°
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {race.FirstPractice && (
                <Badge variant="outline" className="text-xs">
                  FP1: {format(parseISO(race.FirstPractice.date), "dd MMM")}
                </Badge>
              )}
              {race.SecondPractice && (
                <Badge variant="outline" className="text-xs">
                  FP2: {format(parseISO(race.SecondPractice.date), "dd MMM")}
                </Badge>
              )}
              {race.ThirdPractice && (
                <Badge variant="outline" className="text-xs">
                  FP3: {format(parseISO(race.ThirdPractice.date), "dd MMM")}
                </Badge>
              )}
              {race.Qualifying && (
                <Badge variant="outline" className="text-xs">
                  Quali: {format(parseISO(race.Qualifying.date), "dd MMM")}
                </Badge>
              )}
              {race.Sprint && (
                <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                  Sprint: {format(parseISO(race.Sprint.date), "dd MMM")}
                </Badge>
              )}
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/80" />
              <div>
                <div className="font-semibold text-foreground">Circuit</div>
                <div>Length: {trackInfo.length}</div>
                <div>Laps: {trackInfo.laps}</div>
                <div>Corners: {trackInfo.turns}</div>
                <div>Race distance: {(parseFloat(trackInfo.length) * trackInfo.laps).toFixed(3)} km</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/80" />
              <div>
                <div className="font-semibold text-foreground">Lap records</div>
                <div className="text-xs opacity-90">Qualifying and race records when available.</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "weather" && (
          <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Weather</div>
            <p className="mt-2 max-w-xs text-xs">
              Forecasts will appear closer to the event. Check back on race week.
            </p>
          </div>
        )}
        
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to={`/calendar?year=${race.season ?? ""}&race=${race.round}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open in calendar
          </Link>
          {race.Circuit.url && (
            <a
              href={race.Circuit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Circuit site
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default SelectedRaceInfo;
