# Crush of Roses — Windows .exe wrapper (Electron thin shell)

Batch 17 scaffold. The wrapper loads the game **site** in a window; no game
files are bundled, so a site deploy updates the game for wrapper players
with no wrapper rebuild.

## Build flavors

| Flavor | Site loaded | Installer produced |
| ------ | ----------- | ------------------ |
| dev    | `https://crush-of-roses-dev.pages.dev/` | `dist/crush-of-roses-dev-setup.exe` |
| live   | `https://crushofroses.com/` | `dist/crush-of-roses-setup.exe` |

The flavor is baked in at build time: `npm run build:dev` /
`npm run build:live` run `scripts/set-flavor.js`, which writes
`flavor.json` (`{ "flavor": "dev" | "live" }`) next to `main.js`; the
packaged app reads it at startup. A `CRUSH_FLAVOR=dev|live` env var
overrides it at runtime (dev testing only, e.g. `CRUSH_FLAVOR=live npm start`).

## Batch 21 (21 Nov 2026) — version 0.2.0

- **Company rename (wrapper metadata only):** `package.json` author is now
  "Sloth Game Laboratory" again — Batch 21 had renamed it to "Sloth Gaming
  Laboratory" (was "Sloth Game Laboratory"); Batch 25, 22 Nov 2026,
  renames it back, so the studio name is one name everywhere, in-game
  and wrapper. That is what electron-builder puts in the installer's
  CompanyName / Programs & Features publisher. App id
  `com.slothgamelab.crushofroses` never changes.
- **Version 0.2.0** (was 0.1.0; number was the builder's suggestion — the
  owner can pick another). `package.json` + `package-lock.json`.
- **Splash window:** `main.js` opens a small frameless splash window
  (`splash.html`, rose logo from `assets/crystal-rose-512-transparent.png`
  — the existing game asset, copied, no new art) while the main window
  boots. The main window is created hidden (`show: false`) and shown on
  `ready-to-show`, which closes the splash. If the site fails to load
  (`did-fail-load`) or nothing fires within 30 s, the main window is
  shown anyway so the user is never trapped on the splash.
- **Crash recovery:** `render-process-gone` on the main window reloads the
  page for `crashed` / `killed` / `oom` (this subsumes the legacy
  `crashed` event). Guard: at most 3 auto-reloads in 60 s, then it stops
  so a crash loop can't spin forever.
- **Installer "app is running" check:** the stock electron-builder 26.18.0
  template DOES call `CHECK_APP_RUNNING` in the oneClick install section,
  so oneClick itself is not missing the check. The remaining hole is
  detection: the stock probe leans on PowerShell (`$INSTDIR` path-prefix
  match) with a tasklist fallback filtered by username, either of which
  can miss a running instance (PowerShell blocked, app running elevated).
  Fix: `build/installer.nsh` defines `customCheckAppRunning` (picked up
  via `nsis.include: installer.nsh` in both builder configs) — an
  `nsProcess` exact-exe-name probe first; if the app is running it hands
  over to the stock prompt / graceful-close / force-kill / retry flow.
  oneClick stays on. **Verified:** the include compiles clean under the
  Linux `makensis` in BOTH contexts — the uninstaller script (full
  `npm run build:dev`, 21 Nov, got past makensis with zero errors) and
  the installer script (minimal replay `/tmp/min-nsis/minimal.nsi`,
  compiled to the "writing output" stage). Two gotchas found and fixed
  while verifying — see the comments in `build/installer.nsh` (nsProcess
  is a macro, not a plugin export; the stock template skips
  `getProcessInfo.nsh`/`Var pid` when a custom macro exists). **Still
  blocked:** the full installer exe — see Build status below.
- **Still unsigned, still no app icon.** No code-signing (separate step,
  needs a certificate). No icon configured.

## Run / build

```sh
npm install
npm start            # dev flavor, loads the dev site
npm run start:live   # live flavor
npm run build:dev    # Windows NSIS installer, dev
npm run build:live   # Windows NSIS installer, live
```

## Wrapped-app detection (batch17-contracts.md §1)

Both contract signals are set:

