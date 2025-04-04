
import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { format, parseISO } from "date-fns";
import { Race } from "@/components/calendar/map/types";
import { getCountryFlag } from "@/utils/countryUtils";

interface RaceMarkersProps {
  map: mapboxgl.Map;
  races: Race[];
  onRaceClick: (race: Race) => void;
}

const RaceMarkers = ({ map, races, onRaceClick }: RaceMarkersProps) => {
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  
  // Add markers for each race
  useEffect(() => {
    // Sort races by round number
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));
    
    // Clear any existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Clear any existing popups
    popupsRef.current.forEach(popup => popup.remove());
    popupsRef.current = [];
    
    // Add markers for each race
    sortedRaces.forEach((race) => {
      const { Circuit, raceName, date, round } = race;
      const { lat, long, locality, country } = Circuit.Location;
      
      if (!lat || !long) return;
      
      // Ensure coordinates are properly formatted as [lng, lat]
      const coordinates: [number, number] = [parseFloat(long), parseFloat(lat)];
      
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
        .addTo(map);
      
      markersRef.current.push(marker);
      
      // Handle marker click
      el.addEventListener('click', () => {
        onRaceClick(race);
      });
    });
    
    // Fit the map to show all markers
    if (sortedRaces.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      sortedRaces.forEach(race => {
        const raceCoords: [number, number] = [
          parseFloat(race.Circuit.Location.long), 
          parseFloat(race.Circuit.Location.lat)
        ];
        bounds.extend(raceCoords);
      });
      
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 2
      });
    }
    
    // Cleanup function
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      popupsRef.current.forEach(popup => popup.remove());
    };
  }, [map, races, onRaceClick]);
  
  return null; // This component doesn't render anything itself
};

export default RaceMarkers;
