// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { APP_NAME, PROJECT_NAME } from "../src/app/appName.ts";
import { en } from "../src/app/i18n/en.ts";

// The name the app shows is the build's: the listing's in an app build (from
// `APP_DISPLAY_NAME`, through Vite's `define`), the project's own anywhere
// the constant was never defined — which is what these tests run as.

describe("APP_NAME", () => {
  it("falls back to the project's own name when the build named nothing", () => {
    expect(APP_NAME).toBe(PROJECT_NAME);
    expect(PROJECT_NAME).toBe("Hourglass");
  });

  it("is what every sentence that names the app says", () => {
    expect(en.app.name).toBe(APP_NAME);
    expect(en.settings.privacy).toContain(APP_NAME);
  });
});
