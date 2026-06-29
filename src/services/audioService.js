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

const SAMPLE_SETS = {
  guitar: {
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/',
    urls: { A2: 'A2.mp3', A3: 'A3.mp3', A4: 'A4.mp3', E2: 'E2.mp3', E3: 'E3.mp3', E4: 'E4.mp3', B3: 'B3.mp3', D4: 'D4.mp3' },
  },
  bass: {
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/bass-electric/',
    urls: { A1: 'A1.mp3', A2: 'A2.mp3', E1: 'E1.mp3', E2: 'E2.mp3', G1: 'G1.mp3', D2: 'D2.mp3' },
  },
  ukulele: {
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-nylon/',
    urls: { A2: 'A2.mp3', A3: 'A3.mp3', E3: 'E3.mp3', C4: 'C4.mp3', G4: 'G4.mp3' },
  },
};

class GuitarAudioService {
  constructor() {
    this.sampler = null;
    this.reverb = null;
    this.isInitialized = false;
    this.isLoaded = false;
    this._currentInstrument = null;
  }

  async init(instrument = 'guitar') {
    if (this.isInitialized && this._currentInstrument === instrument) return true;

    if (this.sampler) this.sampler.dispose();
    if (this.reverb) this.reverb.dispose();

    this.isLoaded = false;

    await Tone.start();

    this.reverb = new Tone.Reverb({ decay: 1.8, wet: 0.15 }).toDestination();

    const sampleSet = SAMPLE_SETS[instrument] || SAMPLE_SETS.guitar;

    this.sampler = new Tone.Sampler({
      urls: sampleSet.urls,
      baseUrl: sampleSet.baseUrl,
    }).connect(this.reverb);

    this.isInitialized = true;
    this._currentInstrument = instrument;

    Tone.loaded().then(() => {
      this.isLoaded = true;
    });

    return true;
  }

  playString(stringIndex, noteName) {
    if (!this.isInitialized || !this.isLoaded || !this.sampler) return;
    try {
      this.sampler.triggerAttackRelease(noteName, '8n');
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
    if (this.sampler) this.sampler.releaseAll();
  }

  dispose() {
    if (this.sampler) this.sampler.dispose();
    if (this.reverb) this.reverb.dispose();
    this.sampler = null;
    this.isInitialized = false;
    this.isLoaded = false;
    this._currentInstrument = null;
  }
}

const audioService = new GuitarAudioService();
export default audioService;
