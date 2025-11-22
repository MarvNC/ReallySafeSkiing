import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { BiomeType } from './WorldState';
import type { ChunkState, PathPoint } from './WorldState';
import { getTreeGeometry, getRockGeometry } from './AssetFactory';

export const CHUNK_WIDTH = 150;
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
  CANYON_FLOOR_OFFSET: 20, // Additional width beyond track for canyon floor
  CANYON_HEIGHT: 40, // The max height of the cliff
  WALL_WIDTH: 15, // How wide the slope is horizontally
  CLIFF_NOISE_SCALE: 0.5, // Higher frequency noise for rocks
  OBSTACLE_COUNT: 200, // Number of obstacles per chunk
};

export class TerrainChunk {
  // Visuals
  readonly group: THREE.Group;
  private snowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private snowMaterial: THREE.MeshStandardMaterial;

  // Geometry
  private snowGeometry: THREE.PlaneGeometry;

  // Obstacles
  private treeMesh: THREE.InstancedMesh;
  private rockMesh: THREE.InstancedMesh;
  private treeGeometry: THREE.BufferGeometry;
  private rockGeometry: THREE.BufferGeometry;
  private treeMaterial: THREE.MeshStandardMaterial;
  private rockMaterial: THREE.MeshStandardMaterial;

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

