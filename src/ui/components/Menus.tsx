import clsx from 'clsx';

import { UIState, useGameStore } from '../store';

export const Menus = () => {
  const { uiState, menuIndex, distance, topSpeed } = useGameStore();

  if (uiState === UIState.PLAYING) return null;

  return (
    <div
      className={clsx(
        'font-russo absolute inset-0 z-50 flex flex-col items-center justify-center text-white',
        // Add background blur/tint only for non-crash menus, or a red tint for crash
        uiState === UIState.CRASHED
          ? 'bg-red-900/30 transition-colors duration-1000'
          : 'bg-sky-dark/40 backdrop-blur-sm'
      )}
    >
      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <>
          <h1 className="mb-5 text-center text-7xl italic drop-shadow-lg">REALLY SAFE SKIING</h1>
          <div className="animate-blink text-2xl">A / D TO STEER</div>
        </>
      )}

      {/* PAUSE MENU */}
      {uiState === UIState.PAUSED && (
        <>
          <h1 className="mb-8 text-7xl italic drop-shadow-lg">PAUSED</h1>
          <div className="flex min-w-[300px] flex-col gap-4 text-center">
            {['RESUME', 'RESTART', 'ABOUT'].map((item, idx) => (
              <div
                key={item}
                className={clsx(
                  'flex cursor-pointer items-center justify-center gap-4 text-3xl transition-all',
                  menuIndex === idx
                    ? 'scale-110 font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                    : 'text-sky-300'
                )}
              >
                {menuIndex === idx && (
                  <div className="border-l-accent-orange h-0 w-0 border-y-[10px] border-l-[15px] border-y-transparent" />
                )}
                {item}
                {menuIndex === idx && (
                  <div className="border-r-accent-orange h-0 w-0 border-y-[10px] border-r-[15px] border-y-transparent" />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* WASTED OVERLAY */}
      {uiState === UIState.CRASHED && (
        <div className="animate-in fade-in zoom-in duration-300">
          <h1
            className="text-8xl italic tracking-widest text-accent-red drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
            style={{ textShadow: '4px 4px 0 #000, -2px -2px 0 #000' }}
          >
            WASTED
          </h1>
        </div>
      )}

      {/* GAME OVER */}
      {uiState === UIState.GAME_OVER && (
        <>
          <h1 className="mb-5 text-7xl italic drop-shadow-lg">TIME&apos;S UP!</h1>
          <div className="mb-10 flex flex-col items-center gap-5">
            <div className="text-4xl text-sky-300 drop-shadow-md">
              DISTANCE: {Math.floor(distance)}m
            </div>
            <div className="text-accent-orange animate-pulse text-3xl italic">
              TOP SPEED: {topSpeed} km/h
            </div>
          </div>
          <div className="animate-blink text-2xl">PRESS SPACE TO RESTART</div>
        </>
      )}
    </div>
  );
};
