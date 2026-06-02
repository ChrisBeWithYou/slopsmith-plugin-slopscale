# SlopScale Design System

> The single reference for SlopScale's GUI: principles, tokens, control taxonomy,
> layout rules, and the locked design decisions. Read this before changing button
> placement, adding a control, or restyling anything in `screen.html`/`screen.js`.
>
> **Source:** the four-lane GUI design audit of 2026-05-31 (UX-chaired, with
> learning-design, gamification, and market-analyst lanes; synthesized by the main
> thread). Per-lane raw findings live in each agent's `.claude/agent-memory/<agent>/`.
>
> **Where CSS lives:** the one loaded stylesheet is the inline `<style>` block in
> `screen.html`. `static/slopscale.css` is dead — do not edit it. All tokens are
> `--ss-*` custom properties on `:root` so the host can repaint and the accent
> themes work; **no raw hex in component CSS** (see §2, §10).

---

## 1. Principles

1. **One lit primary action per mode**, sized to its label (≤360px), docked to the
   content it launches. Never a full-width slab. (The ultrawide START-CTA banner was
   the canonical violation — see §9.)
2. **Recognition over recall.** Labelled controls beat icon-only for any non-obvious
   action. (Why the Setup/Play pill survives and the `⟨ ⟩` icon button was removed — §B1.)
3. **Token-driven, theme-paintable.** Every color comes from a `--ss-*` token so the
   host can repaint and the accent themes (blue/ember/violet) recolor the *whole* UI,
   not just a handful of buttons.
4. **Native to the host.** Match Slopsmith's flat-pill transport language; SlopScale
   should read as a first-class part of the host, not bolted on.
5. **Safe, normalized audio & reduced-motion-aware.** Standard loudness limits — no
   clipping, no gratuitous full-volume transients, no victory stingers, predictable
   starts (the audio we serve users should meet normal safe-audio practice, not a
   personal accommodation); all slide/transition gated by `@media (prefers-reduced-motion: reduce)`.
6. **Practice-not-generation in all copy.** Verbs are *drill / build / run / play
   along*, never "generate a song/riff." Jam stays "a mirror, not a judge / find your
   own voice." This is load-bearing positioning **and** north-star — protect it.
7. **Progress is a map, not a scoreboard.** Bands are chapters, pathways are
   skills-owned, tiers are speeds-cleared, modes are phases-of-mastery. Every progress
   element answers "where am I in *learning the instrument*," never "what's my rank."

---

## 2. Tokens (`--ss-*`)

**Live families** (on `:root` in `screen.html`):
`--ss-bg-0/1`, `--ss-surface`, `--ss-surface-bar`, `--ss-inset`, text scale
`--ss-text*`, `--ss-border`, `--ss-hairline`; accent `--ss-accent`, `-hover`,
`-soft`, `-grad`, `-edge`; semantic `--ss-playhead`, `--ss-danger`, `--ss-meter`;
spacing `--ss-sp-1..5`; radius `--ss-r-control/panel/pill`; type `--ss-mono`;
elevation `--ss-shadow-panel`.

