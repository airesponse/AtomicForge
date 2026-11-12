# ChordCraft v3 — Songwriting Studio

A responsive songwriting workspace for guitarists, built with React and Vite.

## Features
- Major/minor key and scale selection, tempo, section labels, and groove feel
- Progression builder with Roman numerals, chord colour substitutions, bar lengths, reordering, and removal
- Preset progression inspiration and random generation
- Sampled General MIDI playback with multiple instruments and two selectable soundfont banks (FluidR3 GM / MusyngKite)
- Guitar-aware chord voicings generated from standard tuning and capo position
- More natural note-by-note strumming, arpeggio timing, velocity shaping, room ambience, and output compression
- Adjustable room ambience and saved audio-library preference
- Guitar playing-feel choices: downstrokes, pop/rock, folk eighths, half-time, arpeggiated
- Guitar setup controls: capo, open/barre/triad/power-chord display, chord shape diagram
- Optional root-note bass support
- Contextual theory notes and borrowed-chord suggestions
- Save/load ideas in local storage, separate song-section snapshots, A/B comparisons
- Export chord sheets, JSON projects, and a basic MIDI file
- Responsive dark studio interface

## Run locally
Requires Node.js 18+.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## GitHub Pages
The repository's `Deploy AtomicForge to GitHub Pages` workflow builds ChordCraft at the project root and publishes the standalone AtomicForge tools alongside it whenever changes are pushed to `main`. The first time, set the repository's Pages source to **GitHub Actions** in **Settings → Pages**.

- ChordCraft v3: `https://airesponse.github.io/AtomicForge/`

The Vite config uses the repository subpath for the Pages build and the root path for local development. To create a Pages-ready build manually, run `GITHUB_PAGES=true npm run build` from this directory.

## Audio quality and licensing
Audio uses `soundfont-player` with remotely loaded FluidR3 GM or MusyngKite samples. A network connection is needed when a new instrument/sample bank is first loaded. v3 improves guitar voicing selection using standard tuning, capo-aware pitch selection, staggered strums, velocity shaping, a generated room-ambience impulse, and output compression. This remains a sample-based prototype, not a dedicated commercial guitar library: the source soundfonts have limited guitar articulations, no true round-robin picking or string-specific sample sets, and browser playback timing varies. For production-grade guitar realism, use explicitly licensed multi-velocity guitar recordings with pick/finger articulations and round-robin samples.

## MIDI
The MIDI export creates a basic single-track chord arrangement with tempo metadata. Verify the exported MIDI in your target DAW before relying on it for a finished session. Guitar-specific voicing export and separate bass/percussion tracks are future improvements.

## Important scope note
Chord diagrams are helpful shape guides and are not guaranteed to be physically correct for every altered chord or capo/key combination. Always verify the fingering. The capo control is an educational/playback aid in this prototype rather than a full guitar fretboard engine.

## Test the pure audio helpers

```bash
npm test
```

## Suggested next steps
- Add automated tests for harmony and MIDI generation
- Add an editable fretboard with exact voicing/fingering generation
- Add separate MIDI tracks for chords, bass, melody, and percussion
- Add licensed premium sample packs, velocity layers, articulations and caching
- Add cloud sync / portable project import
- Add more advanced harmony tools: secondary dominants, borrowed chords, modulation and modal interchange
- Add a rhythm editor with adjustable strum pattern grids and humanization

## Libraries
React, Vite, soundfont-player, Lucide React. Review each dependency and soundfont's license and terms before redistributing assets.
