import * as THREE from 'three';

import { createMountainRangeGeometry } from './assets/MountainGeometry';

export class BackgroundEnvironment {
  private group: THREE.Group;
  private skyDome!: THREE.Mesh;
  private distantMountains!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.createSkyDome();
    this.createDistantMountains();
  }

  private createSkyDome(): void {
    // Huge sphere for the sky
    const geometry = new THREE.SphereGeometry(4000, 32, 16);
    // Invert geometry so we see the inside
    geometry.scale(-1, 1, 1);
    // Vertex colors for gradient
    const count = geometry.attributes.position.count;
    const colors: number[] = [];
    const positions = geometry.attributes.position;
    const zenithColor = new THREE.Color('#4a90e2'); // Deep blue sky
    const horizonColor = new THREE.Color('#87CEEB'); // Sky blue horizon

    for (let i = 0; i < count; i++) {
      const y = positions.getY(i);
      // Map Y from -4000 to 4000 to 0..1, but bias towards top
      const normalizedY = (y + 4000) / 8000;
      const color = new THREE.Color()
        .copy(horizonColor)
        .lerp(zenithColor, Math.pow(normalizedY, 2));
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false, // Sky shouldn't be affected by fog
    });
    this.skyDome = new THREE.Mesh(geometry, material);
    this.group.add(this.skyDome);
  }

  private createDistantMountains(): void {
    this.distantMountains = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      flatShading: true,
    });
    // Create a ring of mountains
    const ringRadius = 1500;
    const segments = 12;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.sin(angle) * ringRadius;
      const z = Math.cos(angle) * ringRadius;
      // Skip mountains directly behind the start (optional, saves draw calls)
      // if (Math.abs(angle) < 0.5) continue;

      const geometry = createMountainRangeGeometry(600, 400, 300, 8);
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(x, -50, z); // Sunk slightly
      mesh.lookAt(0, 0, 0);

      this.distantMountains.add(mesh);
    }
    this.group.add(this.distantMountains);
  }

  update(cameraPosition: THREE.Vector3): void {
    // 1. Sky Dome follows camera exactly (infinite distance)
    this.skyDome.position.copy(cameraPosition);
    // 2. Mountains follow camera generally, but we can rotate them
    // or offset them to fake parallax.
    // For a simple "Far away" effect in a runner:
    // Move the container WITH the camera so you never reach them.
    this.distantMountains.position.x = cameraPosition.x;
    this.distantMountains.position.z = cameraPosition.z;

    // Optional: Vertical parallax (mountains allow to look over them when flying high)
    this.distantMountains.position.y = cameraPosition.y * 0.8 - 100;

    // Optional: Refined Parallax (The "Pass-by" Effect)
    // Makes the mountains look like they are passing by (not just static in the distance)
    const rotationSpeed = 0.0001; // Very slow rotation
    this.distantMountains.rotation.y = cameraPosition.z * rotationSpeed;
  }
}
