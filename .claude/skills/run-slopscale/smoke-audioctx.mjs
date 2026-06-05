#!/usr/bin/env node
// Assertive guard for SlopScale's window.AudioContext patch. Two regressions:
//
// (1) v0.5.0 cross-plugin: the stub was handed to EVERY `new AudioContext()` page-wide
//     whenever SlopScale's audioCtx merely existed — so the host's stem loader (another
//     plugin/screen) got a context with no decodeAudioData and all stems failed. The fix
//     scopes the stub to when SlopScale's OWN screen is active → backgrounded SlopScale
//     yields the REAL thing.
//
// (2) scorer-poisoning (fixed 2026-06-04): the click-suppressing stub also poisoned the
//     Minigames scorer, which opens its OWN `new AudioContext()` for the mic. The stub's
//     resume() is undefined + state 'closed', so createContinuous().start() threw and the
//     tuner / grading / per-note gems silently died — even on a current host with a mic.
//     The fix gates the stub on !ptAvailable(): the fake (a workaround for old hosts whose
//     highway doesn't honor bgReactive:false) is only handed out when NO scoring SDK is
//     present. On a host WITH the SDK, `new AudioContext()` is always real (the highway
//     honors bgReactive:false so no click to suppress, and the scorer needs a real ctx).
//
// So this guard is TARGET-AWARE: on the SDK-having checkout it asserts a real, scorer-usable
// context while SlopScale is visible; on the SDK-less bundled target it asserts the stub.
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

  // Is the Minigames scoring SDK present on this host? It loads lazily after the screen
  // opens — wait briefly. Present ⇔ current/checkout host; absent ⇔ bundled host.
  let hasSDK = false;
  try { await page.waitForFunction(() => typeof window.slopsmithMinigames?.scoring?.createContinuous === "function", { timeout: 4000 }); hasSDK = true; } catch {}

  // Create SlopScale's audioCtx via a real Play gesture, then stop — the session state
  // that poisoned the global in v0.5.0 (ctx exists, not playing).
  await page.click("#slopscale-play");
  await page.waitForTimeout(500);
  await page.click("#slopscale-play");   // stop
  await page.waitForTimeout(300);

  // While SlopScale is the active screen + its audioCtx exists:
  const visible = await page.evaluate(() => {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const r = { decode: typeof c.decodeAudioData, resume: typeof c.resume, state: c.state };
    try { c.close && c.close(); } catch {}
    return r;
  });
  if (hasSDK) {
    // (2) SDK present: the patch must NOT fake — the scorer's `new AudioContext()` needs a
    //     real, usable context (resume() + decodeAudioData), or tuner/grading/gems die.
    ok(visible.decode === "function" && visible.resume === "function" && visible.state !== "closed",
      "SDK present: REAL AudioContext while SlopScale visible — scorer/tuner/gems NOT poisoned by the patch",
      `decode=${visible.decode} resume=${visible.resume} state=${visible.state}`);
  } else {
    // (1) No SDK (old host): the highway-click stub is in force while visible.
    ok(visible.decode === "undefined",
      "no SDK: highway-click stub active while SlopScale visible (and no scorer to break)",
      `decodeAudioData=${visible.decode}`);
  }

  // (v0.5.0 fix, both targets): background SlopScale → new AudioContext() must be REAL for
  // the host's stem loader (the cross-plugin regression).
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

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  audiocontext-sharing: ${fails} failure(s)  [SDK ${hasSDK ? "present" : "absent"}]`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
