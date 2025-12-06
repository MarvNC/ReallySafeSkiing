import * as THREE from 'three';

import { PLAYER_CONFIG } from '../config/GameConfig';
import { Action, InputManager } from '../core/InputManager';
import { PlayerPhysics } from './PlayerPhysics';
import { createHandWithPole, createSkiPair } from './SkierAssets';

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

  // Hand rotation state for smooth rotation animation
  private currentLeftHandRotationZ: number = -PLAYER_CONFIG.hands.poleAngleRadians;
  private currentRightHandRotationZ: number = PLAYER_CONFIG.hands.poleAngleRadians;
  private currentLeftHandRotationX: number = 0;
  private currentRightHandRotationX: number = 0;

  // Add state trackers for smooth ski animation
  private currentSkiLeftRot = new THREE.Euler();
  private currentSkiRightRot = new THREE.Euler();
  private currentSkiLeftPos = new THREE.Vector3(-0.3, 0, 0); // Local to ski group
  private currentSkiRightPos = new THREE.Vector3(0.3, 0, 0); // Local to ski group

  private physics: PlayerPhysics;

  // Animation State
  private isCrashed = false;
  private crashTimer = 0;
  private readonly CRASH_DURATION = 3.0;

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
    if (this.isCrashed) {
      this.updateCrashAnimation(deltaTime);
    } else {
      this.physics.applyControls(this.input, deltaTime);
      this.physics.syncToThree(this.mesh);
      this.updateVisuals(deltaTime);
    }
  }

  triggerCrash(): void {
    if (this.isCrashed) return;
    this.isCrashed = true;
    this.crashTimer = 0;

    // Notify physics
    this.physics.setCrashed(true);
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
    const speed = this.physics.getSpeed(); // Requires getting speed from physics
    const speedRatio = Math.min(1.0, speed / 30.0); // 0 to 1 based on speed (max 30m/s)

    // --- SKI ANIMATION (New Logic) ---
    const leftSki = this.skis.children[0];
    const rightSki = this.skis.children[1];

    // 1. Calculate Targets
    const targets = {
      left: { rot: new THREE.Euler(), pos: new THREE.Vector3(-PLAYER_CONFIG.skis.baseWidth, 0, 0) },
      right: { rot: new THREE.Euler(), pos: new THREE.Vector3(PLAYER_CONFIG.skis.baseWidth, 0, 0) },
    };

    if (isBraking) {
      // --- BRAKING STATE ---
      // Rotation Y: V-Shape (Pigeon toed)
      targets.left.rot.y = -PLAYER_CONFIG.skis.brakeOpenAngle;
      targets.right.rot.y = PLAYER_CONFIG.skis.brakeOpenAngle;

      // Rotation Z: Edging (Roll inward to dig into snow)
      // Left ski rolls right (negative Z), Right ski rolls left (positive Z)
      targets.left.rot.z = -PLAYER_CONFIG.skis.brakeEdgeRoll;
      targets.right.rot.z = PLAYER_CONFIG.skis.brakeEdgeRoll;

      // Position X: Widen stance
      targets.left.pos.x = -PLAYER_CONFIG.skis.brakeWidth;
      targets.right.pos.x = PLAYER_CONFIG.skis.brakeWidth;

      // Add High Frequency Vibration (Chatter)
      const chatter = Math.sin(time * 50) * 0.02 * speedRatio;
      targets.left.rot.x += chatter;
      targets.right.rot.x -= chatter;
    } else {
      // --- GLIDING / TURNING STATE ---

      // Determine Turn Input (-1 Right, 0 Center, 1 Left)
      let turnInput = 0;
      if (steerLeft) turnInput = 1;
      if (steerRight) turnInput = -1;

      // Rotation Z: Banking (Carving)
      // If turning Left (+1), we roll Left (+Z rotation)
      const bankAngle = turnInput * PLAYER_CONFIG.skis.maxTurnRoll;
      targets.left.rot.z = bankAngle;
      targets.right.rot.z = bankAngle;

      // Rotation Y: Steering (Pointing into turn)
      const steerAngle = turnInput * PLAYER_CONFIG.skis.maxTurnYaw;
      targets.left.rot.y = steerAngle;
      targets.right.rot.y = steerAngle;

      // Position Z: Parallel Offset (Inside ski moves back)
      if (turnInput !== 0) {
        // Turning Left: Left ski is inside (moves back), Right ski outside (moves forward)
        targets.left.pos.z = -turnInput * PLAYER_CONFIG.skis.carveOffsetZ;
        targets.right.pos.z = turnInput * PLAYER_CONFIG.skis.carveOffsetZ;
      }

      // --- SPEED SHAKE (Visual Instability) ---
      if (speedRatio > 0.5) {
        const shake = (speedRatio - 0.5) * PLAYER_CONFIG.skis.vibrationIntensity;
        // Independent noise for each ski
        targets.left.pos.y += (Math.random() - 0.5) * shake;
        targets.right.pos.y += (Math.random() - 0.5) * shake;
        targets.left.rot.z += (Math.random() - 0.5) * shake;
        targets.right.rot.z += (Math.random() - 0.5) * shake;
      }
    }

    // 2. Apply Smooth Interpolation (Lerp)
    const lerpFactor = 1.0 - Math.exp(-PLAYER_CONFIG.skis.animationSpeed * deltaTime);

    // Apply Left Ski
    this.currentSkiLeftRot.x = THREE.MathUtils.lerp(
      this.currentSkiLeftRot.x,
      targets.left.rot.x,
      lerpFactor
    );
    this.currentSkiLeftRot.y = THREE.MathUtils.lerp(
      this.currentSkiLeftRot.y,
      targets.left.rot.y,
      lerpFactor
    );
    this.currentSkiLeftRot.z = THREE.MathUtils.lerp(
      this.currentSkiLeftRot.z,
      targets.left.rot.z,
      lerpFactor
    );
    this.currentSkiLeftPos.lerp(targets.left.pos, lerpFactor);
    leftSki.rotation.copy(this.currentSkiLeftRot);
    leftSki.position.copy(this.currentSkiLeftPos);

    // Apply Right Ski
    this.currentSkiRightRot.x = THREE.MathUtils.lerp(
      this.currentSkiRightRot.x,
      targets.right.rot.x,
      lerpFactor
    );
    this.currentSkiRightRot.y = THREE.MathUtils.lerp(
      this.currentSkiRightRot.y,
      targets.right.rot.y,
      lerpFactor
    );
    this.currentSkiRightRot.z = THREE.MathUtils.lerp(
      this.currentSkiRightRot.z,
      targets.right.rot.z,
      lerpFactor
    );
    this.currentSkiRightPos.lerp(targets.right.pos, lerpFactor);
    rightSki.rotation.copy(this.currentSkiRightRot);
    rightSki.position.copy(this.currentSkiRightPos);

    // Update Hands (using the existing logic or the refined version below)
    this.updateHands(deltaTime, steerLeft, steerRight, isBraking, isPoling, time);
  }

  // Refactored Hand logic into its own method for cleanliness
  private updateHands(
    deltaTime: number,
    steerLeft: boolean,
    steerRight: boolean,
    isBraking: boolean,
    isPoling: boolean,
    time: number
  ): void {
    // Calculate target X positions for hands based on steering input
    let targetLeftHandX = PLAYER_CONFIG.hands.leftOffset.x;
    let targetRightHandX = PLAYER_CONFIG.hands.rightOffset.x;

    // Don't apply lateral movement when braking - keep hands in default position
    if (!isBraking) {
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

    // Hand Rotation (Braking)
    // Calculate target rotations based on braking state
    let targetLeftHandRotationZ = -PLAYER_CONFIG.hands.poleAngleRadians;
    let targetRightHandRotationZ = PLAYER_CONFIG.hands.poleAngleRadians;
    let targetLeftHandRotationX = 0;
    let targetRightHandRotationX = 0;

    if (isBraking) {
      // When braking, rotate hands inward and forward
      // Left hand: rotate Z more positive (toward center), X forward (positive)
      targetLeftHandRotationZ =
        -PLAYER_CONFIG.hands.poleAngleRadians + PLAYER_CONFIG.hands.brakeRotationInward;
      targetLeftHandRotationX = PLAYER_CONFIG.hands.brakeRotationForward;

      // Right hand: rotate Z more negative (toward center), X forward (positive)
      targetRightHandRotationZ =
        PLAYER_CONFIG.hands.poleAngleRadians - PLAYER_CONFIG.hands.brakeRotationInward;
      targetRightHandRotationX = PLAYER_CONFIG.hands.brakeRotationForward;
    }

    // Smoothly interpolate current rotations toward target
    const rotationLerp = 1 - Math.exp(-PLAYER_CONFIG.hands.rotationAnimationSpeed * deltaTime);
    this.currentLeftHandRotationZ = THREE.MathUtils.lerp(
      this.currentLeftHandRotationZ,
      targetLeftHandRotationZ,
      rotationLerp
    );
    this.currentRightHandRotationZ = THREE.MathUtils.lerp(
      this.currentRightHandRotationZ,
      targetRightHandRotationZ,
      rotationLerp
    );
    this.currentLeftHandRotationX = THREE.MathUtils.lerp(
      this.currentLeftHandRotationX,
      targetLeftHandRotationX,
      rotationLerp
    );
    this.currentRightHandRotationX = THREE.MathUtils.lerp(
      this.currentRightHandRotationX,
      targetRightHandRotationX,
      rotationLerp
    );

    // Apply rotations to hands
    this.leftHand.rotation.z = this.currentLeftHandRotationZ;
    this.leftHand.rotation.x = this.currentLeftHandRotationX;
    this.rightHand.rotation.z = this.currentRightHandRotationZ;
    this.rightHand.rotation.x = this.currentRightHandRotationX;

    // Hand Animation (Poling or Bobbing)
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

  private updateCrashAnimation(dt: number): void {
    this.crashTimer += dt;

    // 1. Fall phase (0.0 - 0.5s)
    if (this.crashTimer < 0.5) {
      const t = this.crashTimer / 0.5;
      const ease = (x: number) => x * x; // Quadratic ease in

      // Rotate camera sideways (90 deg Z) and slightly down (pitch)
      this.camera.rotation.z = THREE.MathUtils.lerp(0, -Math.PI / 2, ease(t));
      this.camera.rotation.x = THREE.MathUtils.lerp(
        PLAYER_CONFIG.camera.tiltRadians,
        -Math.PI / 4,
        ease(t)
      );

      // Drop camera to ground level (relative to player mesh)
      this.camera.position.y = THREE.MathUtils.lerp(
        PLAYER_CONFIG.camera.eyeHeight,
        0.5,
        ease(t)
      );

      // Flail hands
      this.leftHand.rotation.z = THREE.MathUtils.lerp(
        -PLAYER_CONFIG.hands.poleAngleRadians,
        Math.PI,
        ease(t)
      );
      this.rightHand.rotation.z = THREE.MathUtils.lerp(
        PLAYER_CONFIG.hands.poleAngleRadians,
        -Math.PI,
        ease(t)
      );
    }
    // 2. Lying on ground phase (0.5s - 2.5s) - Stay static
    else if (this.crashTimer < 2.5) {
      // Maybe slight jitter/groan movement here if desired
    }
    // 3. Recovery phase (2.5s - 3.0s)
    else if (this.crashTimer < this.CRASH_DURATION) {
      const t = (this.crashTimer - 2.5) / 0.5;
      const ease = (x: number) => 1 - Math.pow(1 - x, 3); // Cubic ease out

      // Reset Camera
      this.camera.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, 0, ease(t));
      this.camera.rotation.x = THREE.MathUtils.lerp(
        -Math.PI / 4,
        PLAYER_CONFIG.camera.tiltRadians,
        ease(t)
      );
      this.camera.position.y = THREE.MathUtils.lerp(
        0.5,
        PLAYER_CONFIG.camera.eyeHeight,
        ease(t)
      );

      // Reset Hands
      this.leftHand.rotation.z = THREE.MathUtils.lerp(
        Math.PI,
        -PLAYER_CONFIG.hands.poleAngleRadians,
        ease(t)
      );
      this.rightHand.rotation.z = THREE.MathUtils.lerp(
        -Math.PI,
        PLAYER_CONFIG.hands.poleAngleRadians,
        ease(t)
      );
    }
    // 4. Finish
    else {
      this.isCrashed = false;
      this.physics.setCrashed(false);
      // Force immediate sync to ensure clean state
      this.physics.syncToThree(this.mesh);
    }
  }
}
