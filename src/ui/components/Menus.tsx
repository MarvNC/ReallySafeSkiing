import clsx from 'clsx';
import type { FC } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';
import { DifficultySelector } from './DifficultySelector';
import { SlopeControl } from './SlopeControl';

const SetupPanel: FC = () => (
  // Mobile: p-3, max-w-sm. Desktop: p-4, max-w-xl.
  <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-sm shadow-2xl backdrop-blur-md md:max-w-xl md:gap-3 md:p-4">
    {/* Mobile: p-2. Desktop: p-4. */}
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-2 md:p-4">
      <div className="text-xs tracking-widest text-white/70 uppercase">Obstacle Difficulty</div>
      <DifficultySelector />
    </div>
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-2 md:p-4">
      <div className="text-xs tracking-widest text-white/70 uppercase">Slope Angle</div>
      <div className="w-full">
        <SlopeControl />
      </div>
    </div>
    <div className="mt-2 flex items-center justify-center gap-4 border-t border-white/10 pt-2 opacity-80 md:pt-4">
      {/* Desktop controls */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono text-sm">
          A
        </span>
        <span className="text-xs tracking-widest">/</span>
        <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono text-sm">
          D
        </span>
        <span className="text-xs tracking-widest">STEER</span>
        <span className="mx-1 text-xs tracking-widest">|</span>
        <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono text-sm">
          A
        </span>
        <span className="text-xs tracking-widest">+</span>
        <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono text-sm">
          D
        </span>
        <span className="text-xs tracking-widest">TO WEDGE</span>
      </div>
      {/* Mobile controls */}
      <div className="flex flex-col items-center gap-1 text-center text-[10px] tracking-widest md:hidden md:text-xs">
        <div>TAP LEFT AND RIGHT SIDES TO STEER</div>
        <div>TAP BOTH SIDES TO WEDGE</div>
      </div>
    </div>
  </div>
);

const StartButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    // Mobile: mt-4, py-3, text-lg. Desktop: mt-6, py-4, text-xl.
    className="bg-accent-orange font-russo pointer-events-auto mt-4 w-full max-w-sm cursor-pointer rounded-xl py-3 text-lg tracking-widest text-white uppercase shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-400 active:scale-95 md:mt-6 md:max-w-3xl md:py-4 md:text-xl"
  >
    {label}
  </button>
);

const GhostButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    // Mobile: mt-2, py-2, text-sm. Desktop: mt-4, py-4, text-lg.
    className="font-russo pointer-events-auto mt-2 w-full max-w-sm cursor-pointer rounded-xl border-2 border-white/20 bg-transparent py-2 text-sm tracking-widest text-white/80 uppercase transition-all hover:border-white/50 hover:bg-white/10 hover:text-white md:mt-4 md:max-w-3xl md:py-4 md:text-lg"
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
      className="font-russo pointer-events-auto absolute right-2 bottom-2 z-50 cursor-pointer text-xs tracking-wider text-white/50 transition-colors hover:text-white hover:underline md:text-sm"
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
          {/* Mobile: text-4xl, mb-2. Desktop: text-7xl, mb-5 */}
          <h1 className="mb-2 bg-gradient-to-b from-white to-sky-200 bg-clip-text px-4 text-center text-6xl text-transparent italic drop-shadow-md md:mb-5">
            REALLY SAFE SKIING
          </h1>

          <SetupPanel />

          <StartButton label="START RUN" onClick={handleStart} />

          <GhostButton
            label="ABOUT"
            onClick={() => useGameStore.getState().setUIState(UIState.ABOUT)}
          />

          <MenuFooter />
        </>
      )}

      {/* PAUSE MENU */}
      {uiState === UIState.PAUSED && (
        <>
          <h1 className="mb-8 text-5xl italic drop-shadow-lg md:text-7xl">PAUSED</h1>
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
                  'flex cursor-pointer items-center justify-center gap-4 p-2 text-2xl transition-all md:text-3xl',
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
          <h1 className="mb-5 text-4xl italic drop-shadow-lg md:text-7xl">TIME&apos;S UP!</h1>
          <div className="mb-10 flex flex-col items-center gap-5">
            <div className="text-2xl text-sky-300 drop-shadow-md md:text-4xl">
              DISTANCE: {Math.floor(distance)}m
            </div>
            <div className="text-accent-orange animate-pulse text-xl italic md:text-3xl">
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
          className="pointer-events-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-white/20 bg-slate-900/80 p-6 text-center shadow-2xl backdrop-blur-md md:gap-6 md:p-8"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold italic drop-shadow-md md:text-5xl">ABOUT</h2>
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
          <div className="flex flex-col gap-2 text-left text-white/90 md:gap-4">
            <p className="text-sm leading-relaxed md:text-lg">
              <strong className="text-accent-orange">Really Safe Skiing</strong> is a fast-paced
              skiing game where you navigate down a procedurally generated slope while avoiding
              obstacles.
            </p>
            <div className="mt-2 space-y-1 md:mt-4 md:space-y-2">
              <h3 className="text-lg font-bold text-white md:text-xl">Features:</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-white/80 md:text-base">
                <li>Three difficulty levels: Chill, Sport, and Extreme</li>
                <li>Adjustable slope angle from 0° to 70°</li>
                <li>Real-time physics simulation</li>
                <li>Procedurally generated terrain</li>
                <li>Touch controls for mobile devices</li>
              </ul>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 md:mt-4 md:pt-4">
              <p className="text-xs text-white/60 md:text-sm">
                Press <kbd className="rounded bg-white/20 px-2 py-1 font-mono">ESC</kbd> or click
                outside to return to the menu.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
