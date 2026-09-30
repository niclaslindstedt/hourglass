// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Expo config, as a FUNCTION rather than a static app.json so the app's
// marketing version can be read from the web app's `package.json`. The wrapper
// has no version of its own — it ships one build of the hourglass, and the
// two must never disagree about which one. Store build numbers are
// auto-incremented by EAS (see eas.json), so nothing here is bumped by hand.

const { version } = require("../package.json");

// The listing's name and identifier. Build variables rather than literals —
// see ./identifiers.js.
const { DISPLAY_NAME, BUNDLE_ID } = require("./identifiers.js");

// The light theme's page background (`index.html`'s light `theme-color`).
// Only paints the splash and the chrome before the page reports its own.
const BRAND_BG = "#ffffff";

// The near-black the app mark is cut from (scripts/generate-icons.mjs's BG).
// The adaptive icon's foreground runs to the edges of its tile, so the layer
// behind it has to be the same ink or the launcher's mask shows a seam.
const MARK_INK = "#12101a";

// The EAS project this app builds under. `eas init` prints the id; paste it
// here or pass it in the environment (which is what CI does), because
// `eas init` cannot write into a dynamic config. Left unset, the project is
// simply unlinked and `eas build` will ask — it is not a build failure.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? "";

module.exports = () => ({
  expo: {
    name: DISPLAY_NAME,
    slug: "hourglass",
    version,
    // An hourglass stands up: the screen is a column with the glass in it,
    // and laid on its side the glass would be shorter than it is wide.
    // Pinned to portrait on purpose.
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    icon: "./assets/icon.png",
    // The URL scheme is the bundle id — reverse-DNS, as RFC 8252 §7.1 asks of
    // a private-use scheme, so it is this listing's own and no other app can
    // claim it. `se.agilator.hourglass` in production, `dev.local.hourglass` in a
    // plain checkout; never committed.
    scheme: BUNDLE_ID,
    backgroundColor: BRAND_BG,
    assetBundlePatterns: ["**/*"],

    ios: {
      supportsTablet: true,
      // The iPad would otherwise have to turn with every orientation to
      // share its screen; this app holds one, so it takes the whole screen.
      requireFullScreen: true,
      bundleIdentifier: BUNDLE_ID,
      infoPlist: {
        // Portrait, and only the right way up. Expo's `orientation:
        // "portrait"` lets iOS turn the screen upside down as well, which
        // is the one turn this app is about: held upside down, the sand
        // runs the other way and only the cog changes corners — the page
        // itself never spins round. (Expo notes at prebuild that this
        // overrides `orientation` on iOS; that is the point.)
        UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
        "UISupportedInterfaceOrientations~ipad": [
          "UIInterfaceOrientationPortrait",
        ],
        // The bundled build is served over plain HTTP on the loopback
        // interface. ATS is left ON — only localhost is excepted, so nothing
        // else in the app may fall back to cleartext.
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: true,
          NSExceptionDomains: {
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: false,
            },
          },
        },
        // Skips the App Store export-compliance prompt: no non-exempt crypto.
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: BUNDLE_ID,
      // A buzz when the sand runs out, and nothing else: the wrapper reads no
      // sensor, no contact and no file outside its own sandbox — and Play's
      // data-safety form is answered against this list. The app is the web
      // app served from inside the download.
      permissions: ["android.permission.VIBRATE"],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: MARK_INK,
      },
    },

    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 180,
          resizeMode: "contain",
          backgroundColor: BRAND_BG,
        },
      ],
      // The bundled static server (lighttpd, via
      // @dr.pogodin/react-native-static-server) needs Android minSdk 28, and
      // the loopback origin is plain HTTP so cleartext has to be permitted.
      [
        "expo-build-properties",
        { android: { minSdkVersion: 28, usesCleartextTraffic: true } },
      ],
    ],

    extra: {
      // NO remote URL here, deliberately. The app serves the copy of the
      // hourglass bundled inside it (assets/webroot.zip) from a loopback
      // server — that is what makes it work offline, and what makes it an app
      // rather than a viewer for a website (App Store guideline 4.2). To point
      // a debug build at a deployed slot, set EXPO_PUBLIC_HOURGLASS_URL at
      // build time; src/config.ts reads that env var directly.
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
  },
});
