import { describe, expect, it } from "@jest/globals";

import {
    judgeSilence,
    localIsoDate,
    MAX_RECORDING_MS,
    meterToLevel,
    NO_SPEECH_TIMEOUT_MS,
    draftDelta,
    proposedDraftOf,
    resolveVoiceDraft,
    savableEntry,
    savableTransfer,
    spokenDateToLocal,
    voiceTurnsOf,
    TRAILING_SILENCE_MS,
} from "./voice-entry";

const NOW = new Date(2026, 8, 3, 14, 30, 0);

const DRAFT = {
    accountName: "amex",
    amount: 12.5,
    categoryName: "coffee",
    currency: null,
    date: "2026-09-02",
    details: null,
    domain: "starbucks.com",
    income: false,
    kind: "entry" as const,
    merchant: "Starbucks",
    recurrence: null,
};

const TRANSFER = {
    amount: 500,
    currency: null,
    date: "2026-09-03",
    details: null,
    fromAccountName: "checking",
    kind: "transfer" as const,
    toAccountName: "Savings",
};

const CATEGORIES = [
    { id: "cat-coffee", income: false, name: "Coffee" },
    { id: "cat-salary", income: true, name: "Salary" },
    { id: "cat-refund", income: true, name: "Coffee" },
];

const ACCOUNTS = [
    { currency: "USD", id: "acc-amex", name: "Amex" },
    { currency: "USD", id: "acc-check", name: "Checking" },
    { currency: "EUR", id: "acc-eur", name: "Savings" },
];

const resolve = (draft: Parameters<typeof resolveVoiceDraft>[0]["draft"]) =>
    resolveVoiceDraft({ accounts: ACCOUNTS, categories: CATEGORIES, currency: "USD", draft, now: NOW });

describe("resolveVoiceDraft", () => {
    it("maps folded names onto ids, on the side of the ledger the draft is on", () => {
        const resolved = resolveVoiceDraft({
            accounts: ACCOUNTS,
            categories: CATEGORIES,
            currency: "USD",
            draft: DRAFT,
            now: NOW,
        });
        expect(resolved).toMatchObject({
            accountId: "acc-amex",
            categoryId: "cat-coffee",
            currency: "USD",
            date: new Date(2026, 8, 2, 12, 0, 0, 0),
            kind: "entry",
            recurrence: null,
        });
    });

    it("rounds the amount to the currency's minor units, on both kinds", () => {
        expect(resolve({ ...DRAFT, amount: 12.505 })).toMatchObject({ amount: 12.5 });
        expect(resolve({ ...DRAFT, amount: 100.6, currency: "JPY" })).toMatchObject({ amount: 101, currency: "JPY" });
        expect(resolve({ ...TRANSFER, amount: 500.004, toAccountName: "Amex" })).toMatchObject({ amount: 500 });
    });

    it("a spoken cadence becomes the stored recurring type and its multiplier", () => {
        const resolved = resolve({ ...DRAFT, recurrence: { every: 2, unit: "week" } });
        expect(resolved).toMatchObject({ recurrence: { coefficient: 2, type: 2 } });
    });

    it("an income draft matches the income category of the same name, never the expense one", () => {
        const resolved = resolveVoiceDraft({
            accounts: ACCOUNTS,
            categories: CATEGORIES,
            currency: "USD",
            draft: { ...DRAFT, income: true },
            now: NOW,
        });
        expect(resolved).toMatchObject({ categoryId: "cat-refund" });
    });

    it("unknown names and a spoken currency come through as null and as given", () => {
        const resolved = resolveVoiceDraft({
            accounts: ACCOUNTS,
            categories: CATEGORIES,
            currency: "USD",
            draft: { ...DRAFT, accountName: "Visa", categoryName: "Toys", currency: "EUR" },
            now: NOW,
        });
        expect(resolved).toMatchObject({ accountId: null, categoryId: null, currency: "EUR" });
    });

    it("a name two accounts or two categories share matches neither", () => {
        const doubled = resolveVoiceDraft({
            accounts: [...ACCOUNTS, { currency: "USD", id: "acc-amex-2", name: "AMEX" }],
            categories: [...CATEGORIES, { id: "cat-coffee-2", income: false, name: "coffee" }],
            currency: "USD",
            draft: DRAFT,
            now: NOW,
        });
        expect(doubled).toMatchObject({ accountId: null, accountUnresolved: true, categoryId: null });
    });

    it("an account named but not placed keeps a categorised draft out of direct save", () => {
        const doubledAccount = resolveVoiceDraft({
            accounts: [...ACCOUNTS, { currency: "USD", id: "acc-amex-2", name: "AMEX" }],
            categories: CATEGORIES,
            currency: "USD",
            draft: DRAFT,
            now: NOW,
        });
        const unnamedAccount = resolve({ ...DRAFT, accountName: null });
        if (doubledAccount.kind !== "entry" || unnamedAccount.kind !== "entry") {
            throw new Error("Expected entry drafts");
        }
        expect(doubledAccount).toMatchObject({ accountUnresolved: true, categoryId: "cat-coffee" });
        expect(savableEntry(doubledAccount)).toBeNull();
        expect(unnamedAccount).toMatchObject({ accountId: null, accountUnresolved: false });
        expect(savableEntry(unnamedAccount)).toStrictEqual({ categoryId: "cat-coffee" });
    });

    it("a transfer resolves both accounts and takes the leaving account's currency when none was said", () => {
        const resolved = resolve({ ...TRANSFER, fromAccountName: "Savings", toAccountName: "Amex" });
        expect(resolved).toMatchObject({
            currency: "EUR",
            fromAccount: { id: "acc-eur" },
            kind: "transfer",
            toAccount: { id: "acc-amex" },
        });
    });

    it("a transfer naming one account twice keeps only the source, and marks the destination unresolved", () => {
        const resolved = resolve({ ...TRANSFER, toAccountName: "Checking" });
        expect(resolved).toMatchObject({ fromAccount: { id: "acc-check" }, toAccount: null, toUnresolved: true });
    });

    it("a transfer leg named but not placed is flagged; an unnamed leg is not", () => {
        expect(resolve({ ...TRANSFER, fromAccountName: "Visa" })).toMatchObject({
            fromAccount: null,
            fromUnresolved: true,
            toUnresolved: false,
        });
        expect(resolve({ ...TRANSFER, toAccountName: null })).toMatchObject({ toAccount: null, toUnresolved: false });
    });
});

