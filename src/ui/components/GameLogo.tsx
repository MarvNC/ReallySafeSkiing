import clsx from 'clsx';
import type { FC } from 'react';

export const GameLogo: FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('flex flex-col items-center justify-center p-4 select-none', className)}>
      {/* Top part: "REALLY SAFE" - stylized like a warning label tape */}
      <div className="relative z-10 -rotate-2 transform transition-transform duration-500 hover:scale-105 hover:rotate-0">
        <div className="absolute -inset-1 skew-x-[-10deg] bg-yellow-500 shadow-[4px_4px_0px_rgba(0,0,0,0.3)]" />
        <div className="absolute -inset-1 translate-x-[2px] translate-y-[2px] skew-x-[-10deg] bg-orange-600" />

        {/* Striped pattern overlay for safety tape look */}
        <div
          className="absolute -inset-1 skew-x-[-10deg] opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)',
          }}
        />

        <h2 className="font-russo relative px-4 py-1 text-2xl tracking-widest text-white uppercase italic text-shadow-sm md:text-3xl lg:text-4xl">
          Really Safe
        </h2>
      </div>

      {/* Bottom part: "SKIING" - Fast, cold, sharp */}
      <div className="relative -mt-2 transition-transform duration-500 hover:scale-105 md:-mt-4">
        {/* Speed lines effect behind */}
        <div className="absolute top-1/2 left-1/2 -z-10 h-full w-[120%] -translate-x-1/2 -translate-y-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent blur-sm" />

        <h1
          className="font-russo relative z-10 text-6xl tracking-tighter uppercase italic md:text-8xl lg:text-9xl"
          style={{
            transform: 'skewX(-10deg)',
          }}
        >
          <span
            className="bg-gradient-to-b from-white via-sky-100 to-sky-400 bg-clip-text text-transparent drop-shadow-xl"
            style={{
              filter: 'drop-shadow(0px 4px 0px rgba(0,40,80,0.4))',
            }}
          >
            Skiing
          </span>

          {/* Decorative Speed Lines */}
          <div className="absolute top-1/2 -left-8 h-[2px] w-full -skew-x-[45deg] bg-white/20" />
          <div className="absolute top-2/3 -right-8 h-[2px] w-full -skew-x-[45deg] bg-white/20" />
        </h1>

        {/* Low Poly Mountain Graphic */}
        <div className="absolute top-1/2 left-1/2 -z-20 -translate-x-1/2 -translate-y-1/2 scale-150 opacity-10">
          <svg width="200" height="100" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 0 L200 100 L0 100 Z" fill="white" />
            <path d="M100 0 L150 100 L50 100 Z" fill="#87ceeb" opacity="0.5" />
          </svg>
        </div>

        {/* Bottom Accents */}
        <div className="mt-2 flex justify-center gap-1 opacity-60">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-1 w-8 skew-x-[-45deg] bg-sky-300" />
          ))}
        </div>
      </div>
    </div>
  );
};
