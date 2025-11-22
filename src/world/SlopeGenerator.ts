import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from '../core/PhysicsSystem';

export class SlopeGenerator {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private halfSize: number;

  constructor(size = 8000, slopeAngle = Math.PI / 3) {
    this.halfSize = size / 2;

    const geometry = new THREE.PlaneGeometry(size, size, 64, 64);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.6,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;

    // Rotate so the slope runs downhill along -Z with a noticeable pitch.
    // Using a shallow negative tilt keeps the plane in view while still sloped.
    this.mesh.rotation.x = -Math.PI / 2 + slopeAngle;
    this.mesh.position.set(0, 0, 0);
  }

  setWireframe(enabled: boolean): void {
    this.mesh.material.wireframe = enabled;
    this.mesh.material.needsUpdate = true;
  }

  register(physics: PhysicsSystem): void {
    const tilt = this.mesh.quaternion;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z)
      .setRotation({ x: tilt.x, y: tilt.y, z: tilt.z, w: tilt.w });

    const colliderDesc = RAPIER.ColliderDesc.cuboid(this.halfSize, 0.25, this.halfSize)
      .setFriction(0.05)
      .setRestitution(0);

    physics.addBody(this.mesh, bodyDesc, colliderDesc);
  }
}
