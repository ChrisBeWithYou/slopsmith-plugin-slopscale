# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**SlopScale** is a **Slopsmith plugin** — it is not a standalone app. It generates guitar/bass scale, arpeggio, and sweep-arpeggio practice routines and runs them through Slopsmith's existing player. Install by dropping the repo into Slopsmith's `plugins/` directory and restarting; the plugin then appears in the Slopsmith navigation as "SlopScale".

The plugin has no build step. There is no `package.json`, no compiler, no bundler. All files are served directly by Slopsmith's FastAPI host.

## File layout

| File | Role |
|------|------|
| `plugin.json` | Slopsmith plugin manifest (id, nav label, screen/script/routes pointers) |
| `screen.html` | Plugin UI — CSS, markup, and a small bootstrap script. Loads before `screen.js`. |
| `screen.js` | All generator logic, CAGED/3NPS data, pathway definitions, built-in renderers, audio playback, and Slopsmith integration. Runs in Slopsmith page scope. |
| `routes.py` | FastAPI routes under `/api/plugins/slopscale/…` — preset CRUD, status, and `POST /temp-sloppak` (the chart builder). |
| `settings.html` | Plugin settings panel fragment rendered by Slopsmith. |
| `static/slopscale.css` | External stylesheet served by the `GET /api/plugins/slopscale/assets/slopscale.css` route. |
| `docs/architecture.md` | Integration design — the authoritative spec for how the plugin interacts with Slopsmith. Read this first before changing the launch flow. |
| `docs/exercise-schema.md` | Internal generated exercise JSON schema and note field abbreviations. |
| `docs/practice-pedagogy.md` | Pedagogical rationale behind the curated pathways and build order. |
| `docs/pedagogy-sequencing.md` | Beginner→advanced sequencing rationale for pathways. |
| `docs/fretboard-pedagogy.md` | Guitar fretboard system reference (CAGED, 3NPS, etc.). |
| `docs/position-system-rework.md` | Design notes on the unified position system (CAGED_SHAPES consolidation history). |
| `docs/session-schema.md` | Session/segment data model used by `BUILT_IN_SESSIONS`. |
| `docs/theory-caged.md` / `theory-scales.md` / `theory-arpeggios.md` / `theory-jazz-advanced.md` | Distilled theory knowledge base (CAGED, scales, arpeggios, advanced jazz). |
| `docs/ui-session.md` | Session UI design notes. |
| `docs/session-2026-05-26-shape-system.md` | Shape-system unification session log. |
| `docs/sources/` | Source PDFs — reference material only. |
| `README.md` | User-facing feature list + install steps. |
| `ROADMAP.md` | Phase plan; **read at session start**. Authoritative for "what's shipped vs planned". |
| `AGENTS.md` | Codex variant; mirrors this file. |

## Development workflow

No build. No dev server. The workflow is:

1. Clone into Slopsmith's `plugins/` directory as `slopscale/`.
2. Restart Slopsmith (web: `docker compose restart`; Desktop: relaunch the app).
3. Edit files, then reload the Slopsmith page. `screen.js` and `screen.html` changes take effect on page reload. `routes.py` changes require a Slopsmith restart.

To exercise backend routes directly, hit them via curl or the browser while Slopsmith is running:
- `GET /api/plugins/slopscale/status` — confirms the plugin is loaded
- `GET /api/plugins/slopscale/presets` — list saved presets
- `POST /api/plugins/slopscale/temp-sloppak` — build a temp chart; body is `{ "exercise": { ... } }`

## Architecture

### The core data flow

```
User configures routine in screen.html/screen.js
  → JS calls generate(config) dispatch → generator returns an exercise object
  → POST /api/plugins/slopscale/temp-sloppak
  → routes.py normalises fields, synthesises audio stem, writes a directory-form .sloppak under <DLC_DIR>/.slopscale-temp/
  → JS calls window.playSong(filename, arrangement) — Slopsmith's native player opens
  → Player uses Slopsmith's existing highway, transport, and scoring
  → Escape key returns to the SlopScale screen (via sessionStorage marker)
```

The built-in 2D highway and 2D tab renderers in `screen.js` are **preview surfaces only** — they let you see a generated chart without launching the full Slopsmith player. The primary user action is "Play" (launching in the main Slopsmith player via the temp-sloppak path above).

### screen.js structure

`screen.js` is one IIFE, ~190 KB / 3400+ lines. **Prefer targeted `Grep` to locate a section before reading.** Key sections (in order):

