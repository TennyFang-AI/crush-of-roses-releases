; Crush of Roses — custom NSIS include (Batch 21).
;
; Picked up automatically by electron-builder: nsis.include defaults to
; "installer.nsh" in the build resources dir (this file). It is a
; build-time resource only — it is NOT packaged into the app.
;
; customCheckAppRunning — "app is running" check for the installer.
;
; WHY THIS EXISTS
; --------------
; The stock electron-builder template (26.18.0) DOES call CHECK_APP_RUNNING
; in the oneClick install section, so the "oneClick has no check at all"
; theory does not hold for this version. The remaining hole is in how the
; stock check detects the app: FIND_PROCESS leans on PowerShell
; (Get-CimInstance, matching by $INSTDIR path prefix) with a tasklist
; fallback filtered by USERNAME. Either leg can miss a running instance —
; PowerShell blocked/unavailable, or the app running elevated / as another
; user while the installer runs un-elevated — and then the installer
; proceeds to overwrite in-use files and fails mid-install with no clear
; message ("failing silently").
;
; This macro keeps the stock prompt/kill/retry flow for the running case,
; but probes FIRST with nsProcess (bundled with electron-builder's NSIS
; resources): an exact exe-name match that works across users and
; elevation levels and needs no PowerShell. If the app is not running we
; skip the stock probe entirely; if it is, we hand over to the stock
; flow (user prompt, graceful close, forced kill, retry loop).
;
; GOTCHAS (both hit during the Batch 21 build, 21 Nov 2026)
; ---------------------------------------------------------
; 1. nsProcess::FindProcess is a MACRO from nsProcess.nsh, not a plugin
;    export — the DLL only exports _FindProcess / _KillProcess. Call it
;    with !insertmacro; a bare `nsProcess::FindProcess "..."` fails
;    makensis with "Plugin function not found".
; 2. When customCheckAppRunning is defined, the stock template SKIPS
;    including getProcessInfo.nsh and declaring `Var pid` (see
;    allowOnlyOneInstallerInstance.nsh) — so a custom macro that hands
;    over to the stock _CHECK_APP_RUNNING must include that file and
;    declare `pid` itself, or makensis fails with
;    `Invalid command: "${GetProcessInfo}"`. Both are done below.

!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  ; nsProcess::FindProcess pushes 0 when the process is running, non-zero
  ; when it is not (or the lookup failed — treated as "not running", in
  ; which case the stock probe below is skipped and the install proceeds;
  ; a stale false negative here is no worse than the stock behaviour).
  !insertmacro nsProcess::FindProcess "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    ; App is running — stock flow: prompt the user, close gracefully,
    ; force-kill if needed, retry loop.
    !insertmacro IS_POWERSHELL_AVAILABLE
    !insertmacro _CHECK_APP_RUNNING
  ${EndIf}
!macroend
