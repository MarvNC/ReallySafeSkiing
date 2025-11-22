import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { BiomeType } from './WorldState';
import type { ChunkState, PathPoint } from './WorldState';

export const CHUNK_WIDTH = 100;
export const CHUNK_LENGTH = 100;
export const CHUNK_SEGMENTS = 60;

const TERRAIN_CONFIG = {
  SLOPE_ANGLE: 0.5,
  BIOME_DEFAULTS: {
    [BiomeType.Glade]:   { turnSpeed: 0.02, widthMin: 25, widthMax: 40 },
    [BiomeType.Chute]:   { turnSpeed: 0.05, widthMin: 10, widthMax: 15 },
    [BiomeType.Slalom]:  { turnSpeed: 0.08, widthMin: 15, widthMax: 25 },
    [BiomeType.Cruiser]: { turnSpeed: 0.01, widthMin: 30, widthMax: 50 },
  },
  BANKING_STRENGTH: 0.8,
  WALL_STEEPNESS: 3.0,
  MOGUL_SCALE: 0.2,
  MOGUL_HEIGHT: 2.0,
  BIOME_TRANSITION_DISTANCE: 2000,
  ANGLE_INTERPOLATION: 0.15, // How quickly the path follows the target angle
};

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
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    this.body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(0, 0, baseZ),
    );

    // Initialize with default state for the first chunk
    const initialState: ChunkState = {
      endX: 0,
      endAngle: 0,
      endZ: baseZ,
      biome: BiomeType.Glade,
      distanceInBiome: 0
    };
    this.regenerate(baseZ, initialState);
  }

  get centerZ(): number {
    return this.currentZ;
  }

  private generatePathSpine(startState: ChunkState): { points: PathPoint[], endState: ChunkState } {
    const points: PathPoint[] = [];
    let currentX = startState.endX;
    let currentAngle = startState.endAngle;
    let currentBiome = startState.biome;
    let distanceInBiome = startState.distanceInBiome;

    const segmentLength = CHUNK_LENGTH / CHUNK_SEGMENTS;

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
      const localZ = i * segmentLength;
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

      // Generate width using separate noise channel
      const widthNoise = this.noise2D(100, worldZ * 0.01);
      const width = biomeConfig.widthMin +
                    (widthNoise * 0.5 + 0.5) * (biomeConfig.widthMax - biomeConfig.widthMin);

      // Calculate banking based on current angle
      const banking = currentAngle * TERRAIN_CONFIG.BANKING_STRENGTH;

      points.push({
        x: currentX,
        z: localZ,
        angle: currentAngle,
        width: width,
        banking: banking
      });

      distanceInBiome += segmentLength;
    }

    const endState: ChunkState = {
      endX: currentX,
      endAngle: currentAngle,
      endZ: startState.endZ + CHUNK_LENGTH,
      biome: currentBiome,
      distanceInBiome: distanceInBiome
    };

    return { points, endState };
  }

  regenerate(centerZ: number, startState: ChunkState): ChunkState {
    this.currentZ = centerZ;
    this.mesh.position.set(0, 0, centerZ);
    this.body.setTranslation({ x: 0, y: 0, z: centerZ }, true);

    // Generate the path spine first
    const { points, endState } = this.generatePathSpine(startState);

    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const colors = this.geometry.attributes.color as THREE.BufferAttribute;
    const heights = new Float32Array(this.nrows * this.ncols);

    let heightIndex = 0;
    for (let col = 0; col < this.ncols; col++) {
      for (let row = 0; row < this.nrows; row++) {
        const i = row * this.ncols + col;
        const worldX = this.baseX[i];
        const localZ = this.baseZ[i];
        const worldZ = localZ + centerZ;

        // Find the corresponding path point for this row
        const pointIndex = Math.min(Math.floor((localZ + CHUNK_LENGTH / 2) / CHUNK_LENGTH * CHUNK_SEGMENTS), CHUNK_SEGMENTS);
        const pathPoint = points[pointIndex];

        // Layer A: Base Descent
        const baseHeight = worldZ * Math.tan(TERRAIN_CONFIG.SLOPE_ANGLE);

        // Layer B: Banking (tilt on turns)
        const distFromPath = worldX - pathPoint.x;
        const bankingOffset = distFromPath * pathPoint.banking;

        // Layer C: Canyon Walls
        const normalizedDist = Math.abs(distFromPath) / pathPoint.width;
        let wallHeight = 0;
        if (normalizedDist > 1.0) {
          // Outside the track - create steep walls
          wallHeight = Math.pow(normalizedDist - 1, TERRAIN_CONFIG.WALL_STEEPNESS) * 20;
        }

        // Layer D: Surface Detail (Moguls & Roughness)
        const surfaceNoise = this.noise2D(worldX * TERRAIN_CONFIG.MOGUL_SCALE, worldZ * TERRAIN_CONFIG.MOGUL_SCALE);
        let surfaceDetail = 0;
        if (normalizedDist < 1.0) {
          // Smooth moguls on the track
          const mask = Math.max(0, 1 - Math.pow(normalizedDist, 4));
          surfaceDetail = surfaceNoise * TERRAIN_CONFIG.MOGUL_HEIGHT * mask;
        } else {
          // Rocky texture on walls
          surfaceDetail = surfaceNoise * 0.5;
        }

        const y = baseHeight + bankingOffset + wallHeight + surfaceDetail;

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

    return endState;
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
