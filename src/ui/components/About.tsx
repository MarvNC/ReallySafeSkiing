import { Github } from 'lucide-react';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';

export const About = () => {
  const { uiState } = useGameStore();

  if (uiState !== UIState.ABOUT) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop, not the content box
    if (e.target === e.currentTarget) {
      InputManager.instance?.triggerAction(Action.Pause);
    }
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.key === 'Escape' || e.target === e.currentTarget) {
        InputManager.instance?.triggerAction(Action.Pause);
      }
    }
  };

  return (
    <div
      className="bg-sky-dark/90 font-russo pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center text-white backdrop-blur-lg"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Click outside to close"
    >
      {/* <h1 className="mb-5 text-7xl italic drop-shadow-lg">SYSTEM INFO</h1> */}

      <div
        className="border-sky mb-10 max-w-2xl -skew-x-3 transform rounded-md border-2 bg-black/50 p-10 text-center shadow-[0_0_20px_rgba(135,206,235,0.2)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="skew-x-3 transform">
          <div className="font-russo mb-5 text-3xl tracking-wider text-white shadow-[2px_2px_0px_#ff6b35]">
            Really Safe Skiing
          </div>

          <span className="text-accent-orange mb-2.5 block text-xs font-bold tracking-[3px]">
            Powered By
          </span>

          <div className="mb-8 flex flex-wrap justify-center gap-4">
            {[
              { name: 'Three.js', url: 'https://threejs.org' },
              { name: 'Rapier', url: 'https://rapier.rs' },
              { name: 'TypeScript', url: 'https://www.typescriptlang.org' },
              { name: 'React', url: 'https://reactjs.org' },
              { name: 'Tailwind', url: 'https://tailwindcss.com' },
              { name: 'Zustand', url: 'https://github.com/pmndrs/zustand' },
              { name: 'Vite', url: 'https://vitejs.dev' },
              { name: 'Bun', url: 'https://bun.sh' },
            ].map((tech) => (
              <a
                key={tech.name}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sky/10 border-sky text-sky hover:bg-sky border px-2.5 py-1.5 text-sm font-bold transition-colors hover:text-black"
              >
                {tech.name}
              </a>
            ))}
          </div>

          <div className="font-russo border-t border-white/20 pt-5 text-lg text-white flex items-center justify-center gap-2">
            CREATED BY{' '}
            <a
              href="https://github.com/MarvNC"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-orange hover:bg-accent-orange relative px-1.5 py-0.5 transition-all hover:text-black hover:shadow-[0_0_15px_#ff6b35] flex items-center gap-2"
            >
              <Github className="w-5 h-5" />
              MarvNC
            </a>
          </div>
        </div>
      </div>

      <div className="animate-blink text-sky font-russo text-base uppercase opacity-80">
        PRESS ESC TO RETURN
      </div>
    </div>
  );
};
