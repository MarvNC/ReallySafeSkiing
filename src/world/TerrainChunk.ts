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
    [BiomeType.Glade]: { turnSpeed: 0.02, widthMin: 25, widthMax: 40 },
    [BiomeType.Chute]: { turnSpeed: 0.05, widthMin: 10, widthMax: 15 },
    [BiomeType.Slalom]: { turnSpeed: 0.08, widthMin: 15, widthMax: 25 },
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
  // Visuals
  readonly group: THREE.Group;
  private snowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private snowMaterial: THREE.MeshStandardMaterial;

  // Geometry
  private snowGeometry: THREE.PlaneGeometry;

  readonly width = CHUNK_WIDTH;
  readonly length = CHUNK_LENGTH;

  private readonly noise2D: NoiseFunction2D;
  private readonly world: RAPIER.World;
  private readonly rapier: typeof RAPIER;
  private readonly body: RAPIER.RigidBody;
  private collider?: RAPIER.Collider;

  // Physics heightfield data
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

    // Initialize Group
    this.group = new THREE.Group();

    // Initialize Materials
    this.snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    // Initialize Geometries
    this.snowGeometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, 30, CHUNK_SEGMENTS);

    // Initialize Meshes
    this.snowMesh = new THREE.Mesh(this.snowGeometry, this.snowMaterial);

    // Prevent the renderer from hiding the mesh because it thinks it's off-screen
    this.snowMesh.frustumCulled = false;

    this.snowMesh.receiveShadow = true;

    this.group.add(this.snowMesh);

    // Physics setup (Heightfield resolution matches CHUNK_SEGMENTS)
    this.nrows = CHUNK_SEGMENTS + 1;
    this.ncols = CHUNK_SEGMENTS + 1;

    const physicsGeo = new THREE.PlaneGeometry(
      CHUNK_WIDTH,
      CHUNK_LENGTH,
      CHUNK_SEGMENTS,
      CHUNK_SEGMENTS
    );
    const position = physicsGeo.attributes.position as THREE.BufferAttribute;
    const vertexCount = position.count;

    this.baseX = new Float32Array(vertexCount);
    this.baseZ = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      this.baseX[i] = position.getX(i);
      this.baseZ[i] = position.getY(i);
    }
    physicsGeo.dispose();

    this.body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(0, 0, baseZ)
    );

    const initialState: ChunkState = {
      endX: 0,
      endAngle: 0,
      endZ: baseZ,
      biome: BiomeType.Glade,
      distanceInBiome: 0,
    };
    this.regenerate(baseZ, initialState);
  }

  get startZ(): number {
    return this.currentZ;
  }

  // Helper Methods

  private getTrackWidth(z: number, biome: BiomeType): number {
    const widthNoise = this.noise2D(z * 0.01, 100);
    const config = TERRAIN_CONFIG.BIOME_DEFAULTS[biome];
    return config.widthMin + (widthNoise * 0.5 + 0.5) * (config.widthMax - config.widthMin);
  }

  private getSnowHeight(localX: number, worldZ: number, banking: number): number {
    const baseSlope = worldZ * Math.tan(TERRAIN_CONFIG.SLOPE_ANGLE);
    const bankingOffset = localX * banking;
    const moguls = this.noise2D(localX * 0.2, worldZ * 0.2) * 1.5;
    return baseSlope + bankingOffset + moguls;
  }

  private generatePathSpine(startState: ChunkState): { points: PathPoint[]; endState: ChunkState } {
    const points: PathPoint[] = [];
    let currentX = startState.endX;
    let currentAngle = startState.endAngle;
    let currentBiome = startState.biome;
    let distanceInBiome = startState.distanceInBiome;

    const segmentLength = CHUNK_LENGTH / CHUNK_SEGMENTS;

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
      const localZ = -i * segmentLength;
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

      // Track width
      const width = this.getTrackWidth(worldZ, currentBiome);

      // Calculate banking based on current angle
      const banking = currentAngle * TERRAIN_CONFIG.BANKING_STRENGTH;

      points.push({
        x: currentX,
        z: localZ,
        angle: currentAngle,
        width: width,
        banking: banking,
      });

      distanceInBiome += segmentLength;
    }

    const endState: ChunkState = {
      endX: currentX,
      endAngle: currentAngle,
      endZ: startState.endZ - CHUNK_LENGTH,
      biome: currentBiome,
      distanceInBiome: distanceInBiome,
    };

    return { points, endState };
  }

  regenerate(startZ: number, startState: ChunkState): ChunkState {
    this.currentZ = startZ;
    this.group.position.set(0, 0, startZ);
    this.body.setTranslation({ x: 0, y: 0, z: startZ }, true);

    // Generate the path spine first
    const { points, endState } = this.generatePathSpine(startState);

    // --- 1. Update Snow Geometry ---
    const snowPos = this.snowGeometry.attributes.position as THREE.BufferAttribute;
    const snowRows = this.snowGeometry.parameters.heightSegments + 1;
    const snowCols = this.snowGeometry.parameters.widthSegments + 1;

    for (let row = 0; row < snowRows; row++) {
      const zFraction = row / (snowRows - 1);
      const pathIndex = Math.floor(zFraction * CHUNK_SEGMENTS);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];
      const worldZ = startState.endZ + pathPoint.z; // Approximate

      for (let col = 0; col < snowCols; col++) {
        const i = row * snowCols + col;

        // U coordinate (0 to 1)
        const u = col / (snowCols - 1);

        // Calculate width at this point
        const trackWidth = pathPoint.width;

        // Map U to [-trackWidth/2, +trackWidth/2]
        const localX = (u - 0.5) * trackWidth;
        const worldX = localX + pathPoint.x; // Add spine offset

        const y = this.getSnowHeight(localX, worldZ, pathPoint.banking);
        const vertexZ = pathPoint.z;

        snowPos.setXYZ(i, worldX, y, vertexZ);
      }
    }
    snowPos.needsUpdate = true;
    this.snowGeometry.computeVertexNormals();

    // --- 2. Update Physics Collider (Heightfield) ---
    const heights = new Float32Array(this.nrows * this.ncols);
    let heightIndex = 0;

    for (let col = 0; col < this.ncols; col++) {
      for (let row = this.nrows - 1; row >= 0; row--) {
        const zFraction = (this.nrows - 1 - row) / (this.nrows - 1);
        const pathIndex = Math.floor(zFraction * CHUNK_SEGMENTS);
        const pathPoint = points[Math.min(pathIndex, points.length - 1)];
        const worldZ = startState.endZ + pathPoint.z;

        const xFraction = col / (this.ncols - 1);
        const localGridX = (xFraction - 0.5) * CHUNK_WIDTH;
        const effectiveLocalX = localGridX - pathPoint.x;
        const halfWidth = pathPoint.width / 2;

        let y: number;

        if (Math.abs(effectiveLocalX) <= halfWidth) {
          y = this.getSnowHeight(effectiveLocalX, worldZ, pathPoint.banking);
        } else {
          const seamX = effectiveLocalX > 0 ? halfWidth : -halfWidth;
          y = this.getSnowHeight(seamX, worldZ, pathPoint.banking);
        }

        heights[heightIndex++] = y;
      }
    }

    this.rebuildCollider(heights);

    return endState;
  }

  setWireframe(enabled: boolean): void {
    this.snowMaterial.wireframe = enabled;
    this.snowMaterial.needsUpdate = true;
  }

  dispose(): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }
    this.world.removeRigidBody(this.body);
    this.snowGeometry.dispose();
    this.snowMaterial.dispose();
  }

  private rebuildCollider(heights: Float32Array): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }

    try {
      const colliderDesc = this.rapier.ColliderDesc.heightfield(this.nrows, this.ncols, heights, {
        x: CHUNK_WIDTH,
        y: 1,
        z: CHUNK_LENGTH,
      })
        .setFriction(0.05)
        .setRestitution(0)
        .setRotation({ x: 0, y: 1, z: 0, w: 0 })
        .setTranslation(0, 0, -CHUNK_LENGTH);

      this.collider = this.world.createCollider(colliderDesc, this.body);
    } catch (error) {
      console.error('Failed to rebuild terrain collider', error);
    }
  }
}
