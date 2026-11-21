// Crush of Roses — Electron thin shell (main process).
//
// The game itself is NOT bundled. This window loads the live game site, so
// every deploy to the site is picked up by the wrapper with no rebuild.
//
// Build flavor (dev vs live) is baked in at build time by
// scripts/set-flavor.js, which writes flavor.json next to this file.
//   dev  -> https://crush-of-roses-dev.pages.dev/
//   live -> https://crushofroses.com/
// A CRUSH_FLAVOR env var overrides flavor.json at runtime (dev testing only).

const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const URLS = {
  dev: "https://crush-of-roses-dev.pages.dev/",
  live: "https://crushofroses.com/",
};

function resolveFlavor() {
  const env = (process.env.CRUSH_FLAVOR || "").toLowerCase();
  if (env === "dev" || env === "live") return env;
  try {
    const baked = JSON.parse(
      fs.readFileSync(path.join(__dirname, "flavor.json"), "utf8"),
    ).flavor;
    if (baked === "dev" || baked === "live") return baked;
  } catch {
    // no flavor.json yet — fall through to dev default
  }
  return "dev";
}

const flavor = resolveFlavor();
const SITE_URL = URLS[flavor];

const SPLASH_HTML = path.join(__dirname, "splash.html");

// Crash recovery (Batch 21): if the renderer process dies, reload the page
// instead of leaving a blank or dead window. Guard against a crash loop:
// after MAX_CRASH_RELOADS reloads inside CRASH_WINDOW_MS, stop
// auto-reloading and leave the page as-is (the user can reload manually).
const MAX_CRASH_RELOADS = 3;
const CRASH_WINDOW_MS = 60_000;
const crashReloadTimes = [];

function attachCrashRecovery(win) {
  // 'render-process-gone' is the current API; it subsumes the legacy
  // webContents 'crashed' event, so this single handler covers both.
  win.webContents.on("render-process-gone", (_event, details) => {
    const reason = details && details.reason;
    console.error(`[crash-recovery] render process gone: reason=${reason}`);
    if (reason !== "crashed" && reason !== "killed" && reason !== "oom") {
      return;
    }
    const now = Date.now();
    while (crashReloadTimes.length > 0 && now - crashReloadTimes[0] >= CRASH_WINDOW_MS) {
      crashReloadTimes.shift();
    }
    if (crashReloadTimes.length >= MAX_CRASH_RELOADS) {
      console.error(
        "[crash-recovery] too many crashes in a row — not auto-reloading",
      );
      return;
    }
    crashReloadTimes.push(now);
    if (!win.isDestroyed()) {
      win.webContents.reload();
    }
  });
}

// Splash window (Batch 21): a small frameless window with the rose logo,
// shown immediately so the user never stares at a blank window while the
// main window boots and the site loads. Closed when the main window is
// ready to show. Deliberately NOT transparent: a solid dark background
// avoids transparent-window quirks on Windows; splash.html paints the
// same colour, so it looks identical either way.
function createSplash() {
  const splash = new BrowserWindow({
    width: 360,
    height: 420,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: true,
    backgroundColor: "#140a12",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splash.loadFile(SPLASH_HTML);
  return splash;
}

function createWindow(splash) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Crush of Roses",
    autoHideMenuBar: true,
    // Hidden until ready: the splash covers the boot, and the user never
    // sees a blank white window.
    show: false,
    backgroundColor: "#140a12",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  attachCrashRecovery(win);

  // Reveal exactly once, whichever trigger fires first.
  let revealed = false;
  let fallbackTimer = null;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    if (splash && !splash.isDestroyed()) splash.close();
    if (!win.isDestroyed()) win.show();
  };

  win.once("ready-to-show", reveal);

  // If the site fails to load (offline, DNS, ...), don't trap the user on
  // the splash forever: show the main window so the browser error page is
  // visible and they can retry.
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`[load] failed: ${errorCode} ${errorDescription}`);
    reveal();
  });

  // Hard fallback: if neither event fires within 30 s (hung load), reveal
  // anyway instead of leaving the splash up indefinitely.
  fallbackTimer = setTimeout(reveal, 30_000);

  win.loadURL(SITE_URL);
  return win;
}

app.whenReady().then(() => {
  // Wrapped-app signal #2 (see batch17-contracts.md §1): append the token
  // to every user agent this app sends, so the game can detect the wrapper.
  // Signal #1 (window.__CRUSH_WRAPPED__) is set by preload.js.
  app.userAgentFallback = `${app.userAgentFallback} CrushOfRoses-Wrapped`;

  // Splash failure must never block the main window.
  let splash = null;
  try {
    splash = createSplash();
  } catch (err) {
    console.error("[splash] failed to create splash window:", err);
  }

  createWindow(splash);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(null);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
