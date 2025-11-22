import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PhysicsSystem } from './core/PhysicsSystem';
import { PlayerController } from './player/PlayerController';
import { TerrainManager } from './world/TerrainManager';
import { DebugUI } from './debug/DebugUI';
import { DebugHelpers } from './debug/DebugHelpers';

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
  private useDebugCamera = true;
  private grid?: THREE.GridHelper;
  private debugUI?: DebugUI;
  private debugHelpers?: DebugHelpers;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8bd1ff');
    this.scene.fog = new THREE.Fog(this.scene.background, 120, 2200);

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
    window.addEventListener('keydown', this.onKeyDown);

    this.debugCamera = new THREE.PerspectiveCamera(70, this.getAspect(), 0.1, 8000);
    this.debugCamera.position.set(160, 180, 260);
    this.debugCamera.lookAt(0, 0, 0);
    this.debugControls = new OrbitControls(this.debugCamera, this.renderer.domElement);
    this.debugControls.enableDamping = true;
    this.activeCamera = this.debugCamera;

    this.physics = await PhysicsSystem.create(new THREE.Vector3(0, -20, 0));
    this.setupLights();
    this.addHelpers();

    this.terrainManager = new TerrainManager(this.scene, this.physics);

    this.player = new PlayerController(this.scene, this.physics);
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

  private setupLights(): void {
    const keyLight = new THREE.DirectionalLight('#ffffff', 1.2);
    keyLight.position.set(60, 200, 120);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 800;
    keyLight.shadow.camera.left = -250;
    keyLight.shadow.camera.right = 250;
    keyLight.shadow.camera.top = 250;
    keyLight.shadow.camera.bottom = -250;
    keyLight.shadow.bias = -0.0005;

    const fillLight = new THREE.DirectionalLight('#a7f0ff', 0.6);
    fillLight.position.set(-120, 150, -80);

    const bounceLight = new THREE.HemisphereLight('#b5f5ff', '#ffe7d3', 0.45);
    const ambient = new THREE.AmbientLight('#ffffff', 0.15);

    this.scene.add(keyLight, fillLight, bounceLight, ambient);
  }

  private addHelpers(): void {
    const axes = new THREE.AxesHelper(10);
    this.grid = new THREE.GridHelper(200, 20, '#ff6b35', '#8c9ea8');
    this.grid.position.set(0, 0.01, 0);
    this.scene.add(axes, this.grid);
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    const delta = this.clock.getDelta();
    this.physics.update(delta);
    this.player.update(delta);
    this.terrainManager.update(this.player.mesh.position);

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
        delta
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

  private onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === 'c' && this.player) {
      this.useDebugCamera = !this.useDebugCamera;
      this.activeCamera = this.useDebugCamera ? this.debugCamera : this.player.camera;
      console.info(`Camera toggled to ${this.useDebugCamera ? 'debug orbit' : 'first-person'}`);
    }
    if (key === 'v' && this.terrainManager) {
      const isWireframe = this.terrainManager.toggleWireframe();
      console.info(`Slope wireframe ${isWireframe ? 'on' : 'off'}`);
    }
    if (key === 'g' && this.grid) {
      this.grid.visible = !this.grid.visible;
      console.info(`Grid ${this.grid.visible ? 'visible' : 'hidden'}`);
    }
    if (key === 'd') {
      const isVisible = this.debugUI?.toggle() ?? false;
      this.debugHelpers?.setVisible(isVisible);
      console.info(`Debug info ${isVisible ? 'visible' : 'hidden'}`);
    }
  };

  private getAspect(): number {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    return width / Math.max(1, height);
  }
}
