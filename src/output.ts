// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The central output module: every diagnostic line the app emits goes
// through these semantic helpers rather than bare `console.*` calls. They
// fan out to the in-app log buffer (Settings → Developer renders it live).

import { logStore } from "./app/log.ts";

const out = logStore.createLogger("app");

/** A normal progress/state line ("Service worker ready"). */
export function status(message: string): void {
  out.info(message);
}

/** Supplementary detail a user only reads when digging. */
export function info(message: string): void {
  out.info(message);
}

/** Something odd but recoverable — the app continues. */
export function warn(message: string): void {
  out.warn(message);
}

/** A failure the user should know about. */
export function error(message: string): void {
  out.error(message);
}
