import './ChordDiagram.css';
import ChordDiagram from './ChordDiagram';
import { getChordsForInstrument } from '../../services/chordUtils';
import useMediaQuery from '../../hooks/useMediaQuery';

const TYPE_LABELS = {
  major: 'Major Chords',
  minor: 'Minor Chords',
  power: 'Power Chords',
};

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
      <div className="chord-strip" role="tablist" aria-label="Chord selector">
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
