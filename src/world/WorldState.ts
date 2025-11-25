// src/world/WorldState.ts

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
