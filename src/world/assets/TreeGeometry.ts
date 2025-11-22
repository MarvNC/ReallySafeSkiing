import * as THREE from 'three';
import { mergeGeometries } from '../utils/mergeGeometries';

/**
 * Creates a low-poly pine tree geometry with variable layer count.
 * Uses CylinderGeometry for both trunk and foliage layers to achieve the low-poly look.
 * 
 * @param layerCount - Number of foliage layers (2-4 recommended for performance)
 * @returns Merged BufferGeometry ready for InstancedMesh
 */
export function createTreeGeometry(layerCount: number): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Trunk: cylinder with low radial segments for low-poly look
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 7);
  trunkGeo.translate(0, 0.75, 0); // Move pivot to bottom
  geometries.push(trunkGeo);

  // Foliage Layers: stacked cylinders (cones) with decreasing size
  const layerHeight = 1.2;
  let currentY = 1.0; // Start slightly overlapping trunk
  let currentRadius = 1.5;

  for (let i = 0; i < layerCount; i++) {
    // Use CylinderGeometry with different top/bottom radius to create cone shape
    const coneGeo = new THREE.CylinderGeometry(
      currentRadius * 0.5, // Top radius (narrower)
      currentRadius, // Bottom radius (wider)
      layerHeight, // Height
      7 // Radial segments (low for low-poly look)
    );

    // Position the layer
    coneGeo.translate(0, currentY + layerHeight / 2, 0);

    geometries.push(coneGeo);

    // Move cursor up for next layer (with slight overlap)
    currentY += layerHeight * 0.8;
    currentRadius *= 0.7; // Shrink next layer
  }

  // Merge into one draw call
  const mergedGeometry = mergeGeometries(geometries);
  mergedGeometry.computeVertexNormals(); // Vital for lighting

  // Cleanup
  geometries.forEach((geo) => geo.dispose());

  return mergedGeometry;
}

/**
 * Legacy function for backward compatibility.
 * Creates a tree with 3 layers (medium size).
 */
export function getTreeGeometry(): THREE.BufferGeometry {
  return createTreeGeometry(3);
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
