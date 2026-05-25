# SlopScale

A Slopsmith plugin that generates scale, arpeggio, and sweep-arpeggio practice routines and renders them inside the plugin on a 3D note highway, 2D highway, or 2D tablature view. Pick a pathway, hit Generate, play along.

## Highlights

- **Pathway selector** — curated routines (Pentatonic Foundation, Chord-Tone Targeting, Modal Awareness, Diatonic Triad Drill, Seventh Vocabulary, ii–V–I Workout, Harmonic Minor Exotic, **Sweep Arpeggio Primer**) plus full Custom mode
- **Standard sweep shapes** — Sweep Arpeggio Primer builds proper one-note-per-string sweeps, anchored to the root on the bass string, with a hammer-on / pull-off turnaround at the apex
- **Smart fret range** — selecting a CAGED shape + key auto-sets First Fret / Last Fret to the correct position window; CAGED single-shape run spans two octaves up the neck
- **Three render modes** — 3D Note Highway, 2D Highway, 2D Tablature
- **Generated audio** — synthesised notes, metronome with grouped accents, harmony backing voiced from the progression

## Routine configuration

### Key & scale
- 12 keys
- 11 scale families: Major, Natural Minor, Harmonic Minor, Minor Pentatonic, Major Pentatonic, Blues, Dorian, Phrygian, Mixolydian, Lydian, Locrian

### Instruments & tuning
- 6-string guitar (Standard, Drop D), 7- and 8-string guitar
- 4- and 5-string bass

### Tempo & meter
- 30–260 BPM
- 4/4, 3/4, 6/8, 7/8 (2+2+3 or 3+2+2), 5/4
- Quarter, eighth, sixteenth, triplet, eighth triplet, sixteenth triplet

### Practice types
- **Scale pattern** — run the selected scale across the fretboard system
- **Chord scales** — mode-of-the-moment OR chord-tone-emphasis through the progression
- **Diatonic arpeggios** — triad or seventh arpeggio of every diatonic chord
- **Progression arpeggios** — chord-tone arpeggios over the chosen progression
- **Sweep arpeggios** — one chord tone per string, swept low-to-high with HOPO turnaround, then back down

## Fretboard systems

- **Position box** — manual First/Last fret pair
- **3-notes-per-string**
- **CAGED position** — auto-computes the position window for the selected key + CAGED shape (C/A/G/E/D)
- **CAGED single-shape run** — same starting position, extended range so the same shape runs up the neck through its next octave
- **Single-string run** — pick a single string and walk the scale along it
- **Full-neck map** — every scale note from fret 0–24

Selecting a CAGED mode or changing the key/shape automatically updates the First Fret / Last Fret inputs so the exercise lands where the shape actually lives on the neck. Generated scale runs start on the root note when a CAGED system is selected.

## Progressions

Diatonic I–ii–iii–IV–V–vi–vii°, I–IV–V, I–V–vi–IV, I–vi–IV–V, I–vi–ii–V, ii–V–I, vi–ii–V–I, I–iii–IV–V, I–IV–vi–V, I–ii–IV–V, vi–IV–I–V, Pachelbel, diatonic circle, 12-bar blues, quick-change blues, minor i–VI–III–VII, minor i–VII–VI–VII, minor ii–V–i.

Chord depth: triads or seventh chords. Optional global override to force every chord to maj / min / dim / maj7 / min7 / dom7 / m7b5 / sus4 / add9.

## Renderers

| Renderer | Description |
|---|---|
| **3D Note Highway** | Slopsmith's existing 3D highway, loaded on demand |
| **2D Highway** | Built-in horizontal scrolling highway with string-coloured note tiles, sustain bars, accent halos, HOPO / palm-mute / harmonic / dead / bend glyphs, beat lines, measure numbers, chord tiles, backing-chord row, section markers, and anchor zones |
| **2D Tablature** | Built-in Guitar-Pro-style tab staff with fret numbers on the string lines, bar lines, chord names above the staff, technique characters, sustain ties, and a red playhead |

If the 3D Highway script isn't available at runtime, the plugin falls back to the 2D Highway automatically.

## Generated audio

