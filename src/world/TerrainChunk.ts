import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { BiomeType } from './WorldState';
import type { ChunkState, PathPoint } from './WorldState';
import { getRockGeometry } from './AssetFactory';
import { createTreeGeometry, TREE_ARCHETYPES, type TreeArchetype } from './assets/TreeGeometry';
import { getDeadTreeGeometry } from './assets/DeadTreeGeometry';

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
  private treeBuckets: Record<TreeArchetype, THREE.InstancedMesh>;
  private deadTreeMesh: THREE.InstancedMesh;
  private rockMesh: THREE.InstancedMesh;
  private treeGeometries: Record<TreeArchetype, THREE.BufferGeometry>;
  private deadTreeGeometry: THREE.BufferGeometry;
  private rockGeometry: THREE.BufferGeometry;
  private treeMaterial: THREE.MeshStandardMaterial;
  private deadTreeMaterial: THREE.MeshStandardMaterial;
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
    this.snowGeometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, 80, CHUNK_SEGMENTS);

    // Initialize Meshes
    this.snowMesh = new THREE.Mesh(this.snowGeometry, this.snowMaterial);

    // Prevent the renderer from hiding the mesh because it thinks it's off-screen
    this.snowMesh.frustumCulled = false;

    this.snowMesh.receiveShadow = true;

    this.group.add(this.snowMesh);

    // Initialize obstacle geometries and materials
    this.rockGeometry = getRockGeometry();
    this.deadTreeGeometry = getDeadTreeGeometry();

    // Create tree geometries for each archetype
    this.treeGeometries = {
      small: createTreeGeometry(TREE_ARCHETYPES.small.layerCount),
      medium: createTreeGeometry(TREE_ARCHETYPES.medium.layerCount),
      large: createTreeGeometry(TREE_ARCHETYPES.large.layerCount),
    };

    // Materials
    this.treeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White to allow instance colors to show correctly
      roughness: 0.8,
      flatShading: true,
    });

    this.deadTreeMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4a3a,
      roughness: 0.9,
      flatShading: true,
    });

    this.rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.9,
      flatShading: true,
    });

    // Initialize InstancedMeshes for tree buckets
    const maxTreesPerBucket = Math.ceil(TERRAIN_CONFIG.OBSTACLE_COUNT / 3);
    this.treeBuckets = {
      small: new THREE.InstancedMesh(
        this.treeGeometries.small,
        this.treeMaterial,
        maxTreesPerBucket
      ),
      medium: new THREE.InstancedMesh(
        this.treeGeometries.medium,
        this.treeMaterial,
        maxTreesPerBucket
      ),
      large: new THREE.InstancedMesh(
        this.treeGeometries.large,
        this.treeMaterial,
        maxTreesPerBucket
      ),
    };

    // Enable shadows and initialize instance colors for all tree buckets
    Object.values(this.treeBuckets).forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // Initialize instance colors
      const colors = new Float32Array(mesh.count * 3);
      const baseColor = new THREE.Color(0x4b8b3b);
      for (let i = 0; i < mesh.count; i++) {
        colors[i * 3] = baseColor.r;
        colors[i * 3 + 1] = baseColor.g;
        colors[i * 3 + 2] = baseColor.b;
      }
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    });

    // Dead tree mesh
    this.deadTreeMesh = new THREE.InstancedMesh(
      this.deadTreeGeometry,
      this.deadTreeMaterial,
      Math.ceil(TERRAIN_CONFIG.OBSTACLE_COUNT * 0.1) // ~10% of obstacles can be dead trees
    );
    this.deadTreeMesh.castShadow = true;
    this.deadTreeMesh.receiveShadow = true;
    this.group.add(this.deadTreeMesh);

    // Rock mesh
    this.rockMesh = new THREE.InstancedMesh(
      this.rockGeometry,
      this.rockMaterial,
      TERRAIN_CONFIG.OBSTACLE_COUNT
    );
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;

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

        if (progress < 1.0) {
          // Cliff face - terraced low-poly style
          // Calculate wall height in world space (for proper noise mapping)
          const wallHeight = progress * TERRAIN_CONFIG.CANYON_HEIGHT;

          // Create terraced/blocky profile with quantization
          const terraceSteps = 6; // Number of distinct ledges
          const terraceStepSize = TERRAIN_CONFIG.CANYON_HEIGHT / terraceSteps;
          const quantizedProgress = Math.floor(progress * terraceSteps) / terraceSteps;
          const baseTerraceHeight = quantizedProgress * TERRAIN_CONFIG.CANYON_HEIGHT;

          // Use wall-space coordinates for noise (wallHeight instead of localX)
          // This prevents vertical stretching by mapping noise to the wall face
          const wallSpaceX = worldZ * 0.1; // Horizontal along the wall
          const wallSpaceY = wallHeight * 0.15; // Vertical up the wall

          // Large-scale noise to displace terraces (creates chunky rock formations)
          const terraceDisplacement = this.noise2D(wallSpaceX, wallSpaceY) * terraceStepSize * 0.6;

          // Fine detail noise for texture (smaller amplitude)
          const detailNoise = this.noise2D(wallSpaceX * 2, wallSpaceY * 2) * 2.0;

          // Combine terraced base with displacements
          const cliffHeight = baseTerraceHeight + terraceDisplacement + detailNoise;
          height += cliffHeight;
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
          // Cliff face - detect terraced structure for appropriate coloring
          const canyonFloorWidth = trackWidth / 2 + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
          const distFromTrackEdge = Math.abs(localX) - canyonFloorWidth;
          const progress = Math.min(1.0, distFromTrackEdge / TERRAIN_CONFIG.WALL_WIDTH);

          // Match terrace structure from getSnowHeight
          const terraceSteps = 6;
          const wallHeight = progress * TERRAIN_CONFIG.CANYON_HEIGHT;

          // Use wall-space coordinates for noise (matching getSnowHeight)
          const wallSpaceX = worldZ * 0.1;
          const wallSpaceY = wallHeight * 0.15;

          // Detect if we're on a flat ledge (near terrace step) or vertical face
          const progressInStep = (progress * terraceSteps) % 1.0;
          const isOnLedge = progressInStep < 0.15 || progressInStep > 0.85; // Top/bottom 15% of each step

          if (isOnLedge) {
            // Flat ledge - snow accumulation with some rock showing through
            const ledgeNoise = this.noise2D(wallSpaceX, wallSpaceY) * 0.5 + 0.5;
            const rockColor = new THREE.Color(0x666666);
            const snowColor = new THREE.Color(0xeeeeee);
            const snowAmount = Math.min(ledgeNoise * 0.6 + 0.3, 0.8); // More snow on ledges
            color = rockColor.clone().lerp(snowColor, snowAmount);
          } else {
            // Vertical face - primarily rock with minimal snow
            const faceNoise = this.noise2D(wallSpaceX * 2, wallSpaceY * 2) * 0.5 + 0.5;
            const rockColor = new THREE.Color(0x555555);
            const snowColor = new THREE.Color(0xaaaaaa);
            const snowAmount = Math.min(faceNoise * 0.2, 0.3); // Less snow on vertical faces
            color = rockColor.clone().lerp(snowColor, snowAmount);
          }
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
    let minHeight = Infinity;
    let maxHeight = -Infinity;

    // Iterate rows from Z = -CHUNK_LENGTH to 0 (Min Z to Max Z in physics local space)
    for (let row = 0; row < this.nrows; row++) {
      // Row 0 corresponds to Z = -CHUNK_LENGTH (end of chunk)
      // Row N corresponds to Z = 0 (start of chunk)
      const zProgress = row / (this.nrows - 1); // 0 to 1

      // Map to path points (which go from 0 to -CHUNK_LENGTH)
      // If row=0 (Z=-100), we want path index near end.
      // If row=N (Z=0), we want path index 0.
      const pathZ = -CHUNK_LENGTH + zProgress * CHUNK_LENGTH; // -100 to 0

      // Find corresponding path point
      const pathFraction = Math.abs(pathZ) / CHUNK_LENGTH; // 1 to 0
      const pathIndex = Math.floor(pathFraction * CHUNK_SEGMENTS);
      const pathPoint = points[Math.min(Math.max(0, pathIndex), points.length - 1)];

      const worldZ = startState.endZ + pathZ;

      for (let col = 0; col < this.ncols; col++) {
        const xFraction = col / (this.ncols - 1);
        const localGridX = (xFraction - 0.5) * CHUNK_WIDTH;

        // Calculate distance from the curved path spine
        const effectiveLocalX = localGridX - pathPoint.x;

        // Use full terrain width including canyon walls
        const y = this.getSnowHeight(effectiveLocalX, worldZ, pathPoint.banking, pathPoint.width);

        heights[heightIndex++] = y;
        minHeight = Math.min(minHeight, y);
        maxHeight = Math.max(maxHeight, y);
      }
    }

    console.log(
      `Chunk at Z=${startZ}: Height range: ${minHeight.toFixed(2)} to ${maxHeight.toFixed(2)}`
    );

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
    const dummy = new THREE.Object3D(); // Helper for matrix calculations
    const dummyColor = new THREE.Color();

    // Track instance counts for each bucket
    const indices: Record<TreeArchetype, number> = {
      small: 0,
      medium: 0,
      large: 0,
    };
    let deadTreeIndex = 0;
    let rockInstanceIndex = 0;

    // Store max capacities
    const maxCapacities: Record<TreeArchetype, number> = {
      small: this.treeBuckets.small.count,
      medium: this.treeBuckets.medium.count,
      large: this.treeBuckets.large.count,
    };
    const maxDeadTrees = this.deadTreeMesh.count;

    // Reset instance matrix usage
    Object.values(this.treeBuckets).forEach((mesh) => {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    this.deadTreeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Grid-based placement with noise sampling
    const gridSize = 5; // Spacing between potential tree positions
    const noiseScale = 0.1; // Frequency of noise sampling

    for (let x = -CHUNK_WIDTH / 2; x < CHUNK_WIDTH / 2; x += gridSize) {
      for (let z = -CHUNK_LENGTH; z < 0; z += gridSize) {
        // Find closest path point
        const zFraction = -z / CHUNK_LENGTH;
        const pathIndex = Math.floor(zFraction * CHUNK_SEGMENTS);
        const pathPoint = points[Math.min(pathIndex, points.length - 1)];
        const worldZ = startState.endZ + pathPoint.z;

        // Calculate local X relative to path spine
        const localX = x - pathPoint.x;
        const absLocalX = Math.abs(localX);
        const trackWidth = pathPoint.width;
        const halfTrack = trackWidth / 2;
        const canyonFloorWidth = trackWidth / 2 + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
        const distFromTrackEdge = absLocalX - canyonFloorWidth;

        // Determine terrain type
        const isOnTrack = absLocalX <= halfTrack;
        const isOnBank = absLocalX > halfTrack && distFromTrackEdge <= 0;
        const isOnCliff = distFromTrackEdge > 0 && distFromTrackEdge < TERRAIN_CONFIG.WALL_WIDTH;
        const isOnPlateau = distFromTrackEdge >= TERRAIN_CONFIG.WALL_WIDTH;

        // Sample noise for tree placement and type determination
        const noiseValue = this.noise2D(x * noiseScale, worldZ * noiseScale);
        const normalizedNoise = (noiseValue + 1) / 2; // Convert from [-1, 1] to [0, 1]

        // Get height at this position
        const y = this.getSnowHeight(localX, worldZ, pathPoint.banking, trackWidth);

        // Determine what to place based on terrain and noise
        let placeTree: TreeArchetype | null = null;
        let placeDeadTree = false;
        let placeRock = false;

        if (isOnTrack) {
          // Track: Low chance of rock, no trees
          if (Math.random() < 0.05) {
            placeRock = true;
          }
        } else if (isOnBank) {
          // Bank: Medium chance of tree, some rocks
          if (normalizedNoise > 0.3 && normalizedNoise < 0.5 && Math.random() < 0.25) {
            placeTree = 'small';
          } else if (normalizedNoise >= 0.5 && normalizedNoise < 0.7 && Math.random() < 0.3) {
            placeTree = 'medium';
          } else if (normalizedNoise >= 0.7 && Math.random() < 0.2) {
            placeTree = 'large';
          } else if (Math.random() < 0.15) {
            placeRock = true;
          }
        } else if (isOnCliff) {
          // Cliff: Sparse trees and rocks
          if (normalizedNoise > 0.4 && normalizedNoise < 0.6 && Math.random() < 0.1) {
            placeTree = 'small';
          } else if (normalizedNoise >= 0.6 && Math.random() < 0.08) {
            placeTree = 'medium';
          } else if (Math.random() < 0.08) {
            placeRock = true;
          }
        } else if (isOnPlateau) {
          // Plateau: High density forest with noise-based variety
          if (normalizedNoise < 0.4) {
            // Low noise = clearing, maybe dead tree
            if (Math.random() < 0.1) {
              placeDeadTree = true;
            }
          } else if (normalizedNoise >= 0.4 && normalizedNoise < 0.6) {
            // Medium noise = small trees
            if (Math.random() < 0.6) {
              placeTree = 'small';
            }
          } else if (normalizedNoise >= 0.6 && normalizedNoise < 0.8) {
            // Higher noise = medium trees
            if (Math.random() < 0.7) {
              placeTree = 'medium';
            }
          } else {
            // Highest noise = large trees
            if (Math.random() < 0.8) {
              placeTree = 'large';
            }
          }
        }

        // Place tree in appropriate bucket
        if (placeTree && indices[placeTree] < maxCapacities[placeTree]) {
          const treeY = y;

          // Normal distribution for tree scale (mean ~2.0, std dev ~0.5, clamped to 1.0-3.0)
          // Using Box-Muller transform for normal distribution
          const u1 = Math.random();
          const u2 = Math.random();
          const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          const normalValue = 2.0 + z0 * 0.5; // Mean 2.0, std dev 0.5
          const treeScale = Math.max(1.0, Math.min(3.0, normalValue)); // Clamp to 1.0-3.0 range

          const rotationY = Math.random() * Math.PI * 2;

          dummy.position.set(x, treeY, pathPoint.z);
          dummy.rotation.set(0, rotationY, 0); // Keep trees upright (no X/Z rotation)
          dummy.scale.set(treeScale, treeScale, treeScale);
          dummy.updateMatrix();

          this.treeBuckets[placeTree].setMatrixAt(indices[placeTree], dummy.matrix);

          // Color variation with better base green
          dummyColor.setHex(0x2d7a2d);
          const hueShift = (Math.random() - 0.5) * 0.1; // Small hue variation
          const saturationShift = (Math.random() - 0.5) * 0.1;
          const lightnessShift = (Math.random() - 0.5) * 0.1;
          dummyColor.offsetHSL(hueShift, saturationShift, lightnessShift);
          this.treeBuckets[placeTree].setColorAt(indices[placeTree], dummyColor);

          // Create physics body for trees on track/bank
          if (isOnTrack || isOnBank) {
            const treeHeight = placeTree === 'small' ? 2.5 : placeTree === 'medium' ? 3.5 : 4.5;
            const treeBody = this.world.createRigidBody(
              this.rapier.RigidBodyDesc.fixed().setTranslation(
                x,
                treeY + treeHeight * treeScale,
                startState.endZ + pathPoint.z
              )
            );
            const treeCollider = this.rapier.ColliderDesc.cylinder(
              treeHeight * treeScale,
              0.4 * treeScale
            )
              .setFriction(0.8)
              .setRestitution(0);
            this.world.createCollider(treeCollider, treeBody);
            this.obstacleBodies.push(treeBody);
          }

          indices[placeTree]++;
        }

        // Place dead tree
        if (placeDeadTree && deadTreeIndex < maxDeadTrees) {
          const logY = y;
          const logScale = 0.9 + Math.random() * 0.3;
          // Rotate 90 degrees on X or Z axis to lay flat
          const rotationAxis = Math.random() > 0.5 ? 'x' : 'z';
          const rotationAngle = Math.random() * Math.PI * 2;

          dummy.position.set(x, logY, pathPoint.z);
          if (rotationAxis === 'x') {
            dummy.rotation.x = Math.PI / 2;
            dummy.rotation.z = rotationAngle;
          } else {
            dummy.rotation.z = Math.PI / 2;
            dummy.rotation.x = rotationAngle;
          }
          dummy.scale.set(logScale, logScale, logScale);
          dummy.updateMatrix();

          this.deadTreeMesh.setMatrixAt(deadTreeIndex, dummy.matrix);
          deadTreeIndex++;
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
          matrix.setPosition(x, rockY, pathPoint.z);
          this.rockMesh.setMatrixAt(rockInstanceIndex, matrix);

          // Create physics body for rocks on track/bank
          if (isOnTrack || isOnBank) {
            const rockBody = this.world.createRigidBody(
              this.rapier.RigidBodyDesc.fixed().setTranslation(
                x,
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
    }

    // Update instance counts and mark for update
    Object.entries(this.treeBuckets).forEach(([archetype, mesh]) => {
      mesh.count = indices[archetype as TreeArchetype];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    });
    this.deadTreeMesh.count = deadTreeIndex;
    this.deadTreeMesh.instanceMatrix.needsUpdate = true;
    this.rockMesh.count = rockInstanceIndex;
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
    Object.values(this.treeGeometries).forEach((geo) => geo.dispose());
    this.deadTreeGeometry.dispose();
    this.rockGeometry.dispose();
    this.treeMaterial.dispose();
    this.deadTreeMaterial.dispose();
    this.rockMaterial.dispose();
  }

  private rebuildCollider(heights: Float32Array): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }

    try {
      // RAPIER expects the heightfield scale as a Vector with {x, y, z}
      const scale = { x: CHUNK_WIDTH, y: 1.0, z: CHUNK_LENGTH };

      console.log(
        `Creating heightfield: nrows=${this.nrows}, ncols=${this.ncols}, scale=${JSON.stringify(scale)}`
      );

      // Use FIX_INTERNAL_EDGES flag to improve collision detection on flat surfaces
      const HeightFieldFlags = this.rapier.HeightFieldFlags;
      const colliderDesc = this.rapier.ColliderDesc.heightfield(
        this.nrows,
        this.ncols,
        heights,
        scale,
        HeightFieldFlags.FIX_INTERNAL_EDGES
      )
        .setFriction(0.05)
        .setRestitution(0)
        .setTranslation(0, 0, -CHUNK_LENGTH * 0.5);

      this.collider = this.world.createCollider(colliderDesc, this.body);
      console.log(`✓ Heightfield collider created successfully at Z=${this.currentZ}`);
    } catch (error) {
      console.error('✗ Failed to rebuild terrain collider', error);
      console.error('Heights array length:', heights.length);
      console.error('nrows:', this.nrows, 'ncols:', this.ncols);
      console.error('Expected length:', this.nrows * this.ncols);
    }
  }
}
