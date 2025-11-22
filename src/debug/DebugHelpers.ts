import * as THREE from 'three';

export class DebugHelpers {
  private scene: THREE.Scene;
  private playerHelpers: THREE.Group;
  private axesHelper?: THREE.AxesHelper;
  private forwardArrow?: THREE.ArrowHelper;
  private rightArrow?: THREE.ArrowHelper;
  private upArrow?: THREE.ArrowHelper;
  private velocityArrow?: THREE.ArrowHelper;
  private isVisible = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.playerHelpers = new THREE.Group();
    this.scene.add(this.playerHelpers);

    // Create direction arrows
    this.forwardArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, 0),
      5,
      0x00ff00,
      1,
      0.5
    );
    this.rightArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      5,
      0xff0000,
      1,
      0.5
    );
    this.upArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      5,
      0x0000ff,
      1,
      0.5
    );
    this.velocityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      0,
      0xffff00,
      1.5,
      0.7
    );

    this.playerHelpers.add(this.forwardArrow, this.rightArrow, this.upArrow, this.velocityArrow);
  }

  update(
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    velocity: THREE.Vector3
  ): void {
    if (!this.isVisible) return;

    // Update position
    this.playerHelpers.position.copy(position);

    // Update rotation
    this.playerHelpers.quaternion.copy(rotation);

    // Update velocity arrow
    const speed = velocity.length();
    if (speed > 0.1) {
      const normalizedVelocity = velocity.clone().normalize();
      this.velocityArrow!.setDirection(normalizedVelocity);
      this.velocityArrow!.setLength(speed * 0.5); // Scale down for visibility
      this.velocityArrow!.visible = true;
    } else {
      this.velocityArrow!.visible = false;
    }
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.playerHelpers.visible = visible;
  }

  toggle(): boolean {
    this.isVisible = !this.isVisible;
    this.playerHelpers.visible = this.isVisible;
    return this.isVisible;
  }

  addWorldAxes(size = 50): void {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
    }
    this.axesHelper = new THREE.AxesHelper(size);
    this.scene.add(this.axesHelper);
  }

  dispose(): void {
    this.forwardArrow?.dispose();
    this.rightArrow?.dispose();
    this.upArrow?.dispose();
    this.velocityArrow?.dispose();
    this.scene.remove(this.playerHelpers);
  }
}

