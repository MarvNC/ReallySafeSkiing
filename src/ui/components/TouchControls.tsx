import { useEffect, useRef } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';

type Side = 'left' | 'right';

export const TouchControls = () => {
  const { uiState } = useGameStore();

  const pointerSides = useRef<Map<number, Side>>(new Map());
  const activeCounts = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  const setSideActive = (side: Side, active: boolean) => {
    const action = side === 'left' ? Action.SteerLeft : Action.SteerRight;
    InputManager.instance?.setExternalState(action, active);
  };

  const incrementSide = (side: Side) => {
    activeCounts.current[side] += 1;
    if (activeCounts.current[side] === 1) {
      setSideActive(side, true);
    }
  };

  const decrementSide = (side: Side) => {
    if (activeCounts.current[side] === 0) return;
    activeCounts.current[side] -= 1;
    if (activeCounts.current[side] === 0) {
      setSideActive(side, false);
    }
  };

  const getSideFromEvent = (e: React.PointerEvent<HTMLDivElement>): Side => {
    const midpoint = window.innerWidth / 2;
    return e.clientX < midpoint ? 'left' : 'right';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const side = getSideFromEvent(e);
    pointerSides.current.set(e.pointerId, side);
    incrementSide(side);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointerSides.current.get(e.pointerId);
    const current = getSideFromEvent(e);
    if (!previous) {
      pointerSides.current.set(e.pointerId, current);
      incrementSide(current);
      return;
    }

    if (previous !== current) {
      decrementSide(previous);
      pointerSides.current.set(e.pointerId, current);
      incrementSide(current);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const previous = pointerSides.current.get(e.pointerId);
    if (!previous) return;
    pointerSides.current.delete(e.pointerId);
    decrementSide(previous);
  };

  // Ensure steering is released if this component unmounts while a touch is held
  useEffect(
    () => () => {
      pointerSides.current.clear();
      activeCounts.current = { left: 0, right: 0 };
      setSideActive('left', false);
      setSideActive('right', false);
    },
    []
  );

  const shouldShow =
    uiState === UIState.PLAYING || uiState === UIState.CRASHED || uiState === UIState.FIRST_RUN;

  // Only show controls during gameplay or the first-run prompt
  if (!shouldShow) return null;

  return (
    <div className="pointer-events-none fixed top-16 right-0 bottom-0 left-0 z-40 md:hidden">
      <div
        className="pointer-events-auto absolute inset-0 touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
      />
    </div>
  );
};
