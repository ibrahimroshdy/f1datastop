
import { useEffect, useRef, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Race, GlobeSceneData, RaceMapProps } from "@/components/calendar/map/types";
import { useRaceSchedule } from "@/hooks/useF1Data";
import MapLoadingOverlay from "@/components/calendar/map/MapLoadingOverlay";
import MapLegend from "@/components/calendar/map/MapLegend";
import SelectedRaceInfo from "@/components/calendar/map/SelectedRaceInfo";
import GlobeControls from "@/components/calendar/map/GlobeControls";
import { Search, Sparkles } from "lucide-react";
import GlobeScene from "@/components/calendar/map/GlobeScene";
import RaceMarkers from "@/components/calendar/map/RaceMarkers";
import PathsLayer from "@/components/calendar/map/PathsLayer";
import CountriesLayer from "@/components/calendar/map/CountriesLayer";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";

const F1GlobeContainer = ({ selectedYear, onYearChange: _onYearChange }: RaceMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [sceneData, setSceneData] = useState<GlobeSceneData | null>(null);
  const [hoveredRace, setHoveredRace] = useState<Race | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showPaths, setShowPaths] = useState<boolean>(true);
  const [detailLevel, setDetailLevel] = useState<"low" | "medium" | "high">("medium");
  const [filterStatus, setFilterStatus] = useState({
    first: true,
    upcoming: true,
    completed: true
  });
  const { isGlass } = useTheme();
  
  const { isLoading, data } = useRaceSchedule(selectedYear);
  const races = data?.data || [];

  useEffect(() => {
    if (containerRef.current) {
      setContainerReady(true);
    }
  }, []);

  const handleSceneCreated = useCallback((data: GlobeSceneData) => {
    setSceneData(data);
  }, []);

  const handleRaceSelect = useCallback((race: Race) => {
    setSelectedRace(race);
  }, []);

  const toggleFilter = (filter: "first" | "upcoming" | "completed") => {
    setFilterStatus(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };
  
  const handleTogglePaths = () => {
    setShowPaths(prev => !prev);
  };
  
  const handleDetailLevelChange = (level: "low" | "medium" | "high") => {
    setDetailLevel(level);
  };

  const getFilteredRaces = () => {
    if (!races || races.length === 0) return [];
    
    return races.filter(race => {
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const raceNameMatch = race.raceName.toLowerCase().includes(searchTermLower);
        const locationMatch = race.Circuit.Location.locality?.toLowerCase().includes(searchTermLower) || 
                             race.Circuit.Location.country?.toLowerCase().includes(searchTermLower);
        
        if (!raceNameMatch && !locationMatch) {
          return false;
        }
      }

      const round = parseInt(race.round);
      const raceDate = new Date(race.date);
      const today = new Date();

      if (round === 1 && !filterStatus.first) return false;
      if (raceDate > today && !filterStatus.upcoming) return false;
      if (raceDate <= today && round !== 1 && !filterStatus.completed) return false;

      return true;
    });
  };

  const filteredRaces = getFilteredRaces();
  const filterActive =
    filteredRaces.length !== races.length ||
    !filterStatus.first ||
    !filterStatus.upcoming ||
    !filterStatus.completed ||
    Boolean(searchTerm.trim());

  const shellBorder = isGlass ? "border-white/10" : "border-border";
  const shellBg = isGlass ? "glass-panel" : "bg-card";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border shadow-md",
        "h-[min(70vh,780px)] min-h-[min(70vh,420px)]",
        shellBorder,
        shellBg
      )}
    >
      <div ref={containerRef} className="absolute inset-0 bg-[#0a0a0c]">
        {containerReady && (
          <GlobeScene 
            containerRef={containerRef} 
            onSceneCreated={handleSceneCreated}
            detailLevel={detailLevel}
          />
        )}
      </div>
      
      {sceneData?.globe && (
        <>
          <RaceMarkers 
            races={filteredRaces} 
            globe={sceneData.globe}
            camera={sceneData.camera}
            controls={sceneData.controls}
            markersGroup={sceneData.markersGroup}
            containerRef={containerRef}
            onRaceSelect={handleRaceSelect}
            onRaceHover={(race, point) => {
              setHoveredRace(race);
              setHoverPoint(point);
            }}
          />
          
          <PathsLayer 
            races={filteredRaces} 
            globe={sceneData.globe}
            showPaths={showPaths}
          />
          
          <CountriesLayer 
            globe={sceneData.globe}
            detailLevel={detailLevel} 
          />
        </>
      )}

      {/* Top chrome — theme-aware, works on glass + default */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-background/95 via-background/70 to-transparent pb-10 pt-3 sm:pt-4"
        )}
      >
        <div className="pointer-events-auto mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Season globe
                </p>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {selectedYear} calendar
                  </span>
                  <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] font-normal tabular-nums">
                    {races.length ? `${filteredRaces.length}/${races.length}` : "—"} races
                  </Badge>
                </div>
              </div>
            </div>
            <div className="relative w-full max-w-sm">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Search by race or location…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "h-9 border-border bg-background/85 pl-9 text-sm shadow-sm backdrop-blur-sm",
                  isGlass && "border-white/10 bg-background/60"
                )}
                aria-label="Search races on globe"
              />
            </div>
            {filterActive && (
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                Filters or search are hiding some rounds. Toggle chips to show everything.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <Button
              type="button"
              size="sm"
              variant={filterStatus.first ? "default" : "outline"}
              className="h-8 gap-1.5"
              onClick={() => toggleFilter("first")}
            >
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
              First
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filterStatus.upcoming ? "default" : "outline"}
              className="h-8 gap-1.5"
              onClick={() => toggleFilter("upcoming")}
            >
              <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden />
              Upcoming
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filterStatus.completed ? "default" : "outline"}
              className="h-8 gap-1.5"
              onClick={() => toggleFilter("completed")}
            >
              <span className="h-2 w-2 rounded-full bg-muted-foreground" aria-hidden />
              Done
            </Button>
          </div>
        </div>
      </div>

      <GlobeControls 
        showPaths={showPaths}
        onTogglePaths={handleTogglePaths}
        detailLevel={detailLevel}
        onChangeDetailLevel={handleDetailLevelChange}
      />

      {isLoading && <MapLoadingOverlay />}
      
      {selectedRace && (
        <SelectedRaceInfo 
          race={selectedRace} 
          onClose={() => setSelectedRace(null)} 
        />
      )}
      
      {hoveredRace && hoverPoint && !selectedRace && (
        <div 
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-30 max-w-[220px] rounded-lg border p-2.5 text-xs shadow-lg",
            isGlass
              ? "glass-panel border-white/10 text-foreground"
              : "border-border bg-popover text-popover-foreground"
          )}
          style={{
            left: `${hoverPoint.x}px`,
            top: `${hoverPoint.y - 12}px`,
            transform: "translate(-50%, -100%)"
          }}
        >
          <div className="font-semibold leading-tight">
            {getRaceNameWithoutEmoji(hoveredRace.raceName)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {format(parseISO(hoveredRace.date), "EEE d MMM yyyy")}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hoveredRace.Circuit.Location.locality}, {hoveredRace.Circuit.Location.country}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground/80">
            Round {hoveredRace.round}
          </div>
        </div>
      )}
      
      <MapLegend />
    </div>
  );
};

export default F1GlobeContainer;
