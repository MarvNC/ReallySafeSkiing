import clsx from 'clsx';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';

export const Menus = () => {
  const { uiState, menuIndex, distance, topSpeed, setMenuIndex } = useGameStore();

  if (uiState === UIState.PLAYING) return null;

  const handleMenuClick = (index: number) => {
    setMenuIndex(index);
    // Slight delay to allow visual update of selection before action
    setTimeout(() => {
      InputManager.instance?.triggerAction(Action.MenuSelect);
    }, 50);
  };

  const handleStart = () => {
    InputManager.instance?.triggerAction(Action.Start);
  };

  const handlePauseMenuBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only resume if clicking the backdrop, not a button
    if (e.target === e.currentTarget) {
      // Set menuIndex to 0 (Resume) and trigger select
      setMenuIndex(0);
      setTimeout(() => {
        InputManager.instance?.triggerAction(Action.MenuSelect);
      }, 50);
    }
  };

  const handlePauseMenuBackdropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.target === e.currentTarget) {
        setMenuIndex(0);
        setTimeout(() => {
          InputManager.instance?.triggerAction(Action.MenuSelect);
        }, 50);
      }
    }
  };

  return (
    <div
      className={clsx(
        'font-russo absolute inset-0 z-50 flex flex-col items-center justify-center text-white',
        // Add background blur/tint only for non-crash menus, or a red tint for crash
        uiState === UIState.CRASHED
          ? 'bg-red-900/30 transition-colors duration-1000'
          : 'bg-sky-dark/40 backdrop-blur-sm'
      )}
      onClick={uiState === UIState.PAUSED ? handlePauseMenuBackdropClick : undefined}
      onKeyDown={uiState === UIState.PAUSED ? handlePauseMenuBackdropKeyDown : undefined}
      role={uiState === UIState.PAUSED ? 'button' : undefined}
      tabIndex={uiState === UIState.PAUSED ? 0 : undefined}
      aria-label={uiState === UIState.PAUSED ? 'Click outside to resume' : undefined}
    >
      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <>
          <h1 className="mb-5 px-4 text-center text-6xl italic drop-shadow-lg md:text-7xl">
            REALLY SAFE SKIING
          </h1>

          <button
            onClick={handleStart}
            className="animate-blink pointer-events-auto mt-8 cursor-pointer p-4 text-2xl transition-transform hover:scale-110 active:scale-95"
          >
            TAP OR STEER TO START
          </button>

          <div className="mt-8 text-sm opacity-60">
            <span className="hidden md:inline">A / D TO STEER</span>
            <span className="md:hidden">TOUCH CONTROLS ENABLED</span>
          </div>
        </>
      )}

      {/* PAUSE MENU */}
      {uiState === UIState.PAUSED && (
        <>
          <h1 className="mb-8 text-7xl italic drop-shadow-lg">PAUSED</h1>
          <div
            className="pointer-events-auto flex min-w-[300px] flex-col gap-4 text-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {['RESUME', 'RESTART', 'ABOUT'].map((item, idx) => (
              <button
                key={item}
                onClick={() => handleMenuClick(idx)}
                className={clsx(
                  'flex cursor-pointer items-center justify-center gap-4 p-2 text-3xl transition-all',
                  menuIndex === idx
                    ? 'scale-110 font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                    : 'text-sky-300 hover:scale-105 hover:text-white'
                )}
              >
                {menuIndex === idx && (
                  <div className="border-l-accent-orange h-0 w-0 border-y-[10px] border-l-[15px] border-y-transparent" />
                )}
                {item}
                {menuIndex === idx && (
                  <div className="border-r-accent-orange h-0 w-0 border-y-[10px] border-r-[15px] border-y-transparent" />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* WASTED OVERLAY */}
      {uiState === UIState.CRASHED && (
        <div className="animate-in fade-in zoom-in duration-300">
          <h1
            className="text-accent-red text-6xl tracking-widest italic drop-shadow-[4px_4px_0_rgba(0,0,0,1)] md:text-8xl"
            style={{ textShadow: '4px 4px 0 #000, -2px -2px 0 #000' }}
          >
            WASTED
          </h1>
        </div>
      )}

      {/* GAME OVER */}
      {uiState === UIState.GAME_OVER && (
        <>
          <h1 className="mb-5 text-6xl italic drop-shadow-lg md:text-7xl">TIME&apos;S UP!</h1>
          <div className="mb-10 flex flex-col items-center gap-5">
            <div className="text-3xl text-sky-300 drop-shadow-md md:text-4xl">
              DISTANCE: {Math.floor(distance)}m
            </div>
            <div className="text-accent-orange animate-pulse text-2xl italic md:text-3xl">
              TOP SPEED: {topSpeed} km/h
            </div>
          </div>
          <button
            onClick={handleStart}
            className="animate-blink pointer-events-auto p-4 text-2xl transition-transform hover:scale-110"
          >
            PLAY AGAIN
          </button>
        </>
      )}
    </div>
  );
};
