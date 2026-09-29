// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, type ReactNode } from "react";

import { CloseIcon } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";

// The desk's panel: where Settings goes on a wide screen.
//
// On a phone it is a screen you go to and come back from. On a desk the
// glass is already on screen and there is no reason to lose it — so the panel
// slides in over the right-hand edge and the desk stays put behind a light
// scrim. That is the whole reason it is a panel rather than a dialog in the
// middle: pick a frame in Settings and the hourglass in the centre of the
// desk changes as you do.
//
// It covers the content area rather than the window, so the top bar — and
// the button that opened it, lit as current — stays in reach; pressing that
// button again, the scrim, Escape or the cross closes it. It is a dialog to
// assistive tech and to the framework's own checks (`keyboardIsClaimed`), so
// the desk's single-key shortcuts stand down while it is open.
//
// It is the height of the content area it is positioned against (`App.tsx`'s
// <main>, which is deliberately not the scrolling box), and a settings page
// longer than that scrolls inside the panel. The desk behind it holds still:
// the panel is the only thing on screen that moves.

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function SidePanel({ title, onClose, children }: Props) {
  const t = useT();
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Escape closes the panel — but only while the panel is the top thing on
  // screen. A dialog opened from inside it is what Escape belongs to while
  // it is up. The framework's
  // `useEscapeKey` listens in the capture phase and stops the press dead, so
  // it would close the panel out from under the dialog instead; the panel
  // listens for itself and stands down while anything modal is stacked on
  // top of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (modalAbove(panel.current)) return;
      e.stopImmediatePropagation();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  // Focus lands on the panel when it opens and goes back to the button that
  // opened it when it closes, so a keyboard never loses its place.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panel.current?.focus();
    return () => opener?.focus();
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="app-panel-scrim absolute inset-0 z-30 bg-page-bg/50"
      />
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="app-panel absolute inset-y-0 right-0 z-40 flex w-[30rem] max-w-full flex-col border-l border-line bg-page-bg shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-base font-bold text-fg-bright">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </>
  );
}

/** Whether anything modal is drawn over the panel. A modal is portalled to
 *  the body, so one opened from inside the panel is still not *within* it —
 *  which is exactly what makes it the thing on top. */
function modalAbove(panel: HTMLElement | null): boolean {
  const modals = document.querySelectorAll('[aria-modal="true"]');
  for (const el of modals) {
    if (el !== panel && !panel?.contains(el)) return true;
  }
  return false;
}
