/**
 * Master Configuration File
 *
 * This file serves as the Single Source of Truth (SSOT) for the game.
 * All adjustable gameplay, physics, and visual constants must be defined here.
 */

import * as THREE from 'three';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Global physics configuration for the game world.
 */
export interface PhysicsConfig {
  /** Gravity vector in m/s². */
  gravity: THREE.Vector3;
  /** Maximum physics timestep in seconds. Safety clamp to prevent large jumps. */
  maxDeltaTime: number;
}

/**
 * Core game mechanics configuration.
 */
export interface GameConfig {
  /** Crash speed threshold in km/h. Speeds above this trigger crash sequence. */
  crashSpeedThresholdKmh: number;
  /** Obstacle density multiplier for Zen mode (1.0 = no change, <1.0 = fewer obstacles). */
  zenObstacleDensityMultiplier: number;
}

/**
 * Sprint mode configuration.
 */
export interface SprintConfig {
  /** Target distance to complete the sprint in meters. */
  targetDistance: number;
  /** Time penalty for crashing in seconds. */
  penaltySeconds: number;
  /** Crash sequence duration in seconds. */
  crashDuration: number;
}

/**
 * Arcade mode configuration.
 */
export interface ArcadeConfig {
  /** Default number of lives at game start. */
  defaultLives: number;
  /** Points awarded per coin collected. */
  coinValue: number;
  /** Points per meter traveled (multiplied by current multiplier). */
  distanceScorePerMeter: number;
  /** Multiplier bonus added per coin collected. */
  coinMultiplierBonus: number;
  /** Coin rotation speed in radians per second. */
  coinRotationSpeed: number;
  /** Multiplier increment per airtime interval. */
  airMultiplierIncrement: number;
  /** Interval in seconds between airtime multiplier increments. */
  airMultiplierIntervalSeconds: number;
  /** Minimum airtime in seconds required to start earning multiplier. */
  airMultiplierMinSeconds: number;
  /** Invulnerability duration after taking damage in seconds. */
  invulnerabilitySeconds: number;
  /** Speed threshold in km/h for taking damage (not death). */
  damageThresholdKmh: number;
  /** Speed threshold in km/h for instant death on head-on collision. */
  deathThresholdKmh: number;
  /** Coin collider radius in meters. */
  coinRadius: number;
  /** Number of coins per arc. */
  coinsPerArc: number;
  /** Height offset above terrain for coin placement in meters. */
  coinHeightOffset: number;
  /** Number of coin arcs per terrain chunk. */
  arcsPerChunk: number;
  /** Steering noise amount when damaged (1 life remaining). */
  steerNoiseDamaged: number;
  /** Steering noise amount when critical (0 lives remaining). */
  steerNoiseCritical: number;
  /** Lateral friction multiplier when critical (0 lives remaining). */
  lateralFrictionCritical: number;
  /** Duration of life loss impact effect in seconds. */
  lifeImpactDuration: number;
  /** Speed threshold in km/h to start earning speed bonus points. */
  speedBonusThresholdKmh: number;
  /** Speed bonus points awarded per second above threshold. */
  speedBonusPointsPerSecond: number;
  /** Speed bonus multiplier increment per second. */
  speedBonusMultiplierPerSecond: number;
  /** Interval in seconds between speed bonus popup notifications. */
  speedBonusPopupIntervalSeconds: number;
  /** Points awarded per airtime interval. */
  airtimeBonusPoints: number;
}

/**
 * Player physics configuration.
 */
