// Smoke: the backing-engine core — chart.timeline + seeded determinism.
// Owns the backing-engine SYSTEM per the per-system growth rule (CLAUDE.md):
// new backing-engine asserts land as rows HERE, not as new suite files.
//
//   1. chart.timeline structural validity for EVERY style palette — non-empty,
//      slot-sorted, contiguous, durBeats>0, covers the chart, and the bar-locked
//      degenerate case (durBeats == meter numerator) holds when no harmonicRhythm.
//   2. Sub-bar harmonic rhythm ('2/bar') — twice the events, half the slot.
//   3. applyTimelinePush semantics — anticipation moves the SOUNDING start
//      early, truncates the previous chord's tail, clamps at chart time 0.
//   4. Seeded determinism — same cfg => byte-identical chart, even for
//      direction:'random' (the one shuffle in the core); explicit humanSeed
//      reproduces / varies the roll; chart carries humanSeed.
//   5. Key-cycle charts carry a PER-RUNG timeline (keys change across rungs).
//   6. Session charts assemble the timeline PER-BLOCK (the desync rule) —
//      block B's window holds block B's harmony, not block A's.
//   7. Rolling-window scheduler ceiling — Play on a 30-min Woodshed creates a
//      bounded number of audio nodes (was 39k whole-pass) with no second-long
//      main-thread block. Guards backing-engine step 0.
import { chromium } from "playwright";
const HOST = process.env.SLOPSCALE_HOST || "http://127.0.0.1:8765";
let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL ${label} ${detail}`); }
};

const browser = await chromium.launch({ headless: true });
const step = (s) => console.log(`  .. ${s}`);
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    globalThis.__SS_HARNESS__ = true;
    // Audio-node creation counter + longtask log for the scheduler-ceiling row.
    window.__nodeCount = 0;
    const P = (window.AudioContext || window.webkitAudioContext)?.prototype;
    if (P) ["createOscillator", "createGain", "createBufferSource", "createBiquadFilter", "createDynamicsCompressor"].forEach((n) => {
      const orig = P[n];
      if (orig) P[n] = function (...a) { window.__nodeCount++; return orig.apply(this, a); };
    });
    window.__longTasks = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch {}
  });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-slopscale", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  // showScreen can throw from inside the host if called mid-boot (a race seen
  // intermittently as a minified host error) — retry briefly.
  for (let i = 0; ; i++) {
    try { await page.evaluate(() => window.showScreen("plugin-slopscale")); break; }
    catch (e) { if (i >= 2) throw e; await page.waitForTimeout(1500); }
  }
  await page.waitForSelector("#slopscale-root", { state: "attached" });
  await page.waitForSelector(".slopscale-view-btn");
  await page.waitForFunction(() => window.SlopScale && typeof window.SlopScale.generateExercise === "function" && globalThis.__ss_debug);
  await page.waitForTimeout(600);   // let the screen's boot settle (first-load race)

  // ── (1)+(2) timeline validity per style palette + bar-lock degenerate ──────
  step("styles");
  const styles = await page.evaluate(() => {
    const S = window.SlopScale;
    const out = [];
    for (const id of Object.keys(S.STYLE_PALETTES)) {
      const cfg = Object.assign({}, S.readConfig(), S.stylePaletteConfig(id), { practiceType: "chord_scales", keyCycle: "none" });
      let r;
      try {
        const ex = S.generateExercise(cfg);
        const tl = ex.chart.timeline || [];
        const dur = ex.chart.duration || 0;
        let sorted = true, contiguous = true, durOk = true, barLock = true;
        const num = cfg.meter.numerator;
        for (let i = 0; i < tl.length; i++) {
          if (!(tl[i].durBeats > 0)) durOk = false;
          if (i && tl[i].startBeat < tl[i - 1].startBeat) sorted = false;
          if (i && Math.abs((tl[i - 1].startBeat + tl[i - 1].durBeats) - tl[i].startBeat) > 1e-3) contiguous = false;
          if (Math.abs(tl[i].durBeats - num) > 1e-3) barLock = false;   // no palette sets harmonicRhythm yet
        }
        const covers = tl.length && Math.abs(tl[tl.length - 1].endSec - dur) < 0.05;
        r = { id, n: tl.length, sorted, contiguous, durOk, barLock, covers };
      } catch (e) { r = { id, err: String(e && e.message || e) }; }
      out.push(r);
    }
    return out;
  });
  for (const s of styles) {
    ok(!s.err, `style ${s.id}: generates`, s.err || "");
    if (s.err) continue;
    ok(s.n > 0 && s.sorted && s.contiguous && s.durOk && s.covers, `style ${s.id}: timeline valid`, `n=${s.n} sorted=${s.sorted} contig=${s.contiguous} dur>0=${s.durOk} covers=${s.covers}`);
    ok(s.barLock, `style ${s.id}: bar-locked degenerate (durBeats == numerator)`, "");
  }

  step("2/bar");
  const sub = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign({}, S.readConfig(), { practiceType: "chord_scales", progression: "ii-V-I", key: "C", scale: "major", bars: 4, keyCycle: "none" });
    const one = S.generateExercise(base).chart.timeline;
    const two = S.generateExercise(Object.assign({}, base, { harmonicRhythm: "2/bar" })).chart.timeline;
    const num = base.meter.numerator;
    return {
      n1: one.length, n2: two.length,
      halfSlot: two.every(e => Math.abs(e.durBeats - num / 2) < 1e-3),
      contiguous: two.every((e, i) => !i || Math.abs((two[i - 1].startBeat + two[i - 1].durBeats) - e.startBeat) < 1e-3),
    };
  });
  ok(sub.n2 === sub.n1 * 2 && sub.halfSlot && sub.contiguous, "harmonicRhythm 2/bar: twice the events at half the slot", `n1=${sub.n1} n2=${sub.n2} half=${sub.halfSlot} contig=${sub.contiguous}`);

  // ── (3) push semantics (pure helper via the harness debug surface) ─────────
  step("push");
  const push = await page.evaluate(() => {
    const S = window.SlopScale, D = globalThis.__ss_debug;
    const cfg = Object.assign({}, S.readConfig(), { practiceType: "chord_scales", progression: "ii-V-I", key: "C", bars: 4, keyCycle: "none" });
    const dur = 4 * (cfg.bars ? 1 : 1) * 0 + 8;                       // 8s synthetic window
    const beatSec = (() => { const tl = D.compileChordTimeline(cfg, dur); return (tl[0].endSec - tl[0].startSec) / tl[0].durBeats; })();
    const tl = D.compileChordTimeline(cfg, dur);
    const slot1 = tl[1].startSec, prevEnd0 = tl[0].endSec;
    tl[1].push = 0.5;
    tl[0].push = 4;                                                    // absurd push on the FIRST event -> clamp at 0
    D.applyTimelinePush(tl, cfg, dur);
    return {
      movedEarly: Math.abs(tl[1].startSec - (slot1 - 0.5 * beatSec)) < 1e-3,
      prevTruncated: Math.abs(tl[0].endSec - tl[1].startSec) < 1e-3 && tl[0].endSec < prevEnd0,
      slotUntouched: Math.abs(tl[1].startBeat * beatSec - slot1) < 1e-3,
      firstClamped: tl[0].startSec === 0,
    };
  });
  ok(push.movedEarly, "push: sounding start moves early by push*beatSec", "");
  ok(push.prevTruncated, "push: previous chord's tail truncates at the anticipated start", "");
  ok(push.slotUntouched, "push: the harmonic SLOT (startBeat) is untouched", "");
  ok(push.firstClamped, "push: first event clamps at chart time 0", "");

  // ── (4) seeded determinism ──────────────────────────────────────────────────
  step("determinism");
  const det = await page.evaluate(() => {
    const S = window.SlopScale;
    const base = Object.assign({}, S.readConfig(), {
      practiceType: "scale", scale: "major", key: "C", fretboardSystem: "full_neck",
      direction: "random", repeatCount: 2, bars: 4, keyCycle: "none", advancedMode: true,
    });
    const j = (cfg) => JSON.stringify(S.generateExercise(cfg).chart);
    const a1 = j(base), a2 = j(base);
    const s1 = j(Object.assign({}, base, { humanSeed: 123 }));
    const s1b = j(Object.assign({}, base, { humanSeed: 123 }));
    const s2 = j(Object.assign({}, base, { humanSeed: 456 }));
    const seedOnChart = S.generateExercise(base).chart.humanSeed;
    return { stable: a1 === a2, seedStable: s1 === s1b, seedVaries: s1 !== s2, seedOnChart: Number.isFinite(seedOnChart) };
  });
  ok(det.stable, "determinism: same cfg => byte-identical chart (direction:'random')", "");
  ok(det.seedStable, "determinism: same humanSeed => identical chart", "");
  ok(det.seedVaries, "determinism: different humanSeed => different roll", "");
  ok(det.seedOnChart, "chart carries humanSeed", "");

  // ── (5) key-cycle: per-rung timeline, keys actually change ─────────────────
  step("key-cycle");
  const kc = await page.evaluate(() => {
    const S = window.SlopScale;
    const cfg = Object.assign({}, S.readConfig(), {
      practiceType: "scale", scale: "major", key: "C", progression: "ii-V-I",
      keyCycle: "circle_of_fifths", keyCycleLength: 3, bars: 2, advancedMode: true,
    });
    const ch = S.generateExercise(cfg).chart;
    const tl = ch.timeline || [];
    const secs = (ch.sections || []).map(s => s.time);
    const evAt = (t) => tl.find(e => e.startSec >= t - 1e-3);
    const r1 = evAt(secs[0] || 0), r2 = evAt(secs[1] || -1);
    const monotonic = tl.every((e, i) => !i || e.startSec >= tl[i - 1].startSec - 1e-6);
    return { n: tl.length, monotonic, keysDiffer: !!(r1 && r2 && r1.rootPc !== r2.rootPc) };
  });
  ok(kc.n > 0, "key-cycle chart carries a timeline", `n=${kc.n}`);
  ok(kc.monotonic, "key-cycle timeline is time-monotonic", "");
  ok(kc.keysDiffer, "key-cycle timeline changes key per rung (not the start key everywhere)", "");

  // ── (6) session: per-block timeline (the desync rule for harmony) ──────────
  step("session");
  const ses = await page.evaluate(() => {
    const S = window.SlopScale;
    const session = {
      name: "tl-test", stringSetup: "guitar_6_standard",
      segments: [
        { name: "A", kind: "scale", config: { key: "C",  progression: "ii-V-I", bars: 2, bpm: 100 } },
        { name: "B", kind: "scale", config: { key: "F#", progression: "ii-V-I", bars: 2, bpm: 100 } },
      ],
    };
    const ch = S.generateSession(session).chart;
    const tl = ch.timeline || [], bounds = ch.segmentBounds || [];
    if (tl.length === 0 || bounds.length !== 2) return { n: tl.length, nb: bounds.length };
    const roots = (b) => new Set(tl.filter(e => e.startSec >= b.start - 1e-3 && e.startSec < b.end - 1e-3).map(e => e.rootPc));
    const ra = roots(bounds[0]), rb = roots(bounds[1]);
    const overlap = [...ra].filter(x => rb.has(x));
    const monotonic = tl.every((e, i) => !i || e.startSec >= tl[i - 1].startSec - 1e-6);
    return { n: tl.length, nb: bounds.length, monotonic, ra: [...ra], rb: [...rb], overlap };
  });
  ok(ses.n > 0 && ses.nb === 2, "session chart carries a timeline + bounds", `n=${ses.n} bounds=${ses.nb}`);
  ok(ses.monotonic, "session timeline is time-monotonic", "");
  ok(ses.overlap && ses.overlap.length === 0, "block B's window holds block B's harmony (C vs F# ii-V-I roots disjoint)", `A=${ses.ra} B=${ses.rb}`);

  // ── (7) scheduler ceiling: a Woodshed Play stays windowed ───────────────────
  step("scheduler ceiling");
  await page.click("#slopscale-mode-session");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const sel = document.getElementById("slopscale-length-preset");
    if (sel) { sel.value = "woodshed"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({ n: window.__nodeCount, lt: window.__longTasks.length }));
  await page.click("#slopscale-launch-session");
  await page.waitForFunction(() => document.getElementById("slopscale-play")?.classList.contains("is-playing"), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({ n: window.__nodeCount, longTasks: window.__longTasks.slice() }));
  const created = after.n - before.n;
  const worst = Math.max(0, ...after.longTasks.slice(before.lt));
  ok(created > 0 && created < 2500, "Woodshed Play schedules a bounded window (was 39k whole-pass)", `nodes=${created}`);
  ok(worst < 800, "no second-long main-thread block at Play (was 1.57s)", `worst longtask=${worst}ms`);
  await page.evaluate(() => document.getElementById("slopscale-play")?.click());
  await page.waitForTimeout(400);

  if (errs.length) { fail++; console.log(`  FAIL page errors: ${errs.join(" | ")}`); }
} finally { await browser.close(); }

if (fail) { console.log(`FAIL  backing-engine: ${fail} failure(s) (${pass} passed)`); process.exit(1); }
console.log(`PASS  backing-engine: ${pass} checks passed (timeline validity x styles, 2/bar, push, determinism, key-cycle + session assembly)`);
