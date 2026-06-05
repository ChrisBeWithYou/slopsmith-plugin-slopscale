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
  await page.waitForFunction(() => window.SlopScale && typeof window.SlopScale.generateExercise === "function", { timeout: 10000 });

  // Install in-page helpers that drive the real form + readConfig.
  await page.evaluate(() => {
    window.__t = {
      setForm(o) { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#slopscale-controls [name="${k}"]`); if (el) el.value = String(v); } },
      // advancedMode is a checkbox; readConfig FORCES fretboardSystem to 'caged'
      // unless it's 'on', so any test of a non-caged system (e.g. full_neck) must
      // enable it or it silently tests CAGED instead.
      setAdvanced(on) { const c = document.querySelector('[name="advancedMode"]'); if (c) { c.checked = !!on; c.dispatchEvent(new Event("change", { bubbles: true })); } },
      setTuning(midis) { const h = document.querySelector("#slopscale-custom-open-midis"); if (h) h.value = midis ? midis.join(",") : ""; },
      gen() {
        const ex = window.SlopScale.generateExercise(window.SlopScale.readConfig());
        const ss = ex.chart.notes.map(n => n.s);
        const seen = new Set(), pos = [];
        for (const n of ex.chart.notes) { const k = `${n.s}:${n.f}`; if (!seen.has(k)) { seen.add(k); pos.push({ s: n.s, f: n.f }); } }
        pos.sort((a, b) => a.s - b.s || a.f - b.f);
        return { sig: [...seen].sort().join("|"), n: ex.chart.notes.length, min: Math.min(...ss), max: Math.max(...ss), pos, strings: [...new Set(ss)].sort((a, b) => a - b) };
      },
    };
  });

  console.log("-- (1) GENERATOR adapts to string count (full_neck uses every string) --");
  for (const [setup, count] of [["guitar_6_standard", 6], ["guitar_7_standard", 7], ["guitar_8_standard", 8], ["bass_4_standard", 4], ["bass_5_standard", 5], ["bass_6_standard", 6]]) {
    const r = await page.evaluate((su) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: su, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "full_neck" }); return window.__t.gen(); }, setup);
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

  console.log("-- (5) CAGED is a 6-string system: on 7/8-string it anchors on the TOP SIX (EADGBE), not the low B/F# --");
  // CAGED shapes encode the EADGBE interval pattern. On a standard 7/8-string the
  // top-6 strings ARE EADGBE, so the resolved box must equal the 6-string box
  // shifted up by `off = count-6` strings with IDENTICAL frets — never rooting the
  // E-shape on the low B (the over-reach fixed 2026-06-01, guitar-pedagogy review).
  const cagedBox = (su) => page.evaluate((s) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: s, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" }); return window.__t.gen(); }, su);
  const c6 = await cagedBox("guitar_6_standard");
  const c7 = await cagedBox("guitar_7_standard");
  const c8 = await cagedBox("guitar_8_standard");
  const shiftEq = (base, ext, off) => base.pos.length === ext.pos.length && base.pos.every((p, i) => ext.pos[i].s === p.s + off && ext.pos[i].f === p.f);
  ok(c6.strings[0] === 0, "6-string CAGED box spans the standard 6 (baseline unchanged)", `[${c6.strings.join(",")}]`);
  ok(!c7.strings.includes(0) && c7.strings[0] === 1, "7-string: low B (s=0) NOT in the box; anchors on s=1", `[${c7.strings.join(",")}]`);
  ok(!c8.strings.includes(0) && !c8.strings.includes(1) && c8.strings[0] === 2, "8-string: low F#/B (s=0,1) NOT in the box; anchors on s=2", `[${c8.strings.join(",")}]`);
  ok(shiftEq(c6, c7, 1), "7-string box === 6-string box shifted +1 string, identical frets");
  ok(shiftEq(c6, c8, 2), "8-string box === 6-string box shifted +2 strings, identical frets");
  // Open position is the worse over-reach (lower-string-wins dedupe can EVICT a
  // pitch from the canonical standard string), so it gets the same EADGBE anchor.
  const openBox = (su) => page.evaluate((s) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: s, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "open" }); return window.__t.gen(); }, su);
  const o7 = await openBox("guitar_7_standard");
  const o8 = await openBox("guitar_8_standard");
  ok(o7.n > 0 && !o7.strings.includes(0), "Open 7-string: low B (s=0) NOT used (anchors on top-6)", `[${o7.strings.join(",")}]`);
  ok(o8.n > 0 && !o8.strings.includes(0) && !o8.strings.includes(1), "Open 8-string: low F#/B (s=0,1) NOT used", `[${o8.strings.join(",")}]`);

  console.log("-- (6) Sweep arpeggios contain to the top-six on 7/8 (CAGED sweep template anchored, not an all-string low-B rake) --");
  const sweep = (su) => page.evaluate((s) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: s, practiceType: "sweep_arpeggios", scale: "natural_minor", key: "A", shape: "E", fretboardSystem: "caged", chordDepth: "triad", progression: "i-VI-III-VII", bars: "4" }); return window.__t.gen(); }, su);
  const sw6 = await sweep("guitar_6_standard");
  const sw7 = await sweep("guitar_7_standard");
  const sw8 = await sweep("guitar_8_standard");
  ok(sw6.n > 0 && sw6.strings[0] === 0, "6-string sweep uses the standard 6 (baseline unchanged)", `[${sw6.strings.join(",")}]`);
  ok(sw7.n > 0 && !sw7.strings.includes(0), "7-string sweep: low B (s=0) NOT used (top-six grip, not a low-B rake)", `[${sw7.strings.join(",")}]`);
  ok(sw8.n > 0 && !sw8.strings.includes(0) && !sw8.strings.includes(1), "8-string sweep: low F#/B (s=0,1) NOT used", `[${sw8.strings.join(",")}]`);

  console.log("-- (7) Pathway tuning plumbing: instAgnostic adapt + customOpenMidis vary + anti-leak (djent ladder, 2026-06-05) --");
  // Folded from probe-djent-ladder per the per-system rule (this suite owns the
  // tuning/config plumbing): an instAgnostic pure-time rung must ADAPT to the
  // player's instrument; a drop-tuning vary must land through the form=""-
  // associated hidden field (the stepper path); and the custom tuning must
  // NEVER leak into the next pathway selected.
  await page.evaluate(() => { document.querySelector("#slopscale-mode-guided")?.click(); });
  await page.waitForTimeout(150);
  const pw = await page.evaluate(() => {
    const S = window.SlopScale;
    const selPathway = (id) => { const sel = document.querySelector("#slopscale-pathway"); sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); return S.readConfig(); };
    const setupEl = document.querySelector('#slopscale-controls [name="stringSetup"]');
    setupEl.value = "bass_4_standard"; setupEl.dispatchEvent(new Event("change", { bubbles: true }));
    const adapt = selPathway("djent_chug_lock");          // instAgnostic → keeps the bass
    const coded = selPathway("djent_moving_chug");        // pedal_riff → guitar-coded
    const next = document.querySelector("#slopscale-shape-next");
    next.click(); next.click(); next.click();             // vary[3] = the drop-A override
    const drop = S.readConfig();
    const leak = selPathway("djent_chug_lock");           // next pathway must clear it
    setupEl.value = "guitar_6_standard"; setupEl.dispatchEvent(new Event("change", { bubbles: true }));
    return { adaptSetup: adapt.stringSetup, codedSetup: coded.stringSetup, dropMidis: drop.customOpenMidis, dropKey: drop.key, leakMidis: leak.customOpenMidis || null };
  });
  ok(pw.adaptSetup === "bass_4_standard", "instAgnostic rung adapts to the player's bass setup", pw.adaptSetup);
  ok(pw.codedSetup === "guitar_7_standard", "pedal_riff rung stays guitar-coded", pw.codedSetup);
  ok(Array.isArray(pw.dropMidis) && pw.dropMidis[0] === 33 && pw.dropKey === "A", "drop-A vary lands customOpenMidis via the form-associated hidden field", JSON.stringify(pw.dropMidis));
  ok(pw.leakMidis === null, "custom tuning does NOT leak into the next pathway selected", JSON.stringify(pw.leakMidis));

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  strings/tuning: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
