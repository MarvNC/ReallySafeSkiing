import './style.css';

import { createRoot } from 'react-dom/client';

import { GameApp } from './GameApp';
import { UIOverlay } from './ui/components/UIOverlay';

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

// 3. Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// 4. Start Game Logic
const game = new GameApp(appElement);
game.init().catch((error) => {
  console.error('Failed to start game', error);
});
