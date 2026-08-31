import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target, BarChart3, Guitar, BookOpen, Timer, ArrowLeft,
  PartyPopper, Dumbbell, Check, X, Unlock,
  Lock, Pause, Play, SkipForward, Clock,
} from 'lucide-react';
import './ChordChallenge.css';
import ChordDiagram from '../ChordDiagram/ChordDiagram';
import Fretboard from '../Fretboard/Fretboard';
import { getChordsForInstrument, getDecoyChords } from '../../services/chordUtils';
import { TUNINGS } from '../../data/tunings';
import audioService from '../../services/audioService';

const TOTAL_ROUNDS = 15;
const TIME_PER_ROUND = 10;
const PASS_THRESHOLD = 0.75;

// Easter-egg riddles revealed on the results screen, one per challenge type.
// Each riddle's answer is a single number; the reveal is a simple <details> toggle.
const CHALLENGE_RIDDLES = {
  diagram: {
    riddle: 'Count every fret from the first to the twelfth, then stack the numbers in one growing heap — one, then two, then three, and on you creep, till the octave rings and the total’s yours to keep. What number am I?',
    answer: '78',
  },
  placement: {
    riddle: 'Two identical grids hide on the neck, each a perfect square: three strings side by side, three frets stacked in a deck. Count one grid’s cells, then write that count twice, side by side, to spell a two-digit number. What number am I?',
    answer: '99',
  },
};

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
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState({ correct: 0, wrong: 0, times: [], history: [] });

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
    setPaused(false);
    roundStartTime.current = Date.now();
    if (!isPractice) setTimeLeft(TIME_PER_ROUND);
  }, [instrument, isPractice]);

  const startChallenge = useCallback((practice) => {
    setIsPractice(practice);
    setRound(0);
    setResults({ correct: 0, wrong: 0, times: [], history: [] });
    setScreen(SCREEN.QUESTION);
    const q = buildQuestion(instrument);
    setQuestion(q);
    setAnswered(false);
    setSelectedOptionId(null);
    setPlacedFingers(new Map());
    setPlacementSubmitted(false);
    setPlacementCorrect(null);
    setCorrectFingers(null);
    setPaused(false);
    roundStartTime.current = Date.now();
    if (!practice) setTimeLeft(TIME_PER_ROUND);
  }, [instrument]);

  // Timer for timed mode
  useEffect(() => {
    if (screen !== SCREEN.QUESTION || isPractice || answered || paused) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Time's up = wrong
          handleTimeout(); // eslint-disable-line react-hooks/immutability
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen, isPractice, answered, paused, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordOutcome = useCallback((outcome, elapsed) => {
    const chord = question?.correct;
    const isCorrect = outcome === 'correct';
    setResults((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      times: [...prev.times, elapsed],
      history: [
        ...prev.history,
        {
          name: chord?.name ?? '—',
          shortName: chord?.shortName ?? chord?.name ?? '—',
          outcome, // 'correct' | 'wrong' | 'timeout' | 'skipped'
        },
      ],
    }));
  }, [question]);

  const handleTimeout = useCallback(() => {
    if (answered) return;
    setAnswered(true);
    recordOutcome('timeout', TIME_PER_ROUND * 1000);
    // Diagram challenge waits for a manual Continue (see the reveal button) so
    // the player can study what they missed; placement keeps its auto-advance.
    // advanceRound is declared below; the closure only runs later (see CLAUDE.md
    // TDZ gotcha), so the compiler's forward-reference check is safe to disable.
    if (challengeType !== 'diagram') setTimeout(() => advanceRound(), 2000); // eslint-disable-line react-hooks/immutability
  }, [answered, challengeType, recordOutcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = useCallback(() => {
    if (answered || placementSubmitted) return;
    setAnswered(true);
    setPlacementSubmitted(true);
    setPaused(false);
    const elapsed = Date.now() - roundStartTime.current;
    recordOutcome('skipped', elapsed);
    // Diagram challenge reveals the answer and waits for Continue; placement
    // auto-advances as before.
    if (challengeType !== 'diagram') setTimeout(() => advanceRound(), 700);
  }, [answered, challengeType, placementSubmitted, recordOutcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceRound = useCallback(() => { // eslint-disable-line react-hooks/preserve-manual-memoization
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

    recordOutcome(isCorrect ? 'correct' : 'wrong', elapsed);
    // No auto-advance: the reveal stays up until the player clicks Continue so
    // they can compare the diagrams and see what they got wrong.
  }, [answered, question, ensureAudioReady, recordOutcome]);

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
      // An untouched string means "open" (fret 0), matching the app-wide
      // absent-entry convention (see CLAUDE.md "Play-mode fret resolution").
      // `-1` (muted) and explicit frets stay as-is under `?? 0`.
      const placed = placedFingers.get(si) ?? 0;
      const expected = correctStrings[si];
      if (placed !== expected) {
        allMatch = false;
        break;
      }
    }

    setPlacementSubmitted(true);
    setAnswered(true);
    setPlacementCorrect(allMatch);

    if (!allMatch) {
      const cf = new Map();
      correctStrings.forEach((fret, si) => cf.set(si, fret));
      setCorrectFingers(cf);
    }

    recordOutcome(allMatch ? 'correct' : 'wrong', elapsed);

    setTimeout(() => advanceRound(), 2000);
  }, [question, placedFingers, placementSubmitted, advanceRound, recordOutcome]);

  const accuracy = results.correct + results.wrong > 0
    ? results.correct / (results.correct + results.wrong)
    : 0;

  const avgTime = results.times.length > 0
    ? Math.round(results.times.reduce((a, b) => a + b, 0) / results.times.length / 100) / 10
    : 0;

  const hasCodeReward = !!challengeConfig?.chordChallengeCode;

  // The placement fretboard's mute state is derived from placedFingers (a string
  // is muted when its value is -1) so there is one source of truth. The shared
  // Fretboard nut checkbox toggles this via onToggleMute={handleMuteToggle}.
  const placementMutedStrings = new Set();
  placedFingers.forEach((fret, si) => { if (fret === -1) placementMutedStrings.add(si); });

  if (screen === SCREEN.SELECT_TYPE) {
    return (
      <div className="chord-challenge">
        <div className="challenge-mode-select">
          <h2><Target className="inline-icon" aria-hidden="true" /> Chord Challenge</h2>
          <p>Test your knowledge of chord shapes on {instrument}.</p>
          <div className="challenge-type-grid">
            <button
              className="challenge-type-card"
              onClick={() => { setChallengeType('diagram'); setScreen(SCREEN.SELECT_MODE); }}
            >
              <h3><BarChart3 className="inline-icon" aria-hidden="true" /> Diagram Recognition</h3>
              <p>See a chord name, pick the correct diagram from 4 options.</p>
            </button>
            <button
              className="challenge-type-card"
              onClick={() => { setChallengeType('placement'); setScreen(SCREEN.SELECT_MODE); }}
            >
              <h3><Guitar className="inline-icon" aria-hidden="true" /> Fretboard Placement</h3>
              <p>See a chord name, place the finger positions on the fretboard.</p>
            </button>
          </div>
          <button className="btn btn-ghost back-btn" onClick={onExit}><ArrowLeft aria-hidden="true" /> Back to Learn</button>
        </div>
      </div>
    );
  }

  if (screen === SCREEN.SELECT_MODE) {
    return (
      <div className="chord-challenge">
        <div className="challenge-mode-select">
          <h2>
            {challengeType === 'diagram'
              ? (<><BarChart3 className="inline-icon" aria-hidden="true" /> Diagram Recognition</>)
              : (<><Guitar className="inline-icon" aria-hidden="true" /> Fretboard Placement</>)}
          </h2>
          <p>Choose your mode:</p>
          <div className="mode-buttons">
            <button className="btn btn-secondary mode-btn practice" onClick={() => startChallenge(true)}>
              <BookOpen aria-hidden="true" /> Practice (no timer)
            </button>
            <button className="btn btn-primary mode-btn timed" onClick={() => startChallenge(false)}>
              <Timer aria-hidden="true" /> Challenge ({TOTAL_ROUNDS} rounds, {TIME_PER_ROUND}s each)
            </button>
          </div>
          {hasCodeReward && (
            <p className="reward-teaser">
              <Lock className="inline-icon" aria-hidden="true" /> Score {Math.round(0.9 * 100)}%+ in Challenge mode to unlock a bonus code.
            </p>
          )}
          <button className="btn btn-ghost back-btn" onClick={() => setScreen(SCREEN.SELECT_TYPE)}><ArrowLeft aria-hidden="true" /> Back</button>
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
          <h2>
            {passed
              ? (<><PartyPopper className="inline-icon" aria-hidden="true" /> Passed!</>)
              : (<><Dumbbell className="inline-icon" aria-hidden="true" /> Keep Practicing</>)}
          </h2>
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
                {passed
                  ? (<><Check className="inline-icon" aria-hidden="true" /> Pass</>)
                  : (<><X className="inline-icon" aria-hidden="true" /> Fail</>)} (need {Math.round(PASS_THRESHOLD * 100)}%)
              </span>
            </div>
          </div>
          {showCode ? (
            <div className="unlock-code">
              <Unlock className="inline-icon" aria-hidden="true" /> Unlock Code:
              <strong>{challengeConfig.chordChallengeCode}</strong>
            </div>
          ) : hasCodeReward && (
            <div className="unlock-hint">
              <Lock className="inline-icon" aria-hidden="true" />
              Score {Math.round(0.9 * 100)}%+ to unlock a bonus code.
            </div>
          )}
          {results.history.length > 0 && (
            <div className="results-review">
              <h3>Round Review</h3>
              <ul className="review-list">
                {results.history.map((h, i) => (
                  <li key={i} className={`review-item ${h.outcome === 'correct' ? 'correct' : 'wrong'}`}>
                    <span className="review-num">{i + 1}</span>
                    <span className="review-icon" aria-hidden="true">
                      {h.outcome === 'correct'
                        ? <Check />
                        : h.outcome === 'timeout'
                          ? <Clock />
                          : h.outcome === 'skipped'
                            ? <SkipForward />
                            : <X />}
                    </span>
                    <span className="review-chord">{h.name}</span>
                    <span className="review-outcome">
                      {h.outcome === 'correct' && 'Correct'}
                      {h.outcome === 'wrong' && 'Missed'}
                      {h.outcome === 'timeout' && 'Timed out'}
                      {h.outcome === 'skipped' && 'Skipped'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {CHALLENGE_RIDDLES[challengeType] && (
            <div className="challenge-riddle">
              <span className="challenge-riddle-label">
                <Target className="inline-icon" aria-hidden="true" /> A riddle for finishing
              </span>
              <p className="challenge-riddle-text">{CHALLENGE_RIDDLES[challengeType].riddle}</p>
              <span className="challenge-riddle-padlock">
                <Lock className="inline-icon" aria-hidden="true" />
                Pink padlock — combine this answer with the other Chord Challenge riddle&apos;s answer (this one first) for the full 4-digit code.
              </span>
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
          <ArrowLeft aria-hidden="true" /> Exit
        </button>
        {!isPractice && (
          <div className={`challenge-timer${timeLeft <= 3 && !paused ? ' urgent' : ''}`}>
            <Timer className="inline-icon" aria-hidden="true" /> {paused ? 'Paused' : `${timeLeft}s`}
          </div>
        )}
      </div>

      {!isPractice && !answered && (
        <div className="challenge-controls">
          <button
            className="btn btn-ghost challenge-control-btn"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume timer' : 'Pause timer'}
          >
            {paused
              ? (<><Play aria-hidden="true" /> Resume</>)
              : (<><Pause aria-hidden="true" /> Pause</>)}
          </button>
          <button
            className="btn btn-ghost challenge-control-btn"
            onClick={handleSkip}
            disabled={paused}
            aria-label="Skip this chord (counts as incorrect)"
          >
            <SkipForward aria-hidden="true" /> Skip
          </button>
        </div>
      )}

      {paused ? (
        <div className="challenge-paused" role="status">
          <Pause className="inline-icon" aria-hidden="true" />
          <span className="challenge-paused-title">Paused</span>
          <p>The timer is stopped and the chord is hidden. Resume when you're ready.</p>
          <button className="btn btn-primary" onClick={() => setPaused(false)}>
            <Play aria-hidden="true" /> Resume
          </button>
        </div>
      ) : (
      <>
      <div className="challenge-question">
        <h3>Which diagram shows...</h3>
        <div className="chord-name-big">{question.correct.name}</div>
      </div>

      {challengeType === 'diagram' ? (
        <>
        <div className={`options-grid${answered ? ' revealed' : ''}`} role="group" aria-label={`Pick the diagram for ${question.correct.name}`}>
          {question.options.map((opt) => {
            let cardClass = 'option-card';
            let badge = null;
            if (answered) {
              if (opt.id === question.correct.id) { cardClass += ' correct'; badge = 'correct'; }
              else if (opt.id === selectedOptionId) { cardClass += ' wrong'; badge = 'wrong'; }
            }
            const activate = () => handleDiagramSelect(opt);
            return (
              <div
                key={opt.id}
                className={cardClass}
                role="button"
                tabIndex={answered ? -1 : 0}
                aria-label={`Select ${opt.name}`}
                aria-disabled={answered || undefined}
                onClick={activate}
                onKeyDown={(e) => {
                  if (!answered && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    activate();
                  }
                }}
              >
                {badge && (
                  <span className={`option-badge ${badge}`} aria-hidden="true">
                    {badge === 'correct' ? <Check /> : <X />}
                  </span>
                )}
                <ChordDiagram chord={opt} size={answered ? 'medium' : 'small'} showLabel={answered} />
                {answered && <div className="option-card-name">{opt.name}</div>}
              </div>
            );
          })}
        </div>
        {answered && (
          <div className="reveal-actions">
            <button
              className="btn btn-primary continue-btn"
              onClick={advanceRound}
              autoFocus
            >
              {!isPractice && round + 1 >= TOTAL_ROUNDS ? 'See Results' : 'Continue'}
            </button>
          </div>
        )}
        </>
      ) : (
        <>
          <div className="placement-hint">
            Tap frets to place fingers. Leave a string blank to play it open, or tick its box by the nut to mute it.
          </div>
          <Fretboard
            instrument={instrument}
            selectedChord={null}
            activeStrings={new Set()}
            onStringPluck={null}
            placementMode={true}
            placedFingers={placedFingers}
            onFingerPlace={handleFingerPlace}
            mutedStrings={placementMutedStrings}
            onToggleMute={placementSubmitted ? undefined : handleMuteToggle}
            correctFingers={placementSubmitted && !placementCorrect ? correctFingers : null}
            orientation={orientation}
          />
          <div className="placement-controls">
            {placementSubmitted ? (
              <div className={`placement-feedback ${placementCorrect ? 'correct' : 'wrong'}`}>
                {placementCorrect
                  ? (<><Check className="inline-icon" aria-hidden="true" /> Correct!</>)
                  : (<><X className="inline-icon" aria-hidden="true" /> Wrong — correct positions shown in green</>)}
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
      </>
      )}
    </div>
  );
}
