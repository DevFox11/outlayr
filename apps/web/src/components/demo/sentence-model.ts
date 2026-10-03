import type { Currency } from "./money";

type Kind = "expense" | "income";
type When = "today" | "yesterday";
export type Step = "account" | "amount" | "category" | "currency" | "merchant" | "when";

export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;
export type Key = (typeof KEYS)[number];

const GUIDED = ["amount", "merchant", "category", "account"] as const;
type GuidedStep = (typeof GUIDED)[number];
const GUIDED_INDEX = new Map<Step, number>(GUIDED.map((step, index) => [step, index]));

export const CURRENCY_CODES = ["USD", "EUR", "MXN", "VES"] as const satisfies readonly Currency[];
export const WHEN_OPTIONS = ["today", "yesterday"] as const satisfies readonly When[];
export const ACCOUNTS = ["Chase", "Apple Card", "Amex Gold", "Zinli", "Cash", "Ally Savings"] as const;
export const CATEGORIES = {
    expense: [
        "Groceries",
        "Dining Out",
        "Coffee",
        "Transport",
        "Shopping",
        "Fashion",
        "Subscriptions",
        "Entertainment",
    ],
    income: ["Paycheck", "Freelance", "Part-Time", "Business", "Investments", "Interest", "Bonus", "Tips"],
} as const satisfies Record<Kind, readonly string[]>;
export const RECENT_MERCHANTS = {
    expense: ["Costco", "Lyft", "Nike", "Target", "GitHub", "Figma"],
    income: ["Upwork", "Deel"],
} as const satisfies Record<Kind, readonly string[]>;
const KNOWN_MERCHANTS = new Map([
    ["costco", "Groceries"],
    ["figma", "Subscriptions"],
    ["github", "Subscriptions"],
    ["lyft", "Transport"],
    ["nike", "Fashion"],
    ["target", "Shopping"],
]);

const MAX_INTEGER_DIGITS = 7;
export const MAX_NAME_LENGTH = 50;
const LOG_ROWS = 3;
const AIM_MS = 220;
const SAVE_MS = 1100;
const AFTER_SAVE_MS = 1500;
export const RESUME_MS = 10_000;

export interface Draft {
    account: string | null;
    amount: string;
    category: string | null;
    categoryChosen: boolean;
    currency: Currency;
    kind: Kind;
    merchant: string;
    when: When;
}

interface Row {
    amount: number;
    category: string;
    currency: Currency;
    id: number;
    income: boolean;
    merchant: string;
}

type Move =
    | { type: "choose"; value: string }
    | { type: "currency"; value: Currency }
    | { type: "footer" }
    | { type: "key"; key: Key }
    | { type: "kind" }
    | { type: "open"; step: Step }
    | { type: "when"; value: When };

type VisitorAction = Move | { type: "name"; value: string };
type Action = VisitorAction | { type: "auto" } | { type: "restart" };
export type FocusIntent = "lost" | "stage" | null;
export type Visit = (action: VisitorAction, focus?: FocusIntent) => void;

export type Target = "footer" | "kind" | `key:${Key}` | `option:${string}` | `slot:${Step}`;

export interface State {
    aim: Target | null;
    cursor: number;
    draft: Draft;
    log: readonly Row[];
    nextId: number;
    step: Step;
}

interface Entry {
    account: string;
    category: string;
    currency: Currency;
    keys: readonly Key[];
    kind: Kind;
    merchant: string;
    when: When;
}

export const BLANK: Draft = {
    account: null,
    amount: "",
    category: null,
    categoryChosen: false,
    currency: "USD",
    kind: "expense",
    merchant: "",
    when: "today",
};

const FIRST_ENTRY: Entry = {
    account: "Chase",
    category: "Groceries",
    currency: "USD",
    keys: ["4", "2"],
    kind: "expense",
    merchant: "Costco",
    when: "today",
};

