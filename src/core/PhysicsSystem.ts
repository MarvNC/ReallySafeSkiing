import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_CONFIG } from '../config/GameConfig';

type SyncedBody = {
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
};

export class PhysicsSystem {
  private synced: SyncedBody[] = [];
  private rapier: typeof RAPIER;
  private world: RAPIER.World;

  private constructor(rapier: typeof RAPIER, world: RAPIER.World) {
    this.rapier = rapier;
    this.world = world;
  }

  static async create(gravity: THREE.Vector3 = PHYSICS_CONFIG.gravity): Promise<PhysicsSystem> {
    await RAPIER.init();
    const world = new RAPIER.World({
      x: gravity.x,
      y: gravity.y,
      z: gravity.z,
    });

    return new PhysicsSystem(RAPIER, world);
  }

  addBody(
    mesh: THREE.Object3D,
    rigidBodyDesc: RAPIER.RigidBodyDesc,
    colliderDesc: RAPIER.ColliderDesc
  ): RAPIER.RigidBody {
    const body = this.world.createRigidBody(rigidBodyDesc);
    this.world.createCollider(colliderDesc, body);
    this.synced.push({ mesh, body });

    this.syncMeshToBody(mesh, body);
    return body;
  }

  update(deltaTime: number): void {
    const clampedDt = Math.min(Math.max(deltaTime, 0), PHYSICS_CONFIG.maxDeltaTime);
    this.world.integrationParameters.dt = clampedDt;
    this.world.step();

    for (const { mesh, body } of this.synced) {
      const translation = body.translation();
      const rotation = body.rotation();
      mesh.position.set(translation.x, translation.y, translation.z);
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  getWorld(): RAPIER.World {
    return this.world;
  }

  getRapier(): typeof RAPIER {
    return this.rapier;
  }

  private syncMeshToBody(mesh: THREE.Object3D, body: RAPIER.RigidBody): void {
    const translation = body.translation();
    const rotation = body.rotation();
    mesh.position.set(translation.x, translation.y, translation.z);
    mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}
