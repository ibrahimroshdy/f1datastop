
import { useEffect } from "react";
import { Race } from "@/components/calendar/map/types";

interface RacePathProps {
  map: mapboxgl.Map;
  races: Race[];
  mapLoaded: boolean;
}

const RacePath = ({ map, races, mapLoaded }: RacePathProps) => {
  // Create path visualization between race locations
  useEffect(() => {
    if (!map || races.length < 2 || !mapLoaded) {
      console.log("Cannot create race path yet:", { 
        mapExists: !!map, 
        raceCount: races.length, 
        mapLoaded 
      });
      return;
    }
    
    console.log("Creating race path");
    
    // Sort races by round number
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));
    
    // Create coordinates array from race locations
    const coordinates = sortedRaces.map(race => [
      parseFloat(race.Circuit.Location.long),
      parseFloat(race.Circuit.Location.lat)
    ] as [number, number]);
    
    // Check if the source already exists, and if so, update it
    const source = map.getSource('race-path');
    if (source) {
      (source as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      });
      console.log("Updated existing race path source");
    } else {
      try {
        // Add the source and layer if it doesn't exist
        map.addSource('race-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          }
        });
        
        map.addLayer({
          id: 'race-path-line',
          type: 'line',
          source: 'race-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#e10600',
            'line-width': 2,
            'line-opacity': 0.8,
            'line-dasharray': [0, 2] // Creates a dashed line effect
          }
        });
        
        // Add animated dots along the path
        map.addLayer({
          id: 'race-path-dots',
          type: 'symbol',
          source: 'race-path',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 50,
            'icon-image': 'circle',
            'icon-size': 0.5,
            'icon-allow-overlap': true
          },
          paint: {
            'icon-color': '#ffffff',
            'icon-opacity': 0.8
          }
        });
        console.log("Added new race path source and layers");
      } catch (error) {
        console.error("Error adding race path:", error);
      }
    }
    
    return () => {
      // Cleanup function
      try {
        if (map.getLayer('race-path-dots')) {
          map.removeLayer('race-path-dots');
        }
        if (map.getLayer('race-path-line')) {
          map.removeLayer('race-path-line');
        }
        if (map.getSource('race-path')) {
          map.removeSource('race-path');
        }
      } catch (error) {
        console.error("Error cleaning up race path:", error);
      }
    };
  }, [map, races, mapLoaded]);
  
  return null; // This component doesn't render anything itself
};

export default RacePath;
