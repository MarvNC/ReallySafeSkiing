import clsx from 'clsx';
import { Skull, Snowflake, Wind } from 'lucide-react';
import type { ComponentType } from 'react';

import type { Difficulty } from '../../store';
import { useGameStore } from '../../store';
import { SelectionTile } from '../common/SelectionTile';

export type DifficultyOption = {
  value: Difficulty;
  icon: ComponentType<{ className?: string }>;
  glowClass: string;
  iconClass: string;
};

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    value: 'CHILL',
    icon: Snowflake,
    glowClass: 'shadow-[0_0_18px_rgba(34,211,238,0.35)]',
    iconClass: 'text-cyan-200',
  },
  {
    value: 'SPORT',
    icon: Wind,
    glowClass: 'shadow-[0_0_18px_rgba(249,115,22,0.35)]',
    iconClass: 'text-orange-200',
  },
  {
    value: 'EXTREME',
    icon: Skull,
    glowClass: 'shadow-[0_0_18px_rgba(225,29,72,0.35)]',
    iconClass: 'text-rose-200',
  },
];

export const DifficultySelector = () => {
  const { difficulty, setDifficulty } = useGameStore();

  return (
    <div className="flex flex-col gap-4 text-white">
      <div className="grid grid-cols-3 gap-3">
        {DIFFICULTY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = difficulty === option.value;

          return (
            <SelectionTile
              key={option.value}
              active={isActive}
              glowClass={option.glowClass}
              label={option.value}
              onClick={() => {
                setDifficulty(option.value);
              }}
              icon={
                <Icon className={clsx('h-6 w-6', option.iconClass, !isActive && 'opacity-70')} />
              }
            />
          );
        })}
      </div>
    </div>
  );
};
