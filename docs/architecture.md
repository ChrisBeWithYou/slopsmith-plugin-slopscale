# SlopScale Architecture

SlopScale is a Slopsmith plugin that generates practice material and launches it through Slopsmith's existing player/highway infrastructure.

The plugin should feel like a native practice mode inside Slopsmith, not like a separate app embedded in a plugin panel.

## Source-of-truth contracts from Slopsmith

These notes are based on the current Slopsmith docs and implementation:

- Slopsmith is a FastAPI + vanilla JavaScript single-page app. Plugins are loaded from `plugins/<name>/` via `plugin.json`, optional `routes.py`, optional `screen.html`, optional `screen.js`, and optional `settings.html`.
- Plugin backend routes must live under `/api/plugins/<plugin_id>/...`.
- Plugin screens are mounted with DOM ids of the form `plugin-<plugin_id>`.
- Plugin shortcut scopes use `plugin-<plugin_id>`.
- Frontend plugin scripts run in page scope and may use `window.playSong`, `window.showScreen`, `window.createHighway`, the shared audio element, and `window.slopsmith`.
- `window.slopsmith` is the public frontend integration point for navigation, events, and lightweight host APIs.
- The main player opens through `playSong(filename, arrangement)`, which stops the current highway, switches to the `player` screen, initializes the canonical `#highway` canvas, and connects to `/ws/highway/{filename}?arrangement={index}`.
- Sloppak is an official Slopsmith source format. Directory-form `*.sloppak/` packages are valid, not just zipped `.sloppak` files.
- Sloppak contents are manifest-indexed. The loader does not discover arbitrary files; `manifest.yaml` must point at arrangements and stems.
- Arrangement JSON should follow the `arrangement_to_wire()` / `arrangement_from_wire()` shape: `notes`, `chords`, `anchors`, `handshapes`, `templates`, `beats`, and `sections`.
- The WebSocket stream sends similar shapes to the player, but SlopScale should write arrangement JSON and let Slopsmith's existing `/ws/highway` loader stream it.
- Visualization plugins are for replacing the main highway renderer through `window.slopsmithViz_<id>` and `setRenderer`. SlopScale is not a visualization plugin.

## Core rule

SlopScale generates temporary Sloppak-compatible practice charts. Slopsmith plays them.

Correct flow:

```text
SlopScale configuration UI
  -> generate exercise data
  -> write a temporary directory-form .sloppak under the configured DLC folder
  -> call Slopsmith playSong(filename, arrangement)
  -> Slopsmith main player opens
  -> existing #highway canvas and selected viz render the chart
  -> Escape returns to SlopScale so the routine can be adjusted
```

Avoid:

```text
SlopScale configuration UI
  -> custom plugin-owned 3D player
  -> separate transport, shortcuts, renderer lifecycle, and canvas assumptions
```

## Why the main-player path is preferred

Slopsmith already owns the difficult parts:

- player screen lifecycle
- audio transport
- WebSocket chart loading
- renderer selection and `setViz()`
- 2D/3D canvas context switching
- player keyboard shortcuts
- speed, volume, and looping UX
- note state and future scorer integration
- accessibility behavior around focus and shortcuts

Duplicating those inside SlopScale would create a second player and make the plugin drift from the host app.

## Temporary Sloppak strategy

SlopScale writes generated practice content as directory-form Sloppaks inside the configured DLC directory:

```text
<DLC_DIR>/.slopscale-temp/<id>.sloppak/
  manifest.yaml
  arrangements/lead.json
  stems/silence.wav
```

This keeps the package loadable by Slopsmith's existing `/ws/highway/{filename}` route while avoiding library indexing.

### Manifest requirements

`manifest.yaml` must include:

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

Sloppak docs normally show OGG stems, but the important requirement is that `stems` is non-empty and manifest-indexed. SlopScale currently uses a generated silent WAV so the player has a transport clock; if Slopsmith rejects WAV in practice, replace it with generated OGG.

### Arrangement requirements

The temp arrangement should write Sloppak's on-disk field names:

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

Frontend generation may internally use `chordTemplates` and `handShapes`, but the backend writer should normalize to `templates` and `handshapes` for Sloppak JSON.

