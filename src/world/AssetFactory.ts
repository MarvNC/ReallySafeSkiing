import * as THREE from 'three';

/**
 * Merges multiple BufferGeometries into a single geometry.
 * This is a manual implementation since BufferGeometryUtils may not be available.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (geometries.length === 1) {
    return geometries[0].clone();
  }

  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  let offset = 0;

  for (const geometry of geometries) {
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const uv = geometry.attributes.uv;

    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }

    if (norm) {
      for (let i = 0; i < norm.count; i++) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
    } else {
      // Generate default normals if missing
      for (let i = 0; i < (pos?.count ?? 0); i++) {
        normals.push(0, 1, 0);
      }
    }

    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        uvs.push(uv.getX(i), uv.getY(i));
      }
    } else {
      // Generate default UVs if missing
      for (let i = 0; i < (pos?.count ?? 0); i++) {
        uvs.push(0, 0);
      }
    }

    // Update indices with offset
    if (geometry.index) {
      const indices = geometry.index.array;
      const mergedIndices: number[] = [];
      for (let i = 0; i < indices.length; i++) {
        mergedIndices.push(indices[i] + offset);
      }
      merged.setIndex(mergedIndices);
    }

    offset += pos?.count ?? 0;
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  return merged;
}

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

/**
 * Creates a low-poly rock geometry using a dodecahedron.
 */
export function getRockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(1.5, 0);
  geometry.computeVertexNormals();
  return geometry;
}