export interface PlayerPhysicsConfig {
  /** Capsule collider radius in meters. */
  capsuleRadius: number;
  /** Capsule collider half-height in meters. */
  capsuleHalfHeight: number;
  /** Player mass in kilograms. */
  mass: number;
  /** Angular damping coefficient (0 = no damping, higher = more damping). */
  angularDamping: number;
  /** Lateral friction coefficient for edge grip. */
  lateralFriction: number;
  /** Maximum lateral grip force in Newtons. */
  edgeGripForce: number;
  /** Extra grip multiplier when braking. */
  edgeGripBrakingMultiplier: number;
  /** Fraction of static grip applied when sliding. */
  kineticEdgeFrictionRatio: number;
  /** Residual viscous drag scale when sliding laterally. */
  lateralViscousDragScale: number;
  /** Forward friction coefficient (wax effect). */
  forwardFriction: number;
  /** Air drag coefficient for v² drag calculation. */
  airDragCoeff: number;
  /** Poling force in Newtons. */
  poleForce: number;
  /** Maximum speed in km/h where poling is effective. */
  maxPoleSpeedKmh: number;
  /** Base turn speed multiplier. */
  steerTurnSpeed: number;
  /** Acceleration rate to reach max turn speed. */
  steerSmoothingAccel: number;
  /** Decay rate when releasing steering keys. */
  steerSmoothingDecay: number;
  /** Maximum turn rate in radians per second. */
  maxSteeringSpeed: number;
  /** Brake damping coefficient when snowplowing. */
  brakeDamping: number;
  /** Base friction coefficient for snow contact. */
  friction: number;
  /** Time window in seconds after leaving ground to still treat as grounded. */
  groundContactMemorySeconds: number;
}

/**
 * Camera configuration for first-person view.
 */
export interface CameraConfig {
  /** Field of view in degrees. */
  fov: number;
  /** Near clipping plane distance in meters. */
  near: number;
  /** Far clipping plane distance in meters. */
  far: number;
  /** Eye height above player position in meters. */
  eyeHeight: number;
  /** Base camera tilt in radians (negative = look down). */
  tiltRadians: number;
  /** Maximum bank angle in radians at max steering. */
  maxBankAngle: number;
  /** Bank smoothing speed (higher = faster roll into turn). */
  bankSmoothingSpeed: number;
  /** Minimum FOV in degrees (flow state). */
  fovMin: number;
  /** Maximum FOV in degrees (flow state). */
  fovMax: number;
  /** Base pitch angle in radians. */
  pitchBase: number;
  /** Additional pitch added based on speed in radians. */
  pitchSpeedAdd: number;
  /** Minimum Z offset in meters (camera position). */
  zOffsetMin: number;
  /** Maximum Z offset in meters (camera position). */
  zOffsetMax: number;
  /** Minimum fraction of back offset to keep on steep slopes. */
  slopeBackMultiplierMin: number;
  /** Maximum extra height in meters to raise camera on steep slopes. */
  slopeLiftMax: number;
  /** Forward push distance in meters at steep slopes. */
  slopeForwardPush: number;
  /** Minimum clearance distance from snow in meters before pushing up. */
  cameraMinClearance: number;
  /** Clearance smoothing factor (0-1, higher = smoother). */
  cameraClearanceSmoothing: number;
  /** Speed in km/h where flow state effects begin. */
  flowStartKmh: number;
  /** Speed in km/h where flow state effects are maximum. */
  flowMaxKmh: number;
  /** Horizon offset in radians for slope angle calculation. */
  horizonOffset: number;
}

/**
 * Hand and pole animation configuration.
 */
export interface HandsConfig {
  /** Left hand position offset in meters. */
  leftOffset: THREE.Vector3;
  /** Right hand position offset in meters. */
  rightOffset: THREE.Vector3;
  /** Right hand X-axis mirror scale. */
  rightMirrorScaleX: number;
  /** Pole angle in radians from vertical. */
  poleAngleRadians: number;
  /** Base backward tilt angle in radians. */
  baseBackTiltRadians: number;
  /** Lateral movement amount in meters when steering. */
  lateralMovementAmount: number;
  /** Lateral animation interpolation speed. */
  lateralAnimationSpeed: number;
  /** Inward rotation angle in radians when braking. */
  brakeRotationInward: number;
  /** Forward rotation angle in radians when braking. */
  brakeRotationForward: number;
  /** Rotation animation interpolation speed. */
  rotationAnimationSpeed: number;
}

/**
 * Ground alignment configuration for skis.
 */
export interface GroundAlignmentConfig {
  /** Sample distance offset in meters for surface normal calculation. */
  sampleDistance: number;
  /** Smoothing speed for normal alignment (higher = faster). */
  smoothingSpeed: number;
  /** Hand tilt factor (1 = fully follow ground, 0 = ignore ground tilt). */
  handTiltFactor: number;
  /** Constant downward offset in meters to plant skis in snow. */
  sinkOffset: number;
  /** Maximum extra downward offset in meters on vertical slopes. */
  steepnessSinkMax: number;
}

