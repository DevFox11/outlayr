import { Fragment } from "react";
import { View } from "react-native";
import { type RowAmountLabelInput, rowAmountLabel } from "@/domain/amount-label";
import type { CurrencyBucket } from "@/domain/currency-totals";
import { amountDigits, amountParts, splitSymbol, withCurrencySymbol } from "@/domain/money";
import { useTranslation } from "@/i18n/context";
import { Text } from "./text";
import { cn, tv } from "./tw";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

interface HeroNumberProps {
	/** Signed magnitude; the sign shown is derived unless `sign` is given. */
	amount: number;
	code: string;
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
	sign?: "+" | "-" | "";
	size?: number;
	/** uniwind color class for the digits, e.g. "text-income". */
	toneClass?: string;
}

/** Nested `Text` baseline-aligns the parts without manual layout. */
export function HeroNumber({
	amount,
	code,
	sign,
	toneClass = "text-foreground",
	size = 40,
	showCents = true,
}: HeroNumberProps) {
	const parts = amountParts(amount, code, showCents);
	const resolvedSign = sign ?? (amount < 0 ? "-" : "+");
	const small = Math.round(size * 0.5);
	const { prefixSymbol, suffixSymbol } = splitSymbol(parts);
	return (
		<Text
			adjustsFontSizeToFit
			className={cn("font-sans tracking-hero", toneClass)}
			numberOfLines={1}
			style={[TABULAR, { fontSize: size }]}
		>
			<Text className="font-sans text-muted" style={{ fontSize: small }}>
				{resolvedSign}
				{prefixSymbol}
			</Text>
			{parts.integer}
			{parts.fraction ? (
				<Text className="font-sans text-muted" style={{ fontSize: small }}>
					{parts.locale.decimal}
					{parts.fraction}
				</Text>
			) : null}
			{suffixSymbol ? (
				<Text className="font-sans text-muted" style={{ fontSize: small }}>
					{suffixSymbol}
				</Text>
			) : null}
		</Text>
	);
}

/**
 * Order matters: `isFuture` is declared after `income`, so a future-dated income
 * row resolves to `text-future` once `tv`'s merge drops the earlier colour.
 */
const rowAmount = tv({
	base: "font-sans-medium text-foreground text-title",
	variants: {
		income: { true: "text-income" },
		isFuture: { true: "text-future" },
		struck: { true: "line-through" },
	},
});

interface RowAmountProps extends RowAmountLabelInput {
	isFuture: boolean;
	/** The import review's excluded state: still legible, visibly not counted. */
	struck?: boolean;
	/**
	 * Net-zero money, printed unsigned: a transfer is neither earned nor spent,
	 * and a sign on it would claim a direction the ledger does not have. The
	 * colour cue lives on the row's icon, not here.
	 */
	transfer?: boolean;
}

function signFor(income: boolean | null): "+" | "-" {
	return income ? "+" : "-";
}

export function RowAmount({
	amount,
	income,
	isFuture,
	code,
	showCents = true,
	struck = false,
	transfer = false,
}: RowAmountProps) {
	const t = useTranslation();
	const parts = amountParts(amount, code, showCents);
	const sign = transfer ? "" : signFor(income);
	return (
		<Text
			// Spelled out because neither the glyph nor the colour is a cue a screen
			// reader can read; `rowAmountLabel` owns the wording.
			accessibilityLabel={rowAmountLabel({ amount, code, income: transfer ? null : income, showCents }, t)}
			className={rowAmount({ income: !transfer && income === true, isFuture, struck })}
			numberOfLines={1}
			style={TABULAR}
		>
			{sign}
			{withCurrencySymbol(parts, amountDigits(parts))}
		</Text>
	);
}

interface MeasureCellAmountProps {
	code: string;
	/** True only for the "In" measure — the one figure that earns the income color. */
	income: boolean;
	/** Unsigned magnitude; the sign comes from `positive`, not from this. */
	magnitude: number;
	positive: boolean;
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
}

/** Symbol, sign and digits share one tone, unlike the hero's muted symbol. */
export function MeasureCellAmount({ magnitude, positive, income, code, showCents = true }: MeasureCellAmountProps) {
	const parts = amountParts(magnitude, code, showCents);
	const toneClass = income ? "text-income" : "text-foreground";
	const sign = positive ? "+" : "-";
	return (
		<Text className={cn("font-sans-semibold text-body", toneClass)} numberOfLines={1} style={TABULAR}>
			{sign}
			{withCurrencySymbol(parts, amountDigits(parts))}
		</Text>
	);
}

interface DayTotalProps {
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
	/** The Upcoming header runs a step larger than a day header's. */
	sizeClass?: string;
	/** Signed totals per currency, dominant first. */
	totals: readonly CurrencyBucket[];
}

function signedAmount(amount: number, code: string, showCents: boolean): string {
	const parts = amountParts(amount, code, showCents);
	const sign = amount < 0 ? "-" : "+";
	return `${sign}${withCurrencySymbol(parts, amountDigits(parts))}`;
}

/**
 * A day that spent two currencies gets two figures separated by a slash, never
 * added: there is no rate here, so a single number would be an invention.
 */
export function DayTotal({ totals, showCents = true, sizeClass = "text-footnote" }: DayTotalProps) {
	return (
		<View className="flex-row items-baseline gap-1.5">
			{totals.map((bucket, index) => (
				<Fragment key={bucket.currencyCode}>
					{index > 0 ? <Text className={cn("font-sans-semibold text-subtle", sizeClass)}>/</Text> : null}
					<Text className={cn("font-sans-semibold text-muted", sizeClass)} numberOfLines={1} style={TABULAR}>
						{signedAmount(bucket.amount, bucket.currencyCode, showCents)}
					</Text>
				</Fragment>
			))}
		</View>
	);
}
