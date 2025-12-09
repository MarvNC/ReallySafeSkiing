import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

import { MOUNTAIN_CONFIG, TERRAIN_CONFIG } from '../config/GameConfig';
import type { PathPoint, TerrainSample } from './WorldState';
import { SurfaceKind } from './WorldState';

/**
 * Pure terrain-generation logic: heightfields, path spine, and noise sampling.
 */
export class TerrainGenerator {
  private readonly noise2D: NoiseFunction2D;
  private readonly jumpStarts: number[] = [];
  private readonly jumpLengths: number[] = [];
  private readonly jumpHeights: number[] = [];
  private lastJumpLookupIndex = 0;

  constructor(noise2D: NoiseFunction2D = createNoise2D()) {
    this.noise2D = noise2D;
  }

  sampleNoise(x: number, y: number): number {
    return this.noise2D(x, y);
  }

  private hash01(value: number): number {
    const seed = (value * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  private sampleNormal(seedA: number, seedB: number): number {
    const u1 = Math.max(1e-6, this.hash01(seedA));
    const u2 = this.hash01(seedB);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private sampleJumpSpacing(index: number): number {
    const { jumpDistanceMean, jumpDistanceStd, jumpDistanceMax, segmentLength } = TERRAIN_CONFIG;
    const minSpacing = Math.max(segmentLength, 20);
    const normal = this.sampleNormal(index * 2, index * 2 + 1);
    const raw = jumpDistanceMean + normal * jumpDistanceStd;
    const clamped = Math.min(jumpDistanceMax, Math.max(minSpacing, raw));
    return clamped;
  }

  private ensureJumpsCoverS(s: number): void {
    const { jumpDistanceMax, jumpLengthRange, jumpHeightRange } = TERRAIN_CONFIG;

    if (this.jumpStarts.length === 0) {
      const firstStart = this.sampleJumpSpacing(0);
      const firstLength =
        jumpLengthRange.min + this.hash01(1000) * (jumpLengthRange.max - jumpLengthRange.min);
      const firstHeight =
        jumpHeightRange.min + this.hash01(1001) * (jumpHeightRange.max - jumpHeightRange.min);
      this.jumpStarts.push(firstStart);
      this.jumpLengths.push(firstLength);
      this.jumpHeights.push(firstHeight);
    }

    while (this.jumpStarts[this.jumpStarts.length - 1] < s + jumpDistanceMax) {
      const idx = this.jumpStarts.length;
      const prevStart = this.jumpStarts[idx - 1];
      const spacing = this.sampleJumpSpacing(idx);
      const start = prevStart + spacing;

      const length =
        jumpLengthRange.min +
        this.hash01(idx * 10 + 3) * (jumpLengthRange.max - jumpLengthRange.min);
      const height =
        jumpHeightRange.min +
        this.hash01(idx * 10 + 4) * (jumpHeightRange.max - jumpHeightRange.min);

      this.jumpStarts.push(start);
      this.jumpLengths.push(length);
      this.jumpHeights.push(height);
    }
  }

  private getJumpHeightOffset(s: number): {
    offset: number;
    index: number | null;
    start: number;
    length: number;
  } {
    this.ensureJumpsCoverS(s);

    let idx = this.lastJumpLookupIndex;

    // Move forward to the containing/next jump
    while (idx < this.jumpStarts.length - 1 && s >= this.jumpStarts[idx] + this.jumpLengths[idx]) {
      idx++;
    }

    // Move backward if we've gone before the cached index
    while (idx > 0 && s < this.jumpStarts[idx]) {
      idx--;
    }

    this.lastJumpLookupIndex = idx;

    const start = this.jumpStarts[idx];
    const length = this.jumpLengths[idx];
    const height = this.jumpHeights[idx];

    if (s < start || s > start + length) {
      return { offset: 0, index: null, start, length };
    }

    const progress = (s - start) / length;
    const rampPhase = 0.7;

    let offset: number;
    if (progress < rampPhase) {
      const t = progress / rampPhase;
      const eased = t * t * (3 - 2 * t); // smoothstep
      offset = eased * height;
    } else {
      const lipT = (progress - rampPhase) / (1 - rampPhase);
      const lipCurve = 1 - Math.pow(1 - lipT, 3);
      offset = lipCurve * height;
    }

    return { offset, index: idx, start, length };
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
      this.noise2D(t * TERRAIN_CONFIG.mogulScale, s * TERRAIN_CONFIG.mogulScale) *
      TERRAIN_CONFIG.mogulHeight;
    const trackWidth = point.width;
    const halfTrack = trackWidth / 2;
    const canyonFloorWidth = halfTrack + TERRAIN_CONFIG.canyonFloorOffset;
    const distFromTrackEdge = Math.abs(t) - canyonFloorWidth;
    let extraHeight = 0;
    let kind: SurfaceKind;

    if (distFromTrackEdge <= 0) {
      const onTrack = Math.abs(t) <= halfTrack;
      const onBank = !onTrack && distFromTrackEdge <= 0;
      kind = onTrack ? SurfaceKind.Track : onBank ? SurfaceKind.Bank : SurfaceKind.CanyonFloor;
    } else {
      const progress = Math.min(1.0, distFromTrackEdge / TERRAIN_CONFIG.wallWidth);

      if (progress < 1.0) {
        const terraceSteps = 6;
        const terraceStepSize = TERRAIN_CONFIG.canyonHeight / terraceSteps;
        const quantizedProgress = Math.floor(progress * terraceSteps) / terraceSteps;
        const baseTerraceHeight = quantizedProgress * TERRAIN_CONFIG.canyonHeight;

        const wallHeight = progress * TERRAIN_CONFIG.canyonHeight;
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
        extraHeight = TERRAIN_CONFIG.canyonHeight + plateauNoise;
        kind = SurfaceKind.Plateau;
      }
    }

    const baseHeight = point.y + bankingOffset;
    let height = baseHeight + moguls + extraHeight;

    // Limit jumps to a lateral band (configurable fraction of rideable width) with random center per jump
    const jump = this.getJumpHeightOffset(s);
    const jumpHeight = jump.offset;
    if (
      jumpHeight > 0 &&
      jump.index !== null &&
      (kind === SurfaceKind.Track || kind === SurfaceKind.Bank)
    ) {
      const usableHalfWidth = halfTrack + TERRAIN_CONFIG.canyonFloorOffset;
      const usableWidth = usableHalfWidth * 2;
      const rawFraction = TERRAIN_CONFIG.jumpWidthFraction;
      const bandFraction = Math.max(0.05, Math.min(1, rawFraction));
      const bandWidth = usableWidth * bandFraction;
      const halfBand = bandWidth / 2;

      const centerSeed = this.hash01(jump.index * 10 + 5);
      const maxCenterOffset = Math.max(0, usableHalfWidth - halfBand);
      const centerOffset = (centerSeed - 0.5) * 2 * maxCenterOffset;

      const lateralDist = Math.abs(t - centerOffset);
      let lateralFactor = 0;
      if (halfBand > 0 && lateralDist < halfBand) {
        const edgeT = lateralDist / halfBand;
        lateralFactor = 1 - edgeT * edgeT * (3 - 2 * edgeT); // smoothstep falloff to edges
      }

      height += jumpHeight * lateralFactor;
    }
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
      segmentLength,
      amplitude,
      noiseScale,
      meander1Freq,
      meander2Freq,
      widthBase,
      widthNoiseScale,
      widthVariation,
      smoothingWindow,
      bankingStrength,
    } = TERRAIN_CONFIG;
    const { totalLength } = MOUNTAIN_CONFIG;

    const segmentLengthValue = segmentLength;
    const numPoints = segmentCount + 1;
    const rawPoints: Array<{ x: number; y: number; z: number }> = [];
    const startDistance = startIndex * segmentLengthValue;
    const virtualRunSamples = totalLength / segmentLengthValue;

    for (let i = 0; i < numPoints; i++) {
      const globalIndex = startIndex + i;
      const distanceAlong = startDistance + i * segmentLengthValue;
      const currentZ = -distanceAlong;
      const progress = virtualRunSamples > 0 ? globalIndex / virtualRunSamples : 0;
      const noiseValue = this.noise2D(globalIndex * noiseScale, 0);
      const lateralNoise = noiseValue * amplitude;
      const meander1 = Math.sin(progress * Math.PI * 2 * meander1Freq) * amplitude * 0.3;
      const meander2 = Math.sin(progress * Math.PI * 2 * meander2Freq + 1) * amplitude * 0.2;
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
      const windowStart = Math.max(0, i - Math.floor(smoothingWindow / 2));
      const windowEnd = Math.min(combinedPoints.length, i + Math.ceil(smoothingWindow / 2));
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
      let directionZ = -segmentLengthValue;

      if (combinedIndex > 0) {
        directionX = x - smoothedX[combinedIndex - 1];
        directionZ = z - combinedPoints[combinedIndex - 1].z;
      } else if (combinedIndex + 1 < smoothedX.length) {
        directionX = smoothedX[combinedIndex + 1] - x;
        directionZ = combinedPoints[combinedIndex + 1].z - z;
      }

      let stepLength = Math.sqrt(directionX * directionX + directionZ * directionZ);
      if (stepLength === 0) {
        stepLength = segmentLengthValue;
        directionX = 0;
        directionZ = -segmentLengthValue;
      }

      if (combinedIndex > 0) {
        cumulativeS += stepLength;
      }

      const angle = Math.atan2(directionX, -directionZ);
      const forwardX = Math.sin(angle);
      const forwardZ = -Math.cos(angle);
      const rightX = forwardZ;
      const rightZ = -forwardX;

      const widthNoise = this.noise2D(z * widthNoiseScale, 100);
      const segmentProgress = segmentCount > 0 ? i / segmentCount : 0;
      const widthProgressFactor = 1 + Math.sin(segmentProgress * Math.PI - Math.PI / 2) * 0.2;
      const width =
        widthBase * (1 + widthNoise * widthVariation) * Math.max(0.5, widthProgressFactor);
      const banking = angle * bankingStrength;

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
