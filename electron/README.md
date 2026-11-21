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

- **NSIS installer: NOT produced.** `npm run build:dev` packages fine but
  fails at the NSIS step: `wine process failed ENOENT` — electron-builder
  runs the bundled 32-bit `makensis.exe` under Wine, and Wine is not
  installed. The failed run leaves a 162 KB NSIS **stub** at
  `dist/crush-of-roses-dev-setup.exe` (no payload) — do not ship it.
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
