import * as THREE from 'three';
import { createPeakGeometry } from './assets/MountainGeometry';
import { COLOR_PALETTE } from '../constants/colors';

export class BackgroundEnvironment {
  private group: THREE.Group;
  private skyDome!: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // Render before everything else
    this.group.renderOrder = -1;

    scene.add(this.group);

    this.createSkyDome();
    this.createMountainRanges();
    this.createFloor();
  }

  private createSkyDome(): void {
    // Matches reference fog/sky feel
    const geometry = new THREE.SphereGeometry(6000, 32, 16);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: COLOR_PALETTE.background.sky,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });

    this.skyDome = new THREE.Mesh(geometry, material);
    this.group.add(this.skyDome);
  }

  private createMountainRanges(): void {
    // 1. BACK LAYER (The "Blue" Mountains)
    // Huge, far away, simple shapes, bluish tint
    this.scatterRing({
      count: 12,
      radiusMin: 3500,
      radiusMax: 4500,
      scaleMin: 800,
      scaleMax: 1200,
      yOffset: -300,
      color: COLOR_PALETTE.primaryEnvironment.farMountain, // Bluish
      noiseScale: 0.002,
      detail: 0.3, // Smoother
    });

    // 2. MID LAYER
    // Closer, detailed, white/rocky
    this.scatterRing({
      count: 15,
      radiusMin: 1800,
      radiusMax: 2800,
      scaleMin: 400,
      scaleMax: 700,
      yOffset: -100,
      color: COLOR_PALETTE.primaryEnvironment.snowWhite,
      noiseScale: 0.005,
      detail: 1.0, // Jagged
    });

    // 3. FRONT/SIDE CLUSTERS
    // Small peaks to fill gaps near the horizon
    this.scatterRing({
      count: 8,
      radiusMin: 1200,
      radiusMax: 1600,
      scaleMin: 200,
      scaleMax: 400,
      yOffset: -50,
      color: COLOR_PALETTE.primaryEnvironment.snowWhite,
      noiseScale: 0.008,
      detail: 1.2,
    });
  }

  private scatterRing(config: {
    count: number;
    radiusMin: number;
    radiusMax: number;
    scaleMin: number;
    scaleMax: number;
    yOffset: number;
    color: string;
    noiseScale: number;
    detail: number;
  }): void {
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });

    const angleStep = (Math.PI * 2) / config.count;

    for (let i = 0; i < config.count; i++) {
      // Randomize angle slightly so it's not a perfect circle
      const angle = i * angleStep + (Math.random() - 0.5) * 0.5;
      const radius = config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin);

      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const size = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);

      // Generate unique geometry for this mountain
      const geometry = createPeakGeometry({
        width: size * 1.5, // Base width relative to height
        height: size,
        noiseScale: config.noiseScale,
        detail: config.detail,
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(x, config.yOffset, z);

      // Rotate to face roughly center, with variation
      mesh.rotation.y = Math.atan2(x, z) + Math.PI + (Math.random() - 0.5);

      mesh.renderOrder = -1;
      this.group.add(mesh);
    }
  }

  private createFloor(): void {
    // A giant disc to hide the void below the mountains
    const geometry = new THREE.CircleGeometry(5000, 32);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.primaryEnvironment.snowWhite,
      roughness: 1.0,
    });

    const floor = new THREE.Mesh(geometry, material);
    floor.position.y = -50; // Slightly below track
    floor.renderOrder = -2;
    this.group.add(floor);
  }

  update(cameraPosition: THREE.Vector3): void {
    // 1. Sky Dome follows camera exactly
    this.skyDome.position.copy(cameraPosition);

    // 2. Mountains follow the camera on X/Z (Infinite feeling)
    // BUT we preserve their Y height so they don't bob up and down with player jumps
    this.group.position.x = cameraPosition.x;
    this.group.position.z = cameraPosition.z;

    // 3. Parallax Effect (Optional - purely visual polish)
    // Rotate the group extremely slowly based on position to simulate 3D depth shift
    // this.group.rotation.y = cameraPosition.z * 0.0001;
  }
}
