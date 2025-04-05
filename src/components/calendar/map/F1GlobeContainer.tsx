
import { useEffect, useRef, useState, useCallback } from "react";
import { Race, GlobeDetailLevel, RaceMapProps } from "@/components/calendar/map/types";
import { useRaceSchedule } from "@/hooks/useF1Data";
import MapLoadingOverlay from "@/components/calendar/map/MapLoadingOverlay";
import MapLegend from "@/components/calendar/map/MapLegend";
import SelectedRaceInfo from "@/components/calendar/map/SelectedRaceInfo";
import GlobeControls from "@/components/calendar/map/GlobeControls";
import { Globe, Search } from "lucide-react";
import { toast } from "sonner";
import GlobeScene from "@/components/calendar/map/GlobeScene";
import RaceMarkers from "@/components/calendar/map/RaceMarkers";
import PathsLayer from "@/components/calendar/map/PathsLayer";
import CountriesLayer from "@/components/calendar/map/CountriesLayer";

const F1GlobeContainer = ({ selectedYear, onYearChange }: RaceMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [sceneData, setSceneData] = useState<any>(null);
  const [hoveredRace, setHoveredRace] = useState<Race | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{x: number, y: number} | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showPaths, setShowPaths] = useState<boolean>(true);
  const [detailLevel, setDetailLevel] = useState<GlobeDetailLevel>('medium');
  const [filterStatus, setFilterStatus] = useState({
    first: true,
    upcoming: true,
    completed: true
  });
  
  const { isLoading, data } = useRaceSchedule(selectedYear);
  const races = data?.data || [];

  // Handle scene creation
  const handleSceneCreated = useCallback((data) => {
    setSceneData(data);
  }, []);

  // Handle race selection
  const handleRaceSelect = useCallback((race: Race) => {
    setSelectedRace(race);
    
    toast.success(`Selected: ${race.raceName}`, {
      description: `Round ${race.round} - ${race.date}`
    });
  }, []);

  // Handle filter toggle
  const toggleFilter = (filter: 'first' | 'upcoming' | 'completed') => {
    setFilterStatus(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };
  
  // Toggle paths visibility
  const handleTogglePaths = () => {
    setShowPaths(prev => !prev);
  };
  
  // Handle detail level change
  const handleDetailLevelChange = (level: GlobeDetailLevel) => {
    setDetailLevel(level);
  };

  // Filter races based on search and status
  const getFilteredRaces = () => {
    if (!races || races.length === 0) return [];
    
    return races.filter(race => {
      // Apply search filter
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const raceNameMatch = race.raceName.toLowerCase().includes(searchTermLower);
        const locationMatch = race.Circuit.Location.locality?.toLowerCase().includes(searchTermLower) || 
                             race.Circuit.Location.country?.toLowerCase().includes(searchTermLower);
        
        if (!raceNameMatch && !locationMatch) {
          return false;
        }
      }

      // Apply status filters
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

  return (
    <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
      {/* Globe container */}
      <div ref={containerRef} className="absolute inset-0">
        {containerRef.current && (
          <GlobeScene 
            containerRef={containerRef} 
            onSceneCreated={handleSceneCreated}
            detailLevel={detailLevel}
          />
        )}
      </div>
      
      {/* Race markers and paths */}
      {sceneData && sceneData.globe && (
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

      {/* Search and filters */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search races..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-4 py-2 bg-black/60 backdrop-blur-sm border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red"
          />
        </div>
      </div>

      {/* Globe controls */}
      <GlobeControls 
        showPaths={showPaths}
        onTogglePaths={handleTogglePaths}
        detailLevel={detailLevel}
        onChangeDetailLevel={handleDetailLevelChange}
      />

      {/* Filter buttons */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button 
          onClick={() => toggleFilter('first')} 
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md backdrop-blur-sm text-sm ${filterStatus.first ? 'bg-green-800/80 text-white' : 'bg-black/60 text-gray-400 border-gray-700 border'}`}
        >
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          First
        </button>
        <button 
          onClick={() => toggleFilter('upcoming')} 
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md backdrop-blur-sm text-sm ${filterStatus.upcoming ? 'bg-red-900/80 text-white' : 'bg-black/60 text-gray-400 border-gray-700 border'}`}
        >
          <div className="w-2 h-2 rounded-full bg-red-600"></div>
          Upcoming
        </button>
        <button 
          onClick={() => toggleFilter('completed')} 
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md backdrop-blur-sm text-sm ${filterStatus.completed ? 'bg-gray-700/80 text-white' : 'bg-black/60 text-gray-400 border-gray-700 border'}`}
        >
          <div className="w-2 h-2 rounded-full bg-white"></div>
          Completed
        </button>
      </div>
      
      {/* Loading overlay */}
      {isLoading && <MapLoadingOverlay />}
      
      {/* Selected race info overlay */}
      {selectedRace && (
        <SelectedRaceInfo 
          race={selectedRace} 
          onClose={() => setSelectedRace(null)} 
        />
      )}
      
      {/* Hover tooltip */}
      {hoveredRace && hoverPoint && (
        <div 
          className="absolute z-30 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-md p-2 text-xs text-white shadow-lg pointer-events-none"
          style={{
            left: `${hoverPoint.x}px`,
            top: `${hoverPoint.y - 80}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-bold">{hoveredRace.raceName}</div>
          <div className="text-gray-300 mt-1">{hoveredRace.date}</div>
          <div className="text-gray-300">{hoveredRace.Circuit.Location.locality}, {hoveredRace.Circuit.Location.country}</div>
          <div className="text-gray-400 text-[10px] mt-1">Round {hoveredRace.round}</div>
        </div>
      )}
      
      {/* Legend */}
      <MapLegend />
    </div>
  );
};

export default F1GlobeContainer;
