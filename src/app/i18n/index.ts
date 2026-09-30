// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's i18n runtime, built once from the framework's `createI18n`
// factory over the app's own catalog. English is the only language today;
// adding a second is one `loaders` entry plus one translated file.

import { createI18n } from "@niclaslindstedt/oss-framework/i18n";

import { en, type Catalog } from "./en.ts";

export type Lang = "en";
export type { Catalog };

export const i18n = createI18n<Lang, Catalog>({
  fallbackLang: "en",
  fallbackCatalog: en,
  toBcp47: () => "en-US",
  storageKey: "hourglass:language",
  eventName: "hourglass:language",
});

export const { LanguageRoot, useT, useLang, setLanguage, supportedLangs } =
  i18n;

export type TFn = ReturnType<typeof useT>;
