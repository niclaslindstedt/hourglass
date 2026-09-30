// The screens a shot can be of, and how each is reached — by doing what a
// person does with the real app: a tap on the glass, a tap on the cog, the
// phone turned over or leaned or shaken. No DOM surgery, no state injected
// past the settings and the run the app itself keeps.
//
// Every shot starts on a fresh page with the glass up and part way through
// its run (`seedRun`). `stage(page, h)` takes it from there and returns
// when the screen is drawn; wait for the state an action makes (a dialog, a
// radio), never only for time, where there is a state to wait for. The
// sand is physics, though, and has no state to wait on: a heap settling or
// falling is given the time it takes (`h.settle(ms)`).
//
// The helpers on `h`:
//   h.device   — the device row (`devices.mjs`), `h.device.shape` is
//                "phone" | "desk"
//   h.run(state, at)  — reseed the run ("full" | "running" | "done") and reload
//   h.tilt(beta, gamma, alpha) — an orientation reading, as the phone's sensor
//                gives it: beta 90 is upright, −90 upside down; gamma leans it
//   h.shake(a) — a jolt of `a` m/s² along the screen from the accelerometer
//   h.setting(patch) — a settings patch, then a reload (the app reads it at boot)
//   h.settle(ms)     — a wait for the sand, after any state check

/* global document, window, DeviceOrientationEvent, DeviceMotionEvent */

/** The phone held upright, and then as asked: a first reading upright so
 *  the second is a turn or a lean rather than the sensor's first word. */
async function hold(page, h, beta, gamma, alpha = 0) {
  await h.tilt(90, 0, 0);
  await h.settle(150);
  await h.tilt(beta, gamma, alpha);
}

async function settings(page, h) {
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page.getByRole("radio", { name: "Light", exact: true }).waitFor();
  await h.settle();
}

export const SCREENS = {
  glass: {
    label: "Running",
    async stage(page, h) {
      await h.settle(900);
    },
  },
  full: {
    label: "Full, standing",
    async stage(page, h) {
      await h.run("full");
      await h.settle(900);
    },
  },
  done: {
    label: "Run out",
    async stage(page, h) {
      await h.run("done");
      await h.settle(900);
    },
  },
  turning: {
    label: "Tapped, turning",
    async stage(page, h) {
      await page.locator('[data-area="glass"]').click();
      await h.settle(330);
    },
  },
  turned: {
    label: "Tapped, landed",
    async stage(page, h) {
      await page.locator('[data-area="glass"]').click();
      await h.settle(900);
    },
  },
  upside: {
    label: "Phone upside down",
    async stage(page, h) {
      await hold(page, h, -90, 0);
      await h.settle(1500);
    },
  },
  "lean-right": {
    label: "Leaned right 40°",
    async stage(page, h) {
      await hold(page, h, 50, 90);
      await h.settle(2500);
    },
  },
  "lean-back": {
    label: "Leaned back 45°",
    async stage(page, h) {
      await hold(page, h, 45, 0);
      await h.settle(2500);
    },
  },
  "sky-up": {
    label: "Held up to the sky",
    // Tilted back to look up past the glass: the pose that shows what the
    // glass's waist mirrors of the land under the horizon.
    async stage(page, h) {
      await hold(page, h, 126, 0);
      await h.settle(2500);
    },
  },
  "turned-left": {
    label: "Phone turned left 90°",
    async stage(page, h) {
      await hold(page, h, 90, 0, 90);
      await h.settle(1200);
    },
  },
  "turned-right": {
    label: "Phone turned right 90°",
    async stage(page, h) {
      await hold(page, h, 90, 0, 270);
      await h.settle(1200);
    },
  },
  flat: {
    label: "Laid flat",
    async stage(page, h) {
      await hold(page, h, 5, 0);
      await h.settle(2500);
    },
  },
  shake: {
    label: "Shaken",
    async stage(page, h) {
      await hold(page, h, 90, 0);
      for (let k = 0; k < 6; k++) {
        await h.shake(k % 2 ? -22 : 22);
        await h.settle(50);
      }
      await h.settle(60);
    },
  },
  orbit: {
    label: "Turned by a finger",
    async stage(page, h) {
      const box = await page.locator('[data-area="glass"]').boundingBox();
      const y = box.y + box.height / 2;
      const x = box.x + box.width / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 70, y, { steps: 6 });
      await h.settle(50);
    },
  },
  flick: {
    label: "Flicked fast",
    async stage(page, h) {
      // A fast sideways flick, let go: the glass spins on, and the sand,
      // dragged round with it, is flung up the walls.
      const box = await page.locator('[data-area="glass"]').boundingBox();
      const y = box.y + box.height / 2;
      const x = box.x + box.width * 0.2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + box.width * 0.6, y, { steps: 3 });
      await page.mouse.up();
      await h.settle(1200);
    },
  },
  settings: {
    label: "Settings",
    stage: settings,
  },
};

export const SCREEN_SETS = {
  default: ["glass", "full", "done", "upside", "lean-right", "lean-back"],
  states: ["full", "glass", "done"],
  sensors: ["upside", "lean-right", "lean-back", "flat", "shake", "sky-up"],
  turn: ["turning", "turned", "upside"],
  around: ["glass", "turned-left", "turned-right", "lean-back"],
  all: Object.keys(SCREENS),
};

/** The helpers a stage function gets. */
export function helpers(page, device, { ready, seed, seedRun }) {
  return {
    device,
    async run(state, at) {
      const { script, arg } = seedRun(state, at);
      await page.addInitScript(script, arg);
      await page.reload();
      await ready(page);
    },
    async tilt(beta, gamma, alpha = 0) {
      await page.evaluate(
        ([a, b, g]) => {
          window.dispatchEvent(
            new DeviceOrientationEvent("deviceorientation", {
              alpha: a,
              beta: b,
              gamma: g,
              absolute: false,
            }),
          );
        },
        [alpha, beta, gamma],
      );
    },
    async shake(a) {
      await page.evaluate((x) => {
        window.dispatchEvent(
          new DeviceMotionEvent("devicemotion", {
            acceleration: { x: x * 0.3, y: x, z: 0 },
            accelerationIncludingGravity: { x: x * 0.3, y: x - 9.8, z: 0 },
            rotationRate: { alpha: 0, beta: 0, gamma: x * 4 },
            interval: 16,
          }),
        );
      }, a);
    },
    async setting(patch) {
      const { script, arg } = seed(patch);
      await page.addInitScript(script, arg);
      await page.reload();
      await ready(page);
    },
    async settle(ms = 250) {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(ms);
    },
  };
}

/** The app has loaded and the glass has drawn its first frame. */
export async function ready(page) {
  await page.locator('[data-area="glass"][data-drawn]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Nothing left in the frame that is only there because of the cursor. */
export async function release(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
}
