import clsx from 'clsx';

import { useGameStore } from '../store';
import { SelectionTile } from './SelectionTile';

export type SlopeLevel = {
  angle: number;
  label: string;
  glowClass: string;
  renderIcon: (isActive: boolean) => React.ReactNode;
};

export const SLOPE_LEVELS: SlopeLevel[] = [
  {
    angle: 15,
    label: 'BEGINNER',
    glowClass: 'shadow-[0_0_18px_rgba(74,222,128,0.35)]',
    renderIcon: (isActive) => (
      <div className={clsx('h-6 w-6 rounded-full bg-green-400', !isActive && 'opacity-70')} />
    ),
  },
  {
    angle: 30,
    label: 'INTERMEDIATE',
    glowClass: 'shadow-[0_0_18px_rgba(56,189,248,0.35)]',
    renderIcon: (isActive) => (
      <div className={clsx('h-6 w-6 rounded-sm bg-sky-400', !isActive && 'opacity-70')} />
    ),
  },
  {
    angle: 45,
    label: 'EXPERT',
    glowClass: 'shadow-[0_0_18px_rgba(148,163,184,0.25)]',
    renderIcon: (isActive) => (
      <div
        className={clsx('h-6 w-6 rotate-45 rounded-sm bg-slate-800', !isActive && 'opacity-70')}
      />
    ),
  },
  {
    angle: 60,
    label: 'SUICIDAL',
    glowClass: 'shadow-[0_0_18px_rgba(220,38,38,0.35)]',
    renderIcon: (isActive) => (
      <div className={clsx('flex gap-1', !isActive && 'opacity-70')}>
        <div className="border-accent-red/40 h-6 w-6 rotate-45 rounded-sm border bg-slate-950" />
        <div className="border-accent-red/40 h-6 w-6 rotate-45 rounded-sm border bg-slate-950" />
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
          <SelectionTile
            key={level.angle}
            active={isActive}
            glowClass={level.glowClass}
            label={level.label}
            badge={`${level.angle}°`}
            onClick={() => setSlopeAngle(level.angle)}
            icon={level.renderIcon(isActive)}
          />
        );
      })}
    </div>
  );
};
