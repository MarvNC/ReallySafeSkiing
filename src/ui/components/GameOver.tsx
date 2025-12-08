import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Clock, MapPin, RefreshCcw, Trophy, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Action, InputManager } from '../../core/InputManager';
import {
  calculateGrade,
  getPersonalBest,
  type Grade,
  savePersonalBest,
} from '../../utils/scoreSystem';
import { Difficulty, EndReason, GameMode, useGameStore } from '../store';
import { DIFFICULTY_OPTIONS, DifficultySelector } from './DifficultySelector';
import { GameModeToggle } from './GameModeToggle';
import { SLOPE_LEVELS, SlopeControl } from './SlopeControl';

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.floor((value * 100) % 100);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(2, '0')}`;
};

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  accentClass: string;
  detail?: string;
};

const StatCard = ({ icon: Icon, label, value, accentClass, detail }: StatCardProps) => (
  <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-3 text-center shadow-inner shadow-black/30 backdrop-blur-md">
    <Icon className={clsx('h-5 w-5', accentClass)} />
    <div className="text-2xl font-black tracking-wide md:text-3xl">{value}</div>
    <div className="text-[10px] font-semibold tracking-[0.3em] text-white/70">{label}</div>
    {detail && <div className="text-xs text-white/60">{detail}</div>}
  </div>
);

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
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!showSettings) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings]);

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
        finishStats.timeElapsed,
        true
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

  const headerText = 'GAME OVER';

  const handleRestart = () => {
    InputManager.instance?.triggerAction(Action.Start);
  };

  return (
    <div className="pointer-events-auto flex w-full flex-col items-center gap-3 px-4 text-white md:px-0">
      <div className="text-center">
        <div className="mb-2 text-xs tracking-[0.5em] text-white/50">
          {finishStats.gameMode} MODE
        </div>
        <h1 className="font-russo bg-gradient-to-b from-white to-sky-200 bg-clip-text text-4xl tracking-widest text-transparent uppercase italic drop-shadow-md md:text-6xl">
          {headerText}
        </h1>
        {isCrash && finishStats.penalties > 0 && (
          <div className="mt-2 text-xs tracking-[0.4em] text-white/40 uppercase">
            {finishStats.penalties} {finishStats.penalties === 1 ? 'PENALTY' : 'PENALTIES'}
          </div>
        )}
      </div>

      <div className="pointer-events-auto relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-2xl md:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {showSettings ? (
          <div className="space-y-6">
            <div className="text-[11px] font-semibold tracking-[0.4em] text-white/60 uppercase">
              Run Settings
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
                  Game Mode
                </div>
                <GameModeToggle />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
                  Obstacle Density
                </div>
                <DifficultySelector />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
                  Steepness
                </div>
                <SlopeControl />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-semibold tracking-[0.3em] text-white/80 uppercase transition hover:bg-white/10"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {finishStats.gameMode === 'ARCADE' && (
                <div className="col-span-2 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.35em] text-amber-100/90 uppercase">
                    <Trophy className="h-4 w-4 text-amber-200" />
                    Score
                  </div>
                  <div className="text-4xl font-black tracking-[0.18em] text-white md:text-5xl">
                    {Math.floor(finishStats.score).toLocaleString()}
                  </div>
                  <div className="text-xs font-semibold tracking-[0.2em] text-white/70">
                    Best {Math.floor(finishStats.highScore).toLocaleString()}
                  </div>
                </div>
              )}
              <StatCard
                icon={Zap}
                label="TOP SPEED"
                value={`${Math.round(finishStats.topSpeed)} KM/H`}
                accentClass="text-accent-orange"
              />
              <div className="relative flex flex-col items-center justify-center rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/0 p-3 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <Clock className="text-accent-orange mb-2 h-6 w-6" />
                <div className="text-3xl font-black tracking-wide md:text-4xl">
                  {formatTime(finishStats.timeElapsed)}
                </div>
                <div className="text-[11px] tracking-[0.4em] text-white/70 uppercase">
                  Final Time
                </div>
                {personalBest && !isNewRecord && (
                  <div className="mt-2 text-xs text-white/60">PB {formatTime(personalBest)}</div>
                )}
                {isNewRecord && (
                  <div className="absolute -top-3 right-3 flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1 text-[10px] font-black text-slate-900 shadow-lg">
                    <Trophy className="h-3 w-3" />
                    NEW BEST
                  </div>
                )}
              </div>
              <StatCard
                icon={MapPin}
                label="DISTANCE"
                value={`${Math.floor(finishStats.distance)} M`}
                accentClass="text-sky-300"
              />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  {(() => {
                    const activeDifficulty = DIFFICULTY_OPTIONS.find(
                      (option) => option.value === finishStats.difficulty
                    );
                    if (!activeDifficulty) return null;
                    const Icon = activeDifficulty.icon;
                    return (
                      <>
                        <Icon className={clsx('h-5 w-5', activeDifficulty.iconClass)} />
                        <div className="text-lg font-black tracking-wide text-white">
                          {activeDifficulty.value}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  {(() => {
                    const activeSlope = getSlopeDescriptor(finishStats.slopeAngle);
                    return (
                      <>
                        <div className="flex h-8 w-8 items-center justify-center">
                          {activeSlope.renderIcon(true)}
                        </div>
                        <div>
                          <div className="text-lg font-black tracking-wide text-white">
                            {Math.round(finishStats.slopeAngle)}°
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className={clsx(
                'rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs font-semibold tracking-[0.4em] text-white/80 uppercase transition hover:bg-white/10',
                isCrash && 'text-accent-red/90'
              )}
            >
              CONFIGURE RUN
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="group from-accent-orange to-accent-red relative flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r py-4 text-lg font-black tracking-[0.3em] uppercase shadow-[0_12px_30px_rgba(249,115,22,0.45)] transition-transform hover:translate-y-[-2px] active:scale-95"
            >
              <RefreshCcw className="h-5 w-5 transition-transform group-hover:rotate-180" />
              Play Again
            </button>
            <div className="hidden text-center text-xs text-white/60 md:block">
              Press Space or Enter to restart instantly.
            </div>
          </div>
        )}

        {showGrade && !showSettings && (
          <div className="pointer-events-none absolute top-6 -right-2 rotate-12 text-8xl font-black text-white/20 md:text-[8rem]">
            {grade}
          </div>
        )}
      </div>
    </div>
  );
};
