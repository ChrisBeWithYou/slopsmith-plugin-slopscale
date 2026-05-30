// SlopScale — Slopsmith practice chart generator + renderer adapter.
(function () {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_ALIASES = { C:0, 'B#':0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, Fb:4, F:5, 'E#':5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11, Cb:11 };
  const STRING_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
  const AUDIO_LOOKAHEAD_SECONDS = 0.20;

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
  const COMMON_PROGRESSIONS = {
    diatonic:[1,2,3,4,5,6,7,1],
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
    tadd_dameron:[1, { semis:3, q:'dom7', rn:'♭III7' }, { semis:8, q:'maj7', rn:'♭VImaj7' }, { semis:1, q:'dom7', rn:'♭II7' }] // C–E♭7–A♭maj7–D♭7
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
    { id: 'pent_foundation',       x: 20, y: 27, short: 'Pentatonic' },
    { id: 'blues_foundation',      x: 20, y: 73, short: 'Blues Scale' },
    { id: 'major_pent_country',    x: 36, y: 12, short: 'Major Pent' },
    { id: 'dorian_groove',         x: 36, y: 42, short: 'Dorian' },
    { id: 'harmonic_minor_exotic', x: 36, y: 80, short: 'Harm. Minor' },
    { id: 'chord_tone_targeting',  x: 54, y: 24, short: 'Chord Tones' },
    { id: 'modal_awareness',       x: 54, y: 52, short: 'Modal Aware.' },
    { id: 'diatonic_triad_drill',  x: 54, y: 80, short: 'Triad Drill' },
    { id: 'modal_vamp',            x: 72, y: 36, short: 'Modal Vamp' },
    { id: 'seventh_vocab',         x: 72, y: 62, short: '7th Chords' },
    { id: 'sweep_arpeggio_primer', x: 72, y: 85, short: 'Sweep Arps' },
    { id: 'ii_V_I_workout',        x: 88, y: 50, short: 'ii–V–I' },
    { id: 'bend_drill',            x: 20, y: 91, short: 'Bending' },
  ];
  const SKILL_TREE_EDGES = [
    ['chromatic_warmup',    'pent_foundation'],
    ['chromatic_warmup',    'blues_foundation'],
    ['pent_foundation',     'bend_drill'],
    ['blues_foundation',    'bend_drill'],
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
  ];
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
      base:{ practiceType:'scale', scale:'blues', meter:'4/4', subdivision:'eighth', bpm:80, bars:12, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', progression:'12_bar_blues', chordDepth:'seventh', chordOverride:'min7' },
      vary:[ { key:'A', shape:'E' }, { key:'E', shape:'E' }, { key:'D', shape:'E' }, { key:'G', shape:'E' }, { key:'C', shape:'E' } ]
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
    }
  };
  const PATHWAY_STORAGE_KEY = 'slopscale.lastPathway';
  const PATHWAY_FIRST_VISIT_DEFAULT = 'pent_foundation';

  // === Practice Sessions ===
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
    }
  };

  // === CAGED + 3NPS + Open shape system ===
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
    const rootOpenPc = openPcForString(openMidis, def.rootStringIdx);
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
    const numStrings = openMidis.length;
    // Degree-driven, no-unison selection. A naive fret-window block repeats the
    // SAME pitch wherever two adjacent strings overlap (e.g. A-major A-shape:
    // B on the G string f4 and the B string f0). Per the no-unison rule, each
    // pitch may sound on only one string in the box; the lower string wins a
    // shared pitch (added first) so the box stays compact and ascending. Roots
    // in different octaves are distinct pitches and are all kept.
    const notes = [];
    const usedMidi = new Set();
    for (let s = 0; s < numStrings; s++) {
      const openPc = openPcForString(openMidis, s);
      const openMidi = openMidis[s];
      for (let f = firstFret; f <= fretMax; f++) {
        const notePc = (openPc + f) % 12;
        const degree = degreeOfPc(keyPc, notePc, scale);
        if (degree === null) continue;
        const midi = openMidi + f;
        if (usedMidi.has(midi)) continue; // unison already placed on a lower string
        usedMidi.add(midi);
        notes.push({ s, f, d: degree, isRoot: degree === 1, fg: scaleFingerFor(s, f, firstFret, true) });
      }
    }
    return {
      fretMin: Math.max(0, fretMin),
      fretMax,
      rootFret,
      rootStringIdx: def.rootStringIdx,
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
    // No-unison selection (see resolveCAGEDShape): drop a pitch already placed
    // on a lower string so open position never doubles a note across strings.
    const usedMidi = new Set();
    for (let s = 0; s < numStrings; s++) {
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
  let currentPracticeTime = 0, playAnchorMs = 0, playAnchorChartTime = 0, playing = false;
  let _activeSession = null, _sessionStartMs = 0, _newlyUnlockedTier = null;
  // Count-in: while performance.now() < countInUntilMs, the tick freezes
  // the playhead at the start position and only the count-in clicks play.
  // 0 = no count-in active.
  let countInUntilMs = 0;
  // A-B segment loop endpoints in chart-time seconds. Null = no loop.
  // See docs/section-looping.md for the design + phasing.
  let segmentLoopA = null, segmentLoopB = null;
  // Transport UI state: tpA/tpB are the user's chosen A/B loop points (either
  // may be set before the other); the committed loop lives in segmentLoopA/B.
  // _scrubbing suppresses scrubber write-back while the user drags it.
  let tpA = null, tpB = null, _scrubbing = false, _loopWraps = 0;
  // Session transport: index of the segment currently under the playhead, so
  // the highlight only touches the DOM when it actually changes.
  let _activeSegIdx = -1;
  let audioCtx = null, audioNodes = [];
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
    const makeFakeCtx = () => ({
      state: 'closed',
      currentTime: 0,
      close: () => Promise.resolve(),
      createMediaElementSource: () => {
        throw new DOMException('AudioContext already in use by SlopScale', 'InvalidStateError');
      },
    });
    const Patched = function(...args) {
      if (audioCtx && audioCtx.state !== 'closed') return makeFakeCtx();
      const ctx = new Ctor(...args);
      return ctx;
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
    let fretMin = Math.max(0, parseInt(data.get('fretMin') || '0', 10));
    let fretMax = Math.max(fretMin + 1, parseInt(data.get('fretMax') || '5', 10));
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
      const resolved = resolveCurrentShape({ fretboardSystem, key: data.get('key') || 'C', scale: data.get('scale') || 'major', shape }, setup.openMidis);
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
      customOpenMidis: (() => {
        const raw = (data.get('customOpenMidis') || '').toString().trim();
        if (!raw) return null;
        const list = raw.split(',').map(s => parseInt(s, 10)).filter(Number.isFinite);
        return list.length === setup.openMidis.length ? list : null;
      })(),
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
      chromaticPattern: data.get('chromaticPattern') || '1234',
      voices: data.get('voices') || 'thirds_only',
      keyCycle: data.get('keyCycle') || 'none',
      keyCycleLength: Math.max(2, Math.min(12, parseInt(data.get('keyCycleLength') || '4', 10))),
      bendTarget: data.get('bendTarget') || 'whole',
      audio: { notes: data.get('audioNotes') === 'on', metronome: data.get('audioMetronome') === 'on', harmony: data.get('audioHarmony') === 'on', harmonyTone: data.get('harmonyTone') || 'pad' }
    };
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
  function secondsPerDivision(cfg) { const q = 60 / cfg.bpm; return ({ quarter:q, eighth:q/2, sixteenth:q/4, triplet:q/3, eighth_triplet:q/3, sixteenth_triplet:q/6 })[cfg.subdivision] || q/2; }
  function measureSeconds(cfg) { return (60 / cfg.bpm) * (4 / cfg.meter.denominator) * cfg.meter.numerator; }
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
    // Shape templates are designed for 6-string guitar; skip for other string counts
    if (cfg.stringCount !== 6) return null;
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    const tmpl = def.chordTemplates[cagedShapeQualityKey(quality)];
    if (!tmpl) return null;
    const opens = openMidisForConfig(cfg);
    const out = [];
    for (const note of tmpl) {
      // note.s is already in low-E=0 indexing per CAGED_SHAPES convention.
      if (note.s < 0 || note.s >= cfg.stringCount) continue;
      const f = rootFret + note.fOff;
      if (f < 0 || f > 24) continue;
      const midi = opens[note.s] + f;
      out.push({ s:note.s, f, midi, pc:midi % 12, interval:note.iv });
    }
    out.sort((a, b) => a.midi - b.midi || a.s - b.s);
    return out;
  }

  function pickShapeRootFret(cfg, shape, rootPc, prevRootFret, mode) {
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    // def.rootStringIdx is already in low-E=0 indexing.
    if (def.rootStringIdx < 0 || def.rootStringIdx >= cfg.stringCount) return null;
    const opens = openMidisForConfig(cfg);
    const anchorPc = ((opens[def.rootStringIdx] % 12) + 12) % 12;
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
      case 'full_neck': return everyScalePosition(Object.assign({}, cfg, { fretMin:0, fretMax:24 }));
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
    const intervals = SCALE_INTERVALS[rootScale] || SCALE_INTERVALS.major;
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
    if (cfg.stringCount !== 6) return null;
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    const tmpl = def.chordTemplates[cagedShapeQualityKey(quality)];
    if (!tmpl) return null;
    const frets = new Array(cfg.stringCount).fill(-1);
    const fingers = new Array(cfg.stringCount).fill(-1);
    for (const ent of tmpl) {
      if (ent.s < 0 || ent.s >= cfg.stringCount) continue;
      const f = rootFret + ent.fOff;
      if (f < 0 || f > 24) return null;
      frets[ent.s] = f;
      fingers[ent.s] = f === 0 ? 0 : (ent.fg ?? 1);
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
    const upperLow = o.upperLow ?? 48, upperHigh = o.upperHigh ?? 74;
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
    let cursor = Math.max(bass + 3, upperLow);
    for (const r of upper) {
      let midi = cursor + ((((r.pc - cursor) % 12) + 12) % 12);   // lowest MIDI ≥ cursor with this pitch class
      if (midi > upperHigh) midi -= 12;
      if (!out.includes(midi)) out.push(midi);
      cursor = midi + (midi < 52 ? 3 : 2);
    }
    return out.sort((a, b) => a - b);
  }
  function voiceBackingChord(rootPc, intervals, instrument) {
    const bassWin = instrument === 'bass' ? { bassLow: 23, bassHigh: 40 } : { bassLow: 36, bassHigh: 48 };
    return voiceChord(rootPc, intervals, Object.assign({ instrument, maxVoices: 4, upperLow: 48, upperHigh: 74 }, bassWin));
  }
  function buildBackingEvents(cfg, duration) {
    const degrees = progressionDegreesForConfig(cfg);
    const slot = measureSeconds(cfg);
    const events = [];
    for (let t = 0, i = 0; t < duration - 0.001; t += slot, i++) {
      const degree = degrees[i % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
      events.push({ t:Number(t.toFixed(6)), end:Number(Math.min(duration, t + slot).toFixed(6)), name:chordName(rootPc, quality), midis:voiceBackingChord(rootPc, formula.intervals, cfg.instrument) });
    }
    return events;
  }

  function chordScalePositions(cfg, rootPc, quality) {
    const scaleName = (CHORD_FORMULAS[quality] && CHORD_FORMULAS[quality].mode) || MODE_FOR_QUALITY[quality] || 'major';
    const intervals = SCALE_INTERVALS[scaleName] || SCALE_INTERVALS.major;
    const pcs = new Set(intervals.map(i => (rootPc + i) % 12));
    const opens = openMidisForConfig(cfg), out = [];
    for (let s = 0; s < cfg.stringCount; s++) for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
      const midi = opens[s] + f, pc = midi % 12;
      if (pcs.has(pc)) out.push({ s, f, midi, pc });
    }
    return out.sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
  }

  function buildChordScaleExercise(cfg) {
    const degrees = progressionDegreesForConfig(cfg);
    const mLen = measureSeconds(cfg), step = secondsPerDivision(cfg);
    const totalBars = Math.max(1, cfg.bars), duration = totalBars * mLen;
    const notesPerBar = Math.max(1, Math.round(mLen / step));
    const strategy = cfg.chordScaleStrategy || 'mode_of_moment';
    const keyParent = strategy === 'chord_tone_emphasis' ? scalePositionsForSystem(cfg) : null;
    const notes = [], chordTemplates = [], chords = [], handShapes = [], sections = [];
    let cursor = 0;
    for (let bar = 0; bar < totalBars; bar++) {
      const degree = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride, cfg.progression);
      const positions = strategy === 'chord_tone_emphasis' ? keyParent : chordScalePositions(cfg, rootPc, quality);
      if (!positions || !positions.length) continue;
      const sequenced = applySequencePattern(positions, cfg.sequence);
      const path = directedPath(sequenced, cfg.direction, cfg.repeatCount);
      if (!path.length) continue;
      const barStart = bar * mLen;
      const name = chordName(rootPc, quality), templateId = chordTemplates.length;
      const tones = chordTonePositionsInPosition(cfg, rootPc, quality);
      const displayTones = tones.length ? tones : pickChordPositions(cfg, rootPc, quality);
      const chordPcs = new Set((CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj).intervals.map(iv => (rootPc + iv) % 12));
      chordTemplates.push(templateFromPositions(name, displayTones, cfg, false));
      chords.push({ t:Number(barStart.toFixed(6)), id:templateId, hd:false, notes:displayTones.map(p => noteDefaults({ s:p.s, f:p.f, sus:0 })) });
      handShapes.push({ chord_id:templateId, start_time:Number(barStart.toFixed(6)), end_time:Number((barStart + mLen).toFixed(6)), arp:false });
      sections.push({ name, number:templateId + 1, time:Number(barStart.toFixed(6)) });
      let startIdx = 0;
      if (strategy === 'chord_tone_emphasis') startIdx = cursor;
      else for (let k = 0; k < path.length; k++) if (path[k].pc === rootPc) { startIdx = k; break; }
      for (let i = 0; i < notesPerBar; i++) {
        const p = path[(startIdx + i) % path.length];
        const onBeat = i % Math.max(1, cfg.meter.numerator) === 0;
        const isChordTone = strategy === 'chord_tone_emphasis' && chordPcs.has(p.pc);
        notes.push(noteDefaults({ t:Number((barStart + i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.78), ac:onBeat || isChordTone }));
      }
      if (strategy === 'chord_tone_emphasis') cursor += notesPerBar;
    }
    return { notes, chords, chordTemplates, handShapes, sections:sections.length ? sections : [{ name:'chord-scales', number:1, time:0 }], duration };
  }

  function buildScaleExercise(cfg) {
    const positions = scalePositionsForSystem(cfg);
    if (!positions.length) throw new Error('No scale notes found inside this fret range.');
    const sequenced = applySequencePattern(positions, cfg.sequence);
    const step = secondsPerDivision(cfg), mLen = measureSeconds(cfg), minDuration = cfg.bars * mLen;
    const path = directedPath(sequenced, cfg.direction, cfg.repeatCount);
    const rawDuration = Math.max(minDuration, path.length * step);
    const duration = Math.ceil(rawDuration / mLen - 1e-6) * mLen;
    const totalEvents = Math.max(path.length, Math.floor(duration / step));
    const notes = [];
    for (let i = 0; i < totalEvents; i++) {
      const p = path[i % path.length];
      notes.push(noteDefaults({ t:Number((i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.78), ac:i % Math.max(1, cfg.meter.numerator) === 0 }));
    }
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections:[{ name:`scale-${cfg.fretboardSystem || 'position'}`, number:1, time:0 }], duration };
  }

  function sweepArpeggioPositions(cfg, rootPc, quality, anchorFret) {
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const intervalPcSet = new Set(formula.intervals.map(iv => (rootPc + iv) % 12));
    const opens = openMidisForConfig(cfg), out = [];
    const fLo = Math.max(0, cfg.fretMin), fHi = Math.min(24, cfg.fretMax);
    const bassStr = 0; // SlopScale: s=0 is the LOWEST string (low E) — the sweep's bass anchor
    // Greedy-adjacent selection: the bass string anchors near anchorFret (root
    // preferred); each higher string then picks the chord tone CLOSEST to the
    // previous string's fret. This keeps the shape contiguous (a real sweepable
    // grip) instead of the zig-zags an independent per-string search can produce.
    let prevFret = anchorFret;
    for (let s = 0; s < cfg.stringCount; s++) {
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
    const useShape = cfg.stringCount === 6 && !!CAGED_SHAPES[shape];
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

  // Fill the timeline with `seq`, cycling it, one note per `step`.
  // opts: { step, totalTime, sus, name, startAt=0, duration=Math.max(t,totalTime) }
  function fillNotesFromSeq(seq, opts) {
    const { step, totalTime, sus, name, startAt = 0 } = opts;
    const notes = [], sections = [{ name, number: 1, time: 0 }];
    let t = startAt, idx = 0;
    while (t < totalTime - 0.001) {
      const ev = seq[idx % seq.length];
      const note = { t: Number(t.toFixed(6)), s: ev.s, f: ev.f, sus };
      for (const k of SEQ_NOTE_FIELDS) if (ev[k] !== undefined) note[k] = ev[k];
      notes.push(noteDefaults(note));
      t += step; idx++;
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
    const asc = [];
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
      if (partner) { asc.push(lo); asc.push(partner); }
    }
    if (asc.length < 2) throw new Error(`No ${label} available in this position — widen the fret range.`);
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
    if (mode === 'octave_displacement')    return buildOctaveDisplacementExercise(cfg);
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

  function generateExercise(cfg) {
    const chart = cfg.keyCycle && cfg.keyCycle !== 'none'
      ? buildKeyCycleChart(cfg)
      : buildSingleChart(cfg);
    const duration = Math.max(chart.duration || 0, cfg.bars * measureSeconds(cfg));
    const anchors = chart.anchors && chart.anchors.length ? chart.anchors : buildAnchors(cfg, duration);
    return { version:1, session:cfg, chart:Object.assign({}, chart, { beats:buildBeats(cfg, duration), anchors, duration }) };
  }

  // Build one segment's config by merging session-level defaults, string setup,
  // and segment-level overrides. Resolves shape notes if system is shape-aware.
  function buildSegmentConfig(segment, session) {
    const stringSetup = session.stringSetup || 'guitar_6_standard';
    const setup = STRING_SETUPS[stringSetup] || STRING_SETUPS.guitar_6_standard;
    const raw = Object.assign({
      // Structural defaults
      key:'C', scale:'major', bpm:80, bars:4, direction:'up_down', sequence:'none',
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

  // Concatenate all session segments into one chart with section markers.
  // Each segment's times are offset by the cumulative duration of prior segments.
  // BPM ladder and key cycle are applied per-segment as configured.
  function buildSessionChart(session) {
    const notes = [], chords = [], chordTemplates = [], handShapes = [], sections = [], anchors = [], beats = [];
    // Per-segment time bounds — drives the session transport (progress bar,
    // segment jump, active-segment highlight, per-segment loop).
    const segmentBounds = [];
    let t = 0, tplOffset = 0;

    for (const segment of (session.segments || [])) {
      const segCfg = buildSegmentConfig(segment, session);
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
      segmentBounds.push({ name:segment.name, kind:segment.kind, start:Number(t.toFixed(6)), end:Number((t + dur).toFixed(6)) });
      t += dur;
    }
    return { notes, chords, chordTemplates, handShapes, sections, anchors, beats, segmentBounds, duration:t };
  }

  // Top-level session generator — parallel to generateExercise() for single exercises.
  // Returns the same { version, session, chart } shape so the rest of the launch
  // path (makeBundle, POST /temp-sloppak, playSong) works unchanged.
  function generateSession(session) {
    const chart = buildSessionChart(session);
    const duration = chart.duration || 0;
    // Use first segment's config for metadata
    const firstSeg = (session.segments || [])[0];
    const firstCfg = firstSeg ? buildSegmentConfig(firstSeg, session) : {};
    const anchors = chart.anchors?.length ? chart.anchors : buildAnchors(firstCfg, duration);
    const sessionMeta = Object.assign({}, firstCfg, {
      mode:'session', practiceType:'session',
      sessionName:session.name, sessionId:Object.keys(BUILT_IN_SESSIONS).find(k => BUILT_IN_SESSIONS[k] === session) || 'custom'
    });
    return { version:1, session:sessionMeta, chart:Object.assign({}, chart, { beats:chart.beats || [], anchors, duration }) };
  }

  function makeBundle(exercise) {
    const cfg = exercise.session, c = exercise.chart;
    const bundle = {
      currentTime:0,
      songInfo:{ title:`SlopScale ${cfg.mode}`, artist:'SlopScale', arrangement:cfg.instrument === 'bass' ? 'Bass' : 'Lead', tuning:tuningOffsetsForConfig(cfg), capo:0, duration:c.duration, format:'slopscale-practice', fretboardSystem:cfg.fretboardSystem },
      config:cfg,
    isReady:true, notes:c.notes, chords:c.chords, anchors:c.anchors, beats:c.beats, sections:c.sections, chordTemplates:c.chordTemplates, handShapes:c.handShapes, segmentBounds:c.segmentBounds || null,
      backingEvents:buildBackingEvents(cfg, c.duration),
      stringCount:cfg.stringCount, tuning:tuningOffsetsForConfig(cfg), openMidis:openMidisForConfig(cfg), capo:0,
      lyrics:[], toneChanges:[], toneBase:'', drumTab:null, mastery:1, hasPhraseData:false,
      inverted:readHighwayInverted(), lefty:readLefty(), renderScale:readRenderScale(), lyricsVisible:false, project:null, fretX:null,
      getNoteState:function(){return null;}, getNoteStateProvider:function(){return null;}
    };
    syncHighwaySettings(bundle);
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

  function makeBuiltin2DRenderer() {
    let canvas = null, ctx = null, W = 0, H = 0;
    const LEFT_PAD = 64, RIGHT_PAD = 28, TOP_PAD = 96, BOTTOM_PAD = 52;
    const AHEAD = 8, BEHIND = 1.5;

    function resize() {
      if (!canvas) return;
      const r = canvas.parentElement.getBoundingClientRect();
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
    const LEFT_PAD = 56, RIGHT_PAD = 20, AHEAD = 5, BEHIND = 1.5;
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
    function drawHud(bundle, now) {
      ctx.fillStyle = t.dim; ctx.font = 'italic 600 12px "Cambria","Georgia",serif';
      ctx.fillText(bundle.songInfo?.title || 'SlopScale', 12, 18);
      ctx.font = '11px "Cambria","Georgia",serif';
      ctx.fillText(`${now.toFixed(2)}s / ${(bundle.songInfo?.duration||0).toFixed(2)}s`, 12, 34);
    }
    function draw(bundle) {
      if (!ctx || !bundle) return;
      resize();
      t = getRenderTheme();
      const now = bundle.currentTime || 0, nStr = Math.max(1, bundle.stringCount || 6);
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
    const LEFT_PAD = 68, RIGHT_PAD = 24, AHEAD = 5, BEHIND = 1.5;
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
      ctx.fillStyle = t.dim; ctx.font = 'italic 600 12px "Cambria","Georgia",serif';
      ctx.fillText(bundle.songInfo?.title||'SlopScale', 8, 18);
      ctx.font = '11px "Cambria","Georgia",serif';
      ctx.fillText(`${now.toFixed(1)}s / ${(bundle.songInfo?.duration||0).toFixed(1)}s`, 8, 32);
      ctx.font = '600 10px "Cambria","Georgia",serif';
      ctx.fillText(isBass ? 'Bass Clef (8va)' : 'Treble Clef (8va)', 8, notH-6);
    }

    // ── Main draw ─────────────────────────────────────────────────────────
    function draw(bundle) {
      if (!ctx || !bundle) return;
      resize();
      t = getRenderTheme();
      const now = bundle.currentTime || 0, openMidis = bundle.openMidis || null;
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
  async function resolveRendererFactory(kind) {
    if (kind === 'builtin_2d') return { factory:makeBuiltin2DRenderer, label:'2D Highway' };
    if (kind === 'tab_2d') return { factory:makeBuiltin2DTabRenderer, label:'Tab' };
    if (kind === 'notation_2d') return { factory:makeBuiltin2DNotationRenderer, label:'Notation' };
    if (kind === 'highway_3d') {
      if (typeof window.slopsmithViz_highway_3d !== 'function') {
        try { await loadScriptOnce('slopscale-highway-3d-loader', '/api/plugins/highway_3d/screen.js'); } catch (_) {}
        // The host plugin may register its global a tick or two after the
        // script's onload fires (deferred init). Poll briefly before giving up
        // to the 2D fallback — otherwise the first render on startup shows 2D
        // while the 3D Highway tab is (correctly) selected.
        const start = Date.now();
        while (typeof window.slopsmithViz_highway_3d !== 'function' && Date.now() - start < 3000) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
      if (typeof window.slopsmithViz_highway_3d === 'function') return { factory:window.slopsmithViz_highway_3d, label:'3D Note Highway' };
      return { factory:makeBuiltin2DRenderer, label:'2D Highway (fallback)' };
    }
    return { factory:makeBuiltin2DRenderer, label:'2D Highway (default)' };
  }

  function replaceCanvas() { const host = $('slopscale-render-host'), old = $('slopscale-canvas'), canvas = document.createElement('canvas'); canvas.id = 'slopscale-canvas'; canvas.style.width = '100%'; canvas.style.height = '100%'; if (old) old.replaceWith(canvas); else host.appendChild(canvas); const rect = host.getBoundingClientRect(); canvas.width = Math.max(640, Math.round(rect.width || 1280)); canvas.height = Math.max(420, Math.round(rect.height || 720)); return canvas; }
  function stopAudio() { for (const n of audioNodes) { try { n.stop && n.stop(0); } catch {} try { n.disconnect && n.disconnect(); } catch {} } audioNodes = []; }
  function stopRenderer() { playing = false; stopAudio(); stopPitchTracker(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } if (renderer && typeof renderer.destroy === 'function') { try { renderer.destroy(); } catch (e) { console.warn('[SlopScale] renderer destroy failed', e); } } renderer = null; syncPlayButton(); }

  async function attachRenderer(exercise) {
    const cfg = exercise.session;
    // Honour saved renderer preference when the form hasn't been explicitly changed
    if (!cfg.renderer || cfg.renderer === 'highway_3d') {
      const saved = localStorage.getItem('slopscale.renderer');
      if (saved) cfg.renderer = saved;
    }
    // The host 3D highway only supports 6 strings — force 2D for bass / extended
    // range. Transient (per-render), never persisted, so it can't strand a later
    // 6-string session on 2D.
    if (cfg.renderer === 'highway_3d' && (cfg.stringCount || 6) !== 6) cfg.renderer = 'builtin_2d';
    stopRenderer(); activeBundle = makeBundle(exercise); currentPracticeTime = 0;
    const canvas = replaceCanvas(), resolved = await resolveRendererFactory(cfg.renderer);
    renderer = resolved.factory();
    if (!renderer || typeof renderer.draw !== 'function') throw new Error('Selected renderer did not return a Slopsmith-compatible renderer object.');
    if (typeof renderer.init === 'function') { renderer.init(canvas, activeBundle); if (renderer.readyPromise && typeof renderer.readyPromise.then === 'function') await renderer.readyPromise; }
    if (cfg.renderer === 'notation_2d') renderer?.setMode?.(notationMode);
    const rect = canvas.parentElement.getBoundingClientRect();
    if (typeof renderer.resize === 'function') renderer.resize(Math.round(rect.width || canvas.width), Math.round(rect.height || canvas.height));
    const rendererStatus = $('slopscale-renderer-status'); if (rendererStatus) rendererStatus.textContent = resolved.label; drawOnce();
    resetTransportLoop();
  }

  function syncPlayButton() {
    const btn = $('slopscale-play');
    if (!btn) return;
    btn.classList.toggle('is-playing', !!playing);
    btn.textContent = playing ? '■ Stop' : '▶ Play';
  }
  function drawOnce() { if (!renderer || !activeBundle) return; syncHighwaySettings(activeBundle); activeBundle.currentTime = currentPracticeTime; renderer.draw(activeBundle); syncTransportTime(); }
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
      // Hold the playhead frozen at the start position during count-in.
      // Click sounds were already scheduled in startPlayback; the visible
      // chart only starts moving once the count-in window closes.
      if (countInUntilMs && nowMs < countInUntilMs) {
        drawOnce(); rafId = requestAnimationFrame(tick); return;
      }
      if (countInUntilMs && nowMs >= countInUntilMs) {
        countInUntilMs = 0;
        playAnchorMs = nowMs;  // chart clock starts now
      }
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
      } else if (currentPracticeTime > duration) {
        currentPracticeTime = 0; playAnchorChartTime = 0; playAnchorMs = nowMs + AUDIO_LOOKAHEAD_SECONDS * 1000; stopAudio(); schedulePreviewAudio(activeBundle, currentPracticeTime, AUDIO_LOOKAHEAD_SECONDS);
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
    preGain.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc1.start(when); osc2.start(when);
    const stopAt = when + Math.max(0.14, dur) + 0.03;
    osc1.stop(stopAt); osc2.stop(stopAt);
    audioNodes.push(osc1, osc2, preGain, filter, gain);
  }
  function scheduleHarmonyPad(ctx, when, midis, dur, instrument, tone) {
    if (!midis.length) return;
    tone = tone || 'pad';

    if (tone === 'organ') {
      // Hammond drawbar simulation — additive sines, instant on/off, flat envelope
      const RATIOS = [1, 2, 3, 4, 5, 6, 8];
      const VOLS   = [0.8, 0.5, 0.35, 0.25, 0.18, 0.12, 0.08];
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.13 / Math.max(1, midis.length), when);
      master.connect(ctx.destination);
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
      master.connect(ctx.destination);
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

    // pad (default) — triangle+sawtooth mix, lowpass, slow attack/release
    const master = ctx.createGain(), filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(instrument === 'bass' ? 1150 : 1900, when); filter.Q.setValueAtTime(0.7, when);
    master.gain.setValueAtTime(0.0001, when); master.gain.exponentialRampToValueAtTime(0.24, when + 0.012); master.gain.linearRampToValueAtTime(0.18, when + Math.max(0.08, dur - 0.16)); master.gain.linearRampToValueAtTime(0.0001, when + dur);
    filter.connect(master); master.connect(ctx.destination);
    audioNodes.push(filter, master);
    midis.slice(0, 5).forEach((midi, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(midi), when);
      osc.detune.setValueAtTime((i - 2) * 3, when);
      g.gain.setValueAtTime(i === 0 ? 0.48 : 0.22, when);
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
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination); osc.start(when); osc.stop(when + 0.07); audioNodes.push(osc, filter, gain);
  }
  function schedulePreviewAudio(bundle, fromTime, delaySeconds) {
    const cfg = readConfig();
    // Prefer the bundle's own audio settings (sessions patch their own config)
    // so the session's checkboxes are honoured rather than the single-exercise ones.
    const audio = bundle.config?.audio || cfg.audio;
    if (!audio.notes && !audio.metronome && !audio.harmony) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const ctx = audioCtx, base = ctx.currentTime + (Number.isFinite(delaySeconds) ? delaySeconds : AUDIO_LOOKAHEAD_SECONDS), startFrom = fromTime || 0;
    // Use the bundle's own openMidis so note frequencies always match what was
    // generated — prevents pitch mismatch when the form's string setup differs
    // from the exercise (e.g. session generated with 6-string, form shows 8-string).
    const opens = (bundle.openMidis && bundle.openMidis.length) ? bundle.openMidis : openMidisForConfig(cfg);
    const instrument = bundle.config?.instrument || cfg.instrument;
    const duration = bundle.songInfo?.duration || 0;
    if (audio.harmony) for (const ev of bundle.backingEvents || []) {
      if (ev.end < startFrom || ev.t > duration + 0.1) continue;
      const start = Math.max(ev.t, startFrom), end = Math.min(ev.end, duration);
      scheduleHarmonyPad(ctx, base + (start - startFrom), ev.midis || [], Math.max(0.2, end - start), instrument, audio.harmonyTone || 'pad');
    }
    if (audio.notes) for (const n of bundle.notes || []) {
      if (n.t < startFrom || n.t > duration + 0.1) continue;
      if (n.s < 0 || n.s >= opens.length || n.f < 0) continue;
      schedulePluckedString(ctx, base + (n.t - startFrom), midiToFreq(opens[n.s] + n.f), Math.max(0.10, Math.min(0.85, n.sus || 0.24)), instrument, audio.harmony ? 0.9 : 1.25, bendSemitones(n.bn));
    }
    if (audio.metronome) {
      const beats = bundle.beats || [];
      const perBeat = Math.max(1, cfg.clickSubdiv || 1);
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        if (b.time < startFrom || b.time > duration + 0.1) continue;
        // Strong accent on measure downbeats and grouping starts (e.g. 7/8 as
        // 3+2+2), matching the count-in. Beats are already meter-correct (built
        // by buildBeats), so this follows the time-signature selection.
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
  }
  function startPlayback() {
    if (!activeBundle) return;
    sessionEnd(); // flush any in-progress session before starting a new one
    sessionBegin();
    stopAudio(); syncHighwaySettings(activeBundle);
    playing = true;
    playAnchorChartTime = currentPracticeTime;
    // Count-in: optionally play N bars of metronome clicks before the chart
    // starts. The clicks scheduling is shifted to use ctx.currentTime as
    // its base; the chart audio is offset by the count-in duration so the
    // first chart note lands exactly when the last count-in click does.
    const cfg = readConfig();
    const measureSec = measureSeconds(cfg);
    const countInSec = (cfg.countInBars || 0) * measureSec;
    const startMs = performance.now();
    playAnchorMs = startMs + (countInSec + AUDIO_LOOKAHEAD_SECONDS) * 1000;
    countInUntilMs = countInSec > 0 ? startMs + countInSec * 1000 : 0;
    if (countInSec > 0) scheduleCountInClicks(cfg, countInSec);
    schedulePreviewAudio(activeBundle, currentPracticeTime, AUDIO_LOOKAHEAD_SECONDS + countInSec);
    if (!rafId) rafId = requestAnimationFrame(tick);
    startPitchTracker(activeBundle); syncPlayButton(); refreshStatusFromState();
  }
  // Schedule N bars of metronome clicks before chart playback starts.
  // First click of each bar is the accented one. Reuses the same
  // scheduleClick helper as the in-chart metronome track.
  function scheduleCountInClicks(cfg, countInSec) {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const ctx = audioCtx;
    const base = ctx.currentTime + AUDIO_LOOKAHEAD_SECONDS;
    const m = cfg.meter;
    // One metric beat = one denominator note-value (an eighth in x/8, a quarter
    // in x/4), so the count-in matches the meter selection — 7/8 counts 7 beats,
    // not 7 quarters. perBeat soft ticks subdivide each beat (count-in feel).
    const beatSec = (60 / cfg.bpm) * (4 / m.denominator);
    const perBeat = Math.max(1, cfg.clickSubdiv || 1);
    const tickSec = beatSec / perBeat;
    const beatsPerBar = m.numerator;
    // Strong accent on the first beat of each grouping (e.g. 7/8 as 3+2+2) so
    // the count-in actually feels like the meter, not a flat 7.
    const groupStarts = new Set();
    let acc = 0;
    for (const g of m.grouping) { groupStarts.add(acc); acc += g; }
    const totalTicks = (cfg.countInBars || 0) * beatsPerBar * perBeat;
    for (let i = 0; i < totalTicks; i++) {
      const when = base + i * tickSec;
      if (when - ctx.currentTime > countInSec + 0.2) break;
      const onBeat = (i % perBeat) === 0;
      const beatIdx = Math.floor(i / perBeat) % beatsPerBar;
      const groupAccent = onBeat && groupStarts.has(beatIdx);
      scheduleClick(ctx, when, groupAccent, !onBeat);
    }
  }
  function stopPlayback() { sessionEnd(); playing = false; currentPracticeTime = 0; playAnchorChartTime = 0; countInUntilMs = 0; stopAudio(); stopPitchTracker(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } drawOnce(); syncPlayButton(); refreshStatusFromState(); }
  // Toggle for the primary Play/Stop button. If we don't have a chart yet,
  // generate one first so the very first click always plays something.
  async function onPlayToggle() {
    if (playing) { stopPlayback(); return; }
    // In session mode, Play builds + starts the selected session if one isn't
    // already loaded; otherwise it replays the built session from the playhead.
    if ($('slopscale-root')?.classList.contains('slopscale-session-mode')) {
      if (!activeBundle || activeBundle.config?.mode !== 'session') { await onLaunchSession(); return; }
      startPlayback();
      return;
    }
    if (!activeBundle) { await onGenerate(); }
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
    countInUntilMs = 0; // a manual seek cancels any pending count-in freeze
    if (playing) {
      playAnchorChartTime = currentPracticeTime;
      playAnchorMs = performance.now() + AUDIO_LOOKAHEAD_SECONDS * 1000;
      stopAudio();
      schedulePreviewAudio(activeBundle, currentPracticeTime, AUDIO_LOOKAHEAD_SECONDS);
    } else {
      drawOnce();
    }
    syncTransportTime();
  }

  // Per-frame light sync: scrubber position + current-time readout.
  function syncTransportTime() {
    const cur = $('slopscale-time-cur');
    if (cur) cur.textContent = fmtTime(currentPracticeTime);
    const scrub = $('slopscale-scrub');
    if (scrub && !_scrubbing) scrub.value = String(currentPracticeTime);
    updateActiveSegment();
  }

  // Full transport refresh: scrubber range, duration readout, loop region +
  // button states, loop counter, and the count-in segmented control. Called on
  // bundle change, loop change, and mode change — not every frame.
  function syncTransport() {
    const dur = activeBundle?.songInfo?.duration || 0;
    const scrub = $('slopscale-scrub');
    if (scrub) {
      scrub.max = String(dur);
      scrub.disabled = !activeBundle;
      if (!_scrubbing) scrub.value = String(Math.min(currentPracticeTime, dur));
    }
    const durEl = $('slopscale-time-dur'); if (durEl) durEl.textContent = fmtTime(dur);
    syncTransportTime();
    paintLoopRegion();
    $('slopscale-loop-a')?.classList.toggle('active', tpA != null);
    $('slopscale-loop-b')?.classList.toggle('active', tpB != null);
    const lc = $('slopscale-loop-count');
    if (lc) { const active = segmentLoopA != null && segmentLoopB != null; lc.hidden = !active; lc.textContent = 'Loop ' + _loopWraps; }
    const ci = document.querySelector('#slopscale-controls [name="countIn"]')?.value || '0';
    document.querySelectorAll('.slopscale-tp-seg').forEach(b => b.classList.toggle('active', b.dataset.countin === ci));
    renderSessionProgress();
    _activeSegIdx = -1; updateActiveSegment();
  }

  // Paint the loop region onto BOTH the scrubber overlay and the drag lane,
  // and flag the lane so its "drag to set" hint hides while a loop exists.
  function paintLoopRegion() {
    const dur = activeBundle?.songInfo?.duration || 0;
    const active = tpA != null && tpB != null && dur > 0 && Math.abs(tpA - tpB) > 0.02;
    const a = active ? Math.min(tpA, tpB) : 0, b = active ? Math.max(tpA, tpB) : 0;
    const leftPct = dur ? (a / dur * 100) : 0, widthPct = dur ? ((b - a) / dur * 100) : 0;
    for (const id of ['slopscale-loop-region', 'slopscale-loop-lane-region']) {
      const el = $(id); if (!el) continue;
      el.hidden = !active;
      if (active) { el.style.left = leftPct + '%'; el.style.width = widthPct + '%'; }
    }
    $('slopscale-loop-lane')?.classList.toggle('has-loop', active);
  }

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
      case 'ArrowLeft':  e.preventDefault(); nudgeBar(-1); break;
      case 'ArrowRight': e.preventDefault(); nudgeBar(1); break;
      case '[':          e.preventDefault(); tpA = currentPracticeTime; commitLoop(); break;
      case ']':          e.preventDefault(); tpB = currentPracticeTime; commitLoop(); break;
      case '\\':         e.preventDefault(); resetTransportLoop(); break;
      case 'Home':       e.preventDefault(); seekTo(0); break;
      case ',':          if (sessionMode) { e.preventDefault(); prevSegment(); } break;
      case '.':          if (sessionMode) { e.preventDefault(); nextSegment(); } break;
      default: return;
    }
  }

  function summarize(exercise) {
    const cfg = exercise.session, c = exercise.chart, meter = `${cfg.meter.numerator}/${cfg.meter.denominator}`;
    const backingCount = buildBackingEvents(cfg, c.duration).length;
    return [
      `Practice type: ${cfg.mode}`,
      ...(cfg.mode === 'chromatic' ? [`Chromatic pattern: ${CHROMATIC_PATTERN_LABELS[cfg.chromaticPattern] || cfg.chromaticPattern}`] : []),
      `Advanced controls: ${cfg.advancedMode ? 'on' : 'off'}`,
      `Fretboard system: ${fretboardSystemLabel(cfg.fretboardSystem)}`,
      ...(cfg.shapeDisplayName ? [`Shape: ${cfg.shapeDisplayName} (frets ${cfg.fretMin}-${cfg.fretMax})`] : []),
      `Direction/repeats: ${cfg.direction}, ${cfg.repeatCount}x`,
      ...(cfg.sequence && cfg.sequence !== 'none' ? [`Sequence: ${SEQUENCE_LABELS[cfg.sequence] || cfg.sequence}`] : []),
      `Pattern: ${cfg.mode === 'chromatic' ? (CHROMATIC_PATTERN_LABELS[cfg.chromaticPattern] || cfg.chromaticPattern) : cfg.mode === 'scale' ? fretboardSystemLabel(cfg.fretboardSystem) : 'full chord-tone arpeggios across one position'}`,
      `Instrument: ${cfg.setupLabel}`,
      `Highway inverted: ${readHighwayInverted() ? 'on' : 'off'}`,
      `Key/scale: ${cfg.key} ${cfg.scale}${cfg.mode === 'chord_scales' ? ` (chord-scale: ${(cfg.chordScaleStrategy || 'mode_of_moment').replace(/_/g, ' ')})` : ''}`,
      `BPM/meter/division: ${cfg.bpm} BPM, ${meter}, ${cfg.subdivision}`,
      `Position: frets ${cfg.fretMin}-${cfg.fretMax}`,
      `Audio: notes ${cfg.audio.notes ? 'on' : 'off'}, metronome ${cfg.audio.metronome ? 'on' : 'off'}, harmony ${cfg.audio.harmony ? 'on' : 'off'} (${backingCount} backing chords)`,
      `Generated: ${c.notes.length} notes, ${c.chords.length} visible chords, ${c.chordTemplates.length} templates, ${c.handShapes.length} hand shapes, ${c.beats.length} beats, ${Math.round(c.duration / measureSeconds(cfg))} bars`,
      `Duration: ${c.duration.toFixed(2)}s`
    ].join('\n');
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
      const exercise = generateExercise(readConfig());
      lastExercise = exercise;
      summary.textContent = summarize(exercise);
      await attachRenderer(exercise);
      refreshStatusFromState();
    } catch (e) {
      showStatus('Error');
      summary.textContent = `Error: ${e.message || e}`;
      console.error('[SlopScale] generate failed', e);
    }
  }
  async function savePreset() {
    const cfg = readConfig(), name = `${cfg.key} ${cfg.scale} ${cfg.setupLabel} ${cfg.mode}`, id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const res = await fetch('/api/plugins/slopscale/presets', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ id, name, kind:cfg.mode, config:cfg }) });
    if (!res.ok) throw new Error(await res.text());
    $('slopscale-summary').textContent += `\n\nSaved preset: ${name}`;
  }
  function syncStringSetupControls() { const instrument = document.querySelector('[name="instrument"]'), setup = document.querySelector('[name="stringSetup"]'); if (!instrument || !setup) return; const current = STRING_SETUPS[setup.value] || STRING_SETUPS.guitar_6_standard; instrument.value = current.instrument; }
  // CAGED/3NPS shape concepts are guitar-only — hide them when bass is active.
  // Also switch the renderer to 2D Highway since the host's 3D Highway plugin
  // throws on non-6-string string counts.
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
    // Bending is a guitar-only technique (and has no bass backing) — remove it
    // from the Custom practice-type list on bass, and switch off it if selected.
    const ptSel = document.querySelector('[name="practiceType"]');
    if (ptSel) {
      const bendOpt = ptSel.querySelector('option[value="bending"]');
      if (bendOpt) { bendOpt.hidden = isBass; bendOpt.disabled = isBass; }
      if (isBass && ptSel.value === 'bending') { ptSel.value = 'scale'; ptSel.dispatchEvent(new Event('change', { bubbles: true })); }
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
      // The host 3D highway only supports 6 strings, so show 2D on bass — but
      // do NOT persist it. attachRenderer forces 2D at render time for any
      // non-6-string chart; writing localStorage here used to strand 6-string
      // guitar sessions on 2D afterwards.
      const rendererSel = document.querySelector('[name="renderer"]');
      if ((rendererSel?.value || 'highway_3d') === 'highway_3d') {
        if (rendererSel) rendererSel.value = 'builtin_2d';
        syncViewSwitcher('builtin_2d');
      }
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
    // Re-label the next-variation button so it stops claiming "E-shape" on
    // bass (it cycles through pathway variations, which on bass aren't
    // shape-defined). updateShapeButton() picks the right label based on the
    // active fretboard system (forced to 'position' above for bass).
    updateShapeButton();
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

  // The unified mode bar (Guided / Custom / Session) is a view of two root
  // classes: session-mode wins; otherwise pathway-mode ⇒ Guided, else Custom.
  function syncModeBar() {
    const root = $('slopscale-root'); if (!root) return;
    const mode = root.classList.contains('slopscale-session-mode') ? 'session'
      : root.classList.contains('slopscale-pathway-mode') ? 'guided' : 'custom';
    document.querySelectorAll('.slopscale-mode-bar .slopscale-mode-btn').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
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
    if (mode === 'session') {
      syncSessionMode('session');
      const s = $('slopscale-session-select');
      if (s) syncSessionSummary(s.value);
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
    const ignore = new Set(['pathway', 'shape', 'fretboardSystem', 'fretMin', 'fretMax', 'key', 'bpm', 'audioNotes', 'audioMetronome', 'audioHarmony', 'harmonyTone']);
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
    const pw = PATHWAYS[id];
    if (pw && pw.base) {
      const vary = pw.vary && pw.vary.length ? pw.vary : [{}];
      const len = vary.length;
      const idx = variationIdx != null
        ? ((variationIdx % len) + len) % len
        : Math.floor(Math.random() * len);
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
      updateShapeButton();
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

  // Updates the "Next shape" button text to show the active shape and its
  // position in the current key's cycle, e.g. "E-shape (4/5) →".
  function updateShapeButton() {
    const btn = $('slopscale-next-variation');
    if (!btn) return;
    const sysEl = $('slopscale-fretboard-system');
    const shapeEl = $('slopscale-shape');
    const keyEl = $('slopscale-controls')?.querySelector('[name="key"]');
    const scaleEl = $('slopscale-controls')?.querySelector('[name="scale"]');
    const system = sysEl ? sysEl.value : 'caged';
    if (!isShapeAwareSystem(system) || !shapeEl || !keyEl) {
      btn.textContent = 'Next variation';
      return;
    }
    const keyPc = NOTE_ALIASES[keyEl.value] ?? 0;
    const scale = scaleEl ? scaleEl.value : 'major';
    const openMidis = STRING_SETUPS.guitar_6_standard.openMidis;
    const current = system === '3nps' ? parseInt(shapeEl.value, 10) : shapeEl.value;
    const order = shapeOrderForKey(keyPc, system, scale, openMidis);
    const idx = order.indexOf(current);
    if (idx === -1) { btn.textContent = 'Next shape'; return; }
    const pos = idx + 1;
    const total = order.length;
    let shapeName;
    if (system === '3nps') {
      const def = THREE_NPS_POSITION_DEFS[current];
      shapeName = def ? def.mode : `Pos ${current}`;
    } else {
      const def = CAGED_SHAPES[current];
      shapeName = def ? def.displayName : current;
    }
    btn.textContent = `${shapeName} (${pos}/${total}) →`;
  }

  function rotateToNextVariation() {
    // Per design (docs/position-system-rework.md): Next Variation cycles
    // through shapes within the current key, in the cyclic order of the
    // current system (e.g., for CAGED in C major: C → A → G → E → D → C).
    if (!activePathwayId || activePathwayId === 'custom') return;
    const sysEl = $('slopscale-fretboard-system');
    const shapeEl = $('slopscale-shape');
    const keyEl = $('slopscale-controls')?.querySelector('[name="key"]');
    const scaleEl = $('slopscale-controls')?.querySelector('[name="scale"]');
    const system = sysEl ? sysEl.value : 'caged';
    if (isShapeAwareSystem(system) && shapeEl && keyEl) {
      const keyPc = NOTE_ALIASES[keyEl.value] ?? 0;
      const scale = scaleEl ? scaleEl.value : 'major';
      const openMidis = STRING_SETUPS.guitar_6_standard.openMidis;
      const current = system === '3nps' ? parseInt(shapeEl.value, 10) : shapeEl.value;
      const next = nextShapeInCycle(keyPc, system, current, scale, openMidis);
      if (next != null) {
        shapeEl.value = String(next);
        syncShapeDropdownSelectionToHidden();
        updateShapeButton();
        onGenerate();
        return;
      }
    }
    // Fallback for non-shape-aware systems: keep the old per-pathway variation rotation.
    const pw = PATHWAYS[activePathwayId];
    if (!pw || !pw.vary || !pw.vary.length) return;
    const nextIdx = (activePathwayVariationIdx + 1) % pw.vary.length;
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

  function refreshForHostSettingChange() { if (!activeBundle) return; syncHighwaySettings(activeBundle); drawOnce(); const summary = $('slopscale-summary'); if (summary && summary.textContent.includes('Highway inverted:')) summary.textContent = summarize({ session:readConfig(), chart:{ notes:activeBundle.notes || [], chords:activeBundle.chords || [], chordTemplates:activeBundle.chordTemplates || [], handShapes:activeBundle.handShapes || [], beats:activeBundle.beats || [], duration:activeBundle.songInfo?.duration || 0 } }); }

  function syncTempoTierButtons() {
    const container = $('slopscale-tier-buttons');
    if (!container) return;
    container.innerHTML = '';
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
      btn.innerHTML = `<span class="tier-name">${TIER_LABELS[i] || `T${i+1}`}</span><span class="tier-bpm">${bpm} BPM</span>`;
      btn.addEventListener('click', () => {
        activeTempoTierIdx = i;
        setFieldSilent('bpm', String(bpm));
        syncTempoTierButtons();
        onGenerate();
      });
      container.appendChild(btn);
    });
  }

  function renderSkillTree() {
    const container = $('slopscale-skill-tree');
    if (!container) return;
    const ptData = pathwayTiersLoad();
    // Bending is a guitar technique — hide its node (and any edges to it) on bass.
    const setup = document.querySelector('[name="stringSetup"]');
    const isBass = setup && (STRING_SETUPS[setup.value] || {}).instrument === 'bass';
    const hiddenNode = id => isBass && id === 'bend_drill';
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
    _ptHandle = window.slopsmithMinigames.scoring.createContinuous({ smoothingMs: 40 });
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

  function sessionBegin() {
    const isSessionMode = $('slopscale-root')?.classList.contains('slopscale-session-mode');
    let mode, pathway_id, bpm, bpm_tier, scale, key, practice_type;

    if (isSessionMode) {
      mode = 'session';
      pathway_id = $('slopscale-session-select')?.value || null;
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
    _activeSession = null;
    if (unlock) { _newlyUnlockedTier = unlock.tier; syncTempoTierButtons(); renderSkillTree(); _newlyUnlockedTier = null; }
    syncProgressStrip();
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
    const color = KIND_COLORS[seg.kind] || '#94a3b8';
    const label = KIND_LABELS[seg.kind] || seg.kind;
    const dur = segmentEstDuration(seg);
    const durStr = dur < 60 ? `~${Math.round(dur)}s` : `~${Math.floor(dur / 60)}m${Math.round(dur % 60)}s`;
    const cfg = seg.config || {};
    const parts = [];
    if (seg.kind === 'chromatic') {
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
      parts.push(cfg.chordScaleStrategy === 'chord_tone_emphasis' ? 'chord tones' : 'mode of moment');
    }
    if (cfg.bpm) parts.push(`${cfg.bpm} BPM`);
    if (cfg.bars) parts.push(`${cfg.bars} bars`);
    parts.push(durStr);
    return `<div class="slopscale-segment-card" data-kind="${seg.kind}" data-seg-index="${index}" title="Jump to this segment">
      <div class="slopscale-segment-header">
        <span class="slopscale-segment-badge" style="color:${color}">${label}</span>
        <span class="slopscale-segment-name">${seg.name || ''}</span>
      </div>
      <div class="slopscale-segment-meta">${parts.join(' · ')}</div>
    </div>`;
  }

  function syncSessionSummary(sessionId) {
    const session = BUILT_IN_SESSIONS[sessionId];
    const info = $('slopscale-session-info'), list = $('slopscale-segment-list');
    if (!info || !list) return;
    if (!session) { info.innerHTML = ''; list.innerHTML = ''; return; }
    const segs = session.segments || [];
    const totalDur = segs.reduce((s, seg) => s + segmentEstDuration(seg), 0);
    const bpms = segs.map(s => s.config?.bpm).filter(Boolean);
    const minBpm = Math.min(...bpms), maxBpm = Math.max(...bpms);
    const bpmStr = minBpm === maxBpm ? `${minBpm} BPM` : `${minBpm}–${maxBpm} BPM`;
    const durStr = totalDur < 60 ? `${Math.round(totalDur)}s` : `${Math.floor(totalDur / 60)}m ${Math.round(totalDur % 60)}s`;
    const tags = (session.tags || []).join(', ');
    info.innerHTML = `
      <div class="slopscale-session-info-name">${session.name}</div>
      <div class="slopscale-session-info-desc">${session.description || ''}</div>
      <div class="slopscale-session-info-stats">
        <span class="slopscale-session-info-stat">${segs.length} segments</span>
        <span class="slopscale-session-info-stat">${durStr}</span>
        <span class="slopscale-session-info-stat">${bpmStr}</span>
        ${tags ? `<span class="slopscale-session-info-stat">${tags}</span>` : ''}
      </div>`;
    list.innerHTML = segs.map((s, i) => buildSegmentCard(s, i)).join('');
  }

  function syncSessionMode(mode) {
    const root = $('slopscale-root'); if (!root) return;
    root.classList.toggle('slopscale-session-mode', mode === 'session');
    syncModeBar();
  }

  async function onLaunchSession() {
    const sel = $('slopscale-session-select');
    const sessionId = sel?.value || Object.keys(BUILT_IN_SESSIONS)[0];
    const baseSession = BUILT_IN_SESSIONS[sessionId];
    if (!baseSession) return;
    const btn = $('slopscale-launch-session');
    const summary = $('slopscale-summary');
    const audio = {
      notes:      !!document.getElementById('slopscale-session-audio-notes')?.checked,
      metronome:  !!document.getElementById('slopscale-session-audio-metronome')?.checked,
      harmony:    !!document.getElementById('slopscale-session-audio-harmony')?.checked,
      harmonyTone: document.getElementById('slopscale-session-audio-harmony-tone')?.value || 'pad',
    };
    // Pre-warm the AudioContext while still in the button-click user-gesture context
    // (before any await). Without this, new AudioContext() created inside the
    // async continuation below may start in 'suspended' state on some hosts,
    // causing notes scheduled with the frozen currentTime to fire in the past.
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    // Read current string setup from the form so sessions respect the user's
    // string-count selection (built-in sessions default to guitar_6_standard
    // but should use whatever the form has active).
    const formStringSetup = document.querySelector('[name="stringSetup"]')?.value || null;
    // Clone session; patch audio + string setup into each segment config
    const session = Object.assign({}, baseSession, {
      ...(formStringSetup ? { stringSetup: formStringSetup } : {}),
      segments: baseSession.segments.map(seg =>
        Object.assign({}, seg, { config: Object.assign({}, seg.config, { audio }) })
      )
    });
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
      if (playing) stopPlayback();
      showStatus('Building session…');
      const exercise = generateSession(session);
      lastExercise = exercise;
      const totalSecs = exercise.chart.duration.toFixed(1);
      if (summary) summary.textContent = `Session: ${session.name}\n${session.segments.length} segments · ${totalSecs}s total\nGenerated: ${exercise.chart.notes.length} notes, ${exercise.chart.beats.length} beats`;
      await attachRenderer(exercise);
      startPlayback();
      refreshStatusFromState();
    } catch (e) {
      showStatus('Error');
      if (summary) summary.textContent = `Session error: ${e.message || e}`;
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
    if (root) root.classList.toggle('slopscale-theme-renderer', kind === 'tab_2d' || kind === 'notation_2d');
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
      // Refresh the summary so any prior error text from a failed attach
      // doesn't stick around once a switch succeeds.
      if (summary) summary.textContent = summarize(lastExercise);
    } catch (e) {
      console.error('[SlopScale] renderer switch failed', e);
      // Auto-fall back to 2D Highway, which is in-tree and handles any
      // string count. Without this, a 3D-Highway failure leaves the user
      // staring at a stuck error with no obvious way out.
      if (kind !== 'builtin_2d') {
        if (summary) summary.textContent = `${kind} unavailable — falling back to 2D Highway.\n(${e.message || e})`;
        try {
          syncViewSwitcher('builtin_2d');
          lastExercise.session.renderer = 'builtin_2d';
          await attachRenderer(lastExercise);
          if (summary) summary.textContent = summarize(lastExercise);
        } catch (e2) {
          console.error('[SlopScale] fallback to 2D Highway failed', e2);
          if (summary) summary.textContent = `Renderer failed: ${e2.message || e2}`;
        }
      } else if (summary) {
        summary.textContent = `Renderer failed: ${e.message || e}`;
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
    form.querySelectorAll('input[type="checkbox"][name]').forEach(cb => {
      if (!(cb.name in out)) out[cb.name] = cb.checked ? 'on' : '';
    });
    return out;
  }
  function applyFormState(state) {
    const form = $('slopscale-controls'); if (!form || !state || typeof state !== 'object') return;
    for (const [name, value] of Object.entries(state)) {
      const field = form.querySelector(`[name="${name}"]`);
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

  function bind() {
    const root = $('slopscale-root'); if (!root || root.dataset.slopscaleInit === '1') return false; root.dataset.slopscaleInit = '1';
    const instrument = document.querySelector('[name="instrument"]'), setup = document.querySelector('[name="stringSetup"]'), advancedToggle = $('slopscale-advanced-toggle');
    instrument?.addEventListener('change', () => {
      if (!setup) return;
      setup.value = instrument.value === 'bass' ? 'bass_4_standard' : 'guitar_6_standard';
      syncInstrumentClass();
      if (activeBundle) onGenerate();
    });
    setup?.addEventListener('change', () => { syncStringSetupControls(); syncInstrumentClass(); syncStringCountChips(); syncTuningOptions(); });
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
    // Transport: scrubber, A/B loop, count-in segmented, back-to-start.
    const scrub = $('slopscale-scrub');
    if (scrub) {
      scrub.addEventListener('input', () => { _scrubbing = true; seekTo(scrub.value); });
      const endScrub = () => { _scrubbing = false; };
      scrub.addEventListener('change', endScrub);
      scrub.addEventListener('pointerup', endScrub);
      scrub.addEventListener('pointercancel', endScrub);
    }
    // DAW-style drag-loop lane. Drag empty lane = paint a new loop; drag an edge
    // handle = resize; drag the region body = move. Snaps to bar lines (Alt =
    // free). A click with no drag leaves any existing loop untouched. All paths
    // feed the same tpA/tpB + commitLoop() the A/B buttons use — one loop system.
    const lane = $('slopscale-loop-lane');
    if (lane) {
      let mode = null, anchorT = 0, startTpA = 0, startTpB = 0, prevA = null, prevB = null;
      const timeAt = (clientX) => {
        const r = lane.getBoundingClientRect();
        const dur = activeBundle?.songInfo?.duration || 0;
        return Math.max(0, Math.min(dur, (clientX - r.left) / Math.max(1, r.width) * dur));
      };
      lane.addEventListener('pointerdown', (e) => {
        if (!activeBundle) return;
        e.preventDefault();
        try { lane.setPointerCapture(e.pointerId); } catch (_) {}
        prevA = tpA; prevB = tpB;
        const handle = e.target.closest('.slopscale-loop-handle');
        const onRegion = e.target.closest('.slopscale-loop-lane-region');
        if (handle) {
          mode = handle.dataset.edge === 'a' ? 'resizeA' : 'resizeB';
        } else if (onRegion && tpA != null && tpB != null) {
          mode = 'move'; anchorT = timeAt(e.clientX); startTpA = Math.min(tpA, tpB); startTpB = Math.max(tpA, tpB);
        } else {
          mode = 'new'; anchorT = snapToDownbeat(timeAt(e.clientX), e.altKey); tpA = anchorT; tpB = anchorT; paintLoopRegion();
        }
      });
      lane.addEventListener('pointermove', (e) => {
        if (!mode) return;
        const dur = activeBundle?.songInfo?.duration || 0;
        const raw = timeAt(e.clientX), t = snapToDownbeat(raw, e.altKey);
        if (mode === 'new') { tpA = Math.min(anchorT, t); tpB = Math.max(anchorT, t); }
        else if (mode === 'resizeA') { tpA = t; }
        else if (mode === 'resizeB') { tpB = t; }
        else if (mode === 'move') {
          const width = startTpB - startTpA;
          let na = snapToDownbeat(startTpA + (raw - anchorT), e.altKey);
          na = Math.max(0, Math.min(Math.max(0, dur - width), na));
          tpA = na; tpB = na + width;
        }
        paintLoopRegion();
      });
      const endLane = (e) => {
        if (!mode) return;
        const wasNew = mode === 'new';
        mode = null;
        try { lane.releasePointerCapture(e.pointerId); } catch (_) {}
        // A click (no real drag) on empty lane shouldn't wipe an existing loop.
        if (wasNew && Math.abs((tpA ?? 0) - (tpB ?? 0)) < 0.02) { tpA = prevA; tpB = prevB; }
        commitLoop();
      };
      lane.addEventListener('pointerup', endLane);
      lane.addEventListener('pointercancel', endLane);
    }
    $('slopscale-to-start')?.addEventListener('click', () => seekTo(0));
    $('slopscale-nudge-back')?.addEventListener('click', () => nudgeBar(-1));
    $('slopscale-nudge-fwd')?.addEventListener('click', () => nudgeBar(1));
    if (!window.__slopscaleKeysBound) { window.__slopscaleKeysBound = true; document.addEventListener('keydown', onTransportKey); }
    $('slopscale-loop-a')?.addEventListener('click', () => { tpA = currentPracticeTime; commitLoop(); });
    $('slopscale-loop-b')?.addEventListener('click', () => { tpB = currentPracticeTime; commitLoop(); });
    $('slopscale-loop-clear')?.addEventListener('click', resetTransportLoop);
    document.querySelectorAll('.slopscale-tp-seg').forEach(btn => {
      btn.addEventListener('click', () => { setFieldSilent('countIn', btn.dataset.countin); syncTransport(); });
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
    $('slopscale-segment-list')?.addEventListener('click', async (e) => {
      const card = e.target.closest('.slopscale-segment-card');
      if (!card) return;
      const i = parseInt(card.dataset.segIndex, 10);
      if (!activeBundle || activeBundle.config?.mode !== 'session') await onLaunchSession();
      jumpToSegment(i);
    });
    $('slopscale-regenerate')?.addEventListener('click', onGenerate);
    $('slopscale-next-variation')?.addEventListener('click', rotateToNextVariation);
    $('slopscale-save').addEventListener('click', () => savePreset().catch(e => { $('slopscale-summary').textContent += `\n\nPreset save failed: ${e.message || e}`; }));
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
    // View switcher buttons in the render stage — independent of exercise mode
    document.querySelectorAll('.slopscale-view-btn').forEach(btn => {
      btn.addEventListener('click', () => onViewSwitch(btn.dataset.renderer));
    });
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
    // Key or fretboardSystem change → repopulate the Shape dropdown for the
    // new (key, system) combination.
    // Shape stepper: ◄ / ► walk the #slopscale-shape options. A bubbling
    // 'change' reaches the #slopscale-controls listener (sync + regenerate).
    const shapeStep = (dir) => {
      const sel = $('slopscale-shape');
      if (!sel || !sel.options.length) return;
      const n = sel.options.length;
      sel.selectedIndex = (sel.selectedIndex + dir + n) % n;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    };
    $('slopscale-shape-prev')?.addEventListener('click', () => shapeStep(-1));
    $('slopscale-shape-next')?.addEventListener('click', () => shapeStep(1));
    $('slopscale-fretboard-system')?.addEventListener('change', () => { syncShapeDropdown(); syncShapeDropdownSelectionToHidden(); });
    $('slopscale-controls')?.querySelector('[name="key"]')?.addEventListener('change', () => { syncShapeDropdown(); syncShapeDropdownSelectionToHidden(); });
    $('slopscale-controls')?.querySelector('[name="scale"]')?.addEventListener('change', () => { syncShapeDropdown(); syncShapeDropdownSelectionToHidden(); });
    const pathwaySelect = $('slopscale-pathway');
    pathwaySelect?.addEventListener('change', () => {
      applyPathwayById(pathwaySelect.value);
      try { localStorage.setItem(PATHWAY_STORAGE_KEY, pathwaySelect.value); } catch (_) {}
      // The form-change listener above will pick up the silent field updates
      // on its own next tick, but kick a generate now so the initial pick
      // does not feel sluggish.
      if (activeBundle) onGenerate();
    });
    // Unified mode bar: Guided / Custom / Session.
    ['guided', 'custom', 'session'].forEach(m => {
      $('slopscale-mode-' + m)?.addEventListener('click', () => selectMode(m));
    });
    // Preset picker (Custom): load a saved preset's config into the form.
    $('slopscale-preset-picker')?.addEventListener('change', (ev) => {
      const key = ev.target.value; if (!key) return;
      const preset = window.__slopscaleFavorites && window.__slopscaleFavorites[key];
      if (preset && preset.config) { applyPathwayConfig(preset.config); if (activeBundle) onGenerate(); }
    });
    $('slopscale-session-select')?.addEventListener('change', ev => syncSessionSummary(ev.target.value));
    $('slopscale-launch-session')?.addEventListener('click', onLaunchSession);
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
      syncInstrumentClass();
      syncAdvancedMode();
      syncChromaticVisibility();
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
        if (lastExercise) {
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

  window.SlopScale = { generateExercise, makeBundle, resolveRendererFactory, readConfig, setSegmentLoop, clearSegmentLoop, getSegmentLoop };
  if (typeof globalThis !== 'undefined' && globalThis.__SS_HARNESS__) globalThis.__ss_debug = { STRING_SETUPS, resolveCAGEDShape, resolveThreeNPSPosition, NOTE_ALIASES, chordRootForDegree, nearestPositionForPc };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();