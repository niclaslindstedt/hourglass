// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { RefreshIcon } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";

// A new version, said the way the cog says Settings: a glyph floating in the
// corner beside it, never a banner over the glass. The framework's
// `usePwaUpdate` looks for a build by itself (on start, hourly, and when the
// tab comes back) and parks it until it is asked; this is the asking. A tap
// reloads onto it — and the sand stays where it was, because where a run
// stands is read off the wall clock (`useRun`), not kept in the page.
//
// It sits where the cog sits and turns with it: beside it in the top right,
// and with the phone upside down beside it in the corner that is now the top
// (`.app-update-glyph` in `styles.css`), fading out and in with it.

type Props = {
  /** A new build is installed and waiting. */
  ready: boolean;
  /** The phone is upside down: the corner that is now the top. */
  upside: boolean;
  /** Faded out while the cog changes corners. */
  shown: boolean;
  onReload: () => void;
};

export function UpdateGlyph({ ready, upside, shown, onReload }: Props) {
  const t = useT();
  const [reloading, setReloading] = useState(false);
  if (!ready) return null;
  const label = reloading ? t("update.reloading") : t("update.glyph");
  return (
    <>
      <span role="status" className="sr-only">
        {t("update.available")}
      </span>
      <button
        type="button"
        onClick={() => {
          if (reloading) return;
          setReloading(true);
          onReload();
        }}
        aria-label={label}
        aria-busy={reloading}
        title={label}
        className={`app-update-glyph absolute z-40 flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition-[opacity,background-color,color] duration-200 hover:bg-white/10 hover:text-white ${
          upside ? "app-update-glyph-upside rotate-180" : ""
        } ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <RefreshIcon className={`h-5 w-5 ${reloading ? "animate-spin" : ""}`} />
      </button>
    </>
  );
}
