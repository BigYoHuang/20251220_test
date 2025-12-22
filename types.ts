export interface FloorPlan {
  id: number;
  name: string;
  file: File;
  src: string;
}

export interface ProjectInfo {
  id?: string;
  name: string;
  floorPlans: FloorPlan[];
}

export interface MarkerData {
  floor: string;
  isMezzanine: boolean;
  location: string;
  surfaceType: string;
  code1: string;
  code2: string;
  code3: string;
  code4: string;
  code6: string;
  length: string;
  width: string;
  tempImage: File | null;
}

export interface Marker {
  id: number;
  planIndex: number;
  x: number; // Percentage
  y: number; // Percentage
  seq: number;
  data: MarkerData;
  imageBlob: File;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface ImgDimensions {
  width: number;
  height: number;
}

// Augment window for JSZip loaded via CDN
declare global {
  interface Window {
    JSZip: any;
  }
}