# Musicality Guardrails

> Spec (2026-05-29). How SlopScale keeps everything it **generates or ships**
> sounding good, not merely technically accurate. Fully-custom users may court
> dissonance on purpose — that's their choice — but presets, backing, and the
> random generator must prioritise *pleasing* output while staying harmonically
> correct.
>
> Principle: **accuracy and pleasingness are not in conflict — they're resolved at
> different layers.** A chord's *identity* stays accurate (the iii really does
> contain a ♭9 diatonically); its *voicing* is what makes it sound good (put the ♭9
> up top, or omit it in a pad). Don't dumb down the harmony — voice it well.

## Layered model

| Layer | Concern | Status |
|------|---------|--------|
| 1 | Progression-level coherence (what chords, in what order) | Curation ✅ · random-gen rules planned |
| 2 | **Chord voicing** (which tones, what register) | **THIS BUILD** |
| 3 | Emphasis/landing-note safety (avoid notes on accents) | partial (chord-tone-emphasis); future |
| 4 | Random generator guardrails (designed-in, not bolted-on) | planned, with Phase C |

---

## Layer 1 — Progression coherence

**Presets:** curation is the rule. Everything in `COMMON_PROGRESSIONS`, `PATHWAYS`,
`BUILT_IN_SESSIONS` is an established progression. The chromatic token presets
(tritone sub, backdoor, Tadd Dameron) are canonical jazz turnarounds. New presets
must be real progressions or pass the sanity checklist below.

