# SlopScale Roadmap

> Read this at the start of every session. Update it before closing.
> Current date: 2026-05-27. Total commits: 85.

---

## Current state — what's actually shipped

### Generators
- ✅ `scale` — scale runs, all positions (CAGED / 3NPS / Open / position / full-neck)
- ✅ `chord_scales` — scales over chord changes (mode-of-moment + chord-tone-emphasis)
- ✅ `diatonic_arpeggios` — all 7 diatonic chord arpeggios in sequence
- ✅ `progression_arpeggios` — arpeggio paths over named progressions
- ✅ `sweep_arpeggios` — CAGED-anchored sweep patterns with HOPO turnaround
- ✅ `chromatic` — warmup patterns (1234, 4321, 1324, spider, advanced)
- ✅ `guide_tones` — 3rds and/or 7ths voice-led through any progression (Levine)

### Fretboard systems
- ✅ CAGED (5 shapes: C/A/G/E/D) — unified data model, shape resolution, chord templates
- ✅ 3NPS (7 positions, named by mode)
- ✅ Open position
- ✅ Custom fret range / full-neck fallbacks

### Scale library
- ✅ Major, natural minor, harmonic minor, melodic minor
- ✅ All 7 modes (dorian, phrygian, lydian, mixolydian, locrian, + phrygian dominant)
- ✅ Bebop major + bebop dominant
- ✅ Pentatonic minor/major, blues
- ✅ Whole tone, diminished
- ✅ Lydian dominant
- ✅ **5 melodic minor modes (Levine):** dorian_b2, lydian_augmented, mixolydian_b6, locrian_sharp2, altered

### Pathways (11 curated)
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

### Session framework
- ✅ Session data model (`BUILT_IN_SESSIONS`, segment schema)
- ✅ `buildSessionChart()` — concatenates segments with time offsets + section markers
- ✅ `buildBpmLadderChart()` — same exercise at stepping BPMs, beats accurate per step
- ✅ `buildSegmentConfig()` — config merge + shape resolution per segment
- ✅ `generateSession()` — top-level entry point, same output shape as `generateExercise()`
- ✅ 4 built-in session presets: ii–V–I Workshop, Daily 30-min Intermediate, Blues Fundamentals, Bebop Fundamentals
- 🔲 Session UI — selector + "Launch Session" button not yet in `screen.html`

### Sequence patterns
- ✅ Fours (1-2-3-4), triplets, diatonic thirds, broken triads (1-3-5), Yngwie sixes

### Key cycling
- ✅ Circle of fourths, circle of fifths, chromatic

### Audio
- ✅ Web Audio engine — note synthesis (sine), metronome, harmony backing
- ✅ Pitch accuracy tracker via Slopsmith Minigames SDK (unregistered as minigame)

### Display
- ✅ 2D highway preview renderer (built-in canvas)
- ✅ 2D tab preview renderer
- ✅ Static fretboard diagram panel (above highway, shows current shape)
- ✅ Launch in Slopsmith's main 3D player via `launchInMainPlayer()` + `POST /temp-sloppak`
- ✅ Escape-return handler (returns to SlopScale from player)

### Infrastructure
- ✅ Preset CRUD (`GET/POST/DELETE /api/plugins/slopscale/presets`)
- ✅ Temp sloppak builder (`POST /api/plugins/slopscale/temp-sloppak`)
- ✅ Audio stem synthesis (WAV + OGG if ffmpeg available)
- ✅ Multi-instrument string setups: guitar 6/7/8, bass 4/5

### Theory knowledge base
- ✅ Berklee Method Vols 1–3 (Leavitt)
- ✅ Fretboard Theory (Serna)
- ✅ Guitar Method: All Scales & Arpeggios
- ✅ Aebersold Jazz Handbook (dominant 7th tree, scale families)
- ✅ Berklee Voice Leading (chord-scale relationships, II-V-I resolution)
- ✅ Bebop scales (Ghijselen)
- ✅ **Mark Levine — The Jazz Theory Book** (melodic minor modes, guide tones, pentatonic superimposition, Rhythm Changes, minor ii-V-i, avoid notes, 8-step learning sequence)

---

## Phase 1 — Foundation Completion
*Immediate next work. Data model and generators exist; UI hookup and a few data-only items remain.*

### Session UI
- 🔲 Session selector dropdown in `screen.html` (built-ins + custom)
- 🔲 "Launch Session" primary button
- 🔲 Session summary display (total duration, segment count, BPM range)
- 🔲 Per-segment preview list

### Guide tones UI
- 🔲 `voices` selector in `screen.html` (`thirds_only` / `sevenths_only` / `both_alternating`)
- 🔲 `guide_tones` option in the practice type selector

### Levine scale defaults
- 🔲 `chord_scales` generator: default maj7 → Lydian (not Ionian), dom7 resolving to major → Lydian dominant, m7b5 → Locrian ♮2
- 🔲 Minor ii-V-i: add `minor: true` flag to `minor_ii_V_i` progression so generator uses m7b5 on degree ii, altered/dim on degree V

### String setup
- 🔲 **Per-string tuning editor** — allow users to set individual string pitches rather than only selecting from preset `STRING_SETUPS`. Required for open tunings (DADGAD, open G, open D), step-down tunings, and baritone guitar. Maps to `openMidis` array adjustments. *(User UX request)*

