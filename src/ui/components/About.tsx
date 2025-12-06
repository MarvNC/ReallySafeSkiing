import { useGameStore, UIState } from '../store';

export const About = () => {
  const { uiState } = useGameStore();

  if (uiState !== UIState.ABOUT) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-sky-dark/90 backdrop-blur-lg font-russo text-white z-50 pointer-events-auto">
      <h1 className="text-7xl italic mb-5 drop-shadow-lg">SYSTEM INFO</h1>

      <div className="bg-black/50 border-2 border-sky rounded-md p-10 text-center shadow-[0_0_20px_rgba(135,206,235,0.2)] max-w-2xl mb-10 transform -skew-x-3">
        <div className="transform skew-x-3">
          <div className="font-russo text-3xl text-white mb-5 tracking-wider shadow-[2px_2px_0px_#ff6b35]">
            Really Safe Skiing
          </div>

          <span className="block text-xs text-accent-orange tracking-[3px] mb-2.5 font-bold">
            Powered By
          </span>

          <div className="flex justify-center gap-4 mb-8 flex-wrap">
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
                className="bg-sky/10 border border-sky text-sky px-2.5 py-1.5 text-sm font-bold hover:bg-sky hover:text-black transition-colors"
              >
                {tech.name}
              </a>
            ))}
          </div>

          <div className="border-t border-white/20 pt-5 font-russo text-white text-lg">
            CREATED BY{' '}
            <a
              href="https://github.com/MarvNC"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-orange hover:bg-accent-orange hover:text-black transition-all px-1.5 py-0.5 relative hover:shadow-[0_0_15px_#ff6b35]"
            >
              MarvNC
            </a>
          </div>
        </div>
      </div>

      <div className="animate-blink text-base text-sky font-russo uppercase opacity-80">
        PRESS ESC TO RETURN
      </div>
    </div>
  );
};
