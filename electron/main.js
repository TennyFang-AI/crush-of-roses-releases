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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Crush of Roses",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(SITE_URL);
}

app.whenReady().then(() => {
  // Wrapped-app signal #2 (see batch17-contracts.md §1): append the token
  // to every user agent this app sends, so the game can detect the wrapper.
  // Signal #1 (window.__CRUSH_WRAPPED__) is set by preload.js.
  app.userAgentFallback = `${app.userAgentFallback} CrushOfRoses-Wrapped`;

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
