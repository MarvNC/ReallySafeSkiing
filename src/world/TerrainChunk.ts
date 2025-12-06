import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

import { OBSTACLE_CONFIG, TERRAIN_CONFIG, TERRAIN_DIMENSIONS } from '../config/GameConfig';
import { COLOR_PALETTE } from '../constants/colors';
import { makeCollisionGroups, PhysicsLayer } from '../physics/PhysicsLayers';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { getRockGeometry } from './AssetFactory';
import { getDeadTreeGeometry } from './assets/DeadTreeGeometry';
import { createTreeGeometry, TREE_ARCHETYPES, type TreeArchetype } from './assets/TreeGeometry';
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

export const CHUNK_WIDTH = TERRAIN_DIMENSIONS.CHUNK_WIDTH;
export const CHUNK_LENGTH = TERRAIN_DIMENSIONS.CHUNK_LENGTH;
export const CHUNK_SEGMENTS = TERRAIN_DIMENSIONS.CHUNK_SEGMENTS;

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

  private readonly generator: TerrainGenerator;
  private readonly points: PathPoint[];
  private currentZ: number;
  private readonly physics?: PhysicsWorld;
  private terrainBody?: RAPIER.RigidBody;
  private terrainCollider?: RAPIER.Collider;
  private obstacleBodies: RAPIER.RigidBody[] = [];
  private obstacleColliders: RAPIER.Collider[] = [];

  constructor(points: PathPoint[], generator: TerrainGenerator, physics?: PhysicsWorld) {
    this.generator = generator;
    this.points = points;
    this.currentZ = points.length > 0 ? points[0].z : 0;
    this.physics = physics;

    // Initialize Group
    this.group = new THREE.Group();

    // Initialize shared materials
    const materials = getTerrainMaterials();
    this.snowMaterial = materials.snow;

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
    this.treeMaterial = materials.tree;
    this.deadTreeMaterial = materials.deadTree;
    this.rockMaterial = materials.rock;

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
  private calculateObstacleProbabilities(surfaceType: 'track' | 'bank' | 'cliff' | 'plateau') {
    const config = OBSTACLE_CONFIG.surfaces[surfaceType];

    // Normalize tree/rock/deadTree proportions (for track which doesn't use noise)
    const obstacleTypeProportions = this.normalizeProportions({
      tree: config.treeProportion,
      rock: config.rockProportion,
      deadTree: 'deadTreeProportion' in config ? config.deadTreeProportion : 0,
    });

    // Normalize tree size proportions (for track)
    const treeSizeProportions = this.normalizeProportions(config.treeSizes);

    // Calculate base rarity (convert to a reasonable probability per grid point)
    // Higher rarity = more likely to spawn obstacles
    const baseRarity = config.rarity / 100; // Scale down for reasonable probabilities

    return {
      baseRarity,
      obstacleTypeProportions,
      treeSizeProportions,
      noiseThresholds: 'noiseThresholds' in config ? config.noiseThresholds : undefined,
      rockProbability: 'rockProbability' in config ? config.rockProbability : undefined,
    };
  }

  /**
   * Select tree size based on proportions and noise value
   */
  private selectTreeSize(
    treeSizeProportions: Record<string, number>,
    noiseThresholds: Record<string, { min: number; max: number; probability?: number }> | undefined,
    normalizedNoise: number
  ): TreeArchetype | null {
    if (!noiseThresholds) {
      // Simple proportional selection without noise (for track)
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

    // Noise-based selection with probabilities
    for (const [size, threshold] of Object.entries(noiseThresholds)) {
      if (normalizedNoise >= threshold.min && normalizedNoise < threshold.max) {
        // Check if this size has a proportion > 0 and a probability
        if (treeSizeProportions[size] > 0 && threshold.probability !== undefined) {
          // Apply the probability from config
          if (Math.random() < threshold.probability) {
            return size as TreeArchetype;
          }
        }
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

    // Reset instance matrix usage
    Object.values(this.treeBuckets).forEach((mesh) => {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    this.deadTreeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Grid-based placement with noise sampling
    const gridSize = OBSTACLE_CONFIG.gridSize;
    const noiseScale = OBSTACLE_CONFIG.noiseScale;

    const lateralMax = CHUNK_WIDTH / 2;

    // Pre-calculate probabilities for each surface type
    const trackProbs = this.calculateObstacleProbabilities('track');
    const bankProbs = this.calculateObstacleProbabilities('bank');
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

        const noiseValue = this.generator.sampleNoise(
          worldX * noiseScale,
          sample.localS * noiseScale
        );
        const normalizedNoise = (noiseValue + 1) / 2;
        const y = sample.height;

        let placeTree: TreeArchetype | null = null;
        let placeDeadTree = false;
        let placeRock = false;

        if (isOnTrack) {
          // Track: Simple proportional approach
          const probs = trackProbs;
          if (Math.random() < probs.baseRarity) {
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
              // Track trees are always small
              placeTree = this.selectTreeSize(
                probs.treeSizeProportions,
                undefined,
                normalizedNoise
              );
            } else if (selectedType === 'rock') {
              placeRock = true;
            }
          }
        } else if (isOnBank) {
          // Bank: Noise-based tree selection, then rock fallback
          const probs = bankProbs;
          placeTree = this.selectTreeSize(
            probs.treeSizeProportions,
            probs.noiseThresholds,
            normalizedNoise
          );
          if (
            !placeTree &&
            probs.rockProbability !== undefined &&
            Math.random() < probs.rockProbability
          ) {
            placeRock = true;
          }
        } else if (isOnCliff) {
          // Cliff: Noise-based tree selection, then rock fallback
          const probs = cliffProbs;
          placeTree = this.selectTreeSize(
            probs.treeSizeProportions,
            probs.noiseThresholds,
            normalizedNoise
          );
          if (
            !placeTree &&
            probs.rockProbability !== undefined &&
            Math.random() < probs.rockProbability
          ) {
            placeRock = true;
          }
        } else if (isOnPlateau) {
          // Plateau: Noise-based selection for dead trees and tree sizes
          const probs = plateauProbs;
          if (probs.noiseThresholds) {
            // Check dead tree first (low noise range)
            const deadTreeThreshold =
              'deadTree' in probs.noiseThresholds ? probs.noiseThresholds.deadTree : undefined;
            if (
              deadTreeThreshold &&
              normalizedNoise >= deadTreeThreshold.min &&
              normalizedNoise < deadTreeThreshold.max &&
              deadTreeThreshold.probability !== undefined &&
              Math.random() < deadTreeThreshold.probability
            ) {
              placeDeadTree = true;
            } else {
              // Check tree sizes
              placeTree = this.selectTreeSize(
                probs.treeSizeProportions,
                probs.noiseThresholds,
                normalizedNoise
              );
            }
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
              treeScale
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
        if (placeRock && rockInstanceIndex < TERRAIN_CONFIG.OBSTACLE_COUNT) {
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
    }

    // Dispose geometries (materials are shared and owned by TerrainMaterials)
    this.snowGeometry.dispose();
    Object.values(this.treeGeometries).forEach((geo) => geo.dispose());
    this.deadTreeGeometry.dispose();
    this.rockGeometry.dispose();
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
    scale: number
  ): void {
    const world = physics.getWorld();
    const radius = 0.8 * scale;
    const halfHeight = 4 * scale;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(worldX, worldY + halfHeight, worldZ)
    );
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius).setCollisionGroups(
        makeCollisionGroups(PhysicsLayer.World, PhysicsLayer.Player)
      ),
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
      RAPIER.ColliderDesc.ball(radius).setCollisionGroups(
        makeCollisionGroups(PhysicsLayer.World, PhysicsLayer.Player)
      ),
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
      .setCollisionGroups(makeCollisionGroups(PhysicsLayer.World, PhysicsLayer.Player));
    const collider = world.createCollider(colliderDesc, body);
    this.obstacleBodies.push(body);
    this.obstacleColliders.push(collider);
  }
}
