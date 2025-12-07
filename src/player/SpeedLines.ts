import * as THREE from 'three';

export class SpeedLines {
  public mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private count = 20;
  private lines: Array<{
    x: number;
    y: number;
    z: number;
    speed: number;
    len: number;
  }> = [];

  constructor() {
    // Create geometry: thin, long white streaks
    const geometry = new THREE.CylinderGeometry(0.02, 0.02, 10, 3);
    geometry.rotateX(Math.PI / 2); // Point along Z axis

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0, // Start invisible
      depthWrite: false, // Don't block other objects
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.mesh.frustumCulled = false; // Always render if camera is active

    // Initialize line data randomly around the center
    for (let i = 0; i < this.count; i++) {
      this.lines.push(this.resetLine(new THREE.Vector3()));
    }
  }

  private resetLine(pos: THREE.Vector3) {
    // Spawn in a tunnel shape around the center (where the camera is)
    // Radius 5 to 15 units away from center
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 10;

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      // Start far ahead (negative Z is forward in WebGL/Three typically,
      // but here we want them "coming at" the camera or camera moving past them.
      // We'll simulate them moving past the camera.)
      z: -20 - Math.random() * 50,
      speed: 1.0 + Math.random() * 0.5, // Variance in speed
      len: 1.0 + Math.random() * 2.0, // Variance in length scale
    };
  }

  update(currentSpeedKmh: number) {
    // Thresholds
    const START_SPEED = 100;
    const MAX_OPACITY_SPEED = 200;

    // Calculate opacity based on speed
    let targetOpacity = 0;
    if (currentSpeedKmh > START_SPEED) {
      const ratio = Math.min(
        1.0,
        (currentSpeedKmh - START_SPEED) / (MAX_OPACITY_SPEED - START_SPEED)
      );
      targetOpacity = ratio * 0.6; // Max 60% opacity at 200km/h
    }

    // Smoothly fade opacity
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity += (targetOpacity - mat.opacity) * 0.1;

    // If fully invisible, save performance by skipping update
    if (mat.opacity < 0.01) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    // Animate lines
    // We move the lines towards positive Z (past the camera)
    for (let i = 0; i < this.count; i++) {
      const line = this.lines[i];

      // Move line 'back' towards the camera
      // The faster the player goes, the faster these should zip by
      const speedFactor = Math.max(1, currentSpeedKmh / 50);
      line.z += 2.0 * line.speed * speedFactor;

      // If it passes the camera (Z > 5), reset it to far front
      if (line.z > 10) {
        line.z = -50 - Math.random() * 20;
        // Randomize position again for variety
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 10;
        line.x = Math.cos(angle) * radius;
        line.y = Math.sin(angle) * radius;
      }

      this.dummy.position.set(line.x, line.y, line.z);
      this.dummy.scale.set(1, 1, line.len * speedFactor * 0.5); // Stretch when fast
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
