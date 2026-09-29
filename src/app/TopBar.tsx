// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { CogIcon } from "@niclaslindstedt/oss-framework/components";

import { AppMarkIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";

// The bar across the top of the Settings screen: the app's mark and name,
// and the cog, lit, which is also the way back. The glass itself has no bar
// — it has the whole screen, and the cog floats in its corner (`App.tsx`).
//
// The sibling apps' geometry — a bordered row at `px-4 py-3` with the action
// on the right — so a header that lands at the same height on each of them
// reads as one family. `padding-top` comes from the stylesheet
// (`.app-header`), the larger of the row's own padding and the status bar.

type Props = {
  onBack: () => void;
};

export function TopBar({ onBack }: Props) {
  const t = useT();
  return (
    <header className="app-header relative flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 pb-3">
      <h1 className="app-wordmark flex min-w-0 items-center gap-2 text-accent">
        <AppMarkIcon className="h-6 w-6 shrink-0" />
        <span className="truncate">{t("app.name")}</span>
      </h1>
      <button
        type="button"
        onClick={onBack}
        aria-label={t("nav.back")}
        aria-current="page"
        title={t("nav.back")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent transition-colors hover:bg-surface-2"
      >
        <CogIcon className="h-5 w-5" />
      </button>
    </header>
  );
}