/**
 * Ski animation and visual configuration.
 */
export interface SkisConfig {
  /** Ski position offset relative to player in meters. */
  offset: THREE.Vector3;
  /** Ground alignment settings. */
  groundAlignment: GroundAlignmentConfig;
  /** Maximum turn roll angle in radians when turning. */
  maxTurnRoll: number;
  /** Maximum turn yaw angle in radians when steering. */
  maxTurnYaw: number;
  /** Multiplier for ski and hand turning animations. */
  turnAnimationMultiple: number;
  /** Brake open angle in radians (V-shape). */
  brakeOpenAngle: number;
  /** Brake edge roll angle in radians (inward edging). */
  brakeEdgeRoll: number;
  /** Distance from center in meters when braking. */
  brakeWidth: number;
  /** Distance from center in meters when gliding. */
  baseWidth: number;
  /** Z-axis offset in meters for inside ski during turn (carving). */
  carveOffsetZ: number;
  /** Animation interpolation speed. */
  animationSpeed: number;
  /** Maximum speed in km/h for speed ratio calculation. */
  maxSpeedKmh: number;
  /** Vibration intensity at max speed. */
  vibrationIntensity: number;
}

/**
 * Player animation configuration.
 */
export interface AnimationConfig {
  /** Bob speed scale multiplier. */
  bobSpeedScale: number;
  /** Maximum bob amount in meters. */
  maxBobAmount: number;
  /** Base bob frequency in Hz. */
  baseBobFrequency: number;
}

/**
 * Complete player configuration.
 */
export interface PlayerConfig {
  /** Player collision radius in meters. */
  radius: number;
  /** Starting position in world space. */
  startPosition: THREE.Vector3;
  /** Physics engine settings. */
  physics: PlayerPhysicsConfig;
  /** Camera behavior and positioning settings. */
  camera: CameraConfig;
  /** Hand and pole animation settings. */
  hands: HandsConfig;
  /** Ski animation and visual settings. */
  skis: SkisConfig;
  /** Player animation settings. */
  animation: AnimationConfig;
}

/**
 * Mountain generation configuration.
 */
export interface MountainConfig {
  /** Virtual shaping length for slope/noise generation in meters. */
  totalLength: number;
  /** Baseline altitude reference in meters (legacy). */
  endAltitude: number;
}

/**
 * Terrain geometry dimensions.
 */
export interface TerrainDimensions {
  /** Chunk width in meters. */
  chunkWidth: number;
  /** Chunk length in meters. */
  chunkLength: number;
  /** Number of segments along chunk length. */
  chunkSegments: number;
  /** Number of width segments for terrain mesh (controls visual fidelity vs performance). */
  widthSegments: number;
}

/**
 * Terrain generation configuration.
 */
export interface TerrainConfig {
  /** Terrain geometry dimensions. */
  dimensions: TerrainDimensions;
  /** Distance between samples along the spine in meters (lower = more detail, higher cost). */
  segmentLength: number;
  /** Overall lateral swing of the path in meters (windiness). */
  amplitude: number;
  /** Frequency of Perlin noise offset for meanders. */
  noiseScale: number;
  /** Slow sine wave frequency for large sweeping turns. */
  meander1Freq: number;
  /** Faster sine wave frequency for jittery variation. */
  meander2Freq: number;
  /** Average track width in meters before per-point noise. */
  widthBase: number;
  /** Frequency for width noise sampling along the run. */
  widthNoiseScale: number;
  /** Strength of width noise variation (0 = uniform width). */
  widthVariation: number;
  /** Window size for moving average smoothing of X offsets. */
  smoothingWindow: number;
  /** Scales how aggressively turns bank the snow surface. */
  bankingStrength: number;
  /** Controls how quickly the path changes direction. */
  turnSpeed: number;
  /** Minimum track width in meters. */
  widthMin: number;
  /** Maximum track width in meters. */
  widthMax: number;
  /** Mogul noise scale factor. */
  mogulScale: number;
  /** Mogul height in meters. */
  mogulHeight: number;
  /** How quickly the path follows the target angle (0-1). */
  angleInterpolation: number;
  /** Mean jump spacing in meters. */
  jumpDistanceMean: number;
  /** Standard deviation of jump spacing in meters. */
  jumpDistanceStd: number;
  /** Maximum jump spacing in meters. */
  jumpDistanceMax: number;
  /** Jump length range in meters. */
  jumpLengthRange: { min: number; max: number };
  /** Jump height range in meters. */
  jumpHeightRange: { min: number; max: number };
  /** Portion of rideable width affected by a jump (0-1). */
  jumpWidthFraction: number;
  /** Additional width beyond track for canyon floor in meters. */
  canyonFloorOffset: number;
  /** Maximum height of cliff in meters. */
  canyonHeight: number;
  /** Width of slope horizontally in meters. */
  wallWidth: number;
  /** Number of obstacles per chunk. */
  obstacleCount: number;
}

