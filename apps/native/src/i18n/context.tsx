import type { ReactNode } from "react";
import { createContext, use, useCallback, useMemo } from "react";
import { IntlayerProvider } from "react-native-intlayer";

import { CATALOGS, EN, type TranslatableKey } from "./catalog";
import { useDeviceLanguageTag } from "./device-language";
import { type Language, resolveLanguage } from "./languages";
import { setRuntimeLanguage } from "./runtime";
import { type TranslationParams, translate } from "./translate";

export type TranslateFn = (key: TranslatableKey, params?: TranslationParams) => string;

interface LanguageContextValue {
	language: Language;
	t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/**
 * The language is the device's, always: iOS owns it per app under
 * Settings › Outlayr › Language, so there is nothing here to store or restore.
 * `IntlayerProvider` is nested below so `useIntlayer`/`useLocale` stay available
 * and read the same locale.
 */

export function LanguageProvider({ children }: { children: ReactNode }) {
	// Read synchronously, so the first frame is already in the right language —
	// there is no stored preference left to await.
	const language = resolveLanguage(useDeviceLanguageTag());
	// Deliberately during render, not in an effect: `runtimeLanguage()` is the
	// default argument of the date, budget and insights formatters, so children
	// read it while rendering and an effect would hand them the previous
	// language for a frame. Removing the global is the real fix — see
	// `use-insights.ts`, which already threads the language explicitly instead.
	setRuntimeLanguage(language);

	const t = useCallback<TranslateFn>(
		(key, params) =>
			translate(key, {
				catalog: CATALOGS[language] ?? EN,
				fallback: EN,
				params,
			}),
		[language]
	);

	const value = useMemo(() => ({ language, t }), [language, t]);

	return (
		<LanguageContext.Provider value={value}>
			<IntlayerProvider locale={language}>{children}</IntlayerProvider>
		</LanguageContext.Provider>
	);
}

function useLanguageContext(): LanguageContextValue {
	const context = use(LanguageContext);
	if (!context) {
		throw new Error("useTranslation must be used within LanguageProvider");
	}
	return context;
}

export function useTranslation(): TranslateFn {
	return useLanguageContext().t;
}

export function useLanguage() {
	const { language } = useLanguageContext();
	return { language };
}
