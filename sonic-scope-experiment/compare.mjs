const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchClasses = new Map([
  ['C', 0], ['D', 2], ['E', 4], ['F', 5], ['G', 7], ['A', 9], ['B', 11]
]);

export function noteName(midi) {
  return pitchNames[midi % 12] + (Math.floor(midi / 12) - 1);
}

function baselinePitches(row) {
  if (row.type === 'Uncertain') return [];
  const matches = row.notes.matchAll(/\b([A-G])([#b]?)(-?\d+)\b/g);
  return Array.from(matches, ([, letter, accidental, octave]) => {
    const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    return (Number(octave) + 1) * 12 + pitchClasses.get(letter) + shift;
  });
}

function chordCandidate(midis) {
  const classes = [...new Set(midis.map(midi => midi % 12))];
  for (const root of classes) {
    const intervals = classes.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b).join(',');
    const suffix = { '0,7': '5', '0,4,7': ' major', '0,3,7': ' minor' }[intervals];
    if (suffix) return pitchNames[root] + suffix;
  }
  return null;
}

const minimumChordSeconds = 0.15;

function sustainedChord(notes, start, end) {
  const edges = notes.flatMap(note => [
    { time: Math.max(start, note.start), pitch: note.midi % 12, change: 1 },
    { time: Math.min(end, note.end), pitch: note.midi % 12, change: -1 }
  ]).sort((a, b) => a.time - b.time);
  const active = new Array(12).fill(0);
  let span = null;
  let best = null;

  for (let index = 0; index < edges.length;) {
    const { time } = edges[index];
    while (index < edges.length && edges[index].time === time) {
      const { pitch, change } = edges[index++];
      active[pitch] += change;
    }
    const nextTime = edges[index]?.time ?? end;
    const classes = active.flatMap((count, pitch) => count > 0 ? [pitch] : []);
    const chord = chordCandidate(classes);
    if (!chord) {
      span = null;
      continue;
    }
    if (span?.chord === chord) span.end = nextTime;
    else span = { chord, start: time, end: nextTime };

    const duration = span.end - span.start;
    if (duration + 1e-9 >= minimumChordSeconds && (!best || duration > best.end - best.start)) {
      best = { ...span };
    }
  }
  return best;
}

export function comparePredictions(baseline, modelNotes, duration) {
  const basicPitchNotes = modelNotes.map(note => {
    const start = Math.max(0, note.startTimeSeconds);
    const end = Math.min(duration, note.startTimeSeconds + note.durationSeconds);
    return { midi: note.pitchMidi, start, end, confidence: note.amplitude ?? null };
  }).filter(note => Number.isInteger(note.midi) && note.midi >= 0 && note.midi <= 127 && note.end > note.start)
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
  const assigned = new Set();
  const events = baseline.map(row => {
    const baselineMidi = [...new Set(baselinePitches(row))].sort((a, b) => a - b);
    const basicPitchNoteIndices = [];
    for (const [index, note] of basicPitchNotes.entries()) {
      const overlap = Math.min(row.end, note.end) - Math.max(row.start, note.start);
      const minimum = Math.min(0.05, (row.end - row.start) / 2, (note.end - note.start) / 2);
      if (overlap < minimum) continue;
      basicPitchNoteIndices.push(index);
      assigned.add(index);
    }
    const basicPitchMidi = [...new Set(basicPitchNoteIndices.map(index => basicPitchNotes[index].midi))]
      .sort((a, b) => a - b);
    return {
      start: row.start, end: row.end,
      baseline: {
        midi: baselineMidi, type: row.type, confidence: row.persistence / 100,
        spectralFit: row.fit / 100, chordCandidate: chordCandidate(baselineMidi),
        legacyChord: row.baseline
      },
      basicPitch: { midi: basicPitchMidi, chordCandidate: chordCandidate(basicPitchMidi), noteIndices: basicPitchNoteIndices,
        sustainedChord: sustainedChord(basicPitchNoteIndices.map(index => basicPitchNotes[index]), row.start, row.end) },
      missingFromBasicPitch: baselineMidi.filter(midi => !basicPitchMidi.includes(midi)),
      additionalInBasicPitch: basicPitchMidi.filter(midi => !baselineMidi.includes(midi))
    };
  });
  return {
    events, basicPitchNotes,
    sustainedChordMinimumSeconds: minimumChordSeconds,
    unassignedBasicPitchNoteIndices: basicPitchNotes.flatMap((_, index) => assigned.has(index) ? [] : [index])
  };
}

export async function resampleForBasicPitch(buffer) {
  const sampleRate = 22050;
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * sampleRate)), sampleRate);
  const mono = context.createBuffer(1, buffer.length, buffer.sampleRate);
  const target = mono.getChannelData(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel);
    for (let sample = 0; sample < source.length; sample++) {
      target[sample] += source[sample] / buffer.numberOfChannels;
    }
  }
  const node = context.createBufferSource();
  node.buffer = mono;
  node.connect(context.destination);
  node.start();
  return (await context.startRendering()).getChannelData(0).slice();
}

