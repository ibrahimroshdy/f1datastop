
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent } from "@/components/ui/card";
import { useRaceSchedule } from "@/hooks/useF1Data";
import YearSelector from "@/components/common/YearSelector";
import { getCountryFlag } from "@/utils/countryUtils";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

// Replace this with your Mapbox public token
// In production, this should come from environment variables
const MAPBOX_TOKEN = "pk.eyJ1IjoiZjFkYXRhc3RvcCIsImEiOiJjbHpvenVvdTIwNWxrMnBvMTYwb2dqOGYzIn0.jlgBfK6B0vkCDvI6i27OQw";

interface Race {
  round: string;
  raceName: string;
  date: string;
  Circuit: {
    circuitName: string;
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    }
  }
}

const RaceMap = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const { data: raceSchedule, isLoading } = useRaceSchedule(selectedYear);

  // This function creates a path visualization between race locations
  const createRacePath = (races: Race[]) => {
    if (!map.current || races.length < 2) return;
    
    // Create coordinates array from race locations
    const coordinates = races.map(race => [
      parseFloat(race.Circuit.Location.long),
      parseFloat(race.Circuit.Location.lat)
    ]);
    
    // Check if the source already exists, and if so, update it
    const source = map.current.getSource('race-path');
    if (source) {
      (source as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      });
    } else {
      // Add the source and layer if it doesn't exist
      map.current.addSource('race-path', {
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
      
      map.current.addLayer({
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
      map.current.addLayer({
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
    }
  };

  // Initialize the map
  useEffect(() => {
    if (!mapboxgl.supported()) {
      console.error("Mapbox GL is not supported by your browser");
      return;
    }

    if (!mapContainer.current || map.current) return;
    
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', // Darker theme for better race visualization
      projection: 'globe',
      zoom: 1.5,
      center: [10, 30],
      pitch: 40,
      bearing: 0,
      attributionControl: false
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add custom globe effects
    map.current.on('style.load', () => {
      if (!map.current) return;
      
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
          if (error) throw error;
          if (!map.current || !image) return;

          map.current.addImage('circle', image);
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
      clearInterval(interval);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add race markers and path when race data is loaded
  useEffect(() => {
    if (!map.current || isLoading || !raceSchedule?.data) return;

    // Clear any existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Clear any existing popups
    popupsRef.current.forEach(popup => popup.remove());
    popupsRef.current = [];

    // Add markers for each race
    const races = raceSchedule.data.sort((a, b) => parseInt(a.round) - parseInt(b.round));
    
    races.forEach((race, index) => {
      const { Circuit, raceName, date, round } = race;
      const { lat, long, locality, country } = Circuit.Location;
      
      if (!lat || !long) return;
      
      const coordinates = [parseFloat(long), parseFloat(lat)];
      
      // Create custom HTML element for marker
      const el = document.createElement('div');
      el.className = 'race-marker';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = parseInt(round) === 1 ? '#00ff00' : // First race green
                                new Date(date) > new Date() ? '#e10600' : // Upcoming race red
                                '#888888'; // Past race gray
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      el.style.cursor = 'pointer';
      el.innerHTML = `<span style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);color:white;font-weight:bold;text-shadow:0 0 3px black;">${round}</span>`;
      
      // Create popup
      const flag = getCountryFlag(country);
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(
          `<div style="padding:5px;">
            <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">
              ${flag} ${raceName}
            </div>
            <div style="font-size:12px;margin-bottom:3px;">
              ${locality}, ${country}
            </div>
            <div style="font-size:12px;color:#aaaaaa;">
              ${format(parseISO(date), 'dd MMM yyyy')}
            </div>
            <div style="font-size:10px;margin-top:5px;color:#e10600;">
              Round ${round}
            </div>
          </div>`
        );
      
      popupsRef.current.push(popup);
      
      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat(coordinates)
        .setPopup(popup)
        .addTo(map.current!);
      
      markersRef.current.push(marker);
      
      // Handle marker click
      el.addEventListener('click', () => {
        setSelectedRace(race);
        
        // Fly to this race location
        map.current?.flyTo({
          center: coordinates,
          zoom: 5,
          pitch: 60,
          bearing: Math.random() * 180 - 90, // Random bearing for interesting views
          duration: 2000,
          essential: true
        });
      });
    });
    
    // Add the race path visualization
    createRacePath(races);
    
    // Fit the map to show all markers (with padding)
    if (races.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      races.forEach(race => {
        bounds.extend([
          parseFloat(race.Circuit.Location.long), 
          parseFloat(race.Circuit.Location.lat)
        ]);
      });
      
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 2
      });
    }
    
  }, [raceSchedule, isLoading]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedRace(null);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h2 className="text-xl font-bold">F1 Race Map</h2>
        <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
      </div>

      <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
        <div ref={mapContainer} className="absolute inset-0" />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-f1-red"></div>
          </div>
        )}
        
        {/* Selected race info overlay */}
        {selectedRace && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-xl z-20">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-white font-bold">
                {getCountryFlag(selectedRace.Circuit.Location.country)} {selectedRace.raceName}
              </h3>
              <button 
                onClick={() => setSelectedRace(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-300">
              <p>Round {selectedRace.round}</p>
              <p>{format(parseISO(selectedRace.date), 'dd MMMM yyyy')}</p>
              <p>{selectedRace.Circuit.circuitName}</p>
              <p>{selectedRace.Circuit.Location.locality}, {selectedRace.Circuit.Location.country}</p>
              <p className="text-xs mt-2 text-gray-400">
                Coordinates: {selectedRace.Circuit.Location.lat}, {selectedRace.Circuit.Location.long}
              </p>
            </div>
          </div>
        )}
        
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-md p-2 border border-gray-700 z-10">
          <div className="text-xs text-white font-medium mb-1">Race Legend</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
            <span className="text-xs text-gray-200">First Race</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-red-600 border border-white"></div>
            <span className="text-xs text-gray-200">Upcoming Races</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500 border border-white"></div>
            <span className="text-xs text-gray-200">Completed Races</span>
          </div>
        </div>

        {/* Tips */}
        <div className="absolute top-4 right-4 text-xs text-white bg-black/50 rounded-md px-3 py-1">
          Drag to rotate • Scroll to zoom • Click markers for details
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
};

export default RaceMap;
