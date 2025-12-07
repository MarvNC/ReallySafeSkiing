import clsx from 'clsx';
import { Timer, MapPin } from 'lucide-react';
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
    <div className="font-russo pointer-events-none absolute inset-0 text-white uppercase select-none p-6 flex flex-col justify-between">
      
      {/* --- TOP LEFT: TIMER & DISTANCE --- */}
      <div className="flex flex-col items-start gap-2">
        {/* TIMER PILL */}
        <div className={clsx(
          "flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/40 px-5 py-2 backdrop-blur-md transition-all",
          isUrgent && "border-accent-red/50 bg-red-900/40 animate-pulse"
        )}>
          <Timer className={clsx("w-6 h-6", isUrgent ? "text-accent-red" : "text-sky-300")} />
          <div 
            className={clsx(
              "text-4xl font-bold tabular-nums tracking-wider", 
              heavyShadow,
              isUrgent ? "text-accent-red" : "text-white"
            )}
          >
            {timeStr}
          </div>
        </div>

        {/* DISTANCE */}
        <div className="flex items-center gap-2 opacity-90 pl-2">
          <MapPin className="w-5 h-5 text-accent-orange" />
          <div className={clsx("text-3xl font-bold tracking-wide", heavyShadow)}>
            {Math.floor(distance)} <span className="text-lg text-white/70">m</span>
          </div>
        </div>
      </div>

      {/* --- BOTTOM LEFT: SPEEDOMETER --- */}
      <div className="flex flex-col items-start gap-1">
        
        {/* SPEEDOMETER (Existing, slightly tweaked margins) */}
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
        <div className="w-80 h-6 skew-x-[-12deg] bg-black/50 border-2 border-white/20 relative overflow-hidden rounded-sm backdrop-blur-sm mt-1">
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
