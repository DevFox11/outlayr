import { Fragment } from "react";
import { View } from "react-native";
import {
	type RowAmountLabelInput,
	rowAmountLabel,
} from "@/domain/amount-label";
import type { CurrencyBucket } from "@/domain/currency-totals";
import { amountParts } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { Text } from "./text";
import { cn, tv } from "./tw";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

interface HeroNumberProps {
	/** Signed magnitude; the sign shown is derived unless `sign` is given. */
	amount: number;
	code: string;
	sign?: "+" | "-" | "";
	/** uniwind color class for the digits, e.g. "text-income". */
	toneClass?: string;
	size?: number;
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
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
	return (
		<Text
			className={cn("font-sans tracking-hero", toneClass)}
			style={[TABULAR, { fontSize: size }]}
			numberOfLines={1}
			adjustsFontSizeToFit
		>
			<Text className="font-sans text-muted" style={{ fontSize: small }}>
				{resolvedSign}
				{parts.symbol}
			</Text>
			{parts.integer}
			{parts.fraction ? (
				<Text className="font-sans text-muted" style={{ fontSize: small }}>
					.{parts.fraction}
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
	base: "font-sans-medium text-title text-foreground",
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
}

export function RowAmount({
	amount,
	income,
	isFuture,
	code,
	showCents = true,
	showSign = true,
	struck = false,
}: RowAmountProps) {
	const t = useTranslation();
	const parts = amountParts(amount, code, showCents);
	const sign = showSign ? (income ? "+" : "-") : "";
	return (
		<Text
			// Spelled out because the glyph above is optional and the colour is not a
			// cue a screen reader can read; `rowAmountLabel` owns the wording.
			accessibilityLabel={rowAmountLabel(
				{ amount, income, code, showCents, showSign },
				t,
			)}
			className={rowAmount({ income, isFuture, struck })}
			style={TABULAR}
			numberOfLines={1}
		>
			{sign}
			{parts.symbol}
			{parts.integer}
			{parts.fraction ? `.${parts.fraction}` : ""}
		</Text>
	);
}

interface MeasureCellAmountProps {
	/** Unsigned magnitude; the sign comes from `positive`, not from this. */
	magnitude: number;
	positive: boolean;
	/** True only for the "In" measure — the one figure that earns the income color. */
	income: boolean;
	code: string;
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
}

/** Symbol, sign and digits share one tone, unlike the hero's muted symbol. */
export function MeasureCellAmount({
	magnitude,
	positive,
	income,
	code,
	showCents = true,
}: MeasureCellAmountProps) {
	const parts = amountParts(magnitude, code, showCents);
	const toneClass = income ? "text-income" : "text-foreground";
	const sign = positive ? "+" : "-";
	return (
		<Text
			className={cn("font-sans-semibold text-body", toneClass)}
			style={TABULAR}
			numberOfLines={1}
		>
			{sign}
			{parts.symbol}
			{parts.integer}
			{parts.fraction ? `.${parts.fraction}` : ""}
		</Text>
	);
}

interface DayTotalProps {
	/** Signed totals per currency, dominant first. */
	totals: readonly CurrencyBucket[];
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
	/** The Upcoming header runs a step larger than a day header's. */
	sizeClass?: string;
}

function signedAmount(
	amount: number,
	code: string,
	showCents: boolean,
): string {
	const parts = amountParts(amount, code, showCents);
	return `${amount < 0 ? "-" : "+"}${parts.symbol}${parts.integer}${
		parts.fraction ? `.${parts.fraction}` : ""
	}`;
}

/**
 * A day that spent two currencies gets two figures separated by a slash, never
 * added: there is no rate here, so a single number would be an invention.
 */
export function DayTotal({
	totals,
	showCents = true,
	sizeClass = "text-footnote",
}: DayTotalProps) {
	return (
		<View className="flex-row items-baseline gap-1.5">
			{totals.map((bucket, index) => (
				<Fragment key={bucket.currencyCode}>
					{index > 0 ? (
						<Text className={cn("font-sans-semibold text-subtle", sizeClass)}>
							/
						</Text>
					) : null}
					<Text
						className={cn("font-sans-semibold text-muted", sizeClass)}
						style={TABULAR}
						numberOfLines={1}
					>
						{signedAmount(bucket.amount, bucket.currencyCode, showCents)}
					</Text>
				</Fragment>
			))}
		</View>
	);
}
