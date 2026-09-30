// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CogIcon,
  SpinnerIcon,
  ToastViewport,
  createToastStore,
} from "@niclaslindstedt/oss-framework/components";
import { UpdateToast, usePwaUpdate } from "@niclaslindstedt/oss-framework/pwa";
import { useApplyTheme } from "@niclaslindstedt/oss-framework/theme";

import { DEMO, demoRun, demoSettings } from "./app/dev/demo.ts";
import { Hourglass } from "./app/Hourglass.tsx";
import { useT } from "./app/i18n/index.ts";
import { logStore } from "./app/log.ts";
import { appearanceFor, resolveLook } from "./app/look.ts";
import { cacheIdForBase } from "./app/pwa.ts";
import { SettingsScreen } from "./app/SettingsScreen.tsx";
import { SidePanel } from "./app/SidePanel.tsx";
import { newRun, type Run } from "./app/timer.ts";
import { TopBar } from "./app/TopBar.tsx";
import { useAppSettings, type AppSettings } from "./app/useAppSettings.ts";
import {
  motionNeedsPermission,
  requestMotion,
  useMotion,
} from "./app/useMotion.ts";
import { useRun } from "./app/useRun.ts";
import { useDesk } from "./app/useShape.ts";
import { status } from "./output.ts";

// An hourglass, built from the framework's shared surface. The app owns
// the glass, the sand and the timer; the framework supplies the theme
// engine, the settings controls and the PWA update lifecycle.
//
// One screen: the glass, with a cog floating in its corner. On a phone the
// cog opens Settings as a screen over it; on a desk (`useDesk`) Settings
// slides in over the right-hand edge, so the glass in the middle changes
// as a frame or a sand is picked.

// Module-scoped so the identity stays stable across renders (the framework's
// `useToasts` keys its subscription on the store object).
const toasts = createToastStore();

