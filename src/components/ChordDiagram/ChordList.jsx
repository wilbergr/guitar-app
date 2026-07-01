import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import './ChordDiagram.css';
import ChordDiagram from './ChordDiagram';
import { getChordsForInstrument } from '../../services/chordUtils';
import useMediaQuery from '../../hooks/useMediaQuery';

const TYPE_LABELS = {
  major: 'Major Chords',
  minor: 'Minor Chords',
  power: 'Power Chords',
};

// Phone-only horizontally scrolling strip of chord chips. Shows edge-fade masks
// and a "more" chevron only when the strip actually overflows, and drops each
// edge cue once scrolled to that end. Purely presentational.
function ChordStrip({ chords, selectedChordId, onChordSelect }) {
  const stripRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    // Tolerance absorbs the few px of resting offset from scroll-snap + padding,
    // so the left fade stays off until the strip is meaningfully scrolled.
    const EDGE = 8;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      left: el.scrollLeft > EDGE,
      right: el.scrollLeft < max - EDGE,
    });
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateEdges);
      observer.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', updateEdges);
      if (observer) observer.disconnect();
    };
  }, [updateEdges]);

  // Re-measure when the chord set changes (e.g. instrument switch).
  useEffect(() => {
    updateEdges();
  }, [chords, updateEdges]);

  const stripClass = `chord-strip${edges.left ? ' fade-left' : ''}${
    edges.right ? ' fade-right' : ''
  }`;

  return (
    <div className="chord-strip-wrap">
      <div
        className={stripClass}
        ref={stripRef}
        role="tablist"
        aria-label="Chord selector"
      >
        {chords.map((chord) => (
          <button
            key={chord.id}
            type="button"
            role="tab"
            aria-selected={chord.id === selectedChordId}
            className={`chord-chip${chord.id === selectedChordId ? ' selected' : ''}`}
            onClick={() => onChordSelect(chord)}
          >
            {chord.shortName}
          </button>
        ))}
      </div>
      {edges.right && (
        <span className="chord-strip-more" aria-hidden="true">
          <ChevronRight />
        </span>
      )}
    </div>
  );
}

export default function ChordList({ instrument, selectedChordId, onChordSelect }) {
  const chords = getChordsForInstrument(instrument);
  const isPhone = useMediaQuery('(max-width: 599px)');

  // Group by type
  const groups = {};
  chords.forEach((chord) => {
    if (!groups[chord.type]) groups[chord.type] = [];
    groups[chord.type].push(chord);
  });

  if (isPhone) {
    return (
      <ChordStrip
        chords={chords}
        selectedChordId={selectedChordId}
        onChordSelect={onChordSelect}
      />
    );
  }

  return (
    <div className="chord-list">
      {Object.entries(groups).map(([type, groupChords]) => (
        <div key={type} className="chord-group">
          <div className="chord-group-title">{TYPE_LABELS[type] || type}</div>
          <div className="chord-grid">
            {groupChords.map((chord) => (
              <div
                key={chord.id}
                className={`chord-card${chord.id === selectedChordId ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={chord.id === selectedChordId}
                aria-label={`Select ${chord.name} chord`}
                onClick={() => onChordSelect(chord)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChordSelect(chord);
                  }
                }}
              >
                <ChordDiagram
                  chord={chord}
                  isSelected={chord.id === selectedChordId}
                  size="small"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
