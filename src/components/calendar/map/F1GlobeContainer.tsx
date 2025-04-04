
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Race } from "@/components/calendar/map/types";
import { useRaceSchedule } from "@/hooks/useF1Data";
import MapLoadingOverlay from "@/components/calendar/map/MapLoadingOverlay";
import MapTips from "@/components/calendar/map/MapTips";
import SelectedRaceInfo from "@/components/calendar/map/SelectedRaceInfo";

interface F1GlobeContainerProps {
  selectedYear: number;
}

const F1GlobeContainer = ({ selectedYear }: F1GlobeContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [isGlobeReady, setIsGlobeReady] = useState<boolean>(false);
  const raceSchedule = useRaceSchedule(selectedYear);
  const { isLoading, data } = raceSchedule;

  // Add debug logging
  useEffect(() => {
    console.log("F1GlobeContainer rendered", { 
      selectedYear,
      containerExists: !!containerRef.current,
      isGlobeReady,
      dataLoaded: !!data,
      isLoading
    });
  });

  // Initialize the globe
  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log("Initializing globe visualization");
    
    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x111827); // dark background
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      45, // field of view
      containerRef.current.clientWidth / containerRef.current.clientHeight, // aspect ratio
      0.1, // near clipping plane
      1000 // far clipping plane
    );
    cameraRef.current = camera;
    camera.position.z = 4;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    
    // Create globe
    const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Load earth texture
    const textureLoader = new THREE.TextureLoader();
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: 0x2c3e50, // base color (dark blue)
      shininess: 5,
      wireframe: false,
    });
    
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globeRef.current = globe;
    scene.add(globe);
    
    // Add grid lines to make it look like a globe
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x3a506b, transparent: true, opacity: 0.3 });
    
    // Add latitude lines
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
          0,
          radius * Math.sin(theta)
        ));
      }
      
      const latitudeGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const latitudeLine = new THREE.Line(latitudeGeometry, gridMaterial);
      latitudeLine.rotation.x = Math.PI / 2;
      latitudeLine.position.y = height;
      globe.add(latitudeLine);
    }
    
    // Add longitude lines
    for (let lng = 0; lng < 360; lng += 20) {
      const longitudeGeometry = new THREE.BufferGeometry();
      const points = [];
      
      for (let lat = -90; lat <= 90; lat += 5) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lng * Math.PI / 180;
        
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        
        points.push(new THREE.Vector3(x, y, z));
      }
      
      longitudeGeometry.setFromPoints(points);
      const longitudeLine = new THREE.Line(longitudeGeometry, gridMaterial);
      globe.add(longitudeLine);
    }
    
    // Create markers group
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    scene.add(markersGroup);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation function
    let lastTime = 0;
    const animate = (time: number) => {
      if (!globeRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      
      const delta = time - lastTime;
      lastTime = time;
      
      // Slowly rotate the globe
      globeRef.current.rotation.y += 0.0005;
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      requestAnimationFrame(animate);
    };
    
    // Start animation
    requestAnimationFrame(animate);
    
    // Mark globe as ready
    setIsGlobeReady(true);
    
    // Cleanup function
    return () => {
      console.log("Cleaning up globe");
      window.removeEventListener('resize', handleResize);
      
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      if (globeRef.current) {
        globeRef.current.geometry.dispose();
        if (globeRef.current.material instanceof THREE.Material) {
          globeRef.current.material.dispose();
        } else if (Array.isArray(globeRef.current.material)) {
          globeRef.current.material.forEach(material => material.dispose());
        }
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Add race markers when data is loaded
  useEffect(() => {
    if (!isGlobeReady || !markersGroupRef.current || !data?.data || !globeRef.current) {
      return;
    }
    
    console.log("Adding race markers to globe");
    
    // Clear existing markers
    while (markersGroupRef.current.children.length > 0) {
      const object = markersGroupRef.current.children[0];
      markersGroupRef.current.remove(object);
    }
    
    // Create markers for each race
    data.data.forEach((race) => {
      const { Circuit, round } = race;
      const { lat, long } = Circuit.Location;
      
      if (!lat || !long) return;
      
      // Convert lat/long to 3D coordinates
      const position = latLongToVector3(parseFloat(lat), parseFloat(long), 1.02); // Slightly above globe surface
      
      // Create marker
      const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: parseInt(round) === 1 ? 0x00ff00 : // First race green
              new Date(race.date) > new Date() ? 0xe10600 : // Upcoming race red
              0x888888, // Past race gray
      });
      
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      marker.userData = { race }; // Store race data for click detection
      
      markersGroupRef.current.add(marker);
      
      // Add line from center to marker
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
      });
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), // Center of the globe
        position
      ]);
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      markersGroupRef.current.add(line);
    });
    
    // Add click event for marker selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current || !markersGroupRef.current) return;
      
      // Calculate mouse position in normalized device coordinates
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / containerRef.current.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / containerRef.current.clientHeight) * 2 + 1;
      
      // Cast a ray from the camera through the mouse position
      raycaster.setFromCamera(mouse, cameraRef.current);
      
      // Check intersections with markers
      const intersects = raycaster.intersectObjects(markersGroupRef.current.children.filter(obj => obj instanceof THREE.Mesh));
      
      if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        const race = selectedObject.userData?.race;
        
        if (race) {
          console.log("Selected race:", race.raceName);
          setSelectedRace(race);
          
          // Rotate globe to center on selected race
          if (globeRef.current) {
            const lat = parseFloat(race.Circuit.Location.lat);
            const long = parseFloat(race.Circuit.Location.long);
            
            const phi = (90 - lat) * Math.PI / 180;
            const theta = (long + 90) * Math.PI / 180;
            
            // Animate rotation to center on race
            const targetRotationY = -theta;
            const targetRotationX = phi - Math.PI / 2;
            
            // Simple animation to rotate to target
            const currentRotationY = globeRef.current.rotation.y;
            const currentRotationX = globeRef.current.rotation.x;
            
            const animateRotation = () => {
              if (!globeRef.current) return;
              
              globeRef.current.rotation.y += (targetRotationY - globeRef.current.rotation.y) * 0.05;
              globeRef.current.rotation.x += (targetRotationX - globeRef.current.rotation.x) * 0.05;
              
              if (
                Math.abs(globeRef.current.rotation.y - targetRotationY) > 0.01 ||
                Math.abs(globeRef.current.rotation.x - targetRotationX) > 0.01
              ) {
                requestAnimationFrame(animateRotation);
              }
            };
            
            animateRotation();
          }
        }
      }
    };
    
    containerRef.current?.addEventListener('click', handleClick);
    
    return () => {
      containerRef.current?.removeEventListener('click', handleClick);
    };
  }, [isGlobeReady, data]);
  
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

  return (
    <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Loading overlay */}
      {isLoading && <MapLoadingOverlay />}
      
      {/* Selected race info overlay */}
      {selectedRace && (
        <SelectedRaceInfo 
          race={selectedRace} 
          onClose={() => setSelectedRace(null)} 
        />
      )}
      
      {/* Tips */}
      <MapTips />
    </div>
  );
};

export default F1GlobeContainer;
