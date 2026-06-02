# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**SlopScale** is a **Slopsmith plugin** — it is not a standalone app. It generates guitar/bass scale, arpeggio, and sweep-arpeggio practice routines and plays them back inside the plugin (contained playback — see "Contained playback" below). Install by dropping the repo into Slopsmith's `plugins/` directory and restarting; the plugin then appears in the Slopsmith navigation as "SlopScale".

The plugin has no build step. There is no `package.json`, no compiler, no bundler. All files are served directly by Slopsmith's FastAPI host.

## Design north star

SlopScale is a **practice & learning tool, not a song/riff generator.** Its purpose is to be the state-of-the-art way to practise and learn an instrument **genre-fluently** — building transferable skills a player takes *off the screen* to write their own songs/solos and to be creative. Generated content is always a means to teach a skill, never the deliverable.

**The filter for every feature, generator, pathway, and agent:** *teach the grammar, not the sentences — build a skill the player owns off the screen; never do the creative work for them.* In practice:

- Every exercise **names or describes** the transferable skill it builds and why it's idiomatic — or, at minimum, is **justifiable against this north star** (the pathway goal-cards are the fullest expression).
- Speak the player's theory vocabulary out loud (name the devices: gallop, i–♭VI–♭VII, twin leads) so they learn the language, not just the fingering.
- Prefer **recombinable primitives** (power chords, gallop, pedal-riffs, harmonized lines) over fixed canned content — give the blocks, let the player assemble their own.
- Keep a deliberate on-ramp to creation: Guided → Custom → Improv/Jam. Drills are the entrance; creativity (improv, call-and-response, master/memory mode) is the destination, not optional polish.
- Realism guardrails (no-unison, the voicing engine, fretboard playability) are mission-critical — they're what make practised skill actually *transfer*, and why the harmony / fretboard / metal-idiom review agents matter.

