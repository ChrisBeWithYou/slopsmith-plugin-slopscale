# Riff-Archetype Library — spec

> **Status: DRAFT — pending idiom + rhythm-meter sign-off.** Authored in the main thread
> (the specialist agents `metal-idiom-architect` / `country-idiom-architect` /
> `rhythm-meter-architect` are local/gitignored and not present in the cloud clone). Every
> archetype below is grounded in **verified `screen.js` tokens**, but the *authenticity* and
> *playability* calls are flagged `⟳ sign-off` for the local agent pass.
>
> **What this is.** The shared riff-primitive spec the ROADMAP "Genre & pathway expansion plan"
> calls the single highest-leverage content primitive. A riff-archetype is a **parameterized
> template** the engine frets into the current key/scale (the `pedal_riff`/`gallop` model) —
> generated fresh every time, never a stored transcription. See `genre-research-spec.md` §0 for
> the doctrine (riffs are cells not sentences; generated archetypes; archetype + era-framing IP
> posture).

---

## How an archetype maps to the engine

A riff-archetype = `{ practiceType, + config knobs }`. The real knobs available today
(verified in `buildPedalRiffExercise`, `secondsPerDivision`, `rhythmSteps`):

| Knob | Real values | What it controls |
|------|-------------|------------------|
| `practiceType` | `pedal_riff` · `pedal_point` · `tremolo_picking` · `scale_thirds`/`scale_sixths` (+`harmonize`) · `hybrid_picking` · `chromatic` | which riff engine |
| `subdivision` | `eighth` · `gallop` (=`[q/2,q/4,q/4]`) · `reverse_gallop` (=`[q/4,q/4,q/2]`) · `sixteenth` · `triplet` | the picking-hand cell |
| `meter` | `4/4` · `8/8:3+3+2` · `7/8:3+2+2` · `16/8:3+3+3+3+2+2` | polymeter grouping cell |
| `chordOverride` | `5` (dyad) · `5oct` (root+5+8, 3-string) | power-chord voicing |
| `progression` | `metal_pedal_chromatic` · `metal_i_bVI_bVII` · `metal_i_bVII_bVI_V` · `metal_death_tritone` · `static_i` · … | root motion |
| `tremolo` | `true`/`false` | marks the `tr` flag (NB: a *flag*, not re-articulation — see gap T1) |
| `stringSetup` | `guitar_6_drop_d` · `guitar_7_standard` · … | tuning |

**Status legend:** ✅ ships over existing generators today · ◐ approximable now, wants a flag for
full fidelity · 🔲 needs a new primitive (the dependency the library must build).

---

## Metal riff archetypes  ⟳ sign-off: metal-idiom-architect

*Finding: metal is **~85% already expressible** — the `pedal_riff`/`gallop`/polymeter engine
plus the four `metal_*` progressions cover the core riff vocabulary. The gaps are the four
roadmap-flagged authenticity follow-ups, all riff-domain.*

