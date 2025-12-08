import clsx from 'clsx';
import { AlertTriangle, Coins, MapPin, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ARCADE_CONFIG, SPRINT_CONFIG } from '../../config/GameConfig';
import { useGameStore } from '../store';
import { ScoreFeed } from './ScoreFeed';

type HeartState = 'full' | 'fragile' | 'lost';

const LowPolyHeart = ({
  state,
  id,
  pulse,
  shattered,
}: {
  state: HeartState;
  id: string;
  pulse?: boolean;
  shattered?: boolean;
}) => {
  const palette: Record<
    HeartState,
    { main: string; dark: string; light: string; highlight: string }
  > = {
    full: { main: '#f87171', dark: '#ef4444', light: '#fb923c', highlight: '#fef9c3' },
    fragile: { main: '#fcd34d', dark: '#f59e0b', light: '#ffe58f', highlight: '#fff4cc' },
    lost: { main: '#cbd5e1', dark: '#94a3b8', light: '#e2e8f0', highlight: '#f8fafc' },
  };

  const colors = palette[state];
  const mainId = `heart-main-${id}`;
  const shineId = `heart-shine-${id}`;

  return (
    <div
      className={clsx(
        'relative h-10 w-10 transition-transform duration-700 [transform-style:preserve-3d] sm:h-12 sm:w-12',
        state !== 'lost' && 'animate-[heartTilt_8s_ease-in-out_infinite]',
        pulse && 'animate-[juicePulse_0.6s_ease-out]',
        shattered && 'animate-[heartShatter_0.7s_ease_forwards]',
        state === 'lost' && 'grayscale'
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-60 blur-sm" />
      <svg
        viewBox="0 0 64 56"
        className="relative h-full w-full drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
        style={{ transform: 'translateZ(0)' }}
      >
        <defs>
          <linearGradient id={mainId} x1="12%" y1="10%" x2="88%" y2="90%">
            <stop stopColor={colors.light} offset="0%" />
            <stop stopColor={colors.main} offset="50%" />
            <stop stopColor={colors.dark} offset="100%" />
          </linearGradient>
          <linearGradient id={shineId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor={colors.highlight} stopOpacity="0.9" offset="0%" />
            <stop stopColor={colors.light} stopOpacity="0.2" offset="60%" />
            <stop stopColor={colors.light} stopOpacity="0" offset="100%" />
          </linearGradient>
        </defs>
        <path
          d="M32 54L8.5 30.5C2 24 2 13 10 7.5C15 4 22 5 26.5 10.5L32 17L37.5 10.5C42 5 49 4 54 7.5C62 13 62 24 55.5 30.5Z"
          fill={`url(#${mainId})`}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
        />
        <polygon points="32,17 20,8 11,14 20,28" fill={colors.dark} opacity="0.9" />
        <polygon points="32,17 44,8 53,14 44,28" fill={colors.light} opacity="0.9" />
        <polygon points="20,28 32,17 44,28 32,42" fill={`url(#${shineId})`} opacity="0.9" />
        <polygon points="24,24 32,34 28,40 20,32" fill={colors.dark} opacity="0.4" />
        <polygon points="40,24 32,34 36,40 44,32" fill={colors.light} opacity="0.4" />
      </svg>
    </div>
  );
};

// Configuration for visual max speed (the bar is full at this speed)
const MAX_DISPLAY_SPEED_KMH = 200;

export const HUD = () => {
  const {
    timeElapsed,
    speed,
    distance,
    gameMode,
    showPenaltyNotification,
    clearPenaltyNotification,
    penalties,
    score,
    coins,
    lives,
    multiplier,
  } = useGameStore();

  const [multiplierFlash, setMultiplierFlash] = useState(false);
  const [lifeToast, setLifeToast] = useState(false);
  const [lostHeartIndex, setLostHeartIndex] = useState<number | null>(null);
  const [lifeImpact, setLifeImpact] = useState(false);
  const prevMultiplier = useRef(multiplier);
  const prevLives = useRef(lives);

  // Handle penalty notification auto-clear
  useEffect(() => {
    if (showPenaltyNotification) {
      // Auto-clear after animation duration (2.5 seconds)
      const timer = setTimeout(() => {
        clearPenaltyNotification();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showPenaltyNotification, clearPenaltyNotification]);

  // Multiplier pulse when it changes
  useEffect(() => {
    if (gameMode !== 'ARCADE') {
      prevMultiplier.current = multiplier;
      return;
    }
    if (multiplier !== prevMultiplier.current) {
      const frame = requestAnimationFrame(() => setMultiplierFlash(true));
      const timer = setTimeout(() => setMultiplierFlash(false), 800);
      prevMultiplier.current = multiplier;
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
    prevMultiplier.current = multiplier;
  }, [multiplier, gameMode]);

  // Life toast when a life is lost
  useEffect(() => {
    if (gameMode !== 'ARCADE') {
      prevLives.current = lives;
      const frame = requestAnimationFrame(() => {
        setLostHeartIndex(null);
        setLifeImpact(false);
      });
      return () => cancelAnimationFrame(frame);
    }

    if (lives < prevLives.current) {
      const lostIdx = Math.max(lives, 0);
      const frame = requestAnimationFrame(() => {
        setLifeToast(true);
        setLostHeartIndex(lostIdx);
        setLifeImpact(true);
      });
      const timer = setTimeout(
        () => {
          setLifeToast(false);
          setLostHeartIndex(null);
          setLifeImpact(false);
        },
        (ARCADE_CONFIG.LIFE_IMPACT_DURATION ?? 0.8) * 1000
      );
      prevLives.current = lives;
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }

    prevLives.current = lives;
    const resetFrame = requestAnimationFrame(() => setLostHeartIndex(null));
    return () => cancelAnimationFrame(resetFrame);
  }, [lives, gameMode]);

  // Time Formatting: Sprint and Zen count up
  const timerValue = timeElapsed;
  const minutes = Math.floor(timerValue / 60);
  const seconds = Math.floor(timerValue % 60);
  const milliseconds = Math.floor((timerValue * 100) % 100);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;

  // Logic
  const speedKmh = Math.floor(speed * 3.6);
  // Cap the bar at 100% width, but let the number go higher
  const speedPercent = Math.min(100, (speedKmh / MAX_DISPLAY_SPEED_KMH) * 100);
  // Start vignette at 50km/h, max at 150km/h
  const vignetteOpacity = Math.min(0.6, Math.max(0, (speedKmh - 50) / 100));

  // Helper for heavy text shadow to ensure readability on snow
  const heavyShadow = 'drop-shadow-[2px_2px_0_rgba(0,0,0,0.75)]';
  const darkGlow =
    'drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] drop-shadow-[0_0_18px_rgba(0,0,0,0.5)]';

  const showCracked = gameMode === 'ARCADE' && lives === 2;
  const showShattered = gameMode === 'ARCADE' && lives <= 1;

  return (
    <>
      {/* Impairment overlays */}
      {showCracked && (
        <div className="pointer-events-none fixed inset-0 z-10 opacity-40 mix-blend-screen">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.3),transparent_45%),radial-gradient(circle_at_70%_10%,rgba(255,255,255,0.2),transparent_40%)]" />
        </div>
      )}
      {showShattered && (
        <div className="pointer-events-none fixed inset-0 z-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.14),transparent_40%),repeating-linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.07)_4px,transparent_4px,transparent_10px)] opacity-60 mix-blend-screen" />
          <div
            className="absolute inset-0 mix-blend-screen blur-[1.5px]"
            style={{
              background: 'linear-gradient(120deg, rgba(0,255,255,0.25), rgba(255,0,128,0.2))',
            }}
          />
        </div>
      )}
      {lifeImpact && (
        <div
          className="pointer-events-none fixed inset-0 z-25 animate-[redPulse_0.35s_ease-out] bg-[radial-gradient(circle_at_center,rgba(248,113,113,0.3),rgba(127,29,29,0.45)_50%,rgba(15,23,42,0.9)_82%)]"
          style={{ animationDuration: `${ARCADE_CONFIG.LIFE_IMPACT_DURATION ?? 0.8}s` }}
        />
      )}

      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: vignetteOpacity,
          background:
            'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.4) 90%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      <ScoreFeed />
      <div
        className={clsx(
          'font-russo pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-6 text-white uppercase select-none',
          lifeImpact && 'animate-[hudShake_0.6s_ease]'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {/* --- TOP LEFT: HYPE ZONE (ARCADE) OR TIMER/DISTANCE (OTHERS) --- */}
          <div className="relative flex flex-col items-start gap-3">
            {gameMode === 'ARCADE' ? (
              <div className="relative flex flex-col gap-2">
                <span
                  className={clsx(
                    'inline-block text-5xl font-black tracking-[0.08em] italic sm:text-6xl',
                    heavyShadow,
                    darkGlow
                  )}
                >
                  {Math.floor(score).toLocaleString()}
                </span>
                <span
                  className={clsx(
                    'inline-block text-2xl font-black tracking-wider text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] sm:text-3xl',
                    darkGlow,
                    multiplierFlash && 'animate-[juicePulse_0.6s_ease-out]'
                  )}
                >
                  <span className="align-baseline text-lg sm:text-xl">x</span>
                  <span className="ml-1 align-baseline tabular-nums">{multiplier.toFixed(1)}</span>
                </span>
                <span
                  className={clsx(
                    'inline-flex items-center gap-2 text-xs font-semibold text-amber-100 sm:text-sm',
                    darkGlow
                  )}
                >
                  <Coins className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
                  <span className="text-base tracking-[0.08em] tabular-nums sm:text-lg">
                    {coins}
                  </span>
                </span>
              </div>
            ) : (
              <>
                {/* TIMER PILL */}
                {gameMode !== 'ZEN' && (
                  <div
                    className={clsx(
                      'flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/40 px-5 py-2 backdrop-blur-md transition-all',
                      showPenaltyNotification &&
                        gameMode === 'SPRINT' &&
                        'border-accent-red/80 animate-pulse bg-red-900/60'
                    )}
                  >
                    <Timer
                      className={clsx(
                        'h-6 w-6 transition-colors duration-300',
                        showPenaltyNotification && gameMode === 'SPRINT'
                          ? 'text-accent-red'
                          : 'text-accent-orange'
                      )}
                    />
                    <div
                      className={clsx(
                        'text-4xl font-bold tracking-wider tabular-nums transition-colors duration-300',
                        heavyShadow,
                        showPenaltyNotification && gameMode === 'SPRINT'
                          ? 'text-accent-red'
                          : 'text-white'
                      )}
                    >
                      {timeStr}
                    </div>
                  </div>
                )}

                {/* DISTANCE */}
                <div className="flex items-center gap-2 pl-2 opacity-90">
                  <MapPin className="text-accent-orange h-5 w-5" />
                  <div className={clsx('text-3xl font-bold tracking-wide', heavyShadow)}>
                    {Math.floor(distance)} <span className="text-lg text-white/70">m</span>
                    {gameMode === 'SPRINT' && (
                      <span className="ml-2 text-lg text-white/60">
                        / {SPRINT_CONFIG.TARGET_DISTANCE}m
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* PENALTY NOTIFICATION ANIMATION */}
            {showPenaltyNotification && gameMode === 'SPRINT' && (
              <div
                key={`penalty-${penalties}`}
                className="absolute top-24 left-0 z-50"
                style={{
                  animation: 'penaltyFloat 2.5s ease-out forwards',
                }}
              >
                <div className="border-accent-red/80 flex items-center gap-2 rounded-full border-2 bg-red-900/90 px-6 py-3 shadow-lg shadow-red-500/50 backdrop-blur-md">
                  <span className="text-accent-red text-2xl font-bold drop-shadow-[0_0_8px_rgba(217,75,61,0.8)]">
                    +{SPRINT_CONFIG.PENALTY_SECONDS}
                    <span className="text-base font-normal opacity-75">s</span>
                  </span>
                  <span className="text-lg font-semibold text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
                    PENALTY
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* --- TOP RIGHT: SURVIVAL ZONE (ARCADE) --- */}
          {gameMode === 'ARCADE' && (
            <div className="relative flex flex-col items-end gap-2 text-right">
              <div
                className={clsx(
                  'flex items-center gap-3 pr-1',
                  lifeToast && 'animate-[hudShake_0.6s_ease]'
                )}
              >
                {[0, 1, 2].map((idx) => {
                  const remaining = lives - idx;
                  const isLost = remaining <= 0;
                  // Only show the fragile (yellow) state when the player is on their very last life.
                  const isFragile = remaining === 1 && lives <= 1;
                  const state: HeartState = isLost ? 'lost' : isFragile ? 'fragile' : 'full';
                  const isShattering = isLost && lostHeartIndex === idx && lifeToast;

                  return (
                    <LowPolyHeart
                      key={idx}
                      id={`heart-${idx}`}
                      state={state}
                      pulse={!isLost && lifeToast}
                      shattered={isShattering}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* --- BOTTOM LEFT: SPEEDOMETER --- */}
        <div className="flex flex-col items-start gap-1">
          {/* SPEEDOMETER (Existing, slightly tweaked margins) */}
          <div
            className={clsx('flex items-baseline gap-2 text-6xl font-black italic', heavyShadow)}
          >
            <span
              className={clsx(
                'transition-colors duration-300',
                speedKmh > 120 ? 'text-accent-orange' : 'text-white'
              )}
            >
              {speedKmh}
            </span>
            <span className="text-3xl font-normal text-white not-italic opacity-80">km/h</span>
          </div>

          {/* Visual Speed Bar */}
          <div className="relative mt-1 h-6 w-80 skew-x-[-12deg] overflow-hidden rounded-sm border-2 border-white/20 bg-black/50 backdrop-blur-sm">
            {/* Background hash marks (optional style detail) */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_19px,#fff_20px)] opacity-20" />

            {/* Fill Bar */}
            <div
              className="to-accent-orange h-full bg-gradient-to-r from-sky-400 via-white transition-all duration-100 ease-out"
              style={{ width: `${speedPercent}%` }}
            />
          </div>
        </div>

        {/* Feedback toasts */}
        {lifeToast && (
          <div className="pointer-events-none absolute top-28 right-6 flex items-center gap-2 rounded-full border border-red-400/60 bg-red-900/70 px-4 py-2 text-xs font-bold tracking-[0.2em] text-red-100 shadow-[0_0_18px_rgba(248,113,113,0.4)]">
            <AlertTriangle className="h-4 w-4" />
            -1 LIFE
          </div>
        )}
      </div>
    </>
  );
};
