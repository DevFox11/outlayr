import Cancel01Icon from "@hugeicons-pro/core-stroke-rounded/Cancel01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Button, Shimmer } from "panelui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { intervalPhrase } from "@/components/custom-schedule-sheet";
import { VoiceOrb } from "@/components/voice/voice-orb";
import type { VoiceOrbState } from "@/components/voice/voice-orb";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { rememberLastUsedAccount } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import { useCategoriesByNamespace } from "@/data/categories";
import { getCategoryById } from "@/data/categories-core";
import { backfillRecurring } from "@/data/recurrence-backfill";
import { transactionsRepo } from "@/data/transactions-core";
import { transfersRepo } from "@/data/transfers-core";
import type { AuthGate } from "@/domain/auth-gate";
import { formatChargeDate, startOfDay } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { boundedPromptNames } from "@/domain/prompt-budget";
import {
    draftDelta,
    resolveRecurrence,
    resolveVoiceDraft,
    savableEntry,
    savableTransfer,
    spokenDateToLocal,
    stillCurrent,
    transferStillCurrent,
} from "@/domain/voice-entry";
import type {
    CategoryCandidate,
    ResolvedVoiceEntry,
    ResolvedVoiceTransfer,
    VoiceDraftField,
    VoiceTurn,
} from "@/domain/voice-entry";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useMerchantMark } from "@/hooks/use-merchant-mark";
import { useVoiceEntry } from "@/hooks/use-voice-entry";
import type { VoiceFailure, VoicePhase } from "@/hooks/use-voice-entry";
import { useLanguage, useTranslation } from "@/i18n/context";
import type { TranslateFn } from "@/i18n/context";
import type { Language } from "@/i18n/languages";
import { useAuthSession } from "@/lib/auth-session";
import type { VoiceDraft } from "@/lib/convex";
import { syncSubscriptionReminders } from "@/lib/subscription-reminder-sync";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

const ORB_SIZE = 180;
/** Once a draft is on screen the orb is a badge above it, not the subject. */
const ORB_SIZE_SETTLED = 120;
/**
 * Where the system puts a sheet's own close: 16pt in from the card's top and
 * trailing edge. The route is a `modal`, a card that already sits under the
 * status bar, so the window's top inset does not apply inside it (adding it put
 * the close a whole status bar too low); the trailing inset still does, for
 * landscape and iPad.
 */
const SHEET_CLOSE_INSET = 16;
/** The orb's own press: a small give, never a bounce, so the tap reads as a touch on glass. */
const ORB_PRESS_SCALE = 0.96;
const ORB_SPRING = { damping: 18, mass: 0.9, stiffness: 170 };
/** The merchant's mark sits in the sentence at the title's cap height, a small squircle. */
const MARK_SIZE = 28;
const MARK_RADIUS = 8;
/** The strip shows the tail of the thread; earlier turns are still in it. */
const STRIP_TURNS = 4;

const FAILURE_KEY = {
    denied: "voice.failed.denied",
    notConfigured: "voice.failed.notConfigured",
    offline: "voice.failed.offline",
    provider: "voice.failed.provider",
    rateLimited: "voice.failed.rateLimited",
    silent: "voice.failed.silent",
    timeout: "voice.failed.timeout",
    unauthenticated: "voice.failed.unauthenticated",
    unclear: "voice.failed.unclear",
} as const satisfies Record<VoiceFailure, string>;

const FIELD_KEY = {
    account: "voice.turn.field.account",
    amount: "voice.turn.field.amount",
    category: "voice.turn.field.category",
    date: "voice.turn.field.date",
    details: "voice.turn.field.details",
    kind: "voice.turn.field.kind",
    merchant: "voice.turn.field.merchant",
    schedule: "voice.turn.field.schedule",
} as const satisfies Record<VoiceDraftField, string>;

function orbStateOf(phase: VoicePhase): VoiceOrbState {
    switch (phase.kind) {
        case "listening": {
            return "listening";
        }
        case "sending":
        case "thinking": {
            return "thinking";
        }
        case "review": {
            return "settled";
        }
        case "failed": {
            return "failed";
        }
        default: {
            return "idle";
        }
    }
}

