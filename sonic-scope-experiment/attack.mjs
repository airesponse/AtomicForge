// Check a model-estimated major triad against the audio at its event boundary.
const roots = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function attackSeventh(buffer, event, fft) {
  const root = roots.indexOf(event.basicPitch.summaryChord?.chord?.split(' ')[0]);
  if (root < 0 || event.basicPitch.summaryChord.chord !== roots[root] + ' major') return null;
  const rate = buffer.sampleRate;
  const width = Math.round(0.12 * rate);
  const size = 2 ** Math.ceil(Math.log2(width * 2));
  const hop = Math.round(0.025 * rate);
  const real = new Float64Array(size), imag = new Float64Array(size);
  const window = Float64Array.from({length: width}, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (width - 1)));
  const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i));
  const stop = Math.min(buffer.length, Math.floor(Math.min(event.end, event.start + 0.45) * rate));
  let previous = null;
  for (let start = Math.max(0, Math.ceil(event.start * rate - width / 2)); start + width <= stop; start += hop) {
    real.fill(0); imag.fill(0);
    for (const samples of channels) {
      for (let i = 0; i < width; i++) real[i] += samples[start + i] * window[i];
    }
    fft(real, imag);
    const limit = Math.min(size / 2 - 1, Math.ceil(700 * size / rate));
    const magnitudes = Float64Array.from({length: limit + 2}, (_, i) => Math.hypot(real[i], imag[i]));
    const peaks = new Float64Array(128);
    let maximum = 0;
    for (let i = Math.ceil(65 * size / rate); i <= limit; i++) {
      const level = magnitudes[i];
      maximum = Math.max(maximum, level);
      if (level <= magnitudes[i-1] || level < magnitudes[i+1]) continue;
      const pitch = 69 + 12 * Math.log2(i * rate / size / 440);
      const midi = Math.round(pitch);
      if (Math.abs(midi - pitch) < 0.35) peaks[midi] = Math.max(peaks[midi], level);
    }
    const strongest = pc => {
      let best = pc;
      for (let m = pc; m <= 76; m += 12) if (peaks[m] > peaks[best]) best = m;
      return best;
    };
    const seventh = strongest((root + 10) % 12);
    if (maximum > 0 && [strongest(root), strongest((root + 4) % 12), seventh].every(m => peaks[m] >= maximum * 0.15)) {
      if (previous?.midi === seventh) return {chord: roots[root] + '7', seventhMidi: seventh, start: previous.start / rate, end: (start + width) / rate};
      previous = {midi: seventh, start};
    } else previous = null;
  }
  return null;
}
