# SlopScale

A Slopsmith plugin that generates scale, arpeggio, and sweep-arpeggio practice routines and renders them on a 3D note highway, 2D highway, paper-style tab, or staff notation. Pick a pathway, hit Play, drill.

## Highlights

- **Four render modes** — 3D Note Highway, 2D Highway, paper-style Tab, and staff Notation — all driven by the same chart data
- **Light & Dark themes** for Tab and Notation, with a toggle in the view switcher
- **Bass / Guitar / Piano** instrument selector at the top of the form (piano coming soon)
- **Strings & tuning** controls right under the instrument family — 4/5/6 strings for bass, 6/7/8 for guitar, plus standard / drop / open tunings and a custom per-string editor
- **Save custom tunings** to the Slopsmith database; they show up under "Saved" in the tuning dropdown on every restart
- **Count-in** — optional 1, 2, or 4-bar metronome before playback starts
- **Share links** — every form state is encoded in the URL; copy the link and a friend lands on the exact same exercise
- **Pathway selector** — twelve curated routines (Pentatonic Foundation, Chord-Tone Targeting, Modal Awareness, Diatonic Triad Drill, Seventh Vocabulary, ii–V–I Workout, Harmonic Minor Exotic, Sweep Arpeggio Primer, and more) plus full Custom mode
- **DB-backed presets** — Save preset persists routines to the host DB (no more JSON file)

## Renderers

| Renderer | What it looks like |
|---|---|
| **3D Note Highway** | Slopsmith's bundled 3D fretboard view, loaded on demand |
| **2D Highway** | Built-in horizontal scrolling highway with string-coloured note tiles, sustain bars, accent halos, HOPO / palm-mute / harmonic / bend glyphs, beat lines, measure numbers, chord tiles, and section markers |
| **Tab** | Paper-style guitar tab — parchment background, six black string lines, fret numbers sitting on the strings with the line broken behind each digit, italic chord names, plain bar lines, red playhead. Dark mode swaps to a navy ground |
| **Notation** | Standard staff notation with treble or bass clef (8va transposing), key signature, note heads, stems, beams, ledger lines, accidentals — same parchment-and-ink design language as Tab. Dark mode available |

The Light/Dark toggle appears on the right side of the view switcher when Tab or Notation is active. Choice persists across reloads. If the 3D Highway script isn't available at runtime, the plugin falls back to the 2D Highway automatically. Switching to bass also auto-falls back to 2D since the host's 3D Highway plugin doesn't render non-6-string instruments.

## Practice modes

### Single exercise

- **Pathway** — pick one of twelve curated routines, or "Custom — full control"
- **Speed tier** — Slow / Med / Fast / Push per pathway (tempo curves are pathway-specific)
- **Key, scale, shape, BPM, count-in** — exposed in the form
- **Custom mode** unlocks the advanced controls (meter, division, sequence, progression, chord depth, chord-scale strategy, chord override, key cycling)

### Session

A multi-segment program. Each segment is its own exercise config; the whole session plays back-to-back. Four built-in sessions:

- **ii–V–I Workshop** — structured jazz pedagogy sequence (guide tones, chord-scales, arpeggios)
- **Daily 30-min Intermediate**
- **Blues Fundamentals**
- **Bebop Fundamentals**

## Configuration

### Key & scale
- 12 keys
- 25+ scale families: major, natural/harmonic/melodic minor, the seven modes of major, melodic-minor modes (Dorian ♭2, Lydian augmented, Lydian dominant, Mixolydian ♭6, Locrian ♮2, altered), minor and major pentatonic, blues, bebop major and dominant, whole-tone, diminished (whole-half), Phrygian dominant

### Instruments & tuning
- **Bass** — 4 / 5 / 6 strings, with Standard, Drop D, Eb Standard, BEAD (4), high-C tenor (5), Drop A (5)
- **Guitar** — 6 / 7 / 8 strings, with Standard, Drop D, Eb Standard, D Standard, DADGAD, Open G, Open D (6), Drop A (7), Drop E (8)
- **Custom tuning** — per-string note inputs (`E2`, `F#3`, `Bb4` style). Click **+ Save tuning…** to persist it under a name; it reappears under "Saved" in the dropdown every session
- **Piano** — UI scaffolded, generators not yet emitting keyboard data

### Tempo & meter
- 30–260 BPM
- 4/4, 3/4, 6/8, 7/8 (2+2+3 or 3+2+2), 5/4
- Quarter, eighth, sixteenth, triplet, eighth-triplet, sixteenth-triplet
- **Count-in:** None / 1 bar / 2 bars / 4 bars before playback starts

### Practice types
- **Scale pattern** — run the selected scale across the fretboard system
- **Chord scales** — mode-of-the-moment OR chord-tone-emphasis through the progression
- **Diatonic arpeggios** — triad or seventh arpeggio of every diatonic chord
- **Progression arpeggios** — chord-tone arpeggios over the chosen progression
- **Sweep arpeggios** — one chord tone per string, swept low → high with HOPO turnaround, then back down
- **Chromatic warmup** — 1234, 4321, 1324, spider, and advanced patterns
- **Guide tones** — 3rds / 7ths / alternating, voice-led through any progression

