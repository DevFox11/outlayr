import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { isFavourite } from "./favourite-currencies";

export type CurrencyCode = (typeof PICKABLE_CURRENCY_CODES)[number];

export type CurrencyPickerRow =
	| { kind: "header"; key: string; section: "favourites" | "all" }
	| { kind: "hint"; key: string }
	| {
			kind: "currency";
			key: string;
			code: CurrencyCode;
			favourite: boolean;
	  };

const BY_CODE: ReadonlyMap<string, CurrencyCode> = new Map(
	PICKABLE_CURRENCY_CODES.map((code): [string, CurrencyCode] => [code, code]),
);

function currencyRow(
	code: CurrencyCode,
	favourite: boolean,
): CurrencyPickerRow {
	return { kind: "currency", key: code, code, favourite };
}

/**
 * The rows the currency sheet draws, in order.
 *
 * A favourite appears in the cluster and NOWHERE else. The catalogue pins its
 * two suggested codes above its own alphabet, so a cluster that repeated its
 * codes drew them immediately above themselves — two identical rows, no
 * separator between the sections, which reads as a duplication bug rather than
 * as a shortcut. Lifting them out costs the alphabet two holes and buys back a
 * list where every code is written once.
 *
 * A search returns flat: clustering on top of it would push the match the user
 * typed below the fold.
 *
 * An empty cluster keeps its header and a hint row: favouriting is a long
 * press, which nothing on a row advertises.
 */
export function currencyPickerRows(
	favourites: readonly string[],
	query: string,
): CurrencyPickerRow[] {
	const needle = query.trim().toLowerCase();
	const matches =
		needle === ""
			? PICKABLE_CURRENCY_CODES
			: PICKABLE_CURRENCY_CODES.filter(
					(code) =>
						code.toLowerCase().includes(needle) ||
						CURRENCY_META[code].name.toLowerCase().includes(needle),
				);

	if (needle !== "") {
		return matches.map((code) =>
			currencyRow(code, isFavourite(favourites, code)),
		);
	}

	const cluster = favourites.flatMap((favourite) => {
		const code = BY_CODE.get(favourite);
		return code === undefined ? [] : [currencyRow(code, true)];
	});
	if (cluster.length === 0) {
		return [
			{ kind: "header", key: "header:favourites", section: "favourites" },
			{ kind: "hint", key: "hint:favourites" },
			{ kind: "header", key: "header:all", section: "all" },
			...matches.map((code) => currencyRow(code, false)),
		];
	}

	const rest = matches
		.filter((code) => !isFavourite(favourites, code))
		.map((code) => currencyRow(code, false));

	return [
		{ kind: "header", key: "header:favourites", section: "favourites" },
		...cluster,
		{ kind: "header", key: "header:all", section: "all" },
		...rest,
	];
}
