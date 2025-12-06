import * as THREE from 'three';

import { mergeGeometries } from '../utils/mergeGeometries';

import { COLOR_PALETTE } from '../../constants/colors';

export function createMountainRangeGeometry(
  width: number,
  height: number,
  depth: number,
  count: number
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Create a cluster of cones/pyramids
  for (let i = 0; i < count; i++) {
    const r = Math.random();

    // Randomize dimensions
    const coneRadius = (width / count) * (1.5 + r);
    const coneHeight = height * (0.8 + Math.random() * 0.4);

    // Low radial segments for low-poly look (3-5 sides)
    const segments = Math.floor(3 + Math.random() * 3);

    const geometry = new THREE.ConeGeometry(coneRadius, coneHeight, segments);

    // Randomize position within the bounds
    const x = (Math.random() - 0.5) * width;
    const z = (Math.random() - 0.5) * depth;

    geometry.translate(x, coneHeight / 2, z);
    // Random rotation
    geometry.rotateY(Math.random() * Math.PI * 2);

    geometries.push(geometry);
  }

  const merged = mergeGeometries(geometries);
  merged.computeVertexNormals();

  // Add vertex colors (White top, Blueish-Grey bottom)
  const colors: number[] = [];
  const positions = merged.attributes.position;
  const countPos = positions.count;
  const topColor = new THREE.Color(COLOR_PALETTE.primaryEnvironment.snowWhite);
  const bottomColor = new THREE.Color(COLOR_PALETTE.primaryEnvironment.iceBlue);

  for (let i = 0; i < countPos; i++) {
    const y = positions.getY(i);
    // Normalize height for gradient (0 to height)
    const alpha = Math.max(0, Math.min(1, y / (height * 0.8)));

    const color = new THREE.Color().copy(bottomColor).lerp(topColor, alpha);
    colors.push(color.r, color.g, color.b);
  }

  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Cleanup
  geometries.forEach((g) => g.dispose());

  return merged;
}
