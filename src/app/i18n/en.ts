// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The English catalog — the app's single source of user-facing copy, and
// (as the fallback language) the source of the compile-time message-key
// type. Add a string here first; `t()` won't type-check against a key this
// file doesn't carry.

import { APP_NAME } from "../appName.ts";

export const en = {
  app: {
    name: APP_NAME,
    tagline: "A glass of sand, on your device",
  },

  nav: {
    settings: "Settings",
    back: "Back",
  },

  common: {
    close: "Close",
  },

  // The hourglass itself: what a press does, and what it says to a screen
  // reader.
  glass: {
    aria: "The hourglass, {state}. Press to turn it over; hold, or press Backspace, to reset it; drag up or down to change how long it runs; drag sideways, or use the left and right arrows, to turn it round; pinch, scroll, or press plus and minus to make it bigger or smaller.",
    hint: "Press to turn it over, hold to reset it. Drag up or down to make it a longer or a shorter glass, sideways to turn it round. Pinch or scroll to make it bigger or smaller.",
    running: "running",
    paused: "standing still",
    done: "run out",
  },

  timer: {
    minutes: "{n} min",
    hours: "{n} h",
    hoursMinutes: "{h} h {m} min",
  },

  // A new version: the glyph beside the cog, and About's check.
  update: {
    available: "A new version is ready",
    glyph: "A new version is ready — tap to reload",
    reload: "Reload",
    reloading: "Reloading…",
    check: "Check for updates",
    checking: "Checking…",
    upToDate: "This is the latest version",
    unavailable: "Updates can't be checked here",
    hint: "The app looks for a new version by itself and shows a small arrow beside the cog when one has landed. Reloading leaves the sand where it was.",
  },

  settings: {
    title: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "Device",
    glass: "The hourglass",
    glassHint:
      "Pick one of the ten, or Custom and put one together: the frame it stands in, the shape of the glass, and the sand in it. Every sand piles at its own angle, and the glass runs the same however it looks.",
    glassPreset: "Hourglass",
    glassCustom: "Custom",
    glassCustomHint: "Your own hourglass, piece by piece.",
    // The ten presets, named for where you would find one.
    preset: {
      study: "Study",
      harbor: "Harbor",
      midnight: "Midnight",
      desert: "Desert",
      glacier: "Glacier",
      nordic: "Nordic",
      library: "Library",
      loft: "Loft",
      meadow: "Meadow",
      treasure: "Treasure",
    },
    presetHint: {
      study: "Walnut and black steel, a teardrop glass, pale quartz sand.",
      harbor: "The ship's glass: turned brass, round bulbs, white sand.",
      midnight:
        "Black lacquer with a gold line, a tall smoked glass, black sand.",
      desert: "Copper, a wide bell-shaped glass, red sand.",
      glacier: "Brushed steel, two straight cones, blue glass beads.",
      nordic: "Blonde pine, round bulbs, black sand.",
      library: "Turned oak, old green-tinged glass, quartz sand.",
      loft: "No frame at all: a bare glass on thick ground ends, white sand.",
      meadow: "Oak and a teardrop glass, green sand.",
      treasure: "Brass, a bell glass, fine gold sand.",
    },
    top: "The frame",
    tops: {
      walnut: "Walnut",
      oak: "Oak",
      pine: "Pine",
      ebony: "Ebony",
      brass: "Brass",
      copper: "Copper",
      steel: "Steel",
      bare: "None",
    },
    topHint: {
      walnut: "Square walnut plates, four black steel posts, acorn nuts.",
      oak: "Round turned oak, three turned spindles.",
      pine: "Square blonde pine, four pale dowels.",
      ebony:
        "Round black lacquer with a gold line, four slim brass posts, a ball on each.",
      brass: "Round turned brass, three brass balusters.",
      copper: "Round copper, three rods, a ball on each.",
      steel: "Square brushed steel, two flat bands on the diagonal.",
      bare: "No frame: the glass stands on its own thick ground ends.",
    },
    shape: "The glass",
    shapes: {
      teardrop: "Teardrop",
      sphere: "Sphere",
      cone: "Cone",
      slim: "Slim",
      antique: "Antique",
      bell: "Bell",
    },
    shapeHint: {
      teardrop: "A dome to the widest point, then a long taper to the waist.",
      sphere: "Two near-spheres and a short waist, the blown shape.",
      cone: "Two cones tip to tip, thick-walled and straight-sided.",
      slim: "Tall and narrow, in smoked grey glass.",
      antique:
        "Old glass with a faint green in it, and a longer collar at the waist.",
      bell: "Flat, wide ends that curve straight into the waist.",
    },
    sand: "The sand",
    sands: {
      quartz: "Quartz",
      white: "White",
      black: "Black",
      red: "Red",
      blue: "Blue",
      gold: "Gold",
      pink: "Rose",
      green: "Green",
    },
    sandHint:
      "Each sand piles at its own angle — the heap of glass beads is the flattest, black sand the steepest — and that is what shapes the funnel and the cone.",
    timer: "The timer",
    timerHint:
      "How long the glass runs, and so how big it is. On the glass itself, drag up for longer and down for shorter.",
    length: "Length",
    vibrate: "Buzz when it runs out",
    vibrateHint:
      "A short vibration when the last of the sand is through, where the device can.",
    awake: "Keep the screen on",
    awakeHint: "While the sand is running, the screen does not go to sleep.",
    sensor: "Turn with the phone",
    sensorHint:
      "Turn the phone upside down and the sand falls to the other end and runs the other way; lean it to a side, back or forward and the heaps slide that way; shake it and the grains jump; swing it and the glass swings a little behind. The sky behind stays level with the world. Uses the motion sensors, which on an iPhone ask for permission the first time you tap the glass. The readings are used for the next frame and nothing else — never stored or sent.",
    haptics: "Feel the sand",
    hapticsHint:
      "A tick in the hand when the sand hits the glass — when it is shaken, or lands after a turn — where the device can buzz.",
    sky: "The sky",
    skyHint:
      "What stands behind the glass, and lights it. Now is the sky outside at this moment — the sun or the moon where they stand, as bright as the hour, the season and the place make it, the place read from the device's time zone and never sent anywhere.",
    skies: {
      now: "Now",
      day: "Day",
      dusk: "Dusk",
      night: "Night",
    },
    developer: "Developer",
    devMode: "Developer mode",
    devModeHint: "Show the log panel.",
    captureLogs: "Capture console output",
    captureLogsHint: "Mirror console messages into the log panel below.",
    about: "About",
    version: "Version",
    build: "Build",
    privacy: `${APP_NAME} keeps nothing but the settings on this device, and sends nothing anywhere: no account, no analytics, no requests at all. The privacy policy is at apps.agilator.se.`,
  },
} as const;

export type Catalog = typeof en;
