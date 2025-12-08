import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { type FC, type ReactNode, useState } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import { GameMode, UIState, useGameStore } from '../store';
import { DifficultySelector } from './DifficultySelector';
import { GameLogo } from './GameLogo';
import { GameModeToggle } from './GameModeToggle';
import { GameOver } from './GameOver';
import { SlopeControl } from './SlopeControl';

/** Trigger an input action after a brief delay for visual feedback */
const triggerDelayedAction = (action: Action, delay = 50) => {
  setTimeout(() => InputManager.instance?.triggerAction(action), delay);
};

const getPauseMenuItems = (gameMode: GameMode) =>
  ['RESUME', 'RESTART', gameMode === 'ZEN' ? 'END RUN' : 'BACK TO MENU'] as const;

const SelectionArrow: FC<{ direction: 'left' | 'right' }> = ({ direction }) => (
  <div
    className={clsx(
      'h-0 w-0 border-y-10 border-y-transparent',
      direction === 'left'
        ? 'border-l-accent-orange border-l-15'
        : 'border-r-accent-orange border-r-15'
    )}
  />
);

// Consistent content container for width constraints and mobile padding
const ContentContainer: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={clsx('w-full max-w-sm px-4 md:max-w-xl md:px-0', className)}>{children}</div>;

const AccordionSection: FC<{
  title: string;
  subtitle?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}> = ({ title, subtitle, isOpen, onToggle, children }) => {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10 md:overflow-visible md:rounded-none md:border-none md:bg-transparent md:hover:bg-transparent">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left outline-none md:cursor-default md:p-0 md:pb-1"
      >
        <div className="flex flex-col md:w-full md:flex-row md:items-baseline md:justify-between md:gap-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-white/50 uppercase md:text-white/30">{subtitle}</span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 text-white/50 transition-transform duration-300 md:hidden',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={clsx(
          'grid transition-[grid-template-rows] duration-300 ease-out md:grid-rows-[1fr]',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden md:overflow-visible">
          <div className="p-3 pt-0 md:p-0">{children}</div>
        </div>
      </div>
    </div>
  );
};

