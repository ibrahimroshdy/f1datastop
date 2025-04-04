
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
          if (detailLevel === 'low' && Math.random() > 0.3) return; // Skip some countries for low detail
          if (detailLevel === 'medium' && Math.random() > 0.6) return; // Skip fewer for medium detail
          
          const points: THREE.Vector3[] = [];
          
          // Create points for each coordinate in the ring
          // Use a step value to reduce point density based on detail level
          const step = detailLevel === 'high' ? 1 : detailLevel === 'medium' ? 2 : 3;
          for (let i = 0; i < ring.length; i += step) {
            const [long, lat] = ring[i];
            const position = latLongToVector3(lat, long, 1.002); // Slightly above globe surface
            points.push(position);
          }
          
          if (points.length > 1) {
            // Create a line for the country border
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ 
              color: 0x4a7a9c,
              transparent: true,
              opacity: 0.7,
              linewidth: 1
            });
            const line = new THREE.Line(geometry, material);
            line.userData = { isCountryBorder: true };
            globe.add(line);
          }
        });
      });
    });
    
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
