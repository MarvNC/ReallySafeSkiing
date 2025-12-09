import * as THREE from 'three';

import { DIFFICULTY_SETTINGS, MOUNTAIN_CONFIG, TERRAIN_CONFIG } from '../config/GameConfig';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Difficulty } from '../ui/store';
import { TerrainChunk } from './TerrainChunk';
import { TerrainGenerator } from './TerrainGenerator';
import type { PathPoint } from './WorldState';

export class TerrainManager {
  private readonly chunks: TerrainChunk[] = [];
  private readonly chunkPointCounts: number[] = [];
  private generator: TerrainGenerator;
  private wireframe = false;
  private readonly allPoints: PathPoint[] = [];
  private readonly scene: THREE.Scene;
  private readonly physics?: PhysicsWorld;
  private coinsEnabled = false;
  private startAltitude: number = 0;
  private slopeTangent: number = 0;
  private readonly chunkSegments = TERRAIN_CONFIG.dimensions.chunkSegments;
  private readonly chunkLength =
    TERRAIN_CONFIG.dimensions.chunkSegments * TERRAIN_CONFIG.segmentLength;
  private sampleIndex = 0;
  private obstacleMultiplier = 1;
  private trackObstaclesEnabled = true;
  private readonly chunksAhead = 6;
  private readonly chunksBehind = 2;

  constructor(
    scene: THREE.Scene,
    physics?: PhysicsWorld,
    slopeAngle: number = 20,
    difficulty: Difficulty = 'SPORT',
    modeObstacleMultiplier: number = 1,
    coinsEnabled: boolean = false
  ) {
    this.scene = scene;
    this.physics = physics;
    this.generator = new TerrainGenerator();
    this.regenerate(slopeAngle, difficulty, modeObstacleMultiplier, coinsEnabled);
  }

  regenerate(
    slopeAngle: number,
    difficulty: Difficulty,
    obstacleModeMultiplier: number = 1,
    coinsEnabled: boolean = this.coinsEnabled
  ): void {
    this.disposeChunks();
    this.generator = new TerrainGenerator(); // Create new generator with new noise seed
    this.sampleIndex = 0;
    this.allPoints.length = 0;
    this.chunkPointCounts.length = 0;
    this.coinsEnabled = coinsEnabled;
    this.startAltitude = this.getStartAltitudeFromSlope(slopeAngle);
    this.slopeTangent = Math.tan(THREE.MathUtils.degToRad(Math.max(0, Math.min(70, slopeAngle))));
    const baseObstacleDensity = DIFFICULTY_SETTINGS[difficulty]?.obstacleDensity ?? 1;
    this.obstacleMultiplier = baseObstacleDensity * obstacleModeMultiplier;
    this.trackObstaclesEnabled = difficulty !== 'CHILL';

    const initialChunks = this.chunksAhead + this.chunksBehind + 2;
    for (let i = 0; i < initialChunks; i++) {
      this.appendChunk();
    }

    if (this.wireframe) {
      this.chunks.forEach((chunk) => chunk.setWireframe(true));
    }
  }

  private appendChunk(): void {
    const smoothingTail = this.allPoints.slice(
      Math.max(0, this.allPoints.length - (this.chunkSegments + 1))
    );
    const points = this.generator.generatePathSegment(
      this.sampleIndex,
      this.chunkSegments,
      this.startAltitude,
      this.slopeTangent,
      smoothingTail
    );

    if (points.length < 2) return;

    if (this.allPoints.length > 0) {
      const lastPoint = this.allPoints[this.allPoints.length - 1];
      points[0] = lastPoint;
    }

    const chunk = new TerrainChunk(
      points,
      this.generator,
      this.obstacleMultiplier,
      this.trackObstaclesEnabled,
      this.coinsEnabled,
      this.physics
    );
    if (this.wireframe) {
      chunk.setWireframe(true);
    }
    this.chunks.push(chunk);
    this.chunkPointCounts.push(points.length);
    this.allPoints.push(...points);
    this.scene.add(chunk.group);

    this.sampleIndex += this.chunkSegments;
  }

  private ensureChunksAhead(playerZ: number): void {
    if (this.chunks.length === 0) {
      this.appendChunk();
    }

    let lastChunk = this.chunks[this.chunks.length - 1];
    let lastEndZ = lastChunk.startZ - this.chunkLength;
    let distanceAhead = playerZ - lastEndZ;
    const requiredAhead = this.chunkLength * this.chunksAhead;

    while (distanceAhead < requiredAhead) {
      this.appendChunk();
      lastChunk = this.chunks[this.chunks.length - 1];
      lastEndZ = lastChunk.startZ - this.chunkLength;
      distanceAhead = playerZ - lastEndZ;
    }
  }

