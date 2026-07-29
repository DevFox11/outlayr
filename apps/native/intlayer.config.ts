import { type IntlayerConfig, Locales } from "intlayer";

/**
 * Plain `es`, not `es-419`: the Swift catalogue this content is ported from is
 * keyed `es-419`, but a device reports `es-MX`/`es-AR`/`es-419` interchangeably
 * and every one of them should land on the same strings.
 */
const config: IntlayerConfig = {
	internationalization: {
		locales: [Locales.ENGLISH, Locales.SPANISH],
		defaultLocale: Locales.ENGLISH,
	},
	content: {
		// `src/app` is the expo-router routes directory — a `.content.ts` file
		// under it would be crawled as a route.
		contentDir: ["src/content"],
	},
};

export default config;
