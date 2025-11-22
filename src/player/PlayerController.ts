import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { createSkiPair, createHandWithPole } from './SkierAssets';

type PlayerOptions = {
  startPosition?: THREE.Vector3;
  radius?: number;
};

export class PlayerController {
  readonly mesh: THREE.Group; // Changed from Mesh to Group for complex hierarchy
  readonly camera: THREE.PerspectiveCamera;
  readonly body: RAPIER.RigidBody;

  // Visual components for animation
  private skis!: THREE.Group;
  private leftHand!: THREE.Group;
  private rightHand!: THREE.Group;
  private physicsMesh!: THREE.Mesh; // Invisible mesh synced with physics

  constructor(scene: THREE.Scene, physics: PhysicsSystem, options?: PlayerOptions) {
    const rapier = physics.getRapier();
    const radius = options?.radius ?? 1.6;
    const startPosition = options?.startPosition ?? new THREE.Vector3(0, 15, -5);

    // 1. Main container for all visual elements
    this.mesh = new THREE.Group();
    this.mesh.position.copy(startPosition);

    // 2. Camera setup (acts as the "head" in first-person view)
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    this.camera.position.set(0, 1.7, 0); // Eye height
    this.camera.rotation.x = -0.15; // Slight downward tilt to see skis
    this.mesh.add(this.camera);

    // 3. Setup visual components
    this.setupHands();
    this.setupSkis();

    // 4. Physics body - invisible sphere for smooth sliding mechanics
    // We create a separate mesh that PhysicsSystem can sync, but make it invisible
    this.physicsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.physicsMesh.visible = false;
    this.physicsMesh.position.copy(startPosition);
    scene.add(this.physicsMesh);

    this.body = physics.addBody(
      this.physicsMesh,
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(startPosition.x, startPosition.y, startPosition.z)
        .setLinearDamping(0.05)
        .setAngularDamping(0.6)
        .setCcdEnabled(true), // Enable Continuous Collision Detection to prevent tunneling
      rapier.ColliderDesc.ball(radius).setFriction(0.02).setRestitution(0.1)
    );

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
    this.leftHand.position.set(-0.3, -0.3, -0.5);
    this.leftHand.rotation.z = -Math.PI / 12; // Slight outward angle
    this.camera.add(this.leftHand);

    // Right Hand (mirrored)
    this.rightHand = createHandWithPole();
    this.rightHand.position.set(0.3, -0.3, -0.5);
    this.rightHand.rotation.z = Math.PI / 12; // Slight outward angle
    this.rightHand.scale.x = -1; // Mirror the geometry
    this.camera.add(this.rightHand);
  }

  /**
   * Setup skis that will move with the player but rotate independently.
   */
  private setupSkis(): void {
    this.skis = createSkiPair();
    this.skis.position.set(0, -1.5, 0.3); // Below the player, slightly forward
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
    const translation = this.body.translation();
    this.mesh.position.set(translation.x, translation.y, translation.z);

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
    const bobAmount = Math.min(speed * 0.02, 0.1); // Cap the bob amount
    const bobFrequency = Math.max(speed * 2, 1); // Faster bobbing at higher speeds

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
