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
| `docs/architecture.md` | Integration design — the authoritative spec for how the plugin interacts with Slopsmith. Read this first before changing the launch flow. |
| `docs/exercise-schema.md` | Internal generated exercise JSON schema and note field abbreviations. |
| `docs/practice-pedagogy.md` | Pedagogical rationale behind the curated pathways and build order. |
| `docs/pedagogy-sequencing.md` | Beginner→advanced sequencing rationale for pathways. |
| `docs/fretboard-pedagogy.md` | Guitar fretboard system reference (CAGED, 3NPS, etc.). |
| `docs/position-system-rework.md` | Design notes on the unified position system (CAGED_SHAPES consolidation history). |
| `docs/session-schema.md` | Session/segment data model used by `BUILT_IN_SESSIONS`. |
| `docs/theory-caged.md` / `theory-scales.md` / `theory-arpeggios.md` / `theory-jazz-advanced.md` / `theory-progressions.md` | Distilled theory knowledge base (CAGED, scales, arpeggios, advanced jazz, cross-genre progressions). |
| `docs/genre-framework-guitar.md` | Genre/style framework behind the progression library and random-style generator. |
| `docs/musicality-guardrails.md` | Spec for keeping generated output musically pleasing, not just theoretically correct (voicing engine rationale). |
| `docs/section-looping.md` | Section/segment looping design notes. |
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

To run, screenshot, or smoke-test the plugin without doing the clone/restart dance by hand, use the **`run-slopscale` skill** (`.claude/skills/run-slopscale/`). `launch.ps1` junctions this repo into the Slopsmith plugins dir, starts the bundled-Python host on port 8765, and waits for `/status` to return `ok`; `driver.mjs` drives the SlopScale screen via Playwright and screenshots any of the four renderers. Server logs land in `%TEMP%\slopscale\server.log`.

There is **no unit-test or lint suite**. Verification is behavioural, via two Playwright smoke suites in the `run-slopscale` skill, run against a live host (start it with `launch.ps1` first):

- `npm test` (from `.claude/skills/run-slopscale/`) runs **both** suites — renderers then generators.
- `smoke-renderers.mjs` (`npm run smoke`) — walks all four renderers; asserts each attaches, draws, advances the playback clock, and throws no errors.
- `smoke-generators.mjs` (`npm run smoke:gen`) — drives `generateExercise()` across every practice type + scale, a bass pass, and all built-in sessions; validates chart structure.

These plus the startup regression guards baked into `screen.js` (e.g. the no-unison check, which throws on load if a resolved shape doubles a pitch) are the safety net before/after any `screen.js` change.

To exercise backend routes directly, hit them via curl or the browser while Slopsmith is running:
- `GET /api/plugins/slopscale/status` — confirms the plugin is loaded
- `GET /api/plugins/slopscale/presets` — list saved presets
- `POST /api/plugins/slopscale/temp-sloppak` — build a temp chart; body is `{ "exercise": { ... } }`

## Architecture

### The core data flow

**Playback is contained entirely inside the plugin.** "Play" does **not** hand off to Slopsmith's main player — this is a deliberate divergence from the old launch model (decided 2026-05-30; see "Contained playback" below).

```
User configures routine in screen.html/screen.js
  → generateExercise(cfg) / generateSession(session) dispatch → returns { version, session, chart }
  → makeBundle(exercise) wraps it into a renderer-ready bundle (activeBundle)
  → attachRenderer() mounts the selected renderer onto #slopscale-canvas (or a borrowed host-viz sibling)
  → onPlayToggle() → startPlayback(): own requestAnimationFrame loop + Web Audio scheduling + pitch tracker
  → renderers, HUD, and live fretboard strip are driven each frame from currentPracticeTime
```

The renderers in `screen.js` are the **actual playback surface**, not just previews — there is no second transport in a host player. `startPlayback()` owns the clock (`currentPracticeTime`, RAF `tick`), audio (count-in clicks + scheduled note/metronome audio), and scoring (Minigames-SDK pitch tracker).

### screen.js structure

`screen.js` is one IIFE, ~7000 lines. It loads as a classic `<script>` (the host injects it without `type="module"`), so it cannot use `import`/`export` — keep it one file. Major sections are marked with `§N` banner comments and indexed in a table-of-contents header at the top; **grep `§` to jump between sections, or use targeted `Grep` to locate one before reading.** Key sections (in order):

