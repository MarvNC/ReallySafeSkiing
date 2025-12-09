import * as THREE from 'three';

import { COLOR_PALETTE } from '../config/GameConfig';

/**
 * Creates a single ski with a curved and rounded tip using procedural geometry.
 * The ski curves up (Y-axis) and forms a blunt, semi-circular shape at the tip.
 */
export function createSki(): THREE.Mesh; /**
 * Creates a ski with a realistic semi-circle tip.
 * Uses high segmentation and Z-axis sculpting to round the front edge physically.
 */
export function createSki(): THREE.Mesh {
  const width = 0.15;
  const length = 2.0;

  // CRITICAL CHANGE:
  // widthSegments is set to 8. This splits the "top plane" into 8 strips,
  // creating vertices we can move to form a true curve instead of a flat square edge.
  // depthSegments is 60 for very smooth bending.
  const geo = new THREE.BoxGeometry(width, 0.02, length, 8, 1, 60);
  const pos = geo.attributes.position;

  // Parameters
  const bendStart = -0.4; // Where the ski starts curving up
  const tipRadius = width / 2; // Radius for the semi-circle tip

  // We perform the modification in two passes or combined logic.
  // We need to modify Z first (to round the shape), then Y (to lift the tip).

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let z = pos.getZ(i);
    const y = pos.getY(i);

    // --- STEP 1: ROUND THE TIP (Z-Axis Sculpting) ---
    // The "front face" of the box is originally at z = -length/2 (-1.0).
    // We want to pull the outer corners BACK towards the tail to make a semi-circle.

    // Check if we are near the very front of the ski
    // We only apply this rounding to the last "tipRadius" of the geometry
    const tipBoundary = -(length / 2) + tipRadius;

    if (z < tipBoundary) {
      // Calculate circular offset.
      // At x=0 (center), offset is 0.
      // At x=max (edge), offset is full radius.
      // Formula: z = z + (Radius - sqrt(Radius^2 - x^2))
      // This creates a perfect semi-circle arc.
      const circleOffset = tipRadius - Math.sqrt(Math.max(0, tipRadius * tipRadius - x * x));

      // Apply the offset to Z. This physically curves the flat front edge.
      z += circleOffset;
      pos.setZ(i, z);
    }

    // --- STEP 2: LIFT THE TIP (Y-Axis Bending) ---
    // Now we lift based on the *new* Z position so the curve flows naturally.

    if (z < bendStart) {
      const dist = bendStart - z;

      // Quadratic lift for smooth rocker
      const lift = dist * dist * 0.45;
      pos.setY(i, y + lift);
    }
  }

  // Re-compute normals so the new curved surface reflects light correctly
  geo.computeVertexNormals();

  // Center the ski vertically
  geo.translate(0, 0.01, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: COLOR_PALETTE.charactersAndGear.redJacket,
    roughness: 0.4,
    metalness: 0.05,
    emissive: new THREE.Color(COLOR_PALETTE.charactersAndGear.redJacket),
    emissiveIntensity: 0.12,
    flatShading: true, // Highlights the low-poly faces nicely
  });
  mat.color.multiplyScalar(1.08);

  return new THREE.Mesh(geo, mat);
}

/**
 * Creates a ski pole with shaft, basket, and handle.
 */
export function createPole(): THREE.Group {
  const group = new THREE.Group();

  // Shaft - main pole body
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 1.2, 6),
    new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.terrainAndObjects.rockGray,
      flatShading: true,
    })
  );
  shaft.position.y = -0.6; // Pivot at top (hand position)

  // Basket - the circular disc near the bottom
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, 0.01, 6),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      flatShading: true,
    })
  );
  basket.position.y = -1.1;

  // Handle - grip at the top
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6),
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      flatShading: true,
    })
  );
  handle.position.y = 0;

  group.add(shaft, basket, handle);
  return group;
}

/**
 * Creates a low-poly mitten (glove) using composite box geometry.
 * Includes palm and thumb for a realistic hand shape.
 */
export function createMitten(): THREE.Group {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9,
    flatShading: true,
  });

  // Main hand (palm)
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.15), mat);

  // Thumb - rotated and offset to the side
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), mat);
  thumb.position.set(0.06, 0, 0.02);
  thumb.rotation.y = Math.PI / 4;

  group.add(palm, thumb);
  return group;
}

/**
 * Creates a complete pair of skis positioned for first-person view.
 */
export function createSkiPair(): THREE.Group {
  const skiGroup = new THREE.Group();

  const leftSki = createSki();
  leftSki.position.set(-0.3, 0, 0);

  const rightSki = createSki();
  rightSki.position.set(0.3, 0, 0);

  skiGroup.add(leftSki, rightSki);
  return skiGroup;
}

/**
 * Creates a hand group with mitten and pole for first-person view.
 */
export function createHandWithPole(): THREE.Group {
  const handGroup = new THREE.Group();

  const mitten = createMitten();
  const pole = createPole();

  // Angle pole back slightly for realistic skiing pose
  pole.rotation.x = -Math.PI / 16;
  pole.position.y = 0;

  handGroup.add(mitten, pole);
  return handGroup;
}