## Main-player launch contract

The frontend launch path should:

1. Generate the current exercise from UI config.
2. POST it to `/api/plugins/slopscale/temp-sloppak`.
3. Receive `{ ok, filename, title, duration }`.
4. Set a one-shot return marker in `sessionStorage`.
5. Prefer the existing 3D Highway by setting the Slopsmith viz picker through `setViz('highway_3d')` when available, with a safe localStorage fallback.
6. Call `playSong(...)` with the temp DLC-relative filename.

Filename encoding needs practical testing because Slopsmith's current `playSong()` builds its WebSocket URL with `decodeURIComponent(filename)`. If passing the raw relative path fails with slashes or spaces, pass `encodeURIComponent(filename)`. Do not change the backend output unless testing proves the current path is incompatible.

## Escape-return behavior

Slopsmith's default player shortcut returns to the Library or Favorites. If a song is launched from an unexpected screen, including a plugin screen, the default fallback is Library.

SlopScale needs a plugin-level Escape override only for SlopScale-launched temp charts:

- Before launch, set `sessionStorage['slopscale.returnToMenu'] = '1'`.
- Install a capture-phase keydown listener.
- If `Escape` is pressed while the active screen is `player` and the marker is set, stop propagation and navigate to `plugin-slopscale`.
- Clear the marker when returning.
- Do not override Escape for normal songs.

This avoids core Slopsmith changes while preserving native player behavior for the rest of the app.

## Plugin UX direction

SlopScale should look and behave like a compact Slopsmith practice-control panel.

Primary UX:

- One primary action: **Launch in Main 3D Player**.
- Secondary action: **Generate Preview**.
- Tertiary actions: **Play Preview**, **Stop Preview**, **Save Preset**.
- Navigation actions: **Library** and **Plugins**.
- Status area should tell the user what will happen next: generated notes/chords, duration, temp chart build status, and launch errors.

Preview UX:

- Keep the built-in 2D renderer as a fast preview/debug surface.
- Remove the renderer dropdown from the main path. Renderer selection is a Slopsmith player concern, not a SlopScale configuration concern.
- Do not expose embedded 3D as a normal user option. It creates lifecycle and canvas assumptions that already belong to the main player.

Configuration UX:

- Group controls by task, not by implementation detail:
  - Routine: mode, key, scale, progression, chord depth, chord override.
  - Instrument: instrument, tuning, fret range.
  - Timing: BPM, meter, subdivision, bars.
  - Output: preview summary and launch status.
- Hide irrelevant fields based on mode where possible. Progression selection is only relevant to progression arpeggios; chord depth and chord override are only relevant to arpeggio modes.
- Keep the form keyboard-safe. Slopsmith global shortcuts intentionally avoid text inputs and selects; SlopScale should not add conflicting document-level shortcuts except the one-shot Escape return handler.

## Growth path

SlopScale should grow by generating richer chart data, not by owning playback:

1. Position-aware scale paths: CAGED, 3NPS, string-set restrictions.
2. Better arpeggio paths: inversions, sweep shapes, nearest-note voice leading.
3. Progression-aware practice: chord-tone targeting, guide tones, shell voicings.
4. Audio improvements: generated metronome/click stem, count-in stem, optional spoken count.
5. Song-aware mode: use active song tuning, tempo, sections, and loop regions as inputs, then still emit a separate temp practice Sloppak.
6. Diagnostics: contribute SlopScale generation state through Slopsmith diagnostics if troubleshooting becomes common.

## Current implementation alignment

Current state:

- Backend temp Sloppak route exists.
- Backend normalizes frontend `chordTemplates` / `handShapes` to Sloppak `templates` / `handshapes`.
- Frontend still emphasizes embedded preview/rendering and lacks the main-player launch button/function.
- README still describes the earlier renderer-adapter strategy.

Next implementation pass:

1. Make **Launch in Main 3D Player** the primary button in `screen.html`.
2. Add `launchInMainPlayer()` to `screen.js`.
3. Add SlopScale-only Escape return handling.
4. Reframe existing embedded 2D renderer as Preview only.
5. Remove or demote the renderer dropdown.
6. Update README to describe temp Sloppak launch through the native Slopsmith player.
