import { posthog } from "posthog-js";
import { useEffect, useEffectEvent, useId, useReducer, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import { useIntlayer } from "react-intlayer";

import { formatMoney, signedMoney } from "./money";
import type { Currency } from "./money";
import {
    ACCOUNTS,
    BLANK,
    CATEGORIES,
    CURRENCY_CODES,
    INITIAL,
    KEYS,
    MAX_NAME_LENGTH,
    RECENT_MERCHANTS,
    RESUME_MS,
    WHEN_OPTIONS,
    amountOf,
    delayOf,
    isWhole,
    reduce,
} from "./sentence-model";
import type { Draft, FocusIntent, Step, Target, Visit } from "./sentence-model";
import { useAutoplay } from "./use-autoplay";
import { useNames } from "./use-names";

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
            posthog.capture("demo_entry_added", { currency: state.draft.currency, kind: state.draft.kind });
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
