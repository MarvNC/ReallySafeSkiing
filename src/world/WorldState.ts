// src/world/WorldState.ts

export const BiomeType = {
  Glade: 'Glade', // Wide, gentle curves
  Chute: 'Chute', // Narrow, faster turns
  Slalom: 'Slalom', // High frequency turns
  Cruiser: 'Cruiser', // Very wide, straight
} as const;

export type BiomeType = (typeof BiomeType)[keyof typeof BiomeType];

export interface ChunkState {
  endX: number; // The X position of the path at the end of the chunk
  endAngle: number; // The direction the path is pointing (radians)
  endZ: number; // The absolute Z world position
  biome: BiomeType; // The current biome
  distanceInBiome: number; // How long we've been in this biome (to trigger transitions)
}

export interface PathPoint {
  x: number;
  y: number;
  z: number;
  angle: number;
  width: number;
  banking: number;
}
