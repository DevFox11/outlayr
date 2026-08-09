import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";

/** Symbol → the currencies that use it. */
const BY_SYMBOL = new Map<string, string[]>();
for (const code of PICKABLE_CURRENCY_CODES) {
	const { symbol } = CURRENCY_META[code];
	const existing = BY_SYMBOL.get(symbol);
	if (existing) {
		existing.push(code);
	} else {
		BY_SYMBOL.set(symbol, [code]);
	}
}

const CODES = new Set<string>(PICKABLE_CURRENCY_CODES);

/**
 * Reads the currency out of a formatted amount, e.g. "€12,40" → "EUR".
 *
 * Returns null when the text does not identify exactly ONE currency — a bare
 * "$12.40" is shared by USD, CAD, AUD, MXN and more. Callers read null as "fall
 * back to the global currency", which is what `transactionsRepo.create` does.
 */
export function detectCurrency(text: string | null | undefined): string | null {
	if (!text) {
		return null;
	}

	// An explicit ISO code wins outright — it is the one form that cannot be
	// ambiguous, and it must be checked before symbols because a few currencies
	// use their code as their symbol (AED, and others).
	for (const token of text.toUpperCase().match(/[A-Z]{3}/g) ?? []) {
		if (CODES.has(token)) {
			return token;
		}
	}

	// Whatever is left once the number is removed is the symbol.
	const symbol = text
		.replace(/[\d.,\s  ]/g, "")
		.replace(/^[-+]|[-+]$/g, "")
		.trim();
	if (!symbol) {
		return null;
	}

	const matches = BY_SYMBOL.get(symbol);
	return matches?.length === 1 ? matches[0] : null;
}
