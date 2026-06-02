#!/usr/bin/env node
// Assertive smoke test for the SlopScale generators (complements
// smoke-renderers.mjs, which covers the render/playback surface).
//
// It drives window.SlopScale.generateExercise() directly (fast — no rendering)
// across every practice type and every scale, plus a bass pass (string-count
// dependent shapes), then launches each built-in session through the UI. For
// each generated chart it validates structure: notes present, every note has a
// finite t>=0, an integer string in range, a sane fret, positive sustain; beats
// present (transport clock). It exits non-zero on any fatal failure.
//
// The no-unison rule is covered for free: screen.js throws a
// "[SlopScale no-unison] …" error at load time if a resolved shape doubles a
// pitch, which surfaces as a pageerror and fails the run.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-slopscale/smoke-generators.mjs   # or: npm run smoke:gen
//
// Exit 0 = all generators OK (warnings allowed), 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";

const BENIGN = [
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
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
  await page.waitForSelector(".slopscale-view-btn", { timeout: 5_000 });
  await page.waitForFunction(() => window.SlopScale && typeof window.SlopScale.generateExercise === "function", { timeout: 5_000 });
}

// Runs in the page: generate `cfg` overrides over a base config and validate the
// resulting chart. Returns one result row per override. `mode` picks the matrix.
function runMatrixInPage({ mode, overridesList, stringCount }) {
  const S = window.SlopScale;
  const base = S.readConfig();
  const sc = stringCount || (base.openMidis && base.openMidis.length) || 6;

  function check(res) {
    const fatal = [], warn = [];
    if (!res || !res.chart) { fatal.push("no chart returned"); return { fatal, warn, notes: 0 }; }
    const c = res.chart;
    const notes = Array.isArray(c.notes) ? c.notes : [];
    if (notes.length === 0) fatal.push("no notes");
    if (!Array.isArray(c.beats) || c.beats.length === 0) warn.push("no beats");
    // String index must be inside the instrument's range — FATAL, not a warning
    // (a bass-invalid string is a real regression, not a nit). Use the chart's
    // string count; fall back to the 8-string guitar ceiling if it's unknown.
    const maxStrings = Number.isInteger(sc) && sc > 0 ? sc : 8;
    for (const n of notes) {
      if (typeof n.t !== "number" || !isFinite(n.t) || n.t < 0) { fatal.push(`bad t=${n.t}`); break; }
      if (!Number.isInteger(n.s) || n.s < 0 || n.s >= maxStrings) { fatal.push(`bad string=${n.s} (max ${maxStrings})`); break; }
      if (!Number.isInteger(n.f) || n.f < 0 || n.f > 30) { fatal.push(`bad fret=${n.f}`); break; }
      if (n.sus !== undefined && (typeof n.sus !== "number" || n.sus <= 0)) { fatal.push(`bad sus=${n.sus}`); break; }
    }
    return { fatal, warn, notes: notes.length };
  }

  const out = [];
  for (const ov of overridesList) {
    const label = mode === "scale" ? `scale:${ov.scale}` : (ov.practiceType || JSON.stringify(ov));
    // readConfig() returns BOTH cfg.mode and cfg.practiceType, and the dispatch
    // (buildSingleChart) reads cfg.mode first — so an override must set both or
    // the stale base.mode wins and every type generates the same chart.
    const merged = { ...base, ...ov };
    if (ov.practiceType) merged.mode = ov.practiceType;
    try {
      const res = S.generateExercise(merged);
      const v = check(res);
      out.push({ label, ok: v.fatal.length === 0, fatal: v.fatal, warn: v.warn, notes: v.notes });
    } catch (e) {
      out.push({ label, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 });
    }
  }
  return out;
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
  const sections = []; // { name, rows }
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });

    await gotoSlopScale(page);

    // ── Phase 1: practice-type matrix (default scale, guitar) ──────────────
    const practiceTypes = await page.$$eval('select[name="practiceType"] option', (os) => os.map((o) => o.value));
    const p1 = await page.evaluate(runMatrixInPage, {
      mode: "pt", stringCount: null,
      overridesList: practiceTypes.map((practiceType) => ({ practiceType })),
    });
    sections.push({ name: `practice types (${practiceTypes.length})`, rows: p1 });

    // ── Phase 2: scale matrix (practiceType=scale, guitar) ─────────────────
    const scales = await page.$$eval('select[name="scale"] option', (os) => os.map((o) => o.value));
    const p2 = await page.evaluate(runMatrixInPage, {
      mode: "scale", stringCount: null,
      overridesList: scales.map((scale) => ({ practiceType: "scale", scale })),
    });
    sections.push({ name: `scales (${scales.length})`, rows: p2 });

    // ── Phase 3: bass pass (string-count-dependent shapes) ─────────────────
    const bassVal = await page.evaluate(() => {
      const sel = document.querySelector('select[name="instrument"]');
      if (!sel) return null;
      const opt = [...sel.options].find((o) => /bass/i.test(o.value) || /bass/i.test(o.textContent));
      if (!opt) return null;
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return opt.value;
    });
    if (bassVal) {
      await page.waitForTimeout(300); // let syncInstrumentClass switch shapes
      const bassTypes = ["scale", "diatonic_arpeggios", "chromatic", "walking_bass",
        "root_fifth_octave", "octave_groove", "dead_note_groove", "right_hand_technique", "slap_pop"].filter((t) => practiceTypes.includes(t));
      const p3 = await page.evaluate(runMatrixInPage, {
        mode: "pt", stringCount: null,
        overridesList: bassTypes.map((practiceType) => ({ practiceType })),
      });
      sections.push({ name: `bass (${bassVal}) practice types`, rows: p3 });
    } else {
      // A missing bass option is a real UI/config regression — fail, don't skip.
      sections.push({ name: "bass", rows: [{ label: "instrument select / bass option not found", ok: false, fatal: ["bass option missing; bass string-count smoke not executed"], warn: [], notes: 0 }] });
    }

    // ── Phase 4: built-in sessions via the UI launch path ──────────────────
    await page.click("#slopscale-mode-session").catch(() => {});
    await page.waitForTimeout(300);
    const sessionVals = await page.$$eval("#slopscale-session-select option", (os) =>
      os.filter((o) => o.value && !o.disabled).map((o) => ({ v: o.value, t: o.textContent.trim() }))
    ).catch(() => []);
    const sessionRows = [];
    for (const s of sessionVals) {
      const errBase = pageErrors.length, conBase = consoleErrors.length;
      try {
        await page.selectOption("#slopscale-session-select", s.v);
        await page.waitForTimeout(150);
        await page.click("#slopscale-launch-session");
        await page.waitForTimeout(700);
        const status = (await page.$eval("#slopscale-renderer-status", (e) => e.textContent.trim()).catch(() => "")) || "";
        const fatal = [];
        if (!status) fatal.push("renderer-status empty after launch");
        for (const e of pageErrors.slice(errBase)) fatal.push(`pageerror: ${e}`);
        for (const e of consoleErrors.slice(conBase)) fatal.push(`console.error: ${e}`);
        sessionRows.push({ label: `session:${s.v}`, ok: fatal.length === 0, fatal, warn: [], notes: 0 });
        // Stop playback if the launch auto-started it (Play toggles to Stop).
        const playTxt = await page.$eval("#slopscale-play", (e) => e.textContent).catch(() => "");
        if (playTxt && !/play/i.test(playTxt)) { await page.click("#slopscale-play").catch(() => {}); await page.waitForTimeout(150); }
      } catch (e) {
        sessionRows.push({ label: `session:${s.v}`, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 });
      }
    }
    sections.push({ name: `built-in sessions (${sessionVals.length})`, rows: sessionRows });
  } finally {
    await browser.close();
  }

  // Report.
  console.log("\n=== SlopScale generator smoke ===");
  let fatalCount = 0, warnCount = 0, total = 0;
  for (const sec of sections) {
    console.log(`\n-- ${sec.name} --`);
    for (const r of sec.rows) {
      total++;
      const tag = r.ok ? (r.warn.length ? "WARN" : "PASS") : "FAIL";
      if (!r.ok) fatalCount++;
      if (r.ok && r.warn.length) warnCount++;
      const extra = r.notes ? ` notes=${r.notes}` : "";
      console.log(`  [${tag}] ${r.label}${extra}`);
      for (const f of r.fatal) console.log(`         x ${f}`);
      for (const w of r.warn) console.log(`         ~ ${w}`);
    }
  }
  console.log(`\n${total - fatalCount}/${total} generator checks passed (${warnCount} with warnings).`);
  if (fatalCount) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
