// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />
//
// Vite's ambient client types: `import.meta.env` and the side-effecting asset
// imports (`import "./styles.css"`) both resolve through this.

// The app version, inlined by Vite's `define` (see `vite.config.ts`).
declare const __APP_VERSION__: string;

// The name the app shows — the listing's (`APP_DISPLAY_NAME`) in an app
// build, the project's own on the website. Read it as `APP_NAME` from
// `src/app/appName.ts`, which falls back when this is not defined.
declare const __APP_NAME__: string | undefined;

// The build identifier shown in Settings → About, composed at build time (see
// `vite.config.ts`): `<version>[.<run>][-<slot>][+<commit>]`.
declare const __BUILD_LABEL__: string;

// Build identity, inlined by Vite's `define` and shown in Settings → About.
declare const __BUILD_COMMIT__: string;
declare const __BUILD_NUMBER__: string;

// Build-time env the app reads through `import.meta.env`. All optional — the
// app builds and runs with none of them set. See `docs/configuration.md`.
interface ImportMetaEnv {
  // Which build this is: "store" for the one sold in the App Store, anything
  // else (including unset) for the web edition. Read by `vite.config.ts`
  // alone: it leaves the web edition's address out of an app build.
  readonly VITE_EDITION?: string;
  // "demo" boots the app onto an in-memory demo — a glass part way through
  // a run — and nothing else: `make demo` and the store screenshots. See
  // `src/app/dev/demo.ts`.
  readonly VITE_SEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Whether this build is the one bundled inside a shell (tauri/, native/).
// True only when a bundle script built it: no service worker was emitted, so
// there is no update lifecycle for the app to drive.
declare const __SHELL_BUILD__: boolean;
