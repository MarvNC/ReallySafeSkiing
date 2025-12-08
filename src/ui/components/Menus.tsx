import clsx from 'clsx';
import { ChevronDown, Home, LogOut, Play, RotateCcw } from 'lucide-react';
import { type FC, type ReactNode, useEffect, useState } from 'react';

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
  [
    { label: 'RESUME', icon: Play },
    { label: 'RESTART', icon: RotateCcw },
    {
      label: gameMode === 'ZEN' ? 'END RUN' : 'BACK TO MENU',
      icon: gameMode === 'ZEN' ? LogOut : Home,
    },
  ] as const;

// Consistent content container for width constraints and mobile padding
const ContentContainer: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={clsx('w-full max-w-sm px-4 md:max-w-xl md:px-0', className)}>{children}</div>;

const KeyPill: FC<{ label: string; large?: boolean }> = ({ label, large = false }) => (
  <span
    className={clsx(
      'rounded-md border border-white/20 bg-white/10 px-3 py-2 font-mono text-white shadow-[0_0_25px_rgba(255,255,255,0.08)]',
      large ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'
    )}
  >
    {label}
  </span>
);

const FirstRunPrompt: FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div className="pointer-events-none flex flex-col items-center gap-6 text-center text-white md:gap-8">
    {isMobile ? (
      <>
        <div className="text-4xl font-extrabold tracking-wide md:text-6xl">
          TAP LEFT / RIGHT TO STEER
        </div>
        <div className="text-3xl font-semibold text-amber-200 md:text-5xl">
          TAP BOTH SIDES TO WEDGE / BRAKE
        </div>
      </>
    ) : (
      <>
        <div className="flex flex-wrap items-center justify-center gap-4 text-3xl font-semibold text-white md:gap-6 md:text-4xl">
          <KeyPill label="A" large />
          <span className="text-2xl font-semibold text-white/60 md:text-3xl">/</span>
          <KeyPill label="D" large />
          <span className="text-2xl font-semibold text-white/80 md:text-3xl">TO STEER</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-3xl font-semibold text-amber-200 md:gap-4 md:text-4xl">
          <KeyPill label="A" />
          <span className="text-xl font-semibold text-white/70 md:text-2xl">+</span>
          <KeyPill label="D" />
          <span className="text-2xl font-bold text-amber-200 md:text-4xl">WEDGE / BRAKE</span>
        </div>
      </>
    )}
  </div>
);

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
          {subtitle && <span className="text-[10px] text-white/60 uppercase">{subtitle}</span>}
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
        <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">
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
        'font-russo pointer-events-auto w-full cursor-pointer rounded-xl py-4 text-xl tracking-[0.15em] text-white uppercase shadow-2xl transition-all duration-300 hover:-translate-y-1 active:scale-95',
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
    className="font-russo pointer-events-auto w-full cursor-pointer rounded-xl border border-white/10 bg-white/20 py-2 text-sm tracking-[0.15em] text-white uppercase transition-all duration-200 hover:bg-white/30 hover:text-white md:py-4 md:text-lg"
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
      <span>By MarvNC</span>
    </a>
  );
};

export const Menus = () => {
  const { uiState, menuIndex, setMenuIndex, endReason, gameMode } = useGameStore();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    return window.matchMedia('(pointer: coarse)').matches || hasTouchPoints;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateIsMobile = () => {
      const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
      setIsMobile(mediaQuery.matches || hasTouchPoints);
    };

    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);

    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, []);

  const isFirstRunOverlay = uiState === UIState.FIRST_RUN;

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
        isFirstRunOverlay && 'pointer-events-none',
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

      {/* FIRST RUN PROMPT */}
      {uiState === UIState.FIRST_RUN && (
        <div className="flex flex-col items-center gap-8 px-4 text-center md:gap-10">
          <FirstRunPrompt isMobile={isMobile} />
        </div>
      )}

      {/* MAIN MENU */}
      {uiState === UIState.MENU && (
        <div className="flex flex-col items-center gap-2">
          <GameLogo className="md:mb-4" />
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
        </div>
      )}

      {/* PAUSE MENU */}
      {uiState === UIState.PAUSED && (
        <div className="flex flex-col items-center justify-center p-4">
          <div
            className="pointer-events-auto flex w-full max-w-sm min-w-[320px] flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl md:min-w-[400px]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="text-center text-3xl font-bold tracking-[0.2em] text-white uppercase drop-shadow-md">
              Paused
            </h2>

            <div className="flex flex-col gap-3">
              {getPauseMenuItems(gameMode).map((item, idx) => {
                const isSelected = menuIndex === idx;
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleMenuClick(idx)}
                    className={clsx(
                      'flex w-full items-center justify-center gap-3 rounded-xl border py-4 text-sm font-bold tracking-[0.15em] uppercase transition-all duration-200',
                      isSelected
                        ? 'scale-105 border-white bg-white text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <MenuFooter />
        </div>
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
