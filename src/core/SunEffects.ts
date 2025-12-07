import * as THREE from 'three';

export class SunEffects {
  private readonly halo: THREE.Sprite;
  private readonly tmpToSun = new THREE.Vector3();
  private readonly tmpViewDir = new THREE.Vector3();

  constructor(sun: THREE.DirectionalLight) {
    const haloTexture = this.createHaloTexture();
    const material = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color(0xfffbe0),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    material.opacity = 0.8;

    this.halo = new THREE.Sprite(material);
    this.halo.scale.set(80, 80, 1);
    this.halo.renderOrder = 1;

    sun.add(this.halo);
    this.halo.position.set(0, 0, 0);
  }

  update(camera: THREE.Camera): void {
    if (!this.halo.parent) return;

    this.tmpToSun.setFromMatrixPosition(this.halo.parent.matrixWorld).sub(camera.position).normalize();
    this.tmpViewDir.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

    const facing = Math.max(0.0, this.tmpToSun.dot(this.tmpViewDir));
    const opacity = 0.25 + 0.75 * Math.pow(facing, 4.0);

    const mat = this.halo.material as THREE.SpriteMaterial;
    mat.opacity = opacity;
  }

  setVisible(visible: boolean): void {
    this.halo.visible = visible;
  }

  private createHaloTexture(): THREE.Texture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (context) {
      const center = size / 2;
      const gradient = context.createRadialGradient(center, center, 0, center, center, center);
      gradient.addColorStop(0.0, 'rgba(255, 251, 224, 0.85)');
      gradient.addColorStop(0.4, 'rgba(255, 247, 210, 0.45)');
      gradient.addColorStop(1.0, 'rgba(255, 247, 210, 0)');

      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}
