import { SPRINT_CONFIG } from '../config/GameConfig';
import type { GameMode } from '../ui/store';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

const SPRINT_GRADE_THRESHOLDS: Record<Exclude<Grade, 'D'>, number> = {
  S: 110,
  A: 140,
  B: 170,
  C: 210,
};

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getPBKey = (mode: GameMode) => `rss_pb_${mode.toLowerCase()}`;

export const calculateGrade = (timeSeconds: number, penalties: number): Grade => {
  const penaltyWeightSeconds = SPRINT_CONFIG.PENALTY_SECONDS * 0.5;
  const adjustedScore = timeSeconds + penalties * penaltyWeightSeconds;

  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.S) return 'S';
  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.A) return 'A';
  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.B) return 'B';
  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.C) return 'C';
  return 'D';
};

export const savePersonalBest = (mode: GameMode, score: number, betterIsLower = true): boolean => {
  const storage = getStorage();
  if (!storage) return false;

  const key = getPBKey(mode);
  let currentScore: number | null = null;
  try {
    const currentValue = storage.getItem(key);
    currentScore = currentValue ? Number.parseFloat(currentValue) : null;
  } catch {
    return false;
  }

  const isBetter =
    currentScore === null ? true : betterIsLower ? score < currentScore : score > currentScore;

  if (isBetter) {
    try {
      storage.setItem(key, score.toString());
      return true;
    } catch {
      return false;
    }
  }

  return false;
};

export const getPersonalBest = (mode: GameMode): number | null => {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(getPBKey(mode));
  } catch {
    return null;
  }

  if (!raw) return null;

  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
};