describe("savableEntry", () => {
    it("needs a resolved category, an amount that survived rounding, and a merchant", () => {
        const whole = resolve(DRAFT);
        const dust = resolve({ ...DRAFT, amount: 0.001 });
        const uncategorised = resolve({ ...DRAFT, categoryName: "Toys" });
        if (whole.kind !== "entry" || dust.kind !== "entry" || uncategorised.kind !== "entry") {
            throw new Error("Expected entry drafts");
        }
        const nameless = resolve({ ...DRAFT, merchant: "  " });
        if (nameless.kind !== "entry") {
            throw new Error("Expected an entry draft");
        }
        expect(savableEntry(whole)).toStrictEqual({ categoryId: "cat-coffee" });
        expect(savableEntry(dust)).toBeNull();
        expect(savableEntry(uncategorised)).toBeNull();
        expect(savableEntry(nameless)).toBeNull();
    });
});

describe("savableTransfer", () => {
    it("needs both accounts in the amount's currency; a cross-currency move goes to the editor", () => {
        const same = resolve({ ...TRANSFER, toAccountName: "Amex" });
        const cross = resolve(TRANSFER);
        const missing = resolve({ ...TRANSFER, toAccountName: "Visa" });
        const dust = resolve({ ...TRANSFER, amount: 0.001, toAccountName: "Amex" });
        if (
            same.kind !== "transfer" ||
            cross.kind !== "transfer" ||
            missing.kind !== "transfer" ||
            dust.kind !== "transfer"
        ) {
            throw new Error("Expected transfer drafts");
        }
        expect(savableTransfer(same)).toMatchObject({ from: { id: "acc-check" }, to: { id: "acc-amex" } });
        expect(savableTransfer(cross)).toBeNull();
        expect(savableTransfer(missing)).toBeNull();
        expect(savableTransfer(dust)).toBeNull();
    });
});

describe("spokenDateToLocal", () => {
    it("today keeps the clock; another day lands at local noon; junk is now", () => {
        expect(spokenDateToLocal("2026-09-03", NOW)).toBe(NOW);
        expect(spokenDateToLocal("2026-08-30", NOW)).toStrictEqual(new Date(2026, 7, 30, 12));
        expect(spokenDateToLocal("yesterday", NOW)).toBe(NOW);
    });

    it("localIsoDate is the device calendar, zero-padded", () => {
        expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    });
});

