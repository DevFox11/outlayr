export interface LogCurrencyOptionsInput {
	/** The ledger's own currency. Always offered, always first. */
	global: string;
	/** The user's favourites, in the order they arranged them. */
	favourites: readonly string[];
	/** Every currency the period on screen ended up expressed in. */
	produced: readonly string[];
	/**
	 * Whether a figure can actually be expressed in a code. Only favourites are
	 * tested: `global` is how a caller leaves an override, and `produced` is
	 * already on screen, so dropping either would strand the user. A favourite the
	 * rate table cannot reach is a different matter — offering it puts a code on
	 * the chip that the numbers beside it can never be in.
	 *
	 * Absent means every favourite is offered.
	 */
	convertible?: (code: string) => boolean;
}

/**
 * The codes the Log's currency chip offers, in the order it offers them.
 *
 * The ledger's own currency leads and is never absent, so the chip has an option
 * to show even on a single-currency ledger, and so a caller can read "the first
 * option" as "no override".
 *
 * Favourites follow, whether or not the period used any: they are the
 * currencies the user said they think in, and converting into one of them is
 * the point of the chip.
 *
 * What the period produced is appended last, because a currency already on
 * screen has to be selectable — otherwise the one figure the user can see is
 * the one they cannot read the rest of the screen in. Nothing here is checked
 * against the currency catalogue: a period can produce a code the catalogue has
 * since retired, and dropping it would strand those entries.
 */
export function logCurrencyOptions({
	global,
	favourites,
	produced,
	convertible,
}: LogCurrencyOptionsInput): string[] {
	const reachable = convertible
		? favourites.filter((code) => convertible(code.trim()))
		: favourites;
	const options: string[] = [];
	const seen = new Set<string>();
	for (const raw of [global, ...reachable, ...produced]) {
		const code = raw.trim();
		// Cased comparison only for the duplicate check: the code itself is passed
		// through as the data spells it, since it is also what a rate lookup and a
		// figures label are matched against.
		const key = code.toUpperCase();
		if (!key || seen.has(key)) {
			continue;
		}
		seen.add(key);
		options.push(code);
	}
	return options;
}
