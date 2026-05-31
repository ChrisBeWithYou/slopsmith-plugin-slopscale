# SlopScale Roadmap

> Read this at the start of every session. Update it before closing.
> Current date: 2026-05-30. Total commits: 170.

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

### Pathways (14 curated)
- ✅ Chromatic Warmup
- ✅ Pentatonic Foundation
- ✅ Blues Scale Foundation
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

## Design direction: per-instrument pathways + RPG-style skill tree (proposed 2026-05-30)

As guitar-specific content grows (the metal pack), the single shared pathway list/tree is straining. Direction (decision pending — discuss + spec before building):

- **Decouple pathways per instrument family.** Pathways gain an instrument scope (guitar / bass / piano); the skill tree filters to the active family. This also resolves **tuning**: today a pathway sets one `stringSetup` and the full metal drop set (Drop C/B/A/G) isn't cleanly reachable from a pathway base (Drop C/B live in `TUNING_PRESETS`/`customOpenMidis`, not `STRING_SETUPS`); instrument-scoped pathways would carry instrument-appropriate tunings directly. Generators are already key-relative, so content transposes — the pedal-riff just frets the tonic on the low string, so the open-string-pedal feel only emerges when the key matches the tuning's low string. Per-instrument scoping makes that intentional rather than incidental.
- **Lean the skill tree into an RPG progression map.** The node/edge graph (`SKILL_TREE_NODES`/`EDGES`) + per-pathway BPM tiers already exist; evolve toward per-instrument trees with prerequisite/branching flow and mastery/XP per node — serving the Phase 2 gamification goal.
- **Constraints:** stays *soft* (suggests next, never content-gates — Phase 2 principle) and must serve the learning progression, never become the point (Design north star in `CLAUDE.md`). Loop in slopscale-ux-designer for the tree UX + a planning pass; this is an architecture + UX change, not a quick edit.

---

## Agent roster (review & design specialists, 2026-05-30)

Specialist sub-agents live in `.claude/agents/` (local/gitignored — they may name artists/bands in conversation, but anything they author into tracked files stays proper-noun-clean per the attribution-cleanup rule). They are reviewers/designers, not builders; each clears a **distinct, non-overlapping lane** so they don't step on each other:

- **harmony-theory-architect** — harmony/note-choice/voicing theory + progressions, all instruments & genres.
- **Instrument playability/pedagogy (verify techniques, fingering, scale/arpeggio patterns):** `fretboard-pedagogy-expert` (guitar), `bass-pedagogy-expert` (bass — movable position box, NOT CAGED), `piano-pedagogy-expert` (piano — pitch-primary, supports Phase 6 groundwork).
- **Genre-idiom (own rhythm/feel/technique/phrasing; defer harmony→harmony-architect, fingering→the instrument expert):** `metal-idiom-architect`, `blues-idiom-architect`, `funk-idiom-architect`, `country-idiom-architect`, `jazz-idiom-architect` (feel/comping/phrasing only — NOT note-choice), `latin-idiom-architect`.
- **slopscale-ux-designer** — UI/UX.

The matrix is clean: **harmony (1) × instrument-playability (3) × genre-idiom (6) + UX (1)**. The agent is cheap; the **genre framework build behind each genre agent** (primitives + pathways, like the whole metal effort) is the real work — **sequence those builds one at a time**, agent-reviewed. Build priority for the genre fronts: blues → funk → country → jazz → latin.

---

## Open threads (next-session pickup — 2026-05-30)

Diagnosed this session, decisions/fixes pending:

- 🔲 **Blues IV sounds dissonant** — `blues_foundation` sets `chordOverride:'min7'`, forcing I/IV/V all minor 7th (a *minor* blues), so the IV is `ivm7`. Standard blues is **dominant** (I7-IV7-V7), so a minor IV clashes with blues-scale phrasing. The `12_bar_blues` progression is degree-only (`[1,1,1,1,4,4,…]`); quality is the override. Likely fix: `blues_foundation` → `dom7` (and a separate, clearly-labeled minor-blues pathway if that sound is wanted). **Per the agent-workflow rule, run through harmony-theory-architect + blues-idiom-architect before changing.**
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

### Backing track generator (intentional future scope)
- 🔲 **WebAudioFont or Tone.js Sampler** — load GM-compatible instrument samples from a CDN (piano, acoustic guitar, bass, etc.) for real sampled chord pads. Trigger on each backing event the same way oscillators are today. No audio stem generation needed — purely frontend.
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
  - Build order: herta `rhythmSteps` → `parseMeter` `@`-clause parsing → pedal-riff phrase-clock branch → optional `accent:'phrase'` highway marker. Playability of the herta trill at speed → fretboard-pedagogy-expert (keep trill flags on static-pitch cells only). No harmony-architect involvement.
- 🔲 (handoff) **Melodeath twin-lead voice separation** — harmonized dyads can land two pitches on the *same string* (sounds right, not literally playable, doesn't read as two guitars). Defer to fretboard-pedagogy-expert.

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
