import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { buildChordChart, buildComparisonReport, comparePredictions, noteName } from './compare.mjs';

const predict = (pitchMidi, startTimeSeconds, durationSeconds, amplitude = 0.72) => ({
  pitchMidi, startTimeSeconds, durationSeconds, amplitude
});

test('reports exact MIDI disagreements and chord candidates on common boundaries', () => {
  const initial = { start: 0, end: 1, type: 'Double-stop', notes: 'E2 + B2 (perfect 5th)', persistence: 80, fit: 54 };
  const report = comparePredictions([initial], [predict(40, 0, 0.9), predict(59, 0.02, 0.7), predict(80, 1.5, 0.7)], 2);
  const [event] = report.events;
  assert.equal(event.baseline.confidence, 0.8);
  assert.deepEqual(event.baseline.midi, [40, 47]);
  assert.deepEqual(event.basicPitch.midi, [40, 59]);
  assert.equal(event.baseline.chordCandidate, 'E5');
  assert.equal(event.basicPitch.chordCandidate, 'E5');
  assert.deepEqual(event.missingFromBasicPitch, [47]);
  assert.deepEqual(event.additionalInBasicPitch, [59]);
  assert.deepEqual(report.unassignedBasicPitchNoteIndices, [2]);
  assert.equal(report.basicPitchNotes[2].end, 2);
  assert.equal(report.basicPitchNotes[1].confidence, 0.72);
  assert.equal(noteName(59), 'B3');
});

test('preserves uncertain rows, short events, and notes spanning adjacent events', () => {
  const first = { start: 0, end: 1, type: 'Uncertain', notes: 'Insufficient evidence', persistence: 12, fit: 25 };
  const second = { ...first, start: 1, end: 1.04, type: 'Single note', notes: 'Bb3' };
  const results = comparePredictions([first, second], [predict(58, 0.9, 0.15), predict(60, 0.99, 0.015)], 1.1);
  assert.deepEqual(results.events[0].baseline.midi, []);
  assert.deepEqual(results.events[0].basicPitch.midi, [58, 60]);
  assert.deepEqual(results.events[1].basicPitch.midi, [58]);
  assert.deepEqual(results.events[1].baseline.midi, [58]);
  assert.deepEqual(results.events[1].missingFromBasicPitch, []);
});

test('finds a sustained chord after a transient and keeps the pooled predictions', () => {
  const baseline = { start: 1.55, end: 3.03, type: 'Double-stop', notes: 'D3 + A3', baseline: 'D5' };
  const notes = [
    predict(95, 1.57, 0.10), predict(40, 1.59, 0.07),
    predict(50, 1.94, 0.6), predict(62, 1.94, 0.61), predict(57, 1.95, 0.65)
  ];
  const report = comparePredictions([baseline], notes, 3.03);
  const [event] = report.events;
  assert.equal(event.basicPitch.chordCandidate, null);
  assert.deepEqual(event.basicPitch.sustainedChord, { chord: 'D5', start: 1.95, end: 2.55 });
  assert.deepEqual(event.additionalInBasicPitch, [40, 62, 95]);
  assert.match(buildComparisonReport({ ...report, recording: 'test.m4a' }), /D5 \(1.950–2.550 s\)/);
});

test('requires continuous overlap and does not assemble a chord from successive notes', () => {
  const baseline = { start: 0, end: 1, type: 'Uncertain', notes: '' };
  const notes = [predict(52, 0, 0.4), predict(59, 0.38, 0.5)];
  const [event] = comparePredictions([baseline], notes, 1).events;
  assert.equal(event.basicPitch.chordCandidate, 'E5');
  assert.equal(event.basicPitch.sustainedChord, null);
});

