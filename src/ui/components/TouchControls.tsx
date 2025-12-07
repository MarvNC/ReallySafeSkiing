import clsx from 'clsx';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';

const SteerButton = ({
  action,
  direction,
  className,
}: {
  action: Action;
  direction: 'left' | 'right';
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
        'font-russo flex h-24 w-24 items-center justify-center text-white shadow-lg',
        className
      )}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      // Add touch handlers specifically for mobile reliability
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
    >
      {/* Solid filled triangle */}
      <div
        className={clsx(
          'h-0 w-0',
          direction === 'left'
            ? 'border-y-[15px] border-r-[20px] border-y-transparent border-r-white'
            : 'border-y-[15px] border-l-[20px] border-y-transparent border-l-white'
        )}
      />
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
      <div className="pointer-events-auto absolute bottom-32 left-8 z-40 md:hidden">
        <SteerButton action={Action.SteerLeft} direction="left" />
      </div>

      <div className="pointer-events-auto absolute right-8 bottom-32 z-40 md:hidden">
        <SteerButton action={Action.SteerRight} direction="right" />
      </div>
    </>
  );
};
