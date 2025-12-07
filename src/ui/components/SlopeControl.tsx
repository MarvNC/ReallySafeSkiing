import type React from 'react';
import { useRef } from 'react';

import { useGameStore } from '../store';

const clampAngle = (angle: number) => Math.max(0, Math.min(70, angle));

export const SlopeControl = () => {
  const { slopeAngle, setSlopeAngle } = useGameStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);

  const width = 260;
  const height = 150;
  const baseX = 20;
  const baseY = height - 18;
  const lineLength = 170;

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const anchorX = rect.left + baseX;
    const anchorY = rect.top + baseY;
    const dx = clientX - anchorX;
    const dy = anchorY - clientY; // invert Y (screen coords)
    const angleRad = Math.atan2(Math.max(dy, 0), Math.max(dx, 0.001));
    const angleDeg = clampAngle((angleRad * 180) / Math.PI);
    setSlopeAngle(angleDeg);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current && event.buttons === 0) return;
    if (event.buttons === 0) return;
    event.stopPropagation();
    isDraggingRef.current = true;
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = false;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const angleRad = (slopeAngle * Math.PI) / 180;
  const endX = baseX + Math.cos(angleRad) * lineLength;
  const endY = baseY - Math.sin(angleRad) * lineLength;
  const markerX = endX + Math.cos(angleRad) * 14;
  const markerY = endY - Math.sin(angleRad) * 14;
  const slopeColor = `hsl(${120 - (slopeAngle / 70) * 120}, 80%, 60%)`;

  return (
    <div className="select-none text-white">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/70">
        <span>Adjust slope</span>
        <span className="text-base font-semibold text-white">{Math.round(slopeAngle)}°</span>
      </div>
      <svg
        ref={svgRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={70}
        aria-valuenow={Math.round(slopeAngle)}
        aria-label="Slope angle"
        width={width}
        height={height}
        className="w-full cursor-pointer"
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
        <rect x={0} y={0} width={width} height={height} rx={12} fill="url(#slope-bg)" />
        <line
          x1={baseX}
          y1={baseY}
          x2={width - 10}
          y2={baseY}
          stroke="#6b7280"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={baseX}
          y1={baseY}
          x2={endX}
          y2={endY}
          stroke={slopeColor}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={endX} cy={endY} r={6} fill={slopeColor} stroke="#fff" strokeWidth={1.5} />
        <text
          x={markerX}
          y={markerY}
          className="pointer-events-none"
          fill="#fff"
          fontSize="12"
          fontWeight="700"
        >
          {Math.round(slopeAngle)}°
        </text>
      </svg>
      <p className="mt-2 text-xs text-white/60">Drag the line to pick 0°–70°.</p>
    </div>
  );
};
