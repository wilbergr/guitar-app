import { Circle, X } from 'lucide-react';
import './ChordDiagram.css';

const FINGER_COLORS = ['#888', '#ef4444', '#22c55e', '#3b82f6', '#f97316'];
const FRET_ROWS = 5;

export default function ChordDiagram({ chord, isSelected, onClick, size = 'small' }) {
  if (!chord) return null;

  const isLarge = size === 'large';
  const stringCount = chord.strings.length;
  const cellW = isLarge ? 28 : 18;
  const cellH = isLarge ? 24 : 16;
  const r = isLarge ? 9 : 6;
  const fontSize = isLarge ? 9 : 6;

  const leftPad = chord.startFret > 1 ? (isLarge ? 22 : 16) : 0;
  const topPad = isLarge ? 18 : 12; // space for open/muted symbols
  const svgW = leftPad + stringCount * cellW + 4;
  const svgH = topPad + FRET_ROWS * cellH + 4;

  // X position for each string (0-indexed, 0=thickest)
  const stringX = (si) => leftPad + si * cellW + cellW / 2;
  // Y position for each fret row (0-indexed, 0=first visible fret)
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
          {chord.instrument} · {chord.type}
          {chord.barre && ' · Barre'}
        </div>
      )}

      <svg
        className="chord-diagram-svg"
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
      >
        {/* Fret number label if startFret > 1 */}
        {chord.startFret > 1 && (
          <text
            x={leftPad - 4}
            y={topPad + cellH / 2 + 3}
            textAnchor="end"
            fontSize={isLarge ? 9 : 6}
            fill="rgba(255,255,255,0.6)"
          >
            {chord.startFret}fr
          </text>
        )}

        {/* Nut (thick bar at top if startFret===1) */}
        {chord.startFret === 1 && (
          <rect
            x={leftPad}
            y={topPad}
            width={stringCount * cellW - 2}
            height={isLarge ? 4 : 3}
            fill="#c9b372"
            rx={1}
          />
        )}

        {/* Fret lines */}
        {Array.from({ length: FRET_ROWS + 1 }, (_, fi) => (
          <line
            key={fi}
            x1={leftPad}
            y1={topPad + fi * cellH}
            x2={leftPad + stringCount * cellW - 2}
            y2={topPad + fi * cellH}
            stroke="rgba(255,255,255,0.2)"
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
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={si === 0 ? 1.5 : 1}
          />
        ))}

        {/* Open/muted indicators */}
        {chord.strings.map((fret, si) => {
          const mark = isLarge ? 10 : 7;
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

        {/* Barre bar */}
        {chord.barre && (() => {
          const b = chord.barre;
          const fi = b.fret - chord.startFret;
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

        {/* Finger dots */}
        {chord.strings.map((fret, si) => {
          if (fret <= 0) return null;
          const fi = fret - chord.startFret;
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

      {!isLarge && (
        <div className="chord-diagram-label">{chord.shortName}</div>
      )}
      {isLarge && chord.description && (
        <div className="chord-description">{chord.description}</div>
      )}
    </div>
  );
}
