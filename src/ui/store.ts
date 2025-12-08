import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export enum UIState {
  MENU,
  FIRST_RUN,
  PLAYING,
  GAME_OVER,
  PAUSED,
  ABOUT,
  CRASHED, // Add this new state
}

export type Difficulty = 'CHILL' | 'SPORT' | 'EXTREME';
export type GameMode = 'SPRINT' | 'ZEN';
export type EndReason = 'time' | 'crash' | 'manual' | 'complete';

interface GameState {
  // Game Flow
  uiState: UIState;
  endReason: EndReason | null;
  hasStartedOnce: boolean;

  // Stats (Updated every frame)
  speed: number;
  distance: number;
  timeRemaining: number;
  timeElapsed: number;
  topSpeed: number;
  penalties: number; // Number of penalties incurred (crashes)
  showPenaltyNotification: boolean; // Flag to show penalty animation

  // Menu Navigation
  menuIndex: number; // 0: Resume, 1: Restart, 2: Back to menu, 3: About

  // Gameplay customization
  slopeAngle: number;
  difficulty: Difficulty;
  gameMode: GameMode;

  // Actions (Callable from React or GameApp)
  setUIState: (state: UIState) => void;
  setEndReason: (reason: EndReason | null) => void;
  setHasStartedOnce: (started: boolean) => void;
  updateStats: (
    speed: number,
    distance: number,
    timeRemaining: number,
    timeElapsed?: number
  ) => void;
  setTopSpeed: (speed: number) => void;
  setMenuIndex: (index: number) => void;
  setSlopeAngle: (angle: number) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setGameMode: (mode: GameMode) => void;
  addPenalty: (seconds: number) => void;
  triggerPenaltyNotification: () => void;
  clearPenaltyNotification: () => void;
}

// Create store with subscription capability (useful if GameApp needs to react to UI changes)
export const useGameStore = create<GameState>()(
  subscribeWithSelector((set) => ({
    uiState: UIState.MENU,
    endReason: null,
    hasStartedOnce: false,
    speed: 0,
    distance: 0,
    timeRemaining: 60,
    timeElapsed: 0,
    topSpeed: 0,
    penalties: 0,
    showPenaltyNotification: false,
    menuIndex: 0,
    slopeAngle: 30, // default to intermediate slope
    difficulty: 'SPORT',
    gameMode: 'SPRINT',

    setUIState: (uiState) => set({ uiState }),
    setEndReason: (endReason) => set({ endReason }),
    setHasStartedOnce: (hasStartedOnce) => set({ hasStartedOnce }),
    updateStats: (speed, distance, timeRemaining, timeElapsed) =>
      set({
        speed,
        distance,
        timeRemaining,
        ...(timeElapsed !== undefined ? { timeElapsed } : {}),
      }),
    setTopSpeed: (topSpeed) => set({ topSpeed }),
    setMenuIndex: (menuIndex) => set({ menuIndex }),
    setSlopeAngle: (angle) => set({ slopeAngle: Math.max(0, Math.min(70, angle)) }),
    setDifficulty: (difficulty) => set({ difficulty }),
    setGameMode: (mode) => set({ gameMode: mode }),
    addPenalty: (seconds) =>
      set((state) => ({
        timeElapsed: state.timeElapsed + seconds,
        penalties: state.penalties + 1,
      })),
    triggerPenaltyNotification: () => set({ showPenaltyNotification: true }),
    clearPenaltyNotification: () => set({ showPenaltyNotification: false }),
  }))
);
