# SlopScale

A Slopsmith plugin that generates scale, arpeggio, and chord-progression practice charts and launches them through Slopsmith's main player. Designed for daily practice — from beginner pentatonics to advanced soloing technique.

> **Plays through Slopsmith's main player.** SlopScale builds a temporary `.sloppak`, then hands playback to Slopsmith so the existing 3D Highway, transport, shortcuts, and practice systems remain the source of truth. The built-in 2D preview is a debugging surface, not the intended playback path.

## Features

### Routine Configuration
- **Key and scale** — 12 keys across 9 scale families (Major, Natural Minor, Harmonic Minor, Minor Pentatonic, Major Pentatonic, Blues, Dorian, Phrygian, Mixolydian)
- **Instrument and tuning** — 6-string guitar (Standard or Drop D), 7- and 8-string guitar, 4- and 5-string bass
- **Fret range** — first/last fret pair defines the position box
- **BPM and meter** — 30–260 BPM, 4/4, 3/4, 6/8, 7/8 (2+2+3 or 3+2+2), 5/4
- **Subdivision** — quarter, eighth, sixteenth, triplet, eighth triplet, sixteenth triplet
- **Practice type** — scale pattern, diatonic arpeggios, or progression arpeggios

### Advanced Fretboard Logic
- **Fretboard system** — Position box, 3-notes-per-string, CAGED position, CAGED shape run, single-string, full-neck
- **CAGED shape family** — C / A / G / E / D button strip; shape is passed into the generated config
- **Direction** — up-then-down, ascending only, descending only, down-then-up, randomized
- **Repeat count** — 1–16 repetitions per phrase

### Arpeggios and Harmony
- **Chord depth** — triads or seventh chords
- **Common progressions** — diatonic I–ii–iii–IV–V–vi–vii°–I, I–IV–V, I–V–vi–IV, ii–V–I, doo-wop, Pachelbel, diatonic circle, 12-bar blues, quick-change blues, minor i–VI–III–VII, minor ii–V–i, and others
- **Chord quality override** — force maj / min / dim / maj7 / min7 / dom7 / m7b5 / sus4 / add9

### Generated Audio
- **Hear generated notes** — synthesized plucked-string preview at the actual fret and string positions
- **Metronome click** — accent on beat 1, group accents follow the meter grouping
- **Harmony backing** — voiced backing chord per progression step, scale- and key-aware
- **Practice stem** — temp Sloppak ships with a generated WAV (auto-converted to OGG when `ffmpeg` is available) so Slopsmith's transport has a real audio clock

### Persistence
- **Save Preset** — routine settings stored under `<config>/plugin_data/slopscale/presets.json`
- **Temporary chart cleanup** — temp Sloppaks under `.slopscale-temp/` are pruned after 24 hours or once 20 entries exist, whichever comes first

## Architecture

SlopScale has three responsibilities:

1. **Generation** — build notes, chords, beats, sections, anchors, chord templates, and hand shapes from the selected routine settings.
2. **Temporary Sloppak writing** — convert generated exercise data into a directory-form `.sloppak` inside the configured Slopsmith DLC folder.
3. **Native player launch** — call Slopsmith's normal `playSong(filename, arrangement)` path so the main player owns playback and rendering.

```text
SlopScale UI
  -> generate exercise data
  -> POST /api/plugins/slopscale/temp-sloppak
  -> write <DLC_DIR>/.slopscale-temp/<id>.sloppak/
  -> call playSong(filename, 0)
  -> Slopsmith main player + existing renderer
```

Renderer selection is a Slopsmith player concern. SlopScale does not present embedded 3D rendering as a normal playback option — the embedded 2D canvas exists to sanity-check generation output during development.

## Quick Start

### Prerequisites
- A working Slopsmith install (web/Docker or Desktop)
- Write access to Slopsmith's `plugins/` directory
- A configured DLC folder (Slopsmith Settings) so temp Sloppaks have somewhere to land

### Install (Slopsmith web/Docker)

```bash
cd /path/to/slopsmith/plugins
git clone https://github.com/ChrisBeWithYou/slopsmith-plugin-slopscale.git slopscale
docker compose restart
```

### Install (Slopsmith Desktop)

Clone into the Desktop app's configured plugins directory (visible in Settings → Plugins).

> **Note:** Do not clone directly under `C:\Program Files\Slopsmith`. Windows protects that path; you will hit permission errors unless the shell is elevated. Use the user-writable plugins directory the Desktop app reports in Settings.

After restart, **SlopScale** appears in the plugin navigation.

## Temporary Sloppak Format

SlopScale writes directory-form Sloppaks under the user's configured DLC folder:

```text
<DLC_DIR>/.slopscale-temp/
└── slopscale-xxxxxxxxxxxx.sloppak/
    ├── manifest.yaml
    ├── arrangements/
    │   └── lead.json
    └── stems/
        └── practice.ogg     (or practice.wav fallback)
```

Generated charts are intentionally temporary and are not indexed into the library.

### Minimal manifest

