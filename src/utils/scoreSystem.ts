import { SPRINT_CONFIG } from '../config/GameConfig';
import type { Difficulty, GameMode } from '../ui/store';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

const SPRINT_GRADE_THRESHOLDS: Record<Exclude<Grade, 'D'>, number> = {
  S: 110,
  A: 140,
  B: 170,
  C: 210,
};

type PersonalBestContext = {
  mode: GameMode;
  difficulty: Difficulty;
  slopeAngle: number;
};

type PersonalBestOptions = {
  includeLegacy?: boolean;
  betterIsLower?: boolean;
};

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeSlopeAngle = (slopeAngle: number) =>
  Math.round(Math.max(0, Math.min(90, slopeAngle)));

const getPBKey = ({ mode, difficulty, slopeAngle }: PersonalBestContext) =>
  `rss_pb_${mode.toLowerCase()}_${difficulty.toLowerCase()}_slope${normalizeSlopeAngle(slopeAngle)}`;

const getLegacyPBKey = (mode: GameMode) => `rss_pb_${mode.toLowerCase()}`;

const prefersLowerScore = (mode: GameMode) => mode === 'SPRINT';

export const calculateGrade = (timeSeconds: number, penalties: number): Grade => {
  const penaltyWeightSeconds = SPRINT_CONFIG.penaltySeconds * 0.5;
  const adjustedScore = timeSeconds + penalties * penaltyWeightSeconds;

  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.S) return 'S';
  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.A) return 'A';
  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.B) return 'B';
  if (adjustedScore <= SPRINT_GRADE_THRESHOLDS.C) return 'C';
  return 'D';
};

export const savePersonalBest = (
  context: PersonalBestContext,
  value: number,
  options: Pick<PersonalBestOptions, 'betterIsLower'> = {}
): boolean => {
  const storage = getStorage();
  if (!storage) return false;

  const key = getPBKey(context);
  let currentScore: number | null = null;
  try {
    const currentValue = storage.getItem(key);
    currentScore = currentValue ? Number.parseFloat(currentValue) : null;
  } catch {
    return false;
  }

  const betterIsLower = options.betterIsLower ?? prefersLowerScore(context.mode);
  const isBetter =
    currentScore === null ? true : betterIsLower ? value < currentScore : value > currentScore;

  if (isBetter) {
    try {
      storage.setItem(key, value.toString());
      return true;
    } catch {
      return false;
    }
  }

  return false;
};

export const getPersonalBest = (
  context: PersonalBestContext,
  options: PersonalBestOptions = {}
): number | null => {
  const storage = getStorage();
  if (!storage) return null;

  const readScore = (key: string): number | null => {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return null;
    }

    if (!raw) return null;

    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const scopedScore = readScore(getPBKey(context));
  if (scopedScore !== null) return scopedScore;

  if (options.includeLegacy) {
    return readScore(getLegacyPBKey(context.mode));
  }

  return null;
};
