# Launch a Slopsmith host with this plugin junctioned in, ready to drive.
#
# Idempotent: kills any prior server on the chosen port, ensures a junction
# from the host's plugin dir to this repo, then starts the bundled Python
# interpreter against the user-clone of Slopsmith source. After return, the
# server is up at http://127.0.0.1:<port>/ and driver.mjs can connect.
#
# Defaults assume the layout on this machine:
#   - Slopsmith Desktop installed at "C:\Program Files\Slopsmith\"
#     (provides the bundled Python at resources\python\python.exe AND the
#     slopsmith source at resources\slopsmith\ on the bundled Python's
#     sys.path; the user's slopsmith checkout is the CWD that holds main.py)
#   - The plugin source lives next to this script (../../..)
#
# Override via env vars: SLOPSCALE_PORT, SLOPSMITH_CHECKOUT, DLC_DIR,
# CONFIG_DIR.

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = (Resolve-Path (Join-Path $ScriptDir '..\..\..')).Path
$Port = if ($env:SLOPSCALE_PORT) { $env:SLOPSCALE_PORT } else { '8765' }
$Checkout = if ($env:SLOPSMITH_CHECKOUT) { $env:SLOPSMITH_CHECKOUT } else { 'C:\Users\chris\slopsmith' }
# Which Slopsmith RUNTIME to boot:
#   checkout (DEFAULT) — your git checkout ($Checkout), AUTO-PULLED current on every
#            launch (see the auto-update block below), run via a normal venv python
#            (no ._pth isolation → the checkout's own code loads). This is our primary
#            test target: CURRENT Slopsmith, which ships the Minigames scoring SDK and
#            the latest capabilities. Needs a venv at $VenvDir with requirements.txt
#            installed (see SKILL.md "Testing against current Slopsmith").
#   bundled  — the frozen Desktop install (resources\slopsmith, older). Its
#            python312._pth pins imports to the bundled code, so this tests against
#            what users on the current Desktop release actually run (e.g. NO scoring
#            SDK). Use `$env:SLOPSMITH_SOURCE='bundled'` before a release to verify
#            the version users currently have.
$Source = if ($env:SLOPSMITH_SOURCE) { $env:SLOPSMITH_SOURCE } else { 'checkout' }
$VenvDir = if ($env:SLOPSMITH_VENV) { $env:SLOPSMITH_VENV } else { 'C:\Users\chris\slopsmith-venv' }
if ($Source -eq 'checkout') {
  $PythonExe = Join-Path $VenvDir 'Scripts\python.exe'
} else {
  # Velopack installs the active version under `current\` (the v0.2.9+ layout);
  # the legacy flat `resources\` path is a stale older install. Prefer current\
  # so `bundled` mode actually tests the version users run (devops audit 2026-06-08).
  $curPy = 'C:\Program Files\Slopsmith\current\resources\python\python.exe'
  $PythonExe = if (Test-Path $curPy) { $curPy } else { 'C:\Program Files\Slopsmith\resources\python\python.exe' }
}
$DlcDir = if ($env:DLC_DIR) { $env:DLC_DIR } else { 'C:\Users\chris\slopsmith-dlc' }
$ConfigDir = if ($env:CONFIG_DIR) { $env:CONFIG_DIR } else { 'C:\Users\chris\slopsmith-config' }
$PluginsBase = Join-Path $env:LOCALAPPDATA 'Slopsmith\plugins'
$JunctionPath = Join-Path $PluginsBase 'slopscale'
$LogDir = Join-Path $env:TEMP 'slopscale'
$LogFile = Join-Path $LogDir 'server.log'

if (-not (Test-Path $PythonExe)) {
  if ($Source -eq 'checkout') {
    throw "Checkout venv python not found at $PythonExe. Create it once: py -3 -m venv $VenvDir; & '$VenvDir\Scripts\python.exe' -m pip install -r '$Checkout\requirements.txt'  (see SKILL.md)."
  }
  throw "Bundled Python not found at $PythonExe. Install Slopsmith Desktop first."
}
if (-not (Test-Path (Join-Path $Checkout 'main.py'))) {
  throw "Slopsmith source not found at $Checkout. Set `$env:SLOPSMITH_CHECKOUT or git clone the slopsmith repo there."
}

