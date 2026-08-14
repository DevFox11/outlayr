import type { EntryRateType } from "@outlayr/money/rates";
import { roundMoney } from "@outlayr/money/round";
import { useMemo, useState } from "react";

import { useAccountBalance, useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useTransferRates } from "@/data/transfer-rates";
import { lastFeeCategoryId } from "@/data/transfers-core";
import type { Database } from "@/db/client";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { marketRateFor, rateTypeOptions } from "@/domain/transfer-rate-options";
import { solveTransfer, transferGap, transferLegs } from "@/domain/transfer-reconcile";
import type { FeeSide, TransferLegs, TransferValues } from "@/domain/transfer-reconcile";

export const RATE_DISPLAY_DECIMALS = 4;

/** `shortfall` is signed, in the fee's own currency: how far the fee overruns its side. */
export type TransferBlock = { kind: "fee"; shortfall: number } | { kind: "rate" };

type TransferShape = Omit<TransferValues, "arrived">;

interface Units {
    fee: number;
    from: number;
    to: number;
}

interface DraftMath {
    arrived: number | null;
    block: TransferBlock | null;
    gap: number;
    gapFee: number | null;
    gapRate: number | null;
    legs: TransferLegs | null;
}

function pairRate(text: string, market: number | null): number | null {
    const rate = text === "" ? market : numpadToNumber(text);
    return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

function selectedRate(
    crossCurrency: boolean,
    rateType: EntryRateType,
    custom: number | null,
    market: number | null
): number | null {
    if (!crossCurrency) {
        return 1;
    }
    return rateType === "custom" ? custom : market;
}

function transferBlock(shape: TransferShape | null, arrived: number | null, feeDecimals: number): TransferBlock | null {
    if (shape === null) {
        return { kind: "rate" };
    }
    if ((arrived !== null && arrived > 0) || shape.sent <= 0) {
        return null;
    }
    const affordable = solveTransfer({ ...shape, arrived: 0 }, "fee", feeDecimals);
    return affordable === null
        ? { kind: "rate" }
        : { kind: "fee", shortfall: roundMoney(affordable - shape.fee, feeDecimals) };
}

/** An arrival of null or zero is `transfer-reconcile`'s verdict that the fee takes
 * everything reaching its side. Both refuse: a transfer that delivers nothing is a
 * fee wearing a transfer's shape, and the legs would credit it as money moved. */
function reconcile(shape: TransferShape | null, pinned: number | null, units: Units): DraftMath {
    const arrived = pinned ?? (shape === null ? null : solveTransfer({ ...shape, arrived: 0 }, "arrived", units.to));
    const values: TransferValues | null =
        shape === null || arrived === null || arrived <= 0 ? null : { ...shape, arrived };
    if (values === null) {
        return {
            arrived,
            block: transferBlock(shape, arrived, units.fee),
            gap: 0,
            gapFee: null,
            gapRate: null,
            legs: null,
        };
    }
    return {
        arrived,
        block: null,
        gap: pinned === null ? 0 : transferGap(values, units.to),
        gapFee: solveTransfer({ ...values, feeSide: "destination" }, "fee", units.to),
        gapRate: solveTransfer(values, "rate", RATE_DISPLAY_DECIMALS),
        legs: transferLegs(values, units.from, units.to),
    };
}

export interface TransferDraft {
    accounts: Account[];
    arrived: number | null;
    arrivedText: string;
    block: TransferBlock | null;
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
    const [customRates, setCustomRates] = useState<Record<string, string>>({});
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
    const pair = `${fromCurrency}/${toCurrency}`;
    const customRateText = customRates[pair] ?? "";
    /** Keyed by pair, so a rate typed for another one does not answer here — and
     * without this the segmented control would label the market rate user-authored. */
    const shownRateType: EntryRateType =
        rateType === "custom" && pairRate(customRateText, marketRate) === null ? marketType : rateType;
    const rate = selectedRate(crossCurrency, rateType, pairRate(customRateText, marketRate), marketRate);

    function setCustomRateText(text: string) {
        setCustomRates((current) => ({ ...current, [pair]: text }));
    }

    const fromDecimals = minorUnitsFor(fromCurrency);
    const toDecimals = minorUnitsFor(toCurrency);
    const feeDecimals = feeSide === "destination" ? toDecimals : fromDecimals;
    const feeCurrency = feeSide === "destination" ? toCurrency : fromCurrency;

    const fee = numpadToNumber(feeText);
    const sent = numpadToNumber(sentText);
    const math = reconcile(
        rate === null ? null : { fee, feeSide, rate, sent },
        arrivalPinned ? numpadToNumber(arrivedText) : null,
        {
            fee: feeDecimals,
            from: fromDecimals,
            to: toDecimals,
        }
    );

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
        arrived: math.arrived,
        arrivedText,
        block: math.block,
        canSave: from !== null && to !== null && from.id !== to.id && sent > 0 && math.legs !== null,
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
            customRateText === "" && marketRate !== null
                ? numberToNumpad(marketRate, RATE_DISPLAY_DECIMALS)
                : customRateText,
        date,
        effectiveRate: math.legs === null ? rate : math.legs.exchangeRate,
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
        gapAmount: math.gap,
        gapFee: math.gapFee,
        gapRate: math.gapRate,
        legs: math.legs,
        pinArrival: () => {
            setArrivedText(math.arrived === null ? "" : numberToNumpad(math.arrived, toDecimals));
            setArrivalPinned(true);
        },
        rateOptions: crossCurrency ? rateTypeOptions(toCurrency) : [],
        rateType: shownRateType,
        // Destination side whatever the current one is: the gap is a
        // destination-currency figure, so it lands there exactly. Carrying it to the
        // source rounds to source cents and leaves a residual nobody can clear.
        resolveAsFee: () => {
            if (math.gapFee !== null && math.gapFee > 0) {
                setFeeSide("destination");
                setFeeText(numberToNumpad(math.gapFee, toDecimals));
            }
        },
        resolveAsRate: () => {
            if (math.gapRate !== null) {
                setRateTypeState("custom");
                setCustomRateText(numberToNumpad(math.gapRate, RATE_DISPLAY_DECIMALS));
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