**Add these missing semantic tokens** — they are the hardcoded hex that recurs
dozens of times for the same roles (the single biggest "themes only half-work" cause;
the accent themes can't reach raw hex):

| Token | Value (current literal) | Role |
|---|---|---|
| `--ss-track` | `#141d33` | segmented-control / fader track bg |
| `--ss-btn` | `#172033` | secondary button bg |
| `--ss-btn-hover` | `#24324a` | button/segment hover bg |
| `--ss-hover-soft` | `#1e293b` | chip / menu-item hover |
| `--ss-stop` | `= var(--ss-danger)` | transport-stop / is-playing state (owns the "non-now" red) |

Migration list in §10.

---

## 3. Spacing scale

4px base → `--ss-sp-1..5` = 4 / 8 / 12 / 16 / 24. Gaps and paddings use tokens, not
literals. Panels `padding: 16px` (sp-4); control rows `gap: 8–12px` (sp-2/3); section
separation via the `.slopscale-group-title` hairline.

---

## 4. Button & control taxonomy

| Tier | Use | Recipe |
|---|---|---|
| **Primary CTA** | the one "begin/launch" per mode | `--ss-accent-grad`, `--ss-accent-edge` border, `min-height: 48px`, `max-width: 360px`, flips to `--ss-stop` while playing |
| **Transport** | play / nudge / loop in the control cluster | flat `--ss-accent` (play), `--ss-track` (sub-buttons), small (28–34px) |
| **Secondary** | Regenerate / Save / Share / Cancel | `--ss-btn` bg, `--ss-border`, `min-height: 38px` |
| **Toggle (pill)** | boolean (e.g. fretboard view) | `.slopscale-pill-toggle`, `--ss-accent` when on |
| **Icon** | settings ⚙, sheet close ✕ | 32×32, `--ss-inset` bg, label via `title` + `aria-label` |

---

## 5. The only two "pick one of N" families

Today there are **four** divergent segmented/chip treatments for the same gesture
(`.slopscale-mode-btn`, `.slopscale-modeview-btn`/`.slopscale-feel-btn`,
`.slopscale-tp-seg`, `.slopscale-band-btn`/`.slopscale-jam-style`/`.slopscale-instr-btn`).
Collapse them to **two sanctioned families**, one active-state recipe each:

- **Segmented control** (`.ss-seg`) — mutually exclusive, fixed small set, stateful.
  One track (`--ss-track`), inset separators, active = flat `--ss-accent`.
  *Use for:* mode-view (Setup/Play), Feel, Count-in, view-switcher tabs.
- **Chip group** (`.ss-chip`) — selectable set, may be many, may scroll. Bordered
  chips, active = `--ss-accent-grad`.
  *Use for:* band bar, pathway list, jam styles, instrument family, string count.

**Retire** the one-off `.slopscale-mode-btn.active` literal gradient
(`linear-gradient(180deg,#1e3a8a,#1e40af)`) → use `--ss-accent-grad`.

---

## 6. Panel & overlay patterns

Exactly these idioms — **do not invent new overlay types.** Slide panels overlay the
stage (never relayout → no renderer-refit storms). All `transform` transitions sit
under the `prefers-reduced-motion` rule.

| Surface | Motion | Close |
|---|---|---|
| Mixer (`M`) | slide **up** from bottom, overlay-not-relayout, resizable | `▾` + Esc/outside-click |
| Progress (`P`) | slide in from **right** edge | `✕` + Esc |
| Cheat-sheet (`?`) | centered modal + scrim | `✕` + Esc/scrim |
| Pack manager | **reuse the cheat-sheet modal idiom** | `✕` + Cancel |
| Setup / Settings popovers | header dropdown, instant | outside-click |

Close-glyph convention: slide-in sheets/modals get `✕`; the mixer keeps `▾`
(directional "dismiss down") **and** gains Esc/outside-click for parity.

---

## 7. Responsive & ultrawide rules

- App shell `height: 100vh`; only the Inspector rail scrolls. Below 1100px the rail
  stacks above the stage and the page scrolls.
- **Header degrade order** (protect primary nav longest): tagline → Setup label
  shortens (1120px) → view-bar secondary toggles hide (1000px) → mode segments →
  `Mode ▾` dropdown last (880px).
- **@1800px ultrawide:** stage caps `minmax(0, 1700px)`; rail becomes 2-col
  `minmax(660px, 800px)`.
  - **Only *content* spans `grid-column: 1/-1`:** section headers, helper text, the
    audio-options grid, segment lists, the goal caption.
  - **Actions never span.** Primary CTAs cap at 360px, left-aligned in column 1. A
    banner spans; a button does not. (This rule is what permanently prevents the
    START-CTA-as-slab regression.)

---

## 8. Color semantics (hard rules)

- **`--ss-meter` green** = the **only** progress / cleared / target fill. Tier cleared,
  calendar *competency* state, jam highlight, future XP bars. **Nothing else is green.**
- **`--ss-playhead` red** = the moving "now" marker **only** (ruler playhead). Never a
  button, never a status.
- **`--ss-stop` (= `--ss-danger`) red** = transport-stop / is-playing button state. The
  *only* other sanctioned red, distinct from playhead-red by role.
- **Activity ≠ competency:** practiced-day calendar dots use **accent blue**, never
  green. "I showed up" is not "I cleared a skill."
- **Accent** (`--ss-accent*`, themeable) = selection / active / armed / primary.
- **Dropdowns follow the dark UI (2026-06-01).** The app/host is **dark-only** (no light
  scheme — SlopScale's themes only recolor the *accent*, and the host has no light mode).
  So native `<select>` dropdowns render dark: `.slopscale-root` declares
  **`color-scheme: dark`** (the host never declares it, so the plugin must — otherwise a
  bare select inherits Tailwind's light text on a default-light popup → low contrast),
  and `.slopscale-root option` carries the dark list styling (`#111827`/`#f8fafc`) the
  form selects already use, now applied to **all** selects incl. ones outside
  `.slopscale-controls` (the bug was the Setup-popover tuning selector). Don't hard-code
  black-on-white — go with the host's dark flow.

---

## 9. The "primed primary" pattern (one lit primary per mode)

**Rule:** *one lit primary per mode, sized to its label, docked to the content it
launches, capped at 360px, flips to stop-red while playing.* All four modes share one
`.slopscale-primary-cta` class:

- **Pathways:** the START button (today `#slopscale-start-cta` — width now capped; the
  larger restructure below is queued).
- **Custom:** add the same primary at the end of the form (today Custom has *no* in-rail
  primary — gap G3).
- **Workout:** `#slopscale-launch-session` → reskin to the shared component (today full-width `.primary`).
- **Jam:** `.slopscale-jam-go` → same component.

The transport-bar Play button stays the *transport's* play (small, in the cluster). The
in-rail CTA is "begin this thing"; the transport Play is "it's loaded, control it."

**Onboarding / ease-in (the #3 fix, full form — queued beyond the width cap).** At the
moment of entry into a chosen pathway a learner needs exactly three things, in order:
**(1) what skill am I building** (named competency, not mechanics) · **(2) what does
"done" look like** (the goal / mastery cue) · **(3) the one first action** (press Start).
Today the CTA conflates these and repeats the pathway name already shown in the picker.
Target shape:

```
band bar  →  pathway list (active row lit)  →  one-line orientation block  →  ▶ Start
```

- **Orientation block** (reading, not a button): `Core · Beginner · 3 of 6` breadcrumb ·
  one-line competency ("Builds: navigate min-pent box 1 over a vamp") · quiet mastery
  cue ("Clear all 4 speeds to advance"). This is the goal-card, promoted above the
  picker and trimmed to one line.
- **Start button:** label-sized, `≤360px`, verb + name only; the skill hook moves up
  into the orientation block.
- Static preview, **no auto-play, no modal intro** stays (a predictable, non-startling
  start; the primed-CTA model is market-right — confirmed by all non-UX lanes).

---

## 10. Migration checklist (token + dead-code)

**Hardcoded-hex → token:** `#141d33`→`--ss-track`, `#24324a`→`--ss-btn-hover`,
`#1e293b`→`--ss-hover-soft`, `#172033`→`--ss-btn`; the `.slopscale-mode-btn` literal
gradient → `--ss-accent-grad`.

**Dead code / orphans:**
- `#slopscale-mode-desc` — `syncModeBar` writes it and CSS exists, but the **element is
  absent** (the "what is this mode" line never renders). Decision: **add the element**
  as the first line of the Inspector (cheap activation legibility) — wiring already
  exists. (Queued.)
- `.slopscale-sticky-modes` / `.slopscale-collapse-wrap` — orphan CSS (the mode switcher
  moved to the header). Remove. (Queued.)
- `#slopscale-collapse-btn` — **removed 2026-05-31** (§B1).

---

## 11. Component IA — Mixer & Pack Manager (specs for the build)

### Mixer (`M`) — growth rules
Keep the bottom slide-up overlay (correct DAW metaphor), but it becomes a docked,
**resizable, overlay-not-relayout** panel as it grows. **Never start relaying out the
stage** on resize (that triggers renderer refits every drag) — the chart sits behind it.

- **Orientation switch:** *compact/short* = horizontal rows (today's
  `58px 30px 30px 1fr 40px` grid: label · M · S · fader · val). *Tall/wide* = re-orient
  to **vertical DAW strips** in a horizontal flex row. Trigger: mixer height ≥ ~340px
  **OR** channel count ≥ 6 **OR** stage ≥ ~1100px-and-user-resized-taller. Use a
  `.ss-mixer-vertical` class (cleanest: `container-type: size` + an `@container` query;
  else a JS height/width check in `renderMixer` / a `ResizeObserver`).
- **Channel-strip anatomy** (vertical, top→bottom): name (truncating) · **instrument-type
  `<select>`** (the new per-channel voice choice; only Player/Comp/Bass — Click/Master
  get none) · **vertical fader** (the defining gesture, most height) · dB/level value
  (mono, tabular) · M / S pair (bottom). Horizontal keeps today's order; the dropdown
  inserts between label and M.
- **Master channel:** add a `master` entry to `MIXER_CHANNELS`, pinned **last**,
  visually separated by a `--ss-hairline` (it's the sum, not a peer). Fader + value +
  optional mute; **no solo, no instrument dropdown.** Label "Master / Out." Backing-dim
  stays the head-row checkbox.
- **Resizable:** top drag-handle (6px grab strip) adjusts height min ~140px (rows) ↔
  max ~80% of stage; crossing the threshold flips orientation. Persist height in
  `localStorage['slopscale.mixerH']` alongside the existing mixer state.
- **Mirror-not-judge guard:** any future master meter is a **loudness/level meter,
  never a performance/accuracy score.** No "mix score," no "% balanced."

### Pack manager — the `+` on the Development Pathways list
- **Entry point:** a trailing `+` chip on the **band bar** (`.slopscale-band-btn.add`,
  right-aligned) — "add a family/pack." Not on rows (implies per-row add), not the header.
- **Popup:** reuse the **cheat-sheet modal idiom** (centered card + scrim + `✕`). Do not
  invent a third overlay style. Two-column transfer list:

```
┌ Pathway Packs ─────────────────────────── ✕ ┐
│  Available              Installed             │
│  ┌────────────┐  [ > ]  ┌────────────────┐    │
│  │ Funk / R&B │  [ < ]  │ ▸ Core (pinned) │    │  ← Core: pinned, lock glyph, not draggable
│  │ Gospel     │         │ ▸ Metal         │    │
│  │ Surf       │         │   Blues  ⋮⋮      │    │  ← others: draggable (⋮⋮ grip)
│  └────────────┘         └────────────────┘    │
│                          [ Cancel ] [ Save ]   │
└───────────────────────────────────────────────┘
```

- **Move:** drag a row between columns **OR** select-then-`>`/`<` (dual affordance —
  drag for mouse, buttons for keyboard/a11y). The columns *are* the install state.
- **No deletion** anywhere — moving to "Available" = not installed. (Matches the spec:
  never delete a pathway.)
- **Core pinned first, in order:** Core packs render at the top of "Installed" with a
  lock glyph, `cursor: default`, not draggable, `<`/move-out disabled while active.
  Non-core packs sort below, user-orderable via drag; a `--ss-hairline` separates the
  pinned block from the orderable block.
- **A "pack" is a coherent curricular unit** (one instrument's Core spine, or one Style
  branch) with an internal arc and declared Core prerequisites. A Style pack carries a
  visible **"Builds on: [Core competencies]"** line (informational, never a lock).
  Core is internally immovable (Beginner→Int→Advanced is a staircase, not a preference)
  and undeletable; Style packs are parallel and freely orderable among themselves.
- **Commit model:** mutate nothing live until **Save** (persists order + install state
  to `localStorage['slopscale.packs']`); **Cancel** discards. Standard primary `Save` +
  secondary `Cancel`.
- Reuse `.slopscale-pw-row` / `.slopscale-segment-card` row styling so the transfer list
  reads as "the same pathways, relocated."

**✅ BUILT 2026-06-01** (group-designed: ux-designer + learning-design; commit pending). As-built decisions:
- **A pack === a band** — `PATHWAY_BANDS` gained `kind:'core'|'style'`, `pinned` (Core), and `buildsOn` + `family` (Style); no parallel registry. A startup integrity guard throws if a Style pack lacks `buildsOn`/`family` (pack-layer analog of the no-unison guard).
- **Core = THREE pinned packs**, not one (the mock's single "▸ Core (pinned)" became three rows: Beginner/Intermediate/Advanced). The Beginner→Advanced climb must *read* in the manager (§12). Christian's call; chose 3 over 1.
- **Core is derived in code, not stored.** `localStorage['slopscale.packs'] = { installed:[styleIds], order:[styleIds] }` tracks **Style packs only**; Core always renders pinned-first regardless (corrupt/empty storage still yields a full curriculum).
- **First-run default = Core only** (Christian's call) — all Style packs start in Available; the `+` IS the breadth-reveal. Future-shipped packs land in Available (opt-in), not auto-installed.
- **Available column groups by `family`** (`PACK_FAMILY_ORDER`) so a 20+ roster reads as a curriculum map; Installed stays flat.
- Overlay is its **own** class (`.slopscale-packs-modal` + root `ss-packs-open`, `togglePackManager()`), *not* `.slopscale-cheatsheet` — sharing that class would let the cheat-sheet's open-state also reveal the pack modal. Reuses the cheat-*card* chrome only. Move via drag **or** `‹`/`›`; commit-on-Save (draft copy); scrim/✕/Cancel discard. **Esc is NOT bound** (host owns Escape — supersedes the §6 "Esc" column for this modal).
- **Note for whoever adds Style packs:** today there are 3 broad Style bands (the §11 mock imagined per-genre Funk/Gospel/Surf); the manager operates on bands, so the model is unchanged — new packs just need `kind:'style'` + `buildsOn` + `family`.

---

## 12. Learning-journey expression (the arc must read)

The single biggest pedagogical gap: **the four modes and the Core/Style bands render as
flat parallel tabs, not an easy→mastery climb.** Express the arc consistently at three
nested scopes (same "current"/"next" language at every zoom):

- **Within a pathway:** tempo tiers (Slow→Push) = the arc. **Label the tier-dots**
  (`TIER_LABELS`) in the picker, not just in `P`.
- **Within Core:** bands Beginner→Advanced = an ordered **climb**, visually distinct
  from the *lateral* Style chips (Blues/Country/Metal). Two axes — don't flatten them
  into one undifferentiated row.
- **Across modes:** Pathways→Custom→Workout→Jam = drill → deliberate-practice →
  transfer. Give the mode bar a faint left-to-right "drill → transfer" reading so the
  four modes don't look like four random tools.

**Fix the dead-end (highest learning leverage):** the `→ next` cue currently stops at
the band boundary — when Beginner is cleared, `→ next` *vanishes* at the exact
Beginner→Intermediate gate where learners quit. Make `→ next` **cross band boundaries**
(Beginner-cleared → "→ next: Major Scale CAGED, in Intermediate"). The arc must never go
silent at a seam.

**Vocabulary (use consistently):** *band* = chapter (ordered for Core, parallel for
Style); *pathway* = a rung / one competency (never "level"); *tempo tier* = a
speed/difficulty step within a rung; the *four modes* = phases of how you practise one
skill. Difficulty labels are **invitations, not walls** — a Style band a beginner hasn't
earned shows "Builds on Beginner Core" (informational), never a lock.

---

## 13. Anti-dark-pattern guardrails (gamification — hard rules)

- **Only ever show XP/progress *gained* — never "lost," never a deficit/deduction.**
- **No FOMO / loss-aversion:** a missed day is a blank dot, never a red mark or a
  "don't lose your streak!" nag. Streaks have grace; absence is silent.
- **No audio victory stingers** — celebratory cues are gentle *visual* moments (the
  tier-glow), never a sound (visual-first; we don't fire gratuitous audio at users).
- **The whole layer toggles Off / Casual / Hardcore.** Off collapses to a bare
  functional tool (the standing proof gamification never gates). Hardcore's stricter
  rules are opt-in *bonus recognition*, never penalties.
- **No scores / ranks / combos / leaderboards anywhere**, incl. Jam and any future
  master channel.
- A reward is a **state change on a real artifact** (a tier dot fills, a row clears, a
  streak ticks), not a trophy popup. Progress describes what you did; it never blocks
  what you can do.

---

## 14. Audit decision log (2026-05-31)

**Decided + (B1) shipped:**
- **B1 — collapse-toggle repeat (your #4):** it was a *triple* (Setup/Play pill +
  `⟨ ⟩` icon button `#slopscale-collapse-btn` + `[` hotkey, all → `setPanelCollapsed`).
  **Keep the labelled Setup/Play pill + the `[` hotkey; remove the unlabelled `⟨ ⟩`
  button.** ✅ shipped 2026-05-31.
- **B2-width — the ultrawide START-CTA (your #3):** root cause = `width:100%` in a rail
  that widens to 660–800px @1800px. **Cap at `max-width:360px`.** ✅ shipped 2026-05-31.
  The full onboarding restructure (§9) is queued.
- **First-run intro popup (your #2):** **no modal — by design.** The primed-CTA model
  (one lit primary, static preview, no survey/coach-marks, ≤90s to first note) is
  market-right; lean on the (to-be-added) `mode-desc` one-liner as the ambient "what is
  this." Don't add a blocking onboarding step.

**Decided 2026-05-31 (Christian):**
- **B2-shape: the goal-caption version** — Pathways' primary is one Start button *below
  the goal caption* (not docked to the picker row), for cross-mode consistency (the
  shared `.slopscale-primary-cta`), cleanest top-down reading order, and a simpler build.
  The onboarding restructure that places it is queue item #2.
- **Session-end summary card: YES — BUILT 2026-05-31.** A calm, dismissible "Last
  session" card at the top of the P sheet (`sessionSummaryCardHtml` + `presentSessionSummary`),
  fed from the just-ended session in `sessionEnd()`; gently auto-presents (opens P) on a
  notable end (a tier cleared, or a ≥20s run), else refreshes silently. Descriptive +
  gained-only (what you practised · time · tempo-tier · streak); meter-green only for a
  freshly-cleared tier; no score/rank. Needs no XP store.

**Decided 2026-06-01 (Christian) — rhythm controls & Preview-Audio consolidation**
(the "preview panel is redundant now there's a Mixer / consolidate the BPM that shows
up twice / DAWs keep rhythm settings by the transport" pass; five-lane group-design,
ux chaired, host/sound-design/L&D/gamification lanes). **Folds into the queued §9 + §11
builds — captured, not built now** (queue item #9):
- **Organising principle (the call behind the rest):** *generation params* (reshape the
  chart — meter, division, key, scale, bars) stay in the Inspector, Custom-gated;
  *playback/feel params* (count-in, loop, transport) live by the transport. Transport
  contents are **mode-aware** (Pathways: tiers + count-in + loop; meter/division only in
  Custom). ux proposed a §4a taxonomy note for this — queued, not yet written.
- **Preview Audio panel — retire it.** sound-design verified the three toggles are *pure
  playback mutes, not generation gates* (read only in `schedulePreviewAudio`,
  `screen.js:~6376-6507`; the chart is identical either way) — safe to fold into per-bus
  control. But they carry pedagogy (mute backing = self-test; mute notes =
  play-by-ear/minus-one; mute click = the T1 hold-tempo test), so they must **not** vanish
  into the hidden Mixer overlay: surface **Click / Backing (± Notes) as small,
  practice-framed toggles next to the Mixer button** in the view bar (else best fit in the
  transport area). Preserve: all buses default un-muted; count-in always clicks even with
  the click bus muted (carve-out stays in the scheduler); 30 ms ramped mute/tone (no zipper).
- **"Backing tone" (brightness) → a per-channel Tone knob on the harmony/comp channel in
  the Mixer** (rides with §11 mixer-growth). Flag for audio-engine: near-dead today (only
  shapes the oscillator pad / distorted family; sampled harmony ignores it) — wire it to
  the sampled path when it moves.
- **Feel stays in the Inspector** — it's a *skill being practised* (swing/shuffle = a T1
  rhythmic competency), not a playback knob. No transport mirror.
- **BPM de-dup:** the SPEED tiers stay the **primary learning ladder** (labelled rungs +
  cleared-✓ + the one `tier-glow`); the precise BPM field is the **readout/override of the
  active tier**, Custom-precise. Never *blank* the tier-dots when BPM is nudged off-tier
  (show "between Fast and Push"). Count-in is already a clean one-source model (inspector
  source + transport mirror + settings default) — leave it. **Anti-dark-pattern (hard):**
  no "tempo PR / fastest-cleared" badge on any transport tempo control — the ✓ + glow on
  the ladder are the only sanctioned tempo recognition; a knob shows a number, never a
  celebration.
- **Glance strip (`#slopscale-summary`) — keep whole** (Key·Tempo·Meter·Bars·Length·Notes);
  Christian's call — the Tempo/Meter echo of their controls is accepted for one "what I
  generated" block. (Note: it *does* exist — populated by `summarize()`; an earlier review
  grep missed it.)
- **Host check (slopsmith-host-expert):** the host exposes **no** tempo/meter/count-in/
  transport control, and its mixer registry (`window.slopsmith.audio.registerFader`) is
  player-screen-gated/unusable on our screen — so this is a pure internal cleanup, nothing
  to borrow; **match** only the host chrome grammar (single small-pill transport row,
  `accent-accent` sliders, popover mixer, loop A/B). See agent-memory
  `reference_host_transport_mixer.md`.

**Confirmed clean (no action):** progress signals are de-duped (chip owns `P`; three
calm signals present, unduplicated); mixer/Jam are mirror-not-judge today.

**Verified (2026-06-01):** the `tier-glow` celebration lives on the **SPEED tier buttons**
(`.slopscale-tier-btn` — the tempo control), where it's alive and fires on a fresh clear
(confirmed by gamification's review). The picker-list `tree-tier-dot`s are a quiet
*readout* (they fill green on clear, now also labelled per §12) and intentionally do NOT
glow — the celebratory beat belongs on the control, not the readout. Nothing to rebind.

---

## 15. Build queue (GUI, post-audit — Foundation conforms to this doc)

1. ✅ **B1 toggle dedupe** + **B2 CTA width cap** (2026-05-31).
2. **Onboarding restructure** (§9): orientation block + breadcrumb + the shared
   `.slopscale-primary-cta` across all four modes (fixes G3 — Custom's missing primary).
   *Start-button shape decided: below the goal caption (§14).*
3. **Token migration + dead-code cleanup** (§10): add the five semantic tokens, swap the
   recurring hex, add `#slopscale-mode-desc`, delete the orphan CSS, retire the literal
   gradient. (Unlocks full accent-theme recolor.)
4. **Consolidate the control families** (§5): `.ss-seg` + `.ss-chip`.
5. ✅ **`→ next` crosses band boundaries** + label the tier-dots + distinguish the Core
   climb from Style branches (§12) — BUILT 2026-06-01. In `renderPathwayList`: a
   cross-band cue (`.slopscale-pw-nextband`) appears when the active band has no
   un-cleared next rung, pointing forward to the next un-cleared pathway (click to
   jump); tier-dots carry `title`/`aria-label` tempo-tier labels (Slow→Push +
   cleared state); a `.slopscale-band-sep` hairline + `.slopscale-band-core/-style`
   classes split the Core climb from the Style branches in the band bar.
6. **Mixer growth** (§11): per-channel instrument `<select>`, master channel, resizable,
   vertical-strip orientation. (Pairs with the audio pass below.)
7. ✅ **Pack manager** (§11): the `+` + dual-column transfer modal — BUILT 2026-06-01.
8. ✅ **Session-end summary card** — BUILT 2026-05-31 (§14).
9. **Rhythm-controls & Preview-Audio consolidation** (§14, decided 2026-06-01) — *not a
   separate build; folds into the queued items*: the audio-toggle relocation + "Backing
   tone → Mixer Tone knob" ride with **#6 (Mixer growth, §11)**; the BPM-as-tier-readout +
   never-blank-the-dots rides with **#5 (tier-dots, §12)**; the generation-vs-playback
   placement + mode-aware transport informs **#2 (onboarding, §9)**. Feel stays Inspector;
   glance strip kept whole; introduces no new control family (respects #4).

**Separate track (not GUI — needs the audio agents):** the #1 audio work — per-note
velocity/volume consistency (entangled with the WAF-vs-oscillator voice split + GM
sample-level variance), WAF-for-all-backing with the synth as failover, and removing the
backing-voice override dropdown (its selection moves into the mixer per §11). Run
`audio-engine-architect` + `sound-design-architect` before building.

### Control inventory (excerpt — extend as controls are added)

| Control | id / class | Lives in | Family | Notes |
|---|---|---|---|---|
| Mode switch | `.slopscale-mode-bar` | header | segmented (nav) | gradient active; 4 modes |
| Setup popover | `#slopscale-setup-btn` | header | icon+label dropdown | instrument/strings/tuning |
| Progress chip | `#slopscale-progress-strip` | header | chip (P affordance) | opens P sheet |
| Settings | `#slopscale-settings-btn` | header | icon dropdown | accent/XP/count-in defaults |
| Pathway picker | `#slopscale-pathway-picker` | rail | chip group | band bar + list |
| Primary CTA | `.slopscale-primary-cta` *(planned shared)* | rail | primary | one per mode, ≤360px |
| Feel | `.slopscale-feel` | rail | segmented | stays in rail — skill, not transport (§14, 2026-06-01); unify with jam-feel |
| Practice toggles | `name=audioNotes/audioMetronome/audioHarmony` pills | stage view-bar, by Mixer | toggle (pill) | **BUILT 2026-06-01** — Notes/Backing/Click mutes; retired the Preview-Audio panel (§14) |
| Keep looping | `#slopscale-keeploop-toggle` | stage view-bar | toggle (pill) | **BUILT 2026-06-01** — off = finite right-sized run (Depth-Ladder run-length), on = infinite loop for open practice; Pathways/Custom only |
| View switcher | `.slopscale-view-btn` | stage | segmented (tabs) | renderer pick |
| Transport | `#slopscale-play` + cluster | stage | transport | play/nudge/loop/count-in |
| Setup/Play | `.slopscale-modeview-btn` | stage | segmented | **sole** collapse control |
| Focus | `#slopscale-focus-btn` | stage | icon toggle | fullscreen stage |
| Mixer | `#slopscale-mixer` | stage overlay | panel | TONE knob on Comp BUILT (absorbs "Backing tone", 2026-06-01); still planned → resizable, master channel, vertical strips |
| Pack `+` | *(planned)* `.slopscale-band-btn.add` | rail band bar | chip | opens pack modal |
