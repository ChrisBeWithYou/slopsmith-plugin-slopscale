# Wave 1 — STYLE_PALETTES content vet + widened pathway slates

> **Status: DRAFT — structural vet COMPLETE; idiom + harmony sign-off PENDING.** Authored in the
> main thread against verified `screen.js` tokens; the *authenticity* calls are flagged
> `⟳ sign-off` for the local idiom/harmony agents (gitignored, not in this clone). This is Wave 1
> of the ROADMAP "Genre & pathway expansion plan": vet the shipped 9 palettes, then widen
> blues/jazz/metal to their full primitive slates **over existing generators only** (no new
> primitives — those are Wave 2+).

---

## Part A — Palette content vet (all 9)

**Structural result: ✅ ALL 9 PALETTES ARE TOKEN-VALID.** Every referenced progression key
exists in `COMMON_PROGRESSIONS` and every `leadScale` exists in `SCALE_INTERVALS`, so the startup
integrity guard passes. No broken references. The flags below are **idiom refinements**, not
errors — and most resolve to "the `backingStyle` is a `pad` placeholder pending the groove/riff
engine," which is expected at this stage.

| Style | Progressions ✓ | Scales ✓ | Idiom flag (⟳ sign-off) | Severity |
|-------|----------------|----------|--------------------------|----------|
| **blues** | 12_bar_blues, quick_change_blues | blues, minor_pentatonic | Clean. (root/dom7 bugs already fixed.) | — |
| **rock** | i-VII-VI-VII, I-V-vi-IV, I-IV-V | minor_pentatonic, natural_minor | Only *minor* scales — major-key/mixolydian rock unrepresented; consider adding `major_pentatonic`/`mixolydian` | low |
| **metal** | metal_i_bVI_bVII, metal_pedal_chromatic, metal_i_bVII_bVI_V | phrygian, natural_minor, harmonic_minor | Clean; backing is `pad` (should become the palm-muted riff — audio/NAM thread) | low |
| **djent** | metal_pedal_chromatic | phrygian, natural_minor | Single progression (correct — djent harmony is static); backing `pad` not the chug | low |
| **jazz** | ii-V-I, vi-ii-V-I, rhythm_changes_a | major, dorian, mixolydian | Clean; `guideTones:true` correct | — |
| **funk** | i-VII-VI-VII, static_i | dorian, minor_pentatonic | `audioProfile:null` (→ global default voice); `chordDepth:'seventh'` ok but funk often `ninth`; backing `pad` not a 16th pocket | med |
| **pop** | I-V-vi-IV, vi-IV-I-V, I-vi-IV-V | major, major_pentatonic | `audioProfile:null`; otherwise clean | low |
| **country** | I-IV-V, I-V-vi-IV | major_pentatonic, major | Add `mixolydian` (honky-tonk) per idiom; backing `pad` not boom-chick (← riff-lib C1) | med |
| **gospel** | ii-V-I, I-vi-ii-V | major, dorian | `chordDepth:'ninth'` + `guideTones` correct; wants the comping generator for the comp feel | low |

**Recommended palette edits (cheap, pending idiom sign-off):**
- `funk.chordDepth: 'seventh' → 'ninth'` and `funk.audioProfile: null → 'funk'` (if/when a funk
  profile exists) — ⟳ funk-idiom.
- `country.leadScales: [...] + 'mixolydian'`; `rock.leadScales: + 'major_pentatonic'` — ⟳
  rock/country-idiom.
- Leave every `backingStyle:'pad'` placeholder as-is until the groove/riff engine lands (Wave
  2/4) — changing it now would promise a feel the engine can't render.

**Net:** the palettes are structurally sound and safe for Pathways/Jam to consume. The idiom
refinements are minor and non-blocking.

---

## Part B — Widened pathway slates (over EXISTING generators only)

Each pathway below passes the Primitive Test (names a transferable skill) and uses **only verified
existing `practiceType` tokens** — buildable today, zero new primitives. `⟳ sign-off` = idiom +
harmony review before "done." Pathways that need a new primitive are listed separately as
*deferred to Wave 2+* so the line stays honest.

### Blues — shipped: `blues_foundation`, `blues_shuffle` (2). Add ~5 over existing:

