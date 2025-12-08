import { UIState, useGameStore } from '../store';
import { About } from './About';
import { HUD } from './HUD';
import { Menus } from './Menus';
import { TopBar } from './TopBar';
import { TouchControls } from './TouchControls';

export const UIOverlay = () => {
  const { uiState, hudVisible } = useGameStore();

  return (
    <>
      {/* Top Bar (Pause / Fullscreen) */}
      {hudVisible && <TopBar />}

      {/* HUD visible during gameplay AND crash */}
      {hudVisible && (uiState === UIState.PLAYING || uiState === UIState.CRASHED) && <HUD />}

      {/* Mobile Controls */}
      {hudVisible && <TouchControls />}

      {/* Menus handle MENU, PAUSED, GAME_OVER, and CRASHED states */}
      <Menus />

      {/* About screen */}
      <About />
    </>
  );
};
