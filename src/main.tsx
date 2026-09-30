// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "preact";

// The UI family (Inter) is imported statically so it ships in the main
// bundle and precaches for offline first paint — self-hosted from the
// `@fontsource` package, so it costs a request to nobody (see the network
// rule in AGENTS.md).
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-700.css";

import "./styles.css";
import { App } from "./App.tsx";
import { LanguageRoot } from "./app/i18n/index.ts";

// In dev no worker registers (`usePwaUpdate` runs disabled), but a worker
// installed by a previous `vite preview` on this origin would keep serving
// stale bytes — unregister any so the dev server always wins.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => void reg.unregister()));
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// Preact's own `render` mounts straight into the container. The demo
// (`VITE_SEED=demo`) needs no loading: it is a run computed from `now`, in
// memory, in `App.tsx`.
render(
  <LanguageRoot>
    <App />
  </LanguageRoot>,
  root,
);
