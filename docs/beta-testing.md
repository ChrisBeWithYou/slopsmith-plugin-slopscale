# Beta builds — `SlopScale (Beta)`

SlopScale ships on two channels:

| Channel | Branch | Plugin id | How users get it |
|---------|--------|-----------|------------------|
| **Stable** | `main` | `slopscale` | Bundled with Slopsmith Desktop **and** auto-updated to `main` HEAD by the host's `update_manager` (the host only ever auto-ships the default branch). |
| **Beta** | `slopscale-beta` | `slopscale_beta` | **Opt-in manual install** of the `slopscale-beta` branch (below). The host cannot auto-update anyone to a non-default branch — that's what keeps beta opt-in. |

The beta is a **renamed mirror of `slopscale-dev`**: every `slopscale` token (plugin id, on-screen element ids, `/api/plugins/slopscale/…` URLs, storage tables, localStorage keys) is swapped to `slopscale_beta`. That distinct identity is what lets it install **alongside** the stable build — Slopsmith keys plugins by `id` and inlines every plugin screen into one shared page, so two `slopscale` installs would collide (registration + duplicate DOM ids). With a different id they coexist: two nav entries, fully independent (own settings, own saved presets, own progress). Proven side-by-side via `.claude/skills/run-slopscale/probe-coexist.mjs`.

---

## For testers — install the beta next to stable

You keep your normal SlopScale; the beta appears as a **second** entry, **SlopScale (Beta)**, so you can A/B them on the fly.

**1. Find your Slopsmith plugins folder**
- Windows (Desktop): `%LOCALAPPDATA%\Slopsmith\plugins`
- (Other platforms: the `plugins/` dir of your Slopsmith install.)

**2. Clone the beta branch into it** (one time):
```bash
git clone -b slopscale-beta https://github.com/ChrisBeWithYou/slopsmith-plugin-slopscale slopscale_beta
```
Restart Slopsmith. You'll now see **SlopScale** and **SlopScale (Beta)** in the menu. The beta's version badge reads `…-beta.N`.

**3. Update to the latest beta** whenever asked:
```bash
git -C slopscale_beta pull
```
…then restart Slopsmith.

**If it ever gets stuck / won't load:**
```bash
git -C slopscale_beta fetch origin
git -C slopscale_beta reset --hard origin/slopscale-beta
```

**Notes**
- The beta is **independent** — it can't touch your stable install's settings or saved presets.
- The beta is where new work lands *before* it's promoted to stable, so expect rough edges. That's the point — **tell us what breaks or feels off** (Discord / GitHub issues).
- To remove it: delete the `slopscale_beta` folder and restart.

---

## For the maintainer — cutting & promoting

**Cut / refresh a beta** (after committing your dev work):
```bash
git push origin slopscale-dev          # beta is built from the latest COMMIT on dev
node scripts/cut-beta.mjs --push        # regenerate the renamed tree → commit + push slopscale-beta
```
`cut-beta.mjs` builds from the committed `slopscale-dev` tree (tracked runtime files only — no `.claude`, docs, ROADMAP, agent-memory), auto-bumps the version to `X.Y.Z-beta.N` (the base `X.Y.Z` comes from `plugin.json`, stripped of `-dev`), and commits a snapshot to `slopscale-beta` so testers' `git pull` stays fast-forward. Flags:
- `--dry-run [dir]` — write the renamed tree to a temp dir and inspect; no git.
- `--version 0.7.6-beta.3` — force a version.
- (no `--push`) — commit to the local `slopscale-beta` branch only; push later.

When you bump `plugin.json` to a new base (e.g. `0.7.7-dev`), the beta counter resets to `0.7.7-beta.1`.

**Promote a beta to stable** (the usual release ritual):
1. Merge `slopscale-dev` → `main`.
2. Bump `plugin.json` `version` to the clean `X.Y.Z` **and** the `SLOPSCALE_VERSION` constant in `screen.js` to match (the host caches by id+version; the badge is mirrored by hand).
3. Tag, Discord post, README/GitHub page update.
4. The host's `update_manager` ships `main` HEAD to all updaters.

See also: `project_host_release_v029_audit` (main = published artifact), `project_dev_install_github_and_test_env` (the dev/test layout).
