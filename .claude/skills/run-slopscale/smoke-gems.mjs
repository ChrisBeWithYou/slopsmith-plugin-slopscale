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
const BENIGN = [/audiocontext/i, /failed to set up audio analyser/i, /play\(\) request was interrupted/i, /continuous scoring failed to start/i, /invalidstateerror/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
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
    window.slopsmithMinigames = window.slopsmithMinigames || {}; window.slopsmithMinigames.scoring = window.slopsmithMinigames.scoring || {};
    window.slopsmithMinigames.scoring.createContinuous = () => ({ on: (e, cb) => { if (e === "pitch") window.__fp = cb; }, stop: () => { window.__run = false; }, isRunning: () => window.__run });
  });
  await p.click("#slopscale-play"); // generates (countIn=0) + plays + starts the fake tracker
  const h = await p.evaluate(async () => {
    const bundle = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    const provActive = bundle.getNoteStateProvider() !== null;
    const om = bundle.openMidis || [], n0 = bundle.notes[0], midi = (om[n0.s] || 0) + n0.f, freq = 440 * Math.pow(2, (midi - 69) / 12);
    let st = null, fired = 0;
    for (let i = 0; i < 60; i++) { if (window.__fp) { window.__fp({ freqHz: freq, confidence: 0.95 }); fired++; } const x = bundle.getNoteState(n0); if (x === "hit" || x === "active") { st = x; break; } await new Promise(r2 => setTimeout(r2, 20)); }
    return { provActive, fired, st };
  });
  ok(h.provActive, "getNoteStateProvider() !== null while the scorer runs (the host's detect-mode signal)");
  ok(h.st === "hit" || h.st === "active", "a CORRECT pitch lights note[0] (hit/active)", `state=${h.st} fired=${h.fired}`);
  await p.click("#slopscale-play").catch(() => {});
  ok(errs.length === 0, "no page errors from the gem path", errs.join(" | "));

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  gems: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