const ONE_DAY_MS = 86_400_000;

/** "Today", "Yesterday", else the charge date — in the case a sentence reads in. */
function spokenDayLabel(date: Date, now: Date, t: TranslateFn, language: Language): string {
    const target = startOfDay(date).getTime();
    const today = startOfDay(now).getTime();
    if (target === today) {
        return t("common.today");
    }
    if (target === today - ONE_DAY_MS) {
        return t("common.yesterday");
    }
    return formatChargeDate(date, now, language);
}

/**
 * The screen's frame: a close in the top-right where a sheet keeps it, the
 * subject in the middle, and whatever the phase puts on the bottom axis.
 * panelui's `VoiceMode` was tried and set aside: its ambient wash and level
 * pills say "listening" a second and third time when the orb already does,
 * and it pins its own mic and close to the bottom row.
 */
function VoiceShell({
    bottom,
    children,
    closeDisabled = false,
    onClose,
}: {
    bottom: React.ReactNode;
    children: React.ReactNode;
    /** A save in flight owns the screen; leaving under it would let its callbacks land on the wrong route. */
    closeDisabled?: boolean;
    onClose: () => void;
}) {
    const t = useTranslation();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    return (
        <View className="bg-background flex-1">
            <View
                className="flex-row justify-end"
                style={{ paddingRight: SHEET_CLOSE_INSET + insets.right, paddingTop: SHEET_CLOSE_INSET }}
            >
                <Button
                    accessibilityLabel={t("voice.close")}
                    disabled={closeDisabled}
                    glass
                    native
                    onPress={onClose}
                    size="icon"
                    variant="secondary"
                >
                    <HugeiconsIcon color={colors.foreground} icon={Cancel01Icon} size={18} strokeWidth={2} />
                </Button>
            </View>
            <View className="flex-1 items-center justify-center gap-6 px-6">{children}</View>
            <View className="gap-2 px-5" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
                {bottom}
            </View>
        </View>
    );
}

/**
 * The orb is the screen's one control. Tapping it while it listens ends the
 * clip; tapping it after a draft or a failure listens again. It grows and
 * shrinks between the subject of the screen and a badge above the draft with a
 * spring on width, height and scale, so the review line rises into place
 * rather than snapping under it. Reduced motion crossfades the sizes instead.
 */
function OrbControl({
    label,
    level,
    onPress,
    size,
    state,
}: {
    label: string;
    level: SharedValue<number>;
    onPress?: () => void;
    size: number;
    state: VoiceOrbState;
}) {
    const reducedMotion = useReducedMotion();
    const pressed = useSharedValue(1);
    const frame = useSharedValue(size);
    useEffect(() => {
        frame.set(reducedMotion ? withTiming(size, { duration: 160 }) : withSpring(size, ORB_SPRING));
    }, [frame, reducedMotion, size]);
    const box = useAnimatedStyle(() => ({ height: frame.get(), width: frame.get() }));
    const canvas = useAnimatedStyle(() => ({
        transform: [{ scale: (frame.get() / ORB_SIZE) * pressed.get() }],
    }));

    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            disabled={onPress === undefined}
            onPress={onPress}
            onPressIn={() => pressed.set(withSpring(ORB_PRESS_SCALE, ORB_SPRING))}
            onPressOut={() => pressed.set(withSpring(1, ORB_SPRING))}
        >
            <Animated.View className="items-center justify-center" style={box}>
                <Animated.View style={canvas}>
                    <VoiceOrb level={level} size={ORB_SIZE} state={state} />
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
}

/**
 * One line, the way the entry will read on the ledger: the amount, then where
 * it went, then the category and the day. A draft with no category says so in
 * the category's place rather than hiding the gap.
 */
