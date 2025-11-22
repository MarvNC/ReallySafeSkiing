import * as THREE from 'three';
import { mergeGeometries } from '../utils/mergeGeometries';

/**
 * Creates a low-poly pine tree geometry.
 * Consists of 3 cone geometries (foliage layers) and 1 cylinder (trunk).
 */
export function getTreeGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Trunk: cylinder
  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
  trunkGeometry.translate(0, 1.5, 0);
  geometries.push(trunkGeometry);

  // Foliage: 3 cones stacked
  const cone1 = new THREE.ConeGeometry(2, 4, 8);
  cone1.translate(0, 4, 0);
  geometries.push(cone1);

  const cone2 = new THREE.ConeGeometry(1.5, 3, 8);
  cone2.translate(0, 5.5, 0);
  geometries.push(cone2);

  const cone3 = new THREE.ConeGeometry(1, 2, 8);
  cone3.translate(0, 6.5, 0);
  geometries.push(cone3);

  const merged = mergeGeometries(geometries);
  merged.computeVertexNormals();

  // Cleanup
  geometries.forEach((geo) => geo.dispose());

  return merged;
}