**Sanity checklist (authored or generated):**
- Starts on a stable chord (I / i / vi) and **resolves** (ends on tonic or the
  style's cadence).
- Root motion is predominantly *strong*: down a 5th / up a 4th, or stepwise.
  Random leaps between unrelated roots are penalised.
- Chromatic chords appear only in a **functional role** — secondary dominant,
  tritone sub, or passing diminished — never floating.
- No two unrelated chromatic chords back-to-back unless part of a known sequence
  (e.g. descending dominants).

**Already in place:** `MODE_FOR_QUALITY` picks chord-scales that dodge the
avoid-note a half-step above a chord tone (maj7→Lydian, dom7→Lydian dominant,
m7♭5→Locrian ♮2). That's a Layer-1/3 guardrail for what the player *solos* with.

---

## Layer 2 — Chord voicing engine  (this build)

### Problem
Today chord tones are *spelled* (each pitch class dropped onto its lowest fret),
not *voiced*. For dense extended chords this risks: the natural-11-against-the-3rd
♭9 clash, low muddy intervals, and altered tensions (♭9/♭13) sitting in a register
where they clang. The backing pad's crude "first 4 tones, folded into one octave"
is the only current guard.

### Scope
The engine governs **block / backing contexts** (the harmony pad, and any future
block-chord display). **Arpeggios are out of scope** — sweeping through every chord
tone in sequence is inherently musical; the avoid-note only bites when a tone
*lands or sustains* (that's Layer 3). First consumer: `voiceBackingChord`.

### `voiceChord(rootPc, intervals, opts) → sorted MIDI[]`

`opts = { instrument, maxVoices = 4, bassLow, bassHigh, upperLow, upperHigh, prev }`

**Step 1 — classify each interval (mod 12) into a role.** Context rules resolve
ambiguity:
- `0` root · `3` minor-3rd (→ **♯9** if a major 3rd is also present) · `4` major-3rd
- `5` **11th** (perfect 4th) · `6` **♯11** if a perfect 5th is present, else **♭5**
- `7` perfect-5th · `8` **♭13** if a perfect 5th is present, else **♯5**
- `9` **13th** (→ **dim7** if the chord has a ♭5 and a minor 3rd and no other 7th)
- `10` minor-7th · `11` major-7th · `1` ♭9 · `2` 9

**Step 2 — select tones to keep (musicality rules), in priority order, capped to
`maxVoices`:**
1. **Guide tones are mandatory:** the 3rd (m3/M3) and the 7th (any). They define
   the quality. If there's no 7th (triad / 6 chords), the 5th becomes mandatory
   instead so the triad is complete.
2. **Avoid-note rule:** **drop the natural 11 (interval 5) when a major 3rd is
   present** (the ♭9 clash — this is why a "dom11" sounds like a 9sus). **Keep** the
   11 on minor chords (the consonant m11 sound). ♯11 (6) is always kept — it's a
   colour, no clash.
3. **Altered 5th (♭5 / ♯5) is high priority** — a defining colour, never dropped
   for a plain 5th.
4. **One top colour tone:** the highest available tension (13 > 9 > ♯11).
5. **Plain perfect 5th is the first filler dropped** when over `maxVoices` — it adds
   least. (Keep it only if voices remain.)
6. **Root** is kept for the bass voice; upper structure may be rootless when a bass
   is present (jazz comping convention) — but the default pad keeps the root low.

   Worked examples (maxVoices 4, pad):
   - `Cmaj13` → root, M3, maj7, **13** (drop 11 by avoid-rule, drop 9 & 5 by cap) → C E B A
   - `C13` (dom) → root, M3, ♭7, **13** → C E B♭ A   (11 dropped by avoid-rule)
   - `Cm11` → root, m3, ♭7, **11** (kept — consonant on minor) → C E♭ B♭ F
   - `C7` → root, M3, ♭7, 5 (no tensions; 5th fills the 4th voice) → C E G B♭
   - `C5` (power) → root, 5 (no 3rd/7th to force) → C G

**Step 3 — octave placement:**
- **Bass** = root, folded into `[bassLow, bassHigh]` (guitar pad ≈ 36–48, bass
  instrument ≈ 23–38).
- **Upper voices** stacked **ascending** from a cursor: each kept non-root tone is
  placed at the lowest MIDI ≥ cursor matching its pitch class, then the cursor
  advances by at least **`minGap`** (3 semitones) while it's in the low region
  (< ~MIDI 52) so no muddy low clusters form. Tensions are placed **last**, so they
  naturally land on **top** — exactly where 9/11/13 sound sweet.
- Clamp the upper structure to `[upperLow, upperHigh]` (≈ 48–76 guitar).

**Step 4 — voice leading (tiebreaker, optional v1):** if `prev` (previous chord's
voicing) is supplied, prefer octave choices for the upper voices that minimise total
motion from `prev`. v1 may stub this; the ascending-compact placement already keeps
motion modest.

### What this fixes
- No more 3rd-vs-natural-11 clash in major/dominant chords.
- Tensions sit on top, not buried low.
- No muddy low intervals.
- The pad plays a real shell-plus-colour voicing (R + guide tones + top tension)
  instead of root+3+5+7 — sounds like a comping voicing, not a block.
- Chord identity unchanged → still accurate, now pleasing.

### Non-goals (this build)
- Fretboard chord *shapes* (CAGED templates / `templateFromPositions`) — those are
  playability-driven and shown as-written; not re-voiced here.
- Arpeggio tone selection (Layer 3).

---

## Layer 3 — Emphasis / landing-note safety  (future)
When a generator **accents, lands, or sustains** a note over a chord, prefer chord
tones or safe tensions over avoid notes. `chord_tone_emphasis` already accents chord
tones; extend the rule to arpeggio landings and sustained scale tones so the harsh
diatonic avoid-notes (the iii's ♭9, the I/IV natural 11) pass rather than ring.

---

## Layer 4 — Random generator guardrails  (with Phase C)
Built **into** `STYLE_GRAMMARS`, not added afterward:
- Per-style **weighted transition tables** — no aimless random walks.
- **Mandatory resolution** — the walk must end on the style's cadence (tonic).
- **Root-motion weighting** — strong moves (down-5th/up-4th, stepwise) favoured;
  weak/aimless leaps penalised.
- **Chromatic chords only in functional roles** (secondary dominant / tritone sub /
  passing dim); never floating.
- **Taste filter** — reject and re-roll candidate progressions that violate the
  Layer-1 checklist.
- Generated chords are voiced through the **Layer-2 engine** for the preview/backing.

---

## Verification standard
- Layer 2: a pure-function harness asserting tone selection (avoid-11 dropped on
  major/dom, kept on minor; tensions on top; guide tones always present) and
  low-cluster avoidance, plus a live smoke that the backing path builds with no
  errors. Audible check by ear is the final gate for the pad.
