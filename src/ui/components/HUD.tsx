import { useGameStore } from '../store';

export const HUD = () => {
  const { timeRemaining, speed, distance } = useGameStore();

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const milliseconds = Math.floor((timeRemaining * 100) % 100);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;

  return (
    <div className="absolute inset-0 pointer-events-none font-russo text-white uppercase select-none">
      {/* Timer */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center drop-shadow-md">
        <div className="text-5xl font-bold tabular-nums">{timeStr}</div>
        <div className="text-xs tracking-widest opacity-80">Time Remaining</div>
      </div>

      {/* Speed */}
      <div className="absolute bottom-5 left-8 drop-shadow-md">
        <div className="text-6xl font-black italic text-accent-orange">
          {Math.floor(speed * 3.6)}{' '}
          <span className="text-2xl font-normal not-italic text-white opacity-80">km/h</span>
        </div>
      </div>

      {/* Distance */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center drop-shadow-md">
        <div className="text-4xl font-bold">
          {Math.floor(distance)} <span className="text-lg opacity-80 font-normal">m</span>
        </div>
        <div className="text-xs tracking-widest opacity-80">Distance</div>
      </div>
    </div>
  );
};
