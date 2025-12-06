import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// Resolution - Lower than before for performance since we will have more mountains
const SEGMENTS = 32;

const noise2D = createNoise2D();

interface MountainOptions {
  width: number;
  height: number;
  noiseScale: number;
  detail: number; // 0 to 1
}

export function createPeakGeometry(options: MountainOptions): THREE.BufferGeometry {
  const { width, height, noiseScale, detail } = options;

  let geometry: THREE.BufferGeometry = new THREE.PlaneGeometry(
    width,
    width, // Square base
    SEGMENTS,
    SEGMENTS
  );

  const pos = geometry.attributes.position;

  // Random offset for this specific mountain so they don't all look identical
  const seedX = Math.random() * 1000;
  const seedY = Math.random() * 1000;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // Plane is XY, we rotate later

    // 1. Radial Mask (Cone shape)
    // Distance from center (0 to 1)
    const dist = Math.sqrt(x * x + y * y) / (width / 2);

    // Circular falloff: 1 at center, 0 at edges
    // Using smoothstep-like curve for natural slope
    const baseShape = Math.max(0, 1 - Math.pow(dist, 1.5));

    // 2. Noise Details
    const nx = x * noiseScale + seedX;
    const ny = y * noiseScale + seedY;

    // Layered noise
    const n1 = noise2D(nx, ny);
    const n2 = noise2D(nx * 2, ny * 2) * 0.5;
    const n3 = noise2D(nx * 4, ny * 4) * 0.25;

    // Combine base shape with noise
    const noiseSum = (n1 + n2 + n3) * detail;

    // Final Elevation
    // The baseShape defines the mountain silhouette, noise adds texture
    const elevation = baseShape * height + noiseSum * height * 0.2 * baseShape;

    pos.setZ(i, Math.max(0, elevation));
  }

  // Convert to low poly look
  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  // Rotate to sit on XZ plane
  geometry.rotateX(-Math.PI / 2);

  return geometry;
}
