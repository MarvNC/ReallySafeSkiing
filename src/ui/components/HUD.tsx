import clsx from 'clsx';
import { MapPin, Timer } from 'lucide-react';
import { useEffect } from 'react';

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
  } = useGameStore();

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

  // Helper for heavy text shadow to ensure readability on snow
  const heavyShadow = 'drop-shadow-[2px_2px_0_rgba(0,0,0,0.75)]';

  return (
    <div className="font-russo pointer-events-none absolute inset-0 flex flex-col justify-between p-6 text-white uppercase select-none">
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
                showPenaltyNotification && gameMode === 'SPRINT' ? 'text-accent-red' : 'text-white'
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
              <span className="ml-2 text-lg text-white/60">/ {SPRINT_CONFIG.TARGET_DISTANCE}m</span>
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

      {/* --- BOTTOM LEFT: SPEEDOMETER --- */}
      <div className="flex flex-col items-start gap-1">
        {/* SPEEDOMETER (Existing, slightly tweaked margins) */}
        <div className={clsx('flex items-baseline gap-2 text-6xl font-black italic', heavyShadow)}>
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
    </div>
  );
};
