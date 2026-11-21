# Crush of Roses — Android wrapper (Capacitor)

Thin shell only. The game is **not** bundled here: the WebView loads the
live site, so game updates deploy to the site and the wrapper picks them up
with no rebuild. No game code is copied into this project.

- App name: **Crush of Roses**
- App id (Capacitor package id **and** Play Store id): `com.slothgamelab.crushofroses`
- Capacitor: **8.6.2** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`)
- Contracts: `../crush-of-roses-redesign/batch17-contracts.md`

## Dev vs live

One project, two builds. The site URL comes from `CRUSH_SITE`
(`capacitor.config.ts`, default `dev`):

| Build | `CRUSH_SITE` | Loads | Output APK |
|---|---|---|---|
| dev | `dev` | `https://crush-of-roses-dev.pages.dev/` | `crush-of-roses-dev.apk` |
| live | `live` | `https://crushofroses.com/` | `crush-of-roses.apk` |

File names are exactly the ones the game modal links to
(`github.com/TennyFang-AI/crush-of-roses-releases/releases/latest/download/…`).

```sh
npm run sync:dev    # write dev URL into android/app/src/main/assets/capacitor.config.json
npm run sync:live   # write live URL instead
npm run build:dev   # sync dev + assembleDebug + copy APK to ./crush-of-roses-dev.apk
npm run build:live  # sync live + assembleDebug + copy APK to ./crush-of-roses.apk
```

`server.allowNavigation` permits the game host plus Google sign-in and
Stripe checkout/billing. Everything else opens in the system browser.

## Wrapped-app detection

Capacitor sets `window.Capacitor` natively in the WebView — that is the
signal the game uses (`isWrappedApp()`, contracts §1) to hide the
Install/Download button inside the wrapped app. No extra code needed.

## Permissions

`android/app/src/main/AndroidManifest.xml` declares exactly one permission:

- `android.permission.INTERNET`

No storage, location, camera, microphone, or notification permissions.
`www/index.html` is only a local offline fallback (no game code).

## Toolchain (already installed on this VM, 21 Nov 2026)

- JDK 17 (Temurin 17.0.21.1): `~/jdk`
- Android SDK: `~/Android/Sdk` — cmdline-tools latest, platform-tools
  r37.0.3, `platforms;android-36`, `build-tools;36.0.0`, licences accepted
  (`licenses/android-sdk-license`)
- Gradle 8.14.3: `~/gradle-8.14.3` (downloaded directly; the wrapper would
  download it via Java, which is blocked — see below)
- Target/min SDK: 36 / 24 (from `android/variables.gradle`, Capacitor 8 default)

## Build status: BLOCKED — sandbox denies Java TCP (`other_tcp: Deny`)

**No APK has been produced yet. This is an environment block, not a project
problem.** The scaffold is complete and verified (`cap sync` works, dev and
live URLs land in the generated `capacitor.config.json`).

What happens: `gradle assembleDebug` starts its daemon fine (daemon log:
"Daemon server started", listening on 127.0.0.1), but the Gradle client
cannot talk to it — `Could not receive a message from the daemon`
(`Unexpected type tag 109`). Root cause, proven with a minimal test:

- A Java process opening **any** TCP connection (even loopback
  127.0.0.1 → a local server) gets its connection intercepted by the
  sandbox, which replies with:
  > `muse: Other TCP connections is turned off for this assistant. To allow
  > it, ask the user to open Muse settings -> Permissions -> Direct network
  > protocols and switch other_tcp from Deny to Ask.`
  (`109` = ASCII `m`, the first byte of that message — hence the Gradle error.)
- The same test in Python works fine (Python loopback TCP is allowed);
  Java is the thing being filtered. This also breaks Java HTTPS through the
  egress proxy (`sdkmanager` fails parsing the same policy text as a proxy
  response), so Gradle could not even download its dependencies — the SDK
  packages and Gradle itself were therefore installed with `curl` instead.

### To unblock (pick one)

1. **Preferred — flip the permission (user action):** in Muse settings →
   Permissions → Direct network protocols, switch `other_tcp` from Deny to
   Ask, approve the Gradle daemon connection, then run:
   ```sh
   cd ~/workspace/crush-of-roses-android
   export JAVA_HOME=~/jdk ANDROID_HOME=~/Android/Sdk
   # proxy for Gradle dependency downloads (values from the shell env):
   P_AUTH="${https_proxy#*://}"; P_USER="${P_AUTH%%:*}"; P_PASS="${P_AUTH#*:}"; P_PASS="${P_PASS%%@*}"
   ~/gradle-8.14.3/bin/gradle assembleDebug --no-daemon \
     -Dhttps.proxyHost=hatch-egress-proxy -Dhttps.proxyPort=3128 \
     -Dhttps.proxyUser="$P_USER" -Dhttps.proxyPassword="$P_PASS" \
     -Dhttp.proxyHost=hatch-egress-proxy -Dhttp.proxyPort=3128 \
     -Dhttp.proxyUser="$P_USER" -Dhttp.proxyPassword="$P_PASS"
   # or simply: npm run build:dev   (same thing, plus the APK copy)
   ```
   Expected output: `android/app/build/outputs/apk/debug/app-debug.apk`,
   copied to `./crush-of-roses-dev.apk`. Verify with `file` (should say
   `Zip archive data`) and `unzip -l` (must list `AndroidManifest.xml`,
   `classes.dex`, `assets/public/`).
2. **Or build on a machine without the restriction** (dev laptop / CI):
   clone this folder, install JDK 17 + Android SDK
   (`platforms;android-36`, `build-tools;36.0.0`), run `npm run build:dev`.
   No other setup is needed — the project has no other dependencies.

## Release signing (not done — needs the real keystore)

`assembleDebug` produces a debug-signed APK, fine for sideload testing.
A Play release needs a release keystore + `signingConfigs` in
`android/app/build.gradle` and `assembleRelease` → AAB for the Play Store.
That is a separate step (keystore creation is a user/owner action, and the
releases repo `TennyFang-AI/crush-of-roses-releases` does not exist yet —
until it does, the download links in the game modal 404, per contracts §3).

## Layout

```
capacitor.config.ts   appId/appName + CRUSH_SITE dev/live switch
www/index.html        offline fallback page only
android/              Capacitor-generated native project (do not hand-edit
                      generated files; re-run `npx cap sync android` instead)
package.json          scripts: sync:dev, sync:live, build:dev, build:live
```
