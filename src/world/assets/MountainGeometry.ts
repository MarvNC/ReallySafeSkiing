import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// Simple pseudo-random noise if simplex isn't available,
// or use the imported one.
const noise2D = createNoise2D();

export function createBackgroundMountain(width: number, depth: number, height: number): THREE.Mesh {
  // 1. High Resolution Plane for good low-poly deformation
  const segmentsW = 50;
  const segmentsD = 20;
  let geometry: THREE.BufferGeometry = new THREE.PlaneGeometry(width, depth, segmentsW, segmentsD);

  // 2. Displace Vertices using Noise
  const pos = geometry.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // Local Y is World Z before rotation

    // Noise Coordinate Scaling (Lower = wider mountains)
    const nx = x * 0.0015;
    const ny = y * 0.0015;

    // Layered Noise (Octaves) for jagged look
    const n =
      noise2D(nx, ny) * 1.0 + noise2D(nx * 2, ny * 2) * 0.5 + noise2D(nx * 4, ny * 4) * 0.25;

    // Power function to sharpen peaks (makes it look like mountains, not hills)
    const elevation = Math.pow(Math.abs(n), 1.2);

    // Edge Tapering: Force edges to 0 so mountains blend into ground
    const distX = Math.abs(x) / (width / 2);
    const distY = Math.abs(y) / (depth / 2);
    const mask = Math.max(0, (1 - Math.pow(distX, 4)) * (1 - Math.pow(distY, 4)));

    // Apply height
    pos.setZ(i, elevation * height * mask);
  }

  // 3. Convert to Flat Shaded (Low Poly) Geometry
  // This splits shared vertices so every triangle has a hard edge
  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  // 4. Apply High-Contrast Vertex Colors
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);

  // COLOR PALETTE FIX:
  // Use a very dark, cool grey for rock to contrast with white snow
  const colorRock = new THREE.Color(0x2a2a35); // Very dark blue-grey
  const colorSnow = new THREE.Color(0xffffff);

  // Snow Line Calculation
  for (let i = 0; i < count; i++) {
    const h = geometry.attributes.position.getZ(i);

    // Thresholds: where snow starts and stops
    const snowLine = height * 0.25;
    const blendRange = height * 0.3;

    // Calculate blend factor (0 = Rock, 1 = Snow)
    let alpha = (h - snowLine) / blendRange;
    alpha = Math.max(0, Math.min(1, alpha));

    const c = colorRock.clone().lerp(colorSnow, alpha);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // 5. Material Setup
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true, // ESSENTIAL for low-poly look
    roughness: 0.9, // Rocks are rough
    metalness: 0.1,
    // Fix for "rendering on top":
    depthTest: true,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Rotate to lie flat on the ground
  mesh.rotation.x = -Math.PI / 2;

  return mesh;
}
