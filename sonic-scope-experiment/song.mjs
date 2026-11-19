const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const shapes = [
  ['5', [0, 7]], ['m', [0, 3, 7]], ['', [0, 4, 7]],
  ['7', [0, 4, 7, 10]], ['m7', [0, 3, 7, 10]], ['maj7', [0, 4, 7, 11]]
];
export const symbol = chord => chord.replace(/ major$/, '').replace(/ minor$/, 'm');

// Compare pitch classes sounding together. Octave doublings count once;
// extra notes can reduce the fitting score without vetoing a whole chord.
export function songReading(event, predictions) {
  const model = event.basicPitch;
  const notes = model.noteIndices.map(i => predictions[i]);
  const votes = new Map();
  const pitchTime = new Map();
  const edges = [...new Set([event.start, event.end, ...notes.flatMap(n =>
    [Math.max(n.start,event.start), Math.min(n.end,event.end)])])].sort((a,b) => a-b);
  for (let i = 1; i < edges.length; i++) {
    const start = edges[i-1], end = edges[i];
    const active = new Map();
    for (const note of notes) {
      if (note.start >= end || note.end <= start) continue;
      const strength = note.confidence ?? 0.5;
      const pc = note.midi % 12;
      active.set(pc, Math.max(active.get(pc) ?? 0, strength));
      pitchTime.set(note.midi, (pitchTime.get(note.midi) ?? 0) + (end-start)*strength);
    }
    const total = [...active.values()].reduce((a,b) => a+b, 0);
    if (!total) continue;
    for (const root of active.keys()) {
      for (const [suffix, intervals] of shapes) {
        const levels = intervals.map(n => active.get((root+n)%12) ?? 0);
        const weakest = Math.min(...levels);
        if (weakest < 0.15) continue;
        const share = levels.reduce((a,b) => a+b,0) / total;
        if (share < 0.75) continue;
        const label = roots[root]+suffix;
        votes.set(label,(votes.get(label) ?? 0)+(end-start)*share*share*weakest);
      }
    }
  }
  const exact = model.summaryChord && symbol(model.summaryChord.chord);
  const provisional = (model.qualityEvidence ?? []).find(s => s.chord === event.attackSeventh?.chord);
  if (provisional) return {label:provisional.chord, source:'attack and transcribed notes', kind:'chord'};
  if (exact) return {label:exact, source:'sustained notes', kind:'chord'};
  const [first, second] = [...votes].sort((a,b) => b[1]-a[1]);
  if (first && first[1] >= 0.12*(event.end-event.start) && first[1] > 1.15*(second?.[1] ?? 0)) {
    return {label:first[0],source:'weighted note overlap',kind:'chord'};
  }
  const common = event.baseline.midi.filter(m => pitchTime.has(m));
  if (event.baseline.chordCandidate && common.length === event.baseline.midi.length && model.chordCandidate === event.baseline.chordCandidate) {
    return {label:symbol(event.baseline.chordCandidate),source:'both detectors',kind:'chord'};
  }
  if (common.length) {
    const label = common.map(m => roots[m%12]+(Math.floor(m/12)-1)).join(' + ');
    return {label,source:'pitches in both detectors',kind:'notes'};
  }
  return {label:'Unresolved',source:'insufficient agreement',kind:'unknown'};
}

export function buildTabDraft(report) {
  const tuning = [64, 59, 55, 50, 45, 40]; // String one first.
  return {
    format: 'sonic-scope-tab-draft', version: 1, recording: report.recording,
    durationSeconds: report.durationSeconds, openStringMidi: tuning, maxFret: 24,
    events: report.events.map(event => ({
      start: event.start, end: event.end, reading: event.songReading,
      label: event.reviewedLabel || event.songReading.label,
      edited: Boolean(event.reviewedLabel), noteIndices: event.basicPitch.noteIndices
    })),
    notes: report.basicPitchNotes.map(({midi, start, end, confidence}) => ({
      midi, start, end, activation: confidence,
      positions: tuning.flatMap((open, index) => {
        const fret = midi - open;
        return fret >= 0 && fret <= 24 ? [{string: index + 1, fret}] : [];
      })
    }))
  };
}
