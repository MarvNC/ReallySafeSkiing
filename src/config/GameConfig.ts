import * as THREE from 'three';
import { BiomeType } from '../world/WorldState';

export const PHYSICS_CONFIG = {
  // Global gravity for the game world
  gravity: new THREE.Vector3(0, -20, 0),
  // Safety clamp for the physics timestep
  maxDeltaTime: 1 / 20,
} as const;

export const PLAYER_CONFIG = {
  radius: 1.6,
  startPosition: new THREE.Vector3(0, 15, -5),
  camera: {
    fov: 75,
    near: 0.1,
    far: 5000,
    eyeHeight: 1.7,
    tiltRadians: -0.15,
  },
  hands: {
    leftOffset: new THREE.Vector3(-0.3, -0.3, -0.5),
    rightOffset: new THREE.Vector3(0.3, -0.3, -0.5),
    rightMirrorScaleX: -1,
    poleAngleRadians: Math.PI / 12,
  },
  skis: {
    offset: new THREE.Vector3(0, -1.5, 0.3),
  },
  animation: {
    bobSpeedScale: 2,
    maxBobAmount: 0.1,
    baseBobFrequency: 1,
  },
} as const;

export const TERRAIN_DIMENSIONS = {
  CHUNK_WIDTH: 150,
  CHUNK_LENGTH: 100,
  CHUNK_SEGMENTS: 60,
} as const;

export const TERRAIN_CONFIG = {
  SLOPE_ANGLE: 0.5,
  BIOME_DEFAULTS: {
    [BiomeType.Glade]: { turnSpeed: 0.02, widthMin: 25, widthMax: 40 },
    [BiomeType.Chute]: { turnSpeed: 0.05, widthMin: 10, widthMax: 15 },
    [BiomeType.Slalom]: { turnSpeed: 0.08, widthMin: 15, widthMax: 25 },
    [BiomeType.Cruiser]: { turnSpeed: 0.01, widthMin: 30, widthMax: 50 },
  },
  BANKING_STRENGTH: 0.8,
  WALL_STEEPNESS: 3.0,
  MOGUL_SCALE: 0.2,
  MOGUL_HEIGHT: 2.0,
  BIOME_TRANSITION_DISTANCE: 2000,
  ANGLE_INTERPOLATION: 0.15, // How quickly the path follows the target angle
  CANYON_FLOOR_OFFSET: 20, // Additional width beyond track for canyon floor
  CANYON_HEIGHT: 40, // The max height of the cliff
  WALL_WIDTH: 15, // How wide the slope is horizontally
  CLIFF_NOISE_SCALE: 0.5, // Higher frequency noise for rocks
  OBSTACLE_COUNT: 200, // Number of obstacles per chunk
} as const;
