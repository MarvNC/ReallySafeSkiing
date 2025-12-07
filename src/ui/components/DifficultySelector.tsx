import clsx from 'clsx';
import { Skull, Snowflake, Wind } from 'lucide-react';
import type { ComponentType } from 'react';

import type { Difficulty } from '../store';
import { useGameStore } from '../store';

const OPTIONS: Array<{
  value: Difficulty;
  icon: ComponentType<{ className?: string }>;
  selectedClasses: string;
}> = [
  {
    value: 'CHILL',
    icon: Snowflake,
    selectedClasses:
      'border-cyan-400 text-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.45)]',
  },
  {
    value: 'SPORT',
    icon: Wind,
    selectedClasses:
      'border-orange-500 text-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.45)]',
  },
  {
    value: 'EXTREME',
    icon: Skull,
    selectedClasses:
      'border-rose-600 text-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(225,29,72,0.45)]',
  },
];

export const DifficultySelector = () => {
  const { difficulty, setDifficulty } = useGameStore();

  return (
    <div className="flex flex-col gap-4 text-white">
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = difficulty === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={clsx(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center text-sm font-semibold drop-shadow-md transition-all duration-200',
                'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
                isActive && option.selectedClasses
              )}
              onClick={(e) => {
                e.stopPropagation();
                setDifficulty(option.value);
              }}
              aria-pressed={isActive}
            >
              <Icon className="h-6 w-6" />
              <span>{option.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