  private removeOldChunks(playerZ: number): void {
    const removalDistance = this.chunkLength * this.chunksBehind;
    while (this.chunks.length > this.chunksBehind + 1) {
      const firstChunk = this.chunks[0];
      if (playerZ < firstChunk.startZ - removalDistance) {
        const removedChunk = this.chunks.shift();
        const removedCount = this.chunkPointCounts.shift();
        if (removedChunk) {
          this.scene.remove(removedChunk.group);
          removedChunk.dispose();
        }
        if (removedCount !== undefined) {
          this.allPoints.splice(0, removedCount);
        }
      } else {
        break;
      }
    }
  }

  private getStartAltitudeFromSlope(slopeAngle: number): number {
    const clamped = Math.max(0, Math.min(70, slopeAngle));
    const height = MOUNTAIN_CONFIG.totalLength * Math.tan(THREE.MathUtils.degToRad(clamped));
    return height;
  }

  private disposeChunks(): void {
    this.chunks.forEach((chunk) => {
      this.scene.remove(chunk.group);
      chunk.dispose();
    });
    this.chunks.length = 0;
    this.chunkPointCounts.length = 0;
    this.allPoints.length = 0;
  }

  update(playerPosition?: THREE.Vector3, deltaSeconds: number = 0): void {
    if (!playerPosition) return;

    const playerZ = playerPosition.z;
    this.ensureChunksAhead(playerZ);
    this.removeOldChunks(playerZ);

    if (deltaSeconds > 0) {
      for (const chunk of this.chunks) {
        chunk.update(deltaSeconds);
      }
    }
  }

  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;
    this.chunks.forEach((chunk) => chunk.setWireframe(enabled));
  }

  toggleWireframe(): boolean {
    this.setWireframe(!this.wireframe);
    return this.wireframe;
  }

  handleCoinCollision(handle: number): boolean {
    for (const chunk of this.chunks) {
      if (chunk.tryCollectCoin(handle)) return true;
    }
    return false;
  }

  getClosestPathPoint(worldZ: number): PathPoint | undefined {
    if (this.allPoints.length === 0) {
      return undefined;
    }

    let closestPoint = this.allPoints[0];
    let minDist = Math.abs(this.allPoints[0].z - worldZ);

    for (let i = 1; i < this.allPoints.length; i++) {
      const point = this.allPoints[i];
      const dist = Math.abs(point.z - worldZ);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = point;
      }
    }

    return closestPoint;
  }

  getStartPoint(): THREE.Vector3 {
    if (this.allPoints.length > 0) {
      const firstPoint = this.allPoints[0];
      return new THREE.Vector3(firstPoint.x, firstPoint.y, firstPoint.z);
    }
    // Fallback
    return new THREE.Vector3(0, this.startAltitude, 0);
  }

  /**
   * Get a point at a specific offset along the path.
   * @param offset Number of points to advance along the path (default: 0 for start point)
   */
  getPointAtOffset(offset: number = 0): THREE.Vector3 {
    if (this.allPoints.length === 0) {
      return new THREE.Vector3(0, this.startAltitude, 0);
    }
    const index = Math.min(Math.max(0, offset), this.allPoints.length - 1);
    const point = this.allPoints[index];
    return new THREE.Vector3(point.x, point.y, point.z);
  }

  /**
   * Get the terrain height at a specific world position.
   * This accounts for moguls, banking, and canyon walls.
   */
  getTerrainHeight(worldX: number, worldZ: number): number {
    const closestPoint = this.getClosestPathPoint(worldZ);
    if (!closestPoint) {
      return this.startAltitude;
    }

    return this.generator.getSnowHeightAt(worldX, worldZ, closestPoint);
  }

  /**
   * Approximate the surface normal at a world position by sampling nearby heights.
   */
  getSurfaceNormal(
    worldX: number,
    worldZ: number,
    target: THREE.Vector3 = new THREE.Vector3(),
    sampleDistance: number = 0.75
  ): THREE.Vector3 {
    const closestPoint = this.getClosestPathPoint(worldZ);
    if (!closestPoint) {
      return target.set(0, 1, 0);
    }

    const delta = Math.max(0.1, sampleDistance);
    const hL = this.generator.getSnowHeightAt(worldX - delta, worldZ, closestPoint);
    const hR = this.generator.getSnowHeightAt(worldX + delta, worldZ, closestPoint);
    const hB = this.generator.getSnowHeightAt(worldX, worldZ - delta, closestPoint);
    const hF = this.generator.getSnowHeightAt(worldX, worldZ + delta, closestPoint);

    const dHdX = (hR - hL) / (2 * delta);
    const dHdZ = (hF - hB) / (2 * delta);

    if (!Number.isFinite(dHdX) || !Number.isFinite(dHdZ)) {
      return target.set(0, 1, 0);
    }

    return target.set(-dHdX, 1, -dHdZ).normalize();
  }
}
