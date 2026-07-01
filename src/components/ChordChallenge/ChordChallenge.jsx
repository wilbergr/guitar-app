import { useState, useEffect, useCallback, useRef } from 'react';
import './ChordChallenge.css';
import ChordDiagram from '../ChordDiagram/ChordDiagram';
import Fretboard from '../Fretboard/Fretboard';
import { getChordsForInstrument, getDecoyChords } from '../../services/chordUtils';
import { TUNINGS } from '../../data/tunings';
import audioService from '../../services/audioService';

const TOTAL_ROUNDS = 15;
const TIME_PER_ROUND = 10;
const PASS_THRESHOLD = 0.75;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(instrument) {
  const pool = getChordsForInstrument(instrument);
  if (pool.length === 0) return null;
  const correct = pool[Math.floor(Math.random() * pool.length)];
  const decoys = getDecoyChords(instrument, correct.id, correct.type, 3);
  const options = shuffleArray([correct, ...decoys]);
  return { correct, options };
}

// Screen enum
const SCREEN = {
  SELECT_TYPE: 'select_type',
  SELECT_MODE: 'select_mode',
  QUESTION: 'question',
  RESULTS: 'results',
};

export default function ChordChallenge({ instrument, onExit, ensureAudioReady, orientation = 'landscape' }) {
  const [screen, setScreen] = useState(SCREEN.SELECT_TYPE);
  const [challengeType, setChallengeType] = useState('diagram'); // 'diagram' | 'placement'
  const [isPractice, setIsPractice] = useState(true);

  // Question state
  const [question, setQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [results, setResults] = useState({ correct: 0, wrong: 0, times: [] });

  // Placement mode state
  const [placedFingers, setPlacedFingers] = useState(new Map());
  const [placementSubmitted, setPlacementSubmitted] = useState(false);
  const [placementCorrect, setPlacementCorrect] = useState(null);
  const [correctFingers, setCorrectFingers] = useState(null);

  // Challenge config
  const [challengeConfig, setChallengeConfig] = useState(null);
  const roundStartTime = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetch('challenge-config.json')
      .then((r) => r.json())
      .then(setChallengeConfig)
      .catch(() => {});
  }, []);

  const loadQuestion = useCallback(() => {
    const q = buildQuestion(instrument);
    setQuestion(q);
    setAnswered(false);
    setSelectedOptionId(null);
    setPlacedFingers(new Map());
    setPlacementSubmitted(false);
    setPlacementCorrect(null);
    setCorrectFingers(null);
    roundStartTime.current = Date.now();
    if (!isPractice) setTimeLeft(TIME_PER_ROUND);
  }, [instrument, isPractice]);

  const startChallenge = useCallback((practice) => {
    setIsPractice(practice);
    setRound(0);
    setResults({ correct: 0, wrong: 0, times: [] });
    setScreen(SCREEN.QUESTION);
    const q = buildQuestion(instrument);
    setQuestion(q);
    setAnswered(false);
    setSelectedOptionId(null);
    setPlacedFingers(new Map());
    setPlacementSubmitted(false);
    setPlacementCorrect(null);
    setCorrectFingers(null);
    roundStartTime.current = Date.now();
    if (!practice) setTimeLeft(TIME_PER_ROUND);
  }, [instrument]);

  // Timer for timed mode
  useEffect(() => {
    if (screen !== SCREEN.QUESTION || isPractice || answered) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Time's up = wrong
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen, isPractice, answered, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTimeout = useCallback(() => {
    if (answered) return;
    setAnswered(true);
    setResults((prev) => ({ ...prev, wrong: prev.wrong + 1, times: [...prev.times, TIME_PER_ROUND * 1000] }));
    setTimeout(() => advanceRound(), 2000);
  }, [answered]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceRound = useCallback(() => {
    const nextRound = round + 1;
    if (!isPractice && nextRound >= TOTAL_ROUNDS) {
      setScreen(SCREEN.RESULTS);
      return;
    }
    setRound(nextRound);
    loadQuestion();
  }, [round, isPractice, loadQuestion]);

  const handleDiagramSelect = useCallback(async (optionChord) => {
    if (answered) return;
    await ensureAudioReady();

    const elapsed = Date.now() - roundStartTime.current;
    const isCorrect = optionChord.id === question.correct.id;

    setSelectedOptionId(optionChord.id);
    setAnswered(true);

    const tuning = TUNINGS[optionChord.instrument];
    audioService.playChord(optionChord, tuning.notes, 'down');

    setResults((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      times: [...prev.times, elapsed],
    }));

    setTimeout(() => advanceRound(), isPractice ? 1500 : 1000);
  }, [answered, question, ensureAudioReady, advanceRound, isPractice]);

  const handleFingerPlace = useCallback((stringIndex, fret) => {
    if (placementSubmitted) return;
    setPlacedFingers((prev) => {
      const next = new Map(prev);
      const current = next.get(stringIndex);
      if (current === fret) {
        next.delete(stringIndex);
      } else {
        next.set(stringIndex, fret);
      }
      return next;
    });
  }, [placementSubmitted]);

  const handleOpenToggle = useCallback((si) => {
    if (placementSubmitted) return;
    setPlacedFingers((prev) => {
      const next = new Map(prev);
      next.set(si, next.get(si) === 0 ? undefined : 0);
      if (next.get(si) === undefined) next.delete(si);
      return next;
    });
  }, [placementSubmitted]);

  const handleMuteToggle = useCallback((si) => {
    if (placementSubmitted) return;
    setPlacedFingers((prev) => {
      const next = new Map(prev);
      next.set(si, next.get(si) === -1 ? undefined : -1);
      if (next.get(si) === undefined) next.delete(si);
      return next;
    });
  }, [placementSubmitted]);

  const handlePlacementSubmit = useCallback(() => {
    if (!question || placementSubmitted) return;
    const elapsed = Date.now() - roundStartTime.current;

    const correctStrings = question.correct.strings;
    const stringCount = correctStrings.length;

    let allMatch = true;
    for (let si = 0; si < stringCount; si++) {
      const placed = placedFingers.get(si);
      const expected = correctStrings[si];
      if (placed !== expected) {
        allMatch = false;
        break;
      }
    }

    setPlacementSubmitted(true);
    setPlacementCorrect(allMatch);

    if (!allMatch) {
      const cf = new Map();
      correctStrings.forEach((fret, si) => cf.set(si, fret));
      setCorrectFingers(cf);
    }

    setResults((prev) => ({
      correct: prev.correct + (allMatch ? 1 : 0),
      wrong: prev.wrong + (allMatch ? 0 : 1),
      times: [...prev.times, elapsed],
    }));

    setTimeout(() => advanceRound(), 2000);
  }, [question, placedFingers, placementSubmitted, advanceRound]);

  const accuracy = results.correct + results.wrong > 0
    ? results.correct / (results.correct + results.wrong)
    : 0;

  const avgTime = results.times.length > 0
    ? Math.round(results.times.reduce((a, b) => a + b, 0) / results.times.length / 100) / 10
    : 0;

  const tuning = TUNINGS[instrument];

  if (screen === SCREEN.SELECT_TYPE) {
    return (
      <div className="chord-challenge">
        <div className="challenge-mode-select">
          <h2>🎯 Chord Challenge</h2>
          <p>Test your knowledge of chord shapes on {instrument}.</p>
          <div className="challenge-type-grid">
            <button
              className="challenge-type-card"
              onClick={() => { setChallengeType('diagram'); setScreen(SCREEN.SELECT_MODE); }}
            >
              <h3>📊 Diagram Recognition</h3>
              <p>See a chord name, pick the correct diagram from 4 options.</p>
            </button>
            <button
              className="challenge-type-card"
              onClick={() => { setChallengeType('placement'); setScreen(SCREEN.SELECT_MODE); }}
            >
              <h3>🎸 Fretboard Placement</h3>
              <p>See a chord name, place the finger positions on the fretboard.</p>
            </button>
          </div>
          <button className="btn btn-ghost back-btn" onClick={onExit}>← Back to Learn</button>
        </div>
      </div>
    );
  }

  if (screen === SCREEN.SELECT_MODE) {
    return (
      <div className="chord-challenge">
        <div className="challenge-mode-select">
          <h2>{challengeType === 'diagram' ? '📊 Diagram Recognition' : '🎸 Fretboard Placement'}</h2>
          <p>Choose your mode:</p>
          <div className="mode-buttons">
            <button className="btn btn-secondary mode-btn practice" onClick={() => startChallenge(true)}>
              📚 Practice (no timer)
            </button>
            <button className="btn btn-primary mode-btn timed" onClick={() => startChallenge(false)}>
              ⏱ Challenge ({TOTAL_ROUNDS} rounds, {TIME_PER_ROUND}s each)
            </button>
          </div>
          <button className="btn btn-ghost back-btn" onClick={() => setScreen(SCREEN.SELECT_TYPE)}>← Back</button>
        </div>
      </div>
    );
  }

  if (screen === SCREEN.RESULTS) {
    const passed = accuracy >= PASS_THRESHOLD;
    const showCode = challengeConfig?.chordChallengeCode && accuracy >= 0.9;

    return (
      <div className="chord-challenge">
        <div className="results-screen">
          <h2>{passed ? '🎉 Passed!' : '💪 Keep Practicing'}</h2>
          <div className="results-summary">
            <div className="result-stat">
              <span className="label">Correct</span>
              <span className="value">{results.correct} / {results.correct + results.wrong}</span>
            </div>
            <div className="result-stat">
              <span className="label">Accuracy</span>
              <span className={`value ${passed ? 'pass' : 'fail'}`}>
                {Math.round(accuracy * 100)}%
              </span>
            </div>
            <div className="result-stat">
              <span className="label">Avg. Time</span>
              <span className="value">{avgTime}s</span>
            </div>
            <div className="result-stat">
              <span className="label">Result</span>
              <span className={`value ${passed ? 'pass' : 'fail'}`}>
                {passed ? '✓ Pass' : '✗ Fail'} (need {Math.round(PASS_THRESHOLD * 100)}%)
              </span>
            </div>
          </div>
          {showCode && (
            <div className="unlock-code">
              🔓 Unlock Code:
              <strong>{challengeConfig.chordChallengeCode}</strong>
            </div>
          )}
          <div className="results-actions">
            <button className="btn btn-primary result-btn primary" onClick={() => startChallenge(!isPractice)}>
              Try Again
            </button>
            <button className="btn btn-secondary result-btn secondary" onClick={() => setScreen(SCREEN.SELECT_TYPE)}>
              Change Mode
            </button>
            <button className="btn btn-secondary result-btn secondary" onClick={onExit}>
              Back to Learn
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUESTION screen
  if (!question) return null;

  return (
    <div className="chord-challenge">
      <div className="challenge-header">
        <div className="challenge-progress">
          {isPractice
            ? `Round ${round + 1} · Practice`
            : `Round ${round + 1} / ${TOTAL_ROUNDS}`}
        </div>
        <button className="btn btn-ghost back-btn" onClick={() => setScreen(SCREEN.SELECT_TYPE)}>
          ← Exit
        </button>
        {!isPractice && (
          <div className={`challenge-timer${timeLeft <= 3 ? ' urgent' : ''}`}>
            ⏱ {timeLeft}s
          </div>
        )}
      </div>

      <div className="challenge-question">
        <h3>Which diagram shows...</h3>
        <div className="chord-name-big">{question.correct.name}</div>
      </div>

      {challengeType === 'diagram' ? (
        <div className="options-grid">
          {question.options.map((opt) => {
            let cardClass = 'option-card';
            if (answered) {
              if (opt.id === question.correct.id) cardClass += ' correct';
              else if (opt.id === selectedOptionId) cardClass += ' wrong';
            }
            return (
              <div
                key={opt.id}
                className={cardClass}
                onClick={() => handleDiagramSelect(opt)}
              >
                <ChordDiagram chord={opt} size="small" />
                <div className="option-card-name">{opt.name}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="placement-hint">
            Click frets to place fingers. Use open/mute toggles per string.
          </div>
          <div className="string-toggle-row">
            {tuning.stringNames.map((name, si) => (
              <div key={si} className="string-toggle">
                <span>{name}</span>
                <button
                  className={`btn btn-icon btn-secondary toggle-btn${placedFingers.get(si) === 0 ? ' open-active' : ''}`}
                  onClick={() => handleOpenToggle(si)}
                  disabled={placementSubmitted}
                >
                  ○
                </button>
                <button
                  className={`btn btn-icon btn-secondary toggle-btn${placedFingers.get(si) === -1 ? ' mute-active' : ''}`}
                  onClick={() => handleMuteToggle(si)}
                  disabled={placementSubmitted}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <Fretboard
            instrument={instrument}
            selectedChord={null}
            activeStrings={new Set()}
            onStringPluck={null}
            placementMode={true}
            placedFingers={placedFingers}
            onFingerPlace={handleFingerPlace}
            correctFingers={placementSubmitted && !placementCorrect ? correctFingers : null}
            orientation={orientation}
          />
          <div className="placement-controls">
            {placementSubmitted ? (
              <div className={`placement-feedback ${placementCorrect ? 'correct' : 'wrong'}`}>
                {placementCorrect ? '✓ Correct!' : '✗ Wrong — correct positions shown in green'}
              </div>
            ) : (
              <button
                className="btn btn-primary submit-btn"
                onClick={handlePlacementSubmit}
              >
                Check Answer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
