import './InstrumentSelector.css';

const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar', icon: '🎸' },
  { id: 'bass', label: 'Bass', icon: '🎵' },
  { id: 'ukulele', label: 'Ukulele', icon: '🪗' },
];

export default function InstrumentSelector({ instrument, onInstrumentChange }) {
  return (
    <div className="instrument-selector">
      {INSTRUMENTS.map((inst) => (
        <button
          key={inst.id}
          className={`btn instrument-btn ${instrument === inst.id ? 'btn-primary active' : 'btn-secondary'}`}
          onClick={() => onInstrumentChange(inst.id)}
          title={inst.label}
        >
          <span className="instrument-icon">{inst.icon}</span>
          <span>{inst.label}</span>
        </button>
      ))}
    </div>
  );
}
