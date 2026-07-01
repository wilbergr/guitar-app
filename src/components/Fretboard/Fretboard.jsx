import { useRef } from 'react';
import { Pencil, Play, Circle, X } from 'lucide-react';
import './Fretboard.css';
import GuitarString from './GuitarString';
import { TUNINGS } from '../../data/tunings';

// Edit / Play options for the mode radiogroup. `val` is the editMode boolean.
const MODE_SEGMENTS = [
  { val: true, label: 'Edit', Icon: Pencil },
  { val: false, label: 'Play', Icon: Play },
];

// Portrait orientation note:
// On phone-sized viewports the SVG is rendered inside a `.fretboard-portrait-frame`
// wrapper that visually rotates the SVG 90° via CSS transform (see Fretboard.css).
// We chose the CSS-rotate fallback over a per-coordinate axis swap because it
// preserves all existing click / keyboard / chord-marker logic untouched —
// browsers correctly hit-test through CSS transforms. Trade-off: text labels
// (string names, fret numbers) render rotated 90° as well, which is acceptable
// for single-character labels.

// Fret position markers (standard guitar inlays)
const MARKER_FRETS = [3, 5, 7, 9];
const DOUBLE_MARKER_FRET = 12;

const TOTAL_FRETS = 12;
const FRET_WIDTH_MIN = 50;
const LEFT_MARGIN = 48; // space for string labels
const RIGHT_MARGIN = 20;
const TOP_MARGIN = 40;  // space for open/muted indicators
const BOTTOM_MARGIN = 30;
const STRING_SPACING = 28;

