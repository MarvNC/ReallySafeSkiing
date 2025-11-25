import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_CONFIG } from '../config/GameConfig';

/**
 * Owns the single Rapier world instance and advances it using a fixed timestep.
 */
export class PhysicsWorld {
  private world?: RAPIER.World;
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
    this.accumulator = 0;
  }

  step(deltaSeconds: number): void {
    const world = this.world;
    if (!world) {
      throw new Error('PhysicsWorld.step called before init');
    }

    const clampedDelta = Math.min(deltaSeconds, PHYSICS_CONFIG.maxDeltaTime);
    this.accumulator += clampedDelta;

    while (this.accumulator >= this.timestep) {
      world.step();
      this.accumulator -= this.timestep;
    }
  }

  getWorld(): RAPIER.World {
    if (!this.world) {
      throw new Error('PhysicsWorld accessed before initialization');
    }
    return this.world;
  }

  dispose(): void {
    if (!this.world) return;
    this.world.free();
    this.world = undefined;
  }
}
