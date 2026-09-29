// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

type IconProps = { className?: string };

/** The app's mark: an hourglass, two triangles on a stroke, the same
 *  geometry `public/icons/icon.svg` and `scripts/generate-icons.mjs`
 *  carry. */
export function AppMarkIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M6 3h12M6 21h12M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l2.4-2.3A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.6-3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2V21" />
    </svg>
  );
}
