import * as THREE from 'three';

import { COLOR_PALETTE } from '../constants/colors';

export type TerrainMaterials = {
  snow: THREE.MeshStandardMaterial;
  tree: THREE.MeshStandardMaterial;
  deadTree: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
};

let cachedMaterials: TerrainMaterials | null = null;

export function getTerrainMaterials(): TerrainMaterials {
  if (cachedMaterials) return cachedMaterials;

  const snow = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
    vertexColors: true,
  });

  const tree = new THREE.MeshStandardMaterial({
    color: 0xffffff, // White to allow instance colors to show correctly
    roughness: 0.8,
    flatShading: true,
    vertexColors: true, // Enable vertex colors for brown trunks
  });

  const deadTree = new THREE.MeshStandardMaterial({
    color: COLOR_PALETTE.terrainAndObjects.darkBarkBrown,
    roughness: 0.9,
    flatShading: true,
  });

  const rock = new THREE.MeshStandardMaterial({
    color: COLOR_PALETTE.terrainAndObjects.rockGray,
    roughness: 0.9,
    flatShading: true,
  });

  cachedMaterials = {
    snow,
    tree,
    deadTree,
    rock,
  };

  return cachedMaterials;
}
