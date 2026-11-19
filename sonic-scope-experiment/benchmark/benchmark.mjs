import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { comparePredictions } from '../compare.mjs';
import chromagram from '@audio/mir-nnls-chroma';
import chordino from '@audio/mir-chordino';

const [audioPath, reportPath] = process.argv.slice(2);
if (!audioPath) throw new Error('Usage: node benchmark.mjs recording [comparison.json]');
const fs = 22050;
const decode = spawnSync(process.env.FFMPEG || 'ffmpeg', [
  '-v', 'error', '-nostdin', '-i', resolve(audioPath), '-vn', '-ac', '1',
  '-ar', String(fs), '-f', 'f32le', 'pipe:1'
], { maxBuffer: 128 * 1024 * 1024 });
if (decode.error) throw decode.error;
if (decode.status !== 0 || !decode.stdout.length) throw new Error(decode.stderr.toString() || 'Audio decode failed');
const pcm = decode.stdout;
const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const duration = samples.length / fs;
const chords = chordino(chromagram(samples, { fs }), { end: duration });
const recording = basename(audioPath);
let events;
let independentWindows;
if (reportPath) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (report.recording !== recording || !Number.isFinite(report.durationSeconds) ||
      Math.abs(report.durationSeconds - duration) > 0.2 || !Array.isArray(report.events)) {
    throw new Error('The comparison export must match the recording name and duration.');
  }
  if (!Array.isArray(report.basicPitchNotes)) throw new Error('The export needs the raw Basic Pitch notes.');
  // Re-segment the same predictions using the external recognizer's change times.
  const windows = chords.map(chord => ({ start: chord.time, end: chord.time + chord.duration, type: 'Uncertain', notes: '' }));
  const predictions = report.basicPitchNotes.map(note => ({
    pitchMidi: note.midi, startTimeSeconds: note.start, durationSeconds: note.end - note.start, amplitude: note.confidence
  }));
  independentWindows = comparePredictions(windows, predictions, duration).events.map((event, index) => ({
    start: event.start, end: event.end, chordino: chords[index].label,
    basicPitch: event.basicPitch.summaryChord?.chord ?? null, otherEvidence: event.basicPitch.qualityEvidence
  }));
  events = report.events.map(({start, end, baseline, basicPitch}) => {
    // The label occupying the most time wins even when it returns in several spans.
    const seconds = new Map();
    for (const chord of chords) {
      const overlap = Math.min(end, chord.time + chord.duration) - Math.max(start, chord.time);
      if (overlap > 0) seconds.set(chord.label, (seconds.get(chord.label) ?? 0) + overlap);
    }
    const winner = [...seconds].sort((a, b) => b[1] - a[1])[0];
    return {start, end, baselineNotes: baseline.midi, basicPitch: (basicPitch.summaryChord ?? basicPitch.sustainedChord)?.chord ?? null,
      chordino: winner?.[0] ?? null, overlapSeconds: winner?.[1] ?? 0};
  });
}
console.log(JSON.stringify({ recording, duration, sampleRate: fs, chords, events, independentWindows }, null, 2));
