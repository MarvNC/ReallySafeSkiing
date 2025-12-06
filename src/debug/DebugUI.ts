import * as THREE from 'three';

export class DebugUI {
  private container: HTMLElement;
  private isVisible = false;
  private fpsCounter = 0;
  private currentFps = 0;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'debug-ui';
    this.container.style.display = 'none';
    parent.appendChild(this.container);
  }

  update(
    playerPosition: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    playerRotation: THREE.Quaternion,
    camera: THREE.Camera,
    deltaTime: number,
    shadowsEnabled: boolean,
    extra?: {
      physics?: {
        yaw: number;
        isAwake: boolean;
        isPushing: boolean;
        isBraking: boolean;
        steerInput: number;
        linearVelocity: THREE.Vector3;
        lastForwardImpulse: number;
        lastLateralImpulse: number;
      };
      input?: {
        forward: boolean;
        steerLeft: boolean;
        steerRight: boolean;
        braking: boolean;
      };
    }
  ): void {
    if (!this.isVisible) return;

    // Calculate FPS
    this.fpsCounter += deltaTime;
    if (this.fpsCounter >= 1.0) {
      this.currentFps = Math.round(1.0 / deltaTime);
      this.fpsCounter = 0;
    }

    // Get direction vectors from rotation
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRotation);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerRotation);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(playerRotation);

    // Get camera rotation
    const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion);

    // Format numbers
    const format = (n: number, decimals = 2) => n?.toFixed(decimals);
    const formatVec = (v: THREE.Vector3, decimals = 2) =>
      `(${format(v.x, decimals)}, ${format(v.y, decimals)}, ${format(v.z, decimals)})`;

    // Build HTML
    this.container.innerHTML = `
      <div class="debug-section">
        <h3>Debug Info</h3>
        <div class="debug-row">
          <span class="debug-label">FPS:</span>
          <span class="debug-value">${this.currentFps}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Position:</span>
          <span class="debug-value">${formatVec(playerPosition)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Velocity:</span>
          <span class="debug-value">${formatVec(playerVelocity)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Speed:</span>
          <span class="debug-value">${format(playerVelocity.length(), 2)} m/s</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Forward:</span>
          <span class="debug-value">${formatVec(forward)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Right:</span>
          <span class="debug-value">${formatVec(right)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Up:</span>
          <span class="debug-value">${formatVec(up)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Rotation:</span>
          <span class="debug-value">${(() => {
            const euler = new THREE.Euler().setFromQuaternion(playerRotation);
            return `(${format(euler.x)}, ${format(euler.y)}, ${format(euler.z)})`;
          })()}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Camera Pos:</span>
          <span class="debug-value">${formatVec(camera.position)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Camera Rot:</span>
          <span class="debug-value">(${format(cameraEuler.x)}, ${format(cameraEuler.y)}, ${format(
            cameraEuler.z
          )})</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Shadows:</span>
          <span class="debug-value">${shadowsEnabled ? 'ON' : 'OFF'}</span>
        </div>
        ${
          extra?.physics
            ? `
        <div class="debug-row">
          <span class="debug-label">Phys Awake:</span>
          <span class="debug-value">${extra.physics.isAwake}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Yaw(deg):</span>
          <span class="debug-value">${format(THREE.MathUtils.radToDeg(extra.physics.yaw), 1)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Steer:</span>
          <span class="debug-value">${extra.physics.steerInput}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Push:</span>
          <span class="debug-value">${extra.physics.isPushing} (${format(
            extra.physics.lastForwardImpulse,
            3
          )})</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Brake:</span>
          <span class="debug-value">${extra.physics.isBraking} (damp ${
            extra.physics.isBraking ? 'on' : 'off'
          })</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Lat Imp:</span>
          <span class="debug-value">${format(extra.physics.lastLateralImpulse, 3)}</span>
        </div>
        `
            : ''
        }
        ${
          extra?.input
            ? `
        <div class="debug-row">
          <span class="debug-label">Input:</span>
          <span class="debug-value">F:${extra.input.forward} L:${extra.input.steerLeft} R:${extra.input.steerRight} B:${extra.input.braking}</span>
        </div>
        `
            : ''
        }
      </div>
      <div class="debug-section">
        <h3>Controls</h3>
        <div class="debug-row"><span class="debug-label">C:</span> Toggle Camera</div>
        <div class="debug-row"><span class="debug-label">V:</span> Toggle Wireframe</div>
        <div class="debug-row"><span class="debug-label">G:</span> Toggle Grid</div>
        <div class="debug-row"><span class="debug-label">F2:</span> Toggle Debug UI</div>
      </div>
    `;
  }

  toggle(): boolean {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'block' : 'none';
    return this.isVisible;
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.style.display = this.isVisible ? 'block' : 'none';
  }
}