- **Constants** — `NOTE_NAMES`, `STRING_SETUPS`, `SCALE_INTERVALS`, `CHORD_FORMULAS`, `DIATONIC_QUALITIES`, `COMMON_PROGRESSIONS`, `SEQUENCE_PATTERNS`, `CHROMATIC_PATTERNS`, etc. `CHORD_FORMULAS` carries the **full interval stack** for each quality (including extensions past the octave for 9/11/13 chords); it is intentionally complete so the voicing engine decides what to actually play.
- **`CAGED_SHAPES`** — unified source of truth for CAGED shape data. Contains `rootStringIdx`, `scaleFretSpanFromRoot`, and `chordTemplates` per quality. **Do not split this into separate tables.** (Historical note: a previous version had two diverged tables; they were unified on 2026-05-26.) Scale/arpeggio shapes are resolved by degree-driven, no-unison selection (`resolveCAGEDShape` and the run-seam dedupe), not naive fret-window blocks — see the no-unison constraint below.
- **`PATHWAYS`** — curated pathway definitions: `label`, `goal`, `scales[]`, `tempoTiers[]`, `base` config, and `vary[]` list for Next Variation cycling.
- **`BUILT_IN_SESSIONS`** — multi-segment session presets (ii–V–I Workshop, Daily 30-min Intermediate, Blues Fundamentals, Bebop Fundamentals).
- **Exercise builders** — `buildScaleExercise`, `buildChordScaleExercise`, `buildArpeggioExercise`, `buildSweepArpeggioExercise`, `buildChromaticExercise`, `buildGuideTonesExercise`. Each returns an `exercise` object.
- **`generateExercise(cfg)`** — single-exercise dispatch; routes to the correct builder based on `cfg.practiceType`.
- **Session builders** — `buildSegmentConfig`, `buildBpmLadderChart`, `buildSessionChart`, `generateSession`. `generateSession()` is parallel to `generateExercise()`; both return the same `{ version, session, chart }` shape so the downstream `makeBundle`/launch path is unchanged.
- **Jazz harmony engine** — `chordQualityForDegree()` resolves the chord quality per scale degree (honouring `chordDepth` = power/triad/seventh/extended, `chordOverride`, and progression context), with optional **tritone substitution** (`cfg.tritoneSub` = `off` / `dominant_v` / `all_dominants`). `voiceChord(rootPc, intervals, opts)` is the **voicing engine** — it turns a raw interval stack into a playable voicing (voice count, register window, drop/omit decisions) rather than stacking every formula note. This is what keeps generated harmony musical; see `docs/musicality-guardrails.md`.
- **`makeBundle(exercise)`** — wraps an exercise into a renderer-ready bundle.
- **Renderer factory system** — `resolveRendererFactory(kind)` selects between renderers, borrowing host visualization plugins via the shared `borrowHostViz(globalName, scriptPath)` helper (lazy-load + poll for deferred `window.slopsmithViz_<id>` registration, with built-in fallback): `highway_3d` (host's `window.slopsmithViz_highway_3d`), `builtin_2d` (the **Jumping Tab** slot — borrows `window.slopsmithViz_jumpingtab`; the in-tree `makeBuiltin2DRenderer` is now only its last-resort fallback), `tab_2d` (Tab), `notation_2d` (Notation), and `piano_roll` (**groundwork only** — borrows `window.slopsmithViz_piano`, gated behind `pianoPathwayActive()` which returns `false`; the Piano Roll view button is `hidden`+`disabled`). User selection persisted via `localStorage['slopscale.renderer']`. Note: the host 3D highway renders **4–8 strings** (its `resolveStringCount` + 8-entry palette), so it is the default for guitar AND bass; `attachRenderer()` only force-falls-back to `builtin_2d` for counts it can't handle (>8 — not currently producible in SlopScale). `attachRenderer()` also calls `syncViewSwitcher(cfg.renderer)` after the saved-pref restore + any force, so the highlighted view button always matches the actual render. Borrowed viz plugins mount their own wrap as a sibling of `#slopscale-canvas`; `stopRenderer()` calls their `destroy()` on switch, and `.slopscale-render-host .jumpingtab-wrap` is sized to fill the host.
- **Built-in renderers** — `makeBuiltin2DRenderer`, `makeBuiltin2DTabRenderer`, `makeBuiltin2DNotationRenderer`, plus their draw helpers, driving `#slopscale-canvas`. Note spacing is **time-linear** (`xForDt(dt)` maps a note's time-offset from the playhead linearly to x — constant-speed scroll). The visible window (`AHEAD`/`BEHIND`, set per-draw) is **beat-relative** via `chartBeatSeconds(bundle)` (≈6.8 beats across the view, clamped), so note density stays comfortable/consistent across tempos instead of cramming at fast BPM; it's constant within a chart so the scroll speed is unchanged.
- **Live fretboard strip** — `drawFretboardFrame()` (+ `fretboardActiveNotes`, `fretboardSyncRange`, `fretboardStringCount`) draws a horizontal neck diagram on `#slopscale-fretboard` (docked under the render-host). It draws the exercise's whole pattern (`fbPattern`, unique string/fret positions) as **hollow circles**, and notes sounding within ~80ms of the playhead **glow filled** on top. The neck is **zoomed to the pattern's fret window** (`fbFretLo`/`fbFretHi`, ±1 fret with a min span) so the shape fills/centres the strip rather than floating on a full neck. Ported/generalised from the host Fretboard View plugin; any string count. Called from `drawOnce()` each frame (early-returns when its canvas is hidden). **Only offered for the views where it adds info the view lacks: Jumping Tab (`builtin_2d`) and Notation** — gated by the `.slopscale-fb-capable` root class (set in `syncViewSwitcher`) AND a user toggle (`.slopscale-fb-on`, button `#slopscale-fretboard-toggle`, persisted in `localStorage['slopscale.fretboard']`, default on, `syncFretboardUI()`). Always hidden for 3D Highway (redundant — already a neck), Tab, and the Piano instrument (`.slopscale-piano-instrument … !important`).
- **Exercise title** — `exerciseTitle(cfg)` sets `bundle.songInfo.title` to the descriptive name (e.g. "C minor pentatonic"; session name for sessions). Each renderer draws this as its own in-canvas header in its native style (the built-in Tab/Notation `drawHud` draw title-only — no in-canvas timer; that lives in the HUD).
- **Player HUD** — `#slopscale-hud` overlay floating over the highway: time on the right (single timer, all views), and a title on the left **only for 3D Highway** (`.slopscale-hud-title-on`, set in `syncViewSwitcher`) since every other renderer draws the title in-canvas. Time set in `syncTransportTime()`, title in `syncTransport()`.
- **Audio engine** — Web Audio API, note synthesis, metronome, harmony backing.
- **Slopsmith Minigames SDK integration** — pitch tracker via `window.slopsmithMinigames.scoring.createContinuous(...)`. Used as a scoring consumer only; **the plugin is not registered as a Slopsmith minigame.**
- **Public surface** — `window.SlopScale = { generateExercise, makeBundle, resolveRendererFactory, readConfig, setSegmentLoop, clearSegmentLoop, getSegmentLoop }` (near the end of the file).
- **`bind()`** — wires all DOM events; called once on DOMContentLoaded.

### routes.py structure

FastAPI routes registered via `setup(app, context)`. All routes are under `/api/plugins/slopscale/`:

- `GET /status` — health check
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
- **`window.playSong`, `window.showScreen`, `window.createHighway`, and `window.slopsmith`** are Slopsmith's public frontend APIs. Do not monkey-patch them. (`goScreen()` uses `window.slopsmith.navigate` / `window.showScreen` for navigation only.)
- **Do not override Escape.** Slopsmith owns Escape for return-to-menu. The plugin's keyboard handler (`screen.js`) deliberately never touches it. (The old launch model used a `sessionStorage['slopscale.returnToMenu']` marker to override Escape; that flow is gone with contained playback.)
- **Do not add the temp sloppak to Slopsmith's library index.** It lives under `.slopscale-temp/` specifically to avoid indexing.
- **No-unison rule:** a scale/mode/arpeggio run must never sound the same pitch (same MIDI) twice across strings. Shapes are degree-driven, not fret-window blocks, and there is a startup regression guard that throws `[SlopScale no-unison] … doubles a pitch` if a resolved CAGED/Open shape doubles a note. When adding or editing shapes, preserve this — don't reintroduce fret-window selection.

## Contained playback (current model)

**SlopScale runs as a fully self-contained player; "Play" never launches the host player.** This is a deliberate decision (2026-05-30, commit `e62d02a`) that supersedes the "Launch in Main 3D Player" UX described in older `docs/architecture.md` prose. Practice plays back inside the plugin via `startPlayback()` (own RAF clock + Web Audio + pitch tracker) across the renderers selected by `resolveRendererFactory()`.

Consequence: `screen.js` does **not** call `fetch('/api/plugins/slopscale/temp-sloppak')` or `window.playSong`. The `POST /temp-sloppak` route in `routes.py` (and the field-translation / sloppak-format machinery documented above) still exists but is **dormant** — kept for reference and possible future re-enablement, not on the live path. Don't "fix" the frontend to call it without confirming the contained-playback decision has been reversed (check `ROADMAP.md` and project memory first).

## Adding a new pathway

1. Add an entry to `PATHWAYS` in `screen.js` with `label`, `goal`, `scales`, `tempoTiers`, `base` config, and `vary[]`.
2. Add the corresponding `<option>` to the `#slopscale-pathway` select in `screen.html`.
3. No backend changes needed.

## Adding a new generator (practice type)

1. Add the `<option>` to the `practiceType` select in `screen.html`.
2. Implement `buildXExercise(cfg)` in `screen.js` returning an `exercise` object matching `docs/exercise-schema.md`.
3. Wire it into the `generateExercise(cfg)` dispatch function.
4. No backend changes needed unless the new type requires a new route.
