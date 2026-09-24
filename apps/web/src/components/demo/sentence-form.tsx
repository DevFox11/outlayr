import { useEffect, useEffectEvent, useId, useReducer, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import { useIntlayer } from "react-intlayer";

import { formatMoney, signedMoney } from "./money";
import type { Currency } from "./money";
import { useAutoplay } from "./use-autoplay";
import { useNames } from "./use-names";

type Kind = "expense" | "income";
type When = "today" | "yesterday";
type Step = "account" | "amount" | "category" | "currency" | "merchant" | "when";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;
type Key = (typeof KEYS)[number];

const GUIDED = ["amount", "merchant", "category", "account"] as const;
type GuidedStep = (typeof GUIDED)[number];
const GUIDED_INDEX = new Map<Step, number>(GUIDED.map((step, index) => [step, index]));

const CURRENCY_CODES = ["USD", "EUR", "MXN", "VES"] as const satisfies readonly Currency[];
const WHEN_OPTIONS = ["today", "yesterday"] as const satisfies readonly When[];
const ACCOUNTS = ["Chase", "Apple Card", "Amex Gold", "Zinli", "Cash", "Ally Savings"] as const;
const CATEGORIES = {
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
const RECENT_MERCHANTS = {
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
const MAX_NAME_LENGTH = 50;
const LOG_ROWS = 3;
const AIM_MS = 220;
const SAVE_MS = 1100;
const AFTER_SAVE_MS = 1500;
const RESUME_MS = 10_000;

interface Draft {
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
type FocusIntent = "lost" | "stage" | null;
type Visit = (action: VisitorAction, focus?: FocusIntent) => void;

type Target = "footer" | "kind" | `key:${Key}` | `option:${string}` | `slot:${Step}`;

interface State {
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

const BLANK: Draft = {
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

function press(current: string, key: Key): string {
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

function amountOf(draft: Draft): number {
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

function isWhole(draft: Draft): boolean {
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

function reduce(state: State, action: Action): State {
    if (action.type === "auto") {
        return autoplay(state);
    }
    if (action.type === "restart") {
        const cursor = ENTRY_STARTS.findLast((start) => start <= state.cursor) ?? 0;
        return { ...state, aim: null, cursor, draft: BLANK, step: "amount" };
    }
    return { ...apply(state, action), aim: null };
}

function delayOf(state: State): number {
    const move = SCRIPT[state.cursor];
    if (state.aim !== null || move === undefined) {
        return AIM_MS;
    }
    const settle = ENTRY_STARTS.includes(state.cursor) ? AFTER_SAVE_MS : 0;
    const saving = move.type === "footer" && isWhole(state.draft);
    return settle + (saving ? SAVE_MS : PACE[move.type]);
}

const INITIAL: State = {
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

const HAIRLINE_GRID = "border-background/35 border-t border-l";
const CELL = "border-background/35 border-r border-b transition-colors duration-150 ease-out";

export function SentenceForm() {
    const { added, blank, cta, kind, lead, log, sentence, sizer, steps } = useIntlayer("demo");
    const nameOf = useNames();
    const root = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<FocusIntent>(null);
    const stageId = useId();
    const { running } = useAutoplay(root);
    const [state, dispatch] = useReducer(reduce, INITIAL);
    const [edited, setEdited] = useState(false);
    const [idle, setIdle] = useState(true);
    const [touches, setTouches] = useState(0);
    const [focusWithin, setFocusWithin] = useState(false);
    const [announcement, setAnnouncement] = useState<ReactNode>(null);

    const live = running && idle && !edited && !focusWithin;
    const tick = useEffectEvent(() => dispatch({ type: "auto" }));

    useEffect(() => {
        if (!live) {
            return;
        }
        const timer = window.setTimeout(tick, delayOf(state));
        return () => window.clearTimeout(timer);
    }, [live, state]);

    useEffect(() => {
        if (idle || edited || focusWithin || !running) {
            return;
        }
        const timer = window.setTimeout(() => {
            setIdle(true);
            dispatch({ type: "restart" });
        }, RESUME_MS);
        return () => window.clearTimeout(timer);
    }, [edited, focusWithin, idle, running, touches]);

    useEffect(() => {
        const want = pendingFocus.current;
        pendingFocus.current = null;
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (want === "stage" || (want === "lost" && lost)) {
            stage.current?.focus({ preventScroll: true });
        }
    });

    const visit: Visit = (action, focus = "lost") => {
        const edits = action.type !== "open" && !(action.type === "footer" && !isWhole(state.draft));
        if (action.type === "footer" && isWhole(state.draft)) {
            const merchant = state.draft.merchant.trim() || nameOf(state.draft.category ?? "");
            const money = signedMoney(amountOf(state.draft), state.draft.currency, state.draft.kind === "income");
            setAnnouncement(added({ merchant, money }));
        }
        pendingFocus.current = focus;
        dispatch(action);
        setIdle(false);
        setTouches((count) => count + 1);
        if (edits) {
            setEdited(true);
        }
    };

    const onBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocusWithin(false);
        }
    };

    const { aim, draft, step } = state;
    const whole = isWhole(draft);
    const open = (next: Step) => visit({ step: next, type: "open" }, "stage");

    return (
        <div
            className="selection:bg-background selection:text-tint [&_:focus-visible]:outline-background grid gap-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 [&_button]:cursor-pointer"
            onBlur={onBlur}
            onFocus={() => setFocusWithin(true)}
            ref={root}
        >
            <div>
                <h2 className="text-poster grid max-w-[16em] font-bold">
                    <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                        {sizer}
                    </span>
                    <span className="col-start-1 row-start-1">
                        {sentence[draft.kind]({
                            account: (
                                <Slot
                                    active={step === "account"}
                                    aimed={aim === "slot:account"}
                                    blank={draft.account === null}
                                    controls={stageId}
                                    onPress={() => open("account")}
                                >
                                    {draft.account === null ? blank.account : nameOf(draft.account)}
                                </Slot>
                            ),
                            amount: (
                                <span className="whitespace-nowrap">
                                    <Slot
                                        active={step === "amount"}
                                        aimed={aim === "slot:amount"}
                                        blank={amountOf(draft) === 0}
                                        controls={stageId}
                                        onPress={() => open("amount")}
                                    >
                                        {formatMoney(amountOf(draft), draft.currency)}
                                    </Slot>
                                    <CodeButton
                                        active={step === "currency"}
                                        aimed={aim === "slot:currency"}
                                        className="ml-[0.2em] text-[0.34em]"
                                        code={draft.currency}
                                        controls={stageId}
                                        onPress={() => open("currency")}
                                    />
                                </span>
                            ),
                            category: (
                                <Slot
                                    active={step === "category"}
                                    aimed={aim === "slot:category"}
                                    blank={draft.category === null}
                                    controls={stageId}
                                    onPress={() => open("category")}
                                >
                                    {draft.category === null ? blank.category : nameOf(draft.category)}
                                </Slot>
                            ),
                            kind: (
                                <Slot aimed={aim === "kind"} onPress={() => visit({ type: "kind" })}>
                                    {kind[draft.kind]}
                                    <SwapGlyph />
                                </Slot>
                            ),
                            merchant: (
                                <Slot
                                    active={step === "merchant"}
                                    aimed={aim === "slot:merchant"}
                                    blank={draft.merchant.trim() === ""}
                                    controls={stageId}
                                    onPress={() => open("merchant")}
                                >
                                    {draft.merchant.trim() === "" ? blank.merchant : draft.merchant}
                                </Slot>
                            ),
                            when: (
                                <Slot
                                    active={step === "when"}
                                    aimed={aim === "slot:when"}
                                    controls={stageId}
                                    onPress={() => open("when")}
                                >
                                    {nameOf(draft.when)}
                                </Slot>
                            ),
                        })}
                    </span>
                </h2>
                <p className="text-lead mt-8 max-w-[30rem]">{lead}</p>
            </div>

            <div>
                <div id={stageId} ref={stage} tabIndex={-1}>
                    <div className="border-background flex h-11 items-center justify-between gap-4 border-t">
                        <span className="text-micro font-mono uppercase">{steps[step]}</span>
                        {step === "amount" ? (
                            <CodeButton
                                aimed={aim === "slot:currency"}
                                className="text-micro px-1 py-1"
                                code={draft.currency}
                                controls={stageId}
                                onPress={() => open("currency")}
                                withChevron
                            />
                        ) : null}
                    </div>
                    <div className="h-48">
                        <StageBody aim={aim} draft={draft} step={step} visit={visit} />
                    </div>
                    <button
                        className={`bg-background text-tint mt-4 h-12 w-full font-semibold transition-opacity duration-150 ease-out ${aim === "footer" ? "opacity-80" : ""}`}
                        onClick={() => visit({ type: "footer" })}
                        type="button"
                    >
                        {whole ? cta.add : cta.next}
                    </button>
                </div>

                <div className="mt-10">
                    <p className="text-micro border-background border-b pb-2 font-mono uppercase">{log}</p>
                    <ol>
                        {state.log.map((row) => (
                            <li
                                className="border-background/35 flex items-baseline justify-between gap-4 border-b py-3 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:-translate-y-1 starting:opacity-0"
                                key={row.id}
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{row.merchant || nameOf(row.category)}</p>
                                    <p className="text-background mt-0.5 flex items-center gap-1.5 text-sm">
                                        <span className="truncate">{nameOf(row.category)}</span>
                                        {row.currency === BLANK.currency ? null : (
                                            <span className="border-background/60 border px-1 font-mono text-[0.625rem] leading-4">
                                                {row.currency}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <span className="shrink-0 font-mono tabular-nums">
                                    {signedMoney(row.amount, row.currency, row.income)}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            <p aria-live="polite" className="sr-only">
                {announcement}
            </p>
        </div>
    );
}

function StageBody({ aim, draft, step, visit }: { aim: Target | null; draft: Draft; step: Step; visit: Visit }) {
    const content = useIntlayer("demo");
    const nameOf = useNames();
    switch (step) {
        case "amount": {
            return (
                <div className={`grid h-full grid-cols-3 grid-rows-4 ${HAIRLINE_GRID}`}>
                    {KEYS.map((key) => (
                        <button
                            aria-label={key === "back" ? content.delete.value : undefined}
                            className={`${CELL} text-lead flex items-center justify-center font-mono ${aim === `key:${key}` ? "bg-background/25" : ""}`}
                            key={key}
                            onClick={() => visit({ key, type: "key" })}
                            type="button"
                        >
                            {key === "back" ? <DeleteGlyph /> : key}
                        </button>
                    ))}
                </div>
            );
        }
        case "currency": {
            return (
                <Options
                    aim={aim}
                    onPick={(value) => visit({ type: "currency", value })}
                    detail={(code) => content.currencies[code].value}
                    labelClassName="font-mono text-sm"
                    selected={draft.currency}
                    values={CURRENCY_CODES}
                />
            );
        }
        case "merchant": {
            return (
                <div className="flex h-full flex-col">
                    <input
                        aria-label={content.merchantField.value}
                        autoComplete="off"
                        className="border-background placeholder:text-background focus-visible:bg-background/10 h-12 w-full shrink-0 border-b-2 bg-transparent text-base"
                        maxLength={MAX_NAME_LENGTH}
                        onChange={(event) => visit({ type: "name", value: event.target.value }, null)}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                visit({ type: "footer" }, null);
                            }
                        }}
                        placeholder={content.merchantPlaceholder.value}
                        spellCheck={false}
                        type="text"
                        value={draft.merchant}
                    />
                    <div className="mt-3 min-h-0 flex-1">
                        <Options
                            aim={aim}
                            onPick={(value) => visit({ type: "choose", value })}
                            rows="auto-rows-[2.75rem]"
                            selected={draft.merchant.trim()}
                            values={RECENT_MERCHANTS[draft.kind]}
                        />
                    </div>
                </div>
            );
        }
        case "category": {
            return (
                <Options
                    aim={aim}
                    label={nameOf}
                    onPick={(value) => visit({ type: "choose", value })}
                    selected={draft.category}
                    values={CATEGORIES[draft.kind]}
                />
            );
        }
        case "account": {
            return (
                <Options
                    aim={aim}
                    label={nameOf}
                    onPick={(value) => visit({ type: "choose", value })}
                    selected={draft.account}
                    values={ACCOUNTS}
                />
            );
        }
        default: {
            return (
                <Options
                    aim={aim}
                    label={nameOf}
                    onPick={(value) => visit({ type: "when", value })}
                    selected={draft.when}
                    values={WHEN_OPTIONS}
                />
            );
        }
    }
}

function asIs(value: string) {
    return value;
}

function Options<T extends string>({
    aim,
    detail,
    label = asIs,
    labelClassName = "",
    onPick,
    rows = "auto-rows-[3rem]",
    selected,
    values,
}: {
    aim: Target | null;
    detail?: (value: T) => string;
    label?: (value: T) => string;
    labelClassName?: string;
    onPick: (value: T) => void;
    rows?: string;
    selected: string | null;
    values: readonly T[];
}) {
    return (
        <div className={`grid grid-cols-2 ${rows} ${HAIRLINE_GRID}`}>
            {values.map((value) => {
                const chosen = value === selected;
                let tone = "";
                if (chosen) {
                    tone = "bg-background text-tint";
                } else if (aim === `option:${value}`) {
                    tone = "bg-background/25";
                }
                return (
                    <button
                        aria-pressed={chosen}
                        className={`${CELL} flex min-w-0 flex-col items-start justify-center px-3 text-left ${tone}`}
                        key={value}
                        onClick={() => onPick(value)}
                        type="button"
                    >
                        <span className={`w-full truncate ${labelClassName}`}>{label(value)}</span>
                        {detail === undefined ? null : (
                            <span className="w-full truncate text-xs opacity-75">{detail(value)}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

function Slot({
    active = false,
    aimed = false,
    blank = false,
    children,
    controls,
    onPress,
}: {
    active?: boolean;
    aimed?: boolean;
    blank?: boolean;
    children: ReactNode;
    controls?: string;
    onPress: () => void;
}) {
    let tone = "decoration-background/70";
    if (active || aimed) {
        tone = "bg-background/15 decoration-background";
    } else if (blank) {
        tone = "text-background/75 decoration-background/60 decoration-dashed";
    }
    return (
        <button
            aria-controls={controls}
            aria-expanded={controls === undefined ? undefined : active}
            className={`underline decoration-2 underline-offset-[0.14em] transition-colors duration-150 ease-out ${tone}`}
            onClick={onPress}
            type="button"
        >
            {children}
        </button>
    );
}

function CodeButton({
    active = false,
    aimed,
    className,
    code,
    controls,
    onPress,
    withChevron = false,
}: {
    active?: boolean;
    aimed: boolean;
    className: string;
    code: Currency;
    controls: string;
    onPress: () => void;
    withChevron?: boolean;
}) {
    const { currency } = useIntlayer("demo");
    return (
        <button
            aria-controls={controls}
            aria-expanded={active}
            aria-label={currency({ code }).value}
            className={`inline-flex items-center gap-1 align-baseline font-mono font-medium tracking-[0.08em] transition-colors duration-150 ease-out ${active || aimed ? "bg-background/15" : ""} ${className}`}
            onClick={onPress}
            type="button"
        >
            {code}
            {withChevron ? <ChevronGlyph /> : null}
        </button>
    );
}

function SwapGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="ml-[0.12em] inline size-[0.4em] align-[0.12em]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
        >
            <path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" />
        </svg>
    );
}

function ChevronGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

function DeleteGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            viewBox="0 0 24 24"
        >
            <path d="M9 5h11v14H9l-6-7zM13 9l5 6M18 9l-5 6" />
        </svg>
    );
}