### Data gaps
- 🔲 Rhythm Changes A section in `COMMON_PROGRESSIONS` (full 8-chord, not reducible to 4 degrees)
- 🔲 Rhythm Changes bridge (III7–VI7–II7–V7) in `COMMON_PROGRESSIONS`
- 🔲 `modal_vamp` as a named pathway (one chord, one scale, extended duration)

---

## Phase 2 — Gamification Layer
*Progress tracking first, then the XP/streak UI on top of it.*

### Progress tracking (localStorage)
- 🔲 Log each practice session start/stop: date, pathway/session name, BPM tier, duration played
- 🔲 "Last 7 days" calendar grid displayed in SlopScale panel
- 🔲 Streak counter (days practiced in a row)

### XP and pathway leveling
- 🔲 Map 4 BPM tiers per pathway to XP milestones
- 🔲 Visual progress bar per pathway card
- 🔲 Tier unlock glow effect when a tier is cleared

### Achievements
- 🔲 10–15 named badges: "Blues Initiator", "Circle Rider", "Sweep Starter", "Jazz Chord Tones", etc.
- 🔲 LocalStorage unlock state + achievement panel

### Pathway skill tree
- 🔲 Replace flat pathway dropdown with a visual tree (beginner → intermediate → advanced)
- 🔲 Prerequisite gating: pathway unlocks when prior tier is hit

---

## Phase 3 — Exercise Library Expansion
*New generators and genre pathway packs.*

### New generators
- 🔲 **Bending drill** — fixed note pairs with `bn: 1` / `bn: 2`; beginner-essential
- 🔲 **Legato runs** — scale passages with `ho: true` ascending, `po: true` descending
- 🔲 **String-skipping** — restrict to non-adjacent strings; Satriani/Guthrie Govan vocabulary
- 🔲 **Pedal point sequences** — alternating pedal note + scale run above/below
- 🔲 **Chromatic enclosures** — approach notes wrapping chord tones (-1, +1, -2, +1)
- 🔲 **Chord Jam / Improv Scoring mode** — generate a chord progression (dropdown or semi-random), display it as a backing chart, score user's improvisation based on whether played notes land in the correct chord-scale at each moment. Uses existing Minigames SDK pitch tracker + chord-scale matching logic; achievable without Slopsmith's full scorer API. *(Community request)*
- 🔲 **Improv mode** — backing chord chart with empty note slots; user fills them in
- 🔲 **Walking bass line** — root-to-chord-tone scalar walks between chord changes
- 🔲 **Pentatonic superimposition** — play pentatonic from non-root starting point for specific tension (Levine chapter)

### Visual / practice modes
- 🔲 **Master mode** — post-processing pass that removes notes from the final N% of a chart; trains memorization
- 🔲 **Position shift exercises** — scale runs that cross CAGED shape boundaries at a specified connection point

### Genre pathway packs
- 🔲 Metal pack: alternate picking 160+ BPM, harmonic minor exotic, diminished runs
- 🔲 Jazz pack: guide tones, ii-V-I, Rhythm Changes A+B, bebop connecting tones, altered dominant
- 🔲 Country pack: major pentatonic hybrid, chicken-pickin' muted note patterns
- 🔲 Classical/fingerstyle pack: Segovia-style patterns, counterpoint fragments

---

## Phase 4 — Scoring Integration + Adaptive Practice
*Depends on Slopsmith's scorer API becoming available.*

- 🔲 Wire Slopsmith Constitution II / pitch scorer results into SlopScale progress model
- 🔲 Adaptive BPM: auto-advance tier if accuracy ≥ 85%, suggest dropping if < 60%
- 🔲 Practice journal: week/month views, accuracy by pathway, BPM progression over time
- 🔲 Weakness detection: flag the worst (key, shape, tempo) triple from session history and auto-generate a targeted drill

---

## Phase 5 — Piano / Keyboard Support
*Architecturally significant — coordinate with Slopsmith roadmap.*

- 🔲 Define pitch-primary exercise data model (note name + octave + duration, string/fret derived for guitar)
- 🔲 Piano exercise generators (scales, arpeggios, ii-V-I, Hanon-style)
- 🔲 Falling-notes canvas display (Synthesia style) for piano preview in SlopScale's built-in renderer
- 🔲 Watch Slopsmith roadmap for native piano highway support (Option A) vs. own display (Option B, above)

---

## Phase 6 — Standalone Potential
*Only if SlopScale outgrows what Slopsmith can provide.*

- 🔲 Evaluate whether Slopsmith's ecosystem is the right long-term host
- 🔲 If standalone: wrap a Tone.js / Web Audio playback engine around the existing generator core
- 🔲 Possible Tauri app (shares DNA with Rifflarr)

---

## Session log

| Date | Work done | Key commits |
|------|-----------|-------------|
| 2026-05-27 | Mark Levine Jazz Theory Book ingested → `docs/theory-levine-jazz.md`. Practice session data model: `buildSessionChart`, `buildBpmLadderChart`, `buildSegmentConfig`, `generateSession`, `buildGuideTonesExercise`, `nearestPositionForPc`. 5 melodic minor modes added to `SCALE_INTERVALS`. 4 built-in session presets. Session schema doc. | `194be3c`, `81fd6ab` |
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
3. Levine scale defaults in `buildChordScaleExercise` (Lydian for maj7, Lydian dominant for dom7)
4. Rhythm Changes progressions in `COMMON_PROGRESSIONS`
