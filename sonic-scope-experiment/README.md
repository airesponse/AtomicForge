# Sonic Scope Basic Pitch experiment

This branch starts from AtomicForge's committed Sonic Scope development snapshot (3a6d48c) and brings in the recovered 2E.18 HTML. The 2E.18 detector, playback, segmentation and diagnostic report remain available. The experiment adds a separate comparison panel. The AtomicForge licence remains MIT. Run this checkout locally.

## Run locally

From the root of the experimental checkout, with Node.js 22 and Python 3 installed:

```sh
npm --prefix sonic-scope-experiment install --no-package-lock --no-audit --no-fund
npm --prefix sonic-scope-experiment run build
npm --prefix sonic-scope-experiment test
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [The Sonic Scope on localhost](http://127.0.0.1:8765/TheSonicScope.html). Select a recording and click **Analyze Tempo, Chroma, Key & Chords**. In the 2E.18 panel, click **Compare 2E.18 and Basic Pitch**. Use **Export comparison JSON** for the combined results or **Copy complete diagnostic report** for the original 2E.18 report. Use Stop to end playback and Ctrl+C in Terminal to stop the local server.

The initial npm install needs internet. The bundle and model files then load from localhost. The browser decodes the audio and downmixes to mono at 22.05 kHz, then sends the PCM to a local web worker for inference. The worker ends after each run or when the recording or event boundaries change. Transitive dependency resolution is currently unlocked. The bundle and model files are generated locally and excluded from Git.

## Read the comparison

- 2E.18 assigns notes to the existing event intervals. Its persistence and spectral fit apply to the event. Basic Pitch predicts individual notes with independent start/end times and mean activation scores. The two scores are heuristics on different scales.
- A model note joins an event if their overlap is at least 50 ms, or half the shorter duration when that duration is under 100 ms. A sustained note may appear in multiple rows. Octaves count as different MIDI pitches. JSON includes the full Basic Pitch list and marks notes outside the comparison windows.
- “2E.18 only” and “Basic Pitch only” are pitch disagreements relative to 2E.18. Human annotations determine which notes were actually missed or added.
- Chord candidates are inferred by matching the notes' pitch classes to a power chord or major/minor triad. Octave duplicates are ignored for the chord label. This can label notes that arrived sequentially in the same segment as a chord. Short strums, overlapping decay, distortion, harmonics, downmix cancellation and segmentation errors can all affect the comparison.

## Verification and recording results

| Input | 2E.18 | Basic Pitch |
| --- | --- | --- |
| Synthetic 196 Hz tone with harmonics | Detected G3 in the Node baseline test | No inference run |
| Simulated octave-disagreement fixture | E2 + B2, E5 candidate | Fixture supplies E2 + B3, E5 candidate. Export identifies B2 as 2E.18-only and B3 as Basic Pitch-only |
| Testfile1.m4a | Expected progression supplied by the player is E5 → D5 → A5 → E5 | Recording download failed in this session |
| GodDamn002.m4a | Earlier 2E.18 diagnostic reported 32 events and zero uncertain. These are historical predictions | Recording download failed in this session |

Three Node tests passed. They cover note matching, event overlap, export data and execution of the actual baseline on synthetic audio. The experiment requires a successful package install, browser inference and a run on both recordings before drawing any accuracy conclusions. The session could not reach the npm registry or download either recording.

For Testfile1, audition the four attacks and verify their boundaries in **Advanced — Manual Ground Truth & Detector Validation**. Power-chord labels establish the expected root and fifth pitch classes. Exact MIDI scoring also requires the played voicing and verified onset times. For GodDamn002, annotate the sounded pitches and onset/offset times before computing accuracy. Use the raw model notes to inspect notes skipped by the baseline segmentation.

## Library and licence evaluation

- [Spotify Basic Pitch TypeScript](https://github.com/spotify/basic-pitch-ts) is Apache-2.0. The pinned package supplies the note model and JavaScript inference. Preserve the applicable licence texts and notices if redistributing the generated assets.
- [Essentia.js](https://github.com/MTG/essentia.js/) is AGPL-3.0. Its Spectrum/SpectralPeaks can provide independent spectral evidence, HPCP/KeyExtractor can check tonal estimates, and [RhythmExtractor2013](https://essentia.upf.edu/reference/std_RhythmExtractor2013.html) can compare tempo and beat positions with 44.1 kHz input. These are candidate feature checks. They do not establish the sounded pitches in each guitar voicing. An MIT-licensed project can contain MIT code in an AGPL-covered combined distribution, but distributing a combined work would require applicable AGPL terms and source availability. This branch keeps its MIT distribution and does not bundle or call Essentia.js. An independent Essentia.js benchmark with known chord and beat timings remains future work.
