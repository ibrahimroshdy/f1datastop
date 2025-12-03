
import { useEffect } from 'react';
import * as THREE from 'three';
import { Race } from './types';

interface RaceMarkersProps {
  races: Race[];
  globe: THREE.Mesh;
  camera: THREE.PerspectiveCamera;
  controls: any;
  markersGroup: THREE.Group;
  containerRef: React.RefObject<HTMLDivElement>;
  onRaceSelect: (race: Race) => void;
  onRaceHover: (race: Race | null, point: {x: number, y: number} | null) => void;
}

const RaceMarkers = ({ 
  races, 
  globe, 
  camera, 
  controls, 
  markersGroup, 
  containerRef,
  onRaceSelect,
  onRaceHover 
}: RaceMarkersProps) => {
  useEffect(() => {
    if (!globe || !markersGroup || races.length === 0 || !containerRef.current) return;

    // Clear existing markers
    while (markersGroup.children.length > 0) {
      const object = markersGroup.children[0];
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        } else if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        }
      }
      markersGroup.remove(object);
    }

    // Sort races by round
    const sortedRaces = [...races].sort((a, b) => parseInt(a.round) - parseInt(b.round));
    
    // Create markers for each race
    sortedRaces.forEach((race) => {
      if (!race.Circuit?.Location?.lat || !race.Circuit?.Location?.long) return;
      
      const lat = parseFloat(race.Circuit.Location.lat);
      const long = parseFloat(race.Circuit.Location.long);
      const position = latLongToVector3(lat, long, 1.02);
      
      // Determine marker color and status
      const raceDate = new Date(race.date);
      const today = new Date();
      const round = parseInt(race.round);
      const isFirstRace = round === 1;
      const isCompleted = raceDate <= today && !isFirstRace;
      const isUpcoming = !isCompleted && !isFirstRace;
      
      let markerColor = isFirstRace ? 0x00ff00 : // Green for first race
                       isUpcoming ? 0xe10600 : // Red for upcoming races
                       0xffffff; // White for completed races
      
      // Create marker - larger and more visible
      const markerGeometry = new THREE.SphereGeometry(0.035, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: markerColor,
        transparent: true,
        opacity: 1.0
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      marker.userData = { race };
      markersGroup.add(marker);
      
      // Add outer ring for better visibility
      const ringGeometry = new THREE.RingGeometry(0.04, 0.055, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: markerColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(position);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      markersGroup.add(ring);
      
      // Add pulse effect for upcoming/first races
      if (isUpcoming || isFirstRace) {
        const pulseGeometry = new THREE.SphereGeometry(0.022, 16, 16);
        const pulseMaterial = new THREE.MeshBasicMaterial({
          color: markerColor,
          transparent: true,
          opacity: 0.6
        });
        
        const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulse.position.copy(position);
        
        // Create animation
        let scale = 1.0;
        let growingPhase = true;
        const pulseSpeed = isFirstRace ? 0.02 : 0.015;
        const minScale = 1.0;
        const maxScale = isFirstRace ? 1.5 : 1.3;
        
        const animatePulse = () => {
          if (growingPhase) {
            scale += pulseSpeed;
            if (scale >= maxScale) growingPhase = false;
          } else {
            scale -= pulseSpeed;
            if (scale <= minScale) growingPhase = true;
          }
          
          pulse.scale.set(scale, scale, scale);
          requestAnimationFrame(animatePulse);
        };
        
        animatePulse();
        markersGroup.add(pulse);
      }
      
      // Add race number label
      const roundCanvas = document.createElement('canvas');
      roundCanvas.width = 64;
      roundCanvas.height = 64;
      
      const ctx = roundCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isFirstRace ? '#00ff00' : 
                      isUpcoming ? '#e10600' : '#ffffff';
        ctx.fillText(race.round, 32, 32);
      }
      
      const roundTexture = new THREE.CanvasTexture(roundCanvas);
      const roundMaterial = new THREE.SpriteMaterial({
        map: roundTexture,
        transparent: true,
        sizeAttenuation: false
      });
      
      const roundSprite = new THREE.Sprite(roundMaterial);
      roundSprite.position.copy(position.clone().multiplyScalar(1.1));
      roundSprite.scale.set(0.05, 0.05, 0.05);
      markersGroup.add(roundSprite);
      
      // Add connecting line to globe center
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: isUpcoming ? 0xe10600 : 0x666666,
        transparent: true,
        opacity: isUpcoming ? 0.4 : 0.2
      });
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        position
      ]);
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      markersGroup.add(line);
    });

    // Raycasting for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current || !camera) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / containerRef.current.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / containerRef.current.clientHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markersGroup.children);
      
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        const race = obj.userData?.race;
        
        if (race) {
          containerRef.current.style.cursor = 'pointer';
          
          // Calculate screen position for tooltip
          const vector = new THREE.Vector3();
          vector.copy(obj.position);
          vector.project(camera);
          
          const x = (vector.x * 0.5 + 0.5) * containerRef.current.clientWidth;
          const y = (-vector.y * 0.5 + 0.5) * containerRef.current.clientHeight;
          
          onRaceHover(race, {x, y});
        }
      } else {
        containerRef.current.style.cursor = 'grab';
        onRaceHover(null, null);
      }
    };
    
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !camera) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / containerRef.current.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / containerRef.current.clientHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markersGroup.children);
      
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        const race = obj.userData?.race;
        
        if (race) {
          onRaceSelect(race);
          
          // Animate camera to focus on selected race
          if (globe && controls) {
            const lat = parseFloat(race.Circuit.Location.lat);
            const long = parseFloat(race.Circuit.Location.long);
            
            // Calculate target position
            const phi = (90 - lat) * Math.PI / 180;
            const theta = (long + 90) * Math.PI / 180;
            
            const distance = camera.position.length();
            const targetPosition = new THREE.Vector3(
              -Math.sin(phi) * Math.cos(theta) * distance * 0.8,
              Math.cos(phi) * distance * 0.8,
              Math.sin(phi) * Math.sin(theta) * distance * 0.8
            );
            
            // Animate camera movement
            const startPosition = camera.position.clone();
            const duration = 1000; // ms
            const startTime = Date.now();
            
            function animateCamera() {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function for smooth animation
              const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
              const easedProgress = easeOutCubic(progress);
              
              // Interpolate position
              camera.position.lerpVectors(
                startPosition,
                targetPosition,
                easedProgress
              );
              
              // Update controls target
              controls.target.copy(latLongToVector3(lat, long, 1));
              controls.update();
              
              if (progress < 1) {
                requestAnimationFrame(animateCamera);
              }
            }
            
            animateCamera();
          }
        }
      }
    };
    
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('click', handleClick);
    
    return () => {
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('click', handleClick);
    };
  }, [races, globe, camera, controls, markersGroup, containerRef, onRaceSelect, onRaceHover]);

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

export default RaceMarkers;
