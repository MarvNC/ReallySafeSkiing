import * as THREE from 'three';
import { TerrainChunk } from './TerrainChunk';
import type { PathPoint } from './WorldState';
import { TerrainGenerator } from './TerrainGenerator';
import { TERRAIN_DIMENSIONS, MOUNTAIN_CONFIG } from '../config/GameConfig';

export class TerrainManager {
  private readonly chunks: TerrainChunk[] = [];
  private readonly generator: TerrainGenerator;
  private wireframe = false;
  private readonly allPoints: PathPoint[] = [];
  private finishLine?: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.generator = new TerrainGenerator();

    // Generate the entire mountain path once
    this.allPoints = this.generator.generatePathSegment(0, MOUNTAIN_CONFIG.TOTAL_LENGTH);

    // Create chunks by slicing the allPoints array
    const { CHUNK_SEGMENTS } = TERRAIN_DIMENSIONS;
    for (let i = 0; i < this.allPoints.length; i += CHUNK_SEGMENTS) {
      const chunkPoints = this.allPoints.slice(i, i + CHUNK_SEGMENTS + 1);
      if (chunkPoints.length < 2) break; // Need at least 2 points for a chunk

      const chunk = new TerrainChunk(chunkPoints, this.generator);
      this.chunks.push(chunk);
      scene.add(chunk.group);
    }

    // Create finish line at the last point
    if (this.allPoints.length > 0) {
      const lastPoint = this.allPoints[this.allPoints.length - 1];
      this.createFinishLine(scene, lastPoint);
    }
  }

  private createFinishLine(scene: THREE.Scene, point: PathPoint): void {
    // Create a red arch/box as finish line
    const finishGeometry = new THREE.BoxGeometry(point.width * 1.5, 20, 2);
    const finishMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.finishLine = new THREE.Mesh(finishGeometry, finishMaterial);
    this.finishLine.position.set(point.x, point.y + 10, point.z);
    this.finishLine.castShadow = true;
    this.finishLine.receiveShadow = true;
    scene.add(this.finishLine);
  }

  update(): void {
    // Disabled - no infinite recycling in finite mode
  }

  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;
    this.chunks.forEach((chunk) => chunk.setWireframe(enabled));
  }

  toggleWireframe(): boolean {
    this.setWireframe(!this.wireframe);
    return this.wireframe;
  }

  getStartPoint(): THREE.Vector3 {
    if (this.allPoints.length > 0) {
      const firstPoint = this.allPoints[0];
      return new THREE.Vector3(firstPoint.x, firstPoint.y, firstPoint.z);
    }
    // Fallback
    return new THREE.Vector3(0, MOUNTAIN_CONFIG.START_ALTITUDE, 0);
  }

  /**
   * Get a point at a specific offset along the path.
   * @param offset Number of points to advance along the path (default: 0 for start point)
   */
  getPointAtOffset(offset: number = 0): THREE.Vector3 {
    if (this.allPoints.length === 0) {
      return new THREE.Vector3(0, MOUNTAIN_CONFIG.START_ALTITUDE, 0);
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
    if (this.allPoints.length === 0) {
      return MOUNTAIN_CONFIG.START_ALTITUDE;
    }

    // Find the closest path point by Z coordinate
    let closestPoint = this.allPoints[0];
    let minDist = Math.abs(this.allPoints[0].z - worldZ);

    for (const point of this.allPoints) {
      const dist = Math.abs(point.z - worldZ);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = point;
      }
    }

    return this.generator.getSnowHeightAt(worldX, worldZ, closestPoint);
  }
}
