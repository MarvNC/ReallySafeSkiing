import * as THREE from 'three';

import { COLOR_PALETTE } from '../constants/colors';
import { TerrainManager } from './TerrainManager';

export class SnowSparkles {
  public points: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly phases: Float32Array;
  private readonly twinkleSpeeds: Float32Array;
  private readonly baseAlphas: Float32Array;
  private readonly count: number;
  private readonly terrain: TerrainManager;

  private readonly baseColor = new THREE.Color(COLOR_PALETTE.primaryEnvironment.iceBlue).lerp(
    new THREE.Color(0xffffff),
    0.35
  );
  private readonly spawnRadiusNear = 8;
  private readonly spawnRadiusFar = 220;
  private readonly maxDistance = 520;
  private readonly maxBehindDistance = 20;
  private readonly forwardArc = Math.PI / 3; // +/- 60deg
  private readonly verticalOffset = 0.08;
  private readonly spawnHeightMax = 35;

  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpCamPos = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpSunDir = new THREE.Vector3();
  private readonly yawQuat = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(terrain: TerrainManager) {
    this.terrain = terrain;
    this.count = this.isMobile() ? 1400 : 2600;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.phases = new Float32Array(this.count);
    this.twinkleSpeeds = new Float32Array(this.count);
    this.baseAlphas = new Float32Array(this.count);

    this.material = new THREE.PointsMaterial({
      size: 0.06,
      map: this.createSparkleTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      color: new THREE.Color(0xffffff),
      sizeAttenuation: true,
    });

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;

    const origin = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < this.count; i++) {
      this.respawnSparkle(i, origin, forward);
    }
    this.updateColorBuffer(0.016, forward, new THREE.Vector3(0, -1, 0));
  }

  update(delta: number, camera: THREE.Camera, sunDir: THREE.Vector3): void {
    if (!this.points.visible) return;

    camera.getWorldPosition(this.tmpCamPos);
    this.tmpForward.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    if (this.tmpForward.lengthSq() < 1e-4) {
      this.tmpForward.set(0, 0, -1);
    } else {
      this.tmpForward.normalize();
    }

    this.tmpSunDir.copy(sunDir).normalize().multiplyScalar(-1);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      this.tmpPos.fromArray(this.positions, idx);

      const toCamera = this.tmpDir.subVectors(this.tmpPos, this.tmpCamPos);
      const distance = toCamera.length();

      const invLen = distance > 1e-5 ? 1 / distance : 0;
      const forwardDot = invLen > 0 ? this.tmpForward.dot(toCamera) * invLen : 0;
      const alongForward = this.tmpForward.dot(toCamera);

      if (
        distance > this.maxDistance ||
        forwardDot < -0.15 ||
        alongForward < -this.maxBehindDistance
      ) {
        this.respawnSparkle(i, this.tmpCamPos, this.tmpForward);
        continue;
      }
    }

    this.updateColorBuffer(delta, this.tmpForward, this.tmpSunDir);

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.points.visible = visible;
  }

  private respawnSparkle(index: number, cameraPos: THREE.Vector3, forward: THREE.Vector3): void {
    const angleOffset = (Math.random() - 0.5) * this.forwardArc;
    this.yawQuat.setFromAxisAngle(this.up, angleOffset);

    const dir = this.tmpDir.copy(forward.lengthSq() > 0 ? forward : new THREE.Vector3(0, 0, -1));
    dir.applyQuaternion(this.yawQuat).normalize();

    const distance = THREE.MathUtils.lerp(this.spawnRadiusNear, this.spawnRadiusFar, Math.random());

    const spawnPos = this.tmpPos.copy(cameraPos).addScaledVector(dir, distance);
    const terrainY = this.terrain.getTerrainHeight(spawnPos.x, spawnPos.z);
    const heightOffset = Math.random() * this.spawnHeightMax;

    const idx = index * 3;
    this.positions[idx] = spawnPos.x;
    this.positions[idx + 1] = terrainY + this.verticalOffset + heightOffset;
    this.positions[idx + 2] = spawnPos.z;

    this.baseAlphas[index] = 0.35 + Math.random() * 0.35;
    this.phases[index] = Math.random() * Math.PI * 2;
    this.twinkleSpeeds[index] = 2.0 + Math.random() * 3.0;
  }

  private updateColorBuffer(delta: number, forward: THREE.Vector3, sunDir: THREE.Vector3): void {
    const viewToSun = sunDir;
    const sunElevation = Math.max(0.2, viewToSun.y * 0.5 + 0.5);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const twinkle = 0.5 + 0.5 * Math.sin(this.phases[i]);
      const facing = Math.max(0, forward.dot(viewToSun) * 0.5 + 0.5);
      const strength = this.baseAlphas[i] * twinkle * sunElevation * (0.4 + 0.6 * facing);

      this.colors[idx] = this.baseColor.r * strength;
      this.colors[idx + 1] = this.baseColor.g * strength;
      this.colors[idx + 2] = this.baseColor.b * strength;

      this.phases[i] += delta * this.twinkleSpeeds[i];
    }
  }

  private createSparkleTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (context) {
      const center = size / 2;
      const gradient = context.createRadialGradient(center, center, 0, center, center, center);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.4, 'rgba(210, 235, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(210, 235, 255, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private isMobile(): boolean {
    return typeof navigator !== 'undefined' ? /Mobi|Android/i.test(navigator.userAgent) : false;
  }
}
