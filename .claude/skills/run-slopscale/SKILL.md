---
name: run-slopscale
description: Launch the Slopsmith host with SlopScale loaded, drive the plugin UI, and screenshot any of the four renderers (3D Highway, 2D Highway, Tab, Notation). Use when asked to run, start, screenshot, verify, or smoke-test SlopScale. SlopScale is a Slopsmith plugin — it cannot run standalone, so this skill brings up the host too.
---

# Run SlopScale

SlopScale is a **plugin**, not a standalone app. It needs Slopsmith as a host. This skill brings up the host with this repo junctioned in, then drives the SlopScale screen via Playwright.

Two files do the work:

- `launch.ps1` — kills any prior server on port 8765, junctions this repo into `%LOCALAPPDATA%\Slopsmith\plugins\slopscale`, starts the bundled-Python server, and waits until `/api/plugins/slopscale/status` returns `ok`.
- `driver.mjs` — Playwright (Node) driver that navigates to the SlopScale screen, triggers a generate, and screenshots the renderer.

Paths in this file are relative to the repo root (`<unit>/` in the skill-generator sense).

## Prerequisites

This skill targets the actual machine these tools were built on. From a clean machine on the same Windows host:

- **Slopsmith Desktop** installed at `C:\Program Files\Slopsmith\`. The installer ships a working Python 3.12 at `resources\python\python.exe` with every dep already in `site-packages` — we reuse it instead of building a venv.
- **A Slopsmith source checkout** at `C:\Users\chris\slopsmith\` (the user's existing clone). Only `main.py` is needed from it — the bundled Python's `sys.path` resolves `server`, `lib`, `plugins/__init__.py` from `C:\Program Files\Slopsmith\resources\slopsmith\` regardless. Override with `$env:SLOPSMITH_CHECKOUT` if you keep it elsewhere.
- **Node.js** + `npm` on PATH. First run of `driver.mjs` requires Playwright + Chromium:
  ```bash
  cd .claude/skills/run-slopscale
  npm i playwright
  npx playwright install chromium
  ```

That's all the persistent setup. The `package.json` + `node_modules/` inside the skill dir is fine; they're agent tooling.

## Run (agent path)

One command brings the host up:

```powershell
powershell -ExecutionPolicy Bypass -File .claude/skills/run-slopscale/launch.ps1
```

Output ends with `[launch] up (pid …)` and prints the next command. The server logs to `%TEMP%\slopscale\server.log`.

Then drive it from Node:

```bash
# Smoke (screenshot whatever renderer is the default — 3D Highway):
node .claude/skills/run-slopscale/driver.mjs smoke

# Single renderer (one of: highway_3d | builtin_2d | tab_2d | notation_2d):
node .claude/skills/run-slopscale/driver.mjs screenshot tab_2d

