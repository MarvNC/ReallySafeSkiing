import * as THREE from 'three';

export class SunEffects {
  private readonly halo: THREE.Sprite;

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

  update(): void {
    // Reserved for future modulation (size/intensity vs camera angle)
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