1. `preload.js` — `contextBridge.exposeInMainWorld("__CRUSH_WRAPPED__", true)`
2. `main.js` — `app.userAgentFallback` appends `CrushOfRoses-Wrapped`

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in the
renderer; the preload exposes nothing else.

## Build status (21 Nov 2026, this VM)

- **NSIS installer: NOT produced.** `npm run build:dev` packages fine and
  the NSIS scripts compile fine under the Linux `makensis` bundled with
  electron-builder 26.18.0 (no Wine needed for compiling — the old
  "Wine is not installed" framing below is outdated for the compile
  step). What still needs Wine: after compiling, electron-builder RUNS
  the built stub installer under Wine to extract the real uninstaller
  exe, and `wine` is not installed on this VM (`spawn wine ENOENT`) —
  the failed run leaves a 164 KB NSIS **stub** at
  `dist/crush-of-roses-dev-setup.exe` (no payload) — do not ship it.
  **Workaround attempted, blocked by this VM:** a fake `wine` that
  extracts the uninstaller offline with electron-builder's own
  `UninstallerReader` (`/tmp/fakewine/`, NOT part of the repo) fails
  because this VM intermittently EPERMs writes of Windows-executable
  bytes from user-space tools (node/python/cp all hit it; it comes and
  goes — small/text writes always work, PE-content writes often don't).
  On a machine with working Wine (or Windows/macOS) the build should
  complete with no code change.
- **Wine unblock attempted, failed on this VM.** `apt` cannot install Wine:
  `apt-get update` fails with unsigned-repository GPG errors on the
  `mirror.cogentco.com` mirror (and is extremely slow on the Azure mirror).
  Standalone Wine 11.22 (Kron4ek, `~/workspace/wine/wine-11.22-amd64/`,
  `wine --version` = wine-11.22) was downloaded instead, but **every**
  Windows PE spins forever in userspace: 32-bit `makensis.exe -VERSION`,
  `wineboot --init` and `wine cmd` all burned ~70–85% CPU for 7–12 min
  with no `~/.wine` prefix ever created (single thread, ~43k
  non-voluntary context switches, no syscall block — a userspace spin
  loop; `strace` attach is also blocked on this VM, so the exact call
  could not be identified). The VM's sandbox appears to break Wine's
  loader. **To unblock:** run the NSIS build on a machine with working
  Wine (real Linux desktop/CI with `apt install wine64 wine32`, or
  Windows/macOS). No code change is needed — the project builds NSIS
  fine once `wine makensis.exe` runs.
- **What DID build on this VM (verified):**
  - `dist/win-unpacked/Crush of Roses.exe` — PE32+ x86-64, 210 MB,
    325 MB unpacked dir; the real Electron app, verified via `file`.
  - `dist/crush-of-roses-dev-portable.exe` — 93,260,391 bytes, PE32
    self-extracting archive with the 7z payload embedded (portable
    target needs no Wine). **Not** the contract installer: it is a
    portable exe (extracts to temp and runs, no install/uninstall,
    no shortcuts). Deliberately renamed away from the contract
    filename so it can never be mistaken for the installer.
  - Both flavors verified packaged: `app.asar` contains exactly
    `main.js`, `preload.js`, `package.json`, `flavor.json`, with
    `flavor.json` = `dev` (current on-disk build) and `live` verified
    in the earlier `--dir` live build; both contract signals
    (`__CRUSH_WRAPPED__`, `CrushOfRoses-Wrapped`) confirmed present
    in the packaged `main.js`/`preload.js`.

## Packaging notes

- **Unsigned.** No code-signing certificate is configured, so Windows
  SmartScreen will warn on first run ("Windows protected your PC") until the
  installer gains reputation or is signed. Signing needs a certificate and
  is a separate step (not done here).
- **Windows build from Linux** uses electron-builder's NSIS target, which
  runs the NSIS compiler under Wine. Wine must be installed on the build
  machine (see build log); without it the NSIS step fails.
- **Download hosting is planned, not live:** the installers are meant for
  the `TennyFang-AI/crush-of-roses-releases` GitHub Releases repo, which does
  not exist yet — until it does, the game's in-modal download links 404.
- App id: `com.slothgamelab.crushofroses` (same as the Android/Play id).
