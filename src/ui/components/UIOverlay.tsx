import { useGameStore, UIState } from '../store';
import { HUD } from './HUD';
import { Menus } from './Menus';
import { About } from './About';

export const UIOverlay = () => {
  const { uiState } = useGameStore();

  return (
    <>
      {/* HUD only visible during gameplay */}
      {uiState === UIState.PLAYING && <HUD />}

      {/* Menus handle MENU, PAUSED, and GAME_OVER states */}
      <Menus />

      {/* About screen */}
      <About />
    </>
  );
};
