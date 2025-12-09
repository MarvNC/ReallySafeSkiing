import * as THREE from 'three';

import { COLOR_PALETTE } from '../config/GameConfig';
import { TerrainManager } from './TerrainManager';

export class SnowSparkles {
  public points: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly baseHeights: Float32Array;
  private readonly sizes: Float32Array;
  private readonly phases: Float32Array;
  private readonly twinkleSpeeds: Float32Array;
  private readonly baseAlphas: Float32Array;
  private readonly driftAngles: Float32Array;
  private readonly driftSpeeds: Float32Array;
  private readonly tintStrengths: Float32Array;
  private readonly heightJitters: Float32Array;
  private readonly count: number;
  private readonly terrain: TerrainManager;

  private readonly baseColor = new THREE.Color(COLOR_PALETTE.primaryEnvironment.iceBlue).lerp(
    new THREE.Color(0xffffff),
    0.5
  );
  private readonly spawnRadiusNear = 5.5;
  private readonly spawnRadiusFar = 200;
  private readonly maxDistance = 480;
  private readonly maxBehindDistance = 45;
  private readonly forwardArc = Math.PI / 2.2; // Wider arc to keep sparkles in view
  private readonly verticalOffset = 0.22;
  private readonly spawnHeightMax = 12;

  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpCamPos = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpSunDir = new THREE.Vector3();
  private readonly yawQuat = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(terrain: TerrainManager) {
    this.terrain = terrain;
    this.count = 6500;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.baseHeights = new Float32Array(this.count);
    this.sizes = new Float32Array(this.count);
    this.phases = new Float32Array(this.count);
    this.twinkleSpeeds = new Float32Array(this.count);
    this.baseAlphas = new Float32Array(this.count);
    this.driftAngles = new Float32Array(this.count);
    this.driftSpeeds = new Float32Array(this.count);
    this.tintStrengths = new Float32Array(this.count);
    this.heightJitters = new Float32Array(this.count);

    this.material = new THREE.PointsMaterial({
      size: 1.0, // Actual per-point size comes from aSize attribute
      map: this.createSparkleTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      color: new THREE.Color(0xffffff),
      sizeAttenuation: true,
      opacity: 0.95,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        /* glsl */ `
attribute float aSize;
void main() {
`
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        /* glsl */ `
gl_PointSize = size * aSize;
`
      );
    };

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

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

    let sizeNeedsUpdate = false;
    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const driftAngle = (this.driftAngles[i] += this.driftSpeeds[i] * delta);
      const driftStep = (0.45 + this.baseAlphas[i] * 0.65) * delta;

      this.positions[idx] += Math.cos(driftAngle) * driftStep;
      this.positions[idx + 2] += Math.sin(driftAngle) * driftStep;

      const bobPhase = this.phases[i] * 0.35 + driftAngle * 0.15;
      this.positions[idx + 1] =
        this.baseHeights[i] + Math.sin(bobPhase) * 0.2 * this.heightJitters[i];

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
        sizeNeedsUpdate = true;
        continue;
      }
    }

    this.updateColorBuffer(delta, this.tmpForward, this.tmpSunDir);

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    if (sizeNeedsUpdate) {
      (this.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  reset(camera: THREE.Camera, sunDir: THREE.Vector3): void {
    camera.getWorldPosition(this.tmpCamPos);
    this.tmpForward.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    if (this.tmpForward.lengthSq() < 1e-4) {
      this.tmpForward.set(0, 0, -1);
    } else {
      this.tmpForward.normalize();
    }

    this.tmpSunDir.copy(sunDir).normalize().multiplyScalar(-1);

    for (let i = 0; i < this.count; i++) {
      this.respawnSparkle(i, this.tmpCamPos, this.tmpForward);
    }

    this.updateColorBuffer(0.016, this.tmpForward, this.tmpSunDir);

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
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
    this.twinkleSpeeds[index] = 2.4 + Math.random() * 3.6;
    this.baseHeights[index] = this.positions[idx + 1];
    this.driftAngles[index] = Math.random() * Math.PI * 2;
    this.driftSpeeds[index] = 0.4 + Math.random() * 1.1;
    this.tintStrengths[index] = 0.75 + Math.random() * 0.25;
    this.heightJitters[index] = 0.4 + Math.random() * 0.8;

    const size = this.randomNormal(0.07, 0.04);
    this.sizes[index] = THREE.MathUtils.clamp(size, 0.01, 0.2);
  }

  private updateColorBuffer(delta: number, forward: THREE.Vector3, sunDir: THREE.Vector3): void {
    const viewToSun = sunDir;
    const sunElevation = Math.max(0.2, viewToSun.y * 0.5 + 0.5);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const twinkle = 0.5 + 0.5 * Math.sin(this.phases[i]);
      const facing = Math.max(0, forward.dot(viewToSun) * 0.5 + 0.5);
      const fresnel = Math.pow(Math.max(0, 1 - forward.dot(viewToSun)), 2.2);
      const tint = this.tintStrengths[i];
      const strength =
        this.baseAlphas[i] * twinkle * sunElevation * (0.35 + 0.65 * facing + 0.2 * fresnel);

      const coolTint = 0.85 + 0.15 * tint;
      const warmTint = 0.9 + 0.1 * (1 - tint);

      this.colors[idx] = this.baseColor.r * strength * warmTint;
      this.colors[idx + 1] = this.baseColor.g * strength * (0.9 + 0.1 * tint);
      this.colors[idx + 2] = this.baseColor.b * strength * coolTint;

      this.phases[i] += delta * this.twinkleSpeeds[i];
    }
  }

  private randomNormal(mean: number, stdDev: number): number {
    let u = 0;
    let v = 0;
    // Use Box-Muller transform for a simple Gaussian sample
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z = mag * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
  }

  private createSparkleTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (context) {
      const center = size / 2;
      const radius = size / 2;
      const gradient = context.createRadialGradient(center, center, 0, center, center, radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      gradient.addColorStop(0.32, 'rgba(230, 240, 255, 0.65)');
      gradient.addColorStop(0.55, 'rgba(200, 225, 255, 0.35)');
      gradient.addColorStop(1, 'rgba(200, 225, 255, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      const drawCross = (rotation: number, alpha: number) => {
        context.save();
        context.translate(center, center);
        context.rotate(rotation);
        context.globalAlpha = alpha;
        context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        context.lineWidth = size * 0.06;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(-radius * 0.8, 0);
        context.lineTo(radius * 0.8, 0);
        context.stroke();
        context.restore();
      };

      context.globalCompositeOperation = 'lighter';
      drawCross(0, 0.9);
      drawCross(Math.PI / 4, 0.6);

      context.beginPath();
      context.fillStyle = 'rgba(255, 255, 255, 0.95)';
      context.arc(center, center, size * 0.08, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }
}
