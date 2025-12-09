import * as THREE from 'three';

import { COLOR_PALETTE } from '../../config/GameConfig';
import { mergeGeometries } from '../utils/mergeGeometries';

// === Export constants for physics to use ===
export const TREE_TRUNK_RADIUS_TOP = 0.2;
export const TREE_TRUNK_RADIUS_BOTTOM = 0.3;
export const TREE_TRUNK_HEIGHT = 1.5;

const TRUNK_SEGMENTS = 6;
const FOLIAGE_SEGMENTS = 6;
const TRUNK_RADIUS_JITTER = 0.08;
const FOLIAGE_RADIUS_JITTER = 0.18;
const MAX_LAYER_OFFSET_FACTOR = 0.12; // % of layer radius used as lateral offset
const TIP_SHARPEN = 0.35; // target scale at very top of foliage layers
const TIP_LIFT_FACTOR = 0.12; // % of layer height to lift the tip

// === Configuration Source of Truth ===
export const TREE_CONFIG = {
  layerHeight: 1.2,
  layerStartY: 1.0,
  layerOverlap: 0.8, // 80% of height
} as const;

/**
 * Calculates the exact visual height of a tree based on its layer count.
 * Formula: Height = StartY + (Layers-1 * Offset) + LayerHeight
 */
export function getTreeHeight(layerCount: number): number {
  if (layerCount <= 0) return TREE_TRUNK_HEIGHT;

  // Calculate where the last layer starts
  const lastLayerY =
    TREE_CONFIG.layerStartY +
    (layerCount - 1) * (TREE_CONFIG.layerHeight * TREE_CONFIG.layerOverlap);

  // The top is the start of the last layer + the height of that layer
  return lastLayerY + TREE_CONFIG.layerHeight;
}

// Simple deterministic PRNG so trees look consistent between runs.
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Adds slight low-poly irregularities to a circular geometry so trees
 * feel less uniform while keeping the faceted look.
 */
function applyOrganicDistortion(
  geometry: THREE.BufferGeometry,
  rng: () => number,
  options: {
    radiusJitter: number;
    lean?: { x: number; z: number };
    tipSharpen?: number;
    tipLift?: number;
  }
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const height = Math.max(maxY - minY, 0.0001);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // 0 (bottom) -> 1 (top)
    const t = (y - minY) / height;
    const jitterScale =
      1 +
      (rng() - 0.5) *
        options.radiusJitter *
        // Keep a bit more volume toward the lower-mid section
        (0.55 + 0.45 * (1 - t * 0.35));

    const tipStrength = t > 0.65 ? (t - 0.65) / 0.35 : 0;
    const sharpenScale = options.tipSharpen
      ? THREE.MathUtils.lerp(1, options.tipSharpen, tipStrength)
      : 1;
    const finalScale = jitterScale * sharpenScale;

    const leanX = options.lean?.x ?? 0;
    const leanZ = options.lean?.z ?? 0;

    const adjustedY = y + (options.tipLift ?? 0) * tipStrength;

    pos.setXYZ(i, x * finalScale + leanX * t, adjustedY, z * finalScale + leanZ * t);
  }

  pos.needsUpdate = true;
}

/**
 * Creates a low-poly pine tree geometry with variable layer count.
 * Uses CylinderGeometry for both trunk and foliage layers to achieve the low-poly look.
 *
 * @param layerCount - Number of foliage layers (2-4 recommended for performance)
 * @returns Merged BufferGeometry ready for InstancedMesh
 */
export function createTreeGeometry(layerCount: number): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const geometryInfo: Array<{ geometry: THREE.BufferGeometry; isTrunk: boolean }> = [];

  const random = makeRng(layerCount * 9973 + 17);
  const treeLean = {
    x: (random() - 0.5) * 0.16,
    z: (random() - 0.5) * 0.16,
  };

  // Trunk: cylinder with low radial segments for low-poly look
  const trunkGeo = new THREE.CylinderGeometry(
    TREE_TRUNK_RADIUS_TOP,
    TREE_TRUNK_RADIUS_BOTTOM,
    TREE_TRUNK_HEIGHT,
    TRUNK_SEGMENTS
  );
  applyOrganicDistortion(trunkGeo, random, {
    radiusJitter: TRUNK_RADIUS_JITTER,
    lean: treeLean,
    tipSharpen: 0.9,
  });
  trunkGeo.translate(0, 0.75, 0); // Move pivot to bottom
  geometries.push(trunkGeo);
  geometryInfo.push({ geometry: trunkGeo, isTrunk: true });

  // Foliage Layers: stacked cylinders (cones) with decreasing size
  let currentY = TREE_CONFIG.layerStartY;
  let currentRadius = 1.5;

  for (let i = 0; i < layerCount; i++) {
    // Use CylinderGeometry with different top/bottom radius to create cone shape
    const coneGeo = new THREE.CylinderGeometry(
      currentRadius * 0.52, // Top radius (narrower)
      currentRadius, // Bottom radius (wider)
      TREE_CONFIG.layerHeight, // Height
      FOLIAGE_SEGMENTS // Radial segments (low for low-poly look)
    );

    applyOrganicDistortion(coneGeo, random, {
      radiusJitter: FOLIAGE_RADIUS_JITTER,
      lean: treeLean,
      tipSharpen: TIP_SHARPEN,
      tipLift: TREE_CONFIG.layerHeight * TIP_LIFT_FACTOR,
    });

    // Slight per-layer rotation and lateral offset for variation
    coneGeo.rotateY(random() * Math.PI * 2);
    const offsetX = (random() - 0.5) * currentRadius * MAX_LAYER_OFFSET_FACTOR;
    const offsetZ = (random() - 0.5) * currentRadius * MAX_LAYER_OFFSET_FACTOR;

    // Position the layer
    coneGeo.translate(offsetX, currentY + TREE_CONFIG.layerHeight / 2, offsetZ);

    geometries.push(coneGeo);
    geometryInfo.push({ geometry: coneGeo, isTrunk: false });

    // Move cursor up using the constant factor
    currentY += TREE_CONFIG.layerHeight * TREE_CONFIG.layerOverlap;
    currentRadius *= 0.68; // Shrink next layer
  }

  // Merge into one draw call
  const mergedGeometry = mergeGeometries(geometries);
  mergedGeometry.computeVertexNormals(); // Vital for lighting

  // Add vertex colors: brown for trunk, green for foliage
  const colors: number[] = [];

  for (const info of geometryInfo) {
    const vertexCount = info.geometry.attributes.position.count;
    const isTrunk = info.isTrunk;

    if (isTrunk) {
      // Brown color for trunk from constants
      const trunkColor = new THREE.Color(COLOR_PALETTE.terrainAndObjects.darkBarkBrown);
      for (let i = 0; i < vertexCount; i++) {
        colors.push(trunkColor.r, trunkColor.g, trunkColor.b);
      }
    } else {
      // Green color for foliage from constants
      const foliageColor = new THREE.Color(COLOR_PALETTE.trees.pineGreen);
      for (let i = 0; i < vertexCount; i++) {
        colors.push(foliageColor.r, foliageColor.g, foliageColor.b);
      }
    }
  }

  mergedGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Cleanup
  geometries.forEach((geo) => geo.dispose());

  return mergedGeometry;
}

/**
 * Tree archetype definitions for instanced rendering.
 * Each archetype uses a different layer count for visual variety.
 */
export const TREE_ARCHETYPES = {
  small: { layerCount: 2 },
  medium: { layerCount: 3 },
  large: { layerCount: 4 },
} as const;

export type TreeArchetype = keyof typeof TREE_ARCHETYPES;