function ReviewLine({ draft, categoryName }: { draft: ResolvedVoiceEntry; categoryName: string | null }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const amount = formatAmount(draft.amount, draft.currency, true, language);
    const day = spokenDayLabel(draft.date, new Date(), t, language);
    const preposition = t(draft.income ? "voice.review.from" : "voice.review.at");
    const mark = useMerchantMark(draft.merchant, draft.domain);

    return (
        <View className="items-center gap-2 px-6">
            <Text
                className={`font-sans-semibold text-hero tabular-nums ${draft.income ? "text-income" : "text-foreground"}`}
            >
                {amount}
            </Text>
            <View className="flex-row items-center justify-center gap-2">
                <Text className="font-sans-medium text-grammar text-title">{preposition}</Text>
                {mark ? (
                    <Animated.View entering={FadeIn.duration(200)}>
                        <Image
                            contentFit="cover"
                            source={{ uri: mark }}
                            style={{ borderRadius: MARK_RADIUS, height: MARK_SIZE, width: MARK_SIZE }}
                        />
                    </Animated.View>
                ) : null}
                <Text className="font-sans-medium text-foreground text-title shrink" numberOfLines={2}>
                    {draft.merchant.trim().length > 0 ? draft.merchant : t("voice.review.noMerchant")}
                </Text>
            </View>
            <Text className="text-muted text-center font-sans text-base" numberOfLines={1}>
                {categoryName ?? t("voice.review.noCategory")}
                {draft.recurrence ? (
                    <>
                        <Text className="text-subtle"> · </Text>
                        {t("transaction.schedule.every", {
                            interval: intervalPhrase(t, draft.recurrence.type, draft.recurrence.coefficient),
                        })}
                    </>
                ) : null}
                <Text className="text-subtle"> · </Text>
                {day}
            </Text>
        </View>
    );
}

/** The same shape for a move: amount, "Checking to Savings", then the kind and the day. */
function TransferReviewLine({ draft }: { draft: ResolvedVoiceTransfer }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const colors = useColors();
    const amount = formatAmount(draft.amount, draft.currency, true, language);
    const day = spokenDayLabel(draft.date, new Date(), t, language);
    const missing = t("voice.review.noAccount");

    return (
        <View className="items-center gap-2 px-6">
            <Text className="font-sans-semibold text-hero tabular-nums" style={{ color: colors.transfer }}>
                {amount}
            </Text>
            <Text className="font-sans-medium text-foreground text-title text-center" numberOfLines={2}>
                {t("voice.review.transfer", {
                    from: draft.fromAccount?.name ?? missing,
                    to: draft.toAccount?.name ?? missing,
                })}
            </Text>
            <Text className="text-muted text-center font-sans text-base" numberOfLines={1}>
                {t("voice.review.transferLabel")}
                <Text className="text-subtle"> · </Text>
                {day}
            </Text>
        </View>
    );
}

/** A sweep across the words while the screen is waiting on something; still once it has an answer. */
const STATUS_SWEEP_MS = 1800;

function StatusLine({ children, waiting = false }: { children: string; waiting?: boolean }) {
    const colors = useColors();
    return (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} key={children}>
            {waiting ? (
                <Shimmer
                    as="text"
                    baseColor={colors.muted}
                    duration={STATUS_SWEEP_MS}
                    shimmerColor={colors.foreground}
                    textClassName="font-sans-medium text-center text-lg"
                >
                    {children}
                </Shimmer>
            ) : (
                <Text className="font-sans-medium text-muted text-center text-lg">{children}</Text>
            )}
        </Animated.View>
    );
}

/** What an answer proposed, in the strip's words: the first as a draft, the rest as what moved. */
function proposedLabel(
    turn: Extract<VoiceTurn, { kind: "proposed" }>,
    previous: VoiceDraft | null,
    t: TranslateFn,
    language: Language
) {
    if (turn.draft === null) {
        return { detail: "", label: t("voice.turn.unclear") };
    }
    if (previous !== null) {
        const moved = draftDelta(previous, turn.draft);
        return {
            detail:
                moved.length === 0 ? t("voice.turn.unchanged") : moved.map((field) => t(FIELD_KEY[field])).join(", "),
            label: t("voice.turn.updated"),
        };
    }
    const now = new Date();
    const day = spokenDayLabel(spokenDateToLocal(turn.draft.date, now), now, t, language);
    const parts = [
        turn.draft.kind === "transfer"
            ? t("voice.review.transfer", {
                  from: turn.draft.fromAccountName ?? t("voice.review.noAccount"),
                  to: turn.draft.toAccountName ?? t("voice.review.noAccount"),
              })
            : (turn.draft.categoryName ?? t("voice.review.noCategory")),
    ];
    if (turn.draft.kind === "entry" && turn.draft.recurrence) {
        const schedule = resolveRecurrence(turn.draft.recurrence);
        if (schedule) {
            parts.push(
                t("transaction.schedule.every", { interval: intervalPhrase(t, schedule.type, schedule.coefficient) })
            );
        }
    }
    parts.push(day);
    return { detail: parts.join(" · "), label: t("voice.turn.draft") };
}

