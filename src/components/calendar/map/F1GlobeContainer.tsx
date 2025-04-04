
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Race } from "@/components/calendar/map/types";
import { useRaceSchedule } from "@/hooks/useF1Data";
import MapLoadingOverlay from "@/components/calendar/map/MapLoadingOverlay";
import MapTips from "@/components/calendar/map/MapTips";
import MapLegend from "@/components/calendar/map/MapLegend";
import SelectedRaceInfo from "@/components/calendar/map/SelectedRaceInfo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MapControls from "@/components/calendar/map/MapControls";
import WorldMapData from "@/components/calendar/map/WorldMapData";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { getCountryFlag } from "@/utils/countryUtils";
import { Search, Globe } from "lucide-react";

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
  const controlsRef = useRef<OrbitControls | null>(null);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [isGlobeReady, setIsGlobeReady] = useState<boolean>(false);
  const [hoveredRace, setHoveredRace] = useState<Race | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{x: number, y: number} | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<{
    first: boolean;
    upcoming: boolean;
    completed: boolean;
  }>({
    first: true,
    upcoming: true,
    completed: true
  });
  
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
    scene.background = new THREE.Color(0x0a0e17); // darker background for more contrast
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      40, // field of view
      containerRef.current.clientWidth / containerRef.current.clientHeight, // aspect ratio
      0.1, // near clipping plane
      1000 // far clipping plane
    );
    cameraRef.current = camera;
    camera.position.z = 5;
    
    // Create renderer with better visuals
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    
    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.minDistance = 2.5;
    controls.maxDistance = 10;
    controlsRef.current = controls;
    
    // Create globe with better geometry and materials
    const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Create a more sophisticated material for the globe
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: 0x182436, // dark blue
      shininess: 15,
      specular: 0x333333,
      wireframe: false,
    });
    
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globe.castShadow = true;
    globe.receiveShadow = true;
    globeRef.current = globe;
    scene.add(globe);
    
    // Add grid lines to make it look like a globe
    const gridMaterial = new THREE.LineBasicMaterial({ 
      color: 0x3a506b, 
      transparent: true, 
      opacity: 0.4 
    });
    
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

    // Add world map outlines with country borders
    WorldMapData.features.forEach(feature => {
      const countryCoordinates = feature.geometry.coordinates;
      
      countryCoordinates.forEach((polygon: any) => {
        // For each polygon in the country's geometry
        polygon.forEach((ring: any) => {
          const points: THREE.Vector3[] = [];
          
          // Create points for each coordinate in the ring
          ring.forEach((coord: number[]) => {
            const [long, lat] = coord;
            const position = latLongToVector3(lat, long, 1.005);
            points.push(position);
          });
          
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
            globe.add(line);
          }
        });
      });
    });
    
    // Create markers group
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    scene.add(markersGroup);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Add directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Add a subtle hemisphere light for better global illumination
    const hemisphereLight = new THREE.HemisphereLight(0xaaaaff, 0x444444, 0.2);
    scene.add(hemisphereLight);
    
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
      if (!globeRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;
      
      const delta = time - lastTime;
      lastTime = time;
      
      // Update controls
      controlsRef.current.update();
      
      // Auto rotation when not interacting
      if (!controlsRef.current.enableDamping) {
        globeRef.current.rotation.y += 0.0002;
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      requestAnimationFrame(animate);
    };
    
    // Start animation
    requestAnimationFrame(animate);
    
    // Mark globe as ready
    setIsGlobeReady(true);
    
    // Event listeners for raycasting to detect hover over race markers
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !markersGroupRef.current) return;
      
      // Calculate mouse position in normalized device coordinates
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / containerRef.current.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / containerRef.current.clientHeight) * 2 + 1;
      
      // Cast a ray from the camera through the mouse position
      raycaster.setFromCamera(mouse, cameraRef.current);
      
      // Check intersections with markers
      const intersects = raycaster.intersectObjects(
        markersGroupRef.current.children.filter(obj => obj instanceof THREE.Mesh)
      );
      
      document.body.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
      
      if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        const race = selectedObject.userData?.race;
        
        if (race) {
          setHoveredRace(race);
          const screenPosition = new THREE.Vector3();
          selectedObject.updateMatrixWorld();
          screenPosition.setFromMatrixPosition(selectedObject.matrixWorld);
          screenPosition.project(cameraRef.current);
          
          const x = (screenPosition.x * 0.5 + 0.5) * containerRef.current.clientWidth;
          const y = (- screenPosition.y * 0.5 + 0.5) * containerRef.current.clientHeight;
          
          setHoverPoint({x, y});
        }
      } else {
        setHoveredRace(null);
        setHoverPoint(null);
      }
    };
    
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup function
    return () => {
      console.log("Cleaning up globe");
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      
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

      if (controlsRef.current) {
        controlsRef.current.dispose();
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

    // Filter data based on search term and filters
    const filteredRaces = data.data.filter(race => {
      // Apply search filter
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const raceNameMatch = race.raceName.toLowerCase().includes(searchTermLower);
        const locationMatch = race.Circuit.Location.locality?.toLowerCase().includes(searchTermLower) || 
                             race.Circuit.Location.country?.toLowerCase().includes(searchTermLower);
        
        if (!raceNameMatch && !locationMatch) {
          return false;
        }
      }

      // Apply status filters
      const round = parseInt(race.round);
      const raceDate = new Date(race.date);
      const today = new Date();

      if (round === 1 && !filterStatus.first) return false;
      if (raceDate > today && !filterStatus.upcoming) return false;
      if (raceDate <= today && round !== 1 && !filterStatus.completed) return false;

      return true;
    });
    
    // Create markers for each filtered race
    filteredRaces.forEach((race) => {
      const { Circuit, round } = race;
      const { lat, long } = Circuit.Location;
      
      if (!lat || !long) return;
      
      // Convert lat/long to 3D coordinates
      const position = latLongToVector3(parseFloat(lat), parseFloat(long), 1.03); // Slightly above globe surface
      
      // Determine marker color based on race status
      const raceDate = new Date(race.date);
      const today = new Date();
      const isFirstRace = parseInt(round) === 1;
      const isUpcoming = raceDate > today;
      const isCompleted = !isFirstRace && !isUpcoming;
      
      let markerColor: number;
      
      if (isFirstRace) markerColor = 0x00ff00; // Green for first race
      else if (isUpcoming) markerColor = 0xe10600; // Red for upcoming races
      else markerColor = 0xffffff; // White for completed races
      
      // Create glowing marker
      const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: markerColor
      });
      
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      marker.userData = { race }; // Store race data for click detection
      markersGroupRef.current.add(marker);
      
      // Add pulsing effect for upcoming races
      if (isUpcoming || isFirstRace) {
        const glowGeometry = new THREE.SphereGeometry(0.025, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: markerColor,
          transparent: true,
          opacity: 0.3
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(position);
        
        // Animate the glow
        const pulseSpeed = isFirstRace ? 1.5 : 1.0;
        const pulseScale = { value: 1.0 };
        const animate = () => {
          pulseScale.value = 1.0 + 0.3 * Math.sin(Date.now() * 0.003 * pulseSpeed);
          glow.scale.set(pulseScale.value, pulseScale.value, pulseScale.value);
          
          requestAnimationFrame(animate);
        };
        animate();
        
        markersGroupRef.current.add(glow);
      }
      
      // Add line from center to marker
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: isUpcoming ? 0xe10600 : 0x666666,
        transparent: true,
        opacity: isUpcoming ? 0.5 : 0.2
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
      const intersects = raycaster.intersectObjects(
        markersGroupRef.current.children.filter(obj => obj instanceof THREE.Mesh)
      );
      
      if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        const race = selectedObject.userData?.race;
        
        if (race) {
          console.log("Selected race:", race.raceName);
          setSelectedRace(race);
          
          // Show a toast notification
          toast.success(`Selected: ${race.raceName}`, {
            description: `Round ${race.round} - ${format(parseISO(race.date), 'dd MMM yyyy')}`
          });
          
          // Rotate globe to center on selected race
          if (globeRef.current && controlsRef.current) {
            const lat = parseFloat(race.Circuit.Location.lat);
            const long = parseFloat(race.Circuit.Location.long);
            
            const phi = (90 - lat) * Math.PI / 180;
            const theta = (long + 90) * Math.PI / 180;
            
            // Make the globe face the selected race
            const targetPosition = new THREE.Vector3(
              -Math.sin(phi) * Math.cos(theta) * 3,
              Math.cos(phi) * 3,
              Math.sin(phi) * Math.sin(theta) * 3
            );
            
            // Animate camera movement
            const animateCamera = () => {
              if (!cameraRef.current) return;

              cameraRef.current.position.lerp(targetPosition, 0.05);
              
              if (cameraRef.current.position.distanceTo(targetPosition) > 0.1) {
                requestAnimationFrame(animateCamera);
              } else {
                // Set control target to look at the race location
                controlsRef.current!.target.copy(latLongToVector3(lat, long, 1.03));
                controlsRef.current!.update();
              }
            };
            
            animateCamera();
          }
        }
      }
    };
    
    containerRef.current?.addEventListener('click', handleClick);
    
    return () => {
      containerRef.current?.removeEventListener('click', handleClick);
    };
  }, [isGlobeReady, data, searchTerm, filterStatus]);
  
  // Handle filter toggle
  const toggleFilter = (filter: 'first' | 'upcoming' | 'completed') => {
    setFilterStatus(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
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

  return (
    <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
      {/* Globe container */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Search and filters */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search races..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-4 py-2 bg-black/60 backdrop-blur-sm border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red"
          />
        </div>
      </div>

      {/* Filter buttons */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button 
          onClick={() => toggleFilter('first')} 
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md backdrop-blur-sm text-sm ${filterStatus.first ? 'bg-green-800/80 text-white' : 'bg-black/60 text-gray-400 border-gray-700 border'}`}
        >
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          First
        </button>
        <button 
          onClick={() => toggleFilter('upcoming')} 
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md backdrop-blur-sm text-sm ${filterStatus.upcoming ? 'bg-red-900/80 text-white' : 'bg-black/60 text-gray-400 border-gray-700 border'}`}
        >
          <div className="w-2 h-2 rounded-full bg-red-600"></div>
          Upcoming
        </button>
        <button 
          onClick={() => toggleFilter('completed')} 
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md backdrop-blur-sm text-sm ${filterStatus.completed ? 'bg-gray-700/80 text-white' : 'bg-black/60 text-gray-400 border-gray-700 border'}`}
        >
          <div className="w-2 h-2 rounded-full bg-white"></div>
          Completed
        </button>
      </div>
      
      {/* Loading overlay */}
      {isLoading && <MapLoadingOverlay />}
      
      {/* Selected race info overlay */}
      {selectedRace && (
        <SelectedRaceInfo 
          race={selectedRace} 
          onClose={() => setSelectedRace(null)} 
        />
      )}
      
      {/* Hover tooltip */}
      {hoveredRace && hoverPoint && (
        <div 
          className="absolute z-30 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-md p-2 text-xs text-white shadow-lg pointer-events-none"
          style={{
            left: `${hoverPoint.x}px`,
            top: `${hoverPoint.y - 80}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-bold">{getCountryFlag(hoveredRace.Circuit.Location.country)} {hoveredRace.raceName}</div>
          <div className="text-gray-300 mt-1">{format(parseISO(hoveredRace.date), 'dd MMM yyyy')}</div>
          <div className="text-gray-300">{hoveredRace.Circuit.Location.locality}, {hoveredRace.Circuit.Location.country}</div>
        </div>
      )}
      
      {/* Tips */}
      <MapTips />
      
      {/* Legend */}
      <MapLegend />

      {/* Controls hints */}
      <MapControls />
    </div>
  );
};

export default F1GlobeContainer;