# Keep the checkout CURRENT before each launch, so our primary test target tracks
# upstream Slopsmith (the version that ships the Minigames scoring SDK + the latest
# capabilities). Non-fatal by design: skipped on a dirty tree, offline, or any error,
# so a launch never blocks on the network or clobbers a local edit. Refreshes the venv
# only when requirements.txt actually changed in the pull.
if ($Source -eq 'checkout') {
  $prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try {
    # The host REGENERATES static/tailwind.min.css at startup (it scans the junctioned
    # plugins), dirtying this tracked file every run — which would block the auto-pull's
    # dirty-tree guard forever and silently stale the checkout. It's a runtime artifact we
    # never hand-edit, so discard it before the dirty check + pull.
    & git -C $Checkout checkout -- static/tailwind.min.css 2>$null
    $porcelain = & git -C $Checkout status --porcelain
    if ($porcelain) {
      Write-Host "[launch] checkout has local changes -- skipping auto-pull (pull it manually when ready)"
    } else {
      $before = (& git -C $Checkout rev-parse HEAD).Trim()
      & git -C $Checkout fetch --quiet 2>$null
      & git -C $Checkout pull --ff-only --quiet 2>$null
      if ($LASTEXITCODE -ne 0) { Write-Host "[launch] auto-pull: 'git pull' returned $LASTEXITCODE -- non-fatal, using the current checkout" }
      $after = (& git -C $Checkout rev-parse HEAD).Trim()
      if ($before -ne $after) {
        Write-Host "[launch] checkout updated $($before.Substring(0,7)) -> $($after.Substring(0,7))"
        if (& git -C $Checkout diff --name-only $before $after | Select-String 'requirements' -Quiet) {
          Write-Host "[launch] requirements changed -- refreshing venv (pip install)..."
          & $PythonExe -m pip install -q -r (Join-Path $Checkout 'requirements.txt') 2>$null
          if ($LASTEXITCODE -ne 0) { Write-Host "[launch] WARNING: pip install exited $LASTEXITCODE -- venv may be stale; rerun 'pip install -r requirements.txt' manually if the host fails to start" }
        }
      } else {
        Write-Host "[launch] checkout already current ($($after.Substring(0,7)))"
      }
    }
  } catch { Write-Host "[launch] auto-pull skipped: $($_.Exception.Message)" }
  $ErrorActionPreference = $prevEAP
}

Write-Host "[launch] killing any prior server on port $Port..."
$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns) {
  $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
  }
  Start-Sleep -Seconds 1
}

foreach ($d in @($PluginsBase, $DlcDir, $ConfigDir, $LogDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

# Junction the host's plugin dir to this repo so the running server picks up
# live edits. If something non-junction lives there, back it up first.
if (Test-Path $JunctionPath) {
  $attrs = (Get-Item $JunctionPath -Force).Attributes
  $isReparse = ($attrs.value__ -band 1024) -ne 0   # FILE_ATTRIBUTE_REPARSE_POINT = 0x400
  if ($isReparse) {
    Write-Host "[launch] junction already at $JunctionPath -- leaving as-is"
  } else {
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    Write-Host "[launch] backing up existing $JunctionPath -> .bak.$stamp"
    Move-Item $JunctionPath "$JunctionPath.bak.$stamp"
    cmd /c mklink /J "$JunctionPath" "$PluginRoot" | Out-Null
  }
} else {
  Write-Host "[launch] creating junction $JunctionPath -> $PluginRoot"
  cmd /c mklink /J "$JunctionPath" "$PluginRoot" | Out-Null
}

Write-Host "[launch] starting server [$Source] via $PythonExe on http://127.0.0.1:$Port/ (log: $LogFile)"
$env:HOST = '127.0.0.1'
$env:PORT = $Port
$env:DLC_DIR = $DlcDir
$env:CONFIG_DIR = $ConfigDir
# Running the checkout: its built-in plugins/ dir is the checkout's own, so point
# user-plugin discovery (SLOPSMITH_PLUGINS_DIR, read by server.py/plugins) at the
# junction dir where this script links SlopScale. (The bundled runtime already
# defaults there, so we only set it for the checkout path.)
if ($Source -eq 'checkout') {
  $env:SLOPSMITH_PLUGINS_DIR = $PluginsBase
  # main.py imports top-level modules from BOTH the checkout root and lib/ (the
  # bundled python's ._pth listed ../slopsmith + ../slopsmith/lib). The venv
  # python isn't ._pth-isolated, so it honours PYTHONPATH — mirror those here.
  $env:PYTHONPATH = "$Checkout;$(Join-Path $Checkout 'lib')"
}

$proc = Start-Process -FilePath $PythonExe -ArgumentList 'main.py' `
  -WorkingDirectory $Checkout `
  -RedirectStandardOutput $LogFile `
  -RedirectStandardError "$LogFile.err" `
  -WindowStyle Hidden -PassThru

# Wait until /api/plugins/slopscale/status returns ok, or fail.
$deadline = (Get-Date).AddSeconds(20)
$ready = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/plugins/slopscale/status" -TimeoutSec 2 -UseBasicParsing
    if ($r.StatusCode -eq 200 -and $r.Content -match '"ok":true') {
      Write-Host "[launch] up (pid $($proc.Id)) -- $($r.Content)"
      Write-Host "[launch] driver: node .claude/skills/run-slopscale/driver.mjs smoke"
      $ready = $true
      break
    }
  } catch {}
}

if (-not $ready) {
  Write-Error "[launch] server did not become ready within 20s. Tail of log:"
  if (Test-Path $LogFile) { Get-Content $LogFile -Tail 30 }
  if (Test-Path "$LogFile.err") { Get-Content "$LogFile.err" -Tail 30 }
  exit 1
}