| Archetype | Era/scene framing (goal-card copy) | Teaches | Realization | Status |
|-----------|-----------------------------------|---------|-------------|--------|
| **Palm-muted pedal chug** | "the metalcore breakdown engine" | lock a muted low pedal against semitone power-chord stabs | `pedal_riff` + `metal_pedal_chromatic` + `chordOverride:'5'` + `guitar_6_drop_d` | ✅ (ships as `metalcore_chug`) |
| **Gallop** | "the NWOBHM / power-metal engine" | down-down-up picking on eighth+two-16ths, palm-muted | `pedal_riff` + `subdivision:'gallop'` | ✅ (`melodic_metal_gallop`) |
| **Reverse gallop** | "the thrash variant" | the inverted 16th-16th-8th cell | `pedal_riff` + `subdivision:'reverse_gallop'` | ✅ |
| **Polymeter chug** | "the djent grouping — the riff IS the rhythm" | feel a 3+3+2 cell against a steady count | `pedal_riff` + `meter:'8/8:3+3+2'` + `chordOverride:'5oct'` | ✅ (`djent_polymeter`) |
| **Non-functional tritone riff** | "death-metal menace — no key gravity" | semitone/tritone root motion, darkest scales | `pedal_riff` + `metal_death_tritone` + `locrian`/`diminished` | ✅ (`death_chromatic`) |
| **Tremolo single-note riff** | "the tremolo-picked melodeath line" | sustained rapid re-picking of a single melodic line | `tremolo_picking` over `phrygian`/`natural_minor` | ✅ (generator re-picks per bar) |
| **Open-string pedal + moving voice** | "the neoclassical pedal figure" | hold a low pedal, move an upper melodic voice | `pedal_point` | ✅ |
| **True tremolo re-articulation on a riff** | (enhancement) | the `tr` flag on `pedal_riff` only *marks*; it doesn't re-pick | `pedal_riff` + per-note re-articulation tied to subdivision | 🔲 **T1** (roadmap: "true tremolo re-articulation") |
| **Half-time breakdown** | "the breakdown — low-string displacement at half the pulse" | feel the half-time displacement | new rhythmic-displacement-on-pedal mode | 🔲 **T2** (roadmap: "half-time breakdown feel") |
| **Composed harmonized twin-lead** | "the Gothenburg twin-guitar signature" | harmonize a *written line*, not a scale walk | today `scale_thirds`+`harmonize` twins a scale run (`melodeath_twin_leads`); composed line needs a melody primitive | ◐→🔲 **T3** (roadmap: "composed harmonized-lead generator") |
| **Herta / long-cycle polymeter** | "extreme-prog rolling burst over a steady 4/4" | a long odd phrase drifting against the pulse | `subdivision:'herta'` case + `@ N/D:g+g` phrase-clause on the meter string | 🔲 **T4** (roadmap-spec'd; pedal-riff phrase-clock branch) |

**Metal dependencies (all already roadmap-flagged):** T1 true-tremolo · T2 half-time-breakdown ·
T3 composed-harmonized-lead · T4 herta/long-cycle. None block the seven ✅ archetypes — metal can
go wide *now*; these four deepen it.

---

## Country riff archetypes  ⟳ sign-off: country-idiom-architect + guitar-pedagogy-expert

*Finding: country's riff vocabulary is **essentially unmodelled** — this is where the
riff-archetype library earns its keep. Most archetypes are 🔲, and they cluster onto a small set
of shared primitives (alternating-bass comping · oblique double-stop bend · hybrid/finger
attack · let-ring) that also serve blues/rock/folk.*

| Archetype | Era/scene framing (goal-card copy) | Teaches | Realization | Status |
|-----------|-----------------------------------|---------|-------------|--------|
| **Boom-chick (alternating bass)** | "the honky-tonk / Bakersfield engine" | alternate root–5 bass against off-beat chord stabs | needs `buildCompingExercise` + an `altBass` flag | 🔲 **C1** (← `buildCompingExercise`, queued #7) |
| **Double-stop 6ths/3rds lead** | "the classic country lead move" | move parallel 6ths/3rds with hammer-ons | `scale_sixths`/`scale_thirds` (+`ho`) approximates *now* | ◐ ships approximately; full = **C2** oblique bend |
| **Chicken-pickin'** | "the Telecaster snap" | muted open-string pops + hybrid-picked double-stops | `hybrid_picking` + `mt` exist; the snap/pop attack + pull-offs need an attack/articulation flag | ◐→🔲 **C3** (attack/pop flag) |
| **Pedal-steel oblique bend** | "the pedal-steel bend on a guitar" | bend one string while holding another static | new oblique double-stop bend builder | 🔲 **C2** (roadmap: "oblique double-stop bend builder") |
| **Banjo-roll / cascading open strings** | "the crosspick roll" | a let-ring rolling arpeggio across open + fretted | new roll/let-ring primitive | 🔲 **C4** (roadmap: "banjo-roll/let-ring") |
| **Travis picking** | "the alternating-thumb fingerstyle pattern" | independent thumb bass under finger melody | needs p-i-m-a RH-finger field + thumb-pattern | 🔲 **C5** (← p-i-m-a RH field; heaviest, defer) |
| **Major-pentatonic open-position lick** | "the country-rock turnaround" | major-pentatonic phrasing in open position | `scale` + `major_pentatonic` + open position | ✅ (ships now; thin without C1–C4) |

**Country dependencies (the library's real build list):** **C1** alternating-bass (rides on
`buildCompingExercise`) · **C2** oblique double-stop bend builder · **C3** chicken-pickin'
attack/pop flag · **C4** banjo-roll/let-ring · **C5** p-i-m-a + Travis (defer). C1–C4 are the
country-authenticity unlock — and **C1/C2 also serve blues and rock**, so build once.

---

## Funk (preview)  ⟳ sign-off: funk-idiom-architect

One headline archetype noted for the backlog (full sweep when funk's spec is authored):
**16th-note one-chord vamp** — "the funk pocket riff" — a percussive 16th-note single-chord/
double-stop figure with ghost notes. Realization needs the **16th-pocket groove + ghost-note
model** (drum/feel engine, Phase D) + a muted-strum attack; ◐ today via `static_i` +
`subdivision:'sixteenth'`, full fidelity 🔲.

---

## Consolidated dependency list  → feeds the ROADMAP backlog

| Dep id | Primitive | Serves | Notes |
|--------|-----------|--------|-------|
| C1 | alternating-bass comping (`altBass` on `buildCompingExercise`) | country, blues, rock, folk | rides on queued generator #7 |
| C2 | oblique double-stop bend builder | country, blues | also blues "double-stop moves" |
| C3 | chicken-pickin' attack/pop flag | country | hybrid_picking + mt exist; needs attack model |
| C4 | banjo-roll / let-ring | country, bluegrass, folk | roll arpeggio + ring-out |
| C5 | p-i-m-a RH-finger field + Travis | country, classical, folk | heaviest; defer (Phase 6-adjacent) |
| T1 | true tremolo re-articulation | metal, surf | `tr` flag → real re-pick |
| T2 | half-time breakdown displacement | metal | roadmap-flagged |
| T3 | composed harmonized-lead | metal (melodeath), prog | harmonize a written line |
| T4 | herta / long-cycle phrase-clock | prog-metal, math-rock | roadmap-spec'd, lightweight |

**Build-leverage read:** metal is wide *today* (7 ✅ archetypes; T1–T4 deepen). Country needs
**C1–C4** to be authentic at all — and C1 (alternating bass) is the keystone because it depends
only on `buildCompingExercise`, already queued as generator #7. **Sequencing implication:** build
`buildCompingExercise` + `altBass` first → unlocks country boom-chick *and* jazz/gospel/rock/pop
comping in one stroke.
