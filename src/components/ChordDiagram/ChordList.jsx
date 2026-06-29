import './ChordDiagram.css';
import ChordDiagram from './ChordDiagram';
import { getChordsForInstrument } from '../../services/chordUtils';

const TYPE_LABELS = {
  major: 'Major Chords',
  minor: 'Minor Chords',
  power: 'Power Chords',
};

export default function ChordList({ instrument, selectedChordId, onChordSelect }) {
  const chords = getChordsForInstrument(instrument);

  // Group by type
  const groups = {};
  chords.forEach((chord) => {
    if (!groups[chord.type]) groups[chord.type] = [];
    groups[chord.type].push(chord);
  });

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
                onClick={() => onChordSelect(chord)}
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
