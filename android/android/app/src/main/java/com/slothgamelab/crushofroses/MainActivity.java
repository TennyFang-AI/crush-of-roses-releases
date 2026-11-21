package com.slothgamelab.crushofroses;

import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;
import com.getcapacitor.WebViewListener;

/**
 * Crush of Roses — thin Capacitor shell.
 *
 * Batch 21: crash recovery. Capacitor 8's BridgeWebViewClient already
 * forwards onRenderProcessGone to registered WebViewListeners, but with
 * no listener registered the default returns false — and a false return
 * tells Android to destroy the WebView, leaving the app on a dead/blank
 * screen until force-stop. This listener returns true (we handle it)
 * and reloads the page, so a renderer crash (or the system killing the
 * renderer under memory pressure) recovers in place instead of
 * stranding the player.
 *
 * Reload-loop guard: if the renderer dies more than MAX_CRASHES times
 * inside CRASH_WINDOW_MS we stop reloading — a page that crashes on
 * load would otherwise loop forever. The counter resets once the
 * window passes.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "CrushOfRoses";

    private static final int MAX_CRASHES = 3;
    private static final long CRASH_WINDOW_MS = 30_000L;

    private long crashWindowStartMs = 0;
    private int crashesInWindow = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // super.onCreate() builds the bridge (BridgeActivity.load()), so
        // getBridge() is non-null here.
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                    boolean crashed = detail != null && detail.didCrash();
                    Logger.info(TAG, "WebView render process gone (crashed=" + crashed + "), recovering");
                    if (!shouldReloadAfterCrash()) {
                        Logger.warn(TAG, "Render process died " + MAX_CRASHES
                                + " times in " + (CRASH_WINDOW_MS / 1000)
                                + "s — not reloading (likely a page that crashes on load)");
                        return false;
                    }
                    // onRenderProcessGone runs on the UI thread, but post
                    // anyway so the reload happens after the callback
                    // unwinds and the WebView is back in a reloadable state.
                    webView.post(webView::reload);
                    // true = we handled it: keep the WebView alive so the
                    // reload can recreate the renderer. Returning false
                    // would destroy it.
                    return true;
                }
            });
        }
    }

    private boolean shouldReloadAfterCrash() {
        long now = SystemClock.uptimeMillis();
        if (now - crashWindowStartMs > CRASH_WINDOW_MS) {
            crashWindowStartMs = now;
            crashesInWindow = 0;
        }
        crashesInWindow++;
        return crashesInWindow <= MAX_CRASHES;
    }
}
