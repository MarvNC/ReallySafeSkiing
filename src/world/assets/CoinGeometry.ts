import * as THREE from 'three';

export function getCoinGeometry(): THREE.BufferGeometry {
  // Simple torus-like coin; thin to keep silhouette clean.
  const geometry = new THREE.TorusGeometry(0.9, 0.25, 12, 24);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}
