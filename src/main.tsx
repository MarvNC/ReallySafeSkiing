import './style.css';

import { createRoot } from 'react-dom/client';

import { GameApp } from './GameApp';
import { UIOverlay } from './ui/components/UIOverlay';

// Disable Right Click Context Menu
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  return false;
});
// ---------------------------------------------

// 1. Setup DOM
const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) {
  throw new Error('Missing #app container');
}

// 2. Mount React UI
const uiLayerElement = document.getElementById('ui-layer');
if (!uiLayerElement) {
  throw new Error('Missing #ui-layer container');
}
const root = createRoot(uiLayerElement);
root.render(<UIOverlay />);

// 3. Start Game Logic
const game = new GameApp(appElement);
game.init().catch((error) => {
  console.error('Failed to start game', error);
});