type StripRow =
    | { key: string; kind: "said"; text: string }
    | { detail: string; key: string; kind: "proposed"; label: string };

/** Each answer is labelled against the draft before it, so the walk is in order. */
function stripRows(turns: VoiceTurn[], t: TranslateFn, language: Language): StripRow[] {
    const rows: StripRow[] = [];
    let previous: VoiceDraft | null = null;
    for (const turn of turns) {
        if (turn.kind === "said") {
            rows.push({ key: `said-${turn.order}`, kind: "said", text: turn.text });
            continue;
        }
        rows.push({ key: `proposed-${turn.order}`, kind: "proposed", ...proposedLabel(turn, previous, t, language) });
        previous = turn.draft ?? previous;
    }
    return rows;
}

/** The tail of the thread: what was said, and what each answer made of it. */
function ThreadStrip({ turns }: { turns: VoiceTurn[] }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const rows = useMemo(() => stripRows(turns, t, language).slice(-STRIP_TURNS), [language, t, turns]);

    if (rows.length === 0) {
        return null;
    }
    return (
        <Animated.View className="w-full gap-1.5" entering={FadeIn.duration(220)}>
            {rows.map((row) =>
                row.kind === "said" ? (
                    <View className="bg-foreground/8 max-w-[86%] self-end rounded-2xl px-3 py-1.5" key={row.key}>
                        <Text className="text-foreground font-sans text-sm" numberOfLines={2}>
                            {row.text}
                        </Text>
                    </View>
                ) : (
                    <Text className="text-muted self-start font-sans text-sm" key={row.key} numberOfLines={1}>
                        {row.label}
                        {row.detail ? <Text className="text-subtle"> · </Text> : null}
                        <Text className="font-sans-medium text-foreground">{row.detail}</Text>
                    </Text>
                )
            )}
        </Animated.View>
    );
}

/**
 * The screen before a session exists: the cloud tier is missing, the session
 * is still being read, or nobody is signed in. Nothing to hear yet, so no
 * recorder, no thread, and none of the hooks that need the Convex provider.
 */
function VoiceGateScreen({ gate }: { gate: Exclude<AuthGate, "signed-in"> }) {
    const router = useRouter();
    const t = useTranslation();
    let status = t("voice.state.starting");
    if (gate === "unconfigured") {
        status = t("voice.failed.notConfigured");
    } else if (gate === "signed-out") {
        status = t("voice.failed.unauthenticated");
    }
    return (
        <VoiceShell bottom={null} onClose={() => router.back()}>
            <VoiceOrb size={ORB_SIZE} state={gate === "restoring" ? "idle" : "failed"} />
            <StatusLine waiting={gate === "restoring"}>{status}</StatusLine>
        </VoiceShell>
    );
}

interface BarAction {
    label: string;
    onPress: () => void;
}

/**
 * What a tap on the orb means now: end the clip, or listen again. Nothing
 * while a clip is on its way (the answer is coming) and nothing while a save
 * is in flight (a new clip or the form must not open under a row that is
 * about to commit and leave).
 */
function orbActionOf(
    phase: VoicePhase,
    saving: boolean,
    actions: { finish: () => void; listenAgain: () => void },
    t: TranslateFn
) {
    if (phase.kind === "sending" || phase.kind === "thinking" || phase.kind === "starting") {
        return { label: t("voice.state.thinking"), onPress: undefined };
    }
    if (phase.kind === "review") {
        return { label: t("voice.action.fix"), onPress: saving ? undefined : actions.listenAgain };
    }
    if (phase.kind === "failed") {
        return { label: t("voice.action.retry"), onPress: actions.listenAgain };
    }
    return { label: t("voice.mic.finish"), onPress: actions.finish };
}

