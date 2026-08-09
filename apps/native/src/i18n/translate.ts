export type Catalog = Readonly<Record<string, string>>;

export type TranslationParams = Readonly<Record<string, string | number | null | undefined>>;

interface TranslateOptions {
	catalog: Catalog;
	fallback: Catalog;
	params?: TranslationParams;
}

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, params: TranslationParams | undefined): string {
	if (!params) {
		return template;
	}
	// `null` renders empty — it is a value the caller does have and knows is
	// absent. `undefined` means the param was never passed, so the placeholder
	// stays visible rather than silently swallowing a wiring mistake.
	return template.replace(PLACEHOLDER, (match, name: string) => {
		const value = params[name];
		if (value === undefined) {
			return match;
		}
		return value === null ? "" : String(value);
	});
}

/**
 * English and Spanish share a one/other split, so the form is chosen by hand
 * rather than through `Intl.PluralRules` — Hermes ships no ICU plural data, and
 * `CURRENCY_META` already exists for the same reason.
 */
function pluralSuffix(count: number): "_one" | "_other" {
	return count === 1 ? "_one" : "_other";
}

function lookup(key: string, catalog: Catalog, fallback: Catalog) {
	return catalog[key] ?? fallback[key];
}

export function translate(key: string, { catalog, fallback, params }: TranslateOptions): string {
	const count = params?.count;
	if (typeof count === "number") {
		const pluralised = `${key}${pluralSuffix(count)}`;
		const form = lookup(pluralised, catalog, fallback);
		if (form !== undefined) {
			return interpolate(form, params);
		}
	}
	const template = lookup(key, catalog, fallback);
	return template === undefined ? key : interpolate(template, params);
}
