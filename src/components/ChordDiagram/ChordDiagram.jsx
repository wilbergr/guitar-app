import { Circle, X } from 'lucide-react';
import './ChordDiagram.css';

const FINGER_COLORS = ['#888', '#ef4444', '#22c55e', '#3b82f6', '#f97316'];
const FRET_ROWS = 5;

// Friendly labels for the large-diagram meta line (the raw `type` slugs like
// "dominant7" read poorly). Falls back to the raw type when unmapped.
const TYPE_DISPLAY = {
  major: 'Major',
  minor: 'Minor',
  dominant7: 'Dominant 7th',
  major7: 'Major 7th',
  minor7: 'Minor 7th',
  power: 'Power Chord',
};

export default function ChordDiagram({ chord, isSelected, onClick, size = 'small', showLabel = true }) {
  if (!chord) return null;

  const isLarge = size === 'large';
  const isMedium = size === 'medium';
  const stringCount = chord.strings.length;
  const cellW = isLarge ? 28 : isMedium ? 26 : 18;
  const cellH = isLarge ? 24 : isMedium ? 22 : 16;
  const r = isLarge ? 9 : isMedium ? 8 : 6;
  const fontSize = isLarge ? 9 : isMedium ? 8 : 6;

  // Diagrams always render from the nut (fret 1 at the top row). The left pad
  // reserves room for the fret-row numbers (1..5) down the left edge, matching
  // the reference charts.
  const rowLabelSize = isLarge ? 9 : isMedium ? 8 : 6;
  const leftPad = isLarge ? 14 : isMedium ? 12 : 10;
  const topPad = isLarge ? 18 : isMedium ? 16 : 12; // space for open/muted symbols
  // Open/muted marker glyph size, scaled per diagram size.
  const mark = isLarge ? 10 : isMedium ? 9 : 7;
  const svgW = leftPad + stringCount * cellW + 4;
  const svgH = topPad + FRET_ROWS * cellH + 4;

  // X position for each string (0-indexed, 0=thickest)
  const stringX = (si) => leftPad + si * cellW + cellW / 2;
  // Y position for the center of an absolute fret row (fi=0 → fret 1)
  const fretY = (fi) => topPad + fi * cellH + cellH / 2;

  return (
    <div
      className={`chord-diagram-wrapper${isSelected ? ' selected' : ''}${isLarge ? ' large' : ''}`}
      onClick={onClick}
    >
      {isLarge && (
        <div className="chord-display-name">{chord.name}</div>
      )}
      {isLarge && (
        <div className="chord-display-meta">
          {chord.instrument} · {TYPE_DISPLAY[chord.type] || chord.type}
          {chord.barre && ' · Barre'}
        </div>
      )}

      <svg
        className="chord-diagram-svg"
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
      >
        {/* Fret-row numbers down the left edge (1..5) */}
        {Array.from({ length: FRET_ROWS }, (_, fi) => (
          <text
            key={fi}
            x={leftPad - 3}
            y={fretY(fi) + rowLabelSize / 2 - 1}
            textAnchor="end"
            fontSize={rowLabelSize}
            style={{ fill: 'var(--diagram-fret-label)' }}
          >
            {fi + 1}
          </text>
        ))}

        {/* Nut (thick bar at the top — every diagram is nut-anchored) */}
        <rect
          x={leftPad}
          y={topPad}
          width={stringCount * cellW - 2}
          height={isLarge ? 4 : 3}
          fill="#c9b372"
          rx={1}
        />

        {/* Fret lines */}
        {Array.from({ length: FRET_ROWS + 1 }, (_, fi) => (
          <line
            key={fi}
            x1={leftPad}
            y1={topPad + fi * cellH}
            x2={leftPad + stringCount * cellW - 2}
            y2={topPad + fi * cellH}
            style={{ stroke: 'var(--diagram-line)' }}
            strokeWidth={1}
          />
        ))}

        {/* String lines */}
        {Array.from({ length: stringCount }, (_, si) => (
          <line
            key={si}
            x1={stringX(si)}
            y1={topPad}
            x2={stringX(si)}
            y2={topPad + FRET_ROWS * cellH}
            style={{ stroke: 'var(--diagram-string)' }}
            strokeWidth={si === 0 ? 1.5 : 1}
          />
        ))}

        {/* Open/muted indicators */}
        {chord.strings.map((fret, si) => {
          if (fret === 0) {
            return (
              <Circle
                key={si}
                x={stringX(si) - mark / 2}
                y={topPad - mark - 1}
                width={mark}
                height={mark}
                style={{ color: 'var(--success)' }}
                aria-hidden="true"
              />
            );
          }
          if (fret === -1) {
            return (
              <X
                key={si}
                x={stringX(si) - mark / 2}
                y={topPad - mark - 1}
                width={mark}
                height={mark}
                style={{ color: 'var(--danger)' }}
                aria-hidden="true"
              />
            );
          }
          return null;
        })}

        {/* Barre bar — drawn at its absolute fret */}
        {chord.barre && (() => {
          const b = chord.barre;
          const fi = b.fret - 1;
          if (fi < 0 || fi >= FRET_ROWS) return null;

          // fromString/toString: guitar string numbers (1=thinnest, N=thickest)
          // strings array: index 0=thickest, index (n-1)=thinnest
          const fromSi = stringCount - b.fromString; // fromString=6 → si=0
          const toSi = stringCount - b.toString;     // toString=1 → si=5
          const x1 = stringX(Math.min(fromSi, toSi)) - r;
          const x2 = stringX(Math.max(fromSi, toSi)) + r;
          const cy = fretY(fi);

          return (
            <rect
              x={x1}
              y={cy - r}
              width={x2 - x1}
              height={r * 2}
              rx={r}
              fill={FINGER_COLORS[1]}
              opacity={0.85}
            />
          );
        })()}

        {/* Finger dots — positioned at absolute fret rows */}
        {chord.strings.map((fret, si) => {
          if (fret <= 0) return null;
          const fi = fret - 1;
          if (fi < 0 || fi >= FRET_ROWS) return null;

          const finger = chord.fingers[si];
          // Skip if this is a barre position (already drawn as bar)
          const isBarrePos =
            chord.barre &&
            fret === chord.barre.fret &&
            finger === 1;

          if (isBarrePos) return null;

          const color = FINGER_COLORS[finger] || FINGER_COLORS[0];
          return (
            <g key={si}>
              <circle cx={stringX(si)} cy={fretY(fi)} r={r} fill={color} opacity={0.9} />
              {finger && (
                <text
                  x={stringX(si)}
                  y={fretY(fi) + fontSize / 2 + 1}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight="bold"
                  fill="white"
                >
                  {finger}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {!isLarge && showLabel && (
        <div className="chord-diagram-label">{chord.shortName}</div>
      )}
      {isLarge && chord.description && (
        <div className="chord-description">{chord.description}</div>
      )}
    </div>
  );
}
