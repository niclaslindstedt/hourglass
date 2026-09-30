// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  SegmentedControl,
  Section,
  ToggleRow,
  CogIcon,
  InfoIcon,
  PaletteIcon,
  ScrollTextIcon,
} from "@niclaslindstedt/oss-framework/components";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import type { PwaUpdate } from "@niclaslindstedt/oss-framework/pwa";

import { HourglassPicker, Labelled } from "./HourglassPicker.tsx";
import { AppMarkIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { logStore } from "./log.ts";
import { SKY_CHOICES } from "./sky.ts";
import { DURATIONS, splitMinutes } from "./timer.ts";
import { UpdateCheck } from "./UpdateCheck.tsx";
import type { AppSettings, ThemeChoice } from "./useAppSettings.ts";

// One scrolling page: a handful of groups, and paging between tabs to find
// one toggle costs more than scrolling past it. The screen owns no state
// of its own — every knob reads and writes the caller's settings store, so
// what is on screen is always what is persisted.

type Props = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** Ask for the motion sensors, from the tap that turns them on. */
  onAskMotion?: () => void;
  /** The update lifecycle, for About's "Check for updates". */
  pwa: PwaUpdate;
};

export function SettingsScreen({ settings, update, onAskMotion, pwa }: Props) {
  const t = useT();
  const length = (m: number) => {
    const { hours, minutes } = splitMinutes(m);
    return hours === 0
      ? t("timer.minutes", { n: String(minutes) })
      : minutes === 0
        ? t("timer.hours", { n: String(hours) })
        : t("timer.hoursMinutes", { h: String(hours), m: String(minutes) });
  };

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <Section
        title={t("settings.appearance")}
        icon={<PaletteIcon className="h-3.5 w-3.5" />}
      >
        <SegmentedControl<ThemeChoice>
          value={settings.theme}
          options={[
            { value: "light", label: t("settings.themeLight") },
            { value: "dark", label: t("settings.themeDark") },
            { value: "system", label: t("settings.themeSystem") },
          ]}
          onChange={(theme) => update("theme", theme)}
          ariaLabel={t("settings.theme")}
          fullWidth
        />
      </Section>

      <Section
        title={t("settings.glass")}
        icon={<AppMarkIcon className="h-3.5 w-3.5" />}
      >
        <p className="text-xs text-muted">{t("settings.glassHint")}</p>
        <HourglassPicker
          preset={settings.preset}
          custom={settings.custom}
          onPreset={(next) => update("preset", next)}
          onCustom={(next) => update("custom", next)}
        />
      </Section>

      <Section
        title={t("settings.timer")}
        icon={<CogIcon className="h-3.5 w-3.5" />}
      >
        <p className="text-xs text-muted">{t("settings.timerHint")}</p>
        <Labelled label={t("settings.length")}>
          <div
            role="radiogroup"
            aria-label={t("settings.length")}
            className="flex flex-wrap gap-1.5"
          >
            {DURATIONS.map((m) => {
              const on = settings.minutes === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update("minutes", m)}
                  className={`min-h-8 rounded-full border px-3 text-sm tabular-nums transition-colors ${
                    on
                      ? "border-accent bg-accent/15 text-fg-bright"
                      : "border-line bg-surface-2 text-fg hover:bg-surface-1"
                  }`}
                >
                  {length(m)}
                </button>
              );
            })}
          </div>
        </Labelled>
        <ToggleRow
          label={t("settings.vibrate")}
          hint={t("settings.vibrateHint")}
          checked={settings.vibrate}
          onChange={(next) => update("vibrate", next)}
        />
        <ToggleRow
          label={t("settings.awake")}
          hint={t("settings.awakeHint")}
          checked={settings.awake}
          onChange={(next) => update("awake", next)}
        />
        <ToggleRow
          label={t("settings.sensor")}
          hint={t("settings.sensorHint")}
          checked={settings.sensor}
          onChange={(next) => {
            update("sensor", next);
            // A toggle is a tap: on iOS, the moment to ask for the sensors.
            if (next) onAskMotion?.();
          }}
        />
        <ToggleRow
          label={t("settings.haptics")}
          hint={t("settings.hapticsHint")}
          checked={settings.haptics}
          onChange={(next) => update("haptics", next)}
        />
      </Section>

      <Section
        title={t("settings.sky")}
        icon={<CogIcon className="h-3.5 w-3.5" />}
      >
        <p className="text-xs text-muted">{t("settings.skyHint")}</p>
        <div
          role="radiogroup"
          aria-label={t("settings.sky")}
          className="flex flex-wrap gap-1.5"
        >
          {SKY_CHOICES.map((choice) => {
            const on = settings.sky === choice;
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update("sky", choice)}
                className={`min-h-8 rounded-full border px-3 text-sm transition-colors ${
                  on
                    ? "border-accent bg-accent/15 text-fg-bright"
                    : "border-line bg-surface-2 text-fg hover:bg-surface-1"
                }`}
              >
                {t(`settings.skies.${choice}`)}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title={t("settings.developer")}
        icon={<ScrollTextIcon className="h-3.5 w-3.5" />}
      >
        <ToggleRow
          label={t("settings.devMode")}
          hint={t("settings.devModeHint")}
          checked={settings.devMode}
          onChange={(next) => update("devMode", next)}
        />
        {settings.devMode && (
          <>
            <ToggleRow
              label={t("settings.captureLogs")}
              hint={t("settings.captureLogsHint")}
              checked={settings.captureLogs}
              onChange={(next) => {
                update("captureLogs", next);
                logStore.setCaptureEnabled(next);
              }}
            />
            <div className="max-h-64 overflow-auto rounded-md border border-line p-2">
              <LogViewer store={logStore} />
            </div>
          </>
        )}
      </Section>

      <Section
        title={t("settings.about")}
        icon={<InfoIcon className="h-3.5 w-3.5" />}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">{t("settings.version")}</dt>
          <dd className="text-fg">{__APP_VERSION__}</dd>
          <dt className="text-muted">{t("settings.build")}</dt>
          <dd className="text-fg">{__BUILD_LABEL__}</dd>
        </dl>
        {!__SHELL_BUILD__ && <UpdateCheck pwa={pwa} />}
        <p className="text-xs leading-snug text-muted">
          {t("settings.privacy")}
        </p>
      </Section>
    </div>
  );
}
