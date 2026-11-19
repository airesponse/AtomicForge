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
      basicPitch: { midi: basicPitchMidi, chordCandidate: chordCandidate(basicPitchMidi), noteIndices: basicPitchNoteIndices },
      missingFromBasicPitch: baselineMidi.filter(midi => !basicPitchMidi.includes(midi)),
      additionalInBasicPitch: basicPitchMidi.filter(midi => !baselineMidi.includes(midi))
    };
  });
  return {
    events, basicPitchNotes,
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

export function renderComparison(container, report) {
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.84rem';
  const body = document.createElement('tbody');
  const head = table.createTHead().insertRow();
  for (const label of ['Event (s)', '2E.18', 'Basic Pitch', '2E.18 only', 'Basic Pitch only']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    head.append(cell);
  }
  table.append(body);
  const names = midis => midis.map(noteName).join(', ') || '—';
  for (const event of report.events) {
    const { start, end, baseline, basicPitch, missingFromBasicPitch, additionalInBasicPitch } = event;
    const modelNotes = basicPitch.noteIndices.map(index => {
      const note = report.basicPitchNotes[index];
      const score = note.confidence === null ? 'score unavailable' : note.confidence.toFixed(2);
      return `${noteName(note.midi)} ${note.start.toFixed(2)}–${note.end.toFixed(2)}s (${score})`;
    });
    const row = body.insertRow();
    for (const text of [
      `${start.toFixed(2)}–${end.toFixed(2)}`,
      `${names(baseline.midi)} · ${baseline.chordCandidate ?? baseline.type} · ${Math.round(baseline.confidence * 100)}% persistence`,
      [basicPitch.chordCandidate, ...modelNotes].filter(Boolean).join(' · ') || '—',
      names(missingFromBasicPitch), names(additionalInBasicPitch)
    ]) {
      const cell = row.insertCell();
      cell.style.cssText = 'padding:8px 6px;border-bottom:1px solid #333;vertical-align:top';
      cell.textContent = text;
    }
  }
  container.replaceChildren(table);
}
