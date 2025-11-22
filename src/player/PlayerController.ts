import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from '../core/PhysicsSystem';

type PlayerOptions = {
  startPosition?: THREE.Vector3;
  radius?: number;
};

export class PlayerController {
  readonly mesh: THREE.Mesh;
  readonly camera: THREE.PerspectiveCamera;
  readonly body: RAPIER.RigidBody;

  constructor(scene: THREE.Scene, physics: PhysicsSystem, options?: PlayerOptions) {
    const rapier = physics.getRapier();
    const radius = options?.radius ?? 1.6;
    const startPosition = options?.startPosition ?? new THREE.Vector3(0, 50, 20);

    const geometry = new THREE.IcosahedronGeometry(radius, 0);
    const material = new THREE.MeshStandardMaterial({
      color: '#ff6b35',
      roughness: 0.4,
      metalness: 0.05,
      flatShading: true,
      emissive: '#ff2200',
      emissiveIntensity: 0.5,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(startPosition);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    this.camera.position.set(0, radius * 0.35, 0.35);
    this.camera.rotation.x = -0.15;
    this.mesh.add(this.camera);

    this.body = physics.addBody(
      this.mesh,
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(startPosition.x, startPosition.y, startPosition.z)
        .setLinearDamping(0.05)
        .setAngularDamping(0.6),
      rapier.ColliderDesc.ball(radius).setFriction(0.02).setRestitution(0.1)
    );

    scene.add(this.mesh);
  }
}
