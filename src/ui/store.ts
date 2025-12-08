import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { ARCADE_CONFIG } from '../config/GameConfig';
import { getPersonalBest, savePersonalBest } from '../utils/scoreSystem';

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
export type GameMode = 'SPRINT' | 'ZEN' | 'ARCADE';
export type EndReason = 'time' | 'crash' | 'manual' | 'complete';

export type ScorePopup = {
  id: number;
  value: number;
  multiplier: number;
  text: string;
  type: 'coin' | 'airtime' | 'trick' | 'life';
};

type ScorePopupPayload = {
  value?: number;
  multiplier: number;
  text?: string;
  type: ScorePopup['type'];
};

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
  hudVisible: boolean; // Flag to toggle HUD visibility

  // Menu Navigation
  menuIndex: number; // 0: Resume, 1: Restart, 2: Back to menu, 3: About

  // Gameplay customization
  slopeAngle: number;
  difficulty: Difficulty;
  gameMode: GameMode;

  // Arcade mode state
  score: number;
  highScore: number;
  coins: number;
  lives: number;
  multiplier: number;
  scorePopups: ScorePopup[];

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
  resetArcadeRun: () => void;
  addScore: (amount: number) => void;
  addCoin: (amount?: number) => void;
  setMultiplier: (multiplier: number) => void;
  loseLife: (amount?: number) => void;
  setHighScore: (score: number) => void;
  addPenalty: (seconds: number) => void;
  triggerPenaltyNotification: () => void;
  clearPenaltyNotification: () => void;
  toggleHUD: () => void;
  triggerScorePopup: (payload: ScorePopupPayload) => void;
}

const ARCADE_DEFAULT_LIVES = ARCADE_CONFIG.DEFAULT_LIVES;
const ARCADE_DEFAULT_MULTIPLIER = 1;
const SCORE_POPUP_LIFETIME_MS = 1600;

const loadArcadePersonalBest = (difficulty: Difficulty, slopeAngle: number): number => {
  const context: { mode: GameMode; difficulty: Difficulty; slopeAngle: number } = {
    mode: 'ARCADE',
    difficulty,
    slopeAngle,
  };
  return getPersonalBest(context) ?? 0;
};

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
    hudVisible: true,
    menuIndex: 0,
    slopeAngle: 30, // default to intermediate slope
    difficulty: 'SPORT',
    gameMode: 'ARCADE',
    score: 0,
    highScore: loadArcadePersonalBest('SPORT', 30),
    coins: 0,
    lives: ARCADE_DEFAULT_LIVES,
    multiplier: ARCADE_DEFAULT_MULTIPLIER,
    scorePopups: [],

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
    setSlopeAngle: (angle) =>
      set((state) => {
        const nextAngle = Math.max(0, Math.min(70, angle));
        const nextHighScore =
          state.gameMode === 'ARCADE'
            ? loadArcadePersonalBest(state.difficulty, nextAngle)
            : state.highScore;
        return { slopeAngle: nextAngle, highScore: nextHighScore };
      }),
    setDifficulty: (difficulty) =>
      set((state) => ({
        difficulty,
        highScore:
          state.gameMode === 'ARCADE'
            ? loadArcadePersonalBest(difficulty, state.slopeAngle)
            : state.highScore,
      })),
    setGameMode: (mode) =>
      set((state) => ({
        gameMode: mode,
        highScore:
          mode === 'ARCADE'
            ? loadArcadePersonalBest(state.difficulty, state.slopeAngle)
            : state.highScore,
      })),
    resetArcadeRun: () =>
      set((state) => ({
        score: 0,
        coins: 0,
        lives: ARCADE_DEFAULT_LIVES,
        multiplier: ARCADE_DEFAULT_MULTIPLIER,
        highScore: state.highScore ?? 0,
      })),
    addScore: (amount) =>
      set((state) => {
        const nextScore = Math.max(0, state.score + amount);
        const newHigh = Math.max(state.highScore, nextScore);
        if (newHigh > state.highScore) {
          savePersonalBest(
            { mode: 'ARCADE', difficulty: state.difficulty, slopeAngle: state.slopeAngle },
            newHigh
          );
        }
        return {
          score: nextScore,
          highScore: newHigh,
        };
      }),
    addCoin: (amount = 1) =>
      set((state) => ({
        coins: state.coins + amount,
      })),
    setMultiplier: (multiplier) => set({ multiplier }),
    loseLife: (amount = 1) =>
      set((state) => {
        const nextLives = Math.max(0, state.lives - amount);
        return {
          lives: nextLives,
          multiplier: ARCADE_DEFAULT_MULTIPLIER,
        };
      }),
    setHighScore: (score) =>
      set((state) => {
        const newHigh = Math.max(score, state.highScore);
        if (newHigh > state.highScore) {
          savePersonalBest(
            { mode: 'ARCADE', difficulty: state.difficulty, slopeAngle: state.slopeAngle },
            newHigh
          );
        }
        return { highScore: newHigh };
      }),
    addPenalty: (seconds) =>
      set((state) => ({
        timeElapsed: state.timeElapsed + seconds,
        penalties: state.penalties + 1,
      })),
    triggerPenaltyNotification: () => set({ showPenaltyNotification: true }),
    clearPenaltyNotification: () => set({ showPenaltyNotification: false }),
    toggleHUD: () => set((state) => ({ hudVisible: !state.hudVisible })),
    triggerScorePopup: (payload) => {
      const id = Date.now() + Math.random();
      const value = payload.value ?? 0;
      const text = payload.text ?? `+${Math.round(value)}`;

      set((state) => ({
        scorePopups: [
          ...state.scorePopups,
          {
            id,
            value,
            multiplier: payload.multiplier,
            text,
            type: payload.type,
          },
        ],
      }));

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          set((state) => ({
            scorePopups: state.scorePopups.filter((popup) => popup.id !== id),
          }));
        }, SCORE_POPUP_LIFETIME_MS);
      }
    },
  }))
);
