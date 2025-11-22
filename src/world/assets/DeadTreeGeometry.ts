import * as THREE from 'three';

/**
 * Creates a low-poly fallen log/dead tree geometry.
 * A simple cylinder with slight distortion for organic feel.
 * Designed to be rotated 90 degrees to lay flat on terrain.
 */
export function getDeadTreeGeometry(): THREE.BufferGeometry {
  // Create a cylinder for the log
  const logGeo = new THREE.CylinderGeometry(0.25, 0.3, 3.0, 6);

  // Slight distortion for organic feel
  const positions = logGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Add slight noise to vertices
    const noise = Math.sin(y * 2) * 0.05;
    positions.setXYZ(i, x + noise, y, z);
  }

  logGeo.computeVertexNormals();

  return logGeo;
}