The planned random-style generator is an **idiom-demonstration / practice-variety engine** (show the genre's grammar to learn from and riff against), never a "make me a song" crutch. And when finalising user-facing docs/description, let this framing show **implicitly** — describe SlopScale as a way to *learn and practise* an instrument, not as a generator.

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
| `docs/design-system.md` | GUI style guide (tokens, hierarchy, primary-action parity, theme-safe color rules) — **read before any GUI change**. |
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

There is **no unit-test or lint suite**. Verification is behavioural, via eight Playwright smoke suites in the `run-slopscale` skill, run against a live host (start it with `launch.ps1` first):

- `npm test` (from `.claude/skills/run-slopscale/`) runs **all eight** suites — renderers, then generators, then highway-settings, then strings/tuning, then audiocontext-sharing, then chord-scale connect, then variation-engine, then core-purity.
- `smoke-renderers.mjs` (`npm run smoke`) — walks all four renderers; asserts each attaches, draws, advances the playback clock, and throws no errors.
- `smoke-generators.mjs` (`npm run smoke:gen`) — drives `generateExercise()` across every practice type + scale, a bass pass, and all built-in sessions; validates chart structure.
- `smoke-highway-settings.mjs` (`npm run smoke:hwy-settings`) — guards that the borrowed 3D Highway inherits the host's `h3d_bg_*` look settings (and never writes them); see the "3D Highway inherits host settings" memory.
- `smoke-strings.mjs` (`npm run smoke:strings`) — drives the real form → `readConfig` path to guard that generated charts adjust for **string count** (4–8) and **tuning** (the displayed pattern + notes change), so the 2026-06-01 string/tuning plumbing bugs can't silently return; see the "stringed-instrument tuning/count framework" memory.
- `smoke-audioctx.mjs` (`npm run smoke:audioctx`) — guards that SlopScale's `window.AudioContext` patch (the highway-click stub) stays scoped to its **own active screen**: stub while SlopScale is visible, but a **real** `AudioContext` (with `decodeAudioData`) when backgrounded, so other plugins' stem loaders aren't poisoned. Regression guard for the v0.5.0 cross-plugin bug; see the "AudioContext patch must be screen-scoped" memory.
- `smoke-connect.mjs` (`npm run smoke:connect`) — guards the v0.6.0 "play the changes" voice-leading in `buildChordScaleExercise`: a ii–V–I in Connect mode must land each new chord's run on the nearest guide tone (3rd/7th), with **0 root-restarts** and bounded chord-seam leaps; see the "Playing-the-changes initiative" memory.
- `smoke-variation.mjs` (`npm run smoke:variation`) — guards the Workout variation engine: rolls **every variant of every `SEGMENT_TEMPLATE`** through `generateSession` (a one-slot template-ref workout), validates chart structure, and asserts the **length-locked** refresh invariant (all variants of a template share one duration — refresh varies content, never difficulty) plus `refreshWorkout` advancing; the no-row / style-lock / no-unison invariants throw at load via `validateSegmentTemplates`. See the "Segment library + Refresh" memory.
- `smoke-core-purity.mjs` (`npm run smoke:core`) — guards the core/shell host-independence boundary (see "Core/shell boundary" under Key constraints): traps `window`/`document`/`localStorage`/`fetch`/`slopsmith*` and runs every exercise/session builder to assert the generation path never touches the host surface.

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

### The four-mode DAW shell (current UI)

The UI is **one DAW-style shell with four modes** (shipped 2026-05-31, commits `bf197c8`→`aca34d8`) — switching modes is a single root-class swap (`ss-mode-*`); the persistent furniture (header top-bar, ruler/transport, stage, Inspector frame) never rebuilds and there is **no second player**. `MODE_META` drives the modes and `selectMode(mode)` does the swap:

- **Pathways** (`data-mode="session"`-token-stable rename of "Guided") — the curated `PATHWAYS`, presented via the **pathway picker** (`PATHWAY_BANDS` 6-band map + `renderPathwayList()` + `nodeProgressState()`); the old SVG skill-tree is shelved behind it (`renderSkillTree()` early-returns).
- **Custom** — full manual control; any Custom config is a saveable Workout block.
- **Workout** — timed multi-block sessions, the wall-clock evolution of `generateSession()`/`BUILT_IN_SESSIONS`. The one new time primitive is `targetSec` + `fillBlockToDuration()` (tiles whole repetitions to a wall-clock duration, overshooting to the next whole cell — never cutting a run mid-phrase); wired into `buildSessionChart` and `generateExercise`, no-op when absent.
- **Jam** — pick a style, play along immediately over a looping backing. `jamPlay()` builds a config from `stylePaletteConfig(styleId)` and loops it through the contained player. **Jam is a MIRROR, not a judge** — no score/combo/rank; feedback is a live chord-tone/guide-tone highlight on the fretboard strip (`jamTargetPcs()` + enriched `backingEvents`/`chordHighlightPcs`).

`STYLE_PALETTES` is the **one shared style→harmony table** (`{ progressions[], leadScales[], chordDepth/chordOverride, guideTones, feel{swing,backingStyle}, audioProfile }` per style) that a Pathway, a Custom config, and a Jam style all draw from; `stylePaletteConfig(id, opts)` returns a mergeable partial config, and a startup integrity guard (mirroring the no-unison guard) throws if a palette references a missing progression/scale/profile.

Shell furniture: a **header top-bar** (title · Setup popover `Guitar · Standard ▾` · centered 4-mode segments · progress chip → `P` sheet · ⚙ settings); the rail is purely the per-mode Inspector. **Hotkeys** (each also a visible button + `?` cheat-sheet; reduced-motion aware; never touch Esc; no audio): `M` mixer slide-up (per-bus faders/mute/solo + Backing dim, wired to the audio buses via `mixerGainFor`/`applyMixer`), `P` right-edge progress sheet, `[` Inspector collapse (`setPanelCollapsed`). Loop in/out are `i`/`o` (`[` was freed for collapse). Settings persist an accent theme (`--ss-accent-grad`/`-edge`), default XP mode, and default count-in. See `ROADMAP.md` "Four-Pillar Charette" for the full rationale and the still-pending pieces (drums voice #4, `slopscale.progress` XP store #6).

### screen.js structure

`screen.js` is one IIFE, ~10,050 lines. It loads as a classic `<script>` (the host injects it without `type="module"`), so it cannot use `import`/`export` — keep it one file. Major sections are marked with `§N` banner comments and indexed in a table-of-contents header at the top; **grep `§` to jump between sections, or use targeted `Grep` to locate one before reading.** Key sections (topical walk-through, **not** in §-order — see the TOC header in `screen.js` for the canonical §1–§15 order):

- **Constants** — `NOTE_NAMES`, `STRING_SETUPS`, `SCALE_INTERVALS`, `CHORD_FORMULAS`, `DIATONIC_QUALITIES`, `COMMON_PROGRESSIONS`, `SEQUENCE_PATTERNS`, `CHROMATIC_PATTERNS`, etc. `CHORD_FORMULAS` carries the **full interval stack** for each quality (including extensions past the octave for 9/11/13 chords); it is intentionally complete so the voicing engine decides what to actually play.
- **`CAGED_SHAPES`** — unified source of truth for CAGED shape data. Contains `rootStringIdx`, `scaleFretSpanFromRoot`, and `chordTemplates` per quality. **Do not split this into separate tables.** (Historical note: a previous version had two diverged tables; they were unified on 2026-05-26.) Scale/arpeggio shapes are resolved by degree-driven, no-unison selection (`resolveCAGEDShape` and the run-seam dedupe), not naive fret-window blocks — see the no-unison constraint below.
- **`PATHWAYS`** — curated pathway definitions: `label`, `goal`, `scales[]`, `tempoTiers[]`, `base` config, and `vary[]` list for Next Variation cycling.
- **`BUILT_IN_SESSIONS`** — the starter Workout library: **11 multi-segment session presets** spanning goal × level × genre × instrument (a `starter_arc` warm-up→technique→application default that's the first key/select option + the `onLaunchSession` fallback; Beginner Foundations; ii–V–I Workshop; Daily 30-min Intermediate; Blues/Bebop Fundamentals; Warm-up 10-min; Rock Essentials; Funk Pocket; Metal Technique; **Bass Foundations**). Each uses only 3–4 of the ~29 primitives, leaving room for distinct user workouts. `onLaunchSession` inherits the form's `stringSetup` only within the same **instrument family** (so instrument-specific presets stay correct and guitar-only techniques never land on bass).
- **Exercise builders** — `buildScaleExercise`, `buildChordScaleExercise`, `buildArpeggioExercise`, `buildSweepArpeggioExercise`, `buildChromaticExercise`, `buildGuideTonesExercise`. Each returns an `exercise` object. **`buildChordScaleExercise` carries the v0.6.0 "play the changes" dial** (Park / Connect / Connect+approach — UI labels for the internal `chord_tone_emphasis` / `mode_of_moment` values): in Connect it voice-leads across chord changes via `connectStartIdx(...)` + a threaded `prevMidi`, starting each new chord's run on the nearest guide tone (3rd/7th) instead of restarting on the root. Guarded by `smoke-connect.mjs`; the beat-based chord-event timeline (Stage 2) is still deferred — see the "Playing-the-changes initiative" memory + `ROADMAP.md`.
- **`generateExercise(cfg)`** — single-exercise dispatch; routes to the correct builder based on `cfg.practiceType`.
- **Session builders** — `buildSegmentConfig`, `buildBpmLadderChart`, `buildSessionChart`, `generateSession`. `generateSession()` is parallel to `generateExercise()`; both return the same `{ version, session, chart }` shape so the downstream `makeBundle`/launch path is unchanged.
- **Jazz harmony engine** — `chordQualityForDegree()` resolves the chord quality per scale degree (honouring `chordDepth` = power/triad/seventh/extended, `chordOverride`, and progression context), with optional **tritone substitution** (`cfg.tritoneSub` = `off` / `dominant_v` / `all_dominants`). `voiceChord(rootPc, intervals, opts)` is the **voicing engine** — it turns a raw interval stack into a playable voicing (voice count, register window, drop/omit decisions) rather than stacking every formula note. This is what keeps generated harmony musical; see `docs/musicality-guardrails.md`.
- **`makeBundle(exercise)`** — wraps an exercise into a renderer-ready bundle.
- **Renderer factory system** — `resolveRendererFactory(kind)` selects between renderers, borrowing host visualization plugins via the shared `borrowHostViz(globalName, scriptPath)` helper (lazy-load + poll for deferred `window.slopsmithViz_<id>` registration, with built-in fallback): `highway_3d` (host's `window.slopsmithViz_highway_3d`), `builtin_2d` (the **Jumping Tab** slot — borrows `window.slopsmithViz_jumpingtab`; the in-tree `makeBuiltin2DRenderer` is now only its last-resort fallback), `tab_2d` (Tab), `notation_2d` (Notation), and `piano_roll` (**groundwork only** — borrows `window.slopsmithViz_piano`, gated behind `pianoPathwayActive()` which returns `false`; the Piano Roll view button is `hidden`+`disabled`). User selection persisted via `localStorage['slopscale.renderer']`. Note: the host 3D highway renders **4–8 strings** (its `resolveStringCount` + 8-entry palette), so it is the default for guitar AND bass; `attachRenderer()` only force-falls-back to `builtin_2d` for counts it can't handle (>8 — not currently producible in SlopScale). `attachRenderer()` also calls `syncViewSwitcher(cfg.renderer)` after the saved-pref restore + any force, so the highlighted view button always matches the actual render. Borrowed viz plugins mount their own wrap as a sibling of `#slopscale-canvas`; `stopRenderer()` calls their `destroy()` on switch, and `.slopscale-render-host .jumpingtab-wrap` is sized to fill the host.
- **Built-in renderers** — `makeBuiltin2DRenderer`, `makeBuiltin2DTabRenderer`, `makeBuiltin2DNotationRenderer`, plus their draw helpers, driving `#slopscale-canvas`. Note spacing is **time-linear** (`xForDt(dt)` maps a note's time-offset from the playhead linearly to x — constant-speed scroll). The visible window (`AHEAD`/`BEHIND`, set per-draw) is **beat-relative** via `chartBeatSeconds(bundle)` (≈6.8 beats across the view, clamped), so note density stays comfortable/consistent across tempos instead of cramming at fast BPM; it's constant within a chart so the scroll speed is unchanged.
- **Live fretboard strip** — `drawFretboardFrame()` (+ `fretboardActiveNotes`, `fretboardSyncRange`, `fretboardStringCount`) draws a horizontal neck diagram on `#slopscale-fretboard` (docked under the render-host). It draws the exercise's whole pattern (`fbPattern`, unique string/fret positions) as **hollow circles**, and notes sounding within ~80ms of the playhead **glow filled** on top. The neck is **zoomed to the pattern's fret window** (`fbFretLo`/`fbFretHi`, ±1 fret with a min span) so the shape fills/centres the strip rather than floating on a full neck. Ported/generalised from the host Fretboard View plugin; any string count. Called from `drawOnce()` each frame, renderer-independently (early-returns when its canvas is hidden) — so it works under any active renderer. **Offered on every stringed-instrument view: 3D Highway, Jumping Tab (`builtin_2d`), Tab, and Notation** — gated by the `.slopscale-fb-capable` root class (set in `syncViewSwitcher`) AND a user toggle (`.slopscale-fb-on`, button `#slopscale-fretboard-toggle`, persisted in `localStorage['slopscale.fretboard']`, default off, `syncFretboardUI()`). Always hidden only for the Piano instrument (`.slopscale-piano-instrument … !important`).
- **Exercise title** — `exerciseTitle(cfg)` sets `bundle.songInfo.title` to the descriptive name (e.g. "C minor pentatonic"; session name for sessions). Each renderer draws this as its own in-canvas header in its native style (the built-in Tab/Notation `drawHud` draw title-only — no in-canvas timer; that lives in the HUD).
- **Player HUD** — `#slopscale-hud` overlay floating over the highway: time on the right (single timer, all views), and a title on the left **only for 3D Highway** (`.slopscale-hud-title-on`, set in `syncViewSwitcher`) since every other renderer draws the title in-canvas. Time set in `syncTransportTime()`, title in `syncTransport()`.
- **Audio engine (§14 — the largest single section, ~1,700 lines)** — a Web Audio graph built by `ensureAudioBus(ctx)`: **per-track buses → a master safety limiter** (a `DynamicsCompressor` that guards against stacked-note peaks for safe, normalized output — no clipping) → destination; grab a per-track sub-bus (notes / harmony / click / bass / drums) with `trackBus(ctx, name)`. This bus/limiter layer landed in the recent audio pass (see git log + ROADMAP audio handoff). **Instrument voices**: sample-based via **WebAudioFont** (`wafPlayer`, self-hosted under `static/wafonts/`, served by the `/wafont` route) on the `engine:'sample'` path, otherwise the synthesized **oscillator** voice. `AUDIO_PROFILES` maps a genre/style → `{ family, harmony:{engine,tone,level}, brightness }` (families: clean / acoustic / distorted / electronic); the resolver applies profile → family → `GLOBAL_AUDIO_DEFAULT`, with the **brightness slider** overriding. The **distorted family's NAM amp-model + cab IR chain** (`/nam` + `/ir` routes; NAM *engine* borrowed from the host `nam_tone` plugin at runtime, not bundled) is **in progress**. **Drums (Phase D, shipped — `a67ec29`/`b6504c6`):** pitch-less `role:'drums'` backing events (`buildDrumEvents`, odd-meter-aware via `buildGenericDrumGroove`) play on their own **drums bus compressed *before* the master limiter**, voiced by `scheduleDrumHit` → `resolveDrumKit` (sampled FluidR3 GM one-shots via `wafDrumVoice`, with a synth-808/909 fallback). §14 also owns the playback clock (`currentPracticeTime`, RAF `tick`), count-in clicks, the metronome, and note scheduling. Lanes: `sound-design-architect` (mix/aesthetics) + `audio-engine-architect` (sourcing method).
- **Slopsmith Minigames SDK integration** — pitch tracker via `window.slopsmithMinigames.scoring.createContinuous(...)`. Used as a scoring consumer only; **the plugin is not registered as a Slopsmith minigame.**
- **Public surface** — `window.SlopScale = { generateExercise, generateSession, makeBundle, resolveRendererFactory, readConfig, setSegmentLoop, clearSegmentLoop, getSegmentLoop, STYLE_PALETTES, stylePaletteConfig, SEGMENT_TEMPLATES, SEGMENT_ROLES, rollSegment, refreshWorkout }` (near the end of the file).
- **Segment-template + variation engine** (just after `stylePaletteConfig`) — the Workout library substrate. `SEGMENT_TEMPLATES` is a registry of templates `{ role, competency, band, style?, kind (1 of the 29 primitives), base, vary[] }` (a generalization of `PATHWAYS[].vary[]` + the palette index-picker). `rollSegment(template,{variantIdx,locks})` materializes one into a normal session segment; `refreshWorkout(session,{scope})` re-rolls template-ref slots. **Browse / Pick / Refresh are three reads of one object.** A workout segment may be an **inline** `{kind,config}` (legacy) OR a **template-ref** `{templateId, variantIdx, locks}` (materialized at the top of `buildSessionChart`'s loop). `validateSegmentTemplates()` is the startup guard enforcing the four refresh invariants (same-band / length-locked / style-locked / no-row-gate). See memory `project_segment_library_and_refresh`.
- **`bind()`** — wires all DOM events; called once on DOMContentLoaded.

### routes.py structure

FastAPI routes registered via `setup(app, context)`. All routes are under `/api/plugins/slopscale/`:

- `GET /status` — health check
- `GET /presets` / `POST /presets` / `DELETE /presets/{id}` — preset CRUD
- `GET /tunings` / `POST /tunings` / `DELETE /tunings/{id}` — custom-tuning CRUD (frontend posts a tuning by name + family + string count + MIDI list; id is an autoincrement INTEGER)
- `POST /temp-sloppak` — normalizes the frontend exercise payload (`_normalise_chart`), writes a directory-form `.sloppak` package under the DLC folder, returns `{ ok, filename, title, duration }`. **Dormant on the live path** — under contained playback `screen.js` no longer calls this route or `playSong()` (the only mention left in `screen.js` is a comment); kept for reference. See "Contained playback" below before assuming it's wired.
- **Self-hosted audio assets** (offline-safe; mirror the same guard — declared extension only, path-traversal rejected): `GET /wafont/{name}.js` serves WebAudioFont player + GM presets from `static/wafonts/` (the sampler backing); `GET /ir/{name}.wav` serves cab impulse responses from `static/irs/`; `GET /nam/{name}.nam` serves NAM amp captures (JSON) from `static/nam/`. `static/irs/` + `static/nam/` are **gitignored** (commercial IRs / GPL-3 community captures pending licensing clearance); the NAM *engine* (worklet+WASM) is **borrowed from the host's `nam_tone` plugin at runtime** (`/api/plugins/nam_tone/worklet/…`), not bundled. (The distorted-track chain that consumes the IR/NAM routes is in progress — see ROADMAP audio handoff.)

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

- **Contained playback — one player, owned by SlopScale.** Under the current model (decided 2026-05-30; see "Contained playback") SlopScale runs its **own** transport/audio/canvas lifecycle in `screen.js`. Do NOT reintroduce host-player handoff (`window.playSong`), and do NOT build a *second* transport/WebSocket/canvas beyond that one contained player.
- **Backend routes must stay under `/api/plugins/slopscale/…`.**
- **`window.playSong`, `window.showScreen`, `window.createHighway`, and `window.slopsmith`** are Slopsmith's public frontend APIs. Do not monkey-patch them. (`goScreen()` uses `window.slopsmith.navigate` / `window.showScreen` for navigation only.)
- **Don't globally clobber `window.AudioContext`** (or any shared browser global) in a way that degrades it for other plugins. SlopScale *does* replace it (`patchAudioContextForSharing`) with a click-suppressing stub for the borrowed highway_3d — but the stub is returned **only while SlopScale's own screen is active** (`#slopscale-root` has an `offsetParent`); when SlopScale is backgrounded, `new AudioContext()` must be the real thing, or the host player's stem loader gets a context with no `decodeAudioData` (the v0.5.0 cross-plugin regression: a too-broad gate poisoned the global session-wide once the pathway-select preload created the ctx). Guarded by `smoke-audioctx.mjs`.
- **Do not override Escape.** Slopsmith owns Escape for return-to-menu. The plugin's keyboard handler (`screen.js`) deliberately never touches it. (The old launch model used a `sessionStorage['slopscale.returnToMenu']` marker to override Escape; that flow is gone with contained playback.)
- **Do not add the temp sloppak to Slopsmith's library index.** It lives under `.slopscale-temp/` specifically to avoid indexing.
- **No-unison rule:** a scale/mode/arpeggio run must never sound the same pitch (same MIDI) twice across strings. Shapes are degree-driven, not fret-window blocks, and there is a startup regression guard that throws `[SlopScale no-unison] … doubles a pitch` if a resolved CAGED/Open shape doubles a note. When adding or editing shapes, preserve this — don't reintroduce fret-window selection.
- **Core/shell boundary (host-independence) — STRATEGIC.** The **generation path** — `generateExercise`/`generateSession` (§8–§9) and everything they call (the theory data tables §1–§3, the CAGED/3NPS/Open shape resolver §4, chord-depth + voicing engines §5–§6, the exercise builders §7, the pure chart helpers in §10) — is SlopScale's **host- and DOM-independent engine** and its durable IP / basis for a future standalone app or embeddable library. It consumes a plain `cfg` and returns a plain `{ version, session, chart }` (the **chart** is the portable artifact); it must **never** reference `window`, `document`, `localStorage`, `fetch`, or any `slopsmith*` global. **`makeBundle()` (§10) is the chart→renderer-bundle boundary** — it reads display prefs (highway inverted/lefty/render-scale/look), the first shell step, *not* core. §11–§15 (renderers + host-viz borrows, audio engine, Minigames scorer, navigation, storage, asset URLs) and `routes.py` are the **thin, disposable shell** — Slopsmith is *one* implementation behind that boundary, not a dependency woven through the core. `readConfig()` (§15) is the single DOM→`cfg` funnel. **Protect this by discipline, not speculative scaffolding:** keep coupling out of the generation path; do NOT build adapter/standalone abstractions until a second consumer actually exists. **Guarded by `smoke-core-purity.mjs`** (traps the host surface, runs every builder; in `npm test`). (Audited 2026-06-01: the generation path is verified clean — 29/29 builders; the only extraction blocker is the one-file/no-modules packaging. Coupling map + risks: project memory `project_host_independent_core`.)

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

## Working sessions (start / end checklist)

A lightweight ritual the **main thread** follows so context survives across sessions — the cheap alternative to a standing PM agent (see the group-design protocol below).

**At session start:**
- Read `ROADMAP.md` — authoritative for shipped-vs-planned; check **"Open threads"** and any **"STOPPED HERE"** handoff marker.
- Project memory (`MEMORY.md` index) loads automatically — skim it; for agent work, read the relevant `.claude/agent-memory/<agent>/`.
- Before acting on anything a memory names (file / function / flag), **verify it still exists** in the current code — memory reflects the past; the code is now.

**At session end (before closing):**
- Update `ROADMAP.md` — move finished items, log new **Open threads** or a **"STOPPED HERE"** handoff for the next session.
- Write durable **decisions** (not ephemeral task state) to project memory; spawned agents update their own `.claude/agent-memory/<agent>/`.
- If conventions changed, keep `CLAUDE.md` and `AGENTS.md` **in sync** (they mirror).
- If `screen.js` changed, run the smoke suites (`npm test` in `.claude/skills/run-slopscale/`, host running). Commit working changes following the repo's **Conventional Commits** style (`type(scope): …` — e.g. `feat(audio):`, `feat(ui):`, `docs:`); **commit/push only when asked.**

## Agent workflow (required)

Specialist agents in `.claude/agents/` (local) are the project's review/design layer — using them is part of the workflow, not optional. These are judgment-based conventions (they need the Agent tool + musical expertise), not automatable hooks.

1. **New genre pathway → a matching genre-idiom agent must own it.** Every genre pathway is vetted for authenticity by the idiom agent for its style. If a new genre pathway introduces a genre/style not yet covered by an existing genre-idiom agent, **create that agent first** (mirror an existing one, e.g. `metal-idiom-architect`). Agents are scoped per *genre/style*, and one agent owns all of that genre's pathways — do **not** create one agent per pathway (keep the clean matrix in `ROADMAP.md`).
2. **New instrument → create its pedagogy agent.** Adding an instrument beyond guitar/bass/piano requires a matching instrument-pedagogy agent (mirror `guitar-pedagogy-expert` / `bass-pedagogy-expert` / `piano-pedagogy-expert`) that verifies techniques, fingering, and scale/arpeggio patterns for that instrument.
3. **Create or adjust an exercise / generator / genre pathway → run it by the appropriate agents before it's "done."** Review with: the **instrument-playability** agent for the target instrument, the **genre-idiom** agent for its style, and **harmony-theory-architect** when harmony/voicings/progressions are involved. Act on the findings or log them — this is how the metal pack and the backing-track voicings were validated (and how the backing root-transposition bug was caught).

**Agent roster & memory.** The specialist agents live in `.claude/agents/*.md` (the genre-idiom set — expanded 2026-05-31 with **19 granular sub-genre agents** (kpop reviewed-and-cut; the broad→granular lane carves recorded in ROADMAP "Granular genre expansion"), the instrument-pedagogy set, and the cross-cutting architects — `harmony-theory-architect` (pitch), `rhythm-meter-architect` (the time/meter engine: subdivision, swing, count-in/loop tiling, odd/polymeter, the long-cycle model), `sound-design-architect` (playback audio quality + safe, normalized output — standard loudness/limiting, no clipping or gratuitous full-volume transients), `audio-engine-architect` (the rendering & instrument-sourcing *method* — synthesis vs amp/cab-modeling vs sampling vs host-engine; distinct from sound-design's mix/aesthetics), `learning-design-architect`, `gamification-architect`, and `slopscale-ux-designer`). Each clears a **distinct, non-overlapping lane** and accumulates findings across sessions in `.claude/agent-memory/<agent>/` — a `MEMORY.md` index plus per-topic files (e.g. logged harmony bugs, the blues content audit). Read the relevant agent's memory before spawning it, and skim it when you need the rationale behind a past decision; spawned agents already carry this context. (`.claude/agents/` and `.claude/agent-memory/` are gitignored — local-only.)

**Group-design sessions & synthesis (no standing PM agent).** Cross-cutting initiatives (a new pathway family, an instrument, a Core curriculum) are designed in a *group-design session*: the most relevant cross-cutting architect **chairs** (`learning-design-architect` for curriculum), genre/theory agents **shape content**, instrument-pedagogy agents **verify playability**, the rest **fill gaps**. The **main thread** runs the session, then synthesizes the outputs into one spec + a decision log, reconciles conflicts, updates `ROADMAP.md`, and writes decisions to memory. This coordination is deliberately the main thread's job — there is **no standing "project-manager" agent** (a cold-spawned agent would re-derive all context every time; the main thread already holds it).
