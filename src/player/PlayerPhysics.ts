import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Action, InputManager } from '../core/InputManager';
import { PLAYER_CONFIG } from '../config/GameConfig';
import { PhysicsLayer, makeCollisionGroups } from '../physics/PhysicsLayers';

export class PlayerPhysics {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly tmpPosition = new THREE.Vector3();
  private readonly tmpVelocity = new THREE.Vector3();
  private yaw = 0;

  constructor(physics: PhysicsWorld, startPosition: THREE.Vector3) {
    const world = physics.getWorld();

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPosition.x, startPosition.y, startPosition.z)
      .setLinvel(0, 0, 0)
      .setAngularDamping(PLAYER_CONFIG.physics.angularDamping)
      .setLinearDamping(PLAYER_CONFIG.physics.linearDamping);

    this.body = world.createRigidBody(bodyDesc);
    this.body.setEnabledRotations(false, true, false, true);

    const colliderDesc = RAPIER.ColliderDesc.capsule(
      PLAYER_CONFIG.physics.capsuleHalfHeight,
      PLAYER_CONFIG.physics.capsuleRadius
    )
      .setMass(PLAYER_CONFIG.physics.mass)
      .setCollisionGroups(makeCollisionGroups(PhysicsLayer.Player, PhysicsLayer.World));

    this.collider = world.createCollider(colliderDesc, this.body);
  }

  applyControls(input: InputManager, deltaSeconds: number): void {
    const steerLeft = input.isActive(Action.SteerLeft);
    const steerRight = input.isActive(Action.SteerRight);
    const isBraking = input.isBraking();
    const isPushing = input.isActive(Action.Forward);

    // Update heading (yaw) based on steer input.
    let steer = 0;
    if (steerLeft) steer -= 1;
    if (steerRight) steer += 1;
    this.yaw += steer * PLAYER_CONFIG.physics.steerTurnSpeed * deltaSeconds;

    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.body.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();

    // Move forward when pushing.
    if (isPushing) {
      const impulse = forward
        .clone()
        .multiplyScalar(PLAYER_CONFIG.physics.moveForce * deltaSeconds);
      this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }

    // Subtle lateral impulse when steering for basic carve feel.
    if (steer !== 0) {
      const lateral = right
        .clone()
        .multiplyScalar(steer * PLAYER_CONFIG.physics.moveForce * 0.2 * deltaSeconds);
      this.body.applyImpulse({ x: lateral.x, y: lateral.y, z: lateral.z }, true);
    }

    // Apply extra damping when braking.
    const baseDamping = PLAYER_CONFIG.physics.linearDamping;
    const brakeDamping = isBraking ? PLAYER_CONFIG.physics.brakeDamping : 0;
    this.body.setLinearDamping(baseDamping + brakeDamping);

    // Clamp horizontal speed to avoid runaway acceleration.
    const vel = this.body.linvel();
    const horizontalSpeed = Math.hypot(vel.x, vel.z);
    if (horizontalSpeed > PLAYER_CONFIG.physics.maxSpeed) {
      const scale = PLAYER_CONFIG.physics.maxSpeed / horizontalSpeed;
      this.body.setLinvel({ x: vel.x * scale, y: vel.y, z: vel.z * scale }, true);
    }
  }

  syncToThree(target: THREE.Object3D): void {
    const translation = this.body.translation();
    const rotation = this.body.rotation();
    target.position.set(translation.x, translation.y, translation.z);
    target.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  getPosition(out = this.tmpPosition): THREE.Vector3 {
    const translation = this.body.translation();
    return out.set(translation.x, translation.y, translation.z);
  }

  getVelocity(out = this.tmpVelocity): THREE.Vector3 {
    const linvel = this.body.linvel();
    return out.set(linvel.x, linvel.y, linvel.z);
  }

  dispose(physics: PhysicsWorld): void {
    const world = physics.getWorld();
    world.removeCollider(this.collider, true);
    world.removeRigidBody(this.body);
  }
}
