import clsx from 'clsx';
import { Flame, Infinity as InfinityIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import { GameMode, UIState, useGameStore } from '../store';
import { DifficultySelector } from './DifficultySelector';
import { SlopeControl } from './SlopeControl';

// Consistent content container for width constraints and mobile padding
const ContentContainer: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={clsx('w-full max-w-sm px-4 md:max-w-xl md:px-0', className)}>{children}</div>;

const GameModeToggle: FC = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  return (
    <div className="group relative w-full">
      {/* Ambient Background Glow - shifts color based on mode */}
      <div
        className={clsx(
          'absolute -inset-1 rounded-full opacity-20 blur-md transition-all duration-700',
          gameMode === 'SPRINT' ? 'bg-orange-500' : 'bg-cyan-400'
        )}
      />
      {/* The Toggle Container */}
      <div
        className={clsx(
          'relative flex h-12 w-full cursor-pointer items-center rounded-full border p-1 transition-colors duration-500',
          gameMode === 'SPRINT'
            ? 'border-orange-500/30 bg-orange-950/40'
            : 'border-cyan-400/30 bg-cyan-950/40'
        )}
        onClick={() => setGameMode(gameMode === 'SPRINT' ? 'ZEN' : 'SPRINT')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setGameMode(gameMode === 'SPRINT' ? 'ZEN' : 'SPRINT');
          }
        }}
      >
        {/* The Sliding "Puck" */}
        <div
          className={clsx(
            'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-lg transition-all duration-500',
            // Custom spring bezier for that "snappy" feel
            'ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            gameMode === 'SPRINT'
              ? 'left-1 translate-x-0 bg-gradient-to-br from-orange-400 to-red-600 shadow-orange-900/50'
              : 'left-1 translate-x-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-cyan-900/50'
          )}
        >
          {/* Shine effect on the puck */}
          <div className="absolute top-0 right-0 left-0 h-1/2 rounded-t-full bg-white/20" />
        </div>
        {/* SPRINT OPTION */}
        <div className="relative z-10 flex flex-1 items-center justify-center gap-2 text-center">
          <Flame
            className={clsx(
              'h-4 w-4 transition-all duration-300',
              gameMode === 'SPRINT'
                ? 'scale-110 text-white drop-shadow-md'
                : 'scale-90 text-white/40'
            )}
          />
          <span
            className={clsx(
              'text-xs font-bold tracking-[0.15em] transition-colors duration-300',
              gameMode === 'SPRINT' ? 'text-white' : 'text-white/40'
            )}
          >
            SPRINT
          </span>
        </div>
        {/* ZEN OPTION */}
        <div className="relative z-10 flex flex-1 items-center justify-center gap-2 text-center">
          <InfinityIcon
            className={clsx(
              'h-4 w-4 transition-all duration-300',
              gameMode === 'ZEN' ? 'scale-110 text-white drop-shadow-md' : 'scale-90 text-white/40'
            )}
          />
          <span
            className={clsx(
              'text-xs font-bold tracking-[0.15em] transition-colors duration-300',
              gameMode === 'ZEN' ? 'text-white' : 'text-white/40'
            )}
          >
            ZEN
          </span>
        </div>
      </div>
    </div>
  );
};

const SetupPanel: FC = () => (
  // Mobile: p-3. Desktop: p-4.
  <div className="pointer-events-auto flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-sm shadow-2xl backdrop-blur-xl transition-all duration-500 md:p-6">
    <div className="flex flex-col gap-2">
      <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">
        Game Mode
      </div>
      <GameModeToggle />
    </div>
    {/* Separator */}
    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">
        <span>Obstacle Density</span>
        <span className="text-white/30">Trees & Rocks</span>
      </div>
      <DifficultySelector />
    </div>
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">
        <span>Steepness</span>
        <span className="text-white/30">Speed & Gravity</span>
      </div>
      <SlopeControl />
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

const StartButton: FC<{ label: string; onClick: () => void; gameMode: GameMode }> = ({
  label,
  onClick,
  gameMode,
}) => {
  return (
    <button
      onClick={onClick}
      type="button"
      className={clsx(
        'font-russo pointer-events-auto mt-4 w-full cursor-pointer rounded-xl py-4 text-xl tracking-[0.15em] text-white uppercase shadow-2xl transition-all duration-300 hover:-translate-y-1 active:scale-95 md:mt-6',
        gameMode === 'SPRINT'
          ? 'bg-gradient-to-br from-orange-400 to-red-600 shadow-orange-500/30 hover:bg-gradient-to-br hover:from-orange-300 hover:to-red-500'
          : 'bg-gradient-to-br from-cyan-300 to-blue-500 shadow-cyan-400/30 hover:bg-gradient-to-br hover:from-cyan-200 hover:to-blue-400'
      )}
    >
      {label}
    </button>
  );
};

const GhostButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="font-russo pointer-events-auto mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2 text-sm tracking-[0.15em] text-white/60 uppercase transition-all duration-200 hover:bg-white/10 hover:text-white md:mt-4 md:py-4 md:text-lg"
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
      className="font-russo pointer-events-auto absolute right-4 bottom-4 z-50 flex items-center gap-2 text-xs tracking-wider text-white/30 transition-colors hover:text-white md:text-sm"
    >
      <span>Created by MarvNC</span>
    </a>
  );
};

