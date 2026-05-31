#!/usr/bin/env node
// Assertive smoke test across all four SlopScale renderers.
//
// Unlike `driver.mjs all-renderers` (which only screenshots), this PASSES or
// FAILS each renderer on concrete signals and exits non-zero if any fail —
// so it can gate a refactor of screen.js without eyeballing PNGs.
//
// Per renderer it asserts:
//   1. view switch took          — the clicked .slopscale-view-btn is .active
//   2. renderer attached         — #slopscale-renderer-status is non-empty
//   3. a render surface exists   — a sized, visible <canvas> in .slopscale-render-host
//   4. it actually drew          — non-uniform pixels (enforced only for the
//                                  in-tree 2D renderers; borrowed WebGL/host
//                                  viz mount their own canvas we can't read)
//   5. playback drives the clock — #slopscale-time-cur advances after Play
//   6. no uncaught errors        — no pageerror / non-benign console.error
//                                  during attach + draw + playback
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-slopscale/smoke-renderers.mjs
//
// Exit code 0 = all renderers passed, 1 = one or more failed (or host down).
// On any failure it drops a screenshot in .slopscale-shots/smoke-fail-<kind>.png.

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const SHOT_DIR = process.env.SHOT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../../.slopscale-shots");

// kind matches data-renderer on the view buttons. enforcePixels is true only
// where SlopScale draws into the in-tree #slopscale-canvas with a 2D context;
// highway_3d and builtin_2d borrow host viz that mount their own canvas.
const RENDERERS = [
  { kind: "highway_3d",  enforcePixels: false },
  { kind: "builtin_2d",  enforcePixels: false },
  { kind: "tab_2d",      enforcePixels: true  },
  { kind: "notation_2d", enforcePixels: true  },
];

// Console noise that is expected and not a SlopScale fault (see SKILL.md #7 +
// headless AudioContext autoplay policy).
const BENIGN = [
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
];
const isBenign = (msg) => BENIGN.some((re) => re.test(msg));

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
}

// Trigger a generate. Pathway mode (default) has no Regenerate button — a
// tempo-tier click generates; Custom mode exposes #slopscale-regenerate; the
// public API is the last resort. Mirrors driver.mjs.generate().
async function generate(page) {
  const tier = await page.$("#slopscale-tempo-tiers button, .slopscale-tier-btn, [data-tempo-tier]");
  const regen = await page.$("#slopscale-regenerate");
  if (tier && (await tier.isVisible())) await tier.click();
  else if (regen && (await regen.isVisible())) await regen.click();
  else await page.evaluate(() => window.SlopScale?.generateExercise?.(window.SlopScale?.readConfig?.() || {}));
  await page.waitForFunction(() => {
    const s = document.getElementById("slopscale-renderer-status");
    return s && s.textContent && s.textContent.trim().length > 0;
  }, { timeout: 5_000 });
  await page.waitForTimeout(500);
}

async function switchRenderer(page, kind) {
  const btn = await page.$(`.slopscale-view-btn[data-renderer="${kind}"]`);
  if (!btn) throw new Error(`Renderer button not found: ${kind}`);
  await btn.click();
  await page.waitForTimeout(700); // attachRenderer is async (may lazy-load host viz)
}

function readSizedCanvas() {
  const host = document.querySelector(".slopscale-render-host");
  if (!host) return null;
  // The render host also holds the DAW ruler and the chord-box overlay — those
  // are chrome, not the render surface. The real surface is #slopscale-canvas
  // (in-tree renderers) or a borrowed host-viz canvas mounted as its sibling.
  const NON_RENDER = new Set(["slopscale-ruler-canvas", "slopscale-chordbox"]);
  const canvases = [...host.querySelectorAll("canvas")].filter((c) => !NON_RENDER.has(c.id));
  const visible = canvases.find((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && c.offsetParent !== null;
  }) || canvases.find((c) => c.width > 1 && c.height > 1);
  return visible ? { id: visible.id || "(anon)", w: visible.width, h: visible.height } : null;
}

