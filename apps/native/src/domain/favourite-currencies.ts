import { PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";

const CATALOGUE: ReadonlySet<string> = new Set(PICKABLE_CURRENCY_CODES);

/** Past a screenful the cluster stops being a shortcut and becomes a list. */
export const FAVOURITE_CURRENCY_LIMIT = 8;

/**
 * The two the cluster always starts with. Neither is a guess about the user: USD
 * is the canonical side of every stored rate, and between them they price most
 * of what a traveller or a remote worker is paid in.
 */
const SEEDED = ["USD", "EUR"] as const;

/**
 * Codes a device reports that the catalogue prices under another name.
 *
 * iOS names Venezuela's currency `VED`, the 2021 redenomination. Rates are still
 * quoted in `VES`, which is what the catalogue therefore carries — so a device in
 * Caracas would otherwise detect a currency this app has never heard of and seed
 * nothing. Same currency, two ISO codes.
 */
const ALIASES: Readonly<Record<string, string>> = { VED: "VES" };

/**
 * The cluster a ledger is created with, so the picker opens with somewhere to
 * start rather than a hint about a gesture.
 *
 * `detected` is the device's own currency and is appended rather than leading:
 * the ledger's currency is chosen a screen later and leads the picker on its own,
 * so putting it first here would only say the same thing twice. A code the
 * catalogue does not know — or no locale at all — leaves the pair untouched.
 */
export function seedFavourites(detected: string | null): string[] {
	const seeded: string[] = [...SEEDED];
	if (detected === null) {
		return seeded;
	}
	const named = normalise(detected);
	const code = ALIASES[named] ?? named;
	if (CATALOGUE.has(code) && !seeded.includes(code)) {
		seeded.push(code);
	}
	return seeded;
}

function normalise(code: string): string {
	return code.trim().toUpperCase();
}

/**
 * Reads the stored comma-separated code list. Favourites live in raw `appMeta`
 * rather than as a setting because `SETTING_DEFAULTS` admits only booleans and
 * numbers — there is no string-setting mechanism to hang them on.
 *
 * A code the catalogue does not know is dropped rather than kept, so a currency
 * retired from the catalogue cannot survive in a stored list and reach a screen
 * that would then have no name or symbol to draw for it.
 */
export function parseFavourites(raw: string | null): string[] {
	if (!raw) {
		return [];
	}

	const favourites: string[] = [];
	for (const part of raw.split(",")) {
		const code = normalise(part);
		if (!CATALOGUE.has(code) || favourites.includes(code)) {
			continue;
		}
		favourites.push(code);
		if (favourites.length === FAVOURITE_CURRENCY_LIMIT) {
			break;
		}
	}
	return favourites;
}

export function serialiseFavourites(codes: readonly string[]): string {
	return codes.join(",");
}

export function isFavourite(codes: readonly string[], code: string): boolean {
	const wanted = normalise(code);
	return codes.some((favourite) => normalise(favourite) === wanted);
}

/**
 * Adding past the limit is refused rather than evicting the oldest favourite:
 * the user picked those eight deliberately, so dropping one for them would be
 * the surprising move. Removal is never refused — that is the way out.
 */
export function toggleFavourite(codes: readonly string[], code: string): string[] {
	const wanted = normalise(code);
	if (isFavourite(codes, wanted)) {
		return codes.filter((favourite) => normalise(favourite) !== wanted);
	}
	if (codes.length >= FAVOURITE_CURRENCY_LIMIT || !CATALOGUE.has(wanted)) {
		return [...codes];
	}
	return [...codes, wanted];
}
