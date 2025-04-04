import { useEffect } from 'react';
import * as THREE from 'three';
import { Race } from './types';

interface RaceSequencePathProps {
  races: Race[];
  globe: THREE.Mesh | null;
  showPaths: boolean;
}

const RaceSequencePath = ({ races, globe, showPaths }: RaceSequencePathProps) => {
  useEffect(() => {
    if (!globe || !showPaths) return;
    
    // Clear any existing path lines
    globe.children = globe.children.filter(child => 
      !(child instanceof THREE.Line && child.userData.isRacePath));
    
    // Sort races by round number to ensure correct sequence
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));

    // Draw path between consecutive races
    for (let i = 0; i < sortedRaces.length - 1; i++) {
      const currentRace = sortedRaces[i];
      const nextRace = sortedRaces[i + 1];
      
      // Convert lat/lng to 3D coordinates
      const startPosition = latLongToVector3(
        parseFloat(currentRace.Circuit.Location.lat),
        parseFloat(currentRace.Circuit.Location.long),
        1.01 // Slightly above globe surface
      );
      
      const endPosition = latLongToVector3(
        parseFloat(nextRace.Circuit.Location.lat),
        parseFloat(nextRace.Circuit.Location.long),
        1.01
      );

      // Create a curved path between points
      const curvePoints = createArcPoints(startPosition, endPosition);
      
      // Create path geometry
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      
      // Determine line color based on race status
      const raceDate = new Date(currentRace.date);
      const today = new Date();
      const isCompleted = raceDate <= today;
      
      // Create line material with glow effect
      const pathMaterial = new THREE.LineBasicMaterial({
        color: isCompleted ? 0x4a7a9c : 0xe10600,
        linewidth: 1,
        transparent: true,
        opacity: isCompleted ? 0.5 : 0.7,
      });
      
      // Create the path line
      const pathLine = new THREE.Line(pathGeometry, pathMaterial);
      pathLine.userData = { 
        isRacePath: true,
        fromRace: currentRace.round,
        toRace: nextRace.round
      };
      
      // Add to globe
      globe.add(pathLine);
    }
    
  }, [races, globe, showPaths]);

  // Helper function to create curved arc points between two positions
  const createArcPoints = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 32): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    
    // Find the middle point
    const middle = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Push the middle point outward to create an arc
    const distance = start.distanceTo(end);
    middle.normalize().multiplyScalar(1.0 + distance * 0.2);
    
    // Create a quadratic curve
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      
      // Quadratic Bezier curve
      const point = new THREE.Vector3();
      point.x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * middle.x + t * t * end.x;
      point.y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * middle.y + t * t * end.y;
      point.z = (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * middle.z + t * t * end.z;
      
      // Normalize to keep on the surface of the globe with slight elevation
      point.normalize().multiplyScalar(1.01);
      points.push(point);
    }
    
    return points;
  };

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

export default RaceSequencePath;