/**
 * Obstacle surface configuration.
 */
export interface ObstacleSurfaceConfig {
  /** Overall rarity (relative - lower = rarer). */
  rarity: number;
  /** Tree proportion when obstacle appears. */
  treeProportion: number;
  /** Rock proportion when obstacle appears. */
  rockProportion: number;
  /** Dead tree proportion (plateau only). */
  deadTreeProportion?: number;
  /** Tree size proportions. */
  treeSizes: {
    small: number;
    medium: number;
    large: number;
  };
  /** Noise thresholds for tree size variety (0-1 range) with probabilities. */
  noiseThresholds?: Record<
    string,
    {
      min: number;
      max: number;
      probability?: number;
    }
  >;
  /** Probability for rocks when no tree is placed. */
  rockProbability?: number;
}

/**
 * Obstacle generation configuration.
 */
export interface ObstacleConfig {
  /** Grid spacing for obstacle placement in meters. */
  gridSize: number;
  /** Noise scale for variety in placement. */
  noiseScale: number;
  /** Obstacle generation settings per surface type. */
  surfaces: {
    track: ObstacleSurfaceConfig;
    bank: ObstacleSurfaceConfig;
    cliff: ObstacleSurfaceConfig;
    plateau: ObstacleSurfaceConfig;
  };
}

/**
 * Shadow configuration.
 */
export interface ShadowConfig {
  /** Distance multiplier to extend shadow coverage. */
  distanceMultiplier: number;
}

/**
 * Sun shadow configuration.
 */
export interface SunShadowConfig {
  /** Shadow map size for high quality preset. */
  mapSizeHigh: number;
  /** Shadow map size for low quality preset. */
  mapSizeLow: number;
  /** Half-extent for orthographic shadow camera in meters. */
  bounds: number;
  /** Shadow camera near plane in meters. */
  cameraNear: number;
  /** Shadow camera far plane in meters. */
  cameraFar: number;
  /** Shadow bias to prevent shadow acne. */
  bias: number;
  /** Normal bias to prevent shadow acne. */
  normalBias: number;
}

/**
 * Sun lighting configuration.
 */
export interface SunConfig {
  /** Sun light color (hex string). */
  color: string;
  /** Sun direction vector (normalized). */
  direction: THREE.Vector3;
  /** Sun light intensity. */
  intensity: number;
  /** Position offset behind camera in meters. */
  positionOffset: number;
  /** Target offset forward in meters. */
  targetOffset: number;
  /** Follow distance ahead of player in meters. */
  followDistance: number;
  /** Shadow settings. */
  shadow: SunShadowConfig;
}

/**
 * Hemisphere light configuration.
 */
export interface HemisphereLightConfig {
  /** Sky color (hex string). */
  skyColor: string;
  /** Ground color (hex string). */
  groundColor: string;
  /** Light intensity. */
  intensity: number;
}

/**
 * Ambient light configuration.
 */
export interface AmbientLightConfig {
  /** Light color (hex string). */
  color: string;
  /** Light intensity. */
  intensity: number;
}

/**
 * Fog configuration.
 */
export interface FogConfig {
  /** Fog color (hex string). */
  color: string;
  /** Fog near distance in meters. */
  near: number;
  /** Fog far distance in meters. */
  far: number;
}

/**
 * Complete lighting configuration.
 */
