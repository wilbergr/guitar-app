import * as Tone from 'tone';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameToMidi(name) {
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

class GuitarAudioService {
  constructor() {
    this.synths = [];
    this.reverb = null;
    this.isInitialized = false;
    this._currentStringCount = 0;
  }

  async init(stringCount = 6) {
    if (this.isInitialized && this._currentStringCount === stringCount) return true;

    this.synths.forEach((s) => s.dispose());
    if (this.reverb) this.reverb.dispose();

    await Tone.start();

    this.reverb = new Tone.Reverb({ decay: 1.8, wet: 0.15 }).toDestination();
    const isBass = stringCount === 4;

    this.synths = Array.from({ length: stringCount }, () =>
      new Tone.PluckSynth({
        attackNoise: 1.2,
        dampening: isBass ? 3000 : 4500,
        resonance: 0.75,
      }).connect(this.reverb)
    );

    this.isInitialized = true;
    this._currentStringCount = stringCount;
    return true;
  }

  playString(stringIndex, noteName) {
    if (!this.isInitialized || !this.synths[stringIndex]) return;
    try {
      this.synths[stringIndex].triggerAttack(noteName);
    } catch {
      // Ignore out-of-range notes silently
    }
  }

  playNote(instrument, stringIndex, fret, tuningNotes) {
    if (!tuningNotes || !tuningNotes[stringIndex]) return;
    const openMidi = noteNameToMidi(tuningNotes[stringIndex]);
    const targetMidi = openMidi + fret;
    const noteName = midiToNoteName(targetMidi);
    this.playString(stringIndex, noteName);
  }

  playChord(chordData, tuningNotes, direction = 'down') {
    const indices = chordData.strings
      .map((fret, i) => ({ fret, i }))
      .filter(({ fret }) => fret !== -1);

    if (direction === 'up') indices.reverse();

    indices.forEach(({ fret, i }, order) => {
      const openMidi = noteNameToMidi(tuningNotes[i]);
      const targetMidi = openMidi + fret;
      const noteName = midiToNoteName(targetMidi);
      setTimeout(() => this.playString(i, noteName), order * 50);
    });
  }

  stopAll() {
    // PluckSynth notes decay naturally
  }

  dispose() {
    this.synths.forEach((s) => s.dispose());
    if (this.reverb) this.reverb.dispose();
    this.synths = [];
    this.isInitialized = false;
    this._currentStringCount = 0;
  }
}

const audioService = new GuitarAudioService();
export default audioService;
