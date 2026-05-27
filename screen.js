// SlopScale — Slopsmith practice chart generator + renderer adapter.
(function () {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_ALIASES = { C:0, 'B#':0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, Fb:4, F:5, 'E#':5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11, Cb:11 };
  const STRING_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
  const AUDIO_LOOKAHEAD_SECONDS = 0.035;

  const STRING_SETUPS = {
    guitar_6_standard: { label:'6-string guitar — standard', instrument:'guitar', openMidis:[40,45,50,55,59,64], tuning:[0,0,0,0,0,0] },
    guitar_6_drop_d: { label:'6-string guitar — Drop D', instrument:'guitar', openMidis:[38,45,50,55,59,64], tuning:[-2,0,0,0,0,0] },
    guitar_7_standard: { label:'7-string guitar — standard', instrument:'guitar', openMidis:[35,40,45,50,55,59,64], tuning:[0,0,0,0,0,0,0] },
    guitar_8_standard: { label:'8-string guitar — standard', instrument:'guitar', openMidis:[30,35,40,45,50,55,59,64], tuning:[2,0,0,0,0,0,0,0] },
    bass_4_standard: { label:'4-string bass — standard', instrument:'bass', openMidis:[28,33,38,43], tuning:[0,0,0,0] },
    bass_5_standard: { label:'5-string bass — standard low B', instrument:'bass', openMidis:[23,28,33,38,43], tuning:[0,0,0,0,0] }
  };

  const SCALE_INTERVALS = {
    major:[0,2,4,5,7,9,11], natural_minor:[0,2,3,5,7,8,10], harmonic_minor:[0,2,3,5,7,8,11],
    minor_pentatonic:[0,3,5,7,10], major_pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10],
    bebop_major:[0,2,4,5,7,8,9,11], bebop_dominant:[0,2,4,5,7,9,10,11],
    dorian:[0,2,3,5,7,9,10], phrygian:[0,1,3,5,7,8,10], lydian:[0,2,4,6,7,9,11], mixolydian:[0,2,4,5,7,9,10], locrian:[0,1,3,5,6,8,10],
    melodic_minor:[0,2,3,5,7,9,11], phrygian_dominant:[0,1,4,5,7,8,10], lydian_dominant:[0,2,4,6,7,9,10],
    whole_tone:[0,2,4,6,8,10], diminished:[0,2,3,5,6,8,9,11],
    lydian:[0,2,4,6,7,9,11], locrian:[0,1,3,5,6,8,10]
  };
  const CHORD_FORMULAS = {
    maj:{symbol:'maj', intervals:[0,4,7]}, min:{symbol:'min', intervals:[0,3,7]}, dim:{symbol:'dim', intervals:[0,3,6]}, aug:{symbol:'aug', intervals:[0,4,8]},
    maj7:{symbol:'maj7', intervals:[0,4,7,11]}, min7:{symbol:'min7', intervals:[0,3,7,10]}, dom7:{symbol:'7', intervals:[0,4,7,10]},
    min7b5:{symbol:'m7b5', intervals:[0,3,6,10]}, dim7:{symbol:'dim7', intervals:[0,3,6,9]}, sus4:{symbol:'sus4', intervals:[0,5,7]}, add9:{symbol:'add9', intervals:[0,4,7,14]}
  };
  const DIATONIC_QUALITIES = {
    major:{triad:['maj','min','min','maj','maj','min','dim'], seventh:['maj7','min7','min7','maj7','dom7','min7','min7b5']},
    natural_minor:{triad:['min','dim','maj','min','min','maj','maj'], seventh:['min7','min7b5','maj7','min7','min7','maj7','dom7']},
    harmonic_minor:{triad:['min','dim','aug','min','maj','maj','dim'], seventh:['min7','min7b5','maj7','min7','dom7','maj7','dim7']}
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
    minor_ii_V_i:[2,5,1,1]
  };
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
  const MODE_FOR_QUALITY = {
    maj:'major', maj7:'major',
    min:'dorian', min7:'dorian',
    dom7:'mixolydian',
    dim:'locrian', min7b5:'locrian', dim7:'locrian',
    aug:'major', sus4:'mixolydian', add9:'major'
  };
  const CHROMATIC_PATTERNS = {
    '1234':[0,1,2,3], '4321':[3,2,1,0], '1324':[0,2,1,3], '1342':[0,2,3,1], '2413':[1,3,0,2]
  };
  const CHROMATIC_PATTERN_LABELS = {
    '1234':'1-2-3-4 (standard)', '4321':'4-3-2-1 (reverse)',
    '1324':'1-3-2-4 (crossing)', '1342':'1-3-4-2 (spider)', '2413':'2-4-1-3 (advanced)'
  };
  // Tempo tier labels — shared by all pathways. Index 0 = Slow.
  const TIER_LABELS = ['Slow', 'Med', 'Fast', 'Challenge'];
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
      goal:'Natural minor with a raised 6th — that one note gives it a brighter, jazzier feel than straight Aeolian. The raised 6th is the money note; resolve to it over the i chord. Santana, Robben Ford, and funk-era Miles Davis all live in Dorian.',
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
    sweep_primer: {
      label:'Sweep Arpeggio Primer',
      goal:'One chord tone per string, swept low-to-high with a hammer-on/pull-off turnaround at the apex, then swept back down. Root anchors the bass string. Start slow — sweeps reward cleanliness over speed.',
      scales:['natural_minor','harmonic_minor','major'],
      tempoTiers:[50, 65, 80, 100],
      base:{ practiceType:'sweep_arpeggios', scale:'natural_minor', chordDepth:'triad', chordOverride:'auto', progression:'i-VI-III-VII', meter:'4/4', subdivision:'sixteenth', bpm:70, bars:8, direction:'up_down', sequence:'none', advancedMode:true, fretboardSystem:'caged', stringSetup:'guitar_6_standard', renderer:'highway_3d', key:'A', shape:'E' },
      vary:[ { key:'A', shape:'E' }, { key:'A', shape:'A' }, { key:'D', shape:'E' }, { key:'E', shape:'E' }, { key:'G', shape:'G' } ]
    }
  };
  const PATHWAY_STORAGE_KEY = 'slopscale.lastPathway';
  const PATHWAY_FIRST_VISIT_DEFAULT = 'pent_foundation';

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
  const CAGED_SHAPES = {
    C: {
      rootStringIdx: 1, displayName: 'C-shape', scaleFretSpanFromRoot: [-3, 2],
      chordTemplates: {
        maj: [{s:1,fOff:0,iv:0},{s:2,fOff:-1,iv:4},{s:3,fOff:-3,iv:7},{s:4,fOff:-2,iv:0},{s:5,fOff:-3,iv:4}],
        min: [{s:1,fOff:0,iv:0},{s:2,fOff:-2,iv:3},{s:3,fOff:-3,iv:7},{s:4,fOff:-2,iv:0},{s:5,fOff:-4,iv:3}],
        dim: [{s:1,fOff:0,iv:0},{s:2,fOff:-2,iv:3},{s:3,fOff:-4,iv:6},{s:4,fOff:-2,iv:0},{s:5,fOff:-4,iv:3}]
      }
    },
    A: {
      rootStringIdx: 1, displayName: 'A-shape', scaleFretSpanFromRoot: [-1, 4], pentFretSpanFromRoot: [0, 3],
      chordTemplates: {
        maj: [{s:1,fOff:0,iv:0},{s:2,fOff:2,iv:7},{s:3,fOff:2,iv:0},{s:4,fOff:2,iv:4},{s:5,fOff:0,iv:7}],
        min: [{s:1,fOff:0,iv:0},{s:2,fOff:2,iv:7},{s:3,fOff:2,iv:0},{s:4,fOff:1,iv:3},{s:5,fOff:0,iv:7}],
        dim: [{s:1,fOff:0,iv:0},{s:2,fOff:1,iv:6},{s:3,fOff:2,iv:0},{s:4,fOff:1,iv:3},{s:5,fOff:-1,iv:6}]
      }
    },
    G: {
      rootStringIdx: 0, displayName: 'G-shape', scaleFretSpanFromRoot: [-3, 2],
      chordTemplates: {
        maj: [{s:0,fOff:0,iv:0},{s:1,fOff:-1,iv:4},{s:2,fOff:-3,iv:7},{s:3,fOff:-3,iv:0},{s:4,fOff:-3,iv:4},{s:5,fOff:0,iv:0}],
        min: [{s:0,fOff:0,iv:0},{s:1,fOff:-2,iv:3},{s:2,fOff:-3,iv:7},{s:3,fOff:-3,iv:0},{s:4,fOff:-4,iv:3},{s:5,fOff:0,iv:0}],
        dim: [{s:0,fOff:0,iv:0},{s:1,fOff:-2,iv:3},{s:2,fOff:-4,iv:6},{s:3,fOff:-3,iv:0},{s:4,fOff:-4,iv:3},{s:5,fOff:0,iv:0}]
      }
    },
    E: {
      rootStringIdx: 0, displayName: 'E-shape', scaleFretSpanFromRoot: [-1, 4], pentFretSpanFromRoot: [0, 3],
      chordTemplates: {
        maj: [{s:0,fOff:0,iv:0},{s:1,fOff:2,iv:7},{s:2,fOff:2,iv:0},{s:3,fOff:1,iv:4},{s:4,fOff:0,iv:7},{s:5,fOff:0,iv:0}],
        min: [{s:0,fOff:0,iv:0},{s:1,fOff:2,iv:7},{s:2,fOff:2,iv:0},{s:3,fOff:0,iv:3},{s:4,fOff:0,iv:7},{s:5,fOff:0,iv:0}],
        dim: [{s:0,fOff:0,iv:0},{s:1,fOff:1,iv:6},{s:2,fOff:2,iv:0},{s:3,fOff:0,iv:3},{s:4,fOff:-1,iv:6},{s:5,fOff:0,iv:0}]
      }
    },
    D: {
      rootStringIdx: 2, displayName: 'D-shape', scaleFretSpanFromRoot: [-2, 3],
      chordTemplates: {
        maj: [{s:2,fOff:0,iv:0},{s:3,fOff:2,iv:7},{s:4,fOff:3,iv:0},{s:5,fOff:2,iv:4}],
        min: [{s:2,fOff:0,iv:0},{s:3,fOff:2,iv:7},{s:4,fOff:3,iv:0},{s:5,fOff:1,iv:3}],
        dim: [{s:2,fOff:0,iv:0},{s:3,fOff:1,iv:6},{s:4,fOff:3,iv:0},{s:5,fOff:1,iv:3}]
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

  // Resolve a CAGED shape in a given key.
  // Returns { fretMin, fretMax, rootFret, rootStringIdx, notes: [{s,f,d,isRoot}], displayName }
  // or null if the shape is undefined.
  function resolveCAGEDShape(keyPc, shape, scale, openMidis) {
    const def = CAGED_SHAPES[shape];
    if (!def) return null;
    const rootOpenPc = openPcForString(openMidis, def.rootStringIdx);
    const rootFret = lowestFretWithPc(rootOpenPc, keyPc);
    const spanDef = (def.pentFretSpanFromRoot && (scale === 'minor_pentatonic' || scale === 'major_pentatonic' || scale === 'blues'))
      ? def.pentFretSpanFromRoot : def.scaleFretSpanFromRoot;
    const fretMin = rootFret + spanDef[0];
    const fretMax = rootFret + spanDef[1];
    const notes = [];
    const numStrings = openMidis.length;
    for (let s = 0; s < numStrings; s++) {
      const openPc = openPcForString(openMidis, s);
      const firstFret = Math.max(0, fretMin);
      for (let f = firstFret; f <= fretMax; f++) {
        const notePc = (openPc + f) % 12;
        const degree = degreeOfPc(keyPc, notePc, scale);
        if (degree !== null) notes.push({ s, f, d: degree, isRoot: degree === 1 });
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
      for (let i = 0; i < degrees.length; i++) {
        notes.push({ s, f: fretsForDegrees[i], d: degrees[i] + 1, isRoot: degrees[i] === 0 });
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
    for (let s = 0; s < numStrings; s++) {
      const openPc = openPcForString(openMidis, s);
      for (let f = fretMin; f <= fretMax; f++) {
        const notePc = (openPc + f) % 12;
        const degree = degreeOfPc(keyPc, notePc, scale);
        if (degree !== null) notes.push({ s, f, d: degree, isRoot: degree === 1 });
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

  // Human-facing label for a shape: name + parenthetical fret range.
  function shapeLabel(system, shape, resolved) {
    if (!resolved) return String(shape);
    const range = `(frets ${resolved.fretMin}–${resolved.fretMax})`;
    if (system === 'caged') return `${resolved.displayName} ${range}`;
    if (system === '3nps')  return `${resolved.displayName} ${range}`;
    if (system === 'open')  return `${resolved.displayName} ${range}`;
    return `${resolved.displayName} ${range}`;
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
  })();

  let renderer = null, activeBundle = null, rafId = null;
  let currentPracticeTime = 0, playAnchorMs = 0, playAnchorChartTime = 0, playing = false;
  let audioCtx = null, audioNodes = [];
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
      renderer: data.get('renderer') || 'highway_3d',
      instrument: setup.instrument,
      stringSetup,
      setupLabel: setup.label,
      stringCount: setup.openMidis.length,
      key: data.get('key') || 'C',
      scale: data.get('scale') || 'major',
      bpm: Math.max(30, Math.min(260, parseFloat(data.get('bpm') || '100'))),
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
      progression: advancedMode ? (data.get('progression') || 'diatonic') : 'diatonic',
      chordOverride: advancedMode ? (data.get('chordOverride') || 'auto') : 'auto',
      chromaticPattern: data.get('chromaticPattern') || '1234',
      keyCycle: data.get('keyCycle') || 'none',
      keyCycleLength: Math.max(2, Math.min(12, parseInt(data.get('keyCycleLength') || '4', 10))),
      audio: { notes: data.get('audioNotes') === 'on', metronome: data.get('audioMetronome') === 'on', harmony: data.get('audioHarmony') === 'on' }
    };
  }

  function openMidisForConfig(cfg) { return (STRING_SETUPS[cfg.stringSetup] || STRING_SETUPS.guitar_6_standard).openMidis.slice(); }
  function tuningOffsetsForConfig(cfg) { return (STRING_SETUPS[cfg.stringSetup] || STRING_SETUPS.guitar_6_standard).tuning.slice(); }
  function noteDefaults(extra) { return Object.assign({ t:0, s:0, f:0, sus:0, sl:-1, slu:-1, bn:0, ho:false, po:false, hm:false, hp:false, pm:false, mt:false, vb:false, tr:false, ac:false, tp:false }, extra || {}); }
  function scalePcs(cfg) { const keyPc = NOTE_ALIASES[cfg.key] ?? 0; return (SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major).map(i => (keyPc + i) % 12); }
  function secondsPerDivision(cfg) { const q = 60 / cfg.bpm; return ({ quarter:q, eighth:q/2, sixteenth:q/4, triplet:q/3, eighth_triplet:q/3, sixteenth_triplet:q/6 })[cfg.subdivision] || q/2; }
  function measureSeconds(cfg) { return (60 / cfg.bpm) * (4 / cfg.meter.denominator) * cfg.meter.numerator; }
  function fretboardSystemLabel(value) { return FRETBOARD_SYSTEM_LABELS[value] || FRETBOARD_SYSTEM_LABELS.position; }

  function cagedShapeQualityKey(quality) {
    if (quality === 'min' || quality === 'min7' || quality === 'min_maj7') return 'min';
    if (quality === 'dim' || quality === 'dim7' || quality === 'm7b5') return 'dim';
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

  // Convert a shape's note list (s/f/d/isRoot) into the {s,f,midi,pc} shape
  // the chart generators expect.
  function shapeNotesToPositions(cfg, shapeNotes) {
    const opens = openMidisForConfig(cfg);
    return shapeNotes
      .filter(n => n.s >= 0 && n.s < cfg.stringCount)
      .map(n => {
        const midi = opens[n.s] + n.f;
        return { s: n.s, f: n.f, midi, pc: midi % 12 };
      })
      .sort((a, b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
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

  function chordQualityForDegree(scale, depth, degree, override) {
    if (override && override !== 'auto') return override;
    const family = DIATONIC_QUALITIES[scale] || DIATONIC_QUALITIES.major;
    const row = family[depth === 'seventh' ? 'seventh' : 'triad'] || family.triad;
    return row[(degree - 1 + 7) % 7] || 'maj';
  }
  function chordRootForDegree(cfg, degree) { const keyPc = NOTE_ALIASES[cfg.key] ?? 0; const intervals = SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major; return (keyPc + intervals[(degree - 1 + intervals.length) % intervals.length]) % 12; }
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

  function templateFromPositions(name, positions, cfg, arp) {
    const frets = new Array(cfg.stringCount).fill(-1), fingers = new Array(cfg.stringCount).fill(-1);
    for (const p of positions) {
      if (!p || p.s < 0 || p.s >= cfg.stringCount) continue;
      if (frets[p.s] === -1 || p.f < frets[p.s]) frets[p.s] = p.f;
      fingers[p.s] = p.f === 0 ? 0 : 1;
    }
    return { name, displayName:name, arp:!!arp, fingers, frets };
  }

  function voiceBackingChord(rootPc, intervals, instrument) {
    const bassMin = instrument === 'bass' ? 23 : 36;
    const bassMax = instrument === 'bass' ? 38 : 48;
    let bass = rootPc;
    while (bass < bassMin) bass += 12;
    while (bass > bassMax) bass -= 12;
    const midis = [bass];
    for (const interval of intervals.slice(0, 4)) {
      let midi = rootPc + interval;
      while (midi < 48) midi += 12;
      while (midi > 67) midi -= 12;
      if (!midis.includes(midi)) midis.push(midi);
    }
    return midis.sort((a,b) => a - b);
  }
  function buildBackingEvents(cfg, duration) {
    const degrees = progressionDegreesForConfig(cfg);
    const slot = measureSeconds(cfg);
    const events = [];
    for (let t = 0, i = 0; t < duration - 0.001; t += slot, i++) {
      const degree = degrees[i % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride);
      const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
      events.push({ t:Number(t.toFixed(6)), end:Number(Math.min(duration, t + slot).toFixed(6)), name:chordName(rootPc, quality), midis:voiceBackingChord(rootPc, formula.intervals, cfg.instrument) });
    }
    return events;
  }

  function chordScalePositions(cfg, rootPc, quality) {
    const scaleName = MODE_FOR_QUALITY[quality] || 'major';
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
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride);
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
    const bassStr = cfg.stringCount - 1; // low E in 0=highE convention = highest s index
    for (let s = 0; s < cfg.stringCount; s++) {
      let best = null, bestScore = Infinity;
      for (let f = fLo; f <= fHi; f++) {
        const midi = opens[s] + f, pc = midi % 12;
        if (!intervalPcSet.has(pc)) continue;
        const dist = Math.abs(f - anchorFret);
        // On the bass string, strongly prefer the root to anchor the sweep correctly
        const rootPenalty = (s === bassStr && pc !== rootPc) ? 30 : 0;
        const score = dist + rootPenalty;
        if (score < bestScore) { best = { s, f, midi, pc }; bestScore = score; }
      }
      if (best) out.push(best);
    }
    return out;
  }

  function sweepTurnaroundNotes(apexPos, cfg, rootPc, quality) {
    const opens = openMidisForConfig(cfg);
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const intervalPcSet = new Set(formula.intervals.map(iv => (rootPc + iv) % 12));
    for (let f = apexPos.f + 1; f <= Math.min(24, apexPos.f + 5); f++) {
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
    // positions[0]=s0 (high e), positions[last]=s5 (low E)
    // Ascending sweep: low E → high e = positions reversed
    const ascending = positions.slice().reverse();
    const apexPos = ascending[ascending.length - 1]; // s=0, high e
    const turnaround = apexPos ? sweepTurnaroundNotes(apexPos, cfg, rootPc, quality) : [];
    // Descending: from s=1 back down to s=stringCount-1 (skip apex — HO/PO handles it)
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
    const notes = [], chordTemplates = [], chords = [], handShapes = [], sections = [];
    for (let bar = 0; bar < totalBars; bar++) {
      const degree = degrees[bar % degrees.length];
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride);
      const positions = sweepArpeggioPositions(cfg, rootPc, quality, anchorFret);
      if (!positions.length) continue;
      const path = buildSweepPathWithHopo(positions, cfg, rootPc, quality);
      if (!path.length) continue;
      const barStart = bar * mLen;
      const name = chordName(rootPc, quality), templateId = chordTemplates.length;
      chordTemplates.push(templateFromPositions(name, positions, cfg, true));
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
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride);
      let displayPositions = null;
      let chordCfg = cfg;
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
      const name = chordName(rootPc, quality), templateId = chordTemplates.length;
      chordTemplates.push(templateFromPositions(name, displayPositions, chordCfg, true));
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
    const stringsAsc = Array.from({ length: stringCount }, (_, i) => stringCount - 1 - i); // low E first (high index first in 0=highE convention)
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

  const CYCLE_KEY_ORDERS = {
    circle_of_fourths: ['C','F','Bb','Eb','Ab','Db','Gb','B','E','A','D','G'],
    circle_of_fifths:  ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F'],
    chromatic:         ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],
  };

  function buildSingleChart(cfg) {
    return cfg.mode === 'scale' ? buildScaleExercise(cfg)
      : cfg.mode === 'chord_scales' ? buildChordScaleExercise(cfg)
      : cfg.mode === 'sweep_arpeggios' ? buildSweepArpeggioExercise(cfg)
      : cfg.mode === 'chromatic' ? buildChromaticExercise(cfg)
      : buildArpeggioExercise(cfg, progressionDegreesForConfig(cfg));
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

  function makeBundle(exercise) {
    const cfg = exercise.session, c = exercise.chart;
    const bundle = {
      currentTime:0,
      songInfo:{ title:`SlopScale ${cfg.mode}`, artist:'SlopScale', arrangement:cfg.instrument === 'bass' ? 'Bass' : 'Lead', tuning:tuningOffsetsForConfig(cfg), capo:0, duration:c.duration, format:'slopscale-practice', fretboardSystem:cfg.fretboardSystem },
      isReady:true, notes:c.notes, chords:c.chords, anchors:c.anchors, beats:c.beats, sections:c.sections, chordTemplates:c.chordTemplates, handShapes:c.handShapes,
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
        // lowercase for high e and high b to match conventional notation
        const display = (s <= 1 && (label === 'E' || label === 'B')) ? label.toLowerCase() : label;
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
    // Guitar Pro / Ultimate Guitar-style horizontal tab staff.
    // Strings stacked top-to-bottom; fret numbers sit ON the string lines.
    // Time scrolls right-to-left through a fixed playhead.
    let canvas = null, ctx = null, W = 0, H = 0;
    const LEFT_PAD = 56, RIGHT_PAD = 28, TOP_PAD = 70, BOTTOM_PAD = 56;
    const AHEAD = 6, BEHIND = 1.2;

    function resize() {
      if (!canvas) return;
      const r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(640, Math.round(r.width || 1280));
      H = Math.max(360, Math.round(r.height || 640));
      canvas.width = W;
      canvas.height = H;
    }
    function laneY(s, count, inverted) {
      // In Guitar Pro tab, the HIGH e is on TOP, LOW E on BOTTOM. With s=0=highE,
      // string index 0 maps to the top lane. "inverted" flips the layout.
      const top = TOP_PAD, bottom = H - BOTTOM_PAD;
      const visualIndex = inverted ? (count - 1 - s) : s;
      const step = (bottom - top) / Math.max(1, count - 1);
      return top + visualIndex * step;
    }
    function xForDt(dt) {
      return LEFT_PAD + ((dt + BEHIND) / (AHEAD + BEHIND)) * (W - LEFT_PAD - RIGHT_PAD);
    }

    function drawBackground() {
      ctx.fillStyle = '#f5f1e6'; // warm parchment for staff
      ctx.fillRect(0, 0, W, H);
      // tab-staff backing band
      ctx.fillStyle = '#fbf8ee';
      ctx.fillRect(LEFT_PAD - 8, TOP_PAD - 8, W - LEFT_PAD - RIGHT_PAD + 12, H - TOP_PAD - BOTTOM_PAD + 16);
      ctx.strokeStyle = '#c8c0aa';
      ctx.lineWidth = 1;
      ctx.strokeRect(LEFT_PAD - 8, TOP_PAD - 8, W - LEFT_PAD - RIGHT_PAD + 12, H - TOP_PAD - BOTTOM_PAD + 16);
    }

    function drawStaff(nStr, inverted, openMidis) {
      ctx.strokeStyle = '#5c5340';
      ctx.lineWidth = 1;
      for (let s = 0; s < nStr; s++) {
        const y = laneY(s, nStr, inverted);
        ctx.beginPath(); ctx.moveTo(LEFT_PAD, y); ctx.lineTo(W - RIGHT_PAD, y); ctx.stroke();
        ctx.fillStyle = '#3a3528';
        ctx.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
        const label = openMidis ? stringLabelForMidi(openMidis[s]) : `${s + 1}`;
        const display = (s <= 1 && (label === 'E' || label === 'B')) ? label.toLowerCase() : label;
        ctx.textAlign = 'right';
        ctx.fillText(display, LEFT_PAD - 10, y + 4);
        ctx.textAlign = 'left';
      }
    }

    function drawBarLines(bundle, now) {
      for (const b of bundle.beats || []) {
        if (b.measure < 0) continue; // only bar starts
        const dt = b.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.strokeStyle = '#7a6f55';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, TOP_PAD - 6);
        ctx.lineTo(x, H - BOTTOM_PAD + 6);
        ctx.stroke();
        ctx.fillStyle = '#7a6f55';
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.fillText(String(b.measure), x + 4, TOP_PAD - 12);
      }
      // beat ticks (very subtle)
      for (const b of bundle.beats || []) {
        if (b.measure >= 0) continue;
        const dt = b.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.strokeStyle = 'rgba(122,111,85,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, TOP_PAD - 2);
        ctx.lineTo(x, TOP_PAD + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, H - BOTTOM_PAD - 4);
        ctx.lineTo(x, H - BOTTOM_PAD + 2);
        ctx.stroke();
      }
    }

    function drawPlayhead() {
      const x = xForDt(0);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, TOP_PAD - 24);
      ctx.lineTo(x, H - BOTTOM_PAD + 8);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(x - 6, TOP_PAD - 26);
      ctx.lineTo(x + 6, TOP_PAD - 26);
      ctx.lineTo(x, TOP_PAD - 18);
      ctx.closePath();
      ctx.fill();
    }

    function drawChordNames(bundle, now) {
      for (const ch of bundle.chords || []) {
        const dt = ch.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        const name = bundle.chordTemplates?.[ch.id]?.displayName || bundle.chordTemplates?.[ch.id]?.name || '';
        if (!name) continue;
        ctx.fillStyle = '#7c2d12';
        ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, TOP_PAD - 30);
        ctx.textAlign = 'left';
      }
    }

    function drawBackingChordRow(bundle, now) {
      // Roman-numeral-ish chord row above the staff (uses backing event names)
      for (const ev of bundle.backingEvents || []) {
        const dt = ev.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.fillStyle = 'rgba(146,64,14,0.08)';
        ctx.fillRect(x - 32, 12, 64, 22);
        ctx.fillStyle = '#92400e';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ev.name, x, 27);
        ctx.textAlign = 'left';
      }
    }

    function techniqueGlyphTab(n) {
      // Single-character form preferred — tab convention
      if (n.ho) return 'h';
      if (n.po) return 'p';
      if (n.hm) return '◇';
      if (n.pm) return 'pm';
      if (n.mt) return 'x';
      if (n.tr) return '≈';
      if (n.vb) return '~';
      if (n.tp) return 'T';
      if ((n.sl || -1) >= 0) return '/';
      if ((n.bn || 0) > 0) return `b${n.bn}`;
      return '';
    }

    function drawSectionMarkers(bundle, now) {
      for (const sec of bundle.sections || []) {
        const dt = sec.time - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        ctx.fillStyle = '#7e22ce';
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sec.name || '·', x, H - BOTTOM_PAD + 28);
        ctx.textAlign = 'left';
      }
    }

    function drawNotes(bundle, now, nStr, inverted) {
      // First pass: sustains and dead-note Xs
      for (const n of bundle.notes || []) {
        const dt = n.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        const y = laneY(n.s, nStr, inverted);
        if ((n.sus || 0) > 0) {
          const x2 = xForDt(dt + n.sus);
          ctx.strokeStyle = 'rgba(120,53,15,0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(Math.min(W - RIGHT_PAD, x2), y); ctx.stroke();
        }
      }
      // Second pass: fret numbers and glyphs
      for (const n of bundle.notes || []) {
        const dt = n.t - now;
        if (dt < -BEHIND || dt > AHEAD) continue;
        const x = xForDt(dt);
        const y = laneY(n.s, nStr, inverted);
        // Erase the staff line behind the fret number so it stays readable
        const fretText = n.mt ? 'x' : String(n.f);
        const padW = Math.max(14, fretText.length * 8 + 4);
        ctx.fillStyle = '#fbf8ee';
        ctx.fillRect(x - padW / 2, y - 8, padW, 16);
        ctx.fillStyle = n.ac ? '#dc2626' : '#0f172a';
        ctx.font = `${n.ac ? '800' : '700'} 14px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(fretText, x, y + 5);
        // technique glyph
        const glyph = techniqueGlyphTab(n);
        if (glyph) {
          ctx.fillStyle = '#7c2d12';
          ctx.font = '700 10px ui-monospace, monospace';
          ctx.fillText(glyph, x + padW / 2 + 6, y + 4);
        }
        ctx.textAlign = 'left';
      }
    }

    function drawHud(bundle, now) {
      ctx.fillStyle = '#3a3528';
      ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillText(bundle.songInfo?.title || 'SlopScale', 14, 22);
      ctx.fillStyle = '#7a6f55';
      ctx.font = '11px ui-monospace, monospace';
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
      drawStaff(nStr, inverted, openMidis);
      drawBarLines(bundle, now);
      drawBackingChordRow(bundle, now);
      drawChordNames(bundle, now);
      drawNotes(bundle, now, nStr, inverted);
      drawSectionMarkers(bundle, now);
      drawPlayhead();
      drawHud(bundle, now);
    }

    return {
      init(c) { canvas = c; ctx = c.getContext('2d'); resize(); window.addEventListener('resize', resize); },
      draw,
      resize,
      destroy() { window.removeEventListener('resize', resize); canvas = null; ctx = null; }
    };
  }

  function loadScriptOnce(id, src) { return new Promise((resolve, reject) => { if (document.getElementById(id)) return resolve(); const s = document.createElement('script'); s.id = id; s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error(`Failed to load ${src}`)); document.head.appendChild(s); }); }
  async function resolveRendererFactory(kind) {
    if (kind === 'builtin_2d') return { factory:makeBuiltin2DRenderer, label:'2D Highway' };
    if (kind === 'tab_2d') return { factory:makeBuiltin2DTabRenderer, label:'2D Tablature' };
    if (kind === 'highway_3d') {
      if (!window.slopsmithViz_highway_3d) await loadScriptOnce('slopscale-highway-3d-loader', '/api/plugins/highway_3d/screen.js');
      if (typeof window.slopsmithViz_highway_3d === 'function') return { factory:window.slopsmithViz_highway_3d, label:'3D Note Highway' };
      // Fall back to the built-in 2D highway if the 3D one isn't available
      return { factory:makeBuiltin2DRenderer, label:'2D Highway (fallback — 3D renderer not found)' };
    }
    return { factory:makeBuiltin2DRenderer, label:'2D Highway (default)' };
  }

  function replaceCanvas() { const host = $('slopscale-render-host'), old = $('slopscale-canvas'), canvas = document.createElement('canvas'); canvas.id = 'slopscale-canvas'; canvas.style.width = '100%'; canvas.style.height = '100%'; if (old) old.replaceWith(canvas); else host.appendChild(canvas); const rect = host.getBoundingClientRect(); canvas.width = Math.max(640, Math.round(rect.width || 1280)); canvas.height = Math.max(420, Math.round(rect.height || 720)); return canvas; }
  function stopAudio() { for (const n of audioNodes) { try { n.stop && n.stop(0); } catch {} try { n.disconnect && n.disconnect(); } catch {} } audioNodes = []; }
  function stopRenderer() { playing = false; stopAudio(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } if (renderer && typeof renderer.destroy === 'function') { try { renderer.destroy(); } catch (e) { console.warn('[SlopScale] renderer destroy failed', e); } } renderer = null; }

  async function attachRenderer(exercise) {
    const cfg = exercise.session;
    stopRenderer(); activeBundle = makeBundle(exercise); currentPracticeTime = 0;
    const canvas = replaceCanvas(), resolved = await resolveRendererFactory(cfg.renderer);
    renderer = resolved.factory();
    if (!renderer || typeof renderer.draw !== 'function') throw new Error('Selected renderer did not return a Slopsmith-compatible renderer object.');
    if (typeof renderer.init === 'function') { renderer.init(canvas, activeBundle); if (renderer.readyPromise && typeof renderer.readyPromise.then === 'function') await renderer.readyPromise; }
    const rect = canvas.parentElement.getBoundingClientRect();
    if (typeof renderer.resize === 'function') renderer.resize(Math.round(rect.width || canvas.width), Math.round(rect.height || canvas.height));
    const rendererStatus = $('slopscale-renderer-status'); if (rendererStatus) rendererStatus.textContent = resolved.label; drawOnce();
  }

  function syncPlayButton() {
    const btn = $('slopscale-play');
    if (!btn) return;
    btn.classList.toggle('is-playing', !!playing);
    btn.textContent = playing ? '■ Stop' : '▶ Play';
  }
  function drawOnce() { if (!renderer || !activeBundle) return; syncHighwaySettings(activeBundle); activeBundle.currentTime = currentPracticeTime; renderer.draw(activeBundle); }
  function tick(nowMs) {
    if (!renderer || !activeBundle) return;
    if (playing) {
      const elapsedMs = Math.max(0, nowMs - playAnchorMs);
      currentPracticeTime = playAnchorChartTime + elapsedMs / 1000;
      const duration = activeBundle.songInfo.duration || 1;
      if (currentPracticeTime > duration) { currentPracticeTime = 0; playAnchorChartTime = 0; playAnchorMs = nowMs + AUDIO_LOOKAHEAD_SECONDS * 1000; stopAudio(); schedulePreviewAudio(activeBundle, currentPracticeTime, AUDIO_LOOKAHEAD_SECONDS); }
    }
    drawOnce(); rafId = requestAnimationFrame(tick);
  }

  function makeDistortionCurve(amount) { const samples = 256, curve = new Float32Array(samples), k = amount || 18; for (let i = 0; i < samples; i++) { const x = i * 2 / samples - 1; curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x)); } return curve; }
  function schedulePluckedString(ctx, when, freq, dur, instrument, gainScale) {
    const isBass = instrument === 'bass', osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter(), shaper = ctx.createWaveShaper();
    osc1.type = isBass ? 'triangle' : 'sawtooth'; osc2.type = isBass ? 'sine' : 'triangle';
    osc1.frequency.setValueAtTime(freq, when); osc2.frequency.setValueAtTime(isBass ? Math.max(25, freq * 0.5) : freq * 2, when); osc2.detune.setValueAtTime(isBass ? 0 : 5, when);
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(isBass ? 1200 : 2600, when); filter.frequency.exponentialRampToValueAtTime(isBass ? 450 : 900, when + Math.max(0.08, dur)); filter.Q.setValueAtTime(isBass ? 0.7 : 1.1, when);
    shaper.curve = makeDistortionCurve(isBass ? 8 : 14); shaper.oversample = '2x';
    const amp = (isBass ? 0.28 : 0.24) * (gainScale || 1);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(amp, when + 0.004); gain.gain.exponentialRampToValueAtTime(amp * 0.45, when + 0.055); gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.12, dur));
    osc1.connect(filter); osc2.connect(filter); filter.connect(shaper); shaper.connect(gain); gain.connect(ctx.destination);
    osc1.start(when); osc2.start(when); const stopAt = when + Math.max(0.14, dur) + 0.03; osc1.stop(stopAt); osc2.stop(stopAt); audioNodes.push(osc1, osc2, filter, shaper, gain);
  }
  function scheduleHarmonyPad(ctx, when, midis, dur, instrument) {
    if (!midis.length) return;
    const master = ctx.createGain(), filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(instrument === 'bass' ? 1150 : 1900, when); filter.Q.setValueAtTime(0.7, when);
    master.gain.setValueAtTime(0.0001, when); master.gain.exponentialRampToValueAtTime(0.24, when + 0.012); master.gain.linearRampToValueAtTime(0.18, when + Math.max(0.08, dur - 0.16)); master.gain.linearRampToValueAtTime(0.0001, when + dur);
    filter.connect(master); master.connect(ctx.destination);
    audioNodes.push(filter, master);
    midis.slice(0, 5).forEach((midi, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(midi), when);
      osc.detune.setValueAtTime((i - 2) * 3, when);
      g.gain.setValueAtTime(i === 0 ? 0.48 : 0.22, when);
      osc.connect(g); g.connect(filter); osc.start(when); osc.stop(when + dur + 0.05); audioNodes.push(osc, g);
    });
  }
  function scheduleClick(ctx, when, accent) {
    const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = 'square'; osc.frequency.setValueAtTime(accent ? 1760 : 1120, when); filter.type = 'highpass'; filter.frequency.setValueAtTime(650, when);
    gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.09, when + 0.002); gain.gain.exponentialRampToValueAtTime(0.0001, when + (accent ? 0.055 : 0.04));
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination); osc.start(when); osc.stop(when + 0.07); audioNodes.push(osc, filter, gain);
  }
  function schedulePreviewAudio(bundle, fromTime, delaySeconds) {
    const cfg = readConfig();
    if (!cfg.audio.notes && !cfg.audio.metronome && !cfg.audio.harmony) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const ctx = audioCtx, base = ctx.currentTime + (Number.isFinite(delaySeconds) ? delaySeconds : AUDIO_LOOKAHEAD_SECONDS), startFrom = fromTime || 0, opens = openMidisForConfig(cfg), duration = bundle.songInfo?.duration || 0;
    if (cfg.audio.harmony) for (const ev of bundle.backingEvents || []) {
      if (ev.end < startFrom || ev.t > duration + 0.1) continue;
      const start = Math.max(ev.t, startFrom), end = Math.min(ev.end, duration);
      scheduleHarmonyPad(ctx, base + (start - startFrom), ev.midis || [], Math.max(0.2, end - start), cfg.instrument);
    }
    if (cfg.audio.notes) for (const n of bundle.notes || []) {
      if (n.t < startFrom || n.t > duration + 0.1) continue;
      if (n.s < 0 || n.s >= opens.length || n.f < 0) continue;
      schedulePluckedString(ctx, base + (n.t - startFrom), midiToFreq(opens[n.s] + n.f), Math.max(0.10, Math.min(0.85, n.sus || 0.24)), cfg.instrument, cfg.audio.harmony ? 0.9 : 1.25);
    }
    if (cfg.audio.metronome) for (const b of bundle.beats || []) { if (b.time < startFrom || b.time > duration + 0.1) continue; scheduleClick(ctx, base + (b.time - startFrom), (b.measure || -1) >= 0); }
  }
  function startPlayback() { if (!activeBundle) return; stopAudio(); syncHighwaySettings(activeBundle); playing = true; playAnchorChartTime = currentPracticeTime; playAnchorMs = performance.now() + AUDIO_LOOKAHEAD_SECONDS * 1000; schedulePreviewAudio(activeBundle, currentPracticeTime, AUDIO_LOOKAHEAD_SECONDS); if (!rafId) rafId = requestAnimationFrame(tick); syncPlayButton(); refreshStatusFromState(); }
  function stopPlayback() { playing = false; currentPracticeTime = 0; playAnchorChartTime = 0; stopAudio(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } drawOnce(); syncPlayButton(); refreshStatusFromState(); }
  // Toggle for the primary Play/Stop button. If we don't have a chart yet,
  // generate one first so the very first click always plays something.
  async function onPlayToggle() {
    if (playing) { stopPlayback(); return; }
    if (!activeBundle) { await onGenerate(); }
    startPlayback();
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
      return;
    }
    const preset = window.__slopscaleFavorites && window.__slopscaleFavorites[id];
    if (preset && preset.config) {
      applyPathwayConfig(preset.config);
      setPathwayModeClass(true);
      updatePathwayGoalCard(null, false, preset);
    }
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
    fetch('/api/plugins/slopscale/presets').then(r => r.ok ? r.json() : null).then(data => {
      const presets = (data && Array.isArray(data.presets)) ? data.presets : [];
      if (!presets.length) return;
      window.__slopscaleFavorites = window.__slopscaleFavorites || {};
      presets.forEach(p => {
        if (!p || !p.id) return;
        const key = 'fav__' + p.id;
        window.__slopscaleFavorites[key] = p;
        if (favoritesGroup.querySelector('option[value="' + key + '"]')) return;
        const opt = document.createElement('option'); opt.value = key; opt.textContent = p.name || p.id;
        favoritesGroup.appendChild(opt);
      });
      if (favoritesGroup.children.length) favoritesGroup.hidden = false;
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
    tiers.forEach((bpm, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slopscale-tier-btn' + (i === activeTempoTierIdx ? ' active' : '');
      btn.textContent = `${TIER_LABELS[i] || `T${i+1}`} (${bpm})`;
      btn.addEventListener('click', () => {
        activeTempoTierIdx = i;
        setFieldSilent('bpm', String(bpm));
        syncTempoTierButtons();
        onGenerate();
      });
      container.appendChild(btn);
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
    const isChromatic = mode === 'chromatic';
    document.querySelectorAll('.slopscale-chromatic-only').forEach(el => {
      el.style.display = isChromatic ? '' : 'none';
    });
  }

  function bind() {
    const root = $('slopscale-root'); if (!root || root.dataset.slopscaleInit === '1') return false; root.dataset.slopscaleInit = '1';
    const instrument = document.querySelector('[name="instrument"]'), setup = document.querySelector('[name="stringSetup"]'), advancedToggle = $('slopscale-advanced-toggle');
    instrument?.addEventListener('change', () => { if (!setup) return; setup.value = instrument.value === 'bass' ? 'bass_4_standard' : 'guitar_6_standard'; if (activeBundle) onGenerate(); });
    setup?.addEventListener('change', syncStringSetupControls); syncStringSetupControls();
    advancedToggle?.addEventListener('change', syncAdvancedMode); syncAdvancedMode(); syncChromaticVisibility();
    $('slopscale-pathway-scale')?.addEventListener('change', (ev) => { setFieldSilent('scale', ev.target.value); if (activeBundle) onGenerate(); });
    $('slopscale-play').addEventListener('click', onPlayToggle);
    $('slopscale-regenerate')?.addEventListener('click', onGenerate);
    $('slopscale-next-variation')?.addEventListener('click', rotateToNextVariation);
    $('slopscale-save').addEventListener('click', () => savePreset().catch(e => { $('slopscale-summary').textContent += `\n\nPreset save failed: ${e.message || e}`; }));
    $('slopscale-go-library')?.addEventListener('click', () => { stopRenderer(); goScreen('home'); });
    $('slopscale-go-plugins')?.addEventListener('click', () => { stopRenderer(); goScreen('plugins'); });
    $('slopscale-controls').addEventListener('change', (ev) => {
      const name = ev && ev.target ? ev.target.name : '';
      if (name === 'shape') syncShapeDropdownSelectionToHidden();
      if (name === 'practiceType') syncChromaticVisibility();
      if (name === 'keyCycle') { const h = $('slopscale-keycycle-help'); if (h) h.style.display = ev.target.value !== 'none' ? '' : 'none'; }
      syncAdvancedMode();
      markPathwayModifiedIfApplicable(name);
      if (activeBundle) onGenerate();
    });
    // Key or fretboardSystem change → repopulate the Shape dropdown for the
    // new (key, system) combination.
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
    loadPathwayFavorites();
    // Populate the Shape dropdown for the initial (key, system) before any
    // pathway runs — applyInitialPathway may set the shape value, but it
    // can't select an option that doesn't exist yet.
    syncShapeDropdown();
    syncShapeDropdownSelectionToHidden();
    applyInitialPathway();
    window.addEventListener('storage', (ev) => { if (ev.key === 'invertHighway' || ev.key === 'lefty' || ev.key === 'renderScale') refreshForHostSettingChange(); });
    window.addEventListener('focus', refreshForHostSettingChange);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshForHostSettingChange(); });
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

  window.SlopScale = { generateExercise, makeBundle, resolveRendererFactory, readConfig };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();