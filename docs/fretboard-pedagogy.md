# Fretboard Pedagogy

This document is the authoritative reference for how SlopScale should think about positions, shapes, scales, and arpeggios on the guitar. It exists because "position" was originally implemented as a fixed fret window (e.g. "5th position = frets 5–9"), which is **wrong** — a position is a root-note anchor that implies multiple valid scale shapes around it.

Every position/shape decision in SlopScale should be traceable back to a principle in this doc. If it isn't, we're making it up.

Sources synthesized: Jimmy Bruno Guitar Institute (5-Shape system, arpeggio extraction, ii-V-I / I-vi-ii-V line creation), Frank Gambale (Modes: No More Mysteries, full-neck modal maps), Barrett Tagliarino (Fretboard Workbook, CAGED), Joe Pass (chord vocabulary, string-group voicings).

---

## The two big ideas

### 1. A position is a root-note anchor, not a fret window

When a player says "C major in 5th position," they don't mean "any C major notes between frets 5 and 9." They mean **"my index finger is anchored around the 5th fret, and I'm fingering a specific shape of C major that sits around that root."**

The fret window FOLLOWS from the root anchor and the chosen shape. Two shapes with the same root anchor will occupy different fret windows.

This is the fix for SlopScale's current bug: the Position dropdown drove `fretMin`/`fretMax` directly, treating position as a fret window. It should drive a *root-anchor + shape choice* instead, and the fret window emerges from those two.

### 2. Multiple shapes share each root anchor

For C major with the root on the 3rd fret of the 6th string (G... wait — C root on the 6th string is fret 8, not 3. Let me restate):

For C major with the root on the **3rd fret of the 5th string** (a low C), the player has *at least three* canonical fingering choices:

| Shape | Fret window | Style |
| --- | --- | --- |
| **Open / 1st position** | 0–3 | Mixes open strings with fretted notes; uses C natural minor fingering convention. Good for folk/rock vocabulary. |
| **C-shape CAGED scale** | 2–5 | Hand sits across frets 2–5, root on 5th string fret 3. Classic "low Position 1" scale shape. |
| **3-notes-per-string starting on 5th string fret 3** | 3–8 | Index at fret 3, spans up to fret 8 across all 6 strings. 18 notes total. Standard rock/fusion shape. |

These are all **C major in the same key** anchored on the **same root note** — but they imply different fret windows and different fingerings. SlopScale should expose all three (or however many the chosen system defines).

This is why the user's feedback was: *"that note anchor on the 3rd fret of the A string should facilitate multiple scale shapes"* — yes, exactly.

---

## The major fretboard systems

There are three serious systems in circulation. SlopScale should support them as user-selectable options, not pick one. Each is internally consistent; mixing them in the same exercise tends to confuse beginners.

### System A — CAGED

**Premise:** The 5 open-position chord shapes (C, A, G, E, D) can be barred and shifted up the neck to play any major chord. The scale that fits *around* each shifted chord shape becomes a 5-fret scale box.

**Shapes:** C, A, G, E, D — named after the open chord they derive from. The hand position is wherever the shape's root sits.

**Span:** Each shape spans roughly 4–5 frets. The 5 shapes tile the neck — there is no fret on the neck not covered by at least one CAGED shape.

**Why 5, not 7?** There are only 5 unique chord shapes available in open position (C, A, G, E, D — the others like B and F overlap with these as bar variants). The "missing" two scale shapes are absorbed by adjacent ones because of the half-steps in the major scale (3→4 and 7→1).

**Best for:** Linking scales to chord shapes. A player who knows "this is the A-shape position" has both a chord they can comp and a scale they can solo over, anchored on the same root.

### System B — Bruno 5-Shape

**Premise:** Same idea as CAGED (5 overlapping major-scale boxes tile the neck), but renamed by the scale degree on the low E string and fingered as **3-notes-per-string wherever possible**.

**Shapes:** 2, 3, 5, 6, 7 — named after the scale degree of the lowest note on the 6th string. No "Shape 1" or "Shape 4" because the half-step gaps in the scale (B→C and E→F) cause the would-be 1 and 4 shapes to collapse into adjacent shapes (same collapse logic as CAGED).

**Cyclic ordering:** Shapes always appear on the neck in the order **5 → 6 → 7 → 2 → 3 → (back to 5)** as you climb up. The starting shape (lowest on the neck) depends on the key:

| Key | Lowest shape | Lowest shape starts at low-E fret |
| --- | --- | --- |
| C | Shape 5 | 3 |
| F | Shape 2 | 3 |
| Bb | Shape 6 | 3 |
| Eb | Shape 3 | 3 |
| Ab | Shape 7 | 3 |
| Db / C# | Shape 3 | 1 |
| Gb / F# | Shape 7 | 1 |
| B | Shape 5 | 2 |
| E | Shape 2 | 2 |
| A | Shape 6 | 2 |
| D | Shape 3 | 2 |
| G | Shape 7 | 2 |

So "Shape 5 in C" sits at frets 2–7; "Shape 5 in G" sits at frets 9–14. Shape numbers are **portable across keys** — they describe the shape's *interval relationship to the root*, not its absolute fret.

**Span:** Each Bruno shape spans 4–6 frets and uses 3 notes per string on most strings (occasional 2-NPS strings where the fingering is more comfortable).

**Best for:** Players who want a tight, modern, 3NPS-friendly fingering vocabulary without committing to strict 3NPS pedagogy. Especially good for jazz/fusion because chord-tone arpeggios extract cleanly from each shape (see "Arpeggio extraction" below).

### System C — Three Notes Per String (3NPS)

**Premise:** Every string gets exactly 3 notes. The 7-note major scale fits in 6 strings × 3 notes = 18 notes per shape. There are **7 distinct 3NPS shapes** — one starting on each scale degree on the low E string.

**Shapes:** Numbered 1 through 7 by the scale degree the shape starts on (low E). Unlike Bruno's 5-shape system, 3NPS keeps all 7 because the strict-3NPS constraint prevents the half-step collapse.

**Span:** Each 3NPS shape spans 5–6 frets. Shapes share considerable overlap with each other.

**Best for:** Speed players, alternate picking, modal soloing, rock/metal. The uniform fingering (3 notes per string, always) makes sequences (fours, sixes, thirds) much easier to pattern across strings.

### Three systems — same scale, different framings

For any given key, all three systems describe the *same* notes on the *same* neck. They differ only in how the player's hand is asked to organize those notes. The user's choice between them is a fingering preference, not a music-theory difference.

**Implication for SlopScale:** the fretboard-system selector is real and load-bearing. Picking CAGED vs Bruno vs 3NPS for the same key+scale produces different exercises with different fret windows and different fingerings.

### Gambale's full-neck map (not a 4th system)

Frank Gambale's *Modes: No More Mysteries* shows each mode as a single full-neck diagram with every scale note labeled by scale degree (1, 2, 3, etc.). This is **not a competing position system** — it's a different *view* of the same fretboard. The position systems are partitions of this map.

SlopScale should support both views:
- **Position view** — one shape highlighted at a time (CAGED / Bruno / 3NPS).
- **Full-neck view** — every scale note across the whole neck, labeled by degree. Useful for understanding before drilling.

---

## How arpeggios live inside shapes

A key Bruno insight (Lesson 12 of his Improv Revealed Level 1): an arpeggio is *the chord tones of a scale, restricted to one shape's fret window.*

For the D-7 arpeggio (D, F, A, C) in C major, played inside Shape 5 (frets 2–7):

- 6th string: A at fret 5
- 5th string: C at fret 3, D at fret 5
- 4th string: F at fret 3, A at fret 7 (the 7 is at the high edge of the shape)
- 3rd string: A at fret 2, C at fret 5
- 2nd string: D at fret 3, F at fret 6
- 1st string: A at fret 5

The same Dm7 arpeggio in Shape 6 (frets 5–8) uses different notes — same chord tones, but different octaves and string locations, fingered with the Shape-6 hand position.

**Implication for SlopScale's arpeggio generator:**
- Take the chord tones (1, 3, 5, 7 — with quality modifiers like b3 for minor).
- Restrict to notes inside the chosen shape's fret window.
- Render those notes in scale order, ascending then descending.

The current SlopScale `chordTonePositionsInPosition` does something close to this but driven by a rectangular `fretMin`/`fretMax`. Once shapes anchor on a root, it should restrict to shape membership instead.

