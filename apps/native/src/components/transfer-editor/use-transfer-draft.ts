import type { EntryRateType } from "@outlayr/money/rates";
import { useMemo, useState } from "react";
import { useAccountBalance, useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useTransferRates } from "@/data/transfer-rates";
import { lastFeeCategoryId } from "@/data/transfers-core";
import type { Database } from "@/db/client";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { marketRateFor, rateTypeOptions } from "@/domain/transfer-rate-options";
import {
	type FeeSide,
	solveTransfer,
	type TransferLegs,
	type TransferValues,
	transferGap,
	transferLegs,
} from "@/domain/transfer-reconcile";

export const RATE_DISPLAY_DECIMALS = 4;

export interface TransferDraft {
	accounts: Account[];
	arrived: number;
	arrivedText: string;
	canSave: boolean;
	chooseFrom: (account: Account | null) => void;
	chooseTo: (account: Account | null) => void;
	crossCurrency: boolean;
	customRatePadText: string;
	date: Date;
	effectiveRate: number | null;
	fee: number;
	feeCategoryId: string | null;
	feeCurrency: string;
	feeDecimals: number;
	feeSide: FeeSide;
	feeText: string;
	from: Account | null;
	fromBalance: number;
	fromCurrency: string;
	fromDecimals: number;
	gapAmount: number;
	gapFee: number | null;
	gapRate: number | null;
	legs: TransferLegs | null;
	pinArrival: () => void;
	rateOptions: EntryRateType[];
	rateType: EntryRateType;
	resolveAsFee: () => void;
	resolveAsRate: () => void;
	sent: number;
	sentText: string;
	setArrived: (text: string) => void;
	setCustomRate: (text: string) => void;
	setDate: (date: Date) => void;
	setFee: (text: string) => void;
	setFeeCategoryId: (id: string) => void;
	setRateType: (type: EntryRateType) => void;
	setSent: (text: string) => void;
	swap: () => void;
	to: Account | null;
	toBalance: number;
	toCurrency: string;
	toDecimals: number;
	toggleFeeSide: () => void;
}

