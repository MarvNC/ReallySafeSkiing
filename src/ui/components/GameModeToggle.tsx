import clsx from 'clsx';
import { Coins, Flame, Infinity as InfinityIcon, Sparkles } from 'lucide-react';

import { useGameStore } from '../store';

const MODES: Array<{
  key: 'SPRINT' | 'ARCADE' | 'ZEN';
  label: string;
  icon: typeof Flame;
  accent: string;
}> = [
  { key: 'SPRINT', label: 'Sprint', icon: Flame, accent: 'from-orange-400 to-red-500' },
  { key: 'ARCADE', label: 'Arcade', icon: Coins, accent: 'from-amber-300 to-amber-500' },
  { key: 'ZEN', label: 'Zen', icon: InfinityIcon, accent: 'from-cyan-300 to-blue-500' },
];

export const GameModeToggle = () => {
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const activeIndex = MODES.findIndex((mode) => mode.key === gameMode);

  return (
    <div className="group relative w-full">
      <div className="relative flex h-14 w-full items-stretch overflow-hidden rounded-full border border-white/10 bg-slate-900/60 shadow-inner shadow-black/30 backdrop-blur">
        <div
          className={clsx(
            'absolute top-1 bottom-1 w-1/3 rounded-full bg-gradient-to-br transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            MODES[activeIndex]?.accent ?? 'from-orange-400 to-red-500'
          )}
          style={{
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/15" />
        </div>

        {MODES.map((mode) => {
          const Icon = mode.icon ?? Sparkles;
          const isActive = mode.key === gameMode;
          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => setGameMode(mode.key)}
              className={clsx(
                'relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full text-xs font-bold tracking-[0.18em] uppercase transition-all duration-300',
                isActive
                  ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                  : 'text-white/50 hover:text-white'
              )}
            >
              <Icon
                className={clsx(
                  'h-4 w-4 transition-transform',
                  isActive ? 'scale-110' : 'scale-95'
                )}
              />
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
