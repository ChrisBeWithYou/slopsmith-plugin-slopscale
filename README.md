# SlopScale

SlopScale is a standalone Slopsmith practice-tool plugin for scales, diatonic arpeggios, and chord-progression drills.

It is intentionally **not a new game engine**. The plugin generates Sloppak-shaped practice chart data and feeds that data into Slopsmith-compatible visualization renderers, starting with the existing 3D Highway renderer. The long-term direction is to reuse the same renderer contract for 3D note highway, 2D highway/tab-style views, and any future Slopsmith visualization that accepts a standard highway bundle.

## Current scope

The initial version provides:

- BPM control
- Meter/time-signature control: 4/4, 3/4, 6/8, 7/8, and custom
- Beat grouping support for odd meters such as 7/8
- Subdivision control: quarter, eighth, sixteenth, triplet, eighth-note triplet, sixteenth-note triplet
- Scale practice generation
- Diatonic triad and seventh-chord arpeggio generation
- Common chord progression generation
- Chord-quality override for arpeggio practice
- Slopsmith-compatible generated data:
  - `notes`
  - `chords`
  - `chordTemplates`
  - `handShapes`
  - `anchors`
  - `beats`
  - `sections`
- Renderer adapter that prefers the bundled 3D Highway factory when available

## Installation

Clone this repository into the Slopsmith plugins directory.

```bash
cd /path/to/slopsmith/plugins
git clone https://github.com/ChrisBeWithYou/SlopScale.git slopscale
```

Restart Slopsmith.

```bash
docker compose restart
```

The plugin appears as **SlopScale** in Slopsmith navigation.

## Architecture

SlopScale has three layers:

1. **Practice generators** build music exercises from key, scale, tuning, neck position, rhythm, and chord/progression settings.
2. **Bundle adapter** converts those exercises into the same shape Slopsmith renderers already consume.
3. **Renderer adapter** hands the generated bundle to an existing Slopsmith renderer factory, such as `window.slopsmithViz_highway_3d`.

The generated data follows Sloppak/Slopsmith conventions:

```json
{
  "notes": [{ "t": 0.0, "s": 0, "f": 3, "sus": 0.25 }],
  "chords": [{ "t": 0.0, "id": 0, "notes": [{ "s": 0, "f": 3 }] }],
  "anchors": [{ "time": 0.0, "fret": 1, "width": 4 }],
  "handShapes": [{ "chord_id": 0, "start_time": 0.0, "end_time": 2.0, "arp": true }],
  "chordTemplates": [{ "name": "Cmaj7", "displayName": "Cmaj7", "frets": [3, 3, 2, 0, 1, 0] }]
}
```

## Design rule

SlopScale should not duplicate the 3D highway or create a separate game renderer. If a practice feature needs visual playback, the first answer should be: generate better chart data and feed the existing renderer contract.

## Development notes

Primary files:

- `plugin.json` — Slopsmith plugin manifest
- `screen.html` — plugin UI
- `screen.js` — music generator and renderer adapter
- `routes.py` — preset persistence API
- `settings.html` — lightweight plugin settings/info panel
- `docs/architecture.md` — implementation direction
- `docs/exercise-schema.md` — generated practice schema

## Roadmap

1. Solidify generated scale/arpeggio/progression data.
2. Improve renderer selection and add explicit 2D/tab-view support when a public tab renderer factory is available.
3. Add saved presets and import/export from `scale_practice.json`.
4. Add song-aware practice using active Sloppak tuning, sections, and beat grid.
5. Add optional note-detection integration through Slopsmith's existing per-note state provider contract.
