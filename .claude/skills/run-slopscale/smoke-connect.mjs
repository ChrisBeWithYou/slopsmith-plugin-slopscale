#!/usr/bin/env node
// Assertive guard: the "Connect" keystone (playing-the-changes Stage 1). The
// chord_scales / mode_of_moment strategy must VOICE-LEAD — each new chord's run
// starts on the nearest GUIDE TONE (3rd/7th) to the previous note, NOT a restart
// on the chord root, and the seam interval stays small (a real connector, often a
// common-tone pivot). Regression guard for the buildChordScaleExercise rework
// (2026-06-01) that replaced the root-restart with nearestPositionForPc-style
// voice-leading. PASS/FAIL, non-zero exit on failure. (host up via launch.ps1.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

const PC = { C:0, "C#":1, Db:1, D:2, "D#":3, Eb:3, E:4, F:5, "F#":6, Gb:6, G:7, "G#":8, Ab:8, A:9, "A#":10, Bb:10, B:11 };
const OPENS_6 = [40, 45, 50, 55, 59, 64]; // guitar_6_standard E A D G B e
const rootPcOf = (name) => { const m = /^([A-G])([#b]?)/.exec(name); return m ? PC[m[1] + (m[2] || "")] : null; };

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const pageErrs = [];
  page.on("pageerror", e => pageErrs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-slopscale"));
  await page.waitForSelector("#slopscale-root", { state: "attached" });
  await page.waitForSelector(".slopscale-view-btn");
  await page.waitForFunction(() => window.SlopScale && typeof window.SlopScale.generateExercise === "function", { timeout: 10000 });

  const ex = await page.evaluate(() => {
    const setForm = (o) => { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#slopscale-controls [name="${k}"]`); if (el) el.value = String(v); } };
    const adv = document.querySelector('[name="advancedMode"]'); if (adv) { adv.checked = true; adv.dispatchEvent(new Event("change", { bubbles: true })); }
    setForm({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "mode_of_moment", progression: "ii-V-I", key: "C", scale: "major", chordDepth: "seventh", chordOverride: "auto", fretboardSystem: "caged", shape: "E", subdivision: "eighth", bars: "6", direction: "up_down", sequence: "none" });
    const e = window.SlopScale.generateExercise(window.SlopScale.readConfig());
    return { notes: e.chart.notes.map(n => ({ t: n.t, s: n.s, f: n.f })), sections: (e.chart.sections || []).map(x => ({ name: x.name, time: x.time })), chords: (e.chart.chords || []).map(c => ({ t: c.t })) };
  });

  // Group notes into bars by chord start time; first/last note per bar.
  const bars = ex.chords.map((c, i) => {
    const next = ex.chords[i + 1] ? ex.chords[i + 1].t : Infinity;
    const inBar = ex.notes.filter(n => n.t >= c.t - 1e-4 && n.t < next - 1e-4).sort((a, b) => a.t - b.t);
    const sec = ex.sections.find(s => Math.abs(s.time - c.t) < 1e-3);
    return { t: c.t, name: sec ? sec.name : null, notes: inBar };
  }).filter(b => b.notes.length);

  console.log(`-- chord_scales / Connect (mode_of_moment), ii-V-I in C, ${bars.length} chords --`);
  let rootStarts = 0, guideStarts = 0, checked = 0, maxSeam = 0;
  let prevLastMidi = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const first = b.notes[0];
    const firstMidi = OPENS_6[first.s] + first.f;
    const firstPc = firstMidi % 12;
    const rootPc = rootPcOf(b.name);
    const iv = rootPc == null ? null : ((firstPc - rootPc) + 12) % 12;
    const isRoot = iv === 0;
    const isGuide = iv === 3 || iv === 4 || iv === 10 || iv === 11; // 3rd or 7th
    const tag = i === 0 ? "(open)" : (isRoot ? "ROOT" : (isGuide ? "guide" : `iv=${iv}`));
    let seam = "";
    if (i > 0 && prevLastMidi != null) { const d = Math.abs(firstMidi - prevLastMidi); maxSeam = Math.max(maxSeam, d); seam = ` seam=${d}st`; }
    console.log(`  bar ${i} ${String(b.name).padEnd(7)} starts on ${tag}${seam}`);
    if (i > 0) { checked++; if (isRoot) rootStarts++; if (isGuide) guideStarts++; }
    const last = b.notes[b.notes.length - 1];
    prevLastMidi = OPENS_6[last.s] + last.f;
  }

  ok(rootStarts === 0, "no chord (after the first) restarts the run on its root", `${rootStarts}/${checked} were root-starts`);
  ok(guideStarts >= Math.ceil(checked * 0.75), "most changes land on a guide tone (3rd/7th)", `${guideStarts}/${checked} guide-tone landings`);
  ok(maxSeam > 0 && maxSeam <= 7, "seam interval stays small (voice-leading, not a jump)", `max seam ${maxSeam}st`);
  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  connect keystone: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
