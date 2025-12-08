import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export enum UIState {
  MENU,
  PLAYING,
  GAME_OVER,
  PAUSED,
  ABOUT,
  CRASHED, // Add this new state
}

export type Difficulty = 'CHILL' | 'SPORT' | 'EXTREME';

interface GameState {
  // Game Flow
  uiState: UIState;

  // Stats (Updated every frame)
  speed: number;
  distance: number;
  timeRemaining: number;
  topSpeed: number;

  // Menu Navigation
  menuIndex: number; // 0: Resume, 1: Restart, 2: Back to menu, 3: About

  // Gameplay customization
  slopeAngle: number;
  difficulty: Difficulty;

  // Actions (Callable from React or GameApp)
  setUIState: (state: UIState) => void;
  updateStats: (speed: number, distance: number, time: number) => void;
  setTopSpeed: (speed: number) => void;
  setMenuIndex: (index: number) => void;
  setSlopeAngle: (angle: number) => void;
  setDifficulty: (difficulty: Difficulty) => void;
}

// Create store with subscription capability (useful if GameApp needs to react to UI changes)
export const useGameStore = create<GameState>()(
  subscribeWithSelector((set) => ({
    uiState: UIState.MENU,
    speed: 0,
    distance: 0,
    timeRemaining: 60,
    topSpeed: 0,
    menuIndex: 0,
    slopeAngle: 30, // default to intermediate slope
    difficulty: 'SPORT',

    setUIState: (uiState) => set({ uiState }),
    updateStats: (speed, distance, timeRemaining) => set({ speed, distance, timeRemaining }),
    setTopSpeed: (topSpeed) => set({ topSpeed }),
    setMenuIndex: (menuIndex) => set({ menuIndex }),
    setSlopeAngle: (angle) => set({ slopeAngle: Math.max(0, Math.min(70, angle)) }),
    setDifficulty: (difficulty) => set({ difficulty }),
  }))
);
