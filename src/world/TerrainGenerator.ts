import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

import { MOUNTAIN_CONFIG, TERRAIN_CONFIG, TERRAIN_DIMENSIONS } from '../config/GameConfig';
import type { ChunkState, PathPoint, TerrainSample } from './WorldState';
import { SurfaceKind } from './WorldState';

const { CHUNK_LENGTH, CHUNK_SEGMENTS } = TERRAIN_DIMENSIONS;

/**
 * Pure terrain-generation logic: heightfields, path spine, and noise sampling.
 */
export class TerrainGenerator {
  private readonly noise2D: NoiseFunction2D;

  constructor(noise2D: NoiseFunction2D = createNoise2D()) {
    this.noise2D = noise2D;
  }

  sampleNoise(x: number, y: number): number {
    return this.noise2D(x, y);
  }

  private getTrackWidth(z: number): number {
    const widthNoise = this.noise2D(z * 0.01, 100);
    return (
      TERRAIN_CONFIG.WIDTH_MIN +
      (widthNoise * 0.5 + 0.5) * (TERRAIN_CONFIG.WIDTH_MAX - TERRAIN_CONFIG.WIDTH_MIN)
    );
  }

  getSnowHeightAt(worldX: number, worldZ: number, point: PathPoint): number {
    return this.sampleTerrainAt(worldX, worldZ, point).height;
  }

  sampleTerrainAt(worldX: number, worldZ: number, point: PathPoint): TerrainSample {
    const { t, s } = this.worldToLocalXZ(worldX, worldZ, point);
    return this.sampleTerrainLocal(t, s, point);
  }

  projectToLocalXZ(worldX: number, worldZ: number, point: PathPoint): { t: number; s: number } {
    return this.worldToLocalXZ(worldX, worldZ, point);
  }

  getSnowHeightLocal(t: number, s: number, point: PathPoint): number {
    return this.sampleTerrainLocal(t, s, point).height;
  }

  private sampleTerrainLocal(t: number, s: number, point: PathPoint): TerrainSample {
    const bankingOffset = t * point.banking;
    const moguls =
      this.noise2D(t * TERRAIN_CONFIG.MOGUL_SCALE, s * TERRAIN_CONFIG.MOGUL_SCALE) *
      TERRAIN_CONFIG.MOGUL_HEIGHT;
    const trackWidth = point.width;
    const halfTrack = trackWidth / 2;
    const canyonFloorWidth = halfTrack + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
    const distFromTrackEdge = Math.abs(t) - canyonFloorWidth;
    let extraHeight = 0;
    let kind: SurfaceKind;

    if (distFromTrackEdge <= 0) {
      const onTrack = Math.abs(t) <= halfTrack;
      const onBank = !onTrack && distFromTrackEdge <= 0;
      kind = onTrack ? SurfaceKind.Track : onBank ? SurfaceKind.Bank : SurfaceKind.CanyonFloor;
    } else {
      const progress = Math.min(1.0, distFromTrackEdge / TERRAIN_CONFIG.WALL_WIDTH);

      if (progress < 1.0) {
        const terraceSteps = 6;
        const terraceStepSize = TERRAIN_CONFIG.CANYON_HEIGHT / terraceSteps;
        const quantizedProgress = Math.floor(progress * terraceSteps) / terraceSteps;
        const baseTerraceHeight = quantizedProgress * TERRAIN_CONFIG.CANYON_HEIGHT;

        const wallHeight = progress * TERRAIN_CONFIG.CANYON_HEIGHT;
        const wallSpaceX = s * 0.1;
        const wallSpaceY = wallHeight * 0.15;

        const terraceDisplacement = this.noise2D(wallSpaceX, wallSpaceY) * terraceStepSize * 0.6;
        const detailNoise = this.noise2D(wallSpaceX * 2, wallSpaceY * 2) * 2.0;
        extraHeight = baseTerraceHeight + terraceDisplacement + detailNoise;

        const progressInStep = (progress * terraceSteps) % 1.0;
        const isOnLedge = progressInStep < 0.15 || progressInStep > 0.85;
        kind = isOnLedge ? SurfaceKind.WallLedge : SurfaceKind.WallVertical;
      } else {
        const plateauNoise = this.noise2D(t * 0.05, s * 0.05) * 3.0;
        extraHeight = TERRAIN_CONFIG.CANYON_HEIGHT + plateauNoise;
        kind = SurfaceKind.Plateau;
      }
    }

    const baseHeight = point.y + bankingOffset;
    const height = baseHeight + moguls + extraHeight;
    const isWall = kind === SurfaceKind.WallVertical;

    return {
      height,
      kind,
      isWall,
      localT: t,
      localS: s,
      distFromTrackEdge,
    };
  }

