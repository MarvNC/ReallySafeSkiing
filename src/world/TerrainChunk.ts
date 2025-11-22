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
  // Visuals
  readonly group: THREE.Group;
  private snowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private canyonMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private snowMaterial: THREE.MeshStandardMaterial;
  private canyonMaterial: THREE.MeshStandardMaterial;

  // Geometry
  private snowGeometry: THREE.PlaneGeometry;
  private canyonGeometry: THREE.PlaneGeometry;

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
    });

    this.canyonMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a5a5a,
      roughness: 0.9,
      flatShading: true,
    });

    // Initialize Geometries
    // Snow: Width CHUNK_WIDTH, Segments 30 x 50 (mapped to 60)
    // Note: CHUNK_SEGMENTS is 60. Let's use that for length segments to match logic.
    this.snowGeometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, 30, CHUNK_SEGMENTS);
    this.canyonGeometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, 20, CHUNK_SEGMENTS);

    // Initialize Meshes
    this.snowMesh = new THREE.Mesh(this.snowGeometry, this.snowMaterial);
    this.canyonMesh = new THREE.Mesh(this.canyonGeometry, this.canyonMaterial);

    this.snowMesh.receiveShadow = true;
    this.canyonMesh.receiveShadow = true;

    this.group.add(this.snowMesh);
    this.group.add(this.canyonMesh);

    // Physics setup (Heightfield resolution matches CHUNK_SEGMENTS)
    this.nrows = CHUNK_SEGMENTS + 1;
    this.ncols = CHUNK_SEGMENTS + 1; // Using consistent resolution for physics

    // We need a reference geometry for the physics grid base positions
    // Using a temporary plane geometry to get the grid distribution
    const physicsGeo = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const position = physicsGeo.attributes.position as THREE.BufferAttribute;
    const vertexCount = position.count;

    this.baseX = new Float32Array(vertexCount);
    this.baseZ = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      this.baseX[i] = position.getX(i);
      this.baseZ[i] = position.getY(i); // PlaneGeometry is defined in XY, so Y is Z
    }
    physicsGeo.dispose();

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

  get startZ(): number {
    return this.currentZ;
  }

  // Helper Methods

  private getTrackWidth(z: number, biome: BiomeType): number {
    // Use a unique noise channel for width so it varies organically
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

  private getCanyonHeight(distFromEdge: number, worldZ: number, baseHeightAtEdge: number): number {
    // Start exactly at the snow height (continuity) and go UP
    // const steepness = TERRAIN_CONFIG.WALL_STEEPNESS; // Unused locally but kept for reference
    const rise = Math.pow(distFromEdge, 2) * 2.0; // Exponential rise
    const jag = this.noise2D(distFromEdge * 0.5, worldZ * 0.1) * 5.0; // Large rock shapes
    return baseHeightAtEdge + rise + Math.abs(jag);
  }

  private generatePathSpine(startState: ChunkState): { points: PathPoint[], endState: ChunkState } {
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
        banking: banking
      });

      distanceInBiome += segmentLength;
    }

    const endState: ChunkState = {
      endX: currentX,
      endAngle: currentAngle,
      endZ: startState.endZ - CHUNK_LENGTH,
      biome: currentBiome,
      distanceInBiome: distanceInBiome
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
      // Map row to spine index
      // Note: PlaneGeometry is created with length CHUNK_LENGTH, centered? 
      // No, standard PlaneGeometry is centered at (0,0).
      // We need to map row index to path index.
      
      // row 0 is top (+Y in PlaneGeometry, but -Z in world usually? Wait.)
      // PlaneGeometry vertices are usually ordered row by row (top to bottom or bottom to top?)
      // Actually, let's look at standard Three.js PlaneGeometry.
      // It builds from +Y/2 to -Y/2 (top to bottom).
      // But our path is generated from 0 to CHUNK_LENGTH.
      // We should be consistent.
      // Let's assume row 0 matches start of chunk (local Z = -CHUNK_LENGTH/2) or similar.
      
      // In previous code:
      // const localZ = this.baseZ[i];
      // this.baseZ was from position.getY(i).
      // Standard PlaneGeometry(w, h): Y ranges from h/2 to -h/2.
      // So if we want to match path 0..CHUNK_LENGTH, we need to handle the offset.
      
      // Let's calculate zFraction for the row
      const zFraction = row / (snowRows - 1);
      // Since standard plane is top-down (+Y to -Y), let's handle that.
      // We want row 0 to be the START (top visually? or start of path?)
      // Usually game convention: +Z is forward/backward. 
      // Previous code: `localZ = i * segmentLength` in generatePathSpine.
      // And `worldZ = localZ + centerZ`.
      
      // In regenerate: `const localZ = this.baseZ[i];`
      // `baseZ` comes from `position.getY(i)`.
      // `position.getY` creates values from +height/2 to -height/2.
      
      // Let's just rely on the row index for consistency with the spine.
      // If we assume row 0 is the "start" of the chunk visually (lowest Z or highest Z?).
      // Let's invert if needed to match the spine which goes 0 -> Length.
      // If PlaneGeometry goes Top(+Y) -> Bottom(-Y), and we map +Y to Z=-Length/2...
      // Let's use the row index directly to interpolate along the spine.
      
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
        
        // Position in local space of the group
        // Group is at (0,0,startZ). 
        // Vertices should be relative to (0,0,0) in the group.
        // pathPoint.z is now 0 to -CHUNK_LENGTH (negative Z direction).
        // We align vertex Z directly to pathPoint.z (no centering offset).
        
        const vertexZ = pathPoint.z;

        snowPos.setXYZ(i, worldX, y, vertexZ);
      }
    }
    snowPos.needsUpdate = true;
    this.snowGeometry.computeVertexNormals();


    // --- 2. Update Canyon Geometry ---
    const canyonPos = this.canyonGeometry.attributes.position as THREE.BufferAttribute;
    const canyonRows = this.canyonGeometry.parameters.heightSegments + 1;
    const canyonCols = this.canyonGeometry.parameters.widthSegments + 1;

    for (let row = 0; row < canyonRows; row++) {
      const zFraction = row / (canyonRows - 1);
      const pathIndex = Math.floor(zFraction * CHUNK_SEGMENTS);
      const pathPoint = points[Math.min(pathIndex, points.length - 1)];
      const worldZ = startState.endZ + pathPoint.z;
      
      const halfWidth = pathPoint.width / 2;
      // Calculate snow height at the seam for continuity
      // At the seam, localX is effectively halfWidth (or -halfWidth)
      // banking affects height: +banking means right side is higher (if banking > 0) or lower.
      // getSnowHeight(localX, ...): 
      // We need height at the specific edge we are extending from.
      
      for (let col = 0; col < canyonCols; col++) {
        const i = row * canyonCols + col;
        
        // Original X in the plane geometry (used to determine left/right side)
        // Plane width is CHUNK_WIDTH. range [-50, 50].
        // We can just use the column index.
        // < 50% is left, > 50% is right.
        const colFraction = col / (canyonCols - 1);
        const isLeft = colFraction < 0.5;
        
        let finalX: number;
        let seamHeight: number;

        if (isLeft) {
           // Map 0..0.5 to -CHUNK_WIDTH/2 .. -halfWidth
           // Normalized sub-range 0..1 for the left side
           const subU = colFraction * 2; // 0..1
           // Lerp
           finalX = -CHUNK_WIDTH/2 + subU * (-halfWidth - (-CHUNK_WIDTH/2));
           
           // Seam height at -halfWidth
           seamHeight = this.getSnowHeight(-halfWidth, worldZ, pathPoint.banking);
           
           // We need distFromSeam. 
           // At finalX = -halfWidth, dist = 0.
           // At finalX = -CHUNK_WIDTH/2, dist = big.
           // dist = distance from the edge of the track (-halfWidth).
           // Since finalX is negative and < -halfWidth:
           // dist = |finalX - (-halfWidth)| = |-finalX - halfWidth|?
           // = -finalX - halfWidth (since -finalX > halfWidth)
        } else {
           // Map 0.5..1.0 to +halfWidth .. +CHUNK_WIDTH/2
           const subU = (colFraction - 0.5) * 2; // 0..1
           finalX = halfWidth + subU * (CHUNK_WIDTH/2 - halfWidth);
           
           seamHeight = this.getSnowHeight(halfWidth, worldZ, pathPoint.banking);
        }
        
        const distFromSeam = Math.abs(finalX) - halfWidth;
        
        let y: number;
        if (distFromSeam <= 0.001) {
            // Inside or on the track (shouldn't happen often with push logic, but boundary case)
            y = seamHeight;
        } else {
            y = this.getCanyonHeight(distFromSeam, worldZ, seamHeight);
        }

        // Apply path offset (The canyon should also follow the X curve of the spine?)
        // Yes, otherwise it won't line up with the snow track.
        const worldX = finalX + pathPoint.x;
        const vertexZ = pathPoint.z;

        canyonPos.setXYZ(i, worldX, y, vertexZ);
      }
    }
    canyonPos.needsUpdate = true;
    this.canyonGeometry.computeVertexNormals();


    // --- 3. Update Physics Collider (Heightfield) ---
    // We need to fill the physics heightfield which covers the FULL CHUNK_WIDTH.
    // We iterate over the physics grid (this.baseX/Z are just initial reference, we need the grid structure)
    // We used CHUNK_SEGMENTS for rows/cols.
    
    const heights = new Float32Array(this.nrows * this.ncols);
    let heightIndex = 0;
    
    // Fill heights array column-major
    // Since our path extends in negative Z (0 to -CHUNK_LENGTH) but Rapier heightfields
    // extend in positive Z, we reverse the row order so row 0 in array = end of chunk (Z=-CHUNK_LENGTH)
    // and row N = start of chunk (Z=0). We'll rotate the collider to match.
    for (let col = 0; col < this.ncols; col++) {
        for (let row = this.nrows - 1; row >= 0; row--) {
             // Reverse row iteration: row N-1 (last) maps to pathPoint[0] (start, Z=0)
             // row 0 maps to pathPoint[N] (end, Z=-CHUNK_LENGTH)
             
             const zFraction = (this.nrows - 1 - row) / (this.nrows - 1);
             const pathIndex = Math.floor(zFraction * CHUNK_SEGMENTS);
             const pathPoint = points[Math.min(pathIndex, points.length - 1)];
             const worldZ = startState.endZ + pathPoint.z;
             
             // X coordinate in local grid
             // The physics grid is a regular grid over CHUNK_WIDTH x CHUNK_LENGTH
             // x ranges from -CHUNK_WIDTH/2 to +CHUNK_WIDTH/2?
             // Actually, ColliderDesc.heightfield args are { x: CHUNK_WIDTH, y: 1, z: CHUNK_LENGTH }.
             // This defines the size. It assumes values are spread over this area.
             
             const xFraction = col / (this.ncols - 1);
             const localGridX = (xFraction - 0.5) * CHUNK_WIDTH;
             
             // Now we need to calculate the height at this specific (localGridX, worldZ).
             // But wait! The Visual mesh is CURVED along X (pathPoint.x).
             // The physics heightfield is a regular grid aligned with the body.
             // If the visual mesh "moves" left/right, the physics grid stays fixed in X/Z?
             // NO. The body is fixed. The heightfield is relative to the body.
             // But the visual terrain curves.
             // So we need to calculate the height at `localGridX` relative to the path.
             
             // Calculate distance from path center at this Z
             // effectiveLocalX is the distance from the path center
             const effectiveLocalX = localGridX - pathPoint.x;
             const halfWidth = pathPoint.width / 2;
             
             let y: number;
             
             if (Math.abs(effectiveLocalX) <= halfWidth) {
                 // On the snow track
                 y = this.getSnowHeight(effectiveLocalX, worldZ, pathPoint.banking);
             } else {
                 // In the canyon
                 const distFromEdge = Math.abs(effectiveLocalX) - halfWidth;
                 // We need the height at the seam to start from
                 // Determining which side we are on:
                 // If effectiveLocalX > halfWidth -> Right side -> seam at +halfWidth
                 // If effectiveLocalX < -halfWidth -> Left side -> seam at -halfWidth
                 
                 const seamX = (effectiveLocalX > 0) ? halfWidth : -halfWidth;
                 const seamHeight = this.getSnowHeight(seamX, worldZ, pathPoint.banking);
                 
                 y = this.getCanyonHeight(distFromEdge, worldZ, seamHeight);
             }
             
             heights[heightIndex++] = y;
        }
    }

    this.rebuildCollider(heights);

    return endState;
  }

  setWireframe(enabled: boolean): void {
    this.snowMaterial.wireframe = enabled;
    this.canyonMaterial.wireframe = enabled;
    this.snowMaterial.needsUpdate = true;
    this.canyonMaterial.needsUpdate = true;
  }

  dispose(): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }
    this.world.removeRigidBody(this.body);
    this.snowGeometry.dispose();
    this.canyonGeometry.dispose();
    this.snowMaterial.dispose();
    this.canyonMaterial.dispose();
  }

  private rebuildCollider(heights: Float32Array): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = undefined;
    }

    try {
      // Rapier heightfields extend in positive Z from origin, but our mesh extends in negative Z.
      // We've reversed the row order in the heights array, so we need to rotate the collider
      // 180 degrees around Y axis and translate it to align with our visual mesh.
      // Quaternion for 180° rotation around Y axis: (x=0, y=1, z=0, w=0)
      const colliderDesc = this.rapier.ColliderDesc.heightfield(
        this.nrows,
        this.ncols,
        heights,
        { x: CHUNK_WIDTH, y: 1, z: CHUNK_LENGTH },
      )
        .setFriction(0.05)
        .setRestitution(0)
        .setRotation({ x: 0, y: 1, z: 0, w: 0 }) // Quaternion: 180° rotation around Y to flip Z direction
        .setTranslation(0, 0, -CHUNK_LENGTH); // Translate to align start at Z=0

      this.collider = this.world.createCollider(colliderDesc, this.body);
    } catch (error) {
      console.error('Failed to rebuild terrain collider', error);
    }
  }
}
