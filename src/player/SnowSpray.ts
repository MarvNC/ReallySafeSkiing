import * as THREE from 'three';

export class SnowSpray {
  public mesh: THREE.Points;
  private positions: Float32Array;
  private life: Float32Array;
  private velocity: Float32Array;
  private count = 200;
  private currentIdx = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.velocity = new Float32Array(this.count * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('life', new THREE.BufferAttribute(this.life, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.4,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float life;\nvarying float vLife;'
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLife = life;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLife;')
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( diffuse, opacity * vLife );'
        );
    };

    this.mesh = new THREE.Points(geo, mat);
    this.mesh.frustumCulled = false;
  }

  emit(pos: THREE.Vector3, right: THREE.Vector3, intensity: number) {
    const spawnCount = Math.ceil(intensity * 4);
    for (let k = 0; k < spawnCount; k++) {
      const i = this.currentIdx;

      this.positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.5;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.5;

      this.life[i] = 1.0;

      this.velocity[i * 3] = -right.x * intensity * 2 + (Math.random() - 0.5);
      this.velocity[i * 3 + 1] = Math.random() * 2 * intensity;
      this.velocity[i * 3 + 2] = 2.0;

      this.currentIdx = (this.currentIdx + 1) % this.count;
    }
  }

  update(dt: number) {
    const decay = 2.0 * dt;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= decay;
        this.positions[i * 3] += this.velocity[i * 3] * dt;
        this.positions[i * 3 + 1] += this.velocity[i * 3 + 1] * dt;
        this.positions[i * 3 + 2] += this.velocity[i * 3 + 2] * dt;
        this.velocity[i * 3 + 1] -= 5.0 * dt;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.life.needsUpdate = true;
  }
}
