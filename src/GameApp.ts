import * as THREE from 'three';

import {
  ARCADE_CONFIG,
  GAME_CONFIG,
  GRAPHICS_PRESET,
  LIGHTING_CONFIG,
  PLAYER_CONFIG,
  SPRINT_CONFIG,
} from './config/GameConfig';
import { Action, InputManager } from './core/InputManager';
import { LightingManager } from './core/LightingManager';
import { DebugHelpers } from './debug/DebugHelpers';
import { DebugUI } from './debug/DebugUI';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { PlayerController } from './player/PlayerController';
import { PlayerPhysics } from './player/PlayerPhysics';
import { EndReason, GameMode, UIState, useGameStore } from './ui/store';
import { BackgroundEnvironment } from './world/BackgroundEnvironment';
import { SnowSparkles } from './world/SnowSparkles';
import { TerrainManager } from './world/TerrainManager';

// 1. Define Game States
const GameState = {
  MENU: 0,
  PLAYING: 1,
  GAME_OVER: 2,
  PAUSED: 3,
  CRASHED: 4, // Crash sequence state
  READY: 5, // First-run prompt shown, waiting for input
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
  private isDebugMode = false;
  private grid?: THREE.GridHelper;
  private debugUI?: DebugUI;
  private debugHelpers?: DebugHelpers;
  private input?: InputManager;
  private isPointerLocked = false;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private debugCameraSpeed = 50;
  private backgroundEnv?: BackgroundEnvironment;
  private lighting?: LightingManager;
  private snowSparkles?: SnowSparkles;

  // 2. Game Logic Variables
  private gameState: GameState = GameState.MENU;
  private timeElapsed = 0;
  private startPosition: THREE.Vector3 = new THREE.Vector3();
  private topSpeed: number = 0; // Track top speed in km/h
  private lastDistance = 0;
  private arcadeInvulnerability = 0;
  private airTimeAccumulator = 0;
  private speedBonusTimer = 0;
  private tmpVecA = new THREE.Vector3();
  private tmpVecB = new THREE.Vector3();
  private lifeShakeTime = 0;
  private readonly lifeShakeDuration = ARCADE_CONFIG.lifeImpactDuration;
  private readonly lifeShakeMagnitude = 0.5;
  private lifeShakeStartPos = new THREE.Vector3();
  private lifeShakeBaseRotZ = 0;

  // Crash sequence variables
  private timeScale = 1.0;
  private crashTimer = 0;
  private readonly CRASH_DURATION = SPRINT_CONFIG.crashDuration; // Real-time seconds
  private wasCrashedBeforePause = false; // Track if we were in crash state before pausing

  // New Menu State
  private isAboutOpen = false;
  private readonly menuOptionsCount = 3; // Resume, Restart, Back to menu

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GRAPHICS_PRESET === 'high' ? 1.15 : 1.0;
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

    this.lighting = new LightingManager(this.scene, this.renderer);
    this.lighting.init();
    this.addHelpers();

    // Initialize Background
    this.backgroundEnv = new BackgroundEnvironment(this.scene);

    this.physics?.dispose();
    this.physics = new PhysicsWorld();
    await this.physics.init();

    const { slopeAngle, difficulty, gameMode } = useGameStore.getState();
    const obstacleMultiplier = this.getModeObstacleMultiplier(gameMode);
    const coinsEnabled = gameMode === 'ARCADE';

    // 1. Create Terrain Manager (generates the world)
    this.terrainManager = new TerrainManager(
      this.scene,
      this.physics,
      slopeAngle,
      difficulty,
      obstacleMultiplier,
      coinsEnabled
    );

    this.snowSparkles = new SnowSparkles(this.terrainManager);
    this.scene.add(this.snowSparkles.points);

    // 2. Get Start Position from generated path
    // Spawn player a bit farther forward along the path (50 points ahead)
    this.recalculateStartPosition();

    // 3. Create Player at Start Position
    this.playerPhysics = new PlayerPhysics(this.physics, this.startPosition);
    this.player = new PlayerController(this.scene, this.input!, {
      startPosition: this.startPosition,
      playerPhysics: this.playerPhysics,
      terrain: this.terrainManager,
    });

    // Set initial camera tilt based on slope angle
    this.player.setSlopeAngle(slopeAngle);

    if (!this.useDebugCamera) {
      this.activeCamera = this.player.camera;
    }

    // Initialize debug systems
    this.debugUI = new DebugUI(this.container);
    this.debugHelpers?.dispose();
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
    this.input.bindKey('5', Action.ToggleDebugUi);
    this.input.bindKey('6', Action.ToggleHUD);

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
        } else if (this.gameState === GameState.READY) {
          this.resumeFromFirstRunPrompt();
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
        if (this.gameState === GameState.PLAYING || this.gameState === GameState.CRASHED) {
          this.pauseGame();
        } else if (this.gameState === GameState.PAUSED) {
          this.resumeGame();
        }
      }
    });

    // MENU NAVIGATION LOGIC
    const handleMenuNav = (action: Action) => {
      if (this.gameState !== GameState.PAUSED || this.isAboutOpen) return;

      const store = useGameStore.getState();
      const currentIndex = store.menuIndex ?? 0;

      if (action === Action.MenuUp) {
        const nextIndex = (currentIndex - 1 + this.menuOptionsCount) % this.menuOptionsCount;
        store.setMenuIndex(nextIndex);
      } else if (action === Action.MenuDown) {
        const nextIndex = (currentIndex + 1) % this.menuOptionsCount;
        store.setMenuIndex(nextIndex);
      } else if (action === Action.MenuSelect || action === Action.Start) {
        this.executeMenuOption();
      }
    };

    // Attach listeners
    this.input.on(Action.MenuUp, (a, p) => p === 'pressed' && handleMenuNav(a));
    this.input.on(Action.MenuDown, (a, p) => p === 'pressed' && handleMenuNav(a));
    this.input.on(Action.MenuSelect, (a, p) => p === 'pressed' && handleMenuNav(a));
    // Allow space (Start action) to select pause menu items for keyboard parity
    this.input.on(Action.Start, (a, p) => p === 'pressed' && handleMenuNav(a));

    // Start game on any movement input
    this.input.on(Action.Forward, (_action, phase) => {
      if (phase !== 'pressed') return;
      if (this.gameState === GameState.MENU) this.startGame();
      else if (this.gameState === GameState.READY) this.resumeFromFirstRunPrompt();
    });
    this.input.on(Action.MenuUp, (_action, phase) => {
      if (phase !== 'pressed') return;
      if (this.gameState === GameState.MENU) this.startGame();
      else if (this.gameState === GameState.READY) this.resumeFromFirstRunPrompt();
    });
    this.input.on(Action.SteerLeft, (_action, phase) => {
      if (phase !== 'pressed') return;
      if (this.gameState === GameState.MENU) this.startGame();
      else if (this.gameState === GameState.READY) this.resumeFromFirstRunPrompt();
    });
    this.input.on(Action.SteerRight, (_action, phase) => {
      if (phase !== 'pressed') return;
      if (this.gameState === GameState.MENU) this.startGame();
      else if (this.gameState === GameState.READY) this.resumeFromFirstRunPrompt();
    });

    // Camera toggle
    this.input.on(Action.ToggleCamera, (_action, phase) => {
      if (phase !== 'pressed' || !this.player || !this.debugCamera) return;
      if (!this.isDebugMode) return;

      if (this.useDebugCamera) {
        this.deactivateDebugCamera();
      } else {
        this.activateDebugCamera();
      }

      console.info(`Camera toggled to ${this.useDebugCamera ? 'debug free' : 'first-person'}`);
    });

    // Terrain wireframe
    this.input.on(Action.ToggleWireframe, (_action, phase) => {
      if (phase !== 'pressed' || !this.terrainManager) return;
      if (!this.isDebugMode) return;
      const isWireframe = this.terrainManager.toggleWireframe();
      console.info(`Slope wireframe ${isWireframe ? 'on' : 'off'}`);
    });

    // Grid helper visibility
    this.input.on(Action.ToggleGrid, (_action, phase) => {
      if (phase !== 'pressed' || !this.grid) return;
      if (!this.isDebugMode) return;
      this.grid.visible = !this.grid.visible;
      console.info(`Grid ${this.grid.visible ? 'visible' : 'hidden'}`);
    });

    // Debug UI and helpers visibility
    this.input.on(Action.ToggleDebugUi, (_action, phase) => {
      if (phase !== 'pressed') return;
      this.setDebugMode(!this.isDebugMode);
      console.info(`Debug mode ${this.isDebugMode ? 'enabled' : 'disabled'}`);
    });

    this.input.on(Action.ToggleHUD, (_action, phase) => {
      if (phase !== 'pressed') return;
      useGameStore.getState().toggleHUD();
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

    if (this.gameState === GameState.PLAYING || this.gameState === GameState.READY) {
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

  private activateDebugCamera(): void {
    if (!this.debugCamera || !this.player || !this.input) return;

    // Position debug camera at player position
    const playerWorldPos = new THREE.Vector3();
    this.player.mesh.getWorldPosition(playerWorldPos);
    this.debugCamera.position.copy(playerWorldPos);

    // Match player's camera rotation
    const playerCameraRotation = new THREE.Euler().setFromQuaternion(this.player.camera.quaternion);
    this.euler.set(playerCameraRotation.x, playerCameraRotation.y, 0);
    this.debugCamera.rotation.set(this.euler.x, this.euler.y, this.euler.z);

    // Request pointer lock for mouse look
    this.renderer.domElement.requestPointerLock();

    // Bind space to DebugMoveUp for debug camera
    // Also bind W/ArrowUp to Forward for debug camera movement
    this.input.unbindKey(' ');
    this.input.bindKey(' ', Action.DebugMoveUp);
    this.input.bindKey('w', Action.Forward);
    this.input.bindKey('arrowup', Action.Forward);

    this.useDebugCamera = true;
    this.activeCamera = this.debugCamera;
  }

  private deactivateDebugCamera(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    if (this.input) {
      this.input.unbindKey(' ');
      this.input.bindKey(' ', Action.Start);
      // Restore bindings based on current game state
      this.updateKeyBindingsForGameState();
    }

    this.useDebugCamera = false;

    if (this.player) {
      this.activeCamera = this.player.camera;
    }
  }

  private setDebugMode(enabled: boolean): void {
    if (enabled && (!this.debugUI || !this.debugHelpers)) {
      return;
    }

    this.isDebugMode = enabled;
    this.debugUI?.setVisible(enabled);
    this.debugHelpers?.setVisible(enabled);

    if (!enabled) {
      this.deactivateDebugCamera();
      if (this.grid) {
        this.grid.visible = false;
      }
      this.terrainManager?.setWireframe(false);
    }
  }

  private getModeObstacleMultiplier(mode: GameMode): number {
    return mode === 'ZEN' ? GAME_CONFIG.zenObstacleDensityMultiplier : 1;
  }

  private startGame() {
    const { slopeAngle, difficulty, gameMode, hasStartedOnce } = useGameStore.getState();
    const obstacleMultiplier = this.getModeObstacleMultiplier(gameMode);
    const shouldPauseForFirstRun = !hasStartedOnce;
    const coinsEnabled = gameMode === 'ARCADE';

    useGameStore.getState().setHasStartedOnce(true);

    // Full reset so restart behaves like a fresh page load
    this.timeScale = shouldPauseForFirstRun ? 0 : 1;
    this.crashTimer = 0;
    this.wasCrashedBeforePause = false;
    this.isAboutOpen = false;
    this.gameState = shouldPauseForFirstRun ? GameState.READY : GameState.PLAYING;
    this.lastDistance = 0;
    this.arcadeInvulnerability = 0;
    this.airTimeAccumulator = 0;
    this.speedBonusTimer = 0;

    // Rebuild world
    this.terrainManager.regenerate(slopeAngle, difficulty, obstacleMultiplier, coinsEnabled);
    this.recalculateStartPosition();

    // Reset player + physics
    this.player.setSlopeAngle(slopeAngle);
    this.playerPhysics.setCrashed(false);
    this.playerPhysics.resetPosition(this.startPosition);
    this.playerPhysics.resetVelocity();
    this.player.mesh.position.copy(this.startPosition);
    this.player.mesh.quaternion.set(0, 0, 0, 1);
    this.player.resetCamera();
    this.snowSparkles?.reset(
      this.player.camera,
      this.lighting?.getSunDirection() ?? LIGHTING_CONFIG.sun.direction
    );

    // Reset timers/UI
    this.timeElapsed = 0;
    this.topSpeed = 0;

    useGameStore.getState().setMenuIndex(0);
    useGameStore
      .getState()
      .setUIState(shouldPauseForFirstRun ? UIState.FIRST_RUN : UIState.PLAYING);
    useGameStore.getState().setTopSpeed(0);
    useGameStore.getState().setEndReason(null);
    // Reset penalties - use zustand's set function pattern
    useGameStore.setState({ penalties: 0 });
    useGameStore.getState().updateStats(0, 0, 0, this.timeElapsed);
    if (gameMode === 'ARCADE') {
      useGameStore.getState().resetArcadeRun();
    }

    // Reset clock
    this.clock.stop();
    this.clock.start();

    // Rebind keys for playing state
    this.updateKeyBindingsForGameState();
  }

  private endGame(reason: EndReason = 'time') {
    this.timeScale = 1;
    this.gameState = GameState.GAME_OVER;

    // Calculate final distance and update store
    const currentPos = this.playerPhysics.getPosition();
    const distance = Math.abs(currentPos.z - this.startPosition.z);

    useGameStore.getState().updateStats(0, distance, 0, this.timeElapsed);
    useGameStore.getState().setTopSpeed(this.topSpeed);
    useGameStore.getState().setEndReason(reason);

    // Rebind keys for menu state (game over shows menu)
    this.updateKeyBindingsForGameState();
    useGameStore.getState().setUIState(UIState.GAME_OVER);
  }

  private pauseGame(): void {
    // Track if we were in crash state before pausing
    this.wasCrashedBeforePause = this.gameState === GameState.CRASHED;

    this.gameState = GameState.PAUSED;
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
    // If we were crashed before pausing, restore the crash state
    if (this.wasCrashedBeforePause) {
      this.gameState = GameState.CRASHED;
      useGameStore.getState().setUIState(UIState.CRASHED);
      this.wasCrashedBeforePause = false; // Reset flag
    } else {
      this.gameState = GameState.PLAYING;
      useGameStore.getState().setUIState(UIState.PLAYING);
    }
    this.clock.getDelta(); // Clear accumulated delta time so we don't jump forward
    // Rebind keys for playing state
    this.updateKeyBindingsForGameState();
  }

  private resumeFromFirstRunPrompt(): void {
    if (this.gameState !== GameState.READY) return;
    this.timeScale = 1;
    this.gameState = GameState.PLAYING;
    useGameStore.getState().setUIState(UIState.PLAYING);
    this.clock.getDelta();
    this.updateKeyBindingsForGameState();
  }

  private returnToMainMenu(): void {
    // Leave the paused state and show the setup menu
    this.gameState = GameState.MENU;
    this.timeScale = 1;
    this.crashTimer = 0;
    this.wasCrashedBeforePause = false;
    this.isAboutOpen = false;
    useGameStore.getState().setMenuIndex(0);
    useGameStore.getState().setUIState(UIState.MENU);
    useGameStore.getState().setEndReason(null);
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

  private executeMenuOption(): void {
    // Read menuIndex from store to sync with React component clicks
    const storeMenuIndex = useGameStore.getState().menuIndex;
    const gameMode = useGameStore.getState().gameMode;

    switch (storeMenuIndex) {
      case 0: // Resume
        this.resumeGame();
        break;
      case 1: // Restart
        this.startGame(); // Reset everything
        break;
      case 2: // Back to menu / End Run
        this.wasCrashedBeforePause = false; // Reset crash flag when returning to menu
        if (gameMode === 'ZEN' && this.gameState === GameState.PAUSED) {
          this.endGame('manual');
        } else {
          this.returnToMainMenu();
        }
        break;
    }
  }

  private updateHUD(deltaSeconds: number, enableArcadeScoring: boolean = false) {
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
    const distanceDelta = Math.max(0, distance - this.lastDistance);
    this.lastDistance = distance;

    // Update store (React will handle the rendering)
    const store = useGameStore.getState();
    store.updateStats(speed, distance, 0, this.timeElapsed);

    if (enableArcadeScoring && store.gameMode === 'ARCADE') {
      const currentMultiplier = store.multiplier;
      const distanceScore = distanceDelta * ARCADE_CONFIG.distanceScorePerMeter * currentMultiplier;

      if (distanceScore > 0) {
        store.addScore(distanceScore);
      }

      this.updateSpeedBonus(speedKmh, currentMultiplier, deltaSeconds, store);
    } else {
      this.speedBonusTimer = 0;
    }
  }

  private handleCoinPickup(): void {
    const store = useGameStore.getState();
    if (store.gameMode !== 'ARCADE') return;

    const currentMultiplier = store.multiplier;
    const nextMultiplier = Number(
      (currentMultiplier + ARCADE_CONFIG.coinMultiplierBonus).toFixed(2)
    );
    const coinScore = ARCADE_CONFIG.coinValue * currentMultiplier;

    store.addCoin(1);
    store.addScore(coinScore);
    store.setMultiplier(nextMultiplier);
    store.triggerScorePopup({
      value: coinScore,
      multiplier: nextMultiplier,
      type: 'coin',
    });
  }

  private handleArcadeCollision(otherHandle: number, speed: number): void {
    if (this.arcadeInvulnerability > 0) return;
    const store = useGameStore.getState();
    const speedKmh = speed * 3.6;

    let headOn = false;
    const collider = this.physics.getCollider(otherHandle);
    if (collider) {
      const playerPos = this.playerPhysics.getPosition(this.tmpVecA);
      const target = collider.translation();
      this.tmpVecB
        .set(target.x - playerPos.x, target.y - playerPos.y, target.z - playerPos.z)
        .normalize();
      const velocityDir = this.playerPhysics.getVelocity(this.tmpVecA).normalize();
      if (velocityDir.lengthSq() > 0) {
        headOn = velocityDir.dot(this.tmpVecB) > 0.65;
      }
    }

    if (speedKmh >= ARCADE_CONFIG.deathThresholdKmh && headOn) {
      this.triggerCrashSequence();
      return;
    }

    if (speedKmh >= ARCADE_CONFIG.damageThresholdKmh) {
      store.loseLife(1);
      const { multiplier } = useGameStore.getState();
      this.triggerLifeShake();
      store.triggerScorePopup({
        multiplier,
        type: 'life',
      });
      this.airTimeAccumulator = 0;
      this.arcadeInvulnerability = ARCADE_CONFIG.invulnerabilitySeconds;
      if (useGameStore.getState().lives <= 0) {
        this.triggerCrashSequence();
      }
    }
  }

  private updateArcadeHandling(): void {
    if (!this.playerPhysics) return;
    const { gameMode, lives } = useGameStore.getState();
    if (gameMode !== 'ARCADE') {
      this.playerPhysics.setHandlingModifiers(0, 1);
      return;
    }

    if (lives <= 1) {
      this.playerPhysics.setHandlingModifiers(
        ARCADE_CONFIG.steerNoiseCritical,
        ARCADE_CONFIG.lateralFrictionCritical
      );
    } else if (lives === 2) {
      this.playerPhysics.setHandlingModifiers(ARCADE_CONFIG.steerNoiseDamaged, 1);
    } else {
      this.playerPhysics.setHandlingModifiers(0, 1);
    }
  }

  private updateAirMultiplier(gameDelta: number): void {
    if (!this.playerPhysics) {
      this.airTimeAccumulator = 0;
      return;
    }

    const store = useGameStore.getState();
    if (store.gameMode !== 'ARCADE') {
      this.airTimeAccumulator = 0;
      return;
    }

    const airborneTime = this.playerPhysics.getAirborneTime();
    const minAirSeconds = ARCADE_CONFIG.airMultiplierMinSeconds;
    const eligible = this.playerPhysics.isAirborne() && airborneTime >= minAirSeconds;

    if (eligible) {
      this.airTimeAccumulator += gameDelta;
      const interval = ARCADE_CONFIG.airMultiplierIntervalSeconds;

      if (interval > 0) {
        const incrementsEarned = Math.floor(this.airTimeAccumulator / interval);

        if (incrementsEarned > 0) {
          const bonus = incrementsEarned * ARCADE_CONFIG.airMultiplierIncrement;
          const currentMultiplier = store.multiplier;
          const airtimeBonus =
            ARCADE_CONFIG.airtimeBonusPoints * incrementsEarned * currentMultiplier;
          const next = Number((currentMultiplier + bonus).toFixed(2));
          store.setMultiplier(next);
          if (airtimeBonus > 0) {
            store.addScore(airtimeBonus);
          }
          store.triggerScorePopup({
            value: airtimeBonus,
            multiplier: next,
            type: 'airtime',
          });
          this.airTimeAccumulator -= incrementsEarned * interval;
        }
      }
    } else {
      this.airTimeAccumulator = 0;
    }
  }

  private updateSpeedBonus(
    speedKmh: number,
    currentMultiplier: number,
    deltaSeconds: number,
    store: ReturnType<typeof useGameStore.getState>
  ): void {
    if (speedKmh <= ARCADE_CONFIG.speedBonusThresholdKmh) {
      this.speedBonusTimer = 0;
      return;
    }

    const interval = ARCADE_CONFIG.speedBonusPopupIntervalSeconds;
    const pointsPerInterval = ARCADE_CONFIG.speedBonusPointsPerSecond * interval;
    const multiplierPerInterval = ARCADE_CONFIG.speedBonusMultiplierPerSecond * interval;

    this.speedBonusTimer += deltaSeconds;
    const events = interval > 0 ? Math.floor(this.speedBonusTimer / interval) : 1;

    if (events === 0) return;

    this.speedBonusTimer -= interval > 0 ? events * interval : 0;

    const multiplierBonus = Number((events * multiplierPerInterval).toFixed(2));
    const nextMultiplier = Number((currentMultiplier + multiplierBonus).toFixed(2));
    const awarded = pointsPerInterval * events * currentMultiplier;

    if (multiplierBonus !== 0) {
      store.setMultiplier(nextMultiplier);
    }

    store.addScore(awarded);
    store.triggerScorePopup({
      value: awarded,
      multiplier: nextMultiplier,
      type: 'speed',
    });
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
    this.player.triggerCrash(); // This will also hide speedlines

    // Capture camera state BEFORE the player starts tumbling
    this.player.captureCrashCameraState();
  }

  private finalizeCrashGameOver(): void {
    if (this.gameState !== GameState.CRASHED) return;
    this.timeScale = 1;
    this.wasCrashedBeforePause = false;

    const gameMode = useGameStore.getState().gameMode;

    // In Sprint mode, recover from crash instead of ending game
    if (gameMode === 'SPRINT') {
      this.recoverFromCrash();
    } else {
      // In Zen mode or other modes, end the game on crash
      this.endGame('crash');
    }
  }

  private recoverFromCrash(): void {
    if (this.gameState !== GameState.CRASHED) return;

    const gameMode = useGameStore.getState().gameMode;
    if (gameMode !== 'SPRINT') return;

    // 1. Add penalty time (this also increments penalty count)
    useGameStore.getState().addPenalty(SPRINT_CONFIG.penaltySeconds);
    // Update local timeElapsed to match store
    this.timeElapsed = useGameStore.getState().timeElapsed;

    // 2. Reset velocity
    this.playerPhysics.resetVelocity();

    // 3. Snap to track center at current Z position
    const currentPos = this.playerPhysics.getPosition();
    const closestPoint = this.terrainManager.getClosestPathPoint(currentPos.z);

    if (closestPoint) {
      // Get terrain height at the center of the track
      const terrainHeight = this.terrainManager.getTerrainHeight(closestPoint.x, closestPoint.z);
      const respawnHeight = terrainHeight + PLAYER_CONFIG.radius + 0.5;

      // Create respawn position at track center
      const respawnPos = new THREE.Vector3(closestPoint.x, respawnHeight, closestPoint.z);

      // Reset player position
      this.playerPhysics.resetPosition(respawnPos);
      this.player.mesh.position.copy(respawnPos);
      this.player.mesh.quaternion.set(0, 0, 0, 1);
    }

    // 4. Reset crash state
    this.playerPhysics.setCrashed(false);
    this.player.isCrashed = false;
    this.player.resetCamera();

    // 5. Return to playing state
    this.gameState = GameState.PLAYING;
    useGameStore.getState().setUIState(UIState.PLAYING);

    // 6. Trigger penalty notification animation
    useGameStore.getState().triggerPenaltyNotification();
  }

  private triggerLifeShake(): void {
    if (!this.player) return;
    this.lifeShakeTime = this.lifeShakeDuration;
    this.lifeShakeStartPos.copy(this.player.camera.position);
    this.lifeShakeBaseRotZ = this.player.camera.rotation.z;
  }

  private applyLifeShake(realDelta: number): void {
    if (!this.player || this.useDebugCamera || this.lifeShakeTime <= 0) return;
    const camera = this.player.camera;
    const t = Math.max(0, this.lifeShakeTime / this.lifeShakeDuration);
    const strength = this.lifeShakeMagnitude * t * t;

    const offsetX = (Math.random() - 0.5) * strength;
    const offsetY = (Math.random() - 0.5) * strength * 0.6;
    const offsetZ = (Math.random() - 0.5) * strength * 0.4;

    camera.position.copy(this.lifeShakeStartPos).add(this.tmpVecA.set(offsetX, offsetY, offsetZ));
    camera.rotation.z = this.lifeShakeBaseRotZ + (Math.random() - 0.5) * strength * 0.12;

    this.lifeShakeTime = Math.max(0, this.lifeShakeTime - realDelta);

    if (this.lifeShakeTime <= 0) {
      camera.position.copy(this.lifeShakeStartPos);
      camera.rotation.z = this.lifeShakeBaseRotZ;
    }
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
    const gameMode = useGameStore.getState().gameMode;
    const isZenMode = gameMode === 'ZEN';
    const activeCamera = this.activeCamera ?? this.player.camera;
    if (this.arcadeInvulnerability > 0) {
      this.arcadeInvulnerability = Math.max(0, this.arcadeInvulnerability - realDelta);
    }
    this.applyLifeShake(realDelta);
    this.updateArcadeHandling();

    // Keep sun/shadows following the rider
    if (this.playerPhysics) {
      const position = this.playerPhysics.getPosition();
      const velocity = this.playerPhysics.getVelocity();
      this.lighting?.update({ position, velocity, camera: activeCamera });
    }

    this.snowSparkles?.update(
      gameDelta,
      activeCamera,
      this.lighting?.getSunDirection() ?? LIGHTING_CONFIG.sun.direction
    );

    // ONLY step physics and timers if PLAYING
    if (this.gameState === GameState.PLAYING) {
      // Step physics with collision callback
      this.physics.step(gameDelta, (handle1, handle2) => {
        // We only care about collisions if we are NOT already crashed
        if (!this.player || !this.playerPhysics) return;
        if (isZenMode) return;
        const isArcadeMode = gameMode === 'ARCADE';

        const playerHandle = this.playerPhysics.getColliderHandle();
        const speed = this.playerPhysics.getSpeed();

        // Check if player is involved
        if (handle1 === playerHandle || handle2 === playerHandle) {
          const otherHandle = handle1 === playerHandle ? handle2 : handle1;

          if (isArcadeMode && this.physics.isCollectible(otherHandle)) {
            if (this.terrainManager.handleCoinCollision(otherHandle)) {
              this.handleCoinPickup();
            }
            return;
          }

          // Check if the other object is an obstacle
          if (this.physics.isObstacle(otherHandle)) {
            // Check speed (convert km/h to m/s for comparison)
            const crashThresholdMs = GAME_CONFIG.crashSpeedThresholdKmh / 3.6;
            if (isArcadeMode) {
              this.handleArcadeCollision(otherHandle, speed);
            } else if (speed > crashThresholdMs) {
              console.log('CRASH! Speed:', speed * 3.6, 'km/h');
              this.triggerCrashSequence();
            }
          }
        }
      });

      // Timer logic: Both Sprint and Zen modes count up
      this.timeElapsed += gameDelta;

      if (!this.useDebugCamera) {
        this.player.update(gameDelta);
      } else {
        this.player.syncFromPhysics();
      }

      this.updateAirMultiplier(gameDelta);
      this.updateHUD(gameDelta, gameMode === 'ARCADE');

      // Win condition: Sprint mode checks distance
      if (gameMode === 'SPRINT') {
        const currentPos = this.playerPhysics.getPosition();
        const distance = Math.abs(currentPos.z - this.startPosition.z);
        if (distance >= SPRINT_CONFIG.targetDistance) {
          this.endGame('complete');
        }
      }

      this.terrainManager.update(this.playerPhysics.getPosition(), gameDelta);
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

      // 5. Keep Timer Running
      this.timeElapsed += gameDelta;
      this.updateHUD(gameDelta);

      // 6. End Crash Sequence
      if (this.crashTimer >= this.CRASH_DURATION) {
        this.finalizeCrashGameOver();
      }

      // Sync visuals
      this.player.syncFromPhysics();
      this.terrainManager.update(this.playerPhysics.getPosition(), gameDelta);
    } else if (this.gameState === GameState.PAUSED) {
      // If PAUSED, we skip the physics step above, effectively freezing the game logic
      // but we CONTINUE to render below, keeping the 3D scene visible behind the menu.
      // Just sync visuals without updating physics
      this.player.syncFromPhysics();
      this.terrainManager.update(this.playerPhysics.getPosition(), gameDelta);
    } else if (this.gameState === GameState.READY) {
      // First-run prompt: keep the scene visible but frozen until input arrives
      this.player.syncFromPhysics();
      this.terrainManager.update(this.playerPhysics.getPosition(), gameDelta);
    } else {
      // In MENU or GAME_OVER, pause physics and just sync visuals
      this.player.syncFromPhysics();
      // Still update terrain manager to keep visuals in sync
      this.terrainManager.update(this.playerPhysics.getPosition(), gameDelta);
    }

    // Update debug camera movement
    if (this.isDebugMode && this.useDebugCamera && this.debugCamera && this.input) {
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
    if (this.backgroundEnv) {
      // Get world position of camera (player camera is a child of mesh, so we need world position)
      const cameraWorldPos = new THREE.Vector3();
      activeCamera.getWorldPosition(cameraWorldPos);
      this.backgroundEnv.update(cameraWorldPos);
    }

    this.renderer.render(this.scene, activeCamera);
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
