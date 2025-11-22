import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PhysicsSystem } from '../core/PhysicsSystem';

export const CHUNK_WIDTH = 100;
export const CHUNK_LENGTH = 100;
export const CHUNK_SEGMENTS = 20;

const SLOPE_ANGLE = 0.2;
const BANK_STEEPNESS = 0.02;
const NOISE_SCALE = 2.0;

export class TerrainChunk {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  readonly width = CHUNK_WIDTH;
  readonly length = CHUNK_LENGTH;

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly noise2D: NoiseFunction2D;
  private readonly world: RAPIER.World;
  private readonly rapier: typeof RAPIER;
  private readonly body: RAPIER.RigidBody;
  private collider?: RAPIER.Collider;

  private readonly baseX: Float32Array;
  private readonly baseZ: Float32Array;
  private readonly nrows: number;
  private readonly ncols: number;
  private currentZ: number;

  constructor(physics: PhysicsSystem, baseZ = 0, noise2D: NoiseFunction2D = createNoise2D()) {
    this.rapier = physics.getRapier();
    this.world = physics.getWorld();
    this.noise2D = noise2D;
    this.currentZ = baseZ;

    this.nrows = CHUNK_SEGMENTS + 1;
    this.ncols = CHUNK_SEGMENTS + 1;

    this.geometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    position.setUsage(THREE.DynamicDrawUsage);
    const vertexCount = position.count;

    this.baseX = new Float32Array(vertexCount);
    this.baseZ = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      this.baseX[i] = position.getX(i);
      this.baseZ[i] = position.getY(i);
      position.setZ(i, this.baseZ[i]);
    }

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.6,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;

    this.body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(0, 0, baseZ),
    );

    this.regenerate(baseZ);
  }

  get centerZ(): number {
    return this.currentZ;
  }

  regenerate(centerZ: number): void {
    this.currentZ = centerZ;
    this.mesh.position.set(0, 0, centerZ);
    this.body.setTranslation({ x: 0, y: 0, z: centerZ }, true);

    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const heights = new Float32Array(this.nrows * this.ncols);

    let heightIndex = 0;
    for (let col = 0; col < this.ncols; col++) {
      for (let row = 0; row < this.nrows; row++) {
        const i = row * this.ncols + col;
        const worldX = this.baseX[i];
        const worldZ = this.baseZ[i] + centerZ;

        let y = worldZ * Math.tan(SLOPE_ANGLE);
        y += (worldX * worldX) * BANK_STEEPNESS;
        y += this.noise2D(worldX * 0.1, worldZ * 0.1) * NOISE_SCALE;

        position.setX(i, this.baseX[i]);
        position.setY(i, y);
        position.setZ(i, this.baseZ[i]);

        heights[heightIndex++] = y;
      }
    }

    position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();

    this.rebuildCollider(heights);
  }

  setWireframe(enabled: boolean): void {
    this.mesh.material.wireframe = enabled;
    this.mesh.material.needsUpdate = true;
  }

  dispose(): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }
    this.world.removeRigidBody(this.body);
    this.geometry.dispose();
    this.material.dispose();
  }

  private rebuildCollider(heights: Float32Array): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }

    try {
      const colliderDesc = this.rapier.ColliderDesc.heightfield(
        this.nrows,
        this.ncols,
        heights,
        { x: CHUNK_WIDTH, y: 1, z: CHUNK_LENGTH },
      )
        .setFriction(0.05)
        .setRestitution(0);

      this.collider = this.world.createCollider(colliderDesc, this.body);
    } catch (error) {
      console.error('Failed to rebuild terrain collider', error);
    }
  }
}
