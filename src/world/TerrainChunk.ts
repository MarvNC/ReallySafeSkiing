import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

import {
  ARCADE_CONFIG,
  COLOR_PALETTE,
  type ObstacleConfig,
  TERRAIN_CONFIG,
} from '../config/GameConfig';
import { makeCollisionGroups, PhysicsLayer } from '../physics/PhysicsLayers';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { getCoinGeometry, getRockGeometry } from './AssetFactory';
import { getDeadTreeGeometry } from './assets/DeadTreeGeometry';
import {
  createTreeGeometry,
  getTreeHeight,
  TREE_ARCHETYPES,
  TREE_TRUNK_RADIUS_BOTTOM,
  type TreeArchetype,
} from './assets/TreeGeometry';
import { TerrainGenerator } from './TerrainGenerator';
import { getTerrainMaterials } from './TerrainMaterials';
import type { PathPoint } from './WorldState';
import { SurfaceKind } from './WorldState';

const SURFACE_KIND_TO_INDEX: Record<SurfaceKind, number> = {
  [SurfaceKind.Track]: 0,
  [SurfaceKind.Bank]: 1,
  [SurfaceKind.CanyonFloor]: 2,
  [SurfaceKind.WallVertical]: 3,
  [SurfaceKind.WallLedge]: 4,
  [SurfaceKind.Plateau]: 5,
};

type CoinInstance = {
  position: THREE.Vector3;
  baseRotationY: number;
  active: boolean;
};

