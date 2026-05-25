# SlopScale

SlopScale is a standalone Slopsmith practice-tool plugin for generating scale, diatonic arpeggio, and chord-progression drills.

SlopScale is **not** a separate rhythm game and should not duplicate Slopsmith's 3D Highway renderer. Its job is to generate temporary Slopsmith-compatible practice material, then launch that material through Slopsmith's normal player so the existing highway, transport, shortcut, visualization, and practice systems remain the source of truth.

## Product direction

The intended user flow is:

```text
Open SlopScale
  -> configure a practice routine
  -> click Launch in Main 3D Player
  -> SlopScale writes a temporary .sloppak
  -> Slopsmith opens it in the normal player
  -> the existing 3D Highway renders the exercise
  -> Escape returns to the SlopScale menu
```

Generated practice charts should **not** be permanently added to the user's library unless a later export/save feature explicitly does that.

## Current scope

SlopScale generates practice routines from:

- Key
- Scale
- Instrument
- Tuning
- Fret range / neck position
- BPM
- Meter / time signature
- Subdivision
- Diatonic arpeggio mode
- Chord progression mode
- Chord-quality override

Initial routine types:

- Scale practice
- Diatonic triads
- Diatonic seventh-chord arpeggios
- Common progression arpeggios

Initial scale library:

- Major
- Natural minor
- Harmonic minor
- Minor pentatonic
- Major pentatonic
- Blues
- Dorian
- Phrygian
- Mixolydian

Initial meter and rhythm support:

- 4/4
- 3/4
- 6/8
- 7/8 grouped 2+2+3
- 7/8 grouped 3+2+2
- 5/4
- Quarter, eighth, sixteenth, triplet, eighth-triplet, and sixteenth-triplet divisions

## Architecture

SlopScale has three responsibilities:

1. **Practice generation** — build notes, chords, beats, sections, anchors, chord templates, and hand shapes from the selected routine settings.
2. **Temporary Sloppak writing** — convert generated exercise data into a directory-form `.sloppak` inside the configured Slopsmith DLC folder.
3. **Native player launch** — call Slopsmith's normal `playSong(filename, arrangement)` path so the main player owns playback and rendering.

Preferred architecture:

```text
SlopScale UI
  -> generate exercise data
  -> POST /api/plugins/slopscale/temp-sloppak
  -> write <DLC_DIR>/.slopscale-temp/<id>.sloppak/
  -> call playSong(filename, 0)
  -> Slopsmith main player + existing highway renderer
```

Avoid this:

```text
SlopScale UI
  -> custom embedded 3D player
  -> duplicated renderer / transport / shortcuts
```

The built-in preview inside SlopScale is a secondary debugging and quick-check surface. The real playback path should be Slopsmith's normal player.

## Temporary Sloppak format

SlopScale writes directory-form Sloppaks under the user's configured DLC folder:

```text
<DLC_DIR>/.slopscale-temp/
└── slopscale-xxxxxxxxxxxx.sloppak/
    ├── manifest.yaml
    ├── arrangements/
    │   └── lead.json
    └── stems/
        └── silence.wav
```

The generated chart is intentionally temporary and should not be indexed into the library.

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
    file: stems/silence.wav
    default: true
```

A silent stem is used so Slopsmith has a valid transport clock. A future version may replace this with a generated click/count-in stem.

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

## Installation

Clone this repository into Slopsmith's plugins directory.

```bash
cd /path/to/slopsmith/plugins
git clone https://github.com/ChrisBeWithYou/SlopScale.git slopscale
```

Restart Slopsmith.

```bash
docker compose restart
```

SlopScale should then appear in Slopsmith's plugin/navigation UI.

### Slopsmith Desktop note

For Slopsmith Desktop, install the plugin into the Desktop app's configured plugins directory rather than cloning into `C:\Program Files\Slopsmith` directly. `Program Files` is normally protected by Windows and will produce permission errors unless the shell is elevated.

## Intended plugin UX

SlopScale should expose one clear primary action:

- **Launch in Main 3D Player** — build a temporary Sloppak and open it through Slopsmith's normal player.

Secondary actions:

- **Generate Preview** — generate the current routine and show it in the lightweight built-in 2D preview.
- **Play Preview** — play only the local preview.
- **Stop Preview** — stop only the local preview.
- **Save Preset** — persist the current routine settings.
- **Library** — return to Slopsmith's library.
- **Plugins** — return to the plugin list.

Renderer selection should remain a Slopsmith player concern. SlopScale should not present embedded 3D rendering as a normal playback option.

## Implementation status

Implemented:

- Plugin manifest
- Core frontend practice-generation logic
- Built-in 2D preview renderer
- Preset save/list/delete backend routes
- Temporary Sloppak backend route at `/api/plugins/slopscale/temp-sloppak`
- Backend normalization from SlopScale exercise data to Sloppak arrangement JSON
- Temporary chart cleanup under `.slopscale-temp`

Still needed:

- Add **Launch in Main 3D Player** button to `screen.html`
- Add `launchInMainPlayer()` to `screen.js`
- Add SlopScale-only Escape return handling from the player back to `plugin-slopscale`
- Demote/remove the renderer dropdown from the main plugin UX
- Test raw vs encoded temp filename handling with `playSong()`
- Verify the generated silent stem works in Slopsmith Desktop

## Suggested test routine

Start with the simplest scale chart:

```text
Mode: Scale practice
Instrument: Guitar
Tuning: Standard
Key: C
Scale: Major
BPM: 100
Meter: 4/4
Division: Eighth
First fret: 0
Last fret: 5
Bars: 4
```

Expected behavior:

- SlopScale builds a temporary Sloppak.
- The Slopsmith player opens.
- The selected main-player visualization renders a C major exercise across frets 0-5.
- Transport runs against the generated silent stem.
- Pressing Escape returns to SlopScale.

Then test diatonic triads:

```text
Mode: Diatonic arpeggios
Key: C
Scale: Major
Chord depth: Triads
Fret range: 0-5
```

Expected chord sequence:

```text
Cmaj -> Dmin -> Emin -> Fmaj -> Gmaj -> Amin -> Bdim -> Cmaj
```

Then test diatonic seventh chords:

```text
Mode: Diatonic arpeggios
Key: C
Scale: Major
Chord depth: Seventh chords
Fret range: 0-5
```

Expected chord sequence:

```text
Cmaj7 -> Dmin7 -> Emin7 -> Fmaj7 -> G7 -> Amin7 -> Bm7b5 -> Cmaj7
```

## Development notes

Primary files:

- `plugin.json` — Slopsmith plugin manifest
- `screen.html` — plugin UI
- `screen.js` — practice generator, preview renderer, and player-launch frontend
- `routes.py` — preset persistence and temporary Sloppak generation
- `settings.html` — lightweight plugin settings/info panel
- `docs/architecture.md` — integration design and Slopsmith-native architecture notes
- `docs/exercise-schema.md` — internal generated exercise schema

## Roadmap

Near term:

1. Launch generated routines through the native Slopsmith player.
2. Clean up the plugin UI around routine configuration and one-click launch.
3. Add a generated click/count-in stem.
4. Improve preset management.

Later:

1. Named CAGED positions.
2. 3NPS scale positions.
3. String-set restrictions.
4. Position-aware arpeggio paths.
5. Inversions and shell voicings.
6. Nearest-note voice leading.
7. Progression-aware chord-tone targeting.
8. Import/export routine JSON.
9. Song-aware mode using the active song's tuning, sections, tempo map, and loop range.
10. Optional Slopsmith diagnostics contribution for generated routine state.
