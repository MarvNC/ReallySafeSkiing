import { UIState, useGameStore } from '../store';
import { About } from './About';
import { HUD } from './HUD';
import { Menus } from './Menus';
import { TopBar } from './TopBar';
import { TouchControls } from './TouchControls';

export const UIOverlay = () => {
  const { uiState } = useGameStore();

  return (
    <>
      {/* Top Bar (Pause / Fullscreen) */}
      <TopBar />

      {/* HUD visible during gameplay AND crash */}
      {(uiState === UIState.PLAYING || uiState === UIState.CRASHED) && <HUD />}

      {/* Mobile Controls */}
      <TouchControls />

      {/* Menus handle MENU, PAUSED, GAME_OVER, and CRASHED states */}
      <Menus />

      {/* About screen */}
      <About />
    </>
  );
};
