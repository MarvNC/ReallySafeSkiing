import clsx from 'clsx';
import { Clock, Home, MapPin, RefreshCcw, Trophy, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import {
  calculateGrade,
  getPersonalBest,
  type Grade,
  savePersonalBest,
} from '../../utils/scoreSystem';
import { Difficulty, EndReason, GameMode, UIState, useGameStore } from '../store';
import { DIFFICULTY_OPTIONS } from './DifficultySelector';
import { SLOPE_LEVELS } from './SlopeControl';

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.floor((value * 100) % 100);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(2, '0')}`;
};

const getSlopeDescriptor = (angle: number) =>
  SLOPE_LEVELS.reduce((closest, current) => {
    const currentDiff = Math.abs(angle - current.angle);
    const closestDiff = Math.abs(angle - closest.angle);
    return currentDiff < closestDiff ? current : closest;
  });

type FinishStats = {
  gameMode: GameMode;
  timeElapsed: number;
  distance: number;
  topSpeed: number;
  penalties: number;
  endReason: EndReason | null;
  difficulty: Difficulty;
  slopeAngle: number;
  score: number;
  highScore: number;
};

type ResultMeta = {
  sprintComplete: boolean;
  grade: Grade | null;
  personalBest: number | null;
  isNewRecord: boolean;
};

export const GameOver = () => {
  const finishStatsRef = useRef<FinishStats | null>(null);
  if (!finishStatsRef.current) {
    const state = useGameStore.getState();
    finishStatsRef.current = {
      gameMode: state.gameMode,
      timeElapsed: state.timeElapsed,
      distance: state.distance,
      topSpeed: state.topSpeed,
      penalties: state.penalties,
      endReason: state.endReason,
      difficulty: state.difficulty,
      slopeAngle: state.slopeAngle,
      score: state.score,
      highScore: state.highScore,
    };
  }

  const finishStats = finishStatsRef.current!;

  const resultMetaRef = useRef<ResultMeta | null>(null);
  if (!resultMetaRef.current) {
    const sprintComplete =
      finishStats.gameMode === 'SPRINT' && finishStats.endReason === 'complete';
    const storedBest = sprintComplete
      ? getPersonalBest({
          mode: finishStats.gameMode,
          difficulty: finishStats.difficulty,
          slopeAngle: finishStats.slopeAngle,
        })
      : null;
    const newRecord =
      sprintComplete && (storedBest === null || finishStats.timeElapsed < storedBest);

    resultMetaRef.current = {
      sprintComplete,
      grade: sprintComplete ? calculateGrade(finishStats.timeElapsed, finishStats.penalties) : null,
      personalBest: sprintComplete ? (newRecord ? finishStats.timeElapsed : storedBest) : null,
      isNewRecord: Boolean(newRecord),
    };
  }

  const { sprintComplete, grade, personalBest, isNewRecord } = resultMetaRef.current!;

  const isCrash = finishStats.endReason === 'crash';
  const showGrade = sprintComplete && grade;

  useEffect(() => {
    if (sprintComplete && isNewRecord) {
      savePersonalBest(
        {
          mode: finishStats.gameMode,
          difficulty: finishStats.difficulty,
          slopeAngle: finishStats.slopeAngle,
        },
        finishStats.timeElapsed
      );
    }
  }, [
    sprintComplete,
    isNewRecord,
    finishStats.timeElapsed,
    finishStats.gameMode,
    finishStats.difficulty,
    finishStats.slopeAngle,
  ]);

  const handleRestart = () => {
    InputManager.instance?.triggerAction(Action.Start);
  };

  const handleBackToMenu = () => {
    const store = useGameStore.getState();
    store.setUIState(UIState.MENU);
    store.setEndReason(null);
    store.setMenuIndex(0);
  };

  const activeDifficulty = DIFFICULTY_OPTIONS.find(
    (option) => option.value === finishStats.difficulty
  );
  const slopeDescriptor = getSlopeDescriptor(finishStats.slopeAngle);

  const arcadeBestScore = Math.max(finishStats.highScore, finishStats.score);
  const isArcadeNewBest =
    finishStats.gameMode === 'ARCADE' &&
    finishStats.score > 0 &&
    (finishStats.highScore === 0 || finishStats.score > finishStats.highScore);

  return (
    <div className="pointer-events-auto flex w-full flex-col items-center px-4 text-white md:px-0">
      <div className="pointer-events-auto relative w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {activeDifficulty && (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/80">
                  <activeDifficulty.icon className={clsx('h-4 w-4', activeDifficulty.iconClass)} />
                  {activeDifficulty.value}
                </span>
              )}
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/80">
                <div className="flex h-4 w-4 items-center justify-center">
                  {slopeDescriptor.renderIcon(true)}
                </div>
                {Math.round(finishStats.slopeAngle)}°
              </span>
            </div>

            <button
              type="button"
              aria-label="Back to home"
              onClick={handleBackToMenu}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/30 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <div className="text-[10px] font-semibold tracking-[0.4em] text-white/50">
              {finishStats.gameMode} MODE
            </div>
            <h1 className="font-russo bg-gradient-to-b from-white to-sky-200 bg-clip-text text-4xl tracking-[0.2em] text-transparent uppercase italic drop-shadow-md md:text-6xl">
              Game Over
            </h1>
            {isCrash && finishStats.penalties > 0 && (
              <div className="text-[11px] tracking-[0.32em] text-white/45 uppercase">
                {finishStats.penalties} {finishStats.penalties === 1 ? 'Penalty' : 'Penalties'}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-inner shadow-black/20">
            {finishStats.gameMode === 'ARCADE' ? (
              <>
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-white/60 uppercase">
                  <Trophy className="h-4 w-4 text-amber-200" />
                  Score
                </div>
                <div className="flex flex-col gap-2">
                  <div className="font-mono text-5xl leading-none font-black text-white md:text-6xl">
                    {Math.floor(finishStats.score).toLocaleString()}
                  </div>
                  <div className="text-sm text-white/70">
                    Best {Math.floor(arcadeBestScore).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-white/70">
                  {isArcadeNewBest ? <span>New personal best!</span> : null}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-white/60 uppercase">
                  <Clock className="text-accent-orange h-4 w-4" />
                  Final Time
                </div>
                <div className="font-mono text-4xl leading-tight font-black text-white md:text-5xl">
                  {formatTime(finishStats.timeElapsed)}
                </div>
                <div className="text-sm text-white/70">
                  {personalBest
                    ? `Personal Best: ${formatTime(personalBest)}`
                    : 'Finish the sprint to set your first record.'}
                </div>
                {isNewRecord && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                    <Trophy className="h-4 w-4" />
                    New personal best!
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-center shadow-inner shadow-black/20">
              <div className="flex flex-col items-center gap-2">
                <Zap className="h-5 w-5 text-amber-200" />
                <div className="font-mono text-lg font-semibold">
                  {Math.round(finishStats.topSpeed)} km/h
                </div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-white/60 uppercase">
                  Speed
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Clock className="h-5 w-5 text-sky-200" />
                <div className="font-mono text-lg font-semibold">
                  {formatTime(finishStats.timeElapsed)}
                </div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-white/60 uppercase">
                  Time
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-200" />
                <div className="font-mono text-lg font-semibold">
                  {Math.floor(finishStats.distance)} m
                </div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-white/60 uppercase">
                  Distance
                </div>
              </div>
            </div>
            <div className="hidden text-center text-sm text-white/60 md:block">
              Press Space or Enter to restart instantly.
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRestart}
              className="group from-accent-orange to-accent-red flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r px-6 text-lg font-black tracking-[0.25em] uppercase shadow-[0_0px_20px_rgba(249,115,22,0.45)] transition-transform hover:translate-y-[-2px] active:scale-95"
            >
              <RefreshCcw className="h-5 w-5 transition-transform group-hover:rotate-180" />
              Play Again
            </button>
            <button
              type="button"
              onClick={handleBackToMenu}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 text-sm font-semibold tracking-[0.18em] text-white/80 uppercase transition hover:border-white/40 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </button>
          </div>
        </div>

        {showGrade && (
          <div className="pointer-events-none absolute top-6 -right-2 rotate-12 text-8xl font-black text-white/15 md:text-[8rem]">
            {grade}
          </div>
        )}
      </div>
    </div>
  );
};
