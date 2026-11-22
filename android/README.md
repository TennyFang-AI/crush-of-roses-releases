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

`android/app/src/main/AndroidManifest.xml` declares four permissions:

- `android.permission.INTERNET`
- `android.permission.RECORD_AUDIO` — voice notes (WebView mic)
- `android.permission.CAMERA` — in-chat camera / take-photo
- `android.permission.MODIFY_AUDIO_SETTINGS` — required by Capacitor 8
  for getUserMedia (normal permission, no runtime prompt)

Camera + mic hardware are **optional** (`<uses-feature …
android:required="false" />`, Batch 21) — the game works fully
without them; voice notes and the camera just ask at first use.
`READ_MEDIA_IMAGES` is deliberately NOT declared: gallery picking
uses the system photo picker, which needs no permission.
`www/index.html` is only a local offline fallback (no game code).

## Batch 21 — Android wrapper (21 Nov 2026)

- **Company name:** wrapper metadata now says **Sloth Game
  Laboratory** — `android:description` in the manifest
  (`@string/app_description`) + `package.json` author/description.
  (Batch 21 had renamed it to "Sloth Gaming Laboratory"; Batch 25,
  22 Nov 2026, renamed it back — one studio name everywhere, in-game
  and wrapper.)
- **Crash recovery:** `MainActivity` registers a Capacitor
  `WebViewListener` whose `onRenderProcessGone` reloads the page and
  returns `true` (we handled it). Before this, no listener was
  registered, so Capacitor's default `false` let Android destroy the
  WebView — dead/blank screen until force-stop. Guard: max 3 reloads
  in 30 s, then it stops (a page that crashes on load must not loop).
- **Version 0.2.0** (suggested number — the owner can pick another):
  `versionCode 2`, `versionName "0.2.0"` in
  `android/app/build.gradle`; `package.json` version `0.2.0`.
- **Release signing:** keystore created 21 Nov 2026, alias
  `crush-of-roses`, RSA 2048, valid to 8 Apr 2054. Live copy:
  `android/release.keystore` (mode 600). **Backup:
  `~/workspace/secure-backups/crush-of-roses-keystore/`**
  (keystore copy + `keystore-password.txt`, both mode 600 — the
  password is stored ONLY there and in `~/.gradle/gradle.properties`,
  never in any report or repo). `android/app/build.gradle` reads the
  four `release*` Gradle properties and signs the release build only
  when they are present; otherwise the release build is unsigned.
  New scripts: `npm run build:release-dev` (AAB + release APK, dev
  site) and `npm run build:release-live` (AAB + release APK, live).
- **allowBackup:** `false` (was `true`). Chat history is cloud-synced
  (Batch 20), so there is no local state worth backing up, and
  backups would carry the WebView's local data.
- **Custom Tabs fallback (verified, no code change needed):** Google
  sign-in opens via `Browser.open()` (Capacitor Browser plugin
  8.0.5). Its `Browser.open` builds a `CustomTabsIntent` and calls
  `launchUrl`; when no browser on the device supports Custom Tabs
  (no session bound — `bindService()` just logs the failure), the
  intent carries no package, so Android opens the URL in the
  default browser instead. If no browser exists at all,
  `ActivityNotFoundException` is caught and the call rejects, which
  the game surfaces as "Couldn't open Google sign-in — try again"
  (graceful, no crash). No wrapper-side fallback is possible without
  forking the plugin out of `node_modules` (wiped by `npm ci`), so
  none was added. `window.open(url, "_blank")` links (Stripe etc.)
  go through Capacitor's `launchIntent` → system browser, as before.

## Toolchain (on this VM)

- JDK 21 (Temurin 21.0.13.1 LTS): `~/jdk21` — **required for
  Capacitor 8 builds** (AGP 8.13.0). The old `~/jdk` (Temurin 17)
  is WRONG for builds; it was used only for `keytool` (keystore
  creation is JDK-version independent).
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

**Re-tested 21 Nov 2026 with JDK 21 + `--no-daemon`: still blocked.**
Gradle 8.14.3 forks a single-use daemon even with `--no-daemon`, and the
client↔daemon loopback handshake hits the same interception, so the
build fails the same way (`Could not receive a message from the daemon`)
before any compilation or dependency download. JDK 21 fixes the
toolchain version, not the sandbox block. `MainActivity.java` was
verified instead by compiling it against faithful stubs of the
Capacitor 8 API it uses (Bridge/BridgeActivity/WebViewListener/Logger
signatures copied from `node_modules/@capacitor/android`) — it
compiles; the manifest/strings XML and `package.json` parse clean.
A real build still needs CI or an unrestricted machine.

