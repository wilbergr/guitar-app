// Renders one string as a horizontal row of clickable fret cells in the SVG fretboard.
// stringIndex 0 = thickest/lowest string.

const FINGER_COLORS = ['#888', '#ef4444', '#22c55e', '#3b82f6', '#f97316'];

export default function GuitarString({
  stringIndex,
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
        stroke={isActive ? '#f5a623' : '#a0968a'}
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

        if (placementMode) {
          if (placedFret === actualFret) {
            dotColor = '#f5a623';
            dotLabel = '●';
          }
          if (correctFret !== undefined && correctFret === actualFret && placedFret !== actualFret) {
            dotColor = 'rgba(34,197,94,0.7)';
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

        return (
          <g key={fi}>
            <rect
              x={x1}
              y={y - 12}
              width={x2 - x1}
              height={24}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (placementMode) {
                  onPlace && onPlace(stringIndex, actualFret);
                } else if (editMode) {
                  onPluck && onPluck(stringIndex, actualFret);
                } else {
                  onPlayString && onPlayString(stringIndex);
                }
              }}
            />
            {dotColor && !pressedDotHere && (
              <circle cx={midX} cy={y} r={9} fill={dotColor} opacity={0.9} />
            )}
            {dotLabel && !pressedDotHere && (
              <text
                x={midX}
                y={y + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {dotLabel}
              </text>
            )}
            {pressedDotHere && (
              <circle cx={midX} cy={y} r={9} fill="#a78bfa" opacity={0.95} />
            )}
          </g>
        );
      })}
    </g>
  );
}
