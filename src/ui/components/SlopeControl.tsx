import clsx from 'clsx';

import { useGameStore } from '../store';

type SlopeLevel = {
  angle: number;
  label: string;
  colorClass: string;
  glowClass: string;
  renderIcon: () => React.ReactNode;
};

const SLOPE_LEVELS: SlopeLevel[] = [
  {
    angle: 15,
    label: 'BEGINNER',
    colorClass: 'bg-green-500 border-green-400',
    glowClass: 'shadow-[0_0_20px_rgba(74,222,128,0.4)]',
    renderIcon: () => <div className="h-6 w-6 rounded-full bg-green-500" />,
  },
  {
    angle: 30,
    label: 'INTERMEDIATE',
    colorClass: 'bg-sky-500 border-sky-400',
    glowClass: 'shadow-[0_0_20px_rgba(56,189,248,0.4)]',
    renderIcon: () => <div className="h-6 w-6 rounded-sm bg-sky-500" />,
  },
  {
    angle: 45,
    label: 'EXPERT',
    colorClass: 'bg-slate-900 border-slate-600',
    glowClass: 'shadow-[0_0_20px_rgba(148,163,184,0.25)]',
    renderIcon: () => <div className="h-6 w-6 rotate-45 rounded-sm bg-black" />,
  },
  {
    angle: 60,
    label: 'SUICIDAL',
    colorClass: 'bg-slate-950 border-accent-red',
    glowClass: 'shadow-[0_0_20px_rgba(220,38,38,0.35)]',
    renderIcon: () => (
      <div className="flex gap-1">
        <div className="border-accent-red/30 h-6 w-6 rotate-45 rounded-sm border bg-black" />
        <div className="border-accent-red/30 h-6 w-6 rotate-45 rounded-sm border bg-black" />
      </div>
    ),
  },
];

export const SlopeControl = () => {
  const { slopeAngle, setSlopeAngle } = useGameStore();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SLOPE_LEVELS.map((level) => {
        // Allow small margin of error for float comparison
        const isActive = Math.abs(slopeAngle - level.angle) < 5;

        return (
          <button
            key={level.angle}
            type="button"
            onClick={() => setSlopeAngle(level.angle)}
            className={clsx(
              'group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all duration-200',
              // Base Styles
              'bg-white/5 hover:bg-white/10 active:scale-95',
              // Active State
              isActive
                ? clsx('border-white/90 text-white', level.glowClass)
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
            )}
          >
            {/* Icon Container */}
            <div className={clsx('transition-transform duration-300 group-hover:scale-110')}>
              {level.renderIcon()}
            </div>

            {/* Text Label */}
            <div className="flex flex-col items-center leading-none">
              <span className="text-xs font-bold tracking-wider">{level.label}</span>
            </div>

            {/* Angle Badge */}
            <div
              className={clsx(
                'absolute top-1 right-2 font-mono text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100',
                isActive && 'opacity-100'
              )}
            >
              {level.angle}°
            </div>
          </button>
        );
      })}
    </div>
  );
};
