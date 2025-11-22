import * as THREE from 'three';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { createSkiPair, createHandWithPole } from './SkierAssets';
import { PLAYER_CONFIG, SKI_PHYSICS } from '../config/GameConfig';
import { GameEntity } from '../core/GameEntity';
import { Action, InputManager } from '../core/InputManager';

type PlayerOptions = {
  startPosition?: THREE.Vector3;
  radius?: number;
};

export class PlayerController extends GameEntity {
  readonly camera: THREE.PerspectiveCamera;

  // Visual components for animation
  private skis!: THREE.Group;
  private leftHand!: THREE.Group;
  private rightHand!: THREE.Group;

  private input: InputManager;
  private physics: PhysicsSystem;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsSystem,
    input: InputManager,
    options?: PlayerOptions
  ) {
    const rapier = physics.getRapier();
    const radius = options?.radius ?? PLAYER_CONFIG.radius;
    const startPosition = options?.startPosition ?? PLAYER_CONFIG.startPosition.clone();

    // 1. Main container for all visual elements
    const mesh = new THREE.Group();
    mesh.position.copy(startPosition);

    // 2. Camera setup (acts as the "head" in first-person view)
    const camera = new THREE.PerspectiveCamera(
      PLAYER_CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      PLAYER_CONFIG.camera.near,
      PLAYER_CONFIG.camera.far
    );
    camera.position.set(0, PLAYER_CONFIG.camera.eyeHeight, 0); // Eye height
    camera.rotation.x = PLAYER_CONFIG.camera.tiltRadians; // Slight downward tilt to see skis
    mesh.add(camera);

    // 3. Physics body - invisible sphere for smooth sliding mechanics
    const physicsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    physicsMesh.visible = false;
    physicsMesh.position.copy(startPosition);
    scene.add(physicsMesh);

    const body = physics.addBody(
      physicsMesh,
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(startPosition.x, startPosition.y, startPosition.z)
        .setLinearDamping(0.0) // We handle friction manually
        .setAngularDamping(1.0) // High damping for rotation stability
        .setCcdEnabled(true), // Enable Continuous Collision Detection to prevent tunneling
      rapier.ColliderDesc.ball(radius).setFriction(0.0).setRestitution(0.0) // Friction handled manually
    );

    // Lock rotation on X and Z axes (only allow Y/Yaw rotation)
    body.lockRotations(true, false); // Deprecated in some versions, checking API...
    // Rapier JS: setEnabledRotations(x, y, z, wakeUp)
    body.setEnabledRotations(false, true, false, true);

    super(mesh, body);

    this.camera = camera;
    this.input = input;
    this.physics = physics;

    // 4. Setup visual components
    this.setupHands();
    this.setupSkis();

    scene.add(this.mesh);

    console.log(
      `Player created at position: (${startPosition.x}, ${startPosition.y}, ${startPosition.z}) with radius ${radius}`
    );
  }

  /**
   * Setup hands and poles attached to camera for first-person view.
   */
  private setupHands(): void {
    // Left Hand
    this.leftHand = createHandWithPole();
    this.leftHand.position.copy(PLAYER_CONFIG.hands.leftOffset);
    this.leftHand.rotation.z = -PLAYER_CONFIG.hands.poleAngleRadians; // Slight outward angle
    this.camera.add(this.leftHand);

    // Right Hand (mirrored)
    this.rightHand = createHandWithPole();
    this.rightHand.position.copy(PLAYER_CONFIG.hands.rightOffset);
    this.rightHand.rotation.z = PLAYER_CONFIG.hands.poleAngleRadians; // Slight outward angle
    this.rightHand.scale.x = PLAYER_CONFIG.hands.rightMirrorScaleX; // Mirror the geometry
    this.camera.add(this.rightHand);
  }

  /**
   * Setup skis that will move with the player but rotate independently.
   */
  private setupSkis(): void {
    this.skis = createSkiPair();
    this.skis.position.copy(PLAYER_CONFIG.skis.offset); // Below the player, slightly forward
    this.skis.castShadow = true;
    this.skis.receiveShadow = true;
    this.mesh.add(this.skis);
  }

  /**
   * Update player position and animations.
   * Must be called every frame after physics update.
   */
  update(deltaTime: number): void {
    // 1. Handle Physics Inputs & Forces
    this.handleSkiPhysics(deltaTime);

    // 2. Sync visual group position with physics body
    this.syncPhysicsPosition();

    // Sync rotation from physics body (since we are using physics torque for turning now)
    const rotation = this.body.rotation();
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    // 3. Procedural animation
    this.updateVisuals(deltaTime);
  }

  private handleSkiPhysics(deltaTime: number): void {
    // Check inputs
    const steerLeft = this.input.isActive(Action.SteerLeft);
    const steerRight = this.input.isActive(Action.SteerRight);
    const isBraking = this.input.isBraking();

    // Ground Detection
    // Raycast down from center
    const origin = this.body.translation();
    const rapier = this.physics.getRapier();
    const ray = new rapier.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: 0, y: -1, z: 0 });
    // Ray length slightly more than radius to detect ground contact
    const maxToi = PLAYER_CONFIG.radius + 0.2;
    const hit = this.physics.getWorld().castRay(
      ray,
      maxToi,
      true
      // Filter out player's own collider? Rapier usually handles this if ray starts inside?
      // Assuming default groups work for now.
      // We might need to configure collision groups if self-intersection happens.
    );

    const isGrounded = !!hit;

    if (isGrounded) {
      // --- STEERING ---
      if (isBraking) {
        // No turning torque while braking (snowplow goes straight-ish or maintains current rot)
        // Optionally we could allow slow steering
      } else {
        if (steerLeft) {
          this.body.applyTorqueImpulse({ x: 0, y: SKI_PHYSICS.turnTorque * deltaTime, z: 0 }, true);
        }
        if (steerRight) {
          this.body.applyTorqueImpulse(
            { x: 0, y: -SKI_PHYSICS.turnTorque * deltaTime, z: 0 },
            true
          );
        }
      }

      // --- FORCES ---
      const linvel = this.body.linvel();
      const vel = new THREE.Vector3(linvel.x, linvel.y, linvel.z);

      // Get player forward and right vectors
      const rotation = this.body.rotation();
      const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();

      // Calculate Local Velocity (relative to facing)
      const localVelX = vel.dot(right); // Lateral speed
      const localVelZ = vel.dot(forward); // Forward speed

      // Lateral Force (Friction/Edge Grip)
      // Apply force opposite to lateral velocity to stop sliding sideways
      const lateralForceMag = -localVelX * SKI_PHYSICS.lateralFriction;
      const lateralForce = right.clone().multiplyScalar(lateralForceMag);

      // Forward Force (Friction/Drag)
      let forwardFriction: number = SKI_PHYSICS.forwardFriction;
      if (isBraking) {
        forwardFriction = SKI_PHYSICS.snowplowDrag;
      }

      // Apply drag opposite to forward movement
      // Note: We only apply drag, gravity handles the "propulsion" down slope
      const forwardForceMag = -localVelZ * forwardFriction;
      const forwardForce = forward.clone().multiplyScalar(forwardForceMag);

      // Gravity Boost (Optional "Punchy" feel)
      // Default gravity is already applied by physics engine.
      // If we want extra gravity along the slope or just stronger gravity:
      const gravityForce = new THREE.Vector3(0, -9.81 * (SKI_PHYSICS.gravityScale - 1), 0);

      // Combine forces
      const totalForce = lateralForce.add(forwardForce).add(gravityForce);

      // Apply to body
      // Using simple numeric object for Rapier
      this.body.addForce({ x: totalForce.x, y: totalForce.y, z: totalForce.z }, true);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateVisuals(_deltaTime: number): void {
    const steerLeft = this.input.isActive(Action.SteerLeft);
    const steerRight = this.input.isActive(Action.SteerRight);
    const isBraking = this.input.isBraking();

    const vel = this.body.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    const time = performance.now() / 1000;

    // 1. Ski Rotation
    const leftSki = this.skis.children[0];
    const rightSki = this.skis.children[1];

    if (isBraking) {
      // Snowplow: V-Shape
      // Left ski -25 degrees, Right ski +25 degrees
      leftSki.rotation.y = THREE.MathUtils.degToRad(-25);
      rightSki.rotation.y = THREE.MathUtils.degToRad(25);
    } else if (steerLeft || steerRight) {
      // Banking into turn?
      // Skis remain parallel usually during carving, but maybe slight offset
      leftSki.rotation.y = 0;
      rightSki.rotation.y = 0;
    } else {
      // Gliding parallel
      leftSki.rotation.y = 0;
      rightSki.rotation.y = 0;
    }

    // 2. Banking (Tilt player mesh)
    // We tilt the visual mesh (this.mesh is synced to physics body rotation)
    // But since we synced rotation in update(), this.mesh.quaternion matches body.
    // To add banking, we might need to rotate the child mesh or offset the camera/skis,
    // OR we can apply a local rotation to this.mesh relative to physics rotation?
    // Actually, PlayerController extends GameEntity, and update() calls syncPhysicsPosition() then sets rotation.
    // If we want visual banking that DOESN'T affect physics body, we should probably rotate a child container
    // OR apply the banking to this.mesh AFTER syncing with physics, but that desyncs it from collider.
    // The collider is a sphere, so rotation doesn't matter for collision.
    // So we can rotate `this.mesh` freely as long as we keep position synced.

    // Let's apply banking to `this.mesh` Z axis based on turning
    if (!isBraking) {
      let bankAngle = 0;
      if (steerLeft) bankAngle = THREE.MathUtils.degToRad(15); // Bank Left
      if (steerRight) bankAngle = THREE.MathUtils.degToRad(-15); // Bank Right

      // Smoothly interpolate banking
      // We need to modify the quaternion derived from physics
      // Apply banking to the Z axis of the local frame
      // Construct banking quaternion
      const bankQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        bankAngle
      );
      this.mesh.quaternion.multiply(bankQuat);
    }

    // 3. Bobbing Animation (Hands)
    const bobAmount = Math.min(speed * 0.02, PLAYER_CONFIG.animation.maxBobAmount);
    const bobFrequency = Math.max(
      speed * PLAYER_CONFIG.animation.bobSpeedScale,
      PLAYER_CONFIG.animation.baseBobFrequency
    );

    const leftBob = Math.sin(time * bobFrequency) * bobAmount;
    const rightBob = Math.sin(time * bobFrequency + Math.PI) * bobAmount;

    this.leftHand.position.y = -0.3 + leftBob;
    this.rightHand.position.y = -0.3 + rightBob;

    this.leftHand.position.z = -0.5 + leftBob * 0.5;
    this.rightHand.position.z = -0.5 + rightBob * 0.5;
  }
}