function VoiceThreadScreen() {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
    const haptics = useHaptics();
    const { language } = useLanguage();
    const currency = useGlobalCurrency(db);
    const accounts = useAccounts(db);
    const expenseCategories = useCategoriesByNamespace(db, false);
    const incomeCategories = useCategoriesByNamespace(db, true);
    const [saving, setSaving] = useState(false);
    const isMounted = useIsMounted();

    const categoryTree = useMemo(
        () =>
            [...expenseCategories, ...incomeCategories]
                .filter((parent) => parent.name != null)
                .map((parent) => ({
                    children: parent.children.map((child) => child.name).filter((name) => name != null),
                    // SAFETY: filtered to a non-null name just above.
                    name: parent.name as string,
                })),
        [expenseCategories, incomeCategories]
    );
    const candidates = useMemo<CategoryCandidate[]>(
        () =>
            [...expenseCategories, ...incomeCategories].flatMap((parent) => [
                { id: parent.id, income: parent.income, name: parent.name },
                ...parent.children.map((child) => ({ id: child.id, income: child.income, name: child.name })),
            ]),
        [expenseCategories, incomeCategories]
    );
    const bounded = useMemo(
        () => boundedPromptNames({ accounts: accounts.map((account) => account.name), categoryTree }),
        [accounts, categoryTree]
    );
    const request = useMemo(
        () => ({
            accounts: bounded.accounts,
            categoryTree: bounded.categoryTree,
            currency,
            language,
        }),
        [bounded, currency, language]
    );

    // What the draft is read against travels with the request: the ledger the
    // model saw, not the ledger as sync may have left it by the time it answers.
    const context = useMemo(
        () => ({
            accounts: accounts.map((account) => ({
                currency: account.currency,
                id: account.id,
                name: account.name,
            })),
            accountsOmitted: bounded.accountsOmitted,
            categories: candidates,
            categoriesOmitted: bounded.categoriesOmitted,
            currency,
        }),
        [accounts, bounded.accountsOmitted, bounded.categoriesOmitted, candidates, currency]
    );

    const { phase, level, finish, listenAgain, cancel, turns } = useVoiceEntry({ context, request });

    const resolved = useMemo(
        () =>
            phase.kind === "review"
                ? resolveVoiceDraft({ ...phase.context, draft: phase.draft, now: new Date() })
                : null,
        [phase]
    );
    const entry = resolved?.kind === "entry" ? resolved : null;
    const transfer = resolved?.kind === "transfer" ? resolved : null;
    const live = useMemo(
        () => ({
            accountIds: new Set(accounts.map((account) => account.id)),
            categoryIds: new Set(candidates.map((candidate) => candidate.id)),
        }),
        [accounts, candidates]
    );
    const savableCategoryId = entry && stillCurrent(entry, live) ? (savableEntry(entry)?.categoryId ?? null) : null;
    const categoryName = entry?.categoryId ? (getCategoryById(db, entry.categoryId)?.name ?? null) : null;

    const close = useCallback(() => {
        cancel();
        router.back();
    }, [cancel, router]);

    const openForm = useCallback(
        (draft: ResolvedVoiceEntry) => {
            // An account sync removed since the draft resolved is a question for
            // the form, not a seed the form would quietly swap for the last used.
            const accountLive = draft.accountId === null || live.accountIds.has(draft.accountId);
            const params = {
                accountId: accountLive ? (draft.accountId ?? undefined) : undefined,
                accountUnresolved: draft.accountUnresolved || !accountLive ? "1" : undefined,
                amount: String(draft.amount),
                categoryId: draft.categoryId ?? undefined,
                currency: draft.currency,
                date: String(draft.date.getTime()),
                details: draft.details ?? undefined,
                income: draft.income ? "1" : "0",
                note: draft.merchant,
                recurringCoefficient: draft.recurrence ? String(draft.recurrence.coefficient) : undefined,
                recurringType: draft.recurrence ? String(draft.recurrence.type) : undefined,
            };
            router.replace({ params, pathname: "/transactions/create" });
        },
        [live, router]
    );

    const openTransferForm = useCallback(
        (draft: ResolvedVoiceTransfer) => {
            // A leg sync removed since the draft resolved is a question for the
            // editor, not a seed it would quietly swap for the first account.
            const leg = (account: { id: string } | null, unresolved: boolean) => {
                const current = account !== null && live.accountIds.has(account.id);
                return {
                    id: current ? account.id : undefined,
                    unresolved: unresolved || (account !== null && !current),
                };
            };
            const from = leg(draft.fromAccount, draft.fromUnresolved);
            const to = leg(draft.toAccount, draft.toUnresolved);
            const params = {
                amount: String(draft.amount),
                currency: draft.currency,
                date: String(draft.date.getTime()),
                fromAccountId: from.id,
                fromUnresolved: from.unresolved ? "1" : undefined,
                note: draft.details ?? undefined,
                toAccountId: to.id,
                toUnresolved: to.unresolved ? "1" : undefined,
            };
            router.replace({ params, pathname: "/transactions/transfers/create" });
        },
        [live, router]
    );

    const save = useCallback(
        (draft: ResolvedVoiceEntry, categoryId: string) => {
            setSaving(true);
            const write = async () => {
                let id: string;
                try {
                    id = await transactionsRepo.create(db, {
                        accountId: draft.accountId,
                        amount: draft.amount,
                        categoryId,
                        currency: draft.currency,
                        date: draft.date,
                        details: draft.details,
                        income: draft.income,
                        note: draft.merchant,
                        onceRecurring: draft.recurrence !== null,
                        recurringCoefficient: draft.recurrence?.coefficient,
                        recurringType: draft.recurrence?.type,
                    });
                } catch {
                    // The row did not land; the form has the failure strip this screen lacks.
                    setSaving(false);
                    if (isMounted()) {
                        openForm(draft);
                    }
                    return;
                }
                // Past this line the row is committed, so nothing below may send
                // the person back to a form that would write it a second time.
                if (draft.recurrence) {
                    try {
                        // What the form does after its own save: the schedule's past
                        // charges land now, and the chain's next date moves forward.
                        await backfillRecurring(db, id);
                    } catch (error) {
                        console.error("Failed to back-fill the spoken subscription", error);
                    }
                    // And its due-date reminder is scheduled now, not on the next
                    // app resume, which may come after the date it was for.
                    syncSubscriptionReminders(db).catch((error) => {
                        console.error("Failed to sync subscription reminders", error);
                    });
                }
                if (draft.accountId) {
                    await rememberLastUsedAccount(db, draft.accountId).catch(() => null);
                }
                haptics("success");
                // A modal gesture can dismiss this screen mid-write; popping again
                // would take the screen underneath with it.
                if (isMounted()) {
                    router.back();
                }
            };
            void write();
        },
        [db, haptics, isMounted, openForm, router]
    );

    /** Same-currency legs only, by `savableTransfer`; the rate is 1 and no fee is spoken. */
    const saveTransfer = useCallback(
        (draft: ResolvedVoiceTransfer, from: { id: string }, to: { id: string }) => {
            setSaving(true);
            const write = async () => {
                try {
                    await transfersRepo.create(db, {
                        date: draft.date,
                        exchangeRate: 1,
                        exchangeRateType: null,
                        fromAccountId: from.id,
                        fromAmount: draft.amount,
                        fromCurrency: draft.currency,
                        note: draft.details ?? "",
                        toAccountId: to.id,
                        toAmount: draft.amount,
                        toCurrency: draft.currency,
                    });
                } catch {
                    setSaving(false);
                    if (isMounted()) {
                        openTransferForm(draft);
                    }
                    return;
                }
                haptics("success");
                // A modal gesture can dismiss this screen mid-write; popping again
                // would take the screen underneath with it.
                if (isMounted()) {
                    router.back();
                }
            };
            void write();
        },
        [db, haptics, isMounted, openTransferForm, router]
    );

    const openSettings = useCallback(() => {
        Linking.openSettings().catch(() => undefined);
    }, []);

    const status = (() => {
        switch (phase.kind) {
            case "starting": {
                return t("voice.state.starting");
            }
            case "listening": {
                return t("voice.state.listening");
            }
            case "sending":
            case "thinking": {
                return t("voice.state.thinking");
            }
            case "failed": {
                return t(FAILURE_KEY[phase.reason]);
            }
            default: {
                return null;
            }
        }
    })();

    const settled = resolved !== null || phase.kind === "failed";
    const transferLegs = transfer && transferStillCurrent(transfer, live) ? savableTransfer(transfer) : null;

    let caption: React.ReactNode = null;
    if (entry) {
        caption = (
            <Animated.View entering={FadeIn.duration(260)}>
                <ReviewLine categoryName={categoryName} draft={entry} />
            </Animated.View>
        );
    } else if (transfer) {
        caption = (
            <Animated.View entering={FadeIn.duration(260)}>
                <TransferReviewLine draft={transfer} />
            </Animated.View>
        );
    } else if (status) {
        caption = <StatusLine waiting={phase.kind !== "failed"}>{status}</StatusLine>;
    }

    // The bottom axis: Edit and Save at equal width (the weight, not the width,
    // says which is primary), or "Finish in the form" when the draft cannot be
    // saved yet; after a failure, another try, with Settings beside it when the
    // microphone was refused.
    let primary: BarAction | null = null;
    let secondary: BarAction | null = null;
    if (entry) {
        secondary = { label: t("voice.action.edit"), onPress: () => openForm(entry) };
        primary =
            savableCategoryId === null
                ? { label: t("voice.action.finish"), onPress: () => openForm(entry) }
                : { label: t("voice.action.save"), onPress: () => save(entry, savableCategoryId) };
    } else if (transfer) {
        secondary = { label: t("voice.action.edit"), onPress: () => openTransferForm(transfer) };
        primary = transferLegs
            ? {
                  label: t("voice.action.save"),
                  onPress: () => saveTransfer(transfer, transferLegs.from, transferLegs.to),
              }
            : { label: t("voice.action.finish"), onPress: () => openTransferForm(transfer) };
    } else if (phase.kind === "failed") {
        primary = { label: t("voice.action.retry"), onPress: listenAgain };
        if (phase.reason === "denied") {
            secondary = { label: t("voice.action.settings"), onPress: openSettings };
        }
    }

    const bottom = settled ? (
        <Animated.View className="gap-1" entering={FadeIn.duration(220)}>
            <View className="flex-row items-center gap-2.5">
                {secondary ? (
                    <View className="flex-1">
                        <Button
                            className="rounded-full"
                            disabled={saving}
                            fullWidth
                            onPress={secondary.onPress}
                            size="md"
                            variant="secondary"
                        >
                            {secondary.label}
                        </Button>
                    </View>
                ) : null}
                {primary ? (
                    <View className="flex-1">
                        <Button
                            className="rounded-full"
                            disabled={saving}
                            fullWidth
                            loading={saving}
                            onPress={primary.onPress}
                            size="md"
                            variant="primary"
                        >
                            {primary.label}
                        </Button>
                    </View>
                ) : null}
            </View>
            {resolved ? (
                <Button className="rounded-full" disabled={saving} onPress={listenAgain} size="md" variant="ghost">
                    {t("voice.action.fix")}
                </Button>
            ) : null}
        </Animated.View>
    ) : null;

    const orb = orbActionOf(phase, saving, { finish, listenAgain }, t);

    return (
        <VoiceShell bottom={bottom} closeDisabled={saving} onClose={close}>
            <OrbControl
                label={orb.label}
                level={level}
                onPress={orb.onPress}
                size={settled ? ORB_SIZE_SETTLED : ORB_SIZE}
                state={orbStateOf(phase)}
            />
            {caption}
            {phase.kind === "failed" && phase.transcript ? (
                <Text className="text-subtle px-8 text-center font-sans text-base" numberOfLines={3}>
                    “{phase.transcript}”
                </Text>
            ) : null}
            {settled ? <ThreadStrip turns={turns} /> : null}
        </VoiceShell>
    );
}

/**
 * The voice screen. The thread, the recorder and the turns subscription only
 * exist for a signed-in session, because the Convex provider they need is
 * mounted only then; every other gate gets the same frame with the reason.
 */
export function VoiceEntryScreen() {
    const { gate } = useAuthSession();
    if (gate === "signed-in") {
        return <VoiceThreadScreen />;
    }
    return <VoiceGateScreen gate={gate} />;
}
