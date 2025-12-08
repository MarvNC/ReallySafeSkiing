import clsx from 'clsx';
import { MapPin, Timer } from 'lucide-react';

import { SPRINT_CONFIG } from '../../config/GameConfig';
import { useGameStore } from '../store';

// Configuration for visual max speed (the bar is full at this speed)
const MAX_DISPLAY_SPEED_KMH = 200;

export const HUD = () => {
  const { timeRemaining, timeElapsed, speed, distance, gameMode } = useGameStore();

  // Time Formatting: Sprint and Zen count up, old modes count down
  const timerValue = gameMode === 'ZEN' || gameMode === 'SPRINT' ? timeElapsed : timeRemaining;
  const minutes = Math.floor(timerValue / 60);
  const seconds = Math.floor(timerValue % 60);
  const milliseconds = Math.floor((timerValue * 100) % 100);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;

  // Logic
  const isUrgent =
    gameMode !== 'SPRINT' && gameMode !== 'ZEN' && timeRemaining <= 10 && timeRemaining > 0;
  const speedKmh = Math.floor(speed * 3.6);
  // Cap the bar at 100% width, but let the number go higher
  const speedPercent = Math.min(100, (speedKmh / MAX_DISPLAY_SPEED_KMH) * 100);

  // Sprint mode progress calculation
  const sprintProgress =
    gameMode === 'SPRINT' ? Math.min(1, Math.max(0, distance / SPRINT_CONFIG.TARGET_DISTANCE)) : 0;

  // Helper for heavy text shadow to ensure readability on snow
  const heavyShadow = 'drop-shadow-[2px_2px_0_rgba(0,0,0,0.75)]';

  return (
    <div className="font-russo pointer-events-none absolute inset-0 flex flex-col justify-between p-6 text-white uppercase select-none">
      {/* --- TOP LEFT: TIMER & DISTANCE --- */}
      <div className="flex flex-col items-start gap-2">
        {/* TIMER PILL */}
        <div
          className={clsx(
            'flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/40 px-5 py-2 backdrop-blur-md transition-all',
            isUrgent && 'border-accent-red/50 animate-pulse bg-red-900/40'
          )}
        >
          <Timer
            className={clsx(
              'h-6 w-6',
              isUrgent
                ? 'text-accent-red'
                : gameMode === 'ZEN'
                  ? 'text-cyan-300'
                  : gameMode === 'SPRINT'
                    ? 'text-accent-orange'
                    : 'text-sky-300'
            )}
          />
          <div
            className={clsx(
              'text-4xl font-bold tracking-wider tabular-nums',
              heavyShadow,
              isUrgent
                ? 'text-accent-red'
                : gameMode === 'ZEN'
                  ? 'text-white'
                  : gameMode === 'SPRINT'
                    ? 'text-white'
                    : 'text-white'
            )}
          >
            {timeStr}
          </div>
        </div>

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

        {/* SPRINT PROGRESS BAR */}
        {gameMode === 'SPRINT' && (
          <div className="relative mt-2 h-3 w-80 overflow-hidden rounded-full border border-white/20 bg-black/50 backdrop-blur-sm">
            <div
              className="to-accent-orange h-full bg-gradient-to-r from-sky-400 via-white transition-all duration-300 ease-out"
              style={{ width: `${sprintProgress * 100}%` }}
            />
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
