#!/usr/bin/env node
// Assertive guard: generated charts must adjust for STRING COUNT and TUNING.
// Born from three real bugs (2026-06-01): (1) the string-count chip didn't
// regenerate, (2) the customOpenMidis hidden field sat OUTSIDE the controls
// form so readConfig never saw it, (3) readConfig resolved CAGED/3NPS shapes
// against the standard tuning instead of the effective one.
//
// IMPORTANT: this drives the REAL form -> readConfig path (set form fields /
// the hidden tuning input, then readConfig() + generateExercise). Hand-built
// configs lie here — stringCount, the effective tuning, and the pre-resolved
// CAGED shapeNotes are all co-derived inside readConfig, so a faithful test
// must go through it. PASS/FAIL per check; non-zero exit on any failure.
import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (cond, label, detail) => { console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}${detail ? "  " + detail : ""}`); if (!cond) fails++; };

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
}

const browser = await chromium.launch({ headless: true });
try {
  await ensureHost();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const pageErrs = [];
  page.on("pageerror", e => pageErrs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-slopscale"));
  await page.waitForSelector("#slopscale-root", { state: "attached" });
  await page.waitForSelector(".slopscale-view-btn");

  // Install in-page helpers that drive the real form + readConfig.
  await page.evaluate(() => {
    window.__t = {
      setForm(o) { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#slopscale-controls [name="${k}"]`); if (el) el.value = String(v); } },
      setTuning(midis) { const h = document.querySelector("#slopscale-custom-open-midis"); if (h) h.value = midis ? midis.join(",") : ""; },
      gen() { const ex = window.SlopScale.generateExercise(window.SlopScale.readConfig()); const ss = ex.chart.notes.map(n => n.s); return { sig: [...new Set(ex.chart.notes.map(n => `${n.s}:${n.f}`))].sort().join("|"), n: ex.chart.notes.length, min: Math.min(...ss), max: Math.max(...ss) }; },
    };
  });

  console.log("-- (1) GENERATOR adapts to string count (full_neck uses every string) --");
  for (const [setup, count] of [["guitar_6_standard", 6], ["guitar_7_standard", 7], ["guitar_8_standard", 8], ["bass_4_standard", 4], ["bass_5_standard", 5], ["bass_6_standard", 6]]) {
    const r = await page.evaluate((su) => { window.__t.setTuning(null); window.__t.setForm({ stringSetup: su, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "full_neck" }); return window.__t.gen(); }, setup);
    ok(r.n > 0 && r.min === 0 && r.max === count - 1, setup, `notes=${r.n} strings=${r.min}..${r.max} (expect max ${count - 1})`);
  }

  console.log("-- (2) GENERATOR adapts to tuning (CAGED shape shifts; guards the orphaned field + shape-resolution fixes) --");
  const t = await page.evaluate(() => {
    window.__t.setForm({ stringSetup: "guitar_6_standard", practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" });
    window.__t.setTuning(null); const std = window.__t.gen().sig;
    window.__t.setTuning([38, 45, 50, 55, 59, 64]); const dropD = window.__t.gen().sig;   // low E -> D, via the hidden field readConfig must read
    window.__t.setTuning(null);
    return { std, dropD };
  });
  ok(t.std !== t.dropD, "Drop-D shifts the CAGED note positions vs standard", t.std === t.dropD ? "(IDENTICAL — tuning ignored!)" : "(differ)");

  console.log("-- (3) UI: tuning dropdown changes the generated chart --");
  await page.evaluate(() => { document.querySelector("#slopscale-mode-custom")?.click(); document.querySelector("#slopscale-setup-btn")?.click(); });
  await page.waitForTimeout(150);
  const ui = await page.evaluate(() => {
    window.__t.setForm({ stringSetup: "guitar_6_standard", practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" });
    window.__t.setTuning(null);
    const before = window.__t.gen().sig;
    const sel = document.querySelector("#slopscale-tuning-select");
    let picked = null;
    for (const o of sel.options) { if (o.value !== sel.value && !o.disabled && o.value !== "custom" && o.value !== "standard") { sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); picked = o.textContent; break; } }
    return { picked, before, after: window.__t.gen().sig };
  });
  ok(ui.picked && ui.before !== ui.after, "a non-standard tuning preset changes the generated notes", `picked=${ui.picked}`);

  console.log("-- (4) UI: string-count chip updates readConfig().stringSetup --");
  const uiCount = await page.evaluate(() => {
    const before = window.SlopScale.readConfig().stringSetup;
    document.querySelector('#slopscale-string-count-row .slopscale-string-count-btn[data-count="7"]')?.click();
    return { before, after: window.SlopScale.readConfig().stringSetup };
  });
  ok(uiCount.after === "guitar_7_standard" && uiCount.after !== uiCount.before, "7-chip sets stringSetup", `${uiCount.before} -> ${uiCount.after}`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  strings/tuning: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
