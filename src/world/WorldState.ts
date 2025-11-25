export interface ChunkState {
  endX: number; // The X position of the path at the end of the chunk
  endAngle: number; // The direction the path is pointing (radians)
  endZ: number; // The absolute Z world position
}

export interface PathPoint {
  x: number;
  y: number;
  z: number;
  angle: number;
  width: number;
  banking: number;
  s: number;
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
}

export const SurfaceKind = {
  Track: 'track',
  Bank: 'bank',
  CanyonFloor: 'canyonFloor',
  WallVertical: 'wallVertical',
  WallLedge: 'wallLedge',
  Plateau: 'plateau',
} as const;

export type SurfaceKind = (typeof SurfaceKind)[keyof typeof SurfaceKind];

export interface TerrainSample {
  height: number;
  kind: SurfaceKind;
  isWall: boolean;
  localT: number;
  localS: number;
  distFromTrackEdge: number;
}
