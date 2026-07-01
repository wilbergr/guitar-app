import { useState, useEffect, useCallback } from 'react';
import { Guitar, Target, BookOpen, Volume2, Music, Sun, Moon, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import './App.css';
import InstrumentSelector from './components/InstrumentSelector/InstrumentSelector';
import Fretboard from './components/Fretboard/Fretboard';
import ChordDiagram from './components/ChordDiagram/ChordDiagram';
import ChordList from './components/ChordDiagram/ChordList';
import ChordChallenge from './components/ChordChallenge/ChordChallenge';
import Toast from './components/Toast/Toast';
import audioService from './services/audioService';
import { TUNINGS } from './data/tunings';
import useMediaQuery from './hooks/useMediaQuery';
import useTheme from './hooks/useTheme';

const INSTRUMENT_LABELS = { guitar: 'Guitar', bass: 'Bass', ukulele: 'Ukulele' };

export default function App() {
  const isPhone = useMediaQuery('(max-width: 599px)');
  const { theme, toggleTheme } = useTheme();
  const [instrument, setInstrument] = useState('guitar');
  const [selectedChord, setSelectedChord] = useState(null);
  const [activeStrings, setActiveStrings] = useState(new Set());
  const [pressedFrets, setPressedFrets] = useState(new Map());
  // Strings the user has explicitly marked dead/muted (X) in Edit mode — kept
  // separate from pressedFrets so a mute survives independent of fret markers.
  const [mutedStrings, setMutedStrings] = useState(new Set());
  const [appMode, setAppMode] = useState('learn');
  // 'idle' → not started, 'pending' → first gesture is initializing, 'ready' → live.
  const [audioStatus, setAudioStatus] = useState('idle');
  const audioReady = audioStatus === 'ready';
  const [audioConfirm, setAudioConfirm] = useState(false);
  const [resetToast, setResetToast] = useState(null);
  const [editMode, setEditMode] = useState(true);

  useEffect(() => {
    if (audioReady) {
      audioService.init(instrument);
    }
  }, [instrument, audioReady]);

  const ensureAudioReady = useCallback(async () => {
    // Ignore taps while a first gesture is still initializing so we don't kick
    // off a second Tone.start()/sampler build in parallel.
    if (audioStatus === 'ready' || audioStatus === 'pending') return;
    setAudioStatus('pending');
    try {
      await audioService.init(instrument);
      setAudioStatus('ready');
      // Flash a visual "Sound enabled" confirmation once audio goes live (the
      // sr-only live region below covers assistive tech).
      setAudioConfirm(true);
    } catch {
      setAudioStatus('idle');
    }
  }, [audioStatus, instrument]);

  // Auto-dismiss the audio confirmation. Timeout-only setState keeps this off
  // the synchronous render path.
  useEffect(() => {
    if (!audioConfirm) return;
    const t = setTimeout(() => setAudioConfirm(false), 2800);
    return () => clearTimeout(t);
  }, [audioConfirm]);

  // Auto-dismiss the instrument-reset notice. A fresh object each switch
  // re-arms the timer and restarts the toast animation.
  useEffect(() => {
    if (!resetToast) return;
    const t = setTimeout(() => setResetToast(null), 2600);
    return () => clearTimeout(t);
  }, [resetToast]);

  const handleInstrumentChange = useCallback((type) => {
    if (type === instrument) return;
    setInstrument(type);
    setSelectedChord(null);
    setActiveStrings(new Set());
    setPressedFrets(new Map());
    setMutedStrings(new Set());
    setResetToast({ label: INSTRUMENT_LABELS[type] || type, id: type });
  }, [instrument]);

  const handleChordSelect = useCallback(async (chord) => {
    setSelectedChord(chord);
    setPressedFrets(new Map());
    setMutedStrings(new Set());
    await ensureAudioReady();
    const tuning = TUNINGS[chord.instrument];
    audioService.playChord(chord, tuning.notes, 'down');
  }, [ensureAudioReady]);

  const handleToggleMute = useCallback((stringIndex) => {
    setMutedStrings((prev) => {
      const next = new Set(prev);
      if (next.has(stringIndex)) next.delete(stringIndex);
      else next.add(stringIndex);
      return next;
    });
  }, []);

  const handleFretPress = useCallback(async (stringIndex, fret) => {
    const isRemoving = pressedFrets.get(stringIndex) === fret;

    await ensureAudioReady();
    const tuning = TUNINGS[instrument];

    // Fretting a string is incompatible with it being dead/muted — clear the
    // mute so the newly placed note can sound.
    if (!isRemoving && mutedStrings.has(stringIndex)) {
      setMutedStrings((prev) => {
        const next = new Set(prev);
        next.delete(stringIndex);
        return next;
      });
    }

    setPressedFrets((prev) => {
      const next = new Map(prev);
      if (next.get(stringIndex) === fret) {
        next.delete(stringIndex);
      } else {
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
  }, [ensureAudioReady, instrument, pressedFrets, mutedStrings]);

  const handlePlayString = useCallback(async (stringIndex) => {
    // A user-muted (dead) string is damped — the pluck registers visually but
    // produces no sound.
    if (mutedStrings.has(stringIndex)) return;
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    const derived = pressedFrets.has(stringIndex)
      ? pressedFrets.get(stringIndex)
      : selectedChord?.strings[stringIndex];
    // A string explicitly muted by the governing chord stays silent.
    if (derived === -1) return;
    // No marker and no chord context → sound the open string (fret 0).
    const fret = derived === undefined ? 0 : derived;
    audioService.playNote(instrument, stringIndex, fret, tuning.notes);
    setActiveStrings((prev) => { const next = new Set(prev); next.add(stringIndex); return next; });
    setTimeout(() => {
      setActiveStrings((prev) => { const next = new Set(prev); next.delete(stringIndex); return next; });
    }, 1500);
  }, [ensureAudioReady, instrument, pressedFrets, selectedChord, mutedStrings]);

  const handleStrumChord = useCallback(async () => {
    if (!selectedChord) return;
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    // Fall back to per-string strumming (which honors user overrides) whenever
    // the user has pressed frets OR muted strings on top of the chord.
    if (pressedFrets.size > 0 || mutedStrings.size > 0) {
      const stringCount = tuning.stringCount;
      for (let si = 0; si < stringCount; si++) {
        if (mutedStrings.has(si)) continue;
        const chordFret = selectedChord.strings[si];
        if (!pressedFrets.has(si) && chordFret === -1) continue;
        const fret = pressedFrets.has(si) ? pressedFrets.get(si) : chordFret;
        setTimeout(() => audioService.playNote(instrument, si, fret, tuning.notes), si * 50);
      }
    } else {
      audioService.playChord(selectedChord, tuning.notes, 'down');
    }
  }, [selectedChord, pressedFrets, mutedStrings, ensureAudioReady, instrument]);

  const handleStrumPressedFrets = useCallback(async () => {
    // With no markers, strum sounds the open strings (each defaults to fret 0).
    await ensureAudioReady();
    const tuning = TUNINGS[instrument];
    const stringCount = tuning.stringCount;
    for (let si = 0; si < stringCount; si++) {
      if (mutedStrings.has(si)) continue;
      const fret = pressedFrets.get(si) ?? 0;
      setTimeout(() => {
        audioService.playNote(instrument, si, fret, tuning.notes);
      }, si * 50);
    }
  }, [pressedFrets, mutedStrings, ensureAudioReady, instrument]);

  return (
    <div className="app">
      <header className="app-header">
        <h1><Guitar className="app-title-icon" aria-hidden="true" /> Guitar Learning App</h1>
        <div className="header-controls">
          <InstrumentSelector instrument={instrument} onInstrumentChange={handleInstrumentChange} />
          <button
            className={`btn btn-primary challenge-toggle-btn${appMode === 'challenge' ? ' active' : ''}`}
            onClick={() => setAppMode(appMode === 'learn' ? 'challenge' : 'learn')}
          >
            {appMode === 'learn'
              ? (<><Target aria-hidden="true" /> Challenge</>)
              : (<><BookOpen aria-hidden="true" /> Learn</>)}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-icon theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light'
              ? <Moon aria-hidden="true" />
              : <Sun aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* Announce audio-state changes to assistive tech — screen-reader parity
          for the visual hint banner sighted users see. */}
      <div className="sr-only" role="status" aria-live="polite">
        {audioReady ? 'Audio enabled' : ''}
      </div>

      {/* Screen-reader parity for the visual instrument-reset toast. */}
      <div className="sr-only" role="status" aria-live="polite">
        {resetToast ? `Switched to ${resetToast.label}. Board cleared.` : ''}
      </div>

      {appMode === 'challenge' ? (
        <ChordChallenge
          instrument={instrument}
          onExit={() => setAppMode('learn')}
          ensureAudioReady={ensureAudioReady}
          orientation={isPhone ? 'portrait' : 'landscape'}
        />
      ) : (
        <div className="app-content">
          {!audioReady && (
            <div className="audio-init-banner">
              <button
                type="button"
                className="btn btn-primary audio-enable-btn"
                onClick={ensureAudioReady}
                disabled={audioStatus === 'pending'}
                aria-label="Enable sound"
              >
                {audioStatus === 'pending' ? (
                  <><Loader2 className="audio-enable-spinner" aria-hidden="true" /> Enabling sound…</>
                ) : (
                  <><Volume2 aria-hidden="true" /> Enable sound</>
                )}
              </button>
              <span className="audio-init-hint">
                {audioStatus === 'pending'
                  ? 'Starting audio — just a moment'
                  : 'Turn on sound, or tap any chord or string to start'}
              </span>
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
                  <button className="btn btn-primary strum-btn" onClick={handleStrumChord}>
                    <Music aria-hidden="true" /> Strum Chord
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary strum-btn" onClick={handleStrumPressedFrets}>
                    <Music aria-hidden="true" /> Strum
                  </button>
                  {pressedFrets.size === 0 && (
                    <div className="no-chord-hint">
                      Select a chord or tap the fretboard — Strum sounds the open strings
                    </div>
                  )}
                </>
              )}

              <Fretboard
                instrument={instrument}
                selectedChord={selectedChord}
                activeStrings={activeStrings}
                onStringPluck={handleFretPress}
                pressedFrets={pressedFrets}
                mutedStrings={mutedStrings}
                onToggleMute={handleToggleMute}
                editMode={editMode}
                onEditModeChange={setEditMode}
                onPlayString={handlePlayString}
                orientation={isPhone ? 'portrait' : 'landscape'}
              />
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack">
        {audioConfirm && (
          <Toast tone="success" icon={CheckCircle2} message="Sound enabled" />
        )}
        {resetToast && (
          <Toast tone="default" icon={RefreshCw} message={`${resetToast.label} loaded — board cleared`} />
        )}
      </div>
    </div>
  );
}
