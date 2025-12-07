import clsx from 'clsx';
import { Maximize, Minimize, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import { UIState, useGameStore } from '../store';

export const TopBar = () => {
  const { uiState } = useGameStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const togglePause = () => {
    // We simply trigger the Pause action, the GameApp handles the state logic
    InputManager.instance?.triggerAction(Action.Pause);
  };

  // Don't show in main menu (it has its own title)
  if (uiState === UIState.MENU) return null;

  const isPaused = uiState === UIState.PAUSED || uiState === UIState.ABOUT;

  return (
    <div className="md:hidden pointer-events-none absolute top-0 left-0 z-50 flex w-full items-start justify-between p-2 md:p-4">
      {/* Fullscreen Toggle */}
      <button
        onClick={toggleFullscreen}
        className={clsx(
          'pointer-events-auto rounded-lg p-2 backdrop-blur-sm transition-all hover:bg-white/20 md:p-3',
          'border border-white/30 text-white'
        )}
        aria-label="Toggle Fullscreen"
      >
        {isFullscreen ? (
          <Minimize className="h-5 w-5 md:h-6 md:w-6" />
        ) : (
          <Maximize className="h-5 w-5 md:h-6 md:w-6" />
        )}
      </button>

      {/* Pause Button */}
      {/* Hide pause button if game over or crashed to avoid confusion */}
      {uiState !== UIState.GAME_OVER && uiState !== UIState.CRASHED && (
        <button
          onClick={togglePause}
          className={clsx(
            'pointer-events-auto rounded-lg p-2 backdrop-blur-sm transition-all hover:bg-white/20 md:p-3',
            'border border-white/30 text-white'
          )}
          aria-label={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? (
            <Play className="h-5 w-5 md:h-6 md:w-6" />
          ) : (
            <Pause className="h-5 w-5 md:h-6 md:w-6" />
          )}
        </button>
      )}
    </div>
  );
};