### To unblock (pick one)

1. **Preferred — flip the permission (user action):** in Muse settings →
   Permissions → Direct network protocols, switch `other_tcp` from Deny to
   Ask, approve the Gradle daemon connection, then run:
   ```sh
   cd ~/workspace/crush-of-roses-android
   export JAVA_HOME=~/jdk21 ANDROID_HOME=~/Android/Sdk
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
   clone this folder, install JDK 21 + Android SDK
   (`platforms;android-36`, `build-tools;36.0.0`), run `npm run build:dev`.
   No other setup is needed — the project has no other dependencies.

## Release signing (Batch 21 — keystore exists, CI wiring still to do)

`assembleDebug` produces a debug-signed APK, fine for sideload testing.
A Play release needs the release keystore + `signingConfigs` in
`android/app/build.gradle` — both now exist (see Batch 21 above).
Local signed build (needs the sandbox block lifted, or any
unrestricted machine with JDK 21 + Android SDK):

```sh
npm run build:release-dev    # dev site → crush-of-roses-dev.aab + crush-of-roses-dev-release.apk
npm run build:release-live   # live site → crush-of-roses.aab + crush-of-roses-release.apk
```

Signing properties live in `~/.gradle/gradle.properties` (mode 600),
never in the repo. The AAB (`app-release.aab`) is what Play Console
takes; the signed release APK is for sideloading.

### CI route (the way a signed build actually gets produced)

The working build route is GitHub Actions in
`TennyFang-AI/crush-of-roses-releases` (workflow
`.github/workflows/build.yml`, "Build wrappers" — editable ONLY via
the GitHub website). It already uses JDK 21 + Gradle 8.14.3, but its
two Android jobs currently build **debug** APKs only. To get signed
0.2.0 outputs, in this order:

1. **Copy the wrapper in** — this folder's contents go into the
   releases repo (root files → `android/`, Gradle project →
   `android/android/`), replacing the current copies. Do NOT copy
   `android/release.keystore` or `~/.gradle/gradle.properties`.
2. **Set four GitHub secrets** (repo Settings → Secrets → Actions;
   a later step, not done here): `ANDROID_KEYSTORE_BASE64` (base64
   of the backup keystore), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`crush-of-roses`), `ANDROID_KEY_PASSWORD`.
   Store and key passwords are the same value.
3. **Edit the workflow** (GitHub website): in both `build-apk-dev`
   and `build-apk-live`, after "Restore Android binary assets", add
   a decode step (`echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" |
   base64 -d > android/release.keystore`), change the build step to
   `gradle bundleRelease assembleRelease
   -PreleaseStoreFile=release.keystore
   -PreleaseStorePassword=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
   -PreleaseKeyAlias=${{ secrets.ANDROID_KEY_ALIAS }}
   -PreleaseKeyPassword=${{ secrets.ANDROID_KEY_PASSWORD }}`,
   copy `app-release.aab` + `app-release.apk` out, upload them as
   artifacts, and add the AABs to the `publish` job's
   `gh release upload latest …` list (keep the APK download names
   `crush-of-roses-dev.apk` / `crush-of-roses.apk` the in-game modal
   links to — copy the signed release APKs onto those names in CI).
4. **Trigger:** push to `main` in the releases repo, or Actions →
   "Build wrappers" → Run workflow (workflow_dispatch).

The Play Store upload itself (Play Console, first AAB) is a manual
owner step after CI produces the signed AAB.

## Layout

```
capacitor.config.ts   appId/appName + CRUSH_SITE dev/live switch
www/index.html        offline fallback page only
android/              Capacitor-generated native project (do not hand-edit
                      generated files; re-run `npx cap sync android` instead)
android/release.keystore   Play upload key (mode 600 — NEVER commit;
                      backup in ~/workspace/secure-backups/crush-of-roses-keystore/)
package.json          scripts: sync:dev, sync:live, build:dev, build:live,
                      build:release-dev, build:release-live
```
