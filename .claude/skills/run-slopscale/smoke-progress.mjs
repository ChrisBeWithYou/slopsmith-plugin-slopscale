#!/usr/bin/env node
// Assertive smoke test for the Depth Ladder + XP store (Phase 8).
//
// Drives window.SlopScale's progress helpers directly. Validates: XP accrues
// (derived/gained-only), and the TRAVEL axis credits a clean Push pass in a
// not-yet-credited key ONLY when the Speed climb is already cleared — with the
// rung flipping on the 2nd distinct key, no double-credit on a repeat key, no
// credit on an unclean run, and Off mode collapsing the whole layer.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-slopscale/smoke-progress.mjs   # or: npm run smoke:progress
//
// Exit 0 = all checks pass, 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const BENIGN = [/desktop audio api not available/i, /audiocontext/i, /failed to set up audio analyser/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/slopscale/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  if (!(await r.json()).ok) throw new Error("Plugin status not ok");
}
async function gotoSlopScale(page) {
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-slopscale"));
  await page.waitForSelector("#slopscale-root", { state: "attached", timeout: 10_000 });
  await page.waitForFunction(
    () => window.SlopScale && typeof window.SlopScale.advanceDepthLadder === "function" && typeof window.SlopScale.progressLoad === "function",
    { timeout: 5_000 }
  );
}

function runProgressInPage() {
  const S = window.SlopScale;
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, ok: !!cond, detail: cond ? "" : (detail || "") });
  // A clean Push run in `key` on a 4-tier pathway (topTier=3).
  const sess = (key, over) => Object.assign({ pathway_id: "pent_foundation", key, bpm_tier: 3, duration_ms: 30000, hit_count: 90, miss_count: 10 }, over || {});

  // ── Travel: Speed cleared (highest_tier=3 on a 4-tier pathway) ──────────────
  localStorage.setItem("slopscale.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
  localStorage.setItem("slopscale.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const r1 = S.advanceDepthLadder(sess("A"));   // 1st key → credited, no rung yet
  const r2 = S.advanceDepthLadder(sess("E"));   // 2nd distinct key → rung flips
  const r3 = S.advanceDepthLadder(sess("A"));   // repeat key → no new credit
  const p = S.progressLoad();
  const node = (p.byNode || {}).pent_foundation || {};
  ok("xp accrued (gained-only) over 3 runs", p.xp > 0, `xp=${p.xp}`);
  ok("1st key credited, no rung", r1 && r1.travelKey === "A" && r1.travelRung === false, JSON.stringify(r1));
  ok("2nd distinct key flips the Travel rung", r2 && r2.travelKey === "E" && r2.travelRung === true, JSON.stringify(r2));
  ok("repeat key not double-credited", r3 && r3.travelKey === null, JSON.stringify(r3));
  ok("keysCleared = [A,E]", JSON.stringify(node.keysCleared) === JSON.stringify(["A", "E"]), JSON.stringify(node.keysCleared));
  ok("Travel rung timestamp set", !!(node.depth && node.depth.travel), JSON.stringify(node.depth));
  const nps = S.nodeProgressState("pent_foundation", JSON.parse(localStorage.getItem("slopscale.pathway_tiers")));
  ok("nodeProgressState exposes depth.travel=true", !!(nps.depth && nps.depth.travel), JSON.stringify(nps.depth));

  // ── No Travel credit when Speed NOT cleared (highest_tier below top) ────────
  localStorage.setItem("slopscale.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 1 } }));
  localStorage.setItem("slopscale.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const rNoSpeed = S.advanceDepthLadder(sess("A"));
  const pNoSpeed = S.progressLoad();
  ok("no Travel credit before Speed cleared", (!rNoSpeed || rNoSpeed.travelKey === null) && ((pNoSpeed.byNode.pent_foundation || {}).keysCleared || []).length === 0, JSON.stringify(rNoSpeed));
  ok("XP still accrues without Speed cleared", pNoSpeed.xp > 0, `xp=${pNoSpeed.xp}`);

  // ── Unclean run earns no Travel credit (even at Push, Speed cleared) ────────
  localStorage.setItem("slopscale.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
  localStorage.setItem("slopscale.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const rDirty = S.advanceDepthLadder(sess("A", { hit_count: 50, miss_count: 50 }));   // 50% < 65%
  ok("unclean run earns no Travel credit", (!rDirty || rDirty.travelKey === null), JSON.stringify(rDirty));

  // ── Off mode collapses the layer (no xp/depth/return) ──────────────────────
  S.progressSetMode("off");
  const xpBefore = S.progressLoad().xp;
  const rOff = S.advanceDepthLadder(sess("D"));
  ok("Off mode returns null (no advance)", rOff === null, JSON.stringify(rOff));
  ok("Off mode accrues no XP", S.progressLoad().xp === xpBefore, `xp ${xpBefore}→${S.progressLoad().xp}`);
  S.progressSetMode("casual");

  return out;
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const browser = await chromium.launch({ headless: true });
  let rows = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) pageErrors.push(m.text()); });
    await gotoSlopScale(page);
    rows = await page.evaluate(runProgressInPage);
  } finally {
    await browser.close();
  }
  console.log("\n=== SlopScale depth-ladder / progress smoke ===\n");
  let fail = 0;
  for (const r of rows) {
    console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.name}`);
    if (!r.ok) { fail++; if (r.detail) console.log(`         x ${r.detail}`); }
  }
  for (const e of pageErrors) { console.log(`  [FAIL] pageerror: ${e}`); fail++; }
  console.log(`\n${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} progress checks passed.`);
  if (fail) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