test('labels a dominant seventh in inversion and through a missing fifth', () => {
  const baseline = { start: 0, end: 1, type: 'Multiple notes', notes: 'C3, D3, F#3' };
  const notes = [predict(48, 0, 0.9), predict(50, 0, 0.9), predict(54, 0, 0.9), predict(57, 0.1, 0.4)];
  const report = comparePredictions([baseline], notes, 1);
  const [event] = report.events;
  assert.equal(event.baseline.chordCandidate, 'D7');
  assert.equal(event.basicPitch.chordCandidate, 'D7');
  assert.deepEqual(event.basicPitch.sustainedChord, { chord: 'D7', start: 0, end: 0.9 });
  assert.match(buildComparisonReport({ ...report, recording: 'dominant.m4a' }), /D7 \(0.000–0.900 s\)/);
});

test('does not label a tritone or a major seventh as a dominant seventh', () => {
  const baseline = { start: 0, end: 1, type: 'Uncertain', notes: '' };
  for (const pitches of [[54, 60], [50, 54, 57, 61]]) {
    const [event] = comparePredictions([baseline], pitches.map(pitch => predict(pitch, 0, 0.8)), 1).events;
    assert.equal(event.basicPitch.chordCandidate, null);
    assert.equal(event.basicPitch.sustainedChord, null);
  }
});

test('runs the actual 2E.18 detector on a synthetic guitar-register tone', async () => {
  const html = await readFile(new URL('../TheSonicScope.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const element = {
    getContext: () => ({}), addEventListener() {}, dataset: {},
    getBoundingClientRect: () => ({ width: 320, height: 155 })
  };
  const context = createContext({
    document: { getElementById: () => Object.create(element) },
    window: { addEventListener() {} }
  });
  runInContext(script, context);
  const result = runInContext(`
    (() => {
      const sampleRate = 48000;
      const samples = Float32Array.from({ length: sampleRate * 2 }, (_, i) =>
        0.6 * Math.sin(2 * Math.PI * 196 * i / sampleRate)
        + 0.15 * Math.sin(2 * Math.PI * 392 * i / sampleRate)
        + 0.08 * Math.sin(2 * Math.PI * 588 * i / sampleRate)
      );
      const buffer = { sampleRate, length: samples.length, duration: 2, numberOfChannels: 1, getChannelData: () => samples };
      return polyEvent218(buffer, { start: 0.2, end: 1.8 });
    })()
  `, context);
  assert.match(result.name, /\bG3\b/);
});

test('surfaces brief seventh evidence only when the defining notes overlap', () => {
  const row = { start: 0, end: 1, notes: '', type: 'Uncertain' };
  const triad = [50, 54, 57].map(midi => predict(midi, 0, 0.8));
  const events = notes => comparePredictions([row], notes, 1).events[0].basicPitch;
  const chord = events([...triad, predict(60, 0.2, 0.05)]);
  assert.equal(chord.sustainedChord.chord, 'D major');
  assert.deepEqual(chord.qualityEvidence, [{ chord: 'D7', start: 0.2, end: 0.25 }]);
  assert.deepEqual(events([...triad, predict(60, 0.81, 0.1)]).qualityEvidence, []);
  assert.deepEqual(events(triad).qualityEvidence, []);
  assert.equal(chord.summaryChord.chord, 'D major');
  assert.equal(events([...triad, predict(60, 0.2, 0.16)]).summaryChord.chord, 'D7');
});

test('interval auditions pause and resume to the same endpoint and stop the previous source', async () => {
  const html = await readFile(new URL('../TheSonicScope.html', import.meta.url), 'utf8');
  const starts = [];
  const stopped = [];
  const element = {
    getContext: () => ({clearRect() {}}), addEventListener() {}, dataset: {},
    getBoundingClientRect: () => ({width: 320, height: 155})
  };
  const ctx = createContext({
    starts, stopped, document: {getElementById: () => Object.create(element)}, window: {addEventListener() {}}
  });
  runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx);
  await runInContext(`(async () => {
    drawVisualizer = () => {};
    audioBuffer = {duration: 10};
    audioContext = {state: 'running', currentTime: 0, createBufferSource: () => ({
      connect() {}, disconnect() {}, start(...args) { starts.push([...args]); }, stop() { stopped.push(true); }
    })};
    await startAt(2, 4);
    audioContext.currentTime = 0.5;
    pauseAudio();
    await startAt(playbackOffset, playbackEnd);
    await startAt(5, 6);
    audioSource.onended();
    await startAt(0);
  })()`, ctx);
  assert.deepEqual(starts.map(args => Array.from(args)), [[0, 2, 2], [0, 2.5, 1.5], [0, 5, 1], [0, 0]]);
  assert.equal(stopped.length, 2);
});

