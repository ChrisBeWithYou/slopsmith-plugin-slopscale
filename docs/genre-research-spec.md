# Genre Research Spec — the repeatable per-genre intake form

> **Purpose.** This is the bounded, repeatable unit of work that turns a genre into SlopScale
> content. One filled copy of this template per genre = everything the build needs: a
> `STYLE_PALETTES` entry, a slate of `PATHWAYS`, and a flagged list of any new primitives
> required. The owning **genre-idiom agent** fills it; **harmony-theory-architect**,
> **rhythm-meter-architect**, and the **instrument-pedagogy agent** review it before it ships.
>
> **Why a template at all.** "How much research per genre" was the wrong question — the right
> one is "*which transferable primitives is this genre built from, and which already have a
> generator?*" That is a finite intake, not an open-ended study. This form makes each genre
> pass cost the same and stay honest to the north star.

---

## 0. The north-star filter (read first)

SlopScale teaches **the grammar, not the sentences.** Every row you write below must name the
**transferable skill** the player takes *off the screen*. Generated content is always a vehicle
for a skill, never the deliverable. The filter is not negotiable — it is the only thing keeping
a "genre pack" from degrading into a karaoke catalogue.

### The Width Doctrine — *where the wiggle room actually is*

Width is welcome. The cap on a genre is **not a pathway quota** — it is the **Primitive Test**.

- A genre's *grammar is large*. Blues alone owns the shuffle, the blue-note bend-to-pitch,
  call-and-response phrasing with space, the quick-change form, turnarounds, dominant-everywhere
  harmony (I7–IV7–V7), double-stops, the BB-box ↔ minor-pentatonic position shift, the rake,
  dynamics. **Each of those is a recombinable primitive** — a block the player reassembles their
  own way. So blues can credibly carry **10–15 pathways** without ever handing the player a
  finished solo to memorise.
- Therefore: **go as wide as the genre has distinct transferable devices.** Enumerate the
  primitives; one pathway (or a small cluster) per primitive. That is "naturally wide."
- The line you must not cross — **"generated solos":** a pathway whose *deliverable* is a fixed,
  composed phrase the player memorises *as content* (rather than as a vehicle for a named
  device); a pathway that strings primitives into a finished musical statement *for* the player;
  or length/completeness pursued as the goal instead of skill-isolation. That is doing the
  creative work for them — cut it or reframe it to a primitive.
- **Variety is already free.** Key cycling, position/shape `vary[]`, tempo tiers, and Next
  Variation give endless surface variety from one pathway. Do **not** add pathways to create
  variety — add a pathway only to name a *new transferable skill*. This is what keeps width from
  becoming padding.
- **The ceiling is self-enforcing.** When you have enumerated the genre's real devices, you
  stop. There is no "Blues Pathway #14: another cool lick" — if a candidate fails the Primitive
  Test, the genre is *done going wide*, not under-served.

### The Primitive Test (apply to every candidate pathway)

1. **Names a transferable skill.** Finish the sentence *"this teaches you to ___"* with a verb +
   device the player uses off-screen (bend to pitch · target the 3rd over the change · lock a
   shuffle · outline the ii–V with guide tones · mute with both hands). If you can't, it's not a
   pathway.
2. **Recombinable, not a sentence.** The output is a *block* the player reassembles, not a
   finished phrase. If removing the skill-name leaves "a nice lick to copy," it fails.
