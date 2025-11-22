import './style.css';
import { GameApp } from './GameApp';

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Missing #app container');
}

const game = new GameApp(appElement);
game.init().catch((error) => {
  console.error('Failed to start game', error);
});