# All four renderers in one run — best for verifying changes to any renderer:
node .claude/skills/run-slopscale/driver.mjs all-renderers
```

`driver.mjs` only *screenshots* — it never fails. To **assert** the renderers
actually work (gate a refactor, prove a fix), run the smoke test instead:

```bash
node .claude/skills/run-slopscale/smoke-renderers.mjs   # or: npm run smoke
```

It walks all four renderers and, per renderer, checks: the view switch took
(active button), the renderer attached (non-empty status + a sized render
canvas — ruler/chord-box excluded), it drew (non-uniform pixels, enforced only
for the in-tree 2D `tab_2d`/`notation_2d`), playback advances `#slopscale-time-cur`,
and **no uncaught pageerror / non-benign console.error** fired (the known
`highway_3d` audio-analyser warning — gotcha #7 — is allowlisted). Prints a
PASS/FAIL line per renderer and **exits non-zero** if any fail, dropping a
`.slopscale-shots/smoke-fail-<kind>.png` for each failure. This is the closest
thing the repo has to a test suite — there is no unit/lint layer.

Screenshots land in `.slopscale-shots/` at the repo root (gitignored). The driver and smoke test both log each path they write.

To stop the host:

```powershell
Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Run (human path)

Just open the Slopsmith Desktop app from the Start menu and click SlopScale in the navigation. This skips the junction step **only if** the Desktop app has already auto-installed a `slopscale` plugin entry (it may be stale). The agent path replaces that stale copy with a junction every time; the human path may show old code if the user has never pulled.

## Layer the driver covers

`driver.mjs` drives the **user-facing UI** of the plugin — pathway dropdown, view-switcher buttons, renderer canvas. That is the right handle for changes to `screen.html`, `screen.js`, or any of the four renderers in `screen.js`.

For changes to **`routes.py`** (the backend), the faster path is direct HTTP. Examples from a running server:

```bash
curl http://127.0.0.1:8765/api/plugins/slopscale/status
curl http://127.0.0.1:8765/api/plugins/slopscale/presets
curl http://127.0.0.1:8765/api/plugins/slopscale/tunings
# POST /api/plugins/slopscale/temp-sloppak with an exercise payload to build a chart
# (note: the /temp-sloppak route is dormant under the contained-playback model)
```

The driver doesn't currently exercise `temp-sloppak`. If a PR touches that route, add a `curl --data` test to your smoke run rather than threading it through the UI.

## Gotchas

1. **The bundled Python wins over your source checkout.** `C:\Program Files\Slopsmith\resources\python\python.exe` has `C:\Program Files\Slopsmith\resources\slopsmith\` on its `sys.path` — so when you run `main.py` from `C:\Users\chris\slopsmith\`, Python imports `server`, `lib`, `plugins/__init__.py` from the **Desktop install**, not from your checkout. Plugin search resolves to `%LOCALAPPDATA%\Slopsmith\plugins\`, which is why `launch.ps1` junctions there (not into the user's `slopsmith/plugins/` directory).

2. **`mklink /J` needs `cmd /c`, not pure PowerShell.** PowerShell's `New-Item -ItemType SymbolicLink` requires admin or developer mode. Junctions made via `cmd /c mklink /J` work without elevation and behave the same for reads.

3. **`#slopscale` is not the screen id — `#plugin-slopscale` is.** The plugin's `plugin.json` declares `nav.screen: "slopscale"`, but Slopsmith's SPA wraps each plugin in `<div id="plugin-<id>">` and `showScreen()` takes that prefixed form. The driver uses `showScreen("plugin-slopscale")`.

4. **Don't wait for `#plugin-slopscale` with the default visibility check.** Slopsmith screens are `display: none` until activated. Playwright's default `waitForSelector` waits for visible; we use `state: "attached"` so we can find the element before calling `showScreen`.

5. **Pathway mode hides the Regenerate button.** `#slopscale-regenerate` is only visible in Custom mode. In pathway mode (the default on first load) you click a tempo-tier button instead, or you call the public API on `window.SlopScale`. `driver.mjs.generate()` tries all three in order.

6. **The default test bundle needs no DLC.** SlopScale generates its own exercises, so a *non-empty* DLC dir is not required. `launch.ps1` creates an empty `C:\Users\chris\slopsmith-dlc` if missing — the host scans it (finds nothing) and starts cleanly.

7. **The 3D Highway logs a noisy console warning** (`failed to set up audio analyser: InvalidStateError`) when the driver opens it without playback. It's the `highway_3d` plugin reacting to a missing audio source, not a problem with SlopScale. Ignore unless a real test depends on the analyser.

## Troubleshooting

**`Bundled Python not found at C:\Program Files\Slopsmith\resources\python\python.exe`**
Slopsmith Desktop isn't installed (or installed elsewhere). Install it from the official release, then re-run.

**`Slopsmith source not found at C:\Users\chris\slopsmith`**
Clone `https://github.com/byrongamatos/slopsmith.git` to that path, or set `$env:SLOPSMITH_CHECKOUT` to your clone before running `launch.ps1`. Only `main.py` is actually read from this checkout.

**`Failed to load routes for plugin 'slopscale' … NameError: name 'filename' is not defined`**
Old bug in `routes.py` where FastAPI path parameters in `@app.get(f"…/{filename}")` got eaten by the surrounding f-string. Fixed; if you see it again, double the braces: `f"…/{{filename}}"`.

**`page.waitForSelector('#plugin-slopscale') Timeout`**
The host loaded but never fetched the plugin's screen. Tail `%TEMP%\slopscale\server.log` — look for a `Failed to load routes for plugin 'slopscale'` line. The plugin's `routes.py` is throwing at import time; everything else gets registered but the screen never wires up.

**`page.click('#slopscale-regenerate') — element is not visible`**
You're in pathway mode and the driver was written assuming custom mode. The current driver handles this; if you write a new one, click a tempo-tier button first, or switch to Custom via the mode toggle.
