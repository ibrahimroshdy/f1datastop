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
    if (!globe || !showPaths || !races || races.length === 0) return;
    
    // Clear any existing path lines
    globe.children = globe.children.filter(child => 
      !(child instanceof THREE.Line && child.userData.isRacePath));
    
    // Sort races by round number to ensure correct sequence
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));

    // Determine which races are completed based on current date
    const today = new Date();
    
    // Draw path between consecutive races
    for (let i = 0; i < sortedRaces.length - 1; i++) {
      const currentRace = sortedRaces[i];
      const nextRace = sortedRaces[i + 1];
      
      // Skip if missing coordinates
      if (!currentRace.Circuit.Location.lat || !currentRace.Circuit.Location.long || 
          !nextRace.Circuit.Location.lat || !nextRace.Circuit.Location.long) {
        continue;
      }
      
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

      // Determine if the path is for completed races or upcoming races
      const currentRaceDate = new Date(currentRace.date);
      const isCompletedPath = currentRaceDate < today;
      
      // Create a curved arc between the points with more segments for smoother curves
      const curvePoints = createArcPoints(startPosition, endPosition, 48);
      
      // Create line geometry
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      
      // Create gradient colors for the line
      const colors = [];
      const color1 = isCompletedPath ? new THREE.Color(0x4a7a9c) : new THREE.Color(0xe10600);
      const color2 = isCompletedPath ? new THREE.Color(0x6f9ebe) : new THREE.Color(0xff5a52);
      
      for (let j = 0; j < curvePoints.length; j++) {
        const t = j / (curvePoints.length - 1);
        const color = new THREE.Color().lerpColors(color1, color2, t);
        colors.push(color.r, color.g, color.b);
      }
      
      // Add colors to geometry
      pathGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      // Create line material with vertex colors
      const pathMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 1,
        transparent: true,
        opacity: isCompletedPath ? 0.6 : 0.8,
      });
      
      // Create the path line
      const pathLine = new THREE.Line(pathGeometry, pathMaterial);
      pathLine.userData = { 
        isRacePath: true,
        fromRace: currentRace.round,
        toRace: nextRace.round,
        completed: isCompletedPath
      };
      
      // Add to globe
      globe.add(pathLine);
      
      // Add direction indicators (small segments that show direction)
      if (curvePoints.length > 10) {
        // Place arrows at intervals along the path
        const numArrows = 1; // Just one arrow in the middle
        for (let a = 1; a <= numArrows; a++) {
          const position = Math.floor(curvePoints.length * (a / (numArrows + 1)));
          if (position < 2 || position >= curvePoints.length - 2) continue;
          
          const point = curvePoints[position];
          const prevPoint = curvePoints[position - 2];
          const direction = new THREE.Vector3().subVectors(point, prevPoint).normalize();
          
          // Create arrow points
          const arrowLength = 0.05;
          const arrowBase = new THREE.Vector3().copy(point).sub(
            new THREE.Vector3().copy(direction).multiplyScalar(arrowLength * 0.5)
          );
          const arrowTip = new THREE.Vector3().copy(point).add(
            new THREE.Vector3().copy(direction).multiplyScalar(arrowLength * 0.5)
          );
          
          const arrowGeometry = new THREE.BufferGeometry().setFromPoints([arrowBase, arrowTip]);
          
          const arrowMaterial = new THREE.LineBasicMaterial({
            color: isCompletedPath ? 0x6f9ebe : 0xff5a52,
            linewidth: 2,
            transparent: true,
            opacity: isCompletedPath ? 0.7 : 0.9,
          });
          
          const arrow = new THREE.Line(arrowGeometry, arrowMaterial);
          arrow.userData = { 
            isRacePath: true,
            isArrow: true
          };
          
          globe.add(arrow);
        }
      }
    }
    
  }, [races, globe, showPaths]);

  // Helper function to create curved arc points between two positions with adaptive elevation
  const createArcPoints = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 32): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    
    // Calculate distance between points
    const distance = start.distanceTo(end);
    
    // Determine arc height based on distance (longer distances = higher arc)
    const arcHeightFactor = Math.min(0.3, distance * 0.3);
    
    // Find the middle point
    const middle = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Normalize and push the middle point outward to create an arc
    middle.normalize().multiplyScalar(1.0 + arcHeightFactor);
    
    // Create a quadratic curve with more segments for smoother appearance
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      
      // Quadratic Bezier curve
      const point = new THREE.Vector3();
      point.x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * middle.x + t * t * end.x;
      point.y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * middle.y + t * t * end.y;
      point.z = (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * middle.z + t * t * end.z;
      
      // Normalize to keep on the surface of the globe with slight elevation
      point.normalize().multiplyScalar(1.01 + (t * (1-t) * 0.03)); // Slightly higher in the middle
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
