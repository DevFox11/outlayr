import { MARKET_RATE_TYPES } from "@outlayr/money/rates";
import type { MarketRateType } from "@outlayr/money/rates";
import { roundMoney } from "@outlayr/money/round";
import { useMemo, useState } from "react";

import { useAccountBalance, useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { pairRateSource, usePriorCustomRate, useTransferRates } from "@/data/transfer-rates";
import type { RateSource } from "@/data/transfer-rates";
import { lastTransfer } from "@/data/transfers-core";
import type { SavedTransfer } from "@/data/transfers-core";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { pairQuotedInverse, quotePairRate, rateEntryText } from "@/domain/transaction-entry-rate";
import { marketRateFor, transferRateOptions } from "@/domain/transfer-rate-options";
import type { TransferRateChoice } from "@/domain/transfer-rate-options";
import { solveTransfer, transferGap, transferLegs } from "@/domain/transfer-reconcile";
import type { FeeSide, TransferLegs, TransferValues } from "@/domain/transfer-reconcile";
import type { RateTable } from "@/domain/valuation";

/** `shortfall` is signed, in the fee's own currency: how far the fee overruns its side. */
type TransferBlock = { kind: "fee"; shortfall: number } | { kind: "rate" };

/** Everything the user has entered — the arrival is solved from it, never typed. */
type EnteredTransfer = Omit<TransferValues, "arrived">;

interface Units {
    fee: number;
    from: number;
    to: number;
}

export type FeeMode = "none" | "included" | "onTop";

interface DraftMath {
    arrived: number | null;
    block: TransferBlock | null;
    gap: number;
    gapFee: number | null;
    legs: TransferLegs | null;
    net: number | null;
    outside: number;
}

interface CustomRate {
    exact: number | null;
    inverse: boolean;
    text: string;
}

function pairRate(
    custom: CustomRate | undefined,
    market: number | null,
    unquote: (rate: number) => number
): number | null {
    const typed = custom === undefined ? null : numpadToNumber(custom.text);
    const rate = custom?.exact ?? (typed === null ? market : unquote(typed));
    return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

function selectedRate(
    crossCurrency: boolean,
    rateType: TransferRateChoice,
    custom: number | null,
    market: number | null
): number | null {
    if (!crossCurrency) {
        return 1;
    }
    return rateType === "custom" ? custom : market;
}

function quoteOf(rateType: TransferRateChoice | null, market: MarketRateType | null, carried?: MarketRateType) {
    const type = rateType ?? carried ?? null;
    return type === "custom" ? (market ?? carried ?? null) : type;
}

function rateChoices(
    chosen: TransferRateChoice | null,
    market: MarketRateType | null,
    carried: MarketRateType | undefined,
    binanceRate: number | null
) {
    const fallback: MarketRateType = binanceRate === null ? "official" : "binance";
    const rateType = chosen ?? carried ?? fallback;
    return { quoteType: quoteOf(rateType, market, carried) ?? fallback, rateType };
}

function transferBlock(
    entered: EnteredTransfer | null,
    arrived: number | null,
    feeDecimals: number,
    reached: number | null
): TransferBlock | null {
    if (entered === null) {
        return { kind: "rate" };
    }
    if (arrived !== null && arrived > 0) {
        return null;
    }
    const affordable = reached ?? solveTransfer({ ...entered, arrived: 0 }, "fee", feeDecimals);
    return affordable === null
        ? { kind: "rate" }
        : { kind: "fee", shortfall: roundMoney(affordable - entered.fee, feeDecimals) };
}

/** An arrival of null or zero is `transfer-reconcile`'s verdict that the fee takes
 * everything reaching its side. Both refuse: a transfer that delivers nothing is a
 * fee wearing a transfer's clothes, and the legs would credit it as money moved. */
function settle(
    typed: EnteredTransfer | null,
    pinned: number | null,
    units: Units,
    crossCurrency: boolean,
    topUp: number,
    outsideConfirmed: boolean
): DraftMath {
    const arrivalTopUp = typed?.feeSide === "destination" ? topUp : 0;
    const entered =
        typed === null ? null : { ...typed, sent: roundMoney(typed.sent + topUp - arrivalTopUp, units.from) };
    const solved = entered === null ? null : solveTransfer({ ...entered, arrived: 0 }, "arrived", units.to);
    const net = pinned === null ? solved : roundMoney(pinned - arrivalTopUp, units.to);
    const arrived = pinned ?? (net === null ? null : roundMoney(net + arrivalTopUp, units.to));
    const values: TransferValues | null =
        entered === null || net === null || net <= 0 ? null : { ...entered, arrived: net };
    if (typed === null || arrived === null || values === null) {
        return {
            arrived,
            block:
                typed !== null && typed.sent <= 0
                    ? null
                    : transferBlock(entered, net, units.fee, arrivalTopUp > 0 ? pinned : null),
            gap: 0,
            gapFee: null,
            legs: null,
            net,
            outside: 0,
        };
    }
    const gap = pinned === null ? 0 : transferGap(values, units.fee, units.to);
    const outside = crossCurrency && outsideConfirmed && gap < 0 ? -gap : 0;
    const gapFee = solveTransfer(values, "fee", units.fee);
    const feeCloses =
        gapFee !== null && gapFee > 0 && transferLegs({ ...values, fee: gapFee }, units.from, units.to) !== null;
    return {
        arrived,
        block: null,
        gap,
        gapFee: feeCloses ? gapFee : null,
        legs:
            gap === 0 || (crossCurrency && gap > 0) || outside > 0 ? transferLegs(values, units.from, units.to) : null,
        net,
        outside,
    };
}

function reconcile(
    typed: Omit<EnteredTransfer, "rate"> & { rate: number | null },
    pinned: number | null,
    units: Units,
    crossCurrency: boolean,
    feeMode: FeeMode,
    outside: boolean
): DraftMath & { gapOnTop: boolean; paid: number } {
    const { rate } = typed;
    const entered = rate === null ? null : { ...typed, rate };
    const topUp = feeMode === "onTop" ? typed.fee : 0;
    const math = settle(entered, pinned, units, crossCurrency, topUp, outside);
    const onTop =
        feeMode === "included" && math.gap !== 0
            ? settle(entered, pinned, units, crossCurrency, typed.fee, outside)
            : null;
    return {
        ...math,
        gapOnTop: onTop?.gap === 0 && onTop.legs !== null,
        paid: roundMoney(typed.sent + (typed.feeSide === "source" ? topUp : 0), units.from),
    };
}

export interface TransferDraft {
    accounts: Account[];
    arrivalSeen: boolean;
    arrived: number | null;
    arrivedText: string;
    block: TransferBlock | null;
    canSave: boolean;
    chooseFrom: (account: Account | null) => void;
    chooseTo: (account: Account | null) => void;
    crossCurrency: boolean;
    customRatePadText: string;
    date: Date;
    fee: number;
    feeCurrency: string;
    feeDecimals: number;
    feeMode: FeeMode;
    feeSide: FeeSide;
    feeText: string;
    from: Account | null;
    fromBalance: number;
    fromBalanceAfter: number;
    fromCurrency: string;
    fromDecimals: number;
    gapAmount: number;
    gapFee: number | null;
    gapOnTop: boolean;
    legs: TransferLegs | null;
    marketRates: Record<TransferRateChoice, number | null>;
    outside: number;
    paid: number;
    prefillArrival: () => void;
    priorCustomRate: { date: Date; rate: number } | null;
    quotedRate: number | null;
    rateInverse: boolean;
    rateOptions: TransferRateChoice[];
    rateSources: Record<TransferRateChoice, RateSource | null>;
    rateType: TransferRateChoice;
    resolveAsFee: () => void;
    resolveAsOnTop: () => void;
    sent: number;
    sentText: string;
    setArrived: (text: string) => void;
    setCustomRate: (text: string, exact?: number) => void;
    setDate: (date: Date) => void;
    setFee: (text: string) => void;
    setFeeMode: (mode: FeeMode) => void;
    setOutside: (confirmed: boolean) => void;
    setRateType: (type: TransferRateChoice) => void;
    setSent: (text: string) => void;
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
    carriedRates: Partial<Record<string, MarketRateType>>;
    customRates: Record<string, CustomRate>;
    date: Date;
    feeSide: FeeSide;
    feeText: string;
    fromId: string | null;
    outside: boolean;
    rateType: TransferRateChoice | null;
    sentText: string;
    toId: string | null;
}

/** The editor's opening state: the seed where it speaks, else the last transfer's route, else the first two accounts. */
function openingState(
    accounts: readonly Account[],
    seed: TransferSeed | undefined,
    last: SavedTransfer | null
): Opening {
    const from = accounts.find((account) => account.id === seed?.fromAccountId);
    const to = accounts.find((account) => account.id === seed?.toAccountId);
    const amount = seed?.amount;
    const spokenIn = seed?.currency;
    const onSent = amount !== undefined && from !== undefined && (spokenIn === undefined || spokenIn === from.currency);
    const onArrival = amount !== undefined && !onSent && to !== undefined && spokenIn === to.currency;
    const holds = (id: string, currency: string) =>
        accounts.some((account) => account.id === id && account.currency === currency);
    const route =
        last !== null && holds(last.fromAccountId, last.fromCurrency) && holds(last.toAccountId, last.toCurrency)
            ? last
            : null;
    // A leg the seed left unnamed takes the last transfer's leg, else the first
    // account, whichever is not the other leg, so a half-resolved move never
    // opens as an account paying itself. A leg that was named and missed stays
    // empty: guessing a balance the person never named is worse than asking.
    const leg = (routed: string | undefined, other: string | null | undefined) =>
        [routed, ...accounts.map((account) => account.id)].find((id) => id !== undefined && id !== other);
    const fallbackFrom = seed?.fromUnresolved ? null : leg(route?.fromAccountId, to?.id);
    const fromId = from?.id ?? fallbackFrom ?? null;
    const fallbackTo = seed?.toUnresolved ? null : leg(route?.toAccountId, fromId);
    const toId = to?.id ?? fallbackTo ?? null;
    const onRoute = route !== null && fromId === route.fromAccountId && toId === route.toAccountId;
    return {
        arrivalPinned: onArrival,
        arrivedText: onArrival ? numberToNumpad(amount, minorUnitsFor(to.currency)) : "",
        carriedRates:
            onRoute && route.rateType !== null && route.rateType !== "custom"
                ? { [`${route.fromCurrency}/${route.toCurrency}`]: route.rateType }
                : {},
        customRates: {},
        date: seed?.date ?? new Date(),
        feeSide: "source",
        feeText: "",
        fromId,
        outside: false,
        rateType: null,
        sentText: onSent ? numberToNumpad(amount, minorUnitsFor(from.currency)) : "",
        toId,
    };
}

function savedState(accounts: readonly Account[], saved: SavedTransfer): Opening {
    const fromCurrency = accounts.find((account) => account.id === saved.fromAccountId)?.currency;
    const toCurrency = accounts.find((account) => account.id === saved.toAccountId)?.currency;
    if (fromCurrency !== saved.fromCurrency || toCurrency !== saved.toCurrency) {
        return openingState(
            accounts,
            {
                date: saved.date,
                fromAccountId: saved.fromAccountId,
                fromUnresolved: true,
                toAccountId: saved.toAccountId,
                toUnresolved: true,
            },
            null
        );
    }
    const rateType = saved.rateType ?? "official";
    const inverse = pairQuotedInverse(saved.fromCurrency, saved.toCurrency, saved.rate);
    const feeDecimals = minorUnitsFor(saved.feeSide === "destination" ? toCurrency : fromCurrency);
    return {
        arrivalPinned: fromCurrency !== toCurrency,
        arrivedText: numberToNumpad(saved.arrived, minorUnitsFor(toCurrency)),
        carriedRates: {},
        customRates:
            rateType === "custom" && saved.rate !== null
                ? {
                      [`${fromCurrency}/${toCurrency}`]: {
                          exact: saved.rate,
                          inverse,
                          text: rateEntryText(quotePairRate(inverse, saved.rate)),
                      },
                  }
                : {},
        date: saved.date,
        feeSide: saved.feeSide,
        feeText: numberToNumpad(saved.fee, feeDecimals),
        fromId: saved.fromAccountId,
        outside:
            fromCurrency !== toCurrency &&
            saved.rate !== null &&
            transferGap(
                { arrived: saved.arrived, fee: saved.fee, feeSide: saved.feeSide, rate: saved.rate, sent: saved.sent },
                feeDecimals,
                minorUnitsFor(toCurrency)
            ) < 0,
        rateType,
        sentText: numberToNumpad(saved.sent, minorUnitsFor(fromCurrency)),
        toId: saved.toAccountId,
    };
}

function tableRatesFor(from: string, to: string, date: Date, tables: Partial<Record<MarketRateType, RateTable>>) {
    const rateIn = (table: RateTable | undefined) =>
        table === undefined ? null : marketRateFor(from, to, date, table);
    return {
        binance: rateIn(tables.binance),
        custom: null,
        eur_reference: rateIn(tables.eur_reference),
        official: rateIn(tables.official),
    } satisfies Record<TransferRateChoice, number | null>;
}

function marketRatesOf(
    quoteType: TransferRateChoice,
    table: Record<TransferRateChoice, number | null>,
    own: number | null
) {
    return {
        binance: table.binance,
        custom: null,
        eur_reference: (quoteType === "eur_reference" ? own : null) ?? table.eur_reference,
        official: (quoteType === "official" ? own : null) ?? table.official,
    } satisfies Record<TransferRateChoice, number | null>;
}

function savedQuote(
    saved: SavedTransfer | undefined,
    pair: string,
    type: TransferRateChoice,
    date: Date
): number | null {
    const same =
        saved !== undefined &&
        pair === `${saved.fromCurrency}/${saved.toCurrency}` &&
        type === saved.rateType &&
        date.getTime() === saved.date.getTime();
    return same ? saved.rate : null;
}

function restoredBy(saved: SavedTransfer | undefined, account: Account | null, nowMs: number): number {
    if (saved === undefined || account === null || saved.date.getTime() > nowMs) {
        return 0;
    }
    const sent = account.id === saved.fromAccountId && account.currency === saved.fromCurrency ? saved.sent : 0;
    const arrived = account.id === saved.toAccountId && account.currency === saved.toCurrency ? saved.arrived : 0;
    return sent - arrived;
}

export function useTransferDraft(db: Database, seed?: TransferSeed, saved?: SavedTransfer): TransferDraft {
    const accounts = useAccounts(db);
    const [opening] = useState(() =>
        saved ? savedState(accounts, saved) : openingState(accounts, seed, lastTransfer(db))
    );
    const [fromId, setFromId] = useState<string | null>(opening.fromId);
    const [toId, setToId] = useState<string | null>(opening.toId);
    const [sentText, setSentText] = useState(opening.sentText);
    const [arrivedText, setArrivedText] = useState(opening.arrivedText);
    const [arrivalPinned, setArrivalPinned] = useState(opening.arrivalPinned);
    const [shownPair, setShownPair] = useState<string | null>(null);
    const [chosenRate, setChosenRate] = useState<TransferRateChoice | null>(opening.rateType);
    const [marketType, setMarketType] = useState<MarketRateType | null>(
        opening.rateType === "custom" ? "official" : opening.rateType
    );
    const [customRates, setCustomRates] = useState<Record<string, CustomRate>>(opening.customRates);
    const [feeText, setFeeText] = useState(opening.feeText);
    const [feeMode, setFeeMode] = useState<FeeMode>(opening.feeText === "" ? "none" : "included");
    const [feeSide, setFeeSide] = useState<FeeSide>(opening.feeSide);
    const [date, setDate] = useState(opening.date);
    const [outside, setOutside] = useState(opening.outside);

    const from = accounts.find((account) => account.id === fromId) ?? null;
    const to = accounts.find((account) => account.id === toId) ?? null;
    const fromCurrency = from?.currency ?? "USD";
    const toCurrency = to?.currency ?? "USD";
    const crossCurrency = fromCurrency !== toCurrency;
    const pair = `${fromCurrency}/${toCurrency}`;
    const carriedRate = opening.carriedRates[pair];
    const nowMs = useNow();
    const fromRestored = restoredBy(saved, from, nowMs);
    const toRestored = restoredBy(saved, to, nowMs);

    const fromBalance = useAccountBalance(
        db,
        {
            currency: fromCurrency,
            id: fromId ?? "",
            initialBalance: from?.initialBalance ?? 0,
        },
        nowMs
    );
    const toBalance = useAccountBalance(
        db,
        {
            currency: toCurrency,
            id: toId ?? "",
            initialBalance: to?.initialBalance ?? 0,
        },
        nowMs
    );

    const chosenQuote = quoteOf(chosenRate, marketType, carriedRate);
    const quotedTypes = useMemo(
        () =>
            MARKET_RATE_TYPES.filter(
                (type) => type === chosenQuote || transferRateOptions(fromCurrency, toCurrency).includes(type)
            ),
        [chosenQuote, fromCurrency, toCurrency]
    );
    const rateTables = useTransferRates(db, [fromCurrency, toCurrency], quotedTypes);
    const tableRates = useMemo(
        () => tableRatesFor(fromCurrency, toCurrency, date, rateTables),
        [fromCurrency, toCurrency, date, rateTables]
    );
    const { quoteType, rateType } = rateChoices(chosenRate, marketType, carriedRate, tableRates.binance);
    const tableRate = tableRates[quoteType];
    const priorCustomRate = usePriorCustomRate(db, fromCurrency, toCurrency, date);
    const ownQuote = savedQuote(saved, pair, quoteType, date);
    const marketRate = ownQuote ?? tableRate;
    const customRate = customRates[pair];
    const rateInverse = customRate?.inverse ?? pairQuotedInverse(fromCurrency, toCurrency, marketRate);
    const quote = (value: number) => quotePairRate(rateInverse, value);
    /** Keyed by pair, so a rate typed for another one does not answer here — and
     * without this the rate list would label the market rate user-authored. */
    const shownRateType = rateType === "custom" && customRate === undefined ? quoteType : rateType;
    const rate = selectedRate(crossCurrency, rateType, pairRate(customRate, marketRate, quote), marketRate);

    function setCustomRateText(text: string, exact: number | null = null) {
        setCustomRates((current) => ({
            ...current,
            [pair]: { exact, inverse: current[pair]?.inverse ?? rateInverse, text },
        }));
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
        { fee, feeSide, rate, sent },
        arrivalPinned ? numpadToNumber(arrivedText) : null,
        {
            fee: feeDecimals,
            from: fromDecimals,
            to: toDecimals,
        },
        crossCurrency,
        feeMode,
        outside
    );

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
        arrivalSeen: !crossCurrency || arrivalPinned || shownPair === pair,
        arrived: math.arrived,
        arrivedText,
        block: math.block,
        canSave: from !== null && to !== null && from.id !== to.id && sent > 0 && math.legs !== null,
        chooseFrom: (account) => {
            if (account) {
                setOutside(false);
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
                setOutside(false);
                pick(account.id, fromId, setToId, setFromId, toId, "to");
            }
        },
        crossCurrency,
        customRatePadText: customRate?.text ?? (marketRate === null ? "" : rateEntryText(quote(marketRate))),
        date,
        fee,
        feeCurrency,
        feeDecimals,
        feeMode,
        feeSide,
        feeText,
        from,
        fromBalance: roundMoney(fromBalance.total, fromDecimals),
        fromBalanceAfter: roundMoney(fromBalance.total + fromRestored - math.paid, fromDecimals),
        fromCurrency,
        fromDecimals,
        gapAmount: math.gap,
        gapFee: math.gapFee,
        gapOnTop: math.gapOnTop,
        legs: math.legs,
        marketRates: marketRatesOf(quoteType, tableRates, ownQuote),
        outside: math.outside,
        paid: math.paid,
        prefillArrival: () => {
            setArrivedText(math.arrived === null ? "" : numberToNumpad(math.arrived, toDecimals));
            setShownPair(pair);
        },
        priorCustomRate,
        quotedRate: rate,
        rateInverse,
        rateOptions: crossCurrency ? transferRateOptions(fromCurrency, toCurrency) : [],
        rateSources: {
            binance: pairRateSource(fromCurrency, toCurrency, date, rateTables.binance),
            custom: null,
            eur_reference: pairRateSource(fromCurrency, toCurrency, date, rateTables.eur_reference),
            official: pairRateSource(fromCurrency, toCurrency, date, rateTables.official),
        },
        rateType: shownRateType,
        resolveAsFee: () => {
            if (math.gapFee !== null && math.net !== null) {
                setFeeText(numberToNumpad(math.gapFee, feeDecimals));
                setFeeMode("included");
                if (feeMode === "onTop" && feeSide === "source") {
                    setSentText(numberToNumpad(math.paid, fromDecimals));
                }
                if (feeMode === "onTop" && feeSide === "destination") {
                    setArrivedText(numberToNumpad(math.net, toDecimals));
                }
            }
        },
        resolveAsOnTop: () => setFeeMode("onTop"),
        sent,
        sentText,
        setArrived: (text) => {
            setOutside(false);
            setArrivedText(text);
            setArrivalPinned(numpadToNumber(text) > 0);
        },
        setCustomRate: (text, exact) => {
            setOutside(false);
            setCustomRateText(text, exact);
        },
        setDate: (next) => {
            setOutside(false);
            setDate(next);
        },
        setFee: (text) => {
            setFeeText(text);
            if (feeMode === "none" && numpadToNumber(text) > 0) {
                setFeeMode("included");
            }
        },
        setFeeMode: (mode) => {
            setFeeMode(mode);
            if (mode === "none") {
                setFeeText("");
            }
        },
        setOutside,
        setRateType: (next) => {
            setOutside(false);
            setChosenRate(next);
            if (next !== "custom") {
                setMarketType(next);
            }
        },
        setSent: (text) => {
            setOutside(false);
            setSentText(text);
        },
        to,
        toBalance: roundMoney(toBalance.total, toDecimals),
        toBalanceAfter: roundMoney(toBalance.total + toRestored + (math.net ?? 0), toDecimals),
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
        },
    };
}
