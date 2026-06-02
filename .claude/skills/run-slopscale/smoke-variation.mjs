#!/usr/bin/env node
// Assertive smoke test for the SlopScale variation engine (Workout library
// substrate) — SEGMENT_TEMPLATES + rollSegment + refreshWorkout.
//
// It drives window.SlopScale directly (fast — no rendering). For every segment
// template it rolls EVERY variant through generateSession() (a one-slot workout
// built from a { templateId, variantIdx } ref) and validates the resulting chart:
// notes present, every note finite t>=0 / integer string in range / sane fret /
// positive sustain; beats present (transport clock). It then asserts the two
// refresh invariants that are checkable at the chart level:
//   • LENGTH-LOCKED — every variant of a template yields the SAME chart duration
//     (refresh varies content, never difficulty/length).
//   • refreshWorkout() advances a template-ref slot's variant and still builds.
//
// The other invariants are guarded elsewhere: the no-unison rule + the no-row /
// style-lock startup checks throw at LOAD (validateSegmentTemplates /
// "[SlopScale no-unison] …"), surfacing as a pageerror and failing this run
// before a single template is read.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-slopscale/smoke-variation.mjs   # or: npm run smoke:variation
//
// Exit 0 = all templates OK, 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";

const BENIGN = [
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
  /desktop audio api not available/i,   // host audio engine reporting headless/browser mode
];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  const body = await r.json();
  if (!body.ok) throw new Error(`Plugin status not ok: ${JSON.stringify(body)}`);
}

async function gotoSlopScale(page) {
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-slopscale"));
  await page.waitForSelector("#slopscale-root", { state: "attached", timeout: 10_000 });
  await page.waitForFunction(
    () => window.SlopScale && window.SlopScale.SEGMENT_TEMPLATES && typeof window.SlopScale.generateSession === "function" && typeof window.SlopScale.refreshWorkout === "function",
    { timeout: 5_000 }
  );
}

// Runs in the page: roll every variant of every template through generateSession
// and validate the chart + the length-locked invariant, then exercise refreshWorkout.
function runVariationInPage() {
  const S = window.SlopScale;
  const T = S.SEGMENT_TEMPLATES || {};
  const out = [];

  const stringFor = (inst) => (inst === "bass" ? "bass_4_standard" : "guitar_6_standard");
  const scFor = (inst) => (inst === "bass" ? 4 : 6);

  function check(res, maxStrings) {
    const fatal = [];
    if (!res || !res.chart) { fatal.push("no chart returned"); return { fatal, notes: 0, dur: 0 }; }
    const c = res.chart;
    const notes = Array.isArray(c.notes) ? c.notes : [];
    if (notes.length === 0) fatal.push("no notes");
    if (!Array.isArray(c.beats) || c.beats.length === 0) fatal.push("no beats (transport clock)");
    const ms = Number.isInteger(maxStrings) && maxStrings > 0 ? maxStrings : 8;
    for (const n of notes) {
      if (typeof n.t !== "number" || !isFinite(n.t) || n.t < 0) { fatal.push(`bad t=${n.t}`); break; }
      if (!Number.isInteger(n.s) || n.s < 0 || n.s >= ms) { fatal.push(`bad string=${n.s} (max ${ms})`); break; }
      if (!Number.isInteger(n.f) || n.f < 0 || n.f > 30) { fatal.push(`bad fret=${n.f}`); break; }
      if (n.sus !== undefined && (typeof n.sus !== "number" || n.sus <= 0)) { fatal.push(`bad sus=${n.sus}`); break; }
    }
    return { fatal, notes: notes.length, dur: c.duration || 0 };
  }

  for (const id of Object.keys(T)) {
    const t = T[id];
    const ss = stringFor(t.instrument);
    const ms = scFor(t.instrument);
    const n = (t.vary && t.vary.length) || 1;
    const durs = [];
    const fatal = [];
    let totalNotes = 0;
    for (let i = 0; i < n; i++) {
      let res;
      try {
        res = S.generateSession({ version: 1, name: `t_${id}_${i}`, stringSetup: ss, segments: [{ id: "slot", templateId: id, variantIdx: i }] });
      } catch (e) { fatal.push(`variant ${i} threw: ${e.message}`); continue; }
      const v = check(res, ms);
      if (v.fatal.length) fatal.push(`variant ${i}: ${v.fatal.join(", ")}`);
      durs.push(v.dur);
      totalNotes += v.notes;
    }
    // LENGTH-LOCKED: every variant of a template must yield the same duration.
    if (durs.length > 1) {
      const d0 = durs[0];
      if (!durs.every((d) => Math.abs(d - d0) < 0.01)) fatal.push(`length not held across variants: [${durs.map((d) => d.toFixed(2)).join(", ")}]`);
    }
    out.push({ label: `${t.role}/${id} (${n}v)`, ok: fatal.length === 0, fatal, notes: totalNotes });
  }

  // refreshWorkout: advance a one-slot workout and confirm the variant index moved
  // (when the template has >1 variant) and the refreshed workout still builds.
  const ids = Object.keys(T);
  if (ids.length) {
    const a = ids.find((k) => (T[k].vary || []).length > 1) || ids[0];
    const multi = (T[a].vary || []).length > 1;
    const w0 = { version: 1, name: "rw", stringSetup: stringFor(T[a].instrument), segments: [{ id: "s1", templateId: a, variantIdx: 0 }] };
    const w1 = S.refreshWorkout(w0, { scope: "all" });
    const fatal = [];
    const moved = (w1.segments[0].variantIdx | 0) !== 0;
    if (multi && !moved) fatal.push("refreshWorkout did not advance variantIdx for a multi-variant template");
    try {
      const r0 = S.generateSession(w0), r1 = S.generateSession(w1);
      if (!r0.chart || !r1.chart) fatal.push("refresh materialisation produced no chart");
    } catch (e) { fatal.push(`refresh build threw: ${e.message}`); }
    out.push({ label: `refreshWorkout(${a})`, ok: fatal.length === 0, fatal, notes: 0 });
  } else {
    out.push({ label: "SEGMENT_TEMPLATES", ok: false, fatal: ["registry is empty"], notes: 0 });
  }

  return out;
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
  let rows = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    await gotoSlopScale(page);
    rows = await page.evaluate(runVariationInPage);
  } finally {
    await browser.close();
  }

  console.log("\n=== SlopScale variation-engine smoke ===\n");
  let fatalCount = 0;
  for (const r of rows) {
    const tag = r.ok ? "PASS" : "FAIL";
    if (!r.ok) fatalCount++;
    const extra = r.notes ? ` notes=${r.notes}` : "";
    console.log(`  [${tag}] ${r.label}${extra}`);
    for (const f of r.fatal) console.log(`         x ${f}`);
  }
  // Load-time guard breakage (validateSegmentTemplates / no-unison) surfaces here.
  for (const e of pageErrors) { console.log(`  [FAIL] pageerror: ${e}`); fatalCount++; }
  for (const e of consoleErrors) { console.log(`  [FAIL] console.error: ${e}`); fatalCount++; }

  console.log(`\n${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} template checks passed.`);
  if (fatalCount) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
