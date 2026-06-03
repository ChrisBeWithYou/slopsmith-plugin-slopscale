// SlopScale — Slopsmith practice chart generator + renderer adapter.
(function () {
  'use strict';

  // ===========================================================================
  // TABLE OF CONTENTS
  // One IIFE, loaded by the host as a classic <script> (no type="module", so no
  // import/export — see CLAUDE.md "screen.js structure"). Major sections are
  // marked with a "§N" banner below; grep "§" to jump between them.
  //
  //   §1  Constants & music-theory data
  //   §2  Curated pathways (PATHWAYS)
  //   §3  Built-in sessions (BUILT_IN_SESSIONS)
  //   §4  CAGED / 3NPS / Open shape system (CAGED_SHAPES, resolveCAGEDShape)
  //   §5  Chord-depth / diatonic extension engine
  //   §6  Voicing engine (docs/musicality-guardrails.md Layer 2)
  //   §7  Exercise builders (scale / chord-scale / arpeggio / sweep / chromatic / guide-tones)
  //   §8  generateExercise() dispatch
  //   §9  Session builders (segment / bpm-ladder / session charts, generateSession)
  //   §10 Exercise title + makeBundle()
  //   §11 Built-in 2D renderers (Jumping-Tab fallback, Tab, Notation)
  //   §12 Renderer factory + borrowed host viz
  //   §13 Live fretboard strip
  //   §14 Transport, HUD, playback clock + audio engine
  //   §15 DOM wiring (bind) + public surface (window.SlopScale)
  // ===========================================================================
  //
  // CORE / SHELL BOUNDARY (host-independence — see CLAUDE.md "Key constraints"):
  // The GENERATION PATH — generateExercise/generateSession (§8–§9) and everything
  // they call (data tables §1–§3, shape/voicing/theory engines §4–§6, exercise
  // builders §7, the pure chart helpers in §10) — is the host- AND DOM-independent
  // engine: SlopScale's durable IP and the basis for a future standalone app /
  // embeddable library. It takes a plain `cfg` and returns a plain
  // `{ version, session, chart }` (the CHART is the portable artifact) and must
  // NEVER reference window, document, localStorage, fetch, or any `slopsmith*`
  // global. Verified by smoke-core-purity.mjs (traps the host surface, runs every
  // builder). `makeBundle()` (§10) is the chart→renderer-bundle BOUNDARY — it reads
  // display prefs (highway inverted/lefty/render-scale/look), so it's the FIRST
  // SHELL step, not core. §11–§15 + routes.py are the THIN, DISPOSABLE SHELL;
  // Slopsmith is one implementation behind it. `readConfig()` (§15) is the single
  // DOM→cfg funnel. (Other shell helpers — the AudioContext patch, goScreen, $(),
  // the WAF loader — are physically interleaved in the §1–§10 line span but are
  // shell-class; the guard is behavioural precisely because the file isn't
  // physically partitioned yet — a future Step-1 module split relocates them.)
  // ===========================================================================

  // ===========================================================================
  // §1 · CONSTANTS & MUSIC-THEORY DATA
  // note names, string setups, scale intervals, chord formulas, diatonic
  // qualities, common progressions, sequence + chromatic patterns.
  // ===========================================================================
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_ALIASES = { C:0, 'B#':0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, Fb:4, F:5, 'E#':5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11, Cb:11 };
  const STRING_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
  const AUDIO_LOOKAHEAD_SECONDS = 0.20;
  // How far ahead (seconds) of the currently-scheduled audio pass to schedule
  // the next loop pass. Must be >= AUDIO_LOOKAHEAD so the next pass's first
  // event is already queued before the current pass ends — that's what makes
  // the whole-chart loop gapless (no stopAudio()/restart at the seam).
  const LOOP_SCHEDULE_AHEAD = 0.35;

  const STRING_SETUPS = {
    guitar_6_standard: { label:'6-string guitar — standard', instrument:'guitar', openMidis:[40,45,50,55,59,64], tuning:[0,0,0,0,0,0] },
    guitar_6_drop_d: { label:'6-string guitar — Drop D', instrument:'guitar', openMidis:[38,45,50,55,59,64], tuning:[-2,0,0,0,0,0] },
    guitar_7_standard: { label:'7-string guitar — standard', instrument:'guitar', openMidis:[35,40,45,50,55,59,64], tuning:[0,0,0,0,0,0,0] },
    guitar_8_standard: { label:'8-string guitar — standard', instrument:'guitar', openMidis:[30,35,40,45,50,55,59,64], tuning:[2,0,0,0,0,0,0,0] },
    bass_4_standard: { label:'4-string bass — standard', instrument:'bass', openMidis:[28,33,38,43], tuning:[0,0,0,0] },
    bass_5_standard: { label:'5-string bass — standard low B', instrument:'bass', openMidis:[23,28,33,38,43], tuning:[0,0,0,0,0] },
    bass_6_standard: { label:'6-string bass — standard (B-E-A-D-G-C)', instrument:'bass', openMidis:[23,28,33,38,43,48], tuning:[0,0,0,0,0,0] }
  };

  // Curated tunings. Keyed by `${family}_${stringCount}` → array of options
  // ({label, midis}). Order is from lowest to highest string (matches
  // STRING_SETUPS.openMidis). Picking one of these maps to a stringSetup
  // when the midis match a built-in preset; otherwise it's stored as a
  // customOpenMidis override (see readConfig + openMidisForConfig).
  const TUNING_PRESETS = {
    guitar_6: [
      { id:'standard',     label:'Standard (E A D G B E)',      midis:[40,45,50,55,59,64] },
      { id:'drop_d',       label:'Drop D (D A D G B E)',        midis:[38,45,50,55,59,64] },
      { id:'drop_c',       label:'Drop C (C G C F A D)',        midis:[36,43,48,53,57,62] },
      { id:'drop_b',       label:'Drop B (B F# B E G# C#)',     midis:[35,42,47,52,56,61] },
      { id:'eb_standard',  label:'Eb Standard (down ½ step)',   midis:[39,44,49,54,58,63] },
      { id:'d_standard',   label:'D Standard (down 1 step)',    midis:[38,43,48,53,57,62] },
      { id:'dadgad',       label:'DADGAD',                       midis:[38,45,50,55,57,62] },
      { id:'open_g',       label:'Open G (D G D G B D)',        midis:[38,43,50,55,59,62] },
      { id:'open_d',       label:'Open D (D A D F# A D)',       midis:[38,45,50,54,57,62] },
    ],
    guitar_7: [
      { id:'standard',     label:'Standard (B E A D G B E)',    midis:[35,40,45,50,55,59,64] },
      { id:'drop_a',       label:'Drop A (A E A D G B E)',      midis:[33,40,45,50,55,59,64] },
    ],
    guitar_8: [
      { id:'standard',     label:'Standard (F# B E A D G B E)', midis:[30,35,40,45,50,55,59,64] },
      { id:'drop_e',       label:'Drop E (E B E A D G B E)',    midis:[28,35,40,45,50,55,59,64] },
    ],
    bass_4: [
      { id:'standard',     label:'Standard (E A D G)',          midis:[28,33,38,43] },
      { id:'drop_d',       label:'Drop D (D A D G)',            midis:[26,33,38,43] },
      { id:'eb_standard',  label:'Eb Standard (down ½ step)',   midis:[27,32,37,42] },
      { id:'bead',         label:'BEAD (low B)',                midis:[23,28,33,38] },
    ],
    bass_5: [
      { id:'standard',     label:'Standard low B (B E A D G)',  midis:[23,28,33,38,43] },
      { id:'standard_hc',  label:'Standard high C (E A D G C)', midis:[28,33,38,43,48] },
      { id:'drop_a',       label:'Drop A (A E A D G)',          midis:[21,28,33,38,43] },
    ],
    bass_6: [
      { id:'standard',     label:'Standard (B E A D G C)',      midis:[23,28,33,38,43,48] },
    ],
  };
  // Maps `${family}_${count}_${tuningId}` → stringSetup name when the preset
  // matches a built-in entry; otherwise the chosen tuning gets stored as
  // customOpenMidis on the config.
  const TUNING_TO_SETUP = {
    guitar_6_standard: 'guitar_6_standard',
    guitar_6_drop_d:   'guitar_6_drop_d',
    guitar_7_standard: 'guitar_7_standard',
    guitar_8_standard: 'guitar_8_standard',
    bass_4_standard:   'bass_4_standard',
    bass_5_standard:   'bass_5_standard',
    bass_6_standard:   'bass_6_standard',
  };

  const SCALE_INTERVALS = {
    // Diatonic and common scales
    major:[0,2,4,5,7,9,11], natural_minor:[0,2,3,5,7,8,10], harmonic_minor:[0,2,3,5,7,8,11],
    melodic_minor:[0,2,3,5,7,9,11],
    // Pentatonic / blues
    minor_pentatonic:[0,3,5,7,10], major_pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10],
    // Bebop scales (chromatic passing tone so chord tones land on strong beats)
    bebop_major:[0,2,4,5,7,8,9,11], bebop_dominant:[0,2,4,5,7,9,10,11],
    // Bebop minor (dorian + chromatic passing tone between b3 and the 4th) — keeps
    // the minor 3rd so it sits correctly over minor/dorian tonalities.
    bebop_dorian:[0,2,3,4,5,7,9,10],
    // Modes of the major scale
    dorian:[0,2,3,5,7,9,10], phrygian:[0,1,3,5,7,8,10], lydian:[0,2,4,6,7,9,11],
    mixolydian:[0,2,4,5,7,9,10], locrian:[0,1,3,5,6,8,10],
    // Other common jazz scales
    phrygian_dominant:[0,1,4,5,7,8,10], lydian_dominant:[0,2,4,6,7,9,10],
    whole_tone:[0,2,4,6,8,10], diminished:[0,2,3,5,6,8,9,11],
    // Modes of melodic minor — for jazz chord-scale applications
    dorian_b2:[0,1,3,5,7,9,10],       // mode II: over m7 with half-step root motion above
    lydian_augmented:[0,2,4,6,8,9,11], // mode III: over maj7#5, floating quality
    mixolydian_b6:[0,2,4,5,7,8,10],   // mode V: over V7 resolving to minor
    locrian_sharp2:[0,2,3,5,6,8,10],  // mode VI: over m7b5 (preferred over plain Locrian)
    altered:[0,1,3,4,6,8,10],         // mode VII: maximum tension over V7alt
    // Symmetric / exotic — fusion, neoclassical, metal (genre-framework §2.2)
    half_whole_dim:[0,1,3,4,6,7,9,10],  // dominant diminished (half-whole) — over dom7, symmetric metal runs
    double_harmonic:[0,1,4,5,7,8,11],   // Byzantine / double harmonic major — neoclassical / exotic death metal
    hungarian_minor:[0,2,3,6,7,8,11],   // harmonic minor ♯4 — neoclassical / melodic metal
    neapolitan_minor:[0,1,3,5,7,8,11],  // dark classical-metal colour
  };
  // Chord qualities defined as semitone intervals from the root. This is a
  // pitch-primary definition: a chord is a stack of intervals, instrument-agnostic
  // by design (see ROADMAP Phase 6 — piano). Extensions go ABOVE the octave
  // (9th = 14, 11th = 17, 13th = 21) so the stack is the complete set of chord
  // tones. ACTUAL VOICING (which notes to play, octave placement, drop-2, omitting
  // the 3rd under an 11th, etc.) is a render-time concern, NOT encoded here — the
  // guitar position-pickers reduce these to pitch classes (% 12); a future piano
  // voicing engine can read the full stack. `add9` already proved intervals > 12
  // work end-to-end.
  const CHORD_FORMULAS = {
    // Triads
    maj:{symbol:'maj', intervals:[0,4,7]}, min:{symbol:'min', intervals:[0,3,7]}, dim:{symbol:'dim', intervals:[0,3,6]}, aug:{symbol:'aug', intervals:[0,4,8]},
    // Power chords — third-less; the harmonic atom of rock/metal/punk/djent.
    // `5` = root+5th; `5oct` = root+5th+octave (the "spread across 3 strings" voicing).
    '5':{symbol:'5', intervals:[0,7]}, '5oct':{symbol:'5', intervals:[0,7,12]},
    // Suspended
    sus2:{symbol:'sus2', intervals:[0,2,7]}, sus4:{symbol:'sus4', intervals:[0,5,7]},
    // Sixths / add
    '6':{symbol:'6', intervals:[0,4,7,9]}, min6:{symbol:'m6', intervals:[0,3,7,9]},
    add9:{symbol:'add9', intervals:[0,4,7,14]}, '69':{symbol:'6/9', intervals:[0,4,7,9,14]},
    // Sevenths
    maj7:{symbol:'maj7', intervals:[0,4,7,11]}, min7:{symbol:'min7', intervals:[0,3,7,10]}, dom7:{symbol:'7', intervals:[0,4,7,10]},
    min7b5:{symbol:'m7b5', intervals:[0,3,6,10]}, dim7:{symbol:'dim7', intervals:[0,3,6,9]}, min_maj7:{symbol:'m(maj7)', intervals:[0,3,7,11]},
    // Ninths
    maj9:{symbol:'maj9', intervals:[0,4,7,11,14]}, min9:{symbol:'m9', intervals:[0,3,7,10,14]}, dom9:{symbol:'9', intervals:[0,4,7,10,14]},
    // Elevenths — 11th chords commonly OMIT the 3rd in real voicings (the 3rd↔11th
    // ♭9 clash); the full stack is kept here for completeness, voicing decides.
    maj11:{symbol:'maj11', intervals:[0,4,7,11,14,17]}, min11:{symbol:'m11', intervals:[0,3,7,10,14,17]}, dom11:{symbol:'11', intervals:[0,4,7,10,14,17]},
    // Thirteenths
    maj13:{symbol:'maj13', intervals:[0,4,7,11,14,21]}, min13:{symbol:'m13', intervals:[0,3,7,10,14,21]}, dom13:{symbol:'13', intervals:[0,4,7,10,14,21]}
  };
  // Qualities the CAGED chord-TEMPLATE path can voice (triads + basic 7ths).
  // Power chords and 9/11/13 extensions are NOT triad/7th shapes — they skip the
  // template and fall back to interval-derived positions (see cagedShapeQualityKey).
  const TEMPLATE_QUALITIES = new Set(['maj','min','dim','aug','sus2','sus4','maj7','min7','dom7','min7b5','dim7','min_maj7','add9','6','min6']);
  const DIATONIC_QUALITIES = {
    major:         {triad:['maj','min','min','maj','maj','min','dim'],    seventh:['maj7','min7','min7','maj7','dom7','min7','min7b5']},
    dorian:        {triad:['min','min','maj','maj','min','dim','maj'],    seventh:['min7','min7','maj7','dom7','min7','min7b5','maj7']},
    phrygian:      {triad:['min','maj','maj','min','dim','maj','min'],    seventh:['min7','maj7','dom7','min7','min7b5','maj7','min7']},
    lydian:        {triad:['maj','maj','min','dim','maj','min','min'],    seventh:['maj7','dom7','min7','min7b5','maj7','min7','min7']},
    mixolydian:    {triad:['maj','min','dim','maj','min','min','maj'],    seventh:['dom7','min7','min7b5','maj7','min7','min7','maj7']},
    natural_minor: {triad:['min','dim','maj','min','min','maj','maj'],    seventh:['min7','min7b5','maj7','min7','min7','maj7','dom7']},
    locrian:       {triad:['dim','maj','min','min','maj','maj','min'],    seventh:['min7b5','maj7','min7','min7','maj7','dom7','min7']},
    harmonic_minor:{triad:['min','dim','aug','min','maj','maj','dim'],    seventh:['min7','min7b5','maj7','min7','dom7','maj7','dim7']},
    melodic_minor: {triad:['min','min','aug','maj','maj','dim','dim'],    seventh:['min7','min7','maj7','dom7','dom7','min7b5','min7b5']}
  };
  // Tonic chord identity for genuinely-exotic scales that have NO DIATONIC_QUALITIES
  // row. Without this, chordQualityForDegree silently borrows major's row (line ~2126),
  // so a static_i drone under e.g. locrian ♮2 (a m7♭5 chord-scale) or the altered scale
  // (a dominant) sounds a bare MAJOR triad — a major 3rd ringing against the scale's ♭3.
  // Only consulted at the TONIC degree (these are used over one-chord drones); non-tonic
  // degrees of these scales still fall through to the major-borrow (no full rows authored).
  // Values are existing CHORD_FORMULAS qualities (7th-family = the honest chord-scale tonic).
  // Pentatonic/blues are deliberately OMITTED — their major-borrow backing is unchanged.
  // Derived from harmony-theory-architect's spec (2026-05-31 Core review), adapted to
  // existing qualities; fuller accuracy (7alt / maj7#5) is a logged future enhancement.
  const SCALE_TONIC_QUALITY = {
    lydian_dominant:'dom7', altered:'dom7', mixolydian_b6:'dom7', phrygian_dominant:'dom7',
    bebop_dominant:'dom7', locrian_sharp2:'min7b5', dorian_b2:'min7', bebop_major:'maj7',
    lydian_augmented:'aug', whole_tone:'aug', diminished:'dim7'
  };
  const COMMON_PROGRESSIONS = {
    diatonic:[1,2,3,4,5,6,7,1],
    static_i:[1],                 // one-chord vamp — Beginner Core "static vamp" (Pulse & Muting); roots stay on the tonic
    'I-IV-V':[1,4,5,1],
    'I-V-vi-IV':[1,5,6,4],
    'I-vi-IV-V':[1,6,4,5],
    'I-vi-ii-V':[1,6,2,5],
    'ii-V-I':[2,5,1,1],
    'vi-ii-V-I':[6,2,5,1],
    'I-iii-IV-V':[1,3,4,5],
    'I-IV-vi-V':[1,4,6,5],
    'I-ii-IV-V':[1,2,4,5],
    'vi-IV-I-V':[6,4,1,5],
    pachelbel:[1,5,6,3,4,1,4,5],
    circle_diatonic:[1,4,7,3,6,2,5,1],
    '12_bar_blues':[1,1,1,1,4,4,1,1,5,4,1,5],
    quick_change_blues:[1,4,1,1,4,4,1,1,5,4,1,5],
    'i-VI-III-VII':[1,6,3,7],
    'i-VII-VI-VII':[1,7,6,7],
    minor_ii_V_i:[2,5,1,1],
    // Rhythm Changes (Gershwin "I Got Rhythm" form) — simplified to degree system.
    // A section: I–VI7–ii–V turnaround × 2 (bars 1–8). VI is a secondary dominant.
    rhythm_changes_a:[1,6,2,5,1,6,2,5],
    // Bridge: chain of secondary dominants resolving III7→VI7→II7→V7→I.
    rhythm_changes_bridge:[3,6,2,5],
    // Chromatic / substitution progressions — authored with the {deg|semis,q,rn}
    // token form. `semis` is a chromatic root offset from the key root; `q` sets the
    // quality at that position; `rn` is a display-only Roman label. These need roots
    // no diatonic degree can express (♭II, ♭VII, ♭III, ♭VI). Resolved by
    // chordRootForDegree / chordQualityForDegree, which accept tokens.
    tritone_sub_ii_V_I:[2, { semis:1,  q:'dom7', rn:'♭II7' }, 1, 1],                 // Dm7–D♭7–C : tritone-sub V
    backdoor_ii_V:[{ deg:4, q:'min7' }, { semis:10, q:'dom7', rn:'♭VII7' }, 1, 1],   // Fm7–B♭7–C : backdoor dominant
    tadd_dameron:[1, { semis:3, q:'dom7', rn:'♭III7' }, { semis:8, q:'maj7', rn:'♭VImaj7' }, { semis:1, q:'dom7', rn:'♭II7' }], // C–E♭7–A♭maj7–D♭7
    // Metal / heavy-genre power-chord roots (genre-framework §3). Spelled against
    // natural-minor degrees; the pedal-riff / power-chord generators take the roots
    // and voice the 5ths. Chromatic moves use {semis} (♭II, tritone) — the
    // non-functional semitone motion that defines the heavy styles.
    // ♭VI/♭VII spelled as semis tokens (not bare degrees 6/7) so harmonic-minor's
    // raised 7th can't turn ♭VII into the leading tone (A–F–G♯ instead of A–F–G).
    'metal_i_bVI_bVII':[1, { semis:8, rn:'♭VI' }, { semis:10, rn:'♭VII' }],            // i–♭VI–♭VII : melodic/heavy metal
    'metal_i_bVII_bVI_V':[1, { semis:10, rn:'♭VII' }, { semis:8, rn:'♭VI' }, 5],       // i–♭VII–♭VI–V : neoclassical minor descent (V stays diatonic)
    'metal_pedal_chromatic':[1, { semis:1, rn:'♭II' }, 1, { semis:10, rn:'♭VII' }],    // i–♭II–i–♭VII over a pedal : metalcore/melodeath
    'metal_death_tritone':[1, { semis:1, rn:'♭II' }, 1, { semis:6, rn:'♭v' }]          // i–♭II–i–tritone : death-metal chromatic
  };
  // Per-progression chord quality overrides — win over diatonic scale harmony,
  // but lose to a user-specified chordOverride. Used by chordQualityForDegree.
  const PROGRESSION_QUALITY_OVERRIDES = {
    minor_ii_V_i:        { 2:'min7b5', 5:'dom7', 1:'min7' },
    rhythm_changes_a:    { 6:'dom7' },
    rhythm_changes_bridge:{ 3:'dom7', 6:'dom7', 2:'dom7', 5:'dom7' }
  };
  // Minor-spelled progressions: their Roman numerals (bVI / bIII / bVII) are
  // spelled against the NATURAL-minor (Aeolian) degrees. Harmonic and melodic
  // minor RAISE the 7th (and melodic also the 6th) — those are MELODIC devices
  // (the leading tone), not chord-root choices. If the chord roots followed
  // those raised degrees, degree VII would land on the raised leading tone:
  // e.g. i-VI-III-VII in A over harmonic_minor produced G#7 for the VII instead
  // of the intended bVII (G). So for these scales we pin the chord ROOTS to
  // natural minor; chord QUALITY still comes from the chord-scale / overrides.
  //
  // Natural minor already gives Aeolian roots (no pinning needed). Dorian and
  // phrygian are deliberately NOT pinned: their characteristic altered degrees
  // (dorian's natural 6, phrygian's b2) are the point of choosing them, and the
  // backing should match the scale the player is actually using rather than be
  // forced back to Aeolian. Major-scale pairings are likewise left untouched.
  const MINOR_SPELLED_PROGRESSIONS = new Set(['i-VI-III-VII', 'i-VII-VI-VII', 'minor_ii_V_i']);
  const ROOT_PIN_NATURAL_MINOR_SCALES = new Set(['harmonic_minor', 'melodic_minor']);
  const FRETBOARD_SYSTEM_LABELS = {
    caged:'CAGED (5 shapes)',
    '3nps':'3 Notes Per String (7 positions)',
    open:'Open position',
    position:'Custom fret range',
    single_string:'Single-string run',
    full_neck:'Full-neck map'
  };
  // CAGED shape data moved to a single unified CAGED_SHAPES definition further
  // down (search for "Unified CAGED shape data"). That table is the single
  // source of truth for both chord templates and scale shape windows.
  const SEQUENCE_PATTERNS = {
    none:null,
    fours:[0,1,2,3],
    triplets:[0,1,2],
    thirds:[0,2],
    broken_triads:[0,2,4],
    yngwie_sixes:[0,1,2,3,2,1]
  };
  const SEQUENCE_LABELS = {
    none:'straight',
    fours:'fours (1-2-3-4)',
    triplets:'triplets (1-2-3)',
    thirds:'diatonic thirds',
    broken_triads:'broken triads (1-3-5)',
    yngwie_sixes:'sixes (1-2-3-4-3-2)'
  };
  // Default chord-scale for "mode of the moment". These follow the codebase's
  // documented jazz stance (see docs/theory-jazz-advanced.md "Chord-scale
  // defaults"): prefer scales that dodge the avoid-note a half-step above a
  // chord tone, even though that's a more advanced choice than the textbook
  // functional scale.
  //   maj7  → Lydian        — #11 avoids the Ionian 4th avoid-note.
  //   dom7  → Lydian dominant — #11 avoids the Mixolydian 4th avoid-note.
  //   min7  → Dorian        — most consonant minor chord-scale.
  //   m7b5  → Locrian ♮2     — avoids the plain-Locrian b2 clash.
  // These are DEFAULTS for auto chord-scale selection; the user can still pick
  // Ionian / Mixolydian explicitly when a strictly functional sound is wanted.
  const MODE_FOR_QUALITY = {
    maj:'major',           maj7:'lydian',
    min:'dorian',          min7:'dorian',
    dom7:'lydian_dominant',
    dim:'locrian',         min7b5:'locrian_sharp2', dim7:'locrian',
    aug:'major',           sus4:'mixolydian', add9:'major',
    // Power chords are third-less; minor pentatonic is the universal "play over a
    // power chord" choice across rock/metal/blues.
    '5':'minor_pentatonic', '5oct':'minor_pentatonic',
    sus2:'mixolydian', '6':'major', min6:'dorian', '69':'major', min_maj7:'melodic_minor',
    // Extensions follow their parent 7th's chord-scale; the natural-11 dominant
    // (dom11) takes mixolydian (natural 11) rather than lydian dominant (♯11).
    maj9:'lydian',          min9:'dorian',          dom9:'lydian_dominant',
    maj11:'lydian',         min11:'dorian',         dom11:'mixolydian',
    maj13:'lydian',         min13:'dorian',         dom13:'lydian_dominant'
  };
  const CHROMATIC_PATTERNS = {
    '1234':[0,1,2,3], '4321':[3,2,1,0], '1324':[0,2,1,3], '1342':[0,2,3,1], '2413':[1,3,0,2]
  };
  const CHROMATIC_PATTERN_LABELS = {
    '1234':'1-2-3-4 (standard)', '4321':'4-3-2-1 (reverse)',
    '1324':'1-3-2-4 (crossing)', '1342':'1-3-4-2 (spider)', '2413':'2-4-1-3 (advanced)'
  };
  const KIND_LABELS = {
    chromatic:'Chromatic', scale:'Scale', modal_vamp:'Modal Vamp',
    chord_scales:'Chord Scales', diatonic_arpeggios:'Dia. Arps',
    progression_arpeggios:'Prog. Arps', sweep_arpeggios:'Sweeps', guide_tones:'Guide Tones',
  };
  const KIND_COLORS = {
    chromatic:'#f97316', scale:'#22c55e', modal_vamp:'#22c55e',
    chord_scales:'#3b82f6', diatonic_arpeggios:'#a855f7', progression_arpeggios:'#a855f7',
    sweep_arpeggios:'#ef4444', guide_tones:'#eab308',
  };
  // Tempo tier labels — shared by all pathways. Index 0 = Slow.
  const TIER_LABELS = ['Slow', 'Med', 'Fast', 'Push'];
  // Skill tree topology — positions as % of the inner container (x left→right, y top→bottom).
  // Edges draw pedagogical flow lines; clicking a node selects the pathway.
  const SKILL_TREE_NODES = [
    { id: 'chromatic_warmup',      x:  6, y: 50, short: 'Chromatic' },
    // Beginner band (x20)
    { id: 'pent_foundation',       x: 20, y: 20, short: 'Pentatonic' },
    { id: 'pulse_muting',          x: 20, y: 42, short: 'Pulse/Mute' },
    { id: 'blues_foundation',      x: 20, y: 64, short: 'Blues Scale' },
    { id: 'bend_drill',            x: 20, y: 86, short: 'Bending' },
    // Beginner-2 / Beg→Int bridge band (x36)
    { id: 'major_pent_country',    x: 36, y: 10, short: 'Major Pent' },
    { id: 'dorian_groove',         x: 36, y: 32, short: 'Dorian' },
    { id: 'power_chord_comping',   x: 36, y: 54, short: 'Power Chords' },
    { id: 'blues_shuffle',         x: 36, y: 72, short: 'Blues Shuffle' },
    { id: 'harmonic_minor_exotic', x: 36, y: 90, short: 'Harm. Minor' },
    // Intermediate band (x54)
    { id: 'chord_tone_targeting',  x: 54, y: 14, short: 'Chord Tones' },
    { id: 'major_scale_caged',     x: 54, y: 36, short: 'Major CAGED' },
    { id: 'modal_awareness',       x: 54, y: 56, short: 'Modal Aware.' },
    { id: 'sixteenth_pocket',      x: 54, y: 76, short: '16th Pocket' },
    { id: 'diatonic_triad_drill',  x: 54, y: 92, short: 'Triad Drill' },
    // Advanced band (x72 / x88)
    { id: 'modal_vamp',            x: 72, y: 22, short: 'Modal Vamp' },
    { id: 'seventh_vocab',         x: 72, y: 44, short: '7th Chords' },
    { id: 'melmin_exotic_12key',   x: 72, y: 66, short: 'Mel-Min' },
    { id: 'sweep_arpeggio_primer', x: 72, y: 88, short: 'Sweep Arps' },
    { id: 'guide_tones_path',      x: 88, y: 30, short: 'Guide Tones' },
    { id: 'whole_neck_freedom',    x: 88, y: 52, short: 'Whole Neck' },
    { id: 'ii_V_I_workout',        x: 88, y: 74, short: 'ii–V–I' },
    // Metal / heavy-genre pack — advanced offshoots along the bottom band.
    { id: 'metalcore_chug',        x: 44, y: 97, short: 'Metalcore' },
    { id: 'melodic_metal_gallop',  x: 57, y: 97, short: 'Gallop' },
    { id: 'melodeath_twin_leads',  x: 70, y: 97, short: 'Twin Leads' },
    { id: 'djent_polymeter',       x: 83, y: 97, short: 'Djent' },
    { id: 'death_chromatic',       x: 96, y: 97, short: 'Death' },
  ];
  const SKILL_TREE_EDGES = [
    ['chromatic_warmup',    'pent_foundation'],
    ['chromatic_warmup',    'blues_foundation'],
    ['pent_foundation',     'bend_drill'],
    ['blues_foundation',    'bend_drill'],
    ['blues_foundation',    'blues_shuffle'],
    ['pent_foundation',     'major_pent_country'],
    ['pent_foundation',     'dorian_groove'],
    ['blues_foundation',    'dorian_groove'],
    ['blues_foundation',    'harmonic_minor_exotic'],
    ['dorian_groove',       'chord_tone_targeting'],
    ['dorian_groove',       'modal_awareness'],
    ['major_pent_country',  'chord_tone_targeting'],
    ['modal_awareness',     'modal_vamp'],
    ['modal_awareness',     'diatonic_triad_drill'],
    ['chord_tone_targeting','diatonic_triad_drill'],
    ['diatonic_triad_drill','seventh_vocab'],
    ['diatonic_triad_drill','sweep_arpeggio_primer'],
    ['seventh_vocab',       'ii_V_I_workout'],
    ['modal_vamp',          'ii_V_I_workout'],
    // Guitar Core ★ nodes — prerequisite flow (build-queue #1).
    ['chromatic_warmup',    'pulse_muting'],          // B0 → B1
    ['pulse_muting',        'power_chord_comping'],   // B1 → B3 (power chords in Beginner)
    ['pulse_muting',        'sixteenth_pocket'],      // B1 → I8
    ['pent_foundation',     'major_scale_caged'],     // B2 → I1
    ['major_scale_caged',   'whole_neck_freedom'],    // I1 → A6
    ['modal_awareness',     'melmin_exotic_12key'],   // I3 → A7
    ['seventh_vocab',       'guide_tones_path'],      // A1 → A2
    ['guide_tones_path',    'ii_V_I_workout'],        // A2 → A3 (guide-tones before voice-leading)
    // Metal pack branches off the advanced minor/arpeggio nodes.
    ['harmonic_minor_exotic','metalcore_chug'],
    ['harmonic_minor_exotic','melodic_metal_gallop'],
    ['sweep_arpeggio_primer','melodeath_twin_leads'],
    ['sweep_arpeggio_primer','djent_polymeter'],
    ['sweep_arpeggio_primer','death_chromatic'],
  ];
  // Band map — the single source for the two-level picker that replaces the SVG
  // skill-tree display (which tangles at 27 nodes). L1 = band (array order); L2 =
  // ordered pathway list per band (array order, top = do-first). Authored by
  // learning-design-architect (project_guitar_pathway_bands); the SVG tree
  // (SKILL_TREE_NODES/EDGES) is kept for the future RPG view. Style pathways' Core
  // prereq comes from SKILL_TREE_EDGES (first incoming edge), surfaced as a soft
  // "Builds on …" hint. When a new guitar pathway is added, slot it here.
  // A "pack" === a band (no parallel registry). `kind` drives the Pack-manager
  // (§11): Core packs are pinned-first / locked / always-installed (the staircase),
  // Style packs are installable/orderable and each declares a Core foundation
  // (`buildsOn`, player vocabulary, informational — never a lock) + a `family`
  // (groups the Available column into a curriculum map as the roster grows).
  const PATHWAY_BANDS = [
    { id:'core_beginner',     label:'Beginner',     kind:'core', pinned:true, pathways:['chromatic_warmup','pulse_muting','pent_foundation','power_chord_comping','blues_foundation','bend_drill'] },
    { id:'core_intermediate', label:'Intermediate', kind:'core', pinned:true, pathways:['major_scale_caged','sixteenth_pocket','dorian_groove','chord_tone_targeting','modal_awareness','diatonic_triad_drill'] },
    { id:'core_advanced',     label:'Advanced',     kind:'core', pinned:true, pathways:['seventh_vocab','whole_neck_freedom','guide_tones_path','ii_V_I_workout','modal_vamp','melmin_exotic_12key','harmonic_minor_exotic','sweep_arpeggio_primer'] },
    { id:'style_blues',       label:'Blues',        kind:'style', family:'Roots & Rock',          buildsOn:'Builds on Core Beginner — minor-pentatonic box 1, the blue note (♭5), and a steady pulse over the 12-bar form.', pathways:['blues_shuffle'] },
    { id:'style_country',     label:'Country',      kind:'style', family:'Roots & Rock',          buildsOn:'Builds on Core Beginner→Intermediate — major pentatonic and the CAGED major scale; you target chord tones inside the shape.', pathways:['major_pent_country'] },
    { id:'style_metal',       label:'Metal',        kind:'style', family:'High-Gain & Technical', buildsOn:'Builds on Core — power chords and palm-mute pulse (Beginner), tight 16th picking (Intermediate), plus exotic/harmonic-minor scales and sweep mechanics (Advanced).', pathways:['metalcore_chug','melodic_metal_gallop','djent_polymeter','melodeath_twin_leads','death_chromatic'] },
  ];
  // Family display order for the Pack-manager Available column (Core-branch-point
  // depth → the catalog reads as a curriculum map, not a scrolling wall).
  const PACK_FAMILY_ORDER = ['Roots & Rock', 'Groove', 'Jazz & Sophisticated Harmony', 'High-Gain & Technical', 'Acoustic & Fingerstyle'];
  // Pack integrity guard (the pack-layer analog of the no-unison guard): a Style
  // pack with no Core foundation or family is a curricular error — fail loudly on load.
  PATHWAY_BANDS.forEach(b => {
    if (b.kind === 'style' && (!b.buildsOn || !b.family)) {
      throw new Error(`[SlopScale pack] style pack "${b.id}" must declare buildsOn + family`);
    }
  });
  // ===========================================================================
  // §2 · CURATED PATHWAYS
  // label, goal, scales[], tempoTiers[], base config, vary[] (Next-Variation cycle).
  // ===========================================================================
  const PATHWAYS = {
    chromatic_warmup: {
      label:'Chromatic Warmup',
      goal:'One finger per fret — 1-2-3-4 across all six strings. Builds fretting-hand synchronization, finger independence, and positional awareness. The universal warmup every method teaches. Start slow; speed comes from clean reps, not rushed ones.',
      scales:[],
      tempoTiers:[60, 80, 100, 120],
      base:{ practiceType:'chromatic', chromaticPattern:'1234', meter:'4/4', subdivision:'sixteenth', bpm:60, bars:8, direction:'up_down', advancedMode:false, fretboardSystem:'position', stringSetup:'guitar_6_standard', renderer:'highway_3d', fretMin:1, fretMax:4 },
      vary:[
        { chromaticPattern:'1234', fretMin:1, fretMax:4 },
        { chromaticPattern:'4321', fretMin:1, fretMax:4 },
        { chromaticPattern:'1324', fretMin:1, fretMax:4 },
        { chromaticPattern:'1342', fretMin:1, fretMax:4 },
        { chromaticPattern:'1234', fretMin:5, fretMax:8 },
        { chromaticPattern:'1234', fretMin:9, fretMax:12 }
      ]
    },
    blues_foundation: {
      label:'Blues Scale Foundation',
      goal:'Minor pentatonic with the flat-5 blue note added. That one extra note is what separates a scale run from a blues lick. Play it over a 12-bar blues and land on the b5 for tension — resolve it up to the 5th.',
      scales:['blues','minor_pentatonic'],
      tempoTiers:[60, 80, 100, 120],
      base:{ practiceType:'scale', scale:'blues', meter:'4/4', subdivision:'eighth', bpm:80, bars:12, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'dom7' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ]
    },
    blues_shuffle: {
      label:'Blues Shuffle',
      goal:'Play blues licks over a real shuffle. The backing walks a root–5–6–♭7 boogie bass with off-beat 9th-chord stabs, all swung — the dominant I7–IV7–V7 feel. Lock your phrasing to the triplet pocket: land chord tones on the beat, save the ♭5 and ♭3 for the swung off-beats. This is where the scale becomes music.',
      scales:['blues','minor_pentatonic'],
      tempoTiers:[80, 100, 120, 140],
      base:{ practiceType:'scale', scale:'blues', meter:'4/4', subdivision:'eighth', bpm:100, bars:12, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'dom7', backingStyle:'boogie', swing:'shuffle', audioProfile:'blues' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' }, { key:'D', shape:'E' } ]
    },
    pent_foundation: {
      label:'Pentatonic Foundation',
      goal:'Play minor pentatonic box 1 over a 12-bar blues. The single most useful guitar drill — every rock and blues solo lives in this combination.',
      scales:['minor_pentatonic','blues','major_pentatonic'],
      tempoTiers:[60, 80, 100, 120],
      base:{ practiceType:'scale', scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bpm:80, bars:12, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'dom7' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ]
    },
    major_pent_country: {
      label:'Major Pentatonic Country',
      goal:'Country and southern rock vocabulary. Major pentatonic sits over the chord so every note is a chord tone or a step away — nothing clashes. Target the 2nd and 6th for the Nashville twang. G is the classic country key; I-IV-V keeps it honest.',
      scales:['major_pentatonic','major','blues'],
      tempoTiers:[70, 95, 115, 140],
      base:{ practiceType:'scale', scale:'major_pentatonic', meter:'4/4', subdivision:'eighth', bpm:95, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'I-IV-V', chordDepth:'triad', chordOverride:'auto', key:'G', fretMin:3, fretMax:7 },
      vary:[ { key:'G', shape:'G' }, { key:'A', shape:'E' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'C', shape:'E' } ]
    },
    dorian_groove: {
      label:'Dorian Groove',
      goal:'Natural minor with a raised 6th — that one note gives it a brighter, jazzier feel than straight Aeolian. The raised 6th is the money note; resolve to it over the i chord. Dorian is the go-to scale for blues-jazz and funk grooves.',
      scales:['dorian','natural_minor','minor_pentatonic'],
      tempoTiers:[65, 85, 105, 125],
      base:{ practiceType:'scale', scale:'dorian', meter:'4/4', subdivision:'eighth', bpm:85, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'i-VII-VI-VII', chordDepth:'seventh', chordOverride:'min7', key:'A', fretMin:5, fretMax:9 },
      vary:[ { key:'A', shape:'E' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ]
    },
    chord_tone_targeting: {
      label:'Chord Tone Targeting',
      goal:"Keep the key's scale, but watch the accents shift to chord tones as the progression moves. Trains chord-tone awareness inside familiar scale shapes.",
      scales:['major','natural_minor','dorian','mixolydian'],
      tempoTiers:[65, 90, 110, 130],
      base:{ practiceType:'chord_scales', chordScaleStrategy:'chord_tone_emphasis', scale:'major', chordDepth:'seventh', chordOverride:'auto', meter:'4/4', subdivision:'eighth', bpm:90, bars:8, direction:'ascending', sequence:'fours', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', fretMin:0, fretMax:7 },
      vary:[ { key:'C', progression:'diatonic' }, { key:'C', progression:'I-IV-V' }, { key:'G', progression:'I-V-vi-IV' }, { key:'D', progression:'I-vi-IV-V' }, { key:'A', progression:'vi-IV-I-V' } ]
    },
    modal_awareness: {
      label:'Modal Awareness',
      goal:'Each chord gets its own mode. Uses dom7 override so the scale audibly shifts per chord — bar 1 has Bb, bar 2 has F#, etc.',
      scales:['major','dorian','phrygian','lydian','mixolydian','natural_minor','locrian'],
      tempoTiers:[60, 85, 105, 125],
      base:{ practiceType:'chord_scales', chordScaleStrategy:'mode_of_moment', scale:'major', chordDepth:'seventh', chordOverride:'dom7', progression:'diatonic', meter:'4/4', subdivision:'eighth', bpm:85, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'G' }, { key:'D' }, { key:'A' }, { key:'F' } ]
    },
    diatonic_triad_drill: {
      label:'Diatonic Triad Drill',
      goal:'Triad arpeggio of every diatonic chord, in order. The 7-chord lap.',
      scales:['natural_minor','major','harmonic_minor','melodic_minor'],
      tempoTiers:[70, 100, 120, 144],
      base:{ practiceType:'diatonic_arpeggios', scale:'natural_minor', chordDepth:'triad', chordOverride:'auto', meter:'4/4', subdivision:'eighth', bpm:100, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'G' }, { key:'C', shape:'A' } ]
    },
    seventh_vocab: {
      label:'Seventh Chord Vocabulary',
      goal:'Diatonic seventh arpeggios in natural minor. One arpeggio per chord: m7, m7b5, maj7, m7, m7, maj7, dom7. Every diatonic seventh quality across the minor field.',
      scales:['natural_minor','major','dorian','harmonic_minor'],
      tempoTiers:[65, 90, 110, 130],
      base:{ practiceType:'diatonic_arpeggios', scale:'natural_minor', chordDepth:'seventh', chordOverride:'auto', meter:'4/4', subdivision:'eighth', bpm:90, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'G' }, { key:'C', shape:'A' } ]
    },
    ii_V_I_workout: {
      label:'ii–V–I Workout',
      goal:'The most common jazz cadence, run as scales over the changes. Mode-of-the-moment so Dorian / Mixolydian / Ionian land audibly.',
      scales:['major','dorian','mixolydian','melodic_minor','bebop_major','bebop_dominant'],
      tempoTiers:[70, 100, 120, 144],
      base:{ practiceType:'chord_scales', chordScaleStrategy:'mode_of_moment', scale:'major', chordDepth:'seventh', chordOverride:'auto', progression:'ii-V-I', meter:'4/4', subdivision:'eighth', bpm:100, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'F' }, { key:'Bb' }, { key:'G' }, { key:'D' }, { key:'A' } ]
    },
    harmonic_minor_exotic: {
      label:'Harmonic Minor Exotic',
      goal:'Yngwie / flamenco flavor. Harmonic-minor scale, mode-of-the-moment, every chord is dom7 so each bar lands the raised 7th outside the key.',
      scales:['harmonic_minor','phrygian_dominant','natural_minor'],
      tempoTiers:[70, 95, 115, 140],
      base:{ practiceType:'chord_scales', chordScaleStrategy:'mode_of_moment', scale:'harmonic_minor', chordDepth:'seventh', chordOverride:'dom7', progression:'i-VI-III-VII', meter:'4/4', subdivision:'sixteenth', bpm:110, bars:8, direction:'up_down', sequence:'fours', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'B', shape:'E' } ]
    },
    sweep_arpeggio_primer: {
      label:'Sweep Arpeggio Primer',
      goal:'One chord tone per string, swept low-to-high with a hammer-on/pull-off turnaround at the apex, then swept back down. Root anchors the bass string. Start slow — sweeps reward cleanliness over speed.',
      scales:['natural_minor','harmonic_minor','major'],
      tempoTiers:[50, 65, 80, 100],
      base:{ practiceType:'sweep_arpeggios', scale:'natural_minor', chordDepth:'triad', chordOverride:'auto', progression:'i-VI-III-VII', meter:'4/4', subdivision:'sixteenth', bpm:70, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[ { key:'A', shape:'E' }, { key:'A', shape:'A' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'G' } ]
    },
    modal_vamp: {
      label:'Modal Vamp',
      goal:'One scale, one pedal, no chord changes — extended melodic exploration in a single tonality. Essential for modal jazz, fusion, and building phrase vocabulary without harmonic distractions.',
      scales:['dorian','mixolydian','lydian','phrygian','natural_minor','lydian_dominant','altered'],
      tempoTiers:[65, 85, 105, 125],
      base:{ practiceType:'modal_vamp', scale:'dorian', meter:'4/4', subdivision:'eighth', bpm:80, bars:16, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[ { key:'A', scale:'dorian', shape:'E' }, { key:'D', scale:'dorian', shape:'E' }, { key:'G', scale:'mixolydian', shape:'E' }, { key:'A', scale:'lydian', shape:'E' }, { key:'A', scale:'altered', shape:'E' } ]
    },
    bend_drill: {
      label:'Bending Drill',
      goal:'Whole-step bends on the upper three strings. Bend up to the target pitch, hold, listen. Consistent intonation is the entire point — if you can\'t hear when you\'re sharp, slow down. Classic blues and rock vocabulary.',
      scales:['minor_pentatonic','blues','major_pentatonic','major'],
      tempoTiers:[50, 65, 80, 95],
      base:{ practiceType:'bending', bendTarget:'whole', scale:'minor_pentatonic', meter:'4/4', subdivision:'quarter', bpm:60, bars:8, direction:'up_down', advancedMode:false, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[
        { key:'A', shape:'E', bendTarget:'whole' },
        { key:'A', shape:'E', bendTarget:'half' },
        { key:'E', shape:'E', bendTarget:'whole' },
        { key:'A', shape:'E', bendTarget:'mixed' },
        { key:'D', shape:'E', bendTarget:'whole' },
      ]
    },
    // ── Guitar Core ★ nodes (Development Pathways — guitar Core spec) ────────
    // New rungs over EXISTING generators (build-queue #1). Each names its
    // transferable skill (north star). Comping nodes (B5/I6/I7) await
    // buildCompingExercise; the master/improv rung (A8) awaits its engine.
    pulse_muting: {
      label:'Pulse & Muting',
      goal:'The foundation under everything: lock to the click and control the mute. A palm-muted low-E pedal chugs the beat while a tight E5 lands on each downbeat — straight feel first. The skill is the metronome relationship and both-hand muting (palm-mute + left-hand dampening), not the notes. Own this and every riff sits in the pocket.',
      scales:['natural_minor','minor_pentatonic'],
      tempoTiers:[50, 65, 80, 95],
      base:{ practiceType:'pedal_riff', harmonize:false, scale:'natural_minor', key:'E', meter:'4/4', subdivision:'eighth', bpm:60, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'position', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'static_i', chordOverride:'5', swing:'straight', fretMin:0, fretMax:5 },
      vary:[
        { progression:'static_i', subdivision:'eighth' },
        { progression:'static_i', subdivision:'sixteenth' },
        { progression:'static_i', key:'A' },
        { progression:'static_i', key:'G' },
      ]
    },
    power_chord_comping: {
      label:'Power-Chord Comping',
      goal:'Power chords as harmony, not metal — root+5th dyads moving through a musical minor progression (i–♭VII–♭VI–♭VII) over a tonic pedal. The skill is changing power-chord shapes cleanly in time and hearing the root motion. Standard tuning; this is the chord vocabulary every rock and pop rhythm part is built from.',
      scales:['natural_minor','minor_pentatonic','major'],
      tempoTiers:[60, 80, 100, 120],
      base:{ practiceType:'pedal_riff', harmonize:false, scale:'natural_minor', key:'E', meter:'4/4', subdivision:'eighth', bpm:80, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'position', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'i-VII-VI-VII', chordOverride:'5', swing:'straight', fretMin:0, fretMax:7 },
      vary:[
        { progression:'i-VII-VI-VII' },
        { progression:'I-V-vi-IV', scale:'major', key:'G' },
        { progression:'i-VI-III-VII' },
        { progression:'I-IV-V', scale:'major', key:'A' },
      ]
    },
    major_scale_caged: {
      label:'Major Scale — CAGED',
      goal:'The headline scale, learned as five connected shapes. Start with C major in the E shape (the most ergonomic box), then move through the A, G, C, and D shapes — same notes, five zones of the neck. The skill is connecting positions so the major scale stops being one box and becomes the whole fretboard. The map every other scale is measured against.',
      scales:['major'],
      tempoTiers:[60, 85, 105, 130],
      base:{ practiceType:'scale', scale:'major', meter:'4/4', subdivision:'eighth', bpm:85, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'I-IV-V', chordDepth:'triad', chordOverride:'auto', key:'C', shape:'E' },
      vary:[ { key:'C', shape:'E' }, { key:'C', shape:'A' }, { key:'C', shape:'G' }, { key:'C', shape:'C' }, { key:'C', shape:'D' } ]
    },
    sixteenth_pocket: {
      label:'Sixteenth-Note Pocket',
      goal:'Rhythm at the next resolution: four even sixteenths per beat, then loosen them into a swung feel. Run minor pentatonic as the vehicle, but the focus is the subdivision — staying even, accenting the downbeat of each group, then flipping to swing. The 16th pocket is the engine of funk, R&B, and modern rhythm playing.',
      scales:['minor_pentatonic','blues','dorian'],
      tempoTiers:[55, 70, 85, 100],
      base:{ practiceType:'scale', scale:'minor_pentatonic', meter:'4/4', subdivision:'sixteenth', bpm:70, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'i-VII-VI-VII', chordDepth:'seventh', chordOverride:'min7', key:'A', shape:'E', swing:'straight' },
      vary:[ { swing:'straight' }, { swing:'swing' }, { sequence:'fours' }, { key:'E', shape:'E' }, { key:'G', shape:'E' } ]
    },
    guide_tones_path: {
      label:'Guide Tones',
      goal:'The 3rds and 7ths are what spell a chord — and they move by the smallest steps through a progression. Voice-lead just those two notes through a ii–V–I and you hear the changes with two notes per chord. The skill is voice leading: connecting chords by their closest tones. The spine of jazz comping and melodic soloing over changes.',
      scales:['major','dorian','mixolydian'],
      tempoTiers:[55, 75, 95, 115],
      base:{ practiceType:'guide_tones', scale:'major', progression:'ii-V-I', chordDepth:'seventh', voices:'both_alternating', meter:'4/4', subdivision:'quarter', bpm:75, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'C', shape:'E' },
      vary:[ { voices:'thirds_only' }, { voices:'sevenths_only' }, { voices:'both_alternating' }, { key:'F', voices:'both_alternating' }, { key:'Bb', voices:'both_alternating' } ]
    },
    whole_neck_freedom: {
      label:'Whole-Neck Freedom',
      goal:'Stop thinking in boxes. The full-neck map plays the major scale across all positions at once — every note in the key, fret 0 to the top. The skill is freedom of movement: finding any key by feel anywhere on the neck, connecting zones without seams. The endgame of the pitch map.',
      scales:['major','natural_minor','minor_pentatonic'],
      tempoTiers:[60, 80, 100, 120],
      base:{ practiceType:'scale', scale:'major', meter:'4/4', subdivision:'eighth', bpm:80, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'full_neck', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'I-V-vi-IV', chordDepth:'triad', chordOverride:'auto', key:'C' },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' }, { key:'D' } ]
    },
    melmin_exotic_12key: {
      label:'Melodic Minor & Exotic',
      goal:'Beyond the diatonic world: melodic-minor modes and symmetric/exotic scales, cycled through keys. Lydian dominant, altered, Locrian ♮2, plus diminished and whole-tone colors — the vocabulary of fusion, film, and modern jazz. The skill is hearing and fingering these unusual scales in any key, on demand.',
      scales:['melodic_minor','lydian_dominant','altered','locrian_sharp2','lydian_augmented','diminished','whole_tone'],
      tempoTiers:[65, 90, 110, 135],
      base:{ practiceType:'scale', scale:'melodic_minor', meter:'4/4', subdivision:'eighth', bpm:90, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'static_i', chordDepth:'seventh', chordOverride:'auto', key:'A', shape:'E' },
      vary:[ { scale:'melodic_minor', key:'A' }, { scale:'lydian_dominant', key:'C' }, { scale:'altered', key:'E' }, { scale:'locrian_sharp2', key:'B' }, { scale:'lydian_augmented', key:'G' } ]
    },
    // ── Metal / heavy-genre pack (genre-framework §3) ────────────────────────
    metalcore_chug: {
      label:'Metalcore Pedal Chug',
      goal:'The defining heavy riff: a palm-muted low pedal (open/tonic) alternating with power chords that move by semitone (i–♭II–i–♭VII). Lock the pedal chugs to the click, keep the power chords tight and muted. Drop D. Start slow — the groove is in the precision, not the speed.',
      scales:['phrygian','natural_minor'],
      tempoTiers:[80, 100, 120, 140],
      base:{ practiceType:'pedal_riff', harmonize:false, scale:'phrygian', key:'E', meter:'4/4', subdivision:'eighth', bpm:80, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'position', stringSetup:'guitar_6_drop_d', renderer:'highway_3d', progression:'metal_pedal_chromatic', chordOverride:'5', fretMin:0, fretMax:7 },
      vary:[
        { progression:'metal_pedal_chromatic', subdivision:'eighth' },
        { progression:'metal_i_bVI_bVII', subdivision:'eighth' },
        { scale:'natural_minor', progression:'metal_pedal_chromatic' },
        { progression:'metal_pedal_chromatic', subdivision:'gallop' },
      ]
    },
    melodic_metal_gallop: {
      label:'Melodic Metal Gallop',
      goal:'Galloping power chords (eighth + two sixteenths) over a minor/harmonic-minor key — the NWOBHM / power-metal engine. The gallop lives in the picking hand: down on the eighth, down-up on the sixteenths, palm muted. i–♭VI–♭VII root motion.',
      scales:['harmonic_minor','natural_minor'],
      tempoTiers:[90, 120, 150, 180],
      base:{ practiceType:'pedal_riff', harmonize:false, scale:'harmonic_minor', key:'A', meter:'4/4', subdivision:'gallop', bpm:120, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'position', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'metal_i_bVI_bVII', chordOverride:'5', fretMin:0, fretMax:9 },
      vary:[
        { subdivision:'gallop', progression:'metal_i_bVI_bVII' },
        { subdivision:'reverse_gallop', progression:'metal_i_bVI_bVII' },
        { scale:'natural_minor', subdivision:'gallop' },
        { progression:'metal_i_bVII_bVI_V', subdivision:'gallop' },
      ]
    },
    melodeath_twin_leads: {
      label:'Melodic Death Twin Leads',
      goal:'The Gothenburg signature: two guitars harmonized a 3rd apart, both voices sounding together over a minor key. Play the lower line cleanly first, then let the harmony ring with it. Natural and harmonic minor; tremolo-pick for the full melodeath feel.',
      scales:['natural_minor','harmonic_minor'],
      tempoTiers:[80, 100, 120, 140],
      base:{ practiceType:'scale_thirds', harmonize:true, tremolo:true, scale:'natural_minor', key:'E', meter:'4/4', subdivision:'eighth', bpm:90, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'caged', shape:'E', stringSetup:'guitar_6_standard', renderer:'highway_3d' },
      vary:[
        { practiceType:'scale_thirds', harmonize:true, scale:'natural_minor' },
        { practiceType:'scale_sixths', harmonize:true, scale:'natural_minor' },
        { practiceType:'scale_thirds', harmonize:true, scale:'harmonic_minor', key:'D' },
        { practiceType:'scale_thirds', harmonize:true, scale:'natural_minor', subdivision:'gallop' },
      ]
    },
    djent_polymeter: {
      label:'Djent Polymeter Chug',
      goal:'One palm-muted power chord (root+5th+octave), arranged as a rhythmic cell — the harmony is static, the "progression" is the grouping. Feel the 3+3+2 pulse against a steady count. Extended range, lowest tunings. The riff is the rhythm.',
      scales:['phrygian','natural_minor'],
      tempoTiers:[70, 90, 110, 130],
      base:{ practiceType:'pedal_riff', harmonize:false, scale:'phrygian', key:'E', meter:'8/8:3+3+2', subdivision:'eighth', bpm:90, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'position', stringSetup:'guitar_7_standard', renderer:'highway_3d', progression:'metal_pedal_chromatic', chordOverride:'5oct', fretMin:0, fretMax:7 },
      vary:[
        { meter:'8/8:3+3+2', chordOverride:'5oct' },
        { meter:'16/8:3+3+3+3+2+2', chordOverride:'5oct' },
        { meter:'8/8:3+3+2', scale:'natural_minor' },
        { meter:'7/8:3+2+2', chordOverride:'5oct' },
      ]
    },
    death_chromatic: {
      label:'Death Metal Chromatic Riffs',
      goal:'Non-functional, tritone-laced power-chord riffs over the darkest scales (Locrian, diminished, double harmonic). Roots move by semitone and tritone — no key gravity, pure menace. Tremolo-pick at speed; lowest tunings. i–♭II–i–♭v.',
      scales:['locrian','phrygian','diminished','double_harmonic'],
      tempoTiers:[100, 130, 160, 190],
      base:{ practiceType:'pedal_riff', harmonize:false, tremolo:true, scale:'locrian', key:'B', meter:'4/4', subdivision:'eighth', bpm:120, bars:8, direction:'up_down', advancedMode:true, fretboardSystem:'position', stringSetup:'guitar_7_standard', renderer:'highway_3d', progression:'metal_death_tritone', chordOverride:'5', fretMin:0, fretMax:9 },
      vary:[
        { progression:'metal_death_tritone', scale:'locrian' },
        { progression:'metal_death_tritone', scale:'diminished' },
        { progression:'metal_pedal_chromatic', scale:'phrygian', subdivision:'gallop' },
        { progression:'metal_death_tritone', scale:'double_harmonic' },
      ]
    }
  };
  const PATHWAY_STORAGE_KEY = 'slopscale.lastPathway';
  const MODE_STORAGE_KEY = 'slopscale.lastMode';   // resume-last-mode (data-mode token)
  // First-ever launch lands on the first pathway (Chromatic Warmup, the root of
  // the skill tree) on 6-string guitar — its base config sets guitar_6_standard.
  // Only applies when nothing is stored; later launches restore the last pathway.
  const PATHWAY_FIRST_VISIT_DEFAULT = 'chromatic_warmup';

  // ===========================================================================
  // §3 · BUILT-IN SESSIONS
  // multi-segment session presets (ii-V-I Workshop, Daily 30-min, Blues, Bebop).
  // ===========================================================================
  //
  // A session is an ordered list of exercise segments. Each segment configures
  // one exercise type and duration. buildSessionChart() concatenates them into
  // a single sloppak with section markers. See docs/session-schema.md for the
  // full field reference.
  //
  // Segment `kind` values map to buildSingleChart() mode dispatch:
  //   scale | chord_scales | diatonic_arpeggios | progression_arpeggios |
  //   sweep_arpeggios | chromatic | guide_tones | modal_vamp | bending
  //
  // Built-in sessions follow established jazz pedagogy. The "ii-V-I Workshop"
  // segment order follows a standard guide-tone-first learning sequence.

  const BUILT_IN_SESSIONS = {
    // The soft-default workout arc: warm-up → technique → application. It's the
    // first key, so it's the default-selected session (and onLaunchSession's
    // fallback). A starting point to make your own, NOT a locked program — block
    // reorder/swap (authoring) arrives with the Workout-authoring flow.
    starter_arc: {
      version:1,
      name:'Starter — warm-up · technique · application',
      description:'The default practice arc to build from: a chromatic warm-up, a scale-focus technique block, then applying it over changes. Start here and make it your own.',
      stringSetup:'guitar_6_standard',
      tags:['starter','any level'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'warmup',      name:'Warm-up — chromatic',          kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:70, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'sixteenth', keyCycle:'none' } },
        { id:'technique',   name:'Technique — C major (E-shape)', kind:'scale',
          config:{ key:'C', scale:'major', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'application', name:'Application — over I–IV–V',     kind:'chord_scales',
          config:{ key:'C', scale:'major', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', chordScaleStrategy:'mode_of_moment', progression:'I-IV-V', chordDepth:'triad', chordOverride:'auto', keyCycle:'none' } }
      ]
    },
    ii_v_i_workshop: {
      version:1,
      name:'ii–V–I Workshop',
      description:"Structured jazz learning sequence for any progression: guide tones first (3rds, then 7ths, then alternating), then chord scales, then arpeggios. All in C major / E-shape position.",
      stringSetup:'guitar_6_standard',
      tags:['jazz','intermediate'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'gt_thirds',   name:'Guide tones — 3rds',        kind:'guide_tones',
          config:{ key:'C', scale:'major', progression:'ii-V-I', chordDepth:'seventh', voices:'thirds_only',    bpm:60, bars:8, meter:'4/4', subdivision:'quarter',  fretboardSystem:'caged', shape:'E', direction:'up_down', sequence:'none', keyCycle:'none' } },
        { id:'gt_sevenths', name:'Guide tones — 7ths',        kind:'guide_tones',
          config:{ key:'C', scale:'major', progression:'ii-V-I', chordDepth:'seventh', voices:'sevenths_only', bpm:60, bars:8, meter:'4/4', subdivision:'quarter',  fretboardSystem:'caged', shape:'E', direction:'up_down', sequence:'none', keyCycle:'none' } },
        { id:'gt_both',     name:'Guide tones — alternating', kind:'guide_tones',
          config:{ key:'C', scale:'major', progression:'ii-V-I', chordDepth:'seventh', voices:'both_alternating', bpm:60, bars:8, meter:'4/4', subdivision:'quarter', fretboardSystem:'caged', shape:'E', direction:'up_down', sequence:'none', keyCycle:'none' } },
        { id:'chord_scales',name:'Chord scales — mode of moment', kind:'chord_scales',
          config:{ key:'C', scale:'major', progression:'ii-V-I', chordScaleStrategy:'mode_of_moment', chordDepth:'seventh', chordOverride:'auto', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', fretboardSystem:'caged', shape:'E', direction:'up_down', sequence:'none', keyCycle:'none' } },
        { id:'arpeggios',   name:'Diatonic 7th arpeggios',   kind:'diatonic_arpeggios',
          config:{ key:'C', scale:'major', chordDepth:'seventh', chordOverride:'auto', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', fretboardSystem:'caged', shape:'E', direction:'up_down', keyCycle:'none' } }
      ]
    },
    daily_intermediate: {
      version:1,
      name:'Daily 30-min Intermediate',
      description:'Segmented practice session: chromatic warmup, CAGED scale run, sequence pattern, diatonic arpeggios, sweep arpeggios.',
      stringSetup:'guitar_6_standard',
      tags:['intermediate','technique'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'chromatic',   name:'Chromatic warmup',            kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:80, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'sixteenth', keyCycle:'none' } },
        { id:'caged_scale', name:'C major — E-shape',           kind:'scale',
          config:{ key:'C', scale:'major', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'fours',       name:'Fours ascending sequence',    kind:'scale',
          config:{ key:'C', scale:'major', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'ascending', sequence:'fours', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'arpeggios',   name:'Diatonic 7th arpeggios',      kind:'diatonic_arpeggios',
          config:{ key:'C', scale:'major', chordDepth:'seventh', chordOverride:'auto', bpm:100, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'sweeps',      name:'Sweep arpeggios — Am',        kind:'sweep_arpeggios',
          config:{ key:'A', scale:'natural_minor', chordDepth:'triad', chordOverride:'auto', bpm:70, bars:8, meter:'4/4', subdivision:'sixteenth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    blues_fundamentals: {
      version:1,
      name:'Blues Fundamentals',
      description:'Chromatic warmup → minor pentatonic box 1 → blues scale → chord scales over 12-bar form. The essential first-year blues vocabulary in A.',
      stringSetup:'guitar_6_standard',
      tags:['beginner','blues'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'chromatic',  name:'Chromatic warmup',             kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:70, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'sixteenth', keyCycle:'none' } },
        { id:'pent',       name:'A minor pentatonic — E-shape', kind:'scale',
          config:{ key:'A', scale:'minor_pentatonic', bpm:80, bars:12, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'dom7', keyCycle:'none' } },
        { id:'blues',      name:'A blues scale — E-shape',      kind:'scale',
          config:{ key:'A', scale:'blues', bpm:80, bars:12, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'dom7', keyCycle:'none' } },
        { id:'chord_scales',name:'Chord scales — 12-bar',       kind:'chord_scales',
          config:{ key:'A', scale:'minor_pentatonic', bpm:90, bars:12, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', chordScaleStrategy:'mode_of_moment', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'dom7', keyCycle:'none' } }
      ]
    },
    bebop_fundamentals: {
      version:1,
      name:'Bebop Fundamentals',
      description:'Dominant bebop scale applied to ii-V-I. Chromatic passing tone ensures chord tones land on strong beats — the grammar of bebop improvisation.',
      stringSetup:'guitar_6_standard',
      tags:['jazz','bebop','intermediate'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'chromatic',       name:'Chromatic warmup',          kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:80, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'sixteenth', keyCycle:'none' } },
        { id:'major_scale',     name:'C major — E-shape',         kind:'scale',
          config:{ key:'C', scale:'major', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'bebop_dominant',  name:'Bebop dominant — ii-V-I',   kind:'chord_scales',
          config:{ key:'C', scale:'bebop_dominant', progression:'ii-V-I', chordScaleStrategy:'mode_of_moment', chordDepth:'seventh', chordOverride:'auto', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'ascending', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'ii_v_i_arps',     name:'ii–V–I arpeggios',          kind:'progression_arpeggios',
          config:{ key:'C', scale:'major', progression:'ii-V-I', chordDepth:'seventh', chordOverride:'auto', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    // ── Added 2026-06-02 to reach a credible starter library (≥10). Spread
    // across goal × level × time × genre × instrument, and DELIBERATELY shallow
    // on the primitive palette (each uses 3–4 of the 29 types, a handful of
    // scales/progressions) so a user's own workout has plenty of room to differ.
    quick_warmup: {
      version:1,
      name:'Warm-up — 10 minutes',
      description:'A fast loosen-up before you really practise: chromatic finger independence, a clean scale run, then flowing legato. Any level, any day.',
      stringSetup:'guitar_6_standard',
      tags:['warm-up','short','any level'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'chromatic', name:'Chromatic 1-2-3-4',      kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:80, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'sixteenth', keyCycle:'none' } },
        { id:'scale',     name:'C major — E-shape',       kind:'scale',
          config:{ key:'C', scale:'major', bpm:100, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'legato',    name:'Legato — A minor pent',   kind:'legato',
          config:{ key:'A', scale:'minor_pentatonic', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    beginner_foundations: {
      version:1,
      name:'Beginner Foundations',
      description:'The first-year guitar bedrock: the minor-pentatonic box, the major scale in a second shape, then turning the scale into chord tones with triad arpeggios.',
      stringSetup:'guitar_6_standard',
      tags:['beginner','foundational'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'pent',   name:'A minor pentatonic — E-shape', kind:'scale',
          config:{ key:'A', scale:'minor_pentatonic', bpm:75, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'major',  name:'C major — C-shape',            kind:'scale',
          config:{ key:'C', scale:'major', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'C', keyCycle:'none' } },
        { id:'triads', name:'Diatonic triads',              kind:'diatonic_arpeggios',
          config:{ key:'C', scale:'major', chordDepth:'triad', chordOverride:'auto', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    rock_essentials: {
      version:1,
      name:'Rock Essentials',
      description:'Power-chord pedal riffing, the minor-pentatonic lead box, and expressive whole-step bends — the core rock rhythm-and-lead vocabulary in E minor.',
      stringSetup:'guitar_6_standard',
      tags:['rock','beginner'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'riff',    name:'Power-chord pedal riff',    kind:'pedal_riff',
          config:{ harmonize:false, scale:'natural_minor', key:'E', meter:'4/4', subdivision:'eighth', bpm:100, bars:8, direction:'up_down', fretboardSystem:'position', progression:'i-VII-VI-VII', chordOverride:'5', swing:'straight', fretMin:0, fretMax:7, keyCycle:'none' } },
        { id:'pent',    name:'E minor pentatonic — E-shape', kind:'scale',
          config:{ key:'E', scale:'minor_pentatonic', bpm:100, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'bends',   name:'Whole-step bends',          kind:'bending',
          config:{ bendTarget:'whole', scale:'minor_pentatonic', key:'E', meter:'4/4', subdivision:'quarter', bpm:70, bars:8, direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    funk_pocket: {
      version:1,
      name:'Funk Pocket & Vocabulary',
      description:'Sit in a 16th-note Dorian pocket, displace the rhythm, comp two-note shell voicings, then snap octaves — the building blocks of funk phrasing in A Dorian.',
      stringSetup:'guitar_6_standard',
      tags:['funk','intermediate'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'pocket',  name:'A Dorian — 16th pocket',    kind:'scale',
          config:{ key:'A', scale:'dorian', bpm:95, bars:8, meter:'4/4', subdivision:'sixteenth', direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'displace',name:'Rhythmic displacement',     kind:'rhythmic_displacement',
          config:{ key:'A', scale:'dorian', bpm:95, bars:8, meter:'4/4', subdivision:'sixteenth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'shells',  name:'Shell voicings',            kind:'shell_voicings',
          config:{ key:'A', scale:'dorian', progression:'i-VII-VI-VII', chordDepth:'seventh', chordOverride:'min7', bpm:90, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'octaves', name:'Octave displacement',       kind:'octave_displacement',
          config:{ key:'A', scale:'dorian', bpm:95, bars:8, meter:'4/4', subdivision:'sixteenth', direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    metal_technique: {
      version:1,
      name:'Metal Technique',
      description:'Chromatic warm-up into a chromatic-pedal chug, the Phrygian-dominant exotic run, then minor-triad sweeps — the heavy rhythm-and-shred toolkit in E.',
      stringSetup:'guitar_6_standard',
      tags:['metal','advanced'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'warmup',  name:'Chromatic warm-up',         kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:90, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'sixteenth', keyCycle:'none' } },
        { id:'chug',    name:'Chromatic pedal chug',      kind:'pedal_riff',
          config:{ harmonize:false, scale:'phrygian', key:'E', meter:'4/4', subdivision:'sixteenth', bpm:120, bars:8, direction:'up_down', fretboardSystem:'position', progression:'metal_pedal_chromatic', chordOverride:'5', swing:'straight', fretMin:0, fretMax:7, keyCycle:'none' } },
        { id:'exotic',  name:'Phrygian dominant — fours',  kind:'scale',
          config:{ key:'E', scale:'phrygian_dominant', bpm:100, bars:8, meter:'4/4', subdivision:'sixteenth', direction:'up_down', sequence:'fours', fretboardSystem:'caged', shape:'E', keyCycle:'none' } },
        { id:'sweeps',  name:'Minor-triad sweeps',        kind:'sweep_arpeggios',
          config:{ key:'E', scale:'natural_minor', chordDepth:'triad', chordOverride:'auto', progression:'i-VI-III-VII', meter:'4/4', subdivision:'sixteenth', bpm:80, bars:8, direction:'up_down', fretboardSystem:'caged', shape:'E', keyCycle:'none' } }
      ]
    },
    bass_foundations: {
      version:1,
      name:'Bass Foundations',
      description:'A first bass routine: chromatic finger drills, the minor-pentatonic box, chord-tone (arpeggio) targeting, then a walking line over ii–V–I.',
      stringSetup:'bass_4_standard',
      tags:['bass','beginner'],
      bpmLadder:{ enabled:false },
      keyCycle:{ enabled:false },
      segments:[
        { id:'chromatic', name:'Chromatic 1-2-3-4',       kind:'chromatic',
          config:{ chromaticPattern:'1234', bpm:70, bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4, meter:'4/4', subdivision:'eighth', stringSetup:'bass_4_standard', keyCycle:'none' } },
        { id:'pent',      name:'A minor pentatonic',       kind:'scale',
          config:{ key:'A', scale:'minor_pentatonic', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', sequence:'none', fretboardSystem:'position', fretMin:0, fretMax:5, stringSetup:'bass_4_standard', keyCycle:'none' } },
        { id:'arps',      name:'Chord-tone targeting',     kind:'diatonic_arpeggios',
          config:{ key:'C', scale:'major', chordDepth:'triad', chordOverride:'auto', bpm:80, bars:8, meter:'4/4', subdivision:'eighth', direction:'up_down', fretboardSystem:'position', stringSetup:'bass_4_standard', keyCycle:'none' } },
        { id:'walk',      name:'Walking bass — ii–V–I',    kind:'walking_bass',
          config:{ key:'C', scale:'major', progression:'ii-V-I', chordDepth:'seventh', chordOverride:'auto', bpm:80, bars:8, meter:'4/4', subdivision:'quarter', direction:'up_down', fretboardSystem:'position', stringSetup:'bass_4_standard', keyCycle:'none' } }
      ]
    },

    // ═══ Phase 7 — starter sessions as ROLE-SKELETONS of template-refs ═════════
    // Each segment is a { id, templateId } ref into SEGMENT_TEMPLATES (materialized
    // at the top of buildSessionChart via rollSegment); inline-config sessions above
    // still work. Composition rules: warm-up first · ≥1 isolation before application
    // · ≤2 same-primitive in a row · ~3–5 blocks. The session's stringSetup must
    // match the templates' instrument (guitar refs in guitar sessions, bass in bass).
    core_beginner_guitar: {
      version:1, name:'Core — Beginner (guitar)',
      description:'The first-year bedrock as one routine: chromatic warm-up → the minor-pentatonic box → the major scale in CAGED shapes → diatonic triads → a relaxed cool-down.',
      stringSetup:'guitar_6_standard', tags:['beginner','foundational','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'box', templateId:'g_tech_pentatonic_box' }, { id:'scale', templateId:'g_scale_major_caged' }, { id:'arps', templateId:'g_arp_triads' }, { id:'cool', templateId:'g_cool_scale' } ],
    },
    rock_rhythm_lead: {
      version:1, name:'Rock — Rhythm & Lead',
      description:'Warm up, lock power-chord changes, drive an eighth-note power-chord strum, then improvise over a rock vamp.',
      stringSetup:'guitar_6_standard', tags:['rock','beginner','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'power', templateId:'g_tech_power_chords' }, { id:'strum', templateId:'g_comp_rock' }, { id:'jam', templateId:'g_jam_rock' } ],
    },
    blues_workout: {
      version:1, name:'Blues — Lead Workout',
      description:'Warm up, work whole-step bend intonation, learn the blues scale, phrase it over a 12-bar shuffle, then jam.',
      stringSetup:'guitar_6_standard', tags:['blues','intermediate','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'bends', templateId:'g_tech_bending' }, { id:'scale', templateId:'g_blues_scale' }, { id:'shuffle', templateId:'g_app_blues_shuffle' }, { id:'jam', templateId:'g_jam_blues' } ],
    },
    jazz_changes: {
      version:1, name:'Jazz — Playing the Changes',
      description:'Warm up, build seventh-arpeggio vocabulary, voice-lead guide tones, run scales over a ii–V–I, then explore a modal vamp.',
      stringSetup:'guitar_6_standard', tags:['jazz','intermediate','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_scale' }, { id:'arps', templateId:'g_arp_diatonic_7th' }, { id:'guide', templateId:'g_app_guide_tones' }, { id:'changes', templateId:'g_app_ii_v_i' }, { id:'vamp', templateId:'g_jam_modal' } ],
    },
    metal_shred: {
      version:1, name:'Metal — Technique',
      description:'Chromatic warm-up → metalcore pedal chug → melodic gallop → the Phrygian-dominant exotic run → minor-triad sweeps.',
      stringSetup:'guitar_6_standard', tags:['metal','advanced','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'chug', templateId:'g_metal_metalcore' }, { id:'gallop', templateId:'g_metal_gallop' }, { id:'exotic', templateId:'g_metal_phrygian' }, { id:'sweeps', templateId:'g_tech_sweep' } ],
    },
    funk_rhythm_guitar: {
      version:1, name:'Funk — Rhythm Guitar',
      description:'Warm up, sit in a 16th-note pocket, lock a muted 16th funk-scratch comp, then jam over a modal vamp.',
      stringSetup:'guitar_6_standard', tags:['funk','intermediate','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'pocket', templateId:'g_tech_16th_pocket' }, { id:'scratch', templateId:'g_comp_funk' }, { id:'jam', templateId:'g_jam_modal' } ],
    },
    lead_technique: {
      version:1, name:'Lead Technique Builder',
      description:'Warm up, then drill the lead toolkit: legato fluency, clean sweep picking, and a pentatonic recall.',
      stringSetup:'guitar_6_standard', tags:['technique','intermediate','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'legato', templateId:'g_tech_legato' }, { id:'sweep', templateId:'g_tech_sweep' }, { id:'review', templateId:'g_review_pentatonic' } ],
    },
    daily_balanced_guitar: {
      version:1, name:'Daily — Balanced (guitar)',
      description:'A rounded daily session: chromatic warm-up → the pentatonic box → a Dorian scale focus → a mode-per-chord application → a cool-down.',
      stringSetup:'guitar_6_standard', tags:['daily','intermediate','guitar'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'g_warm_chromatic' }, { id:'box', templateId:'g_tech_pentatonic_box' }, { id:'dorian', templateId:'g_scale_dorian' }, { id:'modal', templateId:'g_app_modal' }, { id:'cool', templateId:'g_cool_arpeggio' } ],
    },
    bass_foundations_groove: {
      version:1, name:'Bass — Foundations & Groove',
      description:'The bass bedrock in the right order: chromatic warm-up → right-hand alternation → the root–5th–octave box → the major scale box → a walking line.',
      stringSetup:'bass_4_standard', tags:['bass','beginner','foundational'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'b_warm_chromatic' }, { id:'rh', templateId:'b_tech_right_hand' }, { id:'box', templateId:'b_tech_root_fifth_octave' }, { id:'scale', templateId:'b_scale_major' }, { id:'walk', templateId:'b_app_walking' } ],
    },
    bass_pocket: {
      version:1, name:'Bass — The Pocket',
      description:'Right-hand stamina → the octave bounce → the 16th-note dead-note pocket → a funk groove jam. Groove first, the bass way.',
      stringSetup:'bass_4_standard', tags:['bass','funk','intermediate'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'b_warm_chromatic' }, { id:'rh', templateId:'b_tech_right_hand' }, { id:'octave', templateId:'b_tech_octave_groove' }, { id:'dead', templateId:'b_tech_dead_note' }, { id:'jam', templateId:'b_jam_funk' } ],
    },
    bass_walking: {
      version:1, name:'Bass — Walking Lines',
      description:'Warm up, build seventh-arpeggio chord tones, voice-lead guide tones, then walk a ii–V–I and a 12-bar blues.',
      stringSetup:'bass_4_standard', tags:['bass','jazz','intermediate'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'b_warm_scale' }, { id:'arps', templateId:'b_arp_sevenths' }, { id:'guide', templateId:'b_app_guide_tones' }, { id:'walk', templateId:'b_app_walking' }, { id:'blues', templateId:'b_app_walking_blues' } ],
    },
    bass_slap_workout: {
      version:1, name:'Bass — Slap & Pop',
      description:'Build the right hand and the dead-note pocket first, THEN add slap & pop (gated after fingerstyle), and jam it.',
      stringSetup:'bass_4_standard', tags:['bass','funk','advanced'],
      bpmLadder:{ enabled:false }, keyCycle:{ enabled:false },
      segments:[ { id:'warmup', templateId:'b_warm_chromatic' }, { id:'rh', templateId:'b_tech_right_hand' }, { id:'dead', templateId:'b_tech_dead_note' }, { id:'slap', templateId:'b_tech_slap' }, { id:'jam', templateId:'b_jam_funk' } ],
    }
  };

  // ===========================================================================
  // §4 · CAGED / 3NPS / OPEN SHAPE SYSTEM
  // CAGED_SHAPES (unified source of truth) + degree-driven, no-unison resolution.
  // ===========================================================================
  //
  // A "shape" is a way of organizing a scale across the fretboard. SlopScale
  // supports three systems: CAGED (5 shapes), 3NPS (7 modal positions), and
  // Open (key-specific, uses open strings). The fret window of a shape is
  // *derived* from the key — it isn't a user-supplied fret range.
  //
  // String indices follow SlopScale's existing convention: s=0 is the lowest
  // string (low E in standard tuning, index 0 of openMidis). s=5 is high E.
  //
  // See docs/fretboard-pedagogy.md for the design rationale and
  // docs/position-system-rework.md for how this data model is intended to
  // flow into the rest of the plugin.

  // Unified CAGED shape data — single source of truth.
  //
  // Each shape stores everything the plugin needs to know about it:
  //   - rootStringIdx:           which string the canonical root sits on
  //                              (s=0 is low E in standard tuning, per
  //                              SlopScale's openMidis convention)
  //   - displayName:             user-facing label
  //   - scaleFretSpanFromRoot:   [low, high] offsets that define the fret
  //                              window of the scale shape relative to the
  //                              root's fret on rootStringIdx
  //   - chordTemplates:          chord-tone offsets for rendering chord boxes
  //                              on the highway, one entry per chord quality
  //                              (maj / min / dim). Each entry is an array of
  //                              { s, fOff, iv } where s is the string
  //                              (low-E=0), fOff is the fret offset from the
  //                              shape's rootFret, and iv is the interval in
  //                              semitones above the chord root.
  //
  // Worked example — C-shape in C major:
  //   rootStringIdx 1 (A string), keyPc 0 (C), so rootFret = 3.
  //   scaleFretSpanFromRoot [-3, 2] → scale window is frets 0..5.
  //   chordTemplates.maj has the C-shape chord-tone offsets relative to that
  //   root fret 3.
  //
  // Historical note: the previous version of this file used two separate
  // structures (CAGED_SHAPE_DEFS for chord templates in a high-E=0 indexing,
  // and a separate scale-shape map in low-E=0). Those were unified here on
  // 2026-05-26 to a single low-E=0 table so the two halves can't drift apart.
  // Each chordTemplate entry: { s, fOff, iv, fg }
  //   s   — string index (low-E=0)
  //   fOff — fret offset from the shape's root fret
  //   iv  — interval class above root (0=root, 3=minor 3rd, 4=major 3rd, 6=dim5, 7=perfect 5th)
  //   fg  — suggested left-hand finger (1=index, 2=middle, 3=ring, 4=pinky).
  //         Encoded for the *barre form*; when the resulting fret = 0 (open),
  //         the renderer should show an open-string marker and ignore fg.
  //         Repeated fg values across adjacent strings indicate a barre/mini-barre.
  const CAGED_SHAPES = {
    C: {
      rootStringIdx: 1, displayName: 'C-shape', scaleFretSpanFromRoot: [-3, 2],
      chordTemplates: {
        maj: [{s:1,fOff:0,iv:0,fg:4},{s:2,fOff:-1,iv:4,fg:3},{s:3,fOff:-3,iv:7,fg:1},{s:4,fOff:-2,iv:0,fg:2},{s:5,fOff:-3,iv:4,fg:1}],
        min: [{s:1,fOff:0,iv:0,fg:4},{s:2,fOff:-2,iv:3,fg:3},{s:3,fOff:-3,iv:7,fg:2},{s:4,fOff:-2,iv:0,fg:3},{s:5,fOff:-4,iv:3,fg:1}],
        dim: [{s:1,fOff:0,iv:0,fg:4},{s:2,fOff:-2,iv:3,fg:2},{s:3,fOff:-4,iv:6,fg:1},{s:4,fOff:-2,iv:0,fg:3},{s:5,fOff:-4,iv:3,fg:1}]
      }
    },
    A: {
      rootStringIdx: 1, displayName: 'A-shape', scaleFretSpanFromRoot: [-1, 4], pentFretSpanFromRoot: [0, 3],
      chordTemplates: {
        maj: [{s:1,fOff:0,iv:0,fg:1},{s:2,fOff:2,iv:7,fg:3},{s:3,fOff:2,iv:0,fg:3},{s:4,fOff:2,iv:4,fg:3},{s:5,fOff:0,iv:7,fg:1}],
        min: [{s:1,fOff:0,iv:0,fg:1},{s:2,fOff:2,iv:7,fg:3},{s:3,fOff:2,iv:0,fg:4},{s:4,fOff:1,iv:3,fg:2},{s:5,fOff:0,iv:7,fg:1}],
        dim: [{s:1,fOff:0,iv:0,fg:1},{s:2,fOff:1,iv:6,fg:2},{s:3,fOff:2,iv:0,fg:4},{s:4,fOff:1,iv:3,fg:3},{s:5,fOff:-1,iv:6,fg:1}]
      }
    },
    G: {
      rootStringIdx: 0, displayName: 'G-shape', scaleFretSpanFromRoot: [-3, 2],
      chordTemplates: {
        // G-shape is overwhelmingly played as an open chord (3-2-0-0-0-3, classic
        // 2-1-0-0-0-3 fingering). Barre-up form is rare/uncomfortable.
        maj: [{s:0,fOff:0,iv:0,fg:2},{s:1,fOff:-1,iv:4,fg:1},{s:2,fOff:-3,iv:7,fg:1},{s:3,fOff:-3,iv:0,fg:1},{s:4,fOff:-3,iv:4,fg:1},{s:5,fOff:0,iv:0,fg:3}],
        min: [{s:0,fOff:0,iv:0,fg:2},{s:1,fOff:-2,iv:3,fg:1},{s:2,fOff:-3,iv:7,fg:1},{s:3,fOff:-3,iv:0,fg:1},{s:4,fOff:-4,iv:3,fg:1},{s:5,fOff:0,iv:0,fg:3}],
        dim: [{s:0,fOff:0,iv:0,fg:2},{s:1,fOff:-2,iv:3,fg:1},{s:2,fOff:-4,iv:6,fg:1},{s:3,fOff:-3,iv:0,fg:1},{s:4,fOff:-4,iv:3,fg:1},{s:5,fOff:0,iv:0,fg:3}]
      }
    },
    E: {
      rootStringIdx: 0, displayName: 'E-shape', scaleFretSpanFromRoot: [-1, 4], pentFretSpanFromRoot: [0, 3],
      chordTemplates: {
        // E-shape barre is the canonical movable shape — fingering encoded for
        // the barre form (e.g. F major at rootFret 1: 1-3-3-2-1-1).
        maj: [{s:0,fOff:0,iv:0,fg:1},{s:1,fOff:2,iv:7,fg:3},{s:2,fOff:2,iv:0,fg:4},{s:3,fOff:1,iv:4,fg:2},{s:4,fOff:0,iv:7,fg:1},{s:5,fOff:0,iv:0,fg:1}],
        min: [{s:0,fOff:0,iv:0,fg:1},{s:1,fOff:2,iv:7,fg:3},{s:2,fOff:2,iv:0,fg:4},{s:3,fOff:0,iv:3,fg:1},{s:4,fOff:0,iv:7,fg:1},{s:5,fOff:0,iv:0,fg:1}],
        dim: [{s:0,fOff:0,iv:0,fg:1},{s:1,fOff:1,iv:6,fg:2},{s:2,fOff:2,iv:0,fg:4},{s:3,fOff:0,iv:3,fg:1},{s:4,fOff:-1,iv:6,fg:1},{s:5,fOff:0,iv:0,fg:1}]
      }
    },
    D: {
      rootStringIdx: 2, displayName: 'D-shape', scaleFretSpanFromRoot: [-2, 3],
      chordTemplates: {
        maj: [{s:2,fOff:0,iv:0,fg:1},{s:3,fOff:2,iv:7,fg:2},{s:4,fOff:3,iv:0,fg:4},{s:5,fOff:2,iv:4,fg:3}],
        min: [{s:2,fOff:0,iv:0,fg:1},{s:3,fOff:2,iv:7,fg:3},{s:4,fOff:3,iv:0,fg:4},{s:5,fOff:1,iv:3,fg:2}],
        dim: [{s:2,fOff:0,iv:0,fg:1},{s:3,fOff:1,iv:6,fg:1},{s:4,fOff:3,iv:0,fg:3},{s:5,fOff:1,iv:3,fg:1}]
      }
    }
  };
  const CAGED_CYCLE = ['C', 'A', 'G', 'E', 'D']; // cyclic order (C→A→G→E→D→C…)

  // 3NPS positions, named by mode. Each position starts on a specific scale
  // degree on the low E string, then places 3 consecutive scale degrees on
  // each subsequent string.
  const THREE_NPS_POSITION_DEFS = {
    1: { startDegree: 1, mode: 'Ionian',     displayName: 'Position 1 (Ionian)' },
    2: { startDegree: 2, mode: 'Dorian',     displayName: 'Position 2 (Dorian)' },
    3: { startDegree: 3, mode: 'Phrygian',   displayName: 'Position 3 (Phrygian)' },
    4: { startDegree: 4, mode: 'Lydian',     displayName: 'Position 4 (Lydian)' },
    5: { startDegree: 5, mode: 'Mixolydian', displayName: 'Position 5 (Mixolydian)' },
    6: { startDegree: 6, mode: 'Aeolian',    displayName: 'Position 6 (Aeolian)' },
    7: { startDegree: 7, mode: 'Locrian',    displayName: 'Position 7 (Locrian)' }
  };
  const THREE_NPS_CYCLE = [1, 2, 3, 4, 5, 6, 7];

  // Pitch-class helpers — independent of any tuning, derived from openMidis.
  function openPcForString(openMidis, stringIdx) {
    return openMidis[stringIdx] % 12;
  }
  function lowestFretWithPc(openPc, targetPc) {
    return ((targetPc - openPc) + 12) % 12;
  }
  function scaleSemitones(scale) {
    return SCALE_INTERVALS[scale] || SCALE_INTERVALS.major;
  }
  function pcOfDegree(keyPc, degree, scale) {
    const semis = scaleSemitones(scale);
    if (degree < 1 || degree > semis.length) return null;
    return (keyPc + semis[degree - 1]) % 12;
  }
  function degreeOfPc(keyPc, notePc, scale) {
    const semis = scaleSemitones(scale);
    const interval = ((notePc - keyPc) + 12) % 12;
    const idx = semis.indexOf(interval);
    return idx === -1 ? null : idx + 1;
  }
  // Suggested left-hand finger for a note in a box (1=index..4=pinky, 0=open).
  // One-finger-per-fret from the box's index-finger anchor, clamped to 1–4.
  // The B and high-E strings (s=4,5) get a −1 nudge because the G→B major-3rd
  // tuning gap shifts the same shape one fret higher there; un-nudging keeps the
  // canonical fingering (validated by the fretboard-pedagogy review, 2026-05-29).
  function scaleFingerFor(s, f, anchorFret, applyGBNudge) {
    if (f <= 0) return 0; // open string
    const nudge = (applyGBNudge && s >= 4) ? 1 : 0;
    return Math.max(1, Math.min(4, (f - anchorFret + 1) - nudge));
  }
  // 3NPS fingering for the three ascending frets on one string, from the standard
  // per-string interval lookup: whole-whole (span 4) = 1-2-4, whole-half = 1-2-3,
  // half-whole = 1-3-4. (fretboard-pedagogy review, 2026-05-29.)
  function threeNpsStringFingers(frets) {
    const g1 = frets[1] - frets[0], g2 = frets[2] - frets[1];
    if (g1 >= 2 && g2 >= 2) return [1, 2, 4];
    if (g1 >= 2 && g2 < 2) return [1, 2, 3];
    if (g1 < 2 && g2 >= 2) return [1, 3, 4];
    return [1, 2, 3];
  }

  // Resolve a CAGED shape in a given key.
  // Returns { fretMin, fretMax, rootFret, rootStringIdx, notes: [{s,f,d,isRoot}], displayName }
  // or null if the shape is undefined.
  function resolveCAGEDShape(keyPc, shape, scale, openMidis) {
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    // CAGED is a 6-string system — its shapes encode the standard EADGBE interval
    // pattern. On an extended-range guitar (7/8-string) the box is anchored on the
    // TOP SIX strings (the EADGBE sub-group); the extra low string(s) are treated
    // as added range, NOT part of the shape. Anchoring across all N strings would
    // root e.g. the E-shape on the low B/F# — a box no method book teaches and no
    // player has under their fingers. `off` shifts the shape's string indices up
    // into that top-six window; off=0 for a standard 6-string, so this is a no-op
    // there (and keeps arpeggio-CAGED, which contains to 6, and scale-CAGED
    // consistent). Extended-range design per the guitar-pedagogy review, 2026-06-01.
    const numStrings = openMidis.length;
    const off = Math.max(0, numStrings - 6);
    const rootStringIdx = def.rootStringIdx + off;
    const rootOpenPc = openPcForString(openMidis, rootStringIdx);
    let rootFret = lowestFretWithPc(rootOpenPc, keyPc);
    const spanDef = (def.pentFretSpanFromRoot && (scale === 'minor_pentatonic' || scale === 'major_pentatonic' || scale === 'blues'))
      ? def.pentFretSpanFromRoot : def.scaleFretSpanFromRoot;
    // Nut-clamp fix: if the box would extend below the nut (rootFret too low, so
    // the lower part of the shape is unplayable and the box collapses to a sliver
    // at fret 0), shift the whole shape up an octave so it resolves as a complete,
    // canonical fretted box. CAGED shapes are fretted boxes — open-string
    // vocabulary belongs to the separate Open position system.
    if (rootFret + spanDef[0] < 0) rootFret += 12;
    const fretMin = rootFret + spanDef[0];
    const fretMax = rootFret + spanDef[1];
    const firstFret = Math.max(0, fretMin);
    // Degree-driven, no-unison selection. A naive fret-window block repeats the
    // SAME pitch wherever two adjacent strings overlap (e.g. A-major A-shape:
    // B on the G string f4 and the B string f0). Per the no-unison rule, each
    // pitch may sound on only one string in the box; the lower string wins a
    // shared pitch (added first) so the box stays compact and ascending. Roots
    // in different octaves are distinct pitches and are all kept.
    const notes = [];
    const usedMidi = new Set();
    for (let s = off; s < numStrings; s++) {
      const openPc = openPcForString(openMidis, s);
      const openMidi = openMidis[s];
      for (let f = firstFret; f <= fretMax; f++) {
        const notePc = (openPc + f) % 12;
        const degree = degreeOfPc(keyPc, notePc, scale);
        if (degree === null) continue;
        const midi = openMidi + f;
        if (usedMidi.has(midi)) continue; // unison already placed on a lower string
        usedMidi.add(midi);
        // Fingering is computed against the 6-string-equivalent index (s - off):
        // scaleFingerFor's G→B nudge keys off the B-string index (4 on a 6-string),
        // so on the top-6 of a 7/8-string the same EADGBE box must reuse the
        // 6-string indices or the nudge would fire on the wrong (G) string.
        notes.push({ s, f, d: degree, isRoot: degree === 1, fg: scaleFingerFor(s - off, f, firstFret, true) });
      }
    }
    return {
      fretMin: Math.max(0, fretMin),
      fretMax,
      rootFret,
      rootStringIdx,
      notes,
      displayName: def.displayName
    };
  }

  // Resolve a 3NPS position in a given key.
  // Generates 3 consecutive scale degrees per string starting from `position`
  // on the low E string, then climbs the rest of the strings by +3 degrees each.
  // Fret choice: lowest valid fret per degree, with octave bumps to keep each
  // string's notes ascending AND keep the position climbing across strings.
  function resolveThreeNPSPosition(keyPc, position, scale, openMidis) {
    const def = THREE_NPS_POSITION_DEFS[position];
    if (!def) return null;
    const semis = scaleSemitones(scale);
    const NUM_DEGREES = semis.length;
    const notes = [];
    let prevHighMidi = -1;
    const numStrings = openMidis.length;
    for (let s = 0; s < numStrings; s++) {
      const baseDegreeIdx = ((def.startDegree - 1) + s * 3) % NUM_DEGREES;
      const degrees = [
        baseDegreeIdx,
        (baseDegreeIdx + 1) % NUM_DEGREES,
        (baseDegreeIdx + 2) % NUM_DEGREES
      ];
      const openPc = openPcForString(openMidis, s);
      const openMidi = openMidis[s];
      const fretsForDegrees = degrees.map(idx => lowestFretWithPc(openPc, (keyPc + semis[idx]) % 12));
      for (let i = 1; i < fretsForDegrees.length; i++) {
        while (openMidi + fretsForDegrees[i] <= openMidi + fretsForDegrees[i - 1]) {
          fretsForDegrees[i] += 12;
        }
      }
      while (prevHighMidi >= 0 && openMidi + fretsForDegrees[0] <= prevHighMidi) {
        for (let i = 0; i < fretsForDegrees.length; i++) fretsForDegrees[i] += 12;
      }
      prevHighMidi = openMidi + fretsForDegrees[fretsForDegrees.length - 1];
      const fingers = threeNpsStringFingers(fretsForDegrees);
      for (let i = 0; i < degrees.length; i++) {
        notes.push({ s, f: fretsForDegrees[i], d: degrees[i] + 1, isRoot: degrees[i] === 0, fg: fingers[i] });
      }
    }
    const allFrets = notes.map(n => n.f);
    return {
      fretMin: Math.min.apply(null, allFrets),
      fretMax: Math.max.apply(null, allFrets),
      rootFret: notes.find(n => n.isRoot && n.s === 0)?.f ?? null,
      rootStringIdx: 0,
      notes,
      displayName: def.displayName
    };
  }

  // Resolve the open-position shape for a given key.
  // Generates all scale notes in frets 0–3 across every string. Some keys have
  // very few notes here (e.g., F#, Bb in major) — callers can check the note
  // count and decide whether Open is sensible for the key.
  function resolveOpenShape(keyPc, scale, openMidis) {
    const fretMin = 0;
    const fretMax = 3;
    const notes = [];
    const numStrings = openMidis.length;
    // Open position is built from the EADGBE open-string vocabulary — like CAGED it
    // anchors on the TOP SIX strings on a 7/8-string (off = N-6). Without this, the
    // low B/F# open string can claim a pitch first and, because dedupe is
    // lower-string-wins, EVICT it from the canonical standard string the player
    // expects — pulling notes OFF the standard strings, not just adding junk on an
    // unused one. (Extended-range fix, guitar-pedagogy review 2026-06-01.)
    const off = Math.max(0, numStrings - 6);
    // No-unison selection (see resolveCAGEDShape): drop a pitch already placed
    // on a lower string so open position never doubles a note across strings.
    const usedMidi = new Set();
    for (let s = off; s < numStrings; s++) {
      const openPc = openPcForString(openMidis, s);
      const openMidi = openMidis[s];
      for (let f = fretMin; f <= fretMax; f++) {
        const notePc = (openPc + f) % 12;
        const degree = degreeOfPc(keyPc, notePc, scale);
        if (degree === null) continue;
        const midi = openMidi + f;
        if (usedMidi.has(midi)) continue;
        usedMidi.add(midi);
        notes.push({ s, f, d: degree, isRoot: degree === 1, fg: scaleFingerFor(s, f, 1, false) });
      }
    }
    return { fretMin, fretMax, rootFret: null, rootStringIdx: null, notes, displayName: 'Open position' };
  }

  // Heuristic for whether Open position is a sensible system for this key.
  // The "open position" character comes from ringing open strings — so the
  // key must have at least 2 unique open-string pitches in its scale.
  // This excludes Db, F#, and Ab major (≤1 open string in scale) and
  // includes everything else.
  function isOpenSystemSensible(keyPc, scale, openMidis) {
    const semis = scaleSemitones(scale);
    const scalePcs = new Set(semis.map(s => (keyPc + s) % 12));
    const openInScale = new Set();
    for (let s = 0; s < openMidis.length; s++) {
      const openPc = openMidis[s] % 12;
      if (scalePcs.has(openPc)) openInScale.add(openPc);
    }
    return openInScale.size >= 2;
  }

  // Unified entry point. Returns the shape's resolved data or null.
  function fretWindowForShape(keyPc, system, shape, scale, openMidis) {
    if (system === 'caged')   return resolveCAGEDShape(keyPc, shape, scale, openMidis);
    if (system === '3nps')    return resolveThreeNPSPosition(keyPc, shape, scale, openMidis);
    if (system === 'open')    return resolveOpenShape(keyPc, scale, openMidis);
    return null;
  }

  // Available shapes for a system, ordered low-to-high by where each shape
  // sits on the neck for the given key. Used by the Shape dropdown to list
  // shapes in fret order and by Next Variation to cycle through them.
  function shapeOrderForKey(keyPc, system, scale, openMidis) {
    if (system === 'caged') {
      return CAGED_CYCLE
        .map(shape => ({ shape, resolved: resolveCAGEDShape(keyPc, shape, scale, openMidis) }))
        .filter(entry => entry.resolved)
        .sort((a, b) => a.resolved.fretMin - b.resolved.fretMin)
        .map(entry => entry.shape);
    }
    if (system === '3nps') {
      return THREE_NPS_CYCLE
        .map(shape => ({ shape, resolved: resolveThreeNPSPosition(keyPc, shape, scale, openMidis) }))
        .filter(entry => entry.resolved)
        .sort((a, b) => a.resolved.fretMin - b.resolved.fretMin)
        .map(entry => entry.shape);
    }
    if (system === 'open') {
      return isOpenSystemSensible(keyPc, scale, openMidis) ? ['open'] : [];
    }
    return [];
  }

  // Returns the next shape in the cyclic order for the current key, wrapping.
  // Used by the Next Variation button.
  function nextShapeInCycle(keyPc, system, currentShape, scale, openMidis) {
    const order = shapeOrderForKey(keyPc, system, scale, openMidis);
    if (!order.length) return null;
    const idx = order.indexOf(currentShape);
    if (idx === -1) return order[0];
    return order[(idx + 1) % order.length];
  }

  // Map a fretboardSystem value to its kind. Shape-aware systems flow through
  // the new resolver functions; the others fall back to the legacy
  // fretMin/fretMax handling.
  const SHAPE_AWARE_SYSTEMS = new Set(['caged', '3nps', 'open']);
  function isShapeAwareSystem(system) { return SHAPE_AWARE_SYSTEMS.has(system); }

  // Sensible default shape for a system + key.
  function defaultShapeForSystem(system, keyPc, scale, openMidis) {
    if (system === 'open') return 'open';
    const order = shapeOrderForKey(keyPc, system, scale, openMidis);
    if (order && order.length) return order[0];
    if (system === 'caged') return 'C';
    if (system === '3nps')  return 1;
    return null;
  }

  // Human-facing position name for a fret window. "Open position" for any
  // shape sitting at the nut (fretMin === 0); otherwise "Nth position" using
  // the standard guitar convention that "Nth position" = index finger on
  // fret N.
  function positionLabel(fretMin) {
    if (fretMin == null) return '';
    if (fretMin === 0) return 'open position';
    return `${fretMin}${fretMin === 1 ? 'st' : fretMin === 2 ? 'nd' : fretMin === 3 ? 'rd' : 'th'} position`;
  }

  // Human-facing label for a shape: name + position name. The fret range is
  // exposed as a title (tooltip) for the advanced reader who needs the exact
  // window — beginners read "E-shape (open position)" far faster than
  // "E-shape (frets 0-3)".
  function shapeLabel(system, shape, resolved) {
    if (!resolved) return String(shape);
    return `${resolved.displayName} (${positionLabel(resolved.fretMin)})`;
  }
  function shapeLabelTooltip(resolved) {
    if (!resolved || resolved.fretMin == null) return '';
    return `frets ${resolved.fretMin}–${resolved.fretMax}`;
  }

  // Populate the Shape dropdown for the current key + system. Preserves the
  // currently-selected shape if it's still valid for the new system.
  function syncShapeDropdown() {
    const sel = (typeof document !== 'undefined') ? document.getElementById('slopscale-shape') : null;
    if (!sel) return;
    const sysEl = document.getElementById('slopscale-fretboard-system');
    const keyEl = document.querySelector('#slopscale-controls [name="key"]');
    const scaleEl = document.querySelector('#slopscale-controls [name="scale"]');
    const system = sysEl ? sysEl.value : 'caged';
    const keyPc = keyEl ? (NOTE_ALIASES[keyEl.value] ?? 0) : 0;
    const scale = scaleEl ? scaleEl.value : 'major';
    const openMidis = STRING_SETUPS.guitar_6_standard.openMidis;

    // Remember the current selection so we can preserve it across system changes.
    const prev = sel.value;
    sel.innerHTML = '';

    if (!isShapeAwareSystem(system)) {
      // Custom-range / single-string / full-neck — Shape dropdown is hidden by CSS
      // when the parent label has no contents. Leave the select empty.
      return;
    }

    const order = shapeOrderForKey(keyPc, system, scale, openMidis);
    if (!order.length) {
      // No valid shapes (e.g., Open in Db major). Leave a single disabled option.
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '(not available in this key)'; opt.disabled = true;
      sel.appendChild(opt);
      return;
    }
    for (const shape of order) {
      const resolved = fretWindowForShape(keyPc, system, shape, scale, openMidis);
      const opt = document.createElement('option');
      opt.value = String(shape);
      opt.textContent = shapeLabel(system, shape, resolved);
      opt.title = shapeLabelTooltip(resolved);
      sel.appendChild(opt);
    }
    // Restore the previous selection if still valid; otherwise pick the lowest shape.
    if (order.map(String).includes(prev)) {
      sel.value = prev;
    } else {
      sel.value = String(order[0]);
    }

    // Mirror the active shape into the legacy cagedShape hidden input so the
    // chord-template helpers keep working. Only meaningful when system is CAGED.
    const cagedHidden = document.getElementById('slopscale-caged-shape-value');
    if (cagedHidden) {
      if (system === 'caged') cagedHidden.value = sel.value || 'C';
      // For 3NPS/Open, leave the hidden value alone — chord-template helpers
      // aren't called in those shape contexts yet.
    }
  }

  // Resolve the shape selected in the form (or default) into fret range +
  // shape-note set. Called by readConfig. Returns null if the current system
  // isn't shape-aware (callers should fall back to raw fretMin/fretMax).
  function resolveCurrentShape(cfg, openMidis) {
    if (!isShapeAwareSystem(cfg.fretboardSystem)) return null;
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    let shape = cfg.shape;
    // Coerce numeric shape ids for 3NPS (form values are strings).
    if (cfg.fretboardSystem === '3nps') shape = parseInt(shape, 10);
    if (shape == null || shape === '' || (typeof shape === 'number' && isNaN(shape))) {
      shape = defaultShapeForSystem(cfg.fretboardSystem, keyPc, cfg.scale, openMidis);
    }
    const resolved = fretWindowForShape(keyPc, cfg.fretboardSystem, shape, cfg.scale, openMidis);
    if (!resolved) return null;
    return { shape, resolved };
  }

  // Expose for DevTools inspection and (soon) chart generation.
  if (typeof window !== 'undefined') {
    window.__slopscaleShapes = {
      CAGED_SHAPES,
      THREE_NPS_POSITION_DEFS,
      CAGED_CYCLE,
      THREE_NPS_CYCLE,
      resolveCAGEDShape,
      resolveThreeNPSPosition,
      resolveOpenShape,
      isOpenSystemSensible,
      fretWindowForShape,
      shapeOrderForKey,
      nextShapeInCycle,
      defaultShapeForSystem,
      isShapeAwareSystem,
      // Helpers
      openPcForString,
      pcOfDegree,
      degreeOfPc
    };
  }

  // Smoke tests — verify the data model produces correct output for known
  // reference cases. Fires once on load via console.assert; failures are
  // visible in DevTools but don't break the plugin.
  (function smokeTestShapeSystem() {
    const guitar = [40, 45, 50, 55, 59, 64];
    function fretsByString(shape) {
      const map = {};
      for (const n of shape.notes) {
        if (!map[n.s]) map[n.s] = [];
        map[n.s].push(n.f);
      }
      for (const s of Object.keys(map)) map[s] = map[s].slice().sort((a, b) => a - b);
      return map;
    }
    function arraysEqual(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    // CAGED C-shape in C major → frets 0–5, root at A-string fret 3
    const cShapeC = resolveCAGEDShape(0, 'C', 'major', guitar);
    console.assert(cShapeC && cShapeC.fretMin === 0 && cShapeC.fretMax === 5,
      '[SlopScale shapes] C-shape in C major should span frets 0–5', cShapeC);
    console.assert(cShapeC.notes.some(n => n.s === 1 && n.f === 3 && n.isRoot),
      '[SlopScale shapes] C-shape in C major should have root at s=1 f=3', cShapeC);
    // CAGED E-shape in G major → root on low E fret 3, span 2–7
    const eShapeG = resolveCAGEDShape(7, 'E', 'major', guitar);
    console.assert(eShapeG && eShapeG.fretMin === 2 && eShapeG.fretMax === 7,
      '[SlopScale shapes] E-shape in G major should span frets 2–7', eShapeG);
    console.assert(eShapeG.notes.some(n => n.s === 0 && n.f === 3 && n.isRoot),
      '[SlopScale shapes] E-shape in G major should have root at s=0 f=3', eShapeG);
    // 3NPS Position 1 (Ionian) in C major → low E starts at fret 8
    const pos1C = resolveThreeNPSPosition(0, 1, 'major', guitar);
    const pos1Frets = fretsByString(pos1C);
    console.assert(arraysEqual(pos1Frets[0], [8, 10, 12]),
      '[SlopScale shapes] 3NPS Pos 1 in C major, low E should be [8,10,12]', pos1Frets);
    console.assert(arraysEqual(pos1Frets[4], [10, 12, 13]),
      '[SlopScale shapes] 3NPS Pos 1 in C major, B string should be [10,12,13]', pos1Frets);
    // 3NPS Position 1 in G major → low E starts at fret 3
    const pos1G = resolveThreeNPSPosition(7, 1, 'major', guitar);
    const pos1GFrets = fretsByString(pos1G);
    console.assert(arraysEqual(pos1GFrets[0], [3, 5, 7]),
      '[SlopScale shapes] 3NPS Pos 1 in G major, low E should be [3,5,7]', pos1GFrets);
    // CAGED order in C major: C → A → G → E → D
    const cagedC = shapeOrderForKey(0, 'caged', 'major', guitar);
    console.assert(arraysEqual(cagedC, ['C', 'A', 'G', 'E', 'D']),
      '[SlopScale shapes] CAGED order in C major should be C,A,G,E,D', cagedC);
    // CAGED order in G major: G → E → D → C → A
    const cagedG = shapeOrderForKey(7, 'caged', 'major', guitar);
    console.assert(arraysEqual(cagedG, ['G', 'E', 'D', 'C', 'A']),
      '[SlopScale shapes] CAGED order in G major should be G,E,D,C,A', cagedG);
    // Open is sensible for C major (root on B-string fret 1, plenty of notes)
    console.assert(isOpenSystemSensible(0, 'major', guitar),
      '[SlopScale shapes] Open should be sensible for C major');
    // Open is NOT sensible for Db major or Ab major — those are the only two
    // major keys with no root note in frets 0-3 across any string.
    console.assert(!isOpenSystemSensible(1, 'major', guitar),
      '[SlopScale shapes] Open should NOT be sensible for Db major (no root in frets 0-3)');
    console.assert(!isOpenSystemSensible(8, 'major', guitar),
      '[SlopScale shapes] Open should NOT be sensible for Ab major (no root in frets 0-3)');
    // Next-variation cycle in C major CAGED: C → A → G → E → D → C
    console.assert(nextShapeInCycle(0, 'caged', 'C', 'major', guitar) === 'A',
      '[SlopScale shapes] After C-shape in C major, next is A-shape');
    console.assert(nextShapeInCycle(0, 'caged', 'D', 'major', guitar) === 'C',
      '[SlopScale shapes] After D-shape in C major, wraps to C-shape');
    // No-unison rule: a resolved scale shape must never place the same pitch
    // (openMidi + fret) on two strings. Roots in different octaves are distinct
    // midis and are kept; only true unisons are dropped. Regression guard for
    // the duplicate-root bug (fret-window blocks doubled pitches across strings).
    const shapeDupMidis = (resolved) => {
      if (!resolved) return ['unresolved'];
      const seen = new Set(), dups = [];
      for (const n of resolved.notes) {
        const midi = guitar[n.s] + n.f;
        if (seen.has(midi)) dups.push(midi); else seen.add(midi);
      }
      return dups;
    };
    for (const k of [0, 7, 9, 2, 3]) for (const sc of ['major', 'natural_minor', 'harmonic_minor']) {
      for (const shape of CAGED_CYCLE) {
        const d = shapeDupMidis(resolveCAGEDShape(k, shape, sc, guitar));
        console.assert(d.length === 0,
          `[SlopScale no-unison] CAGED ${shape}-shape key=${k} ${sc} doubles a pitch`, d);
      }
      const od = shapeDupMidis(resolveOpenShape(k, sc, guitar));
      console.assert(od.length === 0,
        `[SlopScale no-unison] Open key=${k} ${sc} doubles a pitch`, od);
    }
  })();

  let renderer = null, activeBundle = null, rafId = null, lastExercise = null;
  // The bundle actually handed to the active renderer. Usually === activeBundle,
  // but for the 3D Highway it's a chord-free clone so the host doesn't project
  // chord-shape frames onto the note lane (see attachRenderer + drawOnce).
  let rendererBundle = null;
  let currentPracticeTime = 0, playAnchorMs = 0, playAnchorChartTime = 0, playing = false;
  // Chart time where the current/last playback began (Logic-style: Stop returns
  // the playhead here). Unlike playAnchorChartTime, it does NOT drift on loop wrap.
  let playStartChartTime = 0;
  let _activeSession = null, _sessionStartMs = 0, _newlyUnlockedTier = null;
  let _lastEndedSession = null;  // the just-finished session → the P-sheet "Last session" card
  // A-B segment loop endpoints in chart-time seconds. Null = no loop.
  // See docs/section-looping.md for the design + phasing.
  let segmentLoopA = null, segmentLoopB = null;
  // Transport UI state: tpA/tpB are the user's chosen A/B loop points (either
  // may be set before the other); the committed loop lives in segmentLoopA/B.
  let tpA = null, tpB = null, _loopWraps = 0;
  // Session transport: index of the segment currently under the playhead, so
  // the highlight only touches the DOM when it actually changes.
  let _activeSegIdx = -1;
  let audioCtx = null, audioNodes = [];
  // Continuous whole-chart loop bookkeeping (see maybeScheduleLoopAhead).
  // nextLoopAudioBase = absolute AudioContext time at which the next not-yet-
  // scheduled pass should begin (chart-time 0 maps here). loopPasses tracks
  // each scheduled pass's nodes + end time so finished passes can be
  // disconnected — keeps node count bounded during extended practice.
  let nextLoopAudioBase = 0, loopPasses = [];
  // highway_3d's _bgGetAnalyser() creates a fresh AudioContext every call
  // until setup succeeds, then calls ctx.close() in the catch block when
  // createMediaElementSource throws (stem_mixer already holds the element).
  // That close() produces an audible transient click. Fix: while SlopScale
  // has an active context, return a lightweight stub instead. The stub throws
  // InvalidStateError on createMediaElementSource (flags the failure as
  // permanent so highway_3d stops retrying) and no-ops close() (no click).
  (function patchAudioContextForSharing() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    // The stub must survive WHATEVER highway_3d's analyser setup calls on it, not
    // just createMediaElementSource: it also builds gain/analyser nodes around
    // that source. Any create* returns an inert no-op node (connect/disconnect
    // chainable); createMediaElementSource still throws (the signal that makes
    // highway_3d treat setup as permanently failed and stop retrying); close()
    // no-ops (no real context to close → no audible click). Without the catch-all
    // create*, an early audioCtx (now created on pathway-select preload) flips
    // highway into this path and `ctx.createGain()` throws "not a function".
    const makeFakeCtx = () => {
      const noopNode = new Proxy({}, { get: (_t, p) => ((p === 'connect' || p === 'disconnect') ? (() => noopNode) : (() => {})) });
      const base = {
        state: 'closed',
        currentTime: 0,
        close: () => Promise.resolve(),
        createMediaElementSource: () => {
          throw new DOMException('AudioContext already in use by SlopScale', 'InvalidStateError');
        },
      };
      return new Proxy(base, {
        get(target, prop) {
          if (prop in target) return target[prop];
          if (typeof prop === 'string' && prop.startsWith('create')) return () => noopNode;
          return undefined;
        },
      });
    };
    // Only hand out the click-suppressing stub while SlopScale's OWN screen is
    // the active one (its root has a layout box → offsetParent set; the host
    // hides inactive plugin screens with display:none). When SlopScale is
    // backgrounded — the user is on the host player loading a song — every
    // `new AudioContext()` MUST be the real thing, or OTHER plugins' stem
    // loaders get a context with no decodeAudioData/etc.
    //
    // This is the fix for the v0.5.0 cross-plugin regression: the old gate keyed
    // off "a SlopScale audioCtx exists and isn't closed", which (once the
    // pathway-select preload created the ctx) stayed true for the rest of the
    // session and globally crippled `window.AudioContext` for the whole page —
    // breaking the host's stem decode ("ctx.decodeAudioData is not a function").
    // Scoping to the active screen keeps the highway-click fix (SlopScale on
    // screen) while leaving the global pristine for everyone else.
    const slopscaleActive = () => { const r = document.getElementById('slopscale-root'); return !!(r && r.offsetParent); };
    const Patched = function(...args) {
      if (slopscaleActive() && audioCtx && audioCtx.state !== 'closed') return makeFakeCtx();
      return new Ctor(...args);
    };
    Patched.prototype = Ctor.prototype;
    Object.defineProperty(window, 'AudioContext', { value: Patched, configurable: true, writable: true });
    if (window.webkitAudioContext) Object.defineProperty(window, 'webkitAudioContext', { value: Patched, configurable: true, writable: true });
  }());
  // Notation renderer is notation-only — tab is its own renderer now.
  const notationMode = 'notation';

  // Theme palette for the Tab and Notation renderers. The light theme is the
  // parchment-and-ink look we shipped for Tab; the dark theme mirrors it on a
  // navy ground. The 3D Highway and 2D Highway renderers are not affected —
  // they have their own color identities.
  const RENDER_THEMES = {
    light: {
      bg: '#fbf8ef',          // parchment
      bgAlt: '#fbf8ef',
      ink: '#1a1a1a',          // primary text + strokes
      inkSoft: '#3f3f3f',
      dim: '#6b6b6b',           // secondary text (HUD, measure numbers)
      ledger: '#1a1a1a',
      noteFill: '#1a1a1a',
      noteOutline: '#1a1a1a',
      stem: '#1a1a1a',
      beam: '#1a1a1a',
      keysig: '#1a1a1a',
      accidental: '#1a1a1a',
      chordName: '#1a1a1a',
      sectionLabel: '#1a1a1a',
      hopo: '#1a1a1a',
      bend: '#1a1a1a',
      playhead: '#b91c1c',     // red playhead
      faintLine: 'rgba(0,0,0,0.25)',
    },
    dark: {
      bg: '#0a1322',           // navy ground
      bgAlt: '#070c18',
      ink: '#e2e8f0',
      inkSoft: '#cbd5e1',
      dim: '#94a3b8',
      ledger: '#cbd5e1',
      noteFill: '#e2e8f0',
      noteOutline: '#e2e8f0',
      stem: '#e2e8f0',
      beam: '#e2e8f0',
      keysig: '#e2e8f0',
      accidental: '#e2e8f0',
      chordName: '#bfdbfe',
      sectionLabel: '#fbcfe8',
      hopo: '#cbd5e1',
      bend: '#cbd5e1',
      playhead: '#f87171',
      faintLine: 'rgba(226,232,240,0.18)',
    },
  };
  // Active theme for renderers that participate. Light is the default.
  let currentRenderTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('slopscale.renderTheme')) || 'light';
  if (currentRenderTheme !== 'light' && currentRenderTheme !== 'dark') currentRenderTheme = 'light';
  function getRenderTheme() { return RENDER_THEMES[currentRenderTheme] || RENDER_THEMES.light; }
  function setRenderTheme(name) {
    if (name !== 'light' && name !== 'dark') return;
    currentRenderTheme = name;
    try { localStorage.setItem('slopscale.renderTheme', name); } catch (_) {}
    if (renderer && activeBundle) drawOnce();
  }
  // Pitch tracker state — wraps slopsmithMinigames.scoring.createContinuous (no registration required)
  let _ptHandle = null, _ptNotes = [], _ptOpenMidis = [], _ptScored = new Set();
  // Active pathway state — tracks which pathway is showing and which variation
  // index we are on, so Next Variation rotates predictably.
  let activePathwayId = null;
  let activePathwayVariationIdx = 0;
  let activeTempoTierIdx = 0;
  let _activeBandId = null;   // which band the L2 pathway list is showing
  let jamFeel = 'straight';   // Jam-mode feel (straight / swing / shuffle)

  function $(id) { return document.getElementById(id); }
  function pcName(pc) { return NOTE_NAMES[((pc % 12) + 12) % 12]; }
  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function storage(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } }
  function readHighwayInverted() { return storage('invertHighway', 'false') === 'true'; }
  function readLefty() { return storage('lefty', '0') === '1'; }
  function readRenderScale() { const value = parseFloat(storage('renderScale', '1')); return Number.isFinite(value) && value > 0 ? value : 1; }
  function syncHighwaySettings(bundle) { if (!bundle) return; bundle.inverted = readHighwayInverted(); bundle.lefty = readLefty(); bundle.renderScale = readRenderScale(); }

  function goScreen(id) {
    if (window.slopsmith && typeof window.slopsmith.navigate === 'function') return window.slopsmith.navigate(id);
    if (typeof window.showScreen === 'function') return window.showScreen(id);
    document.querySelector(`[data-screen="${id}"]`)?.click();
  }

  function parseMeter(value) {
    const [sig, groupingRaw] = String(value || '4/4').split(':');
    const [nRaw, dRaw] = sig.split('/');
    const numerator = Math.max(1, parseInt(nRaw || '4', 10));
    const denominator = Math.max(1, parseInt(dRaw || '4', 10));
    const grouping = groupingRaw ? groupingRaw.split('+').map(x => parseInt(x, 10)).filter(Number.isFinite) : [numerator];
    return { numerator, denominator, grouping: grouping.length ? grouping : [numerator] };
  }

  function readConfig() {
    const data = new FormData($('slopscale-controls'));
    const stringSetup = data.get('stringSetup') || 'guitar_6_standard';
    const setup = STRING_SETUPS[stringSetup] || STRING_SETUPS.guitar_6_standard;
    // Effective open-string tuning: a custom per-string override (DADGAD, Drop A,
    // baritone — comma-separated MIDI, low→high) when it's valid for this string
    // count, else the stringSetup's standard midis. Computed HERE, before shape
    // resolution, so CAGED/3NPS/Open shapes resolve against the tuning the player
    // actually has — not the standard one (openMidisForConfig + the resolvers
    // already honour it; this closes the gap for the pre-resolved shape path).
    const customOpenMidis = (() => {
      const raw = (data.get('customOpenMidis') || '').toString().trim();
      if (!raw) return null;
      const list = raw.split(',').map(s => parseInt(s, 10)).filter(Number.isFinite);
      return list.length === setup.openMidis.length ? list : null;
    })();
    const effectiveOpenMidis = customOpenMidis || setup.openMidis;
    // HTML min/max on these inputs are advisory only — a crafted share link (or
    // any FormData) can carry arbitrary values, and fretMin/fretMax drive
    // generation loops (e.g. chordScalePositions). Hard-cap the window so a
    // malicious link can't hang the tab with a giant fret range.
    const MAX_FRET = 36;
    let fretMin = Math.min(MAX_FRET - 1, Math.max(0, parseInt(data.get('fretMin') || '0', 10) || 0));
    let fretMax = Math.min(MAX_FRET, Math.max(fretMin + 1, parseInt(data.get('fretMax') || '5', 10) || 5));
    const practiceType = data.get('practiceType') || data.get('mode') || 'scale';
    const advancedMode = data.get('advancedMode') === 'on';
    // Default fretboard system is CAGED in beginner mode and whatever the user
    // picks in advanced mode. The shape-aware systems (caged/3nps/open) drive
    // fretMin/fretMax via the resolved shape; raw fretMin/fretMax inputs only
    // matter for the 'position' / 'single_string' / 'full_neck' legacy paths.
    const fretboardSystem = advancedMode ? (data.get('fretboardSystem') || 'caged') : 'caged';
    let shape = data.get('shape');
    let shapeNotes = null, shapeDisplayName = null;
    if (isShapeAwareSystem(fretboardSystem)) {
      const resolved = resolveCurrentShape({ fretboardSystem, key: data.get('key') || 'C', scale: data.get('scale') || 'major', shape }, effectiveOpenMidis);
      if (resolved) {
        shape = resolved.shape;
        shapeNotes = resolved.resolved.notes;
        shapeDisplayName = resolved.resolved.displayName;
        fretMin = resolved.resolved.fretMin;
        fretMax = resolved.resolved.fretMax;
      }
    }
    return {
      mode: practiceType,
      practiceType,
      advancedMode,
      fretboardSystem,
      shape,
      shapeNotes,
      shapeDisplayName,
      cagedShape: advancedMode ? (data.get('cagedShape') || 'C') : 'C',
      renderer: data.get('renderer') || localStorage.getItem('slopscale.renderer') || 'highway_3d',
      instrument: setup.instrument,
      stringSetup,
      setupLabel: setup.label,
      // Custom per-string tuning override (comma-separated MIDI numbers in
      // low → high order). When non-empty + length matches the stringSetup,
      // openMidisForConfig prefers it over the stringSetup's defaults.
      customOpenMidis,
      stringCount: setup.openMidis.length,
      key: data.get('key') || 'C',
      scale: data.get('scale') || 'major',
      bpm: Math.max(30, Math.min(260, parseFloat(data.get('bpm') || '100'))),
      // Count-in bars before playback starts. 0 = no count-in (immediate
      // play). 1/2/4 = that many bars of metronome clicks at the current
      // bpm + meter, then the chart kicks in. See startPlayback below for
      // how this is plumbed into the transport.
      countInBars: Math.max(0, Math.min(8, parseInt(data.get('countIn') || '0', 10) || 0)),
      // Click subdivision: soft clicks per metric beat for BOTH the count-in and
      // the in-chart metronome. 1 = on the beat only; 2/3/4 = duplet/triplet/
      // quadruplet feel. This is a transport (click-track) setting, independent
      // of the note `subdivision` (which controls generated note rhythm) — the
      // standard DAW model where the metronome has its own click rate.
      clickSubdiv: Math.max(1, Math.min(4, parseInt(data.get('clickSubdiv') || '1', 10) || 1)),
      meter: parseMeter(data.get('meter')),
      subdivision: data.get('subdivision') || 'eighth',
      direction: advancedMode ? (data.get('direction') || 'up_down') : 'up_down',
      repeatCount: advancedMode ? Math.max(1, Math.min(16, parseInt(data.get('repeatCount') || '1', 10))) : 1,
      sequence: advancedMode ? (data.get('sequence') || 'none') : 'none',
      harmonize: data.get('harmonize') === 'on',   // twin-guitar thirds/sixths (§2.4)
      tremolo: data.get('tremolo') === 'on',        // mark generated notes tremolo-picked (melodeath/death)
      chordScaleStrategy: advancedMode ? (data.get('chordScaleStrategy') || 'mode_of_moment') : 'mode_of_moment',
      fretMin,
      fretMax,
      bars: Math.max(1, Math.min(32, parseInt(data.get('bars') || '4', 10))),
      chordDepth: advancedMode ? (data.get('chordDepth') || 'triad') : 'triad',
      tritoneSub: advancedMode ? (data.get('tritoneSub') || 'off') : 'off',
      progression: practiceType === 'guide_tones'
        ? (data.get('guideToneProgression') || 'ii-V-I')
        : (advancedMode ? (data.get('progression') || 'diatonic') : 'diatonic'),
      chordOverride: advancedMode ? (data.get('chordOverride') || 'auto') : 'auto',
      // Backing comp style + feel. Pathway-driven (hidden fields); 'pad' + 'straight'
      // preserve the original held-pad / no-swing behaviour for everything that
      // doesn't opt in. 'boogie' walks a R-5-6-♭7 bass with off-beat shell stabs;
      // 'shuffle'/'swing' bend the eighth grid (see applySwingToBundle).
      backingStyle: data.get('backingStyle') || 'pad',
      swing: data.get('swing') || 'straight',
      chromaticPattern: data.get('chromaticPattern') || '1234',
      voices: data.get('voices') || 'thirds_only',
      keyCycle: data.get('keyCycle') || 'none',
      keyCycleLength: Math.max(2, Math.min(12, parseInt(data.get('keyCycleLength') || '4', 10))),
      bendTarget: data.get('bendTarget') || 'whole',
      audio: { notes: data.get('audioNotes') === 'on', metronome: data.get('audioMetronome') === 'on', harmony: data.get('audioHarmony') === 'on', profile: data.get('audioProfile') || '', brightness: Math.max(0, Math.min(1, parseFloat(data.get('brightness')))) }
    };
  }

  // ── Audio profiles — automated per-genre backing tone ─────────────────────
  // The player never picks a cab/voice/instrument: a genre/pathway declares one
  // string `audioProfile` and this resolves it to the backing voice + brightness.
  // Today the realizable harmony voices are the oscillator tones (pad/epiano/
  // organ); when the WebAudioFont (acoustic) + amp (distorted) tracks land, a
  // profile's voice/engine maps to those without touching genre data.
  // Each family declares three voices: harmony (the backing comp), notes (the
  // practice voice — what the player is meant to play), and bass (the backing
  // bass line, e.g. a boogie walk). notes/bass are sampled by default (real
  // instrument, oscillator fallback until the async preset loads). The notes
  // tone is overridden to a bass program when the instrument itself is a bass.
  // Phase B (WAF for all backing): the comp is a SAMPLED instrument by default, with
  // the synth pad (scheduleHarmonyPad) as the per-voice failover until the preset
  // loads. The distorted family keeps the synth pad for now — a distorted comp's
  // real voice is the NAM amp model (in progress); a sampled e-piano under metal
  // would be a regression, so pad stays its placeholder/failover until NAM lands.
  const AUDIO_FAMILY_DEFAULTS = {
    clean:      { harmony: { engine: 'sample', tone: 'epiano', level: 0.9 },  notes: { tone: 'clean'  }, bass: { tone: 'bass'    }, brightness: 0.5 },
    acoustic:   { harmony: { engine: 'sample', tone: 'piano',  level: 0.8 },  notes: { tone: 'guitar' }, bass: { tone: 'upright' }, brightness: 0.6 },
    distorted:  { harmony: { tone: 'pad',    level: 0.7 },  notes: { tone: 'clean'  }, bass: { tone: 'bass'    }, brightness: 0.42 },
    electronic: { harmony: { engine: 'sample', tone: 'epiano', level: 0.85 }, notes: { tone: 'clean'  }, bass: { tone: 'bass'    }, brightness: 0.7 },
  };
  const GLOBAL_AUDIO_DEFAULT = {
    family: 'clean',
    harmony: { engine: 'sample', tone: 'epiano', level: 0.9 },
    notes:   { engine: 'sample', tone: 'clean', level: 1.0 },
    bass:    { engine: 'sample', tone: 'bass',  level: 0.95 },
    brightness: 0.5,
  };
  const AUDIO_PROFILES = {
    blues:      { family: 'clean',      harmony: { engine: 'sample', tone: 'organ',  level: 0.85 }, brightness: 0.5 },
    jazz:       { family: 'clean',      harmony: { engine: 'sample', tone: 'epiano', level: 0.85 }, brightness: 0.55, drums: { kit: 'kit_jazz' } },
    rock:       { family: 'clean',      harmony: { engine: 'sample', tone: 'organ',  level: 0.8 },  brightness: 0.55 },
    metal:      { family: 'distorted',  harmony: { tone: 'pad', level: 0.7 },  brightness: 0.42 },
    djent:      { family: 'distorted',  harmony: { tone: 'pad', level: 0.65 }, brightness: 0.38 },
    gospel:     { family: 'clean',      harmony: { engine: 'sample', tone: 'organ',  level: 0.9 },  brightness: 0.55 },
    bluegrass:  { family: 'acoustic',   harmony: { engine: 'sample', tone: 'guitar', level: 0.78 }, brightness: 0.62, drums: { kit: 'kit_acoustic_soft' } },
    'city-pop': { family: 'electronic', harmony: { engine: 'sample', tone: 'epiano', level: 0.8 },  brightness: 0.68 },
  };

  // ── Drum kits (audio-realism Phase D) ────────────────────────────────────────
  // A kit is a SOUND set; the groove (DRUM_GROOVES) is separate. Phase D1–D3 ship
  // only the procedural synth kits (zero asset, zero licensing, authentic-by-
  // construction, and the never-silent failover). Sampled CC0 acoustic kits
  // (kit_rock/kit_jazz/kit_acoustic_soft/…) land in Phase D4. `resolveDrumKit`
  // falls any unregistered kit id back to kit_909 → in D1–D3 every style plays a
  // synth beat until the sampled kits exist (intentional; fix on the backend in D4).
  // Sampled kits (Phase D4) play self-hosted WebAudioFont drum one-shots — one tiny
  // preset file per GM percussion note, served from static/wafonts/ by the /wafont
  // route (zero route changes), same MIT WAF provenance as the melodic tones. The
  // piece→GM-note map is shared (FluidR3_GM kit); kits differ by level/groove, not
  // sample set (brush/percussion sample sets are a later curation pass). NOTE: the
  // FluidR3_GM drum DATA redistribution should be verified before any public release
  // (same caveat as the bundled JCLive melodic data).
  const ACOUSTIC_PIECES = { kick:36, snare:38, hatClosed:42, hatOpen:46, hatPedal:44, ride:51, crash:49, tomHi:50, tomMid:47, tomLo:43, clap:39 };
  const drumFile = (note, font, variant) => `128${note}_${variant}_${font}_sf2_file.js`;
  const drumVar  = (note, font, variant) => `_drum_${note}_${variant}_${font}_sf2_file`;
  const KIT_REGISTRY = {
    kit_909: { engine: 'synth', preset: '909' },   // tight/punchy default electronic
    kit_808: { engine: 'synth', preset: '808' },   // sub-heavy, long kick tail
    // Sampled acoustic kits (FluidR3_GM). Share the piece set; differ by level.
    kit_rock:          { engine: 'sample', font: 'FluidR3_GM', variant: 0, level: 1.0,  pieces: ACOUSTIC_PIECES },
    kit_acoustic_soft: { engine: 'sample', font: 'FluidR3_GM', variant: 0, level: 0.82, pieces: ACOUSTIC_PIECES },
    kit_jazz:          { engine: 'sample', font: 'FluidR3_GM', variant: 0, level: 0.8,  pieces: ACOUSTIC_PIECES },  // brush sample set = later curation
    // kit_latin / kit_afro (percussion-led) → Phase D6
  };
  const DRUM_KIT_FAMILY_DEFAULT = { electronic: 'kit_909', acoustic: 'kit_acoustic_soft', clean: 'kit_rock', distorted: 'kit_rock' };
  // Core groove staples preloaded at generate; cymbals/toms lazy-load on first hit.
  const DRUM_CORE_PIECES = ['kick', 'snare', 'hatClosed', 'hatOpen'];

  // ── STYLE_PALETTES — one shared style→harmony table (build-queue #2) ──────────
  // The single source a Pathway, a Custom config, and a Jam style all draw from:
  // a loopable progression set + lead scales + quality defaults + a guide-tone flag
  // + the backing feel + the audio profile, per style. It does NOT compose song form
  // — it hands a consumer the genre's *grammar* to loop and riff against (north star:
  // "teach the grammar, not the sentences"). Everything here is the style DNA already
  // encoded in shipped, agent-vetted pathway `base` configs + AUDIO_PROFILES + real
  // COMMON_PROGRESSIONS/SCALE_INTERVALS tokens — consolidated, not invented. New genre
  // entries (and broadening this beyond the seed set) want genre-idiom + harmony review
  // before Jam/pathways consume them (CLAUDE.md agent-workflow). Fields:
  //   progressions[]  loopable COMMON_PROGRESSIONS keys (index 0 = default)
  //   leadScales[]    SCALE_INTERVALS keys idiomatic for soloing (index 0 = default)
  //   chordDepth      'triad'|'seventh'|'ninth'… (power chords come via chordOverride)
  //   chordOverride   default chord-quality override ('auto'|'dom7'|'min7'|'5'|'5oct'…)
  //   guideTones      is guide-tone voice-leading a *defining* skill of the style
  //   feel            { swing, backingStyle } — the backing feel
  //   audioProfile    AUDIO_PROFILES key (the sound), or null → clean family inferred
  const STYLE_PALETTES = {
    blues:   { label:'Blues',      defaultKey:'A', progressions:['12_bar_blues','quick_change_blues'], leadScales:['blues','minor_pentatonic'], chordDepth:'seventh', chordOverride:'dom7', guideTones:false, feel:{ swing:'shuffle', backingStyle:'boogie' }, audioProfile:'blues' },
    rock:    { label:'Rock',       defaultKey:'E', progressions:['i-VII-VI-VII','I-V-vi-IV','I-IV-V'], leadScales:['minor_pentatonic','natural_minor'], chordDepth:'triad', chordOverride:'5', guideTones:false, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:'rock' },
    metal:   { label:'Metal',      defaultKey:'E', progressions:['metal_i_bVI_bVII','metal_pedal_chromatic','metal_i_bVII_bVI_V'], leadScales:['phrygian','natural_minor','harmonic_minor'], chordDepth:'triad', chordOverride:'5', guideTones:false, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:'metal' },
    djent:   { label:'Djent',      defaultKey:'E', progressions:['metal_pedal_chromatic'], leadScales:['phrygian','natural_minor'], chordDepth:'triad', chordOverride:'5oct', guideTones:false, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:'djent' },
    jazz:    { label:'Jazz',       defaultKey:'C', progressions:['ii-V-I','vi-ii-V-I','minor_ii_V_i','rhythm_changes_a'], leadScales:['major','dorian','mixolydian'], chordDepth:'seventh', chordOverride:'auto', guideTones:true, feel:{ swing:'swing', backingStyle:'pad' }, audioProfile:'jazz' },
    funk:    { label:'Funk / R&B', defaultKey:'A', progressions:['i-VII-VI-VII','static_i'], leadScales:['dorian','minor_pentatonic'], chordDepth:'seventh', chordOverride:'min7', guideTones:false, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:null },
    pop:     { label:'Pop',        defaultKey:'C', progressions:['I-V-vi-IV','vi-IV-I-V','I-vi-IV-V'], leadScales:['major','major_pentatonic'], chordDepth:'triad', chordOverride:'auto', guideTones:false, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:null },
    country: { label:'Country',    defaultKey:'G', progressions:['I-IV-V','I-V-vi-IV'], leadScales:['major_pentatonic','major'], chordDepth:'triad', chordOverride:'auto', guideTones:false, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:'bluegrass' },
    gospel:  { label:'Gospel',     defaultKey:'C', progressions:['ii-V-I','I-vi-ii-V'], leadScales:['major','dorian'], chordDepth:'ninth', chordOverride:'auto', guideTones:true, feel:{ swing:'straight', backingStyle:'pad' }, audioProfile:'gospel' },
  };
  // Resolve a style palette into a mergeable partial config the way a Pathway/Custom/
  // Jam consumer uses it: Object.assign({}, base, stylePaletteConfig('blues')). opts let
  // a consumer pick a non-default progression/scale (by index) or pin key/progression/scale.
  function stylePaletteConfig(styleId, opts) {
    const pal = STYLE_PALETTES[styleId];
    if (!pal) return null;
    opts = opts || {};
    const at = (arr, idx, override) => override != null ? override
      : arr[(((idx | 0) % arr.length) + arr.length) % arr.length];
    const out = {
      style: styleId,
      progression: at(pal.progressions, opts.progressionIdx || 0, opts.progression),
      scale:       at(pal.leadScales,   opts.scaleIdx || 0,       opts.scale),
      key:         opts.key || pal.defaultKey,
      chordDepth:  pal.chordDepth,
      chordOverride: pal.chordOverride,
      swing:       pal.feel.swing,
      backingStyle: pal.feel.backingStyle,
      guideTones:  pal.guideTones,        // advisory metadata for the consumer
    };
    if (pal.audioProfile) out.audioProfile = pal.audioProfile;
    return out;
  }
  // Startup integrity guard (mirrors the no-unison guard): every palette must point at
  // real engine tokens, so the shared style table can't silently rot as the engine
  // evolves. Throws on load if a palette references a missing progression/scale/profile.
  (function validateStylePalettes() {
    for (const id of Object.keys(STYLE_PALETTES)) {
      const p = STYLE_PALETTES[id];
      for (const pr of p.progressions) if (!COMMON_PROGRESSIONS[pr]) throw new Error(`[SlopScale style-palette] ${id} references unknown progression "${pr}"`);
      for (const sc of p.leadScales)   if (!SCALE_INTERVALS[sc])     throw new Error(`[SlopScale style-palette] ${id} references unknown scale "${sc}"`);
      if (p.audioProfile && !AUDIO_PROFILES[p.audioProfile])         throw new Error(`[SlopScale style-palette] ${id} references unknown audioProfile "${p.audioProfile}"`);
    }
  })();

  // ===========================================================================
  // SEGMENT TEMPLATES + VARIATION ENGINE (Workout library substrate)
  // ---------------------------------------------------------------------------
  // A Workout segment is authored as a TEMPLATE, not a frozen preset. A template
  // carries a pedagogical ROLE, a competency, a difficulty BAND, a fixed `base`
  // config, and a bounded `vary[]` list of variant deltas (the same shape as a
  // PATHWAYS[].vary entry). Three reads of the one object:
  //   • BROWSE  → render role/label/band.
  //   • PICK    → rollSegment(t, { variantIdx: 0 }).
  //   • REFRESH → rollSegment(t, { variantIdx: n+1 }) — re-roll the variant.
  // rollSegment() materialises a template into a normal session segment
  // ({ id, name, kind, config }); it then flows through the EXISTING
  // buildSegmentConfig → buildSingleChart path, so the no-unison rule and the
  // voicing engine hold automatically — the engine adds NO new generators.
  //
  // REFRESH INVARIANTS (the anti-slot-machine spine + musical safety):
  //   1. Same BAND      — every variant of a template shares its difficulty band;
  //                       no easier variant exists to "spin for".
  //   2. Length-locked  — a vary delta may NOT carry bpm or targetSec (the Climb
  //                       axis owns difficulty/length); refresh varies CONTENT.
  //   3. Style-locked   — when a template names a `style`, progression + scale are
  //                       drawn from STYLE_PALETTES, so a blues slot can't re-roll
  //                       into I-IV-V pop. A vary delta may only name in-palette
  //                       progression/scale values.
  //   4. No-row gate    — an exotic/symmetric scale (no DIATONIC_QUALITIES row) may
  //                       only appear over a single-chord backing OR a forced
  //                       chordOverride (else its non-tonic chords fall to a bare
  //                       major triad).
  // validateSegmentTemplates() (mirroring the no-unison + style-palette guards)
  // enforces 1–4 over every variant of every template at load; smoke-variation.mjs
  // does the full roll+build behavioural check. See project memory
  // project_segment_library_and_refresh + the four agent-memory charette specs.
  const SEGMENT_ROLES = {
    warmup:      { label:'Warm-up',     order:0 },
    technique:   { label:'Technique',   order:1 },
    scale_arp:   { label:'Scale / Arp', order:2 },
    application: { label:'Application', order:3 },
    jam:         { label:'Jam',         order:4 },
    review:      { label:'Review',      order:5 },
    cooldown:    { label:'Cool-down',   order:6 },
  };
  const SEGMENT_BANDS = ['beginner','intermediate','advanced'];
  // Backings over which a no-DIATONIC_QUALITIES-row scale is harmonically safe
  // (only the tonic quality matters): a single sustained chord area.
  const SINGLE_CHORD_BACKINGS = new Set(['static_i','none']);
  // No-row scales that are nonetheless SAFE over a multi-chord backing: common lead
  // scales (pentatonics / blues / bebop) whose chord derivation maps cleanly through
  // a FUNCTIONAL PARENT (major / minor / dominant) via the functional-root fix — they
  // aren't the exotic/symmetric case the no-row gate targets. Exempt them so a
  // pentatonic/blues lead over a progression isn't false-flagged.
  const GATE_EXEMPT_SCALES = new Set(['minor_pentatonic','major_pentatonic','blues','bebop_major','bebop_dominant']);
  function scaleHasQualityRow(scale){ return !!(scale && DIATONIC_QUALITIES && DIATONIC_QUALITIES[scale]); }
  function isSingleChordBacking(kind, progression){
    return kind === 'modal_vamp' || !progression || progression === 'none' || SINGLE_CHORD_BACKINGS.has(progression);
  }

  // Seed templates — proof of the engine, each derived from an already-vetted
  // PATHWAYS base so the seed set is idiomatic out of the gate. Phases 5–6 expand
  // this to the full ~40 guitar + ~25 bass library (every NEW entry validated by
  // its genre-idiom + instrument-pedagogy agent per the agent-workflow rule).
  // Convention: `base` carries STRUCTURAL + kind config; genre fields (progression,
  // scale, chordDepth/Override, feel) come from the `style` palette; `vary[]`
  // carries only the free axes (key/shape/position/sequence) — never bpm/targetSec.
  const SEGMENT_TEMPLATES = {
    g_warm_chromatic: {
      role:'warmup', label:'Chromatic 1-2-3-4', competency:'finger independence',
      band:'beginner', instrument:'guitar', style:null, kind:'chromatic',
      base:{ chromaticPattern:'1234', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', fretboardSystem:'position' },
      vary:[ { chromaticPattern:'1234', fretMin:1, fretMax:4 }, { chromaticPattern:'4321', fretMin:1, fretMax:4 }, { chromaticPattern:'1324', fretMin:1, fretMax:4 }, { chromaticPattern:'1234', fretMin:5, fretMax:8 } ],
    },
    g_tech_pentatonic_box: {
      role:'technique', label:'Minor pentatonic box', competency:'pentatonic box 1',
      band:'beginner', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ],
    },
    g_blues_scale: {
      role:'scale_arp', label:'Blues scale', competency:'blues vocabulary',
      band:'beginner', instrument:'guitar', style:'blues', kind:'scale',
      base:{ scale:'blues', meter:'4/4', subdivision:'eighth', bars:12, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ],
    },
    g_arp_diatonic_7th: {
      role:'scale_arp', label:'Diatonic 7th arpeggios', competency:'seventh-chord vocabulary',
      band:'intermediate', instrument:'guitar', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'natural_minor', chordDepth:'seventh', chordOverride:'auto', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'G' }, { key:'C', shape:'A' } ],
    },
    g_app_ii_v_i: {
      role:'application', label:'ii–V–I over the changes', competency:'play the changes',
      band:'intermediate', instrument:'guitar', style:'jazz', kind:'chord_scales',
      base:{ scale:'major', chordScaleStrategy:'mode_of_moment', chordDepth:'seventh', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'F' }, { key:'Bb' }, { key:'G' }, { key:'D' } ],
    },
    g_metal_phrygian: {
      role:'technique', label:'Phrygian-dominant run', competency:'exotic-scale shred',
      band:'advanced', instrument:'guitar', style:'metal', kind:'scale',
      base:{ scale:'phrygian_dominant', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', sequence:'fours', fretboardSystem:'caged' },
      vary:[ { key:'E', shape:'E' }, { key:'A', shape:'E' }, { key:'D', shape:'E' }, { key:'B', shape:'E' } ],
    },

    // ── Phase 5 guitar library — derived from already-vetted PATHWAYS bases (so the
    // content is genre-validated) + role-tagged. vary[] holds duration CONSTANT
    // (no meter/bpm/bars changes) per the length-locked invariant. ───────────────
    // Technique role
    g_tech_pulse_mute: {
      role:'technique', label:'Pulse & muting', competency:'click-lock + palm mute',
      band:'beginner', instrument:'guitar', style:null, kind:'pedal_riff',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', progression:'static_i', chordOverride:'5', harmonize:false, swing:'straight', fretMin:0, fretMax:5 },
      vary:[ { key:'E' }, { key:'A' }, { key:'G' }, { key:'D' } ],
    },
    g_tech_power_chords: {
      role:'technique', label:'Power-chord comping', competency:'clean power-chord changes',
      band:'beginner', instrument:'guitar', style:null, kind:'pedal_riff',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', chordOverride:'5', harmonize:false, swing:'straight', fretMin:0, fretMax:7 },
      vary:[ { key:'E', progression:'i-VII-VI-VII' }, { key:'A', progression:'i-VI-III-VII' }, { key:'E', progression:'i-VII-VI-VII' }, { key:'D', progression:'i-VI-III-VII' } ],
    },
    g_tech_bending: {
      role:'technique', label:'Bending drill', competency:'bend intonation',
      band:'beginner', instrument:'guitar', style:null, kind:'bending',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'quarter', bars:8, direction:'up_down', fretboardSystem:'caged', bendTarget:'whole' },
      vary:[ { key:'A', shape:'E', bendTarget:'whole' }, { key:'A', shape:'E', bendTarget:'half' }, { key:'E', shape:'E', bendTarget:'whole' }, { key:'D', shape:'E', bendTarget:'mixed' } ],
    },
    g_tech_sweep: {
      role:'technique', label:'Sweep arpeggio primer', competency:'clean sweep picking',
      band:'advanced', instrument:'guitar', style:null, kind:'sweep_arpeggios',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'triad', chordOverride:'auto', progression:'i-VI-III-VII' },
      vary:[ { key:'A', shape:'E' }, { key:'A', shape:'A' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'G' } ],
    },
    g_tech_legato: {
      role:'technique', label:'Legato runs', competency:'hammer/pull fluency',
      band:'intermediate', instrument:'guitar', style:null, kind:'legato',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' } ],
    },
    g_tech_16th_pocket: {
      role:'technique', label:'Sixteenth-note pocket', competency:'16th subdivision + feel',
      band:'intermediate', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', progression:'i-VII-VI-VII', chordDepth:'seventh', chordOverride:'min7', swing:'straight' },
      vary:[ { key:'A', shape:'E', swing:'straight' }, { key:'A', shape:'E', swing:'swing' }, { key:'E', shape:'E' }, { key:'G', shape:'E' } ],
    },
    // Scale / Arp role
    g_scale_major_caged: {
      role:'scale_arp', label:'Major scale — CAGED', competency:'connect the 5 shapes',
      band:'beginner', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', progression:'I-IV-V', chordDepth:'triad', chordOverride:'auto' },
      vary:[ { key:'C', shape:'E' }, { key:'C', shape:'A' }, { key:'C', shape:'G' }, { key:'C', shape:'C' }, { key:'C', shape:'D' } ],
    },
    g_scale_dorian: {
      role:'scale_arp', label:'Dorian groove', competency:'the raised-6th colour',
      band:'intermediate', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'dorian', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', progression:'i-VII-VI-VII', chordDepth:'seventh', chordOverride:'min7' },
      vary:[ { key:'A', shape:'E' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ],
    },
    g_scale_country_pent: {
      role:'scale_arp', label:'Major pentatonic — country', competency:'major-pentatonic over changes',
      band:'beginner', instrument:'guitar', style:'country', kind:'scale',
      base:{ scale:'major_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'G', shape:'G' }, { key:'A', shape:'E' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'C', shape:'E' } ],
    },
    g_arp_triads: {
      role:'scale_arp', label:'Diatonic triads', competency:'triad arpeggio vocabulary',
      band:'beginner', instrument:'guitar', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'triad', chordOverride:'auto' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'G' }, { key:'C', shape:'A' } ],
    },
    g_scale_full_neck: {
      role:'scale_arp', label:'Whole-neck freedom', competency:'connect the whole neck',
      band:'intermediate', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'full_neck', progression:'I-V-vi-IV', chordDepth:'triad', chordOverride:'auto' },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' }, { key:'D' } ],
    },
    g_scale_melmin: {
      role:'scale_arp', label:'Melodic minor & exotic', competency:'melodic-minor + symmetric colours',
      band:'advanced', instrument:'guitar', style:null, kind:'modal_vamp',
      base:{ scale:'melodic_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', progression:'static_i', chordDepth:'seventh', chordOverride:'auto' },
      vary:[ { scale:'melodic_minor', key:'A', shape:'E' }, { scale:'lydian_dominant', key:'C', shape:'E' }, { scale:'altered', key:'E', shape:'E' }, { scale:'locrian_sharp2', key:'B', shape:'E' }, { scale:'lydian_augmented', key:'G', shape:'E' } ],
    },
    // Application role (over the changes)
    g_app_chord_tone: {
      role:'application', label:'Chord-tone targeting', competency:'chord tones inside the scale',
      band:'intermediate', instrument:'guitar', style:null, kind:'chord_scales',
      base:{ scale:'major', chordScaleStrategy:'chord_tone_emphasis', chordDepth:'seventh', chordOverride:'auto', meter:'4/4', subdivision:'eighth', bars:8, direction:'ascending', sequence:'fours', fretboardSystem:'caged', fretMin:0, fretMax:7 },
      vary:[ { key:'C', progression:'diatonic' }, { key:'C', progression:'I-IV-V' }, { key:'G', progression:'I-V-vi-IV' }, { key:'D', progression:'I-vi-IV-V' }, { key:'A', progression:'vi-IV-I-V' } ],
    },
    g_app_modal: {
      role:'application', label:'Modal awareness', competency:'a mode per chord',
      band:'intermediate', instrument:'guitar', style:null, kind:'chord_scales',
      base:{ scale:'major', chordScaleStrategy:'mode_of_moment', chordDepth:'seventh', chordOverride:'dom7', progression:'diatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'G' }, { key:'D' }, { key:'A' }, { key:'F' } ],
    },
    g_app_guide_tones: {
      role:'application', label:'Guide tones', competency:'voice-lead 3rds & 7ths',
      band:'intermediate', instrument:'guitar', style:'jazz', kind:'guide_tones',
      base:{ scale:'major', chordDepth:'seventh', voices:'both_alternating', meter:'4/4', subdivision:'quarter', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged', shape:'E' },
      vary:[ { key:'C', voices:'thirds_only' }, { key:'C', voices:'sevenths_only' }, { key:'C', voices:'both_alternating' }, { key:'F', voices:'both_alternating' }, { key:'Bb', voices:'both_alternating' } ],
    },
    g_app_blues_shuffle: {
      role:'application', label:'Blues shuffle', competency:'phrasing over a 12-bar',
      band:'intermediate', instrument:'guitar', style:'blues', kind:'scale',
      base:{ scale:'blues', meter:'4/4', subdivision:'eighth', bars:12, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' }, { key:'D', shape:'E' } ],
    },
    g_app_harmonic_minor: {
      role:'application', label:'Harmonic-minor exotic', competency:'the raised-7th over changes',
      band:'advanced', instrument:'guitar', style:null, kind:'chord_scales',
      base:{ scale:'harmonic_minor', chordScaleStrategy:'mode_of_moment', chordDepth:'seventh', chordOverride:'dom7', progression:'i-VI-III-VII', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', sequence:'fours', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'B', shape:'E' } ],
    },
    // Metal pack (technique-heavy)
    g_metal_metalcore: {
      role:'technique', label:'Metalcore pedal chug', competency:'palm-mute pedal + semitone power chords',
      band:'intermediate', instrument:'guitar', style:'metal', kind:'pedal_riff',
      base:{ scale:'phrygian', harmonize:false, meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', progression:'metal_pedal_chromatic', chordOverride:'5', fretMin:0, fretMax:7 },
      vary:[ { progression:'metal_pedal_chromatic' }, { progression:'metal_i_bVI_bVII' }, { progression:'metal_pedal_chromatic', scale:'natural_minor' }, { progression:'metal_i_bVI_bVII', subdivision:'gallop' } ],
    },
    g_metal_gallop: {
      role:'technique', label:'Melodic metal gallop', competency:'the galloping picking hand',
      band:'advanced', instrument:'guitar', style:'metal', kind:'pedal_riff',
      base:{ scale:'harmonic_minor', harmonize:false, meter:'4/4', subdivision:'gallop', bars:8, direction:'up_down', fretboardSystem:'position', progression:'metal_i_bVI_bVII', chordOverride:'5', fretMin:0, fretMax:9 },
      vary:[ { subdivision:'gallop' }, { subdivision:'reverse_gallop' }, { scale:'natural_minor', subdivision:'gallop' }, { progression:'metal_i_bVII_bVI_V', subdivision:'gallop' } ],
    },
    g_metal_twin_leads: {
      role:'scale_arp', label:'Melodic-death twin leads', competency:'harmonized thirds',
      band:'advanced', instrument:'guitar', style:'metal', kind:'scale_thirds',
      base:{ scale:'natural_minor', harmonize:true, tremolo:true, meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', shape:'E' },
      vary:[ { key:'E', scale:'natural_minor' }, { key:'D', scale:'natural_minor' }, { key:'D', scale:'harmonic_minor' }, { key:'A', scale:'natural_minor' } ],
    },
    g_metal_djent: {
      role:'technique', label:'Djent polymeter chug', competency:'3+3+2 against the count',
      band:'advanced', instrument:'guitar', style:'djent', kind:'pedal_riff',
      base:{ scale:'phrygian', harmonize:false, meter:'8/8:3+3+2', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', progression:'metal_pedal_chromatic', chordOverride:'5oct', fretMin:0, fretMax:7 },
      vary:[ { scale:'phrygian' }, { scale:'natural_minor' }, { progression:'metal_pedal_chromatic' }, { scale:'phrygian', progression:'metal_pedal_chromatic' } ],
    },
    g_metal_death: {
      role:'technique', label:'Death-metal chromatic riffs', competency:'tritone/atonal riffing',
      band:'advanced', instrument:'guitar', style:null, kind:'pedal_riff',
      base:{ scale:'locrian', harmonize:false, tremolo:true, meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', progression:'metal_death_tritone', chordOverride:'5', fretMin:0, fretMax:9 },
      vary:[ { scale:'locrian', progression:'metal_death_tritone' }, { scale:'diminished', progression:'metal_death_tritone' }, { scale:'phrygian', progression:'metal_pedal_chromatic', subdivision:'gallop' }, { scale:'double_harmonic', progression:'metal_death_tritone' } ],
    },
    // Jam role (play along over a backing — the application summit)
    g_jam_modal: {
      role:'jam', label:'Modal vamp jam', competency:'phrase over one tonality',
      band:'intermediate', instrument:'guitar', style:null, kind:'modal_vamp',
      base:{ scale:'dorian', meter:'4/4', subdivision:'eighth', bars:16, direction:'up_down', sequence:'none', fretboardSystem:'caged', progression:'static_i', shape:'E' },
      vary:[ { scale:'dorian', key:'A' }, { scale:'mixolydian', key:'G' }, { scale:'lydian', key:'C' }, { scale:'phrygian', key:'E' }, { scale:'altered', key:'A' } ],
    },
    g_jam_blues: {
      role:'jam', label:'Blues jam', competency:'improvise over a 12-bar',
      band:'beginner', instrument:'guitar', style:'blues', kind:'scale',
      base:{ scale:'blues', meter:'4/4', subdivision:'eighth', bars:12, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'E' }, { key:'D', shape:'E' }, { key:'C', shape:'E' } ],
    },
    g_jam_rock: {
      role:'jam', label:'Rock jam', competency:'pentatonic over a rock vamp',
      band:'beginner', instrument:'guitar', style:'rock', kind:'scale',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'E', shape:'E' }, { key:'A', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' } ],
    },
    // Cool-down role (gentle, low tempo)
    g_cool_scale: {
      role:'cooldown', label:'Cool-down scale', competency:'relaxed clean tone',
      band:'beginner', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'C', shape:'C' }, { key:'G', shape:'E' }, { key:'A', shape:'E' }, { key:'D', shape:'E' } ],
    },
    g_cool_arpeggio: {
      role:'cooldown', label:'Cool-down arpeggios', competency:'relaxed triad arps',
      band:'beginner', instrument:'guitar', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'triad', chordOverride:'auto' },
      vary:[ { key:'C', shape:'C' }, { key:'G', shape:'G' }, { key:'A', shape:'A' }, { key:'D', shape:'E' } ],
    },
    // Comping (strum_comp) — v1 voices triads + power chords; the STRUM_GRIPS dom9/sus
    // upgrade for funk/pop is the remaining carried-over Phase-3 piece.
    g_comp_folk: {
      role:'technique', label:'Folk strumming', competency:'open-chord changes + strum hand',
      band:'beginner', instrument:'guitar', style:null, kind:'strum_comp',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'triad', chordOverride:'auto', strumPattern:'folk_pop_ddu_udu', voicingPosition:'open' },
      vary:[ { key:'G', progression:'I-V-vi-IV' }, { key:'C', progression:'I-vi-IV-V' }, { key:'D', progression:'I-IV-V' }, { key:'A', progression:'vi-IV-I-V' } ],
    },
    g_comp_pop: {
      role:'technique', label:'Pop comping', competency:'pop changes + groove',
      band:'beginner', instrument:'guitar', style:'pop', kind:'strum_comp',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'triad', strumPattern:'folk_pop_ddu_udu', voicingPosition:'open' },
      vary:[ { key:'C', progression:'I-V-vi-IV' }, { key:'G', progression:'vi-IV-I-V' }, { key:'D', progression:'I-vi-IV-V' }, { key:'A', progression:'I-V-vi-IV' } ],
    },
    g_comp_funk: {
      role:'technique', label:'Funk scratch comping', competency:'16th-note rhythm-hand pocket',
      band:'intermediate', instrument:'guitar', style:'funk', kind:'strum_comp',
      base:{ scale:'dorian', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'seventh', strumPattern:'sixteenth_funk_scratch', voicingPosition:'movable', shape:'E' },
      vary:[ { key:'A', progression:'i-VII-VI-VII' }, { key:'E', progression:'static_i' }, { key:'D', progression:'i-VII-VI-VII' }, { key:'G', progression:'static_i' } ],
    },
    g_comp_rock: {
      role:'technique', label:'Rock power-chord strum', competency:'driving 8th power chords',
      band:'beginner', instrument:'guitar', style:'rock', kind:'strum_comp',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', chordOverride:'5', strumPattern:'eighth_down', voicingPosition:'movable', shape:'E' },
      vary:[ { key:'E', progression:'i-VII-VI-VII' }, { key:'A', progression:'I-IV-V' }, { key:'D', progression:'I-V-vi-IV' }, { key:'G', progression:'i-VII-VI-VII' } ],
    },
    // Review role (resurface an earlier skill)
    g_review_pentatonic: {
      role:'review', label:'Pentatonic review', competency:'recall the box',
      band:'beginner', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'E' }, { key:'D', shape:'E' } ],
    },
    g_review_triads: {
      role:'review', label:'Triad review', competency:'recall diatonic triads',
      band:'beginner', instrument:'guitar', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'caged', chordDepth:'triad', chordOverride:'auto' },
      vary:[ { key:'C', shape:'C' }, { key:'G', shape:'G' }, { key:'A', shape:'A' }, { key:'E', shape:'E' } ],
    },
    // Warm-up variety
    g_warm_scale: {
      role:'warmup', label:'Scale warm-up', competency:'gentle position warm-up',
      band:'beginner', instrument:'guitar', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'caged' },
      vary:[ { key:'C', shape:'E' }, { key:'G', shape:'E' }, { key:'A', shape:'E' }, { key:'E', shape:'E' } ],
    },

    // ═══ Phase 6 — BASS segment-template library ═══════════════════════════════
    // Bass is GROOVE + RIGHT-HAND first (the arc inverts the guitar shred instinct:
    // right_hand → root_fifth_octave → octave_groove → dead_note → scales/arps →
    // walking/guide_tones → slap). Movable `position` box (NO CAGED/shape). The 5
    // groove primitives are bass-native (offerable()). vary[] holds duration constant
    // (key / fretMin-Max / progression-in-band — never meter/bpm/bars). FEEL of the
    // groove templates (octave/dead-note/slap) → funk/R&B + Motown/soul idiom agents
    // validate at this stage per the bass-pedagogy consult.
    // Warm-up
    b_warm_chromatic: {
      role:'warmup', label:'Chromatic warm-up', competency:'finger independence',
      band:'beginner', instrument:'bass', style:null, kind:'chromatic',
      base:{ chromaticPattern:'1234', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:1, fretMax:4 },
      vary:[ { chromaticPattern:'1234', fretMin:1, fretMax:4 }, { chromaticPattern:'4321', fretMin:1, fretMax:4 }, { chromaticPattern:'1234', fretMin:5, fretMax:8 }, { chromaticPattern:'1324', fretMin:1, fretMax:4 } ],
    },
    b_warm_scale: {
      role:'warmup', label:'Scale warm-up', competency:'gentle position box',
      band:'beginner', instrument:'bass', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'position', fretMin:0, fretMax:5 },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' } ],
    },
    // Technique (groove + right-hand first)
    b_tech_right_hand: {
      role:'technique', label:'Right-hand technique', competency:'alternating i-m stamina',
      band:'beginner', instrument:'bass', style:null, kind:'right_hand_technique',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', progression:'static_i', fretMin:0, fretMax:5 },
      vary:[ { key:'E' }, { key:'A' }, { key:'G', subdivision:'sixteenth' }, { key:'C' } ],
    },
    b_tech_root_fifth_octave: {
      role:'technique', label:'Root–5th–octave box', competency:'the foundational bass box',
      band:'beginner', instrument:'bass', style:null, kind:'root_fifth_octave',
      base:{ scale:'major', meter:'4/4', subdivision:'quarter', bars:8, direction:'up_down', fretboardSystem:'position', progression:'I-IV-V', fretMin:0, fretMax:7 },
      vary:[ { key:'C', progression:'I-IV-V' }, { key:'G', progression:'I-V-vi-IV' }, { key:'A', progression:'i-VII-VI-VII' }, { key:'E', progression:'I-IV-V' } ],
    },
    b_tech_octave_groove: {
      role:'technique', label:'Octave groove', competency:'disco/Motown octave bounce',
      band:'intermediate', instrument:'bass', style:null, kind:'octave_groove',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', progression:'I-V-vi-IV', fretMin:0, fretMax:7 },
      vary:[ { key:'C', progression:'I-V-vi-IV' }, { key:'A', progression:'i-VII-VI-VII' }, { key:'G', progression:'I-IV-V' }, { key:'D', progression:'vi-IV-I-V' } ],
    },
    b_tech_dead_note: {
      role:'technique', label:'Dead-note pocket', competency:'16th pocket + muting',
      band:'intermediate', instrument:'bass', style:'funk', kind:'dead_note_groove',
      base:{ scale:'dorian', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:7 },
      vary:[ { key:'A', progression:'i-VII-VI-VII' }, { key:'E', progression:'static_i' }, { key:'D', progression:'i-VII-VI-VII' }, { key:'G', progression:'static_i' } ],
    },
    b_tech_slap: {
      role:'technique', label:'Slap & pop', competency:'slapped octave + ghosts',
      band:'advanced', instrument:'bass', style:'funk', kind:'slap_pop',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:7 },
      vary:[ { key:'E', progression:'static_i' }, { key:'A', progression:'i-VII-VI-VII' }, { key:'G', progression:'static_i' }, { key:'D', progression:'i-VII-VI-VII' } ],
    },
    b_tech_legato: {
      role:'technique', label:'Legato (HO/PO)', competency:'hammer/pull on bass',
      band:'intermediate', instrument:'bass', style:null, kind:'legato',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:5 },
      vary:[ { key:'A' }, { key:'E' }, { key:'G' }, { key:'D' } ],
    },
    b_tech_position_shift: {
      role:'technique', label:'Position shifts', competency:'move cleanly up the neck',
      band:'intermediate', instrument:'bass', style:null, kind:'position_shift',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:7 },
      vary:[ { key:'A' }, { key:'E' }, { key:'G' }, { key:'C' } ],
    },
    // Scale / Arp (the position box)
    b_scale_major: {
      role:'scale_arp', label:'Major scale box', competency:'the movable major box',
      band:'beginner', instrument:'bass', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'position', fretMin:0, fretMax:5 },
      vary:[ { key:'C', fretMin:0, fretMax:5 }, { key:'G', fretMin:2, fretMax:7 }, { key:'A', fretMin:4, fretMax:9 }, { key:'E', fretMin:0, fretMax:5 } ],
    },
    b_scale_minor: {
      role:'scale_arp', label:'Minor scale box', competency:'natural-minor box',
      band:'beginner', instrument:'bass', style:null, kind:'scale',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'position', fretMin:0, fretMax:5 },
      vary:[ { key:'A' }, { key:'E' }, { key:'D' }, { key:'G', fretMin:2, fretMax:7 } ],
    },
    b_scale_pentatonic: {
      role:'scale_arp', label:'Pentatonic box', competency:'minor-pentatonic box',
      band:'beginner', instrument:'bass', style:null, kind:'scale',
      base:{ scale:'minor_pentatonic', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'position', fretMin:0, fretMax:5 },
      vary:[ { key:'A' }, { key:'E' }, { key:'G' }, { key:'D' } ],
    },
    b_arp_triads: {
      role:'scale_arp', label:'Triad arpeggios', competency:'chord-tone targeting',
      band:'beginner', instrument:'bass', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', chordDepth:'triad', chordOverride:'auto', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' } ],
    },
    b_arp_sevenths: {
      role:'scale_arp', label:'Seventh arpeggios', competency:'7th chord tones',
      band:'intermediate', instrument:'bass', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'natural_minor', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', chordDepth:'seventh', chordOverride:'auto', fretMin:0, fretMax:7 },
      vary:[ { key:'A' }, { key:'E' }, { key:'D' }, { key:'C' } ],
    },
    // Application (over the changes)
    b_app_walking: {
      role:'application', label:'Walking bass — ii–V–I', competency:'walk the changes',
      band:'intermediate', instrument:'bass', style:'jazz', kind:'walking_bass',
      base:{ scale:'major', meter:'4/4', subdivision:'quarter', bars:8, direction:'up_down', fretboardSystem:'position', chordDepth:'seventh', chordOverride:'auto', fretMin:0, fretMax:7 },
      vary:[ { key:'C', progression:'ii-V-I' }, { key:'F', progression:'ii-V-I' }, { key:'C', progression:'vi-ii-V-I' }, { key:'G', progression:'ii-V-I' } ],
    },
    b_app_walking_blues: {
      role:'application', label:'Walking blues', competency:'walk a 12-bar',
      band:'intermediate', instrument:'bass', style:'blues', kind:'walking_bass',
      base:{ scale:'blues', meter:'4/4', subdivision:'quarter', bars:12, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:7 },
      vary:[ { key:'A' }, { key:'E' }, { key:'G' }, { key:'C' } ],
    },
    b_app_guide_tones: {
      role:'application', label:'Guide tones', competency:'3rds & 7ths on bass',
      band:'intermediate', instrument:'bass', style:'jazz', kind:'guide_tones',
      base:{ scale:'major', chordDepth:'seventh', voices:'both_alternating', meter:'4/4', subdivision:'quarter', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:9 },
      vary:[ { key:'C', voices:'both_alternating' }, { key:'F', voices:'thirds_only' }, { key:'G', voices:'sevenths_only' }, { key:'Bb', voices:'both_alternating' } ],
    },
    b_app_root_motion: {
      role:'application', label:'Root motion through changes', competency:'arpeggiate the progression',
      band:'intermediate', instrument:'bass', style:null, kind:'progression_arpeggios',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', chordDepth:'seventh', chordOverride:'auto', progression:'ii-V-I', fretMin:0, fretMax:9 },
      vary:[ { key:'C', progression:'ii-V-I' }, { key:'G', progression:'I-V-vi-IV' }, { key:'A', progression:'i-VII-VI-VII' }, { key:'F', progression:'ii-V-I' } ],
    },
    b_app_octave_disco: {
      role:'application', label:'Disco octave line', competency:'octave bounce over changes',
      band:'intermediate', instrument:'bass', style:'pop', kind:'octave_groove',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:9 },
      vary:[ { key:'C', progression:'I-V-vi-IV' }, { key:'G', progression:'vi-IV-I-V' }, { key:'D', progression:'I-vi-IV-V' }, { key:'A', progression:'I-V-vi-IV' } ],
    },
    // Jam (the player IS the bass)
    b_jam_funk: {
      role:'jam', label:'Funk groove jam', competency:'hold a funk pocket',
      band:'intermediate', instrument:'bass', style:'funk', kind:'dead_note_groove',
      base:{ scale:'dorian', meter:'4/4', subdivision:'sixteenth', bars:8, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:7 },
      vary:[ { key:'A', progression:'static_i' }, { key:'E', progression:'i-VII-VI-VII' }, { key:'D', progression:'static_i' }, { key:'G', progression:'i-VII-VI-VII' } ],
    },
    b_jam_blues: {
      role:'jam', label:'Blues bass jam', competency:'groove a 12-bar',
      band:'beginner', instrument:'bass', style:'blues', kind:'walking_bass',
      base:{ scale:'blues', meter:'4/4', subdivision:'quarter', bars:12, direction:'up_down', fretboardSystem:'position', fretMin:0, fretMax:7 },
      vary:[ { key:'A' }, { key:'E' }, { key:'G' }, { key:'C' } ],
    },
    // Review + cool-down
    b_review_box: {
      role:'review', label:'Root–5th–octave review', competency:'recall the box',
      band:'beginner', instrument:'bass', style:null, kind:'root_fifth_octave',
      base:{ scale:'major', meter:'4/4', subdivision:'quarter', bars:8, direction:'up_down', fretboardSystem:'position', progression:'I-IV-V', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' } ],
    },
    b_cool_scale: {
      role:'cooldown', label:'Cool-down scale', competency:'relaxed box',
      band:'beginner', instrument:'bass', style:null, kind:'scale',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', sequence:'none', fretboardSystem:'position', fretMin:0, fretMax:5 },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' } ],
    },
    b_cool_arpeggio: {
      role:'cooldown', label:'Cool-down arpeggios', competency:'relaxed triad arps',
      band:'beginner', instrument:'bass', style:null, kind:'diatonic_arpeggios',
      base:{ scale:'major', meter:'4/4', subdivision:'eighth', bars:8, direction:'up_down', fretboardSystem:'position', chordDepth:'triad', chordOverride:'auto', fretMin:0, fretMax:7 },
      vary:[ { key:'C' }, { key:'G' }, { key:'A' }, { key:'E' } ],
    },
  };

  // Materialise a template into a concrete session segment at a given variant.
  // Priority: style-palette lock (floor) ← template base ← variant delta (ceiling).
  // opts = { variantIdx, locks{axis:true} }. Per-axis lock freezes that axis at the
  // anchor (variant 0) value so a player can pin e.g. the key and re-roll the shape.
  function rollSegment(template, opts) {
    if (!template) return null;
    opts = opts || {};
    const vary = (template.vary && template.vary.length) ? template.vary : [{}];
    const n = vary.length;
    const idx = (((opts.variantIdx | 0) % n) + n) % n;
    const anchor = vary[0] || {};
    const delta = Object.assign({}, vary[idx]);
    const locks = opts.locks || null;
    if (locks) for (const ax of Object.keys(locks)) {
      if (locks[ax] && (ax in anchor)) delta[ax] = anchor[ax];
    }
    let styleCfg = {};
    if (template.style) {
      const sp = stylePaletteConfig(template.style, {
        progression: delta.progression || (template.base && template.base.progression),
        scale:       delta.scale       || (template.base && template.base.scale),
        key:         delta.key         || (template.base && template.base.key),
      });
      if (sp) styleCfg = sp;
    }
    const config = Object.assign({}, styleCfg, template.base || {}, delta);
    if (template.targetSec != null && config.targetSec == null) config.targetSec = template.targetSec;
    return {
      id: template.id + (idx ? '__v' + idx : ''),
      name: template.label || template.id,
      kind: template.kind,
      role: template.role,
      templateId: template.id,
      variantIdx: idx,
      config,
    };
  }

  // Re-roll a workout's TEMPLATE-REF slots to their next variant. Inline segments
  // (legacy {kind,config}) are never re-rolled. scope: 'all' | a slot id | an index.
  // Returns a NEW session object with advanced variantIdx values (pure — no build).
  function refreshWorkout(session, opts) {
    if (!session) return session;
    opts = opts || {};
    const scope = (opts.scope == null) ? 'all' : opts.scope;
    const segs = (session.segments || []).map((seg, i) => {
      const isRef = !!(seg && seg.templateId && !seg.kind);
      if (!isRef) return seg;
      const hit = scope === 'all' || scope === seg.id || scope === i;
      if (!hit) return seg;
      const tmpl = SEGMENT_TEMPLATES[seg.templateId];
      const n = (tmpl && tmpl.vary && tmpl.vary.length) || 1;
      if (n <= 1) return seg;
      return Object.assign({}, seg, { variantIdx: (((seg.variantIdx | 0) + 1) % n) });
    });
    return Object.assign({}, session, { segments: segs });
  }

  // Materialise a session segment: a TEMPLATE-REF ({ templateId, variantIdx, locks })
  // becomes a concrete { kind, config } segment via rollSegment; an inline segment
  // passes through unchanged. Returns null for an unknown templateId (caller skips).
  // Shared by buildSessionChart AND generateSession's metadata path so both see the
  // same materialised first segment (else session metadata reads a config-less ref).
  function materializeSegment(rawSeg) {
    if (!(rawSeg && rawSeg.templateId && !rawSeg.kind)) return rawSeg;
    const tmpl = SEGMENT_TEMPLATES[rawSeg.templateId];
    if (!tmpl) return null;
    const seg = rollSegment(tmpl, { variantIdx: rawSeg.variantIdx, locks: rawSeg.locks });
    if (rawSeg.name) seg.name = rawSeg.name;
    if (rawSeg.bpmLadder) seg.bpmLadder = rawSeg.bpmLadder;
    if (rawSeg.keyCycle) seg.keyCycle = rawSeg.keyCycle;
    if (rawSeg.targetSec != null) seg.targetSec = rawSeg.targetSec;
    return seg;
  }

  // Startup integrity guard (mirrors validateStylePalettes + the no-unison guard):
  // injects each template's id, then enforces the four refresh invariants over every
  // variant of every template — throws on load if an authored template violates one.
  (function validateSegmentTemplates() {
    for (const id of Object.keys(SEGMENT_TEMPLATES)) {
      const t = SEGMENT_TEMPLATES[id];
      t.id = id;
      if (!SEGMENT_ROLES[t.role])         throw new Error(`[SlopScale segment-template] ${id} has unknown role "${t.role}"`);
      if (!SEGMENT_BANDS.includes(t.band)) throw new Error(`[SlopScale segment-template] ${id} has unknown band "${t.band}"`);
      if (!t.kind || typeof t.kind !== 'string') throw new Error(`[SlopScale segment-template] ${id} has no kind`);
      if (t.style && !STYLE_PALETTES[t.style]) throw new Error(`[SlopScale segment-template] ${id} references unknown style "${t.style}"`);
      const vary = (t.vary && t.vary.length) ? t.vary : [{}];
      for (const d of vary) {
        for (const lk of ['bpm','targetSec','meter','bars']) if (lk in d) throw new Error(`[SlopScale segment-template] ${id} vary delta sets ${lk} — length determinants (bpm/targetSec/meter/bars) must be held across variants`);
        if (t.style) {
          const pal = STYLE_PALETTES[t.style];
          if (d.progression && !pal.progressions.includes(d.progression)) throw new Error(`[SlopScale segment-template] ${id} vary progression "${d.progression}" is not in the ${t.style} palette (style-lock)`);
          if (d.scale && !pal.leadScales.includes(d.scale))               throw new Error(`[SlopScale segment-template] ${id} vary scale "${d.scale}" is not in the ${t.style} palette (style-lock)`);
        }
      }
      for (let i = 0; i < vary.length; i++) {
        const c = rollSegment(t, { variantIdx:i }).config;
        const forcedChord = c.chordOverride && c.chordOverride !== 'auto';
        if (c.scale && !scaleHasQualityRow(c.scale) && !GATE_EXEMPT_SCALES.has(c.scale) && !isSingleChordBacking(t.kind, c.progression) && !forcedChord)
          throw new Error(`[SlopScale segment-template] ${id} variant ${i}: exotic scale "${c.scale}" over multi-chord backing "${c.progression}" with auto chords (no-row-scale gate)`);
      }
    }
  })();

  // ── Practice-type applicability (the ternary offerable() tag) ───────────────
  // ONE predicate for "is this practice type offered on this instrument", with a
  // TERNARY tag (bass-pedagogy + cross-instrument lock): native (idiomatic as-is) /
  // adapted (transfers but the generator changes behaviour) / n-a (don't offer).
  // Drives the instrument-aware UI (syncInstrumentClass) — the single source of
  // truth replacing the old bending-only hide. Only EXCEPTIONS are listed; anything
  // unlisted is 'native' for every instrument. The `adapted` behaviour contract
  // lives in the generators + the goal-cards (e.g. bass legato = HO/PO only, bass
  // "sweep" = a raked broken arpeggio). Per-lane spec: agent-memory/
  // bass-pedagogy-expert/project_bass_offerable_tag_table.
  const PRACTICE_APPLICABILITY = {
    // Guitar-native, not offered on bass.
    bending:          { bass:'n-a' },
    tremolo_picking:  { bass:'n-a' },
    hybrid_picking:   { bass:'n-a' },
    strum_comp:       { bass:'n-a' },        // bass doesn't strum held chords — its comping is the groove primitives
    // Transfer to bass but the generator must adapt the feel/register.
    legato:           { bass:'adapted' },    // hammer/pull only, no wide runs
    vibrato:          { bass:'adapted' },     // slower, narrower
    tapping:          { bass:'adapted' },     // single-line, advanced only
    pentatonic_super: { bass:'adapted' },     // low-mid register, stretch caveat
    sweep_arpeggios:  { bass:'adapted' },     // a raked broken arpeggio, not a metal sweep
    shell_voicings:   { bass:'adapted' },     // 2-note low-register, no clusters below ~fret 7
    // Bass-native groove primitives, not offered on guitar (keep the guitar arc clean).
    root_fifth_octave:    { guitar:'n-a' },
    octave_groove:        { guitar:'n-a' },
    dead_note_groove:     { guitar:'n-a' },
    right_hand_technique: { guitar:'n-a' },
    slap_pop:             { guitar:'n-a' },
  };
  function offerableTag(primitive, instrument) {
    const e = PRACTICE_APPLICABILITY[primitive];
    return (e && e[instrument]) || 'native';
  }
  function offerable(primitive, instrument) { return offerableTag(primitive, instrument) !== 'n-a'; }
  // Startup integrity guard (mirrors the no-unison / style-palette / segment guards):
  // every applicability value must be one of the three tags.
  (function validateApplicability() {
    const ok = new Set(['native', 'adapted', 'n-a']);
    for (const k of Object.keys(PRACTICE_APPLICABILITY)) {
      const e = PRACTICE_APPLICABILITY[k];
      for (const inst of Object.keys(e)) if (!ok.has(e[inst])) throw new Error(`[SlopScale applicability] ${k}.${inst} = "${e[inst]}" is not native/adapted/n-a`);
    }
  })();

  // Best-effort family inference for pathways that don't (yet) declare a profile,
  // so an untagged pathway gets a sensible family default — never silence or a
  // wrong-family voice.
  function inferAudioFamily(cfg) {
    const p = (cfg && cfg.pathway) || '';
    if (cfg && cfg.chordOverride === '5') return 'distorted';
    if (/chug|gallop|djent|metal|death/.test(p)) return 'distorted';
    return 'clean';
  }
  // Resolve the effective backing profile: GLOBAL ← family ← genre profile ←
  // brightness slider ← manual voice override. Never throws; always returns a
  // complete profile so the backing voice + brightness are always defined.
  function resolveAudioProfile(cfg) {
    const a = (cfg && cfg.audio) || {};
    const profDef = a.profile && AUDIO_PROFILES[a.profile];
    const fam = (profDef && profDef.family) || inferAudioFamily(cfg || {});
    const famDef = AUDIO_FAMILY_DEFAULTS[fam] || {};
    const out = {
      family: fam,
      harmony: { ...GLOBAL_AUDIO_DEFAULT.harmony, ...famDef.harmony, ...(profDef ? profDef.harmony : {}) },
      notes:   { ...GLOBAL_AUDIO_DEFAULT.notes,   ...famDef.notes,   ...(profDef ? profDef.notes   : {}) },
      bass:    { ...GLOBAL_AUDIO_DEFAULT.bass,    ...famDef.bass,    ...(profDef ? profDef.bass    : {}) },
      // Ensemble drums slot (Phase D): a kit id resolved profile ← family default;
      // resolveDrumKit() applies the mixer override + the unregistered→kit_909 fallback.
      drums:   { kit: (profDef && profDef.drums && profDef.drums.kit) || DRUM_KIT_FAMILY_DEFAULT[fam] || 'kit_909',
                 level: (profDef && profDef.drums && Number.isFinite(profDef.drums.level)) ? profDef.drums.level : 1 },
      brightness: (profDef && profDef.brightness != null) ? profDef.brightness
                : (famDef.brightness != null) ? famDef.brightness
                : GLOBAL_AUDIO_DEFAULT.brightness,
    };
    // The practice voice tracks the instrument, not the genre: a bass exercise's
    // notes should sound like a bass regardless of the backing's family.
    if (cfg && cfg.instrument === 'bass') out.notes.tone = 'bass';
    if (Number.isFinite(a.brightness)) out.brightness = a.brightness;           // slider overrides
    // (backing-voice override moved to the Mixer's per-channel instrument select — Phase C)
    return out;
  }

  // ── WebAudioFont sampler (the engine:'sample' path) ───────────────────────
  // Borrows the host's GM-multisample approach (the same JCLive soundfont its
  // piano plugin plays). Loads the player + a GM preset on demand, caches it,
  // and harmony notes for sampled profiles play via queueWaveTable onto the
  // 'harmony' bus — with the oscillator voice as the fallback until the (async)
  // preset finishes loading. NOTE: loads from the soundfont CDN today (proven,
  // exactly as the host does); the agreed hardening step is to self-host the
  // handful of GM programs we actually use under a plugin static route.
  // Self-hosted: bundled under static/wafonts/, served by routes.py (no runtime
  // CDN dependency, offline-safe). WebAudioFont code is MIT; the JCLive GM
  // soundfont data is bundled for the backing — verify redistribution before public release.
  const WAF_BASE = '/api/plugins/slopscale/wafont/';
  const WAF_PLAYER_URL = '/api/plugins/slopscale/wafont/WebAudioFontPlayer.js';
  const WAF_SF = 'JCLive_sf2_file';
  // Symbolic voice id → General MIDI program. Bundled under static/wafonts/ and
  // served by routes.py (offline-safe). guitar = steel acoustic (25); clean =
  // clean electric (27); bass = fingered electric (33); upright = acoustic bass (32).
  const TONE_GM = {
    piano: 0, epiano: 4, clav: 7, organ: 19, nylon: 24, guitar: 25, clean: 27,
    upright: 32, bass: 33, strings: 48, brass: 61, synthlead: 81, synthpad: 88, pad: 89,
  };
  const wafFile = gm => String(gm * 10).padStart(4, '0') + '_' + WAF_SF;
  const wafVar  = gm => '_tone_' + wafFile(gm);
  const wafUrl  = gm => WAF_BASE + wafFile(gm) + '.js';
  let wafPlayer = null;
  const wafPresets = {}; // gm -> { state: 'loading'|'ready'|'failed', preset }
  // Script loading reuses the existing host-viz loader `loadScriptOnce(id, src)`
  // defined in §12 (do NOT add a second loadScriptOnce — function declarations
  // collide and the later one wins).
  // Returns an awaitable promise that resolves when the load SETTLES (ready OR
  // failed) — so callers can wait for the voice before scheduling, preventing the
  // oscillator→WAF swap mid-exercise. Concurrent calls share the in-flight promise.
  // Low-level loader: cache `key` → load `varName` from `url` (settles ready|failed).
  // Both the melodic GM path and the drum-preset path (Phase D4) go through this.
  function loadWafPreset(key, varName, url) {
    if (key == null) return Promise.resolve();
    const prev = wafPresets[key];
    if (prev && (prev.state === 'loading' || prev.state === 'ready')) return prev.promise || Promise.resolve(); // in-flight or done; RETRY on prior 'failed'
    const entry = { state: 'loading', preset: null, promise: null };
    wafPresets[key] = entry;
    entry.promise = (async () => {
      try {
        await loadScriptOnce('slopscale-waf-player', WAF_PLAYER_URL);
        if (typeof WebAudioFontPlayer === 'undefined') throw new Error('WebAudioFontPlayer missing');
        if (!wafPlayer) wafPlayer = new WebAudioFontPlayer();
        const ctx = audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
        if (!window[varName]) await loadScriptOnce('slopscale-waf-' + key, url);
        const preset = window[varName];
        if (!preset) throw new Error('preset var missing');
        wafPlayer.adjustPreset(ctx, preset);
        entry.state = 'ready'; entry.preset = preset;
      } catch (e) {
        entry.state = 'failed'; entry.preset = null; // silent → oscillator/synth fallback
      }
    })();
    return entry.promise;
  }
  function ensureWafPreset(gm) {
    if (gm == null) return Promise.resolve();
    return loadWafPreset(gm, wafVar(gm), wafUrl(gm));
  }
  // Load a drum one-shot preset (Phase D4). Keyed by its var name (no collision with
  // the melodic GM-number keys), served from static/wafonts/ by the /wafont route.
  function ensureDrumPreset(varName, file) { return loadWafPreset(varName, varName, WAF_BASE + file); }
  function getReadyWafPreset(gm) { return (gm != null && wafPresets[gm] && wafPresets[gm].state === 'ready') ? wafPresets[gm].preset : null; }
  // Which sampled-voice GM presets the bundle's ENABLED audio actually needs.
  function resolveVoiceGms(bundle) {
    const cfg = readConfig();
    const audio = (bundle && bundle.config && bundle.config.audio) || cfg.audio;
    const prof = resolveAudioProfile({ ...cfg, audio });
    const out = [];
    const pick = (role, on) => { if (!on) return; const g = mixerInstrumentFor(role) ?? (prof[role] && prof[role].engine === 'sample' ? TONE_GM[prof[role].tone] : null); if (g != null && out.indexOf(g) < 0) out.push(g); };
    pick('notes', audio.notes); pick('harmony', audio.harmony); pick('bass', audio.harmony);
    return out;
  }
  // Kick the (async) load of every sampled voice the bundle needs, WITHOUT waiting —
  // call at generate time so the preset is usually warm by the time Play is pressed.
  function prewarmVoices(bundle) {
    resolveVoiceGms(bundle || activeBundle).forEach(gm => ensureWafPreset(gm));
    const dk = activeSampleDrumKit(bundle || activeBundle);
    if (dk) DRUM_CORE_PIECES.forEach(p => ensureDrumPiece(dk, p));   // preload the groove staples (Phase D4)
  }
  // The active sample-engine drum kit for this bundle (or null: synth kit / drums off).
  function activeSampleDrumKit(bundle) {
    const cfg = readConfig();
    const audio = (bundle && bundle.config && bundle.config.audio) || cfg.audio;
    if (!audio || !audio.harmony || audio.drums === false) return null;
    const kit = resolveDrumKit(resolveAudioProfile({ ...cfg, audio }));
    return (kit && kit.engine === 'sample' && kit.pieces) ? kit : null;
  }
  function ensureDrumPiece(kit, piece) {
    const note = kit.pieces[piece]; if (note == null) return Promise.resolve();
    return ensureDrumPreset(drumVar(note, kit.font, kit.variant), drumFile(note, kit.font, kit.variant));
  }
  // WAIT (capped) for those loads before the first pass is scheduled, so playback
  // starts on the sampled voice instead of starting on the oscillator and swapping
  // to WAF mid-exercise once the load lands. Falls through on timeout/failure (the
  // per-voice oscillator/synth fallback still covers it). Includes the core drum
  // pieces so the kit starts on samples, not the synth fallback.
  async function awaitVoices(bundle, capMs) {
    const gms = resolveVoiceGms(bundle || activeBundle);
    const dk = activeSampleDrumKit(bundle || activeBundle);
    const drumPromises = dk ? DRUM_CORE_PIECES.map(p => ensureDrumPiece(dk, p)) : [];
    if (!gms.length && !drumPromises.length) return;
    let timer; const cap = new Promise(r => { timer = setTimeout(r, capMs || 2000); });
    try { await Promise.race([Promise.all([...gms.map(gm => ensureWafPreset(gm)), ...drumPromises]), cap]); }
    finally { clearTimeout(timer); }
  }

  function openMidisForConfig(cfg) {
    // A customOpenMidis override on the config wins over the stringSetup's
    // default — that's how per-string tunings (DADGAD, baritone, custom)
    // flow from the form into the generators.
    if (Array.isArray(cfg.customOpenMidis) && cfg.customOpenMidis.length) return cfg.customOpenMidis.slice();
    return (STRING_SETUPS[cfg.stringSetup] || STRING_SETUPS.guitar_6_standard).openMidis.slice();
  }
  function tuningOffsetsForConfig(cfg) {
    // When a custom tuning is in play, derive offsets from the difference
    // between custom and stringSetup-standard midis so downstream callers
    // that read the offset field still see something meaningful.
    const baseSetup = STRING_SETUPS[cfg.stringSetup] || STRING_SETUPS.guitar_6_standard;
    if (Array.isArray(cfg.customOpenMidis) && cfg.customOpenMidis.length === baseSetup.openMidis.length) {
      return cfg.customOpenMidis.map((m, i) => m - baseSetup.openMidis[i]);
    }
    return baseSetup.tuning.slice();
  }
  function noteDefaults(extra) { return Object.assign({ t:0, s:0, f:0, sus:0, sl:-1, slu:-1, bn:0, ho:false, po:false, hm:false, hp:false, pm:false, mt:false, vb:false, tr:false, ac:false, tp:false }, extra || {}); }
  function scalePcs(cfg) { const keyPc = NOTE_ALIASES[cfg.key] ?? 0; return (SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major).map(i => (keyPc + i) % 12); }
  function secondsPerDivision(cfg) { const q = 60 / cfg.bpm; return ({ quarter:q, eighth:q/2, sixteenth:q/4, triplet:q/3, eighth_triplet:q/3, sixteenth_triplet:q/6, gallop:q/2, reverse_gallop:q/2 })[cfg.subdivision] || q/2; }
  // Non-uniform rhythm patterns (genre-framework §2.5). Returns a cycling array of
  // per-note durations for one beat, or null for the uniform subdivisions (which
  // use secondsPerDivision instead). Gallop = eighth + two sixteenths; reverse =
  // two sixteenths + eighth — the metal rhythm-guitar staple. Consumed by
  // fillNotesFromSeq's `steps` path; generators opt in via rhythmSteps(cfg).
  function rhythmSteps(cfg) {
    const q = 60 / cfg.bpm;
    if (cfg.subdivision === 'gallop')         return [q / 2, q / 4, q / 4];
    if (cfg.subdivision === 'reverse_gallop') return [q / 4, q / 4, q / 2];
    return null;
  }
  function measureSeconds(cfg) { return (60 / cfg.bpm) * (4 / cfg.meter.denominator) * cfg.meter.numerator; }
  // Seconds per metric beat (the meter's denominator unit) for a rendered
  // bundle. Used to size the Tab/Notation view window in beats rather than
  // fixed seconds, so note density stays comfortable across tempos.
  function chartBeatSeconds(bundle) {
    const c = (bundle && bundle.config) || {};
    const bpm = c.bpm || 90, den = (c.meter && c.meter.denominator) || 4;
    return (60 / bpm) * (4 / den);
  }
  function fretboardSystemLabel(value) { return FRETBOARD_SYSTEM_LABELS[value] || FRETBOARD_SYSTEM_LABELS.position; }

  function cagedShapeQualityKey(quality) {
    // Power chords + 9/11/13 extensions have no triad template — signal "skip the
    // template" so callers fall back to interval-derived voicing (root+5th for
    // power chords, full chord-tone set for extensions). Returning null makes
    // `def.chordTemplates[null]` undefined → the template functions return null.
    if (!TEMPLATE_QUALITIES.has(quality)) return null;
    if (quality === 'min' || quality === 'min7' || quality === 'min_maj7') return 'min';
    if (quality === 'dim' || quality === 'dim7' || quality === 'min7b5') return 'dim';
    return 'maj';
  }

  function cagedShapeNotesForChord(cfg, shape, quality, rootFret) {
    // CAGED chord-tone templates are a 6-string (EADGBE) system. Need ≥6 strings;
    // bass 4/5 (<6) → return null so the caller falls back. On a 7/8-string the
    // template anchors on the TOP SIX strings (off = N-6), mirroring resolveCAGEDShape.
    if (cfg.stringCount < 6) return null;
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    const tmpl = def.chordTemplates[cagedShapeQualityKey(quality)];
    if (!tmpl) return null;
    const opens = openMidisForConfig(cfg);
    const off = Math.max(0, cfg.stringCount - 6);
    const out = [];
    for (const note of tmpl) {
      // note.s is in low-E=0 6-string indexing; shift onto the top-six window.
      const s = note.s + off;
      if (s < 0 || s >= cfg.stringCount) continue;
      const f = rootFret + note.fOff;
      if (f < 0 || f > 24) continue;
      const midi = opens[s] + f;
      out.push({ s, f, midi, pc:midi % 12, interval:note.iv });
    }
    out.sort((a, b) => a.midi - b.midi || a.s - b.s);
    return out;
  }

  function pickShapeRootFret(cfg, shape, rootPc, prevRootFret, mode) {
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    // def.rootStringIdx is low-E=0 6-string indexing; on a 7/8-string the shape is
    // anchored on the top-six (off = N-6), so the anchor string shifts up too —
    // otherwise the root fret would be computed off the low B/F#, not the EADGBE
    // 'low E'. Mirrors resolveCAGEDShape / cagedShapeNotesForChord.
    const off = Math.max(0, cfg.stringCount - 6);
    const rootStringIdx = def.rootStringIdx + off;
    if (rootStringIdx < 0 || rootStringIdx >= cfg.stringCount) return null;
    const opens = openMidisForConfig(cfg);
    const anchorPc = ((opens[rootStringIdx] % 12) + 12) % 12;
    const baseFret = (((rootPc - anchorPc) % 12) + 12) % 12;
    // Generate candidate frets across the neck (baseFret + 0/12, plus -12/+24 for headroom)
    const options = [];
    for (let octShift = -1; octShift <= 2; octShift++) {
      const f = baseFret + octShift * 12;
      // Leave ~4 frets of headroom at the top so the shape extension fits
      if (f >= 0 && f <= 20) options.push(f);
    }
    if (!options.length) return baseFret;
    if (prevRootFret == null || prevRootFret < 0) {
      // First chord: lowest valid fret (matches user's example: C in C-shape starts at fret 3)
      return Math.min.apply(null, options);
    }
    if (mode === 'ascend') {
      const above = options.filter(f => f > prevRootFret);
      if (above.length) return Math.min.apply(null, above);
      // Ran out of neck — fall back to closest as a safety net
    }
    let best = options[0], bestDist = Math.abs(options[0] - prevRootFret);
    for (let i = 1; i < options.length; i++) {
      const d = Math.abs(options[i] - prevRootFret);
      if (d < bestDist) { best = options[i]; bestDist = d; }
    }
    return best;
  }

  function shuffleCopy(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Find the {s, f, midi} within [fretMin, fretMax] whose pitch class matches
  // targetPc and whose MIDI pitch is closest to prevMidi. Used by guide tones
  // for voice-leading — each successive guide tone takes the nearest occurrence
  // rather than jumping to an arbitrary octave.
  function nearestPositionForPc(targetPc, prevMidi, openMidis, fretMin, fretMax) {
    const normPc = ((targetPc % 12) + 12) % 12;
    const options = [];
    for (let s = 0; s < openMidis.length; s++) {
      for (let f = Math.max(0, fretMin); f <= Math.min(24, fretMax); f++) {
        const midi = openMidis[s] + f;
        if (((midi % 12) + 12) % 12 === normPc) options.push({ s, f, midi });
      }
    }
    if (!options.length) return null;
    // Closest pitch to prevMidi wins; on a tie (the same pitch is reachable at
    // two string/fret spots, e.g. D2 at low-E fret 10 or D-string fret 0) prefer
    // the LOWER fret so lines stay in a comfortable, low hand position instead of
    // drifting up the neck. Used by walking bass, guide tones, shell voicings.
    let best = options[0], bestDist = Math.abs(options[0].midi - prevMidi);
    for (let i = 1; i < options.length; i++) {
      const d = Math.abs(options[i].midi - prevMidi);
      if (d < bestDist || (d === bestDist && options[i].f < best.f)) { best = options[i]; bestDist = d; }
    }
    return best;
  }

  function applySequencePattern(positions, pattern) {
    const offsets = SEQUENCE_PATTERNS[pattern];
    if (!offsets || !offsets.length || positions.length < 2) return positions;
    const maxOffset = Math.max.apply(null, offsets);
    if (positions.length <= maxOffset) return positions;
    const out = [];
    for (let i = 0; i + maxOffset < positions.length; i++) {
      for (const offset of offsets) out.push(positions[i + offset]);
    }
    return out.length ? out : positions;
  }

  function directedPath(items, direction, repeatCount) {
    const base = items.slice();
    if (base.length <= 1) return base;
    let phrase;
    switch (direction) {
      case 'ascending': phrase = base; break;
      case 'descending': phrase = base.slice().reverse(); break;
      case 'down_up': phrase = base.slice().reverse().concat(base.slice(1, -1)); break;
      case 'random': phrase = shuffleCopy(base); break;
      case 'up_down':
      default: phrase = base.concat(base.slice(1, -1).reverse()); break;
    }
    const out = [];
    const repeats = Math.max(1, repeatCount || 1);
    for (let i = 0; i < repeats; i++) out.push(...(direction === 'random' ? shuffleCopy(base) : phrase));
    return out;
  }

  // Map a (possibly out-of-range) linear index onto [0, len-1] by REFLECTION
  // (a triangle wave) instead of wraparound (a sawtooth). When a run walks past
  // the end of a box, wraparound teleports top→bottom (a ~2-octave leap); a
  // reflection bounces back stepwise, the way a player turns a run around at the
  // edge of a position. Used by the chord-scale bar emission so neither a short
  // box nor a mid-box entry point produces an unplayable intra-bar jump.
  function reflectIdx(p, len) {
    if (len <= 1) return 0;
    const period = 2 * (len - 1);
    const m = ((p % period) + period) % period;
    return m < len ? m : period - m;
  }

  function positionsForPitchClass(pc, cfg) {
    const opens = openMidisForConfig(cfg), out = [];
    for (let s = 0; s < cfg.stringCount; s++) for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
      const midi = opens[s] + f;
      if (midi % 12 === pc) out.push({ s, f, midi, pc });
    }
    return out.sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
  }

  function allScalePositions(cfg) {
    const pcs = new Set(scalePcs(cfg));
    const opens = openMidisForConfig(cfg);
    const chosen = [], usedMidi = new Set();
    let lastMidi = -Infinity;
    for (let s = 0; s < cfg.stringCount; s++) {
      const candidates = [];
      for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
        const midi = opens[s] + f, pc = midi % 12;
        if (pcs.has(pc)) candidates.push({ s, f, midi, pc });
      }
      candidates.sort((a,b) => a.midi - b.midi || a.f - b.f);
      const picks = [];
      for (const p of candidates) {
        if (p.midi <= lastMidi || usedMidi.has(p.midi)) continue;
        picks.push(p);
        if (picks.length >= 3) break;
      }
      if (picks.length < 3) {
        for (const p of candidates) {
          if (usedMidi.has(p.midi) || picks.some(x => x.s === p.s && x.f === p.f)) continue;
          picks.push(p);
          if (picks.length >= 3) break;
        }
      }
      picks.sort((a,b) => a.midi - b.midi || a.f - b.f);
      for (const p of picks) {
        if (usedMidi.has(p.midi)) continue;
        chosen.push(p); usedMidi.add(p.midi);
        if (p.midi > lastMidi) lastMidi = p.midi;
      }
    }
    if (chosen.length > 1) return chosen;
    return everyScalePosition(cfg).filter((p, index, arr) => arr.findIndex(x => x.midi === p.midi) === index);
  }

  function everyScalePosition(cfg) {
    const pcs = new Set(scalePcs(cfg));
    const opens = openMidisForConfig(cfg);
    const out = [];
    for (let s = 0; s < cfg.stringCount; s++) for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
      const midi = opens[s] + f, pc = midi % 12;
      if (pcs.has(pc)) out.push({ s, f, midi, pc });
    }
    return out.sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
  }

  function singleStringScalePositions(cfg) {
    const pcs = new Set(scalePcs(cfg));
    const opens = openMidisForConfig(cfg);
    let best = [];
    for (let s = 0; s < cfg.stringCount; s++) {
      const row = [];
      for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
        const midi = opens[s] + f, pc = midi % 12;
        if (pcs.has(pc)) row.push({ s, f, midi, pc });
      }
      if (row.length > best.length) best = row;
    }
    return best.sort((a,b) => a.midi - b.midi || a.f - b.f);
  }

  function startAtRootPc(positions, cfg) {
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const idx = positions.findIndex(p => p.pc === keyPc);
    return idx > 0 ? positions.slice(idx).concat(positions.slice(0, idx)) : positions;
  }

  // Drop unison duplicates (same pitch on two strings) from a position list,
  // keeping the first occurrence. Positions are expected midi-ascending, so the
  // lower string/fret wins. Enforces the no-unison rule for any run — scales and
  // arpeggios alike, regardless of which resolver produced the positions.
  function dedupeUnisons(positions) {
    const out = [], used = new Set();
    for (const p of positions) {
      if (!p || used.has(p.midi)) continue;
      used.add(p.midi);
      out.push(p);
    }
    return out;
  }

  // Convert a shape's note list (s/f/d/isRoot) into the {s,f,midi,pc} shape
  // the chart generators expect.
  function shapeNotesToPositions(cfg, shapeNotes) {
    const opens = openMidisForConfig(cfg);
    const mapped = shapeNotes
      .filter(n => n.s >= 0 && n.s < cfg.stringCount)
      .map(n => {
        const midi = opens[n.s] + n.f;
        return { s: n.s, f: n.f, midi, pc: midi % 12 };
      })
      .sort((a, b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
    // No-unison guard at the run/seam layer: a pitch must sound only once even
    // when shapes are stitched together (combined positions, arpeggio + scale).
    // Resolvers already avoid intra-shape unisons; this also covers combinations.
    return dedupeUnisons(mapped);
  }

  function scalePositionsForSystem(cfg) {
    // Shape-aware systems (caged / 3nps / open) come pre-resolved by readConfig
    // — return the shape's note set directly.
    if (cfg.shapeNotes && cfg.shapeNotes.length) {
      return shapeNotesToPositions(cfg, cfg.shapeNotes);
    }
    switch (cfg.fretboardSystem) {
      case 'single_string': return singleStringScalePositions(cfg);
      // full_neck is the one path that doesn't resolve through a unison-deduping
      // resolver (shape paths → shapeNotesToPositions; position → allScalePositions
      // unique-midi). everyScalePosition collects every fret across the neck, so a
      // pitch recurs on multiple strings — dedupe to one ascending pass (no-unison rule).
      // FRET-COUNT ASSUMPTION: this sweeps a fixed 0–24 neck. SlopScale has no
      // instrument fret-count model (MAX_FRET=36 is only an input sanity-clamp, not a
      // real neck length), so the top of this run reaches fret ~24 — playable on 24-fret
      // guitars but past the end of 21/22-fret necks (most Fender/Gibson). Accepted by
      // decision (2026-05-31): leave at 24. Future option if it matters: add a per-
      // instrument `frets` field to STRING_SETUPS and clamp fretMax to it here.
      case 'full_neck': return dedupeUnisons(everyScalePosition(Object.assign({}, cfg, { fretMin:0, fretMax:24 })));
      case 'position':
      default: return allScalePositions(cfg);
    }
  }

  function buildBeats(cfg, duration) {
    const beats = [], beatUnit = (60 / cfg.bpm) * (4 / cfg.meter.denominator), mLen = measureSeconds(cfg), groupingStarts = new Set();
    let g = 0; for (const width of cfg.meter.grouping) { groupingStarts.add(g); g += width; }
    let measure = 1;
    for (let barStart = 0; barStart <= duration + 0.0001; barStart += mLen) {
      for (let i = 0; i < cfg.meter.numerator; i++) {
        const time = Number((barStart + i * beatUnit).toFixed(6));
        if (time > duration + 0.0001) break;
        beats.push({ time, measure: i === 0 ? measure : -1, accent: i === 0 ? 'measure' : (groupingStarts.has(i) ? 'group' : 'beat') });
      }
      measure += 1;
    }
    return beats;
  }
  function buildAnchors(cfg, duration) { const out = [], width = Math.max(3, cfg.fretMax - cfg.fretMin + 1); for (let t = 0; t <= duration + 0.0001; t += 2) out.push({ time: Number(t.toFixed(6)), fret: cfg.fretMin, width }); return out; }

  // ===========================================================================
  // §5 · CHORD-DEPTH / DIATONIC EXTENSION ENGINE
  // ===========================================================================
  // --- Chord depth / diatonic extension engine -----------------------------
  // Depth → number of stacked tones. Extended depths stack further diatonic
  // thirds on top of the seventh (9th, 11th, 13th).
  const DEPTH_TONES = { triad:3, seventh:4, ninth:5, eleventh:6, thirteenth:7 };
  const EXTENDED_DEPTHS = new Set(['ninth','eleventh','thirteenth']);
  // Promote a NAMED quality to its natural extended form. Used for chords that
  // are deliberate harmonic choices (progression overrides — secondary dominants,
  // and future tritone subs) rather than plain diatonic chords: those extend with
  // conventional natural tensions, NOT by stacking the home key's scale. Unlisted
  // bases fall through unchanged.
  const QUALITY_EXTEND = {
    ninth:      { maj7:'maj9', min7:'min9', dom7:'dom9', maj:'add9', min:'min9', '6':'69' },
    eleventh:   { maj7:'maj11', min7:'min11', dom7:'dom11', maj:'maj11', min:'min11' },
    thirteenth: { maj7:'maj13', min7:'min13', dom7:'dom13', maj:'maj13', min:'min13' }
  };
  function extendNamedQuality(base, depth) { const m = QUALITY_EXTEND[depth]; return (m && m[base]) || base; }
  // Build the diatonic chord on `degree` of `scale`, stacked to `tones` notes, as
  // semitone intervals from the chord root — by stacking scale thirds (every other
  // scale tone). For heptatonic scales this yields the TRUE diatonic chord at any
  // extension, including altered tensions (e.g. the iii chord's ♭9/♭13 and the IV
  // chord's ♯11 in major fall out automatically).
  function diatonicChordIntervals(scale, degree, tones) {
    const sc = SCALE_INTERVALS[scale] || SCALE_INTERVALS.major;
    const n = sc.length, rootIdx = (degree - 1 + n * 99) % n, rootPitch = sc[rootIdx], out = [];
    for (let k = 0; k < tones; k++) { const step = rootIdx + 2 * k; out.push(sc[step % n] + 12 * Math.floor(step / n) - rootPitch); }
    return out;
  }
  // Derive a readable jazz chord symbol from an interval stack. Base triad/7th +
  // extension figure + characteristic altered tensions. NOTES are always exact;
  // the symbol approximates but flags the spicy tensions (♭9 / ♯11 / ♭13 …).
  function deriveChordSymbol(iv) {
    const has = x => iv.includes(x);
    const third = has(4) ? 'M' : has(3) ? 'm' : null;
    const dim5 = has(6) && !has(7), aug5 = has(8) && !has(7);
    const maj7 = has(11), b7 = has(10), dd7 = has(9) && !has(10) && !has(11);
    let stem, special = false;
    if (third === 'm' && dim5 && b7) { stem = 'm7♭5'; special = true; }
    else if (dim5 && dd7) { stem = 'dim7'; special = true; }
    else if (third === 'M' && maj7) stem = 'maj';
    else if (third === 'M' && b7) stem = '';            // dominant
    else if (third === 'm' && maj7) { stem = 'm(maj7)'; special = true; }
    else if (third === 'm') stem = 'm';
    else if (aug5) { stem = 'aug'; special = true; }
    else stem = third === 'M' ? 'maj' : 'm';
    const fig = (has(20) || has(21)) ? '13' : (has(17) || has(18)) ? '11' : (has(13) || has(14) || has(15)) ? '9' : (maj7 || b7 || dd7) ? '7' : '';
    const alt = [];
    if (aug5 && !special) alt.push('♯5');                 // augmented-maj7 (III of harmonic/melodic minor)
    if (dim5 && !special && third === 'M') alt.push('♭5'); // dominant ♭5
    if (has(13)) alt.push('♭9'); if (has(15)) alt.push('♯9');
    if (has(18) && !has(17)) alt.push('♯11');
    if (has(20) && !has(21)) alt.push('♭13');
    if (special) { const inner = []; if (fig && fig !== '7') inner.push(fig); inner.push(...alt); return stem + (inner.length ? `(${inner.join(',')})` : '') || 'maj'; }
    return (stem + fig + (alt.length ? `(${alt.join('')})` : '')) || 'maj';
  }
  // Register (memoised) a synthetic CHORD_FORMULAS entry for a diatonically-stacked
  // extended chord; return its key. Consumers read CHORD_FORMULAS[key] exactly like
  // a static quality, so no call site needs to change. `mode` carries the chord-
  // scale for mode-of-the-moment (the diatonic mode of the base seventh chord).
  function diatonicExtendedQuality(scale, degree, depth) {
    const key = `__d:${scale}:${degree}:${depth}`;
    if (!CHORD_FORMULAS[key]) {
      const intervals = diatonicChordIntervals(scale, degree, DEPTH_TONES[depth] || 5);
      const fam = DIATONIC_QUALITIES[scale] || DIATONIC_QUALITIES.major;
      const base7 = (fam.seventh || fam.triad)[(degree - 1 + 7) % 7] || 'maj7';
      CHORD_FORMULAS[key] = { symbol: deriveChordSymbol(intervals), intervals, mode: MODE_FOR_QUALITY[base7] || 'major' };
    }
    return key;
  }
  function chordQualityForDegree(scale, depth, degree, override, progression) {
    if (override && override !== 'auto') return override;            // explicit override wins fully
    const ext = EXTENDED_DEPTHS.has(depth);
    // Progression token: {deg|semis, q, rn}. An explicit q wins (promoted by depth);
    // a deg-only token defers to the diatonic path; a chromatic semis token with no
    // quality is assumed dominant (the usual chromatic-chord case).
    if (degree && typeof degree === 'object') {
      if (degree.q) return ext ? extendNamedQuality(degree.q, depth) : degree.q;
      if (degree.deg != null) return chordQualityForDegree(scale, depth, degree.deg, override, progression);
      return ext ? extendNamedQuality('dom7', depth) : 'dom7';
    }
    const progOverride = progression && PROGRESSION_QUALITY_OVERRIDES[progression];
    if (progOverride && progOverride[degree] != null) {
      const base = progOverride[degree];
      return ext ? extendNamedQuality(base, depth) : base;          // promote borrowed/secondary chords
    }
    // Diatonic chords: extended depths stack true scale thirds (heptatonic scales
    // only — the DIATONIC_QUALITIES set); triad/seventh use the hand-verified rows.
    if (ext && DIATONIC_QUALITIES[scale] && (SCALE_INTERVALS[scale] || []).length === 7) {
      return diatonicExtendedQuality(scale, degree, depth);
    }
    // Exotic scale with no diatonic row: give its TONIC the honest chord identity
    // rather than silently borrowing a major triad. Tonic only (degree 1/8); other
    // degrees still fall through. Pentatonic/blues aren't in the map → unchanged.
    if (!DIATONIC_QUALITIES[scale] && ((degree - 1 + 7) % 7) === 0 && SCALE_TONIC_QUALITY[scale]) {
      const base = SCALE_TONIC_QUALITY[scale];
      return ext ? extendNamedQuality(base, depth) : base;
    }
    const family = DIATONIC_QUALITIES[scale] || DIATONIC_QUALITIES.major;
    if (ext) {
      // Non-heptatonic scale (pentatonic/blues/etc.): promote the fallback seventh.
      const base = (family.seventh || family.triad)[(degree - 1 + 7) % 7] || 'maj7';
      return extendNamedQuality(base, depth);
    }
    const row = family[depth === 'seventh' ? 'seventh' : 'triad'] || family.triad;
    return row[(degree - 1 + 7) % 7] || 'maj';
  }
  // A chord is "dominant" if it has a major 3rd + minor 7th and no major 7th —
  // covers dom7/9/11/13 (named or synthetic). Used to decide tritone-sub targets.
  function isDominantQuality(quality) {
    const f = CHORD_FORMULAS[quality];
    if (!f) return false;
    const s = new Set(f.intervals.map(i => i % 12));
    return s.has(4) && s.has(10) && !s.has(11);
  }
  function chordRootForDegree(cfg, degree) {
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    // Progression token: {deg|semis, …}. An explicit semis is a chromatic root
    // offset from the key root (and is taken literally — no auto tritone-sub on an
    // already-authored chromatic chord); a deg-only token routes the normal path.
    if (degree && typeof degree === 'object') {
      if (degree.semis != null) return ((keyPc + degree.semis) % 12 + 12) % 12;
      return chordRootForDegree(cfg, degree.deg != null ? degree.deg : 1);
    }
    // For a minor-spelled progression played over a minor-family chord-scale,
    // pin the chord ROOTS to natural minor so bVI/bIII/bVII keep their Aeolian
    // spelling (harmonic minor's raised 7th, etc. would otherwise move them).
    // All other cases follow the chosen chord-scale's own degree positions.
    const useNaturalMinorRoots = cfg.progression
      && MINOR_SPELLED_PROGRESSIONS.has(cfg.progression)
      && ROOT_PIN_NATURAL_MINOR_SCALES.has(cfg.scale);
    const rootScale = useNaturalMinorRoots ? 'natural_minor' : cfg.scale;
    let intervals = SCALE_INTERVALS[rootScale] || SCALE_INTERVALS.major;
    // Progression degrees (I/IV/V…) are FUNCTIONAL and need a 7-note scale to index.
    // Pentatonic / blues / other non-heptatonic lead scales have no usable IV or V
    // position — indexing them roots the IV on the ♭5 (blues) or 5th (pentatonic),
    // which is the long-standing blues-IV dissonance. Fall back to a diatonic scale
    // for root mapping: natural minor for minor-spelled progressions, else major
    // (the dominant-blues / major-key I–IV–V functional reading). Lead notes still
    // use cfg.scale; only the chord ROOTS are pinned to a diatonic reading.
    if (intervals.length !== 7) intervals = SCALE_INTERVALS[useNaturalMinorRoots ? 'natural_minor' : 'major'];
    let rootPc = (keyPc + intervals[(degree - 1 + intervals.length) % intervals.length]) % 12;
    // Tritone substitution: replace a dominant chord with the dominant a tritone
    // (6 semitones) away — G7 → D♭7. Quality stays dominant (so the name follows
    // the new root) and mode-of-the-moment over it resolves to that root's lydian
    // dominant, which is the classic altered-scale relationship. Extended depths
    // ride along automatically (G13 → D♭13). Subs only fire on actual dominant-7th
    // chords, so it needs Seventh-or-richer depth (or a dominant override).
    if (cfg.tritoneSub && cfg.tritoneSub !== 'off') {
      const q = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      const inScope = cfg.tritoneSub === 'all_dominants' || (cfg.tritoneSub === 'dominant_v' && degree === 5);
      if (inScope && isDominantQuality(q)) rootPc = (rootPc + 6) % 12;
    }
    return rootPc;
  }
  function chordName(rootPc, quality) { const f = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj; return pcName(rootPc) + (f.symbol === 'maj' ? 'maj' : f.symbol); }
  function progressionDegreesForConfig(cfg) { return cfg.mode === 'diatonic_arpeggios' ? COMMON_PROGRESSIONS.diatonic : (COMMON_PROGRESSIONS[cfg.progression] || COMMON_PROGRESSIONS['I-V-vi-IV']); }

  function pickChordPositions(cfg, rootPc, quality) {
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj, picked = [], used = new Set();
    for (const interval of formula.intervals) {
      const pc = (rootPc + interval) % 12, candidates = positionsForPitchClass(pc, cfg);
      const next = candidates.find(p => !used.has(`${p.s}:${p.f}`)) || candidates[0];
      if (next) { picked.push(Object.assign({}, next, { interval })); used.add(`${next.s}:${next.f}`); }
    }
    return picked.sort((a,b) => a.midi - b.midi || a.s - b.s);
  }

  function chordTonePositionsInPosition(cfg, rootPc, quality) {
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const intervalPcs = formula.intervals.map(interval => ({ interval, pc:(rootPc + interval) % 12 }));
    const chordPcs = new Set(intervalPcs.map(x => x.pc));
    const opens = openMidisForConfig(cfg);
    const out = [];
    const usedMidi = new Set();
    for (let s = 0; s < cfg.stringCount; s++) {
      for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
        const midi = opens[s] + f, pc = midi % 12;
        if (!chordPcs.has(pc) || usedMidi.has(midi)) continue;
        const match = intervalPcs.find(x => x.pc === pc) || { interval:0 };
        out.push({ s, f, midi, pc, interval:match.interval });
        usedMidi.add(midi);
      }
    }
    out.sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
    if (out.length) return out;
    return pickChordPositions(cfg, rootPc, quality);
  }

  // Build a chord template from canonical CAGED shape data — preferred path when
  // the generator knows which CAGED shape it's working in. Produces the full
  // chord voicing (all strings the shape covers, not just the strings the
  // generator happened to play) with sensible fingerings.
  function templateFromShape(name, shape, quality, rootFret, cfg, arp) {
    // 6-string (EADGBE) template; need ≥6 strings. On 7/8 it sits on the top-six
    // (off = N-6) so the chord box matches the anchored CAGED shape.
    if (cfg.stringCount < 6) return null;
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    const tmpl = def.chordTemplates[cagedShapeQualityKey(quality)];
    if (!tmpl) return null;
    const off = Math.max(0, cfg.stringCount - 6);
    const frets = new Array(cfg.stringCount).fill(-1);
    const fingers = new Array(cfg.stringCount).fill(-1);
    for (const ent of tmpl) {
      const s = ent.s + off;
      if (s < 0 || s >= cfg.stringCount) continue;
      const f = rootFret + ent.fOff;
      if (f < 0 || f > 24) return null;
      frets[s] = f;
      fingers[s] = f === 0 ? 0 : (ent.fg ?? 1);
    }
    return { name, displayName:`${name} (${def.displayName})`, arp:!!arp, fingers, frets };
  }

  // Fallback when no shape context is available. Ranks distinct non-zero frets
  // ascending — the lowest gets finger 1 (index / barre), next gets 2, etc.
  // Strings sharing the same fret share the same finger (indicates a barre).
  // Better than the previous "every string gets finger 1" but not perfect for
  // shapes with non-contiguous same-fret strings; use templateFromShape when
  // the CAGED shape is known.
  function templateFromPositions(name, positions, cfg, arp) {
    const frets = new Array(cfg.stringCount).fill(-1), fingers = new Array(cfg.stringCount).fill(-1);
    for (const p of positions) {
      if (!p || p.s < 0 || p.s >= cfg.stringCount) continue;
      if (frets[p.s] === -1 || p.f < frets[p.s]) frets[p.s] = p.f;
    }
    const distinctFrets = [...new Set(frets.filter(f => f > 0))].sort((a, b) => a - b);
    const fretToFinger = new Map();
    distinctFrets.forEach((f, idx) => fretToFinger.set(f, Math.min(4, idx + 1)));
    for (let s = 0; s < cfg.stringCount; s++) {
      if (frets[s] === -1) continue;
      fingers[s] = frets[s] === 0 ? 0 : fretToFinger.get(frets[s]);
    }
    return { name, displayName:name, arp:!!arp, fingers, frets };
  }

  // ===========================================================================
  // §6 · VOICING ENGINE
  // ===========================================================================
  // --- Voicing engine (docs/musicality-guardrails.md Layer 2) ----------------
  // Classify each chord-tone pitch class (mod 12) into a role + inclusion rank
  // (lower = kept first). Context resolves ambiguity: a minor 3rd is a ♯9 when a
  // major 3rd is also present; the ♭5/♯5 vs ♯11/♭13 split depends on the natural 5th;
  // the natural 11 is a low-priority avoid-note on major/dominant chords but a kept
  // colour on minor chords; the plain 5th is mandatory only when there is no 7th.
  function classifyChordTones(intervals) {
    const pcs = new Set(intervals.map(i => ((i % 12) + 12) % 12));
    const M3 = pcs.has(4), m3 = pcs.has(3), P5 = pcs.has(7);
    const seventh = pcs.has(11) ? 11 : pcs.has(10) ? 10 : (pcs.has(9) && m3 && pcs.has(6)) ? 9 : null;
    const roles = [];
    for (const pc of pcs) {
      let kind, rank;
      switch (pc) {
        case 0:  kind = 'root'; rank = 0; break;
        case 4:  kind = '3rd';  rank = 1; break;
        case 3:  if (M3) { kind = '#9'; rank = 3; } else { kind = '3rd'; rank = 1; } break;
        case 11: kind = '7th';  rank = 1; break;
        case 10: kind = '7th';  rank = 1; break;
        case 9:  if (pc === seventh) { kind = 'dim7'; rank = 1; } else { kind = '13'; rank = 3; } break;
        case 7:  kind = '5th';  rank = seventh === null ? 1 : 5; break;  // complete the triad only when there's no 7th
        case 6:  if (P5) { kind = '#11'; rank = 3; } else { kind = 'b5'; rank = 2; } break;
        case 8:  if (P5) { kind = 'b13'; rank = 3; } else { kind = '#5'; rank = 2; } break;
        case 2:  kind = '9';   rank = 4; break;
        case 1:  kind = 'b9';  rank = 3; break;
        case 5:  kind = '11';  rank = M3 ? 90 : 3; break;   // avoid-note on major/dominant; consonant on minor
        default: kind = 'other'; rank = 6;
      }
      roles.push({ pc, kind, rank });
    }
    return roles;
  }
  // Turn a chord (root pc + tertian interval stack) into a good-sounding block
  // voicing: keep guide tones, drop the avoid-note 11 on major/dominant chords,
  // keep the top colour tension, avoid muddy low clusters, tensions on top.
  // Block/backing only — arpeggios sweep all tones elsewhere.
  const VOICE_ORDER = { '3rd':0, 'b5':1, '5th':1, '#5':1, '7th':2, 'dim7':2, 'b9':3, '9':3, '#9':3, '11':4, '#11':4, '13':5, 'b13':5 };
  function voiceChord(rootPc, intervals, opts) {
    const o = opts || {};
    const maxVoices = o.maxVoices || 4;
    const bassLow = o.bassLow ?? 36, bassHigh = o.bassHigh ?? 48;
    const upperHigh = o.upperHigh ?? 74;
    // Hard-drop the natural 11 when a major 3rd is present (rank 90 sentinel).
    const roles = classifyChordTones(intervals).filter(r => r.rank < 90);
    // Mandatory guide tones (rank ≤ 1) always kept; fill remaining slots by rank.
    const mandatory = roles.filter(r => r.rank <= 1);
    const optional = roles.filter(r => r.rank > 1).sort((a, b) => a.rank - b.rank);
    const keep = mandatory.slice();
    for (const r of optional) { if (keep.length >= maxVoices) break; keep.push(r); }
    // Bass = root, folded into the bass window.
    let bass = ((rootPc % 12) + 12) % 12;
    while (bass < bassLow) bass += 12;
    while (bass > bassHigh) bass -= 12;
    const out = [bass];
    // Upper voices: core (3rd/5th/7th) low, tensions high — placed ascending so
    // colour tones naturally land on top; min gap in the low region kills mud.
    const upper = keep.filter(r => r.kind !== 'root').sort((a, b) => (VOICE_ORDER[a.kind] ?? 9) - (VOICE_ORDER[b.kind] ?? 9));
    // The FIRST upper voice is register-anchored near a centre (~G3) so major and
    // minor chords sit in the SAME register — a minor 3rd no longer folds an octave
    // above a major 3rd. A bass→upper MINIMUM GAP (not a fixed floor) keeps
    // consistent clearance regardless of root and kills low-register mud.
    const minBassGap = o.instrument === 'bass' ? 14 : 10;
    const CENTER = 55; // ~G3
    let cursor = bass + minBassGap, first = true;
    for (const r of upper) {
      // r.pc is the interval ABOVE THE ROOT (0..11); the actual pitch class is
      // rootPc + that interval. (Placing the bare interval put every non-C-rooted
      // chord's upper voices on the wrong pitches — correct bass, wrong triad.)
      const apc = (((rootPc + r.pc) % 12) + 12) % 12;
      let midi;
      if (first) {
        midi = apc; while (midi < CENTER - 6) midi += 12; while (midi > CENTER + 6) midi -= 12; // pc in the octave nearest the centre
        while (midi < cursor) midi += 12;                                                        // but never inside the bass gap
        first = false;
      } else {
        midi = cursor + ((((apc - cursor) % 12) + 12) % 12);   // lowest pc ≥ cursor
      }
      if (midi > upperHigh) midi -= 12;
      if (!out.includes(midi)) out.push(midi);
      cursor = midi + (midi < 67 ? 3 : 2);   // inter-voice min gap: ≥3 below ~G4, ≥2 above (anti-cluster)
    }
    return out.sort((a, b) => a - b);
  }
  function voiceBackingChord(rootPc, intervals, instrument) {
    const bassWin = instrument === 'bass' ? { bassLow: 23, bassHigh: 40 } : { bassLow: 36, bassHigh: 48 };
    // Register (mud + minor-chord octave consistency) is handled inside voiceChord
    // by the register-anchor + bass-gap, so no upperLow floor here.
    return voiceChord(rootPc, intervals, Object.assign({ instrument, maxVoices: 4, upperHigh: 74 }, bassWin));
  }
  // Place a pitch class (0..11) at or above a floor MIDI.
  function pcAtOrAbove(pc, floor) { let m = ((pc % 12) + 12) % 12; while (m < floor) m += 12; return m; }

  // Chord-tone + guide-tone pitch classes for a chord, for the Jam target-highlight.
  // cpcs = all chord tones; gpcs = the guide tones (3rd + 7th — the chord's identity).
  function chordHighlightPcs(rootPc, intervals) {
    const ivset = intervals.map(i => ((i % 12) + 12) % 12);
    const cpcs = Array.from(new Set(ivset.map(iv => (rootPc + iv) % 12)));
    const third = ivset.includes(4) ? 4 : ivset.includes(3) ? 3 : null;
    const sev = ivset.includes(10) ? 10 : ivset.includes(11) ? 11 : null;
    const gpcs = [third, sev].filter(x => x != null).map(iv => (rootPc + iv) % 12);
    return { cpcs, gpcs };
  }
  function buildBackingEvents(cfg, duration) {
    if (cfg.backingStyle === 'boogie') return buildBoogieBacking(cfg, duration);
    const degrees = progressionDegreesForConfig(cfg);
    const slot = measureSeconds(cfg);
    const events = [];
    for (let t = 0, i = 0; t < duration - 0.001; t += slot, i++) {
      const degree = degrees[i % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
      const name = chordName(rootPc, quality);
      const midis = voiceBackingChord(rootPc, formula.intervals, cfg.instrument);
      const end = Number(Math.min(duration, t + slot).toFixed(6));
      // Chord-tone + guide-tone pitch classes for the Jam target-highlight (teaching
      // mirror — lights which neck notes are chord/guide tones for the current chord).
      const { cpcs, gpcs } = chordHighlightPcs(rootPc, formula.intervals);
      // Coalesce consecutive identical chords into one sustained event so the pad
      // doesn't hard re-attack every bar (the "pumping" on held harmony).
      const prev = events[events.length - 1];
      if (prev && prev.name === name && prev.midis.length === midis.length && prev.midis.every((m, k) => m === midis[k])) {
        prev.end = end;
      } else {
        events.push({ t:Number(t.toFixed(6)), end, name, midis, cpcs, gpcs });
      }
    }
    return events;
  }
  // Boogie/shuffle backing (blues-idiom + harmony-theory-architect review). Instead
  // of one sustained pad per bar, walk a root-5-6-♭7 bass figure on the beats and
  // stab a rootless dom9 shell (3rd / ♭7 / 9th) on the off-beats — the classic
  // blues shuffle comp. The off-beat stabs swing late once applySwingToBundle runs,
  // giving the triplet feel. Re-articulated, NOT coalesced — movement is the point.
  function buildBoogieBacking(cfg, duration) {
    const degrees = progressionDegreesForConfig(cfg);
    const slot = measureSeconds(cfg);
    const beatsPerBar = Math.max(1, cfg.meter.numerator);
    const beatSec = slot / beatsPerBar;
    const bassLow = cfg.instrument === 'bass' ? 24 : 36, bassHigh = cfg.instrument === 'bass' ? 38 : 48;
    const upperLow = cfg.instrument === 'bass' ? 50 : 58, upperHigh = 72;
    const BOOGIE = [0, 7, 9, 10]; // root, 5th, 6th, ♭7 — the walking boogie figure
    const events = [];
    for (let bar = 0, t = 0; t < duration - 0.001; bar++, t += slot) {
      const degree = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
      const name = chordName(rootPc, quality);
      const { cpcs, gpcs } = chordHighlightPcs(rootPc, formula.intervals);   // Jam highlight
      const ivset = formula.intervals.map(i => ((i % 12) + 12) % 12);
      // Rootless shell: guide tones (3rd + 7th) + the 9th colour. Falls back to the
      // full voiced pad when the chord has no clear 3rd/7th (e.g. a power chord).
      const third = ivset.includes(4) ? 4 : ivset.includes(3) ? 3 : null;
      const sev = ivset.includes(10) ? 10 : ivset.includes(11) ? 11 : null;
      let shell;
      if (third != null && sev != null) {
        shell = []; let cur = upperLow;
        for (const iv of [third, sev, 14]) {
          let m = pcAtOrAbove((rootPc + iv) % 12, cur);
          if (m > upperHigh) m -= 12;
          shell.push(m); cur = m + 2;
        }
        shell.sort((a, b) => a - b);
      } else {
        shell = voiceBackingChord(rootPc, formula.intervals, cfg.instrument);
      }
      const bassRoot = pcAtOrAbove(rootPc % 12, bassLow);
      const root0 = bassRoot > bassHigh ? bassRoot - 12 : bassRoot;
      for (let b = 0; b < beatsPerBar; b++) {
        const beatT = t + b * beatSec;
        if (beatT >= duration - 1e-4) break;
        const bassMidi = root0 + BOOGIE[b % BOOGIE.length];
        // Walking bass on the beat (only the bar's downbeat carries the chord name,
        // so the in-tree backing overlay shows one label per bar, not per hit).
        // role:'bass' routes it to the sampled bass voice / 'bass' bus, distinct
        // from the harmony shell — so the boogie walks like a bass, not an organ.
        events.push({ t:Number(beatT.toFixed(6)), end:Number(Math.min(duration, beatT + beatSec * 0.9).toFixed(6)), name: b === 0 ? name : '', midis:[bassMidi], role:'bass', cpcs, gpcs });
        // Chord-shell chick on the off-beat (the swung "and").
        const upT = beatT + beatSec * 0.5;
        if (upT < duration - 1e-4) events.push({ t:Number(upT.toFixed(6)), end:Number(Math.min(duration, upT + beatSec * 0.4).toFixed(6)), name:'', midis:shell, cpcs, gpcs });
      }
    }
    return events;
  }

  // ── Drum grooves (audio-realism Phase D) ────────────────────────────────────
  // A groove is a declarative per-voice lane cell on a subdivision grid. `div` =
  // steps per beat (2=8ths, 3=triplets, 4=16ths). Each lane is a token string of
  // length stepsPerBar (numerator*div): 'a'=accent, 'n'=normal, 'g'=ghost,
  // '.'/'0'=rest. Pre-swung triplet cells (shuffle/jazz) set `preSwung` so
  // applySwingToBundle skips them (no double-swing); straight cells (div=2) ride
  // the global swing warp. buildDrumEvents tiles the cell across the content
  // length using the same beat math buildBeats uses. Fills are a Phase D5 concern.
  const DRUM_VELOCITY = { a: 0.95, n: 0.78, g: 0.32 };
  const DRUM_GROOVES = {
    // 8-step (4/4 ·div2) backbeat: kick 1+3, snare 2+4, straight 8th hats.
    straight_8th_rock: { div: 2, preSwung: false, lanes: {
      kick:      'n...n...',
      snare:     '..a...a.',
      hatClosed: 'nnnnnnnn',
    } },
    // Disco/dance: four-on-the-floor kick, backbeat snare, open hat on every "&"
    // (choked by the next closed hat — the genre-defining sizzle).
    four_on_floor: { div: 2, preSwung: false, lanes: {
      kick:      'n.n.n.n.',
      snare:     '..a...a.',
      hatClosed: 'n.n.n.n.',
      hatOpen:   '.n.n.n.n',
    } },
    // Half-time: backbeat moves to beat 3 only, lots of space.
    half_time: { div: 2, preSwung: false, lanes: {
      kick:      'n....n..',
      snare:     '....a...',
      hatClosed: 'nnnnnnnn',
    } },
    // 12-step (4/4 ·div3) triplet shuffle, authored pre-swung: hats play the
    // "spang" skip (downbeat + last triplet), kick 1+3, snare 2+4.
    shuffle_blues: { div: 3, preSwung: true, lanes: {
      kick:      'n.....n.....',
      snare:     '...a.....a..',
      hatClosed: 'n.nn.nn.nn.n',
    } },
  };
  // Resolve which groove a config plays. Shuffle feel → the triplet shuffle;
  // everything else → the straight backbeat. (four_on_floor / half_time are wired
  // and reachable via an explicit cfg.groove or a future electronic palette.)
  function resolveGroove(cfg) {
    if (cfg.groove && DRUM_GROOVES[cfg.groove]) return cfg.groove;
    if (cfg.swing === 'shuffle') return 'shuffle_blues';
    return 'straight_8th_rock';
  }
  // Emit role:'drums' backing events for [0, duration). Pitch-less: each event is
  // a kit-piece `voice` + time + structural `velocity` (+ accent/ghost flags +
  // a `noSwing` flag for pre-swung cells). Concatenated into backingEvents in
  // makeBundle BEFORE the count-in shift + swing, so drums get count-in silence
  // and the global swing warp for free. Open hats are choked to the next hat.
  // Open-hat choke: an open hat rings only until the next hat (closed or open).
  function chokeOpenHats(events) {
    const hats = events.filter(e => e.voice === 'hatOpen' || e.voice === 'hatClosed').sort((a, b) => a.t - b.t);
    for (let i = 0; i < hats.length; i++) {
      if (hats[i].voice !== 'hatOpen') continue;
      const next = hats[i + 1];
      if (next) hats[i].dur = Math.max(0.04, +(next.t - hats[i].t - 0.005).toFixed(6));
    }
    return events;
  }
  function buildDrumEvents(cfg, duration, grooveId) {
    if (!(duration > 0)) return [];
    const groove = DRUM_GROOVES[grooveId];
    const numer = Math.max(1, cfg.meter.numerator), denom = cfg.meter.denominator;
    const div = groove ? Math.max(1, groove.div) : 2, stepsPerBar = numer * div;
    const cellLen = groove ? Math.max(...Object.values(groove.lanes).map(s => s.length)) : 0;
    // The authored cells are written for one meter (default 4/4). For any OTHER meter
    // (odd/changing — out of authored-cell v1 scope per ROADMAP) we must NOT wrap a
    // 4/4 cell across the bar; degrade to a grouping-based generic keep instead.
    const fits = groove && (groove.sig || '4/4') === (numer + '/' + denom) && cellLen === stepsPerBar;
    if (!fits) return chokeOpenHats(buildGenericDrumGroove(cfg, duration));
    const beatSec = (60 / cfg.bpm) * (4 / denom), stepSec = beatSec / div;
    const voices = Object.keys(groove.lanes);
    const events = [];
    for (let barStart = 0; barStart < duration - 1e-4; barStart += stepsPerBar * stepSec) {
      for (const voice of voices) {
        const pat = groove.lanes[voice];
        for (let s = 0; s < stepsPerBar; s++) {
          const tok = pat[s] || '.';
          if (tok === '.' || tok === '0') continue;
          const t = barStart + s * stepSec;
          if (t >= duration - 1e-4) break;
          events.push({ t: +t.toFixed(6), end: +(t + 0.1).toFixed(6), role: 'drums', voice,
            velocity: DRUM_VELOCITY[tok] ?? 0.78, accent: tok === 'a', ghost: tok === 'g',
            noSwing: !!groove.preSwung });
        }
      }
    }
    return chokeOpenHats(events);
  }
  // Meter-agnostic generic time-keep for any meter the authored cells don't cover.
  // Kick on the group-starts (the felt pulse — 7/8 = 2+2+3 kicks at beats 0,2), snare
  // on the last group-start (a backbeat-ish accent), closed hat on every beat. Never
  // crams a 4/4 cell into an odd bar, and follows cfg.meter.grouping so 7/8 limps as
  // 2+2+3 rather than a square 4. Not pre-swung, so a global swing still applies.
  function buildGenericDrumGroove(cfg, duration) {
    const numer = Math.max(1, cfg.meter.numerator);
    const beatSec = (60 / cfg.bpm) * (4 / cfg.meter.denominator);
    const grouping = (cfg.meter.grouping && cfg.meter.grouping.length) ? cfg.meter.grouping : [numer];
    const groupStarts = []; { let g = 0; for (const w of grouping) { if (g < numer) groupStarts.push(g); g += w; } }
    let kickBeats, snareBeats;
    if (groupStarts.length >= 2) { kickBeats = new Set(groupStarts.slice(0, -1)); snareBeats = new Set([groupStarts[groupStarts.length - 1]]); }
    else { kickBeats = new Set([0]); snareBeats = new Set([Math.floor(numer / 2)]); }
    const barSec = numer * beatSec, events = [];
    for (let barStart = 0; barStart < duration - 1e-4; barStart += barSec) {
      for (let i = 0; i < numer; i++) {
        const t = barStart + i * beatSec;
        if (t >= duration - 1e-4) break;
        const mk = (voice, vel, accent) => events.push({ t:+t.toFixed(6), end:+(t + 0.1).toFixed(6), role:'drums', voice, velocity:vel, accent:!!accent, ghost:false, noSwing:false });
        mk('hatClosed', DRUM_VELOCITY.n, false);
        if (kickBeats.has(i)) mk('kick', i === 0 ? DRUM_VELOCITY.a : DRUM_VELOCITY.n, i === 0);
        if (snareBeats.has(i)) mk('snare', DRUM_VELOCITY.a, true);
      }
    }
    return events;
  }

  function chordScalePositions(cfg, rootPc, quality) {
    const scaleName = (CHORD_FORMULAS[quality] && CHORD_FORMULAS[quality].mode) || MODE_FOR_QUALITY[quality] || 'major';
    const intervals = SCALE_INTERVALS[scaleName] || SCALE_INTERVALS.major;
    const pcs = new Set(intervals.map(i => (rootPc + i) % 12));
    const opens = openMidisForConfig(cfg);
    // One position per pitch (prefer the lower fret) so a chord-scale RUN never
    // re-sounds the same pitch on two strings — the no-unison rule, matching the
    // CAGED/Open resolvers. (This previously kept every duplicate, which let
    // Connect lines re-finger an identical pitch across adjacent strings.)
    const byMidi = new Map();
    for (let s = 0; s < cfg.stringCount; s++) for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
      const midi = opens[s] + f, pc = midi % 12;
      if (!pcs.has(pc)) continue;
      const e = byMidi.get(midi);
      if (!e || f < e.f) byMidi.set(midi, { s, f, midi, pc });
    }
    return [...byMidi.values()].sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
  }

  // ===========================================================================
  // §7 · EXERCISE BUILDERS
  // each returns an { exercise } object (see docs/exercise-schema.md).
  // ===========================================================================
  function buildChordScaleExercise(cfg) {
    const degrees = progressionDegreesForConfig(cfg);
    const mLen = measureSeconds(cfg), step = secondsPerDivision(cfg);
    const totalBars = Math.max(1, cfg.bars), duration = totalBars * mLen;
    const notesPerBar = Math.max(1, Math.round(mLen / step));
    const strategy = cfg.chordScaleStrategy || 'mode_of_moment';
    const isPark = strategy === 'chord_tone_emphasis';            // one parent scale, accent chord tones
    const useEnclosure = strategy === 'mode_of_moment_enclose';   // Connect + a bebop enclosure into each change
    const keyParent = isPark ? scalePositionsForSystem(cfg) : null;
    const notes = [], chordTemplates = [], chords = [], handShapes = [], sections = [];
    const barStarts = []; // notes[] index of each emitted bar's first (downbeat) note — used by the enclosure post-pass
    let cursor = 0;
    let prevMidi = null; // last note's pitch — threads voice-leading across the changes (Connect)
    // Connect: choose where the new chord's run STARTS so the line resolves INTO
    // the chord instead of restarting on its root. Prefer the nearest 3rd/7th
    // (guide tone) to the previous note, then nearest chord tone, then nearest
    // scale note; the first bar (no previous note) opens on the root. Ties prefer
    // the lower fret (stay in a comfortable hand position) — mirrors
    // nearestPositionForPc, the voice-leading primitive used by guide tones.
    function connectStartIdx(path, prev, guidePcs, chordPcs, rootPc) {
      if (prev == null) { for (let k = 0; k < path.length; k++) if (path[k].pc === rootPc) return k; return 0; }
      const nearest = (test) => {
        let bestK = -1, bestD = Infinity, bestF = Infinity;
        for (let k = 0; k < path.length; k++) {
          const p = path[k];
          if (p.midi == null || !test(p)) continue;
          const d = Math.abs(p.midi - prev);
          if (d < bestD || (d === bestD && p.f < bestF)) { bestK = k; bestD = d; bestF = p.f; }
        }
        return bestK;
      };
      let k = nearest(p => guidePcs.has(p.pc));
      if (k < 0) k = nearest(p => chordPcs.has(p.pc));
      if (k < 0) k = nearest(() => true);
      return k < 0 ? 0 : k;
    }
    // Bebop enclosure: lead INTO each change by rewriting the two notes before the
    // downbeat target as its chromatic upper + lower neighbours (above, below,
    // target) on the target's own string — the canonical bebop approach, and
    // maximally playable (one finger steps around the target). Needs ≥3 notes/bar
    // and the target off the nut/top fret; skipped otherwise. The neighbours are
    // intentionally chromatic (out-of-scale) — that's the device.
    function addEnclosures() {
      if (notesPerBar < 3) return;
      const opens = openMidisForConfig(cfg);
      const midiOf = (n) => opens[n.s] + n.f;
      for (let b = 1; b < barStarts.length; b++) {
        const tIdx = barStarts[b], target = notes[tIdx];
        if (!target || target.f < 1 || target.f > 23) continue;
        const above = tIdx - 2, below = tIdx - 1;
        if (above < barStarts[b - 1]) continue; // both neighbours must belong to the previous bar
        // Avoid a cross-string unison: if the chromatic upper neighbour would just
        // re-sound the note feeding into it (same pitch, different string, back to
        // back — a pointless re-fingering), skip the enclosure here and leave the
        // bar as plain Connect. (guitar-pedagogy spot-check, 2026-06-01.)
        const feed = notes[above - 1];
        if (feed && above - 1 >= barStarts[b - 1] && feed.s !== target.s && midiOf(feed) === opens[target.s] + target.f + 1) continue;
        notes[below].s = target.s; notes[below].f = target.f - 1; // chromatic lower neighbour
        notes[above].s = target.s; notes[above].f = target.f + 1; // chromatic upper neighbour
      }
    }
    for (let bar = 0; bar < totalBars; bar++) {
      const degree = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      const positions = isPark ? keyParent : chordScalePositions(cfg, rootPc, quality);
      if (!positions || !positions.length) continue;
      const sequenced = applySequencePattern(positions, cfg.sequence);
      const path = directedPath(sequenced, cfg.direction, cfg.repeatCount);
      if (!path.length) continue;
      const barStart = bar * mLen;
      const name = chordName(rootPc, quality), templateId = chordTemplates.length;
      const tones = chordTonePositionsInPosition(cfg, rootPc, quality);
      const displayTones = tones.length ? tones : pickChordPositions(cfg, rootPc, quality);
      const formula = (CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj).intervals;
      const chordPcs = new Set(formula.map(iv => (rootPc + iv) % 12));
      // Guide tones (3rd + 7th) define the chord's quality and are the natural
      // resolution targets when the harmony moves — Connect lands the change here.
      const guidePcs = new Set([
        (rootPc + (formula[1] ?? formula[0])) % 12,
        (rootPc + (formula.length >= 4 ? formula[3] : (formula[2] ?? formula[1] ?? formula[0]))) % 12,
      ]);
      chordTemplates.push(templateFromPositions(name, displayTones, cfg, false));
      chords.push({ t:Number(barStart.toFixed(6)), id:templateId, hd:false, notes:displayTones.map(p => noteDefaults({ s:p.s, f:p.f, sus:0 })) });
      handShapes.push({ chord_id:templateId, start_time:Number(barStart.toFixed(6)), end_time:Number((barStart + mLen).toFixed(6)), arp:false });
      sections.push({ name, number:templateId + 1, time:Number(barStart.toFixed(6)) });
      // PARK (chord_tone_emphasis) walks one parent scale continuously (cursor).
      // CONNECT (scale-follows-chord) voice-leads: start the new chord's run on the
      // guide tone nearest the previous note, then continue — no more root-restart.
      let startIdx;
      if (isPark) startIdx = cursor;
      else startIdx = connectStartIdx(path, prevMidi, guidePcs, chordPcs, rootPc);
      let lastMidi = prevMidi;
      barStarts.push(notes.length); // index of this bar's downbeat note (for the enclosure post-pass)
      for (let i = 0; i < notesPerBar; i++) {
        // Reflect (bounce at the box edges) rather than wrap (teleport top→bottom)
        // — keeps the run stepwise when notesPerBar exceeds the box or the entry
        // point is mid-box. Pre-existing leap fixed for both Park and Connect.
        const p = path[reflectIdx(startIdx + i, path.length)];
        const onBeat = i % Math.max(1, cfg.meter.numerator) === 0;
        const isTarget = !isPark && i === 0 && guidePcs.has(p.pc); // the resolved guide tone on the change
        const isChordTone = isPark && chordPcs.has(p.pc);
        notes.push(noteDefaults({ t:Number((barStart + i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.78), ac:onBeat || isChordTone || isTarget }));
        if (p.midi != null) lastMidi = p.midi;
      }
      if (isPark) cursor += notesPerBar;
      else prevMidi = lastMidi;
    }
    if (useEnclosure) addEnclosures();
    return { notes, chords, chordTemplates, handShapes, sections:sections.length ? sections : [{ name:'chord-scales', number:1, time:0 }], duration };
  }

  function buildScaleExercise(cfg) {
    const positions = scalePositionsForSystem(cfg);
    if (!positions.length) throw new Error('No scale notes found inside this fret range.');
    const sequenced = applySequencePattern(positions, cfg.sequence);
    const step = secondsPerDivision(cfg), steps = rhythmSteps(cfg), mLen = measureSeconds(cfg), minDuration = cfg.bars * mLen;
    const avgStep = steps ? steps.reduce((a, b) => a + b, 0) / steps.length : step;
    const path = directedPath(sequenced, cfg.direction, cfg.repeatCount);
    const rawDuration = Math.max(minDuration, path.length * avgStep);
    const duration = Math.ceil(rawDuration / mLen - 1e-6) * mLen;
    // Cumulative clock so non-uniform rhythms (gallop) work; when `steps` is null
    // each tick is the uniform `step`, identical to the old i*step placement.
    const notes = [];
    let t = 0, i = 0;
    while (t < duration - 0.001) {
      const p = path[i % path.length];
      const sd = steps ? steps[i % steps.length] : step;
      notes.push(noteDefaults({ t:Number(t.toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, sd * 0.78), ac:i % Math.max(1, cfg.meter.numerator) === 0 }));
      t += sd; i++;
    }
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections:[{ name:`scale-${cfg.fretboardSystem || 'position'}`, number:1, time:0 }], duration };
  }

  function sweepArpeggioPositions(cfg, rootPc, quality, anchorFret) {
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const intervalPcSet = new Set(formula.intervals.map(iv => (rootPc + iv) % 12));
    const opens = openMidisForConfig(cfg), out = [];
    const fLo = Math.max(0, cfg.fretMin), fHi = Math.min(24, cfg.fretMax);
    // Contain the sweep window to the top-six on a 7/8-string (off = N-6), so the
    // default extended-range sweep is the canonical top-six grip rather than an
    // all-strings rake rooted on the low B/F# (the extra low string(s) are opt-in
    // range). off=0 on ≤6-string, so bass/6-string sweep every string as before.
    const off = Math.max(0, cfg.stringCount - 6);
    const bassStr = off; // lowest string of the sweep window — the bass anchor
    // Greedy-adjacent selection: the bass string anchors near anchorFret (root
    // preferred); each higher string then picks the chord tone CLOSEST to the
    // previous string's fret. This keeps the shape contiguous (a real sweepable
    // grip) instead of the zig-zags an independent per-string search can produce.
    let prevFret = anchorFret;
    for (let s = off; s < cfg.stringCount; s++) {
      let best = null, bestScore = Infinity;
      const ref = (s === bassStr) ? anchorFret : prevFret;
      for (let f = fLo; f <= fHi; f++) {
        const midi = opens[s] + f, pc = midi % 12;
        if (!intervalPcSet.has(pc)) continue;
        const dist = Math.abs(f - ref);
        // On the bass string, strongly prefer the root to anchor the sweep correctly
        const rootPenalty = (s === bassStr && pc !== rootPc) ? 30 : 0;
        const score = dist + rootPenalty;
        if (score < bestScore) { best = { s, f, midi, pc }; bestScore = score; }
      }
      if (best) { out.push(best); prevFret = best.f; }
    }
    return out;
  }

  function sweepTurnaroundNotes(apexPos, cfg, rootPc, quality) {
    const opens = openMidisForConfig(cfg);
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const intervalPcSet = new Set(formula.intervals.map(iv => (rootPc + iv) % 12));
    // Cap the turnaround reach at +3 frets: a HO/PO to +5 above the apex is an
    // impossible stretch low on the neck (validated by fretboard-pedagogy review).
    for (let f = apexPos.f + 1; f <= Math.min(24, apexPos.f + 3); f++) {
      const pc = (opens[apexPos.s] + f) % 12;
      if (intervalPcSet.has(pc)) {
        return [
          { s:apexPos.s, f, midi:opens[apexPos.s] + f, pc, ho:true },
          { s:apexPos.s, f:apexPos.f, midi:opens[apexPos.s] + apexPos.f, pc:apexPos.pc, po:true }
        ];
      }
    }
    return [];
  }

  function buildSweepPathWithHopo(positions, cfg, rootPc, quality) {
    // SlopScale convention: s=0 is the LOWEST string (low E), s=last is the
    // highest (high e). sweepArpeggioPositions returns them built s=0→s=last,
    // i.e. ALREADY in low-E→high-e (ascending) order — so the ascending sweep
    // is the array as-is, NOT reversed.
    const ascending = positions.slice();          // low E (bass/root) → high e (apex)
    const apexPos = ascending[ascending.length - 1]; // highest string = apex of the sweep
    const turnaround = apexPos ? sweepTurnaroundNotes(apexPos, cfg, rootPc, quality) : [];
    // Descending leg: from the string just below the apex back down to the low E.
    // Skip the apex itself — the HO/PO turnaround already covers it.
    const descending = ascending.slice(0, -1).reverse();
    if (turnaround.length) {
      return [...ascending, ...turnaround, ...descending];
    }
    return [...ascending, ...descending.slice(1)];
  }

  function buildSweepArpeggioExercise(cfg) {
    const degrees = progressionDegreesForConfig(cfg);
    const mLen = measureSeconds(cfg), step = secondsPerDivision(cfg);
    const totalBars = Math.max(1, cfg.bars), duration = totalBars * mLen;
    const anchorFret = Math.floor((cfg.fretMin + cfg.fretMax) / 2);
    // Sweep shapes come from the canonical CAGED chord-tone template when a CAGED
    // shape is active: it's a contiguous one-note-per-string arpeggio box that
    // carries fingering by construction (the standard CAGED arpeggio shapes).
    // pickShapeRootFret walks the chosen shape up/down the neck per chord.
    const shape = cfg.shape || cfg.cagedShape;
    // ≥6 strings: a 7/8-string can host the 6-string CAGED sweep template on its
    // top-six (anchored via `off` in pickShapeRootFret/cagedShapeNotesForChord),
    // so the extended-range sweep keeps by-construction fingering instead of the
    // greedy all-string rake. <6 (bass) → falls to sweepArpeggioPositions.
    const useShape = cfg.stringCount >= 6 && !!CAGED_SHAPES[shape];
    let prevRootFret = null;
    const notes = [], chordTemplates = [], chords = [], handShapes = [], sections = [];
    for (let bar = 0; bar < totalBars; bar++) {
      const degree = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      let positions = null, shapeRootFret = null;
      if (useShape) {
        const rootFret = pickShapeRootFret(cfg, shape, rootPc, prevRootFret, 'closest');
        if (rootFret != null) {
          prevRootFret = rootFret;
          const tmplPos = cagedShapeNotesForChord(cfg, shape, quality, rootFret);
          if (tmplPos && tmplPos.length) { positions = dedupeUnisons(tmplPos); shapeRootFret = rootFret; }
        }
      }
      if (!positions || !positions.length) positions = dedupeUnisons(sweepArpeggioPositions(cfg, rootPc, quality, anchorFret));
      if (!positions.length) continue;
      const path = buildSweepPathWithHopo(positions, cfg, rootPc, quality);
      if (!path.length) continue;
      const barStart = bar * mLen;
      const name = chordName(rootPc, quality), templateId = chordTemplates.length;
      const shapeTmpl = (shapeRootFret != null) ? templateFromShape(name, shape, quality, shapeRootFret, cfg, true) : null;
      chordTemplates.push(shapeTmpl || templateFromPositions(name, positions, cfg, true));
      chords.push({ t:Number(barStart.toFixed(6)), id:templateId, hd:false, notes:positions.map(p => noteDefaults({ s:p.s, f:p.f, sus:0 })) });
      handShapes.push({ chord_id:templateId, start_time:Number(barStart.toFixed(6)), end_time:Number((barStart + mLen).toFixed(6)), arp:true });
      sections.push({ name, number:templateId + 1, time:Number(barStart.toFixed(6)) });
      const limit = Math.min(Math.floor(mLen / step), path.length);
      for (let i = 0; i < limit; i++) {
        const p = path[i];
        notes.push(noteDefaults({ t:Number((barStart + i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.6), ac:i === 0, ho:!!p.ho, po:!!p.po }));
      }
    }
    return { notes, chords, chordTemplates, handShapes, sections:sections.length ? sections : [{ name:'sweep-arpeggios', number:1, time:0 }], duration };
  }

  function buildArpeggioExercise(cfg, degrees) {
    const step = secondsPerDivision(cfg), mLen = measureSeconds(cfg);
    const chordTemplates = [], chords = [], handShapes = [], notes = [], sections = [];
    const isShapeRunStrict = cfg.fretboardSystem === 'caged_shape_run';
    const isShapeRunFollow = cfg.fretboardSystem === 'caged_shape_follow';
    const isShapeRun = isShapeRunStrict || isShapeRunFollow;
    const shapeRunMode = isShapeRunStrict ? 'ascend' : 'closest';
    const shapeRunAnchors = isShapeRun ? [] : null;
    let prevRootFret = null;
    let t = 0;
    degrees.forEach(degree => {
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      let displayPositions = null;
      let chordCfg = cfg;
      let shapeRootFret = null;
      // CAGED single-shape modes: play the literal shape geometry, transposed to this chord's root
      // on the shape's anchor string. Strict mode marches monotonically up the neck; follow mode
      // picks the closest fret to the previous chord (lets the shape go up AND down the neck).
      if (isShapeRun) {
        const rootFret = pickShapeRootFret(cfg, cfg.cagedShape, rootPc, prevRootFret, shapeRunMode);
        if (rootFret != null) {
          prevRootFret = rootFret; // always advance so next chord ascends from the right position
          const shapeNotes = cagedShapeNotesForChord(cfg, cfg.cagedShape, quality, rootFret);
          if (shapeNotes && shapeNotes.length) {
            displayPositions = shapeNotes;
            shapeRootFret = rootFret;
            const winLo = Math.max(0, rootFret - 4);
            const winHi = Math.min(24, rootFret + 4);
            chordCfg = Object.assign({}, cfg, { fretMin:winLo, fretMax:winHi });
            shapeRunAnchors.push({ time:Number(t.toFixed(6)), fret:winLo, width:winHi - winLo + 1 });
          }
        }
      }
      // Fallback for non-shape-run modes, or when a shape template isn't available for this quality
      if (!displayPositions || !displayPositions.length) {
        const positionTones = chordTonePositionsInPosition(chordCfg, rootPc, quality);
        displayPositions = positionTones.length ? positionTones : pickChordPositions(chordCfg, rootPc, quality);
      }
      if (!displayPositions.length) return;
      // No-unison rule: the arpeggio run must not sound the same pitch on two
      // strings (e.g. a fallback resolver picking the same octave twice).
      displayPositions = dedupeUnisons(displayPositions);
      const name = chordName(rootPc, quality), templateId = chordTemplates.length;
      const shapeTemplate = (isShapeRun && shapeRootFret != null)
        ? templateFromShape(name, cfg.cagedShape, quality, shapeRootFret, chordCfg, true)
        : null;
      chordTemplates.push(shapeTemplate || templateFromPositions(name, displayPositions, chordCfg, true));
      chords.push({ t:Number(t.toFixed(6)), id:templateId, hd:false, notes:displayPositions.map(p => noteDefaults({ s:p.s, f:p.f, sus:0 })) });
      sections.push({ name, number:templateId + 1, time:Number(t.toFixed(6)) });
      const path = directedPath(displayPositions, cfg.direction, cfg.repeatCount);
      const chordSlot = Math.max(mLen, path.length * step);
      handShapes.push({ chord_id:templateId, start_time:Number(t.toFixed(6)), end_time:Number((t + chordSlot).toFixed(6)), arp:true });
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        notes.push(noteDefaults({ t:Number((t + i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.72), ac:i === 0 }));
      }
      t += chordSlot;
    });
    const result = { notes, chords, chordTemplates, handShapes, sections:sections.length ? sections : [{ name:'arpeggios', number:1, time:0 }], duration:Math.max(t, cfg.bars * mLen) };
    if (shapeRunAnchors) result.anchors = shapeRunAnchors;
    return result;
  }

  function buildChromaticExercise(cfg) {
    const opens = openMidisForConfig(cfg);
    const stringCount = opens.length;
    const step = secondsPerDivision(cfg);
    const mLen = measureSeconds(cfg);
    const totalTime = cfg.bars * mLen;
    const offsets = CHROMATIC_PATTERNS[cfg.chromaticPattern] || CHROMATIC_PATTERNS['1234'];
    const fretBase = Math.max(0, cfg.fretMin || 1);
    const notes = [];
    const sections = [{ name: `Chromatic ${CHROMATIC_PATTERN_LABELS[cfg.chromaticPattern] || cfg.chromaticPattern}`, number: 1, time: 0 }];

    // Build a repeating unit: one full pass across all strings per direction leg
    // Direction: 'ascending' = low-E to high-E, 'descending' = reverse,
    //            'up_down' = ascending then descending (classic warmup)
    // SlopScale convention: s=0 is the LOWEST string (low E). "Ascending" across
    // strings means low E → high e, i.e. s=0 first, climbing to s=stringCount-1.
    const stringsAsc = Array.from({ length: stringCount }, (_, i) => i); // low E (s=0) first
    const stringsDesc = stringsAsc.slice().reverse();
    let stringOrder;
    if (cfg.direction === 'ascending') stringOrder = stringsAsc;
    else if (cfg.direction === 'descending') stringOrder = stringsDesc;
    else stringOrder = [...stringsAsc, ...stringsDesc]; // up_down

    // Build the repeating event list for one pass through the pattern
    const unit = [];
    for (const s of stringOrder) {
      for (const offset of offsets) {
        unit.push({ s, f: fretBase + offset });
      }
    }

    let t = 0, unitIdx = 0;
    while (t < totalTime - 0.001) {
      const { s, f } = unit[unitIdx % unit.length];
      notes.push(noteDefaults({ t: Number(t.toFixed(6)), s, f, sus: Math.max(0.04, step * 0.85) }));
      t += step;
      unitIdx++;
    }

    const duration = Math.max(t, totalTime);
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections, duration };
  }

  // Guide tones generator — jazz entry-point exercise for any progression.
  // Generates only the 3rd and/or 7th of each chord, voice-led so each note
  // moves by the smallest possible interval to the next chord's guide tone.
  // `cfg.voices`: 'thirds_only' | 'sevenths_only' | 'both_alternating'
  function buildGuideTonesExercise(cfg) {
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const scale = cfg.scale || 'major';
    const scaleInts = SCALE_INTERVALS[scale] || SCALE_INTERVALS.major;
    const chordDepth = cfg.chordDepth || 'seventh';
    const degrees = progressionDegreesForConfig(cfg);
    const voices = cfg.voices || 'thirds_only';
    const mLen = measureSeconds(cfg);
    const openMidis = openMidisForConfig(cfg);
    // Resolve fret range from shape if shape-aware system
    let fMin = cfg.fretMin, fMax = cfg.fretMax;
    if (isShapeAwareSystem(cfg.fretboardSystem) && cfg.shapeNotes && cfg.shapeNotes.length) {
      const fs = cfg.shapeNotes.map(n => n.f);
      fMin = Math.min.apply(null, fs); fMax = Math.max.apply(null, fs);
    }
    // Expand slightly for voice-leading flexibility without leaving the position
    const searchFMin = Math.max(0, fMin - 2);
    const searchFMax = Math.min(24, fMax + 2);

    const notes = [], sections = [];
    sections.push({ name:`Guide tones — ${voices.replace(/_/g,' ')}`, number:1, time:0 });

    // Start in mid-range guitar register (E4 = MIDI 64)
    let prevMidi = 64;
    let useThird = true;
    let t = 0;
    const reps = Math.max(1, Math.round(cfg.bars / Math.max(1, degrees.length)));

    for (let rep = 0; rep < reps; rep++) {
      for (let di = 0; di < degrees.length; di++) {
        const degree = degrees[di];
        const degNum = (degree && typeof degree === 'object') ? degree.deg : degree;
        if (degNum != null && (degNum < 1 || degNum > scaleInts.length)) { t += mLen; continue; }
        const chordRootPc = chordRootForDegree(cfg, degree);   // handles {semis|deg} tokens + minor pinning + tritone sub
        const quality = chordQualityForDegree(cfg.scale, chordDepth, degree, cfg.chordOverride, cfg.progression);
        const formula = CHORD_FORMULAS[quality]?.intervals || [0, 4, 7];
        // 3rd = formula[1], 7th = formula[3] (if present, else fall back to 5th)
        const thirdPc  = (chordRootPc + (formula[1] ?? formula[0])) % 12;
        const seventhPc = formula.length >= 4
          ? (chordRootPc + formula[3]) % 12
          : (chordRootPc + (formula[2] ?? formula[1] ?? formula[0])) % 12;

        let targetPc;
        if (voices === 'thirds_only')   targetPc = thirdPc;
        else if (voices === 'sevenths_only') targetPc = seventhPc;
        else { targetPc = useThird ? thirdPc : seventhPc; useThird = !useThird; }

        const pos = nearestPositionForPc(targetPc, prevMidi, openMidis, searchFMin, searchFMax);
        if (pos) {
          notes.push(noteDefaults({ t:Number(t.toFixed(6)), s:pos.s, f:pos.f, sus:Math.max(0.05, mLen * 0.9), ac:di === 0 && rep === 0 }));
          prevMidi = pos.midi;
        }
        t += mLen;
      }
    }
    const duration = Math.max(t, cfg.bars * mLen);
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections, duration };
  }

  // ── Generator helpers ───────────────────────────────────────────────────────
  // Most pattern generators below build a list of "events" (each at least
  // { s, f }, optionally carrying technique flags), then either play them as-is
  // or mirror them for ascending/descending/up-down practice, then lay them onto
  // the timeline one per subdivision. These two helpers capture that shared tail
  // so each builder only expresses what makes it distinct.

  // Technique flags an event may carry through to its rendered note. Anything
  // not in this list (e.g. midi/pc bookkeeping) is dropped so notes stay clean.
  const SEQ_NOTE_FIELDS = ['ho', 'po', 'vb', 'tr', 'tp', 'bn', 'hm', 'hp', 'pm', 'mt', 'ac', 'sl', 'slu'];

  function orientSeq(events, direction) {
    if (direction === 'descending') return events.slice().reverse();
    if (direction === 'up_down')    return [...events, ...events.slice().reverse()];
    return events;
  }

  // Fill the timeline with `seq`, cycling it, one note per step.
  // opts: { step, steps?, totalTime, sus, name, startAt=0, duration=Math.max(t,totalTime) }
  // `steps` (optional) is a cycling array of per-note durations for non-uniform
  // rhythms (gallop — see rhythmSteps); when absent, the uniform `step` is used.
  function fillNotesFromSeq(seq, opts) {
    const { step, steps, totalTime, sus, name, startAt = 0 } = opts;
    const notes = [], sections = [{ name, number: 1, time: 0 }];
    let t = startAt, idx = 0;
    while (t < totalTime - 0.001) {
      const ev = seq[idx % seq.length];
      const note = { t: Number(t.toFixed(6)), s: ev.s, f: ev.f, sus };
      for (const k of SEQ_NOTE_FIELDS) if (ev[k] !== undefined) note[k] = ev[k];
      notes.push(noteDefaults(note));
      t += (steps && steps.length) ? steps[idx % steps.length] : step; idx++;
    }
    const duration = opts.duration != null ? opts.duration : Math.max(t, totalTime);
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections, duration };
  }

  // Bending drill — cycles scale tones on the highest (thinnest) strings, each
  // note bent from a fret below the target pitch.
  // bn=0.5 (half step) bends 1 semitone; bn=1 (whole step) bends 2 semitones.
  //
  // SlopScale convention: s=0 is the LOWEST (thickest) string. Bends are
  // idiomatic on the thinnest strings, so the practical bending range is the
  // TOP three string indices (e.g. on a 6-string: s=3=G, s=4=B, s=5=high e).
  // Bass strings are far too stiff to bend cleanly, so we never target s=0..2
  // on guitar, and we exclude bass instruments from this drill entirely.
  function buildBendingExercise(cfg) {
    const bendTarget = cfg.bendTarget || 'whole';
    const step = secondsPerDivision(cfg);
    const mLen  = measureSeconds(cfg);
    const totalTime = cfg.bars * mLen;
    if (cfg.instrument === 'bass') throw new Error('Bending drills are a guitar technique — pick a guitar string setup.');
    const allPos = scalePositionsForSystem(cfg);
    // Top three strings (highest indices). On a 6-string that's G, B, high e.
    const topStart = Math.max(0, cfg.stringCount - 3);
    const BEND_STRINGS = new Set();
    for (let s = topStart; s < cfg.stringCount; s++) BEND_STRINGS.add(s);
    let mixToggle = false;
    const events = [];
    for (const pos of allPos) {
      if (!BEND_STRINGS.has(pos.s)) continue;
      let bn;
      if (bendTarget === 'half')       bn = 0.5;
      else if (bendTarget === 'whole') bn = 1;
      else { bn = mixToggle ? 0.5 : 1; mixToggle = !mixToggle; }
      const semitones = bn < 1 ? 1 : 2;    // frets below the target pitch
      const preFret = pos.f - semitones;
      // Need a fretted note to bend: fret >= 1. preFret 0 would be an open
      // string, which has no fret behind it to push — physically impossible.
      if (preFret < 1) continue;
      events.push({ s: pos.s, f: preFret, bn });
    }
    if (!events.length) throw new Error('No bendable notes in this position. Try a higher fret range or CAGED shape.');
    let seq;
    if (cfg.direction === 'descending')    seq = events.slice().reverse();
    else if (cfg.direction === 'up_down')  seq = [...events, ...events.slice().reverse()];
    else                                   seq = events;
    const sus = Math.max(0.2, step * 0.92);
    const bendName = bendTarget === 'half' ? 'Half-step bends' : bendTarget === 'whole' ? 'Whole-step bends' : 'Mixed bends';
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `${bendName} — ${cfg.key} ${cfg.scale}` });
  }

  // ── 20 additional generators ────────────────────────────────────────────────

  function buildLegatoExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const byStr = {};
    for (const p of allPos) (byStr[p.s] || (byStr[p.s] = [])).push(p);
    // SlopScale convention: s=0 is the LOWEST string (low E). An ascending legato
    // run climbs low E → high e (s=0 → s=last), low fret → high fret per string,
    // hammering on after the first note on each string.
    const strAsc = Object.keys(byStr).map(Number).sort((a, b) => a - b);
    const asc = [], desc = [];
    for (const s of strAsc) {
      byStr[s].sort((a, b) => a.f - b.f).forEach((n, i) => asc.push({ s: n.s, f: n.f, ho: i > 0, po: false }));
    }
    for (const s of strAsc.slice().reverse()) {
      byStr[s].sort((a, b) => b.f - a.f).forEach((n, i) => desc.push({ s: n.s, f: n.f, ho: false, po: i > 0 }));
    }
    const seq = cfg.direction === 'ascending' ? asc : cfg.direction === 'descending' ? desc : [...asc, ...desc];
    const sus = Math.max(0.05, step * 0.9);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Legato runs — ${cfg.key} ${cfg.scale}` });
  }

  function buildVibratoExercise(cfg) {
    const mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const sorted = allPos.slice().sort((a, b) => a.midi - b.midi);
    const seq = orientSeq(sorted.map(p => ({ s: p.s, f: p.f, vb: true })), cfg.direction);
    const noteStep = mLen / 2, sus = Math.max(0.4, noteStep - 0.08);
    return fillNotesFromSeq(seq, { step: noteStep, totalTime, sus, name: `Vibrato — ${cfg.key} ${cfg.scale}` });
  }

  // Build a "scale in <interval>" run. For each scale tone (lower voice) we pair
  // it with the scale tone that sits the requested harmonic interval above it.
  //
  // The old implementation stepped by a fixed array index (+2 for a third, +5
  // for a sixth). That is only correct for a 7-note diatonic scale: in a 5-note
  // pentatonic, +2 indices is a 4th and +5 indices is an octave. We instead pick
  // the partner by *pitch* — the scale tone whose interval above the lower voice
  // is closest to the target semitone distance — so the drill yields real thirds
  // and sixths in any scale (pentatonic, blues, modes, bebop, …).
  //   minSemis/maxSemis bound the acceptable interval so we never label a 4th a
  //   "third"; if no scale tone falls in range above a given lower voice (e.g.
  //   the top of the range), that lower voice is skipped.
  function buildScaleHarmonyRun(cfg, label, targetSemis, minSemis, maxSemis) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const sorted = scalePositionsForSystem(cfg).slice().sort((a, b) => a.midi - b.midi || a.s - b.s);
    if (sorted.length < 2) throw new Error(`Need more scale notes for ${label} — expand fret range.`);
    const pairs = [];
    for (let i = 0; i < sorted.length; i++) {
      const lo = sorted[i];
      // Find the scale tone whose pitch sits closest to targetSemis above `lo`,
      // searching only notes higher than `lo` and within [minSemis, maxSemis].
      let partner = null, bestErr = Infinity;
      for (let j = i + 1; j < sorted.length; j++) {
        const interval = sorted[j].midi - lo.midi;
        if (interval < minSemis) continue;
        if (interval > maxSemis) break; // sorted ascending — no closer match beyond here
        const err = Math.abs(interval - targetSemis);
        if (err < bestErr) { bestErr = err; partner = sorted[j]; }
      }
      if (partner) pairs.push([lo, partner]);
    }
    if (!pairs.length) throw new Error(`No ${label} available in this position — widen the fret range.`);
    // Twin-guitar harmonization (§2.4): the two voices sound TOGETHER (melody +
    // harmony a 3rd/6th above), one dyad per step — the melodeath/melodic-metal
    // signature — instead of walking the dyad notes as a single line.
    if (cfg.harmonize) {
      const step = secondsPerDivision(cfg), steps = rhythmSteps(cfg);
      const seq = cfg.direction === 'descending' ? pairs.slice().reverse()
        : cfg.direction === 'up_down' ? [...pairs, ...pairs.slice().reverse()] : pairs;
      const sus = Math.max(0.05, (steps ? steps[0] : step) * 0.9);
      const tr = !!cfg.tremolo;   // tremolo-picked twin leads — the melodeath signature
      const notes = []; let t = 0, idx = 0;
      while (t < totalTime - 0.001) {
        const [lo, hi] = seq[idx % seq.length];
        notes.push(noteDefaults({ t: Number(t.toFixed(6)), s: lo.s, f: lo.f, sus, tr }));
        notes.push(noteDefaults({ t: Number(t.toFixed(6)), s: hi.s, f: hi.f, sus, tr }));
        t += (steps && steps.length) ? steps[idx % steps.length] : step; idx++;
      }
      return { notes, chords: [], chordTemplates: [], handShapes: [], sections: [{ name: `Harmonized ${label} — ${cfg.key} ${cfg.scale}`, number: 1, time: 0 }], duration: Math.max(t, totalTime) };
    }
    const asc = [];
    for (const [lo, hi] of pairs) { asc.push(lo); asc.push(hi); }
    // In a "run of thirds/sixths" each dyad's upper voice is frequently the next
    // dyad's lower voice (…A-C, C-E…). Played as a single-note line that yields a
    // repeated pitch (…C, C…). A player never re-articulates the same note there,
    // so collapse any immediate same-position repeat into one event.
    const cleaned = asc.filter((p, i) => i === 0 || p.s !== asc[i - 1].s || p.f !== asc[i - 1].f);
    const seq = orientSeq(cleaned, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Scale in ${label} — ${cfg.key} ${cfg.scale}` });
  }

  // Diatonic third ≈ 3–4 semitones (m3/M3). Target 4 (M3) so major-leaning
  // scales prefer the major third where both are available.
  function buildScaleThirdsExercise(cfg) {
    return buildScaleHarmonyRun(cfg, 'thirds', 4, 3, 4);
  }

  // Diatonic sixth ≈ 8–9 semitones (m6/M6). Target 9 (M6).
  function buildScaleSixthsExercise(cfg) {
    return buildScaleHarmonyRun(cfg, 'sixths', 9, 8, 9);
  }

  function buildCallResponseExercise(cfg) {
    const step = secondsPerDivision(cfg), mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const sorted = allPos.slice().sort((a, b) => a.midi - b.midi);
    const seq = cfg.direction === 'descending' ? sorted.slice().reverse()
      : cfg.direction === 'up_down' ? [...sorted, ...sorted.slice().reverse()] : sorted;
    const CALL = 2, CYCLE = 4; // 2 bars call, 2 bars silence
    const sus = Math.max(0.05, step * 0.85);
    const notes = [], sections = [{ name: 'Call', number: 1, time: 0 }, { name: 'Response', number: 2, time: CALL * mLen }];
    let t = 0, noteIdx = 0;
    while (t < totalTime - 0.001) {
      if (Math.floor(t / mLen) % CYCLE < CALL) {
        notes.push(noteDefaults({ t: Number(t.toFixed(6)), s: seq[noteIdx % seq.length].s, f: seq[noteIdx % seq.length].f, sus }));
        noteIdx++;
      }
      t += step;
    }
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections, duration: Math.max(t, totalTime) };
  }

  function buildTremoloPickingExercise(cfg) {
    const step = secondsPerDivision(cfg), mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const sorted = scalePositionsForSystem(cfg).slice().sort((a, b) => a.midi - b.midi);
    if (!sorted.length) throw new Error('No notes in range.');
    const sus = Math.max(0.03, step * 0.9);
    const notes = [], sections = [{ name: `Tremolo picking — ${cfg.key} ${cfg.scale}`, number: 1, time: 0 }];
    let t = 0, posIdx = 0;
    while (t < totalTime - 0.001) {
      const barEnd = Math.min((Math.floor(t / mLen) + 1) * mLen, totalTime);
      const pos = sorted[posIdx % sorted.length];
      for (let mt = t; mt < barEnd - 0.001; mt += step)
        notes.push(noteDefaults({ t: Number(mt.toFixed(6)), s: pos.s, f: pos.f, sus, tr: true }));
      t = barEnd; posIdx++;
    }
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections, duration: Math.max(t, totalTime) };
  }

  function buildTappingExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const allPos = scalePositionsForSystem(cfg);
    const TAP = 12;
    const events = [];
    for (const p of allPos) {
      if (p.f + TAP > 24) continue;
      events.push({ s: p.s, f: p.f, tp: false });
      events.push({ s: p.s, f: p.f + TAP, tp: true });
    }
    if (!events.length) throw new Error('No tapping positions — try fretMin ≤ 12.');
    const sus = Math.max(0.05, step * 0.85);
    return fillNotesFromSeq(events, { step, totalTime, sus, name: `Tapping — ${cfg.key} ${cfg.scale}` });
  }

  function buildPedalPointExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const sorted = allPos.slice().sort((a, b) => a.midi - b.midi);
    const pedal = sorted[0];
    const melody = sorted.filter(p => p.midi > pedal.midi);
    if (!melody.length) throw new Error('Wider pitch range needed for pedal point.');
    const melSeq = cfg.direction === 'descending' ? melody.slice().reverse()
      : cfg.direction === 'up_down' ? [...melody, ...melody.slice().reverse()] : melody;
    const events = [];
    for (const m of melSeq) { events.push(pedal); events.push(m); }
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(events, { step, totalTime, sus, name: `Pedal point — ${cfg.key} ${cfg.scale}` });
  }

  // Pedal-point RIFF (genre-framework §2.3): a palm-muted low pedal (s=0, tonic,
  // open on drop tunings) alternating with power chords higher up — the defining
  // metalcore / djent / melodeath / death-metal riff shape. Power-chord roots walk
  // the configured progression (degrees → root pcs, including chromatic {semis}
  // tokens); the pedal/chord alternation honours the gallop subdivision. Power
  // chords are root+5th+octave on the 4ths-tuned mid strings (s=1/2/3).
  function buildPedalRiffExercise(cfg) {
    const opens = openMidisForConfig(cfg);
    if (opens.length < 4) throw new Error('Pedal-point riff needs at least 4 strings.');
    const step = secondsPerDivision(cfg), steps = rhythmSteps(cfg), mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const pedalFret = (((keyPc - (opens[0] % 12)) % 12) + 12) % 12;   // tonic on the lowest string
    const s1pc = opens[1] % 12;
    const tremolo = !!cfg.tremolo;
    // Power chord rooted on s=1 (above the pedal). `5oct` = root+5th+octave across 3
    // strings (the heavy djent chug); `5` / anything else = root+5th dyad (the tight
    // one-finger shape). s=1/2/3 are perfect 4ths apart in guitar & bass tunings.
    const threeString = cfg.chordOverride === '5oct';
    const powerChord = (rootPc) => {
      const rf = (((rootPc - s1pc) % 12) + 12) % 12;
      const c = [{ s: 1, f: rf }, { s: 2, f: rf + 2 }];
      if (threeString) c.push({ s: 3, f: rf + 2 });
      return c;
    };
    const roots = progressionDegreesForConfig(cfg).map(d => chordRootForDegree(cfg, d));
    // Power chords land on the meter's GROUP STARTS so the polymeter cell lives in
    // the riff itself: 3+3+2 → chords on beats 0,3,6, pedal chugs fill the rest. A
    // trivial grouping (no cell, e.g. plain 4/4) places a chord on every beat — the
    // standard chug. This puts the rhythm in the NOTES, not just the metronome accent.
    const beatLen = (60 / cfg.bpm) * (4 / cfg.meter.denominator);
    const grouping = (cfg.meter.grouping && cfg.meter.grouping.length > 1)
      ? cfg.meter.grouping : Array(Math.max(1, cfg.meter.numerator)).fill(1);
    const groupStartBeats = []; { let g = 0; for (const w of grouping) { groupStartBeats.push(g); g += w; } }
    const chordTimes = [];
    for (let bar = 0; bar * mLen < totalTime - 1e-6; bar++)
      for (const gb of groupStartBeats) { const ct = bar * mLen + gb * beatLen; if (ct < totalTime - 1e-6) chordTimes.push(ct); }
    const sus = Math.max(0.05, step * 0.9);
    const notes = []; let t = 0, idx = 0, chordIdx = 0, ci = 0;
    while (t < totalTime - 0.001) {
      const tt = Number(t.toFixed(6));
      if (ci < chordTimes.length && t >= chordTimes[ci] - 1e-6) {        // group start → power chord
        for (const n of powerChord(roots[chordIdx % roots.length])) notes.push(noteDefaults({ t: tt, s: n.s, f: n.f, sus, tr: tremolo }));
        chordIdx++; ci++;
      } else {
        notes.push(noteDefaults({ t: tt, s: 0, f: pedalFret, sus, pm: true, tr: tremolo }));   // pedal chug between chords
      }
      t += (steps && steps.length) ? steps[idx % steps.length] : step; idx++;
    }
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections: [{ name: `Pedal-point riff — ${cfg.key} ${cfg.scale}`, number: 1, time: 0 }], duration: Math.max(t, totalTime) };
  }

  function buildStringSkippingExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const byStr = {};
    for (const p of allPos) (byStr[p.s] || (byStr[p.s] = [])).push(p);
    const strings = Object.keys(byStr).map(Number).sort((a, b) => a - b);
    // Interleave even-index and odd-index strings — creates visible cross-string jumps
    const events = [];
    for (const grp of [strings.filter(s => s % 2 === 0), strings.filter(s => s % 2 === 1)]) {
      for (const s of grp)
        for (const p of byStr[s].sort((a, b) => a.f - b.f)) events.push(p);
    }
    const seq = orientSeq(events, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `String skipping — ${cfg.key} ${cfg.scale}` });
  }

  function buildPositionShiftExercise(cfg) {
    // Extend the fret range to force a positional shift across a shape boundary
    const wideCfg = Object.assign({}, cfg, { fretboardSystem: 'position', fretMax: (cfg.fretMax || 5) + 7, shapeNotes: null });
    const allPos = scalePositionsForSystem(wideCfg);
    if (!allPos.length) throw new Error('No notes found — try a lower fret range.');
    const sorted = allPos.slice().sort((a, b) => a.midi - b.midi || a.s - b.s);
    const seq = orientSeq(sorted, cfg.direction);
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Position shift — ${cfg.key} ${cfg.scale}` });
  }

  function buildRhythmicDisplacementExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const sorted = allPos.slice().sort((a, b) => a.midi - b.midi);
    const seq = orientSeq(sorted, cfg.direction);
    const offset = 60 / cfg.bpm; // displace by one quarter note
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, startAt: offset, duration: totalTime, name: `Rhythmic displacement — ${cfg.key} ${cfg.scale}` });
  }

  function buildChromaticEnclosuresExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth || 'seventh', 1, cfg.chordOverride, cfg.progression);
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj7;
    const chordPcs = formula.intervals.map(i => (keyPc + i) % 12);
    const opens = openMidisForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = cfg.fretMax || 12;
    const targets = [];
    for (let s = 0; s < opens.length; s++)
      for (let f = fMin + 1; f <= fMax; f++) {
        const midi = opens[s] + f;
        if (chordPcs.includes(((midi % 12) + 12) % 12)) targets.push({ s, f, midi });
      }
    targets.sort((a, b) => a.midi - b.midi);
    if (!targets.length) throw new Error('No chord tones in range for enclosures.');
    // Each target: lower approach (-1 fret), upper approach (+1 fret), resolution.
    // Approach notes are skipped if they'd fall off the neck (≤0 lower bound is
    // guaranteed since targets start at fMin+1; guard the upper edge at fret 24).
    const events = [];
    for (const tgt of targets) {
      if (tgt.f - 1 >= 0)  events.push({ s: tgt.s, f: tgt.f - 1 });
      if (tgt.f + 1 <= 24) events.push({ s: tgt.s, f: tgt.f + 1 });
      events.push({ s: tgt.s, f: tgt.f });
    }
    // One target's resolution often equals the next target's lower approach
    // (e.g. resolve to B, then approach C from B) — collapse the back-to-back
    // identical position so the line doesn't re-pick the same note.
    const cleaned = events.filter((p, i) => i === 0 || p.s !== events[i - 1].s || p.f !== events[i - 1].f);
    const seq = orientSeq(cleaned, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Chromatic enclosures — ${cfg.key}` });
  }

  function buildBebopScaleExercise(cfg) {
    // Use bebop scale variant; chord tones land on downbeats with 8-note chromatic passing tone
    const scaleInts = SCALE_INTERVALS[cfg.scale] || [];
    // A minor 3rd (interval 3) in the source scale means a minor tonality — route
    // to bebop minor (keeps the b3) rather than a major-3rd bebop scale. A dominant
    // context (mixolydian: major 3rd + b7) gets bebop dominant; otherwise bebop major.
    const hasMinorThird = scaleInts.includes(3);
    const hasFlatSeventh = scaleInts.includes(10);
    const bebopScale = (cfg.scale || '').startsWith('bebop_') ? cfg.scale
      : hasMinorThird ? 'bebop_dorian'
      : hasFlatSeventh ? 'bebop_dominant'
      : 'bebop_major';
    const bebopCfg = Object.assign({}, cfg, { scale: bebopScale, sequence: 'none', shapeNotes: null });
    const allPos = scalePositionsForSystem(bebopCfg);
    if (!allPos.length) throw new Error('No bebop scale notes in range.');
    const sorted = allPos.slice().sort((a, b) => a.midi - b.midi || a.s - b.s);
    const seq = orientSeq(sorted, cfg.direction);
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Bebop scale — ${cfg.key} (${bebopScale.replace('_', ' ')})` });
  }

  function buildArpeggioInversionsExercise(cfg) {
    const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth || 'triad', 1, cfg.chordOverride, cfg.progression);
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const take = DEPTH_TONES[cfg.chordDepth] || 3;
    const intervals = formula.intervals.slice(0, take);
    const chordPcs = intervals.map(i => (keyPc + i) % 12);
    const opens = openMidisForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = cfg.fretMax || 12;
    const allTones = [];
    for (let s = 0; s < opens.length; s++)
      for (let f = fMin; f <= fMax; f++) {
        const midi = opens[s] + f, pc = ((midi % 12) + 12) % 12;
        const ci = chordPcs.indexOf(pc);
        if (ci >= 0) allTones.push({ s, f, midi, ci });
      }
    allTones.sort((a, b) => a.midi - b.midi);
    if (!allTones.length) throw new Error('No chord tones in range.');
    // Build clean inversions: each inversion is ONE ascending arpeggio of
    // `intervals.length` notes, stepping through the chord tones in order from
    // a different starting chord-tone each time:
    //   root position : 1-3-5(-7)
    //   1st inversion : 3-5(-7)-1
    //   2nd inversion : 5(-7)-1-3 …
    // For each note we take the next chord tone strictly higher than the
    // previous, so the line climbs through the inversion instead of replaying an
    // overlapping window of the whole chord-tone pool.
    const n = intervals.length;
    const events = [];
    for (let inv = 0; inv < n; inv++) {
      let prevMidi = -1;
      let placed = 0;
      for (let step = 0; step < n; step++) {
        const ci = (inv + step) % n;
        const cand = allTones.find(t => t.ci === ci && t.midi > prevMidi);
        if (!cand) break;
        events.push(cand);
        prevMidi = cand.midi;
        placed++;
      }
      // If an inversion couldn't complete in range, drop its partial fragment so
      // we don't emit a malformed group.
      if (placed < n) events.length -= placed;
    }
    if (!events.length) throw new Error('Could not build inversions in range.');
    const seq = orientSeq(events, cfg.direction);
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Inversions — ${cfg.key} ${quality}` });
  }

  function buildWalkingBassExercise(cfg) {
    const opens = openMidisForConfig(cfg);
    const mLen = measureSeconds(cfg), beatStep = 60 / cfg.bpm;
    const totalTime = cfg.bars * mLen;
    const degrees = progressionDegreesForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = cfg.fretMax || 12;
    const notes = [], sections = [{ name: `Walking bass — ${cfg.key} ${cfg.scale}`, number: 1, time: 0 }];
    let prevMidi = 40, t = 0;
    for (let bar = 0; bar < cfg.bars; bar++) {
      const deg = degrees[bar % degrees.length];
      const nextDeg = degrees[(bar + 1) % degrees.length];
      const rootPc = chordRootForDegree(cfg, deg);
      const nextRootPc = chordRootForDegree(cfg, nextDeg);
      const rootPos = nearestPositionForPc(rootPc, prevMidi, opens, fMin, fMax);
      if (!rootPos) { t += mLen; continue; }
      notes.push(noteDefaults({ t: Number(t.toFixed(6)), s: rootPos.s, f: rootPos.f, sus: beatStep * 0.9, ac: true }));
      // barRootMidi anchors the straight-line walk toward the next root. We
      // interpolate from this FIXED point (not the moving prevMidi) so the line
      // actually travels across the bar instead of stalling on one pitch.
      const barRootMidi = opens[rootPos.s] + rootPos.f;
      prevMidi = barRootMidi;
      // Target octave of next root nearest to the bar's starting root.
      let targetMidi = nextRootPc;
      while (targetMidi < barRootMidi - 6) targetMidi += 12;
      while (targetMidi > barRootMidi + 17) targetMidi -= 12;
      const beatsPerBar = cfg.meter.numerator;
      const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
      const scaleInts = SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major;
      // Candidate scale-tone MIDIs near the line, sorted by distance to a target.
      const scaleToneNear = (approxMidi) => {
        const cands = [];
        for (const iv of scaleInts) {
          const pc = (keyPc + iv) % 12;
          const oct = Math.round((approxMidi - pc) / 12);
          for (const o of [oct - 1, oct, oct + 1]) cands.push(pc + o * 12);
        }
        return [...new Set(cands)].sort((a, b) => Math.abs(a - approxMidi) - Math.abs(b - approxMidi));
      };
      for (let b = 1; b < beatsPerBar; b++) {
        const frac = b / beatsPerBar;
        const approxMidi = Math.round(barRootMidi + (targetMidi - barRootMidi) * frac);
        // Walk to the nearest scale tone to the interpolated point, but never
        // repeat the immediately preceding pitch — a walking line keeps moving.
        // Fall through to the next-nearest tone if the closest equals prevMidi.
        let chosen = null;
        for (const cand of scaleToneNear(approxMidi)) {
          if (cand === prevMidi) continue;
          const pos = nearestPositionForPc(((cand % 12) + 12) % 12, cand, opens, fMin, fMax);
          if (pos && opens[pos.s] + pos.f === cand) { chosen = pos; break; }
          if (pos && !chosen) chosen = pos; // best-effort fallback if exact octave unavailable in range
        }
        if (chosen) {
          notes.push(noteDefaults({ t: Number((t + b * beatStep).toFixed(6)), s: chosen.s, f: chosen.f, sus: beatStep * 0.9 }));
          prevMidi = opens[chosen.s] + chosen.f;
        }
      }
      t += mLen;
    }
    if (!notes.length) throw new Error('No walking bass notes generated.');
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections, duration: Math.max(t, totalTime) };
  }

  function buildHybridPickingExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const allPos = scalePositionsForSystem(cfg);
    if (!allPos.length) throw new Error('No notes in range.');
    const byStr = {};
    for (const p of allPos) (byStr[p.s] || (byStr[p.s] = [])).push(p);
    // SlopScale convention: s=0 is the LOWEST string (low E). Ascending sort puts
    // the low strings first so strings[i] (pick) sits below strings[i+1] (finger pluck).
    const strings = Object.keys(byStr).map(Number).sort((a, b) => a - b); // low E (s=0) first
    // Pair consecutive strings: pick low, pluck high, creating the hybrid pattern
    const events = [];
    for (let i = 0; i + 1 < strings.length; i++) {
      const lo = byStr[strings[i]].sort((a, b) => a.f - b.f);
      const hi = byStr[strings[i + 1]].sort((a, b) => a.f - b.f);
      const len = Math.max(lo.length, hi.length);
      for (let j = 0; j < len; j++) {
        events.push(lo[j % lo.length]);
        events.push(hi[j % hi.length]);
      }
    }
    if (!events.length) throw new Error('Need ≥ 2 strings for hybrid picking.');
    const seq = orientSeq(events, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Hybrid picking — ${cfg.key} ${cfg.scale}` });
  }

  function buildTriadicPairsExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const scaleInts = SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major;
    const opens = openMidisForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = cfg.fretMax || 12;
    // The "triad pair" device (Lydian / Bebop pedagogy) alternates two ADJACENT
    // triads that share NO common tones, so the two triads together spell six
    // distinct scale tones. The I and ii triads do exactly that:
    //   Triad 1 = I  : degrees 1-3-5 (indices 0,2,4)
    //   Triad 2 = ii : degrees 2-4-6 (indices 1,3,5)
    // The previous version paired I (1-3-5) with iii (3-5-7); those share the
    // 3rd and 5th, producing duplicate pitches back-to-back and only four
    // distinct tones — not a real triad pair.
    const t1Pcs = [0, 2, 4].map(i => (keyPc + scaleInts[i % scaleInts.length]) % 12);
    const t2Pcs = [1, 3, 5].map(i => (keyPc + scaleInts[i % scaleInts.length]) % 12);
    function findNotes(pcs) {
      const out = [];
      for (let s = 0; s < opens.length; s++)
        for (let f = fMin; f <= fMax; f++) {
          const pc = ((opens[s] + f) % 12 + 12) % 12;
          if (pcs.includes(pc)) out.push({ s, f, midi: opens[s] + f });
        }
      return out.sort((a, b) => a.midi - b.midi);
    }
    const t1 = findNotes(t1Pcs), t2 = findNotes(t2Pcs);
    if (!t1.length || !t2.length) throw new Error('Not enough chord tones for triadic pairs.');
    // Play triad 1 ascending in full, then triad 2 ascending in full — the
    // idiomatic "run one triad then the next" articulation — guarding against a
    // back-to-back identical physical position at the seam.
    const events = [];
    for (const p of t1) events.push(p);
    for (const p of t2) events.push(p);
    // De-dup any accidental immediate repeat of the same string+fret.
    const deduped = events.filter((p, i) => i === 0 || p.s !== events[i - 1].s || p.f !== events[i - 1].f);
    const seq = orientSeq(deduped, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Triadic pairs — ${cfg.key} ${cfg.scale}` });
  }

  function buildPentatonicSuperExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    // Superimpose minor pentatonic from the b3 above the root — gives Dorian flavor
    const superRoot = (keyPc + 3) % 12;
    const pentInts = SCALE_INTERVALS.minor_pentatonic;
    const superPcs = pentInts.map(i => (superRoot + i) % 12);
    const opens = openMidisForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = cfg.fretMax || 12;
    const positions = [];
    for (let s = 0; s < opens.length; s++)
      for (let f = fMin; f <= fMax; f++) {
        const pc = ((opens[s] + f) % 12 + 12) % 12;
        if (superPcs.includes(pc)) positions.push({ s, f, midi: opens[s] + f });
      }
    if (!positions.length) throw new Error('No superimposed pentatonic notes in range.');
    const sorted = positions.sort((a, b) => a.midi - b.midi);
    const seq = orientSeq(sorted, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    const superName = pcName(superRoot);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Pent. superimposition — ${superName}m over ${cfg.key}` });
  }

  function buildShellVoicingsExercise(cfg) {
    const mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const opens = openMidisForConfig(cfg);
    const degrees = progressionDegreesForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = cfg.fretMax || 12;
    const notes = [], sections = [{ name: `Shell voicings — ${cfg.key}`, number: 1, time: 0 }];
    let prevMidi = 48, t = 0, bar = 0;
    while (t < totalTime - 0.001) {
      const deg = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, deg);
      const quality = chordQualityForDegree(cfg.scale, 'seventh', deg, cfg.chordOverride, cfg.progression);
      const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj7;
      // Shell: root (0), 3rd (index 1), 7th (index 3 or fall back to 5th)
      const shellIdxs = [0, 1, formula.intervals[3] != null ? 3 : 2];
      for (let b = 0; b < 3; b++) {
        const pc = (rootPc + formula.intervals[shellIdxs[b]]) % 12;
        const pos = nearestPositionForPc(pc, prevMidi, opens, fMin, fMax);
        if (pos) {
          const noteT = t + (b / 3) * mLen;
          if (noteT < totalTime)
            notes.push(noteDefaults({ t: Number(noteT.toFixed(6)), s: pos.s, f: pos.f, sus: Math.max(0.1, mLen / 3 * 0.9) }));
          prevMidi = opens[pos.s] + pos.f;
        }
      }
      t += mLen; bar++;
    }
    if (!notes.length) throw new Error('No shell voicing notes generated.');
    return { notes, chords: [], chordTemplates: [], handShapes: [], sections, duration: Math.max(t, totalTime) };
  }

  function buildOctaveDisplacementExercise(cfg) {
    const step = secondsPerDivision(cfg), totalTime = cfg.bars * measureSeconds(cfg);
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const scaleInts = SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major;
    const opens = openMidisForConfig(cfg);
    const fMin = cfg.fretMin || 0, fMax = Math.min(24, (cfg.fretMax || 12) + 12);
    const events = [];
    for (const iv of scaleInts) {
      const pc = (keyPc + iv) % 12;
      const instances = [];
      for (let s = 0; s < opens.length; s++)
        for (let f = fMin; f <= fMax; f++)
          if (((opens[s] + f) % 12 + 12) % 12 === pc) instances.push({ s, f, midi: opens[s] + f });
      instances.sort((a, b) => a.midi - b.midi);
      // Find a pair exactly one octave apart, preferring the cross-string octave
      // with the SMALLEST fret span — the compact octave grip players actually
      // use (e.g. low-E fret 8 + G-string fret 5), not the same-string +12 pair
      // which is a 12-fret leap no one plays. Fall back to a same-string pair
      // only if no cross-string octave exists in range.
      let pair = null, pairSpan = Infinity, sameStringPair = null;
      for (let i = 0; i + 1 < instances.length; i++) {
        for (let j = i + 1; j < instances.length; j++) {
          if (instances[j].midi - instances[i].midi !== 12) continue;
          if (instances[j].s !== instances[i].s) {
            const span = Math.abs(instances[j].f - instances[i].f);
            if (span < pairSpan) { pair = [instances[i], instances[j]]; pairSpan = span; }
          } else if (!sameStringPair) {
            sameStringPair = [instances[i], instances[j]];
          }
        }
      }
      pair = pair || sameStringPair;
      if (pair) { events.push(pair[0]); events.push(pair[1]); }
    }
    if (!events.length) throw new Error('No octave pairs in range — expand fret range.');
    const seq = orientSeq(events, cfg.direction);
    const sus = Math.max(0.05, step * 0.88);
    return fillNotesFromSeq(seq, { step, totalTime, sus, name: `Octave displacement — ${cfg.key} ${cfg.scale}` });
  }

  // ── strum_comp: held voiced chord + strum rhythm/feel ───────────────────────
  // The one new generator from the Workout charette. Pre-build consult (2026-06-02):
  // rhythm-meter (the STRUM_PATTERNS cell model + the down/up micro-stagger),
  // harmony (voice from CAGED grips, NOT the voiceChord pad), guitar-pedagogy
  // (playability + muted-string encoding + bass = n-a). Per-lane specs in
  // .claude/agent-memory/{rhythm-meter-architect,harmony-theory-architect,
  // guitar-pedagogy-expert}/*strum*. It's a RHYTHM-HAND-INDEPENDENCE drill: hold a
  // real fretting-hand GRIP and strike it on a strum pattern; the strum hand never
  // stops (rests = no event, hand keeps the clock).
  //
  // STRUM_PATTERNS — rhythm cells (sibling to SEQUENCE_PATTERNS), authored in 4/4.
  //   div    steps per beat (1 quarter · 2 eighth · 3 triplet · 4 sixteenth)
  //   grid   one token per step: D down(low→high) · U up(high→low, top strings) ·
  //          '.' rest/ring · X muted chuck (mt) · '-' tie. A '!' suffix accents that step.
  //   accent which steps auto-accent: downbeat | backbeat | offbeat | even
  //   preSwing  the cell is already swung → its notes carry noSwing so the global
  //             swing post-process doesn't double-swing it.
  const STRUM_PATTERNS = {
    held_pad:                 { div:1, bars:1, grid:['D','.','.','.'], accent:'downbeat' },
    quarter_down:             { div:1, bars:1, grid:['D','D','D','D'], accent:'downbeat' },
    eighth_down:              { div:2, bars:1, grid:['D','D','D','D','D','D','D','D'], accent:'backbeat' },
    folk_pop_ddu_udu:         { div:2, bars:1, grid:['D','.','D','U','.','U','D','U'], accent:'backbeat' },
    sixteenth_funk_scratch:   { div:4, bars:1, grid:['D','X','U','X','D','X','U','X','D','X','U','X','D','X','U','X'], accent:'offbeat' },
    reggae_skank:             { div:2, bars:1, grid:['.','U','.','U','.','U','.','U'], accent:'offbeat' },
    ballad_arpeggiated_strum: { div:3, bars:1, grid:['D','.','U','.','U','.','D','.','U','.','U','.'], accent:'downbeat', preSwing:true },
    charleston:               { div:2, bars:1, grid:['D','.','.','D','.','.','.','.'], accent:'downbeat' },
  };
  // Startup integrity guard (mirrors the no-unison / style-palette guards): every
  // cell's grid must fill exactly bars × 4 beats × div (authored in 4/4).
  (function validateStrumPatterns() {
    for (const id of Object.keys(STRUM_PATTERNS)) {
      const p = STRUM_PATTERNS[id];
      const expect = (p.bars || 1) * 4 * p.div;
      if (p.grid.length !== expect) throw new Error(`[SlopScale strum-pattern] ${id} grid has ${p.grid.length} steps, expected ${expect} (bars×4×div)`);
    }
  })();
  function defaultStrumPattern(cfg) {
    if (cfg.style === 'funk')   return 'sixteenth_funk_scratch';
    if (cfg.style === 'reggae') return 'reggae_skank';
    if (cfg.chordOverride === '5' || cfg.chordOverride === '5oct') return 'eighth_down';
    if (cfg.subdivision === 'quarter') return 'quarter_down';
    return 'folk_pop_ddu_udu';
  }
  function strumStepAccented(mode, k, div, beatsPerBar) {
    const beatIdx = Math.floor(k / div), within = k % div;
    switch (mode) {
      case 'even':     return true;
      case 'offbeat':  return div >= 2 && within === Math.floor(div / 2);
      case 'backbeat': return within === 0 && (beatIdx % 2 === 1);                              // 2 & 4 in 4/4
      case 'downbeat':
      default:         return within === 0 && (beatIdx === 0 || beatIdx === Math.floor(beatsPerBar / 2)); // 1 (& 3)
    }
  }
  // A movable power-chord grip (root + 5th [+ octave]) on the low string-set —
  // built directly from the interval geometry (CAGED has no power-chord template).
  // Standard 4ths between the low strings: 5th = next string +2 frets, oct = +2 up two strings.
  function powerChordGrip(cfg, rootPc, quality, prevRootFret) {
    const opens = openMidisForConfig(cfg);
    if (opens.length < 3) return null;
    const open0 = ((opens[0] % 12) + 12) % 12;
    let f = (((rootPc - open0) % 12) + 12) % 12;                 // 0..11 on the lowest string
    if (prevRootFret != null && prevRootFret >= 0 && f + 12 <= 12 &&
        Math.abs((f + 12) - prevRootFret) < Math.abs(f - prevRootFret)) f += 12;
    const gripNotes = [{ s:0, f, midi:opens[0] + f }, { s:1, f:f + 2, midi:opens[1] + f + 2 }];
    if (quality === '5oct') gripNotes.push({ s:2, f:f + 2, midi:opens[2] + f + 2 });
    const name = chordName(rootPc, quality);
    return { shape:'power', rootFret:f, gripNotes, template:templateFromPositions(name, gripNotes, cfg, false) };
  }
  // Pick one grabbable grip for a chord. Power chords build directly; everything
  // else voices from a CAGED triad grip (7ths reduce to the triad in v1 — the
  // STRUM_GRIPS dom7/9/sus table is Phase 3). voicingPosition: 'open' (default,
  // prefer the most open cowboy grip) | 'movable' (a fixed CAGED shape walked up
  // the neck nearest the previous chord).
  const STRUM_SHAPE_ORDER = ['C','A','G','E','D'];
  function pickStrumGrip(cfg, rootPc, quality, prevRootFret, opts) {
    if (quality === '5' || quality === '5oct') return powerChordGrip(cfg, rootPc, quality, prevRootFret);
    const name = chordName(rootPc, quality);
    const shapes = opts.fixedShape ? [opts.fixedShape] : STRUM_SHAPE_ORDER;
    let best = null;
    for (const shape of shapes) {
      const anchorPrev = opts.fixedShape ? prevRootFret : -1;   // open mode: each chord finds its lowest grip
      const rootFret = pickShapeRootFret(cfg, shape, rootPc, anchorPrev, 'nearest');
      if (rootFret == null) continue;
      const gripNotes = cagedShapeNotesForChord(cfg, shape, quality, rootFret);
      if (!gripNotes || gripNotes.length < 3) continue;
      const template = templateFromShape(name, shape, quality, rootFret, cfg, false) || templateFromPositions(name, gripNotes, cfg, false);
      const cand = { shape, rootFret, gripNotes, template };
      if (opts.fixedShape) { best = cand; break; }
      // open mode: prefer the most open grip (most fret-0 strings, then lowest top fret)
      const score = c => c.gripNotes.filter(p => p.f === 0).length * 100 - Math.max.apply(null, c.gripNotes.map(p => p.f));
      if (!best || score(cand) > score(best)) best = cand;
    }
    return best;
  }
  // Emit one strum as per-string time-staggered events (a rake, not a block chord).
  // Down = low→high (ascending s); up = top ≤4 strings high→low. Stagger tightens
  // with tempo so two strums never smear; de-stacking onsets is limiter-friendly.
  function emitStrum(notes, gripNotes, tok, stepT, stepSec, accent, preSwing) {
    const sorted = gripNotes.slice().sort((a, b) => a.s - b.s);
    const mute = (tok === 'X');
    let struck, order;
    if (tok === 'U') { struck = sorted.slice(-4); order = struck.slice().reverse(); }  // up: top ≤4, high→low
    else             { struck = sorted; order = struck; }                              // down / chuck: all, low→high
    const span = Math.max(1, order.length);
    const stagger = Math.max(0.006, Math.min(0.018, (stepSec * 0.40) / span));
    const sus = mute ? Math.max(0.04, stepSec * 0.35) : Math.max(0.05, stepSec * 0.92);
    order.forEach((p, k) => {
      notes.push(noteDefaults({
        t: Number((stepT + k * stagger).toFixed(6)), s: p.s, f: p.f, sus: Number(sus.toFixed(6)),
        mt: mute, ac: !!accent, noSwing: !!preSwing,
      }));
    });
  }
  function buildStrumCompExercise(cfg) {
    const mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const beatsPerBar = Math.max(1, cfg.meter.numerator);
    const beatUnit = mLen / beatsPerBar;
    const degrees = progressionDegreesForConfig(cfg);
    const fixedShape = (cfg.voicingPosition === 'movable' && cfg.shape && CAGED_SHAPES[cfg.shape]) ? cfg.shape : null;
    const pat = STRUM_PATTERNS[cfg.strumPattern] || STRUM_PATTERNS[defaultStrumPattern(cfg)] || STRUM_PATTERNS.folk_pop_ddu_udu;
    // Odd-meter / non-4-beat degrade: if the 4/4-authored grid doesn't fit this bar,
    // fall back to a down-strum on each beat (the chord "limps" with the meter).
    const gridFits = pat.grid.length === beatsPerBar * pat.div;
    const stepCount = gridFits ? pat.grid.length : beatsPerBar;
    const stepSec   = gridFits ? (beatUnit / pat.div) : beatUnit;

    const notes = [], chords = [], chordTemplates = [], handShapes = [];
    const sections = [{ name:`Strum — ${cfg.key}`, number:1, time:0 }];
    let templateId = 0, prevRootFret = -1;
    for (let bar = 0, t = 0; t < totalTime - 0.001; bar++, t += mLen) {
      const deg = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, deg);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, deg, cfg.chordOverride, cfg.progression);
      const grip = pickStrumGrip(cfg, rootPc, quality, prevRootFret, { fixedShape });
      if (!grip || !grip.gripNotes.length) continue;
      prevRootFret = grip.rootFret;
      // Chord box: the full grip (so the chord-box renderers draw x/o + fingering).
      const id = templateId++;
      chordTemplates.push(grip.template || templateFromPositions(chordName(rootPc, quality), grip.gripNotes, cfg, false));
      chords.push({ t:Number(t.toFixed(6)), id, hd:false, notes:grip.gripNotes.map(p => noteDefaults({ s:p.s, f:p.f, sus:0 })) });
      handShapes.push({ chord_id:id, start_time:Number(t.toFixed(6)), end_time:Number((t + mLen).toFixed(6)), arp:false });
      // Strikes from the pattern.
      for (let k = 0; k < stepCount; k++) {
        const raw = gridFits ? pat.grid[k] : 'D';
        const tok = String(raw).replace('!', '');
        if (tok === '.' || tok === '-') continue;
        const stepT = t + k * stepSec;
        if (stepT >= totalTime - 0.0005) break;
        const accent = String(raw).includes('!') || strumStepAccented(pat.accent, k, pat.div, beatsPerBar);
        emitStrum(notes, grip.gripNotes, tok, stepT, stepSec, accent, !!pat.preSwing);
      }
    }
    if (!notes.length) throw new Error('No strum/comp notes generated (strum_comp needs ≥6 strings — guitar only).');
    return { notes, chords, chordTemplates, handShapes, sections, duration:totalTime };
  }

  // ── Bass groove primitives (Phase 4 — bass-pedagogy pre-build spec) ─────────
  // Bass is GROOVE + RIGHT-HAND first (inverts the guitar instinct). These are
  // fixed-interval grips on the all-4ths neck, NOT scale-window scans: from a root
  // (s,f) the 5th is (s+1,+P5) and the octave (s+2,+8ve). Computed BY PITCH (not a
  // hardcoded +2 frets) so they stay correct under drop/alt tunings — and on a
  // guitar's all-4ths low strings too (so the builders never crash, even though the
  // UI offers them only on bass via offerable()). Slap/pop/ghost use the existing
  // schema (no new field): thumb-slap = low-string note + ac; pop = high-string note
  // + ac; ghost/dead = mt. Per-lane spec: agent-memory/bass-pedagogy-expert/
  // project_bass_groove_primitives_spec. Funk/soul-idiom validate the FEEL at the
  // template stage (Phase 6). Tagged bass-native in PRACTICE_APPLICABILITY.

  // Root grip low enough that the up-octave fits on a fretted string (root on
  // s ≤ count-3), nearest the previous pitch. Returns { root, fifth, octave }
  // as {s,f,midi}, or null. The 5th/octave are found BY PITCH on the next strings.
  function bassRootGrip(cfg, rootPc, prevMidi) {
    const opens = openMidisForConfig(cfg);
    const count = opens.length;
    const fMin = cfg.fretMin || 0, fMax = Math.min(cfg.fretMax || 12, 15);
    let root = null, bestDist = Infinity;
    for (let s = 0; s <= count - 3; s++) {
      for (let f = fMin; f <= fMax; f++) {
        if (((opens[s] + f) % 12) !== rootPc) continue;
        const midi = opens[s] + f, d = Math.abs(midi - prevMidi);
        if (d < bestDist) { root = { s, f, midi }; bestDist = d; }
      }
    }
    if (!root) return null;
    const onString = (s, targetMidi) => {
      const openPc = ((opens[s] % 12) + 12) % 12, pc = ((targetMidi % 12) + 12) % 12;
      let f = (((pc - openPc) % 12) + 12) % 12;
      while (opens[s] + f < targetMidi - 6 && f + 12 <= 17) f += 12;
      return { s, f, midi: opens[s] + f };
    };
    return { root, fifth: onString(root.s + 1, root.midi + 7), octave: onString(root.s + 2, root.midi + 12) };
  }

  // right_hand_technique — pitch-INVISIBLE plucking-hand stamina (alternating i-m /
  // raking / 3-finger). A steady re-articulated root pulse at the subdivision; the
  // hand pattern IS the drill, named in the goal-card.
  function buildRightHandTechniqueExercise(cfg) {
    const step = secondsPerDivision(cfg), mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const degrees = progressionDegreesForConfig(cfg);
    const notes = [], sections = [{ name:`Right-hand technique — ${cfg.key}`, number:1, time:0 }];
    const sus = Math.max(0.05, step * 0.5);
    let prevMidi = 33, t = 0, bar = 0;
    while (t < totalTime - 0.001) {
      const grip = bassRootGrip(cfg, chordRootForDegree(cfg, degrees[bar % degrees.length]), prevMidi);
      const barEnd = Math.min(totalTime, t + mLen);
      if (grip) { for (let tt = t; tt < barEnd - 0.001; tt += step) notes.push(noteDefaults({ t:Number(tt.toFixed(6)), s:grip.root.s, f:grip.root.f, sus })); prevMidi = grip.root.midi; }
      t = barEnd; bar++;
    }
    if (!notes.length) throw new Error('No right-hand technique notes generated.');
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections, duration:totalTime };
  }

  // root_fifth_octave — the foundational bass box (taught BEFORE scales). R-5-8-5
  // per bar, anchored on each chord's root.
  function buildRootFifthOctaveExercise(cfg) {
    const mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const beatsPerBar = Math.max(1, cfg.meter.numerator), beatSec = mLen / beatsPerBar;
    const degrees = progressionDegreesForConfig(cfg);
    const notes = [], sections = [{ name:`Root–5th–octave — ${cfg.key}`, number:1, time:0 }];
    const sus = Math.max(0.08, beatSec * 0.9);
    let prevMidi = 33, t = 0, bar = 0;
    while (t < totalTime - 0.001) {
      const grip = bassRootGrip(cfg, chordRootForDegree(cfg, degrees[bar % degrees.length]), prevMidi);
      if (grip) {
        const seq = [grip.root, grip.fifth, grip.octave, grip.fifth];   // R-5-8-5
        for (let b = 0; b < beatsPerBar; b++) {
          const p = seq[b % seq.length], nt = t + b * beatSec;
          if (nt < totalTime) notes.push(noteDefaults({ t:Number(nt.toFixed(6)), s:p.s, f:p.f, sus, ac:(b === 0) }));
        }
        prevMidi = grip.root.midi;
      }
      t += mLen; bar++;
    }
    if (!notes.length) throw new Error('No root-fifth-octave notes generated.');
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections, duration:totalTime };
  }

  // octave_groove — the disco octave bounce. Relentless even R-8 IS the idiom
  // (soul-motown feel review: don't syncopate it, don't add a Motown toggle — Motown
  // melodic-bass is a separate future primitive). Two feel fixes: the weight lands on
  // the HIGH octave (the pop up), not the root; tight root launch + singing octave
  // landing (sus 0.45 vs 0.70).
  function buildOctaveGrooveExercise(cfg) {
    const step = secondsPerDivision(cfg), mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const degrees = progressionDegreesForConfig(cfg);
    const notes = [], sections = [{ name:`Octave groove — ${cfg.key}`, number:1, time:0 }];
    let prevMidi = 33, t = 0, bar = 0;
    while (t < totalTime - 0.001) {
      const grip = bassRootGrip(cfg, chordRootForDegree(cfg, degrees[bar % degrees.length]), prevMidi);
      const barEnd = Math.min(totalTime, t + mLen);
      if (grip) {
        let i = 0;
        for (let tt = t; tt < barEnd - 0.001; tt += step, i++) {
          const isRoot = (i % 2 === 0);
          const p = isRoot ? grip.root : grip.octave;
          notes.push(noteDefaults({ t:Number(tt.toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * (isRoot ? 0.45 : 0.70)), ac:!isRoot, noSwing:true }));
        }
        prevMidi = grip.root.midi;
      }
      t = barEnd; bar++;
    }
    if (!notes.length) throw new Error('No octave groove notes generated.');
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections, duration:totalTime };
  }

  // dead_note_groove — the 16th-note funk pocket. Funk-idiom feel review: uniformity
  // kills the pocket — the REAL notes must SYNCOPATE (the one, then the & of 2, the &
  // of 3, the a of 4 — the push that pulls the loop around), a few genuine RESTS make
  // it breathe, and only ~2 accents/bar. Muted ghosts (mt) fill the rest. noSwing so
  // the 8th-pair swing post-process can't smear the 16ths. Authored for a 4/4 16-step
  // bar; other meters degrade to a tone-on-downbeats / ghost-between feel.
  function buildDeadNoteGrooveExercise(cfg) {
    const mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const beatsPerBar = Math.max(1, cfg.meter.numerator), sixteenth = mLen / (beatsPerBar * 4);
    const stepsPerBar = beatsPerBar * 4, map16 = stepsPerBar === 16;
    const degrees = progressionDegreesForConfig(cfg);
    const notes = [], sections = [{ name:`Dead-note pocket — ${cfg.key}`, number:1, time:0 }];
    const realSus = Math.max(0.03, sixteenth * 0.6), ghostSus = Math.max(0.02, sixteenth * 0.4);
    const REAL = new Set([0, 6, 10, 14]), REST = new Set([2, 5, 13]), ACCENT = new Set([0, 6]);
    let prevMidi = 33, t = 0, bar = 0;
    while (t < totalTime - 0.001) {
      const grip = bassRootGrip(cfg, chordRootForDegree(cfg, degrees[bar % degrees.length]), prevMidi);
      const barEnd = Math.min(totalTime, t + mLen);
      if (grip) {
        const realPitch = [grip.root, grip.octave, grip.fifth, grip.octave];   // root on the one, colour on the pushes
        const tones = [grip.root, grip.octave, grip.fifth];
        let i = 0, realIdx = 0;
        for (let tt = t; tt < barEnd - 0.001; tt += sixteenth, i++) {
          if (map16 && REST.has(i)) continue;
          const isReal = map16 ? REAL.has(i) : (i % 4 === 0);
          if (isReal) {
            const p = map16 ? realPitch[realIdx++ % realPitch.length] : tones[Math.floor(i / 4) % tones.length];
            notes.push(noteDefaults({ t:Number(tt.toFixed(6)), s:p.s, f:p.f, sus:realSus, ac:(map16 ? ACCENT.has(i) : i === 0), noSwing:true }));
            prevMidi = p.midi;
          } else {
            notes.push(noteDefaults({ t:Number(tt.toFixed(6)), s:grip.root.s, f:grip.root.f, sus:ghostSus, mt:true, noSwing:true }));
          }
        }
      }
      t = barEnd; bar++;
    }
    if (!notes.length) throw new Error('No dead-note groove notes generated.');
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections, duration:totalTime };
  }

  // slap_pop — the slap pocket. Funk-idiom feel review: real slap is mostly GHOSTS +
  // SPACE with a few hits that snap, not a clockwork T-P. On a 16-grid: thumb (root,
  // low) on the one and the "and-area" of 3; pop (octave, high) on the backbeat + the
  // a-of-3 / &-of-4 pushes; dead-thumb ghosts (mt) between; the rest rests. Two accents
  // (the one + the backbeat). noSwing keeps the 16ths straight (v1). Other meters
  // degrade to an 8th-feel T-P. Advanced; gate after fingerstyle.
  function buildSlapPopExercise(cfg) {
    const mLen = measureSeconds(cfg), totalTime = cfg.bars * mLen;
    const beatsPerBar = Math.max(1, cfg.meter.numerator), sixteenth = mLen / (beatsPerBar * 4);
    const stepsPerBar = beatsPerBar * 4, map16 = stepsPerBar === 16;
    const degrees = progressionDegreesForConfig(cfg);
    const notes = [], sections = [{ name:`Slap & pop — ${cfg.key}`, number:1, time:0 }];
    const realSus = Math.max(0.03, sixteenth * 0.55), ghostSus = Math.max(0.02, sixteenth * 0.4);
    const THUMB = new Set([0, 8]), POP = new Set([4, 11, 14]), GHOST = new Set([2, 6, 13]), ACCENT = new Set([0, 4]);
    let prevMidi = 33, t = 0, bar = 0;
    while (t < totalTime - 0.001) {
      const grip = bassRootGrip(cfg, chordRootForDegree(cfg, degrees[bar % degrees.length]), prevMidi);
      const barEnd = Math.min(totalTime, t + mLen);
      if (grip) {
        let i = 0;
        for (let tt = t; tt < barEnd - 0.001; tt += sixteenth, i++) {
          const T = Number(tt.toFixed(6));
          if (map16) {
            if (THUMB.has(i))      notes.push(noteDefaults({ t:T, s:grip.root.s,   f:grip.root.f,   sus:realSus,  ac:ACCENT.has(i), noSwing:true }));
            else if (POP.has(i))   notes.push(noteDefaults({ t:T, s:grip.octave.s, f:grip.octave.f, sus:realSus,  ac:ACCENT.has(i), noSwing:true }));
            else if (GHOST.has(i)) notes.push(noteDefaults({ t:T, s:grip.root.s,   f:grip.root.f,   sus:ghostSus, mt:true,          noSwing:true }));
            // else rest
          } else if (i % 2 === 0) {
            const p = (i % 4 === 0) ? grip.root : grip.octave;
            notes.push(noteDefaults({ t:T, s:p.s, f:p.f, sus:realSus, ac:(i % 4 === 0), noSwing:true }));
          }
        }
        prevMidi = grip.root.midi;
      }
      t = barEnd; bar++;
    }
    if (!notes.length) throw new Error('No slap/pop notes generated.');
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections, duration:totalTime };
  }

  // ── End additional generators ───────────────────────────────────────────────

  const CYCLE_KEY_ORDERS = {
    circle_of_fourths: ['C','F','Bb','Eb','Ab','Db','Gb','B','E','A','D','G'],
    circle_of_fifths:  ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F'],
    chromatic:         ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],
  };

  function buildSingleChart(cfg) {
    const mode = cfg.mode || cfg.practiceType || 'scale';
    if (mode === 'scale' || mode === 'modal_vamp') return buildScaleExercise(cfg);
    if (mode === 'chord_scales')      return buildChordScaleExercise(cfg);
    if (mode === 'sweep_arpeggios')   return buildSweepArpeggioExercise(cfg);
    if (mode === 'chromatic')              return buildChromaticExercise(cfg);
    if (mode === 'guide_tones')            return buildGuideTonesExercise(cfg);
    if (mode === 'bending')                return buildBendingExercise(cfg);
    if (mode === 'legato')                 return buildLegatoExercise(cfg);
    if (mode === 'vibrato')                return buildVibratoExercise(cfg);
    if (mode === 'scale_thirds')           return buildScaleThirdsExercise(cfg);
    if (mode === 'scale_sixths')           return buildScaleSixthsExercise(cfg);
    if (mode === 'call_response')          return buildCallResponseExercise(cfg);
    if (mode === 'tremolo_picking')        return buildTremoloPickingExercise(cfg);
    if (mode === 'tapping')                return buildTappingExercise(cfg);
    if (mode === 'pedal_point')            return buildPedalPointExercise(cfg);
    if (mode === 'pedal_riff')             return buildPedalRiffExercise(cfg);
    if (mode === 'string_skipping')        return buildStringSkippingExercise(cfg);
    if (mode === 'position_shift')         return buildPositionShiftExercise(cfg);
    if (mode === 'rhythmic_displacement')  return buildRhythmicDisplacementExercise(cfg);
    if (mode === 'chromatic_enclosures')   return buildChromaticEnclosuresExercise(cfg);
    if (mode === 'bebop_scale')            return buildBebopScaleExercise(cfg);
    if (mode === 'arpeggio_inversions')    return buildArpeggioInversionsExercise(cfg);
    if (mode === 'walking_bass')           return buildWalkingBassExercise(cfg);
    if (mode === 'hybrid_picking')         return buildHybridPickingExercise(cfg);
    if (mode === 'triadic_pairs')          return buildTriadicPairsExercise(cfg);
    if (mode === 'pentatonic_super')       return buildPentatonicSuperExercise(cfg);
    if (mode === 'shell_voicings')         return buildShellVoicingsExercise(cfg);
    if (mode === 'strum_comp')             return buildStrumCompExercise(cfg);
    if (mode === 'octave_displacement')    return buildOctaveDisplacementExercise(cfg);
    if (mode === 'root_fifth_octave')      return buildRootFifthOctaveExercise(cfg);
    if (mode === 'octave_groove')          return buildOctaveGrooveExercise(cfg);
    if (mode === 'dead_note_groove')       return buildDeadNoteGrooveExercise(cfg);
    if (mode === 'right_hand_technique')   return buildRightHandTechniqueExercise(cfg);
    if (mode === 'slap_pop')               return buildSlapPopExercise(cfg);
    return buildArpeggioExercise(cfg, progressionDegreesForConfig(cfg));
  }

  function buildKeyCycleChart(cfg) {
    const order = CYCLE_KEY_ORDERS[cfg.keyCycle];
    if (!order) return buildSingleChart(cfg);
    const startIdx = Math.max(0, order.indexOf(cfg.key));
    const count = Math.max(2, Math.min(12, cfg.keyCycleLength || 4));
    const keys = Array.from({ length: count }, (_, i) => order[(startIdx + i) % order.length]);
    const notes = [], chords = [], chordTemplates = [], handShapes = [], sections = [], anchors = [];
    let t = 0, tplOffset = 0;
    for (const key of keys) {
      const kCfg = Object.assign({}, cfg, { key, keyCycle: 'none' });
      const chart = buildSingleChart(kCfg);
      const dur = Math.max(chart.duration || 0, cfg.bars * measureSeconds(kCfg));
      sections.push({ name: key, number: sections.length + 1, time: Number(t.toFixed(6)) });
      chart.notes.forEach(n => notes.push(Object.assign({}, n, { t: Number((n.t + t).toFixed(6)) })));
      chart.chords.forEach(c => chords.push(Object.assign({}, c, { t: Number((c.t + t).toFixed(6)), id: c.id + tplOffset })));
      chart.chordTemplates.forEach(ct => chordTemplates.push(ct));
      chart.handShapes.forEach(hs => handShapes.push(Object.assign({}, hs, { chord_id: hs.chord_id + tplOffset, start_time: Number((hs.start_time + t).toFixed(6)), end_time: Number((hs.end_time + t).toFixed(6)) })));
      (chart.anchors || []).forEach(a => anchors.push(Object.assign({}, a, { time: Number((a.time + t).toFixed(6)) })));
      tplOffset += chart.chordTemplates.length;
      t += dur;
    }
    return { notes, chords, chordTemplates, handShapes, sections, anchors, duration: t };
  }

  // ===========================================================================
  // §8 · generateExercise() DISPATCH
  // routes cfg.practiceType to the correct builder above.
  // ===========================================================================
  function generateExercise(cfg) {
    let chart = cfg.keyCycle && cfg.keyCycle !== 'none'
      ? buildKeyCycleChart(cfg)
      : buildSingleChart(cfg);
    // Workout single block: a Custom config + a target duration → fill with whole
    // repetitions before timing (no-op when targetSec is absent, i.e. normal play).
    const tSec = blockTargetSec(cfg);
    if (tSec != null) chart = fillBlockToDuration(chart, cfg, tSec);
    const duration = Math.max(chart.duration || 0, cfg.bars * measureSeconds(cfg));
    const anchors = chart.anchors && chart.anchors.length ? chart.anchors : buildAnchors(cfg, duration);
    return { version:1, session:cfg, chart:Object.assign({}, chart, { beats:buildBeats(cfg, duration), anchors, duration }) };
  }

  // Build one segment's config by merging session-level defaults, string setup,
  // and segment-level overrides. Resolves shape notes if system is shape-aware.
  // ===========================================================================
  // §9 · SESSION BUILDERS
  // generateSession() mirrors generateExercise() — same { version, session, chart }.
  // ===========================================================================
  function buildSegmentConfig(segment, session) {
    const stringSetup = session.stringSetup || 'guitar_6_standard';
    const setup = STRING_SETUPS[stringSetup] || STRING_SETUPS.guitar_6_standard;
    const raw = Object.assign({
      // Structural defaults
      key:'C', scale:'major', bpm:80, bars:4, direction:'up_down', sequence:'none',
      meter:'4/4',   // safety-net default so a meter-less config never yields meter.denominator undefined
      subdivision:'eighth', fretboardSystem:'caged', shape:'E', fretMin:0, fretMax:5,
      chordDepth:'seventh', progression:'ii-V-I', chordOverride:'auto',
      chordScaleStrategy:'mode_of_moment', chromaticPattern:'1234', keyCycle:'none',
      repeatCount:1, advancedMode:true, voices:'thirds_only', renderer:'highway_3d',
      audio:{ notes:false, metronome:true, harmony:false },
    }, segment.config || {}, {
      // Always derive these from the session's string setup
      stringSetup, instrument:setup.instrument,
      stringCount:setup.openMidis.length,
      // Segment kind drives the mode dispatch
      mode: segment.kind, practiceType: segment.kind,
    });
    // Parse meter string → object (e.g. '4/4' → { numerator:4, denominator:4, grouping:[4] })
    if (typeof raw.meter === 'string') raw.meter = parseMeter(raw.meter);
    // Resolve CAGED / 3NPS / Open shape into fretMin/fretMax + shapeNotes
    raw.shapeNotes = null; raw.shapeDisplayName = null;
    if (isShapeAwareSystem(raw.fretboardSystem)) {
      const resolved = resolveCurrentShape({ fretboardSystem:raw.fretboardSystem, key:raw.key, scale:raw.scale, shape:raw.shape }, setup.openMidis);
      if (resolved) {
        raw.shape = resolved.shape;
        raw.shapeNotes = resolved.resolved.notes;
        raw.shapeDisplayName = resolved.resolved.displayName;
        raw.fretMin = resolved.resolved.fretMin;
        raw.fretMax = resolved.resolved.fretMax;
      }
    }
    return raw;
  }

  // Generate a chart for one segment with optional BPM ladder sub-sections.
  // BPM ladder produces sub-section markers ("80 BPM", "85 BPM", …) and
  // concatenates the same exercise at stepping tempos with correct beat timing.
  function buildBpmLadderChart(segCfg, ladder) {
    const { bpmStart, bpmTarget, bpmStep, repsPerStep = 1 } = ladder;
    const notes = [], chords = [], chordTemplates = [], handShapes = [], sections = [], anchors = [], beats = [];
    let t = 0, tplOffset = 0;
    for (let bpm = bpmStart; bpm <= bpmTarget + 0.001; bpm += bpmStep) {
      for (let r = 0; r < repsPerStep; r++) {
        const stepCfg = Object.assign({}, segCfg, { bpm, keyCycle:'none' });
        const chart = buildSingleChart(stepCfg);
        const dur = Math.max(chart.duration || 0, segCfg.bars * measureSeconds(stepCfg));
        if (r === 0) sections.push({ name:`${Math.round(bpm)} BPM`, number:sections.length + 1, time:Number(t.toFixed(6)) });
        chart.notes.forEach(n => notes.push(Object.assign({}, n, { t:Number((n.t + t).toFixed(6)) })));
        chart.chords.forEach(c => chords.push(Object.assign({}, c, { t:Number((c.t + t).toFixed(6)), id:c.id + tplOffset })));
        chart.chordTemplates.forEach(ct => chordTemplates.push(ct));
        chart.handShapes.forEach(hs => handShapes.push(Object.assign({}, hs, { chord_id:hs.chord_id + tplOffset, start_time:Number((hs.start_time + t).toFixed(6)), end_time:Number((hs.end_time + t).toFixed(6)) })));
        (chart.anchors || []).forEach(a => anchors.push(Object.assign({}, a, { time:Number((a.time + t).toFixed(6)) })));
        buildBeats(stepCfg, dur).forEach(b => beats.push(Object.assign({}, b, { time:Number((b.time + t).toFixed(6)) })));
        tplOffset += (chart.chordTemplates || []).length;
        t += dur;
      }
    }
    return { notes, chords, chordTemplates, handShapes, sections, anchors, beats, duration:t };
  }

  // ── Right-sized finite runs (Depth Ladder slice 1) ──────────────────────────
  // A Pathways/Custom DRILL plays a RIGHT-SIZED, FINITE run, not an infinite loop:
  // length is DERIVED from what's being practised (a short pass-bounded box vs a
  // longer cycle-bounded over-the-changes drill), then tiled to that target via the
  // existing fillBlockToDuration (whole reps, never cut a phrase) and ended with the
  // existing session-summary closure. Jam stays endless (the mirror); Workout's own
  // per-block targetSec is untouched. See project_depth_ladder_and_run_length.
  //
  // Base target seconds per practiceType. Default ~50 for anything unlisted.
  const RUN_TARGET_SEC = {
    // Pass-bounded (short): scale boxes, chromatic, single-technique drills.
    scale:40, chromatic:40,
    legato:45, bending:45, vibrato:45, tremolo_picking:45, tapping:45,
    string_skipping:45, hybrid_picking:45, scale_thirds:45, scale_sixths:45,
    octave_displacement:45, position_shift:45, rhythmic_displacement:45,
    sweep_arpeggios:55,
    // Riff/comp drills — pass-bounded, use the ~50 default explicitly.
    pedal_point:50, pedal_riff:50, power_chord_comping:50,
    // Bass groove primitives — pass-bounded (pocket/stamina), short.
    root_fifth_octave:40, octave_groove:40, dead_note_groove:45, right_hand_technique:40, slap_pop:45,
    // Cycle-bounded (longer, legitimately >60s): the unit is the harmonic cycle.
    diatonic_arpeggios:50, progression_arpeggios:70, arpeggio_inversions:50,
    guide_tones:60, chord_scales:75, bebop_scale:50, chromatic_enclosures:50,
    call_response:60, walking_bass:60,
    pentatonic_super:55, triadic_pairs:55, shell_voicings:55, strum_comp:55,
  };
  // Types whose UNIT is a harmonic cycle / whole-neck traversal, not the bar — they
  // get the higher ceiling (180s) and a longer base. The `scale` type joins this
  // set only in the full_neck case (handled in resolveRunTargetSec).
  const CYCLE_BOUNDED_TYPES = new Set([
    'chord_scales','guide_tones','progression_arpeggios','diatonic_arpeggios',
    'walking_bass','arpeggio_inversions','bebop_scale','chromatic_enclosures',
    'call_response','pentatonic_super','triadic_pairs','shell_voicings','strum_comp',
  ]);
  const RUN_FLOOR_SEC = 25;             // never shorter than this (settling + a couple judged passes)
  const RUN_CEIL_PASS_SEC = 90;         // pass-bounded ceiling (past it grinds sloppiness in)
  const RUN_CEIL_CYCLE_SEC = 180;       // cycle-bounded ceiling (long-cycle / whole-neck)
  // Speed-tier length modifier (the only ladder axis built today): on the Pathways
  // Climb the "groove" Slow tier gets a LONGER run (×1.5) and the "prove it" Fast/Push
  // tiers a SHORTER one (×0.75); Med = ×1.0. The Climb tier is the module-level
  // activeTempoTierIdx (0=Slow,1=Med,2=Fast,3=Push, mirroring TIER_LABELS). Only applies
  // on a Pathway (Custom has no Climb) — keyed off cfg carrying the pathway's BPM tier
  // when present, else the live index when a pathway is active. Returns 1 otherwise.
  const RUN_TIER_MOD_BY_IDX = [1.5, 1.0, 0.75, 0.75];
  function runTierMod(cfg) {
    // Explicit tier on the cfg wins (forward-compat / Workout blocks that carry one).
    const named = cfg && (cfg.bpmTier || cfg.tempoTier || cfg.tier);
    if (named != null) {
      const i = TIER_LABELS.findIndex(l => l.toLowerCase() === String(named).toLowerCase());
      if (i >= 0) return RUN_TIER_MOD_BY_IDX[i] || 1;
    }
    // Live Pathways Climb tier — only meaningful while a pathway is the active mode.
    const pathwayMode = !!($('slopscale-root')?.classList.contains('slopscale-pathway-mode'));
    if (pathwayMode && activePathwayId && activePathwayId !== 'custom') {
      return RUN_TIER_MOD_BY_IDX[activeTempoTierIdx] || 1;
    }
    return 1;
  }
  // Resolve the target run length (seconds) for a single-exercise DRILL config:
  // base table → speed-tier modifier → clamp to [floor, ceiling] (ceiling depends on
  // pass- vs cycle-bounded). fillBlockToDuration then tiles WHOLE reps to ≥ this and
  // overshoots to a whole cell, so the cycle-completion guarantee (≥1 whole rep) is
  // already covered. Returns null when no sensible target applies (then the run is
  // bars-driven, i.e. unchanged behaviour).
  function resolveRunTargetSec(cfg) {
    if (!cfg) return null;
    const type = cfg.practiceType || cfg.mode || 'scale';
    // The scale type is pass-bounded normally, but a full-neck traversal is a
    // cycle-style (whole-neck) unit — longer base + the higher ceiling.
    const fullNeck = type === 'scale' && cfg.fretboardSystem === 'full_neck';
    const cycleBounded = fullNeck || CYCLE_BOUNDED_TYPES.has(type);
    let base = fullNeck ? 60 : (RUN_TARGET_SEC[type] != null ? RUN_TARGET_SEC[type] : 50);
    base *= runTierMod(cfg);
    const ceil = cycleBounded ? RUN_CEIL_CYCLE_SEC : RUN_CEIL_PASS_SEC;
    const target = Math.max(RUN_FLOOR_SEC, Math.min(ceil, base));
    return target > 0 ? target : null;
  }
  // Apply the per-type run target to a DRILL config so generateExercise tiles it to a
  // right-sized run via fillBlockToDuration. No-op when the caller already set a
  // targetSec (a Workout block, a saved preset, or a share link owns its own length) —
  // we never override an explicit one. NOT called on the Jam path (jamPlay builds its
  // own endless config) or for Workout (generateSession), so this stays drill-only.
  function withRunTarget(cfg) {
    if (!cfg || blockTargetSec(cfg) != null) return cfg;
    const target = resolveRunTargetSec(cfg);
    return target != null ? Object.assign({}, cfg, { targetSec: target }) : cfg;
  }

  // ── Workout time primitive (build-queue #3) ─────────────────────────────────
  // Repeat a block's WHOLE-CELL content until it fills at least targetSec of
  // wall-clock time, overshooting to the next whole repetition — never cutting a
  // run mid-phrase. The "cell" is one full pass of the block exercise (its `bars`);
  // reps are whole passes, so phrases stay intact and the playhead crossing the
  // block's end IS the advance (no second clock). Existing builders count bars/reps;
  // this is the one piece that thinks in seconds. A block stays an existing
  // curriculum unit (a pathway node / Custom config) — this only extends its length.
  // Templates are identical across reps, so chord ids are reused (no tplOffset
  // growth); beats are left to the caller's buildBeats over the new duration.
  function fillBlockToDuration(chart, segCfg, targetSec) {
    const cellDur = (chart && chart.duration) || (segCfg.bars * measureSeconds(segCfg));
    if (!(targetSec > 0) || !(cellDur > 0)) return chart;
    // ceil → overshoot to a whole cell; the tiny epsilon avoids an extra rep when
    // targetSec is an exact multiple of cellDur (floating-point safe).
    const reps = Math.max(1, Math.ceil((targetSec - 1e-6) / cellDur));
    if (reps === 1) return chart;
    const notes = [], chords = [], handShapes = [], anchors = [], sections = [], beats = [];
    for (let r = 0; r < reps; r++) {
      const off = r * cellDur;
      (chart.notes || []).forEach(n => notes.push(Object.assign({}, n, { t: Number((n.t + off).toFixed(6)) })));
      (chart.chords || []).forEach(c => chords.push(Object.assign({}, c, { t: Number((c.t + off).toFixed(6)) })));
      (chart.handShapes || []).forEach(hs => handShapes.push(Object.assign({}, hs, { start_time: Number((hs.start_time + off).toFixed(6)), end_time: Number((hs.end_time + off).toFixed(6)) })));
      (chart.anchors || []).forEach(a => anchors.push(Object.assign({}, a, { time: Number((a.time + off).toFixed(6)) })));
      if (chart.sections) (chart.sections || []).forEach(s => sections.push(Object.assign({}, s, { number: sections.length + 1, time: Number((s.time + off).toFixed(6)) })));
      if (chart.beats)    (chart.beats || []).forEach(b => beats.push(Object.assign({}, b, { time: Number((b.time + off).toFixed(6)) })));
    }
    const out = Object.assign({}, chart, { notes, chords, handShapes, anchors, duration: Number((reps * cellDur).toFixed(6)) });
    if (chart.sections) out.sections = sections;
    if (chart.beats) out.beats = beats;
    return out;
  }
  // A block's target duration in seconds (Workout). Reads it off the segment, or its
  // config, or the cfg directly (single-exercise Custom block). null = bars-driven.
  function blockTargetSec(src) {
    if (!src) return null;
    if (src.targetSec != null) return Number(src.targetSec) || null;
    if (src.config && src.config.targetSec != null) return Number(src.config.targetSec) || null;
    return null;
  }

  // ── Workout length presets (pacing charette) ────────────────────────────────
  // OPT-IN session length — never the default (the natural "As built" length is
  // preserved when no preset is set). A preset distributes a total wall-clock
  // target across the blocks PROPORTIONAL to each block's natural cell duration
  // (so the warm-up stays relatively short and the arc's shape is preserved), via
  // each block's targetSec → fillBlockToDuration tiles whole reps. Duration is a
  // setup PLAN shown as a sum, never a graded countdown. See memory
  // project_workout_pacing_charette.
  const LENGTH_PRESETS = { quick: 10, standard: 20, woodshed: 30 };   // minutes
  function lengthPresetSec(preset) { return LENGTH_PRESETS[preset] ? LENGTH_PRESETS[preset] * 60 : null; }
  function applyLengthPreset(session, preset) {
    const totalSec = lengthPresetSec(preset);
    if (!totalSec || !session) return session;
    const segs = session.segments || [];
    if (!segs.length) return session;
    const nat = segs.map(s => { const m = materializeSegment(s); return m ? segmentEstDuration(m) : 0; });
    const sum = nat.reduce((a, b) => a + b, 0) || 1;
    const scaled = segs.map((s, i) => Object.assign({}, s, { targetSec: Math.max(20, (nat[i] / sum) * totalSec) }));   // ≥20s/block
    return Object.assign({}, session, { segments: scaled });
  }

  // ── Inter-block transition break (Workout pacing charette, 2026-06-02) ───────
  // The gap between blocks IS a count-in for the INCOMING block: ~2s of felt time
  // quantized UP to whole incoming bars (clamp 1–4), so the new 'one' lands on a
  // real downbeat and the ear locks to the next pulse before the notes arrive.
  // Sized adaptively — a technique-class change (the hand's whole operating mode
  // rebuilds: legato↔bend↔sweep↔comp↔slap↔groove) or a big neck leap mandates
  // ≥2 bars (the fretting / right hand physically relocates + re-grips; bass needs
  // this more than guitar). mode: 'auto' (no break when adjacent blocks truly flow)
  // | 'always' | 'off'. See memory project_workout_pacing_charette.
  const TECH_CLASS = {
    bending:'bend', vibrato:'bend',
    legato:'legato', tapping:'legato', string_skipping:'legato', hybrid_picking:'legato',
    sweep_arpeggios:'sweep',
    strum_comp:'comp', shell_voicings:'comp', chord_scales:'comp',
    slap_pop:'slap',
    walking_bass:'groove', root_fifth_octave:'groove', octave_groove:'groove',
    dead_note_groove:'groove', right_hand_technique:'groove',
  };
  function techniqueClass(kind) { return TECH_CLASS[kind] || 'pick'; }
  function segFretCenter(cfg) { return (((cfg.fretMin || 0) + (cfg.fretMax || 0)) / 2); }
  function interBlockBreakBars(prevCfg, curCfg, mode) {
    if (mode === 'off') return 0;
    const barSec = measureSeconds(curCfg) || 2;
    let bars = Math.max(1, Math.min(4, Math.round(2.0 / barSec)));        // ~2s felt, whole incoming bars
    const techChange = techniqueClass(prevCfg.mode || prevCfg.practiceType) !== techniqueClass(curCfg.mode || curCfg.practiceType);
    const bigLeap = Math.abs(segFretCenter(prevCfg) - segFretCenter(curCfg)) >= 5;
    const tempoSame = prevCfg.bpm === curCfg.bpm;
    const meterSame = (prevCfg.meter?.numerator === curCfg.meter?.numerator) && (prevCfg.meter?.denominator === curCfg.meter?.denominator);
    // 'auto': adjacent blocks that genuinely flow (same pulse + hand-mode + region)
    // get NO break — a clean segue is better there (guitar tier-1).
    if (mode !== 'always' && tempoSame && meterSame && !techChange && !bigLeap) return 0;
    if (techChange || bigLeap) bars = Math.max(bars, 2);                  // hand must relocate / re-grip
    return bars;
  }

  // Concatenate all session segments into one chart with section markers.
  // Each segment's times are offset by the cumulative duration of prior segments.
  // BPM ladder and key cycle are applied per-segment as configured.
  function buildSessionChart(session) {
    const notes = [], chords = [], chordTemplates = [], handShapes = [], sections = [], anchors = [], beats = [];
    // Per-segment time bounds — drives the session transport (progress bar,
    // segment jump, active-segment highlight, per-segment loop).
    const segmentBounds = [];
    let t = 0, tplOffset = 0, prevCfg = null;
    const breakMode = session.interBlockBreak || 'auto';

    for (const rawSeg of (session.segments || [])) {
      // Template-ref slots ({ templateId, variantIdx, locks }) materialise through
      // the variation engine; inline segments ({ kind, config }) pass through. An
      // unknown templateId is skipped (validateSegmentTemplates catches authored ones).
      const segment = materializeSegment(rawSeg);
      if (!segment) continue;                                 // unknown templateId — skip
      const segCfg = buildSegmentConfig(segment, session);
      // Inter-block break: a count-in for THIS (incoming) block so the prior block
      // doesn't slam into it. Adds count beats over the gap + advances the offset.
      if (prevCfg) {
        const brkBars = interBlockBreakBars(prevCfg, segCfg, breakMode);
        if (brkBars > 0) {
          const brkSec = brkBars * measureSeconds(segCfg);
          buildBeats(segCfg, Math.max(0, brkSec - 1e-4)).forEach(b =>
            beats.push(Object.assign({}, b, { time: Number((b.time + t).toFixed(6)), brk: true })));
          t += brkSec;
        }
      }
      // Determine which builder to use for this segment
      const ladder = segment.bpmLadder
        ? (segment.bpmLadder.enabled ? segment.bpmLadder : null)
        : (session.bpmLadder?.enabled ? session.bpmLadder : null);
      const keyCycleStrategy = (segment.keyCycle !== undefined)
        ? (segment.keyCycle?.enabled ? segment.keyCycle.strategy : null)
        : (session.keyCycle?.enabled ? session.keyCycle.strategy : null);
      const keyCycleLen = (segment.keyCycle?.keysPerSession) || (session.keyCycle?.keysPerSession) || 4;

      let chart;
      if (ladder) {
        chart = buildBpmLadderChart(segCfg, ladder);
      } else if (keyCycleStrategy) {
        chart = buildKeyCycleChart(Object.assign({}, segCfg, { keyCycle:keyCycleStrategy, keyCycleLength:keyCycleLen }));
      } else {
        chart = buildSingleChart(segCfg);
      }

      // Workout block: if the block declares a target wall-clock duration, fill it
      // with whole repetitions (overshoot, never cut a phrase). The block stays an
      // existing curriculum unit; only its length changes. Beats are regenerated
      // below over the filled duration.
      const tSec = blockTargetSec(segment);
      if (tSec != null) chart = fillBlockToDuration(chart, segCfg, tSec);

      const dur = chart.duration || (segCfg.bars * measureSeconds(segCfg));

      // Segment-level section marker at the top of each segment
      sections.push({ name:segment.name, number:sections.length + 1, time:Number(t.toFixed(6)) });
      // Sub-sections from the chart (BPM ladder steps, key cycle keys) — skip index 0
      // since that collides with the segment marker we just pushed
      (chart.sections || []).forEach((s, i) => {
        if (i === 0) return;
        sections.push(Object.assign({}, s, { number:sections.length + 1, time:Number((s.time + t).toFixed(6)) }));
      });

      chart.notes.forEach(n => notes.push(Object.assign({}, n, { t:Number((n.t + t).toFixed(6)) })));
      chart.chords.forEach(c => chords.push(Object.assign({}, c, { t:Number((c.t + t).toFixed(6)), id:c.id + tplOffset })));
      chart.chordTemplates.forEach(ct => chordTemplates.push(ct));
      chart.handShapes.forEach(hs => handShapes.push(Object.assign({}, hs, { chord_id:hs.chord_id + tplOffset, start_time:Number((hs.start_time + t).toFixed(6)), end_time:Number((hs.end_time + t).toFixed(6)) })));
      (chart.anchors || []).forEach(a => anchors.push(Object.assign({}, a, { time:Number((a.time + t).toFixed(6)) })));
      // Use pre-computed beats if the chart has them (BPM ladder), else generate
      const segBeats = chart.beats || buildBeats(segCfg, dur);
      segBeats.forEach(b => beats.push(Object.assign({}, b, { time:Number((b.time + t).toFixed(6)) })));
      tplOffset += (chart.chordTemplates || []).length;
      segmentBounds.push({ name:segment.name, kind:segment.kind, role:segment.role, start:Number(t.toFixed(6)), end:Number((t + dur).toFixed(6)) });
      t += dur;
      prevCfg = segCfg;
    }
    return { notes, chords, chordTemplates, handShapes, sections, anchors, beats, segmentBounds, duration:t };
  }

  // Top-level session generator — parallel to generateExercise() for single exercises.
  // Returns the same { version, session, chart } shape so the rest of the launch
  // path (makeBundle, POST /temp-sloppak, playSong) works unchanged.
  function generateSession(session) {
    const chart = buildSessionChart(session);
    const duration = chart.duration || 0;
    // Use first segment's config for metadata — materialise a template-ref first so
    // the metadata cfg has a real meter/key/scale (not a config-less ref → undefined).
    const firstSeg = materializeSegment((session.segments || [])[0]);
    const firstCfg = firstSeg ? buildSegmentConfig(firstSeg, session) : {};
    const anchors = chart.anchors?.length ? chart.anchors : buildAnchors(firstCfg, duration);
    const sessionMeta = Object.assign({}, firstCfg, {
      mode:'session', practiceType:'session',
      sessionName:session.name, sessionId:Object.keys(BUILT_IN_SESSIONS).find(k => BUILT_IN_SESSIONS[k] === session) || 'custom'
    });
    return { version:1, session:sessionMeta, chart:Object.assign({}, chart, { beats:chart.beats || [], anchors, duration }) };
  }

  // Descriptive exercise title for the bundle's songInfo.title — what each
  // renderer draws as its in-canvas header (and the player HUD for 3D). e.g.
  // "E minor pentatonic". Sessions use their name; chromatic uses the pattern.
  // ===========================================================================
  // §10 · EXERCISE TITLE + makeBundle()
  // wraps an exercise into the renderer-ready bundle (activeBundle).
  // ===========================================================================
  function exerciseTitle(cfg) {
    try {
      if (!cfg) return 'SlopScale';
      if (cfg.sessionName) return cfg.sessionName;
      if (cfg.mode === 'chromatic') return 'Chromatic ' + (CHROMATIC_PATTERN_LABELS[cfg.chromaticPattern] || cfg.chromaticPattern || '').toString().trim();
      const scaleLabel = String(cfg.scale || '').replace(/_/g, ' ');
      return [cfg.key, scaleLabel].filter(Boolean).join(' ').trim() || ('SlopScale ' + (cfg.mode || '')).trim();
    } catch { return 'SlopScale'; }
  }
  // Bake a count-in into the chart as real lead-in bars: shift every timed
  // element later by `lead` seconds, prepend count-in beats (so notation can
  // draw rests and the highway flows notes in), and extend the duration. The
  // music then lives at [lead, duration]; the loop cycles only that (see the
  // loop scheduler), so the count-in plays once. Bar numbers stay sequential.
  function applyCountIn(chart, cfg, lead, bars) {
    const sh = t => +(((t || 0)) + lead).toFixed(6);
    const shiftNotes = arr => (arr || []).map(n => Object.assign({}, n, { t: sh(n.t) }));
    const notes = shiftNotes(chart.notes);
    const chords = (chart.chords || []).map(ch => Object.assign({}, ch, { t: sh(ch.t), notes: shiftNotes(ch.notes) }));
    const anchors = (chart.anchors || []).map(a => Object.assign({}, a, { time: sh(a.time) }));
    const sections = (chart.sections || []).map(s => Object.assign({}, s, { time: sh(s.time) }));
    const segmentBounds = (chart.segmentBounds || []).map(b => Object.assign({}, b, { start: sh(b.start), end: sh(b.end) }));
    // Count-in beats (cfg meter/bpm) for [0, lead), then the original beats
    // shifted + renumbered so measure numbers stay continuous.
    const leadBeats = buildBeats(cfg, Math.max(0, lead - 1e-4));
    const shifted = (chart.beats || []).map(b => Object.assign({}, b, { time: sh(b.time), measure: (b.measure ?? -1) >= 0 ? b.measure + bars : -1 }));
    const beats = leadBeats.concat(shifted);
    const duration = +(((chart.duration) || 0) + lead).toFixed(6);
    return Object.assign({}, chart, { notes, chords, anchors, sections, segmentBounds, beats, duration, leadIn: lead });
  }

  // Swing/shuffle feel as a single post-process over the assembled bundle, so the
  // lead notes and the backing comp swing together against the steady metronome
  // (clicks stay on the grid — they're the reference you shuffle against). Warps
  // each onset's phase WITHIN its beat: the eighth boundary 0.5 → r (0.667 = a
  // triplet shuffle), so downbeats stay put and off-beats fall late. Count-in and
  // loop-tail offsets are whole bars, so phase stays aligned across the timeline.
  const SWING_RATIOS = { straight:0.5, swing:0.6, shuffle:0.667 };
  function applySwingToBundle(bundle, cfg) {
    const r = SWING_RATIOS[cfg.swing] || 0.5;
    if (r === 0.5) return;
    const beatSec = (60 / cfg.bpm) * (4 / cfg.meter.denominator);
    const sw = t => {
      const bi = Math.floor(t / beatSec + 1e-9);
      const frac = t / beatSec - bi;
      const f2 = frac < 0.5 ? frac * (2 * r) : r + (frac - 0.5) * 2 * (1 - r);
      return +(((bi + f2) * beatSec)).toFixed(6);
    };
    bundle.notes = (bundle.notes || []).map(n => {
      if (n.noSwing) return n;   // pre-swung cells (e.g. a triplet strum) carry their own feel
      const nt = sw(n.t), ne = sw(n.t + (n.sus || 0));
      return Object.assign({}, n, { t:nt, sus:Math.max(0.02, +(ne - nt).toFixed(6)) });
    });
    bundle.backingEvents = (bundle.backingEvents || []).map(ev => {
      if (ev.noSwing) return ev;   // pre-swung triplet drum cells carry their own feel
      const et = sw(ev.t), ee = sw(ev.end);
      return Object.assign({}, ev, { t:et, end:Math.max(+(et + 0.02).toFixed(6), ee) });
    });
  }

  function makeBundle(exercise) {
    const cfg = exercise.session;
    // Count-in is baked here (not at generation) so the stored chart + LCD stay
    // count-in-free, and toggling count-in is a cheap re-attach, not a re-gen.
    const lead = (cfg.countInBars > 0) ? cfg.countInBars * measureSeconds(cfg) : 0;
    const c = lead > 0 ? applyCountIn(exercise.chart, cfg, lead, cfg.countInBars) : exercise.chart;
    // Seamless-loop tail: the loop cycles the music [lead, duration], but every
    // renderer draws a forward lookahead window — near the loop end that window
    // runs past `duration` into emptiness, so notes stop flowing before the
    // wrap. Append copies of the loop's opening notes/beats just past the loop
    // point (one or more loop-lengths, enough to fill any lookahead) so the next
    // pass's notes are already present to flow in. Flagged `_tail` so audio (which
    // loops via its own scheduler) skips them. duration stays the loop point.
    const dur = c.duration || 0, contentLen = dur - lead, LOOKAHEAD_TAIL = 10;
    let notesWithTail = c.notes, beatsWithTail = c.beats;
    if (contentLen > 0.05) {
      const tailNotes = [], tailBeats = [], copies = Math.ceil(LOOKAHEAD_TAIL / contentLen);
      for (let k = 1; k <= copies; k++) {
        const off = k * contentLen;
        for (const n of c.notes) { if (n.t < lead - 1e-6) continue; const tt = n.t + off; if (tt > dur + LOOKAHEAD_TAIL + 0.01) break; tailNotes.push(Object.assign({}, n, { t:+tt.toFixed(6), _tail:true })); }
        for (const b of (c.beats || [])) { if (b.time < lead - 1e-6) continue; const tt = b.time + off; if (tt > dur + LOOKAHEAD_TAIL + 0.01) continue; tailBeats.push(Object.assign({}, b, { time:+tt.toFixed(6), _tail:true })); }
      }
      if (tailNotes.length) notesWithTail = c.notes.concat(tailNotes);
      if (tailBeats.length) beatsWithTail = (c.beats || []).concat(tailBeats);
    }
    const bundle = {
      currentTime:0,
      songInfo:{ title:exerciseTitle(cfg), artist:'SlopScale', arrangement:cfg.instrument === 'bass' ? 'Bass' : 'Lead', tuning:tuningOffsetsForConfig(cfg), capo:0, duration:c.duration, format:'slopscale-practice', fretboardSystem:cfg.fretboardSystem },
      config:cfg,
      // Finite-run eligibility (Depth Ladder slice 1): a single-exercise DRILL
      // (Pathways/Custom) plays its right-sized run ONCE then ends with the session
      // summary, instead of looping forever — unless the user flips "keep looping".
      // A Workout session (mode 'session') keeps its segment-advance/looping; Jam
      // (mode undefined, + its own A–B loop) stays endless. So: eligible = a drill.
      finiteRun: cfg.mode != null && cfg.mode !== 'session',
    isReady:true, notes:notesWithTail, chords:c.chords, anchors:c.anchors, beats:beatsWithTail, sections:c.sections, chordTemplates:c.chordTemplates, handShapes:c.handShapes, segmentBounds:c.segmentBounds || null,
      leadIn:lead,
      // Backing comp/bass + drums cover the music only ([lead, duration]); generate
      // both for the content length, concat, then shift past the count-in (so drums
      // are silent through the count-in and swung with the band — Phase D).
      backingEvents:(function(){
        const cl = Math.max(0, c.duration - lead);
        const evs = buildBackingEvents(cfg, cl).concat(buildDrumEvents(cfg, cl, resolveGroove(cfg)));
        return lead ? evs.map(ev => Object.assign({}, ev, { t:+(ev.t + lead).toFixed(6), end:+(ev.end + lead).toFixed(6) })) : evs;
      })(),
      stringCount:cfg.stringCount, tuning:tuningOffsetsForConfig(cfg), openMidis:openMidisForConfig(cfg), capo:0,
      lyrics:[], toneChanges:[], toneBase:'', drumTab:null, mastery:1, hasPhraseData:false,
      inverted:readHighwayInverted(), lefty:readLefty(), renderScale:readRenderScale(), lyricsVisible:false, project:null, fretX:null,
      getNoteState:function(){return null;}, getNoteStateProvider:function(){return null;}
    };
    syncHighwaySettings(bundle);
    applySwingToBundle(bundle, cfg);
    // Don't project arpeggio/chord shapes onto the note highway — handShapes
    // drive the highway_3d overlay box. Chord names still appear via `chords`
    // events and the chord-preview thumbnail still renders from chordTemplates.
    bundle.handShapes = [];
    return bundle;
  }

  // Label for each open-string MIDI: shows tuning instead of "S1..Sn"
  function stringLabelForMidi(midi) {
    const pc = ((midi % 12) + 12) % 12;
    // High e and low E share the name "E" — caller decides case via string index
    return NOTE_NAMES[pc];
  }

  // ===========================================================================
  // §11 · BUILT-IN 2D RENDERERS
  // Jumping-Tab fallback (makeBuiltin2DRenderer), Tab, Notation. Draw #slopscale-canvas.
  // ===========================================================================
  function makeBuiltin2DRenderer() {
    let canvas = null, ctx = null, W = 0, H = 0;
    const LEFT_PAD = 64, RIGHT_PAD = 28, TOP_PAD = 96, BOTTOM_PAD = 52;
    const AHEAD = 8, BEHIND = 1.5;

    function resize() {
      if (!canvas) return;
      const box = canvas.parentElement || $('slopscale-render-host');
      const r = box ? box.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
      W = Math.max(640, Math.round(r.width || 1280));
      H = Math.max(420, Math.round(r.height || 720));
      canvas.width = W;
      canvas.height = H;
    }
    function laneY(s, count, inverted) {
      const top = TOP_PAD, bottom = H - BOTTOM_PAD;
      const visualIndex = inverted ? s : (count - 1 - s);
      return bottom - (visualIndex * ((bottom - top) / Math.max(1, count - 1)));
    }
    function xForDt(dt) {
      return LEFT_PAD + ((dt + BEHIND) / (AHEAD + BEHIND)) * (W - LEFT_PAD - RIGHT_PAD);
    }
    function inWindow(t, now) { const dt = t - now; return dt >= -BEHIND && dt <= AHEAD; }

    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#08111f'); grad.addColorStop(1, '#050711');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    }

    function drawAnchorZones(bundle, now) {
      // Anchor zones: subtle highlighted vertical bands showing the current fret window
      const anchors = bundle.anchors || [];
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i], next = anchors[i + 1];
        const aStart = a.time, aEnd = next ? next.time : (bundle.songInfo?.duration || aStart + 1);
        if (aEnd < now - BEHIND || aStart > now + AHEAD) continue;
        const x1 = xForDt(Math.max(-BEHIND, aStart - now));
        const x2 = xForDt(Math.min(AHEAD, aEnd - now));
        ctx.fillStyle = 'rgba(96,165,250,0.04)';
        ctx.fillRect(x1, TOP_PAD - 6, Math.max(2, x2 - x1), H - TOP_PAD - BOTTOM_PAD + 12);
      }
    }

    function drawStringLanes(nStr, inverted, openMidis) {
      ctx.lineWidth = 1;
      for (let s = 0; s < nStr; s++) {
        const y = laneY(s, nStr, inverted);
        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx.beginPath(); ctx.moveTo(LEFT_PAD - 4, y); ctx.lineTo(W - RIGHT_PAD, y); ctx.stroke();
        const col = STRING_COLORS[s] || '#94a3b8';
        ctx.fillStyle = col;
        ctx.font = '700 13px system-ui';
        const label = openMidis ? stringLabelForMidi(openMidis[s]) : `S${s + 1}`;
        // high e (highest string) is lowercase by convention; low E stays uppercase
        const display = (s === nStr - 1 && label === 'E') ? 'e' : label;
        ctx.fillText(display, 14, y + 5);
      }
    }

    function drawBeatsAndPlayhead(bundle, now) {
      for (const b of bundle.beats || []) {
        const dt = b.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.strokeStyle = b.measure >= 0 ? 'rgba(96,165,250,0.55)' : 'rgba(148,163,184,0.18)';
        ctx.lineWidth = b.measure >= 0 ? 1.4 : 1;
        ctx.beginPath(); ctx.moveTo(x, TOP_PAD - 24); ctx.lineTo(x, H - BOTTOM_PAD + 6); ctx.stroke();
        if (b.measure >= 0) {
          ctx.fillStyle = '#93c5fd';
          ctx.font = '11px system-ui';
          ctx.fillText(String(b.measure), x + 4, TOP_PAD - 30);
        }
      }
      const playX = xForDt(0);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(playX, TOP_PAD - 36); ctx.lineTo(playX, H - BOTTOM_PAD + 6); ctx.stroke();
      // Playhead triangle
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(playX - 6, TOP_PAD - 38);
      ctx.lineTo(playX + 6, TOP_PAD - 38);
      ctx.lineTo(playX, TOP_PAD - 30);
      ctx.closePath();
      ctx.fill();
    }

    function drawBackingChords(bundle, now) {
      for (const ev of bundle.backingEvents || []) {
        if (!ev.name) continue; // boogie emits many nameless hits per bar — one label/bar
        const dt = ev.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.fillStyle = 'rgba(250,204,21,0.12)';
        ctx.fillRect(x - 42, 22, 84, 26);
        ctx.strokeStyle = 'rgba(250,204,21,0.45)';
        ctx.strokeRect(x - 42, 22, 84, 26);
        ctx.fillStyle = '#fde68a';
        ctx.font = '700 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(ev.name, x, 39);
        ctx.textAlign = 'left';
      }
    }

    function drawChordTiles(bundle, now) {
      for (const ch of bundle.chords || []) {
        const dt = ch.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        const name = bundle.chordTemplates?.[ch.id]?.displayName || bundle.chordTemplates?.[ch.id]?.name || '';
        ctx.fillStyle = 'rgba(168,85,247,0.18)';
        ctx.fillRect(x - 38, 52, 76, 22);
        ctx.strokeStyle = 'rgba(168,85,247,0.75)';
        ctx.strokeRect(x - 38, 52, 76, 22);
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '700 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, 68);
        ctx.textAlign = 'left';
      }
    }

    function drawSectionMarkers(bundle, now) {
      for (const sec of bundle.sections || []) {
        const dt = sec.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.strokeStyle = 'rgba(244,114,182,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, H - BOTTOM_PAD + 8); ctx.lineTo(x, H - BOTTOM_PAD + 22); ctx.stroke();
        ctx.fillStyle = '#fbcfe8';
        ctx.font = '700 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(sec.name || '·', x, H - BOTTOM_PAD + 36);
        ctx.textAlign = 'left';
      }
    }

    function techniqueGlyph(n) {
      if (n.ho) return 'h';
      if (n.po) return 'p';
      if (n.hm) return '◇'; // harmonic
      if (n.pm) return 'PM';
      if (n.mt) return 'x'; // dead/muted
      if (n.tr) return '~~';
      if (n.vb) return '~';
      if (n.tp) return 'T';
      if ((n.sl || -1) >= 0) return '/';
      if ((n.bn || 0) > 0) return `b${n.bn}`;
      return '';
    }

    function drawNotes(bundle, now, nStr, inverted) {
      for (const n of bundle.notes || []) {
        const dt = n.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        const y = laneY(n.s, nStr, inverted);
        const col = STRING_COLORS[n.s] || '#94a3b8';

        // sustain bar
        if ((n.sus || 0) > 0) {
          const x2 = xForDt(dt + n.sus);
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 9;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.min(W - RIGHT_PAD, x2), y); ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // accent halo
        if (n.ac) {
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.18;
          ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }

        // dead note: hollow X instead of fret-number tile
        if (n.mt) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 10, y - 10); ctx.lineTo(x - 10, y + 10); ctx.stroke();
        } else {
          // note tile
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.roundRect(x - 17, y - 13, 34, 26, 7); ctx.fill();
          ctx.strokeStyle = n.ac ? '#f8fafc' : 'rgba(248,250,252,0.5)';
          ctx.lineWidth = n.ac ? 3 : 1.2;
          ctx.stroke();
          ctx.fillStyle = '#020617';
          ctx.font = '800 14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(String(n.f), x, y + 5);
        }

        // palm mute under-bracket
        if (n.pm) {
          ctx.strokeStyle = 'rgba(248,250,252,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x - 12, y + 18); ctx.lineTo(x - 12, y + 14); ctx.lineTo(x + 12, y + 14); ctx.lineTo(x + 12, y + 18); ctx.stroke();
        }

        // technique glyph above the note
        const glyph = techniqueGlyph(n);
        if (glyph) {
          ctx.fillStyle = '#fde68a';
          ctx.font = '700 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(glyph, x, y - 18);
        }
        ctx.textAlign = 'left';
      }
    }

    function drawHud(bundle, now) {
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '700 14px system-ui';
      ctx.fillText(bundle.songInfo?.title || 'SlopScale', 14, 22);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui';
      const dur = bundle.songInfo?.duration || 0;
      ctx.fillText(`${now.toFixed(2)}s / ${dur.toFixed(2)}s`, 14, 42);
    }

    function draw(bundle) {
      if (!ctx || !bundle) return;
      resize();
      const now = bundle.currentTime || 0;
      const nStr = Math.max(1, bundle.stringCount || 6);
      const inverted = !!bundle.inverted;
      const openMidis = bundle.openMidis || null;

      drawBackground();
      drawAnchorZones(bundle, now);
      drawStringLanes(nStr, inverted, openMidis);
      drawBeatsAndPlayhead(bundle, now);
      drawBackingChords(bundle, now);
      drawChordTiles(bundle, now);
      drawSectionMarkers(bundle, now);
      drawNotes(bundle, now, nStr, inverted);
      drawHud(bundle, now);
    }

    return {
      init(c) { canvas = c; ctx = c.getContext('2d'); resize(); window.addEventListener('resize', resize); },
      draw,
      resize,
      destroy() { window.removeEventListener('resize', resize); canvas = null; ctx = null; }
    };
  }

  function makeBuiltin2DTabRenderer() {
    // Standard guitar-tab look: paper background, string lines, fret numbers
    // sitting on the strings with the line broken behind each number, plain
    // bar lines, chord names above the staff, HOPO arcs, slides and bends as
    // inline glyphs. Light/dark theme via getRenderTheme().
    let canvas = null, ctx = null, W = 0, H = 0;
    let hopoPairs = [];
    let t = RENDER_THEMES.light;  // refreshed at the top of each draw()
    const LEFT_PAD = 56, RIGHT_PAD = 20;
    let AHEAD = 5, BEHIND = 1.5;  // view window (seconds); set per draw, beat-relative
    const BAR_LEAD = 13;          // px the bar line sits left of its downbeat note

    function resize() {
      if (!canvas) return;
      const r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(640, Math.round(r.width || 1280));
      H = Math.max(280, Math.round(r.height || 480));
      canvas.width = W; canvas.height = H;
    }
    function staffMetrics(nStr) {
      // Staff occupies the vertical center with comfortable padding.
      // Lane gap stays in a readable range regardless of canvas size.
      const gap = Math.max(14, Math.min(22, Math.floor(H / (nStr + 6))));
      const staffH = gap * (nStr - 1);
      const top = Math.floor((H - staffH) / 2);
      return { gap, top, bottom: top + staffH };
    }
    function laneY(s, nStr, top, gap) {
      // s=0 is low E (lowest pitch); standard tab puts low E at the bottom,
      // high e at the top — so map s=0 → bottom, s=nStr-1 → top.
      return top + (nStr - 1 - s) * gap;
    }
    function xForDt(dt) {
      return LEFT_PAD + ((dt + BEHIND) / (AHEAD + BEHIND)) * (W - LEFT_PAD - RIGHT_PAD);
    }
    function preprocess(notes) {
      hopoPairs = [];
      const sorted = [...notes].sort((a, b) => a.t - b.t);
      for (let i = 0; i < sorted.length; i++) {
        if (!sorted[i].ho && !sorted[i].po) continue;
        for (let j = i - 1; j >= 0; j--) {
          if (sorted[j].s === sorted[i].s) {
            hopoPairs.push({ from: sorted[j], to: sorted[i], isHo: !!sorted[i].ho });
            break;
          }
        }
      }
    }
    function drawBackground() {
      ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
    }
    function drawStaff(nStr, top, gap, openMidis) {
      ctx.strokeStyle = t.ink; ctx.lineWidth = 1;
      for (let s = 0; s < nStr; s++) {
        const y = laneY(s, nStr, top, gap);
        ctx.beginPath(); ctx.moveTo(LEFT_PAD, y); ctx.lineTo(W - RIGHT_PAD, y); ctx.stroke();
      }
      // Left-edge string-tuning labels (e.g. e B G D A E).
      ctx.fillStyle = t.ink; ctx.font = '600 11px "Cambria","Georgia",serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let s = 0; s < nStr; s++) {
        const y = laneY(s, nStr, top, gap);
        const label = openMidis ? stringLabelForMidi(openMidis[s]) : `S${s+1}`;
        const display = (s === nStr - 1 && label === 'E') ? 'e' : label;
        ctx.fillText(display, LEFT_PAD - 8, y);
      }
      ctx.textBaseline = 'alphabetic';
      // "TAB" letter stack at the left, mimicking a clef position.
      const midY = (top + (top + gap * (nStr - 1))) / 2;
      ctx.fillStyle = t.ink; ctx.font = 'italic 700 18px "Cambria","Georgia",serif';
      ctx.textAlign = 'center';
      ctx.fillText('T', LEFT_PAD - 28, midY - gap * 0.9);
      ctx.fillText('A', LEFT_PAD - 28, midY + gap * 0.2);
      ctx.fillText('B', LEFT_PAD - 28, midY + gap * 1.3);
      ctx.textAlign = 'left';
    }
    function drawBarLines(bundle, now, nStr, top, gap) {
      const yTop = laneY(nStr - 1, nStr, top, gap);
      const yBot = laneY(0, nStr, top, gap);
      ctx.strokeStyle = t.ink; ctx.fillStyle = t.dim;
      for (const b of bundle.beats || []) {
        const dt = b.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        // Bar line sits just left of the downbeat so the downbeat note lands
        // after it — standard tab (notes lie between bar lines, not on them).
        const x = xForDt(dt) - BAR_LEAD;
        if (b.measure >= 0) {
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
          ctx.font = '10px "Cambria","Georgia",serif';
          ctx.fillText(String(b.measure), x + 3, yTop - 6);
        }
      }
    }
    function drawPlayhead(top, gap, nStr) {
      const x = xForDt(0);
      const yTop = laneY(nStr - 1, nStr, top, gap);
      const yBot = laneY(0, nStr, top, gap);
      ctx.strokeStyle = t.playhead; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, yTop - 14); ctx.lineTo(x, yBot + 8); ctx.stroke();
    }
    function drawChordNames(bundle, now, top) {
      ctx.fillStyle = t.chordName; ctx.font = 'italic 600 13px "Cambria","Georgia",serif';
      ctx.textAlign = 'center';
      for (const ch of bundle.chords || []) {
        const dt = ch.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const name = bundle.chordTemplates?.[ch.id]?.displayName || bundle.chordTemplates?.[ch.id]?.name || '';
        if (!name) continue;
        ctx.fillText(name, xForDt(dt), top - 16);
      }
      ctx.textAlign = 'left';
    }
    function drawSectionMarkers(bundle, now, top, gap, nStr) {
      const yBot = laneY(0, nStr, top, gap);
      ctx.fillStyle = t.sectionLabel; ctx.font = 'italic 600 11px "Cambria","Georgia",serif';
      ctx.textAlign = 'center';
      for (const sec of bundle.sections || []) {
        const dt = sec.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        ctx.fillText(sec.name || '·', xForDt(dt), yBot + 22);
      }
      ctx.textAlign = 'left';
    }
    function drawHopoPairs(now, nStr, top, gap) {
      ctx.strokeStyle = t.hopo; ctx.fillStyle = t.hopo;
      for (const p of hopoPairs) {
        const dtFrom = p.from.t - now, dtTo = p.to.t - now;
        if (dtFrom < -BEHIND - 0.1 || dtTo > AHEAD + 0.1 || p.from.s !== p.to.s) continue;
        const x1 = xForDt(dtFrom), x2 = xForDt(dtTo);
        const y = laneY(p.from.s, nStr, top, gap);
        const arcH = Math.min(10, Math.max(5, (x2 - x1) * 0.25));
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y - 6);
        ctx.quadraticCurveTo((x1 + x2) / 2, y - 6 - arcH, x2, y - 6); ctx.stroke();
        ctx.font = 'italic 600 9px "Cambria","Georgia",serif'; ctx.textAlign = 'center';
        ctx.fillText(p.isHo ? 'h' : 'p', (x1 + x2) / 2, y - 6 - arcH - 2);
        ctx.textAlign = 'left';
      }
    }
    function drawSustainTie(x, y, x2) {
      // A short horizontal tie line on the string, drawn in ink with the
      // string line still visible beneath — minimal styling.
      ctx.strokeStyle = t.ink; ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y); ctx.stroke();
      ctx.setLineDash([]);
    }
    function drawNotes(bundle, now, nStr, top, gap) {
      ctx.fillStyle = t.ink;
      const fontSize = Math.max(11, Math.min(14, gap - 4));
      for (const n of bundle.notes || []) {
        const dt = n.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt), y = laneY(n.s, nStr, top, gap);
        const fretText = n.mt ? 'x' : String(n.f);
        // "Erase" the string line behind the fret number so the digit reads cleanly.
        ctx.font = `700 ${fontSize}px ui-monospace,"Consolas","Courier New",monospace`;
        const tw = ctx.measureText(fretText).width;
        ctx.fillStyle = t.bg; ctx.fillRect(x - tw/2 - 2, y - fontSize/2 - 1, tw + 4, fontSize + 2);
        ctx.fillStyle = t.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fretText, x, y);
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

        // Sustain tie — dashed line continuing on the string for the duration.
        if ((n.sus || 0) > 0 && !n.mt) {
          const x2 = Math.min(W - RIGHT_PAD, xForDt(dt + n.sus));
          drawSustainTie(x + tw/2 + 3, y, x2);
        }
        // Slide indicator: small "/" or "\" after the fret number.
        if ((n.sl ?? -1) >= 0 && !n.mt) {
          const ch = n.sl > n.f ? '/' : '\\';
          ctx.font = `600 ${fontSize}px "Cambria","Georgia",serif`;
          ctx.fillStyle = t.ink; ctx.fillText(ch, x + tw/2 + 3, y + 3);
        }
        // Bend — caret + label above the note.
        if ((n.bn || 0) > 0 && !n.mt) {
          ctx.font = '600 9px "Cambria","Georgia",serif'; ctx.fillStyle = t.bend;
          ctx.textAlign = 'center';
          ctx.fillText(`b ${bendLabel(n.bn)}`, x, y - gap * 0.6);
          ctx.textAlign = 'left';
        }
        // Palm-mute bracket above the note.
        if (n.pm) {
          ctx.strokeStyle = t.ink; ctx.lineWidth = 1;
          const px = x, py = y - gap * 0.5;
          ctx.beginPath(); ctx.moveTo(px - 4, py + 4); ctx.lineTo(px - 4, py); ctx.lineTo(px + 4, py); ctx.lineTo(px + 4, py + 4); ctx.stroke();
          ctx.fillStyle = t.ink; ctx.font = '600 8px "Cambria","Georgia",serif';
          ctx.textAlign = 'center'; ctx.fillText('P.M.', px, py - 2); ctx.textAlign = 'left';
        }
        // Vibrato / tremolo glyph above the note.
        if (n.vb || n.tr) {
          ctx.fillStyle = t.ink; ctx.font = `600 ${fontSize}px "Cambria","Georgia",serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.tr ? '≈' : '~', x, y - gap * 0.55);
          ctx.textAlign = 'left';
        }
        // Harmonic: angle-brackets around the fret number — redraw with brackets.
        if ((n.hm || n.hp) && !n.mt) {
          ctx.fillStyle = t.ink; ctx.font = `700 ${fontSize}px "Cambria","Georgia",serif`;
          ctx.textAlign = 'center';
          ctx.fillText('〈', x - tw/2 - 3, y + 4);
          ctx.fillText('〉', x + tw/2 + 3, y + 4);
          ctx.textAlign = 'left';
        }
        // Pinch harmonic gets a "P.H." label above the bracketed fret.
        if (n.hp && !n.mt) {
          ctx.fillStyle = t.ink; ctx.font = '600 8px "Cambria","Georgia",serif';
          ctx.textAlign = 'center'; ctx.fillText('P.H.', x, y - gap * 0.55); ctx.textAlign = 'left';
        }
        // Tap — "T" above the note (tapping technique).
        if (n.tp && !n.mt) {
          ctx.fillStyle = t.ink; ctx.font = '700 10px "Cambria","Georgia",serif';
          ctx.textAlign = 'center'; ctx.fillText('T', x, y - gap * 0.6); ctx.textAlign = 'left';
        }
        // Accent — ">" above the note.
        if (n.ac && !n.mt) {
          ctx.fillStyle = t.ink; ctx.font = '800 11px "Cambria","Georgia",serif';
          ctx.textAlign = 'center'; ctx.fillText('>', x, y - gap * 0.9); ctx.textAlign = 'left';
        }
      }
    }
    function drawHud(bundle) {
      // Title only — the single timer lives in the player HUD (top-right).
      ctx.fillStyle = t.dim; ctx.font = 'italic 600 12px "Cambria","Georgia",serif';
      ctx.fillText(bundle.songInfo?.title || 'SlopScale', 12, 18);
    }
    function draw(bundle) {
      if (!ctx || !bundle) return;
      resize();
      t = getRenderTheme();
      const now = bundle.currentTime || 0, nStr = Math.max(1, bundle.stringCount || 6);
      // Beat-relative window: ~6.8 beats across the view at any tempo, so note
      // density (≈ px per beat) stays comfortable and consistent — fast tempos
      // no longer cram. Constant within a chart → scroll speed unchanged.
      const winBeat = chartBeatSeconds(bundle);
      AHEAD = Math.max(2.5, Math.min(6, winBeat * 5));
      BEHIND = Math.max(0.9, Math.min(2.2, winBeat * 1.8));
      const { gap, top } = staffMetrics(nStr);
      drawBackground();
      drawHud(bundle, now);
      drawChordNames(bundle, now, top);
      drawStaff(nStr, top, gap, bundle.openMidis || null);
      drawBarLines(bundle, now, nStr, top, gap);
      drawHopoPairs(now, nStr, top, gap);
      drawNotes(bundle, now, nStr, top, gap);
      drawSectionMarkers(bundle, now, top, gap, nStr);
      drawPlayhead(top, gap, nStr);
    }
    return {
      init(c, bundle) { canvas = c; ctx = c.getContext('2d'); resize(); window.addEventListener('resize', resize); if (bundle?.notes) preprocess(bundle.notes); },
      draw, resize,
      destroy() { window.removeEventListener('resize', resize); canvas = null; ctx = null; }
    };
  }

  function makeBuiltin2DNotationRenderer() {
    // Standard staff notation: treble clef for guitar (8va transposing) or
    // bass clef for bass. Key signature, note heads, stems, beams (8th/16th
    // groups), ledger lines, accidentals. Light/dark theme via
    // getRenderTheme() — light is the parchment-and-ink look that matches
    // the Tab renderer; dark is a navy ground with white ink.
    let canvas = null, ctx = null, W = 0, H = 0;
    let beatDur = 0.5, numAcc = 0, isFlats = false, isBass = false;
    let ksAlter = {}, beamGroups = [];
    let mode = 'both'; // 'both' | 'tab' | 'notation'
    let t = RENDER_THEMES.light;  // refreshed at the top of each draw()
    const LEFT_PAD = 68, RIGHT_PAD = 24;
    let AHEAD = 5, BEHIND = 1.5;   // view window (seconds); set per draw, beat-relative
    const STAFF_LEFT = 6;          // staff/tab lines begin here (clef sits on them)
    const BAR_LEAD = 13;           // px the bar line sits left of its downbeat note
    let contentLeft = LEFT_PAD;    // x where note content starts; set per draw so
                                   // the clef + key signature get room on the staff

    function resize() {
      if (!canvas) return;
      const r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(640, Math.round(r.width || 1280));
      H = Math.max(500, Math.round(r.height || 720));
      canvas.width = W; canvas.height = H;
    }
    function xForDt(dt) {
      return contentLeft + ((dt + BEHIND) / (AHEAD + BEHIND)) * (W - contentLeft - RIGHT_PAD);
    }

    // ── Pitch / staff mapping ────────────────────────────────────────────
    // Each pitch class spells to a staff LETTER (0=C..6=B) + chromatic alter.
    // Sharp keys spell black keys as lower-letter+sharp (C#); flat keys as
    // upper-letter+flat (Db) so flat-key notation reads correctly — e.g. Bb
    // sits on the B line, not the A line.
    const SHARP_SPELL = [[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
    const FLAT_SPELL  = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];
    // Guitar/bass are 8va transposing: display pitch = sounding + 12.
    // Treble bottom line = E4; bass bottom line = G2 (clef-base offsets below).
    function spellMidi(soundingMidi) {
      const written = soundingMidi + 12;
      const pc = ((written % 12) + 12) % 12;
      const oct = Math.floor(written / 12) - 1;
      const [letter, alter] = (isFlats ? FLAT_SPELL : SHARP_SPELL)[pc];
      const step = (oct * 7 + letter) - (isBass ? (2 * 7 + 4) : (4 * 7 + 2));
      return { step, alter, letter };
    }
    function midiToStep(soundingMidi) { return spellMidi(soundingMidi).step; }
    function stepToY(step, bottomY, ls) { return bottomY - step * (ls / 2); }

    // Key-signature alteration per staff letter (0=C..6=B): +1 sharp, -1 flat.
    const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
    const FLAT_LETTERS  = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F
    function keySigLetterAlter() {
      const map = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const n = Math.min(Math.abs(numAcc), 7);
      const order = numAcc >= 0 ? SHARP_LETTERS : FLAT_LETTERS;
      const alt = numAcc >= 0 ? 1 : -1;
      for (let i = 0; i < n; i++) map[order[i]] = alt;
      return map;
    }
    // Accidental a note needs on the roll: null when the key signature already
    // accounts for it; else 'sharp' | 'flat' | 'natural' (natural cancels a
    // key-sig accidental on that letter, e.g. the raised 7th G# in A minor, or
    // an F♮ in G major).
    function noteAccidental(soundingMidi, ksAlter) {
      const { alter, letter } = spellMidi(soundingMidi);
      const sig = ksAlter[letter] || 0;
      if (alter === sig) return null;
      return alter > 0 ? 'sharp' : alter < 0 ? 'flat' : 'natural';
    }

    // ── Key signature ─────────────────────────────────────────────────────
    const KEY_ACC = {C:0,'C#':7,Db:-5,D:2,'D#':9,Eb:-3,E:4,F:-1,'F#':6,Gb:-6,G:1,'G#':8,Ab:-4,A:3,'A#':10,Bb:-2,B:5,Cb:-7};
    const T_SHARP=[8,5,9,6,3,7,4], T_FLAT=[4,7,3,6,2,5,1]; // treble staff steps
    const B_SHARP=[6,3,7,4,1,5,2], B_FLAT=[2,5,1,4,0,3,-1]; // bass staff steps
    const MODE_PARENT={dorian:-2,phrygian:-4,lydian:1,mixolydian:-1,locrian:-5,
      dorian_b2:-2,lydian_augmented:1,lydian_dominant:2,mixolydian_b6:-1,locrian_sharp2:-5,altered:-6,phrygian_dominant:-3};

    function resolveKeySig(key, scale) {
      const root = NOTE_ALIASES[key] ?? 0;
      if (scale === 'natural_minor' || scale === 'harmonic_minor' || scale === 'melodic_minor')
        return KEY_ACC[NOTE_NAMES[(root + 3) % 12]] ?? 0;
      if (scale in MODE_PARENT)
        return KEY_ACC[NOTE_NAMES[((root + MODE_PARENT[scale]) % 12 + 12) % 12]] ?? 0;
      return KEY_ACC[key] ?? 0; // major, pentatonic, blues → use tonic key
    }

    // ── Rhythm / beaming ─────────────────────────────────────────────────
    const NV = [
      {name:'whole',        beats:4,    filled:false,hasStem:false,flags:0},
      {name:'half',         beats:2,    filled:false,hasStem:true, flags:0},
      {name:'quarter',      beats:1,    filled:true, hasStem:true, flags:0},
      {name:'eighth',       beats:0.5,  filled:true, hasStem:true, flags:1},
      {name:'sixteenth',    beats:0.25, filled:true, hasStem:true, flags:2},
      {name:'thirtysecond', beats:0.125,filled:true, hasStem:true, flags:3},
    ];
    function quantize(dur) {
      const b = dur / beatDur;
      return NV.reduce((best, nv) => Math.abs(b - nv.beats) < Math.abs(b - best.beats) ? nv : best, NV[2]);
    }
    function buildBeamGroups(notes) {
      if (!beatDur) return [];
      const sorted = [...notes].sort((a, b) => a.t - b.t);
      const groups = []; let cur = null;
      for (const n of sorted) {
        const nv = quantize(n.sus || beatDur * 0.5);
        const beat = Math.floor((n.t + 0.0001) / beatDur);
        if (!nv.flags) { if (cur) { groups.push(cur); cur = null; } continue; }
        if (!cur || cur.beat !== beat) { if (cur) groups.push(cur); cur = {beat, notes:[n]}; }
        else cur.notes.push(n);
      }
      if (cur) groups.push(cur);
      return groups.filter(g => g.notes.length >= 2);
    }

    // ── Layout helpers ────────────────────────────────────────────────────
    // ls = staff line spacing in px. Cap it so the staff stays a sane size on
    // tall canvases — without the cap, ls scales with notH and the clef/staff
    // balloon to fill the window. Notation mode is notation-only (no tab pane).
    function staffLayout() {
      const ratio = mode === 'notation' ? 1.0 : mode === 'tab' ? 0 : 0.56;
      const notH = Math.floor(H * ratio);
      const ls = Math.max(8, Math.min(14, Math.floor(notH * 0.04)));
      const staffHeight = ls * 4;
      const bottomY = Math.floor((notH - staffHeight) / 2) + staffHeight;
      return { notH, ls, bottomY };
    }
    function tabLayout() {
      if (mode === 'tab') return { tabTop: Math.floor(H * 0.04), tabH: Math.floor(H * 0.88) };
      if (mode === 'notation') return { tabTop: 0, tabH: 0 };
      return { tabTop: Math.floor(H * 0.62), tabH: Math.floor(H * 0.38) };
    }
    function tabLaneY(s, nStr, tabTop, tabH) {
      const top = tabTop + tabH * 0.12, bottom = tabTop + tabH * 0.88;
      return top + (nStr - 1 - s) * ((bottom - top) / Math.max(1, nStr - 1));
    }

    // ── Backgrounds ───────────────────────────────────────────────────────
    // Flat ground in light mode (looks like paper), a soft gradient in dark
    // (gives the staff some depth on a low-contrast ink).
    function drawBg(notH, tabTop, tabH) {
      if (t.bg === t.bgAlt) {
        ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
      } else {
        const g = ctx.createLinearGradient(0,0,0,H);
        g.addColorStop(0, t.bgAlt); g.addColorStop(1, t.bg);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      // Divider between notation and (currently disabled) tab pane.
      if (mode === 'both' && tabH > 0) {
        ctx.strokeStyle = t.faintLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0,notH); ctx.lineTo(W,notH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,tabTop); ctx.lineTo(W,tabTop); ctx.stroke();
      }
    }

    // ── Staff lines ───────────────────────────────────────────────────────
    function drawStaff(bottomY, ls) {
      ctx.strokeStyle = t.ink; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = bottomY - i * ls;
        ctx.beginPath(); ctx.moveTo(STAFF_LEFT, y); ctx.lineTo(W - RIGHT_PAD, y); ctx.stroke();
      }
    }

    // ── Clef ─────────────────────────────────────────────────────────────
    // Unicode music-symbol glyphs are sized so that a font-size of roughly
    // 4–5× staff-line-spacing produces a properly-proportioned clef.
    function drawClef(bottomY, ls) {
      const ch = isBass ? '\u{1D122}' : '\u{1D11E}';
      const size = isBass ? ls * 4 : ls * 4.6;
      ctx.font = `${size}px "Segoe UI Symbol","Apple Symbols","Noto Symbols 2",serif`;
      ctx.fillStyle = t.ink; ctx.textAlign = 'left';
      // Vertically centre the glyph on the staff (middle line = bottomY - 2·ls)
      // using a middle baseline, then restore the default baseline so the rest
      // of the notation text isn't affected.
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 8, bottomY - ls * 2);
      ctx.textBaseline = 'alphabetic';
    }

    // ── Key signature ─────────────────────────────────────────────────────
    function drawKeySig(bottomY, ls) {
      const n = Math.min(Math.abs(numAcc), 7); if (!n) return;
      const steps = isFlats ? (isBass ? B_FLAT : T_FLAT) : (isBass ? B_SHARP : T_SHARP);
      const ch = isFlats ? '♭' : '♯';
      const x0 = STAFF_LEFT + ls * 3.2; // clear of the clef, on the staff
      ctx.fillStyle = t.keysig; ctx.font = `${ls*1.5}px serif`; ctx.textAlign = 'center';
      for (let i = 0; i < n; i++) ctx.fillText(ch, x0 + i*ls*1.0, stepToY(steps[i],bottomY,ls) + ls*0.4);
      ctx.textAlign = 'left';
    }

    // ── Bar lines ─────────────────────────────────────────────────────────
    function drawNotationBarLines(bundle, now, bottomY, ls) {
      const staffTop = bottomY - ls * 4;
      for (const b of bundle.beats || []) {
        if (b.measure < 0) continue;
        const dt = b.time - now; if (dt < -BEHIND || dt > AHEAD) continue;
        // Draw the bar line a hair LEFT of the downbeat so the downbeat note
        // sits just after it — standard engraving (notes lie between bar lines,
        // not on them). BAR_LEAD is the measure's small left margin.
        const x = xForDt(dt) - BAR_LEAD;
        ctx.strokeStyle = t.ink; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, staffTop); ctx.lineTo(x, bottomY); ctx.stroke();
        ctx.fillStyle = t.dim; ctx.font = '10px "Cambria","Georgia",serif'; ctx.fillText(String(b.measure), x+3, staffTop-4);
      }
    }

    // ── Note rendering ────────────────────────────────────────────────────
    function noteHead(x, y, nv, ls) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18);
      if (nv.filled) { ctx.fillStyle = t.noteFill; ctx.beginPath(); ctx.ellipse(0,0,ls*0.6,ls*0.42,0,0,Math.PI*2); ctx.fill(); }
      else { ctx.strokeStyle = t.noteOutline; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(0,0,ls*0.6,ls*0.42,0,0,Math.PI*2); ctx.stroke(); }
      ctx.restore();
    }
    function noteStemAndFlag(x, y, up, nv, ls) {
      const sx = x + (up ? ls*0.58 : -ls*0.58);
      const len = ls * 3.2;
      const tipY = y + (up ? -len : len);
      ctx.strokeStyle = t.stem; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, y + (up ? -ls*0.38 : ls*0.38)); ctx.lineTo(sx, tipY); ctx.stroke();
      if (nv.flags) {
        const dir = up ? 1 : -1;
        for (let f = 0; f < nv.flags; f++) {
          const fy = tipY + dir * f * ls * 0.55;
          ctx.beginPath(); ctx.moveTo(sx, fy);
          ctx.bezierCurveTo(sx+ls*1.1, fy+dir*ls*0.6, sx+ls*0.9, fy+dir*ls*1.3, sx+ls*0.15, fy+dir*ls*1.7);
          ctx.stroke();
        }
      }
      return { sx, tipY };
    }
    function ledgerLines(x, step, bottomY, ls) {
      const rw = ls * 0.7; ctx.strokeStyle = t.ledger; ctx.lineWidth = 1;
      for (let s = -2; s >= step; s -= 2) { const y = stepToY(s,bottomY,ls); ctx.beginPath(); ctx.moveTo(x-rw,y); ctx.lineTo(x+rw,y); ctx.stroke(); }
      for (let s = 10; s <= step; s += 2) { const y = stepToY(s,bottomY,ls); ctx.beginPath(); ctx.moveTo(x-rw,y); ctx.lineTo(x+rw,y); ctx.stroke(); }
    }
    function drawAccidental(x, y, type, ls) {
      const ch = type === 'sharp' ? '♯' : type === 'flat' ? '♭' : '♮';
      ctx.fillStyle = t.accidental; ctx.font = `bold ${ls*1.45}px serif`; ctx.textAlign = 'right';
      ctx.fillText(ch, x - ls*0.6, y + ls*0.42); ctx.textAlign = 'left';
    }

    // ── Beams ─────────────────────────────────────────────────────────────
    function beamedKeys() {
      const s = new Set();
      for (const g of beamGroups) for (const n of g.notes) s.add(`${n.t.toFixed(4)}|${n.s}`);
      return s;
    }
    function drawBeams(bundle, now, bottomY, ls, openMidis) {
      for (const grp of beamGroups) {
        const vis = grp.notes.filter(n => { const dt = n.t-now; return dt >= -BEHIND && dt <= AHEAD; });
        if (vis.length < 2) continue;
        const stems = vis.map(n => {
          const midi = (openMidis?.[n.s] ?? 40) + n.f;
          const step = midiToStep(midi);
          const hy = stepToY(step, bottomY, ls);
          const up = step < 4;
          const sx = xForDt(n.t - now) + (up ? ls*0.58 : -ls*0.58);
          const tipY = hy + (up ? -ls*3.2 : ls*3.2);
          return { sx, tipY, hy, up, nv: quantize(n.sus || beatDur*0.5) };
        });
        ctx.strokeStyle = t.beam; ctx.lineWidth = ls * 0.38; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(stems[0].sx, stems[0].tipY); ctx.lineTo(stems[stems.length-1].sx, stems[stems.length-1].tipY); ctx.stroke();
        if (stems.some(s => s.nv.flags >= 2)) {
          const off = stems[0].up ? ls*0.42 : -ls*0.42; ctx.lineWidth = ls*0.35;
          ctx.beginPath(); ctx.moveTo(stems[0].sx, stems[0].tipY+off); ctx.lineTo(stems[stems.length-1].sx, stems[stems.length-1].tipY+off); ctx.stroke();
        }
        ctx.strokeStyle = t.stem; ctx.lineCap = 'round'; ctx.lineWidth = 1.5;
        for (const sd of stems) { ctx.beginPath(); ctx.moveTo(sd.sx, sd.hy+(sd.up?-ls*0.38:ls*0.38)); ctx.lineTo(sd.sx, sd.tipY); ctx.stroke(); }
      }
    }

    // ── Draw all notation notes ───────────────────────────────────────────
    // Whole-bar rests for the count-in lead-in bars. A whole rest (a filled bar
    // hanging under the 2nd staff line from the top) denotes a full measure of
    // silence in any time signature, so it's meter-appropriate. Only the lead-in
    // bars get one — the music's own bars draw notes.
    function drawNotationRests(bundle, now, bottomY, ls) {
      const lead = bundle.leadIn || 0;
      if (lead <= 0) return;
      const downs = (bundle.beats || []).filter(b => (b.measure ?? -1) >= 0).map(b => b.time).sort((a, b) => a - b);
      const restW = ls * 0.95, restH = ls * 0.42, restTop = bottomY - 3 * ls; // hangs from the 4th line
      ctx.fillStyle = t.ink;
      for (let i = 0; i < downs.length; i++) {
        const d0 = downs[i];
        if (d0 >= lead - 1e-3) break;                       // lead-in bars only
        const d1 = (i + 1 < downs.length) ? Math.min(downs[i + 1], lead) : lead;
        const dt = (d0 + d1) / 2 - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        ctx.fillRect(xForDt(dt) - restW / 2, restTop, restW, restH);
      }
    }
    function drawNotationNotes(bundle, now, bottomY, ls, openMidis) {
      const bk = beamedKeys();
      drawBeams(bundle, now, bottomY, ls, openMidis);
      for (const n of (bundle.notes || [])) {
        const dt = n.t - now; if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        const midi = (openMidis?.[n.s] ?? 40) + n.f;
        const step = midiToStep(midi);
        const y = stepToY(step, bottomY, ls);
        const nv = quantize(n.sus || beatDur);
        const up = step < 4;
        ledgerLines(x, step, bottomY, ls);
        const acc = noteAccidental(midi, ksAlter);
        if (acc) drawAccidental(x, y, acc, ls);
        noteHead(x, y, nv, ls);
        if (nv.hasStem && !bk.has(`${n.t.toFixed(4)}|${n.s}`)) noteStemAndFlag(x, y, up, nv, ls);
      }
    }

    // ── Playhead ──────────────────────────────────────────────────────────
    function drawNotationPlayhead(notH, bottomY, ls) {
      const x = xForDt(0), staffTop = bottomY - ls*4;
      ctx.strokeStyle = t.playhead; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, staffTop-22); ctx.lineTo(x, notH-4); ctx.stroke();
      ctx.fillStyle = t.playhead;
      ctx.beginPath(); ctx.moveTo(x-5,staffTop-24); ctx.lineTo(x+5,staffTop-24); ctx.lineTo(x,staffTop-16); ctx.closePath(); ctx.fill();
    }

    // ── Tab section (only used if mode != 'notation'; currently always
    //    'notation' since the sub-toggle was removed, but kept for safety.) ──
    function drawTabSection(bundle, now) {
      const { tabTop, tabH } = tabLayout();
      const nStr = Math.max(1, bundle.stringCount || 6);
      const openMidis = bundle.openMidis || null;
      const topLane = tabLaneY(nStr-1, nStr, tabTop, tabH);
      const botLane = tabLaneY(0,       nStr, tabTop, tabH);
      for (let s = 0; s < nStr; s++) {
        const y = tabLaneY(s, nStr, tabTop, tabH);
        ctx.strokeStyle = t.faintLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(LEFT_PAD-4, y); ctx.lineTo(W-RIGHT_PAD, y); ctx.stroke();
        ctx.fillStyle = t.inkSoft; ctx.font = '600 11px "Cambria","Georgia",serif';
        const label = openMidis ? stringLabelForMidi(openMidis[s]) : `S${s+1}`;
        ctx.textAlign = 'right'; ctx.fillText((s===nStr-1&&label==='E')?'e':label, LEFT_PAD-10, y+4); ctx.textAlign = 'left';
      }
      ctx.fillStyle = t.dim; ctx.font = 'italic 700 11px "Cambria","Georgia",serif'; ctx.textAlign = 'right';
      ctx.fillText('TAB', LEFT_PAD-2, tabTop+tabH*0.5); ctx.textAlign = 'left';
      for (const b of bundle.beats || []) {
        if (b.measure < 0) continue;
        const dt = b.time - now; if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.strokeStyle = t.faintLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, topLane); ctx.lineTo(x, botLane); ctx.stroke();
      }
      for (const n of bundle.notes || []) {
        const dt = n.t - now; if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt), y = tabLaneY(n.s, nStr, tabTop, tabH);
        const fretText = n.mt ? 'x' : String(n.f);
        const pw = Math.max(14, fretText.length*8+4);
        ctx.fillStyle = t.bg; ctx.fillRect(x-pw/2, y-7, pw, 14);
        ctx.fillStyle = t.ink; ctx.font = '700 12px ui-monospace,monospace'; ctx.textAlign = 'center';
        ctx.fillText(fretText, x, y+5); ctx.textAlign = 'left';
      }
      const x = xForDt(0);
      ctx.strokeStyle = t.playhead; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, tabTop+4); ctx.lineTo(x, botLane+8); ctx.stroke();
    }

    // ── Chord names + section markers + HUD ──────────────────────────────
    // Plain italic chord names floating above the staff, no pill background
    // — matches the Tab renderer's typography.
    function drawChordNames(bundle, now, notH) {
      ctx.fillStyle = t.chordName; ctx.font = 'italic 600 13px "Cambria","Georgia",serif';
      ctx.textAlign = 'center';
      for (const ch of bundle.chords || []) {
        const dt = ch.t - now; if (dt < -BEHIND || dt > AHEAD) continue;
        const name = bundle.chordTemplates?.[ch.id]?.displayName || bundle.chordTemplates?.[ch.id]?.name || '';
        if (!name) continue;
        ctx.fillText(name, xForDt(dt), notH-12);
      }
      ctx.textAlign = 'left';
    }
    function drawSectionMarkers(bundle, now) {
      ctx.fillStyle = t.sectionLabel; ctx.font = 'italic 600 11px "Cambria","Georgia",serif';
      ctx.textAlign = 'center';
      for (const sec of bundle.sections || []) {
        const dt = sec.time - now; if (dt < -BEHIND || dt > AHEAD) continue;
        ctx.fillText(sec.name||'·', xForDt(dt), H-6);
      }
      ctx.textAlign = 'left';
    }
    function drawHud(bundle, now, notH) {
      // Title + clef only — the single timer lives in the player HUD (top-right).
      ctx.fillStyle = t.dim; ctx.font = 'italic 600 12px "Cambria","Georgia",serif';
      ctx.fillText(bundle.songInfo?.title||'SlopScale', 8, 18);
      ctx.font = '600 10px "Cambria","Georgia",serif';
      ctx.fillText(isBass ? 'Bass Clef (8va)' : 'Treble Clef (8va)', 8, notH-6);
    }

    // ── Main draw ─────────────────────────────────────────────────────────
    function draw(bundle) {
      if (!ctx || !bundle) return;
      resize();
      t = getRenderTheme();
      const now = bundle.currentTime || 0, openMidis = bundle.openMidis || null;
      // Beat-relative window (see Tab renderer): ~6.8 beats across the view at
      // any tempo for consistent, comfortable note density; constant within a
      // chart so the scroll speed is unchanged.
      const winBeat = chartBeatSeconds(bundle);
      AHEAD = Math.max(2.5, Math.min(6, winBeat * 5));
      BEHIND = Math.max(0.9, Math.min(2.2, winBeat * 1.8));
      const { notH, ls, bottomY } = staffLayout();
      const { tabTop, tabH } = tabLayout();
      // Reserve room for the clef + key signature so notes start clear of them.
      const nAcc = Math.min(Math.abs(numAcc), 7);
      contentLeft = (mode === 'tab')
        ? LEFT_PAD
        : Math.max(LEFT_PAD, Math.round(STAFF_LEFT + ls * 3.2 + nAcc * ls * 1.0 + ls * 1.6));
      drawBg(notH, tabTop, tabH);
      if (mode !== 'tab') {
        drawStaff(bottomY, ls);
        drawClef(bottomY, ls);
        drawKeySig(bottomY, ls);
        drawNotationBarLines(bundle, now, bottomY, ls);
        drawNotationRests(bundle, now, bottomY, ls);
        drawNotationNotes(bundle, now, bottomY, ls, openMidis);
        drawNotationPlayhead(notH, bottomY, ls);
        drawChordNames(bundle, now, notH);
      }
      if (mode !== 'notation') drawTabSection(bundle, now);
      drawSectionMarkers(bundle, now);
      drawHud(bundle, now, notH);
    }

    return {
      init(c, bundle) {
        canvas = c; ctx = c.getContext('2d'); resize(); window.addEventListener('resize', resize);
        if (!bundle) return;
        const cfg = bundle.config || {};
        beatDur = 60 / (cfg.bpm || 120);
        numAcc = resolveKeySig(cfg.key || 'C', cfg.scale || 'major');
        isFlats = numAcc < 0;
        ksAlter = keySigLetterAlter();
        isBass = bundle.songInfo?.arrangement === 'Bass' || (bundle.openMidis?.[0] ?? 40) < 36;
        beamGroups = buildBeamGroups(bundle.notes || []);
      },
      setMode(m) { mode = m; },
      draw, resize,
      destroy() { window.removeEventListener('resize', resize); canvas = null; ctx = null; }
    };
  }

  function loadScriptOnce(id, src) { return new Promise((resolve, reject) => { if (document.getElementById(id)) return resolve(); const s = document.createElement('script'); s.id = id; s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error(`Failed to load ${src}`)); document.head.appendChild(s); }); }
  // Piano Roll is groundwork only: gated to a future piano pathway and kept
  // disabled in the UI for now. When a piano pathway/instrument ships, return
  // true here (and reveal the Piano Roll view button) to enable it.
  function pianoPathwayActive() { return false; }

  // Borrow a host visualization plugin's renderer factory (registered as
  // window.slopsmithViz_<id>). Lazy-loads the host plugin script and polls
  // briefly for deferred registration — the host may register its global a tick
  // or two after onload fires. Returns null if it never registers so callers
  // can fall back to a built-in renderer.
  // ===========================================================================
  // §12 · RENDERER FACTORY + BORROWED HOST VIZ
  // resolveRendererFactory() selects/loads a renderer; borrowHostViz() lazy-loads
  // host viz plugins (highway_3d, jumpingtab, piano).
  // ===========================================================================
  async function borrowHostViz(globalName, scriptPath) {
    if (typeof window[globalName] === 'function') return window[globalName];
    let loaded = true;
    // If the script 404s / errors (the host doesn't ship this viz plugin — e.g.
    // a source checkout without the Desktop-bundled Jumping Tab/Piano), bail
    // immediately instead of polling 3s for a global that will never register.
    // Fast, clean fallback to the in-tree renderer.
    try { await loadScriptOnce('slopscale-viz-' + globalName, scriptPath); }
    catch (_) { loaded = false; }
    if (loaded) {
      // Loaded — but the host may register its global a tick or two after onload.
      const start = Date.now();
      while (typeof window[globalName] !== 'function' && Date.now() - start < 3000) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
    return typeof window[globalName] === 'function' ? window[globalName] : null;
  }

  async function resolveRendererFactory(kind) {
    // 'builtin_2d' is the Jumping Tab slot. We borrow the host's Jumping Tab
    // visualization, which adapts to 4–8 strings + bass on its own — so it also
    // serves as the bass/extended-range fallback for the 6-string-only 3D
    // highway (see attachRenderer). The in-tree 2D highway remains only as a
    // last-resort fallback if Jumping Tab can't load.
    if (kind === 'builtin_2d') {
      const f = await borrowHostViz('slopsmithViz_jumpingtab', '/api/plugins/jumpingtab/screen.js');
      return f ? { factory:f, label:'Jumping Tab' } : { factory:makeBuiltin2DRenderer, label:'2D Highway (fallback)' };
    }
    if (kind === 'tab_2d') return { factory:makeBuiltin2DTabRenderer, label:'Tab' };
    if (kind === 'notation_2d') return { factory:makeBuiltin2DNotationRenderer, label:'Notation' };
    // Piano Roll — groundwork; borrows the host Piano Highway viz. Reachable
    // only when pianoPathwayActive() (currently false).
    if (kind === 'piano_roll') {
      const f = await borrowHostViz('slopsmithViz_piano', '/api/plugins/piano/screen.js');
      return f ? { factory:f, label:'Piano Roll' } : { factory:makeBuiltin2DRenderer, label:'Piano Roll (unavailable)' };
    }
    if (kind === 'highway_3d') {
      const f = await borrowHostViz('slopsmithViz_highway_3d', '/api/plugins/highway_3d/screen.js');
      return f ? { factory:f, label:'3D Note Highway' } : { factory:makeBuiltin2DRenderer, label:'2D Highway (fallback)' };
    }
    return { factory:makeBuiltin2DRenderer, label:'2D Highway (default)' };
  }

  function replaceCanvas() { const host = $('slopscale-render-host'), old = $('slopscale-canvas'), canvas = document.createElement('canvas'); canvas.id = 'slopscale-canvas'; canvas.style.width = '100%'; canvas.style.height = '100%'; if (old && old.parentElement) old.replaceWith(canvas); else if (host) host.appendChild(canvas); const rect = (host || canvas).getBoundingClientRect(); canvas.width = Math.max(640, Math.round(rect.width || 1280)); canvas.height = Math.max(420, Math.round(rect.height || 720)); return canvas; }
  function stopAudio() { for (const n of audioNodes) { try { n.stop && n.stop(0); } catch {} try { n.disconnect && n.disconnect(); } catch {} } audioNodes = []; nextLoopAudioBase = 0; loopPasses = []; }

  // ── Continuous whole-chart loop scheduling ───────────────────────────────────
  // The seam between loop iterations is made gapless by scheduling the NEXT
  // pass's audio on the same AudioContext clock, slightly before the current
  // pass ends — never stopAudio()+restart. The last note's tail then rings
  // naturally into the first note of the repeat. The visual clock wraps by
  // phase-carry (see tick()), so neither audio nor playhead freezes at the seam.

  // Whether note/metronome/harmony audio is enabled for the active bundle.
  function loopAudioEnabled() {
    const audio = activeBundle?.config?.audio || readConfig().audio;
    return !!(audio && (audio.notes || audio.metronome || audio.harmony));
  }

  // Schedule the current pass starting at the live playhead and (re)set the
  // loop baseline. Used on play, seek, and re-anchor. Captures the nodes this
  // call created so the pass can later be pruned. Caller stops prior audio.
  function scheduleCurrentPassAndAnchor(delaySeconds) {
    const dur = activeBundle?.songInfo?.duration || 0;
    const before = audioNodes.length;
    const base = schedulePreviewAudio(activeBundle, currentPracticeTime, delaySeconds);
    if (base == null) { nextLoopAudioBase = 0; loopPasses = []; return; }
    const endCtx = base + (dur - currentPracticeTime);
    loopPasses = [{ endCtx, nodes: audioNodes.slice(before) }];
    nextLoopAudioBase = endCtx;
  }

  // Schedule one full music pass starting at nextLoopAudioBase. The pass covers
  // [leadIn, duration] — i.e. the music only, NOT the count-in lead-in — so the
  // count-in plays once on the first pass and every loop is music.
  function scheduleNextFullPass() {
    const dur = activeBundle?.songInfo?.duration || 0;
    const lead = activeBundle?.leadIn || 0;
    const contentLen = dur - lead;
    if (contentLen <= 0) return;
    const before = audioNodes.length;
    const base = schedulePreviewAudio(activeBundle, lead, Math.max(0, nextLoopAudioBase - audioCtx.currentTime));
    if (base == null) return;
    loopPasses.push({ endCtx: base + contentLen, nodes: audioNodes.slice(before) });
    nextLoopAudioBase += contentLen;
  }

  // Disconnect + drop one fully-finished pass per call (cheap, keeps >=1 pass).
  function pruneLoopPasses() {
    if (!audioCtx || loopPasses.length <= 1) return;
    if (loopPasses[0].endCtx + 0.5 >= audioCtx.currentTime) return; // keep ring-out tails
    const dead = loopPasses.shift();
    const set = new Set(dead.nodes);
    for (const n of dead.nodes) { try { n.disconnect(); } catch {} }
    audioNodes = audioNodes.filter(n => !set.has(n));
  }

  // Per-frame: pre-schedule the next pass before the current one ends, and
  // re-anchor if the loop audio fell out of sync (resumed from an A-B loop,
  // a seek that bypassed the anchor, or a long rAF stall). Called from tick()
  // only when no A-B segment loop is engaged.
  function maybeScheduleLoopAhead(nowMs) {
    if (!audioCtx || !activeBundle || !loopAudioEnabled()) return;
    const dur = activeBundle.songInfo?.duration || 0;
    if (dur <= 0) return;
    const ctxNow = audioCtx.currentTime;
    if (nextLoopAudioBase <= 0 || nextLoopAudioBase <= ctxNow) {
      // Out of sync — reschedule from the live playhead and realign the visual
      // clock. A brief lookahead here is fine: this only fires on a transition
      // (e.g. clearing an A-B loop), never at the steady-state loop seam.
      stopAudio();
      scheduleCurrentPassAndAnchor(AUDIO_LOOKAHEAD_SECONDS);
      playAnchorChartTime = currentPracticeTime;
      playAnchorMs = nowMs + AUDIO_LOOKAHEAD_SECONDS * 1000;
      return;
    }
    if (ctxNow + LOOP_SCHEDULE_AHEAD >= nextLoopAudioBase) scheduleNextFullPass();
    pruneLoopPasses();
  }
  function stopRenderer() { playing = false; stopAudio(); stopPitchTracker(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } if (renderer && typeof renderer.destroy === 'function') { try { renderer.destroy(); } catch (e) { console.warn('[SlopScale] renderer destroy failed', e); } } renderer = null; syncPlayButton(); }

  async function attachRenderer(exercise) {
    const cfg = exercise.session;
    // Honour saved renderer preference when the form hasn't been explicitly changed
    if (!cfg.renderer || cfg.renderer === 'highway_3d') {
      const saved = localStorage.getItem('slopscale.renderer');
      if (saved) cfg.renderer = saved;
    }
    // The host 3D Highway renders 4–8 strings (resolveStringCount + an 8-entry
    // palette), so guitar AND bass use it. Only fall back for counts it can't
    // handle (>8 — not currently producible in SlopScale, but defensive).
    if (cfg.renderer === 'highway_3d' && (cfg.stringCount || 6) > 8) cfg.renderer = 'builtin_2d';
    // Keep the view row in sync with what's ACTUALLY being rendered (including
    // the saved-pref restore and the bass/extended force above) so the
    // highlighted view button always matches the render.
    syncViewSwitcher(cfg.renderer);
    stopRenderer(); activeBundle = makeBundle(exercise); currentPracticeTime = 0;
    fretboardSyncRange();
    // The host 3D Highway projects chord-shape FRAMES onto the note lane (plus a
    // corner diagram + lane chord-name labels) straight from the chord data —
    // visually noisy, and it covers the first note of the upcoming bar. Hand the
    // highway a chord-free view of the bundle so the lane stays clean; SlopScale
    // draws its own small chord box (drawChordBoxFrame) on every view, including
    // 3D, for the chord reference. Other renderers get the full bundle.
    // bgReactive:false opts the highway out of its audio-reactive background
    // (slopsmith#650). SlopScale doesn't route audio through the host <audio>
    // element, so that analyser only ever fails + click-on-close for us. On a
    // host with #650 this disables it cleanly (the proper fix); on older hosts
    // the field is ignored (the screen-scoped patchAudioContextForSharing stub
    // still suppresses the click — Stage 2 removes that once #650 is the baseline).
    rendererBundle = (cfg.renderer === 'highway_3d')
      ? Object.assign({}, activeBundle, { chords: [], chordTemplates: [], bgReactive: false })
      : activeBundle;
    // Resolve the factory FIRST (a borrowed host viz can take up to ~3s to load),
    // THEN create the canvas — so the fresh canvas isn't sitting in the DOM through
    // that await window, where the just-torn-down prior renderer can detach it
    // (which left the fallback renderer's resize() reading a null parentElement).
    const resolved = await resolveRendererFactory(cfg.renderer);
    const canvas = replaceCanvas();
    renderer = resolved.factory();
    if (!renderer || typeof renderer.draw !== 'function') throw new Error('Selected renderer did not return a Slopsmith-compatible renderer object.');
    if (typeof renderer.init === 'function') { renderer.init(canvas, rendererBundle); if (renderer.readyPromise && typeof renderer.readyPromise.then === 'function') await renderer.readyPromise; }
    if (cfg.renderer === 'notation_2d') renderer?.setMode?.(notationMode);
    const rect = (canvas.parentElement || $('slopscale-render-host'))?.getBoundingClientRect() || { width: canvas.width, height: canvas.height };
    if (typeof renderer.resize === 'function') renderer.resize(Math.round(rect.width || canvas.width), Math.round(rect.height || canvas.height));
    const rendererStatus = $('slopscale-renderer-status'); if (rendererStatus) rendererStatus.textContent = resolved.label; drawOnce();
    resetTransportLoop();
  }

  function syncPlayButton() {
    const btn = $('slopscale-play');
    if (!btn) return;
    btn.classList.toggle('is-playing', !!playing);
    btn.textContent = playing ? '■ Stop' : '▶ Play';
    updateStartCta();
  }
  // First-run primed START CTA (Pathways mode): names the exercise + a short skill
  // hook from the goal, and mirrors the transport (START ⇄ STOP). The one lit primary
  // action on first paint; the preview stays static until pressed (no auto-play).
  function startSkillHook(pw) {
    if (!pw || !pw.goal) return '';
    const seg = pw.goal.split(/[—:.]/)[0].trim();
    return seg.length > 52 ? seg.slice(0, 50).trim() + '…' : seg;
  }
  function updateStartCta() {
    const cta = $('slopscale-start-cta'); if (!cta) return;
    const pw = activePathwayId && activePathwayId !== 'custom' ? PATHWAYS[activePathwayId] : null;
    const verb = $('slopscale-start-verb'), name = $('slopscale-start-name'), skill = $('slopscale-start-skill');
    if (verb) verb.textContent = playing ? '■ STOP' : '▶ START';
    if (name) name.textContent = pw ? pw.label : 'this exercise';
    if (skill) skill.textContent = pw ? startSkillHook(pw) : '';
    cta.classList.toggle('playing', !!playing);
  }
  // ── Live fretboard strip ──────────────────────────────────────────────────
  // A horizontal neck diagram docked under the highway that lights up the
  // currently-sounding notes — the highway shows WHEN, this shows WHERE the
  // shape sits on the neck. Ported + generalised from the host Fretboard View
  // plugin: any string count, SlopScale string colours, driven by our own clock.
  let fbCtx = null, fretboardOn = false;  // off by default; per-view toggle in JT + Notation
  let panelCollapsed = false;  // left settings panel show/hide (persisted)
  let rulerCtx = null;  // unified DAW timeline ruler (bars/beats + playhead + A–B loop)
  let fbFretLo = 0, fbFretHi = 12, fbPattern = [];  // zoomed fret window + unique pattern positions
  const FB_DOT_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
  const FB_DOUBLE_DOT = [12, 24];

  function fretboardStringCount() {
    return (activeBundle?.config?.stringCount) || (activeBundle?.openMidis?.length) || 6;
  }
  // Recompute the zoomed fret window + the exercise's unique note positions (the
  // "pattern") when the chart changes. The window hugs the pattern (±1 fret, with
  // a minimum span) so the shape fills/centres the strip instead of floating on a
  // sparse full neck — less eye travel to reference the current note.
  function fretboardSyncRange() {
    const notes = activeBundle?.notes || [];
    let lo = Infinity, hi = -Infinity; const seen = new Set(); fbPattern = [];
    for (const n of notes) {
      if (n.f < 0) continue;
      if (n.f < lo) lo = n.f;
      if (n.f > hi) hi = n.f;
      const k = n.s + ':' + n.f;
      if (!seen.has(k)) { seen.add(k); fbPattern.push({ s: n.s, f: n.f }); }
    }
    if (!isFinite(lo)) { lo = 0; hi = 12; }
    lo = Math.max(0, lo - 1); hi = Math.min(24, hi + 1);
    const MIN_SPAN = 6;
    if (hi - lo < MIN_SPAN) hi = Math.min(24, lo + MIN_SPAN);
    if (hi - lo < MIN_SPAN) lo = Math.max(0, hi - MIN_SPAN);
    fbFretLo = lo; fbFretHi = hi;
  }
  // Jam target-highlight: which pitch classes to light on the strip right now, given
  // the Highlight mode (chord tones / guide tones / scale / off) and the chord at the
  // playhead (from the enriched backing events). The teaching mirror.
  let jamHighlightMode = 'chord';   // chord | guide | scale | off
  try { const m = localStorage.getItem('slopscale.jamHighlight'); if (m) jamHighlightMode = m; } catch (_) {}
  function jamTargetPcs(t) {
    if (jamHighlightMode === 'off' || !activeBundle) return null;
    if (jamHighlightMode === 'scale') {
      const cfg = activeBundle.config; if (!cfg) return null;
      const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
      const ivs = SCALE_INTERVALS[cfg.scale] || [];
      return ivs.length ? new Set(ivs.map(i => (keyPc + i) % 12)) : null;
    }
    // chord / guide — the most recent backing chord at or before the playhead.
    const evs = activeBundle.backingEvents || [];
    let cur = null;
    for (const e of evs) { if (e.t > t + 1e-6) break; if (e.cpcs) cur = e; }
    if (!cur) return null;
    const pcs = jamHighlightMode === 'guide' ? cur.gpcs : cur.cpcs;
    return (pcs && pcs.length) ? new Set(pcs) : null;
  }
  // Notes sounding within ~80ms of the playhead, with a sustain-based fade.
  function fretboardActiveNotes(t) {
    const out = [], win = 0.08, notes = activeBundle?.notes || [];
    for (const n of notes) {
      if (n.t > t + 0.5) break;            // notes are time-sorted
      const end = n.t + (n.sus || 0);
      if (n.t <= t + win && end >= t - win) {
        let alpha = 1;
        if (n.sus > 0 && t > n.t) alpha = Math.max(0.3, 1 - (t - n.t) / n.sus * 0.7);
        out.push({ s: n.s, f: n.f, alpha });
      }
    }
    return out;
  }
  // Reflect the toggle state onto the root class (drives strip visibility) and
  // the toggle button. The strip only actually appears when the active renderer
  // is also fretboard-capable (see syncViewSwitcher's .slopscale-fb-capable).
  function syncFretboardUI() {
    $('slopscale-root')?.classList.toggle('slopscale-fb-on', fretboardOn);
    $('slopscale-fretboard-toggle')?.setAttribute('aria-checked', String(fretboardOn));
  }
  // Reflect the keep-looping state onto its toggle (visibility is CSS, per mode).
  function syncKeepLoopUI() {
    $('slopscale-keeploop-toggle')?.setAttribute('aria-checked', String(keepLooping));
  }
  // Reflect the active swing/feel (hidden #slopscale-swing) onto the visible
  // Feel segmented control.
  function syncFeelControl() {
    const v = ($('slopscale-swing')?.value) || 'straight';
    document.querySelectorAll('.slopscale-feel-btn').forEach(b => {
      const on = b.dataset.feel === v;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  // Left settings panel collapse/expand. Reflects state onto the root class
  // (drives the layout) and the chevron button (glyph + a11y).
  function syncPanelToggle() {
    $('slopscale-root')?.classList.toggle('slopscale-collapsed', panelCollapsed);
    // Setup|Play segmented control: Play == collapsed (rail hidden, stage widened).
    document.querySelectorAll('.slopscale-modeview-btn').forEach(b => {
      const on = (b.dataset.modeview === 'play') === panelCollapsed;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function setPanelCollapsed(v) {
    panelCollapsed = !!v;  // session-only; startup/selection always resets to expanded
    syncPanelToggle();
    // The render-host width changed — re-fit the active renderer so a borrowed
    // viz re-lays-out instead of stretching its old canvas (mirrors the
    // fretboard-strip toggle).
    if (renderer && typeof renderer.resize === 'function') {
      const host = $('slopscale-render-host');
      if (host) { const r = host.getBoundingClientRect(); renderer.resize(Math.round(r.width), Math.round(r.height)); }
    }
    drawOnce();
  }
  // ── Focus mode (fullscreen the stage) ──────────────────────────────────────
  // Fullscreens just the .slopscale-stage (transport + ruler + render) so the
  // host chrome drops away. requestFullscreen needs a user gesture (the click
  // provides it); Esc exits via the browser before the host's Escape handler.
  function toggleFocus() {
    const stage = document.querySelector('.slopscale-stage');
    if (!stage) return;
    if (!document.fullscreenElement) { try { stage.requestFullscreen?.(); } catch (_) {} }
    else { try { document.exitFullscreen?.(); } catch (_) {} }
  }
  function onFullscreenChange() {
    const on = !!document.fullscreenElement;
    $('slopscale-root')?.classList.toggle('slopscale-focused', on);
    $('slopscale-focus-btn')?.setAttribute('aria-pressed', String(on));
    // Re-fit the renderer to the resized stage on the next frame (after layout settles).
    requestAnimationFrame(() => {
      if (renderer && typeof renderer.resize === 'function') {
        const host = $('slopscale-render-host');
        if (host) { const r = host.getBoundingClientRect(); renderer.resize(Math.round(r.width), Math.round(r.height)); }
      }
      drawOnce();
    });
  }

  // ===========================================================================
  // §13 · LIVE FRETBOARD STRIP
  // horizontal neck on #slopscale-fretboard; hollow pattern + glowing live notes.
  // ===========================================================================
  function drawFretboardFrame() {
    const canvas = $('slopscale-fretboard');
    if (!canvas || canvas.offsetParent === null) return;  // hidden (wrong view / toggled off / piano)
    if (!fbCtx || fbCtx.canvas !== canvas) fbCtx = canvas.getContext('2d');
    const ctx = fbCtx; if (!ctx) return;
    const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    const pxW = Math.max(1, Math.floor(rect.width * dpr)), pxH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.fillStyle = 'rgba(8,8,16,0.92)'; ctx.fillRect(0, 0, W, H);
    if (!activeBundle) return;

    const nStrings = fretboardStringCount();
    const opens = (activeBundle.openMidis && activeBundle.openMidis.length)
      ? activeBundle.openMidis : openMidisForConfig(activeBundle.config || readConfig());
    const padL = 34, padR = 12, padT = 12, padB = 18;
    const lo = fbFretLo, hi = fbFretHi, nSpaces = Math.max(1, hi - lo), usableW = W - padL - padR;
    // Cap per-fret width so the neck doesn't stretch edge-to-edge on wide strips
    // (a 6-fret window across ~1600px spread the frets ~270px apart); the capped
    // neck is centered in the usable area instead, so the shape reads tighter.
    const MAX_SPACE = 72;
    const spaceW = Math.min(usableW / nSpaces, MAX_SPACE);
    const neckW = spaceW * nSpaces;
    const x0 = padL + Math.max(0, (usableW - neckW) / 2);
    const rowH = (H - padT - padB) / Math.max(1, nStrings - 1);
    const rowY = s => padT + (nStrings - 1 - s) * rowH;        // s=0 (lowest) at the bottom
    const midRow = (nStrings - 1) / 2;
    const xLine = f => x0 + (f - lo) * spaceW;                 // fret-line x
    const xNote = f => f === 0 ? Math.max(x0 + 4, xLine(0)) : xLine(f - 0.5);  // notehead x

    // Fret lines + nut (only the windowed frets)
    for (let f = lo; f <= hi; f++) {
      const x = xLine(f);
      ctx.strokeStyle = f === 0 ? '#555' : '#23233a'; ctx.lineWidth = f === 0 ? 3 : 1;
      ctx.beginPath(); ctx.moveTo(x, rowY(nStrings - 1)); ctx.lineTo(x, rowY(0)); ctx.stroke();
    }
    // Inlay dots inside the window
    ctx.fillStyle = '#1a1a30';
    for (const f of FB_DOT_FRETS) {
      if (f <= lo || f > hi) continue;
      const x = xLine(f - 0.5);
      if (FB_DOUBLE_DOT.includes(f)) {
        ctx.beginPath(); ctx.arc(x, padT + (midRow - 1) * rowH, 4, 0, 6.2832); ctx.fill();
        ctx.beginPath(); ctx.arc(x, padT + (midRow + 1) * rowH, 4, 0, 6.2832); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(x, padT + midRow * rowH, 4, 0, 6.2832); ctx.fill(); }
    }
    // Strings + open-note labels
    ctx.font = 'bold 10px sans-serif'; ctx.textBaseline = 'middle';
    for (let s = 0; s < nStrings; s++) {
      const y = rowY(s), col = STRING_COLORS[s % STRING_COLORS.length];
      ctx.strokeStyle = col; ctx.globalAlpha = 0.4; ctx.lineWidth = 1 + (nStrings - 1 - s) * 0.3;
      ctx.beginPath(); ctx.moveTo(xLine(lo), y); ctx.lineTo(xLine(hi), y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.textAlign = 'right';
      ctx.fillText(NOTE_NAMES[(opens[s] ?? 0) % 12], xLine(lo) - 7, y);
    }
    // Fret numbers (actual fret values across the window)
    ctx.fillStyle = '#4a4a5a'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let f = lo + 1; f <= hi; f++) ctx.fillText(String(f), xLine(f - 0.5), rowY(0) + 4);

    // The whole exercise pattern as hollow circles — shows the shape at a glance.
    for (const p of fbPattern) {
      if (p.s < 0 || p.s >= nStrings) continue;
      ctx.strokeStyle = STRING_COLORS[p.s % STRING_COLORS.length]; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(xNote(p.f), rowY(p.s), 7, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Jam target-highlight: light the current chord's chord/guide/scale tones within
    // the lead box (green = --ss-meter "target") so the player sees which box notes to
    // aim for as the changes move. Drawn under the live glow.
    const targetPcs = $('slopscale-root')?.classList.contains('ss-mode-jam')
      ? jamTargetPcs(currentPracticeTime) : null;
    if (targetPcs) {
      for (const p of fbPattern) {
        if (p.s < 0 || p.s >= nStrings) continue;
        if (!targetPcs.has((opens[p.s] + p.f) % 12)) continue;
        const x = xNote(p.f), y = rowY(p.s);
        ctx.globalAlpha = 0.30; ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.95; ctx.lineWidth = 2; ctx.strokeStyle = '#4ade80';
        ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // Currently-sounding notes glow (filled) on top of their hollow markers.
    for (const n of fretboardActiveNotes(currentPracticeTime)) {
      if (n.s < 0 || n.s >= nStrings) continue;
      const y = rowY(n.s), x = xNote(n.f);
      const col = STRING_COLORS[n.s % STRING_COLORS.length];
      ctx.globalAlpha = n.alpha * 0.3; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = n.alpha; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n.f), x, y);
      ctx.globalAlpha = 1;
    }
  }

  // ── Unified DAW timeline ruler ───────────────────────────────────────────
  // One canvas carrying everything the two old widgets did, plus a bar/beat
  // grid: bar lines + bar numbers, beat/group ticks, the A–B loop band (with
  // edge grips), and the playhead. Time→x is linear across the chart duration.
  // The top strip (loopZoneH) is the loop/cycle zone; below it is the scrub
  // zone — see the pointer handler in bind(). Pure draw; reads tpA/tpB + time.
  const RULER_LOOP_ZONE = 18;  // px height of the top loop/cycle strip
  function rulerGeom() {
    const canvas = $('slopscale-ruler-canvas'); if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const padX = 2, usableW = Math.max(1, rect.width - padX * 2);
    const dur = activeBundle?.songInfo?.duration || 0;
    return { rect, padX, usableW, dur };
  }
  // The SAME scroll window the note renderers use (chartBeatSeconds + AHEAD/BEHIND),
  // so the ruler's bars stay pixel-aligned with the falling notes. Two-lane DAW
  // transport redesign — memory project_transport_two_lane_redesign.
  function rulerWindow() {
    const winBeat = chartBeatSeconds(activeBundle);
    const AHEAD = Math.max(2.5, Math.min(6, winBeat * 5));
    const BEHIND = Math.max(0.9, Math.min(2.2, winBeat * 1.8));
    return { AHEAD, BEHIND, span: AHEAD + BEHIND };
  }
  // One mapping used by both the draw and the pointer handlers so they never
  // diverge. Default = fixed-scale SCROLLING (playhead fixed ~22% left, timeline
  // scrolls under it). prefers-reduced-motion → fall back to the static fit-to-width
  // model (playhead moves; no scroll) so motion-sensitive users aren't scrolled.
  function rulerMap() {
    const g = rulerGeom(); if (!g) return null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now = Math.max(0, Math.min(g.dur || 0, currentPracticeTime));
    if (reduce || g.dur <= 0) {
      return { g, scroll: false, now,
        xAt: t => g.padX + (g.dur ? (t / g.dur) : 0) * g.usableW,
        tAt: cx => Math.max(0, Math.min(g.dur, (cx - g.rect.left - g.padX) / g.usableW * g.dur)),
        inView: () => true };
    }
    const win = rulerWindow();
    return { g, scroll: true, now,
      xAt: t => g.padX + ((t - now + win.BEHIND) / win.span) * g.usableW,
      tAt: cx => Math.max(0, Math.min(g.dur, now + ((cx - g.rect.left - g.padX) / g.usableW) * win.span - win.BEHIND)),
      inView: t => t >= now - win.BEHIND - 0.06 && t <= now + win.AHEAD + 0.06 };
  }
  function drawRulerFrame() {
    const canvas = $('slopscale-ruler-canvas');
    if (!canvas || canvas.offsetParent === null) return;  // hidden view
    if (!rulerCtx || rulerCtx.canvas !== canvas) rulerCtx = canvas.getContext('2d');
    const ctx = rulerCtx; if (!ctx) return;
    const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    const pxW = Math.max(1, Math.floor(rect.width * dpr)), pxH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    const dur = activeBundle?.songInfo?.duration || 0;
    if (!activeBundle || dur <= 0) return;
    const padX = 2, usableW = W - padX * 2, lz = Math.min(RULER_LOOP_ZONE, H * 0.4);
    const map = rulerMap(); if (!map) return;
    const xAt = map.xAt;

    // Loop-zone backing + base track
    ctx.fillStyle = 'rgba(148,163,184,0.06)'; ctx.fillRect(0, 0, W, lz);
    ctx.strokeStyle = 'rgba(148,163,184,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, lz + 0.5); ctx.lineTo(W, lz + 0.5); ctx.stroke();

    // Bar lines + numbers + beat/group ticks — only those in the visible window.
    // Scrolling → ~7 bars on screen, always legible (no picket fence, no decimation).
    const beats = activeBundle.beats || [];
    ctx.textBaseline = 'top'; ctx.font = '10px ui-monospace, monospace';
    for (const b of beats) {
      if (!map.inView(b.time)) continue;
      const x = xAt(b.time), isBar = (b.measure ?? -1) >= 0;
      if (isBar) {
        ctx.strokeStyle = 'rgba(96,165,250,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, lz); ctx.lineTo(x, H); ctx.stroke();
        ctx.fillStyle = '#8aa0bd'; ctx.fillText(String(b.measure), x + 3, lz + 2);
      } else {
        const grp = b.accent === 'group';
        ctx.strokeStyle = grp ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.15)';
        ctx.lineWidth = 1; const tH = grp ? (H - lz) * 0.7 : (H - lz) * 0.42;
        ctx.beginPath(); ctx.moveTo(x, H - tH); ctx.lineTo(x, H); ctx.stroke();
      }
    }

    // A–B loop band (clipped to the visible window) + off-screen edge chevrons so
    // you always know which way an off-screen loop boundary lies.
    if (tpA != null && tpB != null && Math.abs(tpA - tpB) > 0.02) {
      const ax = xAt(Math.min(tpA, tpB)), bx = xAt(Math.max(tpA, tpB));
      const cax = Math.max(0, Math.min(W, ax)), cbx = Math.max(0, Math.min(W, bx));
      if (cbx > cax) {
        ctx.fillStyle = 'rgba(64,128,224,0.20)'; ctx.fillRect(cax, lz, cbx - cax, H - lz);
        ctx.fillStyle = 'rgba(64,128,224,0.85)'; ctx.fillRect(cax, 0, cbx - cax, lz);
      }
      ctx.fillStyle = '#9ec1ff';
      if (ax >= 0 && ax <= W) ctx.fillRect(ax - 1, 0, 2, H);
      else { ctx.beginPath(); ctx.moveTo(2, lz / 2 - 4); ctx.lineTo(9, lz / 2); ctx.lineTo(2, lz / 2 + 4); ctx.closePath(); ctx.fill(); }
      if (bx >= 0 && bx <= W) ctx.fillRect(bx - 1, 0, 2, H);
      else { ctx.beginPath(); ctx.moveTo(W - 2, lz / 2 - 4); ctx.lineTo(W - 9, lz / 2); ctx.lineTo(W - 2, lz / 2 + 4); ctx.closePath(); ctx.fill(); }
    } else {
      ctx.fillStyle = 'rgba(100,116,139,0.65)'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('LOOP · drag here', padX + 3, lz / 2 + 0.5);
    }

    // Playhead: scrolling → FIXED at ~22% (xAt(now)) with the timeline moving under
    // it; reduced-motion fit → the playhead moves instead. Line + bottom flag.
    const px = xAt(map.now);
    ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath(); ctx.moveTo(px - 4, H); ctx.lineTo(px + 4, H); ctx.lineTo(px, H - 5); ctx.closePath(); ctx.fill();
  }

  // ── Overview / marker strip (two-lane transport, lane 2) ─────────────────────
  // The whole-session MAP: fit-to-width, role-tinted NAMED segment bands (the DAW
  // arrangement track — mirrors the host's Section Map). The A–B loop is authored
  // here (you can't grab an off-screen loop on the scrolling working ruler), and
  // click = seek anywhere in the session. Degrades to one band for a single drill
  // (the progressive-disclosure "simplest transport"). Never meter-green (bands are
  // categorical role tints; green = cleared-only). Memory: project_transport_two_lane_redesign.
  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex || 'rgba(100,116,139,0.3)';
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function overviewBands() {
    const b = activeBundle; if (!b) return [];
    const dur = b.songInfo?.duration || 0; if (dur <= 0) return [];
    const sb = Array.isArray(b.segmentBounds) ? b.segmentBounds : null;
    if (sb && sb.length) {
      return sb.map(s => ({ name: s.name || s.kind || '', start: s.start, end: s.end,
        color: ROLE_COLORS[s.role] || KIND_COLORS[s.kind] || '#64748b' }));
    }
    const secs = Array.isArray(b.sections) ? b.sections : null;
    if (secs && secs.length > 1) {
      return secs.map((s, i) => ({ name: s.name || '', start: s.time || 0,
        end: (i + 1 < secs.length ? secs[i + 1].time : dur), color: '#3b82f6' }));
    }
    return [{ name: b.songInfo?.title || '', start: 0, end: dur, color: '#3b82f6' }];   // single drill
  }
  let overviewCtx = null;
  function drawOverviewFrame() {
    const canvas = $('slopscale-overview-canvas');
    if (!canvas || canvas.offsetParent === null) return;
    if (!overviewCtx || overviewCtx.canvas !== canvas) overviewCtx = canvas.getContext('2d');
    const ctx = overviewCtx; if (!ctx) return;
    const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    const pxW = Math.max(1, Math.floor(rect.width * dpr)), pxH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height; ctx.clearRect(0, 0, W, H);
    const dur = activeBundle?.songInfo?.duration || 0;
    if (!activeBundle || dur <= 0) return;
    const padX = 2, usableW = W - padX * 2;
    const xAt = t => padX + (t / dur) * usableW;
    // Role-tinted named bands.
    ctx.textBaseline = 'middle'; ctx.font = '8px ui-sans-serif, sans-serif';
    for (const bnd of overviewBands()) {
      const ax = xAt(bnd.start), w = Math.max(1, xAt(bnd.end) - ax);
      ctx.fillStyle = hexA(bnd.color, 0.32); ctx.fillRect(ax, 1, w, H - 2);
      ctx.fillStyle = hexA(bnd.color, 0.9); ctx.fillRect(ax, 1, 1.5, H - 2);
      if (w > 24 && bnd.name) {
        ctx.save(); ctx.beginPath(); ctx.rect(ax + 3, 0, w - 5, H); ctx.clip();
        ctx.fillStyle = 'rgba(226,232,240,0.88)'; ctx.fillText(bnd.name, ax + 4, H / 2 + 0.5); ctx.restore();
      }
    }
    // A–B loop overlay (full-session, the authoring view).
    if (tpA != null && tpB != null && Math.abs(tpA - tpB) > 0.02) {
      const ax = xAt(Math.min(tpA, tpB)), bx = xAt(Math.max(tpA, tpB));
      ctx.fillStyle = 'rgba(64,128,224,0.28)'; ctx.fillRect(ax, 0, Math.max(1, bx - ax), H);
      ctx.fillStyle = '#9ec1ff'; ctx.fillRect(ax - 1, 0, 2, H); ctx.fillRect(bx - 1, 0, 2, H);
    }
    // Viewport box: the slice the scrolling working ruler is showing right now.
    const win = rulerWindow();
    const now = Math.max(0, Math.min(dur, currentPracticeTime));
    const vx0 = xAt(Math.max(0, now - win.BEHIND)), vx1 = xAt(Math.min(dur, now + win.AHEAD));
    ctx.strokeStyle = 'rgba(226,232,240,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(vx0 + 0.5, 0.5, Math.max(2, vx1 - vx0) - 1, H - 1);
    // Playhead.
    const px = xAt(now);
    ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
  }

  // ── Chord-shape box (small VERTICAL chord chart) ─────────────────────────
  // A standard vertical chord diagram for the currently-sounding chord, drawn
  // as a small overlay in the render's top-left. Vertical (strings vertical,
  // low E on the left, nut on top) is the standard chord-chart convention; the
  // horizontal neck map is the separate fretboard strip. Drawn on ALL views,
  // including 3D Highway — whose own chord diagram + lane frames we suppress by
  // handing it a chord-free bundle (see attachRenderer) — so the chord reference
  // is one consistent box everywhere. Shown only when the chart has chord
  // templates (chord/arpeggio exercises); scales carry none, so it stays hidden
  // for them with no extra gating.
  let chordBoxCtx = null;
  function currentChordTemplate() {
    const b = activeBundle;
    if (!b || !b.chords || !b.chords.length || !b.chordTemplates || !b.chordTemplates.length) return null;
    const t = currentPracticeTime;
    let chord = b.chords[0];
    for (const ch of b.chords) { if (ch.t <= t + 1e-3) chord = ch; else break; }
    const tmpl = b.chordTemplates[chord.id];
    return (tmpl && Array.isArray(tmpl.frets) && tmpl.frets.length) ? tmpl : null;
  }
  function drawChordBoxFrame() {
    const canvas = $('slopscale-chordbox'); if (!canvas) return;
    const tmpl = activeBundle ? currentChordTemplate() : null;
    if (!tmpl) { if (canvas.style.display !== 'none') canvas.style.display = 'none'; return; }
    canvas.style.display = 'block';
    if (!chordBoxCtx || chordBoxCtx.canvas !== canvas) chordBoxCtx = canvas.getContext('2d');
    const ctx = chordBoxCtx; if (!ctx) return;
    const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    const pxW = Math.max(1, Math.floor(rect.width * dpr)), pxH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    // Panel
    ctx.fillStyle = 'rgba(8,12,22,0.94)'; ctx.strokeStyle = 'rgba(96,165,250,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(0.5, 0.5, W - 1, H - 1, 8); ctx.fill(); ctx.stroke();
    // Chord name
    ctx.fillStyle = '#e8d080'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(String(tmpl.displayName || tmpl.name || ''), W / 2, 5);

    const frets = tmpl.frets, nS = frets.length;
    const played = frets.filter(f => f > 0);
    const minF = played.length ? Math.min(...played) : 0;
    const maxF = played.length ? Math.max(...played) : 0;
    let baseFret = 1, showNut = true, SPAN = 4;
    if (maxF > 4) { baseFret = minF; showNut = false; SPAN = Math.max(4, maxF - minF + 1); }
    const padTop = 32, padBot = 13, padL = 15, padR = 15;
    const gx0 = padL, gx1 = W - padR, gy0 = padTop, gy1 = H - padBot;
    const colW = (gx1 - gx0) / Math.max(1, nS - 1), rowH = (gy1 - gy0) / SPAN;
    const xS = s => gx0 + s * colW;  // s=0 (low E) on the left — standard orientation
    // Strings (vertical) + frets (horizontal)
    ctx.strokeStyle = '#52617a'; ctx.lineWidth = 1;
    for (let s = 0; s < nS; s++) { ctx.beginPath(); ctx.moveTo(xS(s), gy0); ctx.lineTo(xS(s), gy1); ctx.stroke(); }
    for (let r = 0; r <= SPAN; r++) { const y = gy0 + r * rowH; ctx.lineWidth = (showNut && r === 0) ? 3 : 1; ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); ctx.stroke(); }
    // Position label when not at the nut
    if (!showNut) { ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(baseFret + 'fr', gx0 - 3, gy0 + rowH / 2); }
    // Per-string markers: × muted, ○ open (above nut), dot for fretted
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let s = 0; s < nS; s++) {
      const f = frets[s], x = xS(s);
      if (f == null || f < 0) { ctx.fillStyle = '#64748b'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('×', x, gy0 - 8); continue; }
      if (f === 0) { ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, gy0 - 8, 3.4, 0, 6.2832); ctx.stroke(); continue; }
      const row = f - baseFret; if (row < 0 || row >= SPAN) continue;
      const y = gy0 + (row + 0.5) * rowH;
      ctx.fillStyle = STRING_COLORS[s % STRING_COLORS.length] || '#e2e8f0';
      ctx.beginPath(); ctx.arc(x, y, Math.min(7, rowH * 0.38), 0, 6.2832); ctx.fill();
      const finger = tmpl.fingers && tmpl.fingers[s];
      if (finger) { ctx.fillStyle = '#0b1220'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(String(finger), x, y); }
    }
  }

  function drawOnce() { drawFretboardFrame(); drawRulerFrame(); drawOverviewFrame(); drawChordBoxFrame(); if (!renderer || !activeBundle) return; const vb = rendererBundle || activeBundle; vb.currentTime = currentPracticeTime; syncHighwaySettings(vb); try { renderer.draw(vb); } catch (e) { console.warn('[SlopScale] renderer draw failed', e); } syncTransportTime(); }
  // "Keep looping" — when on, a finite drill restores the old infinite loop (open
  // practice). Default off (finite). Persisted; loaded in bind(). An A–B loop and Jam
  // are unaffected (they loop via the segment-loop branch above, never this one).
  let keepLooping = false;
  // True when the active run is a single-exercise DRILL that should play once and END
  // rather than loop: the bundle is finite-eligible AND the user hasn't opted into
  // "keep looping". Workout sessions and Jam are never finite-eligible.
  function finiteRunActive() {
    return !!(activeBundle && activeBundle.finiteRun && !keepLooping);
  }
  // End a finite drill run: run the existing closure (sessionEnd → the descriptive
  // session-summary card) and tear playback down. This slice has no clean-gate/verdict
  // yet — the run simply ends with the existing card. Mirrors stopPlayback()'s teardown
  // (which also wraps sessionEnd), including rewinding the playhead to where Play began,
  // so pressing Play again cleanly replays the run from its start rather than re-ending
  // instantly at duration.
  function endFiniteRun() {
    sessionEnd();                 // flush the session → presentSessionSummary (closure)
    playing = false;
    currentPracticeTime = playStartChartTime;
    playAnchorChartTime = playStartChartTime;
    stopAudio();
    stopPitchTracker();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    drawOnce();
    syncPlayButton();
    refreshStatusFromState();
  }
  function tick(nowMs) {
    if (!renderer || !activeBundle) return;
    if (playing) {
      // If the host navigated away from the SlopScale screen, its container goes
      // display:none (offsetParent becomes null) — stop playback so the audio
      // doesn't keep running in the background. Covers the host top-nav and
      // leaving a tutorial, which bypass SlopScale's own back buttons. The rAF
      // tick only runs while playing, so this is the natural place to catch it.
      const screenRoot = $('slopscale-root');
      if (screenRoot && !screenRoot.offsetParent) { stopPlayback(); return; }
      const elapsedMs = Math.max(0, nowMs - playAnchorMs);
      currentPracticeTime = playAnchorChartTime + elapsedMs / 1000;
      const duration = activeBundle.songInfo.duration || 1;
      // A-B segment loop wins over whole-chart wrap when both endpoints are
      // set. No count-in or rewind animation in this phase — just snap to A
      // and re-schedule audio. (See docs/section-looping.md "Phase 2 — UI"
      // for the count-in / rewind plan.)
      if (segmentLoopA != null && segmentLoopB != null && currentPracticeTime >= segmentLoopB) {
        currentPracticeTime = segmentLoopA;
        playAnchorChartTime = segmentLoopA;
        playAnchorMs = nowMs + AUDIO_LOOKAHEAD_SECONDS * 1000;
        stopAudio();
        schedulePreviewAudio(activeBundle, segmentLoopA, AUDIO_LOOKAHEAD_SECONDS);
        if (window.slopsmith && typeof window.slopsmith.emit === 'function') {
          window.slopsmith.emit('slopscale:loop:wrap', { a: segmentLoopA, b: segmentLoopB, time: segmentLoopA });
        }
        _loopWraps++;
        const lc = $('slopscale-loop-count');
        if (lc) { lc.hidden = false; lc.textContent = 'Loop ' + _loopWraps; }
      } else if (finiteRunActive()) {
        // Finite drill (Depth Ladder slice 1): the right-sized run plays ONCE, then
        // ends with the existing session-summary closure instead of looping. No
        // loop-ahead is pre-scheduled (see maybeScheduleLoopAhead) so audio stops
        // cleanly at the seam. Let the run reach the end, then end it.
        if (currentPracticeTime >= duration) {
          currentPracticeTime = duration;
          drawOnce();
          endFiniteRun();
          return;   // run over — no further rAF; endFiniteRun cancels playback
        }
      } else {
        // Seamless whole-chart loop. Audio for the next pass is pre-scheduled
        // ahead of the seam (no stopAudio()/gap/clipped tail), and the visual
        // clock wraps by phase-carry — subtract one loop length and keep
        // ticking, so the playhead never freezes or snaps. Carrying the
        // remainder also keeps the loop phase drift-free over long sessions.
        maybeScheduleLoopAhead(nowMs);
        if (currentPracticeTime >= duration) {
          // Wrap to the music start (after the count-in lead-in), not 0, so the
          // count-in plays once and each loop is music. contentLen carries the
          // phase so the loop stays drift-free.
          const contentLen = duration - (activeBundle.leadIn || 0);
          playAnchorChartTime -= contentLen;
          currentPracticeTime -= contentLen;
        }
      }
    }
    drawOnce(); rafId = requestAnimationFrame(tick);
  }

  // Bend-note states → semitones of upward pitch shift. These mirror the visual
  // bend labels (bendLabel): 0.5 = ½ step (1 semitone), 1 = full/whole step
  // (2 semitones), 1.5 = 1½ steps (3), 2 = two whole steps (4). The synth ramps
  // the played pitch up by this many semitones so a bend sounds bent, reaching
  // the same target pitch the player sees notated above the note.
  const BEND_SEMITONES = { 0: 0, 0.5: 1, 1: 2, 1.5: 3, 2: 4 };
  function bendSemitones(bn) {
    const v = Number(bn) || 0;
    return BEND_SEMITONES[v] != null ? BEND_SEMITONES[v] : v * 2;
  }
  // Standard tab/notation bend label for a bend value (shared by all renderers).
  function bendLabel(bn) {
    return bn === 0.5 ? '½' : bn === 1 ? 'full' : bn === 1.5 ? '1½' : '2';
  }

  // ── Audio output bus (master + per-track) ─────────────────────────────────
  // Every voice routes through a per-track GainNode → a shared master → a safety
  // limiter → destination, instead of connecting straight to the output. This is
  // the structural prerequisite for (a) a master limiter that makes sudden loud
  // peaks / full-density clipping impossible (safe, normalized output), and (b) per-track
  // insert points where the realism upgrade plugs in later — amp/cab modeling on
  // the distorted track, a sampler on the acoustic track, FX sends owned by
  // sound-design. Built once per AudioContext; the bus nodes persist across note
  // stop/start (they are deliberately NOT pushed into audioNodes).
  let audioBus = null;
  function ensureAudioBus(ctx) {
    if (audioBus && audioBus.ctx === ctx) return audioBus;
    const master = ctx.createGain();
    master.gain.value = 0.85;                        // trim — headroom into the limiter
    const limiter = ctx.createDynamicsCompressor();  // transparent safety limiter
    limiter.threshold.value = -6; limiter.knee.value = 12; limiter.ratio.value = 6;
    limiter.attack.value = 0.003; limiter.release.value = 0.12;
    master.connect(limiter); limiter.connect(ctx.destination);
    audioBus = { ctx, master, limiter, tracks: {} };
    return audioBus;
  }
  // Lazily-created per-track sub-bus ('notes' | 'harmony' | 'click'). Future
  // per-track processing (amp/cab, sampler, sends) inserts between the track gain
  // and master without touching the voice code below.
  function trackBus(ctx, name) {
    const bus = ensureAudioBus(ctx);
    if (!bus.tracks[name]) {
      const g = ctx.createGain(); g.gain.value = mixerGainFor(name);
      if (name === 'drums') {
        // Drum sub-bus (Phase D): a dedicated compressor BEFORE the master limiter
        // — the punch lever is THIS comp's makeup, NEVER a looser master limiter —
        // plus a gentle >8 kHz shelf so hats stay out of the player's pick-attack
        // air-band. The per-hit 3–6 ms attack ramp lives in scheduleDrumHit.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 3;
        comp.attack.value = 0.005; comp.release.value = 0.12;
        const shelf = ctx.createBiquadFilter();
        shelf.type = 'highshelf'; shelf.frequency.value = 8000; shelf.gain.value = -3;
        g.connect(comp); comp.connect(shelf); shelf.connect(bus.master);
      } else {
        g.connect(bus.master);
      }
      bus.tracks[name] = g;
    }
    return bus.tracks[name];
  }

  // ── Shell mixer (M) — per-bus faders/mute/solo + a "Backing dim" ───────────
  // Controls the per-track audio buses (notes/harmony/click/bass). Default state
  // is unity (level 1, no mute/solo, no dim) → identical to pre-mixer behaviour.
  const MIXER_CHANNELS = [
    { key:'notes',   label:'Player',  backing:false, instr:'melodic' },
    { key:'harmony', label:'Comp',    backing:true,  instr:'melodic', tone:true },
    { key:'bass',    label:'Bass',    backing:true,  instr:'bass' },
    { key:'drums',   label:'Drums',   backing:true,  kit:true },
    { key:'click',   label:'Click',   backing:false },
  ];
  // Per-channel instrument options (Phase C — backing-voice selection lives here now,
  // moved out of the form). Values are TONE_GM keys; '' = Auto (use the style profile).
  const MIXER_INSTRUMENTS = {
    melodic: [['','Auto'],['epiano','E-piano'],['organ','Organ'],['piano','Piano'],['clean','Clean gtr'],['guitar','Acoustic'],['nylon','Nylon'],['clav','Clav'],['strings','Strings'],['pad','Synth pad']],
    bass:    [['','Auto'],['bass','Electric'],['upright','Upright']],
  };
  // Per-channel kit options for the Drums channel (Phase D). Values are KIT_REGISTRY
  // ids; '' = Auto (use the style profile's kit). Sampled kits join in D4.
  const MIXER_KITS = [['','Auto'],['kit_rock','Acoustic rock'],['kit_acoustic_soft','Acoustic soft'],['kit_jazz','Jazz kit'],['kit_909','Synth 909'],['kit_808','Synth 808']];
  const mixerState = {};
  let mixerBackingDim = false;
  MIXER_CHANNELS.forEach(c => { mixerState[c.key] = { level:1, mute:false, solo:false, instrument:null, kit:null }; });
  // The GM preset a channel's instrument override resolves to, or null = use the profile.
  function mixerInstrumentFor(key) {
    const tone = mixerState[key] && mixerState[key].instrument;
    return tone ? (TONE_GM[tone] ?? null) : null;
  }
  // The kit id a channel's kit override is pinned to, or null = use the profile.
  function mixerKitFor(key) {
    const k = mixerState[key] && mixerState[key].kit;
    return (k && KIT_REGISTRY[k]) ? k : null;
  }
  function mixerLoad() {
    try {
      const s = JSON.parse(localStorage.getItem('slopscale.mixer') || 'null');
      if (s && s.ch) { MIXER_CHANNELS.forEach(c => { if (s.ch[c.key]) Object.assign(mixerState[c.key], s.ch[c.key]); }); mixerBackingDim = !!s.dim; }
    } catch (_) {}
  }
  function mixerSave() { try { localStorage.setItem('slopscale.mixer', JSON.stringify({ ch: mixerState, dim: mixerBackingDim })); } catch (_) {} }
  // Effective gain for a bus given the mixer state (1.0 = no change). Solo on any
  // channel mutes the un-soloed; Backing dim ducks the backing buses.
  function mixerGainFor(name) {
    const st = mixerState[name]; if (!st) return 1;
    const anySolo = MIXER_CHANNELS.some(c => mixerState[c.key].solo);
    let v = st.level;
    if (anySolo) v = st.solo ? v : 0; else if (st.mute) v = 0;
    const ch = MIXER_CHANNELS.find(c => c.key === name);
    if (mixerBackingDim && ch && ch.backing) v *= 0.35;
    return v;
  }
  // Push the mixer state onto any live buses with a short ramp (no clicks — clean,
  // safe audio).
  function applyMixer() {
    if (!audioBus) return;
    const ctx = audioBus.ctx;
    MIXER_CHANNELS.forEach(c => {
      const g = audioBus.tracks[c.key]; if (!g) return;
      const v = mixerGainFor(c.key);
      try { g.gain.setTargetAtTime(v, ctx.currentTime, 0.02); } catch (_) { g.gain.value = v; }
    });
  }
  function renderMixer() {
    const host = $('slopscale-mixer-channels'); if (!host) return;
    host.innerHTML = '';
    MIXER_CHANNELS.forEach(c => {
      const st = mixerState[c.key];
      const row = document.createElement('div');
      row.className = 'slopscale-mixer-ch';
      row.innerHTML =
        `<span class="slopscale-mixer-ch-label">${c.label}</span>` +
        (c.instr
          ? `<select class="slopscale-mixer-instr" data-k="${c.key}" title="${c.label} instrument" aria-label="${c.label} instrument">` +
              MIXER_INSTRUMENTS[c.instr].map(([v, l]) => `<option value="${v}"${(st.instrument || '') === v ? ' selected' : ''}>${l}</option>`).join('') +
            `</select>`
          : c.kit
          ? `<select class="slopscale-mixer-kit" data-k="${c.key}" title="${c.label} kit" aria-label="${c.label} kit">` +
              MIXER_KITS.map(([v, l]) => `<option value="${v}"${(st.kit || '') === v ? ' selected' : ''}>${l}</option>`).join('') +
            `</select>`
          : `<span class="slopscale-mixer-instr-none" aria-hidden="true"></span>`) +
        `<button type="button" class="slopscale-mixer-tog mute${st.mute ? ' active' : ''}" data-k="${c.key}" data-act="mute" title="Mute" aria-pressed="${st.mute}">M</button>` +
        `<button type="button" class="slopscale-mixer-tog solo${st.solo ? ' active' : ''}" data-k="${c.key}" data-act="solo" title="Solo" aria-pressed="${st.solo}">S</button>` +
        `<input type="range" class="slopscale-mixer-fader" min="0" max="1.2" step="0.01" value="${st.level}" data-k="${c.key}" aria-label="${c.label} level">` +
        `<span class="slopscale-mixer-val" data-k="${c.key}">${Math.round(st.level * 100)}</span>`;
      host.appendChild(row);
      // Per-channel Tone knob (the relocated "Backing tone" / brightness — §14).
      // UI relocation only: it reads/writes the form's #slopscale-brightness value
      // (name="brightness"), so the existing audio path (data.get('brightness'))
      // is unchanged. A second row under the Comp channel so the fader stays the
      // dominant gesture.
      if (c.tone) {
        const bEl = $('slopscale-brightness');
        const bright = bEl ? Math.max(0, Math.min(1, parseFloat(bEl.value) || 0)) : 0.5;
        const tone = document.createElement('div');
        tone.className = 'slopscale-mixer-tone';
        tone.innerHTML =
          `<span class="slopscale-mixer-tone-lbl">Tone</span>` +
          `<input type="range" class="slopscale-mixer-toneknob" min="0" max="1" step="0.05" value="${bright}" aria-label="${c.label} tone (darker ↔ brighter)" title="Backing tone — darker ↔ brighter. Auto-set per style; nudge to taste.">` +
          `<span class="slopscale-mixer-tone-end" aria-hidden="true">brighter</span>`;
        host.appendChild(tone);
      }
    });
    const dim = $('slopscale-mixer-dim'); if (dim) dim.checked = mixerBackingDim;
  }
  // Panel toggles (M / P / ? overlays). Slide transitions + open state live in CSS
  // (reduced-motion aware); these flip the root class + aria + the button highlight.
  function toggleMixer(force) {
    const root = $('slopscale-root'); if (!root) return;
    const open = force != null ? force : !root.classList.contains('ss-mixer-open');
    if (open) { root.classList.remove('ss-library-open'); root.classList.remove('ss-starters-open'); }   // mutually exclusive bottom drawers
    root.classList.toggle('ss-mixer-open', open);
    $('slopscale-mixer')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    $('slopscale-mixer-btn')?.classList.toggle('active', open);
    if (open) { renderMixer(); applyMixer(); }
  }
  function toggleProgressSheet(force) {
    const root = $('slopscale-root'); if (!root) return;
    const open = force != null ? force : !root.classList.contains('ss-progress-open');
    root.classList.toggle('ss-progress-open', open);
    $('slopscale-progress-sheet')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    $('slopscale-progress-strip')?.classList.toggle('chip-open', open);   // the header chip is P's affordance
    if (open) renderProgressSheet();
  }
  function toggleCheatSheet(force) {
    const root = $('slopscale-root'); if (!root) return;
    const open = force != null ? force : !root.classList.contains('ss-cheat-open');
    root.classList.toggle('ss-cheat-open', open);
    $('slopscale-cheatsheet')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    $('slopscale-help-btn')?.classList.toggle('active', open);
  }

  // ── Library browse drawer (Phase 9 Slice 3) ─────────────────────────────────
  // Slides UP over the stage (mirrors the Mixer M idiom). Browse the segment
  // TEMPLATE library grouped by ROLE; Genre × Skill × Instrument chips narrow
  // within; [+ Add] appends a fresh template-ref block to the editable Workout
  // draft (addSegmentToDraft) and stays open for multi-add. Overlay, not relayout;
  // Esc stays unbound (the host owns it). UX: project_workout_browse_design_refresh.
  let _libFilters = { genre: 'all', skill: 'all', instrument: 'all' };
  const LIB_GENRE_LABELS = { blues:'Blues', rock:'Rock', metal:'Metal', djent:'Djent', jazz:'Jazz', funk:'Funk', pop:'Pop', country:'Country', gospel:'Gospel' };
  function _libGenres() {
    const set = new Set();
    for (const id of Object.keys(SEGMENT_TEMPLATES)) { const st = SEGMENT_TEMPLATES[id].style; if (st) set.add(st); }
    return [...set].sort();
  }
  function toggleLibrary(force) {
    const root = $('slopscale-root'); if (!root) return;
    const open = force != null ? force : !root.classList.contains('ss-library-open');
    if (open) { root.classList.remove('ss-mixer-open'); root.classList.remove('ss-starters-open'); }   // both slide up from the bottom — mutually exclusive
    root.classList.toggle('ss-library-open', open);
    $('slopscale-library')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    $('slopscale-library-open')?.classList.toggle('active', open);
    if (open) renderLibrary();
  }
  function _libChipRow(dim, label, values) {
    const cur = _libFilters[dim];
    const chip = (val, txt) => `<button type="button" class="slopscale-lib-chip${cur === val ? ' active' : ''}" data-filter="${dim}" data-value="${val}">${txt}</button>`;
    return `<div class="slopscale-lib-chiprow"><span class="slopscale-lib-chiplbl">${label}</span>${chip('all', 'All')}${values.map(v => chip(v[0], v[1])).join('')}</div>`;
  }
  function renderLibraryFilters() {
    const el = $('slopscale-library-filters'); if (!el) return;
    const genres = _libGenres().map(g => [g, LIB_GENRE_LABELS[g] || g]);
    const skills = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
    const insts  = [['guitar', 'Guitar'], ['bass', 'Bass']];
    el.innerHTML = _libChipRow('genre', 'Genre', genres) + _libChipRow('skill', 'Skill', skills) + _libChipRow('instrument', 'Instrument', insts);
  }
  function _libCardHtml(id) {
    const t = SEGMENT_TEMPLATES[id];
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const color = KIND_COLORS[t.kind] || '#94a3b8';
    const klabel = KIND_LABELS[t.kind] || t.kind;
    let dose = '';
    try { const seg = rollSegment(t, { variantIdx: 0 }); const d = segmentEstDuration(seg); dose = d < 60 ? `~${Math.round(d)}s` : `~${Math.floor(d / 60)}m${Math.round(d % 60)}s`; } catch (_) {}
    const meta = [t.competency, t.style ? (LIB_GENRE_LABELS[t.style] || t.style) : 'all-purpose', t.instrument, dose].filter(Boolean).join(' · ');
    return `<div class="slopscale-lib-card">
      <div class="slopscale-segment-header">
        <span class="slopscale-segment-badge" style="color:${color}">${esc(klabel)}</span>
        <span class="slopscale-segment-name">${esc(t.label || id)}</span>
        <button type="button" class="slopscale-lib-add" data-template-id="${esc(id)}" title="Add this block to your workout">+ Add</button>
      </div>
      <div class="slopscale-segment-meta">${esc(meta)}</div>
    </div>`;
  }
  function renderLibrary() {
    renderLibraryFilters();
    const body = $('slopscale-library-body'), cnt = $('slopscale-library-count'); if (!body) return;
    const f = _libFilters;
    const ids = Object.keys(SEGMENT_TEMPLATES);
    const match = id => { const t = SEGMENT_TEMPLATES[id];
      return (f.genre === 'all' || t.style === f.genre)
          && (f.skill === 'all' || t.band === f.skill)
          && (f.instrument === 'all' || t.instrument === f.instrument); };
    const shown = ids.filter(match);
    if (cnt) cnt.textContent = `${shown.length} of ${ids.length}`;
    const roleOrder = Object.keys(SEGMENT_ROLES).sort((a, b) => SEGMENT_ROLES[a].order - SEGMENT_ROLES[b].order);
    let html = '';
    for (const role of roleOrder) {
      const inRole = shown.filter(id => SEGMENT_TEMPLATES[id].role === role);
      if (!inRole.length) continue;
      html += `<div class="slopscale-lib-rolehead">${SEGMENT_ROLES[role].label} <span class="slopscale-lib-rolecount">${inRole.length}</span></div>`;
      html += `<div class="slopscale-lib-grid">${inRole.map(_libCardHtml).join('')}</div>`;
    }
    body.innerHTML = html || `<div class="slopscale-lib-empty">No blocks match these filters — clear one to see more.</div>`;
  }

  // ── Starter-workout browse drawer (Phase 9 Slice 4) ─────────────────────────
  // The SAME drawer pattern one altitude up: browse the BUILT_IN_SESSIONS by
  // Genre × Level × Instrument (derived from tags + stringSetup — the sessions
  // carry no explicit facet fields), with role-mix preview dots. [Load] forks the
  // starter into the editable timeline (replace-guard when the draft is edited).
  // This is the ONLY starter picker — the old <select> dropdown was dropped;
  // BUILT_IN_SESSIONS is the option source and _selectedStarterId the selection state.
  const ROLE_COLORS = { warmup:'#f97316', technique:'#a855f7', scale_arp:'#22c55e', application:'#3b82f6', jam:'#eab308', review:'#06b6d4', cooldown:'#64748b' };
  const STARTER_GENRE_WORDS = { blues:'blues', rock:'rock', metal:'metal', jazz:'jazz', bebop:'jazz', funk:'funk', pop:'pop', country:'country', gospel:'gospel' };
  let _starterFilters = { genre: 'all', level: 'all', instrument: 'all' };
  let _pendingStarter = null;
  function _sessionFacets(id) {
    const sess = BUILT_IN_SESSIONS[id]; if (!sess) return { genre:'general', level:'any', instrument:'guitar' };
    const tags = (sess.tags || []).map(t => String(t).toLowerCase());
    let genre = 'general';
    for (const t of tags) if (STARTER_GENRE_WORDS[t]) { genre = STARTER_GENRE_WORDS[t]; break; }
    let level = 'any';
    for (const t of tags) if (t === 'beginner' || t === 'intermediate' || t === 'advanced') { level = t; break; }
    const setup = STRING_SETUPS[sess.stringSetup] || STRING_SETUPS.guitar_6_standard;
    return { genre, level, instrument: setup.instrument };
  }
  function toggleStarters(force) {
    const root = $('slopscale-root'); if (!root) return;
    const open = force != null ? force : !root.classList.contains('ss-starters-open');
    if (open) { root.classList.remove('ss-mixer-open'); root.classList.remove('ss-library-open'); }   // mutually exclusive bottom drawers
    root.classList.toggle('ss-starters-open', open);
    $('slopscale-starters')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    $('slopscale-starters-open')?.classList.toggle('active', open);
    if (open) { _pendingStarter = null; renderStarters(); }
  }
  function _starterChipRow(dim, label, values) {
    const cur = _starterFilters[dim];
    const chip = (val, txt) => `<button type="button" class="slopscale-lib-chip${cur === val ? ' active' : ''}" data-sfilter="${dim}" data-value="${val}">${txt}</button>`;
    return `<div class="slopscale-lib-chiprow"><span class="slopscale-lib-chiplbl">${label}</span>${chip('all', 'All')}${values.map(v => chip(v[0], v[1])).join('')}</div>`;
  }
  function renderStarterFilters() {
    const el = $('slopscale-starters-filters'); if (!el) return;
    const present = new Set(Object.keys(BUILT_IN_SESSIONS).map(id => _sessionFacets(id).genre));
    const genres = ['blues','rock','metal','jazz','funk','pop','country','gospel','general'].filter(g => present.has(g))
      .map(g => [g, g === 'general' ? 'General' : (LIB_GENRE_LABELS[g] || g)]);
    const levels = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
    const insts  = [['guitar', 'Guitar'], ['bass', 'Bass']];
    el.innerHTML = _starterChipRow('genre', 'Genre', genres) + _starterChipRow('level', 'Level', levels) + _starterChipRow('instrument', 'Instrument', insts);
  }
  function _starterDotsHtml(id) {
    const segs = (BUILT_IN_SESSIONS[id].segments || []).map(materializeSegment).filter(Boolean);
    return `<span class="slopscale-starter-dots">` + segs.map(s => {
      const c = ROLE_COLORS[s.role] || KIND_COLORS[s.kind] || '#64748b';
      const lbl = (SEGMENT_ROLES[s.role] || {}).label || KIND_LABELS[s.kind] || s.kind;
      return `<span class="slopscale-starter-dot" style="background:${c}" title="${lbl}"></span>`;
    }).join('') + `</span>`;
  }
  function _starterCardHtml(id) {
    const sess = BUILT_IN_SESSIONS[id];
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const f = _sessionFacets(id);
    const segs = (sess.segments || []).map(materializeSegment).filter(Boolean);
    const dur = segs.reduce((a, s) => a + segmentEstDuration(s), 0);
    const durStr = dur < 60 ? `~${Math.round(dur)}s` : `~${Math.floor(dur / 60)}m`;
    const meta = [`${segs.length} blocks`, f.genre === 'general' ? null : (LIB_GENRE_LABELS[f.genre] || f.genre), f.level === 'any' ? null : f.level, f.instrument, durStr].filter(Boolean).join(' · ');
    return `<div class="slopscale-lib-card slopscale-starter-card">
      <div class="slopscale-segment-header">
        <span class="slopscale-segment-name">${esc(sess.name || id)}</span>
        <button type="button" class="slopscale-lib-add slopscale-starter-load" data-starter-id="${esc(id)}" title="Load this starter into the timeline">Load</button>
      </div>
      ${_starterDotsHtml(id)}
      <div class="slopscale-segment-meta">${esc(meta)}</div>
    </div>`;
  }
  function renderStarters() {
    renderStarterFilters();
    const body = $('slopscale-starters-body'), cnt = $('slopscale-starters-count'), confirm = $('slopscale-starters-confirm');
    if (!body) return;
    // Replace-guard strip (only when the draft has unsaved edits): inline, not a modal.
    if (confirm) {
      if (_pendingStarter && BUILT_IN_SESSIONS[_pendingStarter]) {
        const n = ((_workoutDraft && _workoutDraft.segments) || []).length;
        confirm.innerHTML = `<span>Replace your ${n} edited block${n === 1 ? '' : 's'} with “${BUILT_IN_SESSIONS[_pendingStarter].name}”?</span>`
          + `<button type="button" class="slopscale-starter-confirm-yes" data-starter-id="${_pendingStarter}">Load</button>`
          + `<button type="button" class="slopscale-starter-confirm-no">Cancel</button>`;
        confirm.hidden = false;
      } else { confirm.hidden = true; confirm.innerHTML = ''; }
    }
    const f = _starterFilters;
    const ids = Object.keys(BUILT_IN_SESSIONS);
    const match = id => { const x = _sessionFacets(id);
      return (f.genre === 'all' || x.genre === f.genre)
          && (f.level === 'all' || x.level === f.level)
          && (f.instrument === 'all' || x.instrument === f.instrument); };
    const shown = ids.filter(match);
    if (cnt) cnt.textContent = `${shown.length} of ${ids.length}`;
    body.innerHTML = shown.length
      ? `<div class="slopscale-lib-grid">${shown.map(_starterCardHtml).join('')}</div>`
      : `<div class="slopscale-lib-empty">No starters match these filters — clear one to see more.</div>`;
  }
  // Fork a starter into the editable timeline. Replace-guard: if the current draft
  // has edits, stage a confirm strip instead of clobbering (force=true confirms).
  function loadStarter(id, force) {
    if (!BUILT_IN_SESSIONS[id]) return;
    if (_workoutDirty && _workoutDraft && !force) { _pendingStarter = id; renderStarters(); return; }
    _selectedStarterId = id;   // selection state (replaces the old dropdown value)
    _workoutDraft = workoutDraftFor(id); _workoutDraftId = id; _workoutDirty = false; _pendingStarter = null;
    clearRefreshSummary(); renderWorkoutDraft();
    toggleStarters(false);
  }

  // ── Pack manager (the band-bar "+") ─────────────────────────────────────────
  // A pack === a band. Core packs (kind:'core') are DERIVED — always installed,
  // pinned first in fixed staircase order, never written to storage. Storage tracks
  // only the user's Style packs: { installed:[styleIds], order:[styleIds] }. A
  // missing/corrupt key = Core only (Style packs start in the Available column —
  // the "+" IS the breadth-reveal). Reuses the cheat-card overlay; commits nothing
  // until Save (works on a draft copy). "Remove" = move back to Available, never delete.
  function packsLoad() {
    try {
      const o = JSON.parse(localStorage.getItem('slopscale.packs') || '{}');
      return { installed: Array.isArray(o.installed) ? o.installed : [],
               order:     Array.isArray(o.order)     ? o.order     : [] };
    } catch { return { installed: [], order: [] }; }
  }
  function packsSave(state) {
    try { localStorage.setItem('slopscale.packs', JSON.stringify({ installed: state.order.slice(), order: state.order.slice() })); }
    catch (e) { console.warn('[SlopScale] packs save failed', e); }
  }
  const _stylePackIds = () => PATHWAY_BANDS.filter(b => b.kind === 'style').map(b => b.id);
  const _corePackIds  = () => PATHWAY_BANDS.filter(b => b.kind === 'core').map(b => b.id);
  // Installed Style packs in saved order — self-healing: existing+installed style
  // ids only, deduped, with any installed-but-unordered id appended.
  function installedStyleOrder(state) {
    const st = state || packsLoad();
    const styles = _stylePackIds();
    const inst = st.installed.filter(id => styles.includes(id));
    const ordered = st.order.filter(id => inst.includes(id));
    inst.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
    return ordered;
  }
  // The picker's band order: Core (fixed) + installed Style packs (user order).
  function visiblePackOrder() { return _corePackIds().concat(installedStyleOrder()); }

  let _packsDraft = null;   // { order:[styleIds] } working copy while the modal is open
  let _packsSel = null;     // { col:'available'|'installed', id } current selection

  function togglePackManager(force) {
    const root = $('slopscale-root'); if (!root) return;
    const open = force != null ? force : !root.classList.contains('ss-packs-open');
    if (open) { _packsDraft = { order: installedStyleOrder() }; _packsSel = null; }
    root.classList.toggle('ss-packs-open', open);
    $('slopscale-packs-modal')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.querySelectorAll('.slopscale-band-add').forEach(b => b.classList.toggle('active', open));
    if (open) renderPackManager(); else { _packsDraft = null; _packsSel = null; }
  }

  function renderPackManager() {
    const inst = $('slopscale-packs-installed');
    const avail = $('slopscale-packs-available');
    if (!inst || !avail || !_packsDraft) return;
    const installedStyles = _packsDraft.order.slice();
    const availableStyles = _stylePackIds().filter(id => !installedStyles.includes(id));

    // Installed column: Core (pinned, locked) → hairline → Style (draggable, ordered)
    inst.innerHTML = '';
    _corePackIds().forEach(id => inst.appendChild(_packRow(id, 'installed', { core: true })));
    const hr = document.createElement('div'); hr.className = 'slopscale-pack-hairline'; inst.appendChild(hr);
    if (!installedStyles.length) {
      inst.appendChild(_packEmpty('No style packs installed — add one from Available.'));
    } else {
      installedStyles.forEach(id => inst.appendChild(_packRow(id, 'installed', {})));
    }

    // Available column: grouped by family in curriculum-map order
    avail.innerHTML = '';
    if (!availableStyles.length) {
      avail.appendChild(_packEmpty('All style packs installed — drag one here to hide it.'));
    } else {
      const famOf = id => (PATHWAY_BANDS.find(b => b.id === id) || {}).family;
      const fams = PACK_FAMILY_ORDER.filter(f => availableStyles.some(id => famOf(id) === f));
      availableStyles.forEach(id => { const f = famOf(id); if (f && !fams.includes(f)) fams.push(f); });
      fams.forEach(f => {
        const head = document.createElement('div'); head.className = 'slopscale-pack-fam'; head.textContent = f; avail.appendChild(head);
        availableStyles.filter(id => famOf(id) === f).forEach(id => avail.appendChild(_packRow(id, 'available', {})));
      });
    }
    _syncPackMoveButtons();
  }

  function _packEmpty(msg) { const d = document.createElement('div'); d.className = 'slopscale-pack-empty'; d.textContent = msg; return d; }

  function _packRow(id, col, opts) {
    const b = PATHWAY_BANDS.find(x => x.id === id) || { label: id };
    const row = document.createElement('div');
    row.className = 'slopscale-segment-card slopscale-pack-row'
      + (opts.core ? ' is-core' : '')
      + (_packsSel && _packsSel.col === col && _packsSel.id === id ? ' active' : '');
    row.dataset.packId = id;
    row.dataset.col = col;
    row.setAttribute('role', 'option');
    const lead = opts.core ? '<span class="slopscale-pack-lock" title="Core — always included" aria-hidden="true">🔒</span>'
      : (col === 'installed' ? '<span class="slopscale-pack-grip" aria-hidden="true">⋮⋮</span>' : '');
    const sub = (b.kind === 'style' && b.buildsOn) ? `<div class="slopscale-pw-sub">${b.buildsOn}</div>` : '';
    row.innerHTML = `<div class="slopscale-pw-rowtop">${lead}<span class="slopscale-pw-label">${b.label}${opts.core ? ' · Core' : ''}</span></div>${sub}`;
    if (!opts.core) {
      row.tabIndex = 0;
      const select = () => { _packsSel = { col, id }; renderPackManager(); };
      row.addEventListener('click', select);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
    }
    return row;
  }

  function _packInstall(id) {
    if (!_packsDraft || _packsDraft.order.includes(id) || !_stylePackIds().includes(id)) return;
    _packsDraft.order.push(id);
  }
  function _packUninstall(id) {
    if (!_packsDraft) return;
    _packsDraft.order = _packsDraft.order.filter(x => x !== id);
  }
  function _packReorder(id, beforeId) {
    if (!_packsDraft) return;
    const arr = _packsDraft.order.filter(x => x !== id);
    const at = beforeId ? arr.indexOf(beforeId) : -1;
    if (at < 0) arr.push(id); else arr.splice(at, 0, id);
    _packsDraft.order = arr;
  }
  // Which installed Style row a drop at clientY lands before (null = append to end).
  function _packRowUnder(container, clientY) {
    const rows = [...container.querySelectorAll('.slopscale-pack-row:not(.is-core)')];
    for (const r of rows) { const box = r.getBoundingClientRect(); if (clientY < box.top + box.height / 2) return r.dataset.packId; }
    return null;
  }
  function _syncPackMoveButtons() {
    const toInst = $('slopscale-packs-to-installed');
    const toAvail = $('slopscale-packs-to-available');
    if (toInst) toInst.disabled = !(_packsSel && _packsSel.col === 'available');
    if (toAvail) toAvail.disabled = !(_packsSel && _packsSel.col === 'installed');
  }
  // ── Session-end summary ("Last session" card in the P sheet) ────────────────
  // A calm, dismissible mirror of the run that just ended — what you practised,
  // time on the instrument, tempo-tier reached, streak. Descriptive + gained-only
  // (no score/accuracy/rank); meter-green only for a freshly-cleared tier. See
  // docs/design-system.md §13/§14. Inputs are controlled internal strings.
  function sessionSummaryCardHtml() {
    const s = _lastEndedSession; if (!s) return '';
    const mins = Math.floor(s.duration_ms / 60000), secs = Math.round((s.duration_ms % 60000) / 1000);
    const dur = `${mins}:${String(secs).padStart(2, '0')}`;
    const sk = s.scale ? `${s.key || ''} ${String(s.scale).replace(/_/g, ' ')}`.trim() : '';
    let tierLine = '';
    if (s.tierCleared && s.clearedTier != null) {
      tierLine = `<div class="slopscale-ss-cleared">▲ New tier cleared — ${TIER_LABELS[s.clearedTier] || ('Tier ' + (s.clearedTier + 1))}</div>`;
    } else if (s.mode === 'pathway' && s.bpm_tier != null && s.bpm_tier >= 0) {
      tierLine = `<div class="slopscale-ss-line">Reached ${TIER_LABELS[s.bpm_tier] || ('Tier ' + (s.bpm_tier + 1))}${s.bpm ? ` · ${s.bpm} BPM` : ''}</div>`;
    } else if (s.bpm) {
      tierLine = `<div class="slopscale-ss-line">${s.bpm} BPM</div>`;
    }
    const streakLine = s.streak > 0
      ? `<div class="slopscale-ss-line">${s.streak === 1 ? 'Streak started — day 1' : `Day ${s.streak} streak`}</div>`
      : '';
    // Depth-ladder credit (Phase 9 Slice 5) — gained-only, surfaced from
    // _lastEndedSession.depth = { xpGained, travelKey, travelRung } | null. The
    // Travel-rung flip is a genuine clear (meter-green); a first clean run in a new
    // key is neutral progress; XP is a calm readout. Null in Off mode → nothing.
    const d = s.depth;
    let depthLine = '';
    if (d && d.travelRung) depthLine = `<div class="slopscale-ss-cleared">▲ Travel rung cleared — it travels now</div>`;
    else if (d && d.travelKey) depthLine = `<div class="slopscale-ss-line">New ground — first clean run in ${d.travelKey}</div>`;
    const xpLine = (d && d.xpGained > 0) ? `<div class="slopscale-ss-line">+${d.xpGained} XP</div>` : '';
    return `<div class="slopscale-progress-sheet-section slopscale-ss-card">` +
      `<div class="slopscale-ss-head"><h4>Last session</h4>` +
      `<button type="button" class="slopscale-ss-dismiss" data-act="dismiss-summary" title="Dismiss" aria-label="Dismiss last-session card">✕</button></div>` +
      `<div class="slopscale-ss-what">${s.displayName}</div>` +
      (sk ? `<div class="slopscale-ss-sub">${sk}</div>` : '') +
      `<div class="slopscale-ss-line">Practiced ${dur}</div>` +
      tierLine + depthLine + xpLine + streakLine +
      `</div>`;
  }
  // Auto-present the card on a notable end (a tier cleared, or a real ≥20s run) by
  // opening P; for short blips just refresh so the card is ready when P next opens.
  function presentSessionSummary() {
    const root = $('slopscale-root');
    const notable = _lastEndedSession && (_lastEndedSession.tierCleared || _lastEndedSession.duration_ms >= 20000);
    if (notable && root && !root.classList.contains('ss-progress-open')) toggleProgressSheet(true);
    else renderProgressSheet();
  }
  // Progress sheet content (gamification's slot). Renders the "Last session" card
  // (if any) + streak + per-pathway tempo-tier dots — with an honest "coming" state
  // for XP/badges, since the slopscale.progress store is unbuilt (don't fake XP).
  function renderProgressSheet() {
    const body = $('slopscale-progress-sheet-body'); if (!body) return;
    const pt = pathwayTiersLoad();
    const streak = (($('slopscale-streak-num') || {}).textContent || '0').trim();
    const touched = Object.keys(pt)
      .filter(id => PATHWAYS[id] && (pt[id].highest_tier ?? -1) >= 0)
      .sort((a, b) => (pt[b].highest_tier ?? -1) - (pt[a].highest_tier ?? -1));
    const dotRow = (id) => {
      const pw = PATHWAYS[id], hi = (pt[id].highest_tier ?? -1);
      const dots = (pw.tempoTiers || []).map((_, i) => `<span class="tree-tier-dot${i <= hi ? ' cleared' : ''}"></span>`).join('');
      return `<div class="slopscale-pm-row"><span>${pw.label}</span><span class="slopscale-pm-dots">${dots}</span></div>`;
    };
    body.innerHTML =
      sessionSummaryCardHtml() +
      `<div class="slopscale-progress-sheet-section"><h4>Streak</h4><div class="slopscale-pm-row"><span>Current streak</span><strong>${streak} ${streak === '1' ? 'day' : 'days'}</strong></div></div>` +
      `<div class="slopscale-progress-sheet-section"><h4>Tempo-tier progress</h4>${touched.length ? touched.slice(0, 8).map(dotRow).join('') : '<div class="slopscale-pm-coming">Clear a tempo tier to see progress here.</div>'}</div>` +
      `<div class="slopscale-progress-sheet-section"><h4>XP &amp; badges</h4><div class="slopscale-pm-coming">Coming soon — your time-on-instrument and mastery will show here.</div></div>`;
  }
  // Header Setup popover (instrument + strings + tuning). The button shows the live
  // instrument + tuning; the popover toggles open. Closing on outside-click is bound
  // in bind(). The controls inside keep their IDs, so all instrument/tuning wiring is
  // unchanged — they just live in the header now.
  function setupLabelText() {
    const instrSel = document.querySelector('[name="instrument"]');
    const v = instrSel ? instrSel.value : 'guitar';
    const instr = v === 'bass' ? 'Bass' : v === 'piano' ? 'Piano' : 'Guitar';
    const tun = $('slopscale-tuning-select');
    let tuning = '';
    if (tun && tun.selectedOptions && tun.selectedOptions[0]) {
      tuning = tun.selectedOptions[0].textContent.replace(/\s*\(.*\)\s*/, '').trim();
    }
    return tuning ? `${instr} · ${tuning}` : instr;
  }
  function updateSetupButton() {
    const lbl = $('slopscale-setup-label');
    if (!lbl) return;
    lbl.textContent = setupLabelText();
    // Short form for the narrow-width degrade (CSS swaps to data-short via ::after).
    const instrSel = document.querySelector('[name="instrument"]');
    const v = instrSel ? instrSel.value : 'guitar';
    const short = v === 'bass' ? 'Bass' : v === 'piano' ? 'Pno' : 'Gtr';
    const tun = $('slopscale-tuning-select');
    const tShort = (tun && tun.selectedOptions && tun.selectedOptions[0])
      ? tun.selectedOptions[0].textContent.replace(/\s*\(.*\)\s*/, '').trim().slice(0, 4) : '';
    lbl.dataset.short = tShort ? `${short} · ${tShort}` : short;
  }
  function toggleSetupPopover(force) {
    const pop = $('slopscale-setup-popover'), btn = $('slopscale-setup-btn');
    if (!pop || !btn) return;
    const open = force != null ? force : pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  // Header settings menu (⚙) + its prefs: accent theme (live), default XP mode (a
  // stored default — ready for the unbuilt XP store), default count-in (seeds the
  // count-in control on load). All persisted to localStorage.
  function toggleSettingsMenu(force) {
    const menu = $('slopscale-settings-menu'), btn = $('slopscale-settings-btn');
    if (!menu || !btn) return;
    const open = force != null ? force : menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function applyTheme(name) {
    const root = $('slopscale-root'); if (!root) return;
    root.classList.remove('ss-theme-ember', 'ss-theme-violet');
    if (name) root.classList.add('ss-theme-' + name);
    try { localStorage.setItem('slopscale.theme', name || ''); } catch (_) {}
    document.querySelectorAll('#slopscale-theme-pick .slopscale-theme-swatch').forEach(b => b.classList.toggle('active', (b.dataset.theme || '') === (name || '')));
  }
  function applyXpModeDefault(mode) {
    try { localStorage.setItem('slopscale.xpMode', mode); } catch (_) {}
    document.querySelectorAll('#slopscale-xp-mode .slopscale-mini-btn').forEach(b => b.classList.toggle('active', b.dataset.xp === mode));
  }
  function applyCountInDefault(val) {
    setFieldSilent('countIn', String(val));   // the field is the source; syncTransport reflects the segments
    syncTransport();
  }
  function loadSettingsPrefs() {
    let theme = '', xp = 'casual', ci = null;
    try { theme = localStorage.getItem('slopscale.theme') || ''; } catch (_) {}
    try { xp = localStorage.getItem('slopscale.xpMode') || 'casual'; } catch (_) {}
    try { ci = localStorage.getItem('slopscale.countInDefault'); } catch (_) {}
    applyTheme(theme);
    applyXpModeDefault(xp);
    // First-run default = a 1-bar count-in, so a new player gets a gentle lead-in
    // on their first Play instead of starting cold on beat 1. A stored value wins
    // thereafter (including an explicit "Off" = '0', which is non-null).
    if (ci == null) ci = '1';
    applyCountInDefault(ci);
    const sel = $('slopscale-countin-default');
    if (sel) sel.value = ci;
  }

  function schedulePluckedString(ctx, when, freq, dur, instrument, gainScale, bendSemis) {
    // Triangle-based plucked-string synthesis — clean, audible, no WaveShaper
    // over-drive. Sawtooth + heavy distortion (prior approach) produced
    // click-like transients that were imperceptible as guitar notes on some
    // hardware. Triangle is softer and reads clearly as a pitched note.
    const isBass = instrument === 'bass';
    const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
    const preGain = ctx.createGain(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    osc1.type = 'triangle'; osc2.type = 'sine';
    const f1 = freq, f2 = isBass ? Math.max(25, freq * 0.5) : freq * 2;
    osc1.frequency.setValueAtTime(f1, when);
    osc2.frequency.setValueAtTime(f2, when);
    osc2.detune.setValueAtTime(isBass ? 0 : 7, when);
    // Bend: ramp both oscillators up by `bendSemis` semitones so the note is
    // heard sliding up to its target pitch, like a real string bend. Pick first
    // (short hold at the fretted pitch), then bend over ~40% of the note.
    if (bendSemis > 0) {
      const ratio = Math.pow(2, bendSemis / 12);
      const bendStart = when + 0.045;
      const bendEnd = when + Math.min(0.22, Math.max(0.10, dur * 0.4));
      osc1.frequency.setValueAtTime(f1, bendStart);
      osc1.frequency.exponentialRampToValueAtTime(f1 * ratio, bendEnd);
      osc2.frequency.setValueAtTime(f2, bendStart);
      osc2.frequency.exponentialRampToValueAtTime(f2 * ratio, bendEnd);
    }
    // Pre-gain mixes the two oscillators at a controlled level
    preGain.gain.setValueAtTime(isBass ? 0.55 : 0.60, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBass ? 1100 : 2400, when);
    filter.frequency.exponentialRampToValueAtTime(isBass ? 380 : 800, when + Math.max(0.08, dur));
    filter.Q.setValueAtTime(isBass ? 0.8 : 1.4, when);
    const amp = (isBass ? 0.42 : 0.38) * (gainScale || 1);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(amp, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(amp * 0.50, when + 0.070);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.12, dur));
    osc1.connect(preGain); osc2.connect(preGain);
    preGain.connect(filter); filter.connect(gain); gain.connect(trackBus(ctx, 'notes'));
    osc1.start(when); osc2.start(when);
    const stopAt = when + Math.max(0.14, dur) + 0.03;
    osc1.stop(stopAt); osc2.stop(stopAt);
    audioNodes.push(osc1, osc2, preGain, filter, gain);
  }
  function scheduleHarmonyPad(ctx, when, midis, dur, instrument, tone, opts) {
    if (!midis.length) return;
    tone = tone || 'pad';
    const bright = (opts && Number.isFinite(opts.bright)) ? opts.bright : 0.5;
    const lvl = (opts && Number.isFinite(opts.level)) ? opts.level : 1;

    if (tone === 'organ') {
      // Hammond drawbar simulation — additive sines, instant on/off, flat envelope
      const RATIOS = [1, 2, 3, 4, 5, 6, 8];
      const VOLS   = [0.8, 0.5, 0.35, 0.25, 0.18, 0.12, 0.08];
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.13 / Math.max(1, midis.length), when);
      const _hg = ctx.createGain(); _hg.gain.value = lvl; master.connect(_hg); _hg.connect(trackBus(ctx, 'harmony')); audioNodes.push(_hg);
      audioNodes.push(master);
      midis.slice(0, 4).forEach(midi => {
        RATIOS.forEach((r, ri) => {
          const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(midiToFreq(midi) * r, when);
          g.gain.setValueAtTime(VOLS[ri], when);
          osc.connect(g); g.connect(master);
          osc.start(when); osc.stop(when + dur);
          audioNodes.push(osc, g);
        });
      });
      return;
    }

    if (tone === 'epiano') {
      // Rhodes feel — triangle fundamental, fast percussive decay to sustain, bell partial
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, when);
      master.gain.exponentialRampToValueAtTime(0.28, when + 0.003);
      master.gain.exponentialRampToValueAtTime(0.09, when + Math.min(0.38, dur * 0.35));
      master.gain.linearRampToValueAtTime(0.06, when + Math.max(0.39, dur - 0.06));
      master.gain.linearRampToValueAtTime(0.0001, when + dur);
      const _hg = ctx.createGain(); _hg.gain.value = lvl; master.connect(_hg); _hg.connect(trackBus(ctx, 'harmony')); audioNodes.push(_hg);
      audioNodes.push(master);
      midis.slice(0, 4).forEach(midi => {
        const osc = ctx.createOscillator(), bell = ctx.createOscillator();
        const g = ctx.createGain(), gb = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(midiToFreq(midi), when);
        bell.type = 'sine'; bell.frequency.setValueAtTime(midiToFreq(midi) * 2, when);
        g.gain.setValueAtTime(0.65, when); gb.gain.setValueAtTime(0.09, when);
        osc.connect(g); g.connect(master);
        bell.connect(gb); gb.connect(master);
        osc.start(when); osc.stop(when + dur + 0.05);
        bell.start(when); bell.stop(when + dur + 0.05);
        audioNodes.push(osc, bell, g, gb);
      });
      return;
    }

    // pad (default) — triangle-led voices with ONE soft saw for a little edge
    // (stacking 4 saws was buzzy/harsh); per-voice gain normalized by voice count
    // so denser chords don't overdrive; lowpass that opens then settles so the
    // pad breathes instead of sitting static.
    const n = Math.min(5, midis.length);
    const master = ctx.createGain(), filter = ctx.createBiquadFilter();
    const bMul = 0.6 + bright * 0.8; // brightness scales the pad's lowpass window
    const fLo = (instrument === 'bass' ? 700 : 1100) * bMul, fHi = (instrument === 'bass' ? 1500 : 2600) * bMul;
    filter.type = 'lowpass'; filter.Q.setValueAtTime(0.5, when);
    filter.frequency.setValueAtTime(fLo, when);
    filter.frequency.exponentialRampToValueAtTime(fHi, when + Math.min(0.18, dur * 0.4));
    filter.frequency.exponentialRampToValueAtTime(Math.max(fLo, fHi * 0.72), when + dur);
    master.gain.setValueAtTime(0.0001, when);
    master.gain.exponentialRampToValueAtTime(0.26, when + 0.022);
    master.gain.linearRampToValueAtTime(0.2, when + Math.max(0.1, dur - 0.18));
    master.gain.linearRampToValueAtTime(0.0001, when + dur);
    filter.connect(master); const _hg = ctx.createGain(); _hg.gain.value = lvl; master.connect(_hg); _hg.connect(trackBus(ctx, 'harmony')); audioNodes.push(_hg);
    audioNodes.push(filter, master);
    const voiceGain = 0.5 / Math.sqrt(n);
    midis.slice(0, n).forEach((midi, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = (i === 1) ? 'sawtooth' : 'triangle';            // single soft saw for edge; rest triangle
      osc.frequency.setValueAtTime(midiToFreq(midi), when);
      osc.detune.setValueAtTime((i - (n - 1) / 2) * 4, when);     // gentle spread, centred
      g.gain.setValueAtTime(i === 0 ? voiceGain * 1.25 : (i === 1 ? voiceGain * 0.7 : voiceGain), when);
      osc.connect(g); g.connect(filter); osc.start(when); osc.stop(when + dur + 0.05); audioNodes.push(osc, g);
    });
  }
  // Three click tiers: accent (group/measure downbeat), normal (on-beat), and
  // soft (a count-in subdivision tick between beats).
  function scheduleClick(ctx, when, accent, soft) {
    const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    const freq = accent ? 1760 : (soft ? 900 : 1120);
    const peak = accent ? 0.14 : (soft ? 0.05 : 0.09);
    const decay = accent ? 0.055 : (soft ? 0.03 : 0.04);
    osc.type = 'square'; osc.frequency.setValueAtTime(freq, when); filter.type = 'highpass'; filter.frequency.setValueAtTime(650, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(peak, when + 0.002); gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(filter); filter.connect(gain); gain.connect(trackBus(ctx, 'click')); osc.start(when); osc.stop(when + 0.07); audioNodes.push(osc, filter, gain);
  }
  // ── Procedural drum kit (audio-realism Phase D — synth 808/909) ─────────────
  // Zero-asset, zero-licensing, authentic-by-construction electronic kit (and the
  // never-silent failover for the sampled kits in D4). Every hit gets a 3–6 ms
  // attack ramp (no hard transient) and routes through the drum sub-bus (its own
  // compressor + >8 kHz shelf, before the master limiter). `vol` already carries
  // the role level × structural velocity; per-piece peak gains shape the balance
  // (kick softened most). Starting numbers — ear-tunable on the backend.
  let _drumNoiseBuf = null, _drumNoiseCtx = null;
  function drumNoiseBuffer(ctx) {
    if (_drumNoiseBuf && _drumNoiseCtx === ctx) return _drumNoiseBuf;
    const len = Math.floor(ctx.sampleRate * 1.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    _drumNoiseBuf = buf; _drumNoiseCtx = ctx; return buf;
  }
  // Natural ring-out per piece for sampled hits (cymbals ring; hats/kick are short).
  // hatOpen uses the choke dur from buildDrumEvents instead.
  const DRUM_NATURAL_DUR = { kick:0.5, snare:0.4, hatClosed:0.12, hatPedal:0.1, hatOpen:0.5, ride:0.6, crash:2.0, tomHi:0.5, tomMid:0.5, tomLo:0.5, clap:0.3 };
  // Play one sampled drum hit via WebAudioFont — wafVoice MINUS wafLoudnessTrim (a
  // drum note number is a piece selector, not a pitch, so the pitch-tilt is wrong).
  // Routes through the drum sub-bus (its own comp + shelf, before the master limiter).
  function wafDrumVoice(ctx, preset, note, when, vol, dur) {
    if (!wafPlayer || !preset) return;
    const e = wafPlayer.queueWaveTable(ctx, trackBus(ctx, 'drums'), preset, when, note, Math.max(0.08, dur || 0.4), Math.max(0, vol));
    if (e) audioNodes.push({ stop() { try { e.cancel(); } catch (_) {} }, disconnect() {} });
  }
  // Dispatch one drum hit. Sample kits (Phase D4) play the FluidR3 one-shot when its
  // preset is loaded; until then (or for a missing piece) they fall back to the synth
  // 909 voice — degraded-but-audible, never silent (matches the melodic failover).
  function scheduleDrumHit(ctx, kit, piece, when, vol, dur) {
    if (kit && kit.engine === 'sample' && kit.pieces) {
      const note = kit.pieces[piece];
      if (note != null) {
        ensureDrumPiece(kit, piece);   // lazy-load cymbals/toms on first use
        const preset = getReadyWafPreset(drumVar(note, kit.font, kit.variant));
        if (preset) {
          const d = (piece === 'hatOpen' && Number.isFinite(dur)) ? dur : (DRUM_NATURAL_DUR[piece] || 0.4);
          wafDrumVoice(ctx, preset, note, when, Math.max(0, vol) * (kit.level || 1), d);
          return;
        }
      }
      scheduleSynthDrumHit(ctx, '909', piece, when, vol, dur);   // fallback: cold-load / missing piece
      return;
    }
    scheduleSynthDrumHit(ctx, (kit && kit.preset) || '909', piece, when, vol, dur);
  }
  // Procedural synth drum voice (808/909) — the electronic kits + the sample failover.
  function scheduleSynthDrumHit(ctx, preset, piece, when, vol, dur) {
    const out = trackBus(ctx, 'drums');
    const v = Math.max(0, vol || 0);
    if (v <= 0) return;
    const RAMP = 0.004;   // 4 ms attack ramp — hearing-safe, no click transient
    const env = (g, peak, decay) => {
      const p = Math.max(0.0002, peak);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(p, when + RAMP);
      g.gain.exponentialRampToValueAtTime(0.0001, when + RAMP + Math.max(0.02, decay));
    };
    const is808 = preset === '808';
    const noise = (peak, decay, type, freq, q) => {
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = drumNoiseBuffer(ctx);
      f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q;
      env(g, peak, decay);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(when); n.stop(when + RAMP + decay + 0.05);
      audioNodes.push(n, f, g);
    };
    switch (piece) {
      case 'kick': {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'sine';
        const f0 = is808 ? 120 : 170, f1 = is808 ? 43 : 52, pdrop = is808 ? 0.05 : 0.04;
        const decay = is808 ? 0.6 : 0.22;
        osc.frequency.setValueAtTime(f0, when);
        osc.frequency.exponentialRampToValueAtTime(f1, when + pdrop);
        env(g, 0.5 * v, decay);            // kick softened most (biggest peak risk)
        let tail = g;
        if (is808) { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30; g.connect(hp); tail = hp; audioNodes.push(hp); }
        osc.connect(g); tail.connect(out);
        osc.start(when); osc.stop(when + RAMP + decay + 0.05); audioNodes.push(osc, g);
        if (!is808) noise(0.16 * v, 0.02, 'bandpass', 2200, 0.8);   // 909 click layer
        break;
      }
      case 'snare':
        noise(0.5 * v, 0.16, 'bandpass', 2600, 0.6);                // crack (70%)
        { const osc = ctx.createOscillator(), g = ctx.createGain();  // tone body (30%)
          osc.type = 'triangle'; osc.frequency.setValueAtTime(190, when);
          env(g, 0.22 * v, 0.1); osc.connect(g); g.connect(out);
          osc.start(when); osc.stop(when + RAMP + 0.12 + 0.05); audioNodes.push(osc, g); }
        break;
      case 'hatClosed':
        noise(0.32 * v, 0.035, 'highpass', 7500);
        break;
      case 'hatOpen':
        noise(0.28 * v, (Number.isFinite(dur) ? dur : 0.32), 'highpass', 7500);
        break;
      case 'clap': {
        const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        n.buffer = drumNoiseBuffer(ctx); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7;
        g.gain.setValueAtTime(0.0001, when);
        [0, 0.01, 0.02].forEach(off => {                            // 3 retriggered bursts
          g.gain.exponentialRampToValueAtTime(0.4 * v, when + off + 0.002);
          g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.08 * v), when + off + 0.008);
        });
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
        n.connect(f); f.connect(g); g.connect(out);
        n.start(when); n.stop(when + 0.2); audioNodes.push(n, f, g);
        break;
      }
      case 'tomHi': case 'tomMid': case 'tomLo': {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        const f0 = piece === 'tomHi' ? 220 : piece === 'tomMid' ? 150 : 100;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f0, when);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.7, when + 0.12);
        env(g, 0.42 * v, 0.25); osc.connect(g); g.connect(out);
        osc.start(when); osc.stop(when + RAMP + 0.25 + 0.05); audioNodes.push(osc, g);
        break;
      }
      case 'crash':
        noise(0.3 * v, 0.6, 'highpass', 5000);                      // electronic cymbal only
        break;
    }
  }
  // Resolve the active drum kit OBJECT. Mixer kit override wins, then the profile's
  // kit, then kit_909. An unregistered id falls back to kit_909 so the band is never
  // silent. The returned object carries `id` + the kit's engine/preset/pieces.
  function resolveDrumKit(profile) {
    const kitId = mixerKitFor('drums') || (profile && profile.drums && profile.drums.kit) || 'kit_909';
    const reg = KIT_REGISTRY[kitId] || KIT_REGISTRY.kit_909;
    return Object.assign({ id: KIT_REGISTRY[kitId] ? kitId : 'kit_909' }, reg);
  }
  // ── Per-voice level consistency (audio-realism Phase A) ─────────────────────
  // One named vol per role (not magic scalars scattered through the scheduler) +
  // a perceptual loudness-trim tilt by pitch, so WAF's per-keymap level variance
  // and the Fletcher-Munson low-end dip don't make a run sound uneven. Sound-design
  // targets: lift <150 Hz ~+2.5 dB, flat through the mid band, tame >2 kHz ~−1.5 dB.
  // Applied inside wafVoice (and to the bent-note oscillator fallback so it matches
  // the sampled voice it stands in for). See ROADMAP audio-realism Phase A.
  const WAF_VOICE_VOL = { notes: 0.7, harmony: 0.5, bass: 0.8, drums: 0.7 };
  function wafLoudnessTrim(midi) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    let db;
    if (f <= 150) db = 2.5;
    else if (f <= 600) db = 2.5 * (1 - (f - 150) / 450);        // 150→600 Hz: +2.5 → 0 dB
    else if (f <= 2000) db = -1.5 * ((f - 600) / 1400);         // 600→2000 Hz: 0 → −1.5 dB
    else db = -1.5;
    return Math.pow(10, db / 20);
  }
  function schedulePreviewAudio(bundle, fromTime, delaySeconds) {
    const cfg = readConfig();
    // Prefer the bundle's own audio settings (sessions patch their own config)
    // so the session's checkboxes are honoured rather than the single-exercise ones.
    const audio = bundle.config?.audio || cfg.audio;
    const lead = bundle.leadIn || 0;
    // The count-in lead-in always clicks (it's a count-in), so proceed even when
    // all audio is off if this pass covers the lead-in.
    const wantCountIn = lead > 0 && (fromTime || 0) < lead - 1e-4;
    if (!audio.notes && !audio.metronome && !audio.harmony && !wantCountIn) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const ctx = audioCtx, base = ctx.currentTime + (Number.isFinite(delaySeconds) ? delaySeconds : AUDIO_LOOKAHEAD_SECONDS), startFrom = fromTime || 0;
    // Use the bundle's own openMidis so note frequencies always match what was
    // generated — prevents pitch mismatch when the form's string setup differs
    // from the exercise (e.g. session generated with 6-string, form shows 8-string).
    const opens = (bundle.openMidis && bundle.openMidis.length) ? bundle.openMidis : openMidisForConfig(cfg);
    const instrument = bundle.config?.instrument || cfg.instrument;
    const duration = bundle.songInfo?.duration || 0;
    const harmProfile = resolveAudioProfile({ ...cfg, audio });
    // Sample path: if a voice wants a sampled instrument, kick its (async) load
    // and use it once ready; until then, fall back to the oscillator voice.
    // Three sampled voices: harmony (backing comp), bass (backing bass line),
    // notes (the practice voice). Each falls back independently.
    // Mixer per-channel instrument override wins over the profile's voice (Phase C).
    const harmGm  = mixerInstrumentFor('harmony') ?? (harmProfile.harmony.engine === 'sample' ? TONE_GM[harmProfile.harmony.tone] : null);
    const bassGm  = mixerInstrumentFor('bass')    ?? (harmProfile.bass.engine    === 'sample' ? TONE_GM[harmProfile.bass.tone]    : null);
    const notesGm = mixerInstrumentFor('notes')   ?? (harmProfile.notes.engine   === 'sample' ? TONE_GM[harmProfile.notes.tone]   : null);
    if (audio.harmony && harmGm != null) ensureWafPreset(harmGm);
    if (audio.harmony && bassGm != null) ensureWafPreset(bassGm);   // backing bass (boogie walk)
    if (audio.notes   && notesGm != null) ensureWafPreset(notesGm); // practice voice
    const harmPreset = getReadyWafPreset(harmGm);
    const bassPreset = getReadyWafPreset(bassGm);
    const notesPreset = getReadyWafPreset(notesGm);
    const wafVoice = (preset, busName, when, midi, d, vol) => {
      const e = wafPlayer.queueWaveTable(ctx, trackBus(ctx, busName), preset, when, midi, d, vol * wafLoudnessTrim(midi));
      if (e) audioNodes.push({ stop() { try { e.cancel(); } catch (_) {} }, disconnect() {} });
    };
    if (audio.harmony) for (const ev of bundle.backingEvents || []) {
      if (ev.role === 'drums') continue;   // drums have their own kit/bus/loop below
      if (ev.end < startFrom || ev.t > duration + 0.1) continue;
      const start = Math.max(ev.t, startFrom), end = Math.min(ev.end, duration);
      const when = base + (start - startFrom), d = Math.max(0.2, end - start);
      if (ev.role === 'bass') {
        // Backing bass line — a real bass voice on its own bus, not the harmony pad.
        for (const m of (ev.midis || [])) {
          if (bassPreset && wafPlayer) wafVoice(bassPreset, 'bass', when, m, d, harmProfile.bass.level * WAF_VOICE_VOL.bass);
          else schedulePluckedString(ctx, when, midiToFreq(m), d, 'bass', harmProfile.bass.level, 0);
        }
      } else if (harmPreset && wafPlayer) {
        // Scale per-voice level by 1/√(chord size) so a dense comp doesn't sum hot
        // into the limiter (anti-clip; matches the synth pad's density-scaling).
        const hn = (ev.midis || []).length, hScale = 1 / Math.sqrt(Math.max(1, hn));
        for (const m of (ev.midis || [])) wafVoice(harmPreset, 'harmony', when, m, d, harmProfile.harmony.level * WAF_VOICE_VOL.harmony * hScale);
      } else {
        scheduleHarmonyPad(ctx, when, ev.midis || [], d, instrument, harmProfile.harmony.tone, { bright: harmProfile.brightness, level: harmProfile.harmony.level });
      }
    }
    // Drums (Phase D) — role:'drums' events on their own kit + drum sub-bus. The
    // band plays together, so drums follow the harmony backing (mute via the Mixer
    // Drums channel, or set audio.drums:false). Silent through the count-in: no
    // drum event exists in [0, lead) after the makeBundle shift, and the guard
    // catches any early fill/anticipation a future groove might add.
    if (audio.harmony && audio.drums !== false) {
      const drumKit = resolveDrumKit(harmProfile);
      for (const ev of bundle.backingEvents || []) {
        if (ev.role !== 'drums') continue;
        if (ev.t < lead - 1e-4) continue;                 // count-in silence
        if (ev.t < startFrom || ev.t > duration + 0.1) continue;
        scheduleDrumHit(ctx, drumKit, ev.voice, base + (ev.t - startFrom),
          WAF_VOICE_VOL.drums * (Number.isFinite(ev.velocity) ? ev.velocity : 0.78), ev.dur);
      }
    }
    if (audio.notes) for (const n of bundle.notes || []) {
      if (n._tail) continue;  // visual loop-preview copy; audio loops via the scheduler
      if (n.t < startFrom || n.t > duration + 0.1) continue;
      if (n.s < 0 || n.s >= opens.length || n.f < 0) continue;
      const when = base + (n.t - startFrom), midi = opens[n.s] + n.f;
      const dur = Math.max(0.10, Math.min(0.85, n.sus || 0.24)), bend = bendSemitones(n.bn);
      // Sampled practice voice for plain notes; the oscillator voice still owns
      // BENT notes (the sampler can't slide pitch) so blues bends stay audible.
      if (notesPreset && wafPlayer && bend <= 0) {
        wafVoice(notesPreset, 'notes', when, midi, dur, harmProfile.notes.level * WAF_VOICE_VOL.notes);
      } else {
        // When a sampled voice IS available but this note bends, the oscillator
        // stands in for it — match its level to the sampler (incl. the loudness
        // trim) so the bend doesn't lurch in volume mid-run (audio-realism A3).
        // Oscillator-only profiles (no notesPreset) keep their own level.
        const sampled = notesPreset && wafPlayer;
        const g = sampled
          ? harmProfile.notes.level * WAF_VOICE_VOL.notes * wafLoudnessTrim(midi)
          : (audio.harmony ? 0.9 : 1.25);
        schedulePluckedString(ctx, when, midiToFreq(midi), dur, instrument, g, bend);
      }
    }
    // Music beats click only when the metronome option is on; the count-in
    // lead-in bars ([0, leadIn)) ALWAYS click so the count is audible even with
    // the metronome off.
    {
      const beats = bundle.beats || [];
      const perBeat = Math.max(1, cfg.clickSubdiv || 1);
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        if (b._tail) continue;  // visual loop-preview copy; don't double-click at the seam
        if (b.time < startFrom || b.time > duration + 0.1) continue;
        const inCountIn = lead > 0 && b.time < lead - 1e-4;
        if (!audio.metronome && !inCountIn) continue;
        // Strong accent on measure downbeats and grouping starts (e.g. 7/8 as
        // 3+2+2). Beats are already meter-correct (built by buildBeats), so this
        // follows the time-signature selection.
        const accent = b.accent === 'measure' || b.accent === 'group' || (b.measure || -1) >= 0;
        scheduleClick(ctx, base + (b.time - startFrom), accent, false);
        if (perBeat > 1) {
          // Derive this beat's length from the actual gap to the next beat so
          // sub-ticks stay correct across bar lines and per-segment meters in
          // sessions; fall back to the previous gap or the form's beat unit.
          const next = beats[i + 1];
          const beatLen = next ? (next.time - b.time)
            : (i > 0 ? b.time - beats[i - 1].time : (60 / cfg.bpm) * (4 / cfg.meter.denominator));
          const tickLen = beatLen / perBeat;
          for (let k = 1; k < perBeat; k++) {
            const t = b.time + k * tickLen;
            if (t < startFrom || t > duration + 0.1) continue;
            scheduleClick(ctx, base + (t - startFrom), false, true);
          }
        }
      }
    }
    // Return the ctx-time that chart-time `startFrom` maps to, so the loop
    // scheduler can compute when this pass ends and queue the next gaplessly.
    return base;
  }
  // ===========================================================================
  // §14 · TRANSPORT, HUD, PLAYBACK CLOCK + AUDIO ENGINE
  // startPlayback() owns the RAF clock (currentPracticeTime), Web Audio scheduling,
  // and the Minigames pitch tracker. Contained playback — never hands off to host.
  // ===========================================================================
  function startPlayback() {
    if (!activeBundle) return;
    sessionEnd(); // flush any in-progress session before starting a new one
    sessionBegin();
    stopAudio(); syncHighwaySettings(activeBundle);
    playing = true;
    // With an active A–B loop, playback begins at the loop start — not wherever
    // the playhead happens to sit (DAW cycle behavior; the playhead is just a
    // seek cursor). Without this, scrubbing then hitting Play started mid-loop.
    if (segmentLoopA != null && segmentLoopB != null) {
      currentPracticeTime = Math.min(segmentLoopA, segmentLoopB);
    }
    playAnchorChartTime = currentPracticeTime;
    playStartChartTime = currentPracticeTime;  // remember where this play began (for Stop)
    // Count-in is baked into the chart as lead-in rest bars (see applyCountIn),
    // so playback just starts from the playhead — no playhead freeze. Starting
    // from 0 plays the count-in once; the loop then cycles the music only. The
    // count-in clicks come from schedulePreviewAudio (lead-in beats always tick).
    const startMs = performance.now();
    playAnchorMs = startMs + AUDIO_LOOKAHEAD_SECONDS * 1000;
    scheduleCurrentPassAndAnchor(AUDIO_LOOKAHEAD_SECONDS);
    if (!rafId) rafId = requestAnimationFrame(tick);
    startPitchTracker(activeBundle); syncPlayButton(); refreshStatusFromState();
  }
  // Stop returns the playhead to where playback last began (Logic Pro behaviour:
  // hit Play to instantly replay the same passage). The ⏮ button jumps to the
  // very start — Logic's "press Stop again to go to the top".
  function stopPlayback() { sessionEnd(); playing = false; currentPracticeTime = playStartChartTime; playAnchorChartTime = playStartChartTime; stopAudio(); stopPitchTracker(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } drawOnce(); syncPlayButton(); refreshStatusFromState(); }
  // Toggle for the primary Play/Stop button. If we don't have a chart yet,
  // generate one first so the very first click always plays something.
  async function onPlayToggle() {
    if (playing) { stopPlayback(); return; }
    // Create/resume the AudioContext inside the click gesture (before any await) so
    // the voice warm-up + playback don't start on a suspended context.
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    // In session mode, Play builds + starts the selected session if one isn't
    // already loaded; otherwise it replays the built session from the playhead.
    if ($('slopscale-root')?.classList.contains('slopscale-session-mode')) {
      if (!activeBundle || activeBundle.config?.mode !== 'session') { await onLaunchSession(); return; }
      await awaitVoices(activeBundle);  // start on WAF, not the oscillator
      startPlayback();
      return;
    }
    if (!activeBundle) { await onGenerate(); }
    await awaitVoices(activeBundle);  // start on WAF, not the oscillator
    startPlayback();
  }

  // ── Playback transport (scrubber + A/B loop + count-in) ──────────────────────
  function fmtTime(s) { s = Math.max(0, s || 0); const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return m + ':' + String(sec).padStart(2, '0'); }

  // Seek the preview to an absolute chart time. Mirrors setSegmentLoop's
  // re-anchor logic so audio resumes from the new spot rather than going silent.
  function seekTo(t) {
    if (!activeBundle) return;
    const dur = activeBundle.songInfo?.duration || 0;
    currentPracticeTime = Math.max(0, Math.min(dur, Number(t) || 0));
    if (playing) {
      playAnchorChartTime = currentPracticeTime;
      playAnchorMs = performance.now() + AUDIO_LOOKAHEAD_SECONDS * 1000;
      stopAudio();
      scheduleCurrentPassAndAnchor(AUDIO_LOOKAHEAD_SECONDS);
    } else {
      drawOnce();
    }
    syncTransportTime();
  }

  // Per-frame light sync: scrubber position + current-time readout.
  function syncTransportTime() {
    const cur = $('slopscale-time-cur');
    if (cur) cur.textContent = fmtTime(currentPracticeTime);
    updateActiveSegment();
  }

  // Full transport refresh: scrubber range, duration readout, loop region +
  // button states, loop counter, and the count-in segmented control. Called on
  // bundle change, loop change, and mode change — not every frame.
  function syncTransport() {
    const dur = activeBundle?.songInfo?.duration || 0;
    const hudTitle = $('slopscale-hud-title');
    if (hudTitle) hudTitle.textContent = activeBundle ? describeCurrentContent() : '';
    const durEl = $('slopscale-time-dur'); if (durEl) durEl.textContent = fmtTime(dur);
    syncTransportTime();
    paintLoopRegion();
    $('slopscale-loop-a')?.classList.toggle('active', tpA != null);
    $('slopscale-loop-b')?.classList.toggle('active', tpB != null);
    const lc = $('slopscale-loop-count');
    if (lc) { const active = segmentLoopA != null && segmentLoopB != null; lc.hidden = !active || _loopWraps < 1; lc.textContent = 'Loop ' + _loopWraps; }
    const lr = $('slopscale-loop-range');
    if (lr) { const txt = loopReadoutText(); lr.hidden = !txt; lr.textContent = txt || ''; }
    syncFeelControl();
    const ci = document.querySelector('#slopscale-controls [name="countIn"]')?.value || '0';
    document.querySelectorAll('.slopscale-tp-seg').forEach(b => b.classList.toggle('active', b.dataset.countin === ci));
    renderSessionProgress();
    _activeSegIdx = -1; updateActiveSegment();
  }

  // The loop region is now drawn directly on the unified ruler canvas; this
  // just triggers a redraw (kept as a named function since callers reference it).
  function paintLoopRegion() { drawRulerFrame(); drawOverviewFrame(); }

  // Measure downbeats (bar lines) of the active chart, ascending.
  function chartDownbeats() {
    return (activeBundle?.beats || []).filter(b => (b.measure || -1) >= 0).map(b => b.time).sort((x, y) => x - y);
  }
  // Snap a time to the nearest bar line, unless `free` (Alt held) or no grid.
  function snapToDownbeat(t, free) {
    if (free) return t;
    const d = chartDownbeats();
    if (!d.length) return t;
    return d.reduce((best, x) => Math.abs(x - t) < Math.abs(best - t) ? x : best, d[0]);
  }

  // Bar.beat label for a time (e.g. "5.1") from the chart's beat grid — the
  // downbeat is beat 1, each subsequent non-bar beat increments. null before the
  // first bar line (e.g. during a count-in lead-in).
  function timeBarBeat(t) {
    const beats = activeBundle?.beats || [];
    let measure = null, beatInBar = 0;
    for (const b of beats) {
      if (b.time > t + 1e-3) break;
      if ((b.measure ?? -1) >= 0) { measure = b.measure; beatInBar = 1; }
      else if (measure != null) beatInBar++;
    }
    return measure == null ? null : measure + '.' + beatInBar;
  }
  // DAW-style cycle readout: "5.1–8.4 · 3 bars" (bar.beat bounds + bar span), or
  // a seconds fallback when there's no bar grid. null when no loop is set.
  function loopReadoutText() {
    if (tpA == null || tpB == null || Math.abs(tpA - tpB) < 0.02) return null;
    const lo = Math.min(tpA, tpB), hi = Math.max(tpA, tpB);
    const a = timeBarBeat(lo), b = timeBarBeat(hi);
    const bars = chartDownbeats().filter(x => x > lo + 0.02 && x <= hi + 0.02).length;
    const span = bars > 0 ? (bars + ' bar' + (bars === 1 ? '' : 's')) : ((hi - lo).toFixed(1) + 's');
    return (a && b) ? (a + '–' + b + ' · ' + span) : ((hi - lo).toFixed(1) + 's');
  }

  // Commit the A/B points to the loop engine once both are set and distinct;
  // otherwise leave the loop disengaged (a single point just paints a marker).
  function commitLoop() {
    if (tpA != null && tpB != null && Math.abs(tpA - tpB) > 0.02) {
      try { setSegmentLoop(Math.min(tpA, tpB), Math.max(tpA, tpB)); }
      catch (_) { clearSegmentLoop(); }
    } else {
      clearSegmentLoop();
    }
    _loopWraps = 0;
    syncTransport();
  }

  // Reset all transport loop state — used when a fresh chart is generated and
  // the old A/B times may no longer be valid for the new duration.
  function resetTransportLoop() {
    tpA = null; tpB = null; _loopWraps = 0; _activeSegIdx = -1;
    clearSegmentLoop();
    syncTransport();
  }

  // ── Session transport (segment progress, jump, highlight, per-segment loop) ──
  function sessionBounds() { return (activeBundle && Array.isArray(activeBundle.segmentBounds)) ? activeBundle.segmentBounds : null; }

  function currentSegmentIndex() {
    const b = sessionBounds(); if (!b || !b.length) return -1;
    const t = currentPracticeTime;
    for (let i = 0; i < b.length; i++) if (t >= b[i].start - 1e-6 && t < b[i].end - 1e-6) return i;
    return t >= b[b.length - 1].end - 1e-6 ? b.length - 1 : 0;
  }

  // Render the proportional segment bar (chunk width ∝ segment duration).
  function renderSessionProgress() {
    const host = $('slopscale-session-progress'); if (!host) return;
    const b = sessionBounds(), dur = activeBundle?.songInfo?.duration || 0;
    if (!b || !b.length || dur <= 0) { host.innerHTML = ''; return; }
    host.innerHTML = b.map((seg, i) => {
      const grow = Math.max(0.0001, (seg.end - seg.start) / dur);
      const label = String(seg.name || `Seg ${i + 1}`).replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `<button type="button" class="slopscale-progress-seg" data-seg-index="${i}" style="flex-grow:${grow.toFixed(4)}" title="${label}">${label}</button>`;
    }).join('');
  }

  // Cheap per-frame check: only touch the DOM when the active segment changes.
  function updateActiveSegment() {
    const idx = currentSegmentIndex();
    if (idx === _activeSegIdx) return;
    _activeSegIdx = idx;
    document.querySelectorAll('#slopscale-session-progress .slopscale-progress-seg').forEach((el, i) => el.classList.toggle('active', i === idx));
    document.querySelectorAll('#slopscale-segment-list .slopscale-segment-card').forEach((el, i) => el.classList.toggle('active', i === idx));
  }

  function jumpToSegment(i) { const b = sessionBounds(); if (b && b[i]) seekTo(b[i].start); }

  function prevSegment() {
    const b = sessionBounds(); if (!b || !b.length) return;
    const idx = currentSegmentIndex();
    // >1s into a segment restarts it; otherwise step to the previous one.
    const target = (currentPracticeTime > b[idx].start + 1 || idx === 0) ? idx : idx - 1;
    seekTo(b[Math.max(0, target)].start);
  }

  function nextSegment() {
    const b = sessionBounds(); if (!b || !b.length) return;
    const idx = currentSegmentIndex();
    if (idx + 1 < b.length) seekTo(b[idx + 1].start);
  }

  function loopCurrentSegment() {
    const b = sessionBounds(); if (!b || !b.length) return;
    const idx = currentSegmentIndex(); if (idx < 0) return;
    tpA = b[idx].start; tpB = b[idx].end; commitLoop();
  }

  // Nudge to the adjacent bar line. Uses the chart's own measure downbeats
  // (beats with measure >= 0), so it stays tempo-accurate even across session
  // segments with different tempos. dir < 0 = back, dir > 0 = forward.
  function nudgeBar(dir) {
    if (!activeBundle) return;
    const downbeats = (activeBundle.beats || []).filter(b => (b.measure || -1) >= 0).map(b => b.time).sort((a, c) => a - c);
    const t = currentPracticeTime, dur = activeBundle.songInfo?.duration || 0;
    if (!downbeats.length) { seekTo(t + dir * 2); return; } // fallback if no beat grid
    if (dir > 0) {
      const next = downbeats.find(d => d > t + 0.05);
      seekTo(next != null ? next : dur);
    } else {
      const prev = [...downbeats].reverse().find(d => d < t - 0.05);
      seekTo(prev != null ? prev : 0);
    }
  }

  // Nudge the loop's end (B) edge to the adjacent bar line (Shift+←/→). Adjusts
  // cycle length from the end; refuses to collapse the loop past its start.
  function nudgeLoopEdge(dir) {
    if (tpA == null || tpB == null || Math.abs(tpA - tpB) < 0.02) return false;
    const dn = chartDownbeats(); if (!dn.length) return false;
    const dur = activeBundle?.songInfo?.duration || 0;
    const lo = Math.min(tpA, tpB), hi = Math.max(tpA, tpB);
    let next = dir > 0 ? dn.find(x => x > hi + 0.05) : [...dn].reverse().find(x => x < hi - 0.05);
    if (next == null) next = dir > 0 ? dur : hi;
    if (next <= lo + 0.02) return true;  // refuse to collapse past the start
    tpA = lo; tpB = next; commitLoop(); paintLoopRegion();
    return true;
  }

  // Keyboard transport, scoped to the SlopScale screen. Ignores keystrokes when
  // a form field is focused or a modifier is held, and never touches Escape
  // (Slopsmith owns Escape for return-to-menu). Comma/period are session-only.
  function onTransportKey(e) {
    const root = $('slopscale-root');
    if (!root || !root.offsetParent) return; // screen not the active/visible one
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
    const sessionMode = root.classList.contains('slopscale-session-mode');
    switch (e.key) {
      case ' ':          e.preventDefault(); onPlayToggle(); break;
      case 'ArrowLeft':  e.preventDefault(); if (e.shiftKey && nudgeLoopEdge(-1)) break; nudgeBar(-1); break;
      case 'ArrowRight': e.preventDefault(); if (e.shiftKey && nudgeLoopEdge(1)) break; nudgeBar(1); break;
      // Loop in/out moved to i/o (editor in/out convention) so [ is free for the
      // shell Inspector-collapse hotkey (menu/shell decision); \ still clears the loop.
      case 'i': case 'I': e.preventDefault(); tpA = currentPracticeTime; commitLoop(); break;
      case 'o': case 'O': e.preventDefault(); tpB = currentPracticeTime; commitLoop(); break;
      case '\\':         e.preventDefault(); resetTransportLoop(); break;
      // Shell hotkeys: M mixer · P progress · [ collapse Inspector · ? cheat-sheet.
      case 'm': case 'M': e.preventDefault(); toggleMixer(); break;
      case 'p': case 'P': e.preventDefault(); toggleProgressSheet(); break;
      case '[':          e.preventDefault(); setPanelCollapsed(!panelCollapsed); break;
      case '?':          e.preventDefault(); toggleCheatSheet(); break;
      case 'Home':       e.preventDefault(); seekTo(0); break;
      case ',':          if (sessionMode) { e.preventDefault(); prevSegment(); } break;
      case '.':          if (sessionMode) { e.preventDefault(); nextSegment(); } break;
      default: return;
    }
  }

  // Compact, glanceable LCD readout for #slopscale-summary. Shows only the
  // GENERATED facts the left-panel controls don't already state — the readout
  // used to restate every menu selection (debug-log style); now it confirms
  // what actually got built. Returns HTML (labeled cells); set via .innerHTML.
  // Errors/fallback messages do NOT go here — they're routed to #slopscale-status.
  function summarize(exercise) {
    const cfg = exercise.session, c = exercise.chart;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cell = (label, value) => `<div class="slopscale-lcd-cell"><span class="slopscale-lcd-lbl">${esc(label)}</span><span class="slopscale-lcd-val">${esc(value)}</span></div>`;
    const len = fmtTime(c.duration);
    // Sessions mix tempo/key/meter across segments, so show session-level facts
    // (name · segments · length · notes) rather than a single key/tempo/meter.
    if (cfg.mode === 'session') {
      const segCount = (c.segmentBounds || []).length;
      return [
        cell('Session', cfg.sessionName || 'Custom'),
        ...(segCount ? [cell('Segments', segCount)] : []),
        cell('Length', len),
        cell('Notes', c.notes.length)
      ].join('');
    }
    const bars = measureSeconds(cfg) > 0 ? Math.round(c.duration / measureSeconds(cfg)) : 0;
    // Key cell doubles as the identity: chromatic has no key/scale, so name the pattern.
    const keyCell = cfg.mode === 'chromatic'
      ? cell('Pattern', CHROMATIC_PATTERN_LABELS[cfg.chromaticPattern] || cfg.chromaticPattern)
      : cell('Key', `${cfg.key} ${String(cfg.scale || '').replace(/_/g, ' ')}`);
    return [
      keyCell,
      cell('Tempo', `${cfg.bpm} BPM`),
      cell('Meter', `${cfg.meter.numerator}/${cfg.meter.denominator}`),
      cell('Bars', bars),
      cell('Length', len),
      cell('Notes', c.notes.length)
    ].join('');
  }
  function showStatus(text) { const el = $('slopscale-status'); if (el) el.textContent = text; }
  function describeCurrentContent() {
    try {
      const cfg = readConfig();
      if (cfg.mode === 'chromatic') {
        return `Chromatic ${CHROMATIC_PATTERN_LABELS[cfg.chromaticPattern] || cfg.chromaticPattern}, frets ${cfg.fretMin}–${cfg.fretMax}`;
      }
      const scaleLabel = String(cfg.scale || '').replace(/_/g, ' ');
      return `${cfg.key} ${scaleLabel}, frets ${cfg.fretMin}–${cfg.fretMax}`;
    } catch { return ''; }
  }
  function refreshStatusFromState() {
    if (!activeBundle) { showStatus('Ready'); return; }
    const desc = describeCurrentContent();
    showStatus(playing ? `Playing — ${desc}` : `Ready — ${desc}`);
  }

  async function onGenerate() {
    const summary = $('slopscale-summary');
    try {
      const exercise = generateExercise(withRunTarget(readConfig()));
      lastExercise = exercise;
      summary.innerHTML = summarize(exercise);
      await attachRenderer(exercise);
      prewarmVoices(activeBundle);  // start the sampled-voice load now so Play starts on WAF, not the oscillator
      refreshStatusFromState();
    } catch (e) {
      showStatus(`Error: ${e.message || e}`);
      console.error('[SlopScale] generate failed', e);
    }
  }
  async function savePreset() {
    const cfg = readConfig(), name = `${cfg.key} ${cfg.scale} ${cfg.setupLabel} ${cfg.mode}`, id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const res = await fetch('/api/plugins/slopscale/presets', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ id, name, kind:cfg.mode, config:cfg }) });
    if (!res.ok) throw new Error(await res.text());
    showStatus(`Saved preset: ${name}`);
  }
  function syncStringSetupControls() { const instrument = document.querySelector('[name="instrument"]'), setup = document.querySelector('[name="stringSetup"]'); if (!instrument || !setup) return; const current = STRING_SETUPS[setup.value] || STRING_SETUPS.guitar_6_standard; instrument.value = current.instrument; }
  // CAGED/3NPS shape concepts are guitar-only — hide them when bass is active.
  // Remembers the shape-aware system (caged/3nps) we force-switched away from
  // when the user picked a bass setup, so returning to guitar restores it
  // instead of stranding the player in 'position'.
  let stashedGuitarSystem = null;
  function syncInstrumentClass() {
    const root = $('slopscale-root');
    const setup = document.querySelector('[name="stringSetup"]');
    if (!root || !setup) return;
    const isBass = (STRING_SETUPS[setup.value] || {}).instrument === 'bass';
    root.classList.toggle('slopscale-bass-instrument', isBass);
    // Piano is keyed off the instrument select directly (it has no string setup).
    // Drives the CSS that reveals the Piano Roll view and hides the guitar/bass
    // views. Piano can't be selected yet (chip disabled), so this is groundwork.
    const instrSel = document.querySelector('[name="instrument"]');
    root.classList.toggle('slopscale-piano-instrument', (instrSel?.value) === 'piano');
    // Offer only the practice types applicable to this instrument (the ternary
    // offerable() tag — the single source of truth, replacing the old bending-only
    // hide). Hide/disable any n-a option; if the current selection becomes n-a,
    // fall back to a safe default. This is what hides the guitar-only techniques
    // (bending/tremolo/hybrid/strum) on bass AND the 5 bass groove primitives on guitar.
    const ptSel = document.querySelector('[name="practiceType"]');
    if (ptSel) {
      const instrument = isBass ? 'bass' : ((instrSel?.value) === 'piano' ? 'piano' : 'guitar');
      let mustSwitch = false;
      ptSel.querySelectorAll('option').forEach(opt => {
        const ok = offerable(opt.value, instrument);
        opt.hidden = !ok; opt.disabled = !ok;
        if (!ok && ptSel.value === opt.value) mustSwitch = true;
      });
      if (mustSwitch) { ptSel.value = 'scale'; ptSel.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    // Re-render the skill tree so the Bending node hides/shows with the instrument.
    renderSkillTree();
    if (isBass) {
      const fs = document.querySelector('[name="fretboardSystem"]');
      // CAGED/3NPS are guitar artifacts — force bass to the movable 'position'
      // box, but remember what we switched away from so guitar can restore it.
      if (fs && (fs.value === 'caged' || fs.value === '3nps')) {
        stashedGuitarSystem = fs.value;
        fs.value = 'position';
      }
      // (Bass keeps the selected view — the 3D Highway renders bass natively, so
      // we no longer force it to 2D here.)
    } else if (stashedGuitarSystem) {
      // Returning to guitar: restore the shape-aware system bass forced off, so
      // the player isn't silently stranded in 'position'. Only restore if the
      // forced 'position' value is still in place (user didn't pick it themself),
      // and fire change so the shape controls re-resolve.
      const fs = document.querySelector('[name="fretboardSystem"]');
      if (fs && fs.value === 'position') {
        fs.value = stashedGuitarSystem;
        fs.dispatchEvent(new Event('change', { bubbles: true }));
      }
      stashedGuitarSystem = null;
    }
    // Re-sync the Position/variation stepper: on bass it falls back to vary[]
    // stepping (CAGED shapes aren't shown), so its label + control must update
    // when the instrument changes. updatePositionStepper() picks the right
    // mode + axis label.
    updatePositionStepper();
    // Mirror the underlying instrument value into the top-level family
    // selector so all three controls (family chip, instrument select,
    // string-setup select) stay in sync regardless of which one drove the
    // change.
    syncInstrumentFamilyButtons();
  }

  // Top-level instrument selector (Bass / Guitar / Piano) — paints the active
  // chip from the current underlying instrument. Piano is scaffolded UI; the
  // generators don't emit keyboard data yet, so its button is disabled in
  // HTML and we never paint it active.
  function syncInstrumentFamilyButtons() {
    const instr = document.querySelector('[name="instrument"]');
    const fam = instr ? instr.value : 'guitar';
    document.querySelectorAll('.slopscale-instr-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.instrument === fam);
    });
  }
  // Click handler for the family chips. Drives the existing [name="instrument"]
  // select and fires its 'change' event so every downstream sync (string
  // setup, instrument class, shape dropdown, renderer fallback for bass)
  // runs through the same code path as the in-form change.
  function onInstrumentFamilyClick(family) {
    if (family === 'piano') return;  // disabled — coming in a future release
    const instr = document.querySelector('[name="instrument"]');
    if (!instr || instr.value === family) { syncInstrumentFamilyButtons(); return; }
    // Drop any per-string custom tuning before flipping families — a guitar
    // custom tuning has the wrong string count and the wrong note ranges
    // for bass (and vice versa), so carrying it across is always wrong.
    const hidden = $('slopscale-custom-open-midis');
    if (hidden) hidden.value = '';
    instr.value = family;
    instr.dispatchEvent(new Event('change', { bubbles: true }));
    try { localStorage.setItem('slopscale.instrumentFamily', family); } catch (_) {}
    syncInstrumentFamilyButtons();
    syncStringCountChips();
    syncTuningOptions();
  }

  // ── Strings + tuning ───────────────────────────────────────────────────
  // Parse "E2", "F#3", "Bb4" into a MIDI number (C-1 = 0, C4 = 60). Returns
  // null on malformed input. Octave is required so the user gets a single
  // explicit semantics instead of guessing.
  function parseNoteName(s) {
    if (typeof s !== 'string') return null;
    const m = /^\s*([A-Ga-g])([#♯b♭]?)(-?\d+)\s*$/.exec(s);
    if (!m) return null;
    const letter = m[1].toUpperCase();
    const acc = m[2].replace('♯','#').replace('♭','b');
    const oct = parseInt(m[3], 10);
    const baseMap = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
    let pc = baseMap[letter];
    if (acc === '#') pc += 1; else if (acc === 'b') pc -= 1;
    const midi = (oct + 1) * 12 + pc;
    if (midi < 0 || midi > 127) return null;
    return midi;
  }
  function midiToNoteName(midi) {
    if (!Number.isFinite(midi)) return '';
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const oct = Math.floor(midi / 12) - 1;
    return names[((midi % 12) + 12) % 12] + oct;
  }
  // Currently-effective tuning, in MIDI. Read by openMidisForConfig when
  // present. Set whenever the user picks a tuning preset or edits a custom
  // string; cleared when the user picks a built-in stringSetup tuning.
  function currentFamily() {
    const el = document.querySelector('[name="instrument"]');
    return (el && el.value === 'bass') ? 'bass' : 'guitar';
  }
  function currentStringCount() {
    const setup = document.querySelector('[name="stringSetup"]');
    const cur = STRING_SETUPS[setup?.value] || STRING_SETUPS.guitar_6_standard;
    return cur.openMidis.length;
  }
  function syncStringCountChips() {
    const row = $('slopscale-string-count-row'); if (!row) return;
    const family = currentFamily();
    const counts = family === 'bass' ? [4,5,6] : [6,7,8];
    const cur = currentStringCount();
    row.innerHTML = '';
    for (const n of counts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slopscale-string-count-btn' + (n === cur ? ' active' : '');
      b.dataset.count = String(n);
      b.textContent = String(n);
      b.addEventListener('click', () => onStringCountClick(n));
      row.appendChild(b);
    }
  }
  function onStringCountClick(count) {
    // Snap stringSetup to the canonical standard preset for this family +
    // count. If a custom tuning was active, it's dropped — the user explicitly
    // chose a different number of strings, so the per-string state is stale.
    const family = currentFamily();
    const target = `${family}_${count}_standard`;
    const setupName = TUNING_TO_SETUP[target] || (family === 'guitar' ? 'guitar_6_standard' : 'bass_4_standard');
    const setup = document.querySelector('[name="stringSetup"]');
    if (!setup) return;
    setup.value = setupName;
    // Clear any custom tuning.
    const hidden = $('slopscale-custom-open-midis');
    if (hidden) hidden.value = '';
    setup.dispatchEvent(new Event('change', { bubbles: true }));
    syncStringCountChips();
    syncTuningOptions();
  }
  // Saved-tunings cache, populated by loadSavedTunings() once per plugin
  // session. Filtered per (family, string_count) by syncTuningOptions.
  let savedTunings = [];
  async function loadSavedTunings() {
    try {
      const r = await fetch('/api/plugins/slopscale/tunings');
      if (!r.ok) return;
      const body = await r.json();
      savedTunings = Array.isArray(body.tunings) ? body.tunings : [];
    } catch (_) {
      savedTunings = [];
    }
    syncTuningOptions();
  }
  function syncTuningOptions() {
    const sel = $('slopscale-tuning-select'); if (!sel) return;
    const family = currentFamily();
    const count = currentStringCount();
    const presets = TUNING_PRESETS[`${family}_${count}`] || [];
    const setup = document.querySelector('[name="stringSetup"]');
    const setupName = setup?.value || `${family}_${count}_standard`;
    const hidden = $('slopscale-custom-open-midis');
    const customStr = hidden?.value || '';
    const customMidis = customStr ? customStr.split(',').map(Number).filter(Number.isFinite) : null;
    sel.innerHTML = '';
    // The "currently effective" tuning is the custom-override when present,
    // otherwise the stringSetup's standard midis. Walk presets and pick the
    // first one that matches — so e.g. switching to DADGAD via the dropdown
    // (which is stored as customOpenMidis) keeps the dropdown showing
    // "DADGAD" instead of "Custom".
    const effective = (customMidis && customMidis.length === count)
      ? customMidis
      : ((STRING_SETUPS[setupName] || {}).openMidis || []);
    let activeId = null;
    // Built-in presets (Standard, Drop D, DADGAD, …).
    const presetGroup = document.createElement('optgroup');
    presetGroup.label = 'Built-in';
    for (const p of presets) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      opt.dataset.midis = p.midis.join(',');
      presetGroup.appendChild(opt);
      if (!activeId && effective.length === p.midis.length && effective.every((m, i) => m === p.midis[i])) {
        activeId = p.id;
      }
    }
    sel.appendChild(presetGroup);
    // Saved tunings filtered to the current family + string count.
    const mine = savedTunings.filter(t => t.family === family && t.string_count === count);
    if (mine.length) {
      const savedGroup = document.createElement('optgroup');
      savedGroup.label = 'Saved';
      for (const t of mine) {
        const opt = document.createElement('option');
        opt.value = `saved:${t.id}`;
        opt.textContent = t.name;
        opt.dataset.midis = (t.midis || []).join(',');
        savedGroup.appendChild(opt);
        if (!activeId && effective.length === (t.midis || []).length && (t.midis || []).every((m, i) => m === effective[i])) {
          activeId = `saved:${t.id}`;
        }
      }
      sel.appendChild(savedGroup);
    }
    // Always offer a Custom option. Picked when no preset matched and the
    // user does have a non-empty custom override.
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Custom…';
    sel.appendChild(customOpt);
    if (!activeId && customMidis && customMidis.length === count) activeId = 'custom';
    sel.value = activeId || (presets[0] && presets[0].id) || 'custom';
    syncCustomTuningInputs();
    updateSetupButton();   // header Setup button shows the live instrument + tuning
  }
  // Persist the active custom tuning to the DB under a user-supplied name.
  // After save, refetch the saved-tunings list so the dropdown reflects the
  // new entry immediately.
  async function onSaveTuningClick() {
    const hidden = $('slopscale-custom-open-midis');
    const midisStr = hidden?.value || '';
    const midis = midisStr.split(',').map(Number).filter(Number.isFinite);
    if (!midis.length) return;
    const family = currentFamily();
    const count = currentStringCount();
    if (midis.length !== count) return;
    const defaultName = midis.map(midiToNoteName).join(' ');
    const name = window.prompt('Save tuning as:', defaultName);
    if (!name) return;
    try {
      const r = await fetch('/api/plugins/slopscale/tunings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), family, string_count: count, midis }),
      });
      if (!r.ok) {
        const txt = await r.text();
        console.warn('[SlopScale] save tuning failed', r.status, txt);
        return;
      }
      await loadSavedTunings();
    } catch (e) {
      console.warn('[SlopScale] save tuning error', e);
    }
  }
  function syncCustomTuningInputs() {
    const sel = $('slopscale-tuning-select');
    const wrap = $('slopscale-custom-tuning');
    const inputs = $('slopscale-custom-tuning-inputs');
    const hidden = $('slopscale-custom-open-midis');
    if (!sel || !wrap || !inputs || !hidden) return;
    const isCustom = sel.value === 'custom';
    wrap.style.display = isCustom ? 'flex' : 'none';
    if (!isCustom) return;
    const count = currentStringCount();
    // Seed from existing hidden value, or the current stringSetup's midis.
    let midis = hidden.value ? hidden.value.split(',').map(Number).filter(Number.isFinite) : null;
    if (!midis || midis.length !== count) {
      const setup = document.querySelector('[name="stringSetup"]');
      midis = (STRING_SETUPS[setup?.value] || STRING_SETUPS.guitar_6_standard).openMidis.slice();
      if (midis.length !== count) {
        // Pad / trim to match the chosen count.
        while (midis.length < count) midis.unshift(midis[0] - 5);
        midis = midis.slice(0, count);
      }
    }
    inputs.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'slopscale-custom-tuning-input';
      input.value = midiToNoteName(midis[i]);
      input.dataset.idx = String(i);
      input.spellcheck = false;
      input.addEventListener('input', () => onCustomTuningEdit());
      input.addEventListener('blur', () => onCustomTuningEdit(true));
      inputs.appendChild(input);
    }
    // Commit the seeded values to the hidden field so an immediate read
    // sees them even before the user types.
    commitCustomTuning(midis);
  }
  function readCustomTuningInputs() {
    const inputs = Array.from(document.querySelectorAll('.slopscale-custom-tuning-input'));
    const midis = [];
    let allValid = true;
    for (const el of inputs) {
      const m = parseNoteName(el.value);
      if (m == null) { el.classList.add('invalid'); allValid = false; midis.push(null); }
      else { el.classList.remove('invalid'); midis.push(m); }
    }
    return { midis, allValid };
  }
  function commitCustomTuning(midis) {
    const hidden = $('slopscale-custom-open-midis');
    if (hidden) hidden.value = midis.join(',');
  }
  function onCustomTuningEdit(commit) {
    const { midis, allValid } = readCustomTuningInputs();
    if (!allValid) return;
    commitCustomTuning(midis);
    if (commit && activeBundle) onGenerate();
  }
  function onTuningPresetChange() {
    const sel = $('slopscale-tuning-select'); if (!sel) return;
    const hidden = $('slopscale-custom-open-midis');
    // Saved tunings come back as `saved:<id>`; the midis live on the option's
    // dataset.midis (set by syncTuningOptions). Apply them as a custom
    // override against the family's standard stringSetup.
    if (sel.value && sel.value.startsWith('saved:')) {
      const opt = sel.options[sel.selectedIndex];
      const midis = (opt?.dataset.midis || '').split(',').map(Number).filter(Number.isFinite);
      if (midis.length) {
        const family = currentFamily();
        const count = currentStringCount();
        const setup = document.querySelector('[name="stringSetup"]');
        if (setup) {
          setup.value = `${family}_${count}_standard`;
          commitCustomTuning(midis);
          setup.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncCustomTuningInputs();
      }
      return;
    }
    if (sel.value === 'custom') {
      // Initialize hidden field from the current stringSetup if not already.
      if (!hidden.value) {
        const setup = document.querySelector('[name="stringSetup"]');
        const midis = (STRING_SETUPS[setup?.value] || STRING_SETUPS.guitar_6_standard).openMidis.slice();
        commitCustomTuning(midis);
      }
      syncCustomTuningInputs();
      if (activeBundle) onGenerate();
      return;
    }
    // A built-in preset. Drop any custom tuning and (when the preset matches
    // a STRING_SETUPS entry) snap stringSetup to it. Otherwise apply the
    // preset's midis as customOpenMidis so generators see the right tuning.
    hidden.value = '';
    const family = currentFamily();
    const count = currentStringCount();
    const preset = (TUNING_PRESETS[`${family}_${count}`] || []).find(p => p.id === sel.value);
    if (!preset) return;
    const setup = document.querySelector('[name="stringSetup"]');
    const setupKey = `${family}_${count}_${preset.id}`;
    const setupName = TUNING_TO_SETUP[setupKey];
    if (setupName && STRING_SETUPS[setupName]) {
      setup.value = setupName;
      setup.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Non-canonical preset (e.g. DADGAD, Open G) — drive it as a custom
      // tuning override against the family's standard stringSetup.
      setup.value = `${family}_${count}_standard`;
      commitCustomTuning(preset.midis);
      setup.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncCustomTuningInputs();
  }
  function syncAdvancedMode() {
    const root = $('slopscale-root'), toggle = $('slopscale-advanced-toggle');
    const enabled = !!toggle?.checked;
    root?.classList.toggle('slopscale-advanced', enabled);
    document.querySelectorAll('.slopscale-advanced-only input, .slopscale-advanced-only select, .slopscale-advanced-only textarea, .slopscale-advanced-only button').forEach(el => { el.disabled = !enabled; });
  }
  function setFieldSilent(name, value) {
    const field = document.querySelector('#slopscale-controls [name="' + name + '"]');
    if (!field) return;
    if (field.type === 'checkbox') field.checked = !!value;
    else field.value = String(value);
  }
  function syncCagedButtonStrip() {
    // The button-strip UI was removed in favor of the unified Shape dropdown.
    // Kept as a no-op so existing callers don't need to be touched.
  }

  // Mirror the Shape dropdown's selected value into the legacy hidden
  // cagedShape input. Only meaningful when the active system is CAGED — for
  // other systems the chord-template helpers aren't called.
  function syncShapeDropdownSelectionToHidden() {
    const sysEl = $('slopscale-fretboard-system');
    const shapeEl = $('slopscale-shape');
    const hidden = $('slopscale-caged-shape-value');
    if (!shapeEl || !hidden) return;
    if (sysEl && sysEl.value === 'caged' && shapeEl.value) hidden.value = shapeEl.value;
  }
  function applyPathwayConfig(config) {
    if (!config) return;
    if (Object.prototype.hasOwnProperty.call(config, 'advancedMode')) setFieldSilent('advancedMode', config.advancedMode);
    syncAdvancedMode();
    // Specialized backing/feel fields default OFF unless the pathway opts in, so a
    // boogie/shuffle pathway's settings never leak into the next pathway selected
    // (applyPathwayConfig doesn't reset the form; it only writes keys it's given).
    setFieldSilent('backingStyle', config.backingStyle || 'pad');
    setFieldSilent('swing', config.swing || 'straight');
    // Backing tone is automated: default the profile (anti-leak) + reflect the
    // genre's default brightness onto the slider (the loop below sets the
    // audioProfile field itself from config).
    setFieldSilent('audioProfile', config.audioProfile || '');
    { const _ap = config.audioProfile && AUDIO_PROFILES[config.audioProfile]; setFieldSilent('brightness', String(_ap && _ap.brightness != null ? _ap.brightness : 0.5)); }
    // Preload this profile's sampled voices now (served locally → fast + offline),
    // so they're ready the instant the player hits play (no first-pass fallback):
    // the harmony comp, the backing bass, and the practice voice.
    {
      const _p = resolveAudioProfile({ ...config, audio: { profile: config.audioProfile || '' } });
      if (_p.harmony.engine === 'sample') ensureWafPreset(TONE_GM[_p.harmony.tone]);
      if (_p.bass.engine    === 'sample') ensureWafPreset(TONE_GM[_p.bass.tone]);
      if (_p.notes.engine   === 'sample') ensureWafPreset(TONE_GM[_p.notes.tone]);
    }
    Object.keys(config).forEach(k => { if (k !== 'advancedMode') setFieldSilent(k, config[k]); });
    syncStringSetupControls();
    syncShapeDropdown();
    syncShapeDropdownSelectionToHidden();
    syncChromaticVisibility();
  }

  // Given a fret-range hint (from a legacy pathway definition), pick the
  // shape whose fret window is closest to that range. Used so old pathway
  // data with fretMin/fretMax still picks a sensible shape on the new model.
  function shapeFromFretHint(system, fretMinHint, keyPc, scale, openMidis) {
    const order = shapeOrderForKey(keyPc, system, scale, openMidis);
    if (!order.length) return null;
    let best = order[0], bestDist = Infinity;
    for (const shape of order) {
      const resolved = fretWindowForShape(keyPc, system, shape, scale, openMidis);
      if (!resolved) continue;
      const d = Math.abs(resolved.fretMin - (fretMinHint || 0));
      if (d < bestDist) { best = shape; bestDist = d; }
    }
    return best;
  }

  function setPathwayModeClass(isPathway) {
    const root = $('slopscale-root');
    if (!root) return;
    root.classList.toggle('slopscale-pathway-mode', !!isPathway);
    syncModeBar();
  }

  // Four-mode shell metadata: data-mode token → { label, the forward-compat ss-mode-*
  // class suffix, and the "what is this mode" JTBD line under the switcher }.
  const MODE_META = {
    guided:  { label:'Pathways', ss:'pathways', desc:'Follow a guided curriculum — we suggest what to work on next.' },
    custom:  { label:'Custom',   ss:'custom',   desc:'Drill the exact thing you’re stuck on — every control is yours.' },
    session: { label:'Workout',  ss:'workout',  desc:'Build a timed practice routine — and actually run it.' },
    jam:     { label:'Jam',      ss:'jam',      desc:'Pick a style and play along on your instrument.' },
  };
  // The mode bar (Pathways / Custom / Workout / Jam) is a VIEW of the root classes:
  // jam-mode wins; else session-mode ⇒ Workout; else pathway-mode ⇒ Pathways; else
  // Custom. Also sets the single forward-compat ss-mode-* class + the mode-desc line.
  function syncModeBar() {
    const root = $('slopscale-root'); if (!root) return;
    const mode = root.classList.contains('slopscale-jam-mode') ? 'jam'
      : root.classList.contains('slopscale-session-mode') ? 'session'
      : root.classList.contains('slopscale-pathway-mode') ? 'guided' : 'custom';
    document.querySelectorAll('.slopscale-mode-bar .slopscale-mode-btn').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const ms = $('slopscale-mode-select'); if (ms && ms.value !== mode) ms.value = mode;   // narrow-width fallback
    // Forward-compat single mode class (the locked ss-mode-* mechanic) for future CSS.
    ['pathways','custom','workout','jam'].forEach(s => root.classList.toggle('ss-mode-' + s, MODE_META[mode] && MODE_META[mode].ss === s));
    const desc = $('slopscale-mode-desc');
    if (desc && MODE_META[mode]) desc.textContent = MODE_META[mode].desc;
  }

  // Jam-mode style grid (skeleton) — chips from the shared STYLE_PALETTES; selecting
  // one marks it active for now. Backing playback + live target-highlight land in the
  // post-checkpoint pass (Jam is a mirror, never a song generator — north star).
  function renderJamStyles() {
    const host = $('slopscale-jam-styles');
    if (!host) return;
    host.innerHTML = '';
    Object.keys(STYLE_PALETTES).forEach((id, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slopscale-jam-style' + (i === 0 ? ' active' : '');
      btn.dataset.style = id;
      btn.textContent = STYLE_PALETTES[id].label;
      btn.addEventListener('click', () => {
        host.querySelectorAll('.slopscale-jam-style').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      host.appendChild(btn);
    });
  }

  // Jam: loop a backing in the selected style through the contained player to play
  // along to. Builds a config from the shared STYLE_PALETTES (the same harmony source
  // a Pathway/Custom draws from) + the Jam key/tempo/feel; the lead scale is the
  // reference line and the progression comp is the backing band. Loops [leadIn,
  // duration] so it keeps going. A MIRROR — no score, no rank (north star).
  async function jamPlay() {
    const styleBtn = document.querySelector('#slopscale-jam-styles .slopscale-jam-style.active');
    const styleId = (styleBtn && styleBtn.dataset.style) || Object.keys(STYLE_PALETTES)[0];
    const jamKey = ($('slopscale-jam-key') || {}).value || 'A';
    const jamTempo = Math.max(40, Math.min(220, parseInt(($('slopscale-jam-tempo') || {}).value || '90', 10) || 90));
    const palette = stylePaletteConfig(styleId, { key: jamKey });
    if (!palette) return;
    const base = readConfig();   // instrument / tuning / renderer / audio defaults
    const cfg = Object.assign({}, base, {
      mode: undefined, shapeNotes: undefined,
      practiceType: 'scale',
      scale: palette.scale, key: palette.key,
      progression: palette.progression,
      chordDepth: palette.chordDepth, chordOverride: palette.chordOverride,
      swing: jamFeel, backingStyle: palette.backingStyle,
      fretboardSystem: 'position', fretMin: 2, fretMax: 9,   // a movable box — no shape to re-resolve
      bpm: jamTempo, bars: 8, harmonize: false, keyCycle: 'none', sequence: 'none', direction: 'up_down',
      audio: Object.assign({}, base.audio, { notes: true, harmony: true, metronome: false, profile: palette.audioProfile || '' }),
    });
    try {
      if (playing) stopPlayback();
      const exercise = generateExercise(cfg);
      lastExercise = exercise;
      await attachRenderer(exercise);
      const dur = (activeBundle && activeBundle.songInfo && activeBundle.songInfo.duration) || 0;
      const lead = (activeBundle && activeBundle.leadIn) || 0;
      if (dur > lead + 0.1) { try { setSegmentLoop(lead, dur); } catch (_) {} }
      startPlayback();
      refreshStatusFromState();
    } catch (e) {
      showStatus(`Jam error: ${e.message || e}`);
      console.error('[SlopScale] jam failed', e);
    }
  }

  // Switch top-level practice mode. Guided/Custom drive the hidden pathway
  // select (its change handler applies the pathway / custom + regenerates);
  // Session swaps to the session panel.
  function selectMode(mode) {
    // Switching practice mode (Guided / Custom / Session) is a transport break:
    // the current exercise no longer matches the view the user is moving to, so
    // stop playback rather than letting audio/playhead bleed into the new mode.
    // Matches onViewSwitch and the session-launch path. No-op before first play.
    if (playing) stopPlayback();
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch (_) {}   // resume-last-mode
    toggleLibrary(false); toggleStarters(false);   // the browse drawers are Workout-only — never linger over another mode
    const root = $('slopscale-root');
    if (root) root.classList.remove('slopscale-jam-mode');   // default: not jam (jam re-adds below)
    if (mode === 'jam') {
      // Jam = the 4th mode: not session, not pathway. Skeleton — style grid + a
      // placeholder Inspector; playback/target-highlight wiring is post-checkpoint.
      syncSessionMode('single');
      setPathwayModeClass(false);          // clears pathway-mode (calls syncModeBar)
      if (root) root.classList.add('slopscale-jam-mode');
      syncModeBar();                       // re-derive now that jam-mode is set
      return;
    }
    if (mode === 'session') {
      syncSessionMode('session');
      syncSessionSummary(_selectedStarterId);
      syncModeBar();
      return;
    }
    syncSessionMode('single');
    const sel = $('slopscale-pathway');
    if (!sel) { setPathwayModeClass(mode === 'guided'); return; }
    if (mode === 'custom') {
      sel.value = 'custom';
    } else {
      let stored = null; try { stored = localStorage.getItem(PATHWAY_STORAGE_KEY); } catch (_) {}
      const valid = stored && stored !== 'custom' && Array.from(sel.options).some(o => o.value === stored);
      sel.value = valid ? stored : (activePathwayId && activePathwayId !== 'custom' ? activePathwayId : 'pent_foundation');
    }
    sel.dispatchEvent(new Event('change'));
  }

  function updatePathwayGoalCard(pathwayId, modified, favoritePreset) {
    const card = $('slopscale-pathway-goal-card');
    const tag = $('slopscale-pathway-tag');
    const title = $('slopscale-pathway-title');
    const goal = $('slopscale-pathway-goal');
    if (!card) return;
    if (favoritePreset) {
      if (title) title.textContent = favoritePreset.name || favoritePreset.id || 'Favorite';
      if (goal) goal.textContent = 'Saved preset.';
      if (tag) tag.textContent = 'Favorite';
      card.classList.remove('modified');
      return;
    }
    const pw = pathwayId ? PATHWAYS[pathwayId] : null;
    if (pw) {
      if (title) title.textContent = pw.label || pathwayId;
      if (goal) goal.textContent = pw.goal || '';
      if (tag) tag.textContent = modified ? 'Modified' : 'Goal';
      card.classList.toggle('modified', !!modified);
    }
    updateStartCta();   // keep the primed START CTA's name/skill in sync
  }

  // Translate the named Position dropdown into raw fretMin/fretMax inputs.
  // Only active in pathway mode — Custom mode lets the user set frets directly.
  // Detect divergence from the curated pathway and flag it visually so the
  // user knows they have drifted off the prescribed exercise. Pathway,
  // Shape, Key, and fret range are all expected to vary; BPM and audio
  // toggles are personal preference, not exercise content. That leaves
  // structural changes (scale, progression, etc) as the only true modifiers —
  // and in pathway mode those controls are hidden anyway.
  function markPathwayModifiedIfApplicable(targetName) {
    if (!activePathwayId || activePathwayId === 'custom') return;
    const ignore = new Set(['pathway', 'shape', 'fretboardSystem', 'fretMin', 'fretMax', 'key', 'bpm', 'audioNotes', 'audioMetronome', 'audioHarmony']);
    if (ignore.has(targetName)) return;
    updatePathwayGoalCard(activePathwayId, true);
  }

  function applyPathwayById(id, variationIdx) {
    const isNewPathway = id !== activePathwayId;
    activePathwayId = id;
    if (id === 'custom') {
      setPathwayModeClass(false);
      // Custom mode hides the goal card via CSS, so no card update needed.
      return;
    }
    // Selecting a pathway jumps the picker list to that pathway's band.
    _activeBandId = pathwayBandId(id) || _activeBandId;
    const pw = PATHWAYS[id];
    if (pw && pw.base) {
      const vary = pw.vary && pw.vary.length ? pw.vary : [{}];
      const len = vary.length;
      // Selecting a pathway opens deterministically on its first variation (the
      // named entry / "first step" of the curriculum rung); Next Variation is the
      // explicit "give me another on-theme shape/key" control (decided 2026-05-31).
      const idx = variationIdx != null
        ? ((variationIdx % len) + len) % len
        : 0;
      activePathwayVariationIdx = idx;
      const variation = vary[idx] || {};
      // Reset tier to Slow when switching to a different pathway; preserve it on variation rotation
      if (isNewPathway) activeTempoTierIdx = 0;
      // Apply tier BPM over the pathway base BPM
      const tieredConfig = Object.assign({}, pw.base, variation);
      if (pw.tempoTiers && pw.tempoTiers[activeTempoTierIdx] != null) {
        tieredConfig.bpm = pw.tempoTiers[activeTempoTierIdx];
      }
      applyPathwayConfig(tieredConfig);
      setPathwayModeClass(true);
      updatePathwayGoalCard(id, false);
      // Resolve the pathway's intended shape. New-style pathways can set
      // `fretboardSystem` + `shape` directly; legacy pathways pass `fretMin`
      // (and we pick the closest shape on the current key).
      const shapeEl = $('slopscale-shape');
      if (shapeEl) {
        const system = tieredConfig.fretboardSystem || 'caged';
        const keyEl = $('slopscale-controls')?.querySelector('[name="key"]');
        const keyPc = keyEl ? (NOTE_ALIASES[keyEl.value] ?? 0) : 0;
        const scale = tieredConfig.scale || 'major';
        const openMidis = STRING_SETUPS.guitar_6_standard.openMidis;
        let chosenShape = tieredConfig.shape;
        if (chosenShape == null && isShapeAwareSystem(system)) {
          const fretHint = variation.fretMin != null ? variation.fretMin : pw.base.fretMin;
          chosenShape = shapeFromFretHint(system, fretHint, keyPc, scale, openMidis)
            || defaultShapeForSystem(system, keyPc, scale, openMidis);
        }
        syncShapeDropdown();
        if (chosenShape != null) {
          shapeEl.value = String(chosenShape);
          syncShapeDropdownSelectionToHidden();
        }
      }
      syncTempoTierButtons();
      syncScaleDropdown(id);
      updatePositionStepper();
      renderSkillTree();
      return;
    }
    const preset = window.__slopscaleFavorites && window.__slopscaleFavorites[id];
    if (preset && preset.config) {
      applyPathwayConfig(preset.config);
      setPathwayModeClass(true);
      updatePathwayGoalCard(null, false, preset);
    }
    renderSkillTree();
  }

  // ── The universal Position / variation stepper ─────────────────────────────
  // The ◄ [select/readout] ► row walks the active pathway's variation axis. For a
  // shape-aware guitar pathway the axis is the fretboard Position (CAGED/3NPS) and
  // the #slopscale-shape select drives it. For everything else the axis is the
  // pathway's curated vary[] list, stepped through applyPathwayById(). This
  // replaces the old bottom "Next variation" button (its ► was redundant with
  // this row's ►), so non-shape pathways must be steppable HERE.

  // Is the active row stepping shapes (true) or vary[] entries (false)?
  function positionStepperIsShapeMode() {
    const sysEl = $('slopscale-fretboard-system');
    const shapeEl = $('slopscale-shape');
    const root = $('slopscale-root');
    const isBass = root && root.classList.contains('slopscale-bass-instrument');
    const system = sysEl ? sysEl.value : 'caged';
    // Shapes are a guitar concept and only render when the select has ≥2 options.
    return !isBass && isShapeAwareSystem(system) && shapeEl && shapeEl.options.length > 1;
  }

  // Infer the human axis name for a pathway's vary[] list by which field changes
  // across its entries. Avoids the generic "Variation" wherever a real axis exists.
  function variationAxisLabel(pw) {
    const vary = (pw && pw.vary) || [];
    if (vary.length < 2) return 'Variation';
    const changes = (field) => new Set(vary.map(v => v[field])).size > 1;
    // Order matters: pick the most specific musical axis that actually varies.
    if (changes('voices')) return 'Voicing';
    if (changes('inversion')) return 'Inversion';
    if (changes('progression')) return 'Progression';
    if (changes('scale')) return 'Scale';
    if (changes('sequence') || changes('chromaticPattern')) return 'Pattern';
    if (changes('swing')) return 'Feel';
    if (changes('key')) return 'Key';
    return 'Variation';
  }

  // Short label for the current vary[] entry, e.g. "A" (key), "Dorian" (scale).
  function variationValueLabel(pw, idx, axis) {
    const v = (pw.vary && pw.vary[idx]) || {};
    switch (axis) {
      case 'Voicing':     return v.voices ? v.voices.replace(/_/g, ' ') : `#${idx + 1}`;
      case 'Inversion':   return v.inversion != null ? `Inv ${v.inversion}` : `#${idx + 1}`;
      case 'Progression': return v.progression || `#${idx + 1}`;
      case 'Scale':       return v.scale ? v.scale.replace(/_/g, ' ') : `#${idx + 1}`;
      case 'Pattern':     return v.chromaticPattern || v.sequence || `#${idx + 1}`;
      case 'Feel':        return v.swing || `#${idx + 1}`;
      case 'Key':         return v.key || `#${idx + 1}`;
      default:            return `Variation ${idx + 1}`;
    }
  }

  // Update the stepper row: label by axis, show the right control (select vs
  // readout), and hide the whole row when there is nothing to step.
  function updatePositionStepper() {
    const row = $('slopscale-position-row');
    const label = $('slopscale-position-label');
    const select = $('slopscale-shape');
    const readout = $('slopscale-position-readout');
    if (!row || !label || !select || !readout) return;

    const pw = activePathwayId && activePathwayId !== 'custom' ? PATHWAYS[activePathwayId] : null;
    const shapeMode = positionStepperIsShapeMode();

    if (shapeMode) {
      // Fretboard Position — the shape select is the control.
      row.classList.remove('no-variations');
      label.textContent = 'Position';
      select.hidden = false;
      readout.hidden = true;
      return;
    }

    // vary[] stepping — show the read-only value + counter; hide the empty select.
    select.hidden = true;
    const varyLen = pw && pw.vary ? pw.vary.length : 0;
    if (!pw || varyLen < 2) {
      // Nothing to step (single-variation pathway with no shapes) — hide the row.
      row.classList.add('no-variations');
      readout.hidden = true;
      return;
    }
    row.classList.remove('no-variations');
    const axis = variationAxisLabel(pw);
    label.textContent = axis === 'Variation' ? 'Change' : axis;
    readout.hidden = false;
    const idx = ((activePathwayVariationIdx % varyLen) + varyLen) % varyLen;
    readout.textContent = `${variationValueLabel(pw, idx, axis)} (${idx + 1}/${varyLen})`;
  }

  // Walk the active pathway's variation axis by `dir` (+1 / -1). Shape mode steps
  // the shape select; otherwise rotates the curated vary[] list.
  function positionStep(dir) {
    if (positionStepperIsShapeMode()) {
      const sel = $('slopscale-shape');
      if (!sel || !sel.options.length) return;
      const n = sel.options.length;
      sel.selectedIndex = (sel.selectedIndex + dir + n) % n;
      // The delegated #slopscale-controls change handler mirrors + regenerates.
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      updatePositionStepper();
      return;
    }
    // vary[] rotation for non-shape pathways.
    if (!activePathwayId || activePathwayId === 'custom') return;
    const pw = PATHWAYS[activePathwayId];
    if (!pw || !pw.vary || pw.vary.length < 2) return;
    const n = pw.vary.length;
    const nextIdx = ((activePathwayVariationIdx + dir) % n + n) % n;
    applyPathwayById(activePathwayId, nextIdx);
    onGenerate();
  }
  function loadPathwayFavorites() {
    const select = $('slopscale-pathway'); if (!select) return;
    const favoritesGroup = select.querySelector('optgroup[label="Favorites"]'); if (!favoritesGroup) return;
    const picker = $('slopscale-preset-picker');
    fetch('/api/plugins/slopscale/presets').then(r => r.ok ? r.json() : null).then(data => {
      const presets = (data && Array.isArray(data.presets)) ? data.presets : [];
      if (!presets.length) return;
      window.__slopscaleFavorites = window.__slopscaleFavorites || {};
      presets.forEach(p => {
        if (!p || !p.id) return;
        const key = 'fav__' + p.id;
        window.__slopscaleFavorites[key] = p;
        if (!favoritesGroup.querySelector('option[value="' + key + '"]')) {
          const opt = document.createElement('option'); opt.value = key; opt.textContent = p.name || p.id;
          favoritesGroup.appendChild(opt);
        }
        // Mirror saved presets into the Custom-mode preset picker.
        if (picker && !picker.querySelector('option[value="' + key + '"]')) {
          const o = document.createElement('option'); o.value = key; o.textContent = p.name || p.id;
          picker.appendChild(o);
        }
      });
      if (favoritesGroup.children.length) favoritesGroup.hidden = false;
      const wrap = $('slopscale-preset-picker-wrap');
      if (wrap && picker && picker.options.length > 1) wrap.hidden = false;
    }).catch(() => {});
  }
  function applyInitialPathway() {
    const select = $('slopscale-pathway'); if (!select) return;
    let stored = null; try { stored = localStorage.getItem(PATHWAY_STORAGE_KEY); } catch (_) {}
    // 'custom' means the user opted out of any pathway; treat it as a non-choice
    // on plugin open so beginners always land on a real exercise. The user can
    // re-select Custom mid-session from the dropdown.
    const useStored = stored && stored !== 'custom' && Array.from(select.options).some(o => o.value === stored);
    const initial = useStored ? stored : PATHWAY_FIRST_VISIT_DEFAULT;
    if (!initial) return;
    if (!Array.from(select.options).some(o => o.value === initial)) return;
    select.value = initial;
    applyPathwayById(initial);
    try { localStorage.setItem(PATHWAY_STORAGE_KEY, initial); } catch (_) {}
  }
  // Resume-last-mode: first-ever launch lands on Pathways (the primed START CTA);
  // a returning user who last left in Custom/Workout/Jam resumes there. Called only
  // when there's no share link (a share URL wins). applyInitialPathway has already
  // set up the Pathways defaults, so a non-Pathways resume just switches the view.
  function resumeLastMode() {
    let m = null; try { m = localStorage.getItem(MODE_STORAGE_KEY); } catch (_) {}
    if (m && m !== 'guided' && (m === 'custom' || m === 'session' || m === 'jam')) selectMode(m);
  }

  // The LCD readout no longer surfaces highway-inverted (it's a menu setting,
  // not a generated fact), so a host setting change only needs a redraw.
  function refreshForHostSettingChange() { if (!activeBundle) return; syncHighwaySettings(activeBundle); drawOnce(); }

  function syncTempoTierButtons() {
    const container = $('slopscale-tier-buttons');
    if (!container) return;
    container.innerHTML = '';
    const signpost = $('slopscale-climb-next');
    if (signpost) { signpost.textContent = ''; signpost.classList.remove('summit'); }
    const pw = activePathwayId && activePathwayId !== 'custom' ? PATHWAYS[activePathwayId] : null;
    const tiers = pw && pw.tempoTiers ? pw.tempoTiers : null;
    if (!tiers || !tiers.length) return;
    const ptData = pathwayTiersLoad();
    const highestCleared = (ptData[activePathwayId] || {}).highest_tier ?? -1;
    tiers.forEach((bpm, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      let cls = 'slopscale-tier-btn';
      if (i === activeTempoTierIdx) cls += ' active';
      if (i <= highestCleared) cls += ' cleared';
      if (i === _newlyUnlockedTier) cls += ' tier-glow';
      btn.className = cls;
      // The rung ordinal makes the ladder read as a climb (Rung 1 → 4), not four
      // equal boxes. Label is the speed name; BPM is the readout below it.
      btn.innerHTML = `<span class="tier-step">Rung ${i + 1}</span>` +
        `<span class="tier-name">${TIER_LABELS[i] || `T${i+1}`}</span>` +
        `<span class="tier-bpm">${bpm} BPM</span>`;
      btn.addEventListener('click', () => {
        activeTempoTierIdx = i;
        setFieldSilent('bpm', String(bpm));
        syncTempoTierButtons();
        onGenerate();
      });
      container.appendChild(btn);
    });
    // Calm next-rung / summit signpost: a map cue, never a nag. Points at the
    // lowest un-cleared rung; when every rung is cleared, "Summit reached".
    if (signpost) {
      const nextIdx = highestCleared + 1;
      if (nextIdx >= tiers.length) {
        signpost.classList.add('summit');
        signpost.innerHTML = `<span class="climb-arrow">✓</span>Summit reached — every speed cleared.`;
      } else {
        const name = TIER_LABELS[nextIdx] || `Rung ${nextIdx + 1}`;
        signpost.innerHTML = `<span class="climb-arrow">→</span>Next rung: <span class="climb-target">${name}</span> · ${tiers[nextIdx]} BPM`;
      }
    }
  }

  // Shared node-visibility predicate (lifted out of renderSkillTree so the list and
  // the SVG tree never diverge): bending is a guitar technique — hidden on bass.
  function isHiddenNode(id) {
    const setup = document.querySelector('[name="stringSetup"]');
    const isBass = setup && (STRING_SETUPS[setup.value] || {}).instrument === 'bass';
    return isBass && id === 'bend_drill';
  }
  // A pathway's prerequisite = the first incoming edge in the prereq graph. Used for
  // the soft "Builds on …" hint (gamification: prereqs suggest, never gate).
  function pathwayPrereq(id) {
    const e = SKILL_TREE_EDGES.find(([, b]) => b === id);
    return e ? e[0] : null;
  }
  function pathwayBandId(id) {
    const b = PATHWAY_BANDS.find(band => band.pathways.includes(id));
    return b ? b.id : null;
  }
  // Single source of truth for a node's progress state — used by the picker list now
  // and the P-sheet skill rack later (one data, two surfaces). Reads pathway_tiers.
  function nodeProgressState(id, ptData) {
    const pw = PATHWAYS[id];
    const tierCount = (pw && pw.tempoTiers && pw.tempoTiers.length) || 0;
    const highestTier = (ptData[id] || {}).highest_tier ?? -1;
    const cleared = tierCount > 0 && highestTier >= tierCount - 1;
    const inProgress = highestTier >= 0 && !cleared;
    const prereq = pathwayPrereq(id);
    const prereqUnmet = prereq ? (((ptData[prereq] || {}).highest_tier ?? -1) < 0) : false;
    // Depth-ladder overlay (Phase 8) — the combined Speed+Depth profile from the
    // progress store. Off mode hides it (returns null). Rungs are booleans; Clean /
    // Eyes-off / Master are schema-present but unfilled until their slices land.
    const prog = progressLoad();
    const pnode = prog.mode !== 'off' ? prog.byNode[id] : null;
    const depth = pnode ? {
      travel: !!pnode.depth.travel, clean: !!pnode.depth.clean,
      eyesOff: !!pnode.depth.eyesOff, mastered: !!pnode.masteredAt,
      keysCleared: (pnode.keysCleared || []).length,
    } : null;
    return { tierCount, highestTier, cleared, inProgress, prereq, prereqUnmet, depth };
  }
  // The two-level pathway picker (replaces the SVG tree's display role): L1 band bar
  // + L2 bounded, ordered list for the active band. Full labels, tier-dot progress,
  // "you are here" on the active row, one "→ next" cue, a soft "Builds on …" sub-line.
  function renderPathwayList() {
    const bandBar = $('slopscale-band-bar');
    const list = $('slopscale-pathway-list');
    if (!bandBar || !list) return;
    const ptData = pathwayTiersLoad();
    // Visible bands = Core packs (pinned, fixed order) + installed Style packs in
    // the user's saved order. Uninstalled Style packs live in the Pack-manager's
    // Available column (the "+"), not the picker.
    const bands = visiblePackOrder()
      .map(id => PATHWAY_BANDS.find(b => b.id === id))
      .filter(Boolean)
      .map(b => ({ id:b.id, label:b.label, kind:b.kind, ids:b.pathways.filter(id => PATHWAYS[id] && !isHiddenNode(id)) }))
      .filter(b => b.ids.length);
    if (!bands.length) { bandBar.innerHTML = ''; list.innerHTML = ''; return; }
    // Which band to show = the user's selected band (_activeBandId), defaulting to the
    // active pathway's band when unset/stale. Band-chip clicks set _activeBandId directly
    // (browse); selecting a pathway sets it in applyPathwayById (list follows selection).
    if (!_activeBandId || !bands.find(b => b.id === _activeBandId)) {
      const pwBand = bands.find(b => b.ids.includes(activePathwayId));
      _activeBandId = pwBand ? pwBand.id : bands[0].id;
    }
    const activeBand = bands.find(b => b.id === _activeBandId) || bands[0];
    // L1 — band bar
    bandBar.innerHTML = '';
    // Two axes (§12): the Core bands (Beginner→Advanced) are an ordered CLIMB;
    // the Style bands are LATERAL branches. Render them as two groups separated
    // by a hairline, so the bar doesn't read as one undifferentiated row.
    let _prevKind = null;
    bands.forEach(b => {
      if (_prevKind === 'core' && b.kind !== 'core') {
        const sep = document.createElement('span');
        sep.className = 'slopscale-band-sep';
        sep.setAttribute('aria-hidden', 'true');
        bandBar.appendChild(sep);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slopscale-band-btn slopscale-band-' + (b.kind || 'style') + (b.id === activeBand.id ? ' active' : '');
      btn.textContent = b.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', b.id === activeBand.id ? 'true' : 'false');
      btn.addEventListener('click', () => { _activeBandId = b.id; renderPathwayList(); });
      bandBar.appendChild(btn);
      _prevKind = b.kind;
    });
    // Trailing "+" — open the Pack manager (install / order / hide packs). It's an
    // action, not a tab (no role=tab / aria-selected); right-aligned via CSS.
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'slopscale-band-btn slopscale-band-add'
      + ($('slopscale-root')?.classList.contains('ss-packs-open') ? ' active' : '');
    addBtn.textContent = '+';
    addBtn.title = 'Manage pathway packs';
    addBtn.setAttribute('aria-label', 'Manage pathway packs');
    addBtn.addEventListener('click', () => togglePackManager(true));
    bandBar.appendChild(addBtn);
    // L2 — ordered pathway list for the active band
    const states = activeBand.ids.map(id => ({ id, st: nodeProgressState(id, ptData) }));
    const nextId = (states.find(s => !s.st.cleared && s.id !== activePathwayId) || {}).id;
    list.innerHTML = '';
    states.forEach(({ id, st }) => {
      const pw = PATHWAYS[id];
      const row = document.createElement('div');
      row.className = 'slopscale-segment-card slopscale-pw-row'
        + (id === activePathwayId ? ' active' : '') + (st.cleared ? ' cleared' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', id === activePathwayId ? 'true' : 'false');
      // Tier dots, now LABELLED (§12): each dot names its tempo tier (Slow→Push)
      // + cleared state, so the picker reads the climb, not just anonymous pips.
      const dots = (pw.tempoTiers || []).map((_, i) => {
        const done = i <= st.highestTier;
        const lbl = TIER_LABELS[i] || ('Tier ' + (i + 1));
        return `<span class="tree-tier-dot${done ? ' cleared' : ''}" title="${lbl} — ${done ? 'cleared' : 'not yet'}" aria-label="${lbl}, ${done ? 'cleared' : 'not cleared'}"></span>`;
      }).join('');
      const marker = id === activePathwayId ? '<span class="slopscale-pw-here">you are here</span>'
        : id === nextId ? '<span class="slopscale-pw-next">→ next</span>' : '';
      // Soft "Builds on …" hint — only when the prereq is in ANOTHER band (a Style
      // pathway pointing back to its Core foundation). Within a band the top→bottom
      // order already communicates sequence, so the hint there is just noise.
      const crossBandPrereq = st.prereq && pathwayBandId(st.prereq) !== activeBand.id;
      const sub = (st.prereqUnmet && crossBandPrereq && PATHWAYS[st.prereq])
        ? `<div class="slopscale-pw-sub">Builds on ${PATHWAYS[st.prereq].label} — suggested first</div>` : '';
      // Depth-ladder pip (Phase 9 Slice 5): a 5-rung mastery overview from the
      // progress store — Speed → Travel → Clean → Ears-off → Master. Off mode →
      // no pip (st.depth is null; the whole layer collapses). A filled rung means
      // it was EARNED (a clear), so the accent fill is legitimate, not decorative.
      const depthPip = st.depth ? (() => {
        const rungs = [
          ['Speed',    st.cleared,         'every tempo rung cleared'],
          ['Travel',   st.depth.travel,    'portable across keys & positions'],
          ['Clean',    st.depth.clean,     'clean & in time, support off'],
          ['Ears off', st.depth.eyesOff,   'no metronome / eyes off'],
          ['Master',   st.depth.mastered,  'owned'],
        ];
        const pips = rungs.map(([name, done, hint]) =>
          `<span class="slopscale-pw-pip${done ? ' done' : ''}" title="${name} — ${done ? 'cleared' : 'not yet'} (${hint})" aria-label="${name}, ${done ? 'cleared' : 'not cleared'}"></span>`).join('');
        return `<div class="slopscale-pw-depth"><span class="slopscale-pw-depth-lbl">Depth</span>${pips}</div>`;
      })() : '';
      row.innerHTML = `<div class="slopscale-pw-rowtop"><span class="slopscale-pw-label">${pw.label}</span>${marker}</div>`
        + `<div class="slopscale-pw-dots">${dots}</div>${depthPip}${sub}`;
      row.addEventListener('click', () => {
        const sel = $('slopscale-pathway');
        if (sel) { sel.value = id; sel.dispatchEvent(new Event('change')); }
      });
      list.appendChild(row);
    });
    // Cross-band "→ next" (§12 — the highest-leverage fix): the climb must never
    // go silent at a band seam. When the active band has no un-cleared next rung,
    // point to the next un-cleared pathway forward in the band order (wrapping to
    // an earlier gap only if everything ahead is cleared), and let the learner
    // jump straight to it — so "what's next" survives the Beginner→Intermediate
    // (etc.) boundary where learners otherwise quit.
    if (!nextId) {
      const ai = bands.findIndex(b => b.id === activeBand.id);
      const scan = bands.slice(ai + 1).concat(bands.slice(0, Math.max(0, ai)));
      let cross = null;
      for (const b of scan) {
        const hit = b.ids.find(id => !nodeProgressState(id, ptData).cleared);
        if (hit) { cross = { id: hit, band: b }; break; }
      }
      if (cross && PATHWAYS[cross.id]) {
        const cue = document.createElement('div');
        cue.className = 'slopscale-pw-nextband';
        cue.setAttribute('role', 'button');
        cue.tabIndex = 0;
        cue.title = `Go to ${PATHWAYS[cross.id].label} in ${cross.band.label}`;
        cue.innerHTML = `<span class="slopscale-pw-next">→ next</span>`
          + `<span class="slopscale-pw-nextband-label">${PATHWAYS[cross.id].label}</span>`
          + `<span class="slopscale-pw-nextband-band">in ${cross.band.label}</span>`;
        const go = () => {
          _activeBandId = cross.band.id; renderPathwayList();
          const sel = $('slopscale-pathway'); if (sel) { sel.value = cross.id; sel.dispatchEvent(new Event('change')); }
        };
        cue.addEventListener('click', go);
        cue.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        list.appendChild(cue);
      }
    }
    // Keep the active row visible — scroll the LIST only (never the outer panel).
    const activeRow = list.querySelector('.slopscale-pw-row.active');
    if (activeRow) {
      const lr = list.getBoundingClientRect(), ar = activeRow.getBoundingClientRect();
      if (ar.top < lr.top || ar.bottom > lr.bottom) list.scrollTop += (ar.top - lr.top);
    }
  }

  function renderSkillTree() {
    renderPathwayList();   // the live picker; the SVG tree below is shelved-but-kept
    const container = $('slopscale-skill-tree');
    if (!container || container.classList.contains('slopscale-tree-shelved')) return;
    const ptData = pathwayTiersLoad();
    const hiddenNode = isHiddenNode;
    // Build inner wrapper + SVG edge layer + node buttons
    container.innerHTML = '<div class="slopscale-tree-inner" id="slopscale-tree-inner"></div>';
    const inner = container.firstChild;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'slopscale-tree-edges');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    // Draw edges first so nodes render on top
    const nodeMap = Object.fromEntries(SKILL_TREE_NODES.map(n => [n.id, n]));
    SKILL_TREE_EDGES.forEach(([aId, bId]) => {
      const a = nodeMap[aId], b = nodeMap[bId];
      if (!a || !b || hiddenNode(aId) || hiddenNode(bId)) return;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', 'tree-edge');
      svg.appendChild(line);
    });
    inner.appendChild(svg);
    // Draw nodes
    SKILL_TREE_NODES.forEach(node => {
      const pw = PATHWAYS[node.id];
      if (!pw || hiddenNode(node.id)) return;
      const highestTier = (ptData[node.id] || {}).highest_tier ?? -1;
      const isActive = node.id === activePathwayId;
      const wrapper = document.createElement('div');
      wrapper.className = 'slopscale-tree-node' + (isActive ? ' active' : '');
      wrapper.style.left = node.x + '%';
      wrapper.style.top  = node.y + '%';
      const tiers = (pw.tempoTiers || []).map((_, i) =>
        `<span class="tree-tier-dot${i <= highestTier ? ' cleared' : ''}"></span>`
      ).join('');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slopscale-tree-node-btn';
      btn.title = pw.label;
      btn.innerHTML = `<span>${node.short}</span><span class="tree-node-tiers">${tiers}</span>`;
      btn.addEventListener('click', () => {
        const sel = $('slopscale-pathway');
        if (sel) { sel.value = node.id; sel.dispatchEvent(new Event('change')); }
      });
      wrapper.appendChild(btn);
      inner.appendChild(wrapper);
    });
  }

  function syncScaleDropdown(pathwayId) {
    const el = $('slopscale-pathway-scale');
    const wrap = $('slopscale-pathway-scale-wrap');
    if (!el) return;
    const pw = pathwayId && pathwayId !== 'custom' ? PATHWAYS[pathwayId] : null;
    const scales = pw && pw.scales ? pw.scales : [];
    if (!scales.length) { if (wrap) wrap.style.display = 'none'; return; }
    if (wrap) wrap.style.display = '';
    // Pull human-readable labels from the existing custom scale select
    const sourceOpts = document.querySelectorAll('[name="scale"] option');
    const labelMap = {};
    sourceOpts.forEach(o => { labelMap[o.value] = o.textContent; });
    // Rebuild options
    el.innerHTML = '';
    const currentScale = document.querySelector('[name="scale"]')?.value || '';
    scales.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = labelMap[s] || s;
      if (s === currentScale) opt.selected = true;
      el.appendChild(opt);
    });
    // If current scale isn't in the list, snap to first
    if (!scales.includes(currentScale)) {
      el.value = scales[0];
      setFieldSilent('scale', scales[0]);
    }
  }

  function syncChromaticVisibility() {
    const practiceTypeEl = document.querySelector('[name="practiceType"]');
    const mode = practiceTypeEl ? practiceTypeEl.value : '';
    document.querySelectorAll('.slopscale-chromatic-only').forEach(el => {
      el.style.display = mode === 'chromatic' ? '' : 'none';
    });
    document.querySelectorAll('.slopscale-guide-tones-only').forEach(el => {
      el.style.display = mode === 'guide_tones' ? '' : 'none';
    });
    document.querySelectorAll('.slopscale-bending-only').forEach(el => {
      el.style.display = mode === 'bending' ? '' : 'none';
    });
  }

  // ── Pitch tracker ──────────────────────────────────────────────────────────
  // Uses slopsmithMinigames.scoring.createContinuous (bundled, no registration
  // required). Silently no-ops when the Minigames plugin isn't loaded.
  function ptAvailable() {
    return typeof window.slopsmithMinigames?.scoring?.createContinuous === 'function';
  }

  function startPitchTracker(bundle) {
    if (!ptAvailable()) return;
    stopPitchTracker();
    _ptNotes = [...(bundle.notes || [])].sort((a, b) => a.t - b.t);
    _ptOpenMidis = bundle.openMidis || [];
    _ptScored = new Set();
    // Scoring is optional. Guard the host-SDK call: it can throw or return null
    // when the tracker can't start (no mic, unsupported/secure-context, a host
    // SDK version mismatch). Playback must run regardless.
    try {
      _ptHandle = window.slopsmithMinigames.scoring.createContinuous({ smoothingMs: 40 });
    } catch (_) { _ptHandle = null; return; }
    if (!_ptHandle || typeof _ptHandle.on !== 'function') { _ptHandle = null; return; }
    _ptHandle.on('pitch', ptOnPitch);
    _ptHandle.on('end', () => { _ptHandle = null; });
    ptUpdateMeter({ show: true, active: false, cents: 0, note: '--', hits: 0, total: 0 });
  }

  function ptOnPitch({ freqHz, confidence }) {
    const t = currentPracticeTime;
    let activeNote = null, activeIdx = -1;
    for (let i = 0; i < _ptNotes.length; i++) {
      const n = _ptNotes[i];
      if (n.t - 0.06 <= t && t <= n.t + (n.sus || 0.24) + 0.06) { activeNote = n; activeIdx = i; break; }
    }
    const passedTotal = _ptNotes.filter(n => n.t + (n.sus || 0.24) + 0.06 < t).length;
    if (confidence < 0.55 || !activeNote) {
      ptUpdateMeter({ show: true, active: false, cents: 0, note: '--', hits: _ptScored.size, total: passedTotal });
      return;
    }
    const openMidi = _ptOpenMidis[activeNote.s];
    if (openMidi == null) return;
    const expectedMidi = openMidi + activeNote.f;
    const cents = Math.round(1200 * Math.log2(freqHz / midiToFreq(expectedMidi)));
    if (!_ptScored.has(activeIdx) && Math.abs(cents) <= 50) _ptScored.add(activeIdx);
    const noteName = NOTE_NAMES[((expectedMidi % 12) + 12) % 12] + (Math.floor(expectedMidi / 12) - 1);
    ptUpdateMeter({ show: true, active: true, cents, note: noteName, hits: _ptScored.size, total: passedTotal });
  }

  function stopPitchTracker() {
    if (_ptHandle) { try { _ptHandle.stop(); } catch (_) {} _ptHandle = null; }
    // Clear scoring state so a later silent preview can't read this run's
    // notes/hits and feed stale hit/miss counts to the pathway tier gate.
    _ptNotes = []; _ptScored = new Set();
    ptUpdateMeter({ show: false });
  }

  function ptUpdateMeter({ show, active, cents, note, hits, total }) {
    const meter = $('slopscale-pitch-meter');
    if (!meter) return;
    if (!show) { meter.style.display = 'none'; return; }
    meter.style.display = 'flex';
    const noteEl = $('slopscale-pitch-note'), centsEl = $('slopscale-pitch-cents');
    const needleEl = $('slopscale-cents-needle'), accEl = $('slopscale-pitch-accuracy');
    if (noteEl) noteEl.textContent = active ? note : '--';
    const cc = Math.max(-100, Math.min(100, cents || 0));
    const color = !active ? '#475569' : Math.abs(cents) <= 25 ? '#22c55e' : Math.abs(cents) <= 50 ? '#eab308' : '#ef4444';
    if (needleEl) { needleEl.style.left = `${50 + cc / 2}%`; needleEl.style.background = color; }
    if (centsEl) { centsEl.textContent = active ? `${cents >= 0 ? '+' : ''}${cents}¢` : ''; centsEl.style.color = color; }
    if (accEl) {
      if (total > 0) { const p = Math.round(hits / total * 100); accEl.textContent = `${hits}/${total} (${p}%)`; accEl.style.color = p >= 80 ? '#22c55e' : p >= 60 ? '#eab308' : '#ef4444'; }
      else { accEl.textContent = '--'; accEl.style.color = ''; }
    }
  }
  // ── End pitch tracker ──────────────────────────────────────────────────────

  // ── Session logger ─────────────────────────────────────────────────────────
  // Append-only log of every practice session. Soft-gamification model:
  // logs silently regardless of mode, never gates anything.
  // Schema: { id, date, ts, mode, pathway_id, bpm, bpm_tier, scale, key,
  //           practice_type, duration_ms, hit_count, miss_count }

  function sessionsLoad() {
    try { return JSON.parse(localStorage.getItem('slopscale.sessions') || '[]'); }
    catch { return []; }
  }

  function sessionsSave(arr) {
    try { localStorage.setItem('slopscale.sessions', JSON.stringify(arr.slice(0, 500))); }
    catch (e) { console.warn('[SlopScale] session save failed', e); }
  }

  // ── Pathway tier progress ───────────────────────────────────────────────────
  // Schema: { [pathway_id]: { highest_tier: number } }
  // highest_tier: -1 = none cleared, 0-3 = highest index cleared.
  // Accuracy gate: if pitch tracker ran (hit+miss > 0) and accuracy < 65%, skip.
  // Passive attribution: custom sessions within ±5 BPM of a pathway tier BPM
  // count toward that pathway.
  // SDK: emits window.slopsmith 'slopscale:tier:unlocked' when a new high is set.
  function pathwayTiersLoad() {
    try { return JSON.parse(localStorage.getItem('slopscale.pathway_tiers') || '{}'); }
    catch { return {}; }
  }
  function pathwayTiersSave(obj) {
    try { localStorage.setItem('slopscale.pathway_tiers', JSON.stringify(obj)); }
    catch (e) { console.warn('[SlopScale] pathway tier save failed', e); }
  }
  function _updatePathwayTier(pathwayId, tier) {
    const all = pathwayTiersLoad();
    const cur = all[pathwayId] || { highest_tier: -1 };
    if (tier <= cur.highest_tier) return null;
    all[pathwayId] = { highest_tier: tier };
    pathwayTiersSave(all);
    if (window.slopsmith && typeof window.slopsmith.emit === 'function') {
      window.slopsmith.emit('slopscale:tier:unlocked', {
        pathway: pathwayId, tier, label: TIER_LABELS[tier] || `T${tier + 1}`
      });
    }
    return { pathwayId, tier };
  }
  function advancePathwayTier(session) {
    const total = (session.hit_count || 0) + (session.miss_count || 0);
    const accurate = total === 0 || (session.hit_count || 0) / total >= 0.65;
    if (!accurate) return null;
    if (session.mode === 'pathway' && session.pathway_id && PATHWAYS[session.pathway_id]) {
      const tier = session.bpm_tier;
      if (tier != null && tier >= 0) return _updatePathwayTier(session.pathway_id, tier);
    }
    if (session.mode === 'custom' && session.bpm != null) {
      for (const [pwId, pw] of Object.entries(PATHWAYS)) {
        const tiers = pw.tempoTiers || [];
        let matchedTier = -1;
        tiers.forEach((t, i) => { if (Math.abs(session.bpm - t) <= 5) matchedTier = Math.max(matchedTier, i); });
        if (matchedTier >= 0) {
          const r = _updatePathwayTier(pwId, matchedTier);
          if (r) return r;
        }
      }
    }
    return null;
  }
  // ── End pathway tier progress ───────────────────────────────────────────────

  // ── Depth Ladder + XP (slopscale.progress) — Phase 8 ───────────────────────
  // The second mastery axis ABOVE the shipped Speed Climb (pathway_tiers). Locked
  // design: gamification-architect project_replay_depth_ladder_xp_verdict +
  // project_refresh_variety_loop_verdict. A reward is a gained-only false→true flip
  // on a real artifact — NEVER a rep counter or a stored level. XP is a DERIVED
  // time×difficulty readout, never spent, never gates. SELF-AUDIT LINES TO HOLD:
  //   • Travel/Clean rungs are BINARY false→true per distinct context — never a
  //     "keys 7/12" grind bar or a "% tight" number.
  //   • Off mode collapses the whole layer (no xp/depth/emit) — the standing proof
  //     it never gates.
  //   • Nothing is ever shown LOST; reps stay a silent stat; no scores/ranks/combos.
  // Speed stays in pathway_tiers (NOT duplicated); nodeProgressState reads both.
  const PROGRESS_KEY = 'slopscale.progress';
  function progressLoad() {
    try {
      const o = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      o.byNode = o.byNode || {};
      if (o.mode !== 'off' && o.mode !== 'hardcore') o.mode = 'casual';
      if (typeof o.xp !== 'number') o.xp = 0;
      return o;
    } catch { return { mode:'casual', xp:0, byNode:{} }; }
  }
  function progressSave(o) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(o)); }
    catch (e) { console.warn('[SlopScale] progress save failed', e); }
  }
  function progressNode(o, id) {
    return o.byNode[id] || (o.byNode[id] = { reps:0, depth:{ travel:null, clean:null, eyesOff:null }, masteredAt:null, keysCleared:[] });
  }
  function progressSetMode(mode) {
    if (mode !== 'off' && mode !== 'casual' && mode !== 'hardcore') return;
    const o = progressLoad(); o.mode = mode; progressSave(o);
  }
  // Outbound host-XP seam — mirrors the shipped slopscale:tier:unlocked emit. No-op
  // until the host subscribes; the internal store NEVER depends on it. (The host's
  // actual XP-intake surface is for slopsmith-host-expert to verify when the live
  // hook lands; this only defines the outbound shape.)
  function emitProgress(kind, nodeId, extra) {
    if (window.slopsmith && typeof window.slopsmith.emit === 'function') {
      try { window.slopsmith.emit('slopscale:progress', Object.assign({ source:'slopscale', kind, nodeId, at:Date.now() }, extra || {})); } catch (_) {}
    }
  }
  // A run is "clean" by the same signal the Speed climb uses (≥65% of judged notes
  // hit); when scoring is ABSENT it's lenient/self-confirm true — matching
  // advancePathwayTier, so the rung still advances where the host has no pitch input
  // (the player owns the gate; consistent with gained-only/never-gates).
  function runIsClean(session) {
    const total = (session.hit_count || 0) + (session.miss_count || 0);
    return total === 0 || (session.hit_count || 0) / total >= 0.65;
  }
  // XP difficulty multiplier — gently weights the tempo tier, never penalizes easy
  // play (floor 1.0). The time base means a maxed exercise keeps earning for PLAYING.
  function xpDifficultyMult(session) {
    const tier = Math.max(0, session.bpm_tier != null ? session.bpm_tier : 0);
    return 1 + tier * 0.25;   // Slow 1.0 → Push 1.75
  }
  // Depth Ladder + XP advance — parallel to advancePathwayTier(), called from
  // sessionEnd. Accrues derived XP, and credits the TRAVEL axis when a pathway whose
  // Speed climb is already cleared gets a clean Push pass in a not-yet-credited key
  // (this is how a refresh-into-a-new-key "makes it count" — the session records the
  // refreshed key, we credit it here). Returns a gained-only summary, or null.
  function advanceDepthLadder(session) {
    const store = progressLoad();
    if (store.mode === 'off') return null;                    // Off collapses the layer
    const out = { xpGained:0, travelKey:null, travelRung:false };
    const pwId = session.pathway_id;
    // XP — derived time×difficulty, gained-only (accrues for any run, pathway or not).
    const gained = Math.round(Math.max(0, (session.duration_ms || 0) / 1000) * xpDifficultyMult(session));
    if (gained > 0) { store.xp += gained; out.xpGained = gained; emitProgress('xp', pwId || null, { amount: gained }); }
    // Depth rungs apply only to a known pathway whose Speed axis is already cleared.
    if (pwId && PATHWAYS[pwId]) {
      const node = progressNode(store, pwId);
      node.reps = (node.reps || 0) + 1;                       // silent stat — advances NOTHING
      const topTier = (PATHWAYS[pwId].tempoTiers || []).length - 1;
      const speedCleared = topTier >= 0 && (pathwayTiersLoad()[pwId] || { highest_tier:-1 }).highest_tier >= topTier;
      if (speedCleared && session.bpm_tier === topTier && runIsClean(session) && session.key && !node.keysCleared.includes(session.key)) {
        node.keysCleared.push(session.key);                   // binary false→true per distinct key — no double-credit, tier held
        emitProgress('depth', pwId, { axis:'travel', key: session.key });
        out.travelKey = session.key;
        // The Travel RUNG fills once portability is proven (a 2nd distinct key) — a
        // one-time flip, never a keys-N/12 grind bar.
        if (!node.depth.travel && node.keysCleared.length >= 2) {
          node.depth.travel = Date.now(); out.travelRung = true;
          emitProgress('depth', pwId, { axis:'travel', rung:true });
        }
      }
    }
    progressSave(store);
    return (out.xpGained || out.travelKey) ? out : null;
  }
  // ── End depth ladder ────────────────────────────────────────────────────────

  function sessionBegin() {
    const isSessionMode = $('slopscale-root')?.classList.contains('slopscale-session-mode');
    let mode, pathway_id, bpm, bpm_tier, scale, key, practice_type;

    if (isSessionMode) {
      mode = 'session';
      pathway_id = _selectedStarterId || null;
      bpm = null; bpm_tier = null;
      const firstSeg = activeBundle?.session?.segments?.[0]?.config;
      scale = firstSeg?.scale || null;
      key   = firstSeg?.key   || null;
      practice_type = 'session';
    } else {
      const cfg = activeBundle?.session || readConfig();
      const pathwayEl = document.querySelector('[name="pathway"]');
      const pathwayId = pathwayEl?.value || 'custom';
      mode = pathwayId === 'custom' ? 'custom' : 'pathway';
      pathway_id = mode === 'pathway' ? pathwayId : null;
      bpm = cfg.bpm;
      scale = cfg.scale;
      key   = cfg.key;
      practice_type = cfg.practiceType || cfg.mode || 'scale';
      // Tier = index of highest tempoTier the current BPM meets or exceeds
      bpm_tier = null;
      if (mode === 'pathway' && PATHWAYS[pathwayId]) {
        const tiers = PATHWAYS[pathwayId].tempoTiers;
        bpm_tier = tiers.reduce((best, t, i) => bpm >= t ? i : best, 0);
      }
    }

    const now = Date.now();
    _activeSession = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      date: localDateStr(),
      ts: now, mode, pathway_id, bpm, bpm_tier, scale, key, practice_type,
      duration_ms: 0, hit_count: 0, miss_count: 0
    };
    _sessionStartMs = performance.now();
  }

  function sessionEnd() {
    if (!_activeSession) return;
    const durationMs = Math.round(performance.now() - _sessionStartMs);
    // Discard sub-2s blips (accidental clicks, regenerate-while-playing)
    if (durationMs < 2000) { _activeSession = null; return; }
    const passedTotal = _ptNotes.filter(n => n.t + (n.sus || 0.24) + 0.06 < currentPracticeTime).length;
    _activeSession.duration_ms = durationMs;
    _activeSession.hit_count   = _ptScored.size;
    _activeSession.miss_count  = Math.max(0, passedTotal - _ptScored.size);
    const sessions = sessionsLoad();
    sessions.unshift(_activeSession);
    sessionsSave(sessions);
    const unlock = advancePathwayTier(_activeSession);
    const depthGain = advanceDepthLadder(_activeSession);   // XP + Travel axis (Phase 8)
    // Snapshot for the P-sheet "Last session" card — descriptive + gained-only,
    // no score/accuracy (mirror not judge; see docs/design-system.md §13).
    let displayName;
    if (_activeSession.mode === 'pathway' && PATHWAYS[_activeSession.pathway_id]) displayName = PATHWAYS[_activeSession.pathway_id].label;
    else if (_activeSession.mode === 'session') displayName = (BUILT_IN_SESSIONS[_selectedStarterId]?.name || 'Session practice');
    else displayName = 'Custom practice';
    _lastEndedSession = {
      mode: _activeSession.mode, scale: _activeSession.scale, key: _activeSession.key,
      bpm: _activeSession.bpm, bpm_tier: _activeSession.bpm_tier,
      duration_ms: _activeSession.duration_ms, displayName,
      tierCleared: !!unlock, clearedTier: unlock ? unlock.tier : null,
      depth: depthGain,   // { xpGained, travelKey, travelRung } | null — Phase 9 card reads this
      streak: streakCount(sessions),
    };
    _activeSession = null;
    if (unlock) { _newlyUnlockedTier = unlock.tier; syncTempoTierButtons(); renderSkillTree(); _newlyUnlockedTier = null; }
    syncProgressStrip();
    presentSessionSummary();
  }

  function localDateStr(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function streakCount(sessions) {
    const practiced = new Set(sessions.map(s => s.date));
    const today = localDateStr();
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    // Streak is alive if today or yesterday has a session (grace until midnight)
    if (!practiced.has(today) && !practiced.has(yesterday)) return 0;
    let count = 0;
    let d = practiced.has(today) ? new Date() : new Date(Date.now() - 86400000);
    while (practiced.has(localDateStr(d))) {
      count++;
      d = new Date(d.getTime() - 86400000);
    }
    return count;
  }

  function last7Days(sessions) {
    const practiced = new Set(sessions.map(s => s.date));
    const DAY_LETTERS = ['S','M','T','W','T','F','S'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const date = localDateStr(d);
      return { date, letter: DAY_LETTERS[d.getDay()], practiced: practiced.has(date), isToday: i === 6 };
    });
  }

  function syncProgressStrip() {
    const sessions = sessionsLoad();
    const streak = streakCount(sessions);
    const numEl = $('slopscale-streak-num');
    if (numEl) {
      numEl.textContent = streak;
      numEl.classList.toggle('active', streak > 0);
    }
    const calEl = $('slopscale-cal-dots');
    if (!calEl) return;
    calEl.innerHTML = last7Days(sessions).map(d =>
      `<div class="slopscale-cal-day${d.isToday ? ' today' : ''}">` +
      `<div class="slopscale-cal-dot${d.practiced ? ' practiced' : ''}"></div>` +
      `<span class="slopscale-cal-lbl">${d.letter}</span>` +
      `</div>`
    ).join('');
  }

  // ── End session logger ─────────────────────────────────────────────────────

  // ── Session UI ─────────────────────────────────────────────────────────────

  function segmentEstDuration(seg) {
    const cfg = seg.config || {};
    const m = parseMeter(cfg.meter || '4/4');
    const bpm = cfg.bpm || 80;
    const bars = cfg.bars || 4;
    return bars * (60 / bpm) * (4 / m.denominator) * m.numerator;
  }

  function buildSegmentCard(seg, index) {
    // Escape every interpolated value (defence-in-depth — segment fields are
    // enum/numeric today, but this card builds raw HTML; also escapes " for the
    // data-kind attribute context, unlike summarize()'s text-only esc).
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const color = KIND_COLORS[seg.kind] || '#94a3b8';
    const label = KIND_LABELS[seg.kind] || seg.kind;
    const dur = segmentEstDuration(seg);
    const durStr = dur < 60 ? `~${Math.round(dur)}s` : `~${Math.floor(dur / 60)}m${Math.round(dur % 60)}s`;
    const cfg = seg.config || {};
    const parts = [];
    if (seg.kind === 'chromatic') {
      if (cfg.chromaticPattern) parts.push(`Pattern ${cfg.chromaticPattern}`);
      parts.push(`Frets ${cfg.fretMin ?? 1}–${cfg.fretMax ?? 4}`);
    } else if (cfg.key) {
      parts.push(`${cfg.key} ${(cfg.scale || 'major').replace(/_/g, ' ')}`);
    }
    if (cfg.shape && seg.kind !== 'chromatic') parts.push(`${cfg.shape}-shape`);
    if (cfg.progression && cfg.progression !== 'none' &&
        ['chord_scales','guide_tones','progression_arpeggios'].includes(seg.kind)) {
      parts.push(cfg.progression);
    }
    if (seg.kind === 'guide_tones' && cfg.voices) {
      parts.push({ thirds_only:'3rds', sevenths_only:'7ths', both_alternating:'3rds+7ths' }[cfg.voices] || cfg.voices);
    }
    if (seg.kind === 'chord_scales' && cfg.chordScaleStrategy) {
      parts.push(cfg.chordScaleStrategy === 'chord_tone_emphasis' ? 'park'
        : (cfg.chordScaleStrategy === 'mode_of_moment_enclose' ? 'connect+enclose' : 'connect'));
    }
    if (cfg.bpm) parts.push(`${cfg.bpm} BPM`);
    if (cfg.bars) parts.push(`${cfg.bars} bars`);
    parts.push(durStr);
    // Editing affordances (Phase 9 Slice 2). Re-roll only advances a template-ref
    // that actually has >1 variant; Remove needs >1 block to keep the workout
    // non-empty. The whole card is draggable (grip is the visual cue — mirrors the
    // Pack-Manager idiom); the inline action row is the `⋯` menu, toggled open.
    const tmpl = seg.templateId ? SEGMENT_TEMPLATES[seg.templateId] : null;
    const canReroll = !!(tmpl && tmpl.vary && tmpl.vary.length > 1);
    const canRemove = ((_workoutDraft && _workoutDraft.segments) || []).length > 1;
    return `<div class="slopscale-segment-card" data-kind="${esc(seg.kind)}" data-seg-index="${index}" draggable="true" title="Drag to reorder · click to preview from here">
      <div class="slopscale-segment-header">
        <span class="slopscale-segment-grip" data-act="grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
        <span class="slopscale-segment-badge" style="color:${color}">${esc(label)}</span>
        <span class="slopscale-segment-name">${esc(seg.name || '')}</span>
        <button type="button" class="slopscale-segment-menu-btn" data-act="menu" aria-label="Block actions" title="Block actions">⋯</button>
      </div>
      <div class="slopscale-segment-meta">${esc(parts.join(' · '))}</div>
      <div class="slopscale-segment-actions" hidden>
        <button type="button" data-act="dup" title="Add a copy of this block below">Duplicate</button>
        <button type="button" data-act="reroll"${canReroll ? '' : ' disabled'} title="${canReroll ? 'Re-roll just this block into a fresh variation' : 'This block has no variations to re-roll'}">↻ Re-roll</button>
        <button type="button" data-act="remove"${canRemove ? '' : ' disabled'} title="${canRemove ? 'Remove this block' : 'A workout needs at least one block'}">Remove</button>
      </div>
    </div>`;
  }

  // ── Workout draft + Refresh (Phase 9) ──────────────────────────────────────
  // The editable WORKING COPY of the selected Workout — Refresh (and future
  // design-your-own editing) operate on this, NEVER on the shipped BUILT_IN_SESSIONS
  // (loading a starter = a fork/copy). Template-ref slots are materialized for DISPLAY
  // (cards show the rolled key/scale/shape) while the draft keeps the refs so Refresh
  // can re-roll their vary[] cursor. UX spec: slopscale-ux-designer
  // project_workout_browse_design_refresh.
  // The selected starter id — the single source of truth for which Workout is
  // loaded (replaces the old #slopscale-session-select value; the dropdown was
  // dropped in Phase 9 Slice 4, BUILT_IN_SESSIONS is the option source).
  let _selectedStarterId = Object.keys(BUILT_IN_SESSIONS)[0];
  let _workoutDraft = null, _workoutDraftId = null;
  // True once the user edits the loaded draft (reorder/dup/remove/re-roll/add/refresh)
  // — gates the starter-browse replace-guard so we only warn when edits would be lost.
  let _workoutDirty = false;
  function workoutDraftFor(sessionId) {
    const base = BUILT_IN_SESSIONS[sessionId];
    return base ? JSON.parse(JSON.stringify(base)) : null;   // deep clone — never mutate the shipped session
  }
  function workoutHasRefs(session) {
    return !!(session && (session.segments || []).some(s => s && s.templateId && !s.kind));
  }
  function renderWorkoutDraft() {
    const session = _workoutDraft;
    const info = $('slopscale-session-info'), list = $('slopscale-segment-list');
    if (!info || !list) return;
    if (!session) { info.innerHTML = ''; list.innerHTML = ''; return; }
    // Materialise per RAW index (template-ref → concrete), keeping nulls in place so
    // a card's data-seg-index always maps back to _workoutDraft.segments[i] — the
    // editing ops (reorder/duplicate/remove/re-roll) index into the raw array.
    const rawSegs = session.segments || [];
    const materialized = rawSegs.map(materializeSegment);
    const displaySegs = materialized.filter(Boolean);
    const totalDur = displaySegs.reduce((s, seg) => s + segmentEstDuration(seg), 0);
    const bpms = displaySegs.map(s => s.config?.bpm).filter(Boolean);
    // Template-ref blocks don't pin a BPM (it's tier/default-driven) — omit the stat
    // rather than show a misleading "0 BPM".
    const bpmStr = bpms.length ? (Math.min(...bpms) === Math.max(...bpms) ? `${Math.min(...bpms)} BPM` : `${Math.min(...bpms)}–${Math.max(...bpms)} BPM`) : '';
    // A length preset shows its PLANNED total (≈N min); otherwise the natural sum.
    const presetSec = lengthPresetSec(session.lengthPreset);
    const durStr = presetSec ? `≈ ${Math.round(presetSec / 60)} min`
      : (totalDur < 60 ? `${Math.round(totalDur)}s` : `${Math.floor(totalDur / 60)}m ${Math.round(totalDur % 60)}s`);
    const lenSel = $('slopscale-length-preset');
    if (lenSel) lenSel.value = session.lengthPreset || '';
    const tags = (session.tags || []).join(', ');
    // No hard cap on blocks (charette) — just a calm, non-blocking note past a long
    // set, so a sprawling workout informs without policing. Informational, not green.
    const longNote = displaySegs.length >= 10
      ? `<div class="slopscale-session-longnote">That's a long set — every block can loop or be trimmed, and you never have to finish it all in one sitting.</div>`
      : '';
    info.innerHTML = `
      <div class="slopscale-session-info-name">${session.name}</div>
      <div class="slopscale-session-info-desc">${session.description || ''}</div>
      <div class="slopscale-session-info-stats">
        <span class="slopscale-session-info-stat">${displaySegs.length} segments</span>
        <span class="slopscale-session-info-stat">${durStr}</span>
        ${bpmStr ? `<span class="slopscale-session-info-stat">${bpmStr}</span>` : ''}
        ${tags ? `<span class="slopscale-session-info-stat">${tags}</span>` : ''}
      </div>${longNote}`;
    list.innerHTML = materialized.map((m, i) => m ? buildSegmentCard(m, i) : '').join('');
    const breathe = $('slopscale-breathe-toggle');
    if (breathe) breathe.checked = (session.interBlockBreak || 'auto') !== 'off';   // default on (auto)
    const btn = $('slopscale-workout-refresh');
    if (btn) {
      const can = workoutHasRefs(session);
      btn.disabled = !can;
      btn.title = can ? 'Re-roll every block into a fresh variation — same workout, new keys & positions'
                      : 'This workout’s blocks are fixed (no variations to re-roll)';
    }
  }
  function syncSessionSummary(sessionId) {
    _selectedStarterId = sessionId;   // keep the selection state in sync (single write path with loadStarter)
    if (sessionId !== _workoutDraftId) { _workoutDraft = workoutDraftFor(sessionId); _workoutDraftId = sessionId; _workoutDirty = false; clearRefreshSummary(); }
    renderWorkoutDraft();
  }
  // Plain-language "what changed" between two draft states (the changed surface only).
  function describeRefreshDiff(before, after) {
    const lines = [], a = before.segments || [], b = after.segments || [];
    const pretty = s => String(s).replace(/_/g, ' ');
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (!a[i] || !a[i].templateId || a[i].kind) continue;
      if ((a[i].variantIdx | 0) === (b[i].variantIdx | 0)) continue;
      const ca = (materializeSegment(a[i]) || {}).config || {}, cb = (materializeSegment(b[i]) || {}).config || {};
      const tmpl = SEGMENT_TEMPLATES[a[i].templateId];
      const label = (tmpl && tmpl.label) || a[i].id || `Block ${i + 1}`;
      const parts = [];
      if (cb.key && ca.key !== cb.key) parts.push(`key ${ca.key || '?'}→${cb.key}`);
      if (cb.shape && ca.shape !== cb.shape) parts.push(`${ca.shape || '?'}-shape→${cb.shape}-shape`);
      if (cb.progression && cb.progression !== 'none' && ca.progression !== cb.progression) parts.push(`${pretty(ca.progression || '?')}→${pretty(cb.progression)}`);
      if (cb.scale && ca.scale !== cb.scale) parts.push(`${pretty(ca.scale || '?')}→${pretty(cb.scale)}`);
      // Remaining authored vary axes (so a re-roll never reads "nothing changed"
      // when it genuinely advanced a chromatic pattern / fret window / voice set).
      if (cb.chromaticPattern && ca.chromaticPattern !== cb.chromaticPattern) parts.push(`pattern ${ca.chromaticPattern || '?'}→${cb.chromaticPattern}`);
      const fA = (ca.fretMin != null || ca.fretMax != null) ? `${ca.fretMin ?? '?'}–${ca.fretMax ?? '?'}` : null;
      const fB = (cb.fretMin != null || cb.fretMax != null) ? `${cb.fretMin ?? '?'}–${cb.fretMax ?? '?'}` : null;
      if (fB && fA !== fB) parts.push(`frets ${fA || '?'}→${fB}`);
      const vc = v => ({ thirds_only:'3rds', sevenths_only:'7ths', both_alternating:'3rds+7ths' }[v] || v);
      if (cb.voices && ca.voices !== cb.voices) parts.push(`${vc(ca.voices)}→${vc(cb.voices)}`);
      if (cb.subdivision && ca.subdivision !== cb.subdivision) parts.push(`${pretty(ca.subdivision)}→${pretty(cb.subdivision)}`);
      if (cb.bendTarget != null && ca.bendTarget !== cb.bendTarget) parts.push(`bend ${ca.bendTarget ?? '?'}→${cb.bendTarget}`);
      if (cb.swing != null && ca.swing !== cb.swing) parts.push(`swing ${ca.swing ? 'on' : 'off'}→${cb.swing ? 'on' : 'off'}`);
      if (parts.length) lines.push(`<b>${label}</b> ${parts.join(' · ')}`);
    }
    return lines;
  }
  function clearRefreshSummary() {
    const el = $('slopscale-refresh-summary'); if (el) { el.hidden = true; el.innerHTML = ''; }
  }
  function showRefreshSummary(lines) {
    const el = $('slopscale-refresh-summary'); if (!el) return;
    if (!lines.length) {
      el.innerHTML = `<span>Refreshed — nothing changed this pass.</span><button type="button" class="slopscale-refresh-summary-close" aria-label="Dismiss" title="Dismiss">✕</button>`;
    } else {
      const shown = lines.slice(0, 2), more = lines.length - shown.length;
      el.innerHTML = `<span>Re-rolled — ${shown.join(' · ')}${more > 0 ? ` · +${more} more` : ''}</span><button type="button" class="slopscale-refresh-summary-close" aria-label="Dismiss" title="Dismiss">✕</button>`;
    }
    el.hidden = false;
  }
  function onRefreshWorkout() {
    if (!_workoutDraft || !workoutHasRefs(_workoutDraft)) return;
    const before = JSON.parse(JSON.stringify(_workoutDraft));
    _workoutDraft = refreshWorkout(_workoutDraft, { scope: 'all' });
    _workoutDirty = true;
    showRefreshSummary(describeRefreshDiff(before, _workoutDraft));
    renderWorkoutDraft();
    const btn = $('slopscale-workout-refresh');
    if (btn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      btn.classList.remove('ss-refresh-tick'); void btn.offsetWidth; btn.classList.add('ss-refresh-tick');
    }
    // Mid-playback: the refreshed variation applies on the NEXT Launch (never yanks the
    // playhead). No audio cue (§13).
  }

  // ── Design-your-own timeline edits (Phase 9 Slice 2) ───────────────────────
  // Structural edits on the working DRAFT only (never BUILT_IN_SESSIONS). Each
  // mutates _workoutDraft.segments in place then re-renders. Reorder/duplicate/
  // remove work on both template-ref and inline segments; re-roll only advances a
  // template-ref's variant. Indices are RAW (into _workoutDraft.segments) — the
  // cards carry the raw index (see renderWorkoutDraft). NO audio, no second player.
  function _draftSegs() { return (_workoutDraft && _workoutDraft.segments) || null; }
  // The card a drag at clientY should drop BEFORE (its raw index), or null = append.
  function _segCardUnder(container, clientY) {
    const cards = [...container.querySelectorAll('.slopscale-segment-card')];
    for (const c of cards) {
      const box = c.getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return parseInt(c.dataset.segIndex, 10);
    }
    return null;
  }
  function moveDraftSegment(from, beforeIndex) {
    const segs = _draftSegs(); if (!segs || from < 0 || from >= segs.length) return;
    const [moved] = segs.splice(from, 1);
    let to = (beforeIndex == null || beforeIndex < 0) ? segs.length
           : (beforeIndex > from ? beforeIndex - 1 : beforeIndex);   // adjust for the removal
    to = Math.max(0, Math.min(to, segs.length));
    if (to === from && beforeIndex != null) { segs.splice(from, 0, moved); return; }  // no-op restore
    segs.splice(to, 0, moved);
    _workoutDirty = true; clearRefreshSummary(); renderWorkoutDraft();
  }
  function duplicateDraftSegment(index) {
    const segs = _draftSegs(); if (!segs || index < 0 || index >= segs.length) return;
    const clone = JSON.parse(JSON.stringify(segs[index]));
    if (clone.id) clone.id = clone.id + '__copy' + Date.now().toString(36).slice(-3);  // keep ids unique for scope-by-id
    segs.splice(index + 1, 0, clone);
    _workoutDirty = true; clearRefreshSummary(); renderWorkoutDraft();
  }
  function removeDraftSegment(index) {
    const segs = _draftSegs(); if (!segs || segs.length <= 1 || index < 0 || index >= segs.length) return;
    segs.splice(index, 1);
    _workoutDirty = true; clearRefreshSummary(); renderWorkoutDraft();
  }
  function rerollDraftSegment(index) {
    const segs = _draftSegs(); if (!segs) return;
    const seg = segs[index];
    if (!(seg && seg.templateId && !seg.kind)) return;                 // inline = nothing to re-roll
    const tmpl = SEGMENT_TEMPLATES[seg.templateId];
    if (!tmpl || !tmpl.vary || tmpl.vary.length <= 1) return;          // single-variant = no-op
    const before = JSON.parse(JSON.stringify(_workoutDraft));
    _workoutDraft = refreshWorkout(_workoutDraft, { scope: index });
    _workoutDirty = true;
    showRefreshSummary(describeRefreshDiff(before, _workoutDraft));
    renderWorkoutDraft();
  }
  // Append a library template (or insert after a given raw index) as a fresh
  // template-ref slot — the drawer's [+ Add] entry point (Phase 9 Slice 3).
  function addSegmentToDraft(templateId, atIndex) {
    const tmpl = SEGMENT_TEMPLATES[templateId]; if (!tmpl || !_workoutDraft) return;
    const ref = { id: templateId + '__add' + Date.now().toString(36).slice(-3), templateId, variantIdx: 0 };
    const segs = _workoutDraft.segments || (_workoutDraft.segments = []);
    if (atIndex == null || atIndex < 0 || atIndex >= segs.length) segs.push(ref);
    else segs.splice(atIndex + 1, 0, ref);
    _workoutDirty = true; clearRefreshSummary(); renderWorkoutDraft();
  }
  // Toggle a card's inline action row (the `⋯` menu), closing any other open one.
  function toggleSegMenu(card) {
    const list = $('slopscale-segment-list'); if (!list) return;
    const menu = card.querySelector('.slopscale-segment-actions'); if (!menu) return;
    const willOpen = menu.hidden;
    list.querySelectorAll('.slopscale-segment-actions').forEach(m => { if (m !== menu) m.hidden = true; });
    list.querySelectorAll('.slopscale-segment-card.menu-open').forEach(c => { if (c !== card) c.classList.remove('menu-open'); });
    menu.hidden = !willOpen;
    card.classList.toggle('menu-open', willOpen);
  }

  function syncSessionMode(mode) {
    const root = $('slopscale-root'); if (!root) return;
    root.classList.toggle('slopscale-session-mode', mode === 'session');
    syncModeBar();
  }

  async function onLaunchSession() {
    const sessionId = _selectedStarterId || Object.keys(BUILT_IN_SESSIONS)[0];
    const baseSession = BUILT_IN_SESSIONS[sessionId];
    if (!baseSession) return;
    const btn = $('slopscale-launch-session');
    const summary = $('slopscale-summary');
    const audio = {
      notes:      !!document.getElementById('slopscale-session-audio-notes')?.checked,
      metronome:  !!document.getElementById('slopscale-session-audio-metronome')?.checked,
      harmony:    !!document.getElementById('slopscale-session-audio-harmony')?.checked,
    };
    // Pre-warm the AudioContext while still in the button-click user-gesture context
    // (before any await). Without this, new AudioContext() created inside the
    // async continuation below may start in 'suspended' state on some hosts,
    // causing notes scheduled with the frozen currentTime to fire in the past.
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    // Sessions follow the user's form string-setup ONLY within the same
    // instrument family: a 7-string player gets a guitar session in 7-string,
    // but a bassist launching a guitar session (or a guitarist launching a bass
    // session) keeps the session's OWN setup. This preserves "respect my string
    // count" while protecting instrument-specific presets — Bass Foundations
    // stays bass, and a guitar-only technique (e.g. bending in Rock Essentials)
    // never lands on a bass setup (which would throw).
    const formStringSetup = document.querySelector('[name="stringSetup"]')?.value || null;
    const sessionSetup = STRING_SETUPS[baseSession.stringSetup] || STRING_SETUPS.guitar_6_standard;
    const formSetup = formStringSetup ? STRING_SETUPS[formStringSetup] : null;
    const inheritForm = !!formSetup && formSetup.instrument === sessionSetup.instrument;
    // Launch the editable working DRAFT (refreshed/edited) — materialize any template-ref
    // slots, then patch audio + (family-compatible) string setup into each concrete config.
    // Falls back to a fresh clone if the draft is missing/stale for the selected session.
    if (!_workoutDraft || _workoutDraftId !== sessionId) { _workoutDraft = workoutDraftFor(sessionId); _workoutDraftId = sessionId; }
    const draft = _workoutDraft || baseSession;
    // Apply the opt-in length preset last (distributes targetSec across the blocks);
    // no-op when the draft has no preset ("As built"). interBlockBreak rides along.
    const session = applyLengthPreset(Object.assign({}, draft, {
      ...(inheritForm ? { stringSetup: formStringSetup } : {}),
      segments: (draft.segments || []).map(materializeSegment).filter(Boolean).map(seg =>
        Object.assign({}, seg, { config: Object.assign({}, seg.config, { audio }) })
      )
    }), draft.lengthPreset);
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
      if (playing) stopPlayback();
      showStatus('Building session…');
      const exercise = generateSession(session);
      lastExercise = exercise;
      if (summary) summary.innerHTML = summarize(exercise);
      await attachRenderer(exercise);
      await awaitVoices(activeBundle);  // start on WAF, not the oscillator
      startPlayback();
      refreshStatusFromState();
    } catch (e) {
      showStatus(`Session error: ${e.message || e}`);
      console.error('[SlopScale] session launch failed', e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '▶ Launch Session'; }
    }
  }

  // ── End Session UI ──────────────────────────────────────────────────────────

  function syncViewSwitcher(kind) {
    document.querySelectorAll('.slopscale-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.renderer === kind);
    });
    // Theme toggle is only meaningful for the themed renderers (Tab,
    // Notation); the highway renderers have their own visual identity.
    const root = $('slopscale-root');
    if (root) {
      root.classList.toggle('slopscale-theme-renderer', kind === 'tab_2d' || kind === 'notation_2d');
      // Fretboard strip is offered on every stringed-instrument view — 3D
      // Highway, Jumping Tab, Tab, and Notation; the user can toggle it off.
      // (Always hidden for the Piano instrument via CSS.)
      root.classList.toggle('slopscale-fb-capable',
        kind === 'highway_3d' || kind === 'builtin_2d' || kind === 'tab_2d' || kind === 'notation_2d');
      // The HUD title only shows for 3D Highway — every other renderer draws
      // the exercise name in-canvas itself, so showing it here too would double.
      root.classList.toggle('slopscale-hud-title-on', kind === 'highway_3d');
    }
  }
  function syncThemeButtons() {
    document.querySelectorAll('.slopscale-theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === currentRenderTheme);
    });
  }

  async function onViewSwitch(kind) {
    syncViewSwitcher(kind);
    localStorage.setItem('slopscale.renderer', kind);
    // Keep the Advanced renderer dropdown in sync (if visible / accessible)
    const rendererSel = document.querySelector('[name="renderer"]');
    if (rendererSel && rendererSel.value !== kind) rendererSel.value = kind;
    if (!lastExercise) return;
    lastExercise.session.renderer = kind;
    const summary = $('slopscale-summary');
    // Switching views stops playback by design — the user explicitly chose a
    // new view, so we treat that as a transport break. stopPlayback() resets
    // the playhead, kills audio, AND updates the Play button label back to
    // "▶ Play" so the user isn't left looking at a stale "■ Stop".
    if (playing) stopPlayback();
    try {
      await attachRenderer(lastExercise);
      // Refresh the LCD so a prior failed-attach state doesn't linger after a
      // successful switch.
      if (summary) summary.innerHTML = summarize(lastExercise);
    } catch (e) {
      console.error('[SlopScale] renderer switch failed', e);
      // Auto-fall back to 2D Highway, which is in-tree and handles any
      // string count. Without this, a 3D-Highway failure leaves the user
      // staring at a stuck error with no obvious way out. Status line carries
      // the message; the LCD stays a clean chart readout.
      if (kind !== 'builtin_2d') {
        showStatus(`${kind} unavailable — falling back to 2D Highway (${e.message || e})`);
        try {
          syncViewSwitcher('builtin_2d');
          lastExercise.session.renderer = 'builtin_2d';
          await attachRenderer(lastExercise);
          if (summary) summary.innerHTML = summarize(lastExercise);
        } catch (e2) {
          console.error('[SlopScale] fallback to 2D Highway failed', e2);
          showStatus(`Renderer failed: ${e2.message || e2}`);
        }
      } else {
        showStatus(`Renderer failed: ${e.message || e}`);
      }
    }
  }

  // ── Deep-link / shareable URL ──────────────────────────────────────────
  // Serialises the active form state to a URL hash so a user can copy a link
  // that restores the exact exercise on another machine. We snapshot the
  // entire #slopscale-controls FormData — small enough to fit comfortably in
  // a hash, and stays in sync with whatever fields the form happens to expose.
  const SHARE_HASH_KEY = 's';
  function snapshotFormState() {
    const form = $('slopscale-controls'); if (!form) return null;
    const data = new FormData(form);
    const out = {};
    for (const [k, v] of data.entries()) out[k] = v;
    // FormData omits unchecked checkboxes; restore them explicitly so the
    // round-trip is lossless (otherwise "Hear notes off" can't be shared).
    // form.elements (not a DOM descendant query) so it also reaches the
    // form-associated audio mute pills that live in the stage view-bar.
    Array.from(form.elements).forEach(cb => {
      if (cb.type === 'checkbox' && cb.name && !(cb.name in out)) out[cb.name] = cb.checked ? 'on' : '';
    });
    return out;
  }
  function applyFormState(state) {
    const form = $('slopscale-controls'); if (!form || !state || typeof state !== 'object') return;
    for (const [name, value] of Object.entries(state)) {
      // form.elements[name] reaches form-associated controls regardless of DOM
      // position (the relocated audio mute pills), and never throws on a crafted
      // share-payload key the way an attribute selector could.
      let field = form.elements[name];
      // A radio/checkbox group resolves to a RadioNodeList; we only carry single
      // controls, so take the first element if a list comes back.
      if (field && typeof field.length === 'number' && !('value' in field)) field = field[0];
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = value === 'on' || value === true;
      else field.value = value;
    }
  }
  function encodeShareHash(state) {
    if (!state) return '';
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))).replace(/=+$/, ''); }
    catch (_) { return ''; }
  }
  function decodeShareHash(s) {
    if (!s) return null;
    try {
      const pad = s.length % 4 ? s + '==='.slice((s.length + 3) % 4) : s;
      return JSON.parse(decodeURIComponent(escape(atob(pad))));
    } catch (_) { return null; }
  }
  function readShareHash() {
    const h = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const params = new URLSearchParams(h);
    return decodeShareHash(params.get(SHARE_HASH_KEY));
  }
  function writeShareHash() {
    const enc = encodeShareHash(snapshotFormState());
    if (!enc) return;
    const params = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash);
    params.set(SHARE_HASH_KEY, enc);
    const next = '#' + params.toString();
    if (location.hash !== next) history.replaceState(null, '', next);
  }
  async function onCopyShareLink() {
    writeShareHash();
    const btn = $('slopscale-share');
    try {
      await navigator.clipboard.writeText(location.href);
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    } catch (e) {
      console.warn('[SlopScale] clipboard copy failed', e);
      if (btn) { const orig = btn.textContent; btn.textContent = 'Copy failed'; setTimeout(() => { btn.textContent = orig; }, 1500); }
    }
  }
  // Paste-share-link handler: accept either a full URL containing an
  // #s=<base64> param, or just the raw base64 string. Restores form state,
  // refreshes every dependent control, and triggers a regenerate.
  function onPasteShareLink(raw) {
    const el = $('slopscale-paste-share');
    if (!raw || !raw.trim()) { if (el) el.classList.remove('flash-ok', 'flash-bad'); return; }
    let encoded = raw.trim();
    // Try to extract #s=... from a URL; fall back to treating the input as
    // an already-extracted base64 payload.
    const hashIdx = encoded.indexOf('#');
    if (hashIdx !== -1) {
      const params = new URLSearchParams(encoded.slice(hashIdx + 1));
      const v = params.get(SHARE_HASH_KEY);
      if (v) encoded = v;
    }
    const state = decodeShareHash(encoded);
    if (!state || typeof state !== 'object') {
      if (el) { el.classList.remove('flash-ok'); el.classList.add('flash-bad'); setTimeout(() => el.classList.remove('flash-bad'), 1500); }
      return;
    }
    applyFormState(state);
    // Re-run every downstream sync so dependent controls follow the
    // restored form values (Shape dropdown, instrument-aware UI bits, etc.).
    syncShapeDropdown();
    syncShapeDropdownSelectionToHidden();
    updatePositionStepper();
    syncInstrumentFamilyButtons();
    syncInstrumentClass();
    syncStringCountChips();
    syncTuningOptions();
    syncAdvancedMode();
    syncChromaticVisibility();
    writeShareHash();
    if (el) {
      el.value = '';
      el.classList.remove('flash-bad'); el.classList.add('flash-ok');
      setTimeout(() => el.classList.remove('flash-ok'), 1500);
    }
    if (activeBundle) onGenerate();
  }

  // ===========================================================================
  // §15 · DOM WIRING (bind) + PUBLIC SURFACE (window.SlopScale)
  // bind() wires all DOM events once on DOMContentLoaded.
  // ===========================================================================
  function bind() {
    const root = $('slopscale-root'); if (!root || root.dataset.slopscaleInit === '1') return false; root.dataset.slopscaleInit = '1';
    const instrument = document.querySelector('[name="instrument"]'), setup = document.querySelector('[name="stringSetup"]'), advancedToggle = $('slopscale-advanced-toggle');
    instrument?.addEventListener('change', () => {
      if (!setup) return;
      setup.value = instrument.value === 'bass' ? 'bass_4_standard' : 'guitar_6_standard';
      syncInstrumentClass();
      if (activeBundle) onGenerate();
    });
    setup?.addEventListener('change', () => {
      syncStringSetupControls(); syncInstrumentClass(); syncStringCountChips(); syncTuningOptions();
      // A string-count/tuning change reshapes the generated pattern (different
      // string count, different open pitches) — regenerate so the displayed
      // chart + audio actually reflect it. Mirrors the instrument/tuning-select
      // handlers, which already regenerate. (Programmatic value-sets that must
      // NOT regenerate, e.g. the instrument handler's reset, assign .value
      // without dispatching 'change', so they don't reach here.)
      if (activeBundle) onGenerate();
    });
    // Top-level instrument-family chips (Bass / Guitar / Piano).
    document.querySelectorAll('.slopscale-instr-btn').forEach(btn => {
      btn.addEventListener('click', () => onInstrumentFamilyClick(btn.dataset.instrument));
    });
    // Tuning preset dropdown — wired here since the chip row populates its
    // contents dynamically and we still want a single change handler.
    $('slopscale-tuning-select')?.addEventListener('change', () => {
      onTuningPresetChange();
      if (activeBundle) onGenerate();
    });
    $('slopscale-save-tuning')?.addEventListener('click', onSaveTuningClick);
    // Fetch any tunings the user saved in a prior session and pull them
    // into the dropdown. Async; the dropdown is repainted by the fetch
    // callback so users see saved entries the moment the request lands.
    loadSavedTunings();
    // Restore the last-used family before first sync, so reload lands on
    // bass-instrument state immediately (renderer fallback, shape selector
    // hidden, etc.) rather than guitar-then-bass flicker.
    try {
      const saved = localStorage.getItem('slopscale.instrumentFamily');
      if (saved === 'bass' || saved === 'guitar') {
        if (instrument && instrument.value !== saved) {
          instrument.value = saved;
          if (setup) setup.value = saved === 'bass' ? 'bass_4_standard' : 'guitar_6_standard';
        }
      }
    } catch (_) {}
    syncStringSetupControls();
    syncInstrumentClass();
    syncStringCountChips();
    syncTuningOptions();
    advancedToggle?.addEventListener('change', syncAdvancedMode); syncAdvancedMode(); syncChromaticVisibility();
    $('slopscale-pathway-scale')?.addEventListener('change', (ev) => { setFieldSilent('scale', ev.target.value); if (activeBundle) onGenerate(); });
    $('slopscale-play').addEventListener('click', onPlayToggle);
    // Unified DAW ruler: one canvas handles BOTH scrub and A–B loop.
    //   • Lower track → scrub/seek (drag the playhead through the chart).
    //   • Top strip (loop zone) → loop/cycle: drag empty = paint a new loop,
    //     drag inside the band = move it, drag near an edge = resize.
    //   • Loop edges are grabbable from anywhere in the ruler height (±6px).
    // Loop drags snap to bar lines (Alt = free) and feed the same tpA/tpB +
    // commitLoop() the A/B buttons use — one loop system. Seek is continuous.
    const rulerCanvas = $('slopscale-ruler-canvas');
    if (rulerCanvas) {
      let mode = null, anchorT = 0, startTpA = 0, startTpB = 0, prevA = null, prevB = null;
      const dur = () => activeBundle?.songInfo?.duration || 0;
      // Map clientX↔time through the SAME scrolling window the ruler draws with, so
      // seek + loop-drag track the visible bars (not the whole-session fit).
      const timeAt = (clientX) => { const m = rulerMap(); return m ? m.tAt(clientX) : 0; };
      // Which loop edge (if any) the pointer is within ~6px of, in screen px. An
      // off-screen edge returns null (can't grab it on a scrolling ruler — that's
      // what the overview strip is for).
      const edgeNear = (clientX) => {
        if (tpA == null || tpB == null || dur() <= 0) return null;
        const m = rulerMap(); if (!m) return null;
        const xa = m.g.rect.left + m.xAt(Math.min(tpA, tpB));
        const xb = m.g.rect.left + m.xAt(Math.max(tpA, tpB));
        if (xa >= m.g.rect.left && Math.abs(clientX - xa) <= 6) return 'resizeA';
        if (xb <= m.g.rect.left + m.g.rect.width && Math.abs(clientX - xb) <= 6) return 'resizeB';
        return null;
      };
      rulerCanvas.addEventListener('pointerdown', (e) => {
        if (!activeBundle || dur() <= 0) return;
        e.preventDefault();
        try { rulerCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        prevA = tpA; prevB = tpB;
        const g = rulerGeom(); const y = e.clientY - g.rect.top;
        const lz = Math.min(RULER_LOOP_ZONE, g.rect.height * 0.4);
        const edge = edgeNear(e.clientX);
        const t = timeAt(e.clientX);
        if (edge) { mode = edge; }
        else if (y <= lz) {
          // Loop zone: move an existing band if clicked inside it, else start new.
          const inBand = tpA != null && tpB != null && t >= Math.min(tpA, tpB) && t <= Math.max(tpA, tpB);
          if (inBand) { mode = 'move'; anchorT = t; startTpA = Math.min(tpA, tpB); startTpB = Math.max(tpA, tpB); }
          else { mode = 'new'; anchorT = snapToDownbeat(t, e.altKey); tpA = anchorT; tpB = anchorT; paintLoopRegion(); }
        } else {
          mode = 'seek'; seekTo(t);
        }
      });
      rulerCanvas.addEventListener('pointermove', (e) => {
        if (!mode) {
          // Hover affordance: resize at edges, crosshair in loop zone, seek below.
          const g = rulerGeom(); if (!g) return;
          const lz = Math.min(RULER_LOOP_ZONE, g.rect.height * 0.4);
          rulerCanvas.style.cursor = edgeNear(e.clientX) ? 'ew-resize' : ((e.clientY - g.rect.top) <= lz ? 'crosshair' : 'pointer');
          return;
        }
        const raw = timeAt(e.clientX);
        if (mode === 'seek') { seekTo(raw); return; }
        const t = snapToDownbeat(raw, e.altKey);
        if (mode === 'new') { tpA = Math.min(anchorT, t); tpB = Math.max(anchorT, t); }
        else if (mode === 'resizeA') { tpA = t; }
        else if (mode === 'resizeB') { tpB = t; }
        else if (mode === 'move') {
          const width = startTpB - startTpA;
          let na = snapToDownbeat(startTpA + (raw - anchorT), e.altKey);
          na = Math.max(0, Math.min(Math.max(0, dur() - width), na));
          tpA = na; tpB = na + width;
        }
        paintLoopRegion();
      });
      const endRuler = (e) => {
        if (!mode) return;
        const wasSeek = mode === 'seek', wasNew = mode === 'new';
        mode = null;
        try { rulerCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
        if (wasSeek) return;  // seek commits live; nothing to finalize
        // A click (no real drag) in the empty loop zone shouldn't wipe a loop.
        if (wasNew && Math.abs((tpA ?? 0) - (tpB ?? 0)) < 0.02) { tpA = prevA; tpB = prevB; }
        commitLoop();
      };
      rulerCanvas.addEventListener('pointerup', endRuler);
      rulerCanvas.addEventListener('pointercancel', endRuler);
    }
    // Overview/marker strip (lane 2): fit-to-width — click = seek anywhere, drag =
    // author the A–B loop (the off-screen-safe authoring surface), edge-drag = resize.
    const ovCanvas = $('slopscale-overview-canvas');
    if (ovCanvas) {
      const ovGeom = () => { const c = $('slopscale-overview-canvas'); if (!c) return null; const rect = c.getBoundingClientRect(); const padX = 2, usableW = Math.max(1, rect.width - padX * 2); const d = activeBundle?.songInfo?.duration || 0; return { rect, padX, usableW, dur: d }; };
      const ovT = (cx) => { const g = ovGeom(); if (!g || g.dur <= 0) return 0; return Math.max(0, Math.min(g.dur, (cx - g.rect.left - g.padX) / g.usableW * g.dur)); };
      const ovEdge = (cx) => { if (tpA == null || tpB == null) return null; const g = ovGeom(); if (!g || g.dur <= 0) return null; const xa = g.rect.left + g.padX + Math.min(tpA, tpB) / g.dur * g.usableW; const xb = g.rect.left + g.padX + Math.max(tpA, tpB) / g.dur * g.usableW; if (Math.abs(cx - xa) <= 6) return 'resizeA'; if (Math.abs(cx - xb) <= 6) return 'resizeB'; return null; };
      let ovMode = null, ovAnchor = 0, ovDownX = 0, ovPrevA = null, ovPrevB = null, ovMoved = false;
      ovCanvas.addEventListener('pointerdown', (e) => {
        const g = ovGeom(); if (!activeBundle || !g || g.dur <= 0) return; e.preventDefault();
        try { ovCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        ovPrevA = tpA; ovPrevB = tpB; ovDownX = e.clientX; ovMoved = false;
        const edge = ovEdge(e.clientX);
        if (edge) ovMode = edge;
        else { ovMode = 'pending'; ovAnchor = snapToDownbeat(ovT(e.clientX), e.altKey); }   // drag→loop, click→seek (decided on up)
      });
      ovCanvas.addEventListener('pointermove', (e) => {
        if (!ovMode) { ovCanvas.style.cursor = ovEdge(e.clientX) ? 'ew-resize' : 'pointer'; return; }
        const t = snapToDownbeat(ovT(e.clientX), e.altKey);
        if (Math.abs(e.clientX - ovDownX) > 3) ovMoved = true;
        if (ovMode === 'pending' && ovMoved) { ovMode = 'new'; tpA = ovAnchor; tpB = ovAnchor; }
        if (ovMode === 'new') { tpA = Math.min(ovAnchor, t); tpB = Math.max(ovAnchor, t); paintLoopRegion(); }
        else if (ovMode === 'resizeA') { tpA = t; paintLoopRegion(); }
        else if (ovMode === 'resizeB') { tpB = t; paintLoopRegion(); }
      });
      const ovEnd = (e) => {
        if (!ovMode) return; const m = ovMode; ovMode = null;
        try { ovCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
        if (m === 'pending' && !ovMoved) { seekTo(ovT(e.clientX)); return; }   // a click = seek
        if (m === 'new' && Math.abs((tpA ?? 0) - (tpB ?? 0)) < 0.02) { tpA = ovPrevA; tpB = ovPrevB; }
        commitLoop();
      };
      ovCanvas.addEventListener('pointerup', ovEnd);
      ovCanvas.addEventListener('pointercancel', ovEnd);
    }
    $('slopscale-to-start')?.addEventListener('click', () => seekTo(0));
    $('slopscale-nudge-back')?.addEventListener('click', () => nudgeBar(-1));
    $('slopscale-nudge-fwd')?.addEventListener('click', () => nudgeBar(1));
    if (!window.__slopscaleKeysBound) { window.__slopscaleKeysBound = true; document.addEventListener('keydown', onTransportKey); }
    $('slopscale-loop-a')?.addEventListener('click', () => { tpA = currentPracticeTime; commitLoop(); });
    $('slopscale-loop-b')?.addEventListener('click', () => { tpB = currentPracticeTime; commitLoop(); });
    $('slopscale-loop-clear')?.addEventListener('click', resetTransportLoop);
    document.querySelectorAll('.slopscale-tp-seg').forEach(btn => {
      // Count-in is baked into the chart as lead-in rest bars (applyCountIn in
      // makeBundle), so changing it rebuilds the bundle — a re-attach, not just
      // a playback tweak. Stop playback and re-attach the current exercise so
      // the new lead-in (notes flowing in + notation rests) takes effect.
      btn.addEventListener('click', async () => {
        const v = btn.dataset.countin;
        setFieldSilent('countIn', v); syncTransport();
        if (!lastExercise) return;
        if (playing) stopPlayback();
        lastExercise.session.countInBars = Math.max(0, Math.min(8, parseInt(v, 10) || 0));
        try { await attachRenderer(lastExercise); } catch (e) { console.error('[SlopScale] count-in re-attach failed', e); }
      });
    });
    document.querySelector('#slopscale-controls [name="countIn"]')?.addEventListener('change', syncTransport);
    // Session transport: segment nav, per-segment loop, and click-to-jump on
    // both the progress bar and the left-panel segment cards.
    $('slopscale-prev-seg')?.addEventListener('click', prevSegment);
    $('slopscale-next-seg')?.addEventListener('click', nextSegment);
    $('slopscale-loop-seg')?.addEventListener('click', loopCurrentSegment);
    $('slopscale-session-progress')?.addEventListener('click', (e) => {
      const seg = e.target.closest('.slopscale-progress-seg');
      if (seg) jumpToSegment(parseInt(seg.dataset.segIndex, 10));
    });
    const _segList = $('slopscale-segment-list');
    _segList?.addEventListener('click', async (e) => {
      const card = e.target.closest('.slopscale-segment-card');
      if (!card) return;
      const i = parseInt(card.dataset.segIndex, 10);
      const ctl = e.target.closest('[data-act]');
      if (ctl) {
        const act = ctl.dataset.act;
        if (act === 'grip') return;                              // drag handle — ignore the click
        if (act === 'menu')   { toggleSegMenu(card); return; }
        if (act === 'dup')    { duplicateDraftSegment(i); return; }
        if (act === 'reroll') { if (!ctl.disabled) rerollDraftSegment(i); return; }
        if (act === 'remove') { if (!ctl.disabled) removeDraftSegment(i); return; }
        return;
      }
      // Card body → preview from here (launch the editable draft, jump to the block).
      if (!activeBundle || activeBundle.config?.mode !== 'session') await onLaunchSession();
      jumpToSegment(i);
    });
    // Drag-reorder the timeline (HTML5 DnD; mirrors the Pack-Manager grip idiom).
    if (_segList) {
      let _segDragFrom = -1;
      _segList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.slopscale-segment-card'); if (!card) return;
        _segDragFrom = parseInt(card.dataset.segIndex, 10);
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(_segDragFrom)); } catch (_) {}
        card.classList.add('dragging');
      });
      _segList.addEventListener('dragend', () => {
        _segDragFrom = -1;
        _segList.querySelectorAll('.dragging, .drop-target').forEach(el => el.classList.remove('dragging', 'drop-target'));
      });
      _segList.addEventListener('dragover', (e) => {
        if (_segDragFrom < 0) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        const under = _segCardUnder(_segList, e.clientY);
        _segList.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        if (under != null) { const t = _segList.querySelector(`.slopscale-segment-card[data-seg-index="${under}"]`); if (t) t.classList.add('drop-target'); }
      });
      _segList.addEventListener('drop', (e) => {
        if (_segDragFrom < 0) return;
        e.preventDefault();
        moveDraftSegment(_segDragFrom, _segCardUnder(_segList, e.clientY));
        _segDragFrom = -1;
      });
    }
    // #slopscale-regenerate is now a HIDDEN refresh bridge (no longer a visible
    // UI button) — the bootstrap settings-watcher .click()s it to silently
    // re-render on host look-setting changes. The handler stays.
    $('slopscale-regenerate')?.addEventListener('click', onGenerate);
    // Save-preset was cut from Custom (the share link covers single-config
    // portability; "Save as Workout block" will be the future save bridge).
    // savePreset() is kept (dormant) for that future reuse.
    $('slopscale-share')?.addEventListener('click', onCopyShareLink);
    // Paste-share-link: fire on actual paste events AND on plain typing
    // (some users will type a base64 payload in directly).
    const pasteEl = $('slopscale-paste-share');
    if (pasteEl) {
      pasteEl.addEventListener('paste', (ev) => {
        // Read the clipboard data directly so we don't depend on the input
        // value being updated yet.
        const txt = (ev.clipboardData || window.clipboardData)?.getData('text') || '';
        if (txt) { ev.preventDefault(); onPasteShareLink(txt); }
      });
      pasteEl.addEventListener('change', () => onPasteShareLink(pasteEl.value));
    }
    $('slopscale-go-library')?.addEventListener('click', () => { stopRenderer(); goScreen('home'); });
    $('slopscale-go-plugins')?.addEventListener('click', () => { stopRenderer(); goScreen('plugins'); });
    $('slopscale-controls').addEventListener('change', (ev) => {
      const name = ev && ev.target ? ev.target.name : '';
      if (name === 'shape') syncShapeDropdownSelectionToHidden();
      if (name === 'practiceType') syncChromaticVisibility();
      if (name === 'keyCycle') { const h = $('slopscale-keycycle-help'); if (h) h.style.display = ev.target.value !== 'none' ? '' : 'none'; }
      if (name === 'renderer') syncViewSwitcher(ev.target.value);
      syncAdvancedMode();
      markPathwayModifiedIfApplicable(name);
      writeShareHash();
      if (activeBundle) onGenerate();
    });
    // Practice mute pills (Notes / Backing / Click) live in the stage view-bar but
    // are form-associated (form="slopscale-controls"), so their change events do
    // NOT bubble to the #slopscale-controls listener above — wire them directly to
    // the same effect (audio flags are pure playback mutes, so a regenerate picks
    // them up cleanly on the next scheduled pass). All default checked = un-muted.
    document.querySelectorAll('.slopscale-practice-pill input').forEach(inp => {
      inp.addEventListener('change', () => { writeShareHash(); if (activeBundle) onGenerate(); });
    });
    // View switcher buttons in the render stage — independent of exercise mode
    document.querySelectorAll('.slopscale-view-btn').forEach(btn => {
      btn.addEventListener('click', () => onViewSwitch(btn.dataset.renderer));
    });
    const fbToggle = $('slopscale-fretboard-toggle');
    if (fbToggle) fbToggle.addEventListener('click', () => {
      fretboardOn = !fretboardOn;
      try { localStorage.setItem('slopscale.fretboard', fretboardOn ? '1' : '0'); } catch (_) {}
      syncFretboardUI();
      // Showing/hiding the strip changes the render-host height. Re-fit the
      // active renderer so a borrowed viz (Jumping Tab) re-lays-out to the new
      // size instead of stretching its old canvas to fill the gap.
      if (renderer && typeof renderer.resize === 'function') {
        const host = $('slopscale-render-host');
        if (host) { const r = host.getBoundingClientRect(); renderer.resize(Math.round(r.width), Math.round(r.height)); }
      }
      drawOnce();
    });
    // Keep-looping toggle: off (default) = a drill plays its right-sized run once then
    // ends; on = loop it forever for open practice. Read live by finiteRunActive() each
    // frame, so toggling mid-run takes effect at the next loop seam (no restart needed).
    const klToggle = $('slopscale-keeploop-toggle');
    if (klToggle) klToggle.addEventListener('click', () => {
      keepLooping = !keepLooping;
      try { localStorage.setItem('slopscale.keepLooping', keepLooping ? '1' : '0'); } catch (_) {}
      syncKeepLoopUI();
    });
    document.querySelectorAll('.slopscale-modeview-btn').forEach(b =>
      b.addEventListener('click', () => setPanelCollapsed(b.dataset.modeview === 'play')));
    $('slopscale-focus-btn')?.addEventListener('click', toggleFocus);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    // Feel control: write the hidden swing field + bubble a change so the
    // delegated #slopscale-controls handler regenerates with the new feel.
    document.querySelectorAll('.slopscale-feel-btn').forEach(b => b.addEventListener('click', () => {
      const sw = $('slopscale-swing'); if (!sw) return;
      sw.value = b.dataset.feel; syncFeelControl();
      sw.dispatchEvent(new Event('change', { bubbles: true }));
    }));
    // Theme toggle (Light / Dark) for Tab + Notation.
    document.querySelectorAll('.slopscale-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => { setRenderTheme(btn.dataset.theme); syncThemeButtons(); });
    });
    syncThemeButtons();
    // One-time migration: an earlier bug let the bass auto-switch persist
    // 'builtin_2d' as the renderer preference, stranding 6-string guitar users
    // on the 2D highway every startup. Clear that stale value once so the 3D
    // default returns; explicit view choices made afterward still persist
    // (bass no longer writes the preference).
    try {
      if (!localStorage.getItem('slopscale.rendererMigratedV1')) {
        if (localStorage.getItem('slopscale.renderer') === 'builtin_2d') localStorage.removeItem('slopscale.renderer');
        localStorage.setItem('slopscale.rendererMigratedV1', '1');
      }
    } catch (_) {}
    // Restore last-used renderer from localStorage
    const savedRenderer = localStorage.getItem('slopscale.renderer');
    if (savedRenderer) {
      syncViewSwitcher(savedRenderer);
      const rendererSel = document.querySelector('[name="renderer"]');
      if (rendererSel) rendererSel.value = savedRenderer;
    }
    // Restore the fretboard-strip toggle (defaults on).
    try { const fb = localStorage.getItem('slopscale.fretboard'); if (fb != null) fretboardOn = fb === '1'; } catch (_) {}
    syncFretboardUI();
    // Restore the keep-looping toggle (defaults OFF = finite, right-sized runs).
    try { const kl = localStorage.getItem('slopscale.keepLooping'); if (kl != null) keepLooping = kl === '1'; } catch (_) {}
    syncKeepLoopUI();
    // The sidebar always starts expanded on plugin startup/selection (it's a
    // transient view affordance, not a saved pref) — also reset on screen:changed.
    panelCollapsed = false;
    syncPanelToggle();
    // Key or fretboardSystem change → repopulate the Shape dropdown for the
    // new (key, system) combination.
    // Position / variation stepper: ◄ / ► walk the pathway's variation axis
    // (shapes when shape-aware; otherwise the curated vary[] list). See
    // positionStep() / updatePositionStepper().
    $('slopscale-shape-prev')?.addEventListener('click', () => positionStep(-1));
    $('slopscale-shape-next')?.addEventListener('click', () => positionStep(1));
    $('slopscale-fretboard-system')?.addEventListener('change', () => { syncShapeDropdown(); syncShapeDropdownSelectionToHidden(); updatePositionStepper(); });
    $('slopscale-controls')?.querySelector('[name="key"]')?.addEventListener('change', () => { syncShapeDropdown(); syncShapeDropdownSelectionToHidden(); updatePositionStepper(); });
    $('slopscale-controls')?.querySelector('[name="scale"]')?.addEventListener('change', () => { syncShapeDropdown(); syncShapeDropdownSelectionToHidden(); updatePositionStepper(); });
    const pathwaySelect = $('slopscale-pathway');
    pathwaySelect?.addEventListener('change', () => {
      applyPathwayById(pathwaySelect.value);
      try { localStorage.setItem(PATHWAY_STORAGE_KEY, pathwaySelect.value); } catch (_) {}
      // The form-change listener above will pick up the silent field updates
      // on its own next tick, but kick a generate now so the initial pick
      // does not feel sluggish.
      if (activeBundle) onGenerate();
    });
    // Four-mode shell switcher: Pathways / Custom / Workout / Jam (data-mode tokens
    // stay guided/custom/session/jam).
    ['guided', 'custom', 'session', 'jam'].forEach(m => {
      $('slopscale-mode-' + m)?.addEventListener('click', () => selectMode(m));
    });
    $('slopscale-mode-select')?.addEventListener('change', (e) => selectMode(e.target.value));   // narrow-width fallback
    renderJamStyles();
    // Jam controls: feel toggle + the Jam action.
    document.querySelectorAll('#slopscale-jam-feel .slopscale-jam-feel-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#slopscale-jam-feel .slopscale-jam-feel-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        jamFeel = b.dataset.feel || 'straight';
      });
    });
    $('slopscale-jam-go')?.addEventListener('click', jamPlay);
    // Jam target-highlight selector (chord / guide / scale / off). Reflects the
    // persisted mode, repaints the strip live on change.
    document.querySelectorAll('#slopscale-jam-hl .slopscale-jam-hl-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.hl === jamHighlightMode);
      b.addEventListener('click', () => {
        document.querySelectorAll('#slopscale-jam-hl .slopscale-jam-hl-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        jamHighlightMode = b.dataset.hl || 'chord';
        try { localStorage.setItem('slopscale.jamHighlight', jamHighlightMode); } catch (_) {}
        drawOnce();
      });
    });
    // First-run primed START CTA — starts the selected pathway (the one lit primary).
    $('slopscale-start-cta')?.addEventListener('click', () => onPlayToggle());
    // Shell panels (M / P / [ / ?): visible buttons + the mixer's own controls.
    mixerLoad();
    $('slopscale-mixer-btn')?.addEventListener('click', () => toggleMixer());
    // The header progress chip opens P (de-dups the old view-bar Progress button).
    const progChip = $('slopscale-progress-strip');
    progChip?.addEventListener('click', () => toggleProgressSheet());
    progChip?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProgressSheet(); } });
    // Collapse is the labelled Setup/Play pill + the [ hotkey; the duplicate
    // ⟨ ⟩ icon button was removed (GUI audit B1). The [ binding lives in the
    // keydown handler; setPanelCollapsed is unchanged.
    $('slopscale-help-btn')?.addEventListener('click', () => toggleCheatSheet());
    $('slopscale-mixer-close')?.addEventListener('click', () => toggleMixer(false));
    $('slopscale-progress-close')?.addEventListener('click', () => toggleProgressSheet(false));
    // Library browse drawer (Phase 9 Slice 3): open from the timeline "+ Browse",
    // close via ▾, chip-filter, and [+ Add] a template-ref to the draft (multi-add).
    $('slopscale-library-open')?.addEventListener('click', () => toggleLibrary());
    $('slopscale-library-close')?.addEventListener('click', () => toggleLibrary(false));
    $('slopscale-library-filters')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]'); if (!chip) return;
      _libFilters[chip.dataset.filter] = chip.dataset.value;
      renderLibrary();
    });
    $('slopscale-library-body')?.addEventListener('click', (e) => {
      const add = e.target.closest('.slopscale-lib-add'); if (!add) return;
      addSegmentToDraft(add.dataset.templateId);
      const orig = add.textContent;                          // "Added ✓" flash — visual only (§5/§13), drawer stays open
      add.classList.add('added'); add.textContent = 'Added ✓';
      setTimeout(() => { add.classList.remove('added'); add.textContent = orig; }, 900);
    });
    // Starter browse drawer (Phase 9 Slice 4): the primary starter picker (the
    // dropdown is hidden). Open / close / chip-filter / Load (with replace-guard).
    $('slopscale-starters-open')?.addEventListener('click', () => toggleStarters());
    $('slopscale-starters-close')?.addEventListener('click', () => toggleStarters(false));
    $('slopscale-starters-filters')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-sfilter]'); if (!chip) return;
      _starterFilters[chip.dataset.sfilter] = chip.dataset.value;
      renderStarters();
    });
    $('slopscale-starters-body')?.addEventListener('click', (e) => {
      const load = e.target.closest('.slopscale-starter-load'); if (!load) return;
      loadStarter(load.dataset.starterId);
    });
    $('slopscale-starters-confirm')?.addEventListener('click', (e) => {
      if (e.target.closest('.slopscale-starter-confirm-yes')) loadStarter(e.target.closest('.slopscale-starter-confirm-yes').dataset.starterId, true);
      else if (e.target.closest('.slopscale-starter-confirm-no')) { _pendingStarter = null; renderStarters(); }
    });
    // "Last session" card dismiss (delegated — the sheet body is re-rendered each open).
    $('slopscale-progress-sheet-body')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="dismiss-summary"]')) { _lastEndedSession = null; renderProgressSheet(); }
    });
    $('slopscale-cheat-close')?.addEventListener('click', () => toggleCheatSheet(false));
    // Pack manager (the band-bar "+"). Open is wired on the "+" chip in
    // renderPathwayList. Close/Cancel discard the draft; Save commits + re-renders.
    $('slopscale-packs-close')?.addEventListener('click', () => togglePackManager(false));
    $('slopscale-packs-cancel')?.addEventListener('click', () => togglePackManager(false));
    $('slopscale-packs-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) togglePackManager(false); });  // scrim → cancel
    $('slopscale-packs-save')?.addEventListener('click', () => {
      if (_packsDraft) packsSave(_packsDraft);
      togglePackManager(false);
      renderPathwayList();
    });
    $('slopscale-packs-to-installed')?.addEventListener('click', () => {
      if (_packsSel && _packsSel.col === 'available') { _packInstall(_packsSel.id); _packsSel = { col: 'installed', id: _packsSel.id }; renderPackManager(); }
    });
    $('slopscale-packs-to-available')?.addEventListener('click', () => {
      if (_packsSel && _packsSel.col === 'installed') { _packUninstall(_packsSel.id); _packsSel = null; renderPackManager(); }
    });
    const _instCol = $('slopscale-packs-installed'), _availCol = $('slopscale-packs-available');
    _instCol?.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    _instCol?.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain'); if (!id || !_packsDraft) return;
      const beforeId = _packRowUnder(_instCol, e.clientY);
      if (!_packsDraft.order.includes(id)) _packInstall(id);
      _packReorder(id, beforeId);
      _packsSel = null; renderPackManager();
    });
    _availCol?.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    _availCol?.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain'); if (!id || !_packsDraft) return;
      _packUninstall(id); _packsSel = null; renderPackManager();
    });
    const mixCh = $('slopscale-mixer-channels');
    mixCh?.addEventListener('input', (ev) => {
      // Tone knob (relocated "Backing tone" / brightness) — writes the form's
      // hidden #slopscale-brightness value; the audio path reads it unchanged.
      const tk = ev.target.closest && ev.target.closest('.slopscale-mixer-toneknob');
      if (tk) {
        const bEl = $('slopscale-brightness');
        if (bEl) { bEl.value = tk.value; writeShareHash(); }
        // Re-schedule from the playhead so the new tone takes effect cleanly
        // (mirrors the per-channel instrument change below; no full regen needed).
        if (playing) {
          playAnchorChartTime = currentPracticeTime;
          playAnchorMs = performance.now() + AUDIO_LOOKAHEAD_SECONDS * 1000;
          stopAudio();
          scheduleCurrentPassAndAnchor(AUDIO_LOOKAHEAD_SECONDS);
        }
        return;
      }
      const f = ev.target.closest && ev.target.closest('.slopscale-mixer-fader'); if (!f) return;
      const k = f.dataset.k; mixerState[k].level = parseFloat(f.value);
      const val = mixCh.querySelector(`.slopscale-mixer-val[data-k="${k}"]`); if (val) val.textContent = Math.round(mixerState[k].level * 100);
      applyMixer(); mixerSave();
    });
    mixCh?.addEventListener('click', (ev) => {
      const t = ev.target.closest && ev.target.closest('.slopscale-mixer-tog'); if (!t) return;
      const k = t.dataset.k, act = t.dataset.act;
      mixerState[k][act] = !mixerState[k][act];
      t.classList.toggle('active', mixerState[k][act]);
      t.setAttribute('aria-pressed', String(mixerState[k][act]));
      applyMixer(); mixerSave();
    });
    // Per-channel instrument select (Phase C) — set the override, load the voice,
    // and (if playing) re-schedule from the playhead so it switches on WAF cleanly.
    mixCh?.addEventListener('change', async (ev) => {
      const kitSel = ev.target.closest && ev.target.closest('.slopscale-mixer-kit');
      const sel = kitSel || (ev.target.closest && ev.target.closest('.slopscale-mixer-instr')); if (!sel) return;
      if (kitSel) mixerState[sel.dataset.k].kit = sel.value || null;
      else mixerState[sel.dataset.k].instrument = sel.value || null;
      mixerSave();
      if (activeBundle) {
        await awaitVoices(activeBundle);
        if (playing) {
          playAnchorChartTime = currentPracticeTime;
          playAnchorMs = performance.now() + AUDIO_LOOKAHEAD_SECONDS * 1000;
          stopAudio();
          scheduleCurrentPassAndAnchor(AUDIO_LOOKAHEAD_SECONDS);
        }
      }
    });
    $('slopscale-mixer-dim')?.addEventListener('change', (ev) => { mixerBackingDim = ev.target.checked; applyMixer(); mixerSave(); });
    // Header Setup popover: toggle on the button, close on outside click, label tracks tuning.
    $('slopscale-setup-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleSetupPopover(); });
    $('slopscale-tuning-select')?.addEventListener('change', updateSetupButton);
    document.addEventListener('click', (e) => {
      const pop = $('slopscale-setup-popover'); if (!pop || pop.hidden) return;
      const btn = $('slopscale-setup-btn');
      if (!pop.contains(e.target) && btn && !btn.contains(e.target)) toggleSetupPopover(false);
    });
    updateSetupButton();
    // Header settings menu (⚙): toggle, items, close-on-outside-click.
    $('slopscale-settings-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleSettingsMenu(); });
    $('slopscale-settings-shortcuts')?.addEventListener('click', () => { toggleSettingsMenu(false); toggleCheatSheet(true); });
    $('slopscale-settings-host')?.addEventListener('click', () => {
      toggleSettingsMenu(false);
      try { if (window.slopsmith && typeof window.slopsmith.navigate === 'function') window.slopsmith.navigate('settings'); } catch (_) {}
    });
    // Settings prefs: accent theme · default XP mode · default count-in.
    document.querySelectorAll('#slopscale-theme-pick .slopscale-theme-swatch').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme || '')));
    document.querySelectorAll('#slopscale-xp-mode .slopscale-mini-btn').forEach(b => b.addEventListener('click', () => applyXpModeDefault(b.dataset.xp)));
    $('slopscale-countin-default')?.addEventListener('change', (e) => { try { localStorage.setItem('slopscale.countInDefault', e.target.value); } catch (_) {} applyCountInDefault(e.target.value); });
    loadSettingsPrefs();
    document.addEventListener('click', (e) => {
      const menu = $('slopscale-settings-menu'); if (!menu || menu.hidden) return;
      const btn = $('slopscale-settings-btn');
      if (!menu.contains(e.target) && btn && !btn.contains(e.target)) toggleSettingsMenu(false);
    });
    // Preset picker (Custom): load a saved preset's config into the form.
    $('slopscale-preset-picker')?.addEventListener('change', (ev) => {
      const key = ev.target.value; if (!key) return;
      const preset = window.__slopscaleFavorites && window.__slopscaleFavorites[key];
      if (preset && preset.config) { applyPathwayConfig(preset.config); if (activeBundle) onGenerate(); }
    });
    $('slopscale-launch-session')?.addEventListener('click', onLaunchSession);
    $('slopscale-workout-refresh')?.addEventListener('click', onRefreshWorkout);   // Phase 9: re-roll blocks
    $('slopscale-breathe-toggle')?.addEventListener('change', (e) => {             // inter-block break on/off
      if (_workoutDraft) _workoutDraft.interBlockBreak = e.target.checked ? 'auto' : 'off';
    });
    $('slopscale-length-preset')?.addEventListener('change', (e) => {              // opt-in session length
      if (_workoutDraft) { _workoutDraft.lengthPreset = e.target.value || null; renderWorkoutDraft(); }
    });
    $('slopscale-refresh-summary')?.addEventListener('click', e => { if (e.target.closest('.slopscale-refresh-summary-close')) clearRefreshSummary(); });
    syncSessionSummary(Object.keys(BUILT_IN_SESSIONS)[0]);

    loadPathwayFavorites();
    // Populate the Shape dropdown for the initial (key, system) before any
    // pathway runs — applyInitialPathway may set the shape value, but it
    // can't select an option that doesn't exist yet.
    syncShapeDropdown();
    syncShapeDropdownSelectionToHidden();
    applyInitialPathway();
    renderSkillTree();
    syncTransport();
    // If the URL carries a share hash, replay the snapshotted form values
    // *after* applyInitialPathway has set up the pathway-driven defaults.
    // The share state wins over the pathway defaults, but the pathway
    // dropdown's value is part of the snapshot — so the GOAL card and the
    // pathway-mode CSS stay correctly applied.
    const sharedState = readShareHash();
    if (sharedState) {
      applyFormState(sharedState);
      syncShapeDropdown();
      syncShapeDropdownSelectionToHidden();
      updatePositionStepper();
      syncInstrumentClass();
      syncAdvancedMode();
      syncChromaticVisibility();
    } else {
      resumeLastMode();   // returning user resumes their last mode; first-run stays on Pathways
    }
    syncViewSwitcher(document.querySelector('[name="renderer"]')?.value || 'highway_3d');
    window.addEventListener('storage', (ev) => { if (ev.key === 'invertHighway' || ev.key === 'lefty' || ev.key === 'renderScale') refreshForHostSettingChange(); });
    window.addEventListener('focus', refreshForHostSettingChange);
    // On window resize the renderers re-size their canvas (which clears it) but
    // don't redraw — so a paused view goes blank. Redraw after a debounce, which
    // also lands AFTER the renderers' own synchronous resize handlers. While
    // playing, the rAF loop already redraws, so this is a no-op there.
    let _resizeT = null;
    window.addEventListener('resize', () => {
      if (_resizeT) clearTimeout(_resizeT);
      _resizeT = setTimeout(() => {
        _resizeT = null;
        if (renderer && activeBundle && !playing) { try { renderer.resize && renderer.resize(); } catch (_) {} drawOnce(); }
      }, 120);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshForHostSettingChange(); });
    // Flush any in-progress session on page hide / unload so duration is saved
    // even if the user closes the tab or navigates away while the preview plays.
    const onPageHide = () => { if (playing) sessionEnd(); };
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('pagehide', onPageHide);
    syncProgressStrip();
    // Defend against blank-on-load: when the host SPA navigates to the
    // SlopScale screen, re-attach the renderer. The initial bind() may have
    // run while the screen was still hidden (host=0x0), and even the
    // ResizeObserver fallback can fire before the renderer has a stable
    // size. A re-attach when the screen becomes visible is cheap and makes
    // the initial paint reliable. (Also covers re-entry after the user
    // navigated to Library or another screen and came back.)
    if (window.slopsmith && typeof window.slopsmith.on === 'function') {
      window.slopsmith.on('screen:changed', (ev) => {
        if (ev?.detail?.id !== 'plugin-slopscale') return;
        // Sidebar always shows when the plugin is (re)selected.
        panelCollapsed = false; syncPanelToggle();
        if (lastExercise) {
          // attachRenderer re-syncs the view row to the actual renderer.
          attachRenderer(lastExercise).catch(e => console.warn('[SlopScale] re-attach on screen show failed', e));
        }
      });
    }
    // Wait until the render host has real dimensions before firing the
    // initial generate. The host may be 0x0 while the plugin screen is
    // still being laid out; if attachRenderer runs against a 0x0 canvas,
    // nothing visible draws. A double-rAF wasn't enough on its own.
    (function fireInitialGenerateWhenLaidOut() {
      const host = $('slopscale-render-host');
      if (!host || typeof ResizeObserver === 'undefined') { onGenerate(); return; }
      let fired = false;
      const fire = () => { if (fired) return; fired = true; try { ro.disconnect(); } catch (_) {} onGenerate(); };
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const w = entry.contentRect.width, h = entry.contentRect.height;
          if (w > 0 && h > 0) { fire(); return; }
        }
      });
      ro.observe(host);
      // Failsafe in case the observer never reports non-zero (e.g. plugin
      // screen mounted hidden for a long time).
      setTimeout(fire, 1000);
    })();
    return true;
  }
  function boot() { if (bind()) return; let tries = 0; const timer = setInterval(() => { tries += 1; if (bind() || tries > 40) clearInterval(timer); }, 250); }

  // A-B segment loop public API. See docs/section-looping.md for the spec.
  // No UI yet — this is the transport-layer foundation that a phase-2 UI
  // (or a sibling plugin / driver script) can drive.
  function setSegmentLoop(a, b) {
    const aNum = Number(a), bNum = Number(b);
    if (!Number.isFinite(aNum) || !Number.isFinite(bNum) || bNum <= aNum) {
      throw new Error(`setSegmentLoop: requires finite a and b with b > a (got a=${a}, b=${b})`);
    }
    const duration = activeBundle?.songInfo?.duration ?? Infinity;
    if (aNum < 0 || bNum > duration + 0.0001) {
      throw new Error(`setSegmentLoop: endpoints must lie within [0, ${duration}] (got a=${aNum}, b=${bNum})`);
    }
    segmentLoopA = aNum;
    segmentLoopB = bNum;
    // Seek the playhead to A so the next tick wraps cleanly inside the loop.
    currentPracticeTime = aNum;
    if (playing) {
      // Re-anchor the play clock and re-schedule audio from A so the listener
      // hears the loop region immediately, not silence until the next wrap.
      playAnchorChartTime = aNum;
      playAnchorMs = performance.now() + AUDIO_LOOKAHEAD_SECONDS * 1000;
      stopAudio();
      schedulePreviewAudio(activeBundle, aNum, AUDIO_LOOKAHEAD_SECONDS);
    } else {
      drawOnce();
    }
    if (window.slopsmith && typeof window.slopsmith.emit === 'function') {
      window.slopsmith.emit('slopscale:loop:set', { a: aNum, b: bNum });
    }
  }
  function clearSegmentLoop() {
    if (segmentLoopA == null && segmentLoopB == null) return;
    segmentLoopA = null;
    segmentLoopB = null;
    if (window.slopsmith && typeof window.slopsmith.emit === 'function') {
      window.slopsmith.emit('slopscale:loop:clear', {});
    }
  }
  function getSegmentLoop() { return { a: segmentLoopA, b: segmentLoopB }; }

  window.SlopScale = { generateExercise, generateSession, makeBundle, resolveRendererFactory, readConfig, setSegmentLoop, clearSegmentLoop, getSegmentLoop, STYLE_PALETTES, stylePaletteConfig, SEGMENT_TEMPLATES, SEGMENT_ROLES, rollSegment, refreshWorkout, progressLoad, progressSave, progressSetMode, advanceDepthLadder, nodeProgressState };
  if (typeof globalThis !== 'undefined' && globalThis.__SS_HARNESS__) globalThis.__ss_debug = { STRING_SETUPS, resolveCAGEDShape, resolveThreeNPSPosition, NOTE_ALIASES, chordRootForDegree, nearestPositionForPc };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();