
import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { MapRaceMarkersProps } from "./types";

const MapRaceMarkers = ({ map, races, onRaceClick }: MapRaceMarkersProps) => {
  useEffect(() => {
    if (!map || races.length === 0) return;
    
    // Clear existing markers
    const markers = document.querySelectorAll('.race-marker');
    markers.forEach(marker => marker.remove());
    
    // Sort races by round
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));
    
    // Create markers for each race
    sortedRaces.forEach((race) => {
      if (!race.Circuit?.Location?.lat || !race.Circuit?.Location?.long) return;
      
      // Determine marker color based on race status
      const raceDate = new Date(race.date);
      const today = new Date();
      const round = parseInt(race.round);
      const isFirstRace = round === 1;
      const isCompleted = raceDate <= today && !isFirstRace;
      const isUpcoming = !isCompleted && !isFirstRace;
      
      let markerColor = isFirstRace ? '#00ff00' : // Green for first race
                       isUpcoming ? '#e10600' : // Red for upcoming races
                       '#ffffff'; // White for completed races
      
      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'race-marker';
      markerEl.style.backgroundColor = markerColor;
      markerEl.style.width = '12px';
      markerEl.style.height = '12px';
      markerEl.style.borderRadius = '50%';
      markerEl.style.border = '2px solid white';
      markerEl.style.cursor = 'pointer';
      
      // Add pulse effect for upcoming races
      if (isUpcoming || isFirstRace) {
        markerEl.style.boxShadow = `0 0 0 rgba(${isFirstRace ? '0, 255, 0' : '225, 6, 0'}, 0.4)`;
        markerEl.style.animation = 'pulse 2s infinite';
      }
      
      // Add marker to map
      new mapboxgl.Marker(markerEl)
        .setLngLat([parseFloat(race.Circuit.Location.long), parseFloat(race.Circuit.Location.lat)])
        .addTo(map);
      
      // Add click event listener
      markerEl.addEventListener('click', () => onRaceClick(race));
    });
    
    // Add pulse animation style
    if (!document.getElementById('map-race-markers-style')) {
      const style = document.createElement('style');
      style.id = 'map-race-markers-style';
      style.innerHTML = `
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(225, 6, 0, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(225, 6, 0, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(225, 6, 0, 0);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      // Clean up markers on component unmount
      const markers = document.querySelectorAll('.race-marker');
      markers.forEach(marker => marker.remove());
    };
  }, [map, races, onRaceClick]);

  return null; // This component doesn't render any elements directly
};

export default MapRaceMarkers;
