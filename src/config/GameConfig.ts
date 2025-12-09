import * as THREE from 'three';

export const PHYSICS_CONFIG = {
  // Global gravity for the game world
  gravity: new THREE.Vector3(0, -18, 0),
  // Safety clamp for the physics timestep
  maxDeltaTime: 1 / 20,
} as const;

export const GAME_CONFIG = {
  // Crash speed threshold in km/h (converted to m/s for physics)
  crashSpeedThresholdKmh: 50,
  // Reduce obstacle density for a calmer Zen experience (1 = no change)
  zenObstacleDensityMultiplier: 0.7,
} as const;

export const SPRINT_CONFIG = {
  // Target distance to complete the sprint (in meters)
  TARGET_DISTANCE: 2000,
  // Time penalty for crashing (in seconds)
  PENALTY_SECONDS: 20,
  // Crash sequence duration (in seconds)
  CRASH_DURATION: 2.0,
} as const;

export const ARCADE_CONFIG = {
  DEFAULT_LIVES: 3,
  COIN_VALUE: 100,
  DISTANCE_SCORE_PER_METER: 1,
  COIN_MULTIPLIER_BONUS: 0.3,
  // Radians per second for rotating collectibles
  COIN_ROTATION_SPEED: Math.PI * 0.5,
  AIR_MULTIPLIER_INCREMENT: 0.1,
  AIR_MULTIPLIER_INTERVAL_SECONDS: 0.5,
  AIR_MULTIPLIER_MIN_SECONDS: 0.5,
  INVULNERABILITY_SECONDS: 2,
  DAMAGE_THRESHOLD_KMH: GAME_CONFIG.crashSpeedThresholdKmh,
  DEATH_THRESHOLD_KMH: Number.POSITIVE_INFINITY,
  COIN_RADIUS: 0.8,
  COINS_PER_ARC: 8,
  COIN_HEIGHT_OFFSET: 0.5,
  ARCS_PER_CHUNK: 2,
  STEER_NOISE_DAMAGED: 0.05,
  STEER_NOISE_CRITICAL: 0.2,
  LATERAL_FRICTION_CRITICAL: 0.7,
  LIFE_IMPACT_DURATION: 0.8,
  SPEED_BONUS_THRESHOLD_KMH: 150,
  SPEED_BONUS_POINTS_PER_SECOND: 20,
  SPEED_BONUS_MULTIPLIER_PER_SECOND: 0.05,
  SPEED_BONUS_POPUP_INTERVAL_SECONDS: 1,
  AIRTIME_BONUS_POINTS: 10,
} as const;

const isLowPreset =
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export const GRAPHICS_PRESET: 'high' | 'low' = isLowPreset ? 'low' : 'high';

export const DIFFICULTY_SETTINGS = {
  CHILL: {
    obstacleDensity: 0.5,
  },
  SPORT: {
    obstacleDensity: 1.0,
  },
  EXTREME: {
    obstacleDensity: 2.0,
  },
} as const;

