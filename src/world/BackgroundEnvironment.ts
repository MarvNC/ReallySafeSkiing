import * as THREE from 'three';

import { COLOR_PALETTE } from '../constants/colors';
import { createPeakGeometry } from './assets/MountainGeometry';

// ============================================================================
// MOUNTAIN CONFIGURATION
// ============================================================================
// Adjust these values to control mountain placement and appearance
const MOUNTAIN_CONFIG = {
  // Global Y offset applied to all mountains relative to player position
  // Negative values move mountains down, positive values move them up
  globalYOffset: -700,

  // BACK LAYER - Far away, large, smooth mountains with bluish tint
  backLayer: {
    count: 40, // Number of mountains in this ring
    radiusMin: 3000, // Closest distance from player (units)
    radiusMax: 5000, // Farthest distance from player (units)
    scaleMin: 700, // Minimum mountain height (units)
    scaleMax: 1400, // Maximum mountain height (units)
    yOffset: -20, // Vertical position (lower = below track, higher = above track)
    noiseScale: 0.002, // Noise frequency (lower = smoother)
    detail: 2, // Detail level 0-1 (lower = smoother peaks)
  },

  // MID LAYER - Medium distance, detailed, white/rocky mountains
  midLayer: {
    count: 24,
    radiusMin: 800,
    radiusMax: 1500,
    scaleMin: 500,
    scaleMax: 800,
    yOffset: 0, // Adjust this to change mid-layer height
    noiseScale: 0.005,
    detail: 1.0, // Full detail for jagged look
  },

  // FRONT LAYER - Close, small peaks to fill gaps
  frontLayer: {
    count: 16,
    radiusMin: 600,
    radiusMax: 800,
    scaleMin: 250,
    scaleMax: 500,
    yOffset: 0, // Adjust this to change front-layer height
    noiseScale: 0.008,
    detail: 1.5,
  },

  // FLOOR - Base plane to hide void below mountains
  floor: {
    radius: 5000, // Size of the floor disc
    yPosition: -50, // Vertical position (should be below track)
  },
} as const;

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
    const zenithColor = new THREE.Color(COLOR_PALETTE.background.sky);
    const horizonColor = new THREE.Color(COLOR_PALETTE.background.fog);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uZenithColor: { value: zenithColor },
        uHorizonColor: { value: horizonColor },
        uExponent: { value: 1.2 },
      },
      vertexShader: `
        varying vec3 vPos;

        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;

        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform float uExponent;

        void main() {
          float t = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          t = pow(t, uExponent);
          vec3 color = mix(uHorizonColor, uZenithColor, t);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
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
      count: MOUNTAIN_CONFIG.backLayer.count,
      radiusMin: MOUNTAIN_CONFIG.backLayer.radiusMin,
      radiusMax: MOUNTAIN_CONFIG.backLayer.radiusMax,
      scaleMin: MOUNTAIN_CONFIG.backLayer.scaleMin,
      scaleMax: MOUNTAIN_CONFIG.backLayer.scaleMax,
      yOffset: MOUNTAIN_CONFIG.backLayer.yOffset,
      color: COLOR_PALETTE.primaryEnvironment.farMountain, // Bluish
      noiseScale: MOUNTAIN_CONFIG.backLayer.noiseScale,
      detail: MOUNTAIN_CONFIG.backLayer.detail,
    });

    // 2. MID LAYER
    // Closer, detailed, white/rocky
    this.scatterRing({
      count: MOUNTAIN_CONFIG.midLayer.count,
      radiusMin: MOUNTAIN_CONFIG.midLayer.radiusMin,
      radiusMax: MOUNTAIN_CONFIG.midLayer.radiusMax,
      scaleMin: MOUNTAIN_CONFIG.midLayer.scaleMin,
      scaleMax: MOUNTAIN_CONFIG.midLayer.scaleMax,
      yOffset: MOUNTAIN_CONFIG.midLayer.yOffset,
      color: COLOR_PALETTE.primaryEnvironment.snowWhite,
      noiseScale: MOUNTAIN_CONFIG.midLayer.noiseScale,
      detail: MOUNTAIN_CONFIG.midLayer.detail,
    });

    // 3. FRONT/SIDE CLUSTERS
    // Small peaks to fill gaps near the horizon
    this.scatterRing({
      count: MOUNTAIN_CONFIG.frontLayer.count,
      radiusMin: MOUNTAIN_CONFIG.frontLayer.radiusMin,
      radiusMax: MOUNTAIN_CONFIG.frontLayer.radiusMax,
      scaleMin: MOUNTAIN_CONFIG.frontLayer.scaleMin,
      scaleMax: MOUNTAIN_CONFIG.frontLayer.scaleMax,
      yOffset: MOUNTAIN_CONFIG.frontLayer.yOffset,
      color: COLOR_PALETTE.primaryEnvironment.snowWhite,
      noiseScale: MOUNTAIN_CONFIG.frontLayer.noiseScale,
      detail: MOUNTAIN_CONFIG.frontLayer.detail,
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
    const geometry = new THREE.CircleGeometry(MOUNTAIN_CONFIG.floor.radius, 32);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.primaryEnvironment.snowWhite,
      roughness: 1.0,
    });

    const floor = new THREE.Mesh(geometry, material);
    floor.position.y = MOUNTAIN_CONFIG.floor.yPosition;
    floor.renderOrder = -2;
    this.group.add(floor);
  }

  update(cameraPosition: THREE.Vector3): void {
    // 1. Sky Dome follows camera exactly
    this.skyDome.position.copy(cameraPosition);

    // 2. Mountains follow the camera on X/Z/Y (Infinite feeling)
    // Mountains are positioned relative to the player so they remain visible
    // no matter how far down the player skis. The yOffset values in the config
    // define the relative height above/below the player.
    // The globalYOffset allows fine-tuning the overall vertical position.
    this.group.position.x = cameraPosition.x;
    this.group.position.y = cameraPosition.y + MOUNTAIN_CONFIG.globalYOffset;
    this.group.position.z = cameraPosition.z;

    // 3. Parallax Effect (Optional - purely visual polish)
    // Rotate the group extremely slowly based on position to simulate 3D depth shift
    // this.group.rotation.y = cameraPosition.z * 0.0001;
  }
}
