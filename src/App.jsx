import { useState, useEffect, useCallback } from 'react';
import './App.css';
import InstrumentSelector from './components/InstrumentSelector/InstrumentSelector';
import Fretboard from './components/Fretboard/Fretboard';
import ChordDiagram from './components/ChordDiagram/ChordDiagram';
import ChordList from './components/ChordDiagram/ChordList';
import ChordChallenge from './components/ChordChallenge/ChordChallenge';
import audioService from './services/audioService';
import { TUNINGS } from './data/tunings';

export default function App() {
  const [instrument, setInstrument] = useState('guitar');
  const [selectedChord, setSelectedChord] = useState(null);
  const [activeStrings, setActiveStrings] = useState(new Set());
  const [appMode, setAppMode] = useState('learn');
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const tuning = TUNINGS[instrument];
    if (audioReady) {
      audioService.init(tuning.stringCount);
    }
  }, [instrument, audioReady]);

  const ensureAudioReady = useCallback(async () => {
    if (!audioReady) {
      const tuning = TUNINGS[instrument];
      await audioService.init(tuning.stringCount);
      setAudioReady(true);
    }
  }, [audioReady, instrument]);

  const handleInstrumentChange = useCallback((type) => {
    setInstrument(type);
    setSelectedChord(null);
    setActiveStrings(new Set());
  }, []);

  const handleChordSelect = useCallback(async (chord) => {
    setSelectedChord(chord);
    await ensureAudioReady();
    const tuning = TUNINGS[chord.instrument];
    audioService.playChord(chord, tuning.notes, 'down');
  }, [ensureAudioReady]);

  const handleStringPluck = useCallback(async (stringIndex, fret) => {
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    audioService.playNote(instrument, stringIndex, fret, tuning.notes);

    setActiveStrings((prev) => {
      const next = new Set(prev);
      next.add(stringIndex);
      return next;
    });
    setTimeout(() => {
      setActiveStrings((prev) => {
        const next = new Set(prev);
        next.delete(stringIndex);
        return next;
      });
    }, 1500);
  }, [ensureAudioReady, instrument]);

  const handleStrumChord = useCallback(async () => {
    if (!selectedChord) return;
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    audioService.playChord(selectedChord, tuning.notes, 'down');
  }, [selectedChord, ensureAudioReady, instrument]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎸 Guitar Learning App</h1>
        <div className="header-controls">
          <InstrumentSelector instrument={instrument} onInstrumentChange={handleInstrumentChange} />
          <button
            className={`challenge-toggle-btn${appMode === 'challenge' ? ' active' : ''}`}
            onClick={() => setAppMode(appMode === 'learn' ? 'challenge' : 'learn')}
          >
            {appMode === 'learn' ? '🎯 Challenge' : '📚 Learn'}
          </button>
        </div>
      </header>

      {appMode === 'challenge' ? (
        <ChordChallenge
          instrument={instrument}
          onExit={() => setAppMode('learn')}
          ensureAudioReady={ensureAudioReady}
        />
      ) : (
        <div className="app-content">
          {!audioReady && (
            <div className="audio-init-banner">
              Click a chord or string to initialize audio 🔊
            </div>
          )}

          <div className="main-layout">
            <div className="chord-list-panel">
              <ChordList
                instrument={instrument}
                selectedChordId={selectedChord?.id}
                onChordSelect={handleChordSelect}
              />
            </div>

            <div className="center-panel">
              {selectedChord ? (
                <>
                  <ChordDiagram chord={selectedChord} isSelected size="large" />
                  <button className="strum-btn" onClick={handleStrumChord}>
                    🎵 Strum Chord
                  </button>
                </>
              ) : (
                <div className="no-chord-hint">
                  Select a chord from the list to see its fingering
                </div>
              )}

              <Fretboard
                instrument={instrument}
                selectedChord={selectedChord}
                activeStrings={activeStrings}
                onStringPluck={handleStringPluck}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