  generatePathSegment(
    startIndex: number,
    segmentCount: number,
    baseAltitude: number,
    slopeTangent: number,
    previousPoints: PathPoint[] = []
  ): PathPoint[] {
    const {
      SEGMENT_LENGTH,
      AMPLITUDE,
      NOISE_SCALE,
      MEANDER1_FREQ,
      MEANDER2_FREQ,
      WIDTH_BASE,
      WIDTH_NOISE_SCALE,
      WIDTH_VARIATION,
      SMOOTHING_WINDOW,
      BANKING_STRENGTH,
    } = TERRAIN_CONFIG;
    const { TOTAL_LENGTH } = MOUNTAIN_CONFIG;

    const segmentLength = SEGMENT_LENGTH;
    const numPoints = segmentCount + 1;
    const rawPoints: Array<{ x: number; y: number; z: number }> = [];
    const startDistance = startIndex * segmentLength;
    const virtualRunSamples = TOTAL_LENGTH / segmentLength;

    for (let i = 0; i < numPoints; i++) {
      const globalIndex = startIndex + i;
      const distanceAlong = startDistance + i * segmentLength;
      const currentZ = -distanceAlong;
      const progress = virtualRunSamples > 0 ? globalIndex / virtualRunSamples : 0;
      const noiseValue = this.noise2D(globalIndex * NOISE_SCALE, 0);
      const lateralNoise = noiseValue * AMPLITUDE;
      const meander1 = Math.sin(progress * Math.PI * 2 * MEANDER1_FREQ) * AMPLITUDE * 0.3;
      const meander2 = Math.sin(progress * Math.PI * 2 * MEANDER2_FREQ + 1) * AMPLITUDE * 0.2;
      const x = lateralNoise + meander1 + meander2;
      const y = baseAltitude - distanceAlong * slopeTangent;

      rawPoints.push({ x, y, z: currentZ });
    }

    const combinedPoints = [
      ...previousPoints.map((point) => ({ x: point.x, y: point.y, z: point.z })),
      ...rawPoints,
    ];
    const smoothedX: number[] = [];

    for (let i = 0; i < combinedPoints.length; i++) {
      const windowStart = Math.max(0, i - Math.floor(SMOOTHING_WINDOW / 2));
      const windowEnd = Math.min(combinedPoints.length, i + Math.ceil(SMOOTHING_WINDOW / 2));
      let sum = 0;
      let count = 0;
      for (let j = windowStart; j < windowEnd; j++) {
        sum += combinedPoints[j].x;
        count++;
      }
      smoothedX.push(count > 0 ? sum / count : combinedPoints[i].x);
    }

    const newPoints: PathPoint[] = [];
    let cumulativeS = previousPoints.length
      ? previousPoints[previousPoints.length - 1].s
      : startDistance;

    for (let i = 0; i < rawPoints.length; i++) {
      const combinedIndex = previousPoints.length + i;
      const x = smoothedX[combinedIndex];
      const y = combinedPoints[combinedIndex].y;
      const z = combinedPoints[combinedIndex].z;

      let directionX = 0;
      let directionZ = -segmentLength;

      if (combinedIndex > 0) {
        directionX = x - smoothedX[combinedIndex - 1];
        directionZ = z - combinedPoints[combinedIndex - 1].z;
      } else if (combinedIndex + 1 < smoothedX.length) {
        directionX = smoothedX[combinedIndex + 1] - x;
        directionZ = combinedPoints[combinedIndex + 1].z - z;
      }

      let stepLength = Math.sqrt(directionX * directionX + directionZ * directionZ);
      if (stepLength === 0) {
        stepLength = segmentLength;
        directionX = 0;
        directionZ = -segmentLength;
      }

      if (combinedIndex > 0) {
        cumulativeS += stepLength;
      }

      const angle = Math.atan2(directionX, -directionZ);
      const forwardX = Math.sin(angle);
      const forwardZ = -Math.cos(angle);
      const rightX = forwardZ;
      const rightZ = -forwardX;

      const widthNoise = this.noise2D(z * WIDTH_NOISE_SCALE, 100);
      const segmentProgress = segmentCount > 0 ? i / segmentCount : 0;
      const widthProgressFactor = 1 + Math.sin(segmentProgress * Math.PI - Math.PI / 2) * 0.2;
      const width =
        WIDTH_BASE * (1 + widthNoise * WIDTH_VARIATION) * Math.max(0.5, widthProgressFactor);
      const banking = angle * BANKING_STRENGTH;

      newPoints.push({
        x,
        y,
        z,
        angle,
        width,
        banking,
        s: cumulativeS,
        forwardX,
        forwardZ,
        rightX,
        rightZ,
      });
    }

    return newPoints;
  }

