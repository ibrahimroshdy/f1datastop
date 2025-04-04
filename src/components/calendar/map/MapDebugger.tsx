
import { useEffect } from 'react';

interface MapDebuggerProps {
  mapLoaded: boolean;
  raceData: any;
}

/**
 * A utility component that helps debug map loading issues
 * This can be included in the F1MapContainer component when needed
 */
const MapDebugger = ({ mapLoaded, raceData }: MapDebuggerProps) => {
  useEffect(() => {
    console.log('Map load state changed:', { mapLoaded });
  }, [mapLoaded]);

  useEffect(() => {
    console.log('Race data updated:', { 
      hasData: !!raceData?.data,
      raceCount: raceData?.data?.length || 0,
    });
  }, [raceData]);

  return null;
};

export default MapDebugger;
