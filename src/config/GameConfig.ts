import * as THREE from 'three';

export const PHYSICS_CONFIG = {
  // Global gravity for the game world
  gravity: new THREE.Vector3(0, -20, 0),
  // Safety clamp for the physics timestep
  maxDeltaTime: 1 / 20,
} as const;

export const GAME_CONFIG = {
  // Game timer duration in seconds
  timerDuration: 60.0,
} as const;

export const PLAYER_CONFIG = {
  radius: 1.6,
  startPosition: new THREE.Vector3(0, 15, -5),
  physics: {
    capsuleRadius: 0.5,
    capsuleHalfHeight: 1.0,
    mass: 100, // Reduced mass slightly to make forces feel snappier

    // Remove general air resistance. We will calculate drag manually.
    angularDamping: 3.0, // High damping to stop spinning instantly when key is released

    // Ski properties
    lateralFriction: 2.0, // "Edge Grip": How hard it stops you sliding sideways
    forwardFriction: 0.05, // "Wax": Very low friction sliding forward

    // Poling mechanics
    poleForce: 10.0, // Strong initial push
    maxPoleSpeed: 15.0, // You can't pole effectively above this speed

    // Steering
    steerTurnSpeed: 1, // Rotation speed

    // Physics limits
    brakeDamping: 7.0, // Drag applied when "snowplowing"
  },
  camera: {
    fov: 75,
    near: 0.1,
    far: 8000,
    eyeHeight: 0.1,
    tiltRadians: -0.6,
  },
  hands: {
    leftOffset: new THREE.Vector3(-0.3, -0.3, -0.5),
    rightOffset: new THREE.Vector3(0.3, -0.3, -0.5),
    rightMirrorScaleX: -1,
    poleAngleRadians: Math.PI / 12,
    lateralMovementAmount: 0.15, // How far hands move left/right when steering
    lateralAnimationSpeed: 8.0, // Speed of lateral animation interpolation
    brakeRotationInward: Math.PI / 6, // How much hands rotate inward when braking (30 degrees)
    brakeRotationForward: Math.PI / 8, // How much hands rotate forward when braking (22.5 degrees)
    rotationAnimationSpeed: 10.0, // Speed of rotation animation interpolation
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
  START_ALTITUDE: 2000, // Y height at start
  END_ALTITUDE: 0, // Y height at finish
} as const;

export const TERRAIN_DIMENSIONS = {
  CHUNK_WIDTH: 150,
  CHUNK_LENGTH: 150,
  CHUNK_SEGMENTS: 60,
} as const;

export const TERRAIN_CONFIG = {
  SEGMENT_LENGTH: 8, // Distance between samples along the spine (lower = more detail, more cost)
  AMPLITUDE: 60, // Overall lateral swing of the path, i.e. “windiness”
  NOISE_SCALE: 0.02, // Frequency of the Perlin offset used for meanders
  MEANDER1_FREQ: 1.0, // Slow sine wave that creates large sweeping turns
  MEANDER2_FREQ: 2.0, // Faster sine wave layered on top for jittery variation
  WIDTH_BASE: 30, // Average track width before per-point noise
  WIDTH_NOISE_SCALE: 0.01, // Frequency for width noise sampling along the run
  WIDTH_VARIATION: 0.4, // Strength of width noise (0 = uniform width)
  SMOOTHING_WINDOW: 5, // Window size for the moving average used to smooth X offsets
  BANKING_STRENGTH: 0.5, // Scales how aggressively turns bank the snow surface
  TURN_SPEED: 0.04, // Controls how quickly the path changes direction
  WIDTH_MIN: 20, // Minimum track width
  WIDTH_MAX: 32.5, // Maximum track width
  MOGUL_SCALE: 0.2,
  MOGUL_HEIGHT: 0.7, // Reduced from 1.0 to make ground less bumpy
  ANGLE_INTERPOLATION: 0.15, // How quickly the path follows the target angle
  CANYON_FLOOR_OFFSET: 20, // Additional width beyond track for canyon floor
  CANYON_HEIGHT: 25, // The max height of the cliff
  WALL_WIDTH: 12, // How wide the slope is horizontally
  OBSTACLE_COUNT: 200, // Number of obstacles per chunk
} as const;

export const OBSTACLE_CONFIG = {
  // Grid spacing for obstacle placement
  gridSize: 5,
  // Noise scale for variety in placement
  noiseScale: 0.1,
  // Obstacle generation settings per surface type
  // Proportions are relative - code will normalize them to percentages
  surfaces: {
    track: {
      rarity: 5, // Overall rarity (relative - lower = rarer)
      treeProportion: 1, // Tree proportion when obstacle appears
      rockProportion: 4, // Rock proportion when obstacle appears
      treeSizes: {
        small: 1, // Small tree proportion
        medium: 0, // Medium tree proportion
        large: 0, // Large tree proportion
      },
    },
    bank: {
      rarity: 10, // Overall rarity
      treeProportion: 3, // Tree proportion
      rockProportion: 1, // Rock proportion
      treeSizes: {
        small: 1, // Small tree proportion
        medium: 2, // Medium tree proportion
        large: 1, // Large tree proportion
      },
      // Noise thresholds for tree size variety (0-1 range) with probabilities
      noiseThresholds: {
        small: { min: 0.3, max: 0.5, probability: 0.25 },
        medium: { min: 0.5, max: 0.7, probability: 0.3 },
        large: { min: 0.7, max: 1.0, probability: 0.2 },
      },
      rockProbability: 0.15, // Probability for rocks when no tree is placed
    },
    cliff: {
      rarity: 5, // Overall rarity
      treeProportion: 1, // Tree proportion
      rockProportion: 1, // Rock proportion
      treeSizes: {
        small: 1, // Small tree proportion
        medium: 1, // Medium tree proportion
        large: 0, // Large tree proportion
      },
      // Noise thresholds for tree size variety with probabilities
      noiseThresholds: {
        small: { min: 0.4, max: 0.6, probability: 0.1 },
        medium: { min: 0.6, max: 1.0, probability: 0.08 },
        large: { min: 0, max: 0, probability: 0 }, // Not used
      },
      rockProbability: 0.08, // Probability for rocks
    },
    plateau: {
      rarity: 15, // Overall rarity
      treeProportion: 3, // Tree proportion
      rockProportion: 0, // Rock proportion (no rocks on plateau)
      deadTreeProportion: 1, // Dead tree proportion
      treeSizes: {
        small: 1, // Small tree proportion
        medium: 2, // Medium tree proportion
        large: 3, // Large tree proportion
      },
      // Noise thresholds for variety with probabilities
      noiseThresholds: {
        deadTree: { min: 0, max: 0.4, probability: 0.1 },
        small: { min: 0.4, max: 0.6, probability: 0.6 },
        medium: { min: 0.6, max: 0.8, probability: 0.7 },
        large: { min: 0.8, max: 1.0, probability: 0.8 },
      },
    },
  },
} as const;

export const LIGHTING_CONFIG = {
  keyLight: {
    color: '#ffffff',
    intensity: 2.0,
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