export interface LightingConfig {
  /** Shadow settings. */
  shadow: ShadowConfig;
  /** Sun lighting settings. */
  sun: SunConfig;
  /** Hemisphere light settings. */
  hemisphereLight: HemisphereLightConfig;
  /** Ambient light settings. */
  ambientLight: AmbientLightConfig;
  /** Fog settings. */
  fog: FogConfig;
}

/**
 * Difficulty level settings.
 */
export interface DifficultySettings {
  /** Obstacle density multiplier (1.0 = normal). */
  obstacleDensity: number;
}

/**
 * Color palette configuration.
 */
export interface ColorPalette {
  background: {
    /** Sky background color (hex string). */
    sky: string;
    /** Fog color (hex string). */
    fog: string;
    /** Mountain shadow color (hex string). */
    mountainShadow: string;
  };
  primaryEnvironment: {
    /** Pure white for mid-ground snow (hex string). */
    snowWhite: string;
    /** Bluish tint for back mountains (hex string). */
    farMountain: string;
    /** Ice blue color (hex string). */
    iceBlue: string;
    /** Shadow gray color (hex string). */
    shadowGray: string;
  };
  terrainAndObjects: {
    /** Rock gray color (hex string). */
    rockGray: string;
    /** Dark bark brown color (hex string). */
    darkBarkBrown: string;
    /** Light wood brown color (hex string). */
    lightWoodBrown: string;
  };
  trees: {
    /** Pine green color (hex string). */
    pineGreen: string;
    /** Dark forest green color (hex string). */
    darkForestGreen: string;
  };
  charactersAndGear: {
    /** Red jacket color (hex string). */
    redJacket: string;
    /** Orange-red accent color (hex string). */
    orangeRedAccent: string;
  };
  debugTestColors: {
    /** Bright pink debug color (hex string). */
    brightPink: string;
    /** Bright green debug color (hex string). */
    brightGreen: string;
    /** Bright blue debug color (hex string). */
    brightBlue: string;
  };
}

/**
 * UI configuration.
 */
export interface UIConfig {
  /** Maximum display speed in km/h for speedometer bar (bar is full at this speed). */
  maxDisplaySpeedKmh: number;
}

// ============================================================================
// CONFIGURATION OBJECTS
// ============================================================================

export const PHYSICS_CONFIG: PhysicsConfig = {
  gravity: new THREE.Vector3(0, -18, 0),
  maxDeltaTime: 1 / 20,
};

export const GAME_CONFIG: GameConfig = {
  crashSpeedThresholdKmh: 50,
  zenObstacleDensityMultiplier: 0.7,
};

export const SPRINT_CONFIG: SprintConfig = {
  targetDistance: 2000,
  penaltySeconds: 20,
  crashDuration: 2.0,
};

export const ARCADE_CONFIG: ArcadeConfig = {
  defaultLives: 3,
  coinValue: 100,
  distanceScorePerMeter: 1,
  coinMultiplierBonus: 0.3,
  coinRotationSpeed: Math.PI * 0.5,
  airMultiplierIncrement: 0.1,
  airMultiplierIntervalSeconds: 0.5,
  airMultiplierMinSeconds: 0.5,
  invulnerabilitySeconds: 2,
  damageThresholdKmh: GAME_CONFIG.crashSpeedThresholdKmh,
  deathThresholdKmh: Number.POSITIVE_INFINITY,
  coinRadius: 0.8,
  coinsPerArc: 8,
  coinHeightOffset: 0.5,
  arcsPerChunk: 2,
  steerNoiseDamaged: 0.05,
  steerNoiseCritical: 0.2,
  lateralFrictionCritical: 0.7,
  lifeImpactDuration: 0.8,
  speedBonusThresholdKmh: 150,
  speedBonusPointsPerSecond: 20,
  speedBonusMultiplierPerSecond: 0.05,
  speedBonusPopupIntervalSeconds: 1,
  airtimeBonusPoints: 10,
};

const isLowPreset =
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export const GRAPHICS_PRESET: 'high' | 'low' = isLowPreset ? 'low' : 'high';

export const DIFFICULTY_SETTINGS: Record<string, DifficultySettings> = {
  CHILL: {
    obstacleDensity: 0.5,
  },
  SPORT: {
    obstacleDensity: 1.0,
  },
  EXTREME: {
    obstacleDensity: 2.0,
  },
};

