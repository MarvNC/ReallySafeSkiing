import * as THREE from 'three';

/**
 * Creates a low-poly coin geometry for the arcade mode.
 * The coin is an extruded octagon with beveled edges to catch light.
 */
export function getCoinGeometry(): THREE.BufferGeometry {
  const radius = 0.55;
  const segments = 8;
  const shape = new THREE.Shape();

  // Create an octagon shape
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    const theta = i * step;
    // Start at angle 0 to have a vertex at (r, 0)
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();

  // Extrude settings for a chunky, low-poly look
  const extrudeSettings = {
    steps: 1,
    depth: 0.1, // Core thickness
    bevelEnabled: true,
    bevelThickness: 0.05, // Chamfer depth
    bevelSize: 0.05, // Chamfer width (adds to radius)
    bevelSegments: 1, // Single bevel segment for low-poly style
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // Center the geometry so it rotates around its center of mass
  geometry.center();

  // The ExtrudeGeometry is created in the XY plane and extruded along Z.
  // This means the coin "faces" the Z axis.
  // In the game, instances are rotated around the Y axis (yaw),
  // so the coin will spin around its vertical axis, showing faces and edges.

  geometry.computeVertexNormals();

  return geometry;
}
