
import { useEffect } from 'react';
import * as THREE from 'three';
import { CountryOutlinesProps } from './types';

// Simplified outlines for major continents and regions
const majorOutlines = [
  // Europe (simplified outline)
  [
    [10, 60], [30, 70], [40, 60], [50, 70], [30, 50], [20, 45], 
    [10, 40], [0, 40], [-10, 50], [10, 60]
  ],
  // Africa (simplified outline)
  [
    [10, 30], [30, 30], [40, 10], [30, -30], [15, -35], 
    [-10, -30], [-20, 0], [-10, 20], [10, 30]
  ],
  // North America (simplified outline)
  [
    [-70, 30], [-120, 30], [-130, 50], [-120, 70], [-70, 80], 
    [-50, 60], [-60, 30], [-70, 30]
  ],
  // South America (simplified outline)
  [
    [-50, 10], [-80, 10], [-80, -40], [-70, -55], 
    [-60, -40], [-50, -10], [-40, 0], [-50, 10]
  ],
  // Asia (simplified outline)
  [
    [30, 40], [50, 60], [90, 70], [130, 60], [140, 40], 
    [100, 10], [80, 0], [50, 10], [30, 30], [30, 40]
  ],
  // Australia (simplified outline)
  [
    [115, -15], [150, -20], [150, -40], [115, -35], [115, -15]
  ]
];

// Major grid lines
const majorGridLines = {
  // Equator
  equator: { lat: 0, color: 0x3a88c5, opacity: 0.5 },
  // Tropics
  tropicCancer: { lat: 23.5, color: 0x3a88c5, opacity: 0.3 },
  tropicCapricorn: { lat: -23.5, color: 0x3a88c5, opacity: 0.3 },
  // Arctic/Antarctic circles
  arcticCircle: { lat: 66.5, color: 0x3a88c5, opacity: 0.3 },
  antarcticCircle: { lat: -66.5, color: 0x3a88c5, opacity: 0.3 },
  // Prime meridian
  primeMeridian: { long: 0, color: 0x3a88c5, opacity: 0.4 },
  // Date line (approximately)
  dateLine: { long: 180, color: 0x3a88c5, opacity: 0.3 }
};

const CountriesLayer = ({ globe, detailLevel }: CountryOutlinesProps) => {
  useEffect(() => {
    if (!globe) return;
    
    // Remove existing country outlines
    globe.children = globe.children.filter(child => 
      !(child instanceof THREE.Line && child.userData.isCountryBorder));

    // Draw continents with enhanced visibility
    const continentMaterial = new THREE.LineBasicMaterial({ 
      color: 0x6a9ac4,
      transparent: true,
      opacity: 0.6,
      linewidth: 1.5
    });
    
    majorOutlines.forEach(outline => {
      const points: THREE.Vector3[] = [];
      
      outline.forEach(([long, lat]) => {
        points.push(latLongToVector3(lat, long, 1.004));
      });
      
      if (points.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, continentMaterial);
        line.userData = { isCountryBorder: true };
        globe.add(line);
      }
    });

    // Add latitude lines (parallels)
    const latStep = detailLevel === 'high' ? 15 : detailLevel === 'medium' ? 30 : 45;
    for (let lat = -90; lat <= 90; lat += latStep) {
      const isSpecialParallel = Object.values(majorGridLines)
        .filter(line => 'lat' in line)
        .some(line => Math.abs((line as any).lat - lat) < 1);
      
      // Special latitude handling
      if (isSpecialParallel) continue; // Skip as we'll add these separately
      
      const radius = Math.cos(Math.abs(lat) * Math.PI / 180);
      const y = Math.sin(lat * Math.PI / 180);
      
      const points = [];
      const segments = detailLevel === 'high' ? 72 : detailLevel === 'medium' ? 48 : 36;
      
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          radius * Math.cos(theta),
          y,
          radius * Math.sin(theta)
        ));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: 0x3a506b, 
        transparent: true, 
        opacity: 0.15
      });
      
      const line = new THREE.Line(geometry, material);
      line.userData = { isCountryBorder: true };
      globe.add(line);
    }
    
    // Add longitude lines (meridians)
    const longStep = detailLevel === 'high' ? 15 : detailLevel === 'medium' ? 30 : 45;
    for (let long = -180; long < 180; long += longStep) {
      const isSpecialMeridian = Object.values(majorGridLines)
        .filter(line => 'long' in line)
        .some(line => Math.abs((line as any).long - long) < 1);
      
      // Special longitude handling
      if (isSpecialMeridian) continue; // Skip as we'll add these separately
      
      const points = [];
      const segments = detailLevel === 'high' ? 72 : detailLevel === 'medium' ? 48 : 36;
      
      for (let i = 0; i <= segments; i++) {
        const lat = -90 + (180 * i / segments);
        points.push(latLongToVector3(lat, long, 1.002));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: 0x3a506b, 
        transparent: true, 
        opacity: 0.15
      });
      
      const line = new THREE.Line(geometry, material);
      line.userData = { isCountryBorder: true };
      globe.add(line);
    }
    
    // Add special grid lines with higher visibility
    
    // Special latitudes (equator, tropics, etc.)
    Object.entries(majorGridLines).forEach(([name, line]) => {
      if ('lat' in line) {
        const lat = line.lat;
        const radius = Math.cos(Math.abs(lat) * Math.PI / 180);
        const y = Math.sin(lat * Math.PI / 180);
        
        const points = [];
        const segments = 72;
        
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          points.push(new THREE.Vector3(
            radius * Math.cos(theta),
            y,
            radius * Math.sin(theta)
          ));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
          color: line.color, 
          transparent: true, 
          opacity: line.opacity,
          linewidth: 1.5
        });
        
        const gridLine = new THREE.Line(geometry, material);
        gridLine.userData = { 
          isCountryBorder: true,
          gridName: name
        };
        globe.add(gridLine);
      }
    });
    
    // Special longitudes (prime meridian, date line)
    Object.entries(majorGridLines).forEach(([name, line]) => {
      if ('long' in line) {
        const long = line.long;
        const points = [];
        const segments = 72;
        
        for (let i = 0; i <= segments; i++) {
          const lat = -90 + (180 * i / segments);
          points.push(latLongToVector3(lat, long, 1.003));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
          color: line.color, 
          transparent: true, 
          opacity: line.opacity,
          linewidth: 1.5
        });
        
        const gridLine = new THREE.Line(geometry, material);
        gridLine.userData = { 
          isCountryBorder: true,
          gridName: name
        };
        globe.add(gridLine);
      }
    });
    
  }, [globe, detailLevel]);
  
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

export default CountriesLayer;