export const PLAYER_CONFIG: PlayerConfig = {
  radius: 1.6,
  startPosition: new THREE.Vector3(0, 15, -5),
  physics: {
    capsuleRadius: 0.5,
    capsuleHalfHeight: 1.0,
    mass: 50,
    angularDamping: 0,
    lateralFriction: 2.0,
    edgeGripForce: 1000,
    edgeGripBrakingMultiplier: 1.5,
    kineticEdgeFrictionRatio: 0.8,
    lateralViscousDragScale: 0.5,
    forwardFriction: 0.05,
    airDragCoeff: 0.0025,
    poleForce: 30.0,
    maxPoleSpeedKmh: 30.0,
    steerTurnSpeed: 1.6,
    steerSmoothingAccel: 1.8,
    steerSmoothingDecay: 5.0,
    maxSteeringSpeed: 1.5,
    brakeDamping: 2.0,
    friction: 0.12,
    groundContactMemorySeconds: 0.2,
  },
  camera: {
    fov: 75,
    near: 0.1,
    far: 8000,
    eyeHeight: 0.1,
    tiltRadians: -0.6,
    maxBankAngle: Math.PI / 18,
    bankSmoothingSpeed: 5.0,
    fovMin: 75,
    fovMax: 95,
    pitchBase: -0.6,
    pitchSpeedAdd: -0.1,
    zOffsetMin: 0,
    zOffsetMax: 2.0,
    slopeBackMultiplierMin: 0.8,
    slopeLiftMax: 1,
    slopeForwardPush: 2,
    cameraMinClearance: 2,
    cameraClearanceSmoothing: 0.35,
    flowStartKmh: 100,
    flowMaxKmh: 200,
    horizonOffset: 0.25,
  },
  hands: {
    leftOffset: new THREE.Vector3(-0.3, -0.3, -0.5),
    rightOffset: new THREE.Vector3(0.3, -0.3, -0.5),
    rightMirrorScaleX: -1,
    poleAngleRadians: Math.PI / 12,
    baseBackTiltRadians: 0.35,
    lateralMovementAmount: 0.15,
    lateralAnimationSpeed: 8.0,
    brakeRotationInward: Math.PI / 6,
    brakeRotationForward: Math.PI / 8,
    rotationAnimationSpeed: 10.0,
  },
  skis: {
    offset: new THREE.Vector3(0, -1.5, 0.3),
    groundAlignment: {
      sampleDistance: 0.8,
      smoothingSpeed: 7,
      handTiltFactor: 0.6,
      sinkOffset: 0.1,
      steepnessSinkMax: 0.4,
    },
    maxTurnRoll: Math.PI / 50,
    maxTurnYaw: Math.PI / 12,
    turnAnimationMultiple: 0.5,
    brakeOpenAngle: Math.PI / 8,
    brakeEdgeRoll: Math.PI / 6,
    brakeWidth: 0.45,
    baseWidth: 0.3,
    carveOffsetZ: -0.02,
    animationSpeed: 10.0,
    maxSpeedKmh: 120,
    vibrationIntensity: 0.02,
  },
  animation: {
    bobSpeedScale: 2,
    maxBobAmount: 0.1,
    baseBobFrequency: 1,
  },
};

export const MOUNTAIN_CONFIG: MountainConfig = {
  totalLength: 2500,
  endAltitude: 0,
};

export const TERRAIN_CONFIG: TerrainConfig = {
  dimensions: {
    chunkWidth: 150,
    chunkLength: 150,
    chunkSegments: 60,
    widthSegments: 80,
  },
  segmentLength: 8,
  amplitude: 60,
  noiseScale: 0.02,
  meander1Freq: 1.0,
  meander2Freq: 2.0,
  widthBase: 30,
  widthNoiseScale: 0.01,
  widthVariation: 0.4,
  smoothingWindow: 5,
  bankingStrength: 0.5,
  turnSpeed: 0.04,
  widthMin: 20,
  widthMax: 32.5,
  mogulScale: 0.2,
  mogulHeight: 0.7,
  angleInterpolation: 0.15,
  jumpDistanceMean: 250,
  jumpDistanceStd: 200,
  jumpDistanceMax: 500,
  jumpLengthRange: { min: 20, max: 40 },
  jumpHeightRange: { min: 4, max: 10 },
  jumpWidthFraction: 0.5,
  canyonFloorOffset: 20,
  canyonHeight: 25,
  wallWidth: 12,
  obstacleCount: 200,
};

