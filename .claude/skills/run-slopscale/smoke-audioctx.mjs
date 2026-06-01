#!/usr/bin/env node
// Assertive guard for the v0.5.0 cross-plugin AudioContext regression.
// SlopScale replaces window.AudioContext with a click-suppressing stub for
// highway_3d. The bug: the stub was handed to EVERY `new AudioContext()`
// page-wide whenever SlopScale's audioCtx merely existed — so the host's stem
// loader (a different plugin/screen) got a context with no decodeAudioData
// ("ctx.decodeAudioData is not a function"), and all stems failed to decode.
//
// The fix scopes the stub to when SlopScale's OWN screen is active. This guard
// locks it: (a) while SlopScale is the active screen the stub is in force (the
// highway-click fix), and (b) when SlopScale is backgrounded, `new AudioContext`
// is the REAL thing with a working decodeAudioData (other plugins unaffected).
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
  page.on("pageerror", e => console.error("[page error]", e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-slopscale"));
  await page.waitForSelector("#slopscale-root", { state: "attached" });
  await page.waitForSelector("#slopscale-play");

  // Create SlopScale's audioCtx via a real Play gesture, then stop — this is the
  // session state that poisoned the global in v0.5.0 (ctx exists, not playing).
  await page.click("#slopscale-play");
  await page.waitForTimeout(500);
  await page.click("#slopscale-play");   // stop
  await page.waitForTimeout(300);

  // (a) While SlopScale is the active screen, the stub is in force (highway-click
  //     suppression): a freshly-constructed AudioContext has no decodeAudioData.
  const visible = await page.evaluate(() => {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    return { decode: typeof c.decodeAudioData, ctor: c.constructor && c.constructor.name };
  });
  ok(visible.decode === "undefined", "stub IS active while SlopScale screen is visible (highway-click fix intact)", `decodeAudioData=${visible.decode}`);

  // (b) THE FIX: background SlopScale (host hides inactive screens via display:none)
  //     → new AudioContext() must be the REAL thing for the host stem loader.
  const hidden = await page.evaluate(() => {
    const screen = document.getElementById("plugin-slopscale");
    const prev = screen.style.display;
    screen.style.display = "none";                       // simulate navigating to another screen
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const decode = typeof c.decodeAudioData;
    try { c.close(); } catch {}
    screen.style.display = prev;
    return { decode };
  });
  ok(hidden.decode === "function", "REAL AudioContext (decodeAudioData present) when SlopScale is backgrounded — host stem loader works", `decodeAudioData=${hidden.decode}`);

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  audiocontext-sharing: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
