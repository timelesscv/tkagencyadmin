import React from 'react';
import { SeasonalTheme } from '../utils/seasonalTheme';

interface SeasonalLogoProps {
  theme: SeasonalTheme;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitleBadge?: boolean;
}

/**
 * Seasonal vector accents custom tailored for the TK AGENCY typography logo.
 */
export const SeasonalLogo: React.FC<SeasonalLogoProps> = ({
  theme,
  className = '',
  size = 'md',
  showSubtitleBadge = false,
}) => {
  const isSmall = size === 'sm';
  const textSizeClass = isSmall ? 'text-lg' : 'text-xl md:text-2xl';
  const dotSizeClass = isSmall ? 'text-xl' : 'text-2xl md:text-3xl';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* 1. CHRISTMAS / GENNA: Santa Hat tilted naturally onto the letter "T" */}
      {theme === 'christmas' && (
        <svg
          viewBox="0 0 44 32"
          className={`absolute pointer-events-none z-20 transition-all duration-300 ${
            size === 'sm'
              ? '-top-2 -left-1.5 w-6 h-5'
              : size === 'lg'
              ? '-top-3.5 -left-2 w-9 h-7'
              : '-top-2.5 -left-2 w-7.5 h-6'
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="santaRedGrad" x1="10" y1="4" x2="36" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="35%" stopColor="#ef4444" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            <radialGradient id="pomPomGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="65%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </radialGradient>
            <filter id="hatShadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#000000" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Solid Red Velvet Cap - curving smoothly from brim to crown and folding to left */}
          <path
            d="M 12 23 C 10 22, 7 20, 5 19 C 9 9, 16 3, 24 3 C 32 3, 36 12, 37 23 Z"
            fill="url(#santaRedGrad)"
          />

          {/* Fold shadow crease on left */}
          <path
            d="M 5 19 C 9 20, 13 21, 15 22 C 12 17, 8 13, 5 19 Z"
            fill="#7f1d1d"
            opacity="0.4"
          />

          {/* Velvet highlight along top curved crest */}
          <path
            d="M 18 5 C 23 4, 29 5, 33 11"
            stroke="#fca5a5"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* White Fur Pom-Pom ball at drooping tip */}
          <circle cx="4.5" cy="19.5" r="4" fill="url(#pomPomGrad)" filter="url(#hatShadow)" />
          <circle cx="3.8" cy="18.8" r="1.2" fill="#ffffff" opacity="0.85" />

          {/* Fluffy White Brim Band resting directly onto the letter T */}
          <g filter="url(#hatShadow)">
            <rect
              x="10"
              y="22"
              width="28"
              height="7.5"
              rx="3.75"
              fill="url(#pomPomGrad)"
            />
            {/* Fur puffs for plush texture */}
            <circle cx="14" cy="25.5" r="3.2" fill="#ffffff" />
            <circle cx="19" cy="25.5" r="3.4" fill="#ffffff" />
            <circle cx="24" cy="25.5" r="3.5" fill="#ffffff" />
            <circle cx="29" cy="25.5" r="3.4" fill="#ffffff" />
            <circle cx="34" cy="25.5" r="3.2" fill="#ffffff" />
          </g>
        </svg>
      )}

      {/* 2. ENKUTATASH: Adey Abeba / Sunflowers crowning the letters */}
      {theme === 'enkutatash' && (
        <svg
          viewBox="0 0 90 40"
          className={`absolute pointer-events-none z-20 drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)] ${
            isSmall
              ? '-top-3.5 -left-1.5 w-16 h-7'
              : '-top-4 -left-2 w-20 h-8'
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="petalGrad1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
            <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <radialGradient id="centerGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#92400e" />
              <stop offset="60%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#451a03" />
            </radialGradient>
          </defs>

          {/* Green leaves arching beneath */}
          <path d="M 12 25 C 6 22, 6 15, 14 18 C 12 21, 14 24, 12 25 Z" fill="url(#leafGrad)" />
          <path d="M 48 24 C 54 21, 56 14, 46 17 C 48 20, 47 23, 48 24 Z" fill="url(#leafGrad)" />
          <path d="M 32 12 C 34 5, 40 4, 38 10 Z" fill="url(#leafGrad)" />

          {/* Left Sunflower (over 'T') */}
          <g transform="translate(18, 20)">
            {/* 8 radiant petals */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <ellipse
                key={i}
                cx="0"
                cy="-7"
                rx="2.4"
                ry="5"
                fill="url(#petalGrad1)"
                transform={`rotate(${angle})`}
              />
            ))}
            {/* Flower center */}
            <circle cx="0" cy="0" r="4.2" fill="url(#centerGrad)" stroke="#b45309" strokeWidth="0.5" />
            <circle cx="-1" cy="-1" r="1.2" fill="#fbbf24" opacity="0.6" />
          </g>

          {/* Middle Main Adey Abeba (center crown) */}
          <g transform="translate(34, 16) scale(1.15)">
            {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((angle, i) => (
              <ellipse
                key={i}
                cx="0"
                cy="-8"
                rx="2.6"
                ry="5.8"
                fill="url(#petalGrad1)"
                transform={`rotate(${angle})`}
              />
            ))}
            <circle cx="0" cy="0" r="4.8" fill="url(#centerGrad)" stroke="#b45309" strokeWidth="0.6" />
            <circle cx="-1.2" cy="-1.2" r="1.5" fill="#fef08a" opacity="0.7" />
          </g>

          {/* Right Sunflower (over 'K') */}
          <g transform="translate(48, 21) scale(0.9)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <ellipse
                key={i}
                cx="0"
                cy="-7"
                rx="2.4"
                ry="4.8"
                fill="url(#petalGrad1)"
                transform={`rotate(${angle})`}
              />
            ))}
            <circle cx="0" cy="0" r="4.2" fill="url(#centerGrad)" stroke="#b45309" strokeWidth="0.5" />
          </g>
        </svg>
      )}

      {/* 3. NEW YEAR: Festive Confetti & Sparkles */}
      {theme === 'new_year' && (
        <svg
          viewBox="0 0 160 55"
          className={`absolute pointer-events-none z-20 ${
            isSmall
              ? '-top-3.5 -left-3 w-40 h-12'
              : '-top-4 -left-4 w-48 h-14'
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Confetti Ribbons & Streamers */}
          {/* Cyan streamer */}
          <path d="M 4 22 Q 10 14, 16 18 T 24 14" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9" />
          {/* Gold streamer */}
          <path d="M 125 12 Q 134 8, 142 16 T 152 10" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9" />
          {/* Pink streamer */}
          <path d="M 28 8 Q 34 2, 42 6" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85" />
          
          {/* Colorful floating confetti bits */}
          <rect x="8" y="8" width="4.5" height="2.2" rx="0.5" fill="#facc15" transform="rotate(-25 8 8)" />
          <rect x="18" y="4" width="3.5" height="2" rx="0.5" fill="#3b82f6" transform="rotate(35 18 4)" />
          <rect x="36" y="2" width="4" height="2.2" rx="0.5" fill="#ec4899" transform="rotate(-15 36 2)" />
          <rect x="52" y="5" width="4" height="2" rx="0.5" fill="#10b981" transform="rotate(40 52 5)" />
          <rect x="82" y="3" width="3.8" height="2" rx="0.5" fill="#f59e0b" transform="rotate(-30 82 3)" />
          <rect x="110" y="4" width="4" height="2.2" rx="0.5" fill="#a855f7" transform="rotate(20 110 4)" />
          <rect x="135" y="22" width="4" height="2" rx="0.5" fill="#ec4899" transform="rotate(-45 135 22)" />
          <rect x="145" y="28" width="3.5" height="2" rx="0.5" fill="#06b6d4" transform="rotate(15 145 28)" />

          {/* Sparkle Glints (Stars) */}
          {/* Gold Star near T */}
          <path d="M 2 12 Q 4 12, 4 9 Q 4 12, 6 12 Q 4 12, 4 15 Q 4 12, 2 12 Z" fill="#fbbf24" />
          {/* Bright Star between letters */}
          <path d="M 44 4 Q 46 4, 46 1 Q 46 4, 48 4 Q 46 4, 46 7 Q 46 4, 44 4 Z" fill="#ffffff" />
          {/* Sparkle Star near the pink dot */}
          <path d="M 148 18 Q 150 18, 150 15 Q 150 18, 152 18 Q 150 18, 150 21 Q 150 18, 148 18 Z" fill="#f43f5e" />
          <circle cx="140" cy="14" r="1.2" fill="#facc15" />
          <circle cx="12" cy="18" r="1.2" fill="#38bdf8" />
        </svg>
      )}

      {/* 4. FASIKA (EASTER): Pastel Eggs & Spring Sprout nestled at base of TK */}
      {theme === 'fasika' && (
        <svg
          viewBox="0 0 70 38"
          className={`absolute pointer-events-none z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
            isSmall
              ? '-bottom-1.5 -left-1 w-14 h-7'
              : '-bottom-2 -left-1.5 w-16 h-8'
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="eggPink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
            <linearGradient id="eggBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
            <linearGradient id="eggYellow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>

          {/* Tiny spring grass sprigs under eggs */}
          <path d="M 4 34 C 8 28, 7 24, 6 22 C 8 26, 12 28, 14 34 Z" fill="#22c55e" />
          <path d="M 12 34 C 15 27, 18 23, 17 20 C 18 25, 21 28, 23 34 Z" fill="#4ade80" />
          <path d="M 22 34 C 25 28, 28 25, 30 23 C 29 27, 31 31, 32 34 Z" fill="#16a34a" />

          {/* Left Egg (Pink with decorative wave) */}
          <g transform="translate(10, 24) rotate(-14)">
            <ellipse cx="0" cy="0" rx="5.2" ry="7.2" fill="url(#eggPink)" />
            {/* Decorative zig-zag band */}
            <path d="M -4.5 0 Q -2 -2, 0 0 T 4.5 0" stroke="#ffffff" strokeWidth="1.2" fill="none" opacity="0.8" />
            <circle cx="-1.5" cy="-3.5" r="0.9" fill="#ffffff" opacity="0.75" />
          </g>

          {/* Right Egg (Golden Pastel) */}
          <g transform="translate(24, 25) rotate(16)">
            <ellipse cx="0" cy="0" rx="5" ry="7" fill="url(#eggYellow)" />
            <path d="M -4 0 L 4 0" stroke="#ffffff" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.8" />
            <circle cx="1.2" cy="-3" r="0.9" fill="#ffffff" opacity="0.7" />
          </g>

          {/* Center Egg (Cyan Mint - in front) */}
          <g transform="translate(17, 23) rotate(2)">
            <ellipse cx="0" cy="0" rx="5.8" ry="7.8" fill="url(#eggBlue)" stroke="#ffffff" strokeWidth="0.4" />
            {/* White polka dots */}
            <circle cx="-2" cy="-2" r="1" fill="#ffffff" opacity="0.85" />
            <circle cx="2" cy="1" r="1" fill="#ffffff" opacity="0.85" />
            <circle cx="-1" cy="3.5" r="0.8" fill="#ffffff" opacity="0.85" />
            <circle cx="1.8" cy="-4" r="0.7" fill="#ffffff" opacity="0.85" />
          </g>
        </svg>
      )}

      {/* Primary Brand Typography */}
      <span className={`font-black tracking-tight text-white flex items-center relative z-10 ${textSizeClass}`}>
        TK AGENCY
        <span className={`text-pink-500 font-extrabold leading-none transition-colors ${dotSizeClass}`}>
          .
        </span>
      </span>

      {/* Optional seasonal indicator pill (shown when configured in settings or hover) */}
      {showSubtitleBadge && theme !== 'standard' && (
        <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-400 border border-pink-500/25">
          {theme === 'christmas' && '🎄 Holiday'}
          {theme === 'new_year' && '🎉 New Year'}
          {theme === 'enkutatash' && '🌸 Enkutatash'}
          {theme === 'fasika' && '🥚 Fasika'}
        </span>
      )}
    </div>
  );
};