// 'drew' | 'blank' | 'na' — best-effort. Only meaningful for a 2D #slopscale-canvas.
function readPixels() {
  const c = document.getElementById("slopscale-canvas");
  if (!c) return "na";
  let ctx;
  try { ctx = c.getContext("2d"); } catch { return "na"; }
  if (!ctx) return "na"; // canvas is a WebGL/host-viz surface
  try {
    const w = Math.min(c.width, 400), h = Math.min(c.height, 300);
    if (w < 2 || h < 2) return "na";
    const data = ctx.getImageData(0, 0, w, h).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 37) {
      seen.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
      if (seen.size > 2) break;
    }
    return seen.size >= 2 ? "drew" : "blank";
  } catch { return "na"; } // tainted / context lost
}

async function clockAdvances(page) {
  const cur = () => page.$eval("#slopscale-time-cur", (e) => e.textContent.trim());
  const t0 = await cur();
  await page.click("#slopscale-play");
  let now = t0, advanced = false;
  for (let i = 0; i < 12 && !advanced; i++) {
    await page.waitForTimeout(400);
    now = await cur();
    advanced = now !== t0;
  }
  // Stop so the next renderer starts clean (Play is a toggle).
  await page.click("#slopscale-play").catch(() => {});
  await page.waitForTimeout(150);
  return { advanced, from: t0, to: now };
}

async function screenshot(page, name) {
  if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text());
    });

    await gotoSlopScale(page);
    await generate(page);

    for (const r of RENDERERS) {
      const errBase = pageErrors.length;
      const conBase = consoleErrors.length;
      const fails = [];

      await switchRenderer(page, r.kind);
      await generate(page);

      const active = await page
        .$eval(`.slopscale-view-btn[data-renderer="${r.kind}"]`, (b) => b.classList.contains("active"))
        .catch(() => false);
      if (!active) fails.push("view button not active after click");

      const status = (await page.$eval("#slopscale-renderer-status", (e) => e.textContent.trim()).catch(() => "")) || "";
      if (!status) fails.push("renderer-status label empty");

      const canvas = await page.evaluate(readSizedCanvas);
      if (!canvas) fails.push("no sized/visible canvas in render host");

      const pixels = await page.evaluate(readPixels);
      if (r.enforcePixels && pixels === "blank") fails.push("canvas drew only a uniform fill (blank)");

      const clock = await clockAdvances(page);
      if (!clock.advanced) fails.push(`clock did not advance (stuck at ${clock.from})`);

      const newPageErrs = pageErrors.slice(errBase);
      const newConErrs = consoleErrors.slice(conBase);
      for (const e of newPageErrs) fails.push(`pageerror: ${e}`);
      for (const e of newConErrs) fails.push(`console.error: ${e}`);

      const pass = fails.length === 0;
      if (!pass) await screenshot(page, `smoke-fail-${r.kind}`);
      results.push({ kind: r.kind, pass, status, canvas, pixels, clock, fails });
    }
  } finally {
    await browser.close();
  }

  // Report.
  console.log("\n=== SlopScale renderer smoke ===");
  let failed = 0;
  for (const r of results) {
    const tag = r.pass ? "PASS" : "FAIL";
    const cv = r.canvas ? `${r.canvas.id} ${r.canvas.w}x${r.canvas.h}` : "none";
    console.log(`[${tag}] ${r.kind.padEnd(12)} status="${r.status}" canvas=${cv} pixels=${r.pixels} clock=${r.clock.from}->${r.clock.to}`);
    if (!r.pass) {
      failed++;
      for (const f of r.fails) console.log(`         • ${f}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} renderers passed.`);
  if (failed) {
    console.log(`Failure screenshots in ${SHOT_DIR}`);
    process.exit(1);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
