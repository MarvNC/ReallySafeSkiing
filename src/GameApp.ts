import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PhysicsSystem } from './core/PhysicsSystem';
import { PlayerController } from './player/PlayerController';
import { TerrainManager } from './world/TerrainManager';
import { DebugUI } from './debug/DebugUI';
import { DebugHelpers } from './debug/DebugHelpers';
import { PHYSICS_CONFIG, PLAYER_CONFIG, LIGHTING_CONFIG } from './config/GameConfig';
import { Action, InputManager } from './core/InputManager';

export class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private clock: THREE.Clock;
  private physics!: PhysicsSystem;
  private terrainManager!: TerrainManager;
  private player!: PlayerController;
  private isRunning = false;
  private container: HTMLElement;
  private debugCamera?: THREE.PerspectiveCamera;
  private debugControls?: OrbitControls;
  private activeCamera?: THREE.PerspectiveCamera;
  private useDebugCamera = false;
  private grid?: THREE.GridHelper;
  private debugUI?: DebugUI;
  private debugHelpers?: DebugHelpers;
  private input?: InputManager;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8bd1ff');
    this.scene.fog = new THREE.Fog(this.scene.background, 120, 8000);

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
    this.debugControls = new OrbitControls(this.debugCamera, this.renderer.domElement);
    this.debugControls.enableDamping = true;
    this.activeCamera = this.debugCamera;

    this.physics = await PhysicsSystem.create(PHYSICS_CONFIG.gravity);
    this.setupLights();
    this.addHelpers();

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

    // DEBUG: Add a simple ground plane to test if collision works at all
    const rapier = this.physics.getRapier();
    // Move ground plane to be under the start position approximately
    const groundBody = this.physics
      .getWorld()
      .createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(
          startPoint.x,
          startPoint.y - 5,
          startPoint.z - 50
        )
      );
    const groundCollider = rapier.ColliderDesc.cuboid(100, 0.1, 100);
    this.physics.getWorld().createCollider(groundCollider, groundBody);
    console.log('DEBUG: Ground plane collider created');

    // 3. Create Player at Start Position
    this.player = new PlayerController(this.scene, this.physics, this.input!, {
      startPosition: startPos,
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
    this.input.bindKey('s', Action.ToggleShadows);

    // Player controls
    this.input.bindKey('w', Action.Forward);
    this.input.bindKey('arrowup', Action.Forward);

    // Camera toggle
    this.input.on(Action.ToggleCamera, (_action, phase) => {
      if (phase !== 'pressed' || !this.player) return;
      this.useDebugCamera = !this.useDebugCamera;
      this.activeCamera = this.useDebugCamera ? this.debugCamera : this.player.camera;
      console.info(`Camera toggled to ${this.useDebugCamera ? 'debug orbit' : 'first-person'}`);
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

    // Global shadows
    this.input.on(Action.ToggleShadows, (_action, phase) => {
      if (phase !== 'pressed') return;
      this.renderer.shadowMap.enabled = !this.renderer.shadowMap.enabled;
      console.info(`Shadows ${this.renderer.shadowMap.enabled ? 'enabled' : 'disabled'}`);
    });
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
    this.physics.update(delta);
    this.player.update(delta);
    this.terrainManager.update();

    // Update debug info
    if (this.debugUI && this.debugHelpers && this.player) {
      const velocity = new THREE.Vector3(
        this.player.body.linvel().x,
        this.player.body.linvel().y,
        this.player.body.linvel().z
      );
      const rotation = this.player.mesh.quaternion.clone();

      this.debugUI.update(
        this.player.mesh.position,
        velocity,
        rotation,
        this.activeCamera ?? this.player.camera,
        delta,
        this.renderer.shadowMap.enabled
      );

      this.debugHelpers.update(this.player.mesh.position, rotation, velocity);
    }

    this.debugControls?.update();
    const camera = this.activeCamera ?? this.player.camera;
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
