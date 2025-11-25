import * as THREE from 'three';
import { createSkiPair, createHandWithPole } from './SkierAssets';
import { PLAYER_CONFIG } from '../config/GameConfig';
import { Action, InputManager } from '../core/InputManager';
import { PlayerPhysics } from './PlayerPhysics';

type PlayerOptions = {
  startPosition?: THREE.Vector3;
  radius?: number;
  playerPhysics: PlayerPhysics;
};

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  readonly mesh: THREE.Group;

  // Visual components for animation
  private skis!: THREE.Group;
  private leftHand!: THREE.Group;
  private rightHand!: THREE.Group;

  private input: InputManager;

  // Hand animation state for smooth lateral movement
  private currentLeftHandX: number = PLAYER_CONFIG.hands.leftOffset.x;
  private currentRightHandX: number = PLAYER_CONFIG.hands.rightOffset.x;

  private physics: PlayerPhysics;

  constructor(scene: THREE.Scene, input: InputManager, options: PlayerOptions) {
    const startPosition = options.startPosition ?? PLAYER_CONFIG.startPosition.clone();

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

    this.mesh = mesh;
    this.camera = camera;
    this.input = input;
    this.physics = options.playerPhysics;

    // 4. Setup visual components
    this.setupHands();
    this.setupSkis();

    scene.add(this.mesh);

    // Ensure visuals start aligned with physics
    this.physics.syncToThree(this.mesh);

    console.log(
      `Player created at position: (${startPosition.x}, ${startPosition.y}, ${startPosition.z})`
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
   * Update player animations.
   */
  update(deltaTime: number): void {
    this.physics.applyControls(this.input, deltaTime);
    this.physics.syncToThree(this.mesh);
    this.updateVisuals(deltaTime);
  }

  syncFromPhysics(): void {
    this.physics.syncToThree(this.mesh);
  }

  private updateVisuals(deltaTime: number): void {
    const steerLeft = this.input.isActive(Action.SteerLeft);
    const steerRight = this.input.isActive(Action.SteerRight);
    const isBraking = this.input.isBraking();
    const isPoling = this.input.isActive(Action.Forward);

    const time = performance.now() / 1000;

    // Calculate target X positions for hands based on steering input
    let targetLeftHandX = PLAYER_CONFIG.hands.leftOffset.x;
    let targetRightHandX = PLAYER_CONFIG.hands.rightOffset.x;

    if (steerLeft) {
      // Move both hands left when steering left
      targetLeftHandX =
        PLAYER_CONFIG.hands.leftOffset.x - PLAYER_CONFIG.hands.lateralMovementAmount;
      targetRightHandX =
        PLAYER_CONFIG.hands.rightOffset.x - PLAYER_CONFIG.hands.lateralMovementAmount;
    } else if (steerRight) {
      // Move both hands right when steering right
      targetLeftHandX =
        PLAYER_CONFIG.hands.leftOffset.x + PLAYER_CONFIG.hands.lateralMovementAmount;
      targetRightHandX =
        PLAYER_CONFIG.hands.rightOffset.x + PLAYER_CONFIG.hands.lateralMovementAmount;
    }

    // Smoothly interpolate current X positions toward target
    const lateralLerp = 1 - Math.exp(-PLAYER_CONFIG.hands.lateralAnimationSpeed * deltaTime);
    this.currentLeftHandX = THREE.MathUtils.lerp(
      this.currentLeftHandX,
      targetLeftHandX,
      lateralLerp
    );
    this.currentRightHandX = THREE.MathUtils.lerp(
      this.currentRightHandX,
      targetRightHandX,
      lateralLerp
    );

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

    // 3. Hand Animation (Poling or Bobbing)
    if (isPoling) {
      // Poling animation: hands move forward and backward (alternating)
      const poleFrequency = 2.5; // Cycles per second for poling motion
      const poleReach = 0.4; // How far forward the hands reach
      const poleVertical = 0.15; // Vertical movement during pole plant

      // Alternating motion: left and right hands are out of phase
      const leftPhase = Math.sin(time * poleFrequency * Math.PI * 2);
      const rightPhase = Math.sin(time * poleFrequency * Math.PI * 2 + Math.PI); // 180 degrees out of phase

      // Left hand: forward when pushing, back when recovering
      this.leftHand.position.z = PLAYER_CONFIG.hands.leftOffset.z + leftPhase * poleReach;
      this.leftHand.position.y =
        PLAYER_CONFIG.hands.leftOffset.y + Math.max(0, leftPhase) * poleVertical;

      // Right hand: forward when pushing, back when recovering
      this.rightHand.position.z = PLAYER_CONFIG.hands.rightOffset.z + rightPhase * poleReach;
      this.rightHand.position.y =
        PLAYER_CONFIG.hands.rightOffset.y + Math.max(0, rightPhase) * poleVertical;

      // Apply smooth lateral movement
      this.leftHand.position.x = this.currentLeftHandX;
      this.rightHand.position.x = this.currentRightHandX;
    } else {
      // Idle pose: lock to base offsets with lateral smoothing only.
      this.leftHand.position.set(
        this.currentLeftHandX,
        PLAYER_CONFIG.hands.leftOffset.y,
        PLAYER_CONFIG.hands.leftOffset.z
      );
      this.rightHand.position.set(
        this.currentRightHandX,
        PLAYER_CONFIG.hands.rightOffset.y,
        PLAYER_CONFIG.hands.rightOffset.z
      );
    }
  }
}