export function useTransferDraft(db: Database): TransferDraft {
	const accounts = useAccounts(db);
	const [fromId, setFromId] = useState<string | null>(accounts[0]?.id ?? null);
	const [toId, setToId] = useState<string | null>(accounts[1]?.id ?? null);
	const [sentText, setSentText] = useState("");
	const [arrivedText, setArrivedText] = useState("");
	const [arrivalPinned, setArrivalPinned] = useState(false);
	const [rateType, setRateTypeState] = useState<EntryRateType>("official");
	const [marketType, setMarketType] = useState<EntryRateType>("official");
	const [customRateText, setCustomRateText] = useState("");
	const [feeText, setFeeText] = useState("");
	const [feeSide, setFeeSide] = useState<FeeSide>("source");
	const [feeCategoryId, setFeeCategoryId] = useState<string | null>(() => lastFeeCategoryId(db));
	const [date, setDate] = useState(() => new Date());

	const from = accounts.find((account) => account.id === fromId) ?? null;
	const to = accounts.find((account) => account.id === toId) ?? null;
	const fromCurrency = from?.currency ?? "USD";
	const toCurrency = to?.currency ?? "USD";
	const crossCurrency = fromCurrency !== toCurrency;

	const fromBalance = useAccountBalance(db, {
		currency: fromCurrency,
		id: fromId ?? "",
		initialBalance: from?.initialBalance ?? 0,
	});
	const toBalance = useAccountBalance(db, {
		currency: toCurrency,
		id: toId ?? "",
		initialBalance: to?.initialBalance ?? 0,
	});

	const rates = useTransferRates(db, [fromCurrency, toCurrency], rateType === "custom" ? marketType : rateType);
	const marketRate = useMemo(
		() => marketRateFor(fromCurrency, toCurrency, date, rates),
		[fromCurrency, toCurrency, date, rates]
	);
	const customRate = customRateText === "" ? marketRate : numpadToNumber(customRateText);
	const rate = selectedRate();

	function selectedRate(): number | null {
		if (!crossCurrency) {
			return 1;
		}
		return rateType === "custom" ? customRate : marketRate;
	}

	const fromDecimals = minorUnitsFor(fromCurrency);
	const toDecimals = minorUnitsFor(toCurrency);
	const feeDecimals = feeSide === "destination" ? toDecimals : fromDecimals;
	const feeCurrency = feeSide === "destination" ? toCurrency : fromCurrency;

	const fee = numpadToNumber(feeText);
	const sent = numpadToNumber(sentText);
	const shape = { fee, feeSide, rate: rate ?? 0, sent };
	const derivedArrival = solveTransfer({ ...shape, arrived: 0 }, "arrived", toDecimals);
	const arrived = arrivalPinned ? numpadToNumber(arrivedText) : (derivedArrival ?? 0);
	const values: TransferValues = { ...shape, arrived };
	const legs = transferLegs(values, fromDecimals, toDecimals);

	const unpin =
		<T>(apply: (value: T) => void) =>
		(value: T) => {
			apply(value);
			setArrivalPinned(false);
		};

	function pick(
		nextId: string,
		otherId: string | null,
		setSelf: (id: string) => void,
		setOther: (id: string | null) => void,
		selfId: string | null
	) {
		if (nextId === otherId) {
			setOther(selfId);
		}
		setSelf(nextId);
		setArrivalPinned(false);
	}

	return {
		accounts,
		arrived,
		arrivedText,
		canSave: from !== null && to !== null && from.id !== to.id && sent > 0 && legs !== null,
		chooseFrom: (account) => {
			if (account) {
				pick(account.id, toId, setFromId, setToId, fromId);
			}
		},
		chooseTo: (account) => {
			if (account) {
				pick(account.id, fromId, setToId, setFromId, toId);
			}
		},
		crossCurrency,
		customRatePadText:
			customRateText === "" && marketRate !== null ? numberToNumpad(marketRate, RATE_DISPLAY_DECIMALS) : customRateText,
		date,
		effectiveRate: legs === null ? rate : legs.exchangeRate,
		fee,
		feeCategoryId,
		feeCurrency,
		feeDecimals,
		feeSide,
		feeText,
		from,
		fromBalance: fromBalance.total,
		fromCurrency,
		fromDecimals,
		gapAmount: arrivalPinned ? transferGap(values, toDecimals) : 0,
		gapFee: solveTransfer({ ...values, feeSide: "destination" }, "fee", toDecimals),
		gapRate: solveTransfer(values, "rate", RATE_DISPLAY_DECIMALS),
		legs,
		pinArrival: () => {
			setArrivedText(numberToNumpad(arrived, toDecimals));
			setArrivalPinned(true);
		},
		rateOptions: crossCurrency ? rateTypeOptions(toCurrency) : [],
		rateType,
		// Destination side whatever the current one is: the gap is a
		// destination-currency figure, so it lands there exactly. Carrying it to the
		// source rounds to source cents and leaves a residual nobody can clear.
		resolveAsFee: () => {
			const solved = solveTransfer({ ...values, feeSide: "destination" }, "fee", toDecimals);
			if (solved !== null && solved > 0) {
				setFeeSide("destination");
				setFeeText(numberToNumpad(solved, toDecimals));
			}
		},
		resolveAsRate: () => {
			const solved = solveTransfer(values, "rate", RATE_DISPLAY_DECIMALS);
			if (solved !== null) {
				setRateTypeState("custom");
				setCustomRateText(numberToNumpad(solved, RATE_DISPLAY_DECIMALS));
			}
		},
		sent,
		sentText,
		setArrived: setArrivedText,
		setCustomRate: unpin(setCustomRateText),
		setDate,
		setFee: unpin(setFeeText),
		setFeeCategoryId,
		setRateType: (next) => {
			setRateTypeState(next);
			if (next !== "custom") {
				setMarketType(next);
			}
			setArrivalPinned(false);
		},
		setSent: unpin(setSentText),
		swap: () => {
			setFromId(toId);
			setToId(fromId);
			setArrivalPinned(false);
		},
		to,
		toBalance: toBalance.total,
		toCurrency,
		toDecimals,
		toggleFeeSide: () => {
			setFeeSide(feeSide === "destination" ? "source" : "destination");
			setArrivalPinned(false);
		},
	};
}