  // Obstacle physics bodies
  private obstacleBodies: RAPIER.RigidBody[] = [];

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
      vertexColors: true,
    });

    // Initialize Geometries (higher width resolution for better cliff quality)
    this.snowGeometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, 40, CHUNK_SEGMENTS);

    // Initialize Meshes
    this.snowMesh = new THREE.Mesh(this.snowGeometry, this.snowMaterial);

    // Prevent the renderer from hiding the mesh because it thinks it's off-screen
    this.snowMesh.frustumCulled = false;

    this.snowMesh.receiveShadow = true;

    this.group.add(this.snowMesh);

    // Initialize obstacle geometries and materials
    this.treeGeometry = getTreeGeometry();
    this.rockGeometry = getRockGeometry();

    this.treeMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5016,
      roughness: 0.8,
      flatShading: true,
    });

    this.rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.9,
      flatShading: true,
    });

    // Initialize InstancedMeshes
    this.treeMesh = new THREE.InstancedMesh(
      this.treeGeometry,
      this.treeMaterial,
      TERRAIN_CONFIG.OBSTACLE_COUNT
    );
    this.treeMesh.castShadow = true;
    this.treeMesh.receiveShadow = true;

    this.rockMesh = new THREE.InstancedMesh(
      this.rockGeometry,
      this.rockMaterial,
      TERRAIN_CONFIG.OBSTACLE_COUNT
    );
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;

    this.group.add(this.treeMesh);
    this.group.add(this.rockMesh);

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

  private getSnowHeight(
    localX: number,
    worldZ: number,
    banking: number,
    trackWidth?: number
  ): number {
    const baseSlope = worldZ * Math.tan(TERRAIN_CONFIG.SLOPE_ANGLE);
    const bankingOffset = localX * banking;
    const moguls = this.noise2D(localX * 0.2, worldZ * 0.2) * 1.5;
    let height = baseSlope + bankingOffset + moguls;

    // Add canyon walls if trackWidth is provided
    if (trackWidth !== undefined) {
      const canyonFloorWidth = trackWidth / 2 + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
      const distFromTrackEdge = Math.abs(localX) - canyonFloorWidth;

      if (distFromTrackEdge > 0) {
        // Calculate progress up the cliff (0.0 = bottom, 1.0 = top)
        const progress = Math.min(1.0, distFromTrackEdge / TERRAIN_CONFIG.WALL_WIDTH);

        // Base cliff height (linear ramp)
        const cliffHeight = progress * TERRAIN_CONFIG.CANYON_HEIGHT;

        // Add jagged noise to cliff face
        if (progress < 1.0) {
          // Cliff face - heavy, jagged noise
          const cliffNoise =
            this.noise2D(
              localX * TERRAIN_CONFIG.CLIFF_NOISE_SCALE,
              worldZ * TERRAIN_CONFIG.CLIFF_NOISE_SCALE
            ) * 8.0;
          const cliffNoise2 =
            this.noise2D(
              localX * TERRAIN_CONFIG.CLIFF_NOISE_SCALE * 2,
              worldZ * TERRAIN_CONFIG.CLIFF_NOISE_SCALE * 2
            ) * 4.0;
          height += cliffHeight + cliffNoise + cliffNoise2;
        } else {
          // Plateau - gentle rolling noise
          const plateauNoise = this.noise2D(localX * 0.05, worldZ * 0.05) * 3.0;
          height += TERRAIN_CONFIG.CANYON_HEIGHT + plateauNoise;
        }
      }
    }

    return height;
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

    // Initialize color attribute if it doesn't exist
    let snowColors: THREE.BufferAttribute;
    if (!this.snowGeometry.attributes.color) {
      const colors = new Float32Array(snowPos.count * 3);
      snowColors = new THREE.BufferAttribute(colors, 3);
      this.snowGeometry.setAttribute('color', snowColors);
    } else {
      snowColors = this.snowGeometry.attributes.color as THREE.BufferAttribute;
    }

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

        // Map U to [-CHUNK_WIDTH/2, +CHUNK_WIDTH/2] for full terrain width
        const localX = (u - 0.5) * CHUNK_WIDTH;
        const worldX = localX + pathPoint.x; // Add spine offset

        const y = this.getSnowHeight(localX, worldZ, pathPoint.banking, trackWidth);
        const vertexZ = pathPoint.z;

        snowPos.setXYZ(i, worldX, y, vertexZ);

        // Calculate vertex color based on height (track vs cliff vs plateau)
        const baseHeight =
          worldZ * Math.tan(TERRAIN_CONFIG.SLOPE_ANGLE) + pathPoint.banking * localX;
        const heightAboveBase = y - baseHeight;

        let color: THREE.Color;
        if (heightAboveBase < 2) {
          // Track level - white snow
          color = new THREE.Color(0xffffff);
        } else if (heightAboveBase < TERRAIN_CONFIG.CANYON_HEIGHT - 5) {
          // Cliff face - grey rock with snow dusting
          const dustNoise = this.noise2D(localX * 0.3, worldZ * 0.3) * 0.5 + 0.5;
          const rockColor = new THREE.Color(0x555555);
          const snowColor = new THREE.Color(0xdddddd);
          // More snow at bottom and top of cliff
          const snowAmount = Math.min(dustNoise * 0.4, 0.5);
          color = rockColor.clone().lerp(snowColor, snowAmount);
        } else {
          // Plateau top - white snow
          const plateauNoise = this.noise2D(localX * 0.1, worldZ * 0.1) * 0.3 + 0.7;
          color = new THREE.Color(0xffffff).multiplyScalar(plateauNoise);
        }

        snowColors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    snowPos.needsUpdate = true;
    snowColors.needsUpdate = true;
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

        // Use full terrain width including canyon walls
        const y = this.getSnowHeight(effectiveLocalX, worldZ, pathPoint.banking, pathPoint.width);

        heights[heightIndex++] = y;
      }
    }

    this.rebuildCollider(heights);

    // --- 3. Scatter Obstacles ---
    this.scatterObstacles(points, startState);

    return endState;
  }

  private scatterObstacles(points: PathPoint[], startState: ChunkState): void {
    // Clean up existing obstacle bodies
    this.obstacleBodies.forEach((body) => {
      this.world.removeRigidBody(body);
    });
    this.obstacleBodies = [];

    const matrix = new THREE.Matrix4();
    let treeInstanceIndex = 0;
    let rockInstanceIndex = 0;

    // Reset instance counts
    this.treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < TERRAIN_CONFIG.OBSTACLE_COUNT; i++) {
      // Random position within chunk bounds
      const randomZ = -Math.random() * CHUNK_LENGTH;
      const randomX = (Math.random() - 0.5) * CHUNK_WIDTH;

      // Find closest path point
      const zFraction = -randomZ / CHUNK_LENGTH;
      const pathIndex = Math.floor(zFraction * CHUNK_SEGMENTS);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];
      const worldZ = startState.endZ + pathPoint.z;

      // Calculate local X relative to path spine
      const localX = randomX - pathPoint.x;
      const absLocalX = Math.abs(localX);
      const trackWidth = pathPoint.width;
      const halfTrack = trackWidth / 2;
      const canyonFloorWidth = trackWidth / 2 + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
      const distFromTrackEdge = absLocalX - canyonFloorWidth;

      // Determine terrain type based on distance from track edge
      const isOnTrack = absLocalX <= halfTrack;
      const isOnBank = absLocalX > halfTrack && distFromTrackEdge <= 0;
      const isOnCliff = distFromTrackEdge > 0 && distFromTrackEdge < TERRAIN_CONFIG.WALL_WIDTH;
      const isOnPlateau = distFromTrackEdge >= TERRAIN_CONFIG.WALL_WIDTH;

      // Get height at this position
      const y = this.getSnowHeight(localX, worldZ, pathPoint.banking, trackWidth);

      // Placement logic
      let placeTree = false;
      let placeRock = false;

      if (isOnTrack) {
        // Track: Low chance of rock, no trees
        if (Math.random() < 0.05) {
          placeRock = true;
        }
      } else if (isOnBank) {
        // Bank: Medium chance of tree, some rocks
        if (Math.random() < 0.25) {
          placeTree = true;
        } else if (Math.random() < 0.15) {
          placeRock = true;
        }
      } else if (isOnCliff) {
        // Cliff: Sparse trees and rocks
        if (Math.random() < 0.1) {
          placeTree = true;
        } else if (Math.random() < 0.08) {
          placeRock = true;
        }
      } else if (isOnPlateau) {
        // Plateau: High density forest
        if (Math.random() < 0.7) {
          placeTree = true;
        }
      }

      // Place tree
      if (placeTree && treeInstanceIndex < TERRAIN_CONFIG.OBSTACLE_COUNT) {
        const treeY = y;
        const treeScale = 1 + Math.random() * 0.5;
        const rotationY = Math.random() * Math.PI * 2;
        matrix.makeRotationY(rotationY);
        matrix.scale(new THREE.Vector3(treeScale, treeScale, treeScale));
        matrix.setPosition(randomX, treeY, pathPoint.z);
        this.treeMesh.setMatrixAt(treeInstanceIndex, matrix);

        // Create physics body for trees on track/bank
        if (isOnTrack || isOnBank) {
          const treeBody = this.world.createRigidBody(
            this.rapier.RigidBodyDesc.fixed().setTranslation(
              randomX,
              treeY + 3,
              startState.endZ + pathPoint.z
            )
          );
          const treeCollider = this.rapier.ColliderDesc.cylinder(3, 0.4)
            .setFriction(0.8)
            .setRestitution(0);
          this.world.createCollider(treeCollider, treeBody);
          this.obstacleBodies.push(treeBody);
        }

        treeInstanceIndex++;
      }

      // Place rock
      if (placeRock && rockInstanceIndex < TERRAIN_CONFIG.OBSTACLE_COUNT) {
        const rockY = y;
        const rockScale = 0.8 + Math.random() * 0.6;
        const euler = new THREE.Euler(
          Math.random() * Math.PI * 0.3,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 0.3
        );
        matrix.makeRotationFromEuler(euler);
        matrix.scale(new THREE.Vector3(rockScale, rockScale, rockScale));
        matrix.setPosition(randomX, rockY, pathPoint.z);
        this.rockMesh.setMatrixAt(rockInstanceIndex, matrix);

        // Create physics body for rocks on track/bank
        if (isOnTrack || isOnBank) {
          const rockBody = this.world.createRigidBody(
            this.rapier.RigidBodyDesc.fixed().setTranslation(
              randomX,
              rockY + 1.5 * rockScale,
              startState.endZ + pathPoint.z
            )
          );
          const rockCollider = this.rapier.ColliderDesc.ball(1.5 * rockScale)
            .setFriction(0.9)
            .setRestitution(0);
          this.world.createCollider(rockCollider, rockBody);
          this.obstacleBodies.push(rockBody);
        }

        rockInstanceIndex++;
      }
    }

    // Update instance counts
    this.treeMesh.count = treeInstanceIndex;
    this.rockMesh.count = rockInstanceIndex;
    this.treeMesh.instanceMatrix.needsUpdate = true;
    this.rockMesh.instanceMatrix.needsUpdate = true;
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

    // Clean up obstacle bodies
    this.obstacleBodies.forEach((body) => {
      this.world.removeRigidBody(body);
    });
    this.obstacleBodies = [];

    // Dispose geometries and materials
    this.snowGeometry.dispose();
    this.snowMaterial.dispose();
    this.treeGeometry.dispose();
    this.rockGeometry.dispose();
    this.treeMaterial.dispose();
    this.rockMaterial.dispose();
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
