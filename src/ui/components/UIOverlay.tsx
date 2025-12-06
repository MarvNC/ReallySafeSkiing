import { UIState, useGameStore } from '../store';
import { About } from './About';
import { HUD } from './HUD';
import { Menus } from './Menus';

export const UIOverlay = () => {
  const { uiState } = useGameStore();

  return (
    <>
      {/* HUD visible during gameplay AND crash */}
      {(uiState === UIState.PLAYING || uiState === UIState.CRASHED) && <HUD />}

      {/* Menus handle MENU, PAUSED, GAME_OVER, and CRASHED states */}
      <Menus />

      {/* About screen */}
      <About />
    </>
  );
};
