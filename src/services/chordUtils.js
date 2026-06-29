import { TUNINGS } from '../data/tunings';
import { ALL_CHORDS } from '../data/chords';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameToMidi(name) {
  // Parse "E2" → MIDI number. Handles sharps but not flats.
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  const noteIndex = NOTE_NAMES.indexOf(match[1]);
  const octave = parseInt(match[2], 10);
  return (octave + 1) * 12 + noteIndex;
}

function midiToNoteName(midi) {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[noteIndex] + octave;
}

export function getChordsForInstrument(instrument, type = null) {
  return ALL_CHORDS.filter(
    (c) => c.instrument === instrument && (type === null || c.type === type)
  );
}

export function getNoteForFret(instrument, stringIndex, fret) {
  const tuning = TUNINGS[instrument];
  const openNote = tuning.notes[stringIndex];
  const openMidi = noteNameToMidi(openNote);
  return midiToNoteName(openMidi + fret);
}

export function getDecoyChords(instrument, correctId, type, count = 3) {
  // Prefer same type for meaningful challenge
  let pool = getChordsForInstrument(instrument, type).filter((c) => c.id !== correctId);
  if (pool.length < count) {
    // Fall back to all chords if not enough of same type
    pool = getChordsForInstrument(instrument).filter((c) => c.id !== correctId);
  }
  // Fisher-Yates partial shuffle
  for (let i = pool.length - 1; i > pool.length - 1 - count && i >= 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(Math.max(0, pool.length - count));
}

export function chordsMatch(userStrings, correctStrings) {
  if (userStrings.length !== correctStrings.length) return false;
  return userStrings.every((fret, i) => fret === correctStrings[i]);
}
