import { Guitar, Music, Music2 } from 'lucide-react';
import './InstrumentSelector.css';

const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar', Icon: Guitar },
  { id: 'bass', label: 'Bass', Icon: Music },
  { id: 'ukulele', label: 'Ukulele', Icon: Music2 },
];

export default function InstrumentSelector({ instrument, onInstrumentChange }) {
  return (
    <div className="instrument-selector">
      {INSTRUMENTS.map((inst) => {
        const { Icon } = inst;
        return (
          <button
            key={inst.id}
            className={`btn instrument-btn ${instrument === inst.id ? 'btn-primary active' : 'btn-secondary'}`}
            onClick={() => onInstrumentChange(inst.id)}
            title={inst.label}
          >
            <Icon className="instrument-icon" aria-hidden="true" />
            <span>{inst.label}</span>
          </button>
        );
      })}
    </div>
  );
}
