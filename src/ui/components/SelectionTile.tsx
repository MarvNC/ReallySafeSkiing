import clsx from 'clsx';
import type { ReactNode } from 'react';

type SelectionTileProps = {
  active?: boolean;
  label: string;
  helperText?: string;
  badge?: string | number;
  glowClass?: string;
  onClick?: () => void;
  icon: ReactNode;
  iconWrapperClassName?: string;
  className?: string;
};

export const SelectionTile = ({
  active = false,
  label,
  helperText,
  badge,
  glowClass,
  onClick,
  icon,
  iconWrapperClassName = 'h-12 w-12',
  className,
}: SelectionTileProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 bg-white/5 p-3 transition-all duration-200 hover:bg-white/10 active:scale-95',
        active
          ? clsx('border-white/90 text-white shadow-[0_0_18px_rgba(255,255,255,0.22)]', glowClass)
          : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white/80',
        className
      )}
      aria-pressed={active}
    >
      <div
        className={clsx(
          'flex items-center justify-center rounded-lg border border-white/15 bg-white/10 p-2 transition-all duration-200 group-hover:scale-110',
          iconWrapperClassName,
          active && 'border-white/60 bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.25)]'
        )}
      >
        {icon}
      </div>

      <span className="text-center text-xs leading-none font-bold tracking-wider">{label}</span>
      {helperText && (
        <span className="text-[10px] leading-tight font-semibold tracking-[0.24em] text-white/45">
          {helperText}
        </span>
      )}

      {badge !== undefined && (
        <div
          className={clsx(
            'absolute top-1 right-2 font-mono text-[10px] font-bold text-white/80 opacity-0 transition-opacity group-hover:opacity-100',
            active && 'opacity-100'
          )}
        >
          {badge}
        </div>
      )}
    </button>
  );
};
