import clsx from 'clsx';

import type { Difficulty } from '../store';
import { useGameStore } from '../store';

const OPTIONS: Difficulty[] = ['CHILL', 'SPORT', 'EXTREME'];

export const DifficultySelector = () => {
  const { difficulty, setDifficulty } = useGameStore();

  return (
    <div className="flex flex-col gap-3 text-white">
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={clsx(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all duration-150',
              difficulty === option
                ? 'border-accent-orange bg-accent-orange text-black shadow-lg shadow-accent-orange/40'
                : 'border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20'
            )}
            onClick={(e) => {
              e.stopPropagation();
              setDifficulty(option);
            }}
            aria-pressed={difficulty === option}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="text-xs text-white/60">
        <span className="font-semibold text-accent-orange">Extreme</span> doubles obstacle density;
        <span className="font-semibold text-sky-200"> Chill</span> halves it.
      </div>
    </div>
  );
};
