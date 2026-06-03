# Backing-Engine Round-Table — Synthesis & Spec (2026-06-03)

> A 34-agent design charette on the **chord-progression + backing-track + harmony/metric**
> engines: how to make generated backing better per-genre and more lifelike, and what the
> practice-tool USP is. Panel: harmony-theory (chair), rhythm-meter, sound-design,
> audio-engine, drum-pedagogy, market-analyst, learning-design, bass- & piano-pedagogy,
> plus 25 genre-idiom lanes (blues, jazz, funk, latin, country, rock, prog, pop, gospel,
> metal, reggae, folk, bluegrass, flamenco, classical, gypsy-jazz, city-pop, soul-motown,
> disco, afrobeat, new-orleans, tango, norteño, ragtime-stride, hip-hop-fusion). Four
> texture/lead-only lanes (shoegaze, surf, emo, punk) were held out of scope.
>
> **Status: DESIGNED — not built.** This is the spec + decision log. It supersedes nothing
> shipped; it gives the already-deferred "Playing-the-changes Stage 2" timeline its full
> motivation + a genre-validated primitive vocabulary, and adds the comp/bass/drum/voicing/
> feel layers that ride on it. See `ROADMAP.md` "Backing-Engine Rebuild" for build order.

---

## 1. The one-line diagnosis

**The harmony is right; the entire rhythm/texture layer is missing.** `COMMON_PROGRESSIONS`
(~40 keys) + the `voiceChord` voicing engine are genuinely good. But the backing has exactly
**two comp shapes** — one sustained, coalesced, voiced **pad per bar** (`buildBackingEvents`,
every style) and the **blues boogie** (`buildBoogieBacking`, blues only) — harmony is
**bar-locked** (one chord per measure), the backing **bass is just the pad's sustained root**,
**drums are 4 grooves** with a straight-backbeat default, and feel is **one global swing ratio**.
So every genre that isn't blues plays *a held chord over a rock backbeat*. That is the whole gap.

The fix is **not** 30 hand-written genre tracks. It is an engine rebuilt around **recombinable
primitives** (north star: *teach the grammar, not the sentences*) — the player learns a genre as
a nameable **combination** of (comp cell × bass figure × drum feel × voicing × feel), not a canned loop.

---

## 2. The USP (market-analyst, sharpened) — and the drift line

**USP, one sentence:** *the backing is a **teaching instrument wired to the drill and to the
fretboard mirror**, not an accompaniment.* The same engine generates the exercise **and** the
backing **and** lights the target chord/guide tones — nobody else closes that loop. iReal Pro
accompanies but never teaches the line over the changes; Band-in-a-Box is lifelike but
pedagogically inert; Chordify is song-locked; Rocksmith/Yousician bake backing into songs and
never expose the *grammar*. The empty intersection we own: **generative + skill-locked + mirrored**
backing, parameterized to a device, in any key, that visibly teaches the changes.

