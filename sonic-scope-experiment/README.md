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

Open [The Sonic Scope on localhost](http://127.0.0.1:8765/TheSonicScope.html). Select a recording and click **Analyze Tempo, Chroma, Key & Chords**. Under **Chord testing**, click **Compare 2E.18 and Basic Pitch**. **Copy comparison report** copies a compact table for sharing. **Export JSON** includes all note predictions and timing. Open **2E.18 note diagnostics** for the full 2E.18 report.

The initial npm install needs internet. The bundle and model files then load from localhost. The browser decodes the audio and downmixes to mono at 22.05 kHz, then sends the PCM to a local web worker for inference. The worker ends after each run or when the recording or event boundaries change. Transitive dependency resolution is currently unlocked. The bundle and model files are generated locally and excluded from Git.

## Read the comparison

- 2E.18 assigns notes to the existing event intervals. Its persistence and spectral fit apply to the event. Basic Pitch predicts individual notes with independent start/end times and mean activation scores. The two scores are heuristics on different scales.
- A model note joins an event if their overlap is at least 50 ms, or half the shorter duration when that duration is under 100 ms. A sustained note may appear in multiple rows. Octaves count as different MIDI pitches. JSON includes the full Basic Pitch list and marks notes outside the comparison windows.
- “2E.18 only” and “Basic Pitch only” are pitch disagreements relative to 2E.18. Human annotations determine which notes were actually missed or added.
- The default **Sustained overlap** view uses the longest uninterrupted interval whose active pitch classes form a power chord or major/minor triad. The minimum is 150 ms. **Whole event** uses all assigned pitches. Expand the note count for each row to inspect raw timing, activation, and MIDI-pitch disagreements. Both chord results are audio-derived estimates. Short chords, arpeggios, and extra pitches sustained alongside a chord can leave the sustained view blank.

## Verification and recording results

The unit tests cover MIDI disagreements, notes crossing event boundaries, overlapping versus successive notes, and the 2E.18 detector on a synthetic tone. Replaying the exported Testfile1 predictions gives E5 → D5 → A5 → E5 in the sustained view. The D5 candidate spans 1.950–2.544 s, after the brief opening E and B predictions in that event. The replay uses the existing export and does not rerun audio inference.

Use **Reference timing and validation** to audition and check attack boundaries. The supplied power-chord labels allow pitch-class scoring. Exact MIDI scoring requires the played voicings and verified onset times.

## Library and licence evaluation

- [Spotify Basic Pitch TypeScript](https://github.com/spotify/basic-pitch-ts) is Apache-2.0. The pinned package supplies the note model and JavaScript inference. Preserve the applicable licence texts and notices if redistributing the generated assets.
- [Essentia.js](https://github.com/MTG/essentia.js/) is AGPL-3.0. Its Spectrum/SpectralPeaks can provide independent spectral evidence, HPCP/KeyExtractor can check tonal estimates, and [RhythmExtractor2013](https://essentia.upf.edu/reference/std_RhythmExtractor2013.html) can compare tempo and beat positions with 44.1 kHz input. These are candidate feature checks. They do not establish the sounded pitches in each guitar voicing. An MIT-licensed project can contain MIT code in an AGPL-covered combined distribution, but distributing a combined work would require applicable AGPL terms and source availability. This branch keeps its MIT distribution and does not bundle or call Essentia.js. An independent Essentia.js benchmark with known chord and beat timings remains future work.
