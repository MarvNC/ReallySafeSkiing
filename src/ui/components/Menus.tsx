import clsx from 'clsx';
import type { FC } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';
import { DifficultySelector } from './DifficultySelector';
import { SlopeControl } from './SlopeControl';

const SetupPanel: FC = () => (
  <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm shadow-2xl backdrop-blur-md">
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs tracking-widest text-white/70 uppercase">Obstacle Difficulty</div>
      <DifficultySelector />
    </div>
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs tracking-widest text-white/70 uppercase">Slope Angle</div>
      <div className="w-full">
        <SlopeControl />
      </div>
    </div>
    <div className="mt-2 border-t border-white/10 pt-4 flex items-center justify-center gap-4 opacity-80">
      {/* Desktop controls */}
      <div className="hidden md:flex items-center gap-2">
        <span className="bg-white/20 rounded-md px-2 py-1 font-mono text-sm border-b-2 border-white/10">A</span>
        <span className="text-xs tracking-widest">/</span>
        <span className="bg-white/20 rounded-md px-2 py-1 font-mono text-sm border-b-2 border-white/10">D</span>
        <span className="text-xs tracking-widest">STEER</span>
        <span className="text-xs tracking-widest mx-1">|</span>
        <span className="bg-white/20 rounded-md px-2 py-1 font-mono text-sm border-b-2 border-white/10">A</span>
        <span className="text-xs tracking-widest">+</span>
        <span className="bg-white/20 rounded-md px-2 py-1 font-mono text-sm border-b-2 border-white/10">D</span>
        <span className="text-xs tracking-widest">TO WEDGE</span>
      </div>
      {/* Mobile controls */}
      <div className="md:hidden flex flex-col items-center gap-1 text-xs tracking-widest text-center">
        <div>TAP LEFT AND RIGHT SIDES TO STEER</div>
        <div>TAP BOTH SIDES TO WEDGE</div>
      </div>
    </div>
  </div>
);

const StartButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="bg-accent-orange font-russo pointer-events-auto mt-6 w-full max-w-3xl cursor-pointer rounded-xl py-4 text-xl tracking-widest text-white uppercase shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-400 active:scale-95"
  >
    {label}
  </button>
);

const GhostButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="border-2 border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white hover:border-white/50 transition-all rounded-xl py-4 uppercase font-russo tracking-widest text-lg w-full max-w-3xl mt-4 pointer-events-auto cursor-pointer"
  >
    {label}
  </button>
);

// Footer Component - Links to GitHub
const MenuFooter: FC = () => {
  return (
    <a
      href="https://github.com/MarvNC"
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto absolute bottom-2 right-2 z-50 text-white/50 hover:text-white transition-colors text-sm font-russo tracking-wider hover:underline cursor-pointer"
    >
      By MarvNC
    </a>
  );
};

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

  const handleAboutBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      useGameStore.getState().setUIState(UIState.MENU);
    }
  };

  const handleAboutKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      useGameStore.getState().setUIState(UIState.MENU);
    }
  };

  return (
    <div
      className={clsx(
        'font-russo absolute inset-0 z-50 flex flex-col items-center justify-center text-white',
        // Add background blur/tint only for non-crash menus, or a red tint for crash
        uiState === UIState.CRASHED
          ? 'bg-red-900/30 transition-colors duration-1000'
          : uiState === UIState.ABOUT
            ? 'bg-sky-dark/60 backdrop-blur-xl'
            : 'bg-sky-dark/40 backdrop-blur-sm'
      )}
      onClick={
        uiState === UIState.PAUSED
          ? handlePauseMenuBackdropClick
          : uiState === UIState.ABOUT
            ? handleAboutBackdropClick
            : undefined
      }
      onKeyDown={
        uiState === UIState.PAUSED
          ? handlePauseMenuBackdropKeyDown
          : uiState === UIState.ABOUT
            ? handleAboutKeyDown
            : undefined
      }
      role={uiState === UIState.PAUSED || uiState === UIState.ABOUT ? 'button' : undefined}
      tabIndex={uiState === UIState.PAUSED || uiState === UIState.ABOUT ? 0 : undefined}
      aria-label={
        uiState === UIState.PAUSED
          ? 'Click outside to resume'
          : uiState === UIState.ABOUT
            ? 'Click outside or press ESC to return'
            : undefined
      }
    >
      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <>
          <h1 className="mb-5 bg-gradient-to-b from-white to-sky-200 bg-clip-text px-4 text-center text-6xl text-transparent italic drop-shadow-md md:text-7xl">
            REALLY SAFE SKIING
          </h1>

          <SetupPanel />

          <StartButton label="START RUN" onClick={handleStart} />

          <GhostButton label="ABOUT" onClick={() => useGameStore.getState().setUIState(UIState.ABOUT)} />

          <div className="mt-2 text-sm opacity-60 md:hidden">TOUCH CONTROLS ENABLED</div>

          <MenuFooter />
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
            {['RESUME', 'RESTART', 'BACK TO MENU'].map((item, idx) => (
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
          <MenuFooter />
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
            <SetupPanel />
          </div>
          <StartButton label="PLAY AGAIN" onClick={handleStart} />
          <MenuFooter />
        </>
      )}

      {/* ABOUT SCREEN */}
      {uiState === UIState.ABOUT && (
        <div
          className="pointer-events-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-white/20 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-bold italic drop-shadow-md md:text-5xl">ABOUT</h2>
            <button
              onClick={() => useGameStore.getState().setUIState(UIState.MENU)}
              className="rounded-full bg-white/10 p-2 text-white transition-all hover:bg-white/20 active:scale-95"
              aria-label="Close About"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col gap-4 text-left text-white/90">
            <p className="text-lg leading-relaxed">
              <strong className="text-accent-orange">Really Safe Skiing</strong> is a fast-paced skiing game where you
              navigate down a procedurally generated slope while avoiding obstacles.
            </p>
            <div className="mt-4 space-y-2">
              <h3 className="text-xl font-bold text-white">Features:</h3>
              <ul className="list-disc list-inside space-y-1 text-white/80">
                <li>Three difficulty levels: Chill, Sport, and Extreme</li>
                <li>Adjustable slope angle from 0° to 70°</li>
                <li>Real-time physics simulation</li>
                <li>Procedurally generated terrain</li>
                <li>Touch controls for mobile devices</li>
              </ul>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-sm text-white/60">
                Press <kbd className="rounded bg-white/20 px-2 py-1 font-mono">ESC</kbd> or click outside to return to
                the menu.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
