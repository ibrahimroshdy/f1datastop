
// Types for the F1 Race Map components
export interface Race {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  season?: string;
  Circuit: {
    circuitName: string;
    url?: string;
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    }
  };
  FirstPractice?: {
    date: string;
    time?: string;
  };
  SecondPractice?: {
    date: string;
    time?: string;
  };
  ThirdPractice?: {
    date: string;
    time?: string;
  };
  Qualifying?: {
    date: string;
    time?: string;
  };
  Sprint?: {
    date: string;
    time?: string;
  };
  SprintQualifying?: {
    date: string;
    time?: string;
  };
}

export type RaceStatus = "first" | "upcoming" | "completed" | "next";

export interface RaceMapProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export interface RaceConnection {
  fromRace: Race;
  toRace: Race;
  completed: boolean;
}

export type GlobeDetailLevel = 'low' | 'medium' | 'high';

export interface GlobeControlsProps {
  showPaths: boolean;
  onTogglePaths: () => void;
  detailLevel: GlobeDetailLevel;
  onChangeDetailLevel: (level: GlobeDetailLevel) => void;
}

export interface RaceMarkerData {
  race: Race;
  status: RaceStatus;
  marker: THREE.Mesh;
  position: THREE.Vector3;
}

export interface CountryOutlinesProps {
  globe: THREE.Mesh;
  detailLevel: GlobeDetailLevel;
}

export interface RaceSequencePathProps {
  races: Race[];
  globe: THREE.Mesh;
  showPaths: boolean;
}

export interface GlobeSceneProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onSceneCreated: (sceneData: GlobeSceneData) => void;
  detailLevel: GlobeDetailLevel;
}

export interface GlobeSceneData {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  globe: THREE.Mesh;
  controls: any;
  markersGroup: THREE.Group;
}
