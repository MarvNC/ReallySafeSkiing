import * as THREE from 'three';

import { PLAYER_CONFIG } from '../config/GameConfig';
import { InputManager } from '../core/InputManager';
import { PlayerPhysics } from './PlayerPhysics';
import { createHandWithPole, createSkiPair } from './SkierAssets';
import { SpeedLines } from './SpeedLines';

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

  private speedLines: SpeedLines;

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

  // Track current bank angle for camera banking
  private currentCameraBank = 0;

  // Base camera pitch (vertical tilt) - dynamically adjusted based on slope
  private basePitch: number = PLAYER_CONFIG.camera.tiltRadians;

  private physics: PlayerPhysics;

  // Animation State
  public isCrashed = false;

  // Crash Camera State
  private crashStartPos = new THREE.Vector3();
  private crashStartQuat = new THREE.Quaternion();

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
    camera.rotation.x = this.basePitch; // Slight downward tilt to see skis
    mesh.add(camera);

    this.mesh = mesh;
    this.camera = camera;
    
    // Speed Lines
    this.speedLines = new SpeedLines();
    this.camera.add(this.speedLines.mesh);
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
    // We handle crash animation from GameApp now, so we always process normally
    // GameApp will control the camera separately during crash
    this.physics.applyControls(this.input, deltaTime);
    this.physics.syncToThree(this.mesh);
    if (!this.isCrashed) {
      this.updateVisuals(deltaTime);
    }
  }

  triggerCrash(): void {
    if (this.isCrashed) return;
    this.isCrashed = true;
    // Notify physics
    this.physics.setCrashed(true);
  }

  captureCrashCameraState(): void {
    // Capture the exact world position/rotation of the camera at the moment of impact
    this.camera.getWorldPosition(this.crashStartPos);
    this.camera.getWorldQuaternion(this.crashStartQuat);
  }

  syncFromPhysics(): void {
    this.physics.syncToThree(this.mesh);
  }

  /**
   * Set the camera's base pitch angle based on the slope.
   * Formula: basePitch = -(slopeAngle + horizonOffset)
   * This ensures the camera looks down the slope, matching the terrain angle.
   */
  public setSlopeAngle(angleDegrees: number): void {
    // Convert slope to radians
    const slopeRad = THREE.MathUtils.degToRad(angleDegrees);

    // Calculate ideal pitch:
    // We want to look down the slope, plus a slight fixed downward tilt (offset)
    // to center the player and see the path ahead.
    // Based on current tuning: 20deg slope needs ~0.6 rad tilt.
    // 0.6 - degToRad(20) ~= 0.25 offset
    const horizonOffset = 0.25;

    this.basePitch = -(slopeRad + horizonOffset);

    // Apply immediately if not crashed
    if (!this.isCrashed) {
      this.camera.rotation.x = this.basePitch;
    }
  }

  private updateVisuals(deltaTime: number): void {
    const isBraking = this.input.isBraking();
    // Read directly from the Source of Truth in Physics
    const isPoling = this.physics.isPushing;

    const time = performance.now() / 1000;
    const speed = this.physics.getSpeed(); // Requires getting speed from physics
    
    // Convert to km/h for the effect
    const speedKmh = speed * 3.6;
    this.speedLines.update(speedKmh);

    // Convert km/h to m/s (divide by 3.6)
    const maxSpeedMs = PLAYER_CONFIG.skis.maxSpeedKmh / 3.6;
    const speedRatio = Math.min(1.0, speed / maxSpeedMs); // 0 to 1 based on speed

    // NEW: Get the smoothed steering value from physics
    const smoothSteering = this.physics.getSteeringValue();
    // smoothSteering is positive for LEFT, negative for RIGHT

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

      // REPLACED: Use smoothSteering instead of raw turnInput
      // smoothSteering is +1 (Left) to -1 (Right)

      // Rotation Z: Banking (Carving)
      // Roll the skis based on how hard we are currently steering
      const bankAngle = smoothSteering * PLAYER_CONFIG.skis.maxTurnRoll;
      targets.left.rot.z = bankAngle;
      targets.right.rot.z = bankAngle;

      // Rotation Y: Steering (Pointing into turn)
      const steerAngle =
        smoothSteering * PLAYER_CONFIG.skis.maxTurnYaw * PLAYER_CONFIG.skis.turnAnimationMultiple;
      targets.left.rot.y = steerAngle;
      targets.right.rot.y = steerAngle;

      // Position Z: Parallel Offset
      // Scale offset by steering intensity
      targets.left.pos.z = -smoothSteering * PLAYER_CONFIG.skis.carveOffsetZ;
      targets.right.pos.z = smoothSteering * PLAYER_CONFIG.skis.carveOffsetZ;
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

    // --- CAMERA BANKING ---
    // Calculate target bank angle based on steering
    // Standard banking: Steer Left -> Roll Left (CCW, +Z)
    let targetBank = 0;

    // Only bank if we are moving significantly and not just pivoting
    // (Optional: multiply by bankSpeedRatio to reduce tilt at low speeds)
    const bankSpeedRatio = Math.min(1.0, speed / 10.0); // 0-1 cap at 10m/s

    targetBank = smoothSteering * PLAYER_CONFIG.camera.maxBankAngle * bankSpeedRatio;

    // Smoothly interpolate current bank to target
    const bankLerp = 1.0 - Math.exp(-PLAYER_CONFIG.camera.bankSmoothingSpeed * deltaTime);
    this.currentCameraBank = THREE.MathUtils.lerp(this.currentCameraBank, targetBank, bankLerp);

    // Apply rotations
    // Keep the existing X tilt (Pitch)
    this.camera.rotation.x = this.basePitch;
    // Apply new Z tilt (Roll)
    this.camera.rotation.z = this.currentCameraBank;

    // Update Hands (using the existing logic or the refined version below)
    this.updateHands(deltaTime, isBraking, isPoling, time, smoothSteering);
  }

  // Refactored Hand logic into its own method for cleanliness
  private updateHands(
    deltaTime: number,
    isBraking: boolean,
    isPoling: boolean,
    time: number,
    smoothSteering: number // NEW param
  ): void {
    // Calculate target X positions for hands based on steering input
    let targetLeftHandX = PLAYER_CONFIG.hands.leftOffset.x;
    let targetRightHandX = PLAYER_CONFIG.hands.rightOffset.x;

    // Don't apply lateral movement when braking - keep hands in default position
    if (!isBraking) {
      // Use smoothSteering (-1 Right to +1 Left) to drive hand lateral position
      // Note: smoothSteering sign matches the logic: + is Left

      const swayAmount =
        smoothSteering *
        PLAYER_CONFIG.hands.lateralMovementAmount *
        PLAYER_CONFIG.skis.turnAnimationMultiple;

      // If smoothSteering is positive (Left), we want to move Left.
      // Looking at existing logic: Left key subtracted lateralMovementAmount.
      // So Left = negative X offset.

      targetLeftHandX -= swayAmount;
      targetRightHandX -= swayAmount;
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

  // Camera control methods for crash sequence (managed from GameApp)
  public setCrashCameraValues(progress: number): void {
    // Calculate Desired World Position
    // 1. Get current player world position (where they are tumbling)
    const playerWorldPos = new THREE.Vector3();
    this.mesh.getWorldPosition(playerWorldPos);

    // 2. Define the "End" camera position (Third person: back and up)
    // We want to be looking down at the player from behind/above
    const offset = new THREE.Vector3(0, 6, 12); // Up 6, Back 12
    const targetWorldPos = playerWorldPos.clone().add(offset);

    // 3. Interpolate from Crash Start -> Target
    // Using smoothstep for nicer ease-out
    const t = progress;
    const currentWorldPos = new THREE.Vector3().lerpVectors(this.crashStartPos, targetWorldPos, t);

    // 4. Calculate Desired World Rotation (Look at player)
    const dummyCam = new THREE.Object3D();
    dummyCam.position.copy(currentWorldPos);
    dummyCam.lookAt(playerWorldPos);
    const targetWorldQuat = dummyCam.quaternion;

    // Interpolate rotation
    const currentWorldQuat = this.crashStartQuat.clone().slerp(targetWorldQuat, t);

    // 5. Convert World Space -> Local Space
    // Since this.camera is a child of this.mesh (which is spinning wildly),
    // we must apply the inverse of the parent's world matrix.

    // Update parent world matrix first to be sure
    this.mesh.updateMatrixWorld();

    const parentInverse = this.mesh.matrixWorld.clone().invert();

    // Apply position: P_local = P_world * M_inv
    const localPos = currentWorldPos.clone().applyMatrix4(parentInverse);

    // Apply rotation: Q_local = Q_parent_inv * Q_world
    const parentQuatInv = this.mesh.quaternion.clone().invert();
    const localQuat = parentQuatInv.multiply(currentWorldQuat);

    // Apply to camera
    this.camera.position.copy(localPos);
    this.camera.quaternion.copy(localQuat);
  }

  public resetCamera(): void {
    this.camera.position.set(0, PLAYER_CONFIG.camera.eyeHeight, 0);
    this.camera.rotation.set(this.basePitch, 0, 0);
    this.currentCameraBank = 0; // Reset bank
    this.isCrashed = false;
    this.physics.setCrashed(false);
  }
}
