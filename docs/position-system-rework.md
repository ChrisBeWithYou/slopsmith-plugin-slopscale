# Position-System Rework Proposal

**Status:** Draft for user review. No code changes shipped yet.
**Companion doc:** [fretboard-pedagogy.md](./fretboard-pedagogy.md) — the *why*. This doc is the *what*.

---

## Problem (recap)

Today's SlopScale treats "position" as a fixed fret window:

```js
const POSITION_PRESETS = {
  open:  { fretMin: 0,  fretMax: 3  },
  '3rd': { fretMin: 3,  fretMax: 6  },
  // ...
};
```

That's pedagogically wrong. The user's feedback:

> "We should anchor off the root note on the 3rd fret of the 6th string / 1st string. Because this is labeled as the open position, the arpeggio fingerings should not go past the third fret… that note anchor on the 3rd fret of the A string should facilitate multiple scale shapes."

The user wants:
- Position chosen by **root anchor**, not fret number.
- One root anchor implies **multiple valid shapes** (open-position, CAGED, 3NPS, …).
- The fret window is **derived** from the chosen shape, not the input.

---

## Proposed model

### New config fields

| Field | Type | Replaces / adds | Notes |
| --- | --- | --- | --- |
| `fretboardSystem` | `'caged' \| 'bruno5' \| '3nps' \| 'open' \| 'fullNeck'` | Replaces existing `fretboardSystem` | "open" = open-position-favoring fingering for keys where it works; "fullNeck" = Gambale full-neck map (for visualization, not drilling). |
| `shape` | depends on system | Replaces `cagedShape` + introduces shape ID for non-CAGED systems | CAGED: `'C'\|'A'\|'G'\|'E'\|'D'`. Bruno5: `2\|3\|5\|6\|7`. 3NPS: `1\|2\|3\|4\|5\|6\|7`. |
| (removed) `position` | — | Old `'open'\|'3rd'\|'5th'\|…` dropdown | Gone. The user picks system + shape; fret window is derived. |
| (removed) `fretMin`/`fretMax` as user inputs | — | Still computed internally | They become outputs of `(key, system, shape)`, not inputs. Advanced users could still override with a "custom fret range" escape hatch — but it's no longer the default path. |

### Derivation function

```js
function fretWindowForShape(key, system, shape) {
  // Returns { fretMin, fretMax, rootPositions, allNotes }
  // where rootPositions is an array of {string, fret} for every root of `key`
  // inside the shape, and allNotes is every scale note inside the shape.
}
```

For Bruno5, this is a lookup table keyed by `(scaleDegreeOnLowE, key)`. For CAGED, it's the chord-shape root location plus the surrounding 4–5 fret scale box. For 3NPS, it's the strict 3-notes-per-string fingering anchored on the starting scale degree.

---

## UI changes

### Controls panel — Key section

Today:
```
Key      Scale       Position
[C  ▼]   [Ionian ▼]  [3rd position (3–6) ▼]
```

Proposed:
```
Key      Scale       Fretboard system    Shape
[C  ▼]   [Ionian ▼]  [Bruno 5-Shape ▼]   [Shape 5 (open) ▼]
```

The Shape dropdown is system-dependent:

| System | Shape dropdown contents |
| --- | --- |
| CAGED | C-shape, A-shape, G-shape, E-shape, D-shape — ordered low-to-high by where the shape sits in the current key |
| Bruno 5-Shape | Shape 5, Shape 6, Shape 7, Shape 2, Shape 3 — ordered low-to-high |
| 3NPS | Position 1 (Ionian), Position 2 (Dorian), … — ordered low-to-high |
| Open | (single option — uses open strings, fingering varies by key) |
| Full Neck | (no shape — full neck active) |

Each Shape option's label includes the fret range it produces in the current key, e.g. **"Shape 5 (frets 2–7)"**. This gives the user a quick read of where the hand will sit without removing the conceptual primary (the shape name).

### Status bar

`Ready — C major, Bruno Shape 5 (frets 2–7)` — names the system and shape, with fret range as parenthetical.

### Pathway behavior

Pathways pick a default `(system, shape)`. When the user changes Key, the pathway's chosen shape stays — the fret range moves to wherever that shape lives in the new key. (Today the dropdown silently rewrites `fretMin/fretMax` to the new preset — slightly different behavior.)

