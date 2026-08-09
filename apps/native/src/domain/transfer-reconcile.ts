import { roundMoney } from "@outlayr/money/round";

export type FeeSide = "source" | "destination";
export type TransferField = "arrived" | "fee" | "rate" | "sent";

export interface TransferValues {
	arrived: number;
	fee: number;
	feeSide: FeeSide;
	rate: number;
	sent: number;
}

export interface TransferLegs {
	exchangeRate: number;
	fromAmount: number;
	toAmount: number;
}

/**
 * Enough decimals that no real currency-per-USD rate is truncated, few enough
 * that `97.3 + 2.7` stops being `100.00000000000001`.
 */
const NOISE_DECIMALS = 10;

function finitePositive(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}

function money(value: number, decimals: number): number | null {
	if (!Number.isFinite(value) || value < 0) {
		return null;
	}
	return roundMoney(value, decimals);
}

function convertedPortion(values: TransferValues): number {
	return values.feeSide === "source" ? values.sent - values.fee : values.sent;
}

function preFeeArrival(values: TransferValues): number {
	return values.feeSide === "source" ? values.arrived : values.arrived + values.fee;
}

function solveArrived(values: TransferValues, decimals: number): number | null {
	if (!Number.isFinite(values.rate)) {
		return null;
	}
	const converted = convertedPortion(values);
	const gross = converted * values.rate;
	return money(values.feeSide === "source" ? gross : gross - values.fee, decimals);
}

function solveSent(values: TransferValues, decimals: number): number | null {
	if (!finitePositive(values.rate)) {
		return null;
	}
	const converted = preFeeArrival(values) / values.rate;
	return money(values.feeSide === "source" ? converted + values.fee : converted, decimals);
}

function solveFee(values: TransferValues, decimals: number): number | null {
	if (!finitePositive(values.rate)) {
		return null;
	}
	if (values.feeSide === "source") {
		return money(values.sent - values.arrived / values.rate, decimals);
	}
	return money(values.sent * values.rate - values.arrived, decimals);
}

function solveRate(values: TransferValues): number | null {
	const divisor = convertedPortion(values);
	if (!finitePositive(divisor)) {
		return null;
	}
	const rate = preFeeArrival(values) / divisor;
	return finitePositive(rate) ? rate : null;
}

export function solveTransfer(values: TransferValues, solveFor: TransferField, decimals: number): number | null {
	switch (solveFor) {
		case "arrived":
			return solveArrived(values, decimals);
		case "sent":
			return solveSent(values, decimals);
		case "fee":
			return solveFee(values, decimals);
		default:
			return solveRate(values);
	}
}

export function transferLegs(
	values: TransferValues,
	sourceDecimals: number,
	destinationDecimals: number
): TransferLegs | null {
	const fromAmount = money(convertedPortion(values), sourceDecimals);
	const toAmount = money(preFeeArrival(values), destinationDecimals);
	if (fromAmount === null || toAmount === null || !finitePositive(fromAmount)) {
		return null;
	}
	const exchangeRate = roundMoney(toAmount / fromAmount, NOISE_DECIMALS);
	return finitePositive(exchangeRate) ? { exchangeRate, fromAmount, toAmount } : null;
}

export function transferDisplay(legs: TransferLegs, fee: number, feeSide: FeeSide): { arrived: number; sent: number } {
	if (feeSide === "source") {
		return {
			arrived: roundMoney(legs.toAmount, NOISE_DECIMALS),
			sent: roundMoney(legs.fromAmount + fee, NOISE_DECIMALS),
		};
	}
	return {
		arrived: roundMoney(legs.toAmount - fee, NOISE_DECIMALS),
		sent: roundMoney(legs.fromAmount, NOISE_DECIMALS),
	};
}

export function transferGap(values: TransferValues, decimals: number): number {
	const expected = solveTransfer(values, "arrived", decimals);
	if (expected === null) {
		return 0;
	}
	return roundMoney(expected - values.arrived, decimals);
}
