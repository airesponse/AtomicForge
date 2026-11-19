import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import { setBackend } from '@tensorflow/tfjs';

const onsetThreshold = 0.25;
const frameThreshold = 0.25;
const minimumNoteFrames = 5;

self.onmessage = async ({ data: samples }) => {
  try {
    self.postMessage({ phase: 'loading' });
    // Avoid a WebGL shader stall or context loss in a browser worker.
    if (!await setBackend('cpu')) throw new Error('Could not start the Basic Pitch CPU backend.');
    const modelUrl = new URL('./model/model.json', self.location.href).href;
    const engine = new BasicPitch(modelUrl);
    await engine.model;
    self.postMessage({ phase: 'first-window' });
    const frames = [];
    const onsets = [];
    await engine.evaluateModel(samples, (frameBatch, onsetBatch) => {
      frames.push(...frameBatch);
      onsets.push(...onsetBatch);
    }, fraction => {
      if (fraction > 0 && fraction < 1) self.postMessage({ fraction });
    });
    self.postMessage({ phase: 'decoding' });
    const notes = noteFramesToTime(outputToNotesPoly(
      frames, onsets, onsetThreshold, frameThreshold, minimumNoteFrames
    ));
    self.postMessage({ notes, settings: { onsetThreshold, frameThreshold, minimumNoteFrames } });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