## Fretboard systems

- **CAGED position** — auto-computes the fret window for the selected key + CAGED shape (C/A/G/E/D), with proper open-position fingerings on E/A/G shapes
- **CAGED single shape — strict ascend** — literal CAGED fingering geometry transposed per chord, marching up the neck
- **CAGED single shape — closest position** — same shape, but each chord picks the nearest fret so the hand moves both up and down
- **3-notes-per-string** — seven positions, modally named (Position 1 Ionian, Position 2 Dorian, …)
- **Open position** — uses open strings where the key supports them
- **Position box** — manual First/Last fret pair
- **Single-string run** — pick a string and walk the scale along it
- **Full-neck map** — every scale note from fret 0–24

Selecting a CAGED mode or changing the key/shape automatically updates the fret window so the exercise lands where the shape actually lives on the neck. Scale runs in CAGED systems start on the root note.

## Progressions

Diatonic I–ii–iii–IV–V–vi–vii°, I–IV–V, I–V–vi–IV, I–vi–IV–V, I–vi–ii–V, ii–V–I, vi–ii–V–I, I–iii–IV–V, I–IV–vi–V, I–ii–IV–V, vi–IV–I–V, Pachelbel, diatonic circle, 12-bar blues, quick-change blues, minor i–VI–III–VII, minor i–VII–VI–VII, minor ii–V–i.

Chord depth: triads or seventh chords. Optional global override to force every chord to maj / min / dim / maj7 / min7 / dom7 / m7b5 / sus4 / add9.

## Generated audio

- **Notes** — synthesised plucked-string preview at the actual fret + string positions
- **Metronome** — accent on beat 1; group accents follow the meter grouping (3+2+2 vs 2+2+3 for 7/8, etc.)
- **Harmony backing** — voiced backing chord per progression step, key-aware

## Persistence

- **Save preset** — full routine config stored in the Slopsmith SQLite database (`slopscale_presets` table)
- **Save tuning** — custom tunings stored in `slopscale_tunings`. Appear in the tuning dropdown under "Saved" on every restart
- **Share link** — `Copy share link` writes the entire form state to a URL hash. Paste a link into the "Paste a share link here…" field below to restore the exact exercise

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
Expected: the pathway auto-fills A natural minor (or one of the variants), 70 BPM 4/4 sixteenths, I–IV–V progression. Each bar plays a triad swept low E → high e, hammers to the next chord tone on the high string, pulls back, then sweeps high e → low E.

### CAGED single-shape run
```text
Pathway:          Custom
Practice type:    Diatonic arpeggios
Fretboard system: CAGED single shape — strict ascend
CAGED shape:      C
Key:              C   Scale: Major
```
Expected: diatonic triads (I–ii–iii–IV–V–vi–vii°–I) arpeggiated in the C shape up the A string — C at fret 3, Dm at fret 5, Em at fret 7, F at fret 8, G at fret 10, Am at fret 12, Bdim at fret 14, C at fret 15. The highway anchor scrolls with each chord.

### Custom tuning (DADGAD with count-in)
```text
Instrument:  Guitar
Strings:     6
Tuning:      DADGAD
Count-in:    2 bars
Practice type: Scale pattern
Key: D   Scale: Major
```
Expected: 2 bars of metronome click, then a D major scale run in DADGAD tuning across the open position.

## File layout

| File | Purpose |
|------|---------|
| `plugin.json` | Slopsmith plugin manifest |
| `screen.html` | Plugin UI (markup + inline styles + bootstrap scripts) |
| `screen.js` | Practice generator + built-in renderers + theme + tuning + share-link logic |
| `routes.py` | DB-backed preset + tuning persistence, temporary chart-export backend |
| `settings.html` | Plugin settings / info panel |
| `static/` | Self-hosted audio assets (`wafonts/` sampler, `irs/` cab IRs, `nam/` amp captures) served by `routes.py` |
| `docs/architecture.md` | Integration design notes |
| `docs/section-looping.md` | A-B loop framework + Slopsmith looping recon |
| `docs/exercise-schema.md` | Internal generated exercise schema |
| `docs/practice-pedagogy.md` | Background notes on the curated pathways |
| `docs/theory-*.md` | Distilled theory knowledge base (CAGED, scales, arpeggios, advanced jazz) |

## Roadmap

- A-B segment looping UI (transport framework is already in place — see `docs/section-looping.md`)
- Practice tracking (tempo ceiling, streak, "next session" recommendation)
- Live fretboard panel showing currently-active notes
- Picking metadata (alternate / economy / sweep) attached to generated note groups
- More sequence patterns (groups of 3s, diatonic-thirds variations, custom melodic cells)
- Inversions and shell voicings
- Nearest-note voice leading between progression steps
- Piano / keyboard exercise generation
