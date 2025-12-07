import clsx from 'clsx';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';

const SteerButton = ({
  action,
  label,
  className,
}: {
  action: Action;
  label: string;
  className?: string;
}) => {
  const handleDown = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent text selection or scrolling
    InputManager.instance?.setExternalState(action, true);
  };

  const handleUp = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    InputManager.instance?.setExternalState(action, false);
  };

  return (
    <button
      className={clsx(
        'touch-none transition-transform select-none active:scale-95',
        'rounded-full border-2 border-white/50 bg-white/20 backdrop-blur-md',
        'font-russo flex h-24 w-24 items-center justify-center text-4xl text-white shadow-lg',
        className
      )}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      // Add touch handlers specifically for mobile reliability
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
    >
      {label}
    </button>
  );
};

export const TouchControls = () => {
  const { uiState } = useGameStore();

  // Only show controls during gameplay
  if (uiState !== UIState.PLAYING && uiState !== UIState.CRASHED) return null;

  return (
    <>
      {/* Mobile Steering Controls - Only visible on mobile (hidden on md and above) */}
      <div className="pointer-events-auto absolute bottom-8 left-8 z-40 md:hidden">
        <SteerButton action={Action.SteerLeft} label="←" />
      </div>

      <div className="pointer-events-auto absolute right-8 bottom-8 z-40 md:hidden">
        <SteerButton action={Action.SteerRight} label="→" />
      </div>

      {/* Brake hint (optional central area) */}
      <div className="font-russo pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50 md:hidden">
        TAP BOTH TO BRAKE
      </div>
    </>
  );
};
