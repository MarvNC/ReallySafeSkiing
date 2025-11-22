import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { BiomeType } from './WorldState';
import type { ChunkState, PathPoint } from './WorldState';
import { TERRAIN_CONFIG, TERRAIN_DIMENSIONS, MOUNTAIN_CONFIG } from '../config/GameConfig';

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

  getSnowHeight(
    localX: number,
    worldZ: number,
    pathY: number,
    banking: number,
    trackWidth?: number
  ): number {
    const bankingOffset = localX * banking;
    const moguls =
      this.noise2D(localX * TERRAIN_CONFIG.MOGUL_SCALE, worldZ * TERRAIN_CONFIG.MOGUL_SCALE) *
      TERRAIN_CONFIG.MOGUL_HEIGHT;
    let height = pathY + bankingOffset + moguls;

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

  /**
   * Generate a stateless path segment for finite or infinite generation.
   * Uses the "Offset Algorithm" for X calculation and linear interpolation for Y.
   * Applies moving average smoothing to ensure seamless transitions between segments.
   */
  generatePathSegment(
    startZ: number,
    length: number,
    previousPoints: PathPoint[] = []
  ): PathPoint[] {
    const {
      SEGMENT_LENGTH,
      WINDINESS,
      NOISE_SCALE,
      MEANDER_AMP,
      MEANDER_FREQ,
      WIDTH_VARIATION,
      SMOOTHING_WINDOW,
      BANKING_STRENGTH,
    } = TERRAIN_CONFIG;
    const { TOTAL_LENGTH, START_ALTITUDE, END_ALTITUDE } = MOUNTAIN_CONFIG;

    // Calculate how many points to generate
    const numPoints = Math.ceil(length / SEGMENT_LENGTH) + 1;
    const rawPoints: Array<{ x: number; y: number; z: number }> = [];

    // Raw Generation Loop
    for (let i = 0; i < numPoints; i++) {
      const currentZ = startZ - i * SEGMENT_LENGTH;

      // X Calculation using Offset Algorithm
      const noiseValue = this.noise2D(0, currentZ * NOISE_SCALE);
      const meanderValue = Math.sin(currentZ * MEANDER_FREQ);
      const x = noiseValue * WINDINESS + meanderValue * MEANDER_AMP;

      // Y Calculation - linear interpolation for finite mode
      const progress = Math.max(0, Math.min(1, (startZ - currentZ) / TOTAL_LENGTH));
      const y = START_ALTITUDE + (END_ALTITUDE - START_ALTITUDE) * progress;

      rawPoints.push({ x, y, z: currentZ });
    }

    // Seam Smoothing - combine with previous points and apply moving average
    const combinedPoints = [...previousPoints, ...rawPoints];
    const smoothedX: number[] = [];

    // Apply moving average to X coordinates
    for (let i = 0; i < combinedPoints.length; i++) {
      const windowStart = Math.max(0, i - Math.floor(SMOOTHING_WINDOW / 2));
      const windowEnd = Math.min(combinedPoints.length, i + Math.ceil(SMOOTHING_WINDOW / 2));
      let sum = 0;
      let count = 0;

      for (let j = windowStart; j < windowEnd; j++) {
        sum += combinedPoints[j].x;
        count++;
      }

      smoothedX.push(sum / count);
    }

    // Slice to get only the new smoothed points
    const newSmoothedPoints = combinedPoints.slice(previousPoints.length);
    const smoothedXValues = smoothedX.slice(previousPoints.length);

    // Post-Processing - calculate derived data
    const finalPoints: PathPoint[] = [];

    for (let i = 0; i < newSmoothedPoints.length; i++) {
      const point = newSmoothedPoints[i];
      const smoothedX = smoothedXValues[i];
      const nextPoint = i < newSmoothedPoints.length - 1 ? newSmoothedPoints[i + 1] : null;

      // Width calculation
      const widthNoise = this.noise2D(0, point.z * 0.01);
      const widthSin = Math.sin(point.z * MEANDER_FREQ);
      const baseWidth = 30; // Default base width
      const width = baseWidth * (1 + widthNoise * WIDTH_VARIATION) * (1 + widthSin * 0.3);

      // Angle calculation
      let angle = 0;
      if (nextPoint) {
        const deltaX = nextPoint.x - smoothedX;
        const deltaZ = nextPoint.z - point.z;
        angle = Math.atan2(deltaX, -deltaZ); // Negative deltaZ because we're going down
      }

      // Banking calculation
      const banking = angle * BANKING_STRENGTH;

      finalPoints.push({
        x: smoothedX,
        y: point.y,
        z: point.z,
        angle,
        width,
        banking,
      });
    }

    return finalPoints;
  }

  // Keep the old method for backward compatibility during transition
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
        y: 0, // Placeholder - will be calculated by new method
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
