export const FALLBACK_IDENTITY_COLOR = "#767676";

export interface TransactionIdentitySource {
	icon: string | null;
	emoji: string | null;
	customColor: string | null;
	imageColor: string | null;
	categoryIcon: string | null;
	categoryEmoji: string | null;
	categoryColor: string | null;
}

export interface TransactionIdentity {
	icon: string | null;
	emoji: string | null;
	color: string;
}

function present(value: string | null | undefined): string | null {
	return value != null && value !== "" ? value : null;
}

const NO_SYMBOL = { icon: null, emoji: null } as const;

/** Storage is icon XOR emoji, so exactly one side of the pair survives. */
function symbol(
	icon: string | null | undefined,
	emoji: string | null | undefined,
): Pick<TransactionIdentity, "icon" | "emoji"> | null {
	const resolvedIcon = present(icon);
	if (resolvedIcon != null) {
		return { icon: resolvedIcon, emoji: null };
	}
	const resolvedEmoji = present(emoji);
	if (resolvedEmoji != null) {
		return { icon: null, emoji: resolvedEmoji };
	}
	return null;
}

/**
 * Ports Swift's `Transaction.effectiveColor` and `displaySymbol`
 * (`apps/ios/app/Core/Persistence/TransactionExtensions.swift:36-75`).
 *
 * The symbol falls through as a **pair**, not field by field: resolving icon and
 * emoji independently lets an emoji-only transaction claim its own emoji and the
 * *category's* icon at the same time, and the tile then paints the icon — an
 * identity the user never chose. A transaction that names either one owns the
 * whole symbol.
 */
export function resolveTransactionIdentity(
	source: TransactionIdentitySource,
): TransactionIdentity {
	const resolved =
		symbol(source.icon, source.emoji) ??
		symbol(source.categoryIcon, source.categoryEmoji) ??
		NO_SYMBOL;
	return {
		...resolved,
		color:
			present(source.customColor) ??
			present(source.imageColor) ??
			present(source.categoryColor) ??
			FALLBACK_IDENTITY_COLOR,
	};
}
