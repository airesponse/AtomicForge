// Pure helpers for guitar-friendly sample playback. MIDI numbers use standard tuning.
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNote(midi) {
  const n = Math.max(0, Math.round(midi));
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}

export function chordMidiVoicing(chord, shape = 'Open / cowboy', capo = 0) {
  const tones = new Set(chord.notes.map(n => ((n % 12) + 12) % 12));
  const power = shape === 'Power chord';
  const triad = shape === 'Triad';
  const barre = shape === 'Barre shape';
  const targetStrings = triad ? [2, 3, 4, 5] : [0, 1, 2, 3, 4, 5];
  const notes = [];
  for (const stringIndex of targetStrings) {
    const open = OPEN_STRINGS[stringIndex] + Math.max(0, Math.min(12, capo));
    let choices = [];
    for (let fret = 0; fret <= 12; fret++) {
      const midi = open + fret;
      const pc = midi % 12;
      if (power ? (pc === chord.root % 12 || pc === (chord.root + 7) % 12) : tones.has(pc)) {
        const fretPenalty = barre ? Math.abs(fret - 3) * 0.8 : fret * (fret === 0 ? 0.12 : 1);
        const highPenalty = midi > 76 ? (midi - 76) * 0.18 : 0;
        choices.push({ midi, fret, score: fretPenalty + highPenalty });
      }
    }
    choices.sort((a, b) => a.score - b.score || a.midi - b.midi);
    if (choices.length) notes.push(choices[0].midi);
  }
  // Prefer a musical spread and avoid stacking too many notes in the same register.
  let unique = [...new Set(notes)];
  if (triad && unique.length > 4) unique = unique.slice(0, 4);
  if (power) {
    const root = chord.root % 12;
    const candidates = unique.filter(n => n % 12 === root || n % 12 === (root + 7) % 12);
    unique = candidates.slice(0, 5);
  }
  if (!unique.length) unique = [48 + chord.root, 55 + chord.root, 60 + chord.root];
  return unique.sort((a, b) => a - b).map(midiToNote);
}

export function strumSchedule(noteCount, style, beatSeconds, humanize = 0.012) {
  const n = Math.max(1, noteCount);
  if (style === 'arpeggio') return Array.from({ length: n }, (_, i) => i * beatSeconds * 0.22);
  if (style === 'half') return Array.from({ length: n }, (_, i) => i * beatSeconds * 0.025);
  if (style === 'down') return Array.from({ length: n }, (_, i) => i * beatSeconds * 0.045);
  if (style === 'folk') return Array.from({ length: n }, (_, i) => i * beatSeconds * 0.055);
  // Pop/rock: a quick, human-feeling sweep rather than six identical simultaneous notes.
  return Array.from({ length: n }, (_, i) => i * beatSeconds * 0.035 + (i % 2 ? humanize : 0));
}

export function velocityForString(index, count, style = 'pop') {
  const position = count <= 1 ? 0 : index / (count - 1);
  const slope = style === 'arpeggio' ? 0.11 : 0.19;
  return Math.max(0.38, 0.82 - position * slope);
}
