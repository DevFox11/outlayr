import type { ReactNode } from "react";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { IntlayerProvider } from "react-native-intlayer";

import { CATALOGS, EN, type TranslatableKey } from "./catalog";
import {
	deviceLanguageTag,
	persistLanguagePreference,
	readLanguagePreference,
} from "./language-storage";
import {
	type Language,
	type LanguagePreference,
	resolveLanguage,
} from "./languages";
import { setRuntimeLanguage } from "./runtime";
import { type TranslationParams, translate } from "./translate";

export type TranslateFn = (
	key: TranslatableKey,
	params?: TranslationParams,
) => string;

interface LanguageContextValue {
	language: Language;
	preference: LanguagePreference;
	/** False until the persisted preference has been read and applied. */
	isHydrated: boolean;
	setPreference: (preference: LanguagePreference) => void;
	t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
	undefined,
);

/**
 * Owns the preference because Intlayer's React Native locale storage is an
 * in-memory stub — its own polyfill notes a locale set through it survives a
 * hot reload but not a restart. `IntlayerProvider` is nested below so
 * `useIntlayer`/`useLocale` stay available and read the same locale.
 */

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [preference, setPreferenceState] =
		useState<LanguagePreference>("system");
	const [isHydrated, setIsHydrated] = useState(false);
	const [deviceTag] = useState(deviceLanguageTag);

	// The root layout holds the splash on `isHydrated`, so a Spanish user never
	// sees a frame of English. `readLanguagePreference` swallows its own
	// failures, so this always settles.
	useEffect(() => {
		let cancelled = false;
		readLanguagePreference().then((stored) => {
			if (!cancelled) {
				setPreferenceState(stored);
				setIsHydrated(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const setPreference = useCallback((next: LanguagePreference) => {
		setPreferenceState(next);
		persistLanguagePreference(next);
	}, []);

	const language = resolveLanguage(preference, deviceTag);
	setRuntimeLanguage(language);

	const t = useCallback<TranslateFn>(
		(key, params) =>
			translate(key, {
				catalog: CATALOGS[language] ?? EN,
				fallback: EN,
				params,
			}),
		[language],
	);

	const value = useMemo(
		() => ({ language, preference, isHydrated, setPreference, t }),
		[language, preference, isHydrated, setPreference, t],
	);

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
	const { language, preference, setPreference } = useLanguageContext();
	return { language, preference, setPreference };
}

export function useLanguageReady(): boolean {
	return useLanguageContext().isHydrated;
}
