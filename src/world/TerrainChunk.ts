import * as THREE from 'three';
import type { PathPoint } from './WorldState';
import { getRockGeometry } from './AssetFactory';
import { createTreeGeometry, TREE_ARCHETYPES, type TreeArchetype } from './assets/TreeGeometry';
import { getDeadTreeGeometry } from './assets/DeadTreeGeometry';
import { TERRAIN_CONFIG, TERRAIN_DIMENSIONS } from '../config/GameConfig';
import { getTerrainMaterials } from './TerrainMaterials';
import { TerrainGenerator } from './TerrainGenerator';

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

  constructor(points: PathPoint[]) {
    this.generator = new TerrainGenerator(); // Keep generator for getSnowHeight
    this.points = points;
    this.currentZ = points.length > 0 ? points[0].z : 0;

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
      const scaledIndex = zFraction * (points.length - 1);
      const pathIndex = Math.floor(scaledIndex);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];
      for (let col = 0; col < snowCols; col++) {
        const i = row * snowCols + col;
        const u = col / (snowCols - 1);
        const t = (u - 0.5) * CHUNK_WIDTH;

        const worldX = pathPoint.x + pathPoint.rightX * t;
        const worldZ = pathPoint.z + pathPoint.rightZ * t;
        const localCoords = this.generator.projectToLocalXZ(worldX, worldZ, pathPoint);
        const y = this.generator.getSnowHeightAt(worldX, worldZ, pathPoint);
        const vertexZ = worldZ - startZ;

        snowPos.setXYZ(i, worldX, y, vertexZ);

        const baseHeight = pathPoint.y + pathPoint.banking * localCoords.t;
        const heightAboveBase = y - baseHeight;

        let color: THREE.Color;
        if (heightAboveBase < 2) {
          color = new THREE.Color(0xffffff);
        } else {
          const trackWidth = pathPoint.width;
          const canyonFloorWidth = trackWidth / 2 + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
          const distFromTrackEdge = Math.abs(localCoords.t) - canyonFloorWidth;

          if (
            heightAboveBase < TERRAIN_CONFIG.CANYON_HEIGHT - 5 &&
            distFromTrackEdge > 0 &&
            distFromTrackEdge < TERRAIN_CONFIG.WALL_WIDTH
          ) {
            const progress = Math.min(1.0, distFromTrackEdge / TERRAIN_CONFIG.WALL_WIDTH);
            const terraceSteps = 6;
            const wallHeight = progress * TERRAIN_CONFIG.CANYON_HEIGHT;
            const wallSpaceX = localCoords.s * 0.1;
            const wallSpaceY = wallHeight * 0.15;
            const progressInStep = (progress * terraceSteps) % 1.0;
            const isOnLedge = progressInStep < 0.15 || progressInStep > 0.85;

            if (isOnLedge) {
              const ledgeNoise = this.generator.sampleNoise(wallSpaceX, wallSpaceY) * 0.5 + 0.5;
              const rockColor = new THREE.Color(0x666666);
              const snowColor = new THREE.Color(0xeeeeee);
              const snowAmount = Math.min(ledgeNoise * 0.6 + 0.3, 0.8);
              color = rockColor.clone().lerp(snowColor, snowAmount);
            } else {
              const faceNoise =
                this.generator.sampleNoise(wallSpaceX * 2, wallSpaceY * 2) * 0.5 + 0.5;
              const rockColor = new THREE.Color(0x555555);
              const snowColor = new THREE.Color(0xaaaaaa);
              const snowAmount = Math.min(faceNoise * 0.2, 0.3);
              color = rockColor.clone().lerp(snowColor, snowAmount);
            }
          } else {
            const plateauNoise =
              this.generator.sampleNoise(localCoords.t * 0.1, localCoords.s * 0.1) * 0.3 + 0.7;
            color = new THREE.Color(0xffffff).multiplyScalar(plateauNoise);
          }
        }

        snowColors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    snowPos.needsUpdate = true;
    snowColors.needsUpdate = true;
    this.snowGeometry.computeVertexNormals();

    // --- 2. Scatter Obstacles ---
    this.scatterObstacles(points, startZ);
  }

  private scatterObstacles(points: PathPoint[], startZ: number): void {
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
    const gridSize = 5; // Spacing between potential tree positions
    const noiseScale = 0.1; // Frequency of noise sampling

    const lateralMax = CHUNK_WIDTH / 2;

    for (let row = 0; row < CHUNK_LENGTH; row += gridSize) {
      const zFraction = row / CHUNK_LENGTH;
      const scaledIndex = zFraction * (points.length - 1);
      const pathIndex = Math.floor(scaledIndex);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];

      for (let t = -lateralMax; t < lateralMax; t += gridSize) {
        const worldX = pathPoint.x + pathPoint.rightX * t;
        const worldZ = pathPoint.z + pathPoint.rightZ * t;
        const { t: localT, s: localS } = this.generator.projectToLocalXZ(worldX, worldZ, pathPoint);

        const trackWidth = pathPoint.width;
        const halfTrack = trackWidth / 2;
        const canyonFloorWidth = halfTrack + TERRAIN_CONFIG.CANYON_FLOOR_OFFSET;
        const distFromTrackEdge = Math.abs(localT) - canyonFloorWidth;

        if (Math.abs(localT) < halfTrack) {
          continue;
        }

        const isOnBank = Math.abs(localT) > halfTrack && distFromTrackEdge <= 0;
        const isOnCliff = distFromTrackEdge > 0 && distFromTrackEdge < TERRAIN_CONFIG.WALL_WIDTH;
        const isOnPlateau = distFromTrackEdge >= TERRAIN_CONFIG.WALL_WIDTH;

        const noiseValue = this.generator.sampleNoise(worldX * noiseScale, localS * noiseScale);
        const normalizedNoise = (noiseValue + 1) / 2;
        const y = this.generator.getSnowHeightAt(worldX, worldZ, pathPoint);

        let placeTree: TreeArchetype | null = null;
        let placeDeadTree = false;
        let placeRock = false;

        if (isOnBank) {
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
    // Dispose geometries (materials are shared and owned by TerrainMaterials)
    this.snowGeometry.dispose();
    Object.values(this.treeGeometries).forEach((geo) => geo.dispose());
    this.deadTreeGeometry.dispose();
    this.rockGeometry.dispose();
  }
}
