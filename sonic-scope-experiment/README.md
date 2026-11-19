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

Open [The Sonic Scope on localhost](http://127.0.0.1:8765/TheSonicScope.html). Select a recording and click **Analyze Tempo, Chroma, Key & Chords**. Under **Guitar chord analysis**, click **Analyze guitar chords**. The three-column summary opens first. **Copy comparison report** copies a compact table for sharing. **Export JSON** includes all note predictions and timing. Open **2E.18 note diagnostics** for the full 2E.18 report.

The initial npm install needs internet. The bundle and model files then load from localhost. The browser decodes the audio and downmixes to mono at 22.05 kHz, then sends the PCM to a local web worker for inference. The worker ends after each run or when the recording or event boundaries change. Transitive dependency resolution is currently unlocked. The bundle and model files are generated locally and excluded from Git.

## Read the comparison

- 2E.18 assigns notes to the existing event intervals. Its persistence and spectral fit apply to the event. Basic Pitch predicts individual notes with independent start/end times and mean activation scores. The two scores are heuristics on different scales.
- A model note joins an event if their overlap is at least 50 ms, or half the shorter duration when that duration is under 100 ms. A sustained note may appear in multiple rows. Octaves count as different MIDI pitches. JSON includes the full Basic Pitch list and marks notes outside the comparison windows.
- “2E.18 only” and “Basic Pitch only” are pitch disagreements relative to 2E.18. Human annotations determine which notes were actually missed or added.
- **Chord summary** prefers a more specific same-root reading when exactly one such alternative lasts at least 150 ms. Other exact pitch-class matches appear with their longest continuous overlap in milliseconds. Short overlaps can also come from transitions or spurious notes. Raw notes, timing and both detectors are available in the comparison views and export.
- The **Compare sustained overlap** view uses the longest uninterrupted interval whose active pitch classes form a power chord, major/minor triad, or dominant seventh. Dominant sevenths require the root, major third, and minor seventh. The fifth is optional. The minimum is 150 ms. **Whole event** uses all assigned pitches. Expand the note count for each row to inspect raw timing, activation, and MIDI-pitch disagreements. Both chord results are audio-derived estimates. Short chords, arpeggios, and extra pitches sustained alongside a chord can leave the sustained view blank.

## Verification and recording results

The unit tests cover MIDI disagreements, notes crossing event boundaries, overlapping versus successive notes, and the 2E.18 detector on a synthetic tone. Replaying the exported Testfile1 predictions gives E5 → D5 → A5 → E5 in the sustained view. The D5 candidate spans 1.950–2.544 s, after the brief opening E and B predictions in that event. The replay uses the existing export and does not rerun audio inference.

A fresh local CPU replay decoded the original recordings with FFmpeg, used stereo audio at 48 kHz for the application detectors and mono at 22.05 kHz for the built Basic Pitch worker. This exercises the detection code outside the interactive browser. Decoder and resampler differences can change event boundaries and short notes.

| Recording | Fresh replay |
| --- | --- |
| Testfile1.m4a | 4 events, 23 model notes. Both the consolidated baseline and chord summary returned E5, D5, A5, E5. |
| zoom006-mixture.mp3 | 7 events, 186 model notes. Consolidated roots gave G5, A5, B5, C5, D5, E5, F5. Chord summary gave G major, A minor, B5, C major, D major, E major, F major. Other evidence included B minor (104 ms) and E7 (35 ms). Replaying the saved browser export also revealed D7 (12 ms), which did not reproduce on fresh decoding. |
| GodDamn002.m4a | 32 events, 237 model notes. This exercises a denser recording. Many events lacked a sustained chord. No independently labeled reference was supplied for scoring accuracy. |

For routine checks, run the automated tests and reuse the existing recordings. A player only needs to audition a disputed voicing when deciding whether to trust a new chord label.

Use **Reference timing and validation** to audition and check attack boundaries. The supplied power-chord labels allow pitch-class scoring. Exact MIDI scoring requires the played voicings and verified onset times.

## Library and licence evaluation

- [Spotify Basic Pitch TypeScript](https://github.com/spotify/basic-pitch-ts) is Apache-2.0. The pinned package supplies the note model and JavaScript inference. Preserve the applicable licence texts and notices if redistributing the generated assets.
- [Essentia.js](https://github.com/MTG/essentia.js/) is AGPL-3.0. Its Spectrum/SpectralPeaks can provide independent spectral evidence, HPCP/KeyExtractor can check tonal estimates, and [RhythmExtractor2013](https://essentia.upf.edu/reference/std_RhythmExtractor2013.html) can compare tempo and beat positions with 44.1 kHz input. These are candidate feature checks. They do not establish the sounded pitches in each guitar voicing. An MIT-licensed project can contain MIT code in an AGPL-covered combined distribution, but distributing a combined work would require applicable AGPL terms and source availability. This branch keeps its MIT distribution and does not bundle or call Essentia.js. An independent Essentia.js benchmark with known chord and beat timings remains future work.

## Independent Chordino benchmark

The timestamp in each **Chord summary** row plays that interval. Use the usual playback controls to pause, resume or stop. The quick report and JSON export still include both browser detectors.

The optional local benchmark runs the audioJS implementation of Chordino and NNLS Chroma, both version 1.0.0. It uses bass and treble pitch-class features and a chord-sequence model. Those features provide an independent comparison with Basic Pitch's note transcription. Upstream credits Matthias Mauch and Chris Cannam for the reference plugin. Both JavaScript packages declare GPL-2.0-or-later. The optional CLI installs them from npm. Their implementation, model profiles and assets are excluded from the browser build. [Original Chordino](https://isophonics.net/nnls-chroma) · [JavaScript implementation and licence](https://audio.js.org/modules/mir-chordino/)

Run from the experimental checkout with FFmpeg on PATH (or set FFMPEG to the executable) and Node 22:

```sh
cd sonic-scope-experiment/benchmark
npm ci --ignore-scripts
node benchmark.mjs "/path/to/recording.mp3" "/path/to/comparison.json" > result.json
```

The export is optional. With audio alone, the CLI returns the independent chord sequence. With the matching Sonic Scope export it also reports the Chordino label covering the most time in each existing event, and recomputes the Basic Pitch summary on Chordino's boundaries. The latter reuses the exported note predictions. Short windows near changes may include notes from the adjacent chord. Intervals and confidence are model estimates.

| Recording | Independent benchmark |
| --- | --- |
| zoom006-mixture.mp3 | After a brief opening no-chord interval, Chordino returned G, Am, B, C, D, E, F. All seven roots matched the supplied order. Three of seven chord qualities matched. Reusing the saved Basic Pitch predictions on these boundaries gave G, Am, B5, C, D, E, F. |
| Testfile1.m4a | Chordino returned E, D, A, E as major chords. Basic Pitch on the same windows returned the four expected power chords. |
| GodDamn002.m4a | Chordino produced 15 labeled spans after the initial no-chord interval. The recording has no independently supplied chord sequence for scoring. |

These runs use FFmpeg mono decoding at 22050 Hz and the packages' default parameters. The known chord order was used only when comparing results. Changing event boundaries alone did not recover the three dominant sevenths in the seven-chord take.
