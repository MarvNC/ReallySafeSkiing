import * as THREE from 'three';

import { COLOR_PALETTE, GRAPHICS_PRESET, LIGHTING_CONFIG } from '../config/GameConfig';
import { SunEffects } from './SunEffects';

const ENABLE_FOG = true;

type UpdateArgs = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  camera: THREE.Camera;
};

export class LightingManager {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sunDirection = LIGHTING_CONFIG.sun.direction.clone();

  private sun!: THREE.DirectionalLight;
  private sunTarget!: THREE.Object3D;
  private hemisphere!: THREE.HemisphereLight;
  private ambient!: THREE.AmbientLight;
  private sunEffects?: SunEffects;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
  }

  init(): void {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.createSun();
    this.createFillLights();
    this.applyFogAndSky();
    this.update({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      camera: new THREE.PerspectiveCamera(),
    });
  }

  update({ position, velocity, camera }: UpdateArgs): void {
    if (!this.sun || !this.sunTarget) return;

    const shadowScale = LIGHTING_CONFIG.shadow.distanceMultiplier;
    const lookDir = this.computeLookDirection(velocity);
    const focus = position
      .clone()
      .add(lookDir.multiplyScalar(LIGHTING_CONFIG.sun.followDistance * shadowScale));

    const sunBackOffset = this.sunDirection
      .clone()
      .multiplyScalar(-LIGHTING_CONFIG.sun.positionOffset);
    const sunForwardOffset = this.sunDirection
      .clone()
      .multiplyScalar(LIGHTING_CONFIG.sun.targetOffset);

    this.sun.position.copy(focus.clone().add(sunBackOffset));
    this.sunTarget.position.copy(focus.clone().add(sunForwardOffset));
    this.sun.target = this.sunTarget;
    this.sunTarget.updateMatrixWorld();

    this.sunEffects?.update(camera);
  }

  private createSun(): void {
    const intensity = LIGHTING_CONFIG.sun.intensity;
    const mapSize =
      GRAPHICS_PRESET === 'high'
        ? LIGHTING_CONFIG.sun.shadow.mapSizeHigh
        : LIGHTING_CONFIG.sun.shadow.mapSizeLow;
    const camNear = LIGHTING_CONFIG.sun.shadow.cameraNear;
    const camFar = LIGHTING_CONFIG.sun.shadow.cameraFar;

    this.sun = new THREE.DirectionalLight(LIGHTING_CONFIG.sun.color, intensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    this.sun.shadow.bias = LIGHTING_CONFIG.sun.shadow.bias;
    this.sun.shadow.normalBias = LIGHTING_CONFIG.sun.shadow.normalBias;

    const shadowScale = LIGHTING_CONFIG.shadow.distanceMultiplier;
    const shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;
    const halfExtent = LIGHTING_CONFIG.sun.shadow.bounds * shadowScale;
    shadowCam.left = -halfExtent;
    shadowCam.right = halfExtent;
    shadowCam.top = halfExtent;
    shadowCam.bottom = -halfExtent;
    shadowCam.near = camNear;
    shadowCam.far = camFar * shadowScale;
    shadowCam.updateProjectionMatrix();

    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.scene.add(this.sun);

    this.sunEffects = new SunEffects(this.sun);
  }

  private createFillLights(): void {
    const hemiIntensity = LIGHTING_CONFIG.hemisphereLight.intensity;
    const ambientIntensity = LIGHTING_CONFIG.ambientLight.intensity;

    this.hemisphere = new THREE.HemisphereLight(
      LIGHTING_CONFIG.hemisphereLight.skyColor,
      LIGHTING_CONFIG.hemisphereLight.groundColor,
      hemiIntensity
    );
    this.ambient = new THREE.AmbientLight(LIGHTING_CONFIG.ambientLight.color, ambientIntensity);

    this.scene.add(this.hemisphere, this.ambient);
  }

  private applyFogAndSky(): void {
    const bgColor = new THREE.Color(COLOR_PALETTE.background.sky);
    this.scene.background = bgColor;

    if (!ENABLE_FOG) {
      this.scene.fog = null;
      return;
    }

    const fogColorHex = LIGHTING_CONFIG.fog.color;
    const near = LIGHTING_CONFIG.fog.near;
    const far = LIGHTING_CONFIG.fog.far;

    this.scene.fog = new THREE.Fog(fogColorHex, near, far);
  }

  private computeLookDirection(velocity: THREE.Vector3): THREE.Vector3 {
    const vel = velocity.clone();
    vel.y = 0;
    const hasVelocity = vel.lengthSq() > 1e-4;
    const velocityDir = hasVelocity
      ? vel.normalize()
      : this.sunDirection.clone().multiplyScalar(-1);

    const blended = velocityDir
      .clone()
      .lerp(this.sunDirection.clone().multiplyScalar(-1), 0.25)
      .normalize();
    return blended;
  }

  getSunDirection(): THREE.Vector3 {
    return this.sunDirection.clone();
  }
}
