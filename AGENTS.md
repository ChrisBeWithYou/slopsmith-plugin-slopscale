# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository. It mirrors `CLAUDE.md` — keep the two in sync.

> **This file is split into numbered Parts** — most-stable first, each Part one coherent concern. It is auto-loaded into context every session, so it is kept scannable.

## Parts Index

- **Part 1 — Orientation & Rules** — what SlopScale is, the design north star, the recurring hard rules, the file map, and the dev/test workflow.
- **Part 2 — Architecture & Code Map** — core data flow, the four-mode shell, the two-lane transport, the string-index convention, and a compact code-map pointer (the full `screen.js`/`routes.py` walkthrough + data schemas live in `docs/code-map.md` / `architecture.md` / `exercise-schema.md`).
- **Part 3 — Constraints, Procedures & Workflow** — the key constraints, the contained-playback model, the "add a pathway / generator" how-tos, and the session-start/end + agent-workflow procedures.

### Adding a Part (do this automatically — no need to ask)

Keep this file in Parts rather than letting one sprawl; it loads every session, so scannability matters.

- **When:** while editing, if a Part would grow past **~2 screens (~150 lines)** — or the whole file past **~340 lines** — split it *before* saving.
- **How:** peel the most self-contained cluster (a whole `##` section, or a coherent group of them) into a new `# ─── Part N — <title> ───` banner and add a one-line entry to the Parts Index above. Never split a single `##` section across Parts.
- **Order:** keep Parts most-stable-first (constitution before code-map).
- **Mirror:** make the identical Part change in `CLAUDE.md` the same session (they mirror).
- **Ceiling, not quota:** never pad content to fill a Part.
- **Single sections stay whole:** a single `##` section is never split across Parts — if one grows too large to keep whole, promote its `###` subsections to `##` first, then peel a coherent cluster into the next Part. (Prefer demoting bulky *reference* detail into an on-demand `docs/` file and pointing to it — only always-loaded vs on-demand actually cuts the session context budget, not an in-file Part split.)

# ─── Part 1 — Orientation & Rules ───

## What this is

**SlopScale** is a **Slopsmith plugin** — it is not a standalone app. It generates guitar/bass practice routines (scales, arpeggios, chords, rhythm/technique drills, timed workouts, jam backing) and plays them back inside the plugin (contained playback — see "Contained playback" below). Install by dropping the repo into Slopsmith's `plugins/` directory and restarting; the plugin then appears in the Slopsmith navigation as "SlopScale".

The plugin has no build step. There is no `package.json`, no compiler, no bundler. All files are served directly by Slopsmith's FastAPI host.

## Design north star

SlopScale is a **practice & learning tool, not a song/riff generator.** Its purpose is to be the state-of-the-art way to practise and learn an instrument **genre-fluently** — building transferable skills a player takes *off the screen* to write their own songs/solos and to be creative. Generated content is always a means to teach a skill, never the deliverable.

**The filter for every feature, generator, pathway, and agent:** *teach the grammar, not the sentences — build a skill the player owns off the screen; never do the creative work for them.* In practice:

- Every exercise **names or describes** the transferable skill it builds and why it's idiomatic — or, at minimum, is **justifiable against this north star** (the pathway goal-cards are the fullest expression).
- Speak the player's theory vocabulary out loud (name the devices: gallop, i–♭VI–♭VII, twin leads) so they learn the language, not just the fingering.
- Prefer **recombinable primitives** (power chords, gallop, pedal-riffs, harmonized lines) over fixed canned content — give the blocks, let the player assemble their own.
- Keep a deliberate on-ramp to creation: Guided → Custom → Improv/Jam. Drills are the entrance; creativity (improv, call-and-response, master/memory mode) is the destination, not optional polish.
- Realism guardrails (no-unison, the voicing engine, fretboard playability) are mission-critical — they're what make practised skill actually *transfer*, and why the harmony / fretboard / metal-idiom review agents matter.
- **Gamification describes mastery, never substitutes a score for it** — credit named competencies, not rounds/time/rank; a "score to beat" is on-mission only as a *capstone demonstration of a skill already taught*, never the goal of practice. (This is the general principle the no-song-generator rule is a special case of, and the reason SlopScale is a **practice studio**, not a Slopsmith *minigame* — see the 2026-06-03 "stay a plugin, not a minigame" decision in `ROADMAP.md`.)

