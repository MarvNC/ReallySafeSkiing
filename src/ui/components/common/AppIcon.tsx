import type { FC } from 'react';

export const AppIcon: FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      aria-label="Really Safe Skiing App Icon"
    >
      <defs>
        {/* Gradients for Icy Background and Mountain */}
        <linearGradient id="skyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" /> {/* sky-100 */}
          <stop offset="100%" stopColor="#38BDF8" /> {/* sky-400 */}
        </linearGradient>
        <linearGradient id="iceFacetLight" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#BAE6FD" /> {/* sky-200 */}
        </linearGradient>
        <linearGradient id="iceFacetDark" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7DD3FC" /> {/* sky-300 */}
          <stop offset="100%" stopColor="#0284C7" /> {/* sky-600 */}
        </linearGradient>

        {/* Gradients for Warning Sign */}
        <linearGradient id="warningYellow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FACC15" /> {/* yellow-400 */}
          <stop offset="100%" stopColor="#EAB308" /> {/* yellow-500 */}
        </linearGradient>
        <linearGradient id="warningOrangeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" /> {/* orange-400 */}
          <stop offset="100%" stopColor="#EA580C" /> {/* orange-600 */}
        </linearGradient>

        {/* Safety Stripe Pattern */}
        <pattern
          id="safetyStripes"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="20" height="40" transform="translate(0,0)" fill="#1c1917" opacity="0.9" />{' '}
          {/* stone-900 */}
        </pattern>

        {/* Speed Line Filter for motion blur effect */}
        <filter id="motionBlur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10 0" />
        </filter>
      </defs>

      {/* --- Background Layer --- */}
      {/* Base Sky */}
      <rect width="512" height="512" fill="url(#skyGradient)" rx="120" />

      {/* Global Skew Group for Speed Sensation */}
      <g transform="skewX(-8) translate(40, 0)">
        {/* --- Midground: Low Poly Icy Mountain --- */}
        <g opacity="0.9">
          {/* Back dark facet */}
          <polygon points="150,512 350,150 550,512" fill="url(#iceFacetDark)" />
          {/* Front light facet */}
          <polygon points="50,512 280,180 450,512" fill="url(#iceFacetLight)" />
          {/* Icy Snow ground base */}
          <polygon points="-50,520 200,450 600,480 600,600 -50,600" fill="#FFFFFF" />
          <polygon points="150,460 350,480 250,550" fill="#E0F2FE" opacity="0.5" />{' '}
          {/* Snow shadow facet */}
        </g>

        {/* --- Foreground: The Warning Sign --- */}
        <g transform="translate(256, 380) rotate(-5)">
          {/* Sign Pole stuck in snow */}
          <rect
            x="-10"
            y="0"
            width="20"
            height="140"
            fill="#78350F" /* amber-900 */
            transform="skewX(5)"
          />

          {/* The Triangle Sign */}
          <g transform="translate(0, -160)">
            {/* Orange Border Triangle */}
            <polygon points="0,-180 160,120 -160,120" fill="url(#warningOrangeBorder)" />

            {/* Inner Yellow Warning Triangle */}
            <g transform="scale(0.85) translate(0, 10)">
              {/* Yellow base */}
              <polygon points="0,-180 160,120 -160,120" fill="url(#warningYellow)" />
              {/* Black stripes overlay using mix-blend-mode for texture */}
              <polygon
                points="0,-180 160,120 -160,120"
                fill="url(#safetyStripes)"
                style={{ mixBlendMode: 'overlay' }}
                opacity="0.4"
              />

              {/* The Skier Silhouette Icon */}
              <g transform="translate(0, -20) scale(0.5)" fill="#1c1917">
                {/* Head */}
                <circle cx="40" cy="-60" r="25" />
                {/* Body Tuck pose */}
                <path d="M20,-30 L-40,0 L-70,60 L-20,80 L60,20 Z" />
                {/* Skis */}
                <path d="M-120,100 L120,40 L130,55 L-110,115 Z" transform="rotate(-15)" />
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* --- Foreground Overlays: Speed Effects --- */}
      {/* Subtle Speed Streaks */}
      <g opacity="0.3" fill="#FFFFFF">
        <rect x="50" y="100" width="400" height="4" transform="skewX(-45)" />
        <rect x="150" y="300" width="300" height="8" transform="skewX(-45)" />
        <rect x="-50" y="450" width="500" height="6" transform="skewX(-45)" />
      </g>

      {/* Motion Blur overlay on edges to enhance speed feel */}
      <rect
        width="512"
        height="512"
        fill="url(#skyGradient)"
        opacity="0.2"
        filter="url(#motionBlur)"
        style={{ mixBlendMode: 'overlay' }}
      />

      {/* Glossy rounded corner highlight */}
      <rect
        width="512"
        height="512"
        rx="120"
        fill="none"
        stroke="white"
        strokeWidth="8"
        opacity="0.3"
      />
    </svg>
  );
};
