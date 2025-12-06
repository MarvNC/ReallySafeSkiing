import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Action, InputManager } from '../core/InputManager';
import { PLAYER_CONFIG } from '../config/GameConfig';
import { PhysicsLayer, makeCollisionGroups } from '../physics/PhysicsLayers';

export type PlayerPhysicsDebugState = {
  yaw: number;
  isAwake: boolean;
  isPushing: boolean;
  isBraking: boolean;
  steerInput: number;
  linearVelocity: THREE.Vector3;
  forwardSpeed: number;
  lateralSpeed: number;
  pushForce: number; // Added to fix lint error
  lastForwardImpulse: number;
  lastLateralImpulse: number;
};

export class PlayerPhysics {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly tmpPosition = new THREE.Vector3();
  private readonly tmpVelocity = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();

  // Vectors for calculation
  private readonly currentVel = new THREE.Vector3();
  private readonly forwardDir = new THREE.Vector3();
  private readonly rightDir = new THREE.Vector3();
  private readonly upDir = new THREE.Vector3(0, 1, 0);

  private yaw = 0;
  private debugState: PlayerPhysicsDebugState = {
    yaw: 0,
    isAwake: false,
    isPushing: false,
    isBraking: false,
    steerInput: 0,
    linearVelocity: new THREE.Vector3(),
    forwardSpeed: 0,
    lateralSpeed: 0,
    pushForce: 0,
    lastForwardImpulse: 0,
    lastLateralImpulse: 0,
  };

  constructor(physics: PhysicsWorld, startPosition: THREE.Vector3) {
    const world = physics.getWorld();

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPosition.x, startPosition.y, startPosition.z)
      .setLinvel(0, 0, 0)
      // We handle damping manually now for anisotropy
      .setAngularDamping(PLAYER_CONFIG.physics.angularDamping)
      .setLinearDamping(0);

    this.body = world.createRigidBody(bodyDesc);
    this.body.setEnabledRotations(false, true, false, true);

    const colliderDesc = RAPIER.ColliderDesc.capsule(
      PLAYER_CONFIG.physics.capsuleHalfHeight,
      PLAYER_CONFIG.physics.capsuleRadius
    )
      .setMass(PLAYER_CONFIG.physics.mass)
      .setCollisionGroups(makeCollisionGroups(PhysicsLayer.Player, PhysicsLayer.World))
      .setFriction(0.0) // We simulate friction manually
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply);

    this.collider = world.createCollider(colliderDesc, this.body);
  }

  applyControls(input: InputManager, deltaSeconds: number): void {
    this.body.wakeUp();

    // 1. Inputs
    const steerLeft = input.isActive(Action.SteerLeft);
    const steerRight = input.isActive(Action.SteerRight);
    const isBraking = input.isBraking();
    const isPushing = input.isActive(Action.Forward);

    // 2. Rotate Player (Steering)
    let steer = 0;
    if (steerLeft) steer += 1;
    if (steerRight) steer -= 1;

    // Slightly reduce turning control while braking to simulate loss of edge control
    const turnSpeed = isBraking
      ? PLAYER_CONFIG.physics.steerTurnSpeed * 0.7
      : PLAYER_CONFIG.physics.steerTurnSpeed;

    this.yaw += steer * turnSpeed * deltaSeconds;

    this.tmpQuat.setFromAxisAngle(this.upDir, this.yaw);
    this.body.setRotation(
      { x: this.tmpQuat.x, y: this.tmpQuat.y, z: this.tmpQuat.z, w: this.tmpQuat.w },
      true
    );

    // 3. Get Current State
    const rawVel = this.body.linvel();
    this.currentVel.set(rawVel.x, rawVel.y, rawVel.z);

    this.forwardDir.set(0, 0, -1).applyQuaternion(this.tmpQuat).normalize();
    this.rightDir.set(1, 0, 0).applyQuaternion(this.tmpQuat).normalize();

    // 4. Project Velocity
    const forwardSpeed = this.currentVel.dot(this.forwardDir);
    const lateralSpeed = this.currentVel.dot(this.rightDir);

    // 5. Apply Forces

    // Lateral Friction (Drift control)
    const lateralForce = -lateralSpeed * PLAYER_CONFIG.physics.lateralFriction;

    // Forward Friction (Braking slide)
    let forwardDrag: number = PLAYER_CONFIG.physics.forwardFriction;
    if (isBraking) {
      forwardDrag = PLAYER_CONFIG.physics.brakeDamping;
    }
    const forwardForce = -forwardSpeed * forwardDrag;

    const impulse = new THREE.Vector3()
      .copy(this.rightDir)
      .multiplyScalar(lateralForce)
      .addScaledVector(this.forwardDir, forwardForce);

    // Poling Logic
    const currentSpeed = this.currentVel.length();
    let pushForceApplied = 0;

    if (isPushing && currentSpeed < PLAYER_CONFIG.physics.maxPoleSpeed) {
      const effectiveness = 1.0 - currentSpeed / PLAYER_CONFIG.physics.maxPoleSpeed;
      const pushImpulse = PLAYER_CONFIG.physics.poleForce * effectiveness;

      const pushVec = this.forwardDir.clone().multiplyScalar(pushImpulse);
      impulse.add(pushVec);
      pushForceApplied = pushImpulse; // Variable is now used below
    }

    impulse.multiplyScalar(PLAYER_CONFIG.physics.mass * deltaSeconds);
    this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);

    // 6. Debug Data
    // Calculate impulse components for debug display
    const forwardImpulse =
      forwardForce * PLAYER_CONFIG.physics.mass * deltaSeconds + pushForceApplied;
    const lateralImpulse = lateralForce * PLAYER_CONFIG.physics.mass * deltaSeconds;

    this.debugState = {
      yaw: this.yaw,
      isAwake: !this.body.isSleeping(),
      isPushing,
      isBraking,
      steerInput: steer,
      linearVelocity: this.currentVel,
      forwardSpeed,
      lateralSpeed,
      pushForce: pushForceApplied,
      lastForwardImpulse: forwardImpulse,
      lastLateralImpulse: lateralImpulse,
    };
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

  getDebugState(): PlayerPhysicsDebugState {
    return this.debugState;
  }
}