const ENTRIES: readonly Entry[] = [
    FIRST_ENTRY,
    {
        account: "Apple Card",
        category: "Transport",
        currency: "USD",
        keys: ["1", "4", ".", "6"],
        kind: "expense",
        merchant: "Lyft",
        when: "today",
    },
    {
        account: "Zinli",
        category: "Freelance",
        currency: "USD",
        keys: ["1", "4", "5", "0"],
        kind: "income",
        merchant: "Upwork",
        when: "yesterday",
    },
    {
        account: "Amex Gold",
        category: "Fashion",
        currency: "EUR",
        keys: ["8", "9"],
        kind: "expense",
        merchant: "Nike",
        when: "today",
    },
];

const SEED_LOG: readonly Row[] = [
    { amount: 15, category: "Subscriptions", currency: "USD", id: 3, income: false, merchant: "Figma" },
    { amount: 54.28, category: "Shopping", currency: "USD", id: 2, income: false, merchant: "Target" },
    { amount: 4, category: "Subscriptions", currency: "USD", id: 1, income: false, merchant: "GitHub" },
];

const PACE = {
    choose: 750,
    currency: 700,
    footer: 650,
    key: 260,
    kind: 900,
    open: 850,
    when: 700,
} as const satisfies Record<Move["type"], number>;

export function press(current: string, key: Key): string {
    if (key === "back") {
        return current.slice(0, -1);
    }
    if (key === ".") {
        if (current.includes(".")) {
            return current;
        }
        return current === "" ? "0." : `${current}.`;
    }
    const [integer = "", fraction] = current.split(".");
    if (fraction !== undefined) {
        return fraction.length >= 2 ? current : `${current}${key}`;
    }
    const next = integer === "0" ? key : `${integer}${key}`;
    return next.length > MAX_INTEGER_DIGITS ? current : next;
}

export function amountOf(draft: Draft): number {
    const value = Number.parseFloat(draft.amount);
    return Number.isFinite(value) ? value : 0;
}

function suggestedCategory(kind: Kind, merchant: string): string | null {
    return kind === "expense" ? (KNOWN_MERCHANTS.get(merchant.trim().toLowerCase()) ?? null) : null;
}

function answered(draft: Draft, step: GuidedStep): boolean {
    switch (step) {
        case "amount": {
            return amountOf(draft) > 0;
        }
        case "merchant": {
            return draft.merchant.trim() !== "";
        }
        case "category": {
            return draft.category !== null;
        }
        default: {
            return draft.account !== null;
        }
    }
}

export function isWhole(draft: Draft): boolean {
    return amountOf(draft) > 0 && draft.category !== null && draft.account !== null;
}

function nextMissing(draft: Draft, from: number): GuidedStep | null {
    return GUIDED.slice(from).find((step) => !answered(draft, step)) ?? null;
}

function afterStep(step: Step): number {
    return (GUIDED_INDEX.get(step) ?? -1) + 1;
}

function advance(state: State, draft: Draft, from: Step): State {
    return { ...state, draft, step: nextMissing(draft, afterStep(from)) ?? "amount" };
}

function named(draft: Draft, merchant: string): Draft {
    if (draft.categoryChosen) {
        return { ...draft, merchant };
    }
    return { ...draft, category: suggestedCategory(draft.kind, merchant), merchant };
}

function save(state: State): State {
    const { draft } = state;
    const category = draft.category ?? "";
    const merchant = draft.merchant.trim();
    const row: Row = {
        amount: amountOf(draft),
        category,
        currency: draft.currency,
        id: state.nextId,
        income: draft.kind === "income",
        merchant,
    };
    return {
        ...state,
        draft: BLANK,
        log: [row, ...state.log].slice(0, LOG_ROWS),
        nextId: state.nextId + 1,
        step: "amount",
    };
}

function choose(state: State, value: string): State {
    const { draft } = state;
    if (state.step === "merchant") {
        return { ...state, draft: named(draft, value) };
    }
    if (state.step === "category") {
        return advance(state, { ...draft, category: value, categoryChosen: true }, "category");
    }
    if (state.step === "account") {
        return advance(state, { ...draft, account: value }, "account");
    }
    return state;
}

