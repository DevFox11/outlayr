import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getIntlayer } from "intlayer";
import { CATALOGS, DICTIONARY_KEYS, EN, ES } from "./catalog";
import { SUPPORTED_LANGUAGES } from "./languages";
import { interpolate } from "./translate";

const PLACEHOLDER = /\{(\w+)\}/g;
const PLURAL_SUFFIX = /_(one|other)$/;

function placeholders(template: string): Set<string> {
	return new Set(
		Array.from(template.matchAll(PLACEHOLDER)).map(
			(match) => match[1] as string,
		),
	);
}

describe("catalog parity", () => {
	it("ships a catalog for every supported language", () => {
		for (const language of SUPPORTED_LANGUAGES) {
			assert.ok(CATALOGS[language], `no catalog for "${language}"`);
		}
	});

	it("translates every English key into Spanish", () => {
		const missing = Object.keys(EN).filter((key) => !(key in ES));
		assert.deepEqual(
			missing,
			[],
			`Spanish is missing ${missing.length} key(s); every new string needs both languages`,
		);
	});

	it("has no Spanish key without an English source", () => {
		const orphaned = Object.keys(ES).filter((key) => !(key in EN));
		assert.deepEqual(
			orphaned,
			[],
			`Spanish declares ${orphaned.length} key(s) English does not; English is the source of truth`,
		);
	});

	it("keeps each dictionary internally in parity", () => {
		for (const name of DICTIONARY_KEYS) {
			const en = Object.keys(getIntlayer(name, "en"));
			const es = Object.keys(getIntlayer(name, "es"));
			assert.deepEqual(
				en.filter((key) => !es.includes(key)),
				[],
				`content/${name}.content.ts: English keys with no Spanish translation`,
			);
			assert.deepEqual(
				es.filter((key) => !en.includes(key)),
				[],
				`content/${name}.content.ts: Spanish keys with no English source`,
			);
		}
	});

	it("declares every key in exactly one dictionary", () => {
		const seen = new Map<string, string>();
		for (const name of DICTIONARY_KEYS) {
			for (const key of Object.keys(getIntlayer(name, "en"))) {
				const owner = seen.get(key);
				assert.equal(
					owner,
					undefined,
					`"${key}" is declared in both content/${owner}.content.ts and content/${name}.content.ts; the flat map would silently keep one`,
				);
				seen.set(key, name);
			}
		}
	});

	it("uses the same placeholders in both languages", () => {
		for (const [key, english] of Object.entries(EN)) {
			const spanish = ES[key as keyof typeof ES];
			if (!spanish) {
				continue;
			}
			assert.deepEqual(
				[...placeholders(spanish)].sort(),
				[...placeholders(english)].sort(),
				`"${key}": a placeholder mismatch renders a literal "{token}" on screen`,
			);
		}
	});

	it("pairs every plural key with its counterpart form", () => {
		for (const catalogName of SUPPORTED_LANGUAGES) {
			const catalog = CATALOGS[catalogName];
			for (const key of Object.keys(catalog)) {
				const match = key.match(PLURAL_SUFFIX);
				if (!match) {
					continue;
				}
				const counterpart =
					match[1] === "one"
						? key.replace(PLURAL_SUFFIX, "_other")
						: key.replace(PLURAL_SUFFIX, "_one");
				assert.ok(
					counterpart in catalog,
					`${catalogName}: "${key}" has no "${counterpart}"; the missing form would fall through to English`,
				);
			}
		}
	});

	// Only the `_other` form: a singular may legitimately spell the number out
	// ("One purchase too many"), but a plural that never shows its count is a bug.
	it("interpolates a count into every plural form", () => {
		for (const catalogName of SUPPORTED_LANGUAGES) {
			const catalog = CATALOGS[catalogName];
			for (const [key, template] of Object.entries(catalog)) {
				if (!key.endsWith("_other")) {
					continue;
				}
				assert.ok(
					placeholders(template).has("count"),
					`${catalogName}: plural "${key}" never shows its count`,
				);
			}
		}
	});

	it("leaves no empty string in either catalog", () => {
		for (const catalogName of SUPPORTED_LANGUAGES) {
			for (const [key, value] of Object.entries(CATALOGS[catalogName])) {
				assert.ok(value.trim().length > 0, `${catalogName}: "${key}" is blank`);
			}
		}
	});

	it("renders every Spanish string without leaking a placeholder", () => {
		for (const [key, template] of Object.entries(ES)) {
			const params = Object.fromEntries(
				[...placeholders(template)].map((name) => [name, "x"]),
			);
			assert.ok(
				!interpolate(template, params).includes("{"),
				`"${key}" still holds an unresolved placeholder`,
			);
		}
	});
});
