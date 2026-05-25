// SlopScale — Slopsmith practice chart generator + renderer adapter.
(function () {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_ALIASES = { C:0, 'B#':0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, Fb:4, F:5, 'E#':5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11, Cb:11 };
  const STRING_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
  const STANDARD_OPEN_MIDI = { guitar:[40,45,50,55,59,64], drop_d:[38,45,50,55,59,64], bass:[28,33,38,43] };
  const SCALE_INTERVALS = {
    major:[0,2,4,5,7,9,11], natural_minor:[0,2,3,5,7,8,10], harmonic_minor:[0,2,3,5,7,8,11],
    minor_pentatonic:[0,3,5,7,10], major_pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10],
    dorian:[0,2,3,5,7,9,10], phrygian:[0,1,3,5,7,8,10], mixolydian:[0,2,4,5,7,9,10]
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
    diatonic:[1,2,3,4,5,6,7,1], 'I-IV-V':[1,4,5,1], 'I-V-vi-IV':[1,5,6,4], 'ii-V-I':[2,5,1,1],
    'vi-IV-I-V':[6,4,1,5], '12_bar_blues':[1,1,1,1,4,4,1,1,5,4,1,5], 'i-VI-III-VII':[1,6,3,7]
  };

  let renderer = null;
  let activeBundle = null;
  let rafId = null;
  let currentPracticeTime = 0;
  let playAnchorMs = 0;
  let playAnchorChartTime = 0;
  let playing = false;
  let audioCtx = null;
  let audioNodes = [];

  function $(id) { return document.getElementById(id); }
  function pcName(pc) { return NOTE_NAMES[((pc % 12) + 12) % 12]; }
  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function goScreen(id) {
    if (window.slopsmith && typeof window.slopsmith.navigate === 'function') { window.slopsmith.navigate(id); return; }
    if (typeof window.showScreen === 'function') { window.showScreen(id); return; }
    const nav = document.querySelector(`[data-screen="${id}"]`);
    if (nav) nav.click();
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
    const instrument = data.get('instrument') || 'guitar';
    const tuningId = data.get('tuning') || 'standard';
    const stringCount = instrument === 'bass' || tuningId === 'bass_standard' ? 4 : 6;
    const fretMin = Math.max(0, parseInt(data.get('fretMin') || '0', 10));
    const fretMax = Math.max(fretMin + 1, parseInt(data.get('fretMax') || '5', 10));
    return {
      mode: data.get('mode') || 'scale',
      renderer: data.get('renderer') || 'highway_3d',
      instrument, tuningId, stringCount,
      key: data.get('key') || 'C',
      scale: data.get('scale') || 'major',
      bpm: Math.max(30, Math.min(260, parseFloat(data.get('bpm') || '100'))),
      meter: parseMeter(data.get('meter')),
      subdivision: data.get('subdivision') || 'eighth',
      fretMin, fretMax,
      bars: Math.max(1, Math.min(32, parseInt(data.get('bars') || '4', 10))),
      chordDepth: data.get('chordDepth') || 'triad',
      progression: data.get('progression') || 'diatonic',
      chordOverride: data.get('chordOverride') || 'auto',
      audio: { notes: data.get('audioNotes') === 'on', metronome: data.get('audioMetronome') === 'on' }
    };
  }

  function openMidisForConfig(cfg) {
    if (cfg.stringCount === 4) return STANDARD_OPEN_MIDI.bass.slice();
    return cfg.tuningId === 'drop_d' ? STANDARD_OPEN_MIDI.drop_d.slice() : STANDARD_OPEN_MIDI.guitar.slice();
  }
  function tuningOffsetsForConfig(cfg) {
    if (cfg.stringCount === 4) return [0,0,0,0,0,0];
    return cfg.tuningId === 'drop_d' ? [-2,0,0,0,0,0] : [0,0,0,0,0,0];
  }
  function noteDefaults(extra) {
    return Object.assign({ t:0, s:0, f:0, sus:0, sl:-1, slu:-1, bn:0, ho:false, po:false, hm:false, hp:false, pm:false, mt:false, vb:false, tr:false, ac:false, tp:false }, extra || {});
  }
  function scalePcs(cfg) {
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    return (SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major).map(i => (keyPc + i) % 12);
  }

  function positionsForPitchClass(pc, cfg) {
    const opens = openMidisForConfig(cfg);
    const out = [];
    for (let s = 0; s < cfg.stringCount; s++) {
      for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
        const midi = opens[s] + f;
        if (midi % 12 === pc) out.push({ s, f, midi, pc });
      }
    }
    return out.sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
  }

  function allScalePositions(cfg) {
    const pcs = new Set(scalePcs(cfg));
    const opens = openMidisForConfig(cfg);
    const chosen = [];
    const usedMidi = new Set();
    let lastMidi = -Infinity;

    for (let s = 0; s < cfg.stringCount; s++) {
      const candidates = [];
      for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
        const midi = opens[s] + f;
        const pc = midi % 12;
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
        chosen.push(p);
        usedMidi.add(p.midi);
        if (p.midi > lastMidi) lastMidi = p.midi;
      }
    }

    if (chosen.length > 1) return chosen;

    const fallback = [];
    for (let s = 0; s < cfg.stringCount; s++) {
      for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
        const midi = opens[s] + f;
        const pc = midi % 12;
        if (pcs.has(pc) && !usedMidi.has(midi)) {
          fallback.push({ s, f, midi, pc });
          usedMidi.add(midi);
        }
      }
    }
    return fallback.sort((a,b) => a.midi - b.midi || a.s - b.s || a.f - b.f);
  }

  function secondsPerDivision(cfg) {
    const q = 60 / cfg.bpm;
    return ({ quarter:q, eighth:q/2, sixteenth:q/4, triplet:q/3, eighth_triplet:q/3, sixteenth_triplet:q/6 })[cfg.subdivision] || q/2;
  }
  function measureSeconds(cfg) { return (60 / cfg.bpm) * (4 / cfg.meter.denominator) * cfg.meter.numerator; }
  function buildBeats(cfg, duration) {
    const beats = [];
    const beatUnit = (60 / cfg.bpm) * (4 / cfg.meter.denominator);
    const mLen = measureSeconds(cfg);
    const groupingStarts = new Set();
    let g = 0;
    for (const width of cfg.meter.grouping) { groupingStarts.add(g); g += width; }
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
  function buildAnchors(cfg, duration) {
    const out = [];
    const width = Math.max(3, cfg.fretMax - cfg.fretMin + 1);
    for (let t = 0; t <= duration + 0.0001; t += 2) out.push({ time: Number(t.toFixed(6)), fret: cfg.fretMin, width });
    return out;
  }

  function chordQualityForDegree(scale, depth, degree, override) {
    if (override && override !== 'auto') return override;
    const family = DIATONIC_QUALITIES[scale] || DIATONIC_QUALITIES.major;
    const row = family[depth === 'seventh' ? 'seventh' : 'triad'] || family.triad;
    return row[(degree - 1 + 7) % 7] || 'maj';
  }
  function chordRootForDegree(cfg, degree) {
    const keyPc = NOTE_ALIASES[cfg.key] ?? 0;
    const intervals = SCALE_INTERVALS[cfg.scale] || SCALE_INTERVALS.major;
    return (keyPc + intervals[(degree - 1 + intervals.length) % intervals.length]) % 12;
  }
  function pickChordPositions(cfg, rootPc, quality) {
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    const picked = [];
    const used = new Set();
    for (const interval of formula.intervals) {
      const pc = (rootPc + interval) % 12;
      const candidates = positionsForPitchClass(pc, cfg);
      const next = candidates.find(p => !used.has(`${p.s}:${p.f}`)) || candidates[0];
      if (next) { picked.push(Object.assign({}, next, { interval })); used.add(`${next.s}:${next.f}`); }
    }
    return picked.sort((a,b) => a.midi - b.midi || a.s - b.s);
  }
  function templateFromPositions(name, positions, cfg, arp) {
    const frets = new Array(cfg.stringCount).fill(-1);
    const fingers = new Array(cfg.stringCount).fill(-1);
    for (const p of positions) {
      if (!p || p.s < 0 || p.s >= cfg.stringCount) continue;
      if (frets[p.s] === -1 || p.f < frets[p.s]) frets[p.s] = p.f;
      fingers[p.s] = p.f === 0 ? 0 : 1;
    }
    return { name, displayName:name, arp:!!arp, fingers, frets };
  }
  function chordName(rootPc, quality) {
    const f = CHORD_FORMULAS[quality] || CHORD_FORMULAS.maj;
    return pcName(rootPc) + (f.symbol === 'maj' ? 'maj' : f.symbol);
  }

  function buildScaleExercise(cfg) {
    const positions = allScalePositions(cfg);
    if (!positions.length) throw new Error('No scale notes found inside this fret range.');
    const step = secondsPerDivision(cfg);
    const duration = cfg.bars * measureSeconds(cfg);
    const totalEvents = Math.max(1, Math.floor(duration / step));
    let path = positions.slice();
    if (path.length > 1) path = path.concat(positions.slice(1, -1).reverse());
    const notes = [];
    for (let i = 0; i < totalEvents; i++) {
      const p = path[i % path.length];
      notes.push(noteDefaults({ t:Number((i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.78), ac:i % Math.max(1, cfg.meter.numerator) === 0 }));
    }
    return { notes, chords:[], chordTemplates:[], handShapes:[], sections:[{ name:'scale-3nps', number:1, time:0 }], duration };
  }

  function buildArpeggioExercise(cfg, degrees) {
    const step = secondsPerDivision(cfg);
    const mLen = measureSeconds(cfg);
    const chordSlot = Math.max(step * 4, mLen);
    const chordTemplates = [];
    const chords = [];
    const handShapes = [];
    const notes = [];
    let t = 0;
    degrees.forEach(degree => {
      const rootPc = chordRootForDegree(cfg, degree);
      const quality = chordQualityForDegree(cfg.scale, cfg.chordDepth, degree, cfg.chordOverride);
      const positions = pickChordPositions(cfg, rootPc, quality);
      if (!positions.length) return;
      const name = chordName(rootPc, quality);
      const templateId = chordTemplates.length;
      chordTemplates.push(templateFromPositions(name, positions, cfg, true));
      chords.push({ t:Number(t.toFixed(6)), id:templateId, hd:false, notes:positions.map(p => noteDefaults({ s:p.s, f:p.f, sus:0 })) });
      handShapes.push({ chord_id:templateId, start_time:Number(t.toFixed(6)), end_time:Number((t + chordSlot).toFixed(6)), arp:true });
      const path = positions.concat(positions.slice(0, -1).reverse());
      const eventsThisChord = Math.max(1, Math.floor(chordSlot / step));
      for (let i = 0; i < eventsThisChord; i++) {
        const p = path[i % path.length];
        notes.push(noteDefaults({ t:Number((t + i * step).toFixed(6)), s:p.s, f:p.f, sus:Math.max(0.04, step * 0.72), ac:i === 0 }));
      }
      t += chordSlot;
    });
    return { notes, chords, chordTemplates, handShapes, sections:[{ name:'arpeggios', number:1, time:0 }], duration:Math.max(t, cfg.bars * mLen) };
  }

  function generateExercise(cfg) {
    const chart = cfg.mode === 'scale'
      ? buildScaleExercise(cfg)
      : buildArpeggioExercise(cfg, cfg.mode === 'diatonic_arpeggios' ? COMMON_PROGRESSIONS.diatonic : (COMMON_PROGRESSIONS[cfg.progression] || COMMON_PROGRESSIONS['I-V-vi-IV']));
    const duration = Math.max(chart.duration || 0, cfg.bars * measureSeconds(cfg));
    return { version:1, session:cfg, chart:Object.assign({}, chart, { beats:buildBeats(cfg, duration), anchors:buildAnchors(cfg, duration), duration }) };
  }

  function makeBundle(exercise) {
    const cfg = exercise.session;
    const c = exercise.chart;
    return {
      currentTime:0,
      songInfo:{ title:`SlopScale ${cfg.mode}`, artist:'SlopScale', arrangement:cfg.instrument === 'bass' ? 'Bass' : 'Lead', tuning:tuningOffsetsForConfig(cfg), capo:0, duration:c.duration, format:'slopscale-practice' },
      isReady:true,
      notes:c.notes, chords:c.chords, anchors:c.anchors, beats:c.beats, sections:c.sections,
      chordTemplates:c.chordTemplates, handShapes:c.handShapes,
      stringCount:cfg.stringCount, tuning:tuningOffsetsForConfig(cfg), capo:0,
      lyrics:[], toneChanges:[], toneBase:'', drumTab:null, mastery:1, hasPhraseData:false,
      inverted:false, lefty:false, renderScale:1, lyricsVisible:false, project:null, fretX:null,
      getNoteState:function(){return null;}, getNoteStateProvider:function(){return null;}
    };
  }

  function makeBuiltin2DRenderer() {
    let canvas = null, ctx = null, W = 0, H = 0;
    function resize() {
      if (!canvas) return;
      const r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(640, Math.round(r.width || 1280));
      H = Math.max(420, Math.round(r.height || 720));
      canvas.width = W; canvas.height = H;
    }
    function laneY(s, count) {
      const top = 95, bottom = H - 58;
      return bottom - (s * ((bottom - top) / Math.max(1, count - 1)));
    }
    function draw(bundle) {
      if (!ctx || !bundle) return;
      resize();
      const now = bundle.currentTime || 0;
      const ahead = 8, behind = 1.5;
      const nStr = Math.max(1, bundle.stringCount || 6);
      ctx.fillStyle = '#050711'; ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#08111f'); grad.addColorStop(1, '#050711'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1;
      for (let s = 0; s < nStr; s++) {
        const y = laneY(s, nStr);
        ctx.beginPath(); ctx.moveTo(54, y); ctx.lineTo(W - 32, y); ctx.stroke();
        ctx.fillStyle = STRING_COLORS[s] || '#94a3b8'; ctx.font = '700 12px system-ui'; ctx.fillText(`S${s + 1}`, 18, y + 4);
      }
      for (const b of bundle.beats || []) {
        const dt = b.time - now;
        if (dt < -behind || dt > ahead) continue;
        const x = 90 + (dt + behind) / (ahead + behind) * (W - 150);
        ctx.strokeStyle = b.measure >= 0 ? 'rgba(96,165,250,0.55)' : 'rgba(148,163,184,0.18)';
        ctx.beginPath(); ctx.moveTo(x, 72); ctx.lineTo(x, H - 36); ctx.stroke();
        if (b.measure >= 0) { ctx.fillStyle = '#93c5fd'; ctx.font = '11px system-ui'; ctx.fillText(String(b.measure), x + 4, 66); }
      }
      ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2;
      const playX = 90 + behind / (ahead + behind) * (W - 150);
      ctx.beginPath(); ctx.moveTo(playX, 60); ctx.lineTo(playX, H - 36); ctx.stroke();
      for (const ch of bundle.chords || []) {
        const dt = ch.t - now;
        if (dt < -behind || dt > ahead) continue;
        const x = 90 + (dt + behind) / (ahead + behind) * (W - 150);
        const name = bundle.chordTemplates?.[ch.id]?.displayName || bundle.chordTemplates?.[ch.id]?.name || '';
        ctx.fillStyle = 'rgba(168,85,247,0.18)'; ctx.fillRect(x - 38, 24, 76, 28);
        ctx.strokeStyle = 'rgba(168,85,247,0.75)'; ctx.strokeRect(x - 38, 24, 76, 28);
        ctx.fillStyle = '#e9d5ff'; ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(name, x, 43); ctx.textAlign = 'left';
      }
      for (const n of bundle.notes || []) {
        const dt = n.t - now;
        if (dt < -behind || dt > ahead) continue;
        const x = 90 + (dt + behind) / (ahead + behind) * (W - 150);
        const y = laneY(n.s, nStr);
        const col = STRING_COLORS[n.s] || '#94a3b8';
        if ((n.sus || 0) > 0) {
          const x2 = 90 + (dt + n.sus + behind) / (ahead + behind) * (W - 150);
          ctx.strokeStyle = col; ctx.globalAlpha = 0.38; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.min(W - 30, x2), y); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - 16, y - 12, 32, 24, 6); ctx.fill();
        ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = n.ac ? 3 : 1; ctx.stroke();
        ctx.fillStyle = '#020617'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(n.f), x, y + 5); ctx.textAlign = 'left';
      }
      ctx.fillStyle = '#e5e7eb'; ctx.font = '700 14px system-ui'; ctx.fillText(bundle.songInfo?.title || 'SlopScale', 18, 28);
      ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui'; ctx.fillText(`${now.toFixed(2)}s / ${(bundle.songInfo?.duration || 0).toFixed(2)}s`, 18, 48);
    }
    return { init(c) { canvas = c; ctx = c.getContext('2d'); resize(); window.addEventListener('resize', resize); }, draw, resize, destroy() { window.removeEventListener('resize', resize); canvas = null; ctx = null; } };
  }

  function loadScriptOnce(id, src) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) return resolve();
      const s = document.createElement('script');
      s.id = id; s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  async function resolveRendererFactory(kind) {
    if (kind === 'builtin_2d') return { factory:makeBuiltin2DRenderer, label:'Built-in 2D practice highway' };
    if (kind === 'highway_3d') {
      if (!window.slopsmithViz_highway_3d) await loadScriptOnce('slopscale-highway-3d-loader', '/api/plugins/highway_3d/screen.js');
      if (typeof window.slopsmithViz_highway_3d === 'function') return { factory:window.slopsmithViz_highway_3d, label:'Existing 3D Highway' };
      throw new Error('3D Highway renderer factory was not found.');
    }
    for (const [globalName, label] of [['slopsmithViz_tab_2d','Existing 2D tab renderer'], ['slopsmithViz_highway_2d','Existing 2D highway renderer'], ['slopsmithViz_classic_2d','Existing classic 2D renderer']]) {
      if (typeof window[globalName] === 'function') return { factory:window[globalName], label };
    }
    throw new Error('No compatible 2D/tab renderer factory is currently exposed by Slopsmith.');
  }

  function replaceCanvas() {
    const host = $('slopscale-render-host');
    const old = $('slopscale-canvas');
    const canvas = document.createElement('canvas');
    canvas.id = 'slopscale-canvas';
    canvas.style.width = '100%'; canvas.style.height = '100%';
    if (old) old.replaceWith(canvas); else host.appendChild(canvas);
    const rect = host.getBoundingClientRect();
    canvas.width = Math.max(640, Math.round(rect.width || 1280));
    canvas.height = Math.max(420, Math.round(rect.height || 720));
    return canvas;
  }
  function stopAudio() {
    for (const n of audioNodes) {
      try { n.stop && n.stop(0); } catch {}
      try { n.disconnect && n.disconnect(); } catch {}
    }
    audioNodes = [];
  }
  function stopRenderer() {
    playing = false;
    stopAudio();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (renderer && typeof renderer.destroy === 'function') { try { renderer.destroy(); } catch (e) { console.warn('[SlopScale] renderer destroy failed', e); } }
    renderer = null;
  }

  async function attachRenderer(exercise) {
    const cfg = exercise.session;
    stopRenderer();
    activeBundle = makeBundle(exercise);
    currentPracticeTime = 0;
    const canvas = replaceCanvas();
    const resolved = await resolveRendererFactory(cfg.renderer);
    renderer = resolved.factory();
    if (!renderer || typeof renderer.draw !== 'function') throw new Error('Selected renderer did not return a Slopsmith-compatible renderer object.');
    if (typeof renderer.init === 'function') {
      renderer.init(canvas, activeBundle);
      if (renderer.readyPromise && typeof renderer.readyPromise.then === 'function') await renderer.readyPromise;
    }
    const rect = canvas.parentElement.getBoundingClientRect();
    if (typeof renderer.resize === 'function') renderer.resize(Math.round(rect.width || canvas.width), Math.round(rect.height || canvas.height));
    $('slopscale-renderer-status').textContent = `Renderer: ${resolved.label}`;
    drawOnce();
  }
  function drawOnce() {
    if (!renderer || !activeBundle) return;
    activeBundle.currentTime = currentPracticeTime;
    renderer.draw(activeBundle);
  }
  function tick(nowMs) {
    if (!renderer || !activeBundle) return;
    if (playing) {
      currentPracticeTime = playAnchorChartTime + (nowMs - playAnchorMs) / 1000;
      const duration = activeBundle.songInfo.duration || 1;
      if (currentPracticeTime > duration) {
        currentPracticeTime = 0;
        playAnchorChartTime = 0;
        playAnchorMs = nowMs;
        stopAudio();
        schedulePreviewAudio(activeBundle, currentPracticeTime);
      }
    }
    drawOnce();
    rafId = requestAnimationFrame(tick);
  }

  function scheduleTone(ctx, when, freq, dur, amp, type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, dur));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(when); osc.stop(when + Math.max(0.05, dur) + 0.03);
    audioNodes.push(osc, gain);
  }
  function schedulePreviewAudio(bundle, fromTime) {
    const cfg = readConfig();
    if (!cfg.audio.notes && !cfg.audio.metronome) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const ctx = audioCtx;
    const base = ctx.currentTime + 0.035;
    const startFrom = fromTime || 0;
    const opens = openMidisForConfig(cfg);
    const duration = bundle.songInfo?.duration || 0;
    if (cfg.audio.notes) {
      for (const n of bundle.notes || []) {
        if (n.t < startFrom || n.t > duration + 0.1) continue;
        if (n.s < 0 || n.s >= opens.length || n.f < 0) continue;
        scheduleTone(ctx, base + (n.t - startFrom), midiToFreq(opens[n.s] + n.f), Math.max(0.08, Math.min(0.75, n.sus || 0.2)), 0.08, 'triangle');
      }
    }
    if (cfg.audio.metronome) {
      for (const b of bundle.beats || []) {
        if (b.time < startFrom || b.time > duration + 0.1) continue;
        const accent = (b.measure || -1) >= 0;
        scheduleTone(ctx, base + (b.time - startFrom), accent ? 1760 : 1120, accent ? 0.055 : 0.04, accent ? 0.18 : 0.12, 'square');
      }
    }
  }
  function startPlayback() {
    if (!activeBundle) return;
    stopAudio();
    playing = true;
    playAnchorChartTime = currentPracticeTime;
    playAnchorMs = performance.now();
    schedulePreviewAudio(activeBundle, currentPracticeTime);
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function stopPlayback() {
    playing = false;
    currentPracticeTime = 0;
    playAnchorChartTime = 0;
    stopAudio();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    drawOnce();
  }

  function summarize(exercise) {
    const cfg = exercise.session;
    const c = exercise.chart;
    const meter = `${cfg.meter.numerator}/${cfg.meter.denominator}`;
    return [
      `Mode: ${cfg.mode}`,
      `Pattern: 3-notes-per-string default`,
      `Key/scale: ${cfg.key} ${cfg.scale}`,
      `BPM/meter/division: ${cfg.bpm} BPM, ${meter}, ${cfg.subdivision}`,
      `Position: frets ${cfg.fretMin}-${cfg.fretMax}`,
      `Audio: notes ${cfg.audio.notes ? 'on' : 'off'}, metronome ${cfg.audio.metronome ? 'on' : 'off'}`,
      `Generated: ${c.notes.length} notes, ${c.chords.length} chords, ${c.chordTemplates.length} templates, ${c.handShapes.length} hand shapes, ${c.beats.length} beats`,
      `Duration: ${c.duration.toFixed(2)}s`
    ].join('\n');
  }
  async function onGenerate() {
    const status = $('slopscale-chart-status');
    const summary = $('slopscale-summary');
    try {
      const exercise = generateExercise(readConfig());
      status.textContent = 'Chart: generated';
      summary.textContent = summarize(exercise);
      await attachRenderer(exercise);
    } catch (e) {
      status.textContent = 'Chart: error';
      summary.textContent = `Error: ${e.message || e}`;
      console.error('[SlopScale] generate failed', e);
    }
  }

  async function savePreset() {
    const cfg = readConfig();
    const name = `${cfg.key} ${cfg.scale} ${cfg.mode}`;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const res = await fetch('/api/plugins/slopscale/presets', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ id, name, kind:cfg.mode, config:cfg }) });
    if (!res.ok) throw new Error(await res.text());
    $('slopscale-summary').textContent += `\n\nSaved preset: ${name}`;
  }

  function bind() {
    const root = $('slopscale-root');
    if (!root || root.dataset.slopscaleInit === '1') return false;
    root.dataset.slopscaleInit = '1';
    $('slopscale-generate').addEventListener('click', onGenerate);
    $('slopscale-play').addEventListener('click', startPlayback);
    $('slopscale-stop').addEventListener('click', stopPlayback);
    $('slopscale-save').addEventListener('click', () => savePreset().catch(e => { $('slopscale-summary').textContent += `\n\nPreset save failed: ${e.message || e}`; }));
    $('slopscale-go-library')?.addEventListener('click', () => { stopRenderer(); goScreen('home'); });
    $('slopscale-go-plugins')?.addEventListener('click', () => { stopRenderer(); goScreen('plugins'); });
    $('slopscale-controls').addEventListener('change', () => { if (activeBundle) onGenerate(); });
    onGenerate();
    return true;
  }
  function boot() {
    if (bind()) return;
    let tries = 0;
    const timer = setInterval(() => { tries += 1; if (bind() || tries > 40) clearInterval(timer); }, 250);
  }

  window.SlopScale = { generateExercise, makeBundle, resolveRendererFactory };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
