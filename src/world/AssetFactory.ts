/**
 * AssetFactory - Central export point for all asset geometries.
 * Each asset is now in its own file for better collaboration.
 *
 * Individual asset files:
 * - assets/TreeGeometry.ts
 * - assets/DeadTreeGeometry.ts
 * - assets/RockGeometry.ts
 */

export { getCoinGeometry } from './assets/CoinGeometry';
export { getDeadTreeGeometry } from './assets/DeadTreeGeometry';
export { getRockGeometry } from './assets/RockGeometry';
export type { TreeArchetype } from './assets/TreeGeometry';
export { createTreeGeometry, getTreeGeometry, TREE_ARCHETYPES } from './assets/TreeGeometry';
