#!/usr/bin/env node
// REAL-audio end-to-end guard for the SCORING system (promoted from
// probe-mic-e2e per the dev-ops consult, 2026-06-05). The only suite that
// exercises the HOST's actual pitch detector with actual audio — smoke-gems
// deliberately injects a fake scorer to stay target-independent; this suite
// is the opposite: it asserts real scoring works on CURRENT Slopsmith.
//
// Mechanism: synthesize a 110 Hz (A2) WAV → stream it as the microphone via
// Chromium's fake-media flags → run a rhythm_pulse drill in A on the low E
// string (every note expects exactly A2/midi 45) → assert the real SDK scorer
// starts, the pitch meter reads A2, grading lights a note, accuracy counts.
// Then the NEGATIVE control: same tone, drill re-keyed to D (expects D3,
// ~-500¢ from A2) → NO note may reach 'hit' (a pass-everything grader would
// silently corrupt the proof-loop's clean-run gating).
//
// Policy (dev-ops): an SDK-less host is a hard FAIL, not a skip — the SDK
// silently vanishing from the checkout target is the #1 thing this suite
// exists to catch. No BENIGN error list here: scoring failures are the point.
// (host up via launch.ps1 — checkout target.)
import { chromium } from "playwright";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

// ── the fake-mic WAV: 110 Hz sine, mono 16-bit 44.1k, 30 s (Chromium loops it).
// tmpdir + PID so concurrent runs can't race a half-written file (run-all runs
// suites in parallel, and ad-hoc runs during npm test are a real scenario).
const SR = 44100, SECS = 30, FREQ = 110;
const nSamp = SR * SECS, pcm = Buffer.alloc(nSamp * 2);
for (let i = 0; i < nSamp; i++) pcm.writeInt16LE(Math.round(Math.sin(2 * Math.PI * FREQ * i / SR) * 0.6 * 32767), i * 2);
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVE", 8);
hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
const wavPath = join(tmpdir(), `slopscale-tone-a2-${process.pid}.wav`);
writeFileSync(wavPath, Buffer.concat([hdr, pcm]));

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",                 // auto-grant the mic permission
    "--use-fake-device-for-media-stream",             // fake capture device…
    `--use-file-for-fake-audio-capture=${wavPath}`,   // …streaming the A2 tone
    "--autoplay-policy=no-user-gesture-required",
  ],
});
try {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const pageErrs = [], consoleErrs = [];
  page.on("pageerror", (e) => pageErrs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-slopscale"));
  await page.waitForSelector("#slopscale-root", { state: "attached" });
  await page.waitForFunction(() => window.SlopScale && typeof window.SlopScale.makeBundle === "function", { timeout: 10000 });

  // ── SDK gate: hard-fail fast with a NAMED message on an SDK-less host. ────
  const sdk = await page.waitForFunction(
    () => typeof window.slopsmithMinigames?.scoring?.createContinuous === "function",
    { timeout: 5000 }
  ).catch(() => null);
  ok(!!sdk, "scoring SDK present on this host", sdk ? "" : "no Minigames scoring SDK — run against the checkout target (launch.ps1 default)");
  if (!sdk) throw new Error("SDK absent — remaining assertions unprovable on this host.");

  // ── configure + stash the bundle ONCE (poll reuses it — no regen reliance).
  const setDrill = (key) => page.evaluate((k) => {
    const set = (name, v) => { const el = document.querySelector(`#slopscale-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("advancedMode", true);
    set("practiceType", "rhythm_pulse"); set("scale", "minor_pentatonic"); set("key", k);
    set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("meter", "4/4"); set("subdivision", "quarter"); set("bpm", "60"); set("bars", "8");
    set("countIn", "0");
    const b = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    window.__e2eBundle = b;
    const n0 = b.notes[0], midi = (b.openMidis[n0.s] || 0) + n0.f;
    return { midi };
  }, key);

  // ── POSITIVE: key A → every note expects A2 = the tone. ───────────────────
  const expA = await setDrill("A");
  ok(expA.midi === 45, "positive drill note[0] expects A2 (midi 45 = 110 Hz)", `midi=${expA.midi}`);
  await page.click("#slopscale-play");
  const pos = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const out = { provider: false, meterShown: false, meterNote: "", meterAcc: "", lit: null };
    for (let i = 0; i < 120; i++) {
      if (b.getNoteStateProvider() !== null) out.provider = true;
      const meter = document.getElementById("slopscale-pitch-meter");
      if (meter && meter.style.display !== "none") out.meterShown = true;
      const noteEl = document.getElementById("slopscale-pitch-note");
      if (noteEl && /A2/.test(noteEl.textContent)) out.meterNote = noteEl.textContent;
      const accEl = document.getElementById("slopscale-pitch-accuracy");
      if (accEl && /^[1-9]/.test(accEl.textContent)) out.meterAcc = accEl.textContent;
      for (const nn of b.notes.slice(0, 6)) { const st = b.getNoteState(nn); if (st === "hit" || st === "active") { out.lit = st; break; } }
      if (out.provider && out.meterNote && out.lit && out.meterAcc) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return out;
  });
  ok(pos.provider, "(1) the REAL host SDK scorer started (provider non-null)");
  ok(pos.meterShown, "(2a) the pitch meter is visible during play");
  ok(!!pos.meterNote, "(2b) the host detector heard the tone as A2", pos.meterNote || "(meter never showed A2)");
  ok(pos.lit === "hit" || pos.lit === "active", "(3) grading lights a note on the correct pitch", `state=${pos.lit}`);
  ok(!!pos.meterAcc, "(4) the accuracy readout counts hits", pos.meterAcc || "(no hits counted)");
  // Known display nit (logged, non-gating): hits can momentarily outrun passed-total.
  { const m = /^(\d+)\/(\d+)/.exec(pos.meterAcc || ""); if (m && +m[1] > +m[2]) console.log(`  [WARN] accuracy readout hits>total (${pos.meterAcc}) — known ptOnPitch counting nit (see ROADMAP small slices)`); }
  await page.click("#slopscale-play").catch(() => {});
  await page.waitForTimeout(200);

  // ── NEGATIVE control: key D → expects D3 (~-500¢ from A2) → NO hit. ───────
  // Guards against a pass-everything grader, which would silently corrupt the
  // proof-loop's clean-run gating while every positive assert stays green.
  const expD = await setDrill("D");
  ok(expD.midi !== 45, "negative drill expects a different pitch (not A2)", `midi=${expD.midi}`);
  await page.click("#slopscale-play");
  const neg = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const out = { provider: false, hit: null };
    for (let i = 0; i < 40; i++) {                       // ~4 s = ~4 note windows at 60 bpm quarters
      if (b.getNoteStateProvider() !== null) out.provider = true;
      for (const nn of b.notes.slice(0, 6)) { if (b.getNoteState(nn) === "hit") { out.hit = nn.t; break; } }
      if (out.hit != null) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return out;
  });
  ok(neg.provider, "(5a) scorer also runs in the negative control (so the pass below is meaningful)");
  ok(neg.hit == null, "(5b) the WRONG pitch lights nothing (no pass-everything grader)", neg.hit != null ? `note at t=${neg.hit} wrongly hit` : "");
  await page.click("#slopscale-play").catch(() => {});
  await page.waitForTimeout(200);

  // ── (6) CHORD EXEMPTION through the REAL detector (2026-06-05): a pedal_riff
  // chord drill in A — the pedal singles expect A2 (= the WAV) and must score;
  // the 2-note power-chord stabs are exempt (the monophonic detector reports
  // nothing usable for polyphony — probe-chord-detector.mjs) and must show NO
  // judgment: no hit even though the chord root also expects A2, and no miss
  // after their windows pass. Catches both regressions: per-note chord judging
  // returning (chord root would hit), and exemption leaking into singles.
  const expC = await page.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#slopscale-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("advancedMode", true);
    set("practiceType", "pedal_riff"); set("chordOverride", "5"); set("progression", "static_i");
    set("scale", "natural_minor"); set("key", "A");
    set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "60"); set("bars", "8"); set("countIn", "0");
    const b = window.SlopScale.makeBundle(window.SlopScale.generateExercise(window.SlopScale.readConfig()));
    window.__e2eBundle = b;
    const om = b.openMidis || [];
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const chord = [...byG.values()].find((g) => g.length > 1) || [];
    const single = [...byG.values()].filter((g) => g.length === 1).map((g) => g[0])[0];
    return { nChord: chord.length, pedalMidi: single ? (om[single.s] || 0) + single.f : -1 };
  });
  ok(expC.nChord >= 2 && expC.pedalMidi === 45, "(6) chord drill structural: 2-note stabs + A2 pedal singles", `chord=${expC.nChord} pedalMidi=${expC.pedalMidi}`);
  await page.click("#slopscale-play");
  const chordRes = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const chordPair = [...byG.values()].find((g) => g.length > 1) || [];
    const singles = [...byG.values()].filter((g) => g.length === 1).map((g) => g[0]).slice(0, 8);
    const out = { singleHit: null, chordLit: null, meterAcc: "" };
    for (let i = 0; i < 80; i++) {   // ~8s: chord windows at 60bpm open and pass
      for (const n of chordPair) { const st = b.getNoteState(n); if (st) out.chordLit = st; }
      if (!out.singleHit) for (const n of singles) { const st = b.getNoteState(n); if (st === "hit" || st === "active") { out.singleHit = st; break; } }
      const accEl = document.getElementById("slopscale-pitch-accuracy");
      if (accEl && /^[1-9]/.test(accEl.textContent)) out.meterAcc = accEl.textContent;
      if (out.singleHit && out.meterAcc && i > 40) break;   // keep polling past several chord windows
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return out;
  });
  ok(chordRes.singleHit === "hit" || chordRes.singleHit === "active", "(6a) pedal singles still score through the real detector in a chord chart", `state=${chordRes.singleHit}`);
  ok(chordRes.chordLit == null, "(6b) chord members show NO judgment (exempt — shown, not scored)", `lit=${chordRes.chordLit}`);
  ok(!!chordRes.meterAcc, "(6c) accuracy counts the singles (denominator excludes exempt chords)", chordRes.meterAcc || "(no hits counted)");
  await page.click("#slopscale-play").catch(() => {});

  // ── error surfaces: NO benign list in this suite — scoring failures ARE the point.
  const scoringFailures = consoleErrs.filter((e) => /continuous scoring failed to start|failed to set up audio analyser/i.test(e));
  ok(scoringFailures.length === 0, "no scorer-startup failures on the console", scoringFailures.slice(0, 2).join(" | "));
  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.slice(0, 2).join(" | "));
} catch (e) {
  console.error("SUITE ERROR:", e.message);
  fails++;
} finally {
  await browser.close();
  try { unlinkSync(wavPath); } catch (_) {}
}
console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  scoring-e2e: ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
