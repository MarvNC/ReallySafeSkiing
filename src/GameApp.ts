import * as THREE from 'three';
import { PlayerController } from './player/PlayerController';
import { TerrainManager } from './world/TerrainManager';
import { BackgroundEnvironment } from './world/BackgroundEnvironment';
import { DebugUI } from './debug/DebugUI';
import { DebugHelpers } from './debug/DebugHelpers';
import { PLAYER_CONFIG, LIGHTING_CONFIG } from './config/GameConfig';
import { Action, InputManager } from './core/InputManager';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PlayerPhysics } from './player/PlayerPhysics';

export class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private clock: THREE.Clock;
  private terrainManager!: TerrainManager;
  private player!: PlayerController;
  private playerPhysics!: PlayerPhysics;
  private physics!: PhysicsWorld;
  private isRunning = false;
  private container: HTMLElement;
  private debugCamera?: THREE.PerspectiveCamera;
  private activeCamera?: THREE.PerspectiveCamera;
  private useDebugCamera = false;
  private grid?: THREE.GridHelper;
  private debugUI?: DebugUI;
  private debugHelpers?: DebugHelpers;
  private input?: InputManager;
  private isPointerLocked = false;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private debugCameraSpeed = 50;
  private backgroundEnv?: BackgroundEnvironment;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.clock = new THREE.Clock();
  }

  async init(): Promise<void> {
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.onResize();
    window.addEventListener('resize', this.onResize);

    this.input = new InputManager(window);
    this.setupInputBindings();

    this.debugCamera = new THREE.PerspectiveCamera(70, this.getAspect(), 0.1, 8000);
    this.debugCamera.position.set(160, 180, 260);
    this.debugCamera.lookAt(0, 0, 0);
    this.activeCamera = this.debugCamera;

    // Setup mouse look for debug camera
    this.setupMouseLook();

    this.setupLights();
    this.addHelpers();

    // Update Fog to match the new sky horizon
    const horizonColor = new THREE.Color('#87CEEB'); // Sky blue
    this.scene.background = horizonColor;
    this.scene.fog = new THREE.Fog(horizonColor, 200, 2500); // Push fog back

    // Initialize Background
    this.backgroundEnv = new BackgroundEnvironment(this.scene);

    this.physics = new PhysicsWorld();
    await this.physics.init();

    // 1. Create Terrain Manager (generates the world)
    this.terrainManager = new TerrainManager(this.scene, this.physics);

    // 2. Get Start Position from generated path
    // Spawn player a bit farther forward along the path (50 points ahead)
    const startPoint = this.terrainManager.getPointAtOffset(50);
    // Calculate actual terrain height at start position (accounts for moguls, banking, etc.)
    const terrainHeight = this.terrainManager.getTerrainHeight(startPoint.x, startPoint.z);
    // Spawn player slightly above terrain (player radius + small buffer)
    const playerHeight = terrainHeight + PLAYER_CONFIG.radius + 0.5;
    const startPos = new THREE.Vector3(startPoint.x, playerHeight, startPoint.z);

    // 3. Create Player at Start Position
    this.playerPhysics = new PlayerPhysics(this.physics, startPos);
    this.player = new PlayerController(this.scene, this.input!, {
      startPosition: startPos,
      playerPhysics: this.playerPhysics,
    });

    if (!this.useDebugCamera) {
      this.activeCamera = this.player.camera;
    }

    // Initialize debug systems
    this.debugUI = new DebugUI(this.container);
    this.debugHelpers = new DebugHelpers(this.scene);
    this.debugHelpers.addWorldAxes(50);

    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  private setupInputBindings(): void {
    if (!this.input) return;

    // Map keys to high-level actions
    this.input.bindKey('c', Action.ToggleCamera);
    this.input.bindKey('v', Action.ToggleWireframe);
    this.input.bindKey('g', Action.ToggleGrid);
    this.input.bindKey('F2', Action.ToggleDebugUi);

    // Player controls
    this.input.bindKey('w', Action.Forward);
    this.input.bindKey('arrowup', Action.Forward);
    this.input.bindKey('a', Action.SteerLeft);
    this.input.bindKey('arrowleft', Action.SteerLeft);
    this.input.bindKey('d', Action.SteerRight);
    this.input.bindKey('arrowright', Action.SteerRight);

    // Debug camera controls (additional keys: S, Space, Shift)
    // W/A/D are shared with player controls and checked in debug camera update
    this.input.bindKey('s', Action.DebugMoveBackward);
    this.input.bindKey(' ', Action.DebugMoveUp);
    this.input.bindKey('shift', Action.DebugMoveDown);

    // Camera toggle
    this.input.on(Action.ToggleCamera, (_action, phase) => {
      if (phase !== 'pressed' || !this.player) return;
      this.useDebugCamera = !this.useDebugCamera;
      this.activeCamera = this.useDebugCamera ? this.debugCamera : this.player.camera;

      if (this.useDebugCamera && this.debugCamera) {
        // Position debug camera at player position
        const playerWorldPos = new THREE.Vector3();
        this.player.mesh.getWorldPosition(playerWorldPos);
        this.debugCamera.position.copy(playerWorldPos);

        // Match player's camera rotation
        const playerCameraRotation = new THREE.Euler().setFromQuaternion(
          this.player.camera.quaternion
        );
        this.euler.set(playerCameraRotation.x, playerCameraRotation.y, 0);
        this.debugCamera.rotation.set(this.euler.x, this.euler.y, this.euler.z);

        // Request pointer lock for mouse look
        this.renderer.domElement.requestPointerLock();
      } else {
        // Release pointer lock when switching back
        if (document.pointerLockElement === this.renderer.domElement) {
          document.exitPointerLock();
        }
      }

      console.info(`Camera toggled to ${this.useDebugCamera ? 'debug free' : 'first-person'}`);
    });

    // Terrain wireframe
    this.input.on(Action.ToggleWireframe, (_action, phase) => {
      if (phase !== 'pressed' || !this.terrainManager) return;
      const isWireframe = this.terrainManager.toggleWireframe();
      console.info(`Slope wireframe ${isWireframe ? 'on' : 'off'}`);
    });

    // Grid helper visibility
    this.input.on(Action.ToggleGrid, (_action, phase) => {
      if (phase !== 'pressed' || !this.grid) return;
      this.grid.visible = !this.grid.visible;
      console.info(`Grid ${this.grid.visible ? 'visible' : 'hidden'}`);
    });

    // Debug UI and helpers visibility
    this.input.on(Action.ToggleDebugUi, (_action, phase) => {
      if (phase !== 'pressed') return;
      const isVisible = this.debugUI?.toggle() ?? false;
      this.debugHelpers?.setVisible(isVisible);
      console.info(`Debug info ${isVisible ? 'visible' : 'hidden'}`);
    });
  }

  private setupMouseLook(): void {
    const onMouseMove = (event: MouseEvent): void => {
      if (!this.useDebugCamera || !this.debugCamera || !this.isPointerLocked) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      this.euler.setFromQuaternion(this.debugCamera.quaternion);
      this.euler.y -= movementX * 0.002;
      this.euler.x -= movementY * 0.002;

      // Clamp vertical rotation
      this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

      this.debugCamera.quaternion.setFromEuler(this.euler);
    };

    const onPointerLockChange = (): void => {
      this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
  }

  private setupLights(): void {
    const keyLight = new THREE.DirectionalLight(
      LIGHTING_CONFIG.keyLight.color,
      LIGHTING_CONFIG.keyLight.intensity
    );
    keyLight.position.copy(LIGHTING_CONFIG.keyLight.position);
    keyLight.castShadow = LIGHTING_CONFIG.keyLight.castShadow;
    keyLight.shadow.mapSize.set(
      LIGHTING_CONFIG.keyLight.shadow.mapSize.width,
      LIGHTING_CONFIG.keyLight.shadow.mapSize.height
    );
    keyLight.shadow.camera.near = LIGHTING_CONFIG.keyLight.shadow.camera.near;
    keyLight.shadow.camera.far = LIGHTING_CONFIG.keyLight.shadow.camera.far;
    keyLight.shadow.camera.left = LIGHTING_CONFIG.keyLight.shadow.camera.left;
    keyLight.shadow.camera.right = LIGHTING_CONFIG.keyLight.shadow.camera.right;
    keyLight.shadow.camera.top = LIGHTING_CONFIG.keyLight.shadow.camera.top;
    keyLight.shadow.camera.bottom = LIGHTING_CONFIG.keyLight.shadow.camera.bottom;
    keyLight.shadow.bias = LIGHTING_CONFIG.keyLight.shadow.bias;

    const fillLight = new THREE.DirectionalLight(
      LIGHTING_CONFIG.fillLight.color,
      LIGHTING_CONFIG.fillLight.intensity
    );
    fillLight.position.copy(LIGHTING_CONFIG.fillLight.position);

    const bounceLight = new THREE.HemisphereLight(
      LIGHTING_CONFIG.hemisphereLight.skyColor,
      LIGHTING_CONFIG.hemisphereLight.groundColor,
      LIGHTING_CONFIG.hemisphereLight.intensity
    );
    const ambient = new THREE.AmbientLight(
      LIGHTING_CONFIG.ambientLight.color,
      LIGHTING_CONFIG.ambientLight.intensity
    );

    this.scene.add(keyLight, fillLight, bounceLight, ambient);
  }

  private addHelpers(): void {
    const axes = new THREE.AxesHelper(10);
    this.grid = new THREE.GridHelper(200, 20, '#ff6b35', '#8c9ea8');
    this.grid.position.set(0, 0.01, 0);
    this.grid.visible = false;
    this.scene.add(axes, this.grid);
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    const delta = this.clock.getDelta();

    this.physics.step(delta);

    if (!this.useDebugCamera) {
      this.player.update(delta);
    } else {
      // Keep visuals in sync even when free camera is active
      this.player.syncFromPhysics();
    }

    this.terrainManager.update(this.playerPhysics.getPosition());

    // Update debug camera movement
    if (this.useDebugCamera && this.debugCamera && this.input) {
      const moveVector = new THREE.Vector3();
      const forward = new THREE.Vector3(0, 0, -1);
      const right = new THREE.Vector3(1, 0, 0);

      forward.applyQuaternion(this.debugCamera.quaternion);
      right.applyQuaternion(this.debugCamera.quaternion);

      // Forward/backward (W/S) - W uses Forward action, S uses DebugMoveBackward
      if (this.input.isActive(Action.Forward)) {
        moveVector.add(forward);
      }
      if (this.input.isActive(Action.DebugMoveBackward)) {
        moveVector.sub(forward);
      }

      // Left/right (A/D) - use SteerLeft/SteerRight actions
      if (this.input.isActive(Action.SteerLeft)) {
        moveVector.sub(right);
      }
      if (this.input.isActive(Action.SteerRight)) {
        moveVector.add(right);
      }

      // Up/down (Space/Shift)
      if (this.input.isActive(Action.DebugMoveUp)) {
        moveVector.y += 1;
      }
      if (this.input.isActive(Action.DebugMoveDown)) {
        moveVector.y -= 1;
      }

      // Normalize and apply speed
      if (moveVector.lengthSq() > 0) {
        moveVector.normalize();
        moveVector.multiplyScalar(this.debugCameraSpeed * delta);
        this.debugCamera.position.add(moveVector);
      }
    }

    // Update debug info
    if (this.debugUI && this.debugHelpers && this.player && this.playerPhysics) {
      const velocity = this.playerPhysics.getVelocity();
      const rotation = this.player.mesh.quaternion.clone();

      this.debugUI.update(
        this.player.mesh.position,
        velocity,
        rotation,
        this.activeCamera ?? this.player.camera,
        delta,
        this.renderer.shadowMap.enabled,
        {
          physics: this.playerPhysics.getDebugState(),
          input: {
            forward: this.input?.isActive(Action.Forward) ?? false,
            steerLeft: this.input?.isActive(Action.SteerLeft) ?? false,
            steerRight: this.input?.isActive(Action.SteerRight) ?? false,
            braking: this.input?.isBraking() ?? false,
          },
        }
      );

      this.debugHelpers.update(this.player.mesh.position, rotation, velocity);
    }

    // Update background environment
    const camera = this.activeCamera ?? this.player.camera;
    if (this.backgroundEnv) {
      // Get world position of camera (player camera is a child of mesh, so we need world position)
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      this.backgroundEnv.update(cameraWorldPos);
    }

    this.renderer.render(this.scene, camera);
    requestAnimationFrame(this.animate);
  };

  private onResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const aspect = width / height;
    if (this.player?.camera) {
      this.player.camera.aspect = aspect;
      this.player.camera.updateProjectionMatrix();
    }
    if (this.debugCamera) {
      this.debugCamera.aspect = aspect;
      this.debugCamera.updateProjectionMatrix();
    }
  };

  private getAspect(): number {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    return width / Math.max(1, height);
  }
}