When the user explicitly changes Shape, the new fret window takes effect; the pathway is marked "modified."

---

## Generator changes

### `scalePositionsForSystem(cfg)`

Today walks the user's `fretMin..fretMax` looking for in-key notes. Proposed: drive entirely from `(key, system, shape)`, return exactly the notes that belong to that shape — including their string assignments (which Bruno-Shape pre-determines).

This is a real change of authority: today notes happen to fall in a window; tomorrow they're *the shape's notes by definition*.

### Arpeggio extraction (`chordTonePositionsInPosition` etc.)

Same idea. Given `(key, system, shape, chordRoot, quality)`:
1. Get the shape's full note set.
2. Filter to chord tones (1, b3, 5, b7 for m7; etc.).
3. Return them in scale order.

Half-step edges may leave gaps — that's fine. Don't pad with out-of-shape notes to hit a target count.

### `buildChordScaleExercise`

Today calls `chordScalePositions(cfg, rootPc, quality)` per chord with rectangular fret bounds. Proposed:
- For `chord_tone_emphasis` strategy: get the **parent key's scale positions in the active shape** once. Reuse for every chord. Mark chord tones per chord for accent emphasis.
- For `mode_of_moment` strategy (genuinely non-diatonic): recompute scale positions per chord, *but still restricted to the active shape's fret window* — meaning each chord's "mode" uses whatever notes fall inside the shape. This will sometimes produce sparse output, which is musically honest.

### Default strategies per progression

| Progression | Default strategy |
| --- | --- |
| `static_I` | n/a (no progression) |
| `I-IV-V`, `I-vi-IV-V`, `I-V-vi-IV`, etc. (all diatonic) | `chord_tone_emphasis` |
| `ii-V-I`, `I-vi-ii-V`, `vi-ii-V-I` (diatonic) | `chord_tone_emphasis` |
| `12_bar_blues`, `quick_change_blues` (dominant-heavy, mode shifts) | `mode_of_moment` (each chord = its Mixolydian) |
| `i-VI-III-VII`, `i-VII-VI-VII` (modal minor) | `chord_tone_emphasis` (in natural minor) |
| `minor_ii-V-i` | `chord_tone_emphasis` (in natural minor / Dorian for ii) |
| `circle_diatonic` (diatonic cycle) | `chord_tone_emphasis` |
| Future: non-diatonic cycles, chromatic mediants | `mode_of_moment` |

User can override.

---

## Specific pathway fixes

### Chord Tone Targeting (the pathway the user tested)

**Today:** `fretMin: 0, fretMax: 7`, strategy `chord_tone_emphasis`, but the wide fret range lets the arpeggio wander all the way to fret 7 (visible as the messy chord box on the highway).

**Proposed:**
- Replace `fretMin/fretMax` with `(system: 'bruno5', shape: 5)` as the pathway default.
- Strategy stays `chord_tone_emphasis`.
- Result: in C major, the line stays inside Shape 5 (frets 2–7) but specifically uses *the Shape-5 note set*, not "every C major note between 2 and 7." Same fret range, different set: the Shape-5 set has consistent 3-NPS fingering; the raw range can include awkward stretches.
- User can switch shape via the Shape dropdown to drill the same exercise in a different position.

### Modal Awareness

**Today:** `fretMin: 0, fretMax: 7`, `mode_of_moment`, diatonic progression. Same wide-range issue.

**Proposed:**
- Default to `(system: 'bruno5', shape: 5)` in C; let user move to other shapes.
- Strategy: actually this one *should* stay `mode_of_moment` since the pedagogy is "feel each mode's distinct color." Each chord's mode uses whatever notes fall inside the active shape.

### Diatonic Triad Drill, Seventh Vocabulary, ii-V-I Workout

Same treatment: pick a sensible default shape per pathway, derive fret window from shape.

### Pent Foundation, Blues Foundation, Major Pent Country, Dorian Groove

These already use sensible 4-fret ranges; they need light touch-up to convert `fretMin/fretMax` into shape selection, but the practice content stays the same.

### Sweep Primer

This one needs care — sweep arpeggios specifically target the **A-shape CAGED** geometry for triad sweeps and the **D-shape** for higher arpeggios. The system should be `'caged'` with explicit shape selection. Currently the pathway specifies `cagedShape: 'A'` which is close but not integrated with the fret-window logic.

