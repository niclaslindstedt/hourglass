// The windows the app is looked at in. Each is a CSS viewport, which is what
// decides the layout (`src/app/shape.ts`): under 1024 px wide the phone
// shell, Settings a screen over the glass; 1024 and past it the desk,
// Settings a panel over the right-hand edge.
//
// `mobile` turns on touch and the mobile viewport meta handling; the pixel
// ratio is the run's `--scale` (1 by default — quick to take and quick to
// read; 2 for a closer look at a line or a glyph).

export const DEVICES = {
  phone: {
    label: "iPhone 6.9″",
    width: 440,
    height: 956,
    mobile: true,
    shape: "phone",
  },
  "phone-small": {
    label: "iPhone SE",
    width: 375,
    height: 667,
    mobile: true,
    shape: "phone",
  },
  "phone-landscape": {
    label: "iPhone on its side",
    width: 956,
    height: 440,
    mobile: true,
    shape: "phone",
  },
  "tablet-mini": {
    label: "iPad mini upright",
    width: 744,
    height: 1133,
    mobile: true,
    shape: "phone",
  },
  tablet: {
    label: "iPad 13″ upright",
    width: 1032,
    height: 1376,
    mobile: true,
    shape: "desk",
  },
  "tablet-landscape": {
    label: "iPad 13″ on its side",
    width: 1376,
    height: 1032,
    mobile: true,
    shape: "desk",
  },
  desktop: {
    label: "Laptop window",
    width: 1440,
    height: 900,
    mobile: false,
    shape: "desk",
  },
  "desktop-small": {
    label: "Small desktop window",
    width: 1280,
    height: 720,
    mobile: false,
    shape: "desk",
  },
  "desktop-wide": {
    label: "Wide monitor",
    width: 1920,
    height: 1080,
    mobile: false,
    shape: "desk",
  },
};

/** Named sets for `--device`. */
export const DEVICE_SETS = {
  default: ["phone", "tablet", "desktop"],
  phones: ["phone", "phone-small", "phone-landscape"],
  tablets: ["tablet-mini", "tablet", "tablet-landscape"],
  desktops: ["desktop-small", "desktop", "desktop-wide"],
  all: Object.keys(DEVICES),
};
