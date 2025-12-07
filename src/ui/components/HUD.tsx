import { useGameStore } from '../store';

export const HUD = () => {
  const { timeRemaining, speed, distance } = useGameStore();

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const milliseconds = Math.floor((timeRemaining * 100) % 100);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;

  return (
    <div className="font-russo pointer-events-none absolute inset-0 text-white uppercase select-none">
      {/* Timer */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center drop-shadow-md">
        <div className="text-5xl font-bold tabular-nums">{timeStr}</div>
        <div className="text-xs tracking-widest opacity-80">Time Remaining</div>
      </div>

      {/* Speed - Adjusted for mobile to avoid overlap with TopBar */}
      <div className="absolute bottom-5 left-2 drop-shadow-md md:left-8">
        <div className="text-accent-orange text-4xl font-black italic md:text-6xl">
          {Math.floor(speed * 3.6)}{' '}
          <span className="text-xl font-normal text-white not-italic opacity-80 md:text-2xl">
            km/h
          </span>
        </div>
      </div>

      {/* Distance */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center drop-shadow-md">
        <div className="text-4xl font-bold">
          {Math.floor(distance)} <span className="text-lg font-normal opacity-80">m</span>
        </div>
        <div className="text-xs tracking-widest opacity-80">Distance</div>
      </div>
    </div>
  );
};