test('attack evidence requires a third and a seventh and remains separate from the sustained label', async () => {
  const {attackSeventh} = await import('./attack.mjs');
  const html = await readFile(new URL('../TheSonicScope.html', import.meta.url), 'utf8');
  const fft = runInContext('(' + html.match(/function fftMagnitude[\s\S]*?\n    }/)[0] + ')', createContext({}));
  const rate = 22050;
  const event = {start: 0, end: 0.5, basicPitch: {summaryChord: {chord: 'A major'}}};
  function evaluate(pitches) {
    const samples = Float32Array.from({length: rate / 2}, (_, i) => pitches.reduce((sum, midi) =>
      sum + 0.15 * Math.sin(2 * Math.PI * (440 * 2 ** ((midi - 69) / 12)) * i / rate), 0));
    return attackSeventh({sampleRate: rate, length: samples.length, numberOfChannels: 1, getChannelData: () => samples}, event, fft);
  }
  assert.equal(evaluate([45, 61, 64, 67]).chord, 'A7');
  assert.equal(evaluate([45, 61, 64]), null);
  assert.equal(evaluate([45, 64, 67]), null);
  assert.equal(event.basicPitch.summaryChord.chord, 'A major');
});

test('chord chart keeps event times, uncertain rows and distinct provisional readings', () => {
  const basicPitch = {summaryChord: {chord: 'F major'}, qualityEvidence: [{chord: 'F7'}]};
  const events = [
    {start: 0, end: 1, basicPitch, attackSeventh: {chord: 'F7'}},
    {start: 1, end: 2, basicPitch: {summaryChord: {chord: 'B minor'}}},
    {start: 2, end: 3, basicPitch: {summaryChord: null}}
  ];
  assert.equal(buildChordChart({recording: 'take.mp3', events}), [
    'take.mp3 — estimated guitar chords', '0.00–1.00 s  F  (F7?)', '1.00–2.00 s  Bm', '2.00–3.00 s  Uncertain'
  ].join('\n'));
});

test('song chart tolerates a weak extra pitch and refuses to invent a chord from successive single notes', async () => {
  const {songReading, buildTabDraft} = await import('./song.mjs');
  const row = {start:0, end:1, type:'Single note', notes:'C4', persistence:80, fit:60};
  const run = notes => {
    const result = comparePredictions([row], notes, 1);
    const event = result.events[0];
    event.songReading = songReading(event, result.basicPitchNotes);
    return result;
  };
  const r = run([48,52,55,58].map(m => predict(m,0,1)).concat({...predict(66,0,1), amplitude:0.09}));
  assert.equal(r.events[0].songReading.label, 'C7');
  const solo = run([predict(60,0,0.3),predict(64,0.35,0.3),predict(67,0.7,0.3)]);
  assert.equal(solo.events[0].songReading.kind, 'notes');
  r.events[0].reviewedLabel = 'C9';
  const draft = buildTabDraft(r);
  assert.equal(draft.events[0].label, 'C9');
  assert.equal(draft.events[0].reading.label, 'C7');
  assert.deepEqual(draft.notes[0].positions, [{string:5,fret:3},{string:6,fret:8}]);
  assert.match(buildChordChart(r), /C9/);
});