export const OBSTACLE_CONFIG: ObstacleConfig = {
  gridSize: 5,
  noiseScale: 0.1,
  surfaces: {
    track: {
      rarity: 12,
      treeProportion: 2,
      rockProportion: 3,
      treeSizes: {
        small: 1,
        medium: 0,
        large: 0,
      },
    },
    bank: {
      rarity: 50,
      treeProportion: 4,
      rockProportion: 1,
      treeSizes: {
        small: 1,
        medium: 2,
        large: 1,
      },
      noiseThresholds: {
        small: { min: 0.3, max: 0.5, probability: 0.25 },
        medium: { min: 0.5, max: 0.7, probability: 0.3 },
        large: { min: 0.7, max: 1.0, probability: 0.2 },
      },
      rockProbability: 0.15,
    },
    cliff: {
      rarity: 5,
      treeProportion: 1,
      rockProportion: 1,
      treeSizes: {
        small: 1,
        medium: 1,
        large: 0,
      },
      noiseThresholds: {
        small: { min: 0.4, max: 0.6, probability: 0.1 },
        medium: { min: 0.6, max: 1.0, probability: 0.08 },
        large: { min: 0, max: 0, probability: 0 },
      },
      rockProbability: 0.08,
    },
    plateau: {
      rarity: 15,
      treeProportion: 3,
      rockProportion: 0,
      deadTreeProportion: 1,
      treeSizes: {
        small: 1,
        medium: 2,
        large: 3,
      },
      noiseThresholds: {
        deadTree: { min: 0, max: 0.4, probability: 0.1 },
        small: { min: 0.4, max: 0.6, probability: 0.6 },
        medium: { min: 0.6, max: 0.8, probability: 0.7 },
        large: { min: 0.8, max: 1.0, probability: 0.8 },
      },
    },
  },
};

export const LIGHTING_CONFIG: LightingConfig = {
  shadow: {
    distanceMultiplier: 4.0,
  },
  sun: {
    color: '#fff1d0',
    direction: new THREE.Vector3(-1, -1.2, 0).normalize(),
    intensity: 5,
    positionOffset: 50,
    targetOffset: 120,
    followDistance: 30,
    shadow: {
      mapSizeHigh: 4096,
      mapSizeLow: 2048,
      bounds: 40,
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
};

export const UI_CONFIG: UIConfig = {
  maxDisplaySpeedKmh: 200,
};

export const COLOR_PALETTE: ColorPalette = {
  background: {
    sky: '#cfe6ff',
    fog: '#cfe6ff',
    mountainShadow: '#3e4452',
  },
  primaryEnvironment: {
    snowWhite: '#ffffff',
    farMountain: '#e8f4f8',
    iceBlue: '#BFE3F5',
    shadowGray: '#9BA4AE',
  },
  terrainAndObjects: {
    rockGray: '#5a5e66',
    darkBarkBrown: '#5A3A25',
    lightWoodBrown: '#A06E46',
  },
  trees: {
    pineGreen: '#3F7C3C',
    darkForestGreen: '#2E5A2B',
  },
  charactersAndGear: {
    redJacket: '#D94B3D',
    orangeRedAccent: '#E24C2A',
  },
  debugTestColors: {
    brightPink: '#FF00FF',
    brightGreen: '#00FF00',
    brightBlue: '#0000FF',
  },
};

// ============================================================================
// LEGACY EXPORTS (for backward compatibility during migration)
// ============================================================================

/**
 * @deprecated Use TERRAIN_CONFIG.dimensions instead.
 */
export const TERRAIN_DIMENSIONS = {
  CHUNK_WIDTH: TERRAIN_CONFIG.dimensions.chunkWidth,
  CHUNK_LENGTH: TERRAIN_CONFIG.dimensions.chunkLength,
  CHUNK_SEGMENTS: TERRAIN_CONFIG.dimensions.chunkSegments,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// ColorPalette type is inferred from the COLOR_PALETTE const above
