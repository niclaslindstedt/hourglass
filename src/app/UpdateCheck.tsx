// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Button,
  RefreshIcon,
  SpinnerIcon,
} from "@niclaslindstedt/oss-framework/components";
import type {
  PwaUpdate,
  PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";

import { useT } from "./i18n/index.ts";

// Settings' half of the update: the glyph beside the cog is what a reader
// usually meets, and this is for asking now rather than waiting for the
// next look (`checkForUpdate`). The answer stays under the button once the
// check ends — "up to date" or "can't check here" — and a found build turns
// the button into the reload itself.
//
// The website only: a desktop or phone build updates by being replaced, so
// Settings leaves this row out there (`__SHELL_BUILD__`).

export function UpdateCheck({ pwa }: { pwa: PwaUpdate }) {
  const t = useT();
  const [echo, setEcho] = useState<PwaUpdateCheckResult | null>(null);
  const [reloading, setReloading] = useState(false);
  const check = async () => {
    setEcho(null);
    setEcho(await pwa.checkForUpdate());
  };
  const line = pwa.checking
    ? t("update.checking")
    : pwa.needRefresh
      ? t("update.available")
      : echo === "up-to-date"
        ? t("update.upToDate")
        : echo === "unavailable"
          ? t("update.unavailable")
          : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {pwa.needRefresh ? (
          <Button
            variant="primary"
            disabled={reloading}
            aria-busy={reloading}
            onClick={() => {
              setReloading(true);
              pwa.reload();
            }}
          >
            <span className="flex items-center gap-1.5">
              <RefreshIcon
                className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`}
              />
              {reloading ? t("update.reloading") : t("update.reload")}
            </span>
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={pwa.checking}
            aria-busy={pwa.checking}
            onClick={() => void check()}
          >
            <span className="flex items-center gap-1.5">
              {pwa.checking && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {t("update.check")}
            </span>
          </Button>
        )}
        {line && (
          <span className="text-sm text-fg" role="status">
            {line}
          </span>
        )}
      </div>
      <p className="text-xs leading-snug text-muted">{t("update.hint")}</p>
    </div>
  );
}
