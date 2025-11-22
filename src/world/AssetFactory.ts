/**
 * AssetFactory - Central export point for all asset geometries.
 * Each asset is now in its own file for better collaboration.
 *
 * Individual asset files:
 * - assets/TreeGeometry.ts
 * - assets/DeadTreeGeometry.ts
 * - assets/RockGeometry.ts
 */

export { getTreeGeometry, createTreeGeometry, TREE_ARCHETYPES } from './assets/TreeGeometry';
export type { TreeArchetype } from './assets/TreeGeometry';
export { getDeadTreeGeometry } from './assets/DeadTreeGeometry';
export { getRockGeometry } from './assets/RockGeometry';
