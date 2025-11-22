import * as THREE from 'three';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { CHUNK_LENGTH, TerrainChunk } from './TerrainChunk';
import { BiomeType } from './WorldState';
import type { ChunkState } from './WorldState';
import { TerrainGenerator } from './TerrainGenerator';

export class TerrainManager {
  private readonly chunks: TerrainChunk[] = [];
  private readonly chunkLength = CHUNK_LENGTH;
  private readonly generator: TerrainGenerator;
  private wireframe = false;
  private lastChunkState: ChunkState;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.generator = new TerrainGenerator();

    // Initialize the starting state
    this.lastChunkState = {
      endX: 0,
      endAngle: 0,
      endZ: 0,
      biome: BiomeType.Glade,
      distanceInBiome: 0,
    };

    for (let i = 0; i < 3; i++) {
      const z = -i * this.chunkLength;
      const chunk = new TerrainChunk(physics, z, this.generator);
      this.lastChunkState = chunk.regenerate(z, this.lastChunkState);
      this.chunks.push(chunk);
      scene.add(chunk.group);
    }
  }

  update(playerPosition: THREE.Vector3): void {
    const leadingChunk = this.chunks[0];
    if (!leadingChunk) return;

    const recycleThreshold = leadingChunk.startZ - this.chunkLength;
    if (playerPosition.z < recycleThreshold) {
      const oldChunk = this.chunks.shift()!;
      const frontChunk = this.chunks[this.chunks.length - 1];
      const targetZ = (frontChunk?.startZ ?? 0) - this.chunkLength;

      this.lastChunkState = oldChunk.regenerate(targetZ, this.lastChunkState);
      oldChunk.setWireframe(this.wireframe);
      this.chunks.push(oldChunk);
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
}
