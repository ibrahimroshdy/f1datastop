
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Race } from "@/components/calendar/map/types";
import MapRaceMarkers from "@/components/calendar/map/MapRaceMarkers";
import RacePath from "@/components/calendar/map/RacePath";
import MapLegend from "@/components/calendar/map/MapLegend";
import SelectedRaceInfo from "@/components/calendar/map/SelectedRaceInfo";
import MapLoadingOverlay from "@/components/calendar/map/MapLoadingOverlay";
import MapTips from "@/components/calendar/map/MapTips";
import MapDebugger from "@/components/calendar/map/MapDebugger";
import { toast } from "sonner";

// Replace this with your Mapbox public token
// In production, this should come from environment variables
const MAPBOX_TOKEN = "pk.eyJ1IjoiZjFkYXRhc3RvcCIsImEiOiJjbHpvenVvdTIwNWxrMnBvMTYwb2dqOGYzIn0.jlgBfK6B0vkCDvI6i27OQw";

interface F1MapContainerProps {
  selectedYear: number;
}

const F1MapContainer = ({ selectedYear }: F1MapContainerProps) => {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const raceSchedule = useRaceSchedule(selectedYear);
  const { isLoading, data } = raceSchedule;

  // Add debug logging
  useEffect(() => {
    console.log("F1MapContainer rendered", { 
      selectedYear,
      mapExists: !!map.current,
      containerExists: !!mapContainer.current,
      mapLoaded,
      dataLoaded: !!data,
      isLoading
    });
  });

  // Initialize the map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    console.log("Initializing map with token:", MAPBOX_TOKEN);
    
    if (!mapboxgl.supported()) {
      console.error("Mapbox GL is not supported by your browser");
      toast.error("Your browser doesn't support Mapbox GL. Try a modern browser.");
      return;
    }
    
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11', // Darker theme for better race visualization
        projection: 'globe',
        zoom: 1.5,
        center: [10, 30],
        pitch: 40,
        bearing: 0
      });
      
      console.log("Map instance created successfully");

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add event listeners for debugging
      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        toast.error("Map error occurred. Please refresh the page.");
      });

      map.current.on('load', () => {
        console.log("Map fully loaded event fired");
      });

      // Wait for the map style to be fully loaded before interacting with it
      map.current.on('style.load', () => {
        if (!map.current) return;
        
        console.log("Map style loaded event fired");
        
        // Set mapLoaded to true to indicate the style has finished loading
        setMapLoaded(true);
        
        // Add atmosphere and fog effects
        map.current.setFog({
          color: 'rgb(15, 16, 20)', // Dark color to match the dark theme
          'high-color': 'rgb(25, 25, 30)',
          'horizon-blend': 0.2
        });

        // Add custom circle symbol for race markers
        map.current.loadImage(
          'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
          (error, image) => {
            if (error) {
              console.error("Error loading marker image:", error);
              return;
            }
            
            if (!map.current || !image) {
              console.error("Map or image is null after loading image");
              return;
            }

            try {
              map.current.addImage('circle', image);
              console.log("Added circle image to map");
            } catch (err) {
              console.error("Error adding image to map:", err);
            }
          }
        );
      });

      // Globe rotation settings
      const secondsPerRevolution = 240;
      const maxSpinZoom = 3;
      const slowSpinZoom = 2;
      let userInteracting = false;
      let spinEnabled = true;

      // Function to spin the globe when user is not interacting
      function spinGlobe() {
        if (!map.current) return;
        
        const zoom = map.current.getZoom();
        if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
          let distancePerSecond = 360 / secondsPerRevolution;
          if (zoom > slowSpinZoom) {
            const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
            distancePerSecond *= zoomDif;
          }
          const center = map.current.getCenter();
          center.lng -= distancePerSecond * 0.02; // Slow down the rotation a bit
          map.current.easeTo({ center, duration: 100, easing: (n) => n });
        }
      }

      // Interaction event handlers
      map.current.on('mousedown', () => {
        userInteracting = true;
      });
      
      map.current.on('dragstart', () => {
        userInteracting = true;
      });
      
      map.current.on('mouseup', () => {
        userInteracting = false;
        setTimeout(spinGlobe, 1000); // Resume spinning after interaction
      });
      
      map.current.on('touchend', () => {
        userInteracting = false;
        setTimeout(spinGlobe, 1000);
      });

      // Globe animation interval
      const interval = setInterval(spinGlobe, 100);

      return () => {
        console.log("Cleaning up map");
        clearInterval(interval);
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error("Error initializing map:", error);
      toast.error("Failed to initialize map. Please refresh the page.");
    }
  }, []);

  const handleRaceClick = (race: Race) => {
    setSelectedRace(race);
    
    if (!map.current) return;

    const coordinates: [number, number] = [
      parseFloat(race.Circuit.Location.long), 
      parseFloat(race.Circuit.Location.lat)
    ];
    
    // Fly to the race location
    map.current.flyTo({
      center: coordinates,
      zoom: 5,
      pitch: 60,
      bearing: Math.random() * 180 - 90, // Random bearing for interesting views
      duration: 2000,
      essential: true
    });
  };

  return (
    <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Add the debug helper */}
      <MapDebugger mapLoaded={mapLoaded} raceData={raceSchedule} />
      
      {/* Loading overlay */}
      {(isLoading || !mapLoaded) && <MapLoadingOverlay />}
      
      {/* Race markers and path */}
      {data?.data && mapLoaded && map.current && (
        <>
          <MapRaceMarkers 
            map={map.current} 
            races={data.data} 
            onRaceClick={handleRaceClick}
          />
          <RacePath 
            map={map.current} 
            races={data.data} 
            mapLoaded={mapLoaded}
          />
        </>
      )}
      
      {/* Selected race info overlay */}
      {selectedRace && (
        <SelectedRaceInfo 
          race={selectedRace} 
          onClose={() => setSelectedRace(null)} 
        />
      )}
      
      {/* Legend */}
      <MapLegend />
      
      {/* Tips */}
      <MapTips />
    </div>
  );
};

export default F1MapContainer;
