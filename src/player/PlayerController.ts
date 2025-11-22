import * as THREE from 'three';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { createSkiPair, createHandWithPole } from './SkierAssets';
import { PLAYER_CONFIG } from '../config/GameConfig';
import { GameEntity } from '../core/GameEntity';

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

  constructor(scene: THREE.Scene, physics: PhysicsSystem, options?: PlayerOptions) {
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
    // We create a separate mesh that PhysicsSystem can sync, but make it invisible
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
        .setLinearDamping(0.05)
        .setAngularDamping(0.6)
        .setCcdEnabled(true), // Enable Continuous Collision Detection to prevent tunneling
      rapier.ColliderDesc.ball(radius).setFriction(0.02).setRestitution(0.1)
    );

    super(mesh, body);

    this.camera = camera;

    // 4. Setup visual components
    this.setupHands();
    this.setupSkis();

    scene.add(this.mesh);

    console.log(
      `Player created at position: (${startPosition.x}, ${startPosition.y}, ${startPosition.z}) with radius ${radius}`
    );

    // Debug: Log player position periodically
    let lastLogTime = 0;
    setInterval(() => {
      const pos = this.body.translation();
      const vel = this.body.linvel();
      const now = Date.now();
      if (now - lastLogTime > 1000) {
        console.log(
          `Player pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) vel: (${vel.x.toFixed(1)}, ${vel.y.toFixed(1)}, ${vel.z.toFixed(1)})`
        );
        lastLogTime = now;
      }
    }, 100);
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
    // 1. Sync visual group position with physics body
    // Use base helper to keep position in sync while allowing custom rotation logic.
    (this as unknown as { syncPhysicsPosition: () => void }).syncPhysicsPosition();

    // 2. Rotate to face movement direction (skiing behavior)
    // Don't copy physics rotation - calculate based on velocity instead
    const vel = this.body.linvel();
    const horizontalSpeed = Math.sqrt(vel.x ** 2 + vel.z ** 2);

    if (horizontalSpeed > 0.5) {
      const targetAngle = Math.atan2(vel.x, vel.z);
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        targetAngle
      );
      // Smooth rotation using spherical linear interpolation (frame-rate independent)
      const rotationSpeed = Math.min(deltaTime * 5, 0.3); // Cap to prevent overshooting
      this.mesh.quaternion.slerp(targetQuat, rotationSpeed);
    }

    // 3. Procedural animation - bobbing hands for skiing motion
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    const time = performance.now() / 1000; // Convert to seconds
    const bobAmount = Math.min(speed * 0.02, PLAYER_CONFIG.animation.maxBobAmount); // Cap the bob amount
    const bobFrequency = Math.max(
      speed * PLAYER_CONFIG.animation.bobSpeedScale,
      PLAYER_CONFIG.animation.baseBobFrequency
    ); // Faster bobbing at higher speeds

    // Alternating hand motion
    const leftBob = Math.sin(time * bobFrequency) * bobAmount;
    const rightBob = Math.sin(time * bobFrequency + Math.PI) * bobAmount; // 180° phase shift

    this.leftHand.position.y = -0.3 + leftBob;
    this.rightHand.position.y = -0.3 + rightBob;

    // Slight forward/backward swing
    this.leftHand.position.z = -0.5 + leftBob * 0.5;
    this.rightHand.position.z = -0.5 + rightBob * 0.5;
  }
}
