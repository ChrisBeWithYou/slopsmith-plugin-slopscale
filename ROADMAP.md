# SlopScale Roadmap

> Read this at the start of every session. Update it before closing.
> Current date: 2026-05-31. Total commits: 171.

---

## ⭐ Four-Pillar Charette (2026-05-31) — synthesis, decisions & build queue

A 13-agent group-design charette (chaired by `learning-design-architect`; main thread synthesized) on the current plugin, the GUI, the gameplay/feedback loops, and **four product pillars** Christian wants to build around. Two cross-cutting agents were created for it: **`market-analyst`** (outside-in comps/positioning/metrics) and **`slopsmith-host-expert`** (host build-vs-borrow). **Design only — nothing built as code yet.** Per-lane detail lives in each agent's `.claude/agent-memory/<agent>/`; the top-line is also in project memory `project_four_pillar_charette`.

> ⚠ Agent-runtime note: an agent type is only spawnable in the session *after* its file is created. `market-analyst` made the cutoff and ran live; `slopsmith-host-expert` did **not** — its charette input was produced by a general-purpose stand-in (flagged in its memory, re-verify next session). `gamification-architect` hit the same delay last session.

### The four pillars (Christian's framing)
1. **Development Pathways** — guided curriculum (exists; guitar Core designed in memory, not built).
2. **Custom / Practice** — drill *exactly* what you choose (controls exist but buried behind a text link).
3. **Workout Planner** *(new)* — "woodshed N minutes, target a few skills" — recommend-or-define, default templates, guided customization, **saveable** timed multi-block session.
4. **Jam / Backing-track** *(new)* — pick a style, **play along immediately** on your instrument; apply the skill, find your own self-expression.

### Unifying thesis (near-unanimous)
**The four pillars ARE the easy→medium→hard→mastery arc.** Pathways/Custom = drills → **Workout = deliberate-practice woodshedding** → **Jam = the mastery / transfer rung** (apply a learned competency over real changes, off-script). Jam scoped as *backing + targets* (not a graded score-attack, not a song generator) **IS the missing mastery rung** the Cores top out short of — so we get "mastery" without first building master/memory mode. The north-star story: every rival makes you a *passenger on a song*; we make you a *player who owns the skill*.

### Locked convergences
- **One shared progression ledger.** Every mode writes one store (`slopscale.progress = { xp, byNode:{[id]:{reps,bestBpm,clearedAt,masteredAt}} }`); **XP is derived** (time-on-instrument × difficulty), never spendable, never gates. Jam/Custom passively attribute to nodes the way Custom already credits `pathway_tiers` (±5 BPM).
- **Jam is a MIRROR, not a JUDGE.** No score/combo/rank/leaderboard in Jam (a grade kills self-expression). Feedback = descriptive telemetry + a **live chord-tone/guide-tone highlight on the fretboard strip** so Jam *teaches* chord-scale membership. Pitch tracker reflects, never verdicts.
- **`STYLE_PALETTES` — one shared style→harmony table** (progressions[] + quality defaults + leadScale + guideTones + backing-feel per style); the single source a Pathway, a Custom config, and a Jam style all draw from. Built from the existing engine (`COMMON_PROGRESSIONS`, `voiceChord`, `chordQualityForDegree`, boogie/swing). Loops a palette; **never composes song form** = the idiom-*demonstration* engine the north star calls for.
- **Workout = timed blocks; ONE new time primitive.** All existing pieces reusable (`buildSessionChart`, `buildBpmLadderChart`, `applyCountIn`, `_tail` tiling, `applySwingToBundle`) **but they count bars/reps, never wall-clock seconds.** Add `targetSec` + `fillBlockToDuration()` (whole cells only — overshoot, never cut a run mid-phrase). A block = a pathway node or a Custom config + a duration — **blocks must BE existing curriculum units, never a forked library.** Playhead crossing `segmentBounds.end` *is* the advance (no second clock); 1-bar lead-in rest re-announces each block's count.
- **A believable backing BAND or Jam dies.** "MIDI-sounding backing" is the #1 complaint vs the whole backing lane. **Biggest missing voice = DRUMS** → **self-host WebAudioFont GM bank-128 percussion** (~8–12 files). `AUDIO_PROFILES` extends from one voice to an **ensemble spec** (drums/bass/comp/pad, each on its own bus). Sourcing by style-class: acoustic/jazz all-sampled; rock/metal bass+comp via the borrowed NAM amp, drums sampled. **Host correction (slopsmith-host-expert):** the host `drums` plugin is a drum-highway+MIDI-scorer that CDN-loads samples — **NOT a borrowable bank**; use it only as a code reference for the GM note→drum map, self-host the rest. Cap live voices (~8–20 buffers + at most ONE NAM worklet); lazy-load per active style, not all 38.
- **One DAW shell, four modes, zero new players.** Mode switch = one root-class swap (`ss-mode-*`); only the **Inspector content** swaps, persistent furniture (ruler/transport/stage/Inspector frame) never rebuilds. Custom promoted to a co-equal mode.
- **Don't register as a Slopsmith minigame** (host-expert, confirmed in host source): the pitch-tracker mirror (`slopsmithMinigames.scoring.createContinuous`) works **unregistered**; registering routes through the host hub's `start({container})` and would **break contained playback**. **Feature-detect** the Minigames SDK — it's absent from the bundled 0.2.7 runtime (present only in the 0.2.9-alpha checkout); degrade gracefully.

### Christian's decisions (LOCKED 2026-05-31)
- **XP toggle → Off / Casual / Hardcore, penalty→bonus.** Ship the toggle (autonomy + it PROVES the layer is soft — switches off entirely). **The "less XP for skipping prerequisites" penalty is REJECTED** (loss-aversion/dark-pattern); its honest intent is salvaged as a **Hardcore opt-in BONUS** ("clean ascent" recognition for mastering in order). **Only ever display XP gained, never "you lost X."** OK to add the `slopscale.progress` readout (derived, never gates). Casual (default) = full XP everywhere + a soft "foundation suggested" hint on unmastered-prereq nodes.
- **Mission tweak → blend "a place to speak it" + the daily-pickup line** (see updated north star below).
- **Build order → Foundation first** (guitar Core ★ nodes over existing generators + the two shared primitives `STYLE_PALETTES` and `targetSec`) — cheapest, already designed, unblocks BOTH new pillars + Pathways/Custom at once.

**Updated north star (light tweak — folds into CLAUDE.md "Design north star"):**
> *Teach the grammar, not the sentences — build transferable, genre-fluent skill you own off the screen, and give every skill a place to **speak** it (drills build it, the jam is where you say something of your own): an instrument you actually want to pick up every day.*

