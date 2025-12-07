import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

import { PLAYER_CONFIG } from '../config/GameConfig';
import { Action, InputManager } from '../core/InputManager';
import { makeCollisionGroups, PhysicsLayer } from '../physics/PhysicsLayers';
import { PhysicsWorld } from '../physics/PhysicsWorld';

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
  // New crash state
  private isCrashed = false;
  // Source of truth for pushing state
  private _isPushing = false;
  // NEW: Track the smoothed steering value (-1.0 to 1.0)
  private currentSteering = 0;
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
      .setCollisionGroups(
        // Collide with World AND Obstacle
        makeCollisionGroups(PhysicsLayer.Player, PhysicsLayer.World | PhysicsLayer.Obstacle)
      )
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS) // Listen for events
      .setFriction(PLAYER_CONFIG.physics.friction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply);

    this.collider = world.createCollider(colliderDesc, this.body);
  }

  // New method to trigger crash physics
  setCrashed(crashed: boolean): void {
    this.isCrashed = crashed;

    if (crashed) {
      // 1. Unlock rotation on all axes to simulate ragdoll/tumbling
      this.body.setEnabledRotations(true, true, true, true);

      // 2. Apply a random tumble impulse
      this.body.applyTorqueImpulse(
        {
          x: (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 50,
          z: (Math.random() - 0.5) * 50,
        },
        true
      );

      // 3. We do NOT zero velocity here anymore, let momentum carry them
    } else {
      // Reset to upright locked rotation
      this.body.wakeUp();
      this.body.setEnabledRotations(false, true, false, true);
      this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  getSpeed(): number {
    return this.currentVel.length();
  }

  // Public getter for external consumers (e.g., PlayerController)
  get isPushing(): boolean {
    return this._isPushing;
  }

  // NEW: Getter for the Controller to sync visuals
  getSteeringValue(): number {
    return this.currentSteering;
  }

  getColliderHandle(): number {
    return this.collider.handle;
  }

  applyControls(input: InputManager, deltaSeconds: number): void {
    // If crashed, stop processing inputs but allow physics engine to move the body
    if (this.isCrashed) {
      // Reset pushing state on crash
      this._isPushing = false;
      // Just update debug state and return
      // Do NOT force velocity to zero
      return;
    }

    this.body.wakeUp();

    // 1. Raw Inputs (Binary)
    const steerLeft = input.isActive(Action.SteerLeft);
    const steerRight = input.isActive(Action.SteerRight);
    const isBraking = input.isBraking();

    // 2. Calculate Target Input (-1 to 1)
    let targetSteer = 0;
    if (steerLeft) targetSteer += 1;
    if (steerRight) targetSteer -= 1;

    // 3. SMOOTHING LOGIC (The new "Analog" feel)
    // If we are providing input, move towards that input at 'accel' speed
    // If no input, move towards 0 at 'decay' speed
    const isProvidingInput = targetSteer !== 0;
    const smoothingSpeed = isProvidingInput
      ? PLAYER_CONFIG.physics.steerSmoothingAccel
      : PLAYER_CONFIG.physics.steerSmoothingDecay;

    // Move currentSteering towards targetSteer linearly
    const delta = smoothingSpeed * deltaSeconds;
    const diff = targetSteer - this.currentSteering;
    if (Math.abs(diff) <= delta) {
      this.currentSteering = targetSteer;
    } else {
      this.currentSteering += Math.sign(diff) * delta;
    }

    // 4. Apply Rotation
    // Reduce turning control while braking
    const turnSpeed = isBraking
      ? PLAYER_CONFIG.physics.steerTurnSpeed * 0.5
      : PLAYER_CONFIG.physics.steerTurnSpeed;

    // Calculate desired turn rate and cap it
    const desiredTurnRate = this.currentSteering * turnSpeed;
    const clampedTurnRate =
      Math.sign(desiredTurnRate) *
      Math.min(Math.abs(desiredTurnRate), PLAYER_CONFIG.physics.maxSteeringSpeed);

    this.yaw += clampedTurnRate * deltaSeconds;

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

    // Lateral Friction (Drift control from ski edge)
    const lateralForce = -lateralSpeed * PLAYER_CONFIG.physics.lateralFriction;

    // Forward snow friction (roughly linear in speed)
    let forwardForce = -forwardSpeed * PLAYER_CONFIG.physics.forwardFriction;

    // --- NEW: Non-linear air drag ---
    // Use total speed so drag acts on whatever direction you're actually moving.
    const speed = this.currentVel.length();
    if (speed > 0.1) {
      // v^2 drag: F_drag ~ -k * v * |v|
      const airK = PLAYER_CONFIG.physics.airDragCoeff;

      // Directional decomposition: project drag onto forward axis
      const speedSq = speed * speed;

      // How much of the velocity is forward (in terms of ratio)
      const forwardRatio = speed > 0 ? Math.abs(forwardSpeed) / speed : 0;

      const forwardSign = Math.sign(forwardSpeed) || 1;

      // Forward air drag - grows ~ v^2
      const forwardAir = -forwardSign * airK * speedSq * forwardRatio;

      forwardForce += forwardAir;
    }

    // Extra damping when snow-plowing
    if (isBraking) {
      const forwardSign = Math.sign(forwardSpeed) || 1;
      const brakeForce = -forwardSign * PLAYER_CONFIG.physics.brakeDamping * Math.abs(forwardSpeed);
      forwardForce += brakeForce;
    }

    const impulse = new THREE.Vector3()
      .copy(this.rightDir)
      .multiplyScalar(lateralForce)
      .addScaledVector(this.forwardDir, forwardForce);

    // Poling Logic - Centralized state calculation
    const currentSpeed = this.currentVel.length();
    let pushForceApplied = 0;

    // Convert maxPoleSpeed from km/h to m/s for comparison
    const maxPoleSpeedMs = PLAYER_CONFIG.physics.maxPoleSpeedKmh / 3.6;

    // The single source of truth calculation for pushing state
    this._isPushing = currentSpeed < maxPoleSpeedMs && !isBraking;

    // Apply forces based on the class property
    if (this._isPushing) {
      const effectiveness = 1.0 - currentSpeed / maxPoleSpeedMs;
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
      isPushing: this._isPushing,
      isBraking,
      steerInput: this.currentSteering, // Visualization will now show the smooth bar
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

  resetPosition(position: THREE.Vector3): void {
    this.body.setTranslation(position, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.yaw = 0;
    this.currentSteering = 0;
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }

  resetVelocity(): void {
    // Reset velocity while keeping current position
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}