```yaml
title: "SlopScale - C major scale"
artist: "SlopScale"
album: "Practice Tools"
year: 2026
duration: 12.0
arrangements:
  - id: lead
    name: Lead
    file: arrangements/lead.json
    tuning: [0, 0, 0, 0, 0, 0]
    capo: 0
stems:
  - id: full
    file: stems/practice.ogg
    default: true
```

### Arrangement JSON

The backend normalizes generated data to Sloppak's on-disk arrangement shape:

```json
{
  "name": "Lead",
  "tuning": [0, 0, 0, 0, 0, 0],
  "capo": 0,
  "notes": [],
  "chords": [],
  "anchors": [],
  "handshapes": [],
  "templates": [],
  "beats": [],
  "sections": []
}
```

Frontend generation may use `chordTemplates` and `handShapes`; the backend writer maps those to Sloppak's `templates` and `handshapes` fields.

## Configuration

| Setting | Location | Description |
|---------|----------|-------------|
| DLC folder | Slopsmith Settings | Required — temp Sloppaks are written under `<DLC_DIR>/.slopscale-temp/` |
| Presets | `<config>/plugin_data/slopscale/presets.json` | Auto-managed; one JSON file, atomic writes |
| Plugin assets | `static/slopscale.css` | Served via `/api/plugins/slopscale/assets/slopscale.css` |

## Test Routines

### Simplest scale chart

```text
Practice type: Scale pattern
Key: C   Scale: Major
Instrument: Guitar   Tuning: 6-string standard
BPM: 100   Meter: 4/4   Division: Eighth
First fret: 0   Last fret: 5   Bars: 4
```

Expected: SlopScale builds a temporary Sloppak, the main player opens, the highway renders a C major exercise across frets 0–5, the generated stem drives the transport, and Escape returns to SlopScale.

### Diatonic triads

```text
Practice type: Diatonic arpeggios
Key: C   Scale: Major
Chord depth: Triads   Fret range: 0-5
```

Expected chord sequence:

```text
Cmaj -> Dmin -> Emin -> Fmaj -> Gmaj -> Amin -> Bdim -> Cmaj
```

### Diatonic seventh chords

```text
Practice type: Diatonic arpeggios
Key: C   Scale: Major
Chord depth: Seventh chords   Fret range: 0-5
```

Expected chord sequence:

```text
Cmaj7 -> Dmin7 -> Emin7 -> Fmaj7 -> G7 -> Amin7 -> Bm7b5 -> Cmaj7
```

## Implementation Status

**Implemented**
- Plugin manifest, screen UI, settings panel
- Core practice generation: scales, diatonic arpeggios, progression arpeggios
- Built-in 2D canvas preview renderer
- Generated preview audio: notes, metronome, harmony backing
- Preset save / list / delete backend routes
- Temporary Sloppak backend route at `POST /api/plugins/slopscale/temp-sloppak`
- Backend normalization from SlopScale exercise data to Sloppak arrangement JSON
- Generated audio stem (WAV; OGG via `ffmpeg` when present)
- Temporary chart cleanup under `.slopscale-temp` (24-hour TTL, capped at 20 entries)
- Advanced controls toggle
- Fretboard system selector (position, 3NPS, CAGED, single-string, full-neck)
- CAGED shape family selector (C / A / G / E / D)

**Still needed**
- CAGED position-aware fret generation (selector exists; generator currently falls through to position-box logic)
- 3NPS-aware scale path
- Picking metadata (alternate / economy / sweep)
- Sequence patterns (ascending 3s, 4s, diatonic sequences)
- **Launch in Main 3D Player** button on `screen.html` and `launchInMainPlayer()` in `screen.js`
- SlopScale-only Escape return handling from the player back to the plugin
- Demote or remove the renderer dropdown from the main plugin UX
- Test raw vs URL-encoded temp filename handling with `playSong()`
- Verify generated stem playback against Slopsmith Desktop

## File Layout

| File | Purpose |
|------|---------|
| `plugin.json` | Slopsmith plugin manifest |
| `screen.html` | Plugin UI (markup + inline styles + bootstrap scripts) |
| `screen.js` | Practice generator, preview renderer, player-launch frontend |
| `routes.py` | Preset persistence and temporary Sloppak generation |
| `settings.html` | Plugin settings / info panel |
| `static/slopscale.css` | External stylesheet |
| `docs/architecture.md` | Integration design notes |
| `docs/exercise-schema.md` | Internal generated exercise schema |

## Roadmap

**Near term**
1. Launch generated routines through the native Slopsmith player.
2. CAGED position-aware fret generation, driven by the C/A/G/E/D selector.
3. Picking-style metadata (alternate / economy / sweep) attached to generated note groups.
4. Sequence patterns (ascending 3s, 4s, diatonic sequences).
5. Clean up the plugin UI around routine configuration and one-click launch.
6. Optional generated click / count-in stem.

**Later**
- 3NPS scale positions and string-set restrictions
- Position-aware arpeggio paths
- Inversions and shell voicings
- Nearest-note voice leading between progression steps
- Progression-aware chord-tone targeting
- Import / export routine JSON
- Song-aware mode using the active song's tuning, sections, tempo map, and loop range
- Optional Slopsmith diagnostics contribution for generated routine state
