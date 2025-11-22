import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

/**
 * Base class for anything that has both a visual representation (mesh/group)
 * and a physics body. Provides helpers to keep them in sync.
 */
export abstract class GameEntity {
  readonly mesh: THREE.Object3D;
  readonly body: RAPIER.RigidBody;

  protected constructor(mesh: THREE.Object3D, body: RAPIER.RigidBody) {
    this.mesh = mesh;
    this.body = body;
  }

  /**
   * Sync only the position from physics to visuals.
   * Useful when you want to control rotation manually (e.g. based on velocity).
   */
  protected syncPhysicsPosition(): void {
    const translation = this.body.translation();
    this.mesh.position.set(translation.x, translation.y, translation.z);
  }

  /**
   * Sync both position and rotation from physics to visuals.
   */
  protected syncPhysicsTransform(): void {
    const translation = this.body.translation();
    const rotation = this.body.rotation();
    this.mesh.position.set(translation.x, translation.y, translation.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  /**
   * Default update implementation keeps visuals fully in sync with physics.
   * Subclasses can override to add behavior but should usually call one of
   * the sync helpers above.
   *
   * @param deltaTime - Time elapsed since last frame in seconds.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(deltaTime: number): void {
    this.syncPhysicsTransform();
  }
}