- **Notes** — synthesised plucked-string preview at the actual fret + string positions
- **Metronome** — accent on beat 1, group accents follow the meter grouping (3+2+2 vs 2+2+3 for 7/8, etc.)
- **Harmony backing** — voiced backing chord per progression step, key-aware

## Persistence

- **Save Preset** — routine settings stored under `<config>/plugin_data/slopscale/presets.json`. Favourites appear in the pathway dropdown.

## Quick start

### Prerequisites
- A working Slopsmith install (web/Docker or Desktop)
- Write access to Slopsmith's `plugins/` directory

### Install (Slopsmith web/Docker)

```bash
cd /path/to/slopsmith/plugins
git clone https://github.com/ChrisBeWithYou/slopsmith-plugin-slopscale.git slopscale
docker compose restart
```

### Install (Slopsmith Desktop)

Clone into the Desktop app's configured plugins directory (visible in **Settings → Plugins**).

> **Note:** Do not clone directly under `C:\Program Files\Slopsmith`. Windows protects that path; clone into the user-writable plugins directory the Desktop app reports in Settings.

After restart, **SlopScale** appears in the plugin navigation.

## Test routines

### Simplest scale chart
```text
Pathway:       Custom
Practice type: Scale pattern
Key: C   Scale: Major
Instrument: 6-string guitar standard
BPM: 100   Meter: 4/4   Division: Eighth
First fret: 0   Last fret: 5   Bars: 4
```
Expected: a C major run from fret 0 to fret 5 scrolling on the highway.

### Sweep Arpeggio Primer
```text
Pathway: Sweep Arpeggio Primer
```
Expected: pathway auto-fills A natural minor (or one of the variants), 70 BPM 4/4 sixteenths, I–IV–V progression. Each bar plays a triad swept low E → high e, hammers to the next chord tone on the high string, pulls back, then sweeps high e → low E.

### CAGED single-shape run
```text
Pathway:          Custom
Fretboard system: CAGED single-shape run up the neck
CAGED shape:      E
Key:              G   Scale: Major
```
Expected: First Fret / Last Fret auto-populate around fret 2–19 (E-shape root for G is fret 3, plus two positions up). Scale notes ascend through the run starting on G.

## File layout

| File | Purpose |
|------|---------|
| `plugin.json` | Slopsmith plugin manifest |
| `screen.html` | Plugin UI (markup + inline styles + bootstrap scripts) |
| `screen.js` | Practice generator + built-in renderers |
| `routes.py` | Preset persistence and temporary chart-export backend |
| `settings.html` | Plugin settings / info panel |
| `static/slopscale.css` | External stylesheet |
| `docs/architecture.md` | Integration design notes |
| `docs/exercise-schema.md` | Internal generated exercise schema |
| `docs/practice-pedagogy.md` | Background notes on the curated pathways |

## Implementation status

**Implemented**
- Plugin manifest, screen UI, settings panel
- Pathway selector with 8 curated routines + Custom
- Scale, chord-scale (mode-of-moment + chord-tone-emphasis), diatonic arpeggio, progression arpeggio, and sweep arpeggio generators
- Sweep arpeggio primer: standard shapes, root-anchored bass string, HOPO turnaround on apex string
- Fretboard systems: Position, 3NPS, CAGED position, CAGED single-shape run, single-string, full-neck
- CAGED-aware fret range auto-computation per key + shape
- Root-note-first ordering for CAGED systems
- Three renderers: 3D Note Highway (delegated to host), built-in 2D Highway, built-in 2D Tablature
- Generated preview audio: notes, metronome, harmony backing
- Preset save / list / delete

**Roadmap — near term**
- Picking metadata (alternate / economy / sweep) attached to generated note groups
- More sequence patterns (groups of 3s, diatonic-thirds variations, custom melodic cells)
- Practice tracking (tempo ceiling, streak, "next session" recommendation)
- Live fretboard panel showing currently-active notes
- Count-in / loop sections

**Roadmap — later**
- Inversions and shell voicings
- Nearest-note voice leading between progression steps
- Import / export routine JSON
- Piano / keyboard exercises (scales, arpeggios, chord-tone targeting on a piano-roll surface)