export const Menus = () => {
  const {
    uiState,
    menuIndex,
    distance,
    topSpeed,
    setMenuIndex,
    endReason,
    gameMode,
    timeElapsed,
    penalties,
  } = useGameStore();
  const isCrashGameOver = endReason === 'crash';
  const isManualEnd = endReason === 'manual';
  const isComplete = endReason === 'complete';
  const isCrashTint =
    uiState === UIState.CRASHED || (uiState === UIState.GAME_OVER && isCrashGameOver);

  const formatTime = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    const milliseconds = Math.floor((value * 100) % 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const finalTime = timeElapsed; // Both Sprint and Zen modes use elapsed time

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
        'font-russo absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden text-white',
        isCrashTint
          ? 'bg-red-950/40 backdrop-blur-sm transition-colors duration-1000'
          : uiState === UIState.ABOUT
            ? 'bg-slate-900/80 backdrop-blur-md'
            : 'bg-slate-900/40 backdrop-blur-sm'
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
    >
      {/* Background Gradient Blob used for atmosphere */}
      {!isCrashTint && (
        <div
          className={clsx(
            'pointer-events-none absolute h-[150vh] w-[150vw] opacity-20 transition-colors duration-1000',
            gameMode === 'ZEN'
              ? 'bg-[radial-gradient(circle_at_center,_rgba(6,182,212,0.2),_transparent)]'
              : 'bg-[radial-gradient(circle_at_center,_rgba(249,115,22,0.2),_transparent)]'
          )}
        />
      )}

      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <>
          {/* Mobile: text-4xl, mb-2. Desktop: text-7xl, mb-5 */}
          <h1 className="mb-2 bg-gradient-to-b from-white to-sky-200 bg-clip-text px-4 text-center text-6xl text-transparent italic drop-shadow-md md:mb-5">
            REALLY SAFE SKIING
          </h1>

          <ContentContainer>
            <SetupPanel />
          </ContentContainer>

          <ContentContainer>
            <StartButton label="START RUN" onClick={handleStart} gameMode={gameMode} />
          </ContentContainer>

          <ContentContainer>
            <GhostButton
              label="ABOUT"
              onClick={() => useGameStore.getState().setUIState(UIState.ABOUT)}
            />
          </ContentContainer>

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
            {['RESUME', 'RESTART', gameMode === 'ZEN' ? 'END RUN' : 'BACK TO MENU'].map(
              (item, idx) => (
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
              )
            )}
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
          <h1
            className={clsx(
              'mb-5 text-4xl italic drop-shadow-lg md:text-7xl',
              isCrashGameOver
                ? 'text-accent-red drop-shadow-[4px_4px_0_rgba(0,0,0,0.8)]'
                : isComplete || isManualEnd
                  ? 'text-cyan-300'
                  : undefined
            )}
          >
            {isCrashGameOver
              ? 'WASTED'
              : isComplete
                ? 'SPRINT COMPLETE!'
                : isManualEnd
                  ? 'RUN COMPLETE'
                  : "TIME'S UP!"}
          </h1>
          {isCrashGameOver && (
            <div className="mb-2 text-center text-lg text-white/80 md:mb-4 md:text-xl">
              You wiped out. The run is over.
            </div>
          )}
          <div className="mb-10 flex w-full flex-col items-center gap-5">
            <div className="text-2xl text-sky-300 drop-shadow-md md:text-4xl">
              DISTANCE: {Math.floor(distance)}m
            </div>
            <div
              className={clsx(
                'animate-pulse text-xl italic md:text-3xl',
                isCrashGameOver ? 'text-accent-red' : 'text-accent-orange'
              )}
            >
              TOP SPEED: {topSpeed} km/h
            </div>
            <div className="text-xl text-white/80 md:text-2xl">
              TIME: {formatTime(finalTime)}
              {gameMode === 'SPRINT' && penalties > 0 && (
                <span className="ml-2 text-sm text-white/60">
                  ({penalties} {penalties === 1 ? 'penalty' : 'penalties'})
                </span>
              )}
            </div>
            <ContentContainer>
              <SetupPanel />
            </ContentContainer>
            <ContentContainer className="[&>button]:!mt-0">
              <StartButton label="PLAY AGAIN" onClick={handleStart} gameMode={gameMode} />
            </ContentContainer>
          </div>
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