export const PLAYER_CONFIG = {
  radius: 1.6,
  startPosition: new THREE.Vector3(0, 15, -5),
  physics: {
    capsuleRadius: 0.5,
    capsuleHalfHeight: 1.0,
    mass: 50,

    // Remove general air resistance. We will calculate drag manually.
    angularDamping: 0, // High damping to stop spinning instantly when key is released

    // Ski properties
    lateralFriction: 2.0, // "Edge Grip": How hard it stops you sliding sideways
    edgeGripForce: 1000, // Max lateral grip force budget (N)
    edgeGripBrakingMultiplier: 1.5, // Extra grip when braking
    kineticEdgeFrictionRatio: 0.8, // Fraction of static grip applied when sliding
    lateralViscousDragScale: 0.5, // Residual viscous drag when sliding
    forwardFriction: 0.05, // "Wax": Very low friction sliding forward

    // --- NEW: Air drag (non-linear with speed) ---
    airDragCoeff: 0.0025, // Strength of v^2 drag. Start small (0.01-0.05).

    // Poling mechanics
    poleForce: 30.0, // Strong initial push
    maxPoleSpeedKmh: 30.0, // You can't pole effectively above this speed (in km/h)

    // Steering
    steerTurnSpeed: 1.6, // Base turn speed multiplier
    steerSmoothingAccel: 1.8, // How fast we reach max turn speed
    steerSmoothingDecay: 5.0, // How fast we center the skis when releasing keys
    maxSteeringSpeed: 1.5, // Maximum turn rate in radians per second (caps the final turn speed)

    // Physics limits
    brakeDamping: 2.0, // Drag applied when "snowplowing"
    friction: 0.12, // Base friction applied to simulate snow contact
    groundContactMemorySeconds: 0.2, // Time window after leaving ground to still treat as grounded
  },
  camera: {
    fov: 75,
    near: 0.1,
    far: 8000,
    eyeHeight: 0.1,
    tiltRadians: -0.6, // look at ground
    // Banking settings
    maxBankAngle: Math.PI / 18, // ~10 degrees of tilt at max steering
    bankSmoothingSpeed: 5.0, // How fast the camera rolls into the turn
    // Flow state tuning
    fovMin: 75,
    fovMax: 95,
    pitchBase: -0.6,
    pitchSpeedAdd: -0.1,
    zOffsetMin: 0,
    zOffsetMax: 2.0,
    // Slope-aware camera tuning
    slopeBackMultiplierMin: 0.8, // Min fraction of back offset to keep on steep slopes
    slopeLiftMax: 1, // Extra meters to raise camera at steep + fast
    slopeForwardPush: 2, // Forward push at steep slopes to keep camera ahead
    cameraMinClearance: 2, // Min distance from snow before pushing up
    cameraClearanceSmoothing: 0.35, // 0-1: how softly to apply clearance push
    flowStartKmh: 100,
    flowMaxKmh: 200,
  },
  hands: {
    leftOffset: new THREE.Vector3(-0.3, -0.3, -0.5),
    rightOffset: new THREE.Vector3(0.3, -0.3, -0.5),
    rightMirrorScaleX: -1,
    poleAngleRadians: Math.PI / 12,
    baseBackTiltRadians: 0.35,
    lateralMovementAmount: 0.15, // How far hands move left/right when steering
    lateralAnimationSpeed: 8.0, // Speed of lateral animation interpolation
    brakeRotationInward: Math.PI / 6, // How much hands rotate inward when braking (30 degrees)
    brakeRotationForward: Math.PI / 8, // How much hands rotate forward when braking (22.5 degrees)
    rotationAnimationSpeed: 10.0, // Speed of rotation animation interpolation
  },
  skis: {
    offset: new THREE.Vector3(0, -1.5, 0.3),
    groundAlignment: {
      sampleDistance: 0.8, // How far to offset height probes (meters) when computing surface normal
      smoothingSpeed: 7, // Lerp speed for normals/alignment to avoid jitter
      handTiltFactor: 0.6, // 1 = hands fully follow ground tilt, 0 = ignore ground tilt
      sinkOffset: 0.1, // Constant downward offset to visually plant skis in snow
      steepnessSinkMax: 0.4, // Extra downward offset added as slope gets steeper (0 flat -> max on vertical)
    },
    // Animation config
    maxTurnRoll: Math.PI / 50, // 30 degrees banking when turning
    maxTurnYaw: Math.PI / 12, // 15 degrees steering into turn
    turnAnimationMultiple: 0.5, // Multiplier for ski and hand turning animations (1.0 = default)
    brakeOpenAngle: Math.PI / 8, // 22.5 degrees V-shape
    brakeEdgeRoll: Math.PI / 6, // 30 degrees inward edging
    brakeWidth: 0.45, // Distance from center when braking
    baseWidth: 0.3, // Distance from center when gliding
    carveOffsetZ: -0.02, // How far the inside ski pulls back during a turn
    animationSpeed: 10.0, // Lerp speed
    maxSpeedKmh: 120, // Maximum speed in km/h for speed ratio calculation
    vibrationIntensity: 0.02, // Shake amount at max speed
  },
  animation: {
    bobSpeedScale: 2,
    maxBobAmount: 0.1,
    baseBobFrequency: 1,
  },
} as const;

export const MOUNTAIN_CONFIG = {
  TOTAL_LENGTH: 2500, // Virtual shaping length for slope/noise (run is infinite)
  END_ALTITUDE: 0, // Baseline altitude reference (legacy)
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
  // Procedural jump generation
  JUMP_DISTANCE_MEAN: 250,
  JUMP_DISTANCE_STD: 200,
  JUMP_DISTANCE_MAX: 500,
  JUMP_LENGTH_RANGE: { min: 20, max: 40 },
  JUMP_HEIGHT_RANGE: { min: 4, max: 10 },
  JUMP_WIDTH_FRACTION: 0.5, // Portion of rideable width affected by a jump (0-1)
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
      rarity: 12, // Overall rarity (relative - lower = rarer)
      treeProportion: 2, // Tree proportion when obstacle appears
      rockProportion: 3, // Rock proportion when obstacle appears
      treeSizes: {
        small: 1, // Small tree proportion
        medium: 0, // Medium tree proportion
        large: 0, // Large tree proportion
      },
    },
    bank: {
      rarity: 50, // Overall rarity
      treeProportion: 4, // Tree proportion
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
  shadow: {
    distanceMultiplier: 4.0, // Increase to extend shadow coverage/distances
  },
  sun: {
    color: '#fff1d0',
    direction: new THREE.Vector3(-1, -1.2, 0).normalize(), // higher sun angle
    intensity: 5,
    positionOffset: 50, // how far behind camera we park the sun
    targetOffset: 120, // how far forward we point the sun
    followDistance: 30, // how far ahead of the player the shadow camera tracks
    shadow: {
      mapSizeHigh: 4096,
      mapSizeLow: 2048,
      bounds: 40, // half-extent for ortho shadow camera
      cameraNear: 8,
      cameraFar: 180,
      bias: -0.0005,
      normalBias: 0.015,
    },
  },
  hemisphereLight: {
    skyColor: '#b9d9ff',
    groundColor: '#9fc7e0',
    intensity: 1.8,
  },
  ambientLight: {
    color: '#9cc8ff',
    intensity: 0.7,
  },
  fog: {
    color: '#cfe6ff',
    near: 300,
    far: 4000,
  },
} as const;