const SetupPanel: FC = () => {
  const [openSection, setOpenSection] = useState<'DENSITY' | 'SLOPE' | null>('DENSITY');

  const toggleSection = (section: 'DENSITY' | 'SLOPE') => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    // Mobile: p-3. Desktop: p-4.
    <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-sm shadow-2xl backdrop-blur-xl transition-all duration-500 md:gap-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">
          Game Mode
        </div>
        <GameModeToggle />
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent md:hidden" />
      <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent md:block" />

      <AccordionSection
        title="Obstacle Density"
        subtitle="Trees & Rocks"
        isOpen={openSection === 'DENSITY'}
        onToggle={() => toggleSection('DENSITY')}
      >
        <DifficultySelector />
      </AccordionSection>

      <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent md:hidden" />

      <AccordionSection
        title="Steepness"
        subtitle="Speed & Gravity"
        isOpen={openSection === 'SLOPE'}
        onToggle={() => toggleSection('SLOPE')}
      >
        <SlopeControl />
      </AccordionSection>

      <div className="text-s flex items-center justify-center gap-4 border-t border-white/10 pt-2 pt-3 text-white opacity-80">
        {/* Desktop controls */}
        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono">
            A
          </span>
          <span className="tracking-widest">/</span>
          <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono">
            D
          </span>
          <span className="tracking-widest">STEER</span>
          <span className="mx-1 tracking-widest">|</span>
          <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono">
            A
          </span>
          <span className="tracking-widest">+</span>
          <span className="rounded-md border-b-2 border-white/10 bg-white/20 px-2 py-1 font-mono">
            D
          </span>
          <span className="tracking-widest">TO WEDGE</span>
        </div>
        {/* Mobile controls */}
        <div className="flex flex-col items-center gap-1 text-center text-xs tracking-widest md:hidden">
          <div>TAP LEFT AND RIGHT SIDES TO STEER</div>
          <div>TAP BOTH SIDES TO WEDGE</div>
        </div>
      </div>
    </div>
  );
};

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
    className="font-russo pointer-events-auto mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-white/20 py-2 text-sm tracking-[0.15em] text-white uppercase transition-all duration-200 hover:bg-white/30 hover:text-white md:mt-4 md:py-4 md:text-lg"
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
  const { uiState, menuIndex, setMenuIndex, endReason, gameMode } = useGameStore();

  if (uiState === UIState.PLAYING) return null;

  const isCrashGameOver = endReason === 'crash';
  const isCrashTint =
    uiState === UIState.CRASHED || (uiState === UIState.GAME_OVER && isCrashGameOver);
  const isInteractiveBackdrop = uiState === UIState.PAUSED || uiState === UIState.ABOUT;

  const handleMenuClick = (index: number) => {
    setMenuIndex(index);
    triggerDelayedAction(Action.MenuSelect);
  };

  const handleStart = () => {
    InputManager.instance?.triggerAction(Action.Start);
  };

  const resumeFromPause = () => {
    setMenuIndex(0);
    triggerDelayedAction(Action.MenuSelect);
  };

  const closeAbout = () => {
    useGameStore.getState().setUIState(UIState.MENU);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (uiState === UIState.PAUSED) resumeFromPause();
    else if (uiState === UIState.ABOUT) closeAbout();
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (uiState === UIState.PAUSED && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      resumeFromPause();
    } else if (uiState === UIState.ABOUT && e.key === 'Escape') {
      e.preventDefault();
      closeAbout();
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
      onClick={isInteractiveBackdrop ? handleBackdropClick : undefined}
      onKeyDown={isInteractiveBackdrop ? handleBackdropKeyDown : undefined}
      role={isInteractiveBackdrop ? 'button' : undefined}
      tabIndex={isInteractiveBackdrop ? 0 : undefined}
    >
      {/* Background Gradient Blob used for atmosphere */}
      {!isCrashTint && (
        <div
          className={clsx(
            'pointer-events-none absolute h-[150vh] w-[150vw] opacity-20 transition-colors duration-1000',
            gameMode === 'ZEN'
              ? 'bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.2),transparent)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.2),transparent)]'
          )}
        />
      )}

      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <>
          <GameLogo className="mb-4" />

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
            {getPauseMenuItems(gameMode).map((item, idx) => {
              const isSelected = menuIndex === idx;
              return (
                <button
                  key={item}
                  onClick={() => handleMenuClick(idx)}
                  className={clsx(
                    'flex cursor-pointer items-center justify-center gap-4 p-2 text-2xl transition-all md:text-3xl',
                    isSelected
                      ? 'scale-110 font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                      : 'text-sky-300 hover:scale-105 hover:text-white'
                  )}
                >
                  {isSelected && <SelectionArrow direction="left" />}
                  {item}
                  {isSelected && <SelectionArrow direction="right" />}
                </button>
              );
            })}
          </div>
          <MenuFooter />
        </>
      )}

      {/* WASTED OVERLAY */}
      {uiState === UIState.CRASHED && (
        <div className="animate-in fade-in zoom-in z-50 flex flex-col items-center justify-center duration-300">
          <div className="relative -rotate-2 transform transition-transform hover:scale-105">
            {/* Vibrant Red Background Box */}
            <div className="absolute -inset-x-12 -inset-y-4 -skew-x-[20deg] border-4 border-white bg-gradient-to-r from-red-600 to-orange-600 shadow-[8px_8px_0_rgba(0,0,0,0.2)]" />

            {/* Subtle Texture/Pattern */}
            <div
              className="absolute -inset-x-12 -inset-y-4 -skew-x-[20deg] opacity-20 mix-blend-overlay"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)',
              }}
            />

            {/* Inner Detail Line */}
            <div className="absolute -inset-x-8 -inset-y-2 -skew-x-[20deg] border-y-2 border-white/20" />

            {/* Main Text */}
            <h1 className="font-russo relative z-10 text-7xl tracking-widest text-white uppercase italic drop-shadow-lg md:text-9xl">
              WASTED
            </h1>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {uiState === UIState.GAME_OVER && (
        <>
          <GameOver />
          <MenuFooter />
        </>
      )}
    </div>
  );
};