export function App() {
  const t = useT();
  const stored = useAppSettings();
  // The demo holds its own settings in memory, so nothing on the device is
  // read or written while it shows.
  const [demo, setDemo] = useState<AppSettings>(demoSettings);
  const settings = DEMO ? demo : stored.settings;
  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (DEMO) setDemo((prev) => ({ ...prev, [key]: value }));
      else stored.update(key, value);
    },
    [stored],
  );
  useApplyTheme(useMemo(() => appearanceFor(settings.theme), [settings.theme]));

  const persisted = useRun(settings.minutes);
  const [demoRunState, setDemoRun] = useState<Run>(() => demoRun(Date.now()));
  const run = DEMO ? demoRunState : persisted.run;
  const turnNow = useCallback(() => {
    if (DEMO)
      setDemoRun((prev) => ({
        ...prev,
        fraction: 1 - prev.fraction,
        startedAt: Date.now(),
      }));
    else persisted.turnNow();
  }, [persisted]);
  const setRun = useCallback(
    (next: Run) => {
      if (DEMO) setDemoRun(next);
      else persisted.setRun(next);
    },
    [persisted],
  );
  const setMinutes = useCallback(
    (minutes: number) => {
      update("minutes", minutes);
      if (DEMO) setDemoRun(newRun(minutes));
    },
    [update],
  );
  const look = useMemo(
    () => resolveLook(settings.preset, settings.custom),
    [settings.preset, settings.custom],
  );

  // Which way up the phone is. On iOS the sensor has to be asked for from
  // a tap, so the first press on the glass asks; until it is granted the
  // glass is turned by tapping alone.
  const [granted, setGranted] = useState(() => !motionNeedsPermission());
  const motion = useMotion(settings.sensor && granted);
  const askMotion = useCallback(() => {
    if (!settings.sensor || granted) return;
    void requestMotion().then((ok) => {
      if (ok) setGranted(true);
    });
  }, [settings.sensor, granted]);

  const desk = useDesk();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSettings = useCallback(
    () => setSettingsOpen((open) => !open),
    [],
  );
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => {
    logStore.setCaptureEnabled(settings.captureLogs);
  }, [settings.captureLogs]);

  // The sand has run out: a buzz, where the device can and the setting
  // allows, and the run laid to rest.
  const onDone = useCallback(() => {
    persisted.finish();
    if (settings.vibrate && "vibrate" in navigator) {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch {
        // A device that will not.
      }
    }
    toasts.clear();
    toasts.push({
      message: t("timer.done"),
      kind: "success",
      durationMs: 4000,
    });
  }, [persisted, settings.vibrate, t]);

  // The screen stays on while the sand runs, where the setting allows and
  // the browser has a wake lock to give. Released when the run ends — a run
  // with a clock on it is running until `onDone` lays it to rest — or the
  // tab is hidden, which the browser does itself.
  const running = run.startedAt !== null;
  useEffect(() => {
    if (!running || !settings.awake) return;
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: {
          request: (
            kind: "screen",
          ) => Promise<{ release: () => Promise<void> }>;
        };
      }
    ).wakeLock;
    if (!wakeLock) return;
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    const take = () => {
      if (document.hidden) return;
      void wakeLock
        .request("screen")
        .then((l) => {
          if (gone) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, [running, settings.awake, run.startedAt]);

  const [reloading, setReloading] = useState(false);
  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV && !__SHELL_BUILD__,
  });
  useEffect(() => {
    if (pwa.needRefresh) status(`Update ready: ${pwa.incomingVersion ?? "?"}`);
  }, [pwa.needRefresh, pwa.incomingVersion]);

  const settingsScreen = <SettingsScreen settings={settings} update={update} />;
  const phoneSettings = !desk && settingsOpen;

  return (
    <div className="flex h-full flex-col bg-page text-fg">
      {phoneSettings && <TopBar onBack={closeSettings} />}

      <main className="app-main relative min-h-0 flex-1 overflow-clip">
        {phoneSettings ? (
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <div className="app-screen mx-auto flex min-h-full max-w-2xl flex-col">
              {settingsScreen}
            </div>
          </div>
        ) : (
          <div className="app-bare flex h-full flex-col">
            <Hourglass
              look={look}
              run={run}
              motion={motion}
              onPress={askMotion}
              onTurn={turnNow}
              onRun={setRun}
              onMinutes={setMinutes}
              onDone={onDone}
              className="min-h-0 flex-1"
            />
            {/* The cog, floating in the corner: Settings is a thing you do
                and leave, so it is a button rather than a place. On the
                desk it is lit while the panel is open, and closes it. */}
            <button
              type="button"
              onClick={toggleSettings}
              aria-label={t("nav.settings")}
              aria-expanded={desk ? settingsOpen : undefined}
              title={t("nav.settings")}
              className={`app-cog absolute z-40 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg ${
                desk && settingsOpen ? "bg-accent/15 text-accent" : ""
              }`}
            >
              <CogIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {desk && settingsOpen && (
          <SidePanel title={t("nav.settings")} onClose={closeSettings}>
            {settingsScreen}
          </SidePanel>
        )}
      </main>

      <div className="app-update-slot relative z-[60]">
        {pwa.needRefresh && reloading ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-3 bottom-3 mx-auto flex max-w-md items-center gap-3 rounded-sm border border-line bg-surface px-3 py-2.5 text-fg shadow-md"
          >
            <SpinnerIcon className="h-5 w-5 animate-spin text-accent" />
            <span className="text-sm font-medium">{t("update.reload")}</span>
          </div>
        ) : (
          <UpdateToast
            needRefresh={pwa.needRefresh}
            incomingVersion={pwa.incomingVersion}
            onReload={() => {
              setReloading(true);
              pwa.reload();
            }}
            onDismiss={() => pwa.dismiss()}
            labels={{
              ready: t("update.available"),
              action: t("update.reload"),
              dismiss: t("common.close"),
            }}
          />
        )}
      </div>

      {/* Top, not the framework's default bottom: the bottom of the screen
          is where a thumb rests on the glass. */}
      <ToastViewport
        store={toasts}
        labels={{ dismiss: t("common.close") }}
        className="app-toasts pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      />
    </div>
  );
}
