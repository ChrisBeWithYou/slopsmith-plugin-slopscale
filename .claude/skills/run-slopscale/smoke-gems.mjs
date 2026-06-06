#!/usr/bin/env node
// Guard for the #254 per-note GEM hook (wired 2026-06-04). SlopScale's bundle exposes
// getNoteState(note)/getNoteStateProvider() so the host highway can light each note's gem
// on a hit/miss from our pitch tracker. This locks the contract so a future screen.js
// change can't silently kill it:
//   1. the bundle exposes real getNoteState + getNoteStateProvider (not the old null stub);
//   2. with NO scorer running, both are inert (provider null, getNoteState null) → no gems,
//      which is the correct no-SDK / not-playing behavior;
//   3. while a scorer runs, getNoteStateProvider() is non-null (the host's "detect-mode" signal);
//   4. a CORRECT pitch lights note[0] ('hit'/'active').
// Target-independent: it injects a FAKE createContinuous + fires a synthetic pitch, so it
// passes on both the bundled (no real SDK) and checkout (real SDK) hosts. countIn is forced
// to 0 so note[0].t = 0 and the synthetic pitch lands in its window. (host up via launch.ps1)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };
// Benign headless noise (autoplay policy, mic-less scoring) — not a gem-path fault.
const BENIGN = [/note detect: mic access denied/i, /audiocontext/i, /failed to set up audio analyser/i, /play\(\) request was interrupted/i, /continuous scoring failed to start/i, /invalidstateerror/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { globalThis.__SS_HARNESS__ = true; });   // row 6 reads __ss_debug (playhead + window table)
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => { if (!isBenign(e.message)) errs.push(e.message); });
  await p.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await p.waitForFunction(() => typeof window.showScreen === "function");
  await p.evaluate(() => window.showScreen("plugin-slopscale"));
  await p.waitForSelector("#slopscale-root", { state: "attached" });
  await p.waitForFunction(() => window.SlopScale && typeof window.SlopScale.makeBundle === "function");

  // (1)+(2) structural + no-scorer gating (a fresh bundle, nothing playing).
  const s = await p.evaluate(() => {
    const bundle = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    return { gns: typeof bundle.getNoteState, gnp: typeof bundle.getNoteStateProvider,
             provNull: bundle.getNoteStateProvider() === null, stNull: bundle.getNoteState(bundle.notes[0]) === null };
  });
  ok(s.gns === "function" && s.gnp === "function", "bundle exposes getNoteState + getNoteStateProvider (real, not the null stub)");
  ok(s.provNull, "getNoteStateProvider() === null with no scorer running");
  ok(s.stNull, "getNoteState(note) === null with no scorer (no gems = correct no-SDK behavior)");

  // (3)+(4) inject a fake scorer, play, fire a CORRECT synthetic pitch for note[0].
  await p.evaluate(() => {
    const c = document.querySelector('[name="countIn"]'); if (c) { c.value = '0'; c.dispatchEvent(new Event('change', { bubbles: true })); }
    window.__fp = null; window.__run = true;
    // Pin the YIN scoring lane: with the note_detect plugin installed (PR #4
    // verifier-backed scoring), window.noteDetect would put the run in verifier
    // mode and make ptOnPitch display-only — the fake pitch events below would
    // never score. This suite owns the FAKE-YIN gem contract; the verifier lane
    // is covered with REAL audio in smoke-scoring-e2e.
    try { delete window.noteDetect; } catch (_) { window.noteDetect = undefined; }
    window.slopsmithMinigames = window.slopsmithMinigames || {}; window.slopsmithMinigames.scoring = window.slopsmithMinigames.scoring || {};
    window.slopsmithMinigames.scoring.createContinuous = () => ({ on: (e, cb) => { if (e === "pitch") window.__fp = cb; }, stop: () => { window.__run = false; }, isRunning: () => window.__run });
  });
  await p.click("#slopscale-play"); // generates (countIn=0) + plays + starts the fake tracker
  const h = await p.evaluate(async () => {
    const bundle = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    const om = bundle.openMidis || [], n0 = bundle.notes[0], midi = (om[n0.s] || 0) + n0.f, freq = 440 * Math.pow(2, (midi - 69) / 12);
    let st = null, fired = 0, provActive = false;
    for (let i = 0; i < 60; i++) {
      if (bundle.getNoteStateProvider() !== null) provActive = true;   // scorer startup is async — poll, don't snapshot once
      if (window.__fp) { window.__fp({ freqHz: freq, confidence: 0.95 }); fired++; }
      const x = bundle.getNoteState(n0); if (x === "hit" || x === "active") { st = x; break; }
      await new Promise(r2 => setTimeout(r2, 20));
    }
    return { provActive, fired, st };
  });
  ok(h.provActive, "getNoteStateProvider() !== null while the scorer runs (the host's detect-mode signal)");
  ok(h.st === "hit" || h.st === "active", "a CORRECT pitch lights note[0] (hit/active)", `state=${h.st} fired=${h.fired}`);
  await p.click("#slopscale-play").catch(() => {});

  // (5) CHORD EXEMPTION (2026-06-05, the DapperTap report): the host detector is
  // monophonic and reports nothing usable for polyphony (probe-chord-detector.mjs),
  // so simultaneous notes (chords/diads) are SHOWN but never pitch-judged — no hit
  // even on a root-matching pitch, and no miss after the window passes. Singles in
  // the same chart stay individually judged. Built from the REAL pedal_riff builder
  // (chordOverride '5' emits 2-note power chords at identical t), never synthetic
  // same-t notes.
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#slopscale-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("advancedMode", true); set("practiceType", "pedal_riff"); set("chordOverride", "5");
    set("progression", "static_i"); set("scale", "natural_minor"); set("key", "A");
    set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "120"); set("bars", "4"); set("countIn", "0");
  });
  await p.click("#slopscale-play");
  const c5 = await p.evaluate(async () => {
    const b = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    const om = b.openMidis || [];
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const groups = [...byG.values()];
    const chordPair = groups.find((g) => g.length > 1) || [];
    const singles = groups.filter((g) => g.length === 1).map((g) => g[0]).slice(0, 8);
    if (!chordPair.length || !singles.length) return { structural: false };
    // In key-A static_i the pedal AND the chord root both expect A2 — one fired
    // pitch stream exercises both judgments at once.
    const root = chordPair.slice().sort((a, b2) => (om[a.s] + a.f) - (om[b2.s] + b2.f))[0];
    const freq = 440 * Math.pow(2, ((om[root.s] + root.f) - 69) / 12);
    let singleHit = null, chordLit = null;
    for (let i = 0; i < 150; i++) {   // ~3s: several chord windows open AND pass
      if (window.__fp) window.__fp({ freqHz: freq, confidence: 0.95 });
      for (const n of chordPair) { const st = b.getNoteState(n); if (st) chordLit = st; }
      if (!singleHit) for (const n of singles) { const st = b.getNoteState(n); if (st === "hit" || st === "active") { singleHit = st; break; } }
      await new Promise((r2) => setTimeout(r2, 20));
    }
    return { structural: true, nChord: chordPair.length, singleHit, chordLit };
  });
  ok(c5.structural, "(5a) chord drill yields chord groups + pedal singles (real builder output)");
  ok(c5.singleHit === "hit" || c5.singleHit === "active", "(5b) singles in a chord chart still judge (pedal lights on correct pitch)", `state=${c5.singleHit}`);
  ok(c5.chordLit == null, "(5c) chord members NEVER judged — no hit on a root-matching pitch, no miss after the window (shown, not scored)", `lit=${c5.chordLit}`);
  await p.click("#slopscale-play").catch(() => {});

  // (6) TIMING-MODEL acceptance (2026-06-06 seven-lane panel): an ON-TIME player
  // must credit EVERY note of a 160 BPM chromatic 16th run. Structurally
  // impossible under the old first-match/consecutive-streak judge (each window
  // opened ~46ms late and the 80ms streak couldn't fit the 94ms slot); the
  // parallel-window + latency-anchored + evidence-pair model must make it pass.
  // Also asserts the precomputed window table's exclusive bounds are
  // non-overlapping (the by-construction invariant both ears rely on).
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#slopscale-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "chromatic"); set("stringSetup", "guitar_6_standard");
    set("meter", "4/4"); set("subdivision", "sixteenth"); set("bpm", "160"); set("bars", "2"); set("countIn", "0");
  });
  await p.click("#slopscale-play");
  const c6 = await p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    if (!dbg || typeof dbg.ptPracticeTime !== "function") return { wired: false };
    const b = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    const om = b.openMidis || [];
    const notes = b.notes.filter((n) => !n._tail).sort((a, b2) => a.t - b2.t);
    // window-table invariant: exclusive bounds sorted + non-overlapping
    let contiguous = true;
    const ws = dbg.ptWindows();
    for (let i = 0; i + 1 < ws.length; i++) if (ws[i].exclEnd > ws[i + 1].exclStart + 1e-6) { contiguous = false; break; }
    // drive an on-time perfect player: each ~15ms, fire the pitch of the note
    // under the JUDGE clock (playhead − 80ms detector latency)
    const dur = notes[notes.length - 1].t + 0.6;
    const deadline = performance.now() + dur * 1000 + 4000;
    while (performance.now() < deadline) {
      const tj = dbg.ptPracticeTime() - 0.08;
      if (tj > notes[notes.length - 1].t + 0.3) break;
      let nearest = null, nd = Infinity;
      for (const n of notes) { const d = Math.abs(n.t - tj); if (d < nd) { nd = d; nearest = n; } }
      if (nearest && window.__fp) {
        const midi = (om[nearest.s] || 0) + nearest.f;
        window.__fp({ freqHz: 440 * Math.pow(2, (midi - 69) / 12), confidence: 0.95 });
      }
      await new Promise((r2) => setTimeout(r2, 15));
    }
    const hit = notes.filter((n) => { const st = b.getNoteState(n); return st === "hit" || st === "active"; }).length;
    return { wired: true, contiguous, hit, total: notes.length, nWin: ws.length };
  });
  ok(c6.wired, "(6a) harness debug surface exposes ptPracticeTime + ptWindows");
  ok(c6.contiguous, "(6b) window table exclusive bounds are non-overlapping (by-construction invariant)", `windows=${c6.nWin}`);
  ok(c6.wired && c6.hit === c6.total, "(6c) on-time player credits EVERY note of a 160 BPM chromatic 16th run", `hit=${c6.hit}/${c6.total}`);
  await p.click("#slopscale-play").catch(() => {});
  ok(errs.length === 0, "no page errors from the gem path", errs.join(" | "));

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  gems: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
