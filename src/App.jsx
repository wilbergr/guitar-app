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
  const [pressedFrets, setPressedFrets] = useState(new Map());
  const [appMode, setAppMode] = useState('learn');
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    if (audioReady) {
      audioService.init(instrument);
    }
  }, [instrument, audioReady]);

  const ensureAudioReady = useCallback(async () => {
    if (!audioReady) {
      await audioService.init(instrument);
      setAudioReady(true);
    }
  }, [audioReady, instrument]);

  const handleInstrumentChange = useCallback((type) => {
    setInstrument(type);
    setSelectedChord(null);
    setActiveStrings(new Set());
    setPressedFrets(new Map());
  }, []);

  const handleChordSelect = useCallback(async (chord) => {
    setSelectedChord(chord);
    await ensureAudioReady();
    const tuning = TUNINGS[chord.instrument];
    audioService.playChord(chord, tuning.notes, 'down');
  }, [ensureAudioReady]);

  const handleFretPress = useCallback(async (stringIndex, fret) => {
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];

    // Read current state before updating to decide play/remove behavior
    const isRemoving = pressedFrets.get(stringIndex) === fret;

    setPressedFrets((prev) => {
      const next = new Map(prev);
      if (next.get(stringIndex) === fret) {
        next.delete(stringIndex);
      } else {
        // Replace any existing press on this string with the new absolute fret
        next.set(stringIndex, fret);
      }
      return next;
    });

    // Play the tapped fret — absolute pitch: openNote + fretNumber semitones
    if (!isRemoving) {
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
    }
  }, [ensureAudioReady, instrument, pressedFrets]);

  const handleStrumChord = useCallback(async () => {
    if (!selectedChord) return;
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    audioService.playChord(selectedChord, tuning.notes, 'down');
  }, [selectedChord, ensureAudioReady, instrument]);

  const handleStrumPressedFrets = useCallback(async () => {
    if (pressedFrets.size === 0) return;
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    const stringCount = tuning.stringCount;
    for (let si = 0; si < stringCount; si++) {
      const fret = pressedFrets.get(si) ?? 0;
      setTimeout(() => {
        audioService.playNote(instrument, si, fret, tuning.notes);
      }, si * 50);
    }
  }, [pressedFrets, ensureAudioReady, instrument]);

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
              ) : pressedFrets.size > 0 ? (
                <button className="strum-btn" onClick={handleStrumPressedFrets}>
                  🎵 Strum
                </button>
              ) : (
                <div className="no-chord-hint">
                  Select a chord or tap the fretboard to press frets
                </div>
              )}

              <Fretboard
                instrument={instrument}
                selectedChord={selectedChord}
                activeStrings={activeStrings}
                onStringPluck={handleFretPress}
                pressedFrets={pressedFrets}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