export default function Fretboard({
  instrument,
  selectedChord,
  activeStrings,
  onStringPluck,
  pressedFrets,
  editMode = true,
  onEditModeChange,
  onPlayString,
  orientation = 'landscape',
  // Placement mode props
  placementMode = false,
  placedFingers,
  onFingerPlace,
  correctFingers,
}) {
  const isPortrait = orientation === 'portrait';
  const tuning = TUNINGS[instrument];
  const stringCount = tuning.stringCount;
  const strings = tuning.stringNames;
  const segmentRefs = useRef([]);

  const handleSegmentKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % MODE_SEGMENTS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + MODE_SEGMENTS.length) % MODE_SEGMENTS.length;
    else return;
    e.preventDefault();
    onEditModeChange && onEditModeChange(MODE_SEGMENTS[nextIdx].val);
    segmentRefs.current[nextIdx]?.focus();
  };

  // SVG dimensions
  const svgWidth = LEFT_MARGIN + TOTAL_FRETS * FRET_WIDTH_MIN + RIGHT_MARGIN;
  const svgHeight = TOP_MARGIN + (stringCount - 1) * STRING_SPACING + BOTTOM_MARGIN;

  // X position of each fret bar (0 = nut)
  const fretXPositions = Array.from(
    { length: TOTAL_FRETS + 1 },
    (_, i) => LEFT_MARGIN + i * FRET_WIDTH_MIN
  );

  const startFret = selectedChord?.startFret ?? 1;

  const svgEl = (
      <svg
        className={`fretboard-svg${isPortrait ? ' fretboard-svg-portrait' : ''}`}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Nut */}
        <rect
          x={fretXPositions[0] - 2}
          y={TOP_MARGIN}
          width={5}
          height={(stringCount - 1) * STRING_SPACING}
          fill="#c9b372"
          rx={2}
        />

        {/* Fret lines */}
        {fretXPositions.slice(1).map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={TOP_MARGIN}
            x2={x}
            y2={TOP_MARGIN + (stringCount - 1) * STRING_SPACING}
            stroke="#555"
            strokeWidth={1.5}
          />
        ))}

        {/* Fretboard background */}
        <rect
          x={fretXPositions[0]}
          y={TOP_MARGIN}
          width={fretXPositions[TOTAL_FRETS] - fretXPositions[0]}
          height={(stringCount - 1) * STRING_SPACING}
          fill="rgba(139, 90, 43, 0.15)"
          rx={0}
        />

        {/* Fret position markers */}
        {MARKER_FRETS.map((fret) => {
          if (fret > TOTAL_FRETS) return null;
          const midX = (fretXPositions[fret - 1] + fretXPositions[fret]) / 2;
          const midY = TOP_MARGIN + ((stringCount - 1) * STRING_SPACING) / 2;
          return (
            <circle key={fret} cx={midX} cy={midY} r={5} fill="rgba(255,255,255,0.15)" />
          );
        })}
        {DOUBLE_MARKER_FRET <= TOTAL_FRETS && (() => {
          const midX = (fretXPositions[DOUBLE_MARKER_FRET - 1] + fretXPositions[DOUBLE_MARKER_FRET]) / 2;
          const midY = TOP_MARGIN + ((stringCount - 1) * STRING_SPACING) / 2;
          return (
            <>
              <circle cx={midX} cy={midY - 8} r={5} fill="rgba(255,255,255,0.15)" />
              <circle cx={midX} cy={midY + 8} r={5} fill="rgba(255,255,255,0.15)" />
            </>
          );
        })()}

        {/* Fret numbers */}
        {[1, 3, 5, 7, 9, 12].map((fret) => {
          if (fret > TOTAL_FRETS) return null;
          const midX = (fretXPositions[fret - 1] + fretXPositions[fret]) / 2;
          return (
            <text
              key={fret}
              x={midX}
              y={svgHeight - 8}
              textAnchor="middle"
              fontSize={11}
              style={{ fontFamily: 'var(--font-mono)', fill: 'var(--text-faint)' }}
            >
              {fret}
            </text>
          );
        })}

        {/* Strings + open/muted indicators */}
        {Array.from({ length: stringCount }, (_, si) => {
          // si=0 is thickest string, show at bottom; si=(n-1) is thinnest, at top
          // Render thinnest at top (standard guitar view from player perspective)
          const displayRow = stringCount - 1 - si;
          const y = TOP_MARGIN + displayRow * STRING_SPACING;
          const isActive = activeStrings.has(si);

          let selectedFret;
          let fingerNumber;
          let isBarreString = false;
          let barreFret;

          if (selectedChord && selectedChord.strings) {
            selectedFret = selectedChord.strings[si];
            fingerNumber = selectedChord.fingers[si];

            if (selectedChord.barre) {
              const b = selectedChord.barre;
              // fromString/toString are guitar string numbers (1=thinnest, 6=thickest)
              const guitarStringNum = stringCount - si; // si=0 → 6, si=5 → 1
              if (guitarStringNum >= b.toString && guitarStringNum <= b.fromString) {
                if (selectedFret === b.fret) {
                  isBarreString = true;
                  barreFret = b.fret;
                }
              }
            }
          }

          // Open/muted indicators above nut
          const nutX = fretXPositions[0] - 14;

          // Placement mode: get user placed value
          const placedFret = placedFingers ? placedFingers.get(si) : undefined;
          const correctFret = correctFingers ? correctFingers.get(si) : undefined;
          // Interactive pressed fret (learn mode)
          const pressedFret = pressedFrets ? pressedFrets.get(si) : undefined;

          return (
            <g key={si}>
              {/* String label */}
              <text
                x={nutX - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                style={{ fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              >
                {strings[si]}
              </text>

              {/* Open/muted indicator */}
              {selectedChord && selectedFret !== undefined && (
                selectedFret === 0 ? (
                  <Circle x={nutX - 6} y={y - 6} width={12} height={12} style={{ color: 'var(--success)' }} aria-hidden="true" />
                ) : selectedFret === -1 ? (
                  <X x={nutX - 6} y={y - 6} width={12} height={12} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                ) : null
              )}

              <GuitarString
                stringIndex={si}
                stringName={strings[si]}
                y={y}
                fretXPositions={fretXPositions}
                stringCount={stringCount}
                isActive={isActive}
                selectedFret={selectedFret}
                fingerNumber={fingerNumber}
                isBarreString={isBarreString && !placementMode}
                barreFret={barreFret}
                startFret={startFret}
                onPluck={onStringPluck}
                pressedFret={pressedFret}
                editMode={editMode}
                onPlayString={onPlayString}
                placementMode={placementMode}
                placedFret={placedFret}
                onPlace={onFingerPlace}
                correctFret={correctFret}
              />
            </g>
          );
        })}

        {/* Barre chord bar overlay */}
        {selectedChord?.barre && !placementMode && (() => {
          const b = selectedChord.barre;
          const fretIndex = b.fret - startFret;
          if (fretIndex < 0 || fretIndex >= TOTAL_FRETS) return null;

          const x1 = fretXPositions[fretIndex];
          const x2 = fretXPositions[fretIndex + 1];
          const barX = (x1 + x2) / 2;

          // fromString/toString: guitar string numbers. Convert to display rows.
          const fromDisplayRow = stringCount - b.fromString; // thickest string (higher number) → lower display row
          const toDisplayRow = stringCount - b.toString;     // thinnest string (lower number) → higher display row
          const y1 = TOP_MARGIN + Math.min(fromDisplayRow, toDisplayRow) * STRING_SPACING;
          const y2 = TOP_MARGIN + Math.max(fromDisplayRow, toDisplayRow) * STRING_SPACING;

          return (
            <rect
              x={barX - 9}
              y={y1}
              width={18}
              height={y2 - y1}
              rx={6}
              fill="#ef4444"
              opacity={0.7}
            />
          );
        })()}
      </svg>
  );

  return (
    <div className={`fretboard-container${placementMode ? ' placement-mode' : ''}${isPortrait ? ' portrait' : ''}`}>
      <div className="fretboard-title">
        {placementMode ? 'Place finger positions on fretboard' : 'Interactive Fretboard'}
      </div>
      {!placementMode && (
        <div className="segmented-control" role="radiogroup" aria-label="Fretboard mode">
          {MODE_SEGMENTS.map((seg, idx) => {
            const checked = editMode === seg.val;
            const { Icon } = seg;
            return (
              <button
                key={seg.label}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                ref={(el) => { segmentRefs.current[idx] = el; }}
                className={`btn segment ${checked ? 'btn-primary active' : 'btn-ghost'}`}
                onClick={() => onEditModeChange && onEditModeChange(seg.val)}
                onKeyDown={(e) => handleSegmentKeyDown(e, idx)}
              >
                <Icon aria-hidden="true" /> {seg.label}
              </button>
            );
          })}
        </div>
      )}
      {isPortrait ? (
        <div
          className="fretboard-portrait-frame"
          style={{
            aspectRatio: `${svgHeight} / ${svgWidth}`,
            '--svg-w': svgWidth,
            '--svg-h': svgHeight,
          }}
        >
          {svgEl}
        </div>
      ) : (
        svgEl
      )}
    </div>
  );
}