The planned random-style generator is an **idiom-demonstration / practice-variety engine** (show the genre's grammar to learn from and riff against), never a "make me a song" crutch. And when finalising user-facing docs/description, let this framing show **implicitly** — describe SlopScale as a way to *learn and practise* an instrument, not as a generator.

## Recurring rules (distilled from session corrections — 2026-06-02)

Promoted from patterns in past-session feedback — the things Christian kept having to repeat. Treat them as hard rules.

1. **Match the established standard — host-first, then DAW / notation convention.** When building or changing ANY UI / rendering / notation / transport element, match how it is *supposed* to look and behave: first **how the SlopSmith host does it** (the 3D Highway look, the transport, section looping, player chrome), then the **Logic-Pro / standard-DAW / standard-music-notation** convention. Do **not** invent non-standard variations. If our output has drifted from the host's default look/behaviour (e.g. a non-standard fret-counter element, a missing nut/headstock, downbeats sitting *on* the bar line instead of *between* bar lines, a 2D tab that doesn't look like plain black-and-white tab), that is a **regression to fix**, not a feature. When unsure, read the host source / look at a real DAW and copy the convention.

2. **Convene the FULL relevant agent panel up front — don't under-scope it.** Christian repeatedly has to add forgotten agents ("don't forget the bass and guitar agents", "we never got input from the slopsmith agent"). When you spin up a design/review panel, include **every** relevant lane the first time. Defaults: any **instrument / playability / exercise / fingering** topic → include **BOTH guitar-pedagogy AND bass-pedagogy** (plus piano-pedagogy when piano is in scope); any **host / integration / borrow-vs-build** topic → include **slopsmith-host-expert**; any **genre / harmony / voicing** topic → the relevant **genre-idiom agent(s) + harmony-theory-architect**. Err toward **over-including** a lane rather than making Christian remind you. (Extends "Agent workflow" below.)

3. **Design in the context of the whole pane — never a rip/replace in isolation.** When you change one UI element, design it against the rest of the pane: keep layout, spacing, control families, and design language consistent with the surrounding controls (see `docs/design-system.md`). Don't isolate the change to just swapping out the one element you were pointed at.

## File layout

| File | Role |
|------|------|
| `plugin.json` | Slopsmith plugin manifest (id, nav label, screen/script/routes pointers) |
| `screen.html` | Plugin UI — CSS, markup, and a small bootstrap script. Loads before `screen.js`. |
| `screen.js` | All generator logic, CAGED/3NPS data, pathway definitions, built-in renderers, audio playback, and Slopsmith integration. Runs in Slopsmith page scope. |
| `routes.py` | FastAPI routes under `/api/plugins/slopscale/…` — preset CRUD, status, and `POST /temp-sloppak` (the chart builder). |
| `settings.html` | Plugin settings panel fragment rendered by Slopsmith. |
| `static/` | Self-hosted audio assets served by `routes.py` — `wafonts/` (WebAudioFont sampler assets, committed); `irs/` + `nam/` (cab IRs / NAM amp captures, **gitignored** pending licensing). |
| `docs/architecture.md` | Integration design — the authoritative spec for how the plugin interacts with Slopsmith (incl. the Sloppak on-disk format, field-name translation, audio stem generation). Read this first before changing the launch flow. |
| `docs/code-map.md` | Per-section walkthrough of `screen.js` (the §1–§15 sections) + `routes.py` (routes, storage). **Read before working inside either file.** |
| `docs/exercise-schema.md` | Internal generated exercise/chart JSON schema + the compact note-field key meanings. |
| `docs/practice-pedagogy.md` | Pedagogical rationale behind the curated pathways and build order. |
| `docs/pedagogy-sequencing.md` | Beginner→advanced sequencing rationale for pathways. |
| `docs/fretboard-pedagogy.md` | Guitar fretboard system reference (CAGED, 3NPS, etc.). |
| `docs/position-system-rework.md` | Design notes on the unified position system (CAGED_SHAPES consolidation history). |
| `docs/tuning-model.md` | How tunings are modeled + named (absolute-MIDI canonical, name-resolution layer, host gotchas) — written shareable for the host team. |
| `docs/session-schema.md` | Session/segment data model used by `BUILT_IN_SESSIONS`. |
| `docs/theory-caged.md` / `theory-scales.md` / `theory-arpeggios.md` / `theory-jazz-advanced.md` / `theory-progressions.md` | Distilled theory knowledge base (CAGED, scales, arpeggios, advanced jazz, cross-genre progressions). |
| `docs/genre-framework-guitar.md` | Genre/style framework behind the progression library and random-style generator. |
| `docs/musicality-guardrails.md` | Spec for keeping generated output musically pleasing, not just theoretically correct (voicing engine rationale). |
| `docs/section-looping.md` | Section/segment looping design notes. |
| `docs/ui-session.md` | Session UI design notes. |
| `docs/design-system.md` | GUI style guide (tokens, hierarchy, primary-action parity, theme-safe color rules) — **read before any GUI change**. |
| `docs/session-2026-05-26-shape-system.md` | Shape-system unification session log. |
| `docs/backing-engine-roundtable.md` / `triad-mastery-ladder.md` / `proof-loop-slice.md` / `rhythm-ladder-roundtable.md` / `timing-judging-roundtable.md` / `hand-marks-roundtable.md` | Charette/spec docs for in-flight initiatives (backing-engine rebuild, triad-mastery pathway, proof-loop slice, rhythm/time ladder, timing-judging rework, hand-marks/fingering display) — see `ROADMAP.md` + project memory for status. |
| `docs/sources/` | Source PDFs — reference material only. |
| `README.md` | User-facing feature list + install steps. |
| `ROADMAP.md` | Phase plan; **read at session start**. Authoritative for "what's shipped vs planned". |
| `CLAUDE.md` | Claude Code variant; this file mirrors it. |

