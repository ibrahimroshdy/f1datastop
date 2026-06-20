
import { useEffect } from 'react';
import * as THREE from 'three';
import { Race } from './types';

interface PathsLayerProps {
  races: Race[];
  globe: THREE.Mesh;
  showPaths: boolean;
}

const PathsLayer = ({ races, globe, showPaths }: PathsLayerProps) => {
  useEffect(() => {
    if (!globe || races.length < 2 || !showPaths) {
      // Remove all paths if toggled off
      globe.children = globe.children.filter(child => 
        !(child.userData?.isRacePath));
      return;
    }
    
    // Clear existing paths
    globe.children = globe.children.filter(child => 
      !(child.userData?.isRacePath));
    
    // Sort races by round
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));
    
    // Determine which races are completed
    const today = new Date();
    
    // Create paths between consecutive races
    for (let i = 0; i < sortedRaces.length - 1; i++) {
      const currentRace = sortedRaces[i];
      const nextRace = sortedRaces[i + 1];
      
      if (!currentRace.Circuit?.Location?.lat || !currentRace.Circuit?.Location?.long || 
          !nextRace.Circuit?.Location?.lat || !nextRace.Circuit?.Location?.long) {
        continue;
      }
      
      const startPosition = latLongToVector3(
        parseFloat(currentRace.Circuit.Location.lat),
        parseFloat(currentRace.Circuit.Location.long),
        1.01
      );
      
      const endPosition = latLongToVector3(
        parseFloat(nextRace.Circuit.Location.lat),
        parseFloat(nextRace.Circuit.Location.long),
        1.01
      );
      
      // Determine if the path is for completed or upcoming races
      const currentRaceDate = new Date(currentRace.date);
      const isCompletedPath = currentRaceDate < today;
      
      // Create smooth arc between points
      const arcPoints = createArcPoints(startPosition, endPosition, 24);
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
      
      // Use gradient color for the path
      const colors: number[] = [];
      const color1 = isCompletedPath ? new THREE.Color(0x4a7a9c) : new THREE.Color(0xe10600);
      const color2 = isCompletedPath ? new THREE.Color(0x6f9ebe) : new THREE.Color(0xff5a52);
      
      for (let j = 0; j < arcPoints.length; j++) {
        const t = j / (arcPoints.length - 1);
        const color = new THREE.Color().lerpColors(color1, color2, t);
        colors.push(color.r, color.g, color.b);
      }
      
      pathGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      // Create line material with vertex colors
      const pathMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: isCompletedPath ? 0.4 : 0.7,
        linewidth: 1
      });
      
      const pathLine = new THREE.Line(pathGeometry, pathMaterial);
      pathLine.userData = { 
        isRacePath: true,
        fromRace: currentRace.round,
        toRace: nextRace.round,
        completed: isCompletedPath
      };
      
      globe.add(pathLine);
      
      // Add a direction indicator at midpoint
      if (arcPoints.length > 10) {
        const midIndex = Math.floor(arcPoints.length / 2);
        const midPoint = arcPoints[midIndex];
        const prevPoint = arcPoints[midIndex - 3];
        
        if (prevPoint && midPoint) {
          const direction = new THREE.Vector3().subVectors(midPoint, prevPoint).normalize();
          
          // Create an arrow
          const arrowLength = 0.05;
          const arrowBase = new THREE.Vector3().copy(midPoint).sub(
            new THREE.Vector3().copy(direction).multiplyScalar(arrowLength * 0.5)
          );
          const arrowTip = new THREE.Vector3().copy(midPoint).add(
            new THREE.Vector3().copy(direction).multiplyScalar(arrowLength * 0.5)
          );
          
          const arrowGeometry = new THREE.BufferGeometry().setFromPoints([arrowBase, arrowTip]);
          
          const arrowMaterial = new THREE.LineBasicMaterial({
            color: isCompletedPath ? 0x6f9ebe : 0xff5a52,
            transparent: true,
            opacity: isCompletedPath ? 0.6 : 0.9,
            linewidth: 2
          });
          
          const arrow = new THREE.Line(arrowGeometry, arrowMaterial);
          arrow.userData = { 
            isRacePath: true
          };
          
          globe.add(arrow);
          
          // Add arrow head (for better visibility)
          const headLength = 0.02;
          const headWidth = 0.01;
          const headGeometry = new THREE.ConeGeometry(headWidth, headLength, 8);
          const headMaterial = new THREE.MeshBasicMaterial({
            color: isCompletedPath ? 0x6f9ebe : 0xff5a52,
            transparent: true,
            opacity: isCompletedPath ? 0.6 : 0.9,
          });
          
          const head = new THREE.Mesh(headGeometry, headMaterial);
          head.position.copy(arrowTip);
          
          // Orient the arrow head along the path direction
          head.lookAt(arrowBase);
          head.rotateX(Math.PI / 2);
          
          head.userData = { 
            isRacePath: true
          };
          
          globe.add(head);
        }
      }
    }
  }, [races, globe, showPaths]);
  
  // Helper function to create arc points between two positions
  const createArcPoints = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 24): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    
    // Calculate distance between points
    const distance = start.distanceTo(end);
    
    // Adjust arc height based on distance
    const arcHeightFactor = Math.min(0.3, distance * 0.3);
    
    // Find middle point and elevate it
    const middle = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    middle.normalize().multiplyScalar(1.0 + arcHeightFactor);
    
    // Create a bezier curve
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      
      // Quadratic bezier curve
      const point = new THREE.Vector3();
      point.x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * middle.x + t * t * end.x;
      point.y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * middle.y + t * t * end.y;
      point.z = (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * middle.z + t * t * end.z;
      
      // Ensure point is slightly above globe surface
      point.normalize().multiplyScalar(1.01 + (t * (1-t) * 0.02));
      points.push(point);
    }
    
    return points;
  };

  // Helper function to convert lat/long to 3D vector
  const latLongToVector3 = (lat: number, long: number, radius: number): THREE.Vector3 => {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (long + 180) * Math.PI / 180;
    
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    return new THREE.Vector3(x, y, z);
  };

  return null;
};

export default PathsLayer;
