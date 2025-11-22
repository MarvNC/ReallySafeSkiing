import * as THREE from 'three';
import { COLOR_PALETTE } from '../constants/colors';

/**
 * Creates a single ski with curved tip using procedural geometry.
 * The ski curves up at the front to simulate realistic ski shape.
 */
export function createSki(): THREE.Mesh {
  // High segment count on Z axis for smooth bending
  const geo = new THREE.BoxGeometry(0.15, 0.02, 2.0, 1, 1, 20);
  const pos = geo.attributes.position;

  // Bend the tip (assuming negative Z is forward)
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < -0.5) {
      // The front 25% of the ski
      const offset = -0.5 - z; // Distance from bend start
      const lift = offset * offset * 0.5; // Quadratic curve for smooth upturn
      pos.setY(i, pos.getY(i) + lift);
    }
  }

  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: COLOR_PALETTE.charactersAndGear.redJacket,
    roughness: 0.4,
    flatShading: true,
  });

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
  leftSki.position.set(-0.2, 0, 0);

  const rightSki = createSki();
  rightSki.position.set(0.2, 0, 0);

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
  pole.rotation.x = Math.PI / 8;
  pole.position.y = 0;

  handGroup.add(mitten, pole);
  return handGroup;
}
