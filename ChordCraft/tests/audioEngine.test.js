import test from 'node:test';
import assert from 'node:assert/strict';
import { chordMidiVoicing, midiToNote, strumSchedule, velocityForString } from '../src/audioEngine.js';

test('MIDI note conversion handles middle C and low guitar E', () => {
  assert.equal(midiToNote(60), 'C4');
  assert.equal(midiToNote(40), 'E2');
});

test('guitar voicings contain chord tones in a plausible guitar register', () => {
  const eMajor = { root: 4, notes: [4, 8, 11] };
  const notes = chordMidiVoicing(eMajor, 'Open / cowboy', 0);
  assert.ok(notes.length >= 3 && notes.length <= 6);
  const midi = notes.map(n => {
    const match = /^([A-G]#?)(-?\d+)$/.exec(n);
    const pcs = { C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11 };
    return (Number(match[2]) + 1) * 12 + pcs[match[1]];
  });
  assert.ok(midi.every(n => [4, 8, 11].includes(n % 12)));
  assert.ok(midi.every(n => n >= 35 && n <= 88));
});

test('capo changes physical open-string pitches while retaining chord tones', () => {
  const chord = { root: 2, notes: [2, 6, 9] };
  const notes = chordMidiVoicing(chord, 'Open / cowboy', 2);
  assert.ok(notes.length >= 3);
  const pcs = notes.map(n => ({C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11}[n.replace(/-?\d+$/, '')]));
  assert.ok(pcs.every(pc => chord.notes.includes(pc)));
});

test('strum schedule is staggered and velocities taper gently', () => {
  const times = strumSchedule(5, 'pop', 0.5);
  assert.equal(times.length, 5);
  assert.ok(times[0] < times[1] && times[1] < times[2]);
  assert.ok(velocityForString(0, 6) > velocityForString(5, 6));
});
