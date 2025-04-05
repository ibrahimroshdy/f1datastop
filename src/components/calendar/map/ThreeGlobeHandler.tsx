import { useEffect, useState, useRef } from 'react';
import ThreeGlobe from 'three-globe';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Race, GlobeDetailLevel } from './types';
import countriesData from './WorldMapData';
import { getCountryFlag } from '@/utils/countryUtils';

interface ThreeGlobeHandlerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  races: Race[];
  onRaceSelect: (race: Race) => void;
  onRaceHover: (race: Race | null, point: {x: number, y: number} | null) => void;
  showPaths: boolean;
  detailLevel: GlobeDetailLevel;
  onGlobeReady: () => void;
}

const ThreeGlobeHandler = ({
  containerRef,
  races,
  onRaceSelect,
  onRaceHover,
  showPaths,
  detailLevel,
  onGlobeReady
}: ThreeGlobeHandlerProps) => {
  const globeRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const markerRefs = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current || isInitialized) return;

    console.log("Initializing Three Globe");

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 240;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 150;
    controls.maxDistance = 500;
    controlsRef.current = controls;

    // Create globe
    const Globe = new ThreeGlobe()
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .polygonsData(countriesData.features)
      .polygonCapColor(() => 'rgba(200, 200, 200, 0.05)')
      .polygonSideColor(() => 'rgba(150, 150, 150, 0.1)')
      .polygonStrokeColor(() => '#111');

    // Set detail level
    const polygonResolution = detailLevel === 'high' ? 3 : detailLevel === 'medium' ? 2 : 1;
    Globe.polygonResolution(polygonResolution);

    // Add atmosphere
    Globe.atmosphereColor('rgb(59,130,246)');
    Globe.atmosphereAltitude(0.15);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xbbbbbb);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Scale the globe to proper size
    Globe.scale.set(100, 100, 100);
    scene.add(Globe);
    
    globeRef.current = Globe;
    
    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    animate();
    setIsInitialized(true);
    
    setTimeout(() => {
      onGlobeReady();
    }, 500);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      // Clear all references
      markerRefs.current = [];
      globeRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [containerRef, isInitialized, detailLevel, onGlobeReady]);

  // Update race markers and paths
  useEffect(() => {
    if (!globeRef.current || races.length === 0) return;
    
    const globe = globeRef.current;
    
    // Clear existing points
    globe.pointsData([]);
    globe.arcsData([]);
    
    // Process races to get points and arcs data
    const racesWithCoordinates = races.filter(race => 
      race.Circuit?.Location?.lat && race.Circuit?.Location?.long);
      
    // Sort races by round
    const sortedRaces = [...racesWithCoordinates].sort((a, b) => 
      parseInt(a.round) - parseInt(b.round)
    );
    
    // Create points data
    const pointsData = sortedRaces.map(race => {
      const raceDate = new Date(race.date);
      const today = new Date();
      const round = parseInt(race.round);
      
      const isFirstRace = round === 1;
      const isCompleted = raceDate <= today;
      const isUpcoming = raceDate > today;
      
      let color;
      if (isFirstRace) color = 'lime';
      else if (isUpcoming) color = '#e10600';
      else color = 'white';
      
      return {
        lat: parseFloat(race.Circuit.Location.lat),
        lng: parseFloat(race.Circuit.Location.long),
        size: isFirstRace || isUpcoming ? 0.8 : 0.5,
        color,
        race,
        isFirstRace,
        isUpcoming,
        isCompleted
      };
    });
    
    // Create arcs data for connections between races (if enabled)
    const arcsData = showPaths ? sortedRaces.slice(0, -1).map((race, index) => {
      const nextRace = sortedRaces[index + 1];
      const raceDate = new Date(race.date);
      const today = new Date();
      const isCompleted = raceDate <= today;
      
      return {
        startLat: parseFloat(race.Circuit.Location.lat),
        startLng: parseFloat(race.Circuit.Location.long),
        endLat: parseFloat(nextRace.Circuit.Location.lat),
        endLng: parseFloat(nextRace.Circuit.Location.long),
        color: isCompleted ? 'rgba(255,255,255,0.5)' : 'rgba(225,6,0,0.5)',
        dashLength: isCompleted ? 0 : 1,
        dashGap: 0.5,
        animateTime: isCompleted ? 0 : 3000
      };
    }) : [];

    // Add points to globe
    globe
      .pointsData(pointsData)
      .pointColor('color')
      .pointsMerge(true)
      .pointRadius('size')
      .pointAltitude(0.01)
      .pointLabel(d => {
        const flag = getCountryFlag(d.race.Circuit.Location.country);
        return `
          <div class="bg-black/80 backdrop-blur-sm p-2 rounded-md text-white border border-gray-700">
            <div class="font-bold">${d.race.raceName}</div>
            <div class="text-gray-300">${d.race.date}</div>
            <div class="text-gray-300">${flag} ${d.race.Circuit.Location.locality}, ${d.race.Circuit.Location.country}</div>
            <div class="text-gray-400 text-xs">Round ${d.race.round}</div>
          </div>
        `;
      });

    // Add point hover effect
    globe
      .onPointHover(point => {
        if (point === null) {
          onRaceHover(null, null);
          document.body.style.cursor = 'default';
        } else {
          document.body.style.cursor = 'pointer';
          if (rendererRef.current && point) {
            const screenPos = getScreenPosition(
              point.lat, 
              point.lng, 
              cameraRef.current!, 
              rendererRef.current
            );
            onRaceHover(point.race, { x: screenPos.x, y: screenPos.y });
          }
        }
      })
      .onPointClick(point => {
        if (point) {
          onRaceSelect(point.race);
        }
      });

    // Add arcs to globe
    if (showPaths) {
      globe
        .arcsData(arcsData)
        .arcColor('color')
        .arcDashLength('dashLength')
        .arcDashGap('dashGap')
        .arcDashAnimateTime('animateTime')
        .arcStroke(0.5);
    } else {
      globe.arcsData([]);
    }

  }, [races, showPaths, onRaceSelect, onRaceHover]);

  // Update detail level
  useEffect(() => {
    if (!globeRef.current) return;
    
    const globe = globeRef.current;
    const polygonResolution = detailLevel === 'high' ? 3 : detailLevel === 'medium' ? 2 : 1;
    globe.polygonResolution(polygonResolution);
    
  }, [detailLevel]);

  // Helper function to convert lat/lng to screen coordinates
  const getScreenPosition = (
    lat: number, 
    lng: number, 
    camera: THREE.PerspectiveCamera, 
    renderer: THREE.WebGLRenderer
  ) => {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    
    // Convert from spherical to Cartesian coordinates
    const x = -100 * Math.sin(phi) * Math.cos(theta);
    const y = 100 * Math.cos(phi);
    const z = 100 * Math.sin(phi) * Math.sin(theta);
    
    // Create position vector
    const position = new THREE.Vector3(x, y, z);
    
    // Project to screen coordinates
    position.project(camera);
    
    // Convert to screen coordinates
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    const screenX = (position.x + 1) * width / 2;
    const screenY = (-position.y + 1) * height / 2;
    
    return { x: screenX, y: screenY };
  };

  return null;
};

export default ThreeGlobeHandler;
