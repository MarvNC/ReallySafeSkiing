export const PhysicsLayer = {
  Player: 0b0000000000000001,
  World: 0b0000000000000010,
} as const;

export type PhysicsLayer = (typeof PhysicsLayer)[keyof typeof PhysicsLayer];

/**
 * Rapier packs the membership into the lower 16 bits and the mask into the upper 16 bits.
 */
export function makeCollisionGroups(membership: PhysicsLayer, mask: number): number {
  return membership | (mask << 16);
}
