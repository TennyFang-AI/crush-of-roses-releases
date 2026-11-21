# Crush of Roses — Releases

Public repo for the Crush of Roses wrapper builds. The game itself lives in
the private `TennyFang-AI/crush-of-roses` repo; this repo holds only the two
thin-shell wrappers (Android + Windows) and the CI that builds them.

The in-game install modal links its downloads here, so this repo MUST stay
public — the links are `.../releases/latest/download/<file>` and must work
for players without GitHub auth.

## Downloads (latest release)

| File | What it is |
|---|---|
| `crush-of-roses-dev.apk` | Android wrapper, test build (loads the dev site) |
| `crush-of-roses.apk` | Android wrapper, live build (loads crushofroses.com) |
| `crush-of-roses-dev-setup.exe` | Windows installer, test build (loads the dev site) |
| `crush-of-roses-setup.exe` | Windows installer, live build (loads crushofroses.com) |

Base URL: `https://github.com/TennyFang-AI/crush-of-roses-releases/releases/latest/download/`

## How builds work

Pushing to `main` triggers `.github/workflows/build.yml` (or run it by hand
from the Actions tab). Four jobs build the four artifacts, then a publish job
uploads them to the `latest` release (created on first run, assets overwritten
on every run). No signing yet — the APK is a debug build and the .exe is
unsigned (SmartScreen will warn on first run).

## Layout

- `android/` — Capacitor 8 wrapper (`com.slothgamelab.crushofroses`). Thin
  shell only; the game is NOT bundled, the WebView loads the site.
  `npm run build:dev` → `crush-of-roses-dev.apk`,
  `npm run build:live` → `crush-of-roses.apk`.
- `electron/` — Electron wrapper, same idea.
  `npm run build:dev` → `crush-of-roses-dev-setup.exe`,
  `npm run build:live` → `crush-of-roses-setup.exe`.

## Building locally

Android: `cd android && npm ci && npm run build:dev` (or `build:live`).
Windows: `cd electron && npm ci && npm run build:dev` (or `build:live`;
the NSIS installer needs Wine on Linux/macOS — use a Windows machine).

Note: the push route does not preserve file modes, so after a fresh clone
`android/gradlew` may not be executable — run `chmod +x android/gradlew`
before the Android build. (CI uses an installed Gradle instead, so it is
not affected.)

## Android binary assets (`android-assets.tar.gz.b64`)

The Android project needs binary resource files (launcher icons, splash
screens, `gradle-wrapper.jar`) that cannot be pushed through this workspace's
text-only GitHub push route, so they live in this repo as one base64-encoded
tarball. CI restores them before building:

```
base64 -d android-assets.tar.gz.b64 | tar -xz -C android/
```

To regenerate it after changing an icon/splash (from the android project
root, i.e. the `android/` directory):

```
tar -czf /tmp/android-assets.tar.gz android/gradle/wrapper/gradle-wrapper.jar $(find android/app/src/main/res -name '*.png' | sort)
base64 -w0 /tmp/android-assets.tar.gz > android-assets.tar.gz.b64
```