### DAW-forward UI (slopscale-ux-designer + Christian's notes)
"Inspired by Logic Pro & comparable DAWs" but improved with gamification best-practice, on overridable `--ss-*` tokens (Slopsmith may "paint over" later). Hotkeys (each also a visible button + a `?` cheat-sheet; no keyboard-only affordances): **`M`** = Mixer slides UP from the bottom over the render window (overlay ~220ms, honors reduced-motion; stage renders behind, no canvas refit; `M` again to drop) — backing/jam per-bus faders/mute/solo + a "Backing dim"; **`P`** = Progress/XP/badges sheet slides in from the right (gamification owns content, UX renders frame; hosts only *shipped* primitives — skill tree, streak, session-summary cards, XP-as-readout); **`[`** = sidebar pill collapses the Inspector to an icon spine. **DAW-fluency = a legitimate SECONDARY transferable competency** (real DAW vocab — transport/loop region/tempo/**gain** not "volume"; the per-bus mixer teaches **gain-staging** via shown signal flow source→bus→limiter); surfaced as one-line descriptors, never a second curriculum.

### Per-pillar design (named primitives)
- **Pathways:** ship the designed guitar Core web (`learning-design-architect/project_guitar_core_web.md`); cheap ★ nodes need only existing generators. `guitar-pedagogy-expert` confirmed it slots cleanly under Pillar 1.
- **Custom:** promote to co-equal mode; show competency name + arc-stage label; any Custom config is a saveable Workout block. **Our sharpest market win** — no rival generates "Cm pentatonic 3NPS at the 7th, 90 BPM" on demand.
- **Workout:** Inspector = "Woodshed [N] min" + target-skill chips + **Recommend** button (reads the shipped session log → lowest tempo-tier cleared, longest-unseen node, accuracy-gate misses → proposes 3 targets) + a drag-reorder block strip. Sequence: **warmup → technique target (1–2 isolated weak competencies) → application (interleave over a vamp/Jam)**; pull 1 review block (>3 sessions old); no two same-theme blocks back-to-back. Saves like a preset; plays via `generateSession()`. **The most uncontested market gap** (Melodics is drums/keys-first). *Host note:* the host `practice`/`setlist`/`the_daily` plugins are references (journal/streak/daily-pick patterns), not dependencies — keep SlopScale's shared-meta-DB tables.
- **Jam:** Inspector = style grid + key + tempo + Feel + one big **Jam** button. Backing band + live target highlight; contained playback. Live tempo/feel change without restart (store at a reference BPM, apply a `tempoScale` multiplier, re-tile at the next loop boundary; feel toggles at the next bar — **snap to bar, never mid-bar**). Mix bar: player notes loudest (ref 0), bass −6, comp −11, click −14/off; carve the backing so the player's attack always reads through (the player is the star).

### Cross-instrument (scope-level parity)
- **Bass:** Jam is bass's *strongest* mode — but the backing must **drop/mute the bass stem** (the 'bass' bus needs mute/solo) so the player isn't doubled. Workout targets differ (pocket/timing, walking lines, RH stamina — **not** sweep/3NPS speed). **Keep CAGED/3NPS/sweep OUT of the bass UI** (`syncInstrumentClass` already force-switches — confirm it holds for every new mode surface).
- **Piano (future-proof NOW, cheap):** add nullable `hand` (L/R) + `finger` (1–5) to the note schema; make Jam backing role a parameter `playerRole: comp | solo | both`; reserve **two-hand-coordination** as a first-class Workout target category; make the live fretboard strip a **pluggable instrument-diagram slot** (keyboard-diagram sibling later); rename "fret window" → neutral `positionContext` in shared config.

### CUT list (don't build / off-mission)
"Make me a song/solo/lick to learn" · master-mode as a *prerequisite* to ship Jam · a Workout block library separate from Pathways/Custom · hard-gating Workout recommendations · the skip-ahead XP *penalty* · Jam score/combo/S-rank/leaderboard · spendable-XP economies, daily-login bonuses, FOMO/streak-anxiety, "perfect session" bonuses, audio victory stingers · registering as a minigame · stem-separation / play-to-real-tracks · chasing Band-in-a-Box arrangement depth or a song catalog · tab/notation *editor* ambitions · adaptive-AI-coach v1 · a second live amp instance · per-channel EQ/pan/multi-reverb in the mixer v1 · odd/changing-meter + herta long-cycle in Workout/Jam v1.

### Build queue (prioritized, dependency-ordered) — **Foundation first (locked)**
1. ✅ **Guitar Core ★ nodes over existing generators** + reorder power chords into Beginner + surface the Feel control — **BUILT + AGENT-REVIEWED 2026-05-31** (committed `9d02b88`; review fixes uncommitted). 7 ★ pathways + skill-tree nodes/edges + select options; power chords in Beginner; `static_i` token. **Agent review done** (guitar-pedagogy + harmony-theory): `static_i` confirmed correctly wired; 6/7 sound. **Fixes applied:** (a) **must-fix** — `full_neck` was the one resolver path skipping unison-dedupe (C-major whole-neck sounded ~61 back-to-back octave dups, a no-unison-rule violation) → wrapped in `dedupeUnisons` (verified: 29 distinct pitches, 4-octave span, 0 adjacent dups); (b) **should-fix** — exotic scales w/o a `DIATONIC_QUALITIES` row silently borrowed a **major triad** for the tonic drone (major 3rd over locrian♮2/altered's ♭3; same root cause as the metal degree-7 bug) → added scoped `SCALE_TONIC_QUALITY` tonic map (existing qualities only; pentatonic/blues untouched) + bumped melmin to 7th depth. **Future enhancement (logged):** add `7alt`/`maj7#5` qualities for fuller exotic-tonic accuracy. The comping Core nodes (B5/I6/I7) still need `buildCompingExercise` (#7); the master/improv rung (A8) needs its engine.
2. ✅ **`STYLE_PALETTES`** (shared style→harmony table) — **BUILT 2026-05-31** (uncommitted). One shared `{progressions[] · leadScales[] · chordDepth/chordOverride · guideTones · feel{swing,backingStyle} · audioProfile}` table seeded from shipped, agent-vetted pathway DNA + `AUDIO_PROFILES` + real tokens (9 styles: blues/rock/metal/djent/jazz/funk/pop/country/gospel). `stylePaletteConfig(id, opts)` returns a mergeable partial config; startup integrity guard (mirrors no-unison) throws if a palette references a missing progression/scale/profile. Exposed on `window.SlopScale`. Verified: all 9 round-trip to valid charts. **Pending: genre-idiom + harmony review of palette CONTENTS before Jam/pathways consume them; broaden beyond the 9-style seed.**
3. ✅ **`targetSec` + `fillBlockToDuration()`** — **BUILT 2026-05-31** (uncommitted). A block declares a wall-clock `targetSec`; `fillBlockToDuration()` tiles whole repetitions (overshoot to the next whole cell — never cut a run mid-phrase), wired into both `buildSessionChart` (multi-block Workout) and `generateExercise` (single Custom block). No-op when absent. Verified: exact-cell=1 rep (epsilon-safe), any overshoot rounds up to a whole cell, notes/beats scale linearly, all built-in sessions unchanged. (Per-block 1-bar lead-in re-announce is a Workout-shell concern, not the fill primitive.)
4. **DRUMS voice** (self-hosted WebAudioFont GM bank-128) + `AUDIO_PROFILES` → ensemble spec — the realism unlock for Jam.
5. **The DAW shell**: `ss-mode-*` four-mode switch, promote Custom, the `M`/`P`/`[` hotkeys + mixer overlay + progress sheet.
6. **`slopscale.progress` ledger** + the Off/Casual/Hardcore toggle.
7. **`buildCompingExercise`** (long-standing generator gap) — comping blocks for Workout + Open-Chord Core nodes.
8. **Future-proofing touches** (note-schema `hand`/`finger`, `playerRole`, pluggable diagram slot) — alongside, cheap.

### ✅ MENU / SHELL — DESIGNED & DECIDED (2026-05-31)
Menu/shell design round run (`slopscale-ux-designer`-led; `gamification-architect` + `market-analyst` in support; main thread synthesized). Build-queue item #5 is now **designed and the forks are picked** — design captured here + in project memory `project_menu_shell_design`. **Still design-only; no code.** Build remains Foundation-first (#1–#3 before #5).

**Christian's LOCKED decisions (picked from the forks):**
- **Layout = Option A — header segmented switcher.** Four-segment `.slopscale-mode-toggle` in the header, built with `role="tablist"` semantics so **Option B (left-rail mode spine)** is an additive migration later (RPG-tree / 5th "Improv" mode era), NOT a rewrite. **Option C (landing hub)** not built; its one-line "what this mode is + Continue" card copy is folded into A's empty states for beginner legibility.
- **First-run = ONE primed Pathways CTA.** Default land = Pathways · Beginner band · first pathway pre-selected · a single lit "▶ START: [exercise] — [skill named]" CTA · static preview, **no auto-play** (hearing-safe). Target ≤90s to first note (Yousician's activation floor). Custom stays full-parity in the rail — **co-equal = equal presence/reachability, NOT equal first-run emphasis.** No survey gate, no coach-marks. Mode sublabels speak the JTBD (Custom = "Drill the exact thing you're stuck on"; Workout = "Build a timed routine — and actually run it").
- **Returning user = resume last mode** (switch one click away); stateful rail shows "Resume: …" / "Run your saved set" (also operationalizes the Custom-repeat-drill + Workout-reuse proof metrics).

**Mode migration (3→4):** Guided→**Pathways** (rename), **Custom** (promote to co-equal), Session→**Workout** (rename + timed-block evolution of the existing `generateSession()`/`BUILT_IN_SESSIONS` engine — **keep internal `data-mode="session"` token stable**, change only the visible label; existing saved sessions become "workouts"), **Jam** (new). One root-class swap `ss-mode-*`; persistent furniture never rebuilds; no new player.

**Hotkeys (each = visible button on the view-switcher bar + `?` cheat-sheet; reduced-motion aware; never touch Esc; no audio):** `M` mixer slide-UP overlay over the stage (no canvas refit; per-bus faders/mute/solo + "Backing dim"); `P` right-edge progress sheet (UX builds frame + `#slopscale-progress-sheet-body` slot, gamification fills content); `[` Inspector collapse via existing `#slopscale-panel-toggle`/`setPanelCollapsed()` (free renderer refit).

**Progress instrumentation (gamification lane, expressed through DAW look):** always-on = **three calm signals** in the re-skinned `#slopscale-progress-strip` — armed-lane (current node) · transport tick-row (streak-with-grace) · →next cue marker. Everything else PULLED via `P`. `P` top→bottom: XP gain-meter + **Off/Casual/Hardcore toggle** → skill rack (bands as arrange-regions, nodes as lanes) → BPM-tier fill-meter (`Slow/Med/Fast/Push`, rising best-BPM = honest XP) → streak tick-row → last-session mirror card (**Jam = descriptive line, NO score/rank**) → next-node pointer ("you can skip"). `--ss-meter` (green) = the ONLY fill/cleared color; `--ss-playhead` (red) = "now" only. **Open dependency:** XP number + the toggle need the **unbuilt `slopscale.progress` store** (xp + per-node `masteredAt`) — until it ships, that block degrades to **time-on-instrument only** (don't fake XP); "mastered" lane state ships dimmed/"coming"; achievements stay OUT (on hold).

**Wiring guardrails:** edit the inline `<style>` in `screen.html` only (`static/slopscale.css` is dead); preserve wiring-contract IDs (`#slopscale-pathway`, goal-card IDs, `#slopscale-tier-buttons`, `#slopscale-panel-toggle`); don't conflate the **three** segmented-control families — `.slopscale-mode-bar` (→`ss-mode-*`), `.slopscale-view-switcher` (renderer picker), and the stage's `.slopscale-modeview`/`.slopscale-focus-btn` (Setup/Play + Focus). Market-analyst's activation guardrail: there must always be exactly **one lit primary action** on first paint, or we lose the activation race while looking more capable.

### ⏸️ STOPPED HERE — #1 reviewed+fixed, #2/#3 BUILT; NEXT = #4 drums / #5 shell (2026-05-31)
Build-queue **#1 agent-reviewed + fixed, #2 STYLE_PALETTES + #3 targetSec BUILT** — all verified (full smoke green: 4/4 renderers, 4/4 sessions, 64/64 generators, highway-settings; plus targeted Playwright probes, removed after). **All this session's changes are UNCOMMITTED** (Christian to greenlight a commit) on top of `9d02b88`. `CLAUDE.md` screen.js line-count refreshed to ~7,750.

**Christian's decisions this session (LOCKED 2026-05-31):**
- **Variation start = deterministic EVERYWHERE.** Selecting any pathway opens on variation index 0 (the named entry); Next Variation is the explicit "give me another" control. `applyPathwayById` random-on-select replaced with `idx 0` (screen.js ~6523). Both review agents recommended it for a curriculum.
- **Major Scale — CAGED = lead with E-shape.** Reordered `vary[]` to E→A→G→C→D (easiest box first; pedagogy agent's call) + base shape→E + goal-card copy updated. (CAGED-mnemonic C-first order dropped in favor of easiest-first.)
- **Fret count = leave at 24, document it.** SlopScale has no instrument fret-count model (`MAX_FRET=36` is only an input sanity-clamp). Only `full_neck`/Whole-Neck Freedom relies on the hardcoded 0–24 sweep, which overshoots 21/22-fret guitars (most Fender/Gibson) — accepted; documented in a code comment at the `full_neck` branch. Future option if it matters: per-instrument `frets` field in `STRING_SETUPS`, clamp `fretMax` to it.

**Next session (build, Foundation continues):**
- **#4 DRUMS voice** (self-hosted WebAudioFont GM bank-128 percussion) + `AUDIO_PROFILES` → ensemble spec — the realism unlock for Jam. ⚠ `drum-pedagogy-expert` now runtime-spawnable.
- **#5 the DAW shell** (`project_menu_shell_design` spec): `ss-mode-*` four-mode switch, promote Custom, `M`/`P`/`[` hotkeys + mixer overlay + progress sheet.
- **#6 `slopscale.progress` ledger** + Off/Casual/Hardcore toggle.
- **Follow-ups from this session (when relevant):** genre-idiom + harmony review of the 9 STYLE_PALETTES contents before Jam consumes them (+ broaden past the seed set); the `7alt`/`maj7#5` exotic-tonic-quality enhancement. Apply the north-star tweak into `CLAUDE.md`/`AGENTS.md` "Design north star".

**Also (cheap, parallel):** run the now-registered `slopsmith-host-expert` to re-verify the stand-in's findings against a live `window` dump — esp. the viz borrow-contract contradiction (`slopsmithRegisterViz` factory vs `window.slopsmithViz_<id>` global) + Minigames SDK runtime presence; **also re-verify the instrument-inherit path** (`GET /api/settings` → `default_arrangement`) against the bundled 0.2.7 runtime before that gets built. `gamification-architect` + `drum-pedagogy-expert` also spawnable.

---

## Current state — what's actually shipped

### Generators
**Core:**
- ✅ `scale` — scale runs, all positions (CAGED / 3NPS / Open / position / full-neck)
- ✅ `chord_scales` — scales over chord changes (mode-of-moment + chord-tone-emphasis)
- ✅ `diatonic_arpeggios` — all 7 diatonic chord arpeggios in sequence
- ✅ `progression_arpeggios` — arpeggio paths over named progressions
- ✅ `sweep_arpeggios` — CAGED-anchored sweep patterns with HOPO turnaround
- ✅ `chromatic` — warmup patterns (1234, 4321, 1324, spider, advanced)
- ✅ `guide_tones` — 3rds and/or 7ths voice-led through any progression

**Technique / vocabulary (Phase 4 — all shipped):**
- ✅ Bending drill, legato runs, vibrato, scale in thirds, scale in sixths, call & response,
  tremolo picking, tapping, pedal point, string skipping, position shift, rhythmic displacement,
  chromatic enclosures, bebop scale, arpeggio inversions, walking bass, hybrid picking,
  triadic pairs, pentatonic superimposition, shell voicings, octave displacement

### Fretboard systems
- ✅ CAGED (5 shapes: C/A/G/E/D) — unified data model, shape resolution, chord templates
- ✅ 3NPS (7 positions, named by mode)
- ✅ Open position
- ✅ Custom fret range / full-neck fallbacks
- ✅ **Bass uses `position` (movable box), NOT CAGED/3NPS — by design.** CAGED/3NPS
  are guitar artifacts (the G–B major-3rd breaks the all-4ths symmetry; CAGED is
  the workaround). Bass is tuned in straight perfect 4ths, so scale/arpeggio
  fingerings are fully symmetric and a single movable box suffices. On a bass
  setup `syncInstrumentClass` force-switches CAGED/3NPS → position and hides the
  shape controls. This is the correct baseline — do not impose CAGED on bass.

### Scale library
- ✅ Major, natural minor, harmonic minor, melodic minor
- ✅ All 7 modes (dorian, phrygian, lydian, mixolydian, locrian, + phrygian dominant)
- ✅ Bebop major + bebop dominant
- ✅ Pentatonic minor/major, blues
- ✅ Whole tone, diminished
- ✅ Lydian dominant
- ✅ **5 melodic minor modes:** dorian_b2, lydian_augmented, mixolydian_b6, locrian_sharp2, altered

### Harmony / chord engine (jazz harmony engine)
- ✅ `chordDepth` — power (`5`/`5oct`) / triad / seventh / extended (9/11/13, 6, m6, 6/9, sus2, m(maj7))
- ✅ Auto-diatonic chord depth — stacks true diatonic thirds per degree with exact altered tensions; synthetic memoised `CHORD_FORMULAS` entries
- ✅ `chordQualityForDegree` / `chordRootForDegree` — quality + root resolution with progression-context overrides
- ✅ **Tritone substitution** — `tritoneSub` toggle (off / dominant V / all dominants); scale follows to lydian dominant; composes with depth
- ✅ General `{deg|semis,q,rn}` progression token — chromatic roots no scale degree can express (tritone_sub_ii_V_I, backdoor_ii_V, tadd_dameron presets)
- ✅ **Voicing engine** (`classifyChordTones` + `voiceChord`) — turns the full interval stack into a playable voicing (drops avoid notes, keeps guide tones + top colour, register windowing); wired into the backing pad. See `docs/musicality-guardrails.md`

### Pathways (15 curated + 5 metal + 7 guitar Core ★ = 27)
- ✅ Chromatic Warmup
- ✅ Pentatonic Foundation
- ✅ Blues Scale Foundation
- ✅ Blues Shuffle (boogie backing + shuffle feel — `backingStyle:'boogie'` + `swing:'shuffle'`)
- ✅ Major Pentatonic Country
- ✅ Dorian Groove
- ✅ Chord Tone Targeting
- ✅ Modal Awareness
- ✅ Diatonic Triad Drill
- ✅ Seventh Chord Vocabulary
- ✅ ii–V–I Workout
- ✅ Harmonic Minor Exotic
- ✅ Sweep Arpeggio Primer
- ✅ Modal Vamp
- ✅ Bending Drill (hidden on bass)
- ✅ Metal pack (5): Metalcore Pedal Chug, Melodic Metal Gallop, Melodic Death Twin Leads, Djent Polymeter, Death Metal Chromatic
- ✅ **Guitar Core ★ (7, built 2026-05-31, agent review pending):** Pulse & Muting, Power-Chord Comping (Beginner power chords), Major Scale — CAGED, Sixteenth-Note Pocket, Guide Tones, Whole-Neck Freedom, Melodic Minor & Exotic

### Session framework
- ✅ Session data model (`BUILT_IN_SESSIONS`, segment schema)
- ✅ `buildSessionChart()` — concatenates segments with time offsets + section markers
- ✅ `buildBpmLadderChart()` — same exercise at stepping BPMs, beats accurate per step
- ✅ `buildSegmentConfig()` — config merge + shape resolution per segment
- ✅ `generateSession()` — top-level entry point, same output shape as `generateExercise()`
- ✅ 4 built-in session presets: ii–V–I Workshop, Daily 30-min Intermediate, Blues Fundamentals, Bebop Fundamentals
- ✅ Session UI — selector, "Launch Session" button, summary card, per-segment preview list (shipped 2026-05-27)

### Sequence patterns
- ✅ Fours (1-2-3-4), triplets, diatonic thirds, broken triads (1-3-5), Yngwie sixes

### Key cycling
- ✅ Circle of fourths, circle of fifths, chromatic

### Audio
- ✅ Web Audio engine — note synthesis (sine), metronome, harmony backing
- ✅ Harmony tone selector — Synth pad / E-piano / Organ (pure Web Audio)
- ✅ Pitch accuracy tracker via Slopsmith Minigames SDK (unregistered as minigame)

### Display & UX
- ✅ Flat top-level mode bar: **Guided · Custom · Session** (shipped 2026-05-29; replaced the nested toggles)
- ✅ Four preview renderers via `resolveRendererFactory()`: 3D Highway (delegated to host), 2D Highway, Tab, Notation
- ✅ Static fretboard diagram panel (above highway, shows current shape)
- ✅ Escape-return handler (returns to SlopScale from player)
- ⛔ **Launch in Slopsmith's main 3D player** — **ABANDONED BY DECISION, not pending.** Superseded by the contained-playback decision (2026-05-30, commit `e62d02a`; see `CLAUDE.md` → "Contained playback"): "Play" plays back fully inside the plugin and never hands off to the host player. The `POST /temp-sloppak` route + `playSong` path are kept dormant for reference only. Do **not** wire this up without first confirming the contained-playback decision has been reversed (check `CLAUDE.md` and project memory).

### Progress / gamification (Phase 2 — soft, opt-in, no content gating)
- ✅ Session logger — every Play logged to `slopscale.sessions` (mode, pathway, BPM/tier, scale, key, duration, hit/miss); ends on Stop / page unload; sub-2s blips discarded
- ✅ Streak counter + 7-day calendar grid (local calendar dates)
- ✅ Per-pathway BPM tier progress (`slopscale.pathway_tiers`) with passive Custom-session attribution; `cleared` + `tier-glow` states; `slopscale:tier:unlocked` SDK emit
- ✅ Pathway skill tree — SVG node map (14 nodes / 18 edges) replacing the flat dropdown; live tier dots; Custom ↔ Pathways toggle
- ⏸️ Achievements — ON HOLD (2026-05-29) pending Slopsmith practice-tool framework

### Infrastructure
- ✅ Preset CRUD (`GET/POST/DELETE /api/plugins/slopscale/presets`)
- ✅ Custom-tuning CRUD (`GET/POST/DELETE /api/plugins/slopscale/tunings`) + per-string tuning editor UI
- ✅ Temp sloppak builder (`POST /api/plugins/slopscale/temp-sloppak`)
- ✅ Audio stem synthesis (WAV + OGG if ffmpeg available)
- ✅ Multi-instrument string setups: guitar 6/7/8, bass 4/5

### Theory knowledge base
- ✅ Classical guitar method pedagogy (position system, derivative chord sequences, accumulative practice)
- ✅ Fretboard visualization methodology (CAGED-first, pentatonic-before-major approach)
- ✅ Scale & arpeggio methodology across positions
- ✅ Jazz improvisation pedagogy (dominant 7th tree, scale families, chord-scale mapping)
- ✅ Voice leading principles (chord-scale relationships, II-V-I resolution)
- ✅ Bebop scale methodology (chromatic passing-tone targeting, strong-beat chord tones)
- ✅ Advanced jazz theory (melodic minor modes, guide tones, pentatonic superimposition, Rhythm Changes, minor ii-V-i, avoid notes, structured learning sequence)

---

## Mode architecture (UX decision — 2026-05-29)

The practice surface is organised as a **single flat top-level mode bar** rather than a nested toggle. Decided after weighing flat-vs-nested IA for ease-of-use across skill levels.

- ✅ **Flat mode bar: `Guided · Custom · Session`** — replaced the old two-level `Single exercise / Session` + sub-toggle `Guided / Custom`. Three peer user intents ("guide me" / "let me build" / "give me a program"), one click to any, all visible at once. Implemented as a view over two root classes (`session-mode`, `pathway-mode`) via `selectMode()` / `syncModeBar()`.
- ✅ **Presets live in Custom**, not a separate mode — a preset *is* a saved Custom config. Surfaced as a "Load preset" picker at the top of Custom (restores access that the skill tree had orphaned). Keeps the bar to 3 (then 4) segments instead of spending one on presets.
- 🔲 **Custom progression tool → a control inside Custom**, not a mode. Build-your-own chord sequence that feeds the existing progression engine (`chordRootForDegree`/`chordQualityForDegree`/backing). Its output is shared logic the Improv mode and sessions can reuse.
- 🔲 **Solo grading → reserved as the 4th top-level mode ("Improv" / "Jam").** A different *verb* (improvise over changes and be graded on note choice) vs. the play-along modes. Distinct display (changes chart + target-scale highlight + live feedback) and scoring rubric (chord-scale membership over time), built on the shared progression engine + the already-integrated Minigames SDK pitch tracker. The flat bar was designed to extend cleanly to this 4th segment. See Phase 4 (Chord Jam) and Phase 5 (scoring).

---

## Development Pathways initiative (per-instrument Core + Style, decided 2026-05-31)

The single shared pathway list is being restructured into **per-instrument "Development Pathways,"** approached from a learning-&-development lens. "Pathways" → **"Development Pathways"** in the UI. Decided 2026-05-31; building groundwork.

**Selection flow:** instrument → strings → tuning → **Development Pathways** dropdown (a dropdown *for now*; the RPG skill tree is the later evolution — see below).

**Dropdown structure (per instrument):**
- **Core – Beginner / Core – Intermediate / Core – Advanced** — the instrument's rhythm + melodic *fundamentals*; the spine.
- **Style – Blues / Funk-R&B / Rock / Metal / Jazz / Prog / Country / Latin / Pop / Classical / …** — genre fronts branching off Core competencies.

**Principles:**
- **Bespoke per instrument, parallel in scope.** Each instrument's pathways have their own exercises (need NOT match in quantity or content) but traverse the **same overarching arc: easy → medium → hard → mastery**. Cores complement each other instrument's architecture rather than being copies.
- **L&D-chaired design.** `learning-design-architect` defines the competency ladder + difficulty stages; then the agent-workflow runs: **theory-architect + genre agents shape content → instrument-pedagogy agents verify playability → other agents fill gaps.** Core pathways are built first.
- Stays **soft** (suggests next, never content-gates — Phase 2) and serves learning, never becomes the point (Design north star).

**Build approach (the 4 parts, 2026-05-31):**
1. ✅ **Guitar agent parity** — `fretboard-pedagogy-expert` → `guitar-pedagogy-expert`; two-way parity pass across guitar/bass/piano MDs.
2. 🔲 **UI/UX** — rename to "Development Pathways"; restructure the dropdown into Core/Style per instrument. (L&D agent created ✅.)
3. ✅ **Genre agents + group design** — roster filled; **group-design session run 2026-05-31** (L&D chair + theory + 10 genre agents + guitar-pedagogy). **Guitar Core designed + decided — spec below.** Bass/piano Core deferred (guitar-first; piano blocked on Phase 6).
4. 🔲 **Build the guitar Core** from the spec below; then bass Core; then piano (Phase 6).

### Guitar Core — design spec (group-designed + decided 2026-05-31)

**The unanimous finding:** a generic foundation teaches **rhythm/feel + articulation too late.** All 10 genre agents independently asked to pull these into **Beginner** (guitar-pedagogy ratified as playable): pulse/backbeat, muting (`mt`/`pm`), **power chords *before* triads**, swing-vs-straight as a felt choice, call-and-response *with space*. (The 16th funk pocket, hybrid picking, and gallop get a gentler early-Intermediate on-ramp.)

**Content spine (harmony-theory-architect): "the backing IS the curriculum."** Backing gates competency: **static vamp (Beg) → diatonic progression (Int) → ii–V–I → full changes (Adv).** T3 scales: min-pent box1 → blues (just after, +♭5) → major (Int headline) → modes as one-note alterations → melodic-minor/exotic+12-key (Adv; Locrian→Adv). T4: triad outlines (Beg) → diatonic 7th arps + chord-tone targeting (Int) → **guide tones BEFORE voice-leading** (Adv). T5: power/open (Beg) → diatonic triads/7ths (Int) → shells/extensions (Adv). **Gate before any Style pathway:** min-pent box1 fluent over a vamp + triad outlines + power chords + steady pulse landing on tonic + ear hears tonic/maj-vs-min.

**The skill tree (★ = new pathway/rung):**
- **Beginner:** Chromatic Warmup → ★Pulse & Muting (`pedal_riff`/`chromatic` foregrounding `pm`/`mt` + backbeat) → Pentatonic Foundation → ★Power-Chord Comping (`pedal_riff` + `chordOverride:'5'` over a *musical* diatonic prog, pulled before triads) → Blues Scale Foundation → Bending Drill.
- **Intermediate:** ★Major Scale CAGED (`scale`+caged+5-shape `vary`) → Dorian Groove / Modal Awareness → Chord-Tone Targeting → Diatonic Triad Drill → ★Open-Chord Comping (needs the new generator) → ★Open→Barre Bridge.
- **Advanced:** Seventh-Chord Vocabulary → Guide Tones → ii–V–I Workout (guide-tones before voice-leading) → Sweep Arpeggio Primer → Modal Vamp → ★Master Mode / Improv-over-changes (unbuilt engine — the mastery rung).

**Locked decisions (2026-05-31):**
- Beginner opens on a **static one-chord vamp** (cleanest melody isolation); the **12-bar blues is the Beginner→Intermediate bridge**.
- Guitar Core is **pick-first for now**; the classical **p-i-m-a fingerstyle track is deferred** (a parallel branch later, blocked on the RH-finger primitive).
- **Build the one new generator** `buildCompingExercise` (voices CAGED triads/7ths on a strum-rhythm grid) — the only generator gap; unlocks T5 comping.
- **Surface swing/feel** (straight · swing · shuffle) as a **visible Beginner-tier Feel control** (already implemented as a hidden field).

**Build queue (prioritized):**
1. *Cheap* — new pathways over existing generators: **Major Scale CAGED, Power-Chord Comping, Pulse & Muting**; reorder power chords into Beginner; surface the Feel control.
2. *One generator* — **`buildCompingExercise`** (open/barre block-chord strum) → unlocks Open-Chord Comping + the Open→Barre Bridge.
3. *Guitar fundamentals the skeleton was missing* (guitar-pedagogy): explicit **hand-sync**, **muting (both hands)**, the **open→barre bridge**, **pick-hand mechanics** rung.
4. *The mastery rung* — **Master/memory mode + Improv/Jam mode** (new playback engine; north-star destination; Cores are excellent through "hard" without it).
5. *Style-pathway primitives (NOT Core-blocking; for the Style packs)* — visible-swing (done in #1), **p-i-m-a RH-finger field** (classical), **dynamics/section model** (rock/classical), **quarter-tone bend + vibrato-on-bend** (blues), **oblique double-stop bend builder** (country/blues), **banjo-roll/let-ring** (country), **hybrid-pick attack flag** (country), **four-on-the-floor backingStyle** (pop), **decoupled phrase clock** (prog/math-rock), **true compositional unison** (prog), **comping-rhythm cell generator** (jazz), **call-and-response/phrase builder that scores** (blues/jazz — overlaps Improv mode).

### ⏸️ STOPPED HERE — next-session pickup (2026-05-31)

**Where we stopped:** the **guitar Core + Development Pathways design is ~complete**; build is **held** at Christian's request until the gamification layer is designed. Nothing is committed as code yet — design only.

**Done this session + saved to agent memories** (`.claude/agent-memory/<agent>/`, local/gitignored — the agents will recall them):
- **Full guitar Core web** (~24 nodes, 3 tiers, edges, gate, Style attach points) → `learning-design-architect/project_guitar_core_web.md`
- **Content ladder** (the "backing IS the curriculum" spine) → `harmony-theory-architect/project_guitar_core_content_ladder.md`
- **Playability verify + generator realizations** → `guitar-pedagogy-expert/project_core_pathway_verify_2026-05-31.md`
- **Each genre's Core prerequisites** ("pull rhythm/feel into Beginner") → each `<genre>-idiom-architect/` memory
- **Development Pathways IA** (rename, two-level picker, Feel control, two-renderers contract) → `slopscale-ux-designer/project_development_pathways_ia.md`
- The decided spec is in "Guitar Core — design spec" above.

**The one missing design piece — the gamification/progression layer.** The `gamification-architect` agent is **created** (`.claude/agents/gamification-architect.md`) but **could not be spawned this session** (agent runtime registers agents at session start only). **It will be live next session.**

**NEXT SESSION, in order:**
1. **Run `gamification-architect`** on the soft progression layer — feed it the L&D web; ask for node states (cleared/mastered), mastery-given-A8(master-mode)-is-unbuilt, XP justify-or-reject, badges, reward loops — all SOFT (describes, never gates).
2. **Reconcile** the three layers (L&D web + UX IA + gamification) + confirm forks (**B5 Open-Chords → Beginner**; accept the UX agent's micro-defaults: band-list picker, keep the "Guided" mode button, shelve the old SVG tree behind the new list).
3. **Build** — start with the **gamification-independent** parts (large + ready): the 7 ★ Core pathways over *existing* generators (★Pulse&Muting, ★Power-Chord Comping, ★Major Scale CAGED, ★Sixteenth-Note Pocket, ★Guide Tones, ★Whole-Neck Freedom, ★Mel-Minor&Exotic) + reorder power chords into Beginner + **`buildCompingExercise`** (unlocks ★Open-Position/Open-Chord/Open→Barre) + surface the **Feel control** + the **"Development Pathways" rename**. Then the gamification overlay + the two-level-picker presentation. **A8 Master/Improv mode** is the separate big engine (the only true-mastery rung).

### ✅ Resolved + now building (2026-05-31, later same day)

**Core-granularity question — RESOLVED.** Christian questioned the 3-tier Core granularity; L&D + gamification + UX were all consulted and unanimously: **keep 3 tiers**, but the **node is the unit the player selects/progresses through** (band = a shelf/chapter, never a task or gate — keeps soft-gamification soft). The ~96 small wins live one level down (24 nodes × 4 BPM tiers). Add one **on-ramp node** ("First Pulse" — land a note on the click) between Chromatic Warmup and Pulse & Muting — NOT a 4th band. `gamification-architect` ran (its first spawn) and specced the soft node-state machine.

**GUI overhaul — DESIGNED, building (staged).** Design-language direction (Christian): **DAW-like, Apple/Logic Pro**, with **gamification CO-EQUAL** (see project memory `design-language-daw`). The resolution both UX + gamification reached: **engagement = instrumentation, not decoration — "a reward is a readout, not a trophy."** The drag-loop timeline (`drawRulerFrame`) is already the most DAW-grade surface → it's the **design constitution**; propagate its language to the Inspector (rail), Browser (picker), Control Bar (transport), and a thin session lane (progress). Shell modes: Setup / Play / Focus. **Engagement spine to ship:** per-node lane-state on the picker, BPM **fill-meter**, streak as a **timeline tick row**, one calm "next node" pointer — all SOFT, visual-first, reusing `pathway_tiers`/`sessions`; one schema add = per-node `mastered` flag, shipped **dimmed** (A8 master-mode unbuilt). **Rejected:** a separate XP economy.

**THEMEABILITY (framework constraint).** Build the Logic look as a **CSS-custom-property token layer** (default theme = calm pro-dark): 4px spacing scale, hairline separators, panel radius ~10px, monospace numerics, reserved playhead-red. Reason: we'll add more themes AND **SlopSmith may end up owning theming** — tokens must defer to / be overridable by host theming with minimal churn ("we might have to paint over it later"). Reusable framework work.

**Build = STAGED, screenshot each stage** (Christian's choice). **Stage 1** = token system + reskin + finish the timeline to Logic-grade (numeric cycle readout, ruler weight, Shift+arrow loop-edge nudge). **Stage 2** = named Setup/Play modes (Focus prototyped separately — `requestFullscreen` host-scope unknown). **Stage 3** = Inspector/browser reskin + engagement spine + two-level picker + the "Development Pathways" rename. **The build hold (pending gamification design) is LIFTED.**

### 🌙 Session end 2026-05-31 — tomorrow's pickup

**SHIPPED + PUSHED today (DAW GUI overhaul):** Stage 1 (themeable `--ss-*` token layer + Logic-grade timeline: monospace cycle readout, weightier ruler, Shift+arrow loop-edge nudge), Stage 2 (`Setup | Play` view modes), **Focus mode** (fullscreen the stage — **verified working in the host page scope**, the one unknown), the **"Development Pathways" rename**, the **Inspector reskin** (one muted Logic section label + hairline separators; softened the loud blue card borders), and the **Feel control** (Straight/Swing/Shuffle in Tempo, writing the existing hidden swing field). All on `main`, pushed; smoke-renderers 4/4.

**TOMORROW — the remaining GUI pieces, built WITH the guitar Core content (they're interdependent):**
1. **Two-level pathway picker** (L1 band pills → L2 ordered node list, per `slopscale-ux-designer/project_development_pathways_ia.md`). Blocked-on / paired-with: each pathway needs a Core/Style **band** assignment — an **L&D-owned** decision against the guitar Core spec — so build it alongside the **Core content**: the ★ pathways over existing generators + **`buildCompingExercise`** (CAGED triads/7ths on a strum grid). Preserve the wiring-contract IDs.
2. **Engagement spine** (gamification, SOFT / visual-first): per-node lane-state on the picker list, BPM tempo-tier as a **fill meter**, streak as a **timeline tick row**, one calm "next node" pointer. One schema add: per-node `mastered` flag, shipped **dimmed** (A8 master-mode unbuilt). **Reject** a separate XP economy (BPM number = honest XP).
3. **Smaller polish:** the **icon-spine** refinement of Play mode (a thin control strip instead of full-hide — needs a small popover system); **canvas-theming** — have the ruler/highway read `--ss-*` via `getComputedStyle` so themes / host paint-over reach the canvas too.

The token framework + contained-playback model are in place; the picker is the gateway into the Core curriculum build.

### 🌙 Session end 2026-05-31 (audio / backing-realism thread) — pickup

Separate thread from the GUI/Core pickup above. Backing-realism work (see project memory `backing-realism-plan` for the full detail + the audio-engine-architect agent memory).

**SHIPPED + COMMITTED today:**
- **Tier-1 GM fonts + sampled bass + practice voice** (`ad638e7`). Bundled 8 more JCLive presets (14 total, static/wafonts/, 3.7MB). The audio profile now has **three** sampled voices: `harmony` (comp), `notes` (the practice voice — clean-elec / steel for acoustic family / bass program when instrument=bass; bent notes stay on oscillator), `bass` (boogie walking-bass events tagged `role:'bass'` → real bass on a 'bass' bus). Oscillator fallback until presets load (no regression). Hardened the highway_3d AudioContext-sharing stub (Proxy no-ops any `create*`) — the practice-voice preload now creates `audioCtx` on pathway-select, which had tripped a latent `createGain` crash. Alternates (FluidR3/GeneralUserGS) pulled to `static/wafonts/alt/` (gitignored) for A/B.
- **Distorted-track asset routes + NAM borrow PROVEN** (`815963f`). routes.py serves `/ir/{name}.wav` + `/nam/{name}.nam` from gitignored static/irs/ + static/nam/. **The host nam_tone engine is borrowable cross-plugin** (worklet + 532KB WASM + glue from `/api/plugins/nam_tone/worklet/...`) — **zero added repo weight**; proven live that it instantiates in our AudioContext (bypass the sharing stub via `window.AudioContext.prototype.constructor`), loads WASM (wasm-ready), and **loads a pulled model** (model-loaded success). Worklet protocol documented in memory.
- **Auto-pulled a djent model + built a reusable fetcher** (gitignored, local). `static/nam/fetch.mjs` + `manifest.json` (symbolic-id→URL) downloads + validates NAM JSON; pulled a boosted-5150 capture → `djent_highgain.nam`. Source: `pelennor2170/NAM_models`, **GPL-3.0 → local use only, licensing gate before any public ship.**
- **A/B demo rendered + sent to Christian** for ear-verdict: same palm-muted DI riff → (1) dry DI, (2) in-house WaveShaper→Djenty-IR, (3) NAM amp→Djenty-IR, peak-matched. (Rendered via real-time ScriptProcessor capture — OfflineAudioContext races the worklet's async init.)

**NEXT SESSION, gated on Christian's ear-verdict (NAM vs in-house WaveShaper):**
1. **Build the distorted-chain insert in screen.js** — a `borrowNamEngine()` helper (fetch+addModule+load-wasm, cache) + the chain (DI → [NAM if model present, else WaveShaper(tanh)+HPF] → cab-IR Convolver → post-EQ: HPF85/scoop500/presence3.2k/LPF9.5k → limiter) on a new **'distorted' bus**. Single NAM instance; fake double-track with delay+detune (don't stack NAM). Wire to the **metal/djent BACKING-rhythm voice** (decision: amp drives backing rhythm only — practice notes stay clean/sampled).
2. **Source-content caveat:** the metal/djent backing is currently a pad/shell. For it to *sound* like djent the backing must become a palm-muted riff — **metal-idiom-architect's job** (a content step that pairs with the chain). That's why the isolated DI-riff demo is the right tone check for now.
3. **If NAM wins:** extend `manifest.json` per distorted genre (the "presets for each genre" plan — feather/nano tier for CPU), tag genre profiles with a symbolic `amp` id; resolver maps id→model+IR. **If WaveShaper is "good enough":** ship it as the in-house distorted tone, keep NAM as the documented dormant upgrade.

### Drums — instrument + pathways (LATER — last-priority dev, 2026-05-31)

Christian's directive: add **drums as a supported instrument + at least one drum pathway**, to reach **parity with the Slopsmith host** (which supports drums) — "might as well be in parity with Slopsmith and support all the same pathways." Explicitly **last priority**; recorded here so it isn't lost, NOT scheduled ahead of the four pillars.

- **Drums is a different beast — PITCH-LESS.** A drum pathway is NOT scales/arpeggios. The transferable competencies are **time/pulse, limb independence (4-limb coordination), the rudiments (PAS-40), sticking, groove vocabulary per genre, fills, dynamics/ghost notes, and foot technique.** The note model maps to **kit pieces / GM percussion** (kick 35/36, snare 38/40, hats 42/44/46, toms 41/43/45/47/48/50, crash 49/57, ride 51/59 — per the host-expert's GM map), NOT string/fret or note+octave. Needs a **pitch-less note-schema branch** (analogous to the planned piano pitch-primary branch) + a **kit-lane renderer** (learn from / possibly borrow the host `drums` viz) + rudiment/groove/independence generators.
- **Owner:** new **`drum-pedagogy-expert`** agent (created 2026-05-31; the percussion sibling of guitar/bass/piano-pedagogy) owns drum playability/pedagogy/kit realization. Clean lane carve, designed to run **in parallel with `rhythm-meter-architect`**: rhythm-meter = the time/meter ENGINE (subdivision/swing/meter/the beats[] grid); the **genre-idiom agents** = which groove a style uses; **drum-pedagogy** = how it's voiced & PLAYED on a kit + drummer pedagogy + playability. (Per the agent-workflow rule, creating the pedagogy agent first satisfies the new-instrument requirement.) ⚠ Like other mid-session-created agents, it's first runtime-spawnable NEXT session.
- **Synergy with the Jam backing band:** the four-pillar charette already plans a self-hosted **WebAudioFont GM bank-128 percussion** voice for Jam backing — that same drum sound source is what a drum pathway would *play*. Build it once for Jam, reuse for drums (the audio groundwork is shared).
- **Scope when picked up:** drums in the instrument selector; the pitch-less note/render path; rudiment/independence/groove generators; a **drum Core** chaired by L&D (ladder: pulse → backbeat → basic independence → rudiments → genre grooves → fills → advanced independence/odd-meter), with drum-pedagogy verifying playability and rhythm-meter supplying the time model. Longer-term parity goal: support the same instruments/pathways the host does.

### RPG skill-tree evolution (later)
As guitar-specific content grows (the metal pack), the single shared pathway list/tree is straining. Direction (the dropdown ships first; the tree is the evolution):

- **Decouple pathways per instrument family.** Pathways gain an instrument scope (guitar / bass / piano); the skill tree filters to the active family. This also resolves **tuning**: today a pathway sets one `stringSetup` and the full metal drop set (Drop C/B/A/G) isn't cleanly reachable from a pathway base (Drop C/B live in `TUNING_PRESETS`/`customOpenMidis`, not `STRING_SETUPS`); instrument-scoped pathways would carry instrument-appropriate tunings directly. Generators are already key-relative, so content transposes — the pedal-riff just frets the tonic on the low string, so the open-string-pedal feel only emerges when the key matches the tuning's low string. Per-instrument scoping makes that intentional rather than incidental.
- **Lean the skill tree into an RPG progression map.** The node/edge graph (`SKILL_TREE_NODES`/`EDGES`) + per-pathway BPM tiers already exist; evolve toward per-instrument trees with prerequisite/branching flow and mastery/XP per node — serving the Phase 2 gamification goal.
- **Constraints:** stays *soft* (suggests next, never content-gates — Phase 2 principle) and must serve the learning progression, never become the point (Design north star in `CLAUDE.md`). Loop in slopscale-ux-designer for the tree UX + a planning pass; this is an architecture + UX change, not a quick edit.

---

## Agent roster (review & design specialists, expanded 2026-05-31)

Specialist sub-agents live in `.claude/agents/` (local/gitignored — they may name artists/bands in conversation, but anything they author into tracked files stays proper-noun-clean per the attribution-cleanup rule). They are reviewers/designers, not builders; each clears a **distinct, non-overlapping lane** so they don't step on each other. All genre agents mirror `metal-idiom-architect` for structure/form, and all carry a **piano framework** (own the genre on keys; defer keyboard playability to `piano-pedagogy-expert`):

- **harmony-theory-architect** — harmony/note-choice/voicing theory + progressions, all instruments & genres (the **pitch**-domain content architect).
- **rhythm-meter-architect** (NEW 2026-05-31) — the **time**-domain mirror of harmony-theory: the meter/subdivision engine + data model (time signatures & changing/odd meter and grouping, swing/shuffle quantization `applySwingToBundle`, count-in `applyCountIn` + loop tiling, polymeter/metric-modulation, the multi-bar **long-cycle/herta** model, `beats[]`/anchors/tempo-tier structure). Owns *how rhythm is represented & generated*; genre agents own *which feel a style uses*. Pairs with harmony as the two halves of the content engine.
- **sound-design-architect** (NEW 2026-05-31) — playback **audio quality**: note synthesis (timbre/envelope/voices), metronome + count-in click design, harmony-backing **mix** (levels/register/density/balance), artifact hygiene (attack clicks, mud, harshness, clipping), gain staging. **Owns the hearing-sensitivity constraint** (no sudden loud/jarring sounds — Christian; shared with gamification for reward cues). Shapes how the existing Web Audio engine *sounds*; never the notes (harmony) or the transport.
- **audio-engine-architect** (NEW 2026-05-31) — the rendering & instrument-sourcing **method/architecture**: synthesis vs **amp/cab modeling** (WaveShaper + cab IRs) vs **sampling** (multisamples/SF2/SFZ/soundfont) vs pre-rendered stems vs **borrowing the host engine**; asset/loading/licensing + dependency + CPU/latency tradeoffs. Reasons from *what production-grade realism requires*, treating thin-deps as a tradeoff, not a first principle. Distinct from sound-design (it builds the engine + raw voices; sound-design mixes/shapes them). Created after the oscillator backing demos came back **sub-GM** — first task: analyze the host's sound-creation capabilities + propose a more-real backing solution.
- **learning-design-architect** (NEW 2026-05-31) — the L&D/curriculum lane: difficulty scaffolding, competency frameworks, the easy→medium→hard→mastery arc, cross-instrument curriculum parity, sequencing. **Chairs the Core (Development) pathway skill-tree design.** Owns *when/what-order/why*, not note-choice (harmony), playability (instrument), or feel (genre).
- **Instrument playability/pedagogy (verify techniques, fingering, scale/arpeggio patterns):** `guitar-pedagogy-expert` (guitar — renamed from `fretboard-pedagogy-expert` 2026-05-31), `bass-pedagogy-expert` (bass — movable position box, NOT CAGED), `piano-pedagogy-expert` (piano — pitch-primary, supports Phase 6 groundwork), plus **`drum-pedagogy-expert`** (NEW 2026-05-31 — drums/percussion; **pitch-less**, kit-based; rudiments/limb-independence/groove-vocabulary/sticking/fills; defers the time/meter ENGINE → rhythm-meter-architect and which-feel-a-style-uses → genre agents; **LAST-priority instrument**, see "Drums" section). Two-way parity pass applied 2026-05-31 so the original three share structure + the lane-boundary and memory-trust guidance.
- **Genre-idiom (own rhythm/feel/technique/phrasing; defer harmony→harmony-architect, fingering→the instrument expert):** `metal-idiom-architect`, `blues-idiom-architect`, `funk-idiom-architect` (**funk/R&B** — neo-soul/gospel R&B in scope), `country-idiom-architect`, `jazz-idiom-architect` (feel/comping/phrasing only — NOT note-choice), `latin-idiom-architect`, plus NEW 2026-05-31: `rock-idiom-architect`, `prog-idiom-architect`, `pop-idiom-architect`, `classical-idiom-architect` (classical music / classical guitar, bass & piano — its étude/scaffolding instinct feeds the Cores).
- **gamification-architect** (NEW 2026-05-31) — the soft-gamification/progression/engagement lane: the RPG skill-tree progression map (node states, mastery, prerequisite-as-*suggestion*, branching), XP/tier mechanics, streaks/journey, badges/achievements, reward loops. Owns the *mechanic + reward loop*; defers curriculum order→L&D, visuals→UX. **Soft only — describes, never content-gates** (Phase 2 law). ⚠ Created this session but **not yet runtime-registered** (the agent runtime registers agents at session start only) — first usable next session.
- **slopscale-ux-designer** — UI/UX.
- **market-analyst** (NEW 2026-05-31) — outside-in product strategy: competitive comps, user pain-points/JTBD, positioning (table-stakes vs differentiator vs trap), scope/prioritization, and the metrics that prove a feature worked. **The only agent allowed to name real competitors** — works exclusively in local/gitignored files, never tracked repo files.
- **slopsmith-host-expert** (NEW 2026-05-31) — keeps current on the HOST (Slopsmith): features/roadmap, plugin APIs, the Minigames SDK + scoring model, borrowable viz/tone plugins (highway_3d/jumpingtab/piano/fretboard/nam_tone/drums), the sloppak/DB model, host settings. Owns **build-vs-borrow** (the NAM-engine borrow is its archetype) + integration risk. ⚠ Created 2026-05-31 but **not yet runtime-registered** (agents register at session start) — first usable next session.

The matrix: **content engine [harmony/pitch (1) + rhythm-meter/time (1)] + sound-design (1) + L&D (1) + gamification (1) × instrument-playability (3) × genre-idiom (10) + UX (1)** = **~19**. The agent is cheap; the **framework build behind each agent** (primitives + pathways, like the whole metal effort) is the real work — **sequence those builds one at a time**, agent-reviewed.

**Roster decisions (2026-05-31).** (1) **Audio + rhythm-meter added** (above) — the two genuinely-missing lanes: no agent owned playback *sound quality* or the *time/meter engine* (the latter blocked the herta/long-cycle idea). (2) **No "psychology"/engagement agent** — the practice-psychology Christian asked about (SDT, flow, habit formation, reward loops, dark-pattern ethics) is already `gamification-architect`'s charter; a separate one would violate the non-overlapping-lane rule. The framing is **intrinsic/ethical** ("the prize is the player getting good"), never addiction-engineering — that *is* the north star. (3) **No standing "project-manager" agent** — the PM need (group-session synthesis, ROADMAP/doc/memory sync, layer reconciliation) is handled by the **main thread** via the group-design protocol now codified in `CLAUDE.md`/`AGENTS.md`; a cold-spawned PM agent has the worst context economics. The genre roster now spans the planned **Style** pathways (Blues/Funk-R&B/Rock/Metal/Jazz/Prog/Country/Latin/Pop/Classical); next major build is the per-instrument **Core (Development) pathways**, with `learning-design-architect` chairing a group design (theory + genre agents shape content → instrument agents verify → fill gaps). See "Development Pathways" initiative below.

### Granular genre expansion — 20 new genre agents (2026-05-31, SPECULATIVE — pending Christian's review/prune)

At Christian's overnight directive ("build another 20 genre agents — get granular"), the genre roster grew by **20**, then trimmed to **19 kept** (**kpop cut 2026-05-31** after Christian reviewed the audio demos — production-led, the weakest as a pure instrument idiom). These were built **speculatively** (ahead of any pathway — an inversion of the usual just-in-time "create the agent when a pathway needs it" rule), and several deliberately **overlap** existing broad agents. Resolution: the new agents are **sub-genre authorities**; the broad agent **cedes** its sub-genre to the specialist (a broad→granular hierarchy, a departure from the flat non-overlapping matrix — **reviewed & blessed by Christian 2026-05-31**). Agents are local/gitignored, so pruning is just file deletion.

New (with the explicit owner they specialize under / cede from):
- **gypsy-jazz** (← jazz cedes manouche), **punk** (← rock cedes punk family), **emo** (midwest-emo-centered; ← rock cedes emo, prog cedes twinkly-math-in-emo-context), **city-pop** (← pop cedes; shares funk's 16th, jazz harmony), **folk** (← country keeps Nashville-fingerpicking, classical keeps legit), **hiphop-fusion** (the trap/R&B-instrumental "Polyphia/Berried-Alive" lane; ← metal keeps djent, prog keeps fusion, funk keeps pocket).
- **reggae** (ska/dub/dancehall), **gospel** (PIANO-centric; ← funk keeps funk/neo-soul), **ragtime-stride** (PIANO; ragtime/stride/boogie; ← jazz keeps swing/bebop), **flamenco** (← classical keeps legit), **bluegrass** (flatpick/crosspick; ← country keeps Nashville), **afrobeat** (highlife interlock), **disco** (four-on-floor; ← funk keeps pocket), **soul-motown** (BASS-centric melodic-bass soul; ← funk/gospel carve), **surf** (← rock cedes; tone-critical), **shoegaze** (dream-pop texture; ← rock cedes), **tango** (PIANO+BASS Argentine; ← latin keeps Afro-Cuban/Brazilian), **new-orleans** (PIANO+BASS second-line/R&B), **norteno** (Mexican regional norteño/banda/mariachi; ← latin carve).
- Piano-leaning per his ask: gospel, ragtime-stride, tango, new-orleans (+ city-pop keys). Bass-leaning: reggae, afrobeat, disco, soul-motown, norteno.
- All carry the **piano framework** + defer to the cross-cutting architects (harmony / rhythm-meter / sound-design / instrument-pedagogy / L&D). No plugin code touched.

---

## Open threads (next-session pickup — 2026-05-30)

Diagnosed this session, decisions/fixes pending:

- ✅ **Blues IV dissonance — RESOLVED (2026-05-31), plus a deeper root bug + a new pathway.** Two bugs, both fixed (harmony-theory-architect + blues-idiom-architect reviewed): (1) `blues_foundation` forced `chordOverride:'min7'` (a minor blues) → changed to **`dom7`** (standard dominant I7–IV7–V7). (2) **Root-resolution bug:** `chordRootForDegree` indexed the progression degree into the *lead* scale, so over a non-heptatonic scale the IV rooted on the wrong pitch (blues `[0,3,5,6,7,10]` deg 4 = ♭5 → A#7 in E; minor-pent deg 4 = 5th). Fix: when the root-scale isn't 7-note, map functional roots through **major** (or **natural minor** if minor-spelled); lead notes still use `cfg.scale`. This also corrected `pent_foundation` and `major_pent_country`. Verified: key A → A7/D7/E7. **Backing movement:** added a `backingStyle:'boogie'` comp (walking R-5-6-♭7 bass + off-beat rootless-dom9 shell stabs, re-articulated not coalesced) and a global `swing` post-process (`applySwingToBundle`; straight/swing/shuffle) — both pathway-driven via hidden fields. New **`blues_shuffle`** pathway ("Blues Shuffle") carries boogie+shuffle; `blues_foundation` stays the scale-learning exercise (static pad, no swing). 15 pathways now. Per the agent-workflow rule the root fix got a harmony sign-off.
- ✅ **3D Highway "fret counter at top / missing nut+string-names" — RESOLVED: it's host viz settings SlopScale inherits, not a SlopScale change (2026-05-30).** The 3D Highway is the **borrowed host `highway_3d`** plugin. Its look is driven by `h3d_bg_*` localStorage keys owned by the **highway_3d plugin's own settings panel**; `_bgPanelKey()` is `'main'` for any canvas and the settings UI writes the **global** slot, so SlopScale and the main game share one settings store — SlopScale inherits whatever's set there. The "non-standard fret counter" = `fretColumnMarkerCadence` (host default `1` = refresh every measure); the missing nut/headstock/open-string-names is just the lookahead camera framing fret 0 off-screen while drilling up-neck (they reappear at low frets). **SlopScale reads/writes NONE of these keys** (grep clean; only sets `inverted`/`lefty`/`renderScale` on the bundle). Empirically verified: `h3d_bg_fretColumnMarkerCadence=0` removes the markers in SlopScale too, and a full highway lifecycle trips **zero** `h3d_bg_*` keys. Christian's "I see it now where I didn't before" → a setting was tripped in his local highway_3d plugin settings; fixing it there flows to SlopScale. Per directive: **follow Slopsmith's settings, never a custom override.** New regression guard: `npm run smoke:hwy-settings` (in `npm test`). The earlier "string-name gutter / built-in 2D Highway restore" thread was a hallucination — **not wanted, do not resurface.**

## Phase 1 — Foundation Completion
*Immediate next work. Data model and generators exist; UI hookup and a few data-only items remain.*

### Session UI
- ✅ Session selector dropdown in `screen.html` (built-ins + custom)
- ✅ "Launch Session" primary button
- ✅ Session summary display (total duration, segment count, BPM range)
- ✅ Per-segment preview list

### Guide tones UI
- ✅ `voices` selector in `screen.html` (`thirds_only` / `sevenths_only` / `both_alternating`)
- ✅ `guide_tones` option in the practice type selector
- ✅ `guideToneProgression` selector (jazz-focused subset: ii–V–I, minor ii–V–i, turnarounds, diatonic)

### Jazz chord-scale defaults
- ✅ `MODE_FOR_QUALITY`: maj7 → Lydian, dom7 → Lydian dominant, min7b5 → Locrian ♮2
- ✅ Minor ii-V-i: `PROGRESSION_QUALITY_OVERRIDES` forces m7b5 on ii, dom7 on V, min7 on i regardless of parent scale
- ✅ `DIATONIC_QUALITIES` expanded to all 7 major modes (dorian/phrygian/lydian/mixolydian/locrian) + melodic minor — each mode gets its own correct diatonic chord qualities
- ✅ Melodic minor modes added to scale dropdown (Dorian ♭2, Lydian augmented, Mixolydian ♭6, Locrian ♮2, Altered)

### String setup
- ✅ **Per-string tuning editor** — `TUNING_PRESETS`, `customOpenMidis` hidden input, tuning block UI in `screen.html`, `openMidisForConfig` override logic all implemented.

### Data gaps
- ✅ Rhythm Changes A section — `[1,6,2,5,1,6,2,5]` with VI forced to dom7 via `PROGRESSION_QUALITY_OVERRIDES`
- ✅ Rhythm Changes bridge — `[3,6,2,5]` with all four degrees forced to dom7
- ✅ `modal_vamp` pathway — 7 modal scales, 16-bar vamp, 5 Next Variation keys/modes

---

## Phase 2 — Gamification Layer

### Design principles (locked)
- **Soft gamification** — progression describes what you've done, never restricts what you can do. No content gating, ever.
- **Pathway mode = opt-in gamification.** Tier bars, XP, and goal cards live inside the pathway experience. Custom mode has none of this by default.
- **Universal session logging** — every session is logged regardless of mode (pathway or custom). Streak + total practice time work for pure Custom users too.
- **Passive attribution** — Custom sessions that match a pathway's parameters (key, scale, BPM range) quietly count toward that pathway's tier progress. No interruptions.
- **Descriptive not prescriptive** — "You've reached 90 BPM" not "Unlock tier 3." Tier system suggests what to try next, never blocks.
- **SDK deferred** — built in localStorage with a clean schema. When Slopsmith refines a practice-tool SDK track (separate from the minigame run/score model), migration is a storage swap, not a redesign. SlopScale stays unregistered as a minigame.

### Session logger
- ✅ Log each session on Play: `{ id, date, ts, mode, pathway_id, bpm, bpm_tier, scale, key, practice_type, duration_ms, hit_count, miss_count }`
- ✅ Session ends on Stop or page unload (`beforeunload` + `pagehide`) — duration written at that point
- ✅ Sub-2s blips discarded (accidental clicks, regenerate-while-playing)
- ✅ Storage key: `slopscale.sessions` — append-only JSON array, capped at 500 entries
- ✅ Passive mode detection: pathway/custom/session resolved from DOM state at play time

### Streak + calendar
- ✅ Streak counter — consecutive days ending at yesterday-or-today; grace period until midnight so streak stays alive until you practice today
- ✅ 7-day calendar grid — dot per day (oldest left, today right); today's dot glows when practiced; always visible above the mode toggle in both modes
- ✅ Dates stored as local calendar dates (not UTC) so midnight boundary matches the user's clock

### Pathway tier progress
- ✅ Per-pathway BPM tier state: highest tier reached (`slopscale.pathway_tiers` localStorage)
- ✅ Passive attribution: Custom sessions within ±5 BPM of a pathway's tier threshold count toward it
- ✅ Visual cleared state on tier buttons (green tint + ✓ mark via `cleared` CSS class)
- ✅ Tier cleared glow effect when a new tier is first reached (`tier-glow` CSS animation)
- ✅ SDK: emits `window.slopsmith 'slopscale:tier:unlocked'` on new high; accuracy gated via `slopsmithMinigames` hit/miss data

### Achievements
- ⏸️ **ON HOLD (2026-05-29).** Paused pending more framework from the Slopsmith dev
  before continuing. The badge/unlock model touches how progress is surfaced
  host-side; we want Slopsmith's practice-tool framework direction before
  building the panel so we don't build against a moving target. Resume when that
  framework lands. Until then, do not start the achievement panel.
- 🔲 10–15 named badges: "First Rep" (first session), "Blues Initiator", "Circle Rider", "Sweep Starter", "Jazz Chord Tones", "Week Streak", "Speed Demon" (tier 4 on any pathway), etc.
- 🔲 Unlocked state in localStorage + achievement panel (opt-in, not surfaced in practice flow)

### Pathway skill tree
- ✅ Replace flat dropdown with scrollable SVG skill tree (hidden select keeps all existing event logic)
- ✅ 14 nodes in 6 pedagogical columns with SVG edge lines showing learning flow
- ✅ Each node: abbreviated name + 4 tier dots (green = cleared from `slopscale.pathway_tiers`)
- ✅ Active node highlighted; clicking fires the existing pathway change handler
- ✅ "Custom mode →" / "← Pathways" toggle links; fixed sweep_primer key mismatch
- ✅ Tree rerenders on pathway change and on tier unlock (dots update live)

---

## Phase 3 — Audio Enrichment
*Richer practice audio without turning SlopScale into a backing-track app.*

### Musicality guardrails (spec: `docs/musicality-guardrails.md`)
- ✅ **Layer 2 — chord voicing engine** (`classifyChordTones` + `voiceChord`): keeps guide tones, drops the avoid-note natural-11 on major/dominant chords (kept on minor), keeps the top colour tension, places tensions on top, avoids muddy low clusters. Wired into `voiceBackingChord` (backing pad). Verified against spec examples + smoke.
- ✅ **Backing-quality pass (2026-05-30):** fixed a root-transposition bug (upper voices were voiced as if rooted on C in every key); replaced the `upperLow` floor with a register-anchor + bass→upper min-gap (major/minor now share a register, no octave jump); lightweight pad timbre + filter envelope; consecutive identical chords tied (no per-bar re-attack). See commits `ca8b931`, `b735f02`.
- 🔲 **Voicing musicality follow-ups (from the harmony-theory-architect audit, Findings 4–6):** extended-chord top-cluster guard (≥3 semitone inter-voice gap below ~G4 on 6/6-9/min11/min13); optional drop-2/drop-3 voicing mode for richer jazz pads; place the `5oct` octave as a distinct MIDI in the pad (currently dedups to a plain `5`).
- 🔲 Layer 3 — emphasis/landing-note safety (avoid notes on accents/sustains)
- 🔲 Layer 4 — random-generator guardrails (functional transitions, mandatory cadence, taste filter) — build with Phase C random generator
- ℹ️ Layer 1 (progression coherence) covered by curation today; formalised checklist in the spec for authored/generated progressions

### Harmony tone selector
- ✅ `harmonyTone` select in both Single and Session audio sections: **Synth pad** / **E-piano** (triangle+bell, percussive decay) / **Organ** (7-drawbar additive sines, instant on/off). Pure Web Audio, no deps. Passed through `readConfig`, `onLaunchSession`, and `scheduleHarmonyPad`.

### Groove engine (partially shipped 2026-05-31)
- ✅ **Boogie/shuffle backing comp** (`backingStyle:'boogie'` in `buildBoogieBacking`) — walking R-5-6-♭7 bass + off-beat rootless-dom9 shell stabs, re-articulated per beat (not coalesced). First use: the `blues_shuffle` pathway. Generalizes to any dominant-leaning progression.
- ✅ **Swing/shuffle feel** (`swing` = straight/swing/shuffle; `applySwingToBundle`) — one post-process over the bundle warps each onset's within-beat phase (eighth boundary → triplet pocket); lead + backing swing together, metronome stays on the grid. Pathway-driven via hidden fields; candidate for a visible Custom "Feel/Backing" control (slopscale-ux-designer).
- 🔲 Other grooves (straight-4 comp, bossa, the half-time metalcore breakdown feel) + selectable on other genre pathways.

### Backing track generator (intentional future scope)
- ✅ **WebAudioFont GM sampler** (2026-05-31) — 14 GM presets bundled under `static/wafonts/`, **self-hosted** via routes.py (`/wafont/{name}`, offline-safe, no CDN). Three sampled voices on the profile (`harmony`/`notes`/`bass`) via `queueWaveTable`, oscillator fallback until loaded. Genre→profile automation (`AUDIO_PROFILES`/`resolveAudioProfile` + brightness slider). See `backing-realism-plan` memory.
- 🔄 **Distorted track (amp/cab)** — host NAM engine borrow PROVEN + asset routes shipped (`815963f`); a djent capture auto-pulled + reusable fetcher built (gitignored). **NEXT:** build the screen.js distorted-chain insert (gated on Christian's A/B ear-verdict). See the audio session-end handoff above.
- 🔲 **Groove engine** — optional rhythmic strumming pattern applied to the chord voicings (straight 4, bossa, shuffle 8ths). Pairs with the sampler above.
- 🔲 **Tempo-sync metronome variations** — hi-hat pattern, rimshot, brushes; selectable alongside the current click-track.
- 🔲 Prerequisite: confirm CDN policy is acceptable (or bundle a small soundfont). Keep it opt-in so existing audio path stays default.

---

## Phase 4 — Exercise Library Expansion
*New generators and genre pathway packs.*

### New generators
- ✅ **Bending drill** — `buildBendingExercise`, filters to treble strings (s=0,1,2), pre-bend fret from target pitch; half/whole/mixed targets; `bend_drill` pathway; `Bending` node in skill tree
- ✅ **Legato runs** — HOPO per string: `ho:true` ascending, `po:true` descending, grouped by string
- ✅ **Vibrato** — sustained scale notes at half-note steps, `vb:true`
- ✅ **Scale in thirds** — every-other-note from sorted positions (i, i+2 pairs)
- ✅ **Scale in sixths** — skip-4 pairs (i, i+5) ascending/descending
- ✅ **Call & response** — 2 bars notes, 2 bars silence, cycling
- ✅ **Tremolo picking** — `tr:true` rapid-fire, one note per bar held at subdivision speed
- ✅ **Tapping** — `tp:true` 12 frets above each scale note, alternating fretted/tapped
- ✅ **Pedal point** — lowest note as pedal, all higher notes as melody, interleaved
- ✅ **String skipping** — reorders notes to even/odd string groups forcing cross-string jumps
- ✅ **Position shift** — widens fret range by +7 to cross a shape boundary
- ✅ **Rhythmic displacement** — phrase offset by one quarter note, crosses the barline
- ✅ **Chromatic enclosures** — lower/upper semitone approach + resolution on each chord tone
- ✅ **Bebop scale** — auto-selects `bebop_major` or `bebop_dominant`; chord tones land on downbeats
- ✅ **Arpeggio inversions** — cycles root/1st/2nd/3rd inversions of root chord
- ✅ **Walking bass** — quarter-note walks root→scale tones→next root via `nearestPositionForPc`
- ✅ **Hybrid picking** — interleaves consecutive string pairs (pick low, pluck high)
- ✅ **Triadic pairs** — interleaves I-triad (1-3-5) + III-triad (3-5-7) note sets
- ✅ **Pentatonic superimposition** — minor pentatonic from b3 of root (Dorian superimposition)
- ✅ **Shell voicings** — 1-3-7 arpeggiated through chord changes via `nearestPositionForPc`
- ✅ **Octave displacement** — pairs scale degrees in two octaves, jumps between them
- 🔲 **Chord Jam / Improv Scoring mode** — backing chart + Minigames SDK scoring against chord-scale targets *(Community request)*. **Planned as the 4th top-level mode ("Improv")** — see "Mode architecture". Consumes the custom progression tool's output for its changes.
- 🔲 **Custom progression tool** — build-your-own chord sequence (a Custom control, not a mode); feeds the progression engine and the Improv backing.
- 🔲 **Improv mode** — backing chord chart with empty note slots; user fills them in

### Visual / practice modes
- 🔲 **Master mode** — post-processing pass that removes notes from the final N% of a chart; trains memorization
- 🔲 **Position shift exercises** — scale runs that cross CAGED shape boundaries at a specified connection point

### Metal authenticity follow-ups (logged from the 2026-05-30 metal-idiom-architect pass)
*Primitives the metal pack still wants — flagged by the idiom review; the §2.3–§2.6 build + the A–D authenticity fixes are done.*
- 🔲 **Half-time breakdown feel** — rhythmic low-string displacement at half the pulse (the metalcore breakdown; the pedal-riff can't author it yet).
- 🔲 **Composed harmonized-lead generator** — harmonize a *written melodic line/riff* (twin guitars) rather than walking the scale in dyads. Today's `harmonize` twins a scale run, not a phrase; this is the melodeath flagship.
- 🔲 **True tremolo re-articulation** — rapidly re-pick each note, vs. today's `tremolo` flag that only marks the technique (`tr:true`). Must interact with the subdivision/rhythm engine.
- 🔲 **Long-cycle polymeter + short syncopated burst ("herta") exercise** — the extreme-prog-metal idiom: a long odd-length rhythmic phrase repeating over a steady 4/4 pulse, plus the short syncopated rolling-burst rhythmic cell. **Spec'd 2026-05-30 (metal-idiom-architect); lightweight, no meter rewrite:**
  - **Herta cell** = four even sixteenths, accent on beat 1, inner pair as a hammer/pull trill. Ships as a `subdivision:'herta'` case in `rhythmSteps` + a small parallel `rhythmStepFields` helper carrying the per-note accent/trill flags (`ac`/`ho`/`po`). Zero meter-engine changes. **Smallest shippable first.**
  - **Long-cycle polymeter** = a **decoupled phrase clock**, expressed as an optional `@ N/D:g+g+…` clause on the meter string (e.g. `4/4 @ 23/16:5+5+4+5+4`). The 4/4 click + `buildBeats` stay untouched (steady pulse); only `buildPedalRiffExercise` learns the second clock and drives chord placement off `p % phrase.length`, so the phrase drifts against the grid — which *is* the effect. Multi-bar grouping was explicitly rejected (forcing the phrase to whole bars destroys the drift).
  - Build order: herta `rhythmSteps` → `parseMeter` `@`-clause parsing → pedal-riff phrase-clock branch → optional `accent:'phrase'` highway marker. Playability of the herta trill at speed → guitar-pedagogy-expert (keep trill flags on static-pitch cells only). No harmony-architect involvement.
- 🔲 (handoff) **Melodeath twin-lead voice separation** — harmonized dyads can land two pitches on the *same string* (sounds right, not literally playable, doesn't read as two guitars). Defer to guitar-pedagogy-expert.

### Bass-specific pedagogy
*Bass works on position-mode box patterns today (see Fretboard systems) — that's the correct baseline, so this is "serve bass well," not "fix bass." Reuses the existing position + walking-bass generators.*
- 🔲 **Bass pathway pack** (the curated pathways are all guitar/CAGED-framed). How bass is actually taught:
  - Root–octave foundation (the octave-box + fifth shape — the first navigation a bassist learns)
  - Movable box scales (major/minor/pentatonic/modes as one repeatable pattern)
  - Arpeggio outlining over changes (1-3-5-7 chord tones to spell the harmony — the bassist's core job)
  - Walking bass — promote the existing `walking_bass` generator from a Custom practice-type to a headline bass pathway
  - Modal / pentatonic grooves (riff-and-feel, not scale runs)
- 🔲 **Hide/relabel guitar-only nodes on bass** — `sweep_arpeggio_primer` (sweep *picking* is a guitar technique; bassists play arpeggios fingerstyle) should hide on bass the way bending now does.
- 🔲 **Slap & pop technique** — thumb slap + finger pop; new technique flags + tab rendering (the `docs/sources/canvas.png` legend already includes slap/pop symbols). Marquee bass technique currently unmodelled.
- 🔲 **Right-hand fingering** hints (alternating index/middle, or slap) — matters more on bass than left-hand shape; not modelled for any instrument yet.

### Genre pathway packs
*Cross-genre progression library + random style generator researched in
`docs/theory-progressions.md` (recommended order A→C→B). The guitar-focused
complex genres below (prog/metal/fusion/emo/trap-rock) are spec'd separately in
`docs/genre-framework-guitar.md` — they need new primitives (power-chord quality
`5`/`5oct`, pedal-point riff mode, polymeter/gallop, drop-tuning presets,
harmonized twin lines, exotic scales) before their pathway packs can be authored.
Framework build order is in that doc §4. These supersede the flat list below.*
- ✅ Power-chord quality `5`/`5oct` + extended chords (9/11/13, 6, m6, 6/9, sus2, m(maj7)) — `CHORD_FORMULAS`, `chordOverride` dropdown, template-path guard, `MODE_FOR_QUALITY` (genre-framework §2.1/§2.1a)
- ✅ Auto-diatonic chord depth (9th/11th/13th) — stacks true diatonic thirds per degree, exact altered tensions (iii→m13♭9♭13, IV→maj13♯11), synthetic memoised `CHORD_FORMULAS` entries, borrowed-chord promotion via `QUALITY_EXTEND` (genre-framework §2.1c)
- ✅ **Tritone substitution** — `tritoneSub` toggle (off / dominant V / all dominants); subs dominant chords by +6 semitones in `chordRootForDegree`, scale follows to lydian dominant, composes with depth (G13→D♭13). Verified live (genre-framework §2.1d)
- ✅ General `{deg|semis,q,rn}` progression token (theory-progressions §1 Phase B) — chromatic roots no degree can express; `chordRootForDegree`/`chordQualityForDegree` accept tokens; 3 presets ship (tritone_sub_ii_V_I, backdoor_ii_V, tadd_dameron); composes with depth. Verified live (genre-framework §2.1e)
- 🔲 Drop-tuning presets + gallop/grouping meters (genre-framework §2.5/§2.6)
- 🔲 Pedal-point riff mode + harmonized twin lines (genre-framework §2.3/§2.4)
- 🔲 Metal pack: alternate picking 160+ BPM, harmonic minor exotic, diminished runs
- 🔲 Prog rock / prog metal / fusion / metalcore / melodic-death / djent / emo / trap-rock packs (genre-framework §3)
- 🔲 Jazz pack: guide tones, ii-V-I, Rhythm Changes A+B, bebop connecting tones, altered dominant
- 🔲 Country pack: major pentatonic hybrid, chicken-pickin' muted note patterns
- 🔲 Classical/fingerstyle pack: Segovia-style patterns, counterpoint fragments

---

## Phase 5 — Scoring Integration + Adaptive Practice
*Depends on Slopsmith's scorer API becoming available.*

- 🔲 Wire Slopsmith Constitution II / pitch scorer results into SlopScale progress model
- 🔲 Adaptive BPM: auto-advance tier if accuracy ≥ 85%, suggest dropping if < 60%
- 🔲 Practice journal: week/month views, accuracy by pathway, BPM progression over time
- 🔲 Weakness detection: flag the worst (key, shape, tempo) triple from session history and auto-generate a targeted drill

---

## Phase 6 — Piano / Keyboard Support
*Architecturally significant — coordinate with Slopsmith roadmap.*

- 🔲 Define pitch-primary exercise data model (note name + octave + duration, string/fret derived for guitar)
- 🔲 Piano exercise generators (scales, arpeggios, ii-V-I, Hanon-style)
- 🔲 Falling-notes canvas display (Synthesia style) for piano preview in SlopScale's built-in renderer
- 🔲 Watch Slopsmith roadmap for native piano highway support (Option A) vs. own display (Option B, above)

---

## Phase 7 — Standalone Potential
*Only if SlopScale outgrows what Slopsmith can provide.*

- 🔲 Evaluate whether Slopsmith's ecosystem is the right long-term host
- 🔲 If standalone: wrap a Tone.js / Web Audio playback engine around the existing generator core
- 🔲 Possible Tauri app (shares DNA with Rifflarr)

---

## Session log

| Date | Work done | Key commits |
|------|-----------|-------------|
| 2026-05-31 | **Development Pathways UX/scaffolding design round (held before build).** Created the `gamification-architect` agent (soft-progression lane). Ran a three-way design session: `learning-design-architect` fleshed the **full guitar Core web** (~24 nodes, deep, per Christian's no-cap mandate — edges, gate, Style attach points), `slopscale-ux-designer` designed the **Development Pathways IA** (rename, two-level band-picker that scales to deep tiers, Feel control in the Tempo group, two-renderers-over-one-contract). `gamification-architect` round **deferred** — agent created this session can't be runtime-registered until a session restart. Christian asked to **hold the whole build** until gamification is designed. Checkpoint logged ("⏸️ STOPPED HERE" above); designs saved to agent memories. No code changes. | — |
| 2026-05-31 | **Guitar Core group-design session.** L&D chair (`learning-design-architect`) set the 8-theme × 3-band framework + "arc lives inside each pathway"; harmony-theory-architect gave the content ladder ("the backing IS the curriculum"); **all 10 genre agents** gave their Core prerequisites — **unanimous: pull rhythm/feel + articulation into Beginner**; guitar-pedagogy-expert verified playability + realized rungs to generator configs (only ONE new generator needed: open/barre comping). Designed the guitar Core skill tree (Beg/Int/Adv) + build queue. Christian decided 4 forks: static-vamp-first (12-bar as bridge), pick-first (defer fingerstyle), build the comping generator, surface a visible Feel control. Full spec in "Guitar Core — design spec" above. Bass/piano Core deferred (guitar-first). Next: build. | — |
| 2026-05-31 | **Development Pathways groundwork (agent roster).** Renamed `fretboard-pedagogy-expert` → `guitar-pedagogy-expert` (rescoped to guitar) + two-way parity pass across guitar/bass/piano MDs (lane-boundary + memory-trust guidance). Created `learning-design-architect` (L&D/curriculum lane, chairs Core design). Created 4 genre agents mirroring `metal-idiom-architect` for structure/form: `rock`, `prog`, `pop`, `classical`-idiom-architect. Broadened funk → funk/R&B. **Laid the piano framework into every genre agent** (own the genre on keys; defer keyboard playability to piano-pedagogy-expert). Updated the roster matrix + recorded the Development Pathways initiative (per-instrument Core/Style dropdown, L&D-chaired, easy→mastery arc). Agents are gitignored (local); docs (CLAUDE/AGENTS/ROADMAP) updated + tracked. Next: UI rename + dropdown restructure, then the group-design session for the Core skill trees. | — (agents local) |
| 2026-05-31 | Blues pass (harmony-theory-architect + blues-idiom-architect reviewed). Fixed the blues-IV dissonance: `blues_foundation` `min7`→`dom7`, AND a deeper **root-resolution bug** (`chordRootForDegree` indexed the progression degree into the non-heptatonic *lead* scale → IV rooted on ♭5/5th; now functional roots map through major / natural-minor while lead notes keep `cfg.scale`) — also fixed `pent_foundation` + `major_pent_country`; harmony sign-off obtained. Added a **groove engine**: `backingStyle:'boogie'` (walking R-5-6-♭7 bass + off-beat rootless-dom9 shell stabs, `buildBoogieBacking`) and a global `swing` post-process (`applySwingToBundle`), both pathway-driven via new hidden form fields (default pad/straight — no change to existing pathways). New **`blues_shuffle`** pathway carries boogie+shuffle; `blues_foundation` reverted to the scale-learning version (static pad). Verified live (key A → A7/D7/E7, boogie bass walk, swung lead); `npm test` green (renderers + 64/64 generators + highway-settings). | — |
| 2026-05-30 | Open-thread triage. Corrected the 3D-Highway thread: it's the **borrowed host highway_3d**, whose look (fret-counter, nut/headstock, string-names) is host `h3d_bg_*` viz settings SlopScale **inherits via shared localStorage but never writes** (grep-clean; only sets inverted/lefty/renderScale). Proved by screenshot (`fretColumnMarkerCadence=0` removes the markers in SlopScale) and a new assertive guard — a full highway lifecycle trips **zero** `h3d_bg_*` keys. Added `smoke-highway-settings.mjs` (`npm run smoke:hwy-settings`, wired into `npm test`). Killed the hallucinated "restore built-in 2D Highway string-name gutter" thread (not wanted). `npm test` green (renderers + 64/64 generators + highway-settings). Blues-IV minor-blues fix still open. | — |
| 2026-05-30 | Session checkpoint. Created 5 genre-idiom agents (blues/funk/country/jazz/latin) + bass/piano pedagogy agents; logged the roster + responsibility matrix; codified the required **agent workflow** rule (genre pathway→matching agent, instrument→pedagogy agent, exercise/pathway change→agent review). Demo/diagnosis: identified the blues IV-dissonance (minor-blues `chordOverride`), the dormant built-in 2D Highway (string-name gutter, demoted behind the host Jumping-Tab borrow), and confirmed the 3D-highway fret-number/nut change is host settings/config, not our code. Open threads logged above. | `c1b0792`, `d6b6e8a` |
| 2026-05-30 | Backing-track quality pass (A timbre / B filter-env + chord-tie / C register) + a harmony-theory-architect voicing/progression audit that, with empirical probing, caught a **critical pre-existing bug**: `voiceChord` voiced upper notes at the bare interval pitch-class, so every non-C-rooted backing chord had wrong upper voices — fixed to `rootPc+interval` (Amin now A-C-E). Also replaced the `upperLow` floor with a register-anchor + bass min-gap (minor chords no longer octave-jump) and respelled two metal progressions as `{semis}` tokens (♭VII was the raised LT over harmonic minor). Created **7 specialist agents** (local): 5 genre-idiom (blues/funk/country/jazz/latin) on the metal-agent structure + `bass-pedagogy-expert` and `piano-pedagogy-expert` on the fretboard-expert structure. Logged the agent roster + responsibility matrix. `npm test` 4/4 + 64/64. | `ca8b931`–`b735f02` |
| 2026-05-30 | Metal build §2.2–§3: exotic scales, Drop C/B tunings, polymeter + gallop subdivisions, pedal-point **riff** generator, twin-line **harmonize**, and 5 subgenre pathway packs (metalcore / melodic-metal gallop / melodeath twin leads / djent polymeter / death chromatic) + 4 metal power-chord progressions. Created the **metal-idiom-architect** agent (local) and ran two authenticity passes: round 1 found the pedal-riff ignored `chordOverride` and `meter.grouping`; fixes A–D landed (group-start chord placement, 5 vs 5oct, stable gallop, tremolo flag); round 2 verified all 5 pathways authentic. Swapped djent `vary[3]` gallop→7/8 cell. Codified the **Design north star** (practice-not-generation) in CLAUDE.md/AGENTS.md. Logged follow-up primitives (half-time breakdown, composed harmonized-lead, true tremolo re-articulation, long-cycle/"herta" polymeter + its metering open-question) and the per-instrument-pathways / RPG-skill-tree design direction. `npm test` 4/4 + 64/64. | `68c5b01`–`a611293`+ |
| 2026-05-30 | Review + security hardening. Code-reviewed the session diff: fixed two smoke-test bugs (session disabled-option filter checked the wrong object; `pageerror` handler bypassed the benign-allowlist that `console.error` used). Reviewed the voicing engine (`voiceChord`/`classifyChordTones`) — correct, no changes. Security-reviewed the copy/paste share link: found + fixed a client-side DoS (fretMin/fretMax had no upper clamp, so a crafted `#s=` link with `fretboardSystem=position` + giant `fretMax` could hang the tab in a generation loop — now capped at 36) and `CSS.escape()`'d the untrusted field name in `applyFormState` (a crafted key could break out of the `[name=…]` selector and throw, aborting state-restore/page-init). Then a full-surface audit: SQL is parameterized, `temp-sloppak` uses a UUID slug (no traversal) + 900s synth cap, preset/tuning names render via `textContent`, `summarize()` escapes, no `eval`/`Function`/`document.write` — all clean. Hardened the one gap: `buildSegmentCard()` now escapes its interpolated segment fields (defence-in-depth; also escapes `"` for the `data-kind` attribute). CSRF on the localhost POST routes is a host-level concern (shared FastAPI app/CORS posture, not a plugin-side fix) — written up and reported to the Slopsmith author for the host layer. Clamp verified live; `npm test` 4/4 + 59/59. | `0c35b4c`–`9cb6078` |
| 2026-05-30 | Structural-review pass (no features). Dead-weight removal: deleted unused `static/slopscale.css` + its `/assets` route + orphaned `Response` import (only confirmed-dead code; `temp-sloppak` machinery deliberately kept). Added behavioural safety net — `smoke-renderers.mjs` (4 renderers: attach/draw/clock/no-errors) and `smoke-generators.mjs` (all 28 practice types + 23 scales + bass + 4 sessions, chart-structure validation); `npm test` runs both (59 generator + 4 renderer checks green). `screen.js` organised in place (TOC header + 15 `§N` section banners, comments only — module split rejected: host loads it as a classic `<script>`, so no ES modules without re-adding a serving route). gitignored local agent tooling. Docs synced (`CLAUDE.md`/`AGENTS.md`/`ROADMAP.md`). | `1437d9e`–`5b2a9d7` |
| 2026-05-29 | Doc sync: refreshed ROADMAP "what's shipped" (Phase 4 generators, jazz harmony + voicing engine, harmony tone selector, 14 pathways, flat mode bar, 4 renderers, Phase 2 gamification, tuning CRUD) and corrected the launch-in-main-player line back to 🔲 (not wired). Updated `CLAUDE.md` (screen.js size, renderer count, jazz engine, docs table). | — |
| 2026-05-29 | UX: unified flat mode bar (Guided/Custom/Session) replacing the nested Single/Session + Guided/Custom toggles; presets folded into Custom (preset picker); compact pathway header; preview-audio 1×4 row; shape stepper (◄ ►); count-in aligned. Mode-architecture decision recorded (flat bar, presets-in-Custom, custom-progression-tool as a Custom control, solo grading reserved as 4th "Improv" mode). | — |
| 2026-05-29 | Fixes: open-string bends eliminated (pre-bend fret must be ≥ 1); bending hidden on bass (practice-type option + skill-tree node). Audible bends, notation clef/accidentals/key-sig, tab technique parity, bar-lines-between-downbeats, chord-progression audit (G#7→G7). | — |
| 2026-05-28 | Phase 4: 20 new generators — legato, vibrato, scale thirds/sixths, call+response, tremolo, tapping, pedal point, string skipping, position shift, rhythmic displacement, chromatic enclosures, bebop scale, arpeggio inversions, walking bass, hybrid picking, triadic pairs, pentatonic super, shell voicings, octave displacement. | — |
| 2026-05-28 | Phase 3+4: harmony tone selector (pad/epiano/organ), bending drill generator + pathway + tree node. | — |
| 2026-05-28 | Phase 2: skill tree — SVG node map replaces flat dropdown, 14 nodes × 18 edges, tier dots live-update, Custom ↔ Pathways toggle links, sweep_arpeggio_primer key fix. | — |
| 2026-05-28 | Phase 2: pathway tier progress — `slopscale.pathway_tiers` localStorage, `advancePathwayTier()`, accuracy gate via Minigames SDK hit/miss, passive custom-session attribution, `cleared` + `tier-glow` CSS, `slopscale:tier:unlocked` SDK emit. | — |
| 2026-05-27 | Session UI: two-mode toggle pill (Single/Session), session selector, summary card (name/desc/stats), segment list with kind-badge cards, Launch Session button, audio toggles. `docs/ui-session.md` design spec. | `e9cec8d` |
| 2026-05-27 | Advanced jazz theory reference ingested → `docs/theory-jazz-advanced.md`. Practice session data model: `buildSessionChart`, `buildBpmLadderChart`, `buildSegmentConfig`, `generateSession`, `buildGuideTonesExercise`, `nearestPositionForPc`. 5 melodic minor modes added to `SCALE_INTERVALS`. 4 built-in session presets. Session schema doc. | `194be3c`, `81fd6ab` |
| 2026-05-27 | Roadmap, competitive landscape, Phase 1–6 plan drafted. | — |
| 2026-05-26 | Shape system rework (CAGED unified data model, 3NPS, Open). Pathway UI (scale picker, Next Variation). Pitch accuracy tracker. Theory docs batch 1+2. | `9d0674f`–`c133c74` |
| Earlier | Generators (scale, chord_scales, arpeggios, sweeps, chromatic). 2D renderers. Pathways v1. Preset CRUD. Backend temp-sloppak route. | `293d558`–`032e7b6` |

---

## Next session checklist

When you open a new session, do this first:

1. Read this file top to bottom (2 min).
2. Note today's date — update the session log before closing.
3. Pick work from **Phase 1** before moving deeper. Phase 1 is unblocked right now.
4. Check `CLAUDE.md` for any updated "Active session context" notes.
5. Commit after every working change. Tag `v0.x.0` at meaningful milestones.

**Immediate next tasks (Phase 1):**
1. Session UI in `screen.html` — selector + Launch Session button
2. `voices` selector + `guide_tones` option in the practice type UI
3. Jazz chord-scale defaults in `buildChordScaleExercise` (Lydian for maj7, Lydian dominant for dom7)
4. Rhythm Changes progressions in `COMMON_PROGRESSIONS`
