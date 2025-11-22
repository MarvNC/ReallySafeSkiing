import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PhysicsSystem } from '../core/PhysicsSystem';

export const CHUNK_WIDTH = 100;
export const CHUNK_LENGTH = 100;
export const CHUNK_SEGMENTS = 60;

const SLOPE_ANGLE = 0.2;
const PATH_AMPLITUDE = 40.0;
const PATH_FREQUENCY = 0.005;
const MOGUL_SCALE = 0.2;
const MOGUL_HEIGHT = 2.0;
const TRACK_WIDTH = 17.0;
const WALL_HEIGHT_SCALAR = 2.0;

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

    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));

    this.baseX = new Float32Array(vertexCount);
    this.baseZ = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      this.baseX[i] = position.getX(i);
      this.baseZ[i] = position.getY(i);
      position.setZ(i, this.baseZ[i]);
    }

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
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

  private getPathX(z: number): number {
    return this.noise2D(0, z * PATH_FREQUENCY) * PATH_AMPLITUDE;
  }

  regenerate(centerZ: number): void {
    this.currentZ = centerZ;
    this.mesh.position.set(0, 0, centerZ);
    this.body.setTranslation({ x: 0, y: 0, z: centerZ }, true);

    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const colors = this.geometry.attributes.color as THREE.BufferAttribute;
    const heights = new Float32Array(this.nrows * this.ncols);

    let heightIndex = 0;
    for (let col = 0; col < this.ncols; col++) {
      for (let row = 0; row < this.nrows; row++) {
        const i = row * this.ncols + col;
        const worldX = this.baseX[i];
        const worldZ = this.baseZ[i] + centerZ;

        // Layer A: Base Descent
        const baseHeight = worldZ * Math.tan(SLOPE_ANGLE);

        // Layer B: The Cross-Section (The "Bowl")
        const pathX = this.getPathX(worldZ);
        const dist = worldX - pathX;
        const normalizedDist = Math.abs(dist) / TRACK_WIDTH;
        const wallHeight = Math.pow(normalizedDist, 2.5) * WALL_HEIGHT_SCALAR;

        // Layer C: Surface Detail (Moguls & Roughness)
        const surfaceNoise = this.noise2D(worldX * MOGUL_SCALE, worldZ * MOGUL_SCALE);
        // Masking: Higher in center, lower on steep walls
        const mask = Math.max(0, 1 - Math.pow(normalizedDist / 2, 4));
        const moguls = surfaceNoise * MOGUL_HEIGHT * mask;

        const y = baseHeight + wallHeight + moguls;

        position.setX(i, this.baseX[i]);
        position.setY(i, y);
        position.setZ(i, this.baseZ[i]);

        // Vertex Colors
        const color = new THREE.Color();
        if (normalizedDist < 0.8) {
          color.setHex(0xffffff); // Snow
        } else {
          // Blend to rock
          const t = Math.min(1, (normalizedDist - 0.8) / 2.0);
          color.setHex(0xffffff).lerp(new THREE.Color(0x444444), t);
        }
        colors.setXYZ(i, color.r, color.g, color.b);

        heights[heightIndex++] = y;
      }
    }

    position.needsUpdate = true;
    colors.needsUpdate = true;
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
