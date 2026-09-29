// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";

// A single in-app log buffer, built on the framework's logging module. The
// Settings → Developer panel renders it live through the framework's
// `LogViewer`. There is no server to ship logs to and nowhere else to look,
// so "what did the app just do?" has to be answerable on-device.
export const logStore = createLogStore({ logsKey: "hourglass:logs" });
logStore.setEnabled(true);
logStore.setCaptureEnabled(true);

export const log = logStore.createLogger("app");
