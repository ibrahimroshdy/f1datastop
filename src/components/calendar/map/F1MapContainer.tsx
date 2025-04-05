
import { useEffect, useRef, useState } from "react";
import { Race } from "@/components/calendar/map/types";
import { useRaceSchedule } from "@/hooks/useF1Data";
import MapLoadingOverlay from "@/components/calendar/map/MapLoadingOverlay";
import MapLegend from "@/components/calendar/map/MapLegend";
import MapDebugger from "@/components/calendar/map/MapDebugger";
import F1GlobeContainer from "@/components/calendar/map/F1GlobeContainer";

interface F1MapContainerProps {
  selectedYear: number;
}

const F1MapContainer = ({ selectedYear }: F1MapContainerProps) => {
  const [mapType] = useState<"globe">("globe");
  const { isLoading, data, error } = useRaceSchedule(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapLoaded = () => {
    setMapLoaded(true);
  };

  // Use effect to handle component mounting/unmounting
  useEffect(() => {
    return () => {
      // Cleanup function
      setMapLoaded(false);
    };
  }, [selectedYear]);

  return (
    <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-gray-900 border border-gray-800" ref={containerRef}>
      {/* Show loading overlay when data is loading */}
      {isLoading && <MapLoadingOverlay />}

      {/* Globe implementation */}
      <F1GlobeContainer 
        selectedYear={selectedYear}
        onYearChange={() => {}}
      />

      {/* Legend explaining the map markers */}
      <MapLegend />
      
      {/* Debug information (hidden by default, revealed with multiple clicks) */}
      <MapDebugger 
        mapLoaded={mapLoaded} 
        raceData={{ isLoading, data, error }} 
      />
    </div>
  );
};

export default F1MapContainer;
