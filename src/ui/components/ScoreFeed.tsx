import clsx from 'clsx';

import { useGameStore } from '../store';

const palette = {
  coin: {
    text: 'text-amber-200',
    tag: 'bg-amber-500/20 border-amber-300/70 text-amber-100',
    glow: 'drop-shadow-[0_0_20px_rgba(251,191,36,0.45)]',
  },
  airtime: {
    text: 'text-cyan-200',
    tag: 'bg-cyan-500/15 border-cyan-300/60 text-cyan-50',
    glow: 'drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]',
  },
  trick: {
    text: 'text-fuchsia-200',
    tag: 'bg-fuchsia-500/20 border-fuchsia-300/60 text-fuchsia-50',
    glow: 'drop-shadow-[0_0_18px_rgba(217,70,239,0.45)]',
  },
} as const;

export const ScoreFeed = () => {
  const { scorePopups } = useGameStore();

  if (!scorePopups.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-2">
      {scorePopups.map((popup) => {
        const colors = palette[popup.type];
        return (
          <div
            key={popup.id}
            className="pointer-events-none"
            style={{ animation: 'scoreFloat 1.5s ease-out forwards' }}
          >
            <div
              className={clsx(
                'flex items-baseline gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md',
                'border-white/10 bg-black/50 shadow-[0_8px_30px_rgba(0,0,0,0.45)]',
                'font-russo uppercase',
                colors.glow
              )}
            >
              <span
                className={clsx('text-4xl font-black tracking-[0.08em] sm:text-5xl', colors.text)}
              >
                {popup.text}
              </span>
              <span
                className={clsx(
                  'rounded-full border px-3 py-1 text-lg font-semibold tracking-wide sm:text-xl',
                  'shadow-[0_0_14px_rgba(0,0,0,0.35)]',
                  colors.tag
                )}
              >
                x{popup.multiplier.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
