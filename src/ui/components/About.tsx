import { Github, X } from 'lucide-react';
import React from 'react';

import { UIState, useGameStore } from '../store';
import { GameLogo } from './GameLogo';

export const About = () => {
  const { uiState, setUIState } = useGameStore();

  if (uiState !== UIState.ABOUT) return null;

  const handleClose = () => {
    setUIState(UIState.MENU);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.key === 'Escape' || e.target === e.currentTarget) {
        handleClose();
      }
    }
  };

  const techStack = [
    { name: 'Three.js', url: 'https://threejs.org' },
    { name: 'Rapier', url: 'https://rapier.rs' },
    { name: 'TypeScript', url: 'https://www.typescriptlang.org' },
    { name: 'React', url: 'https://reactjs.org' },
    { name: 'Tailwind', url: 'https://tailwindcss.com' },
    { name: 'Zustand', url: 'https://github.com/pmndrs/zustand' },
    { name: 'Vite', url: 'https://vitejs.dev' },
    { name: 'Bun', url: 'https://bun.sh' },
  ];

  return (
    <div
      className="font-russo pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 text-white backdrop-blur-md"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Click outside to close"
    >
      <div
        className="relative flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl md:max-w-xl"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <GameLogo className="scale-75 md:scale-90" />
        </div>

        <div className="flex flex-col gap-4">
          <div className="text-center">
            <h3 className="mb-4 text-sm font-bold tracking-[0.2em] text-white/50 uppercase">
              Powered By
            </h3>
            <div className="flex flex-wrap justify-center gap-2">
              {techStack.map((tech) => (
                <a
                  key={tech.name}
                  href={tech.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold tracking-wider text-white transition-all hover:bg-white/20 hover:text-sky-300 hover:shadow-[0_0_15px_rgba(135,206,235,0.2)] md:text-sm"
                >
                  {tech.name}
                </a>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="flex flex-col items-center gap-4 text-center">
            <h3 className="text-sm font-bold tracking-[0.2em] text-white/50 uppercase">
              Created By
            </h3>
            <a
              href="https://github.com/MarvNC/ReallySafeSkiing"
              target="_blank"
              rel="noopener noreferrer"
              className="group hover:border-accent-orange/50 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 py-3 transition-all hover:bg-white/10"
            >
              <Github className="group-hover:text-accent-orange h-6 w-6 text-white/70 transition-colors" />
              <span className="text-lg tracking-widest text-white group-hover:text-white">
                MarvNC
              </span>
            </a>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 py-3 text-sm tracking-[0.15em] text-white/70 uppercase transition-all hover:bg-white/20 hover:text-white"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
};
