import * as THREE from 'three';

import { LIGHTING_CONFIG } from '../config/GameConfig';

type UpdateArgs = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

export class LightingManager {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sunDirection = LIGHTING_CONFIG.sun.direction.clone();
  private readonly isMobile = LIGHTING_CONFIG.device.isMobile();

  private sun!: THREE.DirectionalLight;
  private sunTarget!: THREE.Object3D;
  private hemisphere!: THREE.HemisphereLight;
  private ambient!: THREE.AmbientLight;

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
    });
  }

  update({ position, velocity }: UpdateArgs): void {
    if (!this.sun || !this.sunTarget) return;

    const shadowScale = LIGHTING_CONFIG.shadow.distanceMultiplier ?? 1;
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
  }

  private createSun(): void {
    const intensity = this.isMobile
      ? LIGHTING_CONFIG.sun.intensity.mobile
      : LIGHTING_CONFIG.sun.intensity.desktop;
    const mapSize = this.isMobile
      ? LIGHTING_CONFIG.sun.shadow.mapSize.mobile
      : LIGHTING_CONFIG.sun.shadow.mapSize.desktop;
    const camNear = this.isMobile
      ? LIGHTING_CONFIG.sun.shadow.cameraNear.mobile
      : LIGHTING_CONFIG.sun.shadow.cameraNear.desktop;
    const camFar = this.isMobile
      ? LIGHTING_CONFIG.sun.shadow.cameraFar.mobile
      : LIGHTING_CONFIG.sun.shadow.cameraFar.desktop;

    this.sun = new THREE.DirectionalLight(LIGHTING_CONFIG.sun.color, intensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    this.sun.shadow.bias = LIGHTING_CONFIG.sun.shadow.bias;
    this.sun.shadow.normalBias = LIGHTING_CONFIG.sun.shadow.normalBias;

    const shadowScale = LIGHTING_CONFIG.shadow.distanceMultiplier ?? 1;
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
  }

  private createFillLights(): void {
    const hemiIntensity = this.isMobile
      ? LIGHTING_CONFIG.hemisphereLight.intensity.mobile
      : LIGHTING_CONFIG.hemisphereLight.intensity.desktop;
    const ambientIntensity = this.isMobile
      ? LIGHTING_CONFIG.ambientLight.intensity.mobile
      : LIGHTING_CONFIG.ambientLight.intensity.desktop;

    this.hemisphere = new THREE.HemisphereLight(
      LIGHTING_CONFIG.hemisphereLight.skyColor,
      LIGHTING_CONFIG.hemisphereLight.groundColor,
      hemiIntensity
    );
    this.ambient = new THREE.AmbientLight(LIGHTING_CONFIG.ambientLight.color, ambientIntensity);

    this.scene.add(this.hemisphere, this.ambient);
  }

  private applyFogAndSky(): void {
    const bgColor = this.isMobile
      ? LIGHTING_CONFIG.fog.color.mobile
      : LIGHTING_CONFIG.fog.color.desktop;

    const color = new THREE.Color(bgColor);
    this.scene.background = color.clone();
    this.scene.fog = null; // fog disabled
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
}
