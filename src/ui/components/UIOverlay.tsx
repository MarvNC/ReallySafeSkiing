import { UIState, useGameStore } from '../store';
import { HUD } from './hud/HUD';
import { TopBar } from './hud/TopBar';
import { TouchControls } from './hud/TouchControls';
import { About } from './menu/About';
import { Menus } from './menu/Menus';

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