  // Keep the old method for backward compatibility during transition
  generatePathSpine(startState: ChunkState): { points: PathPoint[]; endState: ChunkState } {
    const points: PathPoint[] = [];
    let currentX = startState.endX;
    let currentAngle = startState.endAngle;

    const segmentLength = CHUNK_LENGTH / CHUNK_SEGMENTS;

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
      const localZ = -i * segmentLength;
      const worldZ = startState.endZ + localZ;

      // Generate target angle using noise
      const noiseFreq = TERRAIN_CONFIG.TURN_SPEED;
      const noiseValue = this.noise2D(0, worldZ * noiseFreq);
      const targetAngle = noiseValue * Math.PI * 0.3; // Max ~54 degrees

      // Smoothly interpolate current angle toward target (momentum)
      currentAngle += (targetAngle - currentAngle) * TERRAIN_CONFIG.ANGLE_INTERPOLATION;

      // Update X position based on angle
      currentX += Math.sin(currentAngle) * segmentLength;

      // Track width
      const width = this.getTrackWidth(worldZ);

      // Calculate banking based on current angle
      const banking = currentAngle * TERRAIN_CONFIG.BANKING_STRENGTH;

      const s = points.length > 0 ? points[points.length - 1].s + segmentLength : 0;
      const forwardX = Math.sin(currentAngle);
      const forwardZ = -Math.cos(currentAngle);
      const rightX = forwardZ;
      const rightZ = -forwardX;

      points.push({
        x: currentX,
        y: 0, // Placeholder - will be calculated by new method
        z: localZ,
        angle: currentAngle,
        width: width,
        banking: banking,
        s,
        forwardX,
        forwardZ,
        rightX,
        rightZ,
      });
    }

    const endState: ChunkState = {
      endX: currentX,
      endAngle: currentAngle,
      endZ: startState.endZ - CHUNK_LENGTH,
    };

    return { points, endState };
  }

  private worldToLocalXZ(
    worldX: number,
    worldZ: number,
    point: PathPoint
  ): { t: number; s: number } {
    const dx = worldX - point.x;
    const dz = worldZ - point.z;
    const t = dx * point.rightX + dz * point.rightZ;
    const sOffset = dx * point.forwardX + dz * point.forwardZ;
    return { t, s: point.s + sOffset };
  }
}
