// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Layout } from "./glass.ts";
import type { Look } from "./look.ts";
import type { Bulb } from "./sand.ts";
import type { Camera } from "./scene.ts";
import type { LookSprites } from "./sprites.ts";

// What one painted frame is made of: the camera, the look, the shapes, the
// two heaps and the moment. Shared by `paint.ts` and the two sections it
// hands off to, `paintGlass.ts` and `paintSand.ts`, so none of them has to
// import the other for the type.

/** What one frame is made of. */
export type Frame = {
  cam: Camera;
  look: Look;
  layout: Layout;
  /** The bulb the sand runs out of, resting against the waist, and the one
   *  it runs into, resting on its plate. */
  source: Bulb;
  sink: Bulb;
  /** Which way gravity points on the screen: down it (1), or up it (−1)
   *  when the phone is held upside down — the source is then the lower
   *  bulb on the screen, and the stream runs up it. */
  gravity: 1 | -1;
  /** Gravity's lean across the screen (`useMotion`), as a tangent: the
   *  stream falls at that slant, and the heaps have been told it already
   *  (`setTilt`). */
  tilt: number;
  /** How shaken the glass is now, 0..1: the stream scatters and the dust
   *  jumps by it. */
  shake: number;
  /** How strong the stream runs, 0..1. */
  flow: number;
  /** Seconds, for what moves: the grains in the stream. */
  t: number;
  /** The light behind the glass once the sand has run out, 0..1. */
  glow: number;
  /** Device pixels to the CSS pixel: the grain and the light are drawn at
   *  the device's own resolution. */
  dpr: number;
  /** The grain, as a pattern to lay over the sand (`grainPattern`). */
  grain: CanvasPattern | null;
  /** The light on the glass, rendered once for this size (`glassLight`). */
  glassLight: HTMLCanvasElement | null;
  /** Whether the page behind the glass is light: the glass's edges are
   *  then drawn in shadow rather than in light. */
  light: boolean;
  /** The modelled parts (`sprites.ts`), where they have loaded: the
   *  plates, the posts, the finials and the light on the glass are then
   *  those pictures rather than the painter's own. */
  sprites: LookSprites | null;
  /** Whether the frame stands the other way up, as a tap's turn leaves
   *  it: the finials hang under the bottom plate. */
  upended?: boolean;
};

/** A post's place: across the plate, into the picture, and how far in
 *  front of the glass's axis it stands on the screen (`postPositions`). */
export type Post = { x: number; z: number; depth: number };
