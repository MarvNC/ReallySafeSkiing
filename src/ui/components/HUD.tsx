import clsx from 'clsx';
import { AlertTriangle, Coins, Heart, MapPin, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { SPRINT_CONFIG } from '../../config/GameConfig';
import { useGameStore } from '../store';

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
      return;
    }
    if (lives < prevLives.current) {
      const frame = requestAnimationFrame(() => setLifeToast(true));
      const timer = setTimeout(() => setLifeToast(false), 1200);
      prevLives.current = lives;
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
    prevLives.current = lives;
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

      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: vignetteOpacity,
          background:
            'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.4) 90%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      <div className="font-russo pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-6 text-white uppercase select-none">
        {/* --- TOP LEFT: TIMER & DISTANCE --- */}
        <div className="flex flex-col items-start gap-2">
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

        {/* --- TOP CENTER: SCORE (ARCADE) --- */}
        {gameMode === 'ARCADE' && (
          <div className="absolute top-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-3">
              <Coins className="h-6 w-6 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
              <div
                className={clsx('text-5xl font-black tracking-widest text-amber-100', heavyShadow)}
              >
                {Math.floor(score).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div
                className={clsx(
                  'rounded-full border px-3 py-1 text-xs font-bold tracking-[0.18em] transition-all',
                  multiplierFlash
                    ? 'border-amber-300/80 bg-amber-500/20 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                    : 'border-white/15 bg-white/5'
                )}
              >
                x{multiplier.toFixed(1)} Multiplier
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                <Coins className="h-4 w-4 text-amber-300" />
                <span className="tracking-[0.12em] text-white">
                  {coins} <span className="text-white/60">coins</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- TOP RIGHT: LIVES (ARCADE) --- */}
        {gameMode === 'ARCADE' && (
          <div className="absolute top-6 right-6 flex flex-col items-end gap-2 text-right">
            <div className="text-[10px] font-semibold tracking-[0.3em] text-white/60">Lives</div>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((idx) => {
                const remaining = lives - idx;
                const isLost = remaining <= 0;
                const isFragile = remaining === 1;
                return (
                  <div
                    key={idx}
                    className={clsx(
                      'flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition-all',
                      isLost
                        ? 'border-white/10 bg-white/5 opacity-30'
                        : 'border-amber-200/30 bg-slate-900/50 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                    )}
                  >
                    <Heart
                      className={clsx(
                        'h-6 w-6 transition-transform',
                        isLost
                          ? 'text-white/25'
                          : isFragile
                            ? 'text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                            : 'text-red-300 drop-shadow-[0_0_10px_rgba(248,113,113,0.5)]'
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
