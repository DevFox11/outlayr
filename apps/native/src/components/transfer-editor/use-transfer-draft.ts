import type { EntryRateType } from "@outlayr/money/rates";
import { roundMoney } from "@outlayr/money/round";
import { useMemo, useState } from "react";

import { useAccountBalance, useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useTransferRates } from "@/data/transfer-rates";
import type { SavedTransfer } from "@/data/transfers-core";
import type { Database } from "@/db/client";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { marketRateFor, rateTypeOptions } from "@/domain/transfer-rate-options";
import { solveTransfer, transferGap, transferLegs } from "@/domain/transfer-reconcile";
import type { FeeSide, TransferLegs, TransferValues } from "@/domain/transfer-reconcile";

export const RATE_DISPLAY_DECIMALS = 4;

/** `shortfall` is signed, in the fee's own currency: how far the fee overruns its side. */
type TransferBlock = { kind: "fee"; shortfall: number } | { kind: "rate" };

/** Everything the user has entered — the arrival is solved from it, never typed. */
type EnteredTransfer = Omit<TransferValues, "arrived">;

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

function pairRate(text: string | undefined, market: number | null): number | null {
    const rate = text === undefined ? market : numpadToNumber(text);
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

function transferBlock(
    entered: EnteredTransfer | null,
    arrived: number | null,
    feeDecimals: number
): TransferBlock | null {
    if (entered === null) {
        return { kind: "rate" };
    }
    if ((arrived !== null && arrived > 0) || entered.sent <= 0) {
        return null;
    }
    const affordable = solveTransfer({ ...entered, arrived: 0 }, "fee", feeDecimals);
    return affordable === null
        ? { kind: "rate" }
        : { kind: "fee", shortfall: roundMoney(affordable - entered.fee, feeDecimals) };
}

/** An arrival of null or zero is `transfer-reconcile`'s verdict that the fee takes
 * everything reaching its side. Both refuse: a transfer that delivers nothing is a
 * fee wearing a transfer's clothes, and the legs would credit it as money moved. */
function reconcile(entered: EnteredTransfer | null, pinned: number | null, units: Units): DraftMath {
    const arrived =
        pinned ?? (entered === null ? null : solveTransfer({ ...entered, arrived: 0 }, "arrived", units.to));
    const values: TransferValues | null =
        entered === null || arrived === null || arrived <= 0 ? null : { ...entered, arrived };
    if (values === null) {
        return {
            arrived,
            block: transferBlock(entered, arrived, units.fee),
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
    feeCurrency: string;
    feeDecimals: number;
    feeSide: FeeSide;
    feeText: string;
    from: Account | null;
    fromBalance: number;
    fromBalanceAfter: number;
    fromCurrency: string;
    fromDecimals: number;
    gapAmount: number;
    gapFee: number | null;
    gapRate: number | null;
    legs: TransferLegs | null;
    pinArrival: () => void;
    quotedRate: number | null;
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
    setRateType: (type: EntryRateType) => void;
    setSent: (text: string) => void;
    swap: () => void;
    to: Account | null;
    toBalance: number;
    toBalanceAfter: number;
    toCurrency: string;
    toDecimals: number;
    toggleFeeSide: () => void;
}

/**
 * What the voice screen hands the editor when a spoken transfer needs the
 * pieces nobody speaks (a rate, a fee) or an account it could not resolve.
 * Every field is optional; a missing one falls back to the editor's own default.
 */
export interface TransferSeed {
    amount?: number;
    /**
     * The currency `amount` was spoken in. It lands on whichever leg holds that
     * currency: the sent side when it is the source account's, the pinned
     * arrival when it is the destination's, and nowhere when it is neither —
     * a number in the wrong currency is worse than an empty field.
     */
    currency?: string;
    date?: Date;
    fromAccountId?: string;
    /**
     * The source was named but the ledger could not place it, so that leg opens
     * empty for the person to choose rather than falling back to any account.
     */
    fromUnresolved?: boolean;
    toAccountId?: string;
    /** Likewise for the destination. */
    toUnresolved?: boolean;
}

interface Opening {
    arrivalPinned: boolean;
    arrivedText: string;
    customRates: Record<string, string>;
    date: Date;
    feeSide: FeeSide;
    feeText: string;
    fromId: string | null;
    rateType: EntryRateType;
    sentText: string;
    toId: string | null;
}

/** The editor's opening state: the seed where it speaks, the first two accounts where it does not. */
function openingState(accounts: readonly Account[], seed: TransferSeed | undefined): Opening {
    const from = accounts.find((account) => account.id === seed?.fromAccountId);
    const to = accounts.find((account) => account.id === seed?.toAccountId);
    const amount = seed?.amount;
    const spokenIn = seed?.currency;
    const onSent = amount !== undefined && from !== undefined && (spokenIn === undefined || spokenIn === from.currency);
    const onArrival = amount !== undefined && !onSent && to !== undefined && spokenIn === to.currency;
    // A leg the seed left unnamed takes the first account that is not the
    // other leg, so a half-resolved move never opens as an account paying
    // itself. A leg that was named and missed stays empty: guessing a balance
    // the person never named is worse than asking.
    const fallbackFrom = seed?.fromUnresolved ? null : accounts.find((account) => account.id !== to?.id)?.id;
    const fromId = from?.id ?? fallbackFrom ?? null;
    const fallbackTo = seed?.toUnresolved ? null : accounts.find((account) => account.id !== fromId)?.id;
    const toId = to?.id ?? fallbackTo ?? null;
    return {
        arrivalPinned: onArrival,
        arrivedText: onArrival ? numberToNumpad(amount, minorUnitsFor(to.currency)) : "",
        customRates: {},
        date: seed?.date ?? new Date(),
        feeSide: "source",
        feeText: "",
        fromId,
        rateType: "official",
        sentText: onSent ? numberToNumpad(amount, minorUnitsFor(from.currency)) : "",
        toId,
    };
}

function savedState(accounts: readonly Account[], saved: SavedTransfer): Opening {
    const fromCurrency = accounts.find((account) => account.id === saved.fromAccountId)?.currency;
    const toCurrency = accounts.find((account) => account.id === saved.toAccountId)?.currency;
    if (fromCurrency !== saved.fromCurrency || toCurrency !== saved.toCurrency) {
        return openingState(accounts, {
            date: saved.date,
            fromAccountId: saved.fromAccountId,
            fromUnresolved: true,
            toAccountId: saved.toAccountId,
            toUnresolved: true,
        });
    }
    const rateType = saved.rateType ?? "official";
    return {
        arrivalPinned: true,
        arrivedText: numberToNumpad(saved.arrived, minorUnitsFor(toCurrency)),
        customRates:
            rateType === "custom" && saved.rate !== null
                ? { [`${fromCurrency}/${toCurrency}`]: numberToNumpad(saved.rate, RATE_DISPLAY_DECIMALS) }
                : {},
        date: saved.date,
        feeSide: saved.feeSide,
        feeText: numberToNumpad(saved.fee, minorUnitsFor(saved.feeSide === "destination" ? toCurrency : fromCurrency)),
        fromId: saved.fromAccountId,
        rateType,
        sentText: numberToNumpad(saved.sent, minorUnitsFor(fromCurrency)),
        toId: saved.toAccountId,
    };
}

function savedQuote(saved: SavedTransfer | undefined, pair: string, type: EntryRateType, date: Date): number | null {
    const same =
        saved !== undefined &&
        pair === `${saved.fromCurrency}/${saved.toCurrency}` &&
        type === saved.rateType &&
        date.getTime() === saved.date.getTime();
    return same ? saved.rate : null;
}

function restoredBy(saved: SavedTransfer | undefined, account: Account | null): number {
    if (saved === undefined || account === null) {
        return 0;
    }
    const sent = account.id === saved.fromAccountId && account.currency === saved.fromCurrency ? saved.sent : 0;
    const arrived = account.id === saved.toAccountId && account.currency === saved.toCurrency ? saved.arrived : 0;
    return sent - arrived;
}

export function useTransferDraft(db: Database, seed?: TransferSeed, saved?: SavedTransfer): TransferDraft {
    const accounts = useAccounts(db);
    const [opening] = useState(() => (saved ? savedState(accounts, saved) : openingState(accounts, seed)));
    const [fromId, setFromId] = useState<string | null>(opening.fromId);
    const [toId, setToId] = useState<string | null>(opening.toId);
    const [sentText, setSentText] = useState(opening.sentText);
    const [arrivedText, setArrivedText] = useState(opening.arrivedText);
    const [arrivalPinned, setArrivalPinned] = useState(opening.arrivalPinned);
    const [rateType, setRateTypeState] = useState<EntryRateType>(opening.rateType);
    const [marketType, setMarketType] = useState<EntryRateType>(
        opening.rateType === "custom" ? "official" : opening.rateType
    );
    const [customRates, setCustomRates] = useState<Record<string, string>>(opening.customRates);
    const [feeText, setFeeText] = useState(opening.feeText);
    const [feeSide, setFeeSide] = useState<FeeSide>(opening.feeSide);
    const [date, setDate] = useState(opening.date);

    const from = accounts.find((account) => account.id === fromId) ?? null;
    const to = accounts.find((account) => account.id === toId) ?? null;
    const fromCurrency = from?.currency ?? "USD";
    const toCurrency = to?.currency ?? "USD";
    const crossCurrency = fromCurrency !== toCurrency;
    const fromRestored = restoredBy(saved, from);
    const toRestored = restoredBy(saved, to);

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

    const quoteType = rateType === "custom" ? marketType : rateType;
    const rates = useTransferRates(db, [fromCurrency, toCurrency], quoteType);
    const tableRate = useMemo(
        () => marketRateFor(fromCurrency, toCurrency, date, rates),
        [fromCurrency, toCurrency, date, rates]
    );
    const pair = `${fromCurrency}/${toCurrency}`;
    const ownQuote = savedQuote(saved, pair, quoteType, date);
    const marketRate = tableRate ?? ownQuote;
    const customRateText = customRates[pair];
    /** Keyed by pair, so a rate typed for another one does not answer here — and
     * without this the segmented control would label the market rate user-authored. */
    const shownRateType: EntryRateType =
        rateType === "custom" && customRateText === undefined && marketRate === null ? marketType : rateType;
    const rate = selectedRate(crossCurrency, rateType, pairRate(customRateText, marketRate), marketRate);

    function setCustomRateText(text: string) {
        setCustomRates((current) => ({ ...current, [pair]: text }));
    }

    const fromDecimals = minorUnitsFor(fromCurrency);
    const toDecimals = minorUnitsFor(toCurrency);
    const feeDecimals = feeSide === "destination" ? toDecimals : fromDecimals;
    const feeCurrency = feeSide === "destination" ? toCurrency : fromCurrency;

    // At the currency's own units, and re-derived per render — so moving the fee
    // to the other side, which changes `feeDecimals`, re-quantizes it rather than
    // solving the reconciliation against a figure the slip no longer shows.
    const fee = roundMoney(numpadToNumber(feeText), feeDecimals);
    const sent = roundMoney(numpadToNumber(sentText), fromDecimals);
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

    /**
     * Picks one leg. Choosing the account the other leg holds swaps them. A
     * pinned arrival is in the destination's currency, so it survives a new
     * source and is dropped only when the destination actually changes — which
     * includes a swap, since the old source becomes the destination.
     */
    function pick(
        nextId: string,
        otherId: string | null,
        setSelf: (id: string) => void,
        setOther: (id: string | null) => void,
        selfId: string | null,
        leg: "from" | "to"
    ) {
        const swapped = nextId === otherId;
        if (swapped) {
            setOther(selfId);
        }
        setSelf(nextId);
        // Re-tapping the selected destination changes nothing, and keeps the pin.
        if ((leg === "to" && nextId !== selfId) || swapped) {
            setArrivalPinned(false);
        }
    }

    return {
        accounts,
        arrived: math.arrived,
        arrivedText,
        block: math.block,
        canSave: from !== null && to !== null && from.id !== to.id && sent > 0 && math.legs !== null,
        chooseFrom: (account) => {
            if (account) {
                pick(account.id, toId, setFromId, setToId, fromId, "from");
                // A pinned arrival with nothing sent yet, and a source in the
                // destination's currency: the legs are equal, so the sent side
                // is the arrival, not a number to type again.
                if (arrivalPinned && sent === 0 && account.id !== toId && account.currency === toCurrency) {
                    setSentText(arrivedText);
                }
            }
        },
        chooseTo: (account) => {
            if (account) {
                pick(account.id, fromId, setToId, setFromId, toId, "to");
            }
        },
        crossCurrency,
        customRatePadText:
            customRateText ?? (marketRate === null ? "" : numberToNumpad(marketRate, RATE_DISPLAY_DECIMALS)),
        date,
        effectiveRate: math.legs === null ? rate : math.legs.exchangeRate,
        fee,
        feeCurrency,
        feeDecimals,
        feeSide,
        feeText,
        from,
        fromBalance: roundMoney(fromBalance.total, fromDecimals),
        fromBalanceAfter: roundMoney(fromBalance.total + fromRestored - sent, fromDecimals),
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
        quotedRate: rate,
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
        toBalance: roundMoney(toBalance.total, toDecimals),
        toBalanceAfter: roundMoney(toBalance.total + toRestored + (math.arrived ?? 0), toDecimals),
        toCurrency,
        toDecimals,
        toggleFeeSide: () => {
            const toDestination = feeSide === "source";
            if (crossCurrency && rate !== null && fee > 0) {
                const decimals = toDestination ? toDecimals : fromDecimals;
                const converted = roundMoney(toDestination ? fee * rate : fee / rate, decimals);
                setFeeText(numberToNumpad(converted, decimals));
            }
            setFeeSide(toDestination ? "destination" : "source");
            setArrivalPinned(false);
        },
    };
}
