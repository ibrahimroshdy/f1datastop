
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GlobeSceneProps } from './types';

// Earth texture URLs from NASA/public sources
const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const EARTH_BUMP_URL = 'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png';

const GlobeScene = ({ containerRef, onSceneCreated, detailLevel }: GlobeSceneProps) => {
  const isInitializedRef = useRef(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    console.log("Initializing globe scene");
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      40,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
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
    
    // Create globe with geometry and materials
    const segments = detailLevel === 'high' ? 96 : 
                    detailLevel === 'medium' ? 64 : 32;
    
    const globeGeometry = new THREE.SphereGeometry(1, segments, segments);
    
    // Load earth textures
    const textureLoader = new THREE.TextureLoader();
    
    // Create initial material with dark color while textures load
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a3a5c,
      shininess: 25,
      specular: 0x333355,
    });
    
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globe.castShadow = true;
    globe.receiveShadow = true;
    scene.add(globe);
    
    // Load textures asynchronously
    textureLoader.load(
      EARTH_TEXTURE_URL,
      (texture) => {
        globeMaterial.map = texture;
        globeMaterial.color = new THREE.Color(0xffffff);
        globeMaterial.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.warn('Failed to load earth texture, using fallback color');
      }
    );
    
    textureLoader.load(
      EARTH_BUMP_URL,
      (texture) => {
        globeMaterial.bumpMap = texture;
        globeMaterial.bumpScale = 0.02;
        globeMaterial.needsUpdate = true;
      },
      undefined,
      () => {} // Silent fail for bump map
    );
    
    // Create markers group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xaaaaff, 0x444444, 0.2);
    scene.add(hemisphereLight);
    
    // Add soft glow effect
    const glowGeometry = new THREE.SphereGeometry(1.02, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x3a5e8c,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);
    
    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Auto-rotation
    const autoRotate = () => {
      if (!controls.enableDamping) {
        globe.rotation.y += 0.0005;
      }
    };

    // Animation loop
    const animate = () => {
      controls.update();
      autoRotate();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    
    animate();
    
    // Store renderer for cleanup
    rendererRef.current = renderer;
    
    // Pass scene data back to parent
    onSceneCreated({
      scene,
      camera,
      renderer,
      globe,
      controls,
      markersGroup
    });
    
    // Cleanup function - only runs on actual unmount
    return () => {
      console.log("Cleaning up globe scene");
      window.removeEventListener('resize', handleResize);
      
      // Only cleanup if we actually have a renderer
      if (rendererRef.current && containerRef.current) {
        try {
          if (rendererRef.current.domElement && containerRef.current.contains(rendererRef.current.domElement)) {
            containerRef.current.removeChild(rendererRef.current.domElement);
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        
        // Dispose of geometries and materials
        globeGeometry.dispose();
        globeMaterial.dispose();
        glowGeometry.dispose();
        glowMaterial.dispose();
        
        // Dispose of renderer
        rendererRef.current.dispose();
        
        // Dispose of controls
        controls.dispose();
        
        rendererRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [containerRef, onSceneCreated, detailLevel]);

  return null;
};

export default GlobeScene;
