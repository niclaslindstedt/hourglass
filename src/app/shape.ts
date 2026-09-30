// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// What shape the window is. The shell asks one thing about the device: is
// there room for the desk shell — Settings as a panel beside the glass,
// rather than a screen over it — which is a matter of width. The edge is
// shared with the stylesheet (`lg:`, `@media (min-width: 64rem)`); keep the
// numbers here and there the same.

/** The desk's edge, in rem: Tailwind's `lg`. */
export const DESK_WIDTH = 64;

export const DESK_QUERY = `(min-width: ${DESK_WIDTH}rem)`;

/** Whether a window this wide is the desk. */
export function isDesk(width: number): boolean {
  return width >= DESK_WIDTH * 16;
}
