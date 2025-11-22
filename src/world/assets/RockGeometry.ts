import * as THREE from 'three';

/**
 * Creates a low-poly rock geometry using a dodecahedron.
 */
export function getRockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(1.5, 0);
  geometry.computeVertexNormals();
  return geometry;
}