function apply(state: State, action: VisitorAction): State {
    const { draft } = state;
    switch (action.type) {
        case "kind": {
            const kind = draft.kind === "expense" ? "income" : "expense";
            return { ...state, draft: { ...draft, category: null, categoryChosen: false, kind } };
        }
        case "open": {
            return { ...state, step: action.step };
        }
        case "key": {
            return { ...state, draft: { ...draft, amount: press(draft.amount, action.key) } };
        }
        case "name": {
            return { ...state, draft: named(draft, action.value) };
        }
        case "currency": {
            return { ...state, draft: { ...draft, currency: action.value }, step: "amount" };
        }
        case "when": {
            return advance(state, { ...draft, when: action.value }, "when");
        }
        case "choose": {
            return choose(state, action.value);
        }
        default: {
            if (isWhole(draft)) {
                return save(state);
            }
            return {
                ...state,
                step: nextMissing(draft, afterStep(state.step)) ?? nextMissing(draft, 0) ?? "amount",
            };
        }
    }
}

function movesFor(entry: Entry): Move[] {
    const moves: Move[] = [];
    if (entry.kind === "income") {
        moves.push({ type: "kind" });
    }
    if (entry.currency !== BLANK.currency) {
        moves.push({ step: "currency", type: "open" }, { type: "currency", value: entry.currency });
    }
    for (const key of entry.keys) {
        moves.push({ key, type: "key" });
    }
    moves.push({ type: "footer" }, { type: "choose", value: entry.merchant }, { type: "footer" });
    if (suggestedCategory(entry.kind, entry.merchant) !== entry.category) {
        moves.push({ type: "choose", value: entry.category });
    }
    moves.push({ type: "choose", value: entry.account });
    if (entry.when !== BLANK.when) {
        moves.push({ step: "when", type: "open" }, { type: "when", value: entry.when });
    }
    moves.push({ type: "footer" });
    return moves;
}

const PLAYS = ENTRIES.map(movesFor);
const SCRIPT = PLAYS.flat();
const ENTRY_STARTS = PLAYS.map((_, index) => PLAYS.slice(0, index).reduce((total, moves) => total + moves.length, 0));

function targetOf(move: Move): Target {
    switch (move.type) {
        case "footer":
        case "kind": {
            return move.type;
        }
        case "key": {
            return `key:${move.key}`;
        }
        case "open": {
            return `slot:${move.step}`;
        }
        default: {
            return `option:${move.value}`;
        }
    }
}

function autoplay(state: State): State {
    const move = SCRIPT[state.cursor];
    if (move === undefined) {
        return state;
    }
    if (state.aim === null) {
        return { ...state, aim: targetOf(move) };
    }
    return { ...apply(state, move), aim: null, cursor: (state.cursor + 1) % SCRIPT.length };
}

export function reduce(state: State, action: Action): State {
    if (action.type === "auto") {
        return autoplay(state);
    }
    if (action.type === "restart") {
        const cursor = ENTRY_STARTS.findLast((start) => start <= state.cursor) ?? 0;
        return { ...state, aim: null, cursor, draft: BLANK, step: "amount" };
    }
    return { ...apply(state, action), aim: null };
}

export function delayOf(state: State): number {
    const move = SCRIPT[state.cursor];
    if (state.aim !== null || move === undefined) {
        return AIM_MS;
    }
    const settle = ENTRY_STARTS.includes(state.cursor) ? AFTER_SAVE_MS : 0;
    const saving = move.type === "footer" && isWhole(state.draft);
    return settle + (saving ? SAVE_MS : PACE[move.type]);
}

export const INITIAL: State = {
    aim: null,
    cursor: movesFor(FIRST_ENTRY).length - 1,
    draft: {
        account: FIRST_ENTRY.account,
        amount: FIRST_ENTRY.keys.reduce(press, ""),
        category: FIRST_ENTRY.category,
        categoryChosen: false,
        currency: FIRST_ENTRY.currency,
        kind: FIRST_ENTRY.kind,
        merchant: FIRST_ENTRY.merchant,
        when: FIRST_ENTRY.when,
    },
    log: SEED_LOG,
    nextId: SEED_LOG.length + 1,
    step: "amount",
};
