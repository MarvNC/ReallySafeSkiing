import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { BiomeType } from './WorldState';
import type { ChunkState, PathPoint } from './WorldState';
import { TERRAIN_CONFIG, TERRAIN_DIMENSIONS } from '../config/GameConfig';

const { CHUNK_LENGTH, CHUNK_SEGMENTS } = TERRAIN_DIMENSIONS;

/**
 * Pure terrain-generation logic: heightfields, path spine, and noise sampling.
 * Contains no Three.js or Rapier dependencies so it can be moved to a worker later.
 */
export class TerrainGenerator {
  private readonly noise2D: NoiseFunction2D;

  constructor(noise2D: NoiseFunction2D = createNoise2D()) {
    this.noise2D = noise2D;
  }

  sampleNoise(x: number, y: number): number {
    return this.noise2D(x, y);
  }

  private getTrackWidth(z: number, biome: BiomeType): number {
    const widthNoise = this.noise2D(z * 0.01, 100);
    const config = TERRAIN_CONFIG.BIOME_DEFAULTS[biome];
    return config.widthMin + (widthNoise * 0.5 + 0.5) * (config.widthMax - config.widthMin);
  }

  getSnowHeight(localX: number, worldZ: number, banking: number, trackWidth?: number): number {
    const baseSlope = worldZ * Math.tan(TERRAIN_CONFIG.SLOPE_ANGLE);
    const bankingOffset = localX * banking;
    const moguls = this.noise2D(localX * 0.2, worldZ * 0.2) * 1.5;
    let height = baseSlope + bankingOffset + moguls;

    // Add canyon walls if trackWidth is provided
    if (trackWidth !== undefined) {
      const canyonFloorWidth = trackWidth / 2 + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
      const distFromTrackEdge = Math.abs(localX) - canyonFloorWidth;

      if (distFromTrackEdge > 0) {
        // Calculate progress up the cliff (0.0 = bottom, 1.0 = top)
        const progress = Math.min(1.0, distFromTrackEdge / TERRAIN_CONFIG.WALL_WIDTH);

        if (progress < 1.0) {
          // Cliff face - terraced low-poly style
          // Calculate wall height in world space (for proper noise mapping)
          const wallHeight = progress * TERRAIN_CONFIG.CANYON_HEIGHT;

          // Create terraced/blocky profile with quantization
          const terraceSteps = 6; // Number of distinct ledges
          const terraceStepSize = TERRAIN_CONFIG.CANYON_HEIGHT / terraceSteps;
          const quantizedProgress = Math.floor(progress * terraceSteps) / terraceSteps;
          const baseTerraceHeight = quantizedProgress * TERRAIN_CONFIG.CANYON_HEIGHT;

          // Use wall-space coordinates for noise (wallHeight instead of localX)
          // This prevents vertical stretching by mapping noise to the wall face
          const wallSpaceX = worldZ * 0.1; // Horizontal along the wall
          const wallSpaceY = wallHeight * 0.15; // Vertical up the wall

          // Large-scale noise to displace terraces (creates chunky rock formations)
          const terraceDisplacement = this.noise2D(wallSpaceX, wallSpaceY) * terraceStepSize * 0.6;

          // Fine detail noise for texture (smaller amplitude)
          const detailNoise = this.noise2D(wallSpaceX * 2, wallSpaceY * 2) * 2.0;

          // Combine terraced base with displacements
          const cliffHeight = baseTerraceHeight + terraceDisplacement + detailNoise;
          height += cliffHeight;
        } else {
          // Plateau - gentle rolling noise
          const plateauNoise = this.noise2D(localX * 0.05, worldZ * 0.05) * 3.0;
          height += TERRAIN_CONFIG.CANYON_HEIGHT + plateauNoise;
        }
      }
    }

    return height;
  }

  generatePathSpine(startState: ChunkState): { points: PathPoint[]; endState: ChunkState } {
    const points: PathPoint[] = [];
    let currentX = startState.endX;
    let currentAngle = startState.endAngle;
    let currentBiome = startState.biome;
    let distanceInBiome = startState.distanceInBiome;

    const segmentLength = CHUNK_LENGTH / CHUNK_SEGMENTS;

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
      const localZ = -i * segmentLength;
      const worldZ = startState.endZ + localZ;

      // Check if we should transition to a new biome
      if (distanceInBiome > TERRAIN_CONFIG.BIOME_TRANSITION_DISTANCE) {
        const biomes = [BiomeType.Glade, BiomeType.Chute, BiomeType.Slalom, BiomeType.Cruiser];
        currentBiome = biomes[Math.floor(Math.random() * biomes.length)];
        distanceInBiome = 0;
      }

      const biomeConfig = TERRAIN_CONFIG.BIOME_DEFAULTS[currentBiome];

      // Generate target angle using noise
      const noiseFreq = biomeConfig.turnSpeed;
      const noiseValue = this.noise2D(0, worldZ * noiseFreq);
      const targetAngle = noiseValue * Math.PI * 0.3; // Max ~54 degrees

      // Smoothly interpolate current angle toward target (momentum)
      currentAngle += (targetAngle - currentAngle) * TERRAIN_CONFIG.ANGLE_INTERPOLATION;

      // Update X position based on angle
      currentX += Math.sin(currentAngle) * segmentLength;

      // Track width
      const width = this.getTrackWidth(worldZ, currentBiome);

      // Calculate banking based on current angle
      const banking = currentAngle * TERRAIN_CONFIG.BANKING_STRENGTH;

      points.push({
        x: currentX,
        z: localZ,
        angle: currentAngle,
        width: width,
        banking: banking,
      });

      distanceInBiome += segmentLength;
    }

    const endState: ChunkState = {
      endX: currentX,
      endAngle: currentAngle,
      endZ: startState.endZ - CHUNK_LENGTH,
      biome: currentBiome,
      distanceInBiome: distanceInBiome,
    };

    return { points, endState };
  }
}
