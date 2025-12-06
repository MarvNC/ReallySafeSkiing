import { useGameStore, UIState } from '../store';
import clsx from 'clsx';

export const Menus = () => {
  const { uiState, menuIndex, distance, topSpeed } = useGameStore();

  if (uiState === UIState.PLAYING) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-sky-dark/40 backdrop-blur-sm font-russo text-white z-50">
      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <>
          <h1 className="text-7xl italic mb-5 drop-shadow-lg text-center">REALLY SAFE SKIING</h1>
          <div className="animate-blink text-2xl">W TO PROPEL, A / D TO STEER</div>
        </>
      )}

      {/* PAUSE MENU */}
      {uiState === UIState.PAUSED && (
        <>
          <h1 className="text-7xl italic mb-8 drop-shadow-lg">PAUSED</h1>
          <div className="flex flex-col gap-4 min-w-[300px] text-center">
            {['RESUME', 'RESTART', 'ABOUT'].map((item, idx) => (
              <div
                key={item}
                className={clsx(
                  'text-3xl cursor-pointer transition-all flex items-center justify-center gap-4',
                  menuIndex === idx
                    ? 'text-white font-bold scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                    : 'text-sky-300'
                )}
              >
                {menuIndex === idx && (
                  <div className="w-0 h-0 border-y-[10px] border-y-transparent border-l-[15px] border-l-accent-orange" />
                )}
                {item}
                {menuIndex === idx && (
                  <div className="w-0 h-0 border-y-[10px] border-y-transparent border-r-[15px] border-r-accent-orange" />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* GAME OVER */}
      {uiState === UIState.GAME_OVER && (
        <>
          <h1 className="text-7xl italic mb-5 drop-shadow-lg">TIME&apos;S UP!</h1>
          <div className="flex flex-col items-center gap-5 mb-10">
            <div className="text-4xl text-sky-300 drop-shadow-md">
              DISTANCE: {Math.floor(distance)}m
            </div>
            <div className="text-3xl text-accent-orange italic animate-pulse">
              TOP SPEED: {topSpeed} km/h
            </div>
          </div>
          <div className="animate-blink text-2xl">PRESS SPACE TO RESTART</div>
        </>
      )}
    </div>
  );
};
