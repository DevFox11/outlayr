import { getIntlayer } from "intlayer";
import alerts from "@/content/alerts.content";
import budgets from "@/content/budgets.content";
import categories from "@/content/categories.content";
import common from "@/content/common.content";
import domain from "@/content/domain.content";
import insights from "@/content/insights.content";
import language from "@/content/language.content";
import log from "@/content/log.content";
import onboarding from "@/content/onboarding.content";
import search from "@/content/search.content";
import settings from "@/content/settings.content";
import transaction from "@/content/transaction.content";
import type { Language } from "./languages";
import type { Catalog } from "./translate";

/**
 * Every dictionary Intlayer builds, so the flat map below and the parity guard
 * both enumerate the same set. Adding a `.content.ts` file means adding it here.
 */
export const DICTIONARIES = [
	alerts,
	budgets,
	categories,
	common,
	domain,
	insights,
	language,
	log,
	onboarding,
	search,
	settings,
	transaction,
] as const;

type Content = (typeof DICTIONARIES)[number]["content"];

/**
 * Keys stay fully qualified inside their dictionary (`log.empty.title` lives in
 * `log`), so one flat namespace types every call site and `t` needs no
 * dictionary argument.
 */
export type TranslationKey = keyof UnionToIntersection<Content>;

type UnionToIntersection<U> = (
	U extends unknown
		? (k: U) => void
		: never
) extends (k: infer I) => void
	? I
	: never;

type PluralStem<K extends string> = K extends `${infer Stem}_other`
	? Stem
	: never;

/**
 * What `t` accepts. A plural is called by its stem — `t("budgets.days",
 * { count })` — so the stem has to be nameable without existing as a key of its
 * own, or every plural would need a third, unrendered entry.
 */
export type TranslatableKey =
	| TranslationKey
	| PluralStem<TranslationKey & string>;

/** Flattens Intlayer's per-dictionary resolution into one lookup. */
export function catalogFor(locale: Language): Catalog {
	const flat: Record<string, string> = {};
	for (const dictionary of DICTIONARIES) {
		Object.assign(flat, getIntlayer(dictionary.key, locale));
	}
	return flat;
}

export const EN = catalogFor("en");
export const ES = catalogFor("es");

export const CATALOGS: Record<Language, Catalog> = { en: EN, es: ES };