- **Constants** — `NOTE_NAMES`, `STRING_SETUPS`, `SCALE_INTERVALS`, `CHORD_FORMULAS`, `DIATONIC_QUALITIES`, `COMMON_PROGRESSIONS`, `SEQUENCE_PATTERNS`, `CHROMATIC_PATTERNS`, etc.
- **`CAGED_SHAPES`** — unified source of truth for CAGED shape data. Contains `rootStringIdx`, `scaleFretSpanFromRoot`, and `chordTemplates` per quality. **Do not split this into separate tables.** (Historical note: a previous version had two diverged tables; they were unified on 2026-05-26.)
- **`PATHWAYS`** — curated pathway definitions: `label`, `goal`, `scales[]`, `tempoTiers[]`, `base` config, and `vary[]` list for Next Variation cycling.
- **`BUILT_IN_SESSIONS`** — multi-segment session presets (ii–V–I Workshop, Daily 30-min Intermediate, Blues Fundamentals, Bebop Fundamentals).
- **Exercise builders** — `buildScaleExercise`, `buildChordScaleExercise`, `buildArpeggioExercise`, `buildSweepArpeggioExercise`, `buildChromaticExercise`, `buildGuideTonesExercise`. Each returns an `exercise` object.
- **`generateExercise(cfg)`** — single-exercise dispatch; routes to the correct builder based on `cfg.practiceType`.
- **Session builders** — `buildSegmentConfig`, `buildBpmLadderChart`, `buildSessionChart`, `generateSession`. `generateSession()` is parallel to `generateExercise()`; both return the same `{ version, session, chart }` shape so the downstream `makeBundle`/launch path is unchanged.
- **`makeBundle(exercise)`** — wraps an exercise into a renderer-ready bundle.
- **Renderer factory system** — `resolveRendererFactory()` selects between `highway_3d` (delegated to host's `window.slopsmithViz_highway_3d`), built-in 2D highway, and `notation_2d`. User selection persisted via `localStorage['slopscale.renderer']`.
- **Built-in renderers** — `drawHighway2D()`, `drawTab2D()`, the `Renderer` class driving `#slopscale-canvas`.
- **Audio engine** — Web Audio API, note synthesis, metronome, harmony backing.
- **Slopsmith Minigames SDK integration** — pitch tracker via `window.slopsmithMinigames.scoring.createContinuous(...)`. Used as a scoring consumer only; **the plugin is not registered as a Slopsmith minigame.**
- **Public surface** — `window.SlopScale = { generateExercise, makeBundle, resolveRendererFactory, readConfig }` (around line 3385).
- **`bind()`** — wires all DOM events; called once on DOMContentLoaded.

### routes.py structure

FastAPI routes registered via `setup(app, context)`. All routes are under `/api/plugins/slopscale/`:

- `GET /status` — health check
- `GET /assets/{filename}` — serves `static/slopscale.css`
- `GET /presets` / `POST /presets` / `DELETE /presets/{id}` — preset CRUD
- `GET /tunings` / `POST /tunings` / `DELETE /tunings/{id}` — custom-tuning CRUD (frontend posts a tuning by name + family + string count + MIDI list; id is an autoincrement INTEGER)
- `POST /temp-sloppak` — normalizes the frontend exercise payload (`_normalise_chart`), writes a directory-form `.sloppak` package under the DLC folder, returns `{ ok, filename, title, duration }`. The frontend then calls `playSong(filename)`.

**Storage is DB-backed, not flat files.** Presets and tunings live in the shared Slopsmith meta-DB obtained via `context["meta_db"]` (a `sqlite3.Connection` on `.conn` guarded by `._lock`), in two dedicated tables `slopscale_presets` (TEXT id, preserves legacy slug ids) and `slopscale_tunings` (INTEGER autoincrement id). `_ensure_tables()` creates them on `setup()`. The legacy `<CONFIG_DIR>/plugin_data/slopscale/presets.json` is migrated into the DB once via `_migrate_presets_from_json()` (idempotent; runs only when the presets table is empty) and then left in place as an audit breadcrumb — it is **no longer the live store**, so don't edit it expecting changes to show up.

Temp sloppaks live under `<DLC_DIR>/.slopscale-temp/<slug>.sloppak/`. They are cleaned up on the next build call (entries older than 24h, or beyond 20 total).

### Sloppak format

A temp sloppak is a directory with this structure:
```
<slug>.sloppak/
  manifest.yaml          ← required; lists arrangements and stems
  arrangements/lead.json ← normalized note/chord/beat data
  stems/practice.wav     ← generated audio (OGG if ffmpeg available)
```

`manifest.yaml` must have a non-empty `stems` list for Slopsmith's player to provide a transport clock. The audio file is synthesized by `routes.py` from the note + beat data.

**Audio stem generation:** The stem is a synthesized WAV (OGG if ffmpeg is on PATH). The stem content is controlled by `session.audio` in the exercise payload:
- `{ "notes": true }` — synthesizes plucked-sine note audio from the note list using the correct string/fret MIDI pitches.
- `{ "metronome": true }` — synthesizes a metronome click track from the beats list (accented on measure downbeats).
- Both false (default) — writes a silent WAV; the player still gets a valid transport clock.

### Field name translation (frontend → sloppak)

Frontend generators use camelCase names; `_normalise_chart()` in `routes.py` translates to the on-disk Sloppak field names before writing:

| Frontend (exercise.chart) | Sloppak (arrangements/lead.json) |
|---------------------------|----------------------------------|
| `chordTemplates` | `templates` |
| `handShapes` | `handshapes` |

All other top-level arrangement fields (`notes`, `chords`, `anchors`, `beats`, `sections`) pass through unchanged.

### Note field abbreviations

All note objects in the exercise payload use compact keys (see `docs/exercise-schema.md` for full reference):

| Key | Meaning |
|-----|---------|
| `t` | start time (seconds) |
| `s` | string index |
| `f` | fret number |
| `sus` | sustain duration (seconds) |
| `sl` / `slu` | slide target / slide-up target fret (-1 = none) |
| `bn` | bend value (0 / 0.5 / 1 / 1.5 / 2) |
| `ho` / `po` | hammer-on / pull-off |
| `hm` / `hp` | harmonic / pinch harmonic |
| `pm` | palm mute |
| `mt` | muted/dead note |
| `vb` / `tr` | vibrato / tremolo |
| `ac` / `tp` | accent / tap |

### String index convention

**In SlopScale, `s=0` is the lowest string (low E in standard 6-string tuning).** This is the `openMidis` array index in `STRING_SETUPS` and the `s` key in `CAGED_SHAPES.chordTemplates`. This is the opposite of Rifflarr's convention — do not cross-apply.

## Key constraints (from docs/architecture.md)

- **Never duplicate the player.** SlopScale generates chart data; Slopsmith plays it. Do not build a second transport, WebSocket handler, or canvas lifecycle inside the plugin.
- **Backend routes must stay under `/api/plugins/slopscale/…`.**
- **`window.playSong`, `window.showScreen`, `window.createHighway`, and `window.slopsmith`** are Slopsmith's public frontend APIs. Do not monkey-patch them.
- The Escape-return handler uses `sessionStorage['slopscale.returnToMenu'] = '1'` as a one-shot marker. Clear it on return. Only override Escape while `player` is the active screen and the marker is set.
- **Do not add the temp sloppak to Slopsmith's library index.** It lives under `.slopscale-temp/` specifically to avoid indexing.

## Current implementation state

The backend `POST /temp-sloppak` route is implemented and ready (see `routes.py`). **The frontend launch flow into Slopsmith's main player is not currently wired up** — `screen.js` has no `launchInMainPlayer()` symbol and no `fetch('/api/plugins/slopscale/temp-sloppak')` call. The plugin currently operates as an embedded preview app with three renderer modes via `resolveRendererFactory()` (3D highway delegated to host, 2D highway, 2D notation), plus a Minigames-SDK pitch tracker.

Per `docs/architecture.md`, the intended primary UX is still **Launch in Main 3D Player** via the temp-sloppak path. Wiring up that launch is outstanding work — when adding it, the `generateExercise` → `makeBundle` → POST → `playSong` chain is already designed for it. Check `ROADMAP.md` before scoping any rework here.

## Adding a new pathway

1. Add an entry to `PATHWAYS` in `screen.js` with `label`, `goal`, `scales`, `tempoTiers`, `base` config, and `vary[]`.
2. Add the corresponding `<option>` to the `#slopscale-pathway` select in `screen.html`.
3. No backend changes needed.

## Adding a new generator (practice type)

1. Add the `<option>` to the `practiceType` select in `screen.html`.
2. Implement `buildXExercise(cfg)` in `screen.js` returning an `exercise` object matching `docs/exercise-schema.md`.
3. Wire it into the `generateExercise(cfg)` dispatch function.
4. No backend changes needed unless the new type requires a new route.