## Development workflow

No build. No dev server. The workflow is:

1. Clone into Slopsmith's `plugins/` directory as `slopscale/`.
2. Restart Slopsmith (web: `docker compose restart`; Desktop: relaunch the app).
3. Edit files, then reload the Slopsmith page. `screen.js` and `screen.html` changes take effect on page reload. `routes.py` changes require a Slopsmith restart.

To run, screenshot, or smoke-test the plugin without doing the clone/restart dance by hand, use the **`run-slopscale` skill** (`.claude/skills/run-slopscale/`). `launch.ps1` junctions this repo into the Slopsmith plugins dir, starts the bundled-Python host on port 8765, and waits for `/status` to return `ok`; `driver.mjs` drives the SlopScale screen via Playwright and screenshots any of the four renderers. Server logs land in `%TEMP%\slopscale\server.log`.

There is **no unit-test or lint suite**. Verification is behavioural, via sixteen Playwright smoke suites in the `run-slopscale` skill, run against a live host (start it with `launch.ps1` first):

- `npm test` (from `.claude/skills/run-slopscale/`) runs **all sixteen** suites **in parallel via `run-all.mjs`** (~20s wall; dev-ops audit 2026-06-05: suites are independent chromium processes, host-read-only, so concurrency 4 is safe; suites are *discovered* by the `smoke-*.mjs` glob so a new one can't be silently missed; a failing suite's full output is replayed at the end). `npm run test:seq` keeps the old sequential chain for debugging suspected cross-suite interference. The suites: renderers (incl. the wakelock-pair teardown guard), generators, highway-settings, strings/tuning, meter-aware-subdivision, over-the-barline, herta, audiocontext-sharing, chord-scale connect, variation-engine, session-sync, depth-ladder/progress, core-purity, backing-engine, gems (the #254 per-note gem hook + the timing-model acceptance — `smoke-gems.mjs`: a synthetic correct pitch through a FAKE scorer lights note[0], and an on-time player must credit EVERY note of a 160 BPM chromatic 16th run; target-independent), and **scoring-e2e** (`smoke-scoring-e2e.mjs` — the only REAL-audio test: a synthesized A2 WAV streamed as the mic via Chromium fake-media flags through the HOST's actual detector, with a wrong-key negative control; hard-FAILS on an SDK-less host by design).
- **Suites are PER-SYSTEM, never per-exercise/per-feature** (growth rule, dev-ops audit 2026-06-05). New content is already covered for free by enumeration (`smoke-generators` drives every practice type + every `BUILT_IN_SESSIONS` entry, with a drawer⇄registry drift guard) and by the startup guards; a new **durable semantic assert** lands as a **row in the suite that owns the system** (e.g. the djent engine semantics live in `smoke-generators` Phase 5; the tuning/instAgnostic plumbing rows in `smoke-strings` §7) — NOT as a new suite file. A new suite file needs a new *system*. Merge the legacy per-rung suites (herta, over-barline, connect, meter-subdiv) only opportunistically when already touching them.
- `smoke-renderers.mjs` (`npm run smoke`) — walks all four renderers; asserts each attaches, draws, advances the playback clock, and throws no errors. Also owns the **transport-split row** (2026-06-06: dedicated Stop + Play/Pause toggle — pause freezes the clock in place, resume re-anchors, Stop returns the playhead to the run start and is disabled when no run is alive).
- `smoke-generators.mjs` (`npm run smoke:gen`) — drives `generateExercise()` across every practice type + scale, a bass pass, and all built-in sessions; validates chart structure.
- `smoke-highway-settings.mjs` (`npm run smoke:hwy-settings`) — guards that the borrowed 3D Highway inherits the host's `h3d_bg_*` look settings (and never writes them); see the "3D Highway inherits host settings" memory.
- `smoke-strings.mjs` (`npm run smoke:strings`) — drives the real form → `readConfig` path to guard that generated charts adjust for **string count** (4–8) and **tuning** (the displayed pattern + notes change), so the 2026-06-01 string/tuning plumbing bugs can't silently return; see the "stringed-instrument tuning/count framework" memory.
- `smoke-meter-subdiv.mjs` (`npm run smoke:meter`) — guards the 2026-06-03 meter-aware **Division default**: a user meter change bumps a too-coarse subdivision up to the pulse (quarter→eighth under any /8) but never touches a /4 meter or a finer pick, an explicit pick survives a regenerate (a default, not a clamp), and the live pulse caption names the felt pulse / frames the cross-pulse phasing. Fixes the "quarter notes don't follow my tempo in 7/8" trap; the generation engine is intentionally unchanged (it is DAW/notation-correct — `secondsPerDivision`/`measureSeconds` untouched).
- `smoke-over-barline.mjs` (`npm run smoke:overbar`) — guards the Tier-2 capstone rung `rhy_over_barline` ("Over the Barline"): selecting the pathway presets quarter-in-7/8 and that preset **survives the Tier-1 meter-aware bump** (the trap-as-lesson interaction — pathways set fields silently), it generates a valid phasing chart (quarter notes that don't divide the 7/8 bar), and the option/band/goal-card are wired. The deliberate metric-superimposition drill that *teaches* the phasing Tier 1 steers beginners away from.
- `smoke-herta.mjs` (`npm run smoke:herta`) — guards the Tier-3 **guitar herta** drill (`buildHertaExercise` / `practiceType:'herta'` / the `pick_herta` Picking-band node): the cell is pick→hammer→pull→pick on one string (accent on note 0 by default), even sixteenths, a whole-step trill, with `hertaAccent` moving the accent (incl. the authentic accent-last) and `hertaWalk` walking the base through the scale. The authentic `R R L R` accent-last **drum** herta is a separate node (Tier-3 follow-on).
- `smoke-audioctx.mjs` (`npm run smoke:audioctx`) — guards that SlopScale's `window.AudioContext` patch (the highway-click stub) stays scoped to its **own active screen**: stub while SlopScale is visible, but a **real** `AudioContext` (with `decodeAudioData`) when backgrounded, so other plugins' stem loaders aren't poisoned. Regression guard for the v0.5.0 cross-plugin bug; see the "AudioContext patch must be screen-scoped" memory.
- `smoke-connect.mjs` (`npm run smoke:connect`) — guards the v0.6.0 "play the changes" voice-leading in `buildChordScaleExercise`: a ii–V–I in Connect mode must land each new chord's run on the nearest guide tone (3rd/7th), with **0 root-restarts** and bounded chord-seam leaps; see the "Playing-the-changes initiative" memory.
- `smoke-variation.mjs` (`npm run smoke:variation`) — guards the Workout variation engine: rolls **every variant of every `SEGMENT_TEMPLATE`** through `generateSession` (a one-slot template-ref workout), validates chart structure, and asserts the **length-locked** refresh invariant (all variants of a template share one duration — refresh varies content, never difficulty) plus `refreshWorkout` advancing; the no-row / style-lock / no-unison invariants throw at load via `validateSegmentTemplates`. See the "Segment library + Refresh" memory.
- `smoke-session-sync.mjs` (`npm run smoke:sync`) — guards multi-block Workout playback **alignment**: backing/notes/click must stay phase-locked across blocks. Builds sessions (tempo-varied blocks, a forced inter-block break, a bpm-ladder block, a key-cycle block) and asserts the **backing tracks each block's/rung's own tempo + key**, is **silent during the break**, and that single-config modes (Pathways/Custom/Jam) are unaffected. Regression guard for the 2026-06-02 backing-desync fix (backing had been synthesized from the *first* block's cfg over the whole session — `makeBundle` now prefers the per-block `chart.backingEvents` assembled by `buildSessionChart` + the rung builders).
- `smoke-progress.mjs` (`npm run smoke:progress`) — guards the Depth Ladder + XP store (`slopscale.progress`): XP accrues (gained-only); the **Travel axis** credits a clean Push pass in a not-yet-credited key **only once the Speed climb is cleared** (the rung flips on the 2nd distinct key, no double-credit, unclean runs rejected); **Off mode** collapses the whole layer. The store is **shell** (localStorage), not core. See the "Segment library + Refresh" memory (Phase 8).
- `smoke-core-purity.mjs` (`npm run smoke:core`) — guards the core/shell host-independence boundary (see "Core/shell boundary" under Key constraints): traps `window`/`document`/`localStorage`/`fetch`/`slopsmith*` and runs every exercise/session builder to assert the generation path never touches the host surface.
- `smoke-backing-engine.mjs` (`npm run smoke:backing`) — owns the **backing-engine system** (per the per-system growth rule, new backing-engine asserts land as rows here): `chart.timeline` structural validity for every style palette (slot-sorted, contiguous, covers the chart, the bar-locked degenerate case), sub-bar harmonic rhythm (`2/bar`), `applyTimelinePush` anticipation semantics, **seeded determinism** (same cfg ⇒ byte-identical chart, even for `direction:'random'`; `humanSeed` reproduces/varies the roll), key-cycle charts carrying a per-rung timeline, session charts assembling the timeline **per-block** (the desync rule), and the **rolling-window scheduler node ceiling** (Play on a 30-min Woodshed creates a bounded number of audio nodes — was 39k whole-pass — with no second-long main-thread block). Guards backing-engine steps 0–4 (rows added for step-3 `COMP_GROOVES` pad-kill/density/suppression and step-4 `BASS_FIGURES` walking/kick-lock/lift/mute); see the "Backing engine" memory.

These plus the startup regression guards baked into `screen.js` (e.g. the no-unison check, which throws on load if a resolved shape doubles a pitch) are the safety net before/after any `screen.js` change.

Alongside the durable `smoke-*.mjs` net, the `run-slopscale` dir also fills with **ad-hoc `probe-*.mjs` and `shot-*.mjs` scripts** — local-only (gitignored), one per feature. A `probe-X.mjs` asserts a just-built feature's behaviour (the per-feature counterpart to the suites; the standard way recent work is verified — see the `probe-…` citations throughout `ROADMAP.md`); a `shot-X.mjs` drives the UI and screenshots a state. They are **not** in `npm test` and may go stale — they are throwaway proofs for the session that built them. When a probe guards something durable, promote it to a `smoke-*.mjs` suite and add it to the `test` script in `package.json`.

To exercise backend routes directly, hit them via curl or the browser while Slopsmith is running:
- `GET /api/plugins/slopscale/status` — confirms the plugin is loaded
- `GET /api/plugins/slopscale/presets` — list saved presets
- `POST /api/plugins/slopscale/temp-sloppak` — build a temp chart; body is `{ "exercise": { ... } }`

# ─── Part 2 — Architecture & Code Map ───

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

- **Ladder** (user-facing label as of v0.7.1; **internal token is `data-mode="guided"`** — a *labels-only* rename of the former "Pathways"/"Guided", `673db57`; the picker header reads **"Skill Ladder"**. `MODE_META.guided.label`/`ss-mode-pathways`/`slopscale-pathway-*`/`PATHWAYS`/`renderPathwayList`/`slopscale.lastPathway` are all UNCHANGED — in code it's still "pathways/guided") — the curated `PATHWAYS`, presented via the **pathway picker** (`PATHWAY_BANDS` 6-band map + `renderPathwayList()` + `nodeProgressState()`); the old SVG skill-tree is shelved behind it (`renderSkillTree()` early-returns).
- **Custom** — full manual control; any Custom config is a saveable Workout block.
- **Workout** — timed multi-block sessions, the wall-clock evolution of `generateSession()`/`BUILT_IN_SESSIONS`. The base time primitive is `targetSec` + `fillBlockToDuration()` (tiles whole repetitions to a wall-clock duration, overshooting to the next whole cell — never cutting a run mid-phrase); wired into `buildSessionChart` and `generateExercise`, no-op when absent. The Workout is an **editable working-draft** (`_workoutDraft`, a deep clone — never mutates `BUILT_IN_SESSIONS`): an editable block timeline (reorder/duplicate/remove/re-roll), a slide-up library drawer over `SEGMENT_TEMPLATES`, and a `↻ Refresh` that re-rolls template-ref slots via `refreshWorkout`. **Pacing (2026-06-02):** `interBlockBreakBars()` inserts a tempo-locked count-in BREAK for the incoming block (doubles as the per-block verdict beat; `auto`/`always`/`off`), and `applyLengthPreset()` (Quick/Standard/Woodshed) distributes a total across blocks proportional to natural cell duration → a setup readout, never a countdown.
- **Jam** — pick a style, play along immediately over a looping backing. `jamPlay()` builds a config from `stylePaletteConfig(styleId)` and loops it through the contained player. **Jam is a MIRROR, not a judge** — no score/combo/rank; feedback is a live chord-tone/guide-tone highlight on the fretboard strip (`jamTargetPcs()` + enriched `backingEvents`/`chordHighlightPcs`).

`STYLE_PALETTES` is the **one shared style→harmony table** (`{ progressions[], leadScales[], chordDepth/chordOverride, guideTones, feel{swing,backingStyle}, audioProfile }` per style) that a Pathway, a Custom config, and a Jam style all draw from; `stylePaletteConfig(id, opts)` returns a mergeable partial config, and a startup integrity guard (mirroring the no-unison guard) throws if a palette references a missing progression/scale/profile.

Shell furniture: a **header top-bar** (title · Setup popover `Guitar · Standard ▾` · centered 4-mode segments · progress chip → `P` sheet · ⚙ settings); the rail is purely the per-mode Inspector. **Hotkeys** (each also a visible button + `?` cheat-sheet; reduced-motion aware; never touch Esc; no audio): `M` mixer slide-up (per-bus faders/mute/solo + Backing dim, wired to the audio buses via `mixerGainFor`/`applyMixer`), `P` right-edge progress sheet, `[` Inspector collapse (`setPanelCollapsed`). Loop in/out are `i`/`o` (`[` was freed for collapse). Settings persist an accent theme (`--ss-accent-grad`/`-edge`), default XP mode, and default count-in. See `ROADMAP.md` "Four-Pillar Charette" for the full rationale and the still-pending pieces (drums voice #4, `slopscale.progress` XP store #6).

### The two-lane transport (the DAW arrangement view)

Built 2026-06-02 (commits `c616e72`→`d8281bf`); all modes share `#slopscale-ruler-canvas`. It is **two lanes**, and matches a real DAW rather than inventing a counter:

1. **Scrolling bars|beats working ruler** — LOCKED to the note renderers' window (`rulerWindow`/`rulerMap` off `chartBeatSeconds` + `AHEAD`/`BEHIND`), playhead fixed ~22% from the left, bars pixel-aligned with the falling notes, ~7 bars on screen so it stays legible at any tempo/length (no decimation). Drawn by `drawRulerFrame()`.
2. **Whole-session overview / marker strip** — `drawOverviewFrame()`/`overviewBands` from `segmentBounds`, each band **role-tinted and NAMED** = the DAW arrangement track (mirrors the host **Section Map** plugin; nothing borrowable, so build-but-mirror). It owns A–B loop **authoring** (drag), click-seek, and a viewport box; the working ruler reflects the loop + off-screen edge chevrons.

In **Jam** (`isJamMode`) the overview becomes the **chord loop** — function-tinted bands of the progression with chord name + roman numeral (from enriched `backingEvents` `rn`/`fn`), current chord bright + NEXT raised, loop-relative bars on the working ruler; the fretboard pre-lights the next chord's guide tones as an amber dashed ghost ~1.5 beats early (`jamNextGuidePcs`) = play-the-changes anticipation. Progressive disclosure: a single Pathway drill shows the simplest transport; Custom/Workout scale the band lane out. **Deferred polish:** tokenize the ruler's raw hex → `--ss-*`; a min:sec readout; decimated bar labels on the overview. Full spec + window math: memory `project_transport_two_lane_redesign`.

### Code map (screen.js + routes.py)

`screen.js` is **one IIFE, ~16,600 lines** — it loads as a classic `<script>` (no `type="module"`), so it **cannot use `import`/`export`; keep it one file.** Sections are marked with `§N` banner comments and indexed in a **table-of-contents header at the top of the file** (the canonical §1–§15 order) — **grep `§` or read that header to navigate before editing.**

`routes.py` registers FastAPI routes under `/api/plugins/slopscale/…` (status, preset + tuning CRUD, the dormant `POST /temp-sloppak` chart builder, and the self-hosted `/wafont` `/ir` `/nam` audio-asset routes). **Storage is DB-backed** (the shared Slopsmith meta-DB via `context["meta_db"]` → tables `slopscale_presets` + `slopscale_tunings`), not flat files.

**The full per-section walkthrough of both files lives in `docs/code-map.md`** (the screen.js §-walkthrough — constants, `CAGED_SHAPES`, `PATHWAYS`, `BUILT_IN_SESSIONS`, the exercise/session builders, voicing engine, renderer factory, fretboard strip, audio engine §14, segment-template engine, public surface — plus the routes.py route list + storage model). **Read it before working in either file.** For the rest: the on-disk **Sloppak format, the `chordTemplates`→`templates` / `handShapes`→`handshapes` field translation, and audio stem generation** are in `docs/architecture.md`; the **exercise/chart JSON schema + the compact note-field key meanings** (`t`/`s`/`f`/`sus`/`bn`/`ho`/`po`/…) are in `docs/exercise-schema.md`.

### String index convention

**In SlopScale, `s=0` is the lowest string (low E in standard 6-string tuning).** This is the `openMidis` array index in `STRING_SETUPS` and the `s` key in `CAGED_SHAPES.chordTemplates`. This is the opposite of Rifflarr's convention — do not cross-apply.

# ─── Part 3 — Constraints, Procedures & Workflow ───

## Key constraints (from docs/architecture.md)

- **Contained playback — one player, owned by SlopScale.** Under the current model (decided 2026-05-30; see "Contained playback") SlopScale runs its **own** transport/audio/canvas lifecycle in `screen.js`. Do NOT reintroduce host-player handoff (`window.playSong`), and do NOT build a *second* transport/WebSocket/canvas beyond that one contained player.
- **Backend routes must stay under `/api/plugins/slopscale/…`.**
- **`window.playSong`, `window.showScreen`, `window.createHighway`, and `window.slopsmith`** are Slopsmith's public frontend APIs. Do not monkey-patch them. (`goScreen()` uses `window.slopsmith.navigate` / `window.showScreen` for navigation only.)
- **Don't globally clobber `window.AudioContext`** (or any shared browser global) in a way that degrades it for other plugins. SlopScale *does* replace it (`patchAudioContextForSharing`) with a click-suppressing stub for the borrowed highway_3d — but the stub is returned **only while SlopScale's own screen is active** (`#slopscale-root` has an `offsetParent`); when SlopScale is backgrounded, `new AudioContext()` must be the real thing, or the host player's stem loader gets a context with no `decodeAudioData` (the v0.5.0 cross-plugin regression: a too-broad gate poisoned the global session-wide once the pathway-select preload created the ctx). Guarded by `smoke-audioctx.mjs`.
- **Do not override Escape.** Slopsmith owns Escape for return-to-menu. The plugin's keyboard handler (`screen.js`) deliberately never touches it. (The old launch model used a `sessionStorage['slopscale.returnToMenu']` marker to override Escape; that flow is gone with contained playback.)
- **Do not add the temp sloppak to Slopsmith's library index.** It lives under `.slopscale-temp/` specifically to avoid indexing.
- **Tailwind: common core utilities only — no arbitrary-value classes, no CDN/runtime JIT** (host `docs/plugin-styles.md`; verified 2026-06-07). The host serves a prebuilt sheet scanned only from core source, and SlopScale (runtime-installed) is never scanned — a class core doesn't ship renders unstyled. We're compliant by omission: `screen.html`/`screen.js` use zero Tailwind (self-contained `ss-*` CSS) and `settings.html` uses only common utilities verified present in the host's `static/tailwind.min.css`. If a future change needs a class beyond that set (especially `text-[11px]`-style arbitrary values), adopt the host's `styles` capability properly: compiled `assets/plugin.css` (`preflight: false`, utilities only), `"styles"` in `plugin.json`, version-bump on every CSS rebuild.
- **No-unison rule:** a scale/mode/arpeggio run must never sound the same pitch (same MIDI) twice across strings. Shapes are degree-driven, not fret-window blocks, and there is a startup regression guard that throws `[SlopScale no-unison] … doubles a pitch` if a resolved CAGED/Open shape doubles a note. When adding or editing shapes, preserve this — don't reintroduce fret-window selection.
- **Core/shell boundary (host-independence) — STRATEGIC.** The **generation path** — `generateExercise`/`generateSession` (§8–§9) and everything they call (the theory data tables §1–§3, the CAGED/3NPS/Open shape resolver §4, chord-depth + voicing engines §5–§6, the exercise builders §7, the pure chart helpers in §10) — is SlopScale's **host- and DOM-independent engine** and its durable IP / basis for a future standalone app or embeddable library. It consumes a plain `cfg` and returns a plain `{ version, session, chart }` (the **chart** is the portable artifact); it must **never** reference `window`, `document`, `localStorage`, `fetch`, or any `slopsmith*` global. **`makeBundle()` (§10) is the chart→renderer-bundle boundary** — it reads display prefs (highway inverted/lefty/render-scale/look), the first shell step, *not* core. §11–§15 (renderers + host-viz borrows, audio engine, Minigames scorer, navigation, storage, asset URLs) and `routes.py` are the **thin, disposable shell** — Slopsmith is *one* implementation behind that boundary, not a dependency woven through the core. `readConfig()` (§15) is the single DOM→`cfg` funnel. **Protect this by discipline, not speculative scaffolding:** keep coupling out of the generation path; do NOT build adapter/standalone abstractions until a second consumer actually exists. **Guarded by `smoke-core-purity.mjs`** (traps the host surface, runs every builder; in `npm test`). (Audited 2026-06-01: the generation path is verified clean — 29/29 builders; the only extraction blocker is the one-file/no-modules packaging. Coupling map + risks: project memory `project_host_independent_core`.)

## Contained playback (current model)

**SlopScale runs as a fully self-contained player; "Play" never launches the host player.** This is a deliberate decision (2026-05-30, commit `e62d02a`) that supersedes the "Launch in Main 3D Player" UX described in older `docs/architecture.md` prose. Practice plays back inside the plugin via `startPlayback()` (own RAF clock + Web Audio + pitch tracker) across the renderers selected by `resolveRendererFactory()`.

Consequence: `screen.js` does **not** call `fetch('/api/plugins/slopscale/temp-sloppak')` or `window.playSong`. The `POST /temp-sloppak` route in `routes.py` (and the field-translation / sloppak-format machinery documented above) still exists but is **dormant** — kept for reference and possible future re-enablement, not on the live path. Don't "fix" the frontend to call it without confirming the contained-playback decision has been reversed (check `ROADMAP.md` and project memory first).

## Adding a new pathway

1. Add an entry to `PATHWAYS` in `screen.js` with `label`, `goal`, `scales`, `tempoTiers`, `base` config, and `vary[]`. Optional flags: `instAgnostic:true` makes a pure-time rung ADAPT to the player's current instrument instead of forcing its coded `stringSetup` (the per-pathway form of the Rhythm-band adapt); a `customOpenMidis:'csv'` in base/vary applies a tuning override (it's anti-leak defaulted in `applyPathwayConfig`, so it never persists into the next pathway). **Technique/rhythm rungs anchored to the low string code NO key:** `anchor:'open_lowest'` + `anchorFret:0–11` in base (vary steps move `anchorFret`) — the key is DERIVED from the player's actual lowest string at apply time (`applyAnchorPolicy`; a startup guard throws on `key` co-coded with `anchor`). Genuinely keyed lessons (CAGED maps, progressions, blues) keep keys.
2. Add the corresponding `<option>` to the `#slopscale-pathway` select in `screen.html`, and slot the id into its band's `pathways[]` in `PATHWAY_BANDS` (+ a `SKILL_TREE_EDGES` prereq edge for the "Builds on" hint).
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
4. **Host check BEFORE building anything in the shell (borrow-before-build).** Any **new capability** outside the generation-path core (§1–§10) — player/transport chrome, audio synthesis/instruments, scoring/detection/judging, visualization, persistence, gamification plumbing — gets a host check **before design starts**: consult `slopsmith-host-expert` (its memory first — it caches the host surface; live-verify against the checkout source when stale or absent). The artifact is a 5-line **HOST CHECK** block in the feature's spec doc (or its ROADMAP entry when there's no doc): *capability · what the host has (file/API, or "nothing found") · evidence + date · verdict BORROW / MIRROR / BUILD · what host change would flip the verdict*. The core generation path never needs one (the host will never ship our USP); fixes to already-shipped shell code don't re-trigger it. In group-design sessions, the HOST CHECK is the chair's first agenda item for any shell-touching initiative. This is the pre-design counterpart of Part 1 rule 1: that rule governs how shell things look/behave; this one governs whether we build them at all. **When the capability ships, quote the HOST CHECK block in the build hand-back to Christian (and in its ROADMAP entry/commit body) — borrow-vs-build must be visible at delivery, not only at design** (adopted 2026-06-06: the tuner's check ran correctly pre-design but produced no visible artifact, so Christian had to ask after the fact). Standing corollary (ratified 2026-06-06): **SlopScale never builds its own polyphonic/chord-detection DSP** — credit semantics and display surfaces are ours; detectors are host territory. (Why: NAM, the WebAudioFont sampler, highway-settings inheritance, and the scoring SDK were each designed/built before discovering the host already had them — each cost a migration this check costs minutes to prevent.)

**Agent roster & memory.** The specialist agents live in `.claude/agents/*.md` (the genre-idiom set — expanded 2026-05-31 with **19 granular sub-genre agents** (kpop reviewed-and-cut; the broad→granular lane carves recorded in ROADMAP "Granular genre expansion"), the instrument-pedagogy set, and the cross-cutting architects — `harmony-theory-architect` (pitch), `rhythm-meter-architect` (the time/meter engine: subdivision, swing, count-in/loop tiling, odd/polymeter, the long-cycle model), `sound-design-architect` (playback audio quality + safe, normalized output — standard loudness/limiting, no clipping or gratuitous full-volume transients), `audio-engine-architect` (the rendering & instrument-sourcing *method* — synthesis vs amp/cab-modeling vs sampling vs host-engine; distinct from sound-design's mix/aesthetics), `learning-design-architect`, `gamification-architect`, `slopscale-ux-designer`, and `devops-operability-architect` (operability / test-harness / release / runtime-robustness — "is it solid to run + ship?"; carries target-CURRENT-Slopsmith + triage-by-value; defers host-API specifics to `slopsmith-host-expert`)). Each clears a **distinct, non-overlapping lane** and accumulates findings across sessions in `.claude/agent-memory/<agent>/` — a `MEMORY.md` index plus per-topic files (e.g. logged harmony bugs, the blues content audit). Read the relevant agent's memory before spawning it, and skim it when you need the rationale behind a past decision; spawned agents already carry this context. (`.claude/agents/` and `.claude/agent-memory/` are gitignored — local-only.)

**Group-design sessions & synthesis (no standing PM agent).** Cross-cutting initiatives (a new pathway family, an instrument, a Core curriculum) are designed in a *group-design session*: the most relevant cross-cutting architect **chairs** (`learning-design-architect` for curriculum), genre/theory agents **shape content**, instrument-pedagogy agents **verify playability**, the rest **fill gaps**. The **main thread** runs the session, then synthesizes the outputs into one spec + a decision log, reconciles conflicts, updates `ROADMAP.md`, and writes decisions to memory. This coordination is deliberately the main thread's job — there is **no standing "project-manager" agent** (a cold-spawned agent would re-derive all context every time; the main thread already holds it).
