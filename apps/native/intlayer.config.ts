import { type IntlayerConfig, Locales } from "intlayer";

/**
 * Plain `es`, not `es-419`: the Swift catalogue this content is ported from is
 * keyed `es-419`, but a device reports `es-MX`/`es-AR`/`es-419` interchangeably
 * and every one of them should land on the same strings.
 */
const config: IntlayerConfig = {
	content: {
		contentDir: ["src/content"],
	},
	internationalization: {
		defaultLocale: Locales.ENGLISH,
		locales: [Locales.ENGLISH, Locales.SPANISH],
		requiredLocales: [Locales.ENGLISH, Locales.SPANISH],
		// `t` must carry every locale rather than warning and falling back, so a
		// half-translated key fails the build instead of reaching a device in
		// English.
		strictMode: "strict",
	},
};

export default config;
