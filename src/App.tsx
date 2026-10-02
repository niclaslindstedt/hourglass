// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CogIcon } from "@niclaslindstedt/oss-framework/components";
import { usePwaUpdate } from "@niclaslindstedt/oss-framework/pwa";
import { useApplyTheme } from "@niclaslindstedt/oss-framework/theme";

import { placeOfZone } from "./app/astronomy.ts";
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
import { UpdateGlyph } from "./app/UpdateGlyph.tsx";
import { useUpright } from "./app/upright.ts";
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

/** How long the cog takes to fade out of one corner, before it fades into
 *  the other — `.app-cog`'s opacity transition in `styles.css`. Slow and
 *  soft, so the move is barely noticed. */
const CORNER_FADE_MS = 650;

export function App() {
  const t = useT();
  // The page never turns with the screen: the phone is the glass.
  useUpright();
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
  const setZoom = useCallback((zoom: number) => update("zoom", zoom), [update]);
  const look = useMemo(
    () => resolveLook(settings.preset, settings.custom),
    [settings.preset, settings.custom],
  );

  // Which way up the phone is, how it leans and how it is shaken. The
  // listeners are on whenever the setting is: a phone that granted the
  // sensors before reports at once. On iOS they have to be asked for from
  // the end of a tap, so a tap on the glass (or turning the setting on)
  // asks, until a reading has come; until then the glass is turned by
  // tapping alone.
  const motion = useMotion(settings.sensor);
  const asking = useRef(false);
  const askMotion = () => {
    if (!settings.sensor || !motionNeedsPermission()) return;
    if (motion.current.heard || asking.current) return;
    asking.current = true;
    void requestMotion().finally(() => {
      asking.current = false;
    });
  };

  // The phone turned over: the cog fades out of the corner that is now the
  // bottom and back in at the one that is now the top, so it is always
  // where a thumb looks for it — and nothing else on the screen turns.
  const [upside, setUpside] = useState(false);
  const [cogShown, setCogShown] = useState(true);
  const [cogUpside, setCogUpside] = useState(false);
  useEffect(
    () =>
      motion.subscribe(() => {
        const next = motion.current.gravity === -1;
        setUpside((was) => (was === next ? was : next));
      }),
    [motion],
  );
  useEffect(() => {
    if (upside === cogUpside) return;
    setCogShown(false);
    const id = window.setTimeout(() => {
      setCogUpside(upside);
      setCogShown(true);
    }, CORNER_FADE_MS);
    return () => window.clearTimeout(id);
  }, [upside, cogUpside]);

  // Where the device is, for the sun and the moon: the place its time zone
  // is named for (`zones.ts`) — no permission asked, nothing sent.
  const place = useMemo(() => {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      zone = undefined;
    }
    return placeOfZone(zone, -new Date().getTimezoneOffset());
  }, []);

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
  // allows, and the run laid to rest. No notice over the glass — the empty
  // bulb says it, the way a real one does.
  const onDone = useCallback(() => {
    persisted.finish();
    if (settings.vibrate && "vibrate" in navigator) {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch {
        // A device that will not.
      }
    }
  }, [persisted, settings.vibrate]);

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

  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV && !__SHELL_BUILD__,
  });
  useEffect(() => {
    if (pwa.needRefresh) status(`Update ready: ${pwa.incomingVersion ?? "?"}`);
  }, [pwa.needRefresh, pwa.incomingVersion]);

  const settingsScreen = (
    <SettingsScreen
      settings={settings}
      update={update}
      onAskMotion={askMotion}
      pwa={pwa}
    />
  );
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
              zoom={settings.zoom}
              motion={motion}
              sky={settings.sky}
              place={place}
              haptics={settings.haptics}
              onPress={askMotion}
              onRun={setRun}
              onMinutes={setMinutes}
              onZoom={setZoom}
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
              className={`app-cog absolute z-40 flex h-10 w-10 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white ${
                cogUpside ? "app-cog-upside rotate-180" : ""
              } ${cogShown ? "opacity-100" : "pointer-events-none opacity-0"} ${
                desk && settingsOpen ? "bg-accent/15 text-accent" : ""
              }`}
            >
              <CogIcon className="h-5 w-5" />
            </button>
            {/* A new version, beside the cog and turning with it — a glyph,
                not a banner over the glass. */}
            <UpdateGlyph
              ready={pwa.needRefresh}
              upside={cogUpside}
              shown={cogShown}
              onReload={pwa.reload}
            />
          </div>
        )}

        {desk && settingsOpen && (
          <SidePanel title={t("nav.settings")} onClose={closeSettings}>
            {settingsScreen}
          </SidePanel>
        )}
      </main>
    </div>
  );
}