| New pathway | Teaches | practiceType + config | Status |
|-------------|---------|------------------------|--------|
| Quick-Change Form | navigate the IV-in-bar-2 variant | `scale` + `progression:'quick_change_blues'` + blues | ✅ |
| BB-Box Pivot | shift between minor-pent and major-pent home boxes | `position_shift` + blues/`minor_pentatonic` | ✅ |
| Call & Response with Space | answer your own phrase, leave room | `call_response` + blues | ✅ |
| Blues in 6ths | move double-stop 6ths as a unit | `scale_sixths` + blues (approximates; oblique bend = Wave 2 C2) | ✅ |
| Bend Drill (blue notes) | bend ♭3→3 / ♭5 in tune | `bending` + blues (microtonal = Wave 2) | ✅ (exists as `bend_drill`; add a blues-keyed variant) |

*Deferred to Wave 2+ (need a primitive):* Dominant-Everywhere Comping (← `buildCompingExercise`) ·
Turnaround Workshop (← `blues_turnaround` token) · Rake & Dynamics (← `attack_rake`).

### Jazz — shipped: `ii_V_I_workout` (+ shared `guide_tones_path`, `seventh_vocab`). Add ~7 over existing:

| New pathway | Teaches | practiceType + config | Status |
|-------------|---------|------------------------|--------|
| Bebop Lines | chromatic passing tones on strong beats | `bebop_scale` + `bebop_dominant`/`bebop_major` | ✅ |
| Chromatic Enclosures | surround a target chord tone | `chromatic_enclosures` over `ii-V-I` | ✅ |
| Shell Voicings | comp with 3rd+7th shells | `shell_voicings` + `ii-V-I` | ✅ |
| Arpeggio Inversions over Changes | spell each chord from any inversion | `arpeggio_inversions` + `ii-V-I` | ✅ |
| Rhythm Changes A | navigate the I-vi-ii-V turnaround engine | `chord_scales` + `rhythm_changes_a` | ✅ |
| Tritone-Sub Lines | hear the ♭II substitution | `chord_scales` + `tritone_sub_ii_V_I` | ✅ |
| Pentatonic Superimposition | imply extensions via displaced pentatonics | `pentatonic_super` + `ii-V-I` | ✅ |
| Walking Bass (bass) | outline changes a quarter-note at a time | `walking_bass` + `ii-V-I` | ✅ |

*Deferred to Wave 2+:* Comping-Rhythm cell (← `buildCompingExercise` + comping-rhythm generator).

### Metal — shipped: 5 (`metalcore_chug`, `melodic_metal_gallop`, `melodeath_twin_leads`, `djent_polymeter`, `death_chromatic`). Add ~4 over existing:

| New pathway | Teaches | practiceType + config | Status |
|-------------|---------|------------------------|--------|
| Tremolo Single-Note Riff | sustained rapid re-picking of a melodic line | `tremolo_picking` + `phrygian`/`natural_minor` | ✅ |
| Neoclassical Pedal Point | hold a low pedal, move an upper voice | `pedal_point` + `harmonic_minor` | ✅ |
| String-Skipping Arpeggios | wide-interval prog-metal arpeggios | `string_skipping` + minor arps | ✅ |
| Shred Tapping | two-hand tapped arpeggio extensions | `tapping` + `natural_minor`/`harmonic_minor` | ✅ |
| Legato Runs | smooth hammer/pull phrasing at speed | `legato` + minor scales | ✅ |

*Deferred to Wave 2+ (the riff-domain gaps — see `riff-archetypes.md` T1–T4):* True-Tremolo Riff ·
Half-Time Breakdown · Composed Twin-Lead · Herta/Long-Cycle.

---

## Outcome & next step

- **Wave 1 structural vet: done** — 9 palettes valid; idiom refinements logged (minor,
  non-blocking) for local idiom sign-off.
- **~16 new pathways** are buildable **today over existing generators** (5 blues + 8 jazz + 5
  metal), each passing the Primitive Test — roughly doubling blues/jazz/metal coverage with zero
  engine work. This is the concrete proof of the Width Doctrine: width comes from naming
  primitives, not new code.
- **The deferred pathways** all cluster onto the same few Wave 2 primitives
  (`buildCompingExercise`, the blues/country articulation builders) — confirming the
  shared-primitive leverage thesis.

**Recommended next action:** run this doc + `riff-archetypes.md` past the local idiom/harmony
agents for sign-off, then build the ~16 vetted pathways as a single content commit (no engine
risk), and schedule `buildCompingExercise` + `altBass` as the first Wave 2 primitive (it unblocks
the largest set of deferred pathways across blues/jazz/gospel/country/rock/pop).
