import RAPIER from '@dimforge/rapier3d-compat';

import { PHYSICS_CONFIG } from '../config/GameConfig';
import { PhysicsLayer } from './PhysicsLayers';

/**
 * Owns the single Rapier world instance and advances it using a fixed timestep.
 */
export class PhysicsWorld {
  private world?: RAPIER.World;
  // Add Event Queue
  private eventQueue?: RAPIER.EventQueue;
  private gravity = new RAPIER.Vector3(
    PHYSICS_CONFIG.gravity.x,
    PHYSICS_CONFIG.gravity.y,
    PHYSICS_CONFIG.gravity.z
  );
  private accumulator = 0;
  private readonly timestep = 1 / 60;

  async init(): Promise<void> {
    if (this.world) return;

    await RAPIER.init();
    this.world = new RAPIER.World(this.gravity);
    this.eventQueue = new RAPIER.EventQueue(true); // Initialize queue
    this.accumulator = 0;
  }

  step(deltaSeconds: number, onContact?: (handle1: number, handle2: number) => void): void {
    const world = this.world;
    if (!world || !this.eventQueue) {
      throw new Error('PhysicsWorld.step called before init');
    }

    const clampedDelta = Math.min(deltaSeconds, PHYSICS_CONFIG.maxDeltaTime);
    this.accumulator += clampedDelta;

    while (this.accumulator >= this.timestep) {
      world.step(this.eventQueue); // Pass event queue to step

      // Process events
      this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        if (started && onContact) {
          onContact(handle1, handle2);
        }
      });

      this.accumulator -= this.timestep;
    }
  }

  getWorld(): RAPIER.World {
    if (!this.world) {
      throw new Error('PhysicsWorld accessed before initialization');
    }
    return this.world;
  }

  // Helper to check if a collider belongs to the Obstacle layer
  isObstacle(handle: number): boolean {
    if (!this.world) return false;
    const collider = this.world.getCollider(handle);
    const groups = collider.collisionGroups();
    // Check if the membership bits (lower 16) match Obstacle
    return (groups & 0xffff) === PhysicsLayer.Obstacle;
  }

  isCollectible(handle: number): boolean {
    if (!this.world) return false;
    const collider = this.world.getCollider(handle);
    const groups = collider.collisionGroups();
    return (groups & 0xffff) === PhysicsLayer.Collectible;
  }

  getCollider(handle: number): RAPIER.Collider | null {
    if (!this.world) return null;
    return this.world.getCollider(handle) ?? null;
  }

  dispose(): void {
    if (!this.world) return;
    this.world.free();
    this.world = undefined;
  }
}
