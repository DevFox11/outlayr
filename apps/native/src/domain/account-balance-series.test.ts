import { type AccountBalanceSeriesAccount, accountBalanceSeries } from "./account-balance-series";
import type { CurrencyCell } from "./currency-totals";
import { buildRateTable } from "./valuation";

const NOW = new Date("2026-08-10T12:00:00Z");
const NO_RATES = buildRateTable([]);

function account(overrides: Partial<AccountBalanceSeriesAccount> = {}): AccountBalanceSeriesAccount {
	return {
		currency: "USD",
		initialBalance: 0,
		initialBalanceDate: new Date("2026-08-10T12:00:00Z"),
		...overrides,
	};
}

function cell(overrides: Partial<CurrencyCell>): CurrencyCell {
	return {
		amount: 0,
		amountUsd: 0,
		count: 1,
		currencyCode: "USD",
		dateKey: "2026-08-01",
		income: false,
		unconvertedAmount: 0,
		unconvertedCount: 0,
		...overrides,
	};
}

function pointAt(series: ReturnType<typeof accountBalanceSeries>, date: string) {
	const point = series.find((candidate) => candidate.date === date);
	if (!point) {
		throw new Error(`Missing point for ${date}`);
	}
	return point;
}

describe("accountBalanceSeries", () => {
	it("applies the initial balance on its effective UTC date", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2026-08-05T23:30:00-04:00") }),
			[],
			NO_RATES,
			NOW
		);

		expect(series[0]).toMatchObject({ date: "2026-08-06", exact: true, value: 100 });
	});

	it("adds income and subtracts expenses on their cell dates", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2026-08-01T12:00:00Z") }),
			[
				cell({ amount: 50, amountUsd: 50, dateKey: "2026-08-03", income: true }),
				cell({ amount: 20, amountUsd: 20, dateKey: "2026-08-06", income: false }),
			],
			NO_RATES,
			NOW
		);

		expect(pointAt(series, "2026-08-03")).toMatchObject({ value: 150 });
		expect(pointAt(series, "2026-08-06")).toMatchObject({ value: 130 });
	});

	it("treats inbound and outbound transfer cells as balance movements", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2026-08-01T12:00:00Z") }),
			[
				cell({ amount: 35, amountUsd: 35, dateKey: "2026-08-04", income: false }),
				cell({ amount: 10, amountUsd: 10, dateKey: "2026-08-06", income: true }),
			],
			NO_RATES,
			NOW
		);

		expect(pointAt(series, "2026-08-04")).toMatchObject({ value: 65 });
		expect(pointAt(series, "2026-08-06")).toMatchObject({ value: 75 });
	});

	it("values mixed-currency cells with their rate-date and preserves exactness", () => {
		const rates = buildRateTable([{ date: "2026-08-01", quote: "EUR", rate: 0.8 }]);
		const series = accountBalanceSeries(
			account({
				currency: "EUR",
				initialBalance: 100,
				initialBalanceDate: new Date("2026-08-01T12:00:00Z"),
			}),
			[cell({ amount: 10, amountUsd: 10, dateKey: "2026-08-05", income: false })],
			rates,
			NOW
		);

		expect(pointAt(series, "2026-08-05")).toMatchObject({ exact: true, value: 92 });
	});

	it("uses the rate available on the cell date instead of a later rate", () => {
		const rates = buildRateTable([
			{ date: "2026-08-01", quote: "EUR", rate: 0.8 },
			{ date: "2026-08-05", quote: "EUR", rate: 0.5 },
		]);
		const series = accountBalanceSeries(
			account({
				currency: "EUR",
				initialBalance: 100,
				initialBalanceDate: new Date("2026-08-01T12:00:00Z"),
			}),
			[cell({ amount: 10, amountUsd: 10, dateKey: "2026-08-02", income: false })],
			rates,
			NOW
		);

		expect(pointAt(series, "2026-08-02")).toMatchObject({ exact: true, value: 92 });
	});

	it("marks later points inexact after cells have no usable rate or unconverted amounts", () => {
		const series = accountBalanceSeries(
			account({
				currency: "VES",
				initialBalance: 100,
				initialBalanceDate: new Date("2026-08-01T12:00:00Z"),
			}),
			[
				cell({ amount: 7, amountUsd: 10, currencyCode: "EUR", dateKey: "2026-08-02", income: false }),
				cell({
					amount: 12,
					amountUsd: 10,
					currencyCode: "EUR",
					dateKey: "2026-08-03",
					income: true,
					unconvertedAmount: 2,
					unconvertedCount: 1,
				}),
			],
			NO_RATES,
			NOW
		);

		expect(pointAt(series, "2026-08-02")).toMatchObject({ exact: false, value: 100 });
		expect(pointAt(series, "2026-08-03")).toMatchObject({ exact: false, value: 100 });
	});

	it("folds the opening balance and cells before the 182-day window into its first point", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2026-01-01T12:00:00Z") }),
			[
				cell({ amount: 20, amountUsd: 20, dateKey: "2026-01-02", income: true }),
				cell({ amount: 5, amountUsd: 5, dateKey: "2026-01-03", income: false }),
			],
			NO_RATES,
			NOW
		);

		expect(series[0]).toMatchObject({ date: "2026-02-10", exact: true, value: 115 });
	});

	it("folds in-window cells before a recent opening into its first visible balance", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2026-08-06T12:00:00Z") }),
			[cell({ amount: 20, amountUsd: 20, dateKey: "2026-08-03", income: false })],
			NO_RATES,
			NOW
		);

		expect(series[0]).toMatchObject({ date: "2026-08-06", exact: true, value: 80 });
	});

	it("keeps an empty account as an exact zero-valued 182-day series", () => {
		const series = accountBalanceSeries(account(), [], NO_RATES, NOW);

		expect(series).toHaveLength(182);
		expect(series[0]).toMatchObject({ date: "2026-02-10", exact: true, value: 0 });
		expect(series.at(-1)).toMatchObject({ date: "2026-08-10", exact: true, value: 0 });
	});

	it("extends through future cells without applying them before their effective date", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2026-08-01T12:00:00Z") }),
			[cell({ amount: 50, amountUsd: 50, dateKey: "2026-08-20", income: true })],
			NO_RATES,
			NOW
		);

		expect(pointAt(series, "2026-08-10")).toMatchObject({ value: 100 });
		expect(series.at(-1)).toMatchObject({ date: "2026-08-20", value: 150 });
	});
	it("bounds far-future effective dates while retaining normal future movements", () => {
		const series = accountBalanceSeries(
			account({ initialBalance: 100, initialBalanceDate: new Date("2040-01-01T12:00:00Z") }),
			[cell({ amount: 50, amountUsd: 50, dateKey: "2040-01-02", income: true })],
			NO_RATES,
			NOW
		);

		expect(series).toHaveLength(1);
		expect(series[0]).toMatchObject({ date: "2027-02-08", value: 0 });
	});
});
