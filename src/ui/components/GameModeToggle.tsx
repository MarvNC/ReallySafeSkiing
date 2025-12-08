import clsx from 'clsx';
import { Flame, Infinity as InfinityIcon } from 'lucide-react';

import { useGameStore } from '../store';

export const GameModeToggle = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const toggleMode = () => setGameMode(gameMode === 'SPRINT' ? 'ZEN' : 'SPRINT');

  return (
    <div className="group relative w-full">
      <div
        className={clsx(
          'absolute -inset-1 rounded-full opacity-20 blur-md transition-all duration-700',
          gameMode === 'SPRINT' ? 'bg-orange-500' : 'bg-cyan-400'
        )}
      />
      <div
        className={clsx(
          'relative flex h-12 w-full cursor-pointer items-center rounded-full border p-1 transition-colors duration-500',
          gameMode === 'SPRINT'
            ? 'border-orange-500/30 bg-orange-950/40'
            : 'border-cyan-400/30 bg-cyan-950/40'
        )}
        onClick={toggleMode}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMode();
          }
        }}
      >
        <div
          className={clsx(
            'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-lg transition-all duration-500',
            'ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            gameMode === 'SPRINT'
              ? 'left-1 translate-x-0 bg-gradient-to-br from-orange-400 to-red-600 shadow-orange-900/50'
              : 'left-1 translate-x-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-cyan-900/50'
          )}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/20" />
        </div>
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
