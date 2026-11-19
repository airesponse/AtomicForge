import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';

const onsetThreshold = 0.25;
const frameThreshold = 0.25;
const minimumNoteFrames = 5;

self.onmessage = async ({ data: samples }) => {
  try {
    const modelUrl = new URL('./model/model.json', self.location.href).href;
    const engine = new BasicPitch(modelUrl);
    const frames = [];
    const onsets = [];
    await engine.evaluateModel(samples, (frameBatch, onsetBatch) => {
      frames.push(...frameBatch);
      onsets.push(...onsetBatch);
    }, fraction => self.postMessage({ fraction }));
    const notes = noteFramesToTime(outputToNotesPoly(
      frames, onsets, onsetThreshold, frameThreshold, minimumNoteFrames
    ));
    self.postMessage({ notes, settings: { onsetThreshold, frameThreshold, minimumNoteFrames } });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
