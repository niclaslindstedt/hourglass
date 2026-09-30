// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The phone wrapper's copy of the site (`native/scripts/bundle-web.mjs`): what
// it is built with, and what it must not carry.
//
// The phone app is the store edition built as a shell — no service worker, no
// update prompt — for the desktop shell's reason: the site ships inside the
// binary, and a worker in the WebView would serve an old copy of it after the
// store had delivered a new one.

import { describe, expect, it } from "vitest";

import { updateMachinery, webBuildEnv } from "../native/scripts/web-build.mts";

describe("the phone app's web build", () => {
  it("is the store edition, built as a shell, under the listing's name", () => {
    const env = webBuildEnv({ PATH: "/bin" }, "Listing Name");
    expect(env.VITE_EDITION).toBe("store");
    expect(env.VITE_SHELL_BUILD).toBe("on");
    expect(env.APP_DISPLAY_NAME).toBe("Listing Name");
  });

  it("keeps the caller's environment and overrides a stray shell flag", () => {
    const env = webBuildEnv(
      {
        PATH: "/bin",
        VITE_BASE: "/",
        VITE_SHELL_BUILD: "off",
      },
      "Hourglass",
    );
    expect(env.PATH).toBe("/bin");
    expect(env.VITE_BASE).toBe("/");
    expect(env.VITE_SHELL_BUILD).toBe("on");
  });

  it("lets a caller choose another edition explicitly", () => {
    expect(webBuildEnv({ VITE_EDITION: "web" }, "Hourglass").VITE_EDITION).toBe(
      "web",
    );
  });
});

describe("the update cycle the bundle refuses", () => {
  it("is nothing in a shell build's webroot", () => {
    expect(
      updateMachinery([
        "index.html",
        "assets/index-abc123.js",
        "manifest.webmanifest",
        "icons/pwa-192.png",
      ]),
    ).toEqual([]);
  });

  it("is the worker, the version it polls and its precache list", () => {
    expect(
      updateMachinery([
        "index.html",
        "version.json",
        "sw.js",
        "precache-manifest.json",
      ]),
    ).toEqual(["precache-manifest.json", "sw.js", "version.json"]);
  });

  it("looks only at the root, where a worker has to be to control the page", () => {
    expect(updateMachinery(["docs/sw.js", "assets/version.json"])).toEqual([]);
  });
});
