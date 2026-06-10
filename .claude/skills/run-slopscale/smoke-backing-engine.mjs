// Smoke: the backing-engine core — chart.timeline + seeded determinism.
// Owns the backing-engine SYSTEM per the per-system growth rule (CLAUDE.md):
// new backing-engine asserts land as rows HERE, not as new suite files.
//
//   1. chart.timeline structural validity for EVERY style palette — non-empty,
//      slot-sorted, contiguous, durBeats>0, covers the chart, and the bar-locked
//      degenerate case (durBeats == meter numerator) holds when no harmonicRhythm.
//   2. Sub-bar harmonic rhythm ('2/bar') — twice the events, half the slot.
//   3. applyTimelinePush semantics — anticipation moves the SOUNDING start
//      early, truncates the previous chord's tail, clamps at chart time 0.
//   4. Seeded determinism — same cfg => byte-identical chart, even for
//      direction:'random' (the one shuffle in the core); explicit humanSeed
//      reproduces / varies the roll; chart carries humanSeed.
//   5. Key-cycle charts carry a PER-RUNG timeline (keys change across rungs).
//   6. Session charts assemble the timeline PER-BLOCK (the desync rule) —
//      block B's window holds block B's harmony, not block A's.
//   7. Rolling-window scheduler ceiling — Play on a 30-min Woodshed creates a
//      bounded number of audio nodes (was 39k whole-pass) with no second-long
//      main-thread block. Guards backing-engine step 0.
//   8. DRUM_GROOVES (backing-engine step 5) — the groove library tiles to valid
//      events; routing by style/profile; jazz constraints (feathered kick, hat
//      foot, no backbeat); fills (toms, hat-mute, crash); seeded determinism;
//      odd-meter fallback.
import { chromium } from "playwright";
const HOST = process.env.SLOPSCALE_HOST || "http://127.0.0.1:8765";
let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL ${label} ${detail}`); }
};

const browser = await chromium.launch({ headless: true });
const step = (s) => console.log(`  .. ${s}`);
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    globalThis.__SS_HARNESS__ = true;
    // Audio-node creation counter + longtask log for the scheduler-ceiling row.
    window.__nodeCount = 0;
    const P = (window.AudioContext || window.webkitAudioContext)?.prototype;
    if (P) ["createOscillator", "createGain", "createBufferSource", "createBiquadFilter", "createDynamicsCompressor"].forEach((n) => {
      const orig = P[n];
      if (orig) P[n] = function (...a) { window.__nodeCount++; return orig.apply(this, a); };
    });
    window.__longTasks = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch {}
  });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  // showScreen can throw from inside the host if called mid-boot (a race seen
  // intermittently as a minified host error) — retry briefly.
  for (let i = 0; ; i++) {
    try { await page.evaluate(() => window.showScreen("plugin-slopscale")); break; }
    catch (e) { if (i >= 2) throw e; await page.waitForTimeout(1500); }
  }
  await page.waitForSelector("#slopscale-root", { state: "attached" });
  await page.waitForSelector(".slopscale-view-btn");
  await page.waitForFunction(() => window.SlopScale && typeof window.SlopScale.generateExercise === "function" && globalThis.__ss_debug);
  await page.waitForTimeout(600);   // let the screen's boot settle (first-load race)

  // ── (1)+(2) timeline validity per style palette + bar-lock degenerate ──────
  step("styles");
  const styles = await page.evaluate(() => {
    const S = window.SlopScale;
    const out = [];
    for (const id of Object.keys(S.STYLE_PALETTES)) {
      const cfg = Object.assign({}, S.readConfig(), S.stylePaletteConfig(id), { practiceType: "chord_scales", keyCycle: "none" });
      let r;
      try {
        const ex = S.generateExercise(cfg);
        const tl = ex.chart.timeline || [];
        const dur = ex.chart.duration || 0;
        let sorted = true, contiguous = true, durOk = true, barLock = true;
        const num = cfg.meter.numerator;
        for (let i = 0; i < tl.length; i++) {
          if (!(tl[i].durBeats > 0)) durOk = false;
          if (i && tl[i].startBeat < tl[i - 1].startBeat) sorted = false;
          if (i && Math.abs((tl[i - 1].startBeat + tl[i - 1].durBeats) - tl[i].startBeat) > 1e-3) contiguous = false;
          if (Math.abs(tl[i].durBeats - num) > 1e-3) barLock = false;   // no palette sets harmonicRhythm yet
        }
        const covers = tl.length && Math.abs(tl[tl.length - 1].endSec - dur) < 0.05;
        r = { id, n: tl.length, sorted, contiguous, durOk, barLock, covers };
      } catch (e) { r = { id, err: String(e && e.message || e) }; }
      out.push(r);
    }
    return out;
  });
  for (const s of styles) {
    ok(!s.err, `style ${s.id}: generates`, s.err || "");
    if (s.err) continue;
    ok(s.n > 0 && s.sorted && s.contiguous && s.durOk && s.covers, `style ${s.id}: timeline valid`, `n=${s.n} sorted=${s.sorted} contig=${s.contiguous} dur>0=${s.durOk} covers=${s.covers}`);
    ok(s.barLock, `style ${s.id}: bar-locked degenerate (durBeats == numerator)`, "");
  }

  step("2/bar");
  const sub = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign({}, S.readConfig(), { practiceType: "chord_scales", progression: "ii-V-I", key: "C", scale: "major", bars: 4, keyCycle: "none" });
    const one = S.generateExercise(base).chart.timeline;
    const two = S.generateExercise(Object.assign({}, base, { harmonicRhythm: "2/bar" })).chart.timeline;
    const num = base.meter.numerator;
    return {
      n1: one.length, n2: two.length,
      halfSlot: two.every(e => Math.abs(e.durBeats - num / 2) < 1e-3),
      contiguous: two.every((e, i) => !i || Math.abs((two[i - 1].startBeat + two[i - 1].durBeats) - e.startBeat) < 1e-3),
    };
  });
  ok(sub.n2 === sub.n1 * 2 && sub.halfSlot && sub.contiguous, "harmonicRhythm 2/bar: twice the events at half the slot", `n1=${sub.n1} n2=${sub.n2} half=${sub.halfSlot} contig=${sub.contiguous}`);

  // ── (3) push semantics (pure helper via the harness debug surface) ─────────
  step("push");
  const push = await page.evaluate(() => {
    const S = window.SlopScale, D = globalThis.__ss_debug;
    const cfg = Object.assign({}, S.readConfig(), { practiceType: "chord_scales", progression: "ii-V-I", key: "C", bars: 4, keyCycle: "none" });
    const dur = 4 * (cfg.bars ? 1 : 1) * 0 + 8;                       // 8s synthetic window
    const beatSec = (() => { const tl = D.compileChordTimeline(cfg, dur); return (tl[0].endSec - tl[0].startSec) / tl[0].durBeats; })();
    const tl = D.compileChordTimeline(cfg, dur);
    const slot1 = tl[1].startSec, prevEnd0 = tl[0].endSec;
    tl[1].push = 0.5;
    tl[0].push = 4;                                                    // absurd push on the FIRST event -> clamp at 0
    D.applyTimelinePush(tl, cfg, dur);
    return {
      movedEarly: Math.abs(tl[1].startSec - (slot1 - 0.5 * beatSec)) < 1e-3,
      prevTruncated: Math.abs(tl[0].endSec - tl[1].startSec) < 1e-3 && tl[0].endSec < prevEnd0,
      slotUntouched: Math.abs(tl[1].startBeat * beatSec - slot1) < 1e-3,
      firstClamped: tl[0].startSec === 0,
    };
  });
  ok(push.movedEarly, "push: sounding start moves early by push*beatSec", "");
  ok(push.prevTruncated, "push: previous chord's tail truncates at the anticipated start", "");
  ok(push.slotUntouched, "push: the harmonic SLOT (startBeat) is untouched", "");
  ok(push.firstClamped, "push: first event clamps at chart time 0", "");

  // ── (4) seeded determinism ──────────────────────────────────────────────────
  step("determinism");
  const det = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign({}, S.readConfig(), {
      practiceType: "scale", scale: "major", key: "C", fretboardSystem: "full_neck",
      direction: "random", repeatCount: 2, bars: 4, keyCycle: "none", advancedMode: true,
    });
    const j = (cfg) => JSON.stringify(S.generateExercise(cfg).chart);
    const a1 = j(base), a2 = j(base);
    const s1 = j(Object.assign({}, base, { humanSeed: 123 }));
    const s1b = j(Object.assign({}, base, { humanSeed: 123 }));
    const s2 = j(Object.assign({}, base, { humanSeed: 456 }));
    const seedOnChart = S.generateExercise(base).chart.humanSeed;
    return { stable: a1 === a2, seedStable: s1 === s1b, seedVaries: s1 !== s2, seedOnChart: Number.isFinite(seedOnChart) };
  });
  ok(det.stable, "determinism: same cfg => byte-identical chart (direction:'random')", "");
  ok(det.seedStable, "determinism: same humanSeed => identical chart", "");
  ok(det.seedVaries, "determinism: different humanSeed => different roll", "");
  ok(det.seedOnChart, "chart carries humanSeed", "");

  // ── (5) key-cycle: per-rung timeline, keys actually change ─────────────────
  step("key-cycle");
  const kc = await page.evaluate(() => {
    const S = window.SlopScale;
    const cfg = Object.assign({}, S.readConfig(), {
      practiceType: "scale", scale: "major", key: "C", progression: "ii-V-I",
      keyCycle: "circle_of_fifths", keyCycleLength: 3, bars: 2, advancedMode: true,
    });
    const ch = S.generateExercise(cfg).chart;
    const tl = ch.timeline || [];
    const secs = (ch.sections || []).map(s => s.time);
    const evAt = (t) => tl.find(e => e.startSec >= t - 1e-3);
    const r1 = evAt(secs[0] || 0), r2 = evAt(secs[1] || -1);
    const monotonic = tl.every((e, i) => !i || e.startSec >= tl[i - 1].startSec - 1e-6);
    return { n: tl.length, monotonic, keysDiffer: !!(r1 && r2 && r1.rootPc !== r2.rootPc) };
  });
  ok(kc.n > 0, "key-cycle chart carries a timeline", `n=${kc.n}`);
  ok(kc.monotonic, "key-cycle timeline is time-monotonic", "");
  ok(kc.keysDiffer, "key-cycle timeline changes key per rung (not the start key everywhere)", "");

  // ── (6) session: per-block timeline (the desync rule for harmony) ──────────
  step("session");
  const ses = await page.evaluate(() => {
    const S = window.SlopScale;
    const session = {
      name: "tl-test", stringSetup: "guitar_6_standard",
      segments: [
        { name: "A", kind: "scale", config: { key: "C",  progression: "ii-V-I", bars: 2, bpm: 100 } },
        { name: "B", kind: "scale", config: { key: "F#", progression: "ii-V-I", bars: 2, bpm: 100 } },
      ],
    };
    const ch = S.generateSession(session).chart;
    const tl = ch.timeline || [], bounds = ch.segmentBounds || [];
    if (tl.length === 0 || bounds.length !== 2) return { n: tl.length, nb: bounds.length };
    const roots = (b) => new Set(tl.filter(e => e.startSec >= b.start - 1e-3 && e.startSec < b.end - 1e-3).map(e => e.rootPc));
    const ra = roots(bounds[0]), rb = roots(bounds[1]);
    const overlap = [...ra].filter(x => rb.has(x));
    const monotonic = tl.every((e, i) => !i || e.startSec >= tl[i - 1].startSec - 1e-6);
    return { n: tl.length, nb: bounds.length, monotonic, ra: [...ra], rb: [...rb], overlap };
  });
  ok(ses.n > 0 && ses.nb === 2, "session chart carries a timeline + bounds", `n=${ses.n} bounds=${ses.nb}`);
  ok(ses.monotonic, "session timeline is time-monotonic", "");
  ok(ses.overlap && ses.overlap.length === 0, "block B's window holds block B's harmony (C vs F# ii-V-I roots disjoint)", `A=${ses.ra} B=${ses.rb}`);

  // ── (8) voice-leading between backing chords (step 2) ──────────────────────
  step("voice-leading");
  const vl = await page.evaluate(() => {
    const S = window.SlopScale;
    const cfg = Object.assign({}, S.readConfig(), {
      practiceType: "chord_scales", progression: "ii-V-I", key: "C", scale: "major",
      chordDepth: "seventh", chordOverride: "auto", bars: 4, keyCycle: "none",
      audio: { notes: false, metronome: false, harmony: true },
    });
    // Single-exercise backing is synthesized at bundle time (makeBundle), not on
    // the chart — go through it like playback does.
    const bundle = S.makeBundle(S.generateExercise(cfg));
    const pads = (bundle.backingEvents || []).filter(e => !e.role && e.midis && e.midis.length);
    const probs = [];
    let seams = 0, holds = 0;
    for (let i = 1; i < pads.length; i++) {
      const a = pads[i - 1], b = pads[i];
      if (a.name === b.name && a.name) continue;                       // coalesce handles identicals
      const apcs = new Set(a.midis.map(m => m % 12)), bpcs = new Set(b.midis.map(m => m % 12));
      const share = [...apcs].some(pc => bpcs.has(pc));
      if (!share) continue;
      seams++;
      // Common tone must HOLD at the same literal MIDI (the comper's hand).
      if (b.midis.some(m => a.midis.includes(m))) holds++;
      else probs.push(`${a.name}->${b.name}: no literal common tone (${a.midis} vs ${b.midis})`);
      const upper = b.midis.slice(1);
      if (upper.length && (upper[upper.length - 1] - upper[0]) > 14) probs.push(`${b.name}: upper span ${upper[upper.length - 1] - upper[0]} > 14`);
      if (b.midis.length > 5) probs.push(`${b.name}: ${b.midis.length} voices > 5`);
    }
    return { seams, holds, probs: probs.slice(0, 4) };
  });
  ok(vl.seams > 0 && vl.holds === vl.seams, "voice-leading: common tones hold literally at every shared-pc chord seam", `${vl.holds}/${vl.seams} ${vl.probs.join(" | ")}`);

  // ── (9) modal-M1 palette ride-along (funk goes Dorian; rock/jazz tokens) ────
  const m1 = await page.evaluate(() => {
    const P = window.SlopScale.STYLE_PALETTES;
    return {
      funkDorian: P.funk.progressions[0] === "dorian_vamp" && P.funk.chordOverride === "auto",
      rockMixo: P.rock.progressions.includes("mixolydian_rock"),
      jazzSoWhat: P.jazz.progressions.includes("so_what"),
    };
  });
  ok(m1.funkDorian, "funk palette leads with dorian_vamp + chordOverride auto (the dom7 IV sounds)", "");
  ok(m1.rockMixo, "rock palette carries mixolydian_rock", "");
  ok(m1.jazzSoWhat, "jazz palette carries so_what", "");

  // ── (6b) COMP_GROOVES (step 3): the pad-kill, density, suppression ──────────
  step("COMP_GROOVES (step 3)");
  const c3 = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 100, bars: 4,
      progression: "I-V-vi-IV", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingDensity: undefined, backingPadDev: false,
    });
    const gen = (over) => S.makeBundle(S.generateExercise(Object.assign({}, base, over)));
    const harm = (b) => (b.backingEvents || []).filter((e) => e.role !== "drums" && e.role !== "bass");
    const out = {};
    // (a) undeclared cfg keeps the legacy coalesced pad
    const pad = harm(gen({}));
    out.padCount = pad.length; out.padHasVel = pad.some((e) => e.vel != null);
    // (b) a declared cell re-articulates: many short velocity-tiered hits
    const comp = harm(gen({ backingComp: "four_comp" }));
    out.compCount = comp.length;
    out.compVels = [...new Set(comp.map((e) => e.vel))].sort().join(",");
    out.compShort = comp.every((e) => e.end - e.t < 1.5);
    out.compLabeled = comp.filter((e) => e.cpcs).length;
    // (c) the jazz pilot: swung non-boogie cfg auto-picks the Charleston
    const jazz = harm(gen({ swing: "swing_8", backingComp: "" }));
    out.jazzComp = jazz.some((e) => e.comp === "charleston");
    // (d) density 1 = the half-note vamp; density 0 = click only
    const vamp = harm(gen({ backingDensity: 1 }));
    out.vampComp = vamp.length > 0 && vamp.every((e) => e.comp === "vamp_half");
    out.density0 = (gen({ backingDensity: 0 }).backingEvents || []).length;
    // (e) player-is-the-comp: strum_comp suppresses the comp lane
    const sc = gen({ practiceType: "strum_comp", mode: "strum_comp", chordDepth: "triad", chordOverride: "auto", voicingPosition: "open", subdivision: "eighth" });
    out.scComp = (sc.backingEvents || []).filter((e) => e.role !== "drums").length;
    // (f) the A/B dev flag forces the pad even with a cell declared
    const dev = harm(gen({ backingComp: "four_comp", backingPadDev: true }));
    out.devPad = dev.length === pad.length && dev.every((e) => e.vel == null);
    return out;
  });
  ok(c3.padCount > 0 && !c3.padHasVel, "undeclared cfg keeps the legacy coalesced pad", `events=${c3.padCount}`);
  ok(c3.compCount >= c3.padCount * 3 && c3.compShort, "a declared cell re-articulates the comp (the pad-kill)", `hits=${c3.compCount} vs pad=${c3.padCount}`);
  ok(c3.compVels.includes("0.78") && c3.compVels.includes("1"), "hits carry the sound-design velocity tiers", `vels=${c3.compVels}`);
  ok(c3.compLabeled > 0, "chord-change labels survive re-articulation (one labeled hit per change)", `labeled=${c3.compLabeled}`);
  ok(c3.jazzComp, "the jazz pilot: swung cfg auto-picks the Charleston cell");
  ok(c3.vampComp, "backingDensity 1 = the half-note vamp");
  ok(c3.density0 === 0, "backingDensity 0 = click only (no backing events at all)", `events=${c3.density0}`);
  ok(c3.scComp === 0, "player-is-the-comp: strum_comp suppresses the comp lane", `comp=${c3.scComp}`);
  ok(c3.devPad, "the pad-vs-comp A/B dev flag forces the legacy pad");

  // ── (6c) BASS_FIGURES (step 4): walking/figures, kick lock, lift, mute ──────
  step("BASS_FIGURES (step 4)");
  const c4 = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 100, bars: 4,
      progression: "I-V-vi-IV", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingBass: "", backingDensity: undefined, backingPadDev: false,
    });
    const gen = (over) => {
      const cfg = Object.assign({}, base, over);
      const ex = S.generateExercise(cfg);
      const b = S.makeBundle(ex);
      return { b, tl: ex.chart.timeline || [], lead: b.leadIn || 0 };
    };
    const bass = (b) => (b.backingEvents || []).filter((e) => e.role === "bass");
    const harm = (b) => (b.backingEvents || []).filter((e) => e.role !== "drums" && e.role !== "bass");
    const out = {};
    // (a) the jazz pilot walks: swung cfg → walking line, root on 1 at the
    // chord slot (the kick lock), accent velocity on the landing.
    const jz = gen({ swing: "swing_8" });
    const jzB = bass(jz.b);
    out.walkFig = jzB.length > 0 && jzB.every((e) => e.fig === "walking");
    out.walkRootOn1 = jz.tl.length > 0 && jz.tl.every((c) => {
      const hit = jzB.find((e) => Math.abs(e.t - (c.startSec + jz.lead)) < 1e-3);
      return hit && hit.midis[0] % 12 === ((c.rootPc % 12) + 12) % 12 && hit.vel === 1;
    });
    // (b) range + leap discipline (the bass-pedagogy realism numbers)
    const mids = jzB.map((e) => e.midis[0]);
    out.range = mids.every((m) => m >= 28 && m <= 51);
    let badLeap = 0;
    for (let i = 1; i < mids.length; i++) { const g = Math.abs(mids[i] - mids[i - 1]); if (g > 9 && g !== 12) badLeap++; }
    out.badLeap = badLeap;
    out.noRepeat = mids.every((m, i) => i === 0 || m !== mids[i - 1] || jzB[i].vel === 0.45);
    // (c) approach semantics: the note before each change targets the next root
    // — chromatic ±1, scalar ±2, or the dominant (the next chord's 5th, pc
    // diff 7). Compare pitch classes (octave-agnostic).
    let seams = 0, approaches = 0;
    for (let i = 1; i < jz.tl.length; i++) {
      const c = jz.tl[i], prevHits = jzB.filter((e) => e.t < c.startSec + jz.lead - 1e-3);
      if (!prevHits.length) continue;
      const last = prevHits[prevHits.length - 1].midis[0];
      const diff = ((last % 12) - (((c.rootPc % 12) + 12) % 12) + 12) % 12;
      seams++;
      if ([1, 2, 7, 10, 11].includes(diff)) approaches++;
    }
    out.seams = seams; out.approaches = approaches;
    // (d) the boogie full-recipe migration: cell + figure; the A/B flag keeps
    // the bespoke pre-step-4 builder (no comp/fig tags).
    const bg = gen({ backingStyle: "boogie", swing: "shuffle" });
    const bgB = bass(bg.b), bgH = harm(bg.b);
    out.boogieFig = bgB.length > 0 && bgB.every((e) => e.fig === "bass_ostinato");
    out.boogieCell = bgH.length > 0 && bgH.every((e) => e.comp === "boogie_stab");
    out.boogieShape = bg.tl.slice(0, 4).every((c) => {
      const hits = bgB.filter((e) => e.t >= c.startSec + bg.lead - 1e-3 && e.t < c.endSec + bg.lead - 1e-3).map((e) => e.midis[0]);
      return hits.length >= 4 && hits[1] - hits[0] === 7 && hits[2] - hits[0] === 9 && hits[3] - hits[0] === 10;
    });
    const bgDev = gen({ backingStyle: "boogie", swing: "shuffle", backingPadDev: true });
    out.boogieLegacy = bass(bgDev.b).length > 0 && (bgDev.b.backingEvents || []).every((e) => !e.fig && !e.comp);
    // (e) player-is-the-bassist: a bass cfg mutes the figure, keeps the comp
    const bz = gen({ swing: "swing_8", stringSetup: "bass_4_standard", instrument: "bass" });
    out.bassMuted = bass(bz.b).length === 0 && harm(bz.b).length > 0;
    // (f) register lift: comp drops its folded root when a figure plays
    out.liftOn = Math.min(...harm(jz.b).flatMap((e) => e.midis)) >= 48;
    out.liftOff = Math.min(...harm(gen({}).b).flatMap((e) => e.midis)) < 48;
    // (g) authored figures: motown (ghosts + root on 1), root_pump, two_feel
    const mo = gen({ backingBass: "motown_counter" });
    const moB = bass(mo.b);
    out.motown = moB.length > 0 && moB.every((e) => e.fig === "motown_counter")
      && moB.some((e) => e.vel === 0.45)
      && mo.tl.every((c) => { const h = moB.find((e) => Math.abs(e.t - (c.startSec + mo.lead)) < 1e-3); return h && h.midis[0] % 12 === ((c.rootPc % 12) + 12) % 12; });
    const rpG = gen({ backingBass: "root_pump" });
    const rpB = bass(rpG.b);
    out.rootPump = rpB.length > 0 && rpB.every((e) => e.fig === "root_pump")
      && rpG.tl.slice(0, 2).every((c) => {
        const hits = rpB.filter((e) => e.t >= c.startSec + rpG.lead - 1e-3 && e.t < c.endSec + rpG.lead - 1e-3);
        return hits.length === 8 && hits.every((e) => e.midis[0] % 12 === ((c.rootPc % 12) + 12) % 12);
      });
    const tf = gen({ backingBass: "two_feel" });
    const tfB = bass(tf.b);
    out.twoFeel = tf.tl.length > 0 && tf.tl.slice(0, 2).every((c) => {
      const hits = tfB.filter((e) => e.t >= c.startSec + tf.lead - 1e-3 && e.t < c.endSec + tf.lead - 1e-3).map((e) => e.midis[0]);
      return hits.length === 2 && (hits[1] - hits[0] + 12) % 12 === 7;
    });
    // (h) density 1 (vamp) has no bass figure
    out.density1 = bass(gen({ swing: "swing_8", backingDensity: 1 }).b).length === 0;
    // (i) determinism: the seeded generator rolls the same line every build
    const j1 = JSON.stringify(gen({ swing: "swing_8" }).b.backingEvents);
    const j2 = JSON.stringify(gen({ swing: "swing_8" }).b.backingEvents);
    out.deterministic = j1 === j2;
    // (j) exactly ONE labeled carrier per chord change (no label spam)
    const cars = (jz.b.backingEvents || []).filter((e) => e.cpcs);
    const named = (jz.b.backingEvents || []).filter((e) => e.name);
    out.carriers = cars.length; out.namedN = named.length; out.tlN = jz.tl.length;
    return out;
  });
  ok(c4.walkFig, "jazz pilot: swung cfg walks a role:'bass' line (fig='walking')");
  ok(c4.walkRootOn1, "walking lands the ROOT on beat 1 of every change, at the kick's slot, accented");
  ok(c4.range, "the line stays in the backing-bass register (MIDI 28–51)");
  ok(c4.badLeap === 0, "leaps ≤9 semitones (octave whitelisted)", `bad=${c4.badLeap}`);
  ok(c4.noRepeat, "no repeated adjacent pitches in the walk");
  ok(c4.seams > 0 && c4.approaches === c4.seams, "every change is approached (chromatic/scalar/dominant into the next root)", `${c4.approaches}/${c4.seams}`);
  ok(c4.boogieFig && c4.boogieCell, "boogie full-recipe migration: bass_ostinato figure + boogie_stab cell", `fig=${c4.boogieFig} cell=${c4.boogieCell}`);
  ok(c4.boogieShape, "the boogie figure walks root–5–6–♭7 on the beats (ported verbatim)");
  ok(c4.boogieLegacy, "the A/B dev flag keeps the bespoke pre-step-4 boogie");
  ok(c4.bassMuted, "player-is-the-bassist: a bass cfg MUTES the figure, keeps the comp");
  ok(c4.liftOn && c4.liftOff, "register lift: the comp drops its folded root (≥48) only while a figure plays", `on=${c4.liftOn} off=${c4.liftOff}`);
  ok(c4.motown, "authored motown_counter: root on 1, dead-thumb ghosts at the ghost tier");
  ok(c4.rootPump, "authored root_pump emits the eighth-note pump");
  ok(c4.twoFeel, "authored two_feel: root on 1, the 5th on beat 3");
  ok(c4.density1, "backingDensity 1 (vamp) carries no bass figure");
  ok(c4.deterministic, "the seeded walk is byte-identical across builds (determinism)");
  ok(c4.carriers === c4.tlN && c4.namedN === c4.tlN, "exactly ONE labeled cpcs carrier per chord change", `carriers=${c4.carriers} named=${c4.namedN} changes=${c4.tlN}`);

  // ── (6d) step-4 VETTING fixes (bass-pedagogy / blues / jazz, 2026-06-07) ────
  step("vetting fixes (6d)");
  const c5 = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 120, bars: 8,
      progression: "ii-V-I", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "swing_8", backingComp: "", backingBass: "", backingDensity: undefined, backingPadDev: false,
    });
    const gen = (over) => {
      const cfg = Object.assign({}, base, over);
      const ex = S.generateExercise(cfg);
      const b = S.makeBundle(ex);
      return { b, tl: ex.chart.timeline || [], lead: b.leadIn || 0 };
    };
    const bass = (b) => (b.backingEvents || []).filter((e) => e.role === "bass");
    const out = {};
    // (a) the SEAM fix (bass-ped must-fix #1 == jazz's stall bug): the approach
    // targets the next window's ACTUAL landing — never the same pitch across
    // the barline, and a chromatic approach resolves by step in register.
    const w = gen({});
    const wB = bass(w.b);
    let stall = 0, badSeam = 0, accWrong = 0, seamN = 0;
    for (let i = 1; i < w.tl.length; i++) {
      const c = w.tl[i], prevC = w.tl[i - 1];
      const land = wB.find((e) => Math.abs(e.t - (c.startSec + w.lead)) < 1e-3);
      const before = wB.filter((e) => e.t < c.startSec + w.lead - 1e-3);
      if (!land || !before.length) continue;
      seamN++;
      const appr = before[before.length - 1].midis[0], lm = land.midis[0];
      if (appr === lm) stall++;                                        // the cross-barline repeat stall
      const diff = ((appr % 12) - (lm % 12) + 12) % 12;
      const dom = (appr % 12) === ((c.rootPc % 12) + 7) % 12;
      if (!([1, 2, 10, 11].includes(diff) || dom)) badSeam++;
      if ([1, 11].includes(diff) && Math.abs(appr - lm) > 2) badSeam++; // chromatic must resolve by STEP
      // accent semantics: vel 1 exactly when the chord changes
      const changed = c.name !== prevC.name;
      if ((land.vel === 1) !== changed) accWrong++;
    }
    out.seamN = seamN; out.stall = stall; out.badSeam = badSeam; out.accWrong = accWrong;
    // landing accents exist at all (the first window is a change by definition)
    const first = wB.find((e) => Math.abs(e.t - (w.tl[0].startSec + w.lead)) < 1e-3);
    out.firstAcc = !!(first && first.vel === 1);
    // (b) motown natural-6 gate (bass-ped must-fix #2): no natural 6 over a
    // minor-3rd chord (the diatonic vi) — the ♭7 plays as the COLOUR tone.
    // The window's FINAL hit is the chromatic approach into the NEXT chord
    // (e.g. F# into F major) — legitimate approach vocabulary, excluded.
    const mo = gen({ swing: "straight", progression: "I-vi-IV-V", backingBass: "motown_counter" });
    const moB = bass(mo.b);
    let nat6 = 0, minorSeen = 0;
    for (const c of mo.tl) {
      const ivs = c.intervals.map((x) => ((x % 12) + 12) % 12);
      if (!(ivs.includes(3) && !ivs.includes(4))) continue;
      minorSeen++;
      const hits = moB.filter((e) => e.t >= c.startSec + mo.lead - 1e-3 && e.t < c.endSec + mo.lead - 1e-3);
      for (let i = 0; i < hits.length - 1; i++) if (hits[i].midis[0] % 12 === ((c.rootPc % 12) + 9) % 12) nat6++;
    }
    out.minorSeen = minorSeen; out.nat6 = nat6;
    // (c) comp accent placement (blues + jazz one-liners): Charleston accents
    // the '&-of-2' push; boogie stabs accent '&-of-2'/'&-of-4'. Authored on a
    // straight cfg so the grid positions are unwarped by swing.
    const beat = 60 / base.bpm;
    const accPos = (cellId) => {
      const g = gen({ swing: "straight", backingComp: cellId });
      const comp = (g.b.backingEvents || []).filter((e) => e.role !== "drums" && e.role !== "bass" && e.vel === 1);
      const c0 = g.tl[0];
      return comp.filter((e) => e.t >= c0.startSec + g.lead - 1e-3 && e.t < c0.endSec + g.lead - 1e-3)
        .map((e) => +(((e.t - (c0.startSec + g.lead)) / beat)).toFixed(2));
    };
    out.charlestonAcc = accPos("charleston");
    out.boogieAcc = accPos("boogie_stab");
    return out;
  });
  ok(c5.seamN > 0 && c5.stall === 0, "no cross-barline pitch repeat (the seam-stall fix)", `stalls=${c5.stall}/${c5.seamN}`);
  ok(c5.badSeam === 0, "approaches target the ACTUAL next landing (chromatic resolves by step)", `bad=${c5.badSeam}`);
  ok(c5.accWrong === 0 && c5.firstAcc, "walk accents land ONLY on chord changes (accent = 'new chord here')", `wrong=${c5.accWrong}`);
  ok(c5.minorSeen > 0 && c5.nat6 === 0, "motown: no natural 6 over a minor-3rd chord (the ♭7 plays)", `minors=${c5.minorSeen} nat6=${c5.nat6}`);
  ok(JSON.stringify(c5.charlestonAcc) === "[1.5]", "Charleston accent sits on the '&-of-2' push, not beat 1", JSON.stringify(c5.charlestonAcc));
  ok(JSON.stringify(c5.boogieAcc) === "[1.5,3.5]", "boogie stabs accent '&-of-2'/'&-of-4' (backbeat-side)", JSON.stringify(c5.boogieAcc));

  // ── (8) DRUM_GROOVES — backing-engine step 5: the groove library + fills + humanization ──
  step("drum grooves — backing step 5");
  const d5 = await page.evaluate(() => {
    const D = globalThis.__ss_debug;
    const mk = (over) => Object.assign({ meter: { numerator: 4, denominator: 4, grouping: [] }, bpm: 120, swing: "straight", humanSeed: 12345, audio: {} }, over);
    const out = { badTile: [] };
    // every groove tiles to a finite, in-range, non-empty stream (16s = 8 bars @120)
    for (const gid of Object.keys(D.DRUM_GROOVES)) {
      const ev = D.buildDrumEvents(mk({}), 16, gid);
      const good = ev.length > 0 && ev.every((e) => Number.isFinite(e.t) && e.t >= -1e-9 && e.t < 16 && e.velocity > 0 && e.velocity <= 1 && typeof e.voice === "string");
      if (!good) out.badTile.push(gid);
    }
    // routing (style-keyed, NOT bare swing)
    out.routeJazz = D.resolveGroove(mk({ audioProfile: "jazz" }));
    out.routeJazzObj = D.resolveGroove(mk({ audio: { profile: "jazz" } }));
    out.routeBareSwing = D.resolveGroove(mk({ swing: "swing" }));
    out.routeShuffle = D.resolveGroove(mk({ swing: "shuffle" }));
    out.routeNone = D.resolveGroove(mk({ drums: "none" }));
    out.noneEmpty = D.buildDrumEvents(mk({ drums: "none" }), 16, null).length;
    // jazz feathered kick + foot + no backbeat snare
    const jz = D.buildDrumEvents(mk({ audioProfile: "jazz" }), 16, "jazz_swing");
    out.jazzKickMax = Math.max(...jz.filter((e) => e.voice === "kick").map((e) => e.velocity));
    out.jazzRideMin = Math.min(...jz.filter((e) => e.voice === "ride").map((e) => e.velocity));
    out.jazzFoot = jz.some((e) => e.voice === "hh_pedal");
    out.jazzNoBackbeat = !jz.some((e) => e.voice === "snare" && e.accent);
    // fill: straight rock, default every-8 → bar 8 is a tom fill, hats mute, crash next downbeat
    const rk = D.buildDrumEvents(mk({}), 18, "straight_8th_rock");
    const bar8 = rk.filter((e) => e.t >= 14 && e.t < 16);
    out.fillToms = bar8.some((e) => e.voice.startsWith("tom_"));
    out.fillHatsMuted = !bar8.some((e) => e.voice === "hh_closed");
    out.fillCrash = rk.some((e) => e.voice === "crash_l" && Math.abs(e.t - 16) < 0.05);
    out.bar1Hats = rk.filter((e) => e.t < 2).some((e) => e.voice === "hh_closed");
    // cellBars:2 clave spans both bars of the cell
    const bo = D.buildDrumEvents(mk({}), 16, "bossa").filter((e) => e.voice === "snare_xstick");
    out.bossaClave = bo.length > 0 && bo.some((e) => e.t < 2) && bo.some((e) => e.t >= 2);
    // determinism (humanization included)
    out.det = JSON.stringify(D.buildDrumEvents(mk({ audioProfile: "jazz" }), 16, "jazz_swing")) === JSON.stringify(D.buildDrumEvents(mk({ audioProfile: "jazz" }), 16, "jazz_swing"));
    out.seedVaries = JSON.stringify(D.buildDrumEvents(mk({ humanSeed: 1 }), 16, "funk_16th")) !== JSON.stringify(D.buildDrumEvents(mk({ humanSeed: 2 }), 16, "funk_16th"));
    // the loop's "one" is never micro-shifted
    out.oneClean = rk.some((e) => e.t === 0);
    // odd meter → generic keep (no ride lane crammed)
    const seven = mk({ meter: { numerator: 7, denominator: 8, grouping: [2, 2, 3] }, audioProfile: "jazz" });
    const sv = D.buildDrumEvents(seven, 14, D.resolveGroove(seven));
    out.oddN = sv.length; out.oddNoRide = !sv.some((e) => e.voice === "ride");
    return out;
  });
  ok(d5.badTile.length === 0, "every groove tiles to a valid event stream", d5.badTile.join(","));
  ok(d5.routeJazz === "jazz_swing" && d5.routeJazzObj === "jazz_swing", "an explicit jazz audioProfile routes to jazz_swing (both cfg shapes)", `${d5.routeJazz}/${d5.routeJazzObj}`);
  ok(d5.routeBareSwing !== "jazz_swing", "a bare swing:'swing' (non-jazz) does NOT drag in the jazz ride", d5.routeBareSwing);
  ok(d5.routeShuffle === "shuffle_blues", "shuffle feel → the triplet shuffle", d5.routeShuffle);
  ok(d5.routeNone === null && d5.noneEmpty === 0, "drums:'none' → a silent kit (drumless genres)", `${d5.routeNone}/${d5.noneEmpty}`);
  ok(d5.jazzKickMax < d5.jazzRideMin && d5.jazzKickMax < 0.28, "jazz kick is feathered (quieter than the ride)", `kick=${d5.jazzKickMax} ride=${d5.jazzRideMin}`);
  ok(d5.jazzFoot && d5.jazzNoBackbeat, "jazz: hi-hat foot on 2&4, no backbeat snare accent in the base");
  ok(d5.fillToms && d5.fillHatsMuted && d5.fillCrash && d5.bar1Hats, "a fill swaps the phrase's last bar (toms), mutes hats, crashes the next downbeat", `toms=${d5.fillToms} mute=${d5.fillHatsMuted} crash=${d5.fillCrash}`);
  ok(d5.bossaClave, "cellBars:2 grooves tile across the multi-bar cell (bossa clave)");
  ok(d5.det, "same cfg => byte-identical drum events (humanization is seeded)");
  ok(d5.seedVaries, "a different humanSeed varies the humanized roll");
  ok(d5.oneClean, "the loop's 'one' is never micro-shifted");
  ok(d5.oddN > 0 && d5.oddNoRide, "odd meter still falls to the generic groove (no 4/4 cell crammed)", `n=${d5.oddN}`);

  // ── (7) scheduler ceiling: a Woodshed Play stays windowed ───────────────────
  step("scheduler ceiling");
  await page.click("#slopscale-mode-session");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const sel = document.getElementById("slopscale-length-preset");
    if (sel) { sel.value = "woodshed"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({ n: window.__nodeCount, lt: window.__longTasks.length }));
  await page.click("#slopscale-launch-session");
  await page.waitForFunction(() => document.getElementById("slopscale-play")?.classList.contains("is-playing"), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({ n: window.__nodeCount, longTasks: window.__longTasks.slice() }));
  const created = after.n - before.n;
  const worst = Math.max(0, ...after.longTasks.slice(before.lt));
  ok(created > 0 && created < 2500, "Woodshed Play schedules a bounded window (was 39k whole-pass)", `nodes=${created}`);
  ok(worst < 800, "no second-long main-thread block at Play (was 1.57s)", `worst longtask=${worst}ms`);
  await page.evaluate(() => document.getElementById("slopscale-play")?.click());
  await page.waitForTimeout(400);

  if (errs.length) { fail++; console.log(`  FAIL page errors: ${errs.join(" | ")}`); }
} finally { await browser.close(); }

if (fail) { console.log(`FAIL  backing-engine: ${fail} failure(s) (${pass} passed)`); process.exit(1); }
console.log(`PASS  backing-engine: ${pass} checks passed (timeline validity x styles, 2/bar, push, determinism, key-cycle + session assembly, drum grooves + fills)`);
