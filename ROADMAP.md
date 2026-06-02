# SlopScale Roadmap

> Read this at the start of every session. Update it before closing.
> Current date: 2026-06-02.

### ⏸️ STOPPED HERE (2026-06-02 cont.) — Segment-Library + REFRESH initiative: **Phases 1–8 done + released v0.7.0; Phase 9 Slice 1 (the Refresh control) BUILT** (`b18ceda`, **1 commit ahead of origin — UNPUSHED**); NEXT = Phase 9 Slices 2–5 (the rest of the Workout UX)
> **Phase status:** P1 variation engine `e560359` · P2 `strum_comp` `70deb13` · P3 jazz wiring `b1aa583` · P4 bass `offerable()`+5 groove gens `3f3bc5b` · P5 40 guitar templates `b756432` · P6 24 bass templates + idiom-validated groove feel `4eb8626` · P7 12 template-ref sessions (23 total) `7eb154d` · P8 Depth Ladder + XP store + Travel axis `9981444` (all PUSHED, **released v0.7.0**) · **P9 Slice 1 — Refresh control `b18ceda` (UNPUSHED):** editable working-draft `_workoutDraft` (deep-clone of the selected workout, never mutates `BUILT_IN_SESSIONS`); the `↻ Refresh` button (by the Segments title) re-rolls every template-ref block via `refreshWorkout` + a dismissible "what changed" caption (neutral accent, reduced-motion gated, no audio); the segment cards now MATERIALIZE template-refs for display (`renderWorkoutDraft`); `onLaunchSession` launches the draft. New helper `materializeSegment` (shared by buildSessionChart + generateSession metadata). Full **9-suite** smoke green throughout (added `smoke-progress.mjs` for P8).
> **NEXT — Phase 9 Slices 2–5** (UX spec: agent-memory `slopscale-ux-designer/project_workout_browse_design_refresh` — drawer + editable timeline + zero new idioms): **(2)** design-your-own editable timeline — upgrade `#slopscale-segment-list` IN PLACE (drag-reorder grip · click-to-select → Inspector block editor reusing Custom's controls · `⋯` menu = Duplicate/Remove/**Re-roll-this-block** via `refreshWorkout({scope:segId})`) · **(3)** library browse **DRAWER** (slide-up over the stage, the Mixer-`M` idiom; browse the 64 `SEGMENT_TEMPLATES` by ROLE first + Genre×Skill×Instrument chips; `[+ Add]` appends to the draft) · **(4)** starter browse grid (same drawer one altitude up, Goal×Level×Genre×Time chips, replaces the `<select>`) · **(5)** surface the Depth/XP readouts (`nodeProgressState().depth` → a 5-dot mastery pip; the session-end card already carries `_lastEndedSession.depth` = Travel flips). **CARRIED refinement** (tracked, non-blocking): the STRUM_GRIPS dom7/9/sus grip table + funk dom9/13 + 2-chord vamp + pop sus (comp templates ship v1 with triads/power chords). Memory: `project_segment_library_and_refresh`.
**The "go deeper with workout programs + segments" ask** became a 4-lane design panel (learning-design chair + gamification + harmony + slopscale-ux; main thread synthesized) that **converged on one model** — see the "Segment library + Refresh" section below + memory `project_segment_library_and_refresh` (+ the 4 agent-memory specs). Christian ratified the most-ambitious path on all three forks: **go big** (~40 guitar templates + ~20 sessions) · **make it count** (build the `slopscale.progress` store so refresh-into-new-key earns Travel credit) · **guitar + bass together**.
- **A library "segment option" = a TEMPLATE** `{ role, competency, band, style?, kind(1 of the 29), base, vary[] }` — generalizes `PATHWAYS[].vary[]` + `stylePaletteConfig`'s index-picker. **Browse / Pick / Refresh = three reads of one object.** A workout = ordered **template-ref slots** `{templateId, variantIdx, locks}`; refresh re-rolls the variant. **NO new generators** — a rolled segment flows through the existing `buildSegmentConfig→buildSingleChart` path (no-unison + voicing hold free).
- **4 refresh invariants** (anti-slot-machine + musical safety): same-band · length-locked · style-locked (progression+scale from `STYLE_PALETTES`) · no-row gate. Refresh = a curated tour shown as a "what changed" readout, never a jackpot; **refresh-into-a-new-key = the Depth-Ladder Travel axis**.
- **✅ Phases 1–4 BUILT + COMMITTED (this session), full 8-suite smoke green throughout:**
  - **P1 — variation engine** (`e560359`): `SEGMENT_TEMPLATES` + `rollSegment` + `refreshWorkout` + the `validateSegmentTemplates` guard (after `stylePaletteConfig`); `buildSessionChart` materializes template-ref slots (inline segments unchanged); exported on `window.SlopScale` (+ `generateSession`); 6 seed templates. New guard `smoke-variation.mjs` (now **8 suites** in `npm test`).
  - **P2 — `strum_comp`** (`70deb13`): held CAGED grip + `STRUM_PATTERNS` (8 cells) + per-string strum stagger; chord boxes; `noSwing` engine line; v1 triads+power chords (STRUM_GRIPS dom9/sus → P5). Pre-build trifecta consult. Bass = n-a.
  - **P3 — palette wiring** (`b1aa583`): jazz `minor_ii_V_i` wired in; pop doo-wop already present. **Re-scoped to P5:** funk dom9/13 + 2-chord dorian vamp (needs a new progression + per-degree quality override) + pop sus + the `STRUM_GRIPS` grip table.
  - **P4 — bass enablement** (committing): the ternary `offerable(primitive,instrument)` tag (native/adapted/n-a) + registry + guard + offerable-driven `syncInstrumentClass` (the single source for instrument applicability, retiring the bending-only hide); **5 new bass groove generators** — `root_fifth_octave`/`octave_groove`/`dead_note_groove`/`right_hand_technique`/`slap_pop` (all-4ths grip, slap/pop via `ac`/`mt`, tuning-robust). Pre-build bass-pedagogy consult. Generators verified on bass AND guitar (82/82 generators, core-purity 35/35). **FEEL-tuning (funk/soul idiom) deferred to the P6 template stage** per the consult.
- **The 9-phase plan** (tasks #1–#9; deps 5←{1,2,3} · 6←{1,4} · 7←{5,6} · 8←1 · 9←1): 1 ✅ · 2 ✅ · 3 ✅(partial→P5) · 4 ✅ · 5 ~40 guitar templates **(+ the carried funk/pop STRUM_GRIPS wiring)** · 6 ~25 bass templates · 7 ~20 starter sessions (role-skeletons) · 8 `slopscale.progress` + refresh→Travel · 9 UX (library drawer + editable timeline + refresh + starter grid).
- **NEXT:** Phase 5 — author the ~40 guitar segment templates (each per-genre + guitar-pedagogy validated), which also lands the carried-over `STRUM_GRIPS` table + funk/pop wiring; then P6 bass templates (funk/soul idiom validate the groove feel), then P7 sessions. Content push — heavy agent validation.
- Earlier this session: CLAUDE/AGENTS line-count + §-order doc fix (`7c51741`). Pre-existing pushed work (`d009772`): 11 starter Workouts, cross-instrument LOCK, Custom action tidy.
- A bundled Slopsmith **host is running** on :8765 from this session (`launch.ps1`) — harmless; relaunch via the `run-slopscale` skill next session.

## 🌙 OVERNIGHT 2026-06-02 — Pathways/Custom action cleanup + 2 design forks AWAITING Christian's batch sign-off

Christian queued an overnight GUI task list (he's asleep; wants all decisions saved for ONE morning batch). **BUILT + committed (NOT pushed — holding for his review): commits `3833e7c` (screen.html) + `4e1c947` (ROADMAP audio note).**

**DONE (safe, clearly-intended, code-verified — needs a 10-sec morning eyeball, not yet screenshotted):**
- **Click subdivision no longer word-wraps** in Pathways. The whole Rhythm/Groove row got a scoped `slopscale-rhythm-grid` (auto-fit `minmax(136px,1fr)` + `nowrap` labels) — 3-up when the rail is wide, 2-up when tight, never cramming+wrapping. (Root cause: selects are `width:100%`, so the wrapping thing was the label *text* in a cramped fixed 3-col grid.)
- **Copy share link / Paste share link / Save preset removed from Pathways** — scoped `slopscale-custom-only` (NOT deleted: `bind()` attaches to `#slopscale-save` without optional chaining, so the elements must stay in the DOM; they're hidden in pathway-mode). Custom unchanged so far.

**Audio note logged (his request, from a parallel Claude session):** genre template = pattern + voicing + **optional-per-instrument-DSP-chain**, not "instrument=sample"; metal fills the guitar-bus chain slot (gate→dist→IR→EQ→double-track), funk leaves it empty → config not re-architecture. In ROADMAP audio section + agent-memory `audio-engine-architect/project_genre_audio_profile_system.md` (it CORROBORATES the existing `AUDIO_PROFILES` design — "stay the course" guardrail).

**AWAITING BATCH SIGN-OFF (3-agent panel run sequentially; full synthesis in my chat handoff). Nothing below is built:**
1. **Custom 1×3 action row** (ux-designer): `[Copy link] [Paste link] [Save routine]`, even Secondary buttons. **Paste becomes a button** (clipboard read on click) that *degrades to today's inline input* on permission/failure (no permanent input footprint).
2. **Regenerate → CUT** (ux-designer + Christian agree): it just re-calls `onGenerate()`; Custom auto-regens on change; not share-related; near-zero perceptible value. Keep the `onGenerate` fn; remove the button+listener (`#slopscale-regenerate` ~screen.js L9277). Revisit "Re-roll" only if/when a generator gains visible randomness.
3. **Save preset → KEEP on Custom** (do NOT move to Workout — preset=single config, Workout=timed multi-block session; different scope). **Relabel "Save routine."** **Add a name modal NOW** (reuse the cheat-sheet/Pack-Manager overlay idiom, prefilled with the auto-name, Enter-to-accept; don't bind Esc) → saves to DB as today. Co-locate the hidden "Load" picker next to the row (deferrable sub-item). **Native OS "Save As" is NOT achievable from the webview plugin** (host-expert: no host file bridge; `showSaveFilePicker` breaks non-Windows) — reframed his file-explorer ask to the name-modal→DB, which matches how presets actually persist. Optional later: `<a download>` `.json` export/import for portable preset files (separate feature; Copy-link already covers self-contained sharing).
4. **Pathways grade-and-advance idea** (gamification, vs the LOCKED Depth Ladder): ~90% already = the Speed-axis clean-and-in-time advance + settling-tax verdict. **Genuinely additive = the explicit in-tempo 1–4 bar musical BREAK as the verdict-delivery beat** (metronome continues, notes drop → verdict card on the next downbeat; in-flow, not a modal stop). Reconcile his "auto-increase speed" with the locked "invite, never auto-pressure": **default = one-tap INVITE after the break; his literal auto-jump survives as Hardcore-only opt-in.** Pre-scoring fallback (scoring absent in some host builds): break is score-independent so it always happens; with scoring→grade timing+notes, without→timing-only-from-onsets or honest self-confirm ("Got it / Again") — never fake a pitch grade. Anti-dark-pattern: non-clean run gets the SAME break + neutral "not yet — run it again?", no streak-loss/shaming; break length stays musical, never padded. **Handoff: the break is a tempo-locked meter-aware rest/verdict window → `rhythm-meter-architect` modeling item.** This sharpens Depth-Ladder slice 2.

## 🏋️ Workout-pillar + curriculum-scaling charette (2026-06-02) — APPROVED (spine + keep-27); validating Core-Beginner next, then build

A launch-scope 5-agent group-design charette (chaired by `learning-design-architect`, 2 waves: + `market-analyst`, then `gamification-architect` + `slopscale-ux-designer` + `harmony-theory-architect`; main thread synthesized). Question: make Custom + Workout top-tier, design a "Workout building-block framework" wide for launch, an auto-planner/"coach" for the player who doesn't know what to practice, genre incorporation, more pathways + more exercises-per-pathway. **Full per-lane specs in `.claude/agent-memory/`** (`learning-design-architect/project_workout_framework_and_planner`, `market-analyst/library-size-and-planner`, + the gamification/ux/harmony files).

**Core finding — primitive-RICH, content-THIN.** We have ~29 exercise primitive types, ~28 scales, ~30 progressions, but only **4 Workout templates** and **27 THIN pathways (~2–4 rungs vs a credible 6–10)**. So "go wide" = **composition + depth, NOT new generators** — with ONE justified exception (`strum_comp`, below). **The Workout pillar is the single highest-leverage launch investment** (and `targetSec`/`fillBlockToDuration` already exist).

**Library-size benchmark** (field-inferred from comparable practice apps + music-software preset libraries — MED confidence, no telemetry yet): credible-at-launch = **12–20 well-differentiated pathways** (we have 27 → count met, **depth missed**), **5–10 rungs per pathway** (we're at ~2–4 → the real gap), **8–12 starter Workouts** (we have 4 → a stub; target **~10**). Lesson from VST preset-counts: don't chase the integer; make content **browsable/categorized + "full not empty" on first screen**.

**The plan, small → big:**
1. *(small)* **Finish the Custom tidy** — cut Regenerate; **Copy link prominent, Paste demoted to a quiet text-affordance** (kept, not deleted — Custom is where you *load* a shared routine). Answers "is copy/paste too much choice?": trim + de-emphasize, don't remove.
2. *(small)* **Seed the Workout arc** in the UI — warm-up → technique → application as a soft default (path of least resistance, never a lock).
3. *(med)* **Workout block-type framework:** block = `{ role, practiceType (1 of the existing 29), style?, duration }`. Roles = Warm-up / Technique-isolation / Scale-Arp focus / Application-over-changes / Jam / Review / Cool-down. Composition rules (warm-up first; ≥1 isolation before application; ≤2 same-primitive in a row; Review resurfaces an earlier skill; ~3–5 blocks / 8–12 min). **Zero new generators** — role is metadata over what exists.
4. *(med)* **Workout authoring flow** — the session-progress segment bar becomes an editable timeline; the Inspector becomes the block editor (reuse Custom's practiceType picker + style chips + Feel). "≈ N min" = a sum readout, not a goal. No second player.
5. *(med)* **~10 vendor starter Workouts** (goal × level × time) + chip-filtered browse grid (full-not-empty) — the authoring quality-bar AND the planner's payload.
6. *(med)* **Shareable Workout** — extend the existing `#s=<base64>` link encoder to the whole block array (no accounts/social).
7. *(med)* **Session-end readout** — per-block rung-clears roll up into ONE gained-only summary ("a mix bouncing down"), reusing the locked `--ss-meter`/verdict grammar + the in-tempo break-verdict beat. No score/rank.
8. *(big)* **Build `strum_comp` — the ONE justified new generator.** Real hole: all 29 primitives are single-note/arpeggiated; nothing strums a **held, voiced chord with a rhythm** — the literal skill a beginner rhythm pathway teaches. Serves 3 of the 6 new pathways (Rhythm-Feel, Pop comping, Funk vamp). **Already a locked Guitar-Core decision** ("build comping generator") — corroborates, doesn't expand, scope. Pre-build review: rhythm-meter + voicing + guitar-pedagogy.
9. *(big)* **Deepen Core pathways to 6–10 rungs** (Core-Beginner first). Explicit harmony ladder: pentatonic box → +blue note → position travel → major-pent flip → triads → 7th vocab → guide tones → Connect over ii–V–I (Jam cap). Needs the two Depth-Ladder engine gaps `gamification-architect` owns: **Jam-as-graded "Apply" summit** (post-Jam, opt-in landing-read — never grade mid-flow) + **Review = re-bank at the highest cleared rung**.
10. *(big)* **New pathways to fill holes**, prioritized: Rhythm/Strumming-Feel (biggest hole, needs #8) → Rock → Funk-R&B 16th → **Jazz Vocabulary** (ii–V–I is Workout-only today — no jazz *pathway*) → Pop comping → bass-parity Cores. Each vetted by its genre-idiom + pedagogy agent before "done." Palette wiring gaps to fix: funk `dom9`/`dom13` + a 2-chord vamp; pop doo-wop + sus; jazz `minor_ii_V_i` (qualities all already exist — wiring only).
11. *(big, LAST)* **"Suggested today" planner = a light ROUTER, not an AI coach.** One editable, ignorable invite card: *resume your pathway at the next uncleared rung* / *run this N-min set* / ignore. Surfaces **competency** ("next rung"), **never a quota** ("hit 15 min"); **NO streaks / calendars / nags** (gamification: competence-anticipation builds the habit; loss-aversion is the dark pattern we refuse). Genre rides it — a "Metal day" just themes the blocks via STYLE_PALETTES.

**DECISIONS — APPROVED 2026-06-02 (Christian):** (A) **Spine approved** — block = role over the existing 29 primitives, **no new generators except `strum_comp`**; **deepen Core-Beginner before adding new pathways**. (B) **KEEP all 27 pathways and deepen** them (no prune). **NEXT:** guitar/bass-pedagogy + genre-idiom agents validate the Core-Beginner 8-rung ladder + new-pathway content **before build**; the Workout pillar (#1–#7 — finish Custom tidy, framework, authoring, ~10 starter Workouts, share, readout) needs no pedagogy validation and can start in parallel. `strum_comp` (#8) gets rhythm-meter + voicing + guitar-pedagogy review before it's built.

## 🎸 Cross-instrument Workout structure — LOCKED (2026-06-02); the spec for building bass next

3-agent design consult (`learning-design-architect` chair + `bass-pedagogy-expert` + `piano-pedagogy-expert`; main thread synthesized). Question: how do Workouts + the practice-type registry span guitar / bass / piano — bundle together or fork per instrument? **Answer: neither — a 3-layer model.** Per-lane detail in the three agents' `.claude/agent-memory/`; durable synthesis in project memory `project_cross_instrument_workout_structure`.

- **Layer 1 — ONE universal framework for every instrument.** The block-type ROLES (Warm-up → Technique-isolation → Application-over-changes → Jam → Review) + the arc + the session/`targetSec` structure are shared. Do NOT fork the structure per instrument.
- **Layer 2 — ONE shared primitive registry; each practice type carries a TERNARY per-instrument applicability tag:** `native` (as-is) / `adapted` (same primitive, instrument-specific config/feel) / `n-a` (not offered). The **`adapted` middle state is load-bearing** (bass legato = hammer/pull only; bass vibrato slower/narrower; bass "sweep" = a raked broken arp, not a metal sweep) — a binary tag would render these guitar-shaped and feel wrong. Formalize via one `offerable(primitive, instrument)` predicate + a startup integrity guard, **replacing** the ad-hoc runtime throws (`bending` throws on bass) + the just-added onLaunchSession same-instrument-family guard.
- **Layer 3 — per-instrument CONTENT** composed from the tagged registry.
- **Parity principle:** parallel journeys at the role/competency layer, never forced same at the content layer (same arc + competency themes per tier, bespoke fillings; anti-sameness AND anti-gap guards).

**Bass — ~90% right for pitch, optimistic for feel; NO schema change needed.** Of the 29 primitives: ~21 `native`, ~5 `adapted` (legato, vibrato, tapping, pentatonic_super, sweep), ~3 guitar-only (bending, tremolo_picking, hybrid_picking). `position` (movable all-4ths box) is correct, not CAGED/3NPS. **Bass's identity = right hand + groove, and the 29 have almost none of it** → add 5 NEW primitives (not recomposable): `root_fifth_octave` (the foundational bass box, taught BEFORE scales — highest priority), `slap_pop`, `dead_note_groove` (pocket), `right_hand_technique` (alternating i-m / raking), `octave_groove`. Credible library ≈ 6–8 workouts (Bass Foundations shipped · Right-Hand Engine · Groove & Pocket · Walking Bass · Slap & Pop · Arpeggios & Changes…). **Sequencing nuance:** right-hand + root-fifth-octave + groove come BEFORE scale velocity — the opposite emphasis order from a guitar shred ladder (parity of arc, not of order).

**Piano — "shared spine + its own technique layer," SCHEMA-GATED.** All theory primitives transfer (scales, arps, guide_tones, chord_scales, bebop, inversions, shell_voicings, walking_bass) — piano is their native home — via `hand`/`finger`/`positionContext` (thumb-under = the finger sequence). `n-a`: CAGED/3NPS, string_skipping, sweep, bending, hybrid/tremolo picking, pedal_riff, slides/HOPO. Piano's own MUST-HAVE primitives (4): thumb-under scale, thumb-under arpeggio, two-hand coordination, rootless comping + a hand-span guardrail in schema validation (Hanon/position-shifts/pedaling/10ths later). **HARD DEPENDENCY: piano blocks on the planned `hand`/`finger`/`positionContext` schema (Phase 6 groundwork) landing first** — design-locked, build-gated.

**Build order:** (1) Guitar — done (29 primitives + 11 workouts). (2) **Bass NEXT** — no schema change: formalize ternary tags + `offerable()`, add the 5 right-hand/groove primitives, ship ~6–8 bass workouts in the right sequence (validate new primitives with bass-pedagogy + idiom agents). (3) Piano — land the schema + span guard FIRST, then its 4 native primitives + 2 starter workouts.

## 🎚️ Depth Ladder & run-length — SPEC LOCKED (2026-06-01), foundation building
Two converged group-design rounds (gamification chaired retention, L&D chaired length; + market + guitar-pedagogy; main thread synthesized). Christian: "lock it in." **Full spec + numbers + the staged build queue live in project memory `project_depth_ladder_and_run_length`** (the canonical record); per-lane detail in the four agents' `.claude/agent-memory/`. Headlines:
- **Replay/level = the Depth Ladder, NOT rep-counting** (rep-gates cut, unanimous). Generalize the shipped tempo "Climb" into a 4-axis finite per-exercise ladder — **Speed → Travel (key/position) → Support-off (metronome/eyes off) → Apply (Jam)** — each rung gated on a **clean-and-in-time RUN, never reps/raw-BPM** (the load-bearing rule: a rep/BPM gate trains speeding past cleanliness). XP stays **derived (time×difficulty), gained-only, never gates**; a maxed exercise keeps earning for *playing*. Mainline-Slopsmith XP = architect the **outbound `slopscale:progress` seam now, defer the live hook**.
- **Run length is content-derived, never a flat clock, and ends with a verdict.** Pass-bounded drills (scale/chromatic/technique) ~30–50s, hard ceiling ~90s; cycle-bounded drills (chord-scales-over-changes, guide-tones, prog/diatonic arps, full-neck) **legitimately >60s** (unit = the harmonic cycle, ≤~3min). Settling-tax verdict window (first 1–2 passes don't count) kills the 22s-fluke clear. Two currencies: XP scales WITH length, rung-clears LENGTH-NEUTRAL (one clean run clears, any length). Long runs get a silent within-run `--ss-meter` progress lane.
- **Pathway = 6–10 rungs; "complete" = all rungs cleared — measured in rungs, NEVER a wall-clock/minutes readout.** Session dose 10–20 min across 2–3 pathways. **No user-facing minutes slider** (expose practice *depth*, not a clock). Jam stays endless; Workout's per-block `targetSec` unchanged — this only changes Pathways/Custom drills.
- **Anti-metric (when telemetry exists — none yet):** time-per-clear rising while clear-rate-at-spec flat = padding/dark pattern.

**Staged build (length substrate first):** (1) **right-sized finite runs** — per-type `RUN_TARGET_SEC` + tier/ladder modifiers + clamps + cycle-completion override → the shipped `fillBlockToDuration`; finite-run-ends-with-closure (existing session card) + a "keep looping" toggle ← **BUILT (commit `33cc69f`, pushed); run-length numbers are FIRST-PASS — feel them in practice before slice 2 gates clears on them.** **NEXT → (2)** `slopscale.progress` store + clean-and-in-time gate on the Speed Climb (graceful fallback when scoring absent). (3) Depth axes (Travel/Support-off/Apply) + per-axis length modifiers. (4) XP readout + the host emit seam + Off/Casual/Hardcore wiring.

**Also shipped + pushed this session (`origin/main`, through `6396626`):** the Pathways back-half **GUI reorg** (climb-led layout, Notes/Backing/Click practice pills, Mixer TONE knob), the **live fretboard strip on Tab + 3D Highway**, the **1-bar first-run count-in**, and the **core/shell host-independence boundary + `smoke-core-purity` guard** (`npm test` now 7 suites; see memory `project_host_independent_core`).

### ⏸️ STOPPED HERE (2026-06-01) — v0.6.0 SHIPPED (pushed + tagged + GitHub release): "Play the Changes" dial + extended-range fix; remaining Stage 2 = the chord-event TIMELINE (+ region, Jam preview)
- **Released v0.6.0** (minor — new feature). plugin.json 0.5.1→0.6.0 (`e8b3d3a`), tag `v0.6.0`, GitHub release `…/releases/tag/v0.6.0`, pushed to origin/main. Headline: the **Park/Connect/Connect+approach "playing the changes" dial** (Stage 1 + Stage-2 A/B/B.5 below) + the **7/8-string CAGED/Open/sweep top-six anchoring fix**. 6 work commits `b9a7dfa`→`334017b`.
- **README landing page now carries 7 screenshots** (`docs/images/*.png`; commits `1d4c9a8` + `8c98f24`, pushed): hero 3D Highway, a Workout+Jam pair, the **Connect "play the changes" dial** crop (under a new README subsection **"Play the changes (v0.6.0)"** — the README previously had no Connect mention), a Tab+Notation pair, and the live Mixer. Regenerate with the host up via the **untracked** capture scripts `.claude/skills/run-slopscale/shot-readme.mjs` (highway/tab/notation), `shot-readme-modes.mjs` (workout/jam/mixer), `shot-connect.mjs` (the dial crop). **Repo is PUBLIC** → `raw.githubusercontent.com/ChrisBeWithYou/slopsmith-plugin-slopscale/main/docs/images/*.png` unfurl as image previews on Discord (bare URL on its own line; don't wrap in `<>` or markdown).
- **"Playing-the-changes" framework — Stage 1 (Connect keystone) + Stage 2 A/B/B.5 all BUILT, reviewed (agents GO), COMMITTED.** Done: Connect voice-leading (`2de8957`), the **Park/Connect/Bebop connection dial** (Park=one-scale, Connect=voice-led to guide tones, **Connect+approach=chromatic enclosure into each change** `58c1ec6`), the intra-bar reflect-not-wrap leap fix (`873034d`), and the chord-scale no-unison dedupe (`718590e`). The connection axis (the "how the change sounds" + beginner→advanced dial) is effectively COMPLETE. **Remaining Stage 2 (the "when chords change" + expansion axis — a fresh, larger effort):** the beat-based **chord-event timeline** (`compileChordTimeline`/`enrichEvent` — harmonic rhythm, anticipation, 2-chords/bar; a clean superset of the degree array, but touches every degree-consuming builder → big refactor, rhythm-meter + harmony chaired), the `region` abstraction (box stops being a hard wall), the difficulty dials beyond connection (target-density, assist-visibility = render-only via `jamTargetPcs`), the hand-vs-pitch "nearest" tier sub-dial, and the Jam next-chord target preview. Detail: project memory `playing-changes-initiative`. Decided by Christian after a 3-agent consult (harmony + guitar-pedagogy + learning-design, all converged). The blind spot: the engine gets the notes right per chord but had ZERO navigation between them — `mode_of_moment` restarted the line on the chord root every bar ("scale practice with a better click"). **Built:** `buildChordScaleExercise` now voice-leads — `connectStartIdx(path, prevMidi, guidePcs, chordPcs, rootPc)` starts each new chord's run on the nearest GUIDE TONE (3rd/7th) to the previous note (fallback nearest chord tone → nearest scale note; first bar opens on root), threading `prevMidi` across the chart (reuses the `nearestPositionForPc` voice-leading device from guide-tones). UI relabeled **Connect** (mode_of_moment) / **Park** (chord_tone_emphasis) — internal values UNCHANGED (no preset/pathway breakage). Guard: `smoke-connect.mjs` (now 6 suites in `npm test`) — ii-V-I → 5/5 guide-tone landings, 0 root-restarts, seams ≤5st incl. emergent common-tone pivots. All 6 smoke suites green. **Reviewed: harmony-theory + guitar-pedagogy both GO (no must-fix).** **KNOWN PRE-EXISTING BUG (logged, NOT a blocker, not caused by Connect):** `buildChordScaleExercise` bar emission `path[(startIdx+i) % path.length]` modulo-wraps mid-bar when `path` is short vs `notesPerBar` (sparse chord-scale + fast subdivision) or a wide `position` window → ~29–39st intra-bar leap; reproduces under Park too. Fix later: clamp `notesPerBar`≤`path.length` (or contour-from-start), + an intra-bar max-interval assertion in `smoke-connect.mjs`. **Stage 2 DEFERRED:** beat-based chord-event timeline (harmonic rhythm/anticipation/2-chords-per-bar — a clean superset of the degree array), full connector-cell vocab (approach/enclosure/slide/common-tone/cell-displacement), the `region` abstraction (box stops being a hard wall), a true `changes_in_position` "Switch" rung + the Park/Switch/Connect dial exposed, the hand-vs-pitch "nearest" tier-gated sub-dial, Jam next-chord target preview. Detail: project memory `playing-changes-initiative` + agent-memories `harmony-theory-architect/project_playing_changes_timeline_proposal.md`, `learning-design-architect/project_playing_changes_ladder.md` (R0→R6 ladder), guitar-pedagogy connector-vocabulary review.
- **Extended-range scale-shape + sweep fix — BUILT, verified & COMMITTED ("close the loop" on the string/tuning thread).** Implemented the guitar-pedagogy framework "CAGED stays a 6-string system": a `off = max(0, N-6)` string offset anchors the box on the **top-six EADGBE strings** on 7/8-string guitars (was rooting the E-shape on the low B — a box nobody plays). Touched: `resolveCAGEDShape` + `resolveOpenShape` (scale boxes; Open was the *worse* offender — lower-string-wins dedupe could EVICT a pitch from the canonical standard string), and the **CAGED sweep path** (`cagedShapeNotesForChord`, `templateFromShape`, `pickShapeRootFret`, the `useShape` gate `===6`→`>=6`, and the `sweepArpeggioPositions` fallback `bassStr=off`) so extended-range sweeps use the canonical top-six grip instead of an all-string low-B rake. `off=0` on 6-string → byte-identical there; bass <6 still rakes all strings; 3NPS confirmed needs nothing; the default diatonic-arpeggio position collector (all-strings on 7/8) is the agent-blessed acceptable fallback, left as-is. guitar-pedagogy reviewed the implementation = **signed off** (CAGED + fingering + Open; sweep is its recommended preferred fix). New guards: `smoke-strings.mjs` checks (5) CAGED/Open top-six + (6) sweep top-six — and the work caught that check (1) "full_neck uses every string" was never actually testing full_neck (readConfig force-downgrades to CAGED unless `advancedMode==='on'`, never set) — now fixed. **All 5 smoke suites green** (4/4 renderers · 64/64 generators · highway-settings · strings · audioctx). Detail in memory `stringed-instrument-tuning-framework` + agent-memory `project_extended_range_caged_framework_2026-06-01`.
- **Released v0.5.1** (patch). Headline: **critical cross-plugin fix** — v0.5.0 globally clobbered `window.AudioContext` (highway-click stub gated only on "a ctx exists" + the new eager preload), breaking the host player's stem decode for OTHER plugins (`decodeAudioData is not a function`); now scoped to SlopScale's active screen (`5fbbd62`, guard `smoke-audioctx.mjs`). Also: the **pathway pack manager** (`+` install/order modal, `9ccad46`) and **string-count/tuning now flow into generated charts** (3 plumbing bugs fixed, guard `smoke-strings.mjs`). plugin.json 0.5.0→0.5.1. See memory `audiocontext-patch-screen-scoped`, `pack-manager-built`, `stringed-instrument-tuning-framework`.
- **Released v0.5.0** (tag + GitHub release: `…/releases/tag/v0.5.0`). Includes the whole four-mode DAW shell + audio-realism A–D (incl. **Phase D4: sampled FluidR3 drum kits + odd-meter drum handling**, committed `b6504c6`). plugin.json bumped 0.4.0→0.5.0 (`cd13d70`); README rewritten for the current product + a **market-analyst positioning pass** (`1081c6e`) — lead with no-song-lock / Jam-as-a-mirror, "Why SlopScale" block, "First five minutes". 27-pathway count verified (`vary:[` ×27).
- **NEXT (resume): djent bedrock from the Periphery PDFs.** Christian wants **ALL songs ingested, not snippets.** Partial snippet-grounded pass is done (guitar + metal returned PDF-cited analysis + 7 candidate exercises; prog blocked). **Solved blocker:** Read can't rasterize the image-PDFs (no `pdftoppm`) and there's no text layer → render notation pages to PNG via PyMuPDF (installed), agents Read the PNGs. **Full detail + resume steps + the render recipe in project memory `project_djent_pdf_ingestion`.** Christian rejected the full render twice — **revisit scope/cost (the full sweep is ~1M tokens) before launching.** Also pending from D: D5 (drum humanization + per-genre grooves), the 2 djent generator gaps (rest-fill in `buildPedalRiffExercise`; the `@` long-cycle `parseMeter` clause), mixer-growth GUI #6, the progress store.

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
5. ◐ **The DAW shell** — **SKELETON + M/P/[ PANELS BUILT 2026-05-31** (commit `bf197c8` + this commit). Four-mode switcher `Pathways · Custom · Workout · Jam` (relabel guided→Pathways / session→Workout keeping data-mode tokens; new Jam mode; `slopscale-jam-mode` + forward-compat `ss-mode-*` root classes; `role="tablist"`; per-mode "what is this mode" desc line). Jam Inspector + **Jam WIRED** (style grid from STYLE_PALETTES + key/tempo/feel → `jamPlay()` loops a style backing through the contained player; mirror, no score). **`M`/`P`/`[` + `?` hotkeys & panels DONE:** `M` mixer slide-up (per-bus Player/Comp/Bass/Click faders + mute/solo + Backing dim, wired to the audio buses via `mixerGainFor`/`applyMixer`, persisted; `trackBus` inits from it); `P` right progress sheet (streak + tempo-tier dots + honest "XP coming"); `[` Inspector collapse (`setPanelCollapsed`); `?` cheat-sheet; each = a visible view-switcher-bar button; reduced-motion, never Esc, no audio. **Loop in/out moved `[`/`]` → `i`/`o`** (editor convention) to free `[` for collapse; `\` still clears. **First-run primed START CTA DONE:** one lit "▶ START [pathway] — [skill hook]" in Pathways mode (above the picker so it's visible on first paint; `updateStartCta()` names the exercise + a hook derived from the goal, mirrors play/stop via `syncPlayButton`; static preview, no auto-play). **Resume-last-mode DONE** (`MODE_STORAGE_KEY`; first-run→Pathways, returning user resumes Custom/Workout/Jam; share link wins). **Copy polish DONE** (generic tagline, Workout intro, de-duped mode intros). **HEADER TOP-BAR DONE (4 stages, the shell-IA furniture map):** the header is now the global top bar — **title (left) · Setup popover `Guitar · Standard ▾` (instrument+strings+tuning moved out of the rail) · 4 mode segments centered (switcher moved out of the rail) · progress chip (opens the P sheet — de-dups the view-bar Progress button) · ⚙ settings menu** (Keyboard shortcuts + host plugin-settings). Rail is now purely the per-mode Inspector; renderer-status dropped from the meta. **Live Jam target-highlight DONE:** backing events enriched with chord+guide PCs (`chordHighlightPcs`); a Highlight selector (Chord/Guide/Scale/Off, default Chord) in the Jam Inspector; `jamTargetPcs()` + `drawFretboardFrame` light the current chord's tones (green = `--ss-meter`) on the strip as the changes move; the strip is forced visible in Jam. **Narrow-width header degrade DONE** (spec order): Setup label → short (`Gtr · Std`, via `data-short`/CSS), view-bar secondary hides (≤1000px), mode segments → a `Mode ▾` `<select>` fallback (≤880px, synced by `syncModeBar`, primary nav protected longest). **Fuller settings DONE:** accent theme switcher (Blue/Ember/Violet — tokenized the active-state fills/edges as `--ss-accent-grad`/`-edge`, themes remap them live + persist), default XP mode (Off/Casual/Hardcore, persisted — ready for the unbuilt store), default count-in (persisted, seeds the count-in control). **Still to do:** gamification fills the `P` XP block + the chip's armed-lane/→next signals when the `slopscale.progress` store lands; fuller `--ss-*` token coverage so themes recolor more of the UI.
   - Also built same session: the **pathway picker** (replaces the tangling SVG skill-tree — `PATHWAY_BANDS` 6-band map + `renderPathwayList()`: L1 band bar + L2 bounded ordered list, full labels, tier dots, you-are-here, one →next cue, cross-band "Builds on" hints, `nodeProgressState()` shared helper; SVG tree shelved-but-kept) + **goal card folded into the picker** + **Stage-C height polish** (advanced cards → `<details>` accordions, progress strip → header, sticky mode switcher). 3-agent design (ux/gamification/L&D) + market best-practice sign-off.
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

### ⏸️ STOPPED HERE — #1–#3 + the FULL #5 DAW shell BUILT & pushed; NEXT = #4 drums + #6 progress store (2026-05-31)
Build-queue **#1 (reviewed+fixed), #2 STYLE_PALETTES, #3 targetSec, and the ENTIRE #5 DAW shell are BUILT + on `main`** — smoke-green throughout (4/4 renderers, 4/4 sessions, 64/64 generators, highway-settings; each feature verified via a one-off Playwright probe, removed after). Commits: `93748b6` Foundation review-fixes/palettes/targetSec · `bf197c8` picker + four-mode skeleton + Stage C + Jam wiring · `d739d1f` M/P/[ panels · `5ee8b38` first-run START CTA · `3bc708a` header top-bar + resume-last-mode + copy · **(this note's commit)** Jam target-highlight + responsive degrade + fuller settings. `shot-rail.mjs` = local screenshot helper (untracked).

**The #5 DAW shell is COMPLETE** (the whole menu/shell + four-pillar spec): pathway picker (replaced the SVG tree — `PATHWAY_BANDS`/`renderPathwayList`/`nodeProgressState`); header top-bar (Pathways/Custom/Workout/Jam · Setup popover · progress chip→P · ⚙ settings; rail = pure Inspector); Stage-C polish; **Jam** (wired `jamPlay()` + live target-highlight via enriched `backingEvents`/`jamTargetPcs`/`drawFretboardFrame`); **M/P/[/? panels** (mixer→audio buses, P sheet, cheat-sheet); first-run primed START CTA; resume-last-mode (`MODE_STORAGE_KEY`); narrow-width degrade (Setup short → view-bar secondary → `Mode ▾` last); accent theme switcher (`--ss-accent-grad`/`-edge` tokenized) + XP-mode/count-in defaults. Per-feature detail in the build-queue #5 entry above.

**GUI build (this session, designed with ux/gamification/L&D + market sign-off):**
- **Pathway picker** replaces the SVG tree (tangled at 27 nodes): `PATHWAY_BANDS` (6 bands) + `renderPathwayList()` (band bar + bounded list, full labels, tier dots, you-are-here, one →next, cross-band "Builds on"); `nodeProgressState()`/`pathwayPrereq()`/`pathwayBandId()` helpers; SVG tree shelved (`.slopscale-tree-shelved`, `renderSkillTree()` early-returns). Goal card folded into the picker (title hidden, flat caption).
- **Four-mode shell**: `Pathways·Custom·Workout·Jam`; `selectMode('jam')` + `slopscale-jam-mode` + `ss-mode-*` classes; `MODE_META` drives the desc line; `syncModeBar` recognizes jam + sets aria-selected.
- **Stage C**: advanced cards → `<details>` accordions; progress strip → header (header now flex row); sticky `.slopscale-sticky-modes`.
- **Jam wired**: `jamPlay()` (style palette → looping backing via contained player), `renderJamStyles()`, key/tempo/feel controls. Mirror, no score.
- **Christian's UI decisions:** deterministic variation-start everywhere; E-shape-first CAGED; fret count left at 24 (documented) — all from the earlier batch, still standing.

**Christian's decisions this session (LOCKED 2026-05-31):**
- **Variation start = deterministic EVERYWHERE.** Selecting any pathway opens on variation index 0 (the named entry); Next Variation is the explicit "give me another" control. `applyPathwayById` random-on-select replaced with `idx 0` (screen.js ~6523). Both review agents recommended it for a curriculum.
- **Major Scale — CAGED = lead with E-shape.** Reordered `vary[]` to E→A→G→C→D (easiest box first; pedagogy agent's call) + base shape→E + goal-card copy updated. (CAGED-mnemonic C-first order dropped in favor of easiest-first.)
- **Fret count = leave at 24, document it.** SlopScale has no instrument fret-count model (`MAX_FRET=36` is only an input sanity-clamp). Only `full_neck`/Whole-Neck Freedom relies on the hardcoded 0–24 sweep, which overshoots 21/22-fret guitars (most Fender/Gibson) — accepted; documented in a code comment at the `full_neck` branch. Future option if it matters: per-instrument `frets` field in `STRING_SETUPS`, clamp `fretMax` to it.

**NEXT SESSION — the shell is done; back to content + realism:**
- **#4 DRUMS voice** (self-hosted WebAudioFont GM bank-128 percussion) + `AUDIO_PROFILES` → ensemble spec — the realism unlock (kills the "MIDI-sounding backing" complaint; the Jam band is pad/boogie + bass today). `drum-pedagogy-expert` spawnable.
- **#6 `slopscale.progress` store** (xp + per-node `masteredAt`) + Off/Casual/Hardcore wiring — UNBLOCKS the two remaining shell gaps: the `P`-sheet XP block + the header chip's armed-lane/→next signals (both degrade to time-on-instrument / placeholders today). The settings XP-mode default already persists, ready to drive it.
- **#7 `buildCompingExercise`** (CAGED triads/7ths on a strum grid) — long-standing generator gap; unlocks the Open-Chord Core nodes + comping Workout blocks.
- **Follow-ups (when relevant):** genre-idiom + harmony review of the 9 STYLE_PALETTES contents before broadening; the `7alt`/`maj7#5` exotic-tonic enhancement; deeper `--ss-*` tokenization so the accent themes recolor more of the UI; the distorted-amp (NAM) backing chain (ear-verdict pending). Apply the north-star tweak into `CLAUDE.md`/`AGENTS.md` "Design north star".
- **Also (cheap, parallel):** run `slopsmith-host-expert` against a live `window` dump to re-verify the viz borrow-contract + Minigames SDK presence + the `GET /api/settings`→`default_arrangement` instrument-inherit (the Setup popover does NOT host-inherit yet — defaults to guitar). `gamification-architect` + `drum-pedagogy-expert` spawnable.

---

## 🎨 GUI Design Audit (2026-05-31) — design system written; #3/#4 fixed; build queue

A four-lane GUI design audit (UX-chaired, + learning-design + gamification + market-analyst; main thread synthesized) on button placement/layout vs the docs — repeats, gaps, conflicting design language. Output: **`docs/design-system.md`** (the project's first style guide — read it before any GUI change), plus the decisions below. Triggered by Christian's batch (the audio/mixer rework, the ultrawide START button, the Setup/Play-vs-`[` toggle, the pathway pack-manager). Per-lane raw findings in each agent's `.claude/agent-memory/<agent>/`.

**Shipped this session (commit pending) — the two contained, unanimous fixes:**
- **B1 — collapse-toggle was a TRIPLE** (Setup/Play pill + `⟨ ⟩` icon button `#slopscale-collapse-btn` + `[` hotkey, all → `setPanelCollapsed`). **Kept the labelled Setup/Play pill + the `[` hotkey; removed the unlabelled `⟨ ⟩` button** (recognition over an unlabelled glyph). [Christian's #4]
- **B2-width — the ultrawide START-CTA banner.** Root cause: `.slopscale-start-cta` is `width:100%` in a rail that widens to 660–800px @1800px. **Capped at `max-width:360px`** (`+ align-self:start`). The full onboarding restructure is queued (below). [Christian's #3]
- Smoke-green after both (4/4 renderers · 64/64 generators · highway-settings).

**Answered — #2 (no fresh-install intro popup):** absent **by design** — the primed-CTA first-run model (one lit primary, static preview, no survey/coach-marks, ≤90s to first note) is market-right; all non-UX lanes said don't add a modal. The ultrawide-button complaint (#3) is the *execution* of that onboarding failing, not the model.

**Key audit findings (full detail in `docs/design-system.md`):**
- **The arc is invisible** (L&D, highest leverage): the four modes AND the Core/Style bands render as flat parallel tabs, not an easy→mastery climb; and **`→ next` dead-ends at the Beginner→Intermediate seam** (the worst place to go silent). Make `→ next` cross band boundaries; distinguish the Core *climb* from lateral Style *branches*; label the tier-dots.
- **Four divergent "pick one" treatments** + **~70% of component CSS uses raw hex** despite the token layer → accent themes only half-recolor. Collapse to two families (`.ss-seg` / `.ss-chip`); add 5 missing semantic tokens (`--ss-track/-btn/-btn-hover/-hover-soft/-stop`); migrate the hex.
- **Dead code:** `#slopscale-mode-desc` (JS+CSS but no element — add it for activation legibility); orphan CSS `.slopscale-sticky-modes`/`.slopscale-collapse-wrap` (remove).
- **No primary-action parity:** 3 of 4 modes have an in-rail "go" (3 different sizes); Custom has none. One shared `.slopscale-primary-cta` (one lit, label-sized, ≤360px) across all modes.
- **Confirmed clean:** progress signals de-duped (chip owns `P`; three calm signals intact); mixer/Jam are mirror-not-judge. **Verify in build:** `tier-glow` still fires on a list-row clear (keyframe bound to the old `.slopscale-tier-btn`).
- **Market wins to protect:** Custom co-equal, Workout first-class, Jam's "mirror not a judge" copy (verbatim), DAW restraint, one-lit-primary, practice-not-generation copy.

**Decided 2026-05-31 (Christian):**
- **B2-shape = the goal-caption version** — Pathways' primary is one Start *below the goal caption* (cross-mode consistency via the shared `.slopscale-primary-cta`, cleanest reading order, simpler build). Placed by the onboarding restructure (build-queue #2).
- **Session-end summary card = YES, BUILT 2026-05-31** — the "Last session" card in the P sheet (`sessionSummaryCardHtml`/`presentSessionSummary`, fed from `sessionEnd()`); auto-presents on a notable end (tier cleared / ≥20s), else refreshes silently. Descriptive + gained-only, meter-green only for a cleared tier, no score. Verified via a one-off probe (card content + dismiss + auto-present-on-tier-clear; probe removed).

**Post-audit GUI build queue (conforms to `docs/design-system.md` §15):** 1 ✅ B1+B2-width · 2 onboarding restructure + shared primary-cta · 3 token migration + dead-code · 4 control-family consolidation · 5 ✅ cross-band `→ next` + tier-dot labels + Core-vs-Style distinction (BUILT 2026-06-01: `.slopscale-pw-nextband` cue, labelled tier-dots, `.slopscale-band-sep`) · 6 mixer growth (per-channel instrument `<select>` + master channel + resizable + vertical strips) · 7 ✅ pack-manager (`+` + dual-column transfer modal, BUILT 2026-06-01: pack==band, Core=3 derived pinned packs, store `slopscale.packs` Style-only, first-run Core-only, Available grouped by family) · 8 ✅ session-end card (BUILT 2026-05-31) · 9 **rhythm-controls & Preview-Audio consolidation** (decided 2026-06-01, five-lane group-design — *folds into #2/#5/#6, not a separate build*: retire Preview-Audio panel → Click/Backing(/Notes) practice toggles by the Mixer button + "Backing tone"→Mixer Tone knob [#6]; BPM=tier readout/override, tiers stay the ladder [#5]; generation-vs-playback split + mode-aware transport [#2]; Feel stays Inspector; glance strip kept whole. Full spec in `design-system.md` §14/§15-#9).

**Separate track — #1 AUDIO (needs the audio agents, NOT in the GUI panel):** per-note velocity/volume consistency (entangled with the WAF-vs-oscillator voice split at screen.js ~5978 + GM sample-level variance — not a one-line constant), WAF-for-all-backing with synth failover, remove the backing-voice override dropdown (its selection moves into the mixer per §11). **Run `audio-engine-architect` + `sound-design-architect` first.**

### ✅ GUI audit complete — #3/#4 fixed + session-end card BUILT; GUI build #2→#7 queued
The design foundation is in place (`docs/design-system.md`); shipped: the two contained fixes (#3 CTA cap, #4 toggle dedupe) **and** the session-end "Last session" card (queue #8). Both forks resolved (B2-shape = goal-caption; card = built). **GUI build queue #2→#7** (conform to the style guide — onboarding restructure + shared `.slopscale-primary-cta`, token migration + dead-code, control-family consolidation, cross-band `→ next`, mixer growth, pack-manager) remains queued; plus the still-pending **drums** + **`slopscale.progress` store** (unblock the `P`-sheet XP + the arc's mastered-state).

---

## 🔊 Audio Realism Pass (2026-05-31) — A/B/C + D1–D4 BUILT (ear-tune pending); D5–D6 (humanization + percussion kits) next

The #1 audio track, designed by `audio-engine-architect` (sourcing/method) + `sound-design-architect` (mix/hearing-safety); main thread synthesized. Both lanes' raw specs are in their `.claude/agent-memory/` (`project_audio_realism_pass`, `project_audio_realism_mix_spec`). Sequenced **A→D**, foundation-first:

> **Architecture guardrail (logged 2026-06-02, cross-session corroboration — detail in agent-memory `audio-engine-architect/project_genre_audio_profile_system.md`):** the genre/style template must be **pattern + voicing + optional-per-instrument-DSP-chain**, NOT "instrument = sample." Metal needs a guitar-bus signal chain (gate → distortion → cab IR → post-EQ → double-track); funk/jazz leave that slot empty. Make the DSP chain a first-class **optional field** of the profile (`engine:'amp'` = "this bus has a chain"), generalized across instruments (surf reverb / dub delay / shoegaze wall ride the same slot), so a new processed genre is **config, not re-architecture**. Build `AUDIO_PROFILES`/`resolveAudioProfile` as the data+resolution layer first, recognizing the `'amp'` slot from day one even though the WaveShaper/NAM impl lands later. Don't special-case the distorted family in the scheduler.

- **A — Per-note velocity/volume CONSISTENCY (FOUNDATION) — ✅ BUILT 2026-05-31 (ear-tune pending).** Root causes (both confirmed in code): scattered magic scalars + no per-pitch normalization, and the bent-note WAF→oscillator lurch. Built: `WAF_VOICE_VOL` named per-role levels; `wafLoudnessTrim(midi)` perceptual tilt (+2.5 dB <150 Hz → flat → −1.5 dB >2 kHz) on every sampled voice; the bent-note oscillator fallback now level-matched (incl. trim) to the sampler it replaces (kept the audible slide — the chosen fork; oscillator-only profiles unchanged). Smoke-green (renderers exercise the audio path). **Numbers are first-pass — Christian to tune by ear next pass** (the loudness curve dB points + the bent-note match level). **Follow-up fix (committed):** the async WAF preset load made playback START on the oscillator and SWAP to WAF mid-exercise — fixed by making `ensureWafPreset` awaitable + `prewarmVoices()` at generate + `awaitVoices()` (capped) before the first pass schedules, so Play starts on the sampled voice. Verified via probe (preset global loaded at generate; clock advances).
- **B — WAF for ALL backing + synth FAILOVER — ✅ BUILT 2026-05-31 (core; mix-carve deferred to ear-tune).** Clean/electronic family + `GLOBAL_AUDIO_DEFAULT` comp default → **sampled e-piano (GM 4)**; acoustic already sampled. The per-voice synth-pad **failover is KEPT** — confirmed *not* redundant even after the prewarm/await fix: it's the only thing between a missing/offline/slow-cold-load and silence (degraded-but-audible > silent). **Distorted family keeps the synth pad** (a sampled e-piano under metal is a regression; the distorted comp's real voice is the NAM amp, in progress). Added `1/√n` density-scaling on the comp (anti-clip). Verified via probe (comp loads as sampled e-piano `_tone_0040`, clock advances, no errors). **Deferred to the pinned ear-tune pass:** the mix carve (HP ~120 Hz on comp, 1–2.5 kHz dip) + exact relative levels (player 0 / bass −5 / comp −11 / click −14) — by-ear.
- **C — Backing-voice selection → the Mixer — ✅ BUILT 2026-05-31.** Removed the `harmonyTone` form dropdown (single + session) + its `readConfig`/`resolveAudioProfile`/session/share-link plumbing. Added a per-channel **instrument `<select>`** on the mixer's Player/Comp/Bass rows (`MIXER_INSTRUMENTS` melodic/bass sets + `mixerInstrumentFor(key)`; `mixerState[key].instrument`, default `null` = use the style profile, persisted with the mixer state). The scheduler + `resolveVoiceGms` honor the override (override wins over profile); changing it loads the voice via `awaitVoices` and re-schedules live if playing. Verified via probe (form dropdown gone; 3 selects render; Comp→Organ loads `_tone_0190`; no errors). **Still in the mixer-growth build (GUI #6, design-system §11):** the master-output channel, user-resizable pane, and horizontal→vertical strip re-orientation past a size threshold.
- **D — DRUMS (the realism unlock, last) — ◐ GROUP-DESIGNED + D1–D3 BUILT 2026-05-31 (uncommitted).** 4-agent session (audio-engine · sound-design · rhythm-meter · drum-pedagogy); main thread synthesized + built the zero-asset synth path. Full spec: project memory `project_drums_phase_d_spec` + the four `.claude/agent-memory/*/…drum…` files. **CORRECTION to the old plan:** do **NOT** ship generic GM **bank-128** as the sound (that's the cheesy kit). New direction: **synth-808/909 (procedural Web Audio, zero-asset, zero-licensing, doubles as the never-silent failover) for electronic genres; curated CC0 WAF one-shots for acoustic; the KIT changes per genre** (`kit` field on the ensemble `AUDIO_PROFILES`).
   - **✅ BUILT D1–D3 (screen.js, uncommitted):** `KIT_REGISTRY` (kit_909/kit_808 synth) + `DRUM_KIT_FAMILY_DEFAULT`; `AUDIO_PROFILES`→ensemble via a resolved `drums:{kit,level}` in `resolveAudioProfile`; `DRUM_GROOVES` (straight_8th_rock · four_on_floor · half_time · shuffle_blues) + `resolveGroove(cfg)` + `buildDrumEvents(cfg,dur,groove)` (per-voice lane cell on a `div` grid, open-hat choke); concat into `backingEvents` in `makeBundle` BEFORE the count-in shift + swing; `applySwingToBundle` skips `noSwing`; a dedicated `drums` sub-bus in `trackBus` (comp −18/3:1/5ms/120ms BEFORE master + >8 kHz shelf −3; master −6/12/6 untouched); `scheduleDrumHit(ctx,kit,piece,when,vol,dur)` synth voices (909/808 kick · snare crack+tone · hats w/ choke · clap · toms · synth crash; 4 ms attack ramp); `role:'drums'` scheduler branch (count-in gate, drums skipped in the harmony loop); mixer **Drums channel + kit picker** (`mixerKitFor`, `MIXER_KITS`, live re-schedule). **Verified:** 64/64 generators · 4/4 renderers · highway-settings green + a drums probe (straight=96 evts kick/snare/hat not-pre-swung · shuffle all-noSwing · count-in minT≥leadIn · playback no drum errors). Per-piece gains/levels are first-pass → **ear-tune** with the rest of the pinned pass.
   - **Locked (agent-convergent):** (1) `role:'drums'` events in `backingEvents`, **one voice per event** `{t,end,role,voice,velocity,accent,ghost?,micro?,noSwing?}` (not grouped `hits:[]` — per-limb micro-timing is the believability crux). (2) `wafDrumVoice()` = `wafVoice` **minus `wafLoudnessTrim`** (a drum note# is a piece selector, not a pitch). (3) new `drums` bus → **drum-bus comp BEFORE master** (start −18/3:1/5ms/120ms), **master −6/12/6 untouched**, 3–6 ms attack ramp/hit, >8 kHz shelf −3…−4, kick HP 30–40 Hz, **drums silent the whole count-in** (`if(ev.t<lead)continue`). (4) **don't humanize electronic kits** (the tightness IS the genre); acoustic gets ghosts/jitter/micro. (5) **kit(sound)≠groove(cell)** — reggae=one_drop, NOLA=second_line, metal=relaxed kick ceiling. (6) `applySwingToBundle` skips `noSwing` (pre-swung jazz/shuffle triplet cells); straight cells ride the global warp. (7) build front-loads the zero-asset synth path (ships before any sample licensing clears).
   - **Engine map:** `buildDrumEvents(cfg,contentLen,groove)` (sibling of `buildBoogieBacking`) concats into `backingEvents` **before** the count-in shift + swing → free count-in-silence + post-swing; `role:'drums'` branch in `schedulePreviewAudio` (`wafDrumVoice` sampled / `scheduleDrumHit` synth); `KIT_REGISTRY` + `AUDIO_PROFILES.drums:{kit}` (`resolveAudioProfile` GLOBAL←family←profile←mixer; family default electronic→909/acoustic→soft/else→rock; STYLE_PALETTES inherits via `audioProfile`, no new field); mixer Drums channel + `mixerKitFor`; groove = declarative per-voice lane cell on a `div` grid + `fillEvery`; soft drop-oldest voice cap (peak ≈8–14, ≤~20 WAF/≤1 NAM); lazy-load active kit only.
   - **Build queue:** ✅ **D1** engine plumbing + synth kit + straight groove (committed `a67ec29`) · ✅ **D2** full 808/909 recipes + four_on_floor/half_time + shuffle_blues (`a67ec29`) · ✅ **D3** KIT_REGISTRY + ensemble AUDIO_PROFILES + selection + mixer Drums/kit picker (`a67ec29`) · ✅ **D4** sampled acoustic kits **BUILT 2026-05-31 (uncommitted)** — self-hosted **FluidR3_GM** WAF drum one-shots (14 pieces, ~484 KB, MIT — same provenance as the JCLive melodic tones) under `static/wafonts/`; `loadWafPreset(key,var,url)` generalized + `ensureDrumPreset`; `wafDrumVoice()` = `queueWaveTable` **minus `wafLoudnessTrim`**; `scheduleDrumHit` dispatches sample→`wafDrumVoice` / cold-load→synth-909 fallback; `KIT_REGISTRY` sample kits (kit_rock/kit_acoustic_soft/kit_jazz share the FluidR3 set, differ by level); `resolveDrumKit` returns the kit object; jazz→kit_jazz, bluegrass→kit_acoustic_soft, family-default clean/distorted→kit_rock; core pieces prewarm/await (cymbals/toms lazy-load); mixer kit picker lists the sampled kits. **Brush/percussion sample sets = later curation.** · **also BUILT: ODD-METER drum handling** — `buildDrumEvents` now meter-checks (authored cells are 4/4); any other meter degrades to `buildGenericDrumGroove` (kick on `cfg.meter.grouping` group-starts, snare on the last, hat per beat — 7/8 = 2+2+3 → kicks 0,2 / snare 4, never a wrapped 4/4 cell). · **D5** humanization (ghost/velocity/micro values from drum-pedagogy) + reggae one_drop/NOLA second_line/metal double-kick/funk_16th grooves + fills (`fillEvery`) + brush-kit curation · **D6** kit_latin/kit_afro (heaviest + genre-agent patterns) · reverb send · opt kit_metal.
   - **Kit→genre map (proposed; genre-idiom vet pending as palettes land):** blues→kit_rock/shuffle_blues · rock→kit_rock/straight_8th · metal→kit_rock(tight)/double-kick · jazz→kit_jazz/swing_jazz · funk→kit_rock/funk_16th · pop→kit_rock/straight_8th · country→kit_acoustic_soft · gospel→kit_rock · (forward) disco/synth-pop/electronic→kit_909/four_on_floor · reggae→kit_rock/**one_drop** · new-orleans→kit_rock/**second_line** · latin→kit_latin · afrobeat→kit_afro.
   - **Open forks (recs landed; Christian's call):** F1 acoustic sourcing = curated CC0 *(rec)* vs 3rd-party soundfont · F2 electronic = synth *(rec, landed)* · F3 punch = conservative-start, lever is drum-bus comp makeup *(rec; parks to ear-tune)* · F4 metal = tightened kit_rock v1 *(rec)* vs kit_metal now · F5 disco = 909-dance *(rec)* vs classic-acoustic · F6 pop = kit_rock default *(rec)* vs 808 variant · F7 reverb/ambience send still MISSING (carry-over from B).

**Voice-cap budget (B–D):** ≤ ~8–20 simultaneous WAF voices (cap, drop oldest); ≤ 1 NAM worklet ever; lazy-load presets per active style only.

**Open forks for Christian:** (1) bend handling — default = keep the slide + level-match (built); alt = sampler-at-target, no slide, perfectly consistent. (2) drum punch vs. softness (Phase D) — start conservative; the punch lever is the drum-bus compressor makeup, NOT a looser master limiter. (3) the reverb/convolver aux send still doesn't exist — blocks the "backing ambient, player dry" carve; ship B's level+HP+dip carve first, ambience as a follow-on.

### ⏸️ STOPPED HERE (2026-05-31) — Audio A+B+C + Phase D1–D4 (synth + sampled drums) + odd-meter handling BUILT; NEXT = D5 (humanization)
Phase A/B/C + **D1–D3 committed (`a67ec29`)**. This session: **D4 (sampled acoustic kits) + odd-meter drum handling BUILT, UNCOMMITTED** — see the Phase D bullet for the per-symbol detail. Built + smoke-green (64/64 gen · 4/4 rend · highway-settings) + the drums probe (11 checks: straight/shuffle/count-in + 7/8 generic-groove kick-on-group-starts + FluidR3 sample load + no errors). **D4 added 14 FluidR3_GM WAF drum files (~484 KB) under `static/wafonts/` — TRACKED + UNCOMMITTED; FluidR3 is MIT (same redistribution caveat as the bundled JCLive melodic data — verify before any public release).** **Ear-tune still PARKED** (A/B numbers + the drum per-piece gains/levels + the sampled-kit relative balance) for one listening pass — safe/normalized only (`feedback_audio_safety_not_personal_sensitivity`). **NEXT:**
- **D5 — humanization + per-genre grooves:** fill the `velocity`/`ghost`/`micro` hooks with drum-pedagogy's ranges (acoustic only; electronic stays tight); add reggae `one_drop`, NOLA `second_line`, metal double-kick, `funk_16th`; fills via `fillEvery`; curate a brush sample set so kit_jazz isn't the standard kit played soft.
- **D6 + follow-ons:** kit_latin/kit_afro (genre-agent patterns) · reverb/ambience send (F7, carry-over from B) · opt kit_metal · authored odd-meter cells (the generic keep covers v1).
- **Genre-idiom vet** the kit→groove map (esp. reggae one-drop / NOLA second-line / latin-afro) as each style's palette lands. Also still open in parallel: **mixer-growth GUI #6**, the rest of the **GUI build queue (#2→#7)**, the **progress-store** item. **Drum probe kept:** `.claude/skills/run-slopscale/probe-drums.mjs`.

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