**The single true DIFFERENTIATOR:** voice-leading + harmonic rhythm **tied to the Jam mirror**.
Everything else on this page is, by the market lens, **table-stakes** ("unbreak the pad-per-bar so
genres we already teach don't sound broken") — necessary, not edge.

**The drift bright line** (this backing work is the **#1 off-mission magnet** — guard it):
> *Does the change make the player play **better**, or make the backing sound **better on its own**?*

| BUILD (reinforces practice) | CUT / GUARDRAIL (drifts to song-gen) |
|---|---|
| Voice-leading + harmonic rhythm the player hears and answers | Long sectioned **arrangements** (intro/verse/chorus/build) |
| Genre comp/bass/drum **feel** so the device transfers idiomatically | A "make me a backing track / jam" entry with **no drill attached** |
| Anything wired to the **mirror** (next-chord target highlight) | **Backing audio export** |
| Looping a **vamp / cycle** | Ear-candy **fills as decoration**, arrangement dynamics |

Jam stays a **mirror** — no score, and no "compose." A backing is a metronome with harmony.

---

## 3. Priority discipline (market + L&D): right thing, **right order**

- **NOW (justified — it *is* the proof-loop payload):** the **narrow** fix that unbreaks the
  **~9 genres we already teach** (blues, rock, metal, djent, jazz, funk, pop, country, gospel) —
  pad→idiomatic comp/bass/drums — **plus voice-leading-to-the-mirror**. This *is* the
  drill→Jam-over-the-same-skill story the proof loop needs.
- **DEFER (breadth ahead of proof):** 30+ palettes as a *count*, exhaustive per-genre realism,
  the exotic-meter lanes (clave/compás/polymeter). Breadth of styles we have no pathway for is
  feature-sprawl that widens the "make me a jam" surface without deepening a skill.
- **Proof metric:** a **skill-transfer proxy**, not "minutes jammed" — on the *same device*, do
  players move drill→Jam and **land more guide tones / fewer root-restarts at the chord seam**
  (already instrumented via the Connect seam) and **return to** richer-backing drills more than
  pad-backing ones. If richer backing doesn't lift seam-landing or return rate, it was polish.

**L&D learning-payoff ranking:** harmonic rhythm > voice-leading > comp grooves (rhythmic
placement) > basslines > drums > palette breadth (last). The **teaching unit is the comp cell**;
backing richness **is** the difficulty axis (easy = static vamp → mastery = full genre feel as a
Jam mirror).

---

## 4. The keystone: a beat-based **chord-event timeline**

**Unanimous** — harmony chair, rhythm-meter, L&D, blues, jazz, gospel all named it first; nothing
sounds idiomatic until it lands. This is exactly the deferred **Playing-the-changes Stage 2**
(`compileChordTimeline`/`enrichEvent`).

Replace the per-bar slot loop (`slot = measureSeconds`) with a beat-keyed event stream:

```js
chart.chordTimeline = [
  { beat:0,   durBeats:2,   root, quality, ... },        // ii  (2 beats — real ii–V in one bar)
  { beat:2,   durBeats:2,   root, quality, ... },        // V
  { beat:4,   durBeats:3.5, root, quality, push:0.5 },   // I, anticipated by an 8th
  ...
]
```

- `durBeats` → 2-per-bar ii–V, 4-bar pedals, stop-time gaps, the blues turnaround.
- `push` (beats) → **anticipation**: the change is pulled earlier than its harmonic slot — the
  single device that most humanizes a change. Near-universal (Latin tumbao, jazz comp, pop "&",
  gospel "& of 4").
- Engine-**generated** `PASSING`/`APPROACH` chords as a timeline op — **not** hand-authored tokens:
  `{ type:'approach', mode:'dim'|'chromatic'|'tritoneSub'|'dom7-of-next', placement:'&4' }`.
  Gospel's keystone; reused by jazz approach + the blues turnaround. (Spelling → harmony-theory.)
- **Bar-lock becomes the trivial case** (one event, `durBeats = measureBeats`) → nothing regresses.
- Beat onsets flow straight into `swungTime` / the per-block session assembly unchanged.

Everything below **reads** this timeline.

---

## 5. The primitive registries (the recombinable grammar)

Four registries + a voicing/feel layer. Genre = a thin **recipe** picking from them.

### 5a. `COMP_GROOVES` — comp-pattern cells (parallel to `DRUM_GROOVES`)

A `DRUM_GROOVES`-style token cell, but each hit also targets **harmony**. The fields
`DRUM_GROOVES` lacks (synthesized from every genre stress-test):

| Field | Values | Forced by |
|---|---|---|
| **per-hit `target`** | `chord · shell · guide · root5 · top · pedal · broken(arpeggiate)` | jazz shell, montuno `top`, metal `pedal`, funk scratch |
| **per-hit `artic`** | `stab · sus · ring · mute-chug · arpeggiate · roll/burst(rasgueado) · swell · pump(choke) · arrastre(drag)` | rock/metal chug, gospel swell, gypsy pump, flamenco roll, tango drag |
| **per-beat `slots`** | beat → `{role, artic, accent}` | **country (keystone)** — boom-chuck, Travis, stride, Motown all fall out of this |
| **`arpPattern: int[]`** | explicit note-ORDER into the sorted voicing | classical **Alberti** `[0,2,1,2]`, pop chime, folk Travis |
| **`accentMap`** | grid indices that hit harder | skank, scratch, compás |
| **`cellBars` / `cellBeats`** | cell length decoupled from the bar | Latin 2-bar clave, prog polymeter, flamenco 12-beat compás, afrobeat |
| **`compLanes[]`** | **≥2 concurrent comp lanes** | reggae (skank + organ bubble), bluegrass (chop + banjo roll), afrobeat (interlock A/B), disco (scratch + strings), funk (gtr + clav), Latin (montuno) |
| **`phaseOffset` / `startSlot`** (per lane) | rhythmic displacement | afrobeat **interlock** (B sits in A's holes) |
| **per-lane mute/dropout track** | bar on/off | reggae **dub** (subtraction) |
| **`couple` / `unison`** | one accent map → comp + bass + kick | **prog** band-stabs, **metal** comp==bass==kick lock |

> The **per-beat `slots`** mechanism and **`compLanes[]`** are the two highest-leverage net-new
> structures — between them they unlock the largest set of genres. `compLanes[]` is the biggest
> single architectural ask after the timeline; even shipping the **array shape** now (one lane
> populated) lets the second lane drop in later without a rewrite.

### 5b. `BASS_FIGURES` — recombinable backing-bass figures (share the timeline + `bassRootGrip`)

`sustained_root · two_feel (+ `connectBass` walk-up) · walking · octave_bounce · root_pump ·
one_pocket · reggae_hook · alternating_thumb (Travis) · tumbao (anticipated) · stride ·
tresillo (3-3-2 — **shared atom**: NOLA, tango, Latin, habanera) · bass_ostinato (boogie 8-to-bar) ·
afro_ostinato · 808_glide (slide artic) · motown_counter / busy_melodic`.

- **`motown_counter` / `busy_melodic` / `walking` are GENERATORS, not stored patterns** — a melodic
  line: root/chord-tone landings + diatonic/**chromatic approach** into the next root + ghost notes
  (`mt`) + anticipation. **Reuse the Connect machinery** (`nearestPositionForPc` / `connectStartIdx`)
  + a lookahead to the next chord + a ghost/anticipation rhythm template. (Note choice → bass-pedagogy.)
- **Realism rules (bass-pedagogy):** clamp to a real bass range, prefer the nearest grip (cap leaps
  ~a 6th), **lock the downbeat root to the kick**, and **drop the pad's folded root** whenever a real
  bass figure plays so they don't fight.

### 5c. `DRUM_GROOVES` — the genre groove library + schema extensions (drum-pedagogy)

- **New lanes:** `ride · hatPedal · rim · openHat-choke · palmas/cajón/golpe (percussion-not-kit) ·
  bell (role:'timeline' — fixed asymmetric, never realigns to downbeats)`.
- **New tokens:** `o` (open-hat choke), `f` (flam/drag), **per-lane `div` override** (double-kick /
  hat rolls under an 8th hat).
- **FILLS** — a `fill` bank + `fill.everyBars` (swap the last bar of a phrase). *Biggest realism
  payoff after the grooves themselves* — a fill-less loop over 30 min is the dead giveaway.
- **Groove set:** `jazz_swing` (swung ride spang-a-lang + hat-foot 2&4 + feathered kick), `reggae_one_drop`
  (kick+snare on beat 3 only, beat 1 empty), `funk_16th`, `metal_double_kick`, `bossa`/clave,
  `second_line`, `train_beat`, `gospel_pocket`, `four_on_floor` (+ the open-hat "&" sizzle).
- **`drums:none` / percussion-role comp** — bluegrass **mandolin chop carries time**; folk/classical/
  flamenco run with no kit (palmas/brushes only).
- **Humanization:** timing ±3–8 ms + velocity jitter, **kit-gated** (electronic 808/909 → ≈0, acoustic
  → ~0.6), **never** the count-in or a loop's first downbeat. Make it **deterministic / seeded** so
  charts stay golden-testable.

### 5d. Voicing + feel layer (harmony-theory, piano-pedagogy, rhythm-meter)

- **Voice-leading BETWEEN successive backing chords** — common-tone retention + nearest-motion (thread
  `prevVoicing`; reuse the Connect picker). *The single biggest "comper, not machine" win* and the
  named differentiator. **M.**
- **`voicingStyle`**: `tertian · quartal/So-What · shell · drop2 · rootless A/B · block(4-way close) ·
  open-drone`. (piano-pedagogy: rootless A/B is the jazz/soul/city-pop workhorse; let the bass track own the root.)
- **Inversions / slash bass** — a `bass` override on the chord event (`/3`, `/5`, pedal).
- **`chromatic_mediant`** timeline transform (root ±3/4 semis + quality shift) — city-pop, prog, film.
- **Independent contrapuntal bass voice** (moving bass under a sustained melody) — classical voice-independence.
- **Feel beyond one global swing:** **per-lane / per-recipe swing** + **swing-LOCK** (Latin must stay
  straight against a global swing) + **per-voice split** (jazz: swung ride, **straight** walking bass);
  **half-time / double-time** flag; **swung-16ths** (distinct from swung-8ths — hip-hop, city-pop);
  **triplet subdivision** feel (slow-blues 12/8, soul ballad, NOLA); **clave 2-3/3-2** + **tresillo 3-3-2**
  alignment; per-lane **micro-timing** (laid-back vs on-top, genre-owned values).

### 5e. The sound (audio-engine + sound-design) — lifelike is **gesture, not timbre**

- **audio-engine:** the realism gap is **gesture**. A per-hit **envelope / note-length layer on the
  existing WAF sampler** unlocks stabs / muted chucks / swells **from voices we already load — pure
  Web Audio, ZERO new assets.** New *sourcing* tasks are few: upright bass, clean comp guitar with a
  muted attack, horn stabs, nylon, clav, strings, brushes (WAF presets / multisamples), and the one
  genuine exception — the **distorted metal/djent comp via the borrowed host NAM amp + cab-IR chain**
  (in progress; never fake distortion with a GM patch).
- **sound-design:** **kill the sustained pad** (re-articulate) = the #1 band-vs-MIDI fix; then
  **velocity contour + downbeat accent** (S, cheapest believability), **register-carve + pan + one
  shared short reverb send** (turns a mono stack into a room *and* unmasks the practice notes). As
  density rises: **pre-limiter bus trim** (limiter is a safety net, ≤3–4 dB GR), watch **correlated
  transients** (kick+bass+stab on the same downbeat). Keep it normalized + safe (no clip, no surprise).

---

## 6. The palette refactor — `STYLE_PALETTES` from config-blobs to **recipes**

Decompose each palette into a thin **recipe** referencing the registries:

```js
salsa: { progressions:['montuno_II7_V7_I'], leadScales:[...],
         compLanes:['montuno_2bar'], bassFigure:'tumbao', drumGroove:'clave_son_2_3',
         voicingStyle:'tertian', harmonicRhythm:'2/bar', feel:{ swing:'locked-straight', claveDir:'2-3' },
         audioProfile:'latin' }
```

Adding a genre = **pick ~5 primitives + name it, zero new code.** Extend the startup integrity guard
(mirrors the no-unison + style-palette guards) to assert every referenced primitive exists, so the
shared table can't silently rot. This is the same *browse/pick/refresh = three reads of one object*
insight from the segment library — and it makes **genre breadth a data task gated behind proof +
genre-agent vetting**, not an engine task.

---

## 7. Recommended build order (chair + rhythm-meter + L&D + market aligned)

1. **Beat-based chord-event timeline** (§4) — **L**, the keystone; bar-lock = trivial case. (= Playing-changes Stage 2.)
2. **Voice-leading between backing chords** (§5d) — **M** — the differentiator; rides the timeline; instant lifelike gain.
3. **`COMP_GROOVES` cell engine** (§5a) for the **~9 taught genres** — **L** — per-beat slots + per-hit
   target/artic (stab/sus/ring/mute-chug/arpeggiate) + **re-articulation** (kills the pad). Audio-engine's
   per-hit **envelope layer** (S, zero assets) + sound-design's velocity contour land here.
4. **`BASS_FIGURES`** (§5b) — **M** — incl. the generated melodic lines (reuse Connect) + `connectBass` walk-up.
5. **Genre `DRUM_GROOVES` + new lanes (ride/rim/openHat) + fills + humanization** (§5c) — **M**.
6. **Palette refactor to recipes-over-primitives** (§6) — **M** — then scale the taught + proven genres as data.
7. **Mix realism** (§5e: register-carve + pan + shared reverb + pre-limiter trim) — **M** — can run alongside #3.
8. **Breadth/exotic tier (DEFERRED behind proof):** `compLanes[]` multi-lane (reggae bubble, afrobeat
   interlock, bluegrass roll, disco strings), `cellBars`/`cellBeats` multi-bar + polymeter (Latin clave,
   flamenco compás, prog unison), the new articulations (pump/roll/arrastre/808-glide), the
   passing-chord generator, quartal/drop2/arpeggiate-note-order, half/double-time + swung-16th + triplet feels.

---

## 8. Per-genre signature → primitive map (the "various genres" answer)

What each lane named as its **#1 signature** and the **net-new primitive** it forced. (Taught-genre
rows are NOW work; the rest seed the deferred breadth tier + size the vocabulary.)

| Genre | #1 signature | Net-new primitive it forced |
|---|---|---|
| **Blues** | slow-blues **12/8 triplet** comp + the **turnaround** (bars 11–12) | triplet-subdivision feel; sub-bar turnaround (needs timeline) |
| **Jazz** | swung **walking bass + ride spang-a-lang** + sparse Charleston comp | 2-chords/bar; **per-voice swing** (swung ride / straight bass) |
| **Funk** | **16th scratch** (ghost chuck + accented stab on *the one*) + locked 16th bass | `mute-chug` artic + 16th ghost web; one-pocket bass |
| **Rock** | power-chord **8ths, chug-vs-ring** dynamic, backbeat lock | **per-hit `mute`/`stab`/`ring` artic** (the one field a pad can't do) |
| **Metal** | palm-muted **gallop chug (3+3+2)** on a double-kick | `pedal` target + `mute-chug`; **`couple:[bass,kick]`** unison; per-lane div double-kick |
| **Country** | **boom-chuck** (bass 1&3 / chuck 2&4) + train-beat | **per-beat comp `slots`** (the keystone); `connectBass` walk-up; per-recipe swing |
| **Pop** | syncopated muted strum + the **"&"-push**; dance four-on-floor | **`ARPEGGIATE`** primitive; sparseness (legal rest steps); anticipation |
| **Gospel** | keys comp riding a **chromatic passing-chord walk-up** | **generated `PASSING`/`APPROACH` chords** on the timeline; `swell` artic |
| **Reggae** | offbeat **skank** + **one-drop** + melodic bass | **`compLanes[]`** (skank + organ bubble); per-lane dropout (dub) |
| **Latin** | **montuno + tumbao over son clave 2-3** | **`cellBars:2`** + `claveDir` + hit-level `tie`/anticipation; swing-lock |
| **Folk** | alternating-thumb **Travis** + open-tuning drone | `alternating_thumb` bass; **`drone` lane**; drums-off default |
| **Bluegrass** | **mandolin chop on 2&4 (no kit)** + banjo roll + two-feel | `drums:none`/percussion-role comp; **concurrent chop + roll lanes** |
| **Flamenco** | the **12-beat compás** + rasgueado + palmas | 12-beat accent cycle; **`rasgueado-roll`/burst artic**; palmas/golpe percussion |
| **Classical** | **Alberti** broken-chord, no drums | **`arpPattern: int[]`** (note ORDER); independent contrapuntal bass |
| **Gypsy-jazz** | **la pompe** (down-up pump + choke) | **`pump`** artic (paired struck+ghost + LH choke) |
| **City-pop** | lush maj9/13 + chromatic-mediant + 16th-scratch + busy bass | `chromatic_mediant` transform; `busy_melodic` bass |
| **Soul/Motown** | the **melodic counter-line bass** | `motown_counter` as a **generator**; 12/8 triplet feel |
| **Disco** | **octave bass** + 16th scratch + string stabs + open-hat "&" | `octave_bounce`; string-stab as 2nd lane; open-hat choke slot |
| **Afrobeat** | the **interlock** (two 2-bar guitars) + ostinato + bell | per-lane **`phaseOffset`**; **bell** as a `role:'timeline'` non-backbeat |
| **New Orleans** | rhumba-boogie **tresillo (3-3-2)** LH + second-line | **`tresillo`** shared bass+accent atom; second-line "big four" |
| **Tango** | **marcato + 3-3-2 + arrastre** | **`arrastre`** drag artic (pre-beat crescendo glide into the downbeat) |
| **Norteño** | polka **oom-pah** (offbeat bajo chuck) | offbeat chuck placement; `rasgueo` vihuela burst |
| **Ragtime/stride** | **stride LH** (bass 1&3 / chord leap 2&4); boogie 8-to-bar | per-beat slots (bass↔chord); `bass_ostinato` figure |
| **Hip-hop-fusion** | **half-time 808** + swung-16ths + lush comp | **`808_glide`** (slide artic); `feel:halftime`; swung-16ths |

**The vocabulary collapses cleanly:** ~25 genres reduce to **per-beat slots + `compLanes[]` +
multi-bar cells + ~6 new articulations (`mute-chug`, `arpeggiate`, `swell`, `pump`, `roll`,
`arrastre`) + the `tresillo` atom + generated melodic/passing lines + per-lane swing/feel flags.**
The breadth is data on top of a small orthogonal field-set — which is exactly the north-star payoff:
the player learns a **finite grammar** that recombines, not 25 memorized tracks.

---

## 9. Decision log

1. **The fix is a primitive-driven engine, not 30 canned palettes.** (north star; market drift line)
2. **Keystone = the beat-based chord-event timeline** (= Playing-changes Stage 2). Build first.
3. **The only true differentiator = voice-leading + harmonic rhythm wired to the Jam mirror.** Build #2.
4. **NOW = unbreak the ~9 already-taught genres + the differentiator** (the proof-loop payload).
   **DEFER = palette breadth + the exotic-meter lanes** (clave/compás/polymeter/interlock) behind proof.
5. **Lifelike = gesture, not timbre** — re-articulate the pad via a per-hit envelope layer (zero assets);
   new instrument voices + NAM distorted comp are a smaller, later sourcing task.
6. **`STYLE_PALETTES` become thin recipes** over registries; a startup guard keeps them honest.
7. **Drift guardrails are hard rules:** loop a vamp not a song; no arrangement sections; no backing
   export; no "make me a jam" entry without a drill; Jam stays a mirror.
8. **Proof before breadth:** instrument the seam-landing / return-rate metric; let it gate the breadth tier.

**Handoffs into build:** harmony-theory owns the timeline schema, voice-leading rule, voicingStyle, and
the passing-chord spelling; rhythm-meter owns the comp-cell/feel engine + multi-bar cells + humanization;
drum-pedagogy owns the groove library + fills; bass- & piano-pedagogy verify bass figures + keys voicings;
audio-engine owns the envelope layer + new voices; sound-design owns the mix + safe output; each genre
agent authors its own recipe + cells when its tier is built.
