import * as THREE from 'three';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { CHUNK_LENGTH, TerrainChunk } from './TerrainChunk';

export class TerrainManager {
  private readonly chunks: TerrainChunk[] = [];
  private readonly chunkLength = CHUNK_LENGTH;
  private readonly noise2D: NoiseFunction2D;
  private wireframe = false;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.noise2D = createNoise2D();

    for (let i = 0; i < 3; i++) {
      const z = -i * this.chunkLength;
      const chunk = new TerrainChunk(physics, z, this.noise2D);
      this.chunks.push(chunk);
      scene.add(chunk.mesh);
    }
  }

  update(playerPosition: THREE.Vector3): void {
    const leadingChunk = this.chunks[0];
    if (!leadingChunk) return;

    const recycleThreshold = leadingChunk.centerZ - this.chunkLength;
    if (playerPosition.z < recycleThreshold) {
      const oldChunk = this.chunks.shift()!;
      const frontChunk = this.chunks[this.chunks.length - 1];
      const targetZ = (frontChunk?.centerZ ?? 0) - this.chunkLength;

      oldChunk.regenerate(targetZ);
      oldChunk.setWireframe(this.wireframe);
      this.chunks.push(oldChunk);
    }
  }

  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;
    this.chunks.forEach(chunk => chunk.setWireframe(enabled));
  }

  toggleWireframe(): boolean {
    this.setWireframe(!this.wireframe);
    return this.wireframe;
  }
}
