import { Minus, Plus } from 'lucide-react';
import type { MouseEvent, PointerEvent } from 'react';
import { useRef } from 'react';

import { useGameStore } from '../store';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 240;
const clampAngle = (angle: number) => Math.max(0, Math.min(70, angle));

export const SlopeControl = () => {
  const { slopeAngle, setSlopeAngle } = useGameStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);

  const width = VIEWBOX_WIDTH;
  const height = VIEWBOX_HEIGHT;
  const baseX = 28;
  const baseY = height - 26;
  const lineLength = 220;

  const handleIncrement = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSlopeAngle(clampAngle(slopeAngle + 1));
  };

  const handleDecrement = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSlopeAngle(clampAngle(slopeAngle - 1));
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;

    const anchorX = rect.left + baseX * scaleX;
    const anchorY = rect.top + baseY * scaleY;
    const dx = clientX - anchorX;
    const dy = anchorY - clientY; // invert Y (screen coords)
    const angleRad = Math.atan2(Math.max(dy, 0), Math.max(dx, 0.001));
    const angleDeg = clampAngle((angleRad * 180) / Math.PI);
    setSlopeAngle(angleDeg);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current && event.buttons === 0) return;
    if (event.buttons === 0) return;
    event.stopPropagation();
    isDraggingRef.current = true;
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = false;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const angleRad = (slopeAngle * Math.PI) / 180;
  const endX = baseX + Math.cos(angleRad) * lineLength;
  const endY = baseY - Math.sin(angleRad) * lineLength;
  const slopeColor = `hsl(${120 - (slopeAngle / 70) * 120}, 80%, 60%)`;

  return (
    <div className="w-full text-white select-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecrement}
          aria-label="Decrease slope angle"
          className="rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20 active:scale-95"
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="flex-1 rounded-xl bg-white/5 p-2 shadow-inner">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gradient-to-b from-[#0c1020]/80 to-[#0c1020]/40">
            <div className="pointer-events-none absolute top-4 right-4 z-10 text-2xl font-bold text-sky-300">
              {Math.round(slopeAngle)}°
            </div>
            <svg
              ref={svgRef}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={70}
              aria-valuenow={Math.round(slopeAngle)}
              aria-label="Slope angle"
              width="100%"
              height="100%"
              viewBox={`0 0 ${width} ${height}`}
              className="h-full w-full cursor-pointer"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <defs>
                <linearGradient id="slope-bg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0c1020" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0c1020" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <rect x={0} y={0} width={width} height={height} rx={16} fill="url(#slope-bg)" />
              <line
                x1={baseX}
                y1={baseY}
                x2={width - 10}
                y2={baseY}
                stroke="#6b7280"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <line
                x1={baseX}
                y1={baseY}
                x2={endX}
                y2={endY}
                stroke={slopeColor}
                strokeWidth={6}
                strokeLinecap="round"
              />
              <circle cx={endX} cy={endY} r={8} fill={slopeColor} stroke="#fff" strokeWidth={1.5} />
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={handleIncrement}
          aria-label="Increase slope angle"
          className="rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20 active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
