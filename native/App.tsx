// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WHOLE APP: a WebView over the bundled web build, and nothing else.
//
// This is a deliberately thin wrapper. It starts a loopback server, points a
// WebView at it, keeps the native chrome in step with the page's theme, and
// sends off-origin links to the system browser. There is no native UI at all
// beyond a spinner and a failure screen — everything a reader sees is the
// web app, unchanged.
//
// What the wrapper adds is that the app runs FROM INSIDE THE DOWNLOAD — no
// network at all, ever — which is what makes it an app rather than a viewer
// for a website (App Store guideline 4.2). It is offered from the OUTSIDE:
// the page is served unchanged and never told where it runs. See
// `native/README.md`.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

import {
  FALLBACK_BACKGROUND,
  FALLBACK_FOREGROUND,
  REMOTE_URL,
} from "./src/config";
import { startLocalServer, type LocalServer } from "./src/local-server";
import {
  AFTER_LOAD_SCRIPT,
  BEFORE_LOAD_SCRIPT,
  isThemeReport,
  statusBarStyleFor,
} from "./src/injected";

// Hold the native splash until the WebView actually paints. Called at module
// scope so the auto-hide never wins the race; a rejection only means the
// splash was already gone, which is harmless.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Ceiling on how long the splash may stay up. The happy path hides it on first
// paint; this only fires when a load hangs, so a broken start falls through to
// the spinner or the failure screen instead of stranding the reader on a
// splash forever.
const SPLASH_TIMEOUT_MS = 10_000;

// Which screen edges the native frame keeps clear of the system bars.
//
// iOS: none. The page is built to run edge to edge — `viewport-fit=cover`,
// and the corners pad themselves with `env(safe-area-inset-*)` — which is how
// the installed PWA looks. Android: top and bottom, because the WebView's
// safe-area insets are not reliably reported there.
const FRAME_EDGES =
  Platform.OS === "ios" ? ([] as const) : (["top", "bottom"] as const);

type ServerState =
  | { status: "starting" }
  | { status: "ready"; origin: string }
  | { status: "failed"; error: Error };

export default function App() {
  const [server, setServer] = useState<ServerState>(
    REMOTE_URL
      ? { status: "ready", origin: REMOTE_URL }
      : { status: "starting" },
  );
  // The page's background as it last reported it; null until it has.
  const [pageBackground, setPageBackground] = useState<string | null>(null);
  const background = pageBackground ?? FALLBACK_BACKGROUND;
  const webViewRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const serverRef = useRef<LocalServer | null>(null);

  // --- the embedded server --------------------------------------------------

  const start = useCallback(async () => {
    if (REMOTE_URL) return;
    setServer({ status: "starting" });
    try {
      const running = await startLocalServer();
      serverRef.current = running;
      setServer({ status: "ready", origin: running.origin });
    } catch (error) {
      setServer({
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  useEffect(() => {
    void start();
    return () => {
      void serverRef.current?.stop();
    };
  }, [start]);

  // --- the splash -----------------------------------------------------------

  const splashHidden = useRef(false);
  const hideSplash = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(hideSplash, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hideSplash]);

  useEffect(() => {
    if (server.status === "failed") hideSplash();
  }, [server.status, hideSplash]);

  // --- what the page says ---------------------------------------------------

  const origin = server.status === "ready" ? server.origin : null;

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.nativeEvent.data) as unknown;
    } catch {
      return; // not ours — the page may postMessage whatever it likes
    }
    if (!isThemeReport(parsed)) return;
    // The native chrome follows the page's theme so the status bar and the
    // safe-area bands match it instead of guessing.
    const reported = parsed.theme.background;
    if (typeof reported === "string" && reported.trim() !== "") {
      setPageBackground(reported.trim());
    }
  }, []);

  // --- navigation -----------------------------------------------------------

  // Android routes the hardware button; iOS gets the edge swipe below.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false; // fall through: exit the app
      webViewRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Keep the WebView on the embedded app. Anything else — a link out of the
  // app — belongs in the system browser, because App Review expects external
  // links to open externally. A `blob:` or `data:` URL exists only inside the
  // page, so the system browser could not open it either, and it is refused.
  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      if (!origin) return false;
      if (request.url.startsWith("blob:") || request.url.startsWith("data:"))
        return false;
      if (request.url.startsWith(origin)) return true;
      if (request.url.startsWith("about:")) return true;
      void Linking.openURL(request.url);
      return false;
    },
    [origin],
  );

  if (server.status === "failed") {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center}>
          <StatusBar style={statusBarStyleFor(FALLBACK_BACKGROUND)} />
          <Text style={styles.errorTitle}>Could not start Hourglass</Text>
          <Text style={styles.errorBody}>{server.error.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void start()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.fill, { backgroundColor: background }]}
        edges={FRAME_EDGES}
      >
        {/* Styled from the page's reported background, never from the
            phone's light or dark setting: the page's own colour is what sits
            under the bar (see `statusBarStyleFor`). "auto" until it reports. */}
        <StatusBar style={statusBarStyleFor(pageBackground)} />
        {origin ? (
          <WebView
            ref={webViewRef}
            source={{ uri: origin }}
            style={[styles.fill, { backgroundColor: background }]}
            javaScriptEnabled
            // Android: without this `localStorage` is unavailable entirely,
            // which is where the settings live.
            domStorageEnabled
            // Never set `incognito` — it makes WKWebView storage
            // non-persistent, which would drop the settings on exit.
            incognito={false}
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
            // Before the page's own scripts: the service-worker guard.
            injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD_SCRIPT}
            // Once the page has loaded: the theme reporter the chrome follows,
            // guarded against a second injection (a reload re-runs this).
            injectedJavaScript={AFTER_LOAD_SCRIPT}
            onMessage={onMessage}
            onLoadEnd={hideSplash}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={(nav) => {
              canGoBack.current = nav.canGoBack;
            }}
            // The app draws its own surfaces; bouncing the WebView itself just
            // exposes the native background behind the layout.
            bounces={false}
            overScrollMode="never"
            // iOS runs full-bleed (see `FRAME_EDGES`), so the scroll view must
            // not pad itself back down by the safe area: the page does that,
            // through `env(safe-area-inset-*)`, exactly as the installed PWA.
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: FALLBACK_BACKGROUND },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FALLBACK_BACKGROUND,
    padding: 24,
  },
  errorTitle: {
    color: FALLBACK_FOREGROUND,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: { color: "#57606a", fontSize: 14, textAlign: "center" },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e6eaef",
  },
  retryButtonPressed: { backgroundColor: "#d3dae1" },
  retryLabel: { color: FALLBACK_FOREGROUND, fontSize: 15, fontWeight: "600" },
});
