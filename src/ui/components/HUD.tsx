import clsx from 'clsx';
import { useGameStore } from '../store';

// Configuration for visual max speed (the bar is full at this speed)
const MAX_DISPLAY_SPEED_KMH = 200;

export const HUD = () => {
  const { timeRemaining, speed, distance } = useGameStore();

  // Time Formatting
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const milliseconds = Math.floor((timeRemaining * 100) % 100);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  
  // Logic
  const isUrgent = timeRemaining <= 10 && timeRemaining > 0;
  const speedKmh = Math.floor(speed * 3.6);
  // Cap the bar at 100% width, but let the number go higher
  const speedPercent = Math.min(100, (speedKmh / MAX_DISPLAY_SPEED_KMH) * 100);

  // Helper for heavy text shadow to ensure readability on snow
  const heavyShadow = 'drop-shadow-[2px_2px_0_rgba(0,0,0,0.75)]';

  return (
    <div className="font-russo pointer-events-none absolute inset-0 text-white uppercase select-none">
      
      {/* --- STATS (Top Left) --- */}
      <div className="absolute top-6 left-6 flex flex-col items-start gap-2 transition-all duration-300">
        
        {/* TIMER */}
        <div 
          className={clsx(
            "text-5xl font-bold tabular-nums transition-colors duration-300", 
            heavyShadow,
            isUrgent ? "text-accent-red animate-pulse scale-110 origin-left" : "text-white"
          )}
        >
          {timeStr}
        </div>

        {/* DISTANCE */}
        <div className="text-left">
          <div className={clsx("text-4xl font-bold", heavyShadow)}>
            {Math.floor(distance)} <span className="text-xl font-normal opacity-80">m</span>
          </div>
          <div className={clsx("text-xs tracking-widest opacity-90", heavyShadow)}>
            Distance Traveled
          </div>
        </div>
      </div>

      {/* --- SPEEDOMETER (Bottom Left) --- */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-1">
        
        {/* Number Display */}
        <div className={clsx("text-6xl font-black italic flex items-baseline gap-2", heavyShadow)}>
          <span className={clsx(
            "transition-colors duration-300", 
            speedKmh > 120 ? "text-accent-orange" : "text-white"
          )}>
            {speedKmh}
          </span>
          <span className="text-3xl font-normal text-white opacity-80 not-italic">
            km/h
          </span>
        </div>

        {/* Visual Speed Bar */}
        <div className="w-80 h-6 skew-x-[-12deg] bg-black/50 border-2 border-white/20 relative overflow-hidden rounded-sm backdrop-blur-sm">
          {/* Background hash marks (optional style detail) */}
          <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_19px,#fff_20px)]" />
          
          {/* Fill Bar */}
          <div 
            className="h-full bg-gradient-to-r from-sky-400 via-white to-accent-orange transition-all duration-100 ease-out"
            style={{ width: `${speedPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
