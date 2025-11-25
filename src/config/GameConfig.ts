import * as THREE from 'three';

export const PHYSICS_CONFIG = {
  // Global gravity for the game world
  gravity: new THREE.Vector3(0, -20, 0),
  // Safety clamp for the physics timestep
  maxDeltaTime: 1 / 20,
} as const;

export const SKI_PHYSICS = {
  turnTorque: 4.0, // How fast player rotates
  maxSpeed: 35.0, // Terminal velocity
  lateralFriction: 6.0, // "Edge Grip" - how hard it is to slide sideways
  forwardFriction: 0.05, // "Wax" - how easily they glide forward
  snowplowDrag: 3.0, // Extra drag when A+D are pressed
  gravityScale: 2.0, // Gravity multiplier for punchy feel
  poleForce: 200.0, // Force applied when pushing
  maxPoleSpeed: 8.0, // Max speed where poling works effectively
  baseDrag: 0.1, // Normal air resistance
  polingDrag: 1.5, // High air resistance when standing up to pole at speed
} as const;

export const PLAYER_CONFIG = {
  radius: 1.6,
  startPosition: new THREE.Vector3(0, 15, -5),
  camera: {
    fov: 75,
    near: 0.1,
    far: 8000,
    eyeHeight: 1.7,
    tiltRadians: -0.5,
  },
  hands: {
    leftOffset: new THREE.Vector3(-0.3, -0.3, -0.5),
    rightOffset: new THREE.Vector3(0.3, -0.3, -0.5),
    rightMirrorScaleX: -1,
    poleAngleRadians: Math.PI / 12,
    lateralMovementAmount: 0.15, // How far hands move left/right when steering
    lateralAnimationSpeed: 8.0, // Speed of lateral animation interpolation
  },
  skis: {
    offset: new THREE.Vector3(0, -1.5, 0.3),
  },
  animation: {
    bobSpeedScale: 2,
    maxBobAmount: 0.1,
    baseBobFrequency: 1,
  },
} as const;

export const MOUNTAIN_CONFIG = {
  TOTAL_LENGTH: 6000, // Total Z distance of the run
  START_ALTITUDE: 600, // Y height at start
  END_ALTITUDE: 0, // Y height at finish
} as const;

export const TERRAIN_DIMENSIONS = {
  CHUNK_WIDTH: 150,
  CHUNK_LENGTH: 150,
  CHUNK_SEGMENTS: 60,
} as const;

export const TERRAIN_CONFIG = {
  SLOPE_ANGLE: 0.5,
  // Tuning parameters for the new algorithm
  WINDINESS: 30, // controls noise amplitude
  NOISE_SCALE: 0.005, // controls noise frequency
  MEANDER_AMP: 40, // controls sine wave amplitude
  MEANDER_FREQ: 0.002, // controls sine wave frequency
  WIDTH_VARIATION: 0.5, // how much the width changes
  SMOOTHING_WINDOW: 5, // window size for moving average
  SEGMENT_LENGTH: 2.5, // Resolution of points

  TURN_SPEED: 0.04, // Controls how quickly the path changes direction
  WIDTH_MIN: 20, // Minimum track width
  WIDTH_MAX: 32.5, // Maximum track width
  BANKING_STRENGTH: 0.8,
  WALL_STEEPNESS: 3.0,
  MOGUL_SCALE: 0.2,
  MOGUL_HEIGHT: 0.5, // Reduced from 1.0 to make ground less bumpy
  ANGLE_INTERPOLATION: 0.15, // How quickly the path follows the target angle
  CANYON_FLOOR_OFFSET: 20, // Additional width beyond track for canyon floor
  CANYON_HEIGHT: 25, // The max height of the cliff
  WALL_WIDTH: 15, // How wide the slope is horizontally
  CLIFF_NOISE_SCALE: 0.5, // Higher frequency noise for rocks
  OBSTACLE_COUNT: 200, // Number of obstacles per chunk
} as const;

export const LIGHTING_CONFIG = {
  keyLight: {
    color: '#ffffff',
    intensity: 1.2,
    position: new THREE.Vector3(60, 200, 120),
    castShadow: true,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 10,
        far: 800,
        left: -250,
        right: 250,
        top: 250,
        bottom: -250,
      },
      bias: -0.0005,
    },
  },
  fillLight: {
    color: '#a7f0ff',
    intensity: 0.6,
    position: new THREE.Vector3(-120, 150, -80),
  },
  hemisphereLight: {
    skyColor: '#b5f5ff',
    groundColor: '#ffe7d3',
    intensity: 0.7,
  },
  ambientLight: {
    color: '#ffffff',
    intensity: 0.5,
  },
} as const;