**Half-step arpeggio collapse:** Like scale shapes, some arpeggios in some shapes occupy *fewer* notes than others because the chord tones happen to be on the half-step edges. This is fine — the arpeggio is what it is. Don't force a minimum note count.

---

## How lines are built over chord progressions

This is the most important section for SlopScale, because the current "Chord Tone Targeting" pathway gets this wrong.

### Diatonic progressions: parent scale + chord-tone emphasis

When all chords come from one key (a I-vi-ii-V or ii-V-I in C major: Cmaj7, A-7, D-7, G7), Bruno's lessons (#23, #32, etc.) show that **the line stays in the parent C major scale the whole time**. The shape stays put for several bars. The change as the chord moves is *which notes get emphasized as targets*, not *which scale is being used*.

A line over Cmaj7 → A-7 → D-7 → G7 in Shape 5 might use the same 18 notes of C major throughout, but land on:
- C, E, G, B (Cmaj7 chord tones) during the Cmaj7 bar
- A, C, E, G (A-7 chord tones) during the A-7 bar
- D, F, A, C (D-7 chord tones) during the D-7 bar
- G, B, D, F (G7 chord tones) during the G7 bar

This is the **chord-tone-targeting strategy**, and it's the right default for diatonic progressions.

### Mode-of-the-moment: only for non-diatonic / modal cycles

The "mode of the moment" approach — where the scale changes per chord — is appropriate for **non-diatonic** chord sequences (e.g. all-dom7 cycles, secondary dominants, modal-jazz tunes that move between key centers).

Example: a four-bar cycle of D7 → G7 → C7 → F7 isn't diatonic to one key. Each chord wants its own Mixolydian. Mode-of-the-moment fits.

But for ii-V-I in C, mode-of-the-moment is wrong: D Dorian, G Mixolydian, and C Ionian are *the same notes*. Forcing the player to "switch modes" on each chord just confuses them when the only thing actually changing is which note to land on.

**Implication for SlopScale:**
- For diatonic progressions: use `chord_tone_emphasis` by default. Stay in parent scale, accent chord tones.
- For non-diatonic progressions: `mode_of_moment` is correct.
- The current "Chord Tone Targeting" pathway should use `chord_tone_emphasis`, anchor on a single shape, and stay there.

### Shifting between shapes

Bruno shows explicit "Shifting" exercises (Lesson 23, bars 49–52) that climb up the neck through adjacent shapes — Shape 5 → Shape 6 → Shape 7 etc. — as a separate drill, not as the default mode of playing.

A good practice progression:
1. Build vocabulary in **one shape**.
2. Once comfortable, transpose the same line to a **different shape, same key**.
3. Once comfortable, **shift between two adjacent shapes** within one phrase.

SlopScale should expose this as a position-handling option: "stay in one shape" (default) vs. "shift through adjacent shapes" (advanced).

---

## String groups (for chord work, not single-note runs)

String groups are a chord-voicing concept, not a single-note scale concept. The string group `6-4-3-2` means "play a four-voice chord using the 6th, 4th, 3rd, and 2nd strings, skipping the 5th." Different string groups produce different chord-voicing textures:

| String group | Voicing character |
| --- | --- |
| 6-5-4-3 | Bass-heavy, big sound |
| 5-4-3-2 | Mid-register, "Freddie Green" comping range |
| 4-3-2-1 | High-register, chord-melody friendly |
| 6-4-3-2 | Skips the 5th — opens up the mid for vocal/melody |
| 5-3-2-1 | Skips the 4th — bright voicing |

For jazz comping, the same chord (e.g. Dmaj7) can be voiced on any of these groups, and the player chooses based on what register they want and what string the melody/bass needs.

**Implication for SlopScale:** string-group selectors only make sense in the **chord/comping** path, not the scale/arpeggio path. Keep them separate in the UI.

---

## Mapping to SlopScale's data model

Translating the above into concrete code-design decisions:

### `Position` is wrong. Use `Anchor` + `Shape`.

Current SlopScale model:
```
position: 'open' | '3rd' | '5th' | '7th' | '9th' | '12th'
→ fretMin/fretMax window
```