export const CHUNK_WIDTH = TERRAIN_CONFIG.dimensions.chunkWidth;
export const CHUNK_LENGTH = TERRAIN_CONFIG.dimensions.chunkLength;
export const CHUNK_SEGMENTS = TERRAIN_CONFIG.dimensions.chunkSegments;

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
  private coinMesh: THREE.InstancedMesh | null = null;
  private coinGeometry: THREE.BufferGeometry;
  private coinMaterial: THREE.MeshStandardMaterial;
  private coinColliders: RAPIER.Collider[] = [];
  private coinHandleToIndex: Map<number, number> = new Map();
  private coinInstances: CoinInstance[] = [];
  private coinSpinAngle = 0;
  private coinDummy = new THREE.Object3D();
  private treeMaterial: THREE.MeshStandardMaterial;
  private deadTreeMaterial: THREE.MeshStandardMaterial;
  private rockMaterial: THREE.MeshStandardMaterial;
  private readonly maxCoins: number;

  readonly width = CHUNK_WIDTH;
  readonly length = CHUNK_LENGTH;

  private readonly generator: TerrainGenerator;
  private readonly points: PathPoint[];
  private currentZ: number;
  private readonly physics?: PhysicsWorld;
  private terrainBody?: RAPIER.RigidBody;
  private terrainCollider?: RAPIER.Collider;
  private obstacleBodies: RAPIER.RigidBody[] = [];
  private obstacleColliders: RAPIER.Collider[] = [];
  private readonly obstacleCapacity: number;
  private readonly maxTreesPerBucket: number;
  private readonly maxDeadTrees: number;
  private readonly maxRocks: number;
  private readonly obstacleConfig: ObstacleConfig;
  private readonly obstacleDensityMultiplier: number;
  private readonly coinsEnabled: boolean;

  constructor(
    points: PathPoint[],
    generator: TerrainGenerator,
    obstacleConfig: ObstacleConfig,
    obstacleDensityMultiplier: number,
    coinsEnabled: boolean = false,
    physics?: PhysicsWorld
  ) {
    this.generator = generator;
    this.points = points;
    this.currentZ = points.length > 0 ? points[0].z : 0;
    this.physics = physics;
    this.obstacleConfig = obstacleConfig;
    this.obstacleDensityMultiplier = obstacleDensityMultiplier;
    this.coinsEnabled = coinsEnabled;
    this.obstacleCapacity = Math.ceil(TERRAIN_CONFIG.obstacleCount * obstacleDensityMultiplier);
    this.maxTreesPerBucket = Math.ceil(this.obstacleCapacity);
    this.maxDeadTrees = Math.ceil(this.obstacleCapacity * 0.1);
    this.maxRocks = this.obstacleCapacity;
    this.maxCoins = ARCADE_CONFIG.coinsPerArc * ARCADE_CONFIG.arcsPerChunk;

    // Initialize Group
    this.group = new THREE.Group();

    // Initialize shared materials
    const materials = getTerrainMaterials();
    this.snowMaterial = materials.snow;

    // Initialize Geometries (higher width resolution for better cliff quality)
    this.snowGeometry = new THREE.PlaneGeometry(
      CHUNK_WIDTH,
      CHUNK_LENGTH,
      TERRAIN_CONFIG.dimensions.widthSegments,
      CHUNK_SEGMENTS
    );

    // Initialize Meshes
    this.snowMesh = new THREE.Mesh(this.snowGeometry, this.snowMaterial);

    // Prevent the renderer from hiding the mesh because it thinks it's off-screen
    this.snowMesh.frustumCulled = false;

    this.snowMesh.receiveShadow = true;

    this.group.add(this.snowMesh);

    // Initialize obstacle geometries and materials
    this.rockGeometry = getRockGeometry();
    this.deadTreeGeometry = getDeadTreeGeometry();
    this.coinGeometry = getCoinGeometry();

    // Create tree geometries for each archetype
    this.treeGeometries = {
      small: createTreeGeometry(TREE_ARCHETYPES.small.layerCount),
      medium: createTreeGeometry(TREE_ARCHETYPES.medium.layerCount),
      large: createTreeGeometry(TREE_ARCHETYPES.large.layerCount),
    };

    // Materials
    this.treeMaterial = materials.tree;
    this.deadTreeMaterial = materials.deadTree;
    this.rockMaterial = materials.rock;
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: '#facc15',
      emissive: '#f59e0b',
      metalness: 0.5,
      roughness: 0.3,
    });

    // Initialize InstancedMeshes for tree buckets
    this.treeBuckets = {
      small: new THREE.InstancedMesh(
        this.treeGeometries.small,
        this.treeMaterial,
        this.maxTreesPerBucket
      ),
      medium: new THREE.InstancedMesh(
        this.treeGeometries.medium,
        this.treeMaterial,
        this.maxTreesPerBucket
      ),
      large: new THREE.InstancedMesh(
        this.treeGeometries.large,
        this.treeMaterial,
        this.maxTreesPerBucket
      ),
    };

    // Enable shadows for all tree buckets
    Object.values(this.treeBuckets).forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    });

    // Dead tree mesh
    this.deadTreeMesh = new THREE.InstancedMesh(
      this.deadTreeGeometry,
      this.deadTreeMaterial,
      this.maxDeadTrees // ~10% of obstacles can be dead trees
    );
    this.deadTreeMesh.castShadow = true;
    this.deadTreeMesh.receiveShadow = true;
    this.group.add(this.deadTreeMesh);

    // Rock mesh
    this.rockMesh = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, this.maxRocks);
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;

    this.group.add(this.rockMesh);

    // Coins (Arcade mode collectibles)
    this.coinMesh = new THREE.InstancedMesh(this.coinGeometry, this.coinMaterial, this.maxCoins);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.castShadow = false;
    this.coinMesh.receiveShadow = false;
    this.group.add(this.coinMesh);

    // Build the chunk from the provided points
    this.buildFromPoints();
  }

  get startZ(): number {
    return this.currentZ;
  }

  // Helper Methods

  private buildFromPoints(): void {
    if (this.points.length === 0) return;

    const startZ = this.points[0].z;
    this.currentZ = startZ;
    this.group.position.set(0, 0, startZ);

    const points = this.points;

    // --- 1. Update Snow Geometry ---
    const snowPos = this.snowGeometry.attributes.position as THREE.BufferAttribute;
    const snowRows = this.snowGeometry.parameters.heightSegments + 1;
    const snowCols = this.snowGeometry.parameters.widthSegments + 1;
    const vertexCount = snowPos.count;

    // Initialize color attribute if it doesn't exist
    let snowColors: THREE.BufferAttribute;
    if (!this.snowGeometry.attributes.color) {
      const colors = new Float32Array(vertexCount * 3);
      snowColors = new THREE.BufferAttribute(colors, 3);
      this.snowGeometry.setAttribute('color', snowColors);
    } else {
      snowColors = this.snowGeometry.attributes.color as THREE.BufferAttribute;
    }

    const surfaceKindAttribute = new THREE.Uint8BufferAttribute(new Uint8Array(vertexCount), 1);
    const wallFlagAttribute = new THREE.Uint8BufferAttribute(new Uint8Array(vertexCount), 1);
    this.snowGeometry.setAttribute('surfaceKind', surfaceKindAttribute);
    this.snowGeometry.setAttribute('wallFlag', wallFlagAttribute);

    for (let row = 0; row < snowRows; row++) {
      const zFraction = row / (snowRows - 1);
      const scaledIndex = zFraction * (points.length - 1);
      const pathIndex = Math.floor(scaledIndex);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];
      for (let col = 0; col < snowCols; col++) {
        const i = row * snowCols + col;
        const u = col / (snowCols - 1);
        const t = (u - 0.5) * CHUNK_WIDTH;

        const worldX = pathPoint.x + pathPoint.rightX * t;
        const worldZ = pathPoint.z + pathPoint.rightZ * t;
        const sample = this.generator.sampleTerrainAt(worldX, worldZ, pathPoint);
        const vertexZ = worldZ - startZ;
        snowPos.setXYZ(i, worldX, sample.height, vertexZ);
        surfaceKindAttribute.setX(i, SURFACE_KIND_TO_INDEX[sample.kind]);
        wallFlagAttribute.setX(i, sample.isWall ? 1 : 0);

        let color: THREE.Color;
        switch (sample.kind) {
          case SurfaceKind.Track:
          case SurfaceKind.Bank:
          case SurfaceKind.CanyonFloor:
            color = new THREE.Color(COLOR_PALETTE.primaryEnvironment.snowWhite);
            break;
          case SurfaceKind.WallLedge:
            color = new THREE.Color(COLOR_PALETTE.terrainAndObjects.rockGray);
            break;
          case SurfaceKind.WallVertical:
            color = new THREE.Color(COLOR_PALETTE.terrainAndObjects.rockGray);
            break;
          case SurfaceKind.Plateau:
            color = new THREE.Color(COLOR_PALETTE.primaryEnvironment.snowWhite);
            break;
          default: {
            color = new THREE.Color(COLOR_PALETTE.debugTestColors.brightGreen);
            break;
          }
        }

        snowColors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    snowPos.needsUpdate = true;
    snowColors.needsUpdate = true;
    surfaceKindAttribute.needsUpdate = true;
    wallFlagAttribute.needsUpdate = true;
    this.snowGeometry.computeVertexNormals();

    // --- 2. Scatter Obstacles ---
    this.scatterObstacles(points, startZ, this.physics);
    this.scatterCoins(points, startZ, this.physics);

    if (this.physics) {
      this.createTerrainCollider(snowPos, startZ);
    }
  }

  /**
   * Normalize proportions to percentages (0-1 range)
   */
  private normalizeProportions(proportions: Record<string, number>): Record<string, number> {
    const sum = Object.values(proportions).reduce((a, b) => a + b, 0);
    if (sum === 0) return proportions;
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(proportions)) {
      normalized[key] = value / sum;
    }
    return normalized;
  }

  /**
   * Calculate obstacle probabilities from config
   */
  private calculateObstacleProbabilities(
    surfaceType: 'track' | 'bank' | 'cliff' | 'plateau',
    densityScale: number = this.obstacleDensityMultiplier
  ) {
    const config = this.obstacleConfig.surfaces[surfaceType];

    // Normalize obstacle type proportions
    const obstacleTypeProportions = this.normalizeProportions({
      tree: config.treeProportion,
      rock: config.rockProportion,
      deadTree: config.deadTreeProportion ?? 0,
    });

    // Normalize tree size proportions
    const treeSizeProportions = this.normalizeProportions(config.treeSizes);

    // Calculate base rarity (0-100 scale converted to 0-1 probability)
    // When rarity is 0, no obstacles should spawn regardless of other settings
    // Multiply by obstacleDensityMultiplier to scale rarity based on difficulty/mode
    const baseRarity = (config.rarity / 100) * densityScale;

    return {
      baseRarity,
      obstacleTypeProportions,
      treeSizeProportions,
    };
  }

  private scatterCoins(points: PathPoint[], startZ: number, physics?: PhysicsWorld): void {
    if (!this.coinMesh) return;
    if (!this.coinsEnabled) {
      this.coinMesh.count = 0;
      this.coinHandleToIndex.clear();
      this.coinColliders = [];
      this.coinInstances.length = 0;
      this.coinSpinAngle = 0;
      return;
    }
    const world = physics?.getWorld();
    const dummy = this.coinDummy;
    let coinIndex = 0;

    this.coinHandleToIndex.clear();
    this.coinColliders = [];
    this.coinSpinAngle = 0;

    const coinsToSpawn = Math.min(this.maxCoins, Math.max(4, Math.floor(points.length * 0.08)));

    for (let i = 0; i < coinsToSpawn; i++) {
      const pointIndex = Math.floor(Math.random() * points.length);
      const point = points[pointIndex];
      const lateralRange = (point.width ?? CHUNK_WIDTH * 0.5) * 0.6;
      const lateralOffset = (Math.random() - 0.5) * lateralRange;
      const worldX = point.x + point.rightX * lateralOffset;
      const worldZ = point.z;
      const sample = this.generator.sampleTerrainAt(worldX, worldZ, point);
      const worldY = sample.height + ARCADE_CONFIG.coinHeightOffset;
      const baseRotationY = Math.random() * Math.PI * 2;

      dummy.position.set(worldX, worldY, worldZ - startZ);
      dummy.rotation.set(0, baseRotationY, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();

      this.coinMesh.setMatrixAt(coinIndex, dummy.matrix);
      this.coinInstances[coinIndex] = {
        position: new THREE.Vector3(worldX, worldY, worldZ - startZ),
        baseRotationY,
        active: true,
      };

      if (world) {
        const colliderRadius = ARCADE_CONFIG.coinRadius * 1.5; // sphere collider enlarged for easier pickup
        const colliderDesc = RAPIER.ColliderDesc.ball(colliderRadius)
          .setSensor(true)
          .setTranslation(worldX, worldY, worldZ)
          .setCollisionGroups(makeCollisionGroups(PhysicsLayer.Collectible, PhysicsLayer.Player))
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        const collider = world.createCollider(colliderDesc);
        this.coinColliders.push(collider);
        this.coinHandleToIndex.set(collider.handle, coinIndex);
      }

      coinIndex++;
    }

    this.coinMesh.count = coinIndex;
    this.coinInstances.length = coinIndex;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  tryCollectCoin(handle: number): boolean {
    if (!this.coinMesh) return false;
    const index = this.coinHandleToIndex.get(handle);
    if (index === undefined) return false;
    const coinInstance = this.coinInstances[index];
    if (coinInstance) {
      coinInstance.active = false;
    }

    // Remove collider to prevent re-triggering
    if (this.physics) {
      const world = this.physics.getWorld();
      const collider = world.getCollider(handle);
      if (collider) {
        world.removeCollider(collider, true);
      }
    }
    this.coinHandleToIndex.delete(handle);

    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    this.coinMesh.setMatrixAt(index, dummy.matrix);
    this.coinMesh.instanceMatrix.needsUpdate = true;

    return true;
  }

  update(deltaSeconds: number): void {
    this.updateCoinRotation(deltaSeconds);
  }

  private updateCoinRotation(deltaSeconds: number): void {
    if (!this.coinMesh || !this.coinsEnabled) return;
    if (this.coinMesh.count === 0 || deltaSeconds <= 0) return;

    this.coinSpinAngle =
      (this.coinSpinAngle + deltaSeconds * ARCADE_CONFIG.coinRotationSpeed) % (Math.PI * 2);

    const dummy = this.coinDummy;

    for (let i = 0; i < this.coinMesh.count; i++) {
      const coin = this.coinInstances[i];
      if (!coin || !coin.active) continue;

      dummy.position.copy(coin.position);
      dummy.rotation.set(0, coin.baseRotationY + this.coinSpinAngle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, dummy.matrix);
    }

    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Select tree size based on proportions (simple weighted random)
   */
  private selectTreeSize(treeSizeProportions: Record<string, number>): TreeArchetype | null {
    const roll = Math.random();
    let cumulative = 0;
    for (const [size, prob] of Object.entries(treeSizeProportions)) {
      cumulative += prob;
      if (roll < cumulative) {
        return size as TreeArchetype;
      }
    }
    return null;
  }

  private scatterObstacles(points: PathPoint[], startZ: number, physics?: PhysicsWorld): void {
    const matrix = new THREE.Matrix4();
    const dummy = new THREE.Object3D(); // Helper for matrix calculations

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
    const maxRocks = this.rockMesh.count;

    // Reset instance matrix usage
    Object.values(this.treeBuckets).forEach((mesh) => {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    this.deadTreeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Grid-based placement
    const gridSize = this.obstacleConfig.gridSize;

    const lateralMax = CHUNK_WIDTH / 2;

    // Pre-calculate probabilities for each surface type
    const trackProbs = this.calculateObstacleProbabilities('track');
    const bankProbs = this.calculateObstacleProbabilities('bank', 1); // decorative; ignore difficulty scaling
    const cliffProbs = this.calculateObstacleProbabilities('cliff');
    const plateauProbs = this.calculateObstacleProbabilities('plateau');

    for (let row = 0; row < CHUNK_LENGTH; row += gridSize) {
      const zFraction = row / CHUNK_LENGTH;
      const scaledIndex = zFraction * (points.length - 1);
      const pathIndex = Math.floor(scaledIndex);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];

      for (let t = -lateralMax; t < lateralMax; t += gridSize) {
        const worldX = pathPoint.x + pathPoint.rightX * t;
        const worldZ = pathPoint.z + pathPoint.rightZ * t;
        const sample = this.generator.sampleTerrainAt(worldX, worldZ, pathPoint);

        const isOnBank = sample.kind === SurfaceKind.Bank;
        const isOnCliff =
          sample.kind === SurfaceKind.WallVertical || sample.kind === SurfaceKind.WallLedge;
        const isOnPlateau = sample.kind === SurfaceKind.Plateau;
        const isOnTrack = sample.kind === SurfaceKind.Track;
        const y = sample.height;

        let placeTree: TreeArchetype | null = null;
        let placeDeadTree = false;
        let placeRock = false;

        // Determine which surface type we're on and get its probabilities
        let probs: ReturnType<typeof this.calculateObstacleProbabilities> | null = null;
        if (isOnTrack) {
          probs = trackProbs;
        } else if (isOnBank) {
          probs = bankProbs;
        } else if (isOnCliff) {
          probs = cliffProbs;
        } else if (isOnPlateau) {
          probs = plateauProbs;
        }

        // Simple proportional obstacle placement for all surfaces
        if (probs && probs.baseRarity > 0 && Math.random() < probs.baseRarity) {
          // Determine obstacle type based on proportions
          const typeRoll = Math.random();
          let cumulative = 0;
          let selectedType: 'tree' | 'rock' | 'deadTree' | null = null;

          for (const [type, prob] of Object.entries(probs.obstacleTypeProportions)) {
            cumulative += prob;
            if (typeRoll < cumulative) {
              selectedType = type as 'tree' | 'rock' | 'deadTree';
              break;
            }
          }

          if (selectedType === 'tree') {
            placeTree = this.selectTreeSize(probs.treeSizeProportions);
          } else if (selectedType === 'rock') {
            placeRock = true;
          } else if (selectedType === 'deadTree') {
            placeDeadTree = true;
          }
        }

        // Place tree in appropriate bucket
        if (placeTree && indices[placeTree] < maxCapacities[placeTree]) {
          // Normal distribution for tree scale (mean ~2.0, std dev ~0.5, clamped to 1.0-3.0)
          // Using Box-Muller transform for normal distribution
          const u1 = Math.random();
          const u2 = Math.random();
          const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          const normalValue = 2.0 + z0 * 0.5; // Mean 2.0, std dev 0.5
          const treeScale = Math.max(1.0, Math.min(3.0, normalValue)); // Clamp to 1.0-3.0 range

          const rotationY = Math.random() * Math.PI * 2;

          dummy.position.set(worldX, y, worldZ - startZ);
          dummy.rotation.set(0, rotationY, 0); // Keep trees upright (no X/Z rotation)
          dummy.scale.set(treeScale, treeScale, treeScale);
          dummy.updateMatrix();

          this.treeBuckets[placeTree].setMatrixAt(indices[placeTree], dummy.matrix);

          if (physics) {
            this.createTreeCollider(
              physics,
              dummy.position.x,
              dummy.position.y,
              dummy.position.z + startZ,
              treeScale,
              placeTree
            );
          }

          indices[placeTree]++;
        }

        // Place dead tree
        if (placeDeadTree && deadTreeIndex < maxDeadTrees) {
          const logScale = 0.9 + Math.random() * 0.3;
          // Rotate 90 degrees on X or Z axis to lay flat
          const rotationAxis = Math.random() > 0.5 ? 'x' : 'z';
          const rotationAngle = Math.random() * Math.PI * 2;

          dummy.position.set(worldX, y, worldZ - startZ);
          dummy.rotation.set(0, 0, 0);
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
          if (physics) {
            this.createDeadTreeCollider(
              physics,
              dummy.position.clone().add(new THREE.Vector3(0, 0, startZ)),
              dummy.rotation.clone(),
              logScale
            );
          }
          deadTreeIndex++;
        }

        // Place rock
        if (placeRock && rockInstanceIndex < maxRocks) {
          const rockScale = 0.8 + Math.random() * 0.6;
          const euler = new THREE.Euler(
            Math.random() * Math.PI * 0.3,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 0.3
          );
          matrix.makeRotationFromEuler(euler);
          matrix.scale(new THREE.Vector3(rockScale, rockScale, rockScale));
          matrix.setPosition(worldX, y, worldZ - startZ);
          this.rockMesh.setMatrixAt(rockInstanceIndex, matrix);

          if (physics) {
            const worldPos = new THREE.Vector3().setFromMatrixPosition(matrix);
            worldPos.z += startZ;
            this.createRockCollider(physics, worldPos, rockScale);
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
    if (this.physics) {
      const world = this.physics.getWorld();
      if (this.terrainCollider) {
        world.removeCollider(this.terrainCollider, true);
      }
      if (this.terrainBody) {
        world.removeRigidBody(this.terrainBody);
      }
      this.obstacleColliders.forEach((collider) => world.removeCollider(collider, true));
      this.obstacleBodies.forEach((body) => world.removeRigidBody(body));
      this.obstacleColliders = [];
      this.obstacleBodies = [];
      this.coinColliders.forEach((collider) => world.removeCollider(collider, true));
      this.coinColliders = [];
      this.coinHandleToIndex.clear();
    }

    // Dispose geometries (materials are shared and owned by TerrainMaterials)
    this.snowGeometry.dispose();
    Object.values(this.treeGeometries).forEach((geo) => geo.dispose());
    this.deadTreeGeometry.dispose();
    this.rockGeometry.dispose();
    this.coinGeometry.dispose();
    this.coinMaterial.dispose();
    this.coinInstances.length = 0;
  }

  private createTerrainCollider(snowPos: THREE.BufferAttribute, startZ: number): void {
    if (!this.physics) return;
    const world = this.physics.getWorld();
    const vertices = new Float32Array(snowPos.array as ArrayLike<number>);
    const indexAttr = this.snowGeometry.getIndex();
    const indices = indexAttr ? new Uint32Array(indexAttr.array as ArrayLike<number>) : undefined;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, startZ);
    this.terrainBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices ?? new Uint32Array());
    colliderDesc.setCollisionGroups(makeCollisionGroups(PhysicsLayer.World, PhysicsLayer.Player));

    this.terrainCollider = world.createCollider(colliderDesc, this.terrainBody);
  }

  private createTreeCollider(
    physics: PhysicsWorld,
    worldX: number,
    worldY: number,
    worldZ: number,
    scale: number,
    archetype: TreeArchetype
  ): void {
    const world = physics.getWorld();

    // 1. Get the Source of Truth height
    const layerCount = TREE_ARCHETYPES[archetype].layerCount;
    const actualVisualHeight = getTreeHeight(layerCount);

    // 2. Scale it
    const scaledHeight = actualVisualHeight * scale;

    // 3. Define Collider Height
    // "Size of trunk or smaller": We use 2/3rds.
    // This ensures the top third (the thin pointy bit) is non-solid.
    const colliderHeight = scaledHeight * 0.67;

    // Rapier cylinder takes half-height
    const halfHeight = colliderHeight / 2;
    const radius = TREE_TRUNK_RADIUS_BOTTOM * scale;
    const body = world.createRigidBody(
      // Pivot is at bottom, so center is Y + halfHeight
      RAPIER.RigidBodyDesc.fixed().setTranslation(worldX, worldY + halfHeight, worldZ)
    );

    const collider = world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius)
        .setCollisionGroups(makeCollisionGroups(PhysicsLayer.Obstacle, PhysicsLayer.Player))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    this.obstacleBodies.push(body);
    this.obstacleColliders.push(collider);
  }

  private createRockCollider(physics: PhysicsWorld, worldPos: THREE.Vector3, scale: number): void {
    const world = physics.getWorld();
    const radius = 1.2 * scale;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(worldPos.x, worldPos.y + radius, worldPos.z)
    );
    const collider = world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setCollisionGroups(makeCollisionGroups(PhysicsLayer.Obstacle, PhysicsLayer.Player))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    this.obstacleBodies.push(body);
    this.obstacleColliders.push(collider);
  }

  private createDeadTreeCollider(
    physics: PhysicsWorld,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: number
  ): void {
    const world = physics.getWorld();
    const halfHeight = 1.5 * scale;
    const radius = 0.3 * scale;
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y + radius, position.z)
    );
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
      .setRotation({
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w,
      })
      .setCollisionGroups(makeCollisionGroups(PhysicsLayer.Obstacle, PhysicsLayer.Player))
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = world.createCollider(colliderDesc, body);
    this.obstacleBodies.push(body);
    this.obstacleColliders.push(collider);
  }
}
