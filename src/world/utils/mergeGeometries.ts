import * as THREE from 'three';

/**
 * Merges multiple BufferGeometries into a single geometry.
 * This is a manual implementation since BufferGeometryUtils may not be available.
 */
export function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
  const mergedIndices: number[] = [];
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
      for (let i = 0; i < indices.length; i++) {
        mergedIndices.push(indices[i] + offset);
      }
    }

    offset += pos?.count ?? 0;
  }

  if (mergedIndices.length > 0) {
    merged.setIndex(mergedIndices);
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  return merged;
}
