import * as THREE from 'three';
import { PhysicsSystem } from '../core/PhysicsSystem';
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

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.generator = new TerrainGenerator();

    // Generate the entire mountain path once
    this.allPoints = this.generator.generatePathSegment(0, MOUNTAIN_CONFIG.TOTAL_LENGTH);

    // Create chunks by slicing the allPoints array
    const { CHUNK_SEGMENTS } = TERRAIN_DIMENSIONS;
    for (let i = 0; i < this.allPoints.length; i += CHUNK_SEGMENTS) {
      const chunkPoints = this.allPoints.slice(i, i + CHUNK_SEGMENTS + 1);
      if (chunkPoints.length < 2) break; // Need at least 2 points for a chunk

      const chunk = new TerrainChunk(physics, chunkPoints);
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
}
