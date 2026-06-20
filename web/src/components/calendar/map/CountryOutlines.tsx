
import { useEffect } from 'react';
import * as THREE from 'three';
import WorldMapData from './WorldMapData';

interface CountryOutlinesProps {
  globe: THREE.Mesh | null;
  detailLevel: 'low' | 'medium' | 'high';
}

const CountryOutlines = ({ globe, detailLevel }: CountryOutlinesProps) => {
  useEffect(() => {
    if (!globe) return;
    
    // Clear any existing country outlines
    globe.children = globe.children.filter(child => 
      !(child instanceof THREE.Line && child.userData.isCountryBorder));
    
    // Add world map outlines with country borders
    WorldMapData.features.forEach(feature => {
      const countryCoordinates = feature.geometry.coordinates;
      
      countryCoordinates.forEach((polygon: any) => {
        // For each polygon in the country's geometry
        polygon.forEach((ring: any) => {
          // Skip some countries based on detail level to improve performance
          if (detailLevel === 'low' && Math.random() > 0.6) return;
          if (detailLevel === 'medium' && Math.random() > 0.8) return;
          
          const points: THREE.Vector3[] = [];
          
          // Create points for each coordinate in the ring
          // Use a step value to reduce point density based on detail level
          const step = detailLevel === 'high' ? 1 : detailLevel === 'medium' ? 2 : 3;
          for (let i = 0; i < ring.length; i += step) {
            const [long, lat] = ring[i];
            const position = latLongToVector3(lat, long, 1.003); // Slightly above globe surface
            points.push(position);
          }
          
          if (points.length > 1) {
            // Create a line for the country border with glow effect
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ 
              color: 0x6a9ac4,
              transparent: true,
              opacity: 0.5,
              linewidth: 1
            });
            const line = new THREE.Line(geometry, material);
            line.userData = { isCountryBorder: true };
            globe.add(line);
          }
        });
      });
    });
    
    // Add continent outlines with stronger lines
    const continents = [
      { name: "North America", color: 0x8aa7c5 },
      { name: "South America", color: 0x8aa7c5 },
      { name: "Europe", color: 0x8aa7c5 },
      { name: "Africa", color: 0x8aa7c5 },
      { name: "Asia", color: 0x8aa7c5 },
      { name: "Oceania", color: 0x8aa7c5 },
      { name: "Antarctica", color: 0x8aa7c5 }
    ];
    
    // Create more visible grid lines
    const gridMaterial = new THREE.LineBasicMaterial({ 
      color: 0x3a506b, 
      transparent: true, 
      opacity: 0.3,
      linewidth: 1
    });
    
    // Add latitude lines (parallels)
    for (let lat = -80; lat <= 80; lat += 20) {
      const radius = Math.cos(Math.abs(lat) * Math.PI / 180);
      const height = Math.sin(lat * Math.PI / 180);
      
      // Create points for latitude circle
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          radius * Math.cos(theta),
          height,
          radius * Math.sin(theta)
        ));
      }
      
      const latitudeGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const latitudeLine = new THREE.Line(latitudeGeometry, gridMaterial);
      latitudeLine.userData = { isCountryBorder: true };
      globe.add(latitudeLine);
    }
    
    // Add longitude lines (meridians)
    for (let lng = -180; lng < 180; lng += 20) {
      const points = [];
      
      for (let lat = -90; lat <= 90; lat += 5) {
        const position = latLongToVector3(lat, lng, 1.001);
        points.push(position);
      }
      
      const longitudeGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const longitudeLine = new THREE.Line(longitudeGeometry, gridMaterial);
      longitudeLine.userData = { isCountryBorder: true };
      globe.add(longitudeLine);
    }
    
  }, [globe, detailLevel]);
  
  // Helper function to convert latitude and longitude to 3D coordinates
  const latLongToVector3 = (lat: number, long: number, radius: number): THREE.Vector3 => {
    // Convert latitude and longitude to spherical coordinates
    const phi = (90 - lat) * Math.PI / 180; // phi is 0 at the north pole
    const theta = (long + 180) * Math.PI / 180; // theta is -180 to 180
    
    // Convert spherical coordinates to Cartesian coordinates
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    return new THREE.Vector3(x, y, z);
  };

  return null; // This component doesn't render anything itself
};

export default CountryOutlines;
