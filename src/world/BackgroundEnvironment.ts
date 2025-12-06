import * as THREE from 'three';
import { createBackgroundMountain } from './assets/MountainGeometry';

export class BackgroundEnvironment {
  private group: THREE.Group;
  private skyDome!: THREE.Mesh;
  private distantMountains!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // CRITICAL FIX: Force this entire group to render before the rest of the scene
    // This prevents the mountains from appearing "in front" of nearby trees.
    this.group.renderOrder = -1;

    scene.add(this.group);
    this.createSkyDome();
    this.createDistantMountains();
  }

  private createSkyDome(): void {
    const geometry = new THREE.SphereGeometry(8000, 32, 16);
    geometry.scale(-1, 1, 1);

    const count = geometry.attributes.position.count;
    const colors: number[] = [];
    const positions = geometry.attributes.position;

    // Updated Colors for a crisper, "Cold Blue" sky
    const zenithColor = new THREE.Color(0x4a90e2);
    const horizonColor = new THREE.Color(0x87ceeb);

    for (let i = 0; i < count; i++) {
      const y = positions.getY(i);
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
      fog: false,
      depthWrite: false, // Ensure sky doesn't mess with depth buffer
    });
    this.skyDome = new THREE.Mesh(geometry, material);
    this.group.add(this.skyDome);
  }

  private createDistantMountains(): void {
    this.distantMountains = new THREE.Group();

    // 1. Generate Massive Landscape Strips
    // Width: 4000, Depth: 1500, Height: 900
    const leftRange = createBackgroundMountain(4000, 1500, 900);
    const rightRange = createBackgroundMountain(4000, 1500, 900);
    const centerRange = createBackgroundMountain(4000, 1500, 1000); // Big hero mountain in back

    // 2. Position them FAR away so they don't clip nearby objects
    // Left side
    leftRange.position.set(-1800, -200, 0);
    leftRange.rotation.y = Math.PI / 8; // Angled inward slightly

    // Right side
    rightRange.position.set(1800, -200, 0);
    rightRange.rotation.y = -Math.PI / 8;

    // Center/Back
    centerRange.position.set(0, -150, -2500); // Way in the back
    centerRange.rotation.y = 0;

    this.distantMountains.add(leftRange, rightRange, centerRange);

    // IMPORTANT: Ensure materials in this group respect the render order
    this.distantMountains.children.forEach((child) => {
      child.renderOrder = -1;
    });

    this.group.add(this.distantMountains);
  }

  update(cameraPosition: THREE.Vector3): void {
    // 1. Sky Dome follows camera exactly
    this.skyDome.position.copy(cameraPosition);

    // 2. Mountains follow camera to appear infinite
    // We update X and Z so you never pass them, but we keep Y static
    // relative to the world so they look like they rise from the ground.
    this.distantMountains.position.x = cameraPosition.x;
    this.distantMountains.position.z = cameraPosition.z;

    // Optional: Subtle rotation for parallax feel
    this.distantMountains.rotation.y = cameraPosition.x * 0.00005;
  }
}