3. **Idiomatic.** It is genuinely how the genre is played (the idiom agent's call), not theory
   imposed on it.
4. **Justifiable against the north star** even at minimum — the `goal` card can state the skill
   and why it's idiomatic.

A pathway must pass **all four.** Fail any → cut, or reframe down to the primitive it's hiding.

### Riffs are first-class primitives — and load-bearing for some genres

A **riff is a cell, not a sentence** — short, looping, recombinable. That puts it firmly on the
*primitive* side of the line (arguably more so than a scale run). So riffs don't strain the north
star; they're its purest expression — "teach the grammar" and a riff-archetype *is* grammar.

For **riff-first genres the riff is the PRIMARY domain, not a footnote.** Metal's rhythm-guitar
craft *is* riffs (chug, gallop, pedal-point, tremolo single-note lines, breakdowns) — scales and
sweeps are the lead-side garnish. Country's rhythm vocabulary is riffs/figures too (boom-chick,
Travis picking, chicken-pickin' double-stop pull-offs, banjo-roll). **A metal or country pack
that taught only scales/arpeggios would be teaching the garnish and skipping the meal** — omitting
riffs is the *authenticity* failure for these genres. (Riff-first genres to flag: metal/all
sub-genres · country · funk · surf · stoner-doom · hard rock · punk.)

**Riffs are generated archetypes, never transcriptions** — this is what makes them simultaneously
*necessary, north-star-clean, and IP-clean.* `pedal_riff` and `gallop` already prove the model: a
**parameterized template** the engine frets into the current key/scale, producing a *fresh*
idiomatic riff every time. It's the genre's real device (authentic), a recombinable loop (a
primitive, not a sentence), and template-generated (no copyrighted cell stored). The shared
infrastructure to grow is a **riff-archetype template library** per riff-genre — generalize the
metal `pedal_riff`/`gallop` proof-of-concept to country/funk/surf/etc. (See the §5 dependency
list; the ROADMAP "Genre & pathway expansion plan" tracks it.)

**IP / naming posture — DECIDED 2026-06-01 (archetype + era framing):**
- ✅ Generate parameterized riff archetypes; goal-card copy **may evoke a scene/era generically**
  — "the engine behind 80s thrash downpicking," "a Bakersfield shuffle feel," "NWOBHM gallop."
- ✅ **Public-domain / traditional** riffs are nameable (12-bar blues, boogie-woogie bassline,
  trad fiddle tunes, Bach/Sor/Giuliani etudes).
- ❌ **Never** a specific song/artist/band **proper noun** in a tracked file (the existing
  attribution-cleanup rule still holds — eras/scenes, not names).
- ❌ **Never** a transcription of a copyrighted riff as the exercise content.

---

## 1. Genre identity

| Field | Value |
|-------|-------|
| **Genre id** (palette/style key) | `<snake_case>` |
| **Display label** | |
| **Owning idiom agent** | `<genre>-idiom-architect` |
| **Parent broad agent** (cedes from) | e.g. `jazz-idiom-architect` |
| **Primary instrument(s)** | guitar / bass / piano / drums |
| **Typical tuning(s)** | standard / drop-D / Drop C–G / DADGAD / … |
| **Sits at arc stage(s)** | Beginner-on-ramp / Intermediate-branch / Advanced-branch |

---

## 2. Signature primitives inventory  ← *the core of the research*

List the genre's transferable devices across the five domains. **This table IS the research
output** — everything else is derived from it. One row = one candidate skill. Keep going until
the Primitive Test stops yielding new rows.

| # | Primitive (device) | Transferable skill (`teaches you to …`) | Domain | Generator status | Dependency |
|---|--------------------|------------------------------------------|--------|------------------|------------|
| 1 | | | riff / harmony / rhythm-feel / articulation / phrasing / form / tone | ✅ existing `buildXExercise` · ◐ existing-needs-flag · 🔲 new primitive | (flag id, or —) |

**Domains to sweep (don't skip any — gaps are where genres feel fake):**
- **Riff / figure** — the genre's signature looping cells (chug, gallop, pedal-point, boom-chick,
  Travis pattern, chicken-pickin', one-chord 16th vamp). **For riff-first genres this is the
  headline domain — sweep it first and widest.** Each = a parameterized archetype template (see
  §0 "Riffs are first-class primitives"), generated in-key, never transcribed.
- **Harmony** — progressions, chord qualities/depth, substitutions, characteristic motion.
- **Rhythm / feel** — subdivision, swing/shuffle/straight, groove cell, gallop, clave, pocket,
  metric devices. (rhythm-meter-architect owns the engine; you name the feel.)
- **Articulation** — bends, slides, HOPO, vibrato, palm mute, rake, ghost notes, slap/pop,
  hybrid/finger-picking, tremolo.
- **Phrasing** — call-and-response, space, motif development, question/answer, dynamics.
- **Form** — 12-bar, AABA/rhythm-changes, vamp, one-chord modal, riff-and-return.
- **Tone** — amp/cab profile, clean/distorted/acoustic/electronic family, kit choice.

---

## 3. `STYLE_PALETTES` entry  *(the shared style→harmony table)*

Fill the exact shape consumed by `stylePaletteConfig()` in `screen.js`. Every referenced
progression / scale / audioProfile must already exist (or be listed as a dependency in §5) —
the startup integrity guard throws otherwise.

```js
<genre_id>: {
  label:        '',
  defaultKey:   '',
  progressions: [ /* COMMON_PROGRESSIONS keys — 1–4 canonical */ ],
  leadScales:   [ /* SCALE_INTERVALS keys — 2–3 idiomatic */ ],
  chordDepth:   '',   // 'power' | 'triad' | 'seventh' | 'extended'
  chordOverride:'',   // 'auto' | 'dom7' | 'min7' | '5' | '5oct' | …
  guideTones:   false,
  feel: { swing: '', backingStyle: '' },   // straight|swing|shuffle · pad|boogie|…|<groove>
  audioProfile: '',   // AUDIO_PROFILES key (+ ensemble kit) | null
},
```

---

## 4. Pathway slate  *(one per primitive cluster — go as wide as §2 earns)*

For each pathway that **passes the Primitive Test**, give the `PATHWAYS` skeleton. Cluster
closely-related primitives where pedagogically natural; split where the skills are genuinely
distinct. Mark arc stage + the band it attaches to.

| Pathway label | Teaches (transferable skill) | Primitive(s) from §2 | Arc stage / band | Gen status |
|---------------|------------------------------|----------------------|------------------|------------|

Then, per pathway, the fill:

```js
<pathway_id>: {
  label:      '',
  goal:       '',                 // NAMES the skill + why it's idiomatic (north-star line)
  scales:     [ ],
  tempoTiers: [ , , , ],
  base: { practiceType:'', scale:'', meter:'', subdivision:'', bpm:, bars:,
          direction:'', sequence:'', advancedMode:true, fretboardSystem:'',
          stringSetup:'', renderer:'highway_3d',
          /* + genre fields: progression, chordDepth, chordOverride, swing, audioProfile, … */ },
  vary: [ /* {key, shape} or partial-config overrides — variety, NOT new skills */ ],
},
```

---

## 5. Primitive dependencies  *(what must be built before this genre is fully authorable)*

List every `🔲 new primitive` / `◐ needs-flag` from §2. This is the **dependency flag** that
gates the pathway and that the ROADMAP backlog tracks. Be specific about the engine touch.

| Dependency | What it is | Engine touch | Owning architect | Blocks which pathways |
|------------|------------|--------------|------------------|------------------------|

> Pathways with **only ✅ generators** ship immediately ("cheap"). Pathways with a 🔲 dependency
> wait on the shared primitive — never fake the device with a near-miss generator.

---

## 6. Realism guardrails  *(playability sign-off)*

- Tuning/string-count fit; any `STRING_SETUPS` / `TUNING_PRESETS` addition needed.
- Playability notes from the instrument-pedagogy agent (fingering, reach, voice-separation, the
  no-unison rule, no two pitches on one string for "twin" lines, etc.).
- Bass/piano divergences (keep CAGED/3NPS/sweep off bass; piano `hand`/`finger` fields).

---

## 7. Sign-off checklist  *(the agent-workflow gate)*

- [ ] **Idiom agent** — every primitive is authentic; nothing crosses into "generated solos."
- [ ] **harmony-theory-architect** — progressions/voicings/substitutions correct (if harmony).
- [ ] **rhythm-meter-architect** — feel/groove/meter expressible by the engine (if rhythmic).
- [ ] **instrument-pedagogy agent** — every pathway is playable as written.
- [ ] **Primitive Test** passed for every pathway in §4.
- [ ] Dependencies in §5 logged to the ROADMAP genre backlog.

---

# Worked example — Blues (the furthest-along genre)

*Illustrates the form with real shipped data. Blues already ships `blues`/`blues_foundation`/
`blues_shuffle`; this shows how the same genre goes **wide** to ~10 pathways under the doctrine
without ever becoming a solo catalogue.*

**§1 Identity:** id `blues` · Blues · owner `blues-idiom-architect` · parent (root genre) ·
guitar+bass · standard / open-E later · Beginner on-ramp → its own Intermediate branch.

**§2 Primitives (abridged):**

| # | Primitive | Teaches you to… | Domain | Gen status | Dep |
|---|-----------|-----------------|--------|------------|-----|
| 1 | Shuffle / boogie feel | lock a triplet-swing pulse | rhythm-feel | ✅ `applySwingToBundle` + `backingStyle:'boogie'` | — |
| 2 | Blue-note bend-to-pitch | bend the ♭3→3 / ♭5 in tune | articulation | ◐ bend flag exists; ◐ quarter-tone + vibrato-on-bend | `bend_microtonal` |
| 3 | Dominant-everywhere harmony | hear I7–IV7–V7 (all dominant) | harmony | ✅ `chordOverride:'dom7'` | — |
| 4 | Quick-change 12-bar form | navigate the canonical form | form | ✅ `12_bar_blues` / `quick_change_blues` | — |
| 5 | Turnaround | resolve the last two bars back to I | harmony/phrasing | ◐ needs a turnaround progression token | `prog:blues_turnaround` |
| 6 | Call-and-response w/ space | answer your own phrase, leave room | phrasing | ◐ `call_response` exists; scoring-phrase later | (Improv mode) |
| 7 | Double-stops | move 6ths/4ths as a unit | articulation/harmony | ◐ `scale_in_sixths`; oblique double-stop bend 🔲 | `double_stop_bend` |
| 8 | BB-box ↔ min-pent shift | pivot between the two home boxes | phrasing/fretboard | ✅ `position_shift` | — |
| 9 | Minor-pentatonic + ♭5 box | the blues-scale home shape | harmony/fretboard | ✅ `scale` (blues) | — |
| 10 | The rake / dynamics | accent into the target note, vary attack | articulation | 🔲 rake/attack model | `attack_rake` |

**§3 Palette (shipped):**
```js
blues: { label:'Blues', defaultKey:'A', progressions:['12_bar_blues','quick_change_blues'],
         leadScales:['blues','minor_pentatonic'], chordDepth:'seventh', chordOverride:'dom7',
         guideTones:false, feel:{swing:'shuffle', backingStyle:'boogie'}, audioProfile:'blues' },
```

**§4 Pathway slate (how width is earned, not padded):** *Blues Scale Foundation* (#9) · *Blues
Shuffle* (#1, shipped) · *Quick-Change Form* (#4) · *Dominant-Everywhere Comping* (#3) · *Bend-to-
Pitch* (#2 — waits on `bend_microtonal`) · *Turnaround Workshop* (#5) · *Call-and-Response with
Space* (#6) · *Double-Stop Moves* (#7) · *BB-Box Pivot* (#8) · *Rake & Dynamics* (#10 — waits on
`attack_rake`). **Ten pathways, ten named skills, zero solos.** Six ship cheap today; four wait
on a flagged primitive (§5).

**§5 Dependencies:** `bend_microtonal` (quarter-tone + vibrato-on-bend — rhythm/articulation
model) · `blues_turnaround` token (harmony-architect) · `double_stop_bend` builder · `attack_rake`
attack model. All four also serve country/rock — *build once, many genres collapse to cheap.*

**§7 Sign-off:** blues-idiom ✅ (root bug history in its agent memory) · harmony ✅ (the
dom7/root-resolution fix) · guitar-pedagogy ✅ · Primitive Test ✅ (each names a device).