describe("meterToLevel", () => {
    it("maps the speech band onto 0–1 and clamps the rest", () => {
        expect(meterToLevel(undefined)).toBe(0);
        expect(meterToLevel(-160)).toBe(0);
        expect(meterToLevel(-45)).toBe(0);
        expect(meterToLevel(-8)).toBe(1);
        expect(meterToLevel(0)).toBe(1);
        expect(meterToLevel(-26.5)).toBeCloseTo(0.5);
    });
});

describe("judgeSilence", () => {
    const start = { lastSpeechAt: null, startedAt: 1000 };

    it("keeps listening through the room until the first word", () => {
        expect(judgeSilence(start, 0.05, 1000 + NO_SPEECH_TIMEOUT_MS - 1).verdict).toBe("keep");
        expect(judgeSilence(start, 0.05, 1000 + NO_SPEECH_TIMEOUT_MS).verdict).toBe("nothingSaid");
    });

    it("a word resets the clock; a trailing silence after it finishes the entry", () => {
        const spoken = judgeSilence(start, 0.6, 5000);
        expect(spoken.verdict).toBe("keep");
        expect(spoken.watch.lastSpeechAt).toBe(5000);
        expect(judgeSilence(spoken.watch, 0.05, 5000 + TRAILING_SILENCE_MS - 1).verdict).toBe("keep");
        expect(judgeSilence(spoken.watch, 0.05, 5000 + TRAILING_SILENCE_MS).verdict).toBe("finished");
    });

    it("the hard cap ends a monologue, and names silence when nothing was ever said", () => {
        const talking = { lastSpeechAt: 1000 + MAX_RECORDING_MS - 10, startedAt: 1000 };
        expect(judgeSilence(talking, 0.8, 1000 + MAX_RECORDING_MS).verdict).toBe("tooLong");
        expect(judgeSilence(start, 0, 1000 + MAX_RECORDING_MS).verdict).toBe("nothingSaid");
    });
});

describe("thread turns", () => {
    const said = { order: 1, parts: [{ type: "text" }], role: "user", status: "success", text: "twenty at netflix" };
    const answered = {
        order: 1,
        parts: [{ output: { draft: DRAFT }, state: "output-available", type: "tool-proposeDraft" }],
        role: "assistant",
        status: "success",
        text: "",
    };
    const pending = {
        order: 2,
        parts: [{ state: "input-streaming", type: "tool-proposeDraft" }],
        role: "assistant",
        status: "streaming",
        text: "",
    };

    it("reads the draft off the tool part once it has output, and nothing before", () => {
        expect(proposedDraftOf(answered)).toStrictEqual({ draft: DRAFT });
        expect(proposedDraftOf(pending)).toBeNull();
        expect(proposedDraftOf(said)).toBeNull();
    });

    it("the strip lists what was said and every answer that reached a draft", () => {
        expect(voiceTurnsOf([said, answered, { ...said, order: 2 }, pending])).toStrictEqual([
            { kind: "said", order: 1, text: "twenty at netflix" },
            { draft: DRAFT, kind: "proposed", order: 1 },
            { kind: "said", order: 2, text: "twenty at netflix" },
        ]);
    });

    it("draftDelta names the fields a correction moved, in names not ids", () => {
        expect(draftDelta(DRAFT, DRAFT)).toStrictEqual([]);
        expect(draftDelta(DRAFT, { ...DRAFT, categoryName: "Groceries", date: "2026-09-03" })).toStrictEqual([
            "date",
            "category",
        ]);
        expect(draftDelta(DRAFT, { ...DRAFT, amount: 15, income: true })).toStrictEqual(["amount", "category"]);
        expect(draftDelta(DRAFT, { ...DRAFT, recurrence: { every: 1, unit: "month" } })).toStrictEqual(["schedule"]);
        expect(draftDelta(DRAFT, { ...DRAFT, details: "for the office" })).toStrictEqual(["details"]);
        expect(draftDelta(DRAFT, TRANSFER)).toStrictEqual(["kind", "amount", "date"]);
        expect(draftDelta(TRANSFER, { ...TRANSFER, toAccountName: "Amex" })).toStrictEqual(["account"]);
    });
});