Proposed model:
```
fretboardSystem: 'caged' | 'bruno5' | '3nps' | 'open' | 'fullNeck'
shape: depends on system (C/A/G/E/D for CAGED; 2/3/5/6/7 for Bruno; 1-7 for 3NPS)
key: NoteName
rootAnchorString: 5 | 6  (which string the root sits on for this shape)
```

The fret window is **derived** from `(key, fretboardSystem, shape, rootAnchorString)`, not user-specified.

Example resolution:
- `(C major, Bruno5, Shape 5)` → low-E root anchor on G (degree 5) at fret 3 → fret window 2–7.
- `(C major, Bruno5, Shape 6)` → low-E root anchor on A (degree 6) at fret 5 → fret window 5–9.
- `(G major, Bruno5, Shape 5)` → low-E root anchor on D at fret 10 → fret window 9–14.

### Shape ordering on the neck

For any (key, system), there is a deterministic ordering of shapes from low-fret to high-fret. SlopScale should be able to:
1. List the shapes in that order.
2. Pick "the lowest shape" by default (the user said *"open position"* for C major, which means the lowest available shape — for Bruno5 in C that's Shape 5).
3. Move to the next shape (or previous) on user request.

### "Open position" is system-dependent

"Open position in C major" means different things depending on the system:
- CAGED: the C-shape, hand at frets 0–3, uses open strings.
- Bruno5: Shape 5, hand at frets 2–7 (doesn't use open strings — Bruno5 is fingered-only).
- 3NPS: Shape 3 (lowest), hand at frets 0–4 (uses open strings).

The dropdown should not say "Open position (0–3)" generically. It should say something like "Lowest shape" or, better, name the actual shape ("C-shape" / "Shape 5" / "3NPS Position 3") based on the selected system.

### Arpeggios live inside shapes

A `diatonic_arpeggios` exercise needs:
1. A scale (e.g., C major).
2. A shape inside that scale (e.g., Bruno Shape 5, fret window 2–7).
3. A chord quality per scale degree (e.g., triads or 7ths).

For each diatonic chord, take its chord tones and intersect with the shape's note set. Render those notes in scale order.

### Mode of the moment vs. chord-tone emphasis

The `chordScaleStrategy` field should default based on whether the progression is diatonic:
- `progression == 'diatonic'`, `I-IV-V`, `ii-V-I`, `I-vi-ii-V` (within one key) → `chord_tone_emphasis`.
- `progression == '12_bar_blues'` (each chord is a dom7, not strictly diatonic) → `mode_of_moment` (each chord gets its own Mixolydian).
- Modal cycles and circle-of-fourths chains → `mode_of_moment`.

---

## What this means for the immediate SlopScale rework

(The actual rework lives in a separate proposal doc — see [position-system-rework.md](./position-system-rework.md) once written. This section is just the punch list.)

1. Replace `POSITION_PRESETS` (fret windows) with a shape-aware system.
2. Make the fretboard-system selector primary, the shape selector secondary (depends on system).
3. Derive `fretMin`/`fretMax` from `(key, system, shape)` rather than reading from a dropdown.
4. Default the Chord Tone Targeting pathway to `chord_tone_emphasis` strategy with a single shape anchor (the user's request from 2026-05-26).
5. Eventually: add the static scale-diagram panel back, this time driven by the *actual current shape* rather than a raw fret range — it will show 5 dots in a recognizable shape, not a scattered grid.

---

## Open questions to revisit with the user

1. **Which system as default for beginners?** Bruno5 is most coherent for the existing jazz-leaning pathways; CAGED is more universal. The skill brief recommends "single position / basic CAGED" for beginners.
2. **How to expose shape choice in the UI?** A scrolling row of 5 shape buttons? A dropdown? A neck minimap with the active shape highlighted?
3. **Open-string handling.** Bruno5 doesn't use open strings; CAGED's C-shape and 3NPS's lowest positions do. Should SlopScale offer an "include open strings when available" toggle?
4. **Position-shift exercises.** Should "shift between adjacent shapes" be its own practice type, or a modifier on existing types?
5. **3NPS shape naming.** The 3NPS shapes are also sometimes called "modes" (Position 1 = Ionian, Position 2 = Dorian, etc.) because each shape starts on a different scale degree. This is a useful coincidence but can confuse beginners. Should we name 3NPS shapes by number (1–7) or by mode (Ionian/Dorian/…)?