---

## Highway integration

This rework is mostly UI/data-model. The note highway itself doesn't change. But two side benefits fall out:

1. **No more stray arpeggio overlay** — already shipped (handShapes cleared in `makeBundle`).
2. **Future static scale diagram** — once shapes are first-class, the diagram we tried to ship earlier can come back, this time rendering *a known shape's dots* (a real, recognizable fingering grid) rather than whatever notes happen to be in a fret range. This is the second half of what the user asked for in the original "static scale view above the note highway" request.

---

## Migration / backward-compat

- Saved presets and pathways have `fretMin/fretMax`. Map them at load time to the closest `(system, shape)` and keep the raw `fretMin/fretMax` as a fallback for custom-range advanced users.
- Add a "Custom fret range" escape hatch in Advanced mode for users who really want a non-shape window (e.g. for chromatic warmups across a wider zone).
- localStorage entries — leave the existing keys; introduce `slopscale.fretboardSystem` and `slopscale.shape` as new keys.

---

## Open questions before implementing

These came out of the source-material research and need user input before code changes:

1. **Default fretboard system for new pathways:** Bruno 5-Shape, CAGED, or 3NPS? My recommendation: **Bruno 5-Shape** as the SlopScale default, since (a) the existing pathways are jazz-leaning and Bruno's system is jazz-native, (b) Bruno shapes give 3-NPS fingering by default which works well for scale runs, and (c) chord-tone arpeggio extraction from a Bruno shape is the cleanest case.
2. **Naming the dropdown options:** "Shape 5" is opaque if you haven't read Bruno. Should we label it as **"Shape 5 / E-shape area (frets 2–7)"** to bridge Bruno's naming with CAGED-familiar players? Or keep it pure to the chosen system?
3. **3NPS shape naming convention:** Number them 1–7, or name them by mode (Ionian/Dorian/…)? I lean toward "Position 1 (Ionian)" — number primary, mode parenthetical — since the position number is what most rock/metal players actually use.
4. **The "Open" system:** Worth its own option, or just a special-case of CAGED's C-shape / Bruno's lowest shape per key? My take: small dedicated path for the actual open-string-rich playing that beginners do (campfire shapes, open-position pentatonic). It's a real pedagogical thing, not a special case.
5. **Pathway variation rotation:** Right now `Next variation` rotates `fretMin/fretMax`. Once shapes are first-class, should it rotate through shapes within the same key, through keys with the same shape, or both? I'd suggest the variations array becomes shape-specific (e.g. `[{shape: 5}, {shape: 6}, {shape: 7}]`) so "Next variation" cycles you through positions on the same exercise.

---

## Acceptance criteria for the rework

When this is shipped, the user should be able to:

1. Pick "Chord Tone Targeting" + key C + Bruno 5-Shape + Shape 5 → see a clean Gmaj7-arpeggio-style box on a 3-NPS Shape-5 fingering, anchored on the G (degree 5) on low-E fret 3, with notes only inside frets 2–7.
2. Change Shape to "Shape 6" → same exercise, hand jumps to frets 5–9, same diatonic chord tones, just in the next box up the neck.
3. Change Key to G → Shape 5 in G now sits at frets 9–14, the practice content adapts automatically.
4. Switch to CAGED system → Shape dropdown changes to C/A/G/E/D; picking E-shape in C major puts the hand around fret 7–11 area (E-shape root on 6th string fret 8 = C).
5. Switch to 3NPS → Shape dropdown shows 7 positions; picking Position 3 in C major sits the hand at frets 4–8 with strict 3-notes-per-string fingering.
6. No more confusion about what "open position" or "3rd position" means — it now says the shape name (e.g. "Bruno Shape 5") and shows the resulting fret range.

---

## What I'm NOT proposing

- **No change to the highway renderer.** It already takes events; the events just get smarter.
- **No new audio.** Same audio engine, same backing chords.
- **No change to the chord-preview thumbnail** that already renders from `chordTemplates`.
- **No reintroduction of the static scale diagram yet.** That's a follow-up after shapes are in.
- **No removal of pathways.** Same pathway list; they just pick shapes instead of fret windows.
