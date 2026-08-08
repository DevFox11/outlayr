import type { CurrencyBucket } from "./currency-totals";
import { formatDayHeader, formatTime } from "./dates";
import type { DayCardInput } from "./day-card";
import { amountParts } from "./money";

export interface CardableTransaction {
	note: string;
	amount: number;
	income: boolean;
	currency: string | null;
	date: Date;
	categoryName: string | null;
}

export interface CardableSection {
	day: Date;
	totals: readonly CurrencyBucket[];
	data: readonly CardableTransaction[];
}

export interface DayCardOptions {
	/** Global display code, used by a row that recorded none. */
	currency: string;
	showCents: boolean;
	swapTimeLabel: boolean;
	/** The row's meta line prints its time on a 24-hour clock. */
	use24Hour: boolean;
}

function figure(amount: number, code: string, showCents: boolean): string {
	const parts = amountParts(amount, code, showCents);
	return `${parts.symbol}${parts.integer}${
		parts.fraction ? `.${parts.fraction}` : ""
	}`;
}

function signed(amount: number, code: string, showCents: boolean): string {
	return `${amount < 0 ? "-" : "+"}${figure(amount, code, showCents)}`;
}

/**
 * The card restates what the Log already painted, so it reads the same
 * `DaySection` and honours the same display settings — a user who turned cents
 * off should not get them back in a screenshot they share.
 */
export function dayCardContent(
	section: CardableSection,
	options: DayCardOptions,
	now: Date = new Date(),
): DayCardInput {
	return {
		dayLabel: formatDayHeader(section.day, now),
		// Two currencies are printed side by side, never summed: the day header
		// makes the same refusal, and inventing a rate here would contradict it.
		total: section.totals
			.map((bucket) =>
				signed(bucket.amount, bucket.currencyCode, options.showCents),
			)
			.join(" / "),
		rows: section.data.map((row) => {
			const code = row.currency ?? options.currency;
			const magnitude = figure(row.amount, code, options.showCents);
			return {
				note: row.note,
				meta: options.swapTimeLabel
					? (row.categoryName ?? "")
					: formatTime(row.date, options.use24Hour),
				amount: `${row.income ? "+" : "-"}${magnitude}`,
			};
		}),
	};
}

export function dayCardFileName(day: Date): string {
	const year = day.getFullYear();
	const month = `${day.getMonth() + 1}`.padStart(2, "0");
	const date = `${day.getDate()}`.padStart(2, "0");
	return `outlayr-${year}-${month}-${date}.png`;
}
