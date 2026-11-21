// Crush of Roses — preload script.
//
// Wrapped-app signal #1 (see batch17-contracts.md §1): expose
// window.__CRUSH_WRAPPED__ === true so the game can hide its
// Install/Download button inside the wrapper. Signal #2 (the
// CrushOfRoses-Wrapped user-agent token) is set in main.js.
// contextIsolation is on and nodeIntegration is off; this script exposes
// nothing else to the page.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("__CRUSH_WRAPPED__", true);
