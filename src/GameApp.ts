import * as THREE from 'three';

import { GAME_CONFIG, LIGHTING_CONFIG, PLAYER_CONFIG } from './config/GameConfig';
import { COLOR_PALETTE } from './constants/colors';
import { Action, InputManager } from './core/InputManager';
import { DebugHelpers } from './debug/DebugHelpers';
import { DebugUI } from './debug/DebugUI';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PlayerController } from './player/PlayerController';
import { PlayerPhysics } from './player/PlayerPhysics';
import { UIState, useGameStore } from './ui/store';
import { BackgroundEnvironment } from './world/BackgroundEnvironment';
import { TerrainManager } from './world/TerrainManager';

// 1. Define Game States
const GameState = {
  MENU: 0,
  PLAYING: 1,
  GAME_OVER: 2,
  PAUSED: 3,
  CRASHED: 4, // Crash sequence state
} as const;

type GameState = (typeof GameState)[keyof typeof GameState];

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

  // 2. Game Logic Variables
  private gameState: GameState = GameState.MENU;
  private timeRemaining: number = GAME_CONFIG.timerDuration;
  private startPosition: THREE.Vector3 = new THREE.Vector3();
  private topSpeed: number = 0; // Track top speed in km/h

  // Crash sequence variables
  private timeScale = 1.0;
  private crashTimer = 0;
  private readonly CRASH_DURATION = 3.0; // Real-time seconds

  // New Menu State
  private menuIndex = 0;
  private isAboutOpen = false;
  private readonly menuOptionsCount = 3; // Resume, Restart, Back to menu

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

    // Update Fog to match the new palette
    // Use the color from our palette configuration
    const fogColor = new THREE.Color(COLOR_PALETTE.background.fog);
    this.scene.background = new THREE.Color(COLOR_PALETTE.background.sky);
    // Denser fog starting closer to blend the "floor" disc edge
    this.scene.fog = new THREE.Fog(fogColor, 600, 5000);

    // Initialize Background
    this.backgroundEnv = new BackgroundEnvironment(this.scene);

    this.physics = new PhysicsWorld();
    await this.physics.init();

    const { slopeAngle, difficulty } = useGameStore.getState();

    // 1. Create Terrain Manager (generates the world)
    this.terrainManager = new TerrainManager(this.scene, this.physics, slopeAngle, difficulty);

    // 2. Get Start Position from generated path
    // Spawn player a bit farther forward along the path (50 points ahead)
    this.recalculateStartPosition();

    // 3. Create Player at Start Position
    this.playerPhysics = new PlayerPhysics(this.physics, this.startPosition);
    this.player = new PlayerController(this.scene, this.input!, {
      startPosition: this.startPosition,
      playerPhysics: this.playerPhysics,
    });

    // Set initial camera tilt based on slope angle
    this.player.setSlopeAngle(slopeAngle);

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
    this.input.bindKey('shift', Action.DebugMoveDown);

    // 3. NEW BINDINGS FOR GAME FLOW
    this.input.bindKey(' ', Action.Start); // Spacebar
    this.input.bindKey('enter', Action.Start);
    this.input.on(Action.Start, (_action, phase) => {
      if (phase === 'pressed') {
        // Don't start game if debug camera is active (space is bound to DebugMoveUp)
        if (this.useDebugCamera) return;
        if (this.gameState === GameState.MENU || this.gameState === GameState.GAME_OVER) {
          this.startGame();
        }
      }
    });

    // Menu / Pause Bindings
    this.input.bindKey('escape', Action.Pause);
    this.input.bindKey('enter', Action.MenuSelect);
    // Note: W/S and Arrows are bound conditionally based on game state
    // See updateKeyBindingsForGameState() method

    // PAUSE TOGGLE LOGIC
    this.input.on(Action.Pause, (_action, phase) => {
      if (phase === 'pressed') {
        const currentUIState = useGameStore.getState().uiState;
        // If About is open, close it regardless of game state
        if (currentUIState === UIState.ABOUT) {
          this.closeAbout();
          return;
        }
        if (this.gameState === GameState.PLAYING) {
          this.pauseGame();
        } else if (this.gameState === GameState.PAUSED) {
          this.resumeGame();
        }
      }
    });

    // MENU NAVIGATION LOGIC
    const handleMenuNav = (action: Action) => {
      if (this.gameState !== GameState.PAUSED || this.isAboutOpen) return;

      if (action === Action.MenuUp) {
        this.menuIndex = (this.menuIndex - 1 + this.menuOptionsCount) % this.menuOptionsCount;
        this.updateMenuVisuals();
      } else if (action === Action.MenuDown) {
        this.menuIndex = (this.menuIndex + 1) % this.menuOptionsCount;
        this.updateMenuVisuals();
      } else if (action === Action.MenuSelect || action === Action.Start) {
        this.executeMenuOption();
      }
    };

    // Attach listeners
    this.input.on(Action.MenuUp, (a, p) => p === 'pressed' && handleMenuNav(a));
    this.input.on(Action.MenuDown, (a, p) => p === 'pressed' && handleMenuNav(a));
    this.input.on(Action.MenuSelect, (a, p) => p === 'pressed' && handleMenuNav(a));

    // Start game on any movement input
    this.input.on(Action.Forward, (_action, phase) => {
      if (phase === 'pressed' && this.gameState === GameState.MENU) {
        this.startGame();
      }
    });
    this.input.on(Action.MenuUp, (_action, phase) => {
      if (phase === 'pressed' && this.gameState === GameState.MENU) {
        this.startGame();
      }
    });
    this.input.on(Action.SteerLeft, (_action, phase) => {
      if (phase === 'pressed' && this.gameState === GameState.MENU) {
        this.startGame();
      }
    });
    this.input.on(Action.SteerRight, (_action, phase) => {
      if (phase === 'pressed' && this.gameState === GameState.MENU) {
        this.startGame();
      }
    });

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

        // Bind space to DebugMoveUp for debug camera
        // Also bind W/ArrowUp to Forward for debug camera movement
        if (this.input) {
          this.input.unbindKey(' ');
          this.input.bindKey(' ', Action.DebugMoveUp);
          this.input.bindKey('w', Action.Forward);
          this.input.bindKey('arrowup', Action.Forward);
        }
      } else {
        // Release pointer lock when switching back
        if (document.pointerLockElement === this.renderer.domElement) {
          document.exitPointerLock();
        }

        // Bind space back to Start action
        // Also restore W/ArrowUp bindings based on game state
        if (this.input) {
          this.input.unbindKey(' ');
          this.input.bindKey(' ', Action.Start);
          // Restore bindings based on current game state
          this.updateKeyBindingsForGameState();
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

    // Set initial key bindings for menu state
    this.updateKeyBindingsForGameState();
  }

  // 4. Game Logic Methods
  /**
   * Updates key bindings based on current game state.
   * When playing: W/ArrowUp bound to Forward (movement)
   * When menu/paused: W/ArrowUp bound to MenuUp (navigation)
   */
  private updateKeyBindingsForGameState(): void {
    if (!this.input) return;

    if (this.gameState === GameState.PLAYING) {
      // Playing: bind to movement actions
      // Note: 'w' and 'arrowup' removed - propulsion is now automatic
      this.input.bindKey('s', Action.DebugMoveBackward);
      this.input.bindKey('arrowdown', Action.MenuDown);
    } else {
      // Menu/Paused: bind to menu navigation
      this.input.bindKey('w', Action.MenuUp);
      this.input.bindKey('arrowup', Action.MenuUp);
      this.input.bindKey('s', Action.MenuDown);
      this.input.bindKey('arrowdown', Action.MenuDown);
    }
  }

  private startGame() {
    this.gameState = GameState.PLAYING;
    this.timeRemaining = GAME_CONFIG.timerDuration;
    this.topSpeed = 0; // Reset top speed

    const { slopeAngle, difficulty } = useGameStore.getState();
    
    // Set camera tilt based on slope angle
    this.player.setSlopeAngle(slopeAngle);
    
    this.terrainManager.regenerate(slopeAngle, difficulty);
    this.recalculateStartPosition();

    // Reset player position
    this.playerPhysics.resetPosition(this.startPosition);
    this.player.mesh.position.copy(this.startPosition);
    this.player.mesh.quaternion.set(0, 0, 0, 1);

    // Update UI via store
    useGameStore.getState().setUIState(UIState.PLAYING);
    useGameStore.getState().setTopSpeed(0);

    // Reset clock
    this.clock.start();

    // Rebind keys for playing state
    this.updateKeyBindingsForGameState();
  }

  private endGame() {
    this.gameState = GameState.GAME_OVER;

    // Calculate final distance and update store
    const currentPos = this.playerPhysics.getPosition();
    const distance = Math.abs(currentPos.z - this.startPosition.z);

    useGameStore.getState().updateStats(0, distance, this.timeRemaining);
    useGameStore.getState().setTopSpeed(this.topSpeed);

    // Rebind keys for menu state (game over shows menu)
    this.updateKeyBindingsForGameState();
    useGameStore.getState().setUIState(UIState.GAME_OVER);
  }

  private pauseGame(): void {
    this.gameState = GameState.PAUSED;
    this.menuIndex = 0; // Reset to "Resume"
    useGameStore.getState().setUIState(UIState.PAUSED);
    // Rebind keys for menu/paused state
    this.updateKeyBindingsForGameState();
    useGameStore.getState().setMenuIndex(0);

    // Ensure cursor is free
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private resumeGame(): void {
    this.gameState = GameState.PLAYING;
    useGameStore.getState().setUIState(UIState.PLAYING);
    this.clock.getDelta(); // Clear accumulated delta time so we don't jump forward
    // Rebind keys for playing state
    this.updateKeyBindingsForGameState();
  }

  private returnToMainMenu(): void {
    // Leave the paused state and show the setup menu
    this.gameState = GameState.MENU;
    this.isAboutOpen = false;
    this.menuIndex = 0;
    useGameStore.getState().setMenuIndex(0);
    useGameStore.getState().setUIState(UIState.MENU);
    this.updateKeyBindingsForGameState();
  }

  private closeAbout(): void {
    this.isAboutOpen = false;
    // Return to the previous state (MENU or PAUSED) based on gameState
    if (this.gameState === GameState.MENU) {
      useGameStore.getState().setUIState(UIState.MENU);
    } else {
      useGameStore.getState().setUIState(UIState.PAUSED);
    }
  }

  private updateMenuVisuals(): void {
    // Menu visuals now handled by React - just update the store
    useGameStore.getState().setMenuIndex(this.menuIndex);
  }

  private executeMenuOption(): void {
    // Read menuIndex from store to sync with React component clicks
    const storeMenuIndex = useGameStore.getState().menuIndex;
    // Sync internal menuIndex for consistency
    this.menuIndex = storeMenuIndex;

    switch (this.menuIndex) {
      case 0: // Resume
        this.resumeGame();
        break;
      case 1: // Restart
        this.resumeGame(); // Set state back to playing
        this.startGame(); // Reset positions/score
        break;
      case 2: // Back to menu
        this.returnToMainMenu();
        break;
    }
  }

  private updateHUD() {
    // Get velocity and calculate speed
    const vel = this.playerPhysics.getVelocity();
    const speed = vel.length();
    const speedKmh = Math.floor(speed * 3.6);

    // Track top speed
    if (speedKmh > this.topSpeed) {
      this.topSpeed = speedKmh;
    }

    // Calculate distance
    const currentPos = this.playerPhysics.getPosition();
    const distance = Math.abs(currentPos.z - this.startPosition.z);

    // Update store (React will handle the rendering)
    useGameStore.getState().updateStats(speed, distance, this.timeRemaining);
  }

  private triggerCrashSequence(): void {
    // Prevent multiple crash triggers
    if (this.gameState === GameState.CRASHED) return;

    console.log('WASTED');
    this.gameState = GameState.CRASHED;
    useGameStore.getState().setUIState(UIState.CRASHED);

    // Enable Slow Mo
    this.timeScale = 0.2;
    this.crashTimer = 0;

    // Notify Physics & Player
    this.playerPhysics.setCrashed(true);
    this.player.isCrashed = true;

    // Capture camera state BEFORE the player starts tumbling
    this.player.captureCrashCameraState();
  }

  private recoverFromCrash(): void {
    // Reset State
    this.gameState = GameState.PLAYING;
    useGameStore.getState().setUIState(UIState.PLAYING);
    this.timeScale = 1.0;

    // 1. Find Safe Ground
    // Get current X/Z
    const currentPos = this.playerPhysics.getPosition();

    // "Cast a vertical line" - query the terrain generator for height at this X/Z
    const safeY = this.terrainManager.getTerrainHeight(currentPos.x, currentPos.z);

    // 2. Teleport Player
    // Place slightly above terrain (radius + padding)
    const resetPos = new THREE.Vector3(
      currentPos.x,
      safeY + PLAYER_CONFIG.radius + 0.5,
      currentPos.z
    );

    this.playerPhysics.resetPosition(resetPos);
    this.player.mesh.position.copy(resetPos);
    this.player.mesh.quaternion.set(0, 0, 0, 1); // Reset rotation upright

    // 3. Reset Camera
    this.player.resetCamera();
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

    // 1. Get Real Delta Time
    const realDelta = this.clock.getDelta();

    // 2. Calculate Game Delta (Slow-mo)
    const gameDelta = realDelta * this.timeScale;

    // ONLY step physics and timers if PLAYING
    if (this.gameState === GameState.PLAYING) {
      // Step physics with collision callback
      this.physics.step(gameDelta, (handle1, handle2) => {
        // We only care about collisions if we are NOT already crashed
        if (!this.player || !this.playerPhysics) return;

        const playerHandle = this.playerPhysics.getColliderHandle();
        const speed = this.playerPhysics.getSpeed();

        // Check if player is involved
        if (handle1 === playerHandle || handle2 === playerHandle) {
          const otherHandle = handle1 === playerHandle ? handle2 : handle1;

          // Check if the other object is an obstacle
          if (this.physics.isObstacle(otherHandle)) {
            // Check speed (convert km/h to m/s for comparison)
            const crashThresholdMs = GAME_CONFIG.crashSpeedThresholdKmh / 3.6;
            if (speed > crashThresholdMs) {
              console.log('CRASH! Speed:', speed * 3.6, 'km/h');
              this.triggerCrashSequence();
            }
          }
        }
      });

      this.timeRemaining -= gameDelta;

      if (!this.useDebugCamera) {
        this.player.update(gameDelta);
      } else {
        this.player.syncFromPhysics();
      }

      this.updateHUD();

      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.endGame();
      }

      this.terrainManager.update(this.playerPhysics.getPosition());
    }
    // STATE: CRASHED (New Logic)
    else if (this.gameState === GameState.CRASHED) {
      // 1. Step physics in slow motion so player tumbles slowly
      this.physics.step(gameDelta, undefined); // No collision callbacks needed

      // 2. Update player visuals (skis/hands) in slow motion
      if (!this.useDebugCamera) {
        this.player.update(gameDelta);
      } else {
        this.player.syncFromPhysics();
      }

      // 3. Update Crash Timer in REAL time
      this.crashTimer += realDelta;

      // 4. Animate Camera (Zoom out)
      const progress = Math.min(this.crashTimer / this.CRASH_DURATION, 1.0);
      // Use easing for smoother camera move
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      this.player.setCrashCameraValues(easeProgress);

      // 5. Keep Timer Running (as requested)
      this.timeRemaining -= gameDelta; // Slow-mo means game timer slows too
      this.updateHUD();

      // 6. End Crash Sequence
      if (this.crashTimer >= this.CRASH_DURATION) {
        this.recoverFromCrash();
      }

      // Sync visuals
      this.player.syncFromPhysics();
      this.terrainManager.update(this.playerPhysics.getPosition());
    } else if (this.gameState === GameState.PAUSED) {
      // If PAUSED, we skip the physics step above, effectively freezing the game logic
      // but we CONTINUE to render below, keeping the 3D scene visible behind the menu.
      // Just sync visuals without updating physics
      this.player.syncFromPhysics();
      this.terrainManager.update(this.playerPhysics.getPosition());
    } else {
      // In MENU or GAME_OVER, pause physics and just sync visuals
      this.player.syncFromPhysics();
      // Still update terrain manager to keep visuals in sync
      this.terrainManager.update(this.playerPhysics.getPosition());
    }

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

      // Up/down (Space for up, Shift for down)
      if (this.input.isActive(Action.DebugMoveUp)) {
        moveVector.y += 1;
      }
      if (this.input.isActive(Action.DebugMoveDown)) {
        moveVector.y -= 1;
      }

      // Normalize and apply speed
      if (moveVector.lengthSq() > 0) {
        moveVector.normalize();
        moveVector.multiplyScalar(this.debugCameraSpeed * realDelta);
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
        realDelta,
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

  private recalculateStartPosition(): void {
    // Spawn player a bit farther forward along the path (50 points ahead)
    const startPoint = this.terrainManager.getPointAtOffset(50);
    // Calculate actual terrain height at start position (accounts for moguls, banking, etc.)
    const terrainHeight = this.terrainManager.getTerrainHeight(startPoint.x, startPoint.z);
    // Spawn player slightly above terrain (player radius + small buffer)
    const playerHeight = terrainHeight + PLAYER_CONFIG.radius + 0.5;

    // Save start pos for resets
    this.startPosition.set(startPoint.x, playerHeight, startPoint.z);
  }
}
