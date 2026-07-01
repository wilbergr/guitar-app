// Renders one string as a horizontal row of clickable fret cells in the SVG fretboard.
// stringIndex 0 = thickest/lowest string.

import { useEffect, useRef, useState } from 'react';

const FINGER_COLORS = ['#888', '#ef4444', '#22c55e', '#3b82f6', '#f97316'];

export default function GuitarString({
  stringIndex,
  stringName,
  y,
  fretXPositions,
  stringCount,
  isActive,
  selectedFret,   // fret number from chord (-1=muted, 0=open, N=fingered)
  fingerNumber,   // 1-4 or null
  isBarreString,  // this string is covered by barre
  barreFret,      // fret of the barre if applicable
  startFret,      // first fret visible in diagram
  onPluck,        // (stringIndex, fret) => void — edit mode
  pressedFret,    // user-pressed fret in learn mode (absolute fret number)
  editMode = true,
  onPlayString,   // (stringIndex) => void — play mode
  // Placement mode
  placementMode,
  placedFret,     // user-placed value
  onPlace,        // (stringIndex, fret) => void
  correctFret,    // revealed after wrong answer
}) {
  const stringThickness = 1 + ((stringCount - 1 - stringIndex) / (stringCount - 1)) * 2;
  const totalFrets = fretXPositions.length - 1;

  // Transient ripple at the tapped fret cell so taps feel responsive (esp. on
  // touch, where the string-pulse alone is easy to miss). `key` is bumped on
  // every activation to re-mount the circle and restart its CSS animation.
  const [flash, setFlash] = useState(null); // { fret, key } | null
  const flashTimer = useRef(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const triggerFlash = (fret) => {
    setFlash((prev) => ({ fret, key: (prev?.key ?? 0) + 1 }));
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 450);
  };

  // If the user has pressed any fret on this string, it overrides chord data entirely.
  const hasUserPress = pressedFret !== undefined;
  const showChordDot = !hasUserPress && selectedFret !== undefined && selectedFret > 0;
  const dotFretIndex = showChordDot ? selectedFret - startFret : -1;

  return (
    <g>
      {/* The string line */}
      <line
        className={`string-line${isActive ? ' active' : ''}`}
        x1={fretXPositions[0]}
        y1={y}
        x2={fretXPositions[totalFrets]}
        y2={y}
        style={{ stroke: isActive ? 'var(--fret-string-active)' : 'var(--fret-string)' }}
        strokeWidth={stringThickness}
      />

      {/* Clickable fret zones */}
      {Array.from({ length: totalFrets }, (_, fi) => {
        const x1 = fretXPositions[fi];
        const x2 = fretXPositions[fi + 1];
        const midX = (x1 + x2) / 2;
        const actualFret = fi + 1;

        let dotColor = null;
        let dotLabel = null;
        let pressedDotHere = false;
        // The revealed correct answer (placement mode, after a wrong submit).
        // Drawn as an outlined ring so it reads distinctly from the user's
        // solid orange placement dot without relying on color perception.
        let isCorrectMarker = false;

        if (placementMode) {
          if (placedFret === actualFret) {
            dotColor = '#f5a623';
            dotLabel = '●';
          }
          if (correctFret !== undefined && correctFret === actualFret && placedFret !== actualFret) {
            isCorrectMarker = true;
          }
        } else {
          if (dotFretIndex === fi) {
            const color = FINGER_COLORS[fingerNumber] || FINGER_COLORS[0];
            dotColor = color;
            dotLabel = fingerNumber ? String(fingerNumber) : null;
          } else if (!hasUserPress && isBarreString && barreFret !== undefined && barreFret - startFret === fi) {
            dotColor = FINGER_COLORS[1];
            dotLabel = '1';
          }
          // User-pressed fret: purple dot, replaces chord dot if at same position
          if (pressedFret !== undefined && pressedFret === actualFret) {
            pressedDotHere = true;
          }
        }

        // Whether this cell represents an active toggle (edit/placement) vs a
        // momentary play action — drives aria-pressed semantics.
        const isMomentary = !placementMode && !editMode;
        const isToggleActive = placementMode
          ? placedFret === actualFret
          : (!!editMode && pressedFret === actualFret);

        const activate = () => {
          triggerFlash(actualFret);
          if (placementMode) {
            onPlace && onPlace(stringIndex, actualFret);
          } else if (editMode) {
            onPluck && onPluck(stringIndex, actualFret);
          } else {
            onPlayString && onPlayString(stringIndex);
          }
        };

        // Decorative markers are drawn BEFORE the hit rect and made
        // pointer-transparent so a click that lands on a dot still reaches the
        // .fret-cell below it (previously the dot swallowed marker clicks).
        return (
          <g key={fi}>
            {flash && flash.fret === actualFret && (
              <circle
                key={flash.key}
                className="fret-ripple"
                cx={midX}
                cy={y}
                r={12}
              />
            )}
            {dotColor && !pressedDotHere && (
              <circle className="fret-dot" cx={midX} cy={y} r={9} fill={dotColor} opacity={0.9} />
            )}
            {dotLabel && !pressedDotHere && (
              <text
                className="fret-cell-label"
                x={midX}
                y={y + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="white"
              >
                {dotLabel}
              </text>
            )}
            {isCorrectMarker && (
              <circle
                className="fret-dot"
                cx={midX}
                cy={y}
                r={9}
                fill="none"
                stroke="#22c55e"
                strokeWidth={2.5}
                strokeDasharray="3 2"
              />
            )}
            {pressedDotHere && (
              <circle className="fret-dot" cx={midX} cy={y} r={9} fill="#a78bfa" opacity={0.95} />
            )}
            {/* Hit zone painted last so it is on top of the markers above. */}
            <rect
              className="fret-cell"
              x={x1}
              y={y - 18}
              width={x2 - x1}
              height={36}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`${stringName} string, fret ${actualFret}`}
              aria-pressed={isMomentary ? undefined : isToggleActive}
              onClick={activate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                  e.preventDefault();
                  activate();
                }
              }}
            />
          </g>
        );
      })}
    </g>
  );
}