export function transcribe(samples, onProgress, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const worker = new Worker(new URL('./generated/basic-pitch.worker.mjs', import.meta.url), { type: 'module' });
    const phaseMessages = {
      loading: 'Loading Basic Pitch model…',
      'first-window': 'Analyzing the first audio window on the CPU…',
      decoding: 'Decoding Basic Pitch notes…'
    };
    let progress = 'Starting Basic Pitch worker…';
    let timeout;
    function resetTimeout() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        finish(reject, new Error('Basic Pitch made no progress for 60 seconds. Last step: ' + progress));
      }, 60000);
    }
    function finish(callback, value) {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      callback(value);
    }
    const abort = () => finish(reject, signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.error) finish(reject, new Error(data.error));
      else if (data.notes) finish(resolve, data);
      else {
        progress = phaseMessages[data.phase] ?? 'Running Basic Pitch… ' + Math.round(data.fraction * 100) + '%';
        resetTimeout();
        onProgress(progress);
      }
    };
    worker.onerror = event => finish(reject, new Error(
      event.message || 'Basic Pitch worker failed to load. Run the experiment build and open the localhost URL.'
    ));
    worker.onmessageerror = () => finish(reject, new Error('Could not read the Basic Pitch worker response.'));
    try {
      resetTimeout();
      worker.postMessage(samples, [samples.buffer]);
    } catch (error) {
      finish(reject, error);
    }
  });
}


const names = midis => midis.map(noteName).join(', ') || '—';
const times = (start, end, decimals = 2) => `${start.toFixed(decimals)}–${end.toFixed(decimals)}`;
const chordWithTime = (chord, decimals) => chord
  ? `${chord.chord} (${times(chord.start, chord.end, decimals)} s)`
  : '—';

export function buildComparisonReport(report) {
  const header = [
    'SONIC SCOPE — CHORD COMPARISON',
    'Recording: ' + report.recording,
    `Events: ${report.events.length} · Basic Pitch note predictions: ${report.basicPitchNotes.length} · Outside windows: ${report.unassignedBasicPitchNoteIndices.length}`,
    `Sustained chord: longest recognized pitch set overlapping for at least ${report.sustainedChordMinimumSeconds * 1000} ms`,
    'Event (s)\tConsolidated\t2E.18 notes\tBasic Pitch sustained chord\tBasic Pitch pooled chord\tBasic Pitch raw pitches\t2E.18 only\tBasic Pitch only'
  ];
  const rows = report.events.map(event => [
    times(event.start, event.end, 3), event.baseline.legacyChord ?? '—', names(event.baseline.midi),
    chordWithTime(event.basicPitch.sustainedChord, 3), event.basicPitch.chordCandidate ?? '—',
    names(event.basicPitch.midi), names(event.missingFromBasicPitch), names(event.additionalInBasicPitch)
  ].join('\t'));
  return [...header, ...rows].join('\n');
}

export function renderComparison(container, report, chordView = 'sustained') {
  const table = document.createElement('table');
  table.className = 'comparison-table';
  const body = document.createElement('tbody');
  const head = table.createTHead().insertRow();
  const modelLabel = chordView === 'sustained' ? 'Basic Pitch sustained' : 'Basic Pitch pooled';
  for (const label of ['Event (s)', 'Consolidated', '2E.18 notes', modelLabel, 'Details']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    head.append(cell);
  }
  table.append(body);
  for (const event of report.events) {
    const { start, end, baseline, basicPitch, missingFromBasicPitch, additionalInBasicPitch } = event;
    const row = body.insertRow();
    for (const text of [
      times(start, end), baseline.legacyChord ?? '—', names(baseline.midi),
      chordView === 'sustained' ? chordWithTime(basicPitch.sustainedChord) : basicPitch.chordCandidate ?? '—'
    ]) {
      row.insertCell().textContent = text;
    }
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${basicPitch.noteIndices.length} notes`;
    details.append(summary);
    details.addEventListener('toggle', () => {
      if (!details.open || details.childElementCount > 1) return;
      const differences = document.createElement('p');
      differences.textContent = `2E.18 only: ${names(missingFromBasicPitch)} · Basic Pitch only: ${names(additionalInBasicPitch)}`;
      const evidence = document.createElement('p');
      evidence.textContent = `2E.18 persistence: ${Math.round(baseline.confidence * 100)}% · Spectral fit: ${Math.round(baseline.spectralFit * 100)}%`;
      const list = document.createElement('ul');
      for (const index of basicPitch.noteIndices) {
        const { midi, start, end, confidence } = report.basicPitchNotes[index];
        const item = document.createElement('li');
        item.textContent = `${noteName(midi)} · ${times(start, end)} s · Activation ${confidence?.toFixed(2) ?? '—'}`;
        list.append(item);
      }
      details.append(differences, evidence, list);
    });
    row.insertCell().append(details);
  }
  container.replaceChildren(table);
}
