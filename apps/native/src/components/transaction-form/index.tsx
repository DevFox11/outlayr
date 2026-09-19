import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Host, RNHostView, ScrollView, VStack } from "@expo/ui/swift-ui";
import { animation, blur, padding, scrollDismissesKeyboard } from "@expo/ui/swift-ui/modifiers";
import { ENTRY_RATE_TYPES } from "@outlayr/money/rates";
import type { EntryRateType } from "@outlayr/money/rates";
import { useField, useForm, useSelector } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PortalHost, PortalProvider } from "panelui-native";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { Confetti } from "@/components/confetti";
import { FLY_BACK, FLY_UP, FORM_BLUR_RADIUS, HEADER_HEIGHT } from "@/components/editor-style";
import { InlineFailure } from "@/components/form/inline-failure";
import { shallowEqual } from "@/components/form/shallow-equal";
import { holdSubmitting, pressSubmit } from "@/components/form/submit-guard";
import { SubscribeFields } from "@/components/form/subscribe-fields";
import { useAppSettings, useSettingBool } from "@/contexts/display-settings-context";
import { EMPTY_DRAFT, useIdentityDraft, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { useAccounts } from "@/data/accounts";
import { getAccountById, getLastUsedAccount, rememberLastUsedAccount } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import { useCategoriesByNamespace } from "@/data/categories";
import { ensureCategoryByName, getCategoryById } from "@/data/categories-core";
import type { Category } from "@/data/categories-core";
import { useFavouriteCurrencies } from "@/data/favourite-currencies";
import { useRecentMerchants } from "@/data/merchant-history";
import { rememberedCategoryFor } from "@/data/merchant-history-core";
import { applyMerchantToSiblings } from "@/data/merchant-siblings-core";
import { ratesRevision, subscribeRatesRevision } from "@/data/rates-revision";
import { backfillRecurring } from "@/data/recurrence-backfill";
import { setBoolSetting } from "@/data/settings-core";
import { splitsRepo } from "@/data/splits-core";
import { useTagIdsFor, useTags } from "@/data/tags";
import { tagIdsForQuery, tagsRepo } from "@/data/tags-core";
import { transactionRateSuggestions } from "@/data/transaction-entry-rates";
import { getTransactionById, transactionsRepo } from "@/data/transactions-core";
import type { Transaction, TransactionInput } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { CONFETTI_FLIGHT_MS } from "@/domain/confetti";
import { computeCurtainHues } from "@/domain/curtain-hues";
import { formatSentenceDate } from "@/domain/dates";
import { merchantKey } from "@/domain/merchant-resolver";
import { suggestMerchants } from "@/domain/merchant-suggest";
import { formatAmount, minorUnitsFor, roundToMinorUnits } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { ensureRecurringType, RECURRING_TYPE } from "@/domain/recurrence";
import { enableReminderStep } from "@/domain/reminder";
import { isRealSplit } from "@/domain/split-draft";
import { normalizeLead } from "@/domain/subscription-reminder";
import { findTagByName, normalizeTagName } from "@/domain/tags";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import { effectiveEntryRate, transactionRateOptions } from "@/domain/transaction-entry-rate";
import type { TransactionEntryRate } from "@/domain/transaction-entry-rate";
import { ctaKey, transactionWhenLabel } from "@/domain/transaction-form-labels";
import { buildTransactionInput } from "@/domain/transaction-form-save";
import { isMissingCategory, transactionFormErrors } from "@/domain/transaction-form-validate";
import { useLocaleTag } from "@/hooks/use-locale-tag";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useRegionCode } from "@/hooks/use-region-code";
import { useToggleFavouriteCurrency } from "@/hooks/use-toggle-favourite-currency";
import { useTransactionEnrichment } from "@/hooks/use-transaction-enrichment";
import type { EnrichmentSuggestion, PendingCategory } from "@/hooks/use-transaction-enrichment";
import { useLanguage, useTranslation } from "@/i18n/context";
import { fetchMerchantImage } from "@/lib/logo-fetch";
import { notifyFailure } from "@/lib/notify";
import { openNotificationSettings, reminderPermission, requestReminderPermission } from "@/lib/reminders";
import { syncSubscriptionReminders } from "@/lib/subscription-reminder-sync";
import { useHaptics } from "@/lib/use-haptics";
import { glowFromEmoji, glowFromImage } from "@/theme/glow";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { useIsDark } from "@/theme/use-is-dark";

import { AmountNumpad } from "../amount-numpad";
import { CategoryIcon } from "../category-icon";
import { CategoryIconTile } from "../category-icon-tile";
import { CustomScheduleSheet, intervalPhrase } from "../custom-schedule-sheet";
import { CURTAIN_LAYER_SIZE, curtainGradient } from "../identity-curtain";
import { IdentityFlyUpLayer } from "../identity-fly-up";
import { revealEntering } from "../sentence/sentence-motion";
import { SplitSheet } from "../split-sheet";
import { TagPickerSheet } from "../tag-picker-sheet";
import { Text } from "../text";
import { TransactionFormAmountPad } from "./amount-pad";
import { TransactionFormCta } from "./cta";
import { TransactionSentenceBody } from "./sentence/sentence-body";
import type { TransactionSentenceSlot } from "./sentence/slots";
import { ConversionStrip } from "./stage/conversion-strip";
import { MetaLine } from "./stage/meta-line";
import { TransactionStage } from "./stage/stage";
import type { StageAction, StageFooter } from "./stage/stage";
import { StepAccount } from "./stage/step-account";
import { StepCategory } from "./stage/step-category";
import { StepCurrency } from "./stage/step-currency";
import { StepDate } from "./stage/step-date";
import { StepMerchant } from "./stage/step-merchant";
import { StepRate } from "./stage/step-rate";
import { StepRepeat } from "./stage/step-repeat";
import { StepWhen } from "./stage/step-when";
import { useSplitDraft } from "./use-split-draft";

/**
 * Only reached if `onGeometryChange` never fires; a real measurement always
 * supersedes it. A 70pt nav-bar scroll inset plus the hero section's own top
 * padding.
 */
const HERO_REST_TOP_FALLBACK = 88;

const RATE_DISPLAY_DECIMALS = 4;

/**
 * Floor for the currency step's virtualised list. A stage body has no intrinsic
 * height and an auto-sized list measures to zero for the frames the stage is
 * swapping, so the list needs a size from the first one. A fraction of the
 * window rather than a constant: the stage still has the sentence above it.
 */
const CURRENCY_LIST_FRACTION = 0.34;

/** One row of pills beside the remembered ones, which come first. */
const MERCHANT_SUGGESTION_LIMIT = 4;

/** Names the policy a stated conversion was produced by. */
const RATE_SOURCE_KEYS = {
    custom: "transaction.rate.custom",
    eur_reference: "transaction.rate.eur_reference",
    official: "transaction.rate.official",
} as const satisfies Record<EntryRateType, string>;

/**
 * What the stage at the bottom of the form is showing. One value rather than a
 * flag per surface: the stage is a single surface, so no two of these can be
 * true at once, and the sentence's washed word reads straight off it.
 *
 * There is no "closed": the stage is always occupied. A form whose bottom is
 * empty leaves no way forward except knowing that a word in the sentence is
 * tappable, which is the whole defect the stage replaced.
 */
type StageStep =
    | "account"
    | "amount"
    | "category"
    | "currency"
    | "date"
    | "endDate"
    | "merchant"
    | "rate"
    | "repeat"
    | "when";

/**
 * Where the stage is, and which way it just travelled. One value rather than two
 * pieces of state: the body animates in from the side it came from, so a step
 * and its direction have to change in the same commit or a return slides in as
 * a forward move.
 */
interface StagePosition {
    forward: boolean;
    step: StageStep;
}

/**
 * The facts the footer button walks, in the order the sentence states them, so a
 * user who never realises a word is tappable still reaches a saveable entry.
 */
const GUIDED_STEPS = ["amount", "merchant", "category", "account"] as const;

type GuidedStep = (typeof GUIDED_STEPS)[number];

/**
 * A rung the ladder offers but never holds the save for. The merchant is what
 * drives enrichment rather than what makes the row valid, so an entry that never
 * names one is whole — pressing the footer on that step IS the skip.
 */
const OPTIONAL_STEPS: ReadonlySet<GuidedStep> = new Set(["merchant"]);

const GUIDED_POSITIONS = new Map<StageStep, number>(GUIDED_STEPS.map((step, index) => [step, index]));

/** Where a step sits on the guided ladder; -1 for one that is not on it. */
function guidedIndex(step: StageStep): number {
    return GUIDED_POSITIONS.get(step) ?? -1;
}

/**
 * The word the stage is editing, so the sentence can wash it. The rate and
 * currency steps both report the amount: each is setting something the amount
 * carries, and neither has a sentence word of its own to mark.
 */
const STEP_SLOTS = {
    account: "account",
    amount: "amount",
    category: "category",
    currency: "amount",
    date: "when",
    endDate: "when",
    merchant: "merchant",
    rate: "amount",
    repeat: "when",
    when: "when",
} as const satisfies Record<StageStep, TransactionSentenceSlot>;

/** One step's body and the header it sits under, before the stage draws them. */
interface StageStepContent {
    body: ReactNode;
    /** Trailing meta the step needs and its body cannot state. */
    rightAction?: StageAction;
    title: string;
}

function rateToEntryText(rate: number | null | undefined): string {
    return rate != null && Number.isFinite(rate) && rate > 0 ? String(rate) : "";
}

function isProviderRate(rate: number | null | undefined, rateType: EntryRateType | null): boolean {
    return rate != null && rateType != null && rateType !== "custom";
}

/** Separated from a plain "touched" flag so a later suggestion can still
 * replace an earlier one: only a human edit ("user") locks a field. */
type FieldSource = "initial" | "suggested" | "user";

/**
 * What another surface can put in the form before the user sees it: a
 * suggestion the user still confirms, never identity or recurrence.
 *
 * A quick action, a widget or an App Intent may set only amount, direction and
 * note. The five below them are for the voice screen, whose draft the user has
 * already read on a review line — a category or account it names is one this
 * ledger resolved by name, never one guessed from outside the app.
 */
export interface TransactionSeed {
    accountId?: string;
    /**
     * The person named an account the ledger could not place, so the form
     * opens with none selected rather than the last used one: choosing is the
     * point of coming here.
     */
    accountUnresolved?: boolean;
    amount?: number;
    categoryId?: string;
    currency?: string;
    date?: Date;
    /** The notes field; what the voice draft heard beyond the merchant. */
    details?: string;
    income?: boolean;
    note?: string;
    /** Opens the form in subscription mode on this cadence; the voice screen's "every month". */
    recurrence?: { coefficient: number; type: number };
}

interface TransactionFormProps {
    /**
     * The charge this create is repeating, from a row's own `Log again`. It may
     * carry category and identity where {@link TransactionSeed} may not: these
     * values came off a row inside the ledger that the user confirmed once
     * already, not from a surface outside the app guessing at intent. It carries
     * no date and no schedule, so the copy lands today and stays a one-off.
     */
    copyOf?: LogAgainDraft;
    db: Database;
    initial?: Transaction;
    mode: "create" | "edit";
    /** Adds a destructive item beside Save. Edit routes only — there is nothing
     * to delete before the row exists. */
    onDelete?: () => void;
    onDone: () => void;
    /** Ignored when `initial` is present — an edit is never seeded. */
    seed?: TransactionSeed;
}

function seedAccount(db: Database, initial: Transaction | undefined, seed: TransactionSeed | undefined) {
    if (initial) {
        return initial.accountId ? getAccountById(db, initial.accountId) : null;
    }
    if (seed?.accountUnresolved) {
        return null;
    }
    return (seed?.accountId ? getAccountById(db, seed.accountId) : null) ?? getLastUsedAccount(db);
}

/**
 * The suggestion names a parent, and only this ledger knows which row that is.
 */
async function createPendingCategory(
    db: Database,
    pending: PendingCategory,
    income: boolean,
    siblings: readonly { id: string; name: string | null; parentId: string | null }[]
): Promise<string> {
    const parentId =
        pending.parentName == null
            ? null
            : (siblings.find((candidate) => candidate.parentId == null && candidate.name === pending.parentName)?.id ??
              null);
    return await ensureCategoryByName(db, pending.name, income, pending.icon, pending.color, {
        emoji: pending.emoji,
        parentId,
    });
}

async function materializeTagIds(
    db: Database,
    tagIds: readonly string[],
    pendingTagNames: readonly string[]
): Promise<string[]> {
    const materialized = [...tagIds];
    for (const tagName of pendingTagNames) {
        // oxlint-disable-next-line no-await-in-loop -- `ensureTag` matches before inserting with no unique constraint behind it, so two pending names that normalize to the same tag would each insert a row if these ran concurrently.
        const tagId = await tagsRepo.ensureTag(db, tagName);
        if (tagId != null && !materialized.includes(tagId)) {
            materialized.push(tagId);
        }
    }
    return materialized;
}

async function persistTransaction(
    db: Database,
    mode: "create" | "edit",
    initial: Transaction | undefined,
    input: TransactionInput
): Promise<string> {
    if (mode === "edit" && initial) {
        await transactionsRepo.update(db, initial.id, input);
        return initial.id;
    }
    return await transactionsRepo.create(db, input);
}

function initialEntryRateType(currency: string, rateType: string | null | undefined): EntryRateType | null {
    if (currency === "USD") {
        return null;
    }
    const normalized = ENTRY_RATE_TYPES.find((candidate) => candidate === rateType);
    if (normalized === "eur_reference" && currency !== "VES") {
        return "official";
    }
    return normalized ?? "official";
}

/**
 * The rate policy in force, in the shape the rate step and the conversion strip
 * both read. `official` stands in for an absent type because that is what an
 * unanswered non-USD entry records.
 */
function rateSelectionOf(exchangeRateText: string, exchangeRateType: EntryRateType | null): TransactionEntryRate {
    return {
        exchangeRate: exchangeRateText === "" ? null : numpadToNumber(exchangeRateText),
        exchangeRateType: exchangeRateType ?? "official",
    };
}

interface TransactionRateControlsOptions {
    currency: string;
    date: Date;
    exchangeRateType: EntryRateType | null;
    initialRateFromProvider: boolean;
    /** Moves the stage. `forward` is the direction the arriving body travels in. */
    onStage: (step: StageStep, forward: boolean) => void;
    setCurrency: (currency: string) => void;
    setDate: (date: Date) => void;
    setRateText: (rateText: string) => void;
    setRateType: (rateType: EntryRateType | null) => void;
    stageStep: StageStep;
}

function useTransactionRateControls({
    currency,
    date,
    exchangeRateType,
    initialRateFromProvider,
    onStage,
    setCurrency,
    setDate,
    setRateText,
    setRateType,
    stageStep,
}: TransactionRateControlsOptions) {
    const rateFromSuggestion = useRef(initialRateFromProvider);
    /** The rate step is only ever on screen because it was asked for. */
    const leaveRateStep = () => {
        if (stageStep === "rate") {
            onStage("amount", false);
        }
    };

    const handleRateTypeChange = (next: EntryRateType) => {
        rateFromSuggestion.current = false;
        setRateType(next);
        setRateText("");
        // Stays on the rate step: choosing a policy with nothing to apply is what
        // the custom keypad appears under, and leaving would hide the choice.
        onStage("rate", true);
    };

    const handleRateSuggestion = (rate: number, type: EntryRateType) => {
        rateFromSuggestion.current = true;
        setRateType(type);
        setRateText(rateToEntryText(rate));
        leaveRateStep();
    };

    const handleCurrencyChange = (next: string) => {
        if (next !== currency) {
            rateFromSuggestion.current = false;
            setRateText("");
        }
        setCurrency(next);
        if (next === "USD") {
            setRateType(null);
            setRateText("");
            leaveRateStep();
            return;
        }
        if (exchangeRateType == null || (exchangeRateType === "eur_reference" && next !== "VES")) {
            setRateType("official");
            setRateText("");
        }
    };

    const handleDateChange = (next: Date) => {
        if (next.getTime() !== date.getTime() && rateFromSuggestion.current) {
            rateFromSuggestion.current = false;
            setRateText("");
        }
        setDate(next);
    };

    const handleRateTextChange = (next: string) => {
        rateFromSuggestion.current = false;
        setRateText(next);
    };

    const openRateStep = () => onStage("rate", true);

    return {
        handleCurrencyChange,
        handleDateChange,
        handleRateSuggestion,
        handleRateTextChange,
        handleRateTypeChange,
        openRateStep,
    };
}

/**
 * The add/edit transaction form.
 *
 * Hand-built cards over a `ScrollView` rather than an inset-grouped `List`:
 * SwiftUI's `List` imposes its own section spacing, corner radius and row
 * insets, none of which are settable.
 */
// oxlint-disable-next-line complexity -- known debt: this component owns entry, edit, copy and log-again in one tree. Splitting it is its own change, tracked separately from the lint gate.
export function TransactionForm({ db, mode, initial, seed, copyOf, onDone, onDelete }: TransactionFormProps) {
    const colors = useColors();
    const haptics = useHaptics();
    const t = useTranslation();
    const { language } = useLanguage();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    /** Swift's `.padding(.horizontal, 20)` content box. */
    const contentWidth = windowWidth - 40;
    const currencyListHeight = Math.round(windowHeight * CURRENCY_LIST_FRACTION);
    const globalCurrency = useGlobalCurrency(db);

    const [nameSeed] = useState(initial?.note ?? copyOf?.note ?? seed?.note ?? "");
    const [notesSeed] = useState(initial?.details ?? copyOf?.details ?? seed?.details ?? "");
    // The note is held in a ref, not state: it feeds a plain RN input, and
    // lifting the string would re-render the SwiftUI `Host` below on every
    // keystroke. The merchant name cannot be — two surfaces edit it — so it is a
    // form field instead, read only through `Subscribe` for the same reason.
    const notesRef = useRef(notesSeed);

    const { draft: identity, setDraft: setIdentity } = useIdentityDraft();
    const [identitySource, setIdentitySource] = useState<FieldSource>("initial");
    const { pickerOpen, setPickerOpen } = useIdentityFlyUp();
    /** A failed write, held until the next attempt: this sheet stays up under it. */
    const [saveFailure, setSaveFailure] = useState<string | null>(null);
    /**
     * Measured, not assumed: the strip is pinned over the form, so the scroll
     * content has to be pushed down by exactly what it covers — and what it
     * covers turns on how many lines the message wraps to.
     */
    const [failureHeight, setFailureHeight] = useState(0);

    // Frozen at mount: `useForm` re-applies changed `defaultValues` on every
    // render while untouched, and `date`/`endDate` are `new Date()` here — an
    // inline object would silently re-seed both to "now" every render.
    // oxlint-disable-next-line complexity -- the seed has to reconcile initial, copyOf and seed across category, currency and rate in one pass, because `useForm` only reads it once
    const [initialValues] = useState(() => {
        const sourceId = initial?.categoryId ?? copyOf?.categoryId ?? seed?.categoryId;
        const seedCategory = sourceId ? getCategoryById(db, sourceId) : null;
        const currencySeed = initial?.currency ?? copyOf?.currency ?? seed?.currency ?? null;
        const amountSeed = initial?.amount ?? copyOf?.amount ?? seed?.amount;
        const effectiveCurrency = currencySeed ?? globalCurrency;
        // SAFETY: three of the fields below start empty and are filled as the form
        // is used, so each initial literal has to carry the type the field will end
        // up holding rather than the empty one it starts as.
        return {
            account: seedAccount(db, initial, seed),
            amount: amountSeed == null ? "" : numberToNumpad(amountSeed, minorUnitsFor(currencySeed ?? globalCurrency)),
            category: seedCategory,
            coefficient: initial?.recurringCoefficient ?? seed?.recurrence?.coefficient ?? 1,
            date: initial ? new Date(initial.date) : (seed?.date ?? new Date()),
            endDate: initial?.recurringEndDate ? new Date(initial.recurringEndDate) : oneYearFrom(new Date()),
            exchangeRateText: rateToEntryText(initial?.exchangeRate),
            exchangeRateType: initialEntryRateType(effectiveCurrency, initial?.exchangeRateType),
            hasEndDate: initial?.recurringEndDate != null,
            income: seedCategory?.income ?? initial?.income ?? copyOf?.income ?? seed?.income ?? false,
            // Seeded from the live schedule, not `onceRecurring`: that flag stays
            // true on every occurrence the back-fill materialized, so reading it
            // here opens a settled charge as an active subscription and
            // re-projects the whole schedule on save. Exactly one row in a chain
            // carries `recurringType > 0` — the one that is genuinely still
            // charging.
            isSubscription:
                (initial?.recurringType ?? RECURRING_TYPE.none) !== RECURRING_TYPE.none || seed?.recurrence != null,
            leadDays: normalizeLead(initial?.reminderLeadDays ?? null),
            merchant: nameSeed,
            // What the sentence's inline field is seeded WITH, which is not the
            // same thing as what the entry is called. That field is uncontrolled
            // — it has to be, or the caret would jump on every keystroke — so the
            // only way the stage's merchant step can move it is to re-seed it,
            // and only the stage ever writes this.
            merchantSeed: nameSeed,
            pendingCategory: null as PendingCategory | null,
            pendingTagNames: [] as readonly string[],
            recurringType:
                initial?.recurringType && initial.recurringType !== RECURRING_TYPE.none
                    ? initial.recurringType
                    : (seed?.recurrence?.type ?? RECURRING_TYPE.monthly),
            tagIds: [] as string[],
            txCurrency: currencySeed,
        };
    });

    const form = useForm({
        defaultValues: initialValues,
        // Clearing the category belongs to the income change itself, not to the
        // segmented control that happens to be the only caller today.
        listeners: {
            onChange: ({ formApi, fieldApi }) => {
                if (fieldApi.name !== "income") {
                    return;
                }
                formApi.setFieldValue("category", null);
                formApi.setFieldValue("pendingCategory", null);
                setCategorySource("initial");
            },
        },
        onSubmit: async ({ value }) => {
            setSaveFailure(null);
            haptics("success");

            let categoryId: string;
            if (value.category) {
                categoryId = value.category.id;
            } else if (value.pendingCategory) {
                const pending = value.pendingCategory;
                try {
                    categoryId = await createPendingCategory(db, pending, value.income, latest.current.categories);
                } catch (error) {
                    console.error("Failed to create the pending category", error);
                    flagMissingCategory();
                    return;
                }
            } else {
                // `validators.onChange` gates submission on the same rule, so this is
                // unreachable — kept only to narrow `categoryId` for the compiler.
                return;
            }

            const input = buildTransactionInput({
                accountId: value.account?.id ?? null,
                // At the currency's own units. Changing the currency mid-entry
                // changes how the sentence and keypad render the figure but leaves
                // the typed digits alone, so 12.34 entered in USD and switched to
                // JPY read as ¥12 on screen while the row kept 12.34 — a fraction
                // the currency has no units for. `account-editor` already rounds
                // at save; this is the same rule, and `draft.currency` is nullable
                // so the pure builder cannot apply it.
                amount: roundToMinorUnits(numpadToNumber(value.amount), value.txCurrency ?? globalCurrency),
                categoryId,
                coefficient: value.coefficient,
                currency: value.txCurrency,
                customColor: identity.color,
                date: value.date,
                details: notesRef.current,
                emoji: identity.emoji,
                endDate: value.endDate,
                exchangeRate:
                    value.exchangeRateType == null || value.exchangeRateText === ""
                        ? null
                        : numpadToNumber(value.exchangeRateText),
                exchangeRateType: value.exchangeRateType,
                hasEndDate: value.hasEndDate,
                icon: identity.icon,
                imageColor: identity.photoColor,
                imageUri: identity.photoUri,
                income: value.income,
                isSubscription: value.isSubscription,
                leadDays: value.leadDays,
                note: value.merchant,
                recurringType: value.recurringType,
            });
            let savedId: string;
            try {
                savedId = await persistTransaction(db, mode, initial, input);
            } catch (error) {
                console.error("Failed to save transaction", error);
                // Nothing was written, so the retry is the same tap again — but say so
                // first: un-dimming the CTA in silence is indistinguishable from having
                // missed the button. Under the header rather than in a toast, which
                // this sheet would cover, and pinned rather than in the scroll, so it
                // stays beside the Save button that has to be pressed again.
                haptics("error");
                setSaveFailure(t("transaction.save.failedBody"));
                return;
            }
            // The row is COMMITTED from here down, so no failure below may re-enable the
            // CTA: a second tap runs `create` again, which mints a fresh id rather than
            // rewriting this row, and the ledger ends up with two subscriptions — each
            // walked forward into its own chain of charges by the next sweep.
            if (value.account != null) {
                rememberLastUsedAccount(db, value.account.id).catch((error) => {
                    console.error("Failed to remember the account", error);
                });
            }
            if (tagsSource !== "initial") {
                // After the row exists, because the link points at it. A failure here
                // costs the tags, not the entry, so it is reported rather than thrown.
                try {
                    // Guarded by `tagsSource !== "initial"`, where the effective ids
                    // are the field's own — `savedTagIds` only stands in before that.
                    const materializedTagIds = await materializeTagIds(db, value.tagIds, value.pendingTagNames);
                    await tagsRepo.setTagsFor(db, savedId, materializedTagIds);
                } catch (error) {
                    console.error("Failed to save tags", error);
                    notifyFailure({ body: t("transaction.tags.failedBody"), title: t("transaction.tags.failedTitle") });
                }
            }
            const answered = lookupAnsweredRef.current;
            const carryCurrency = value.txCurrency ?? globalCurrency;
            if (
                mode === "edit" &&
                forcedLookupRef.current &&
                answered?.key === merchantKey(value.merchant) &&
                answered.currency === carryCurrency
            ) {
                // The lookup was asked for on this row; its answer goes to the
                // merchant's other rows too. Not awaited: the row is saved, and a
                // sibling that would not take it is not this save's failure.
                carryLookupToSiblings(savedId, value.income, value.merchant, value.txCurrency).catch((error) => {
                    console.error("Failed to carry the merchant lookup to its other rows", error);
                });
            }
            // After the row exists, for the same reason tags are: the parts point at
            // it. A single part is stored as no split at all, which is what keeps an
            // entry attributed by its own `categoryId` rather than by an equivalent
            // row saying the same thing.
            try {
                await splitsRepo.setSplit(
                    db,
                    savedId,
                    numpadToNumber(value.amount),
                    isRealSplit(splitAllocations) ? splitAllocations : [],
                    minorUnitsFor(value.txCurrency ?? globalCurrency)
                );
            } catch (error) {
                console.error("Failed to save the split", error);
                notifyFailure({ body: t("transaction.split.failedBody"), title: t("transaction.split.failedTitle") });
            }
            let scheduleFailed = false;
            if (value.isSubscription) {
                try {
                    await backfillRecurring(db, savedId);
                } catch (error) {
                    console.error("Failed to back-fill the subscription", error);
                    scheduleFailed = true;
                }
            }
            // After the backfill, which is what moves the chain's next landing: the
            // sweep dates its requests off that. Not awaited, and its failure is not
            // the save's: the row is already written, so a notification the queue
            // refused must not send this down the catch and re-enable the CTA.
            syncSubscriptionReminders(db).catch((error) => {
                console.error("Subscription reminder sync failed", error);
            });
            if (scheduleFailed) {
                haptics("error");
                // Raised before the dismissal rather than from a button inside it: the
                // toast is mounted at the root, so it outlives this route and reads on
                // the screen behind it — where an alert needs a presenter that is
                // already gone by the time the modal finishes tearing down.
                notifyFailure({
                    body: t("transaction.save.scheduleFailedBody"),
                    title: t("transaction.save.scheduleFailedTitle"),
                });
                onDone();
                return await holdSubmitting();
            }
            if (mode === "edit") {
                onDone();
                return await holdSubmitting();
            }
            setShowToast(true);
            // The form owns the celebration, so it has to outlive its own
            // dismissal: Swift fired the cannon on the screen behind the sheet,
            // which has no equivalent here without hoisting state out of the
            // route.
            if (celebrate) {
                // A counter, not a clock: mulberry32 avalanches its seed, so
                // successive integers decorrelate as well as timestamps do, and
                // the burst stays reproducible in a test.
                setBurstSeed((previous) => previous + 1);
            }
            doneTimer.current = setTimeout(onDone, celebrate ? CONFETTI_FLIGHT_MS : 600);
            return await holdSubmitting();
        },
        // The CTA stays lit on amount alone, so a tap with no category lands here
        // rather than on a dimmed button that explains nothing.
        onSubmitInvalid: ({ value }) => {
            // The amount flags where the category already does: the stage's
            // footer reaches this with nothing entered, and a submit that
            // silently did nothing would read as a missed button.
            const noAmount = numpadToNumber(value.amount) <= 0;
            if (noAmount) {
                flagMissingAmount();
            }
            if (isMissingCategory(value)) {
                flagMissingCategory();
            }
            // Marking the sentence alone leaves the answer further away than the
            // question, and the stage is where every other fact is answered. Only
            // for a fact the sentence states, though: a save rejected for a blank
            // rate must stay on the rate step, which is already showing why.
            if (noAmount) {
                enterStep("amount");
            } else if (isMissingCategory(value)) {
                enterStep("category");
            }
        },
        validators: {
            onChange: ({ value }) =>
                transactionFormErrors({
                    ...value,
                    currency: value.txCurrency ?? globalCurrency,
                    exchangeRate: value.exchangeRateText === "" ? null : numpadToNumber(value.exchangeRateText),
                }),
        },
    });
    // Names the fields rather than taking `values` wholesale: that object gets a
    // fresh identity on every write, so selecting it re-renders this whole screen
    // on each amount keystroke however few fields are read out of it.
    const {
        txCurrency,
        isSubscription,
        category,
        pendingCategory,
        income,
        recurringType,
        coefficient,
        account,
        date,
        endDate,
        hasEndDate,
        leadDays,
        exchangeRateText,
        exchangeRateType,
    } = useSelector(
        form.store,
        (s) => ({
            account: s.values.account,
            category: s.values.category,
            coefficient: s.values.coefficient,
            date: s.values.date,
            endDate: s.values.endDate,
            exchangeRateText: s.values.exchangeRateText,
            exchangeRateType: s.values.exchangeRateType,
            hasEndDate: s.values.hasEndDate,
            income: s.values.income,
            isSubscription: s.values.isSubscription,
            leadDays: s.values.leadDays,
            pendingCategory: s.values.pendingCategory,
            recurringType: s.values.recurringType,
            txCurrency: s.values.txCurrency,
        }),
        { compare: shallowEqual }
    );

    const currency = txCurrency ?? globalCurrency;
    const minorUnits = minorUnitsFor(currency);
    const ratesVersion = useSyncExternalStore(subscribeRatesRevision, ratesRevision, ratesRevision);
    const rateSuggestions = useMemo(
        () => transactionRateSuggestions(db, currency, date),
        // oxlint-disable-next-line react/exhaustive-deps -- ratesVersion invalidates this SQLite read after cache replacement.
        [db, currency, date, ratesVersion]
    );
    const rateSelection = rateSelectionOf(exchangeRateText, exchangeRateType);
    /**
     * Whether this entry converts at all. `transactionRateOptions` is the single
     * answer: it is empty for USD, which has no rate to state and so no strip and
     * no rate step.
     */
    const converts = transactionRateOptions(currency).length > 0;
    const rateInForce = effectiveEntryRate(rateSelection, rateSuggestions);
    const rateSourceLabel = t(RATE_SOURCE_KEYS[rateSelection.exchangeRateType]);

    /**
     * What the entered amount comes to in USD at the rate in force, or null while
     * nothing honest can be stated. `eur_reference` is two-legged — its rate is
     * this currency per EUR — so the EUR-official leg divides in as well, exactly
     * as `computeAmountUSD` does at save time.
     */
    const amountInUsd = (amount: number): number | null => {
        if (amount <= 0 || rateInForce === null || rateInForce <= 0) {
            return null;
        }
        if (rateSelection.exchangeRateType !== "eur_reference") {
            return amount / rateInForce;
        }
        const eurLeg = rateSuggestions.eurOfficial;
        return eurLeg === null || eurLeg <= 0 ? null : amount / rateInForce / eurLeg;
    };

    // A category carried in from `copyOf` is a deliberate choice, not a blank
    // slot an enrichment suggestion is free to fill.
    const [categorySource, setCategorySource] = useState<FieldSource>(() =>
        initialValues.category === null ? "initial" : "user"
    );

    // Registers a FieldApi under `income` purely so the form's `listeners` reach
    // it: `setFieldValue` dispatches them through the mounted field instance, so
    // without this the cascade above is a silent no-op.
    useField({ form, name: "income" });

    const [categoryError, setCategoryError] = useState(false);
    const [categoryShake, setCategoryShake] = useState(false);
    const [amountError, setAmountError] = useState(false);
    const [amountShake, setAmountShake] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const celebrate = useAppSettings().state.bool("confetti");
    const aiEnrichment = useAppSettings().state.bool("aiEnrichment");
    const groundedLookup = useAppSettings().state.bool("groundedLookup");
    const [burstSeed, setBurstSeed] = useState(0);
    // Shared values, not state: the fly-up is the only reader and it reads them from
    // the UI thread, so measuring the form must not cost the SwiftUI tree a render.
    const containerHeight = useSharedValue(0);
    // Global (window) points straight from SwiftUI, NaN until it reports.
    // `measureInWindow` cannot stand in here — it answers 0 for RN views living
    // inside the `Host`.
    const heroWinY = useSharedValue(Number.NaN);
    // The twin is an overlay on this screen's ROOT, so the hero's window frame has to
    // be rebased on the root's window origin. The `ScrollView`'s frame is no use as a
    // reference: it is inset below the transparent nav bar. The root is bottom-anchored
    // and full-bleed, so what it is missing off the window IS its top inset.
    //
    // That holds only because a `modal` presentation on iPhone insets the top alone,
    // and `supportsTablet` is unset so iPad runs iPhone-compatibility. Turning iPad
    // support on breaks this silently: a real iPad modal is a centred card inset on ALL
    // sides, so this subtraction yields the TOTAL vertical inset and launches the twin
    // roughly half of it too low. Halve it — or measure the top inset directly —
    // before shipping an iPad build.
    const heroRestTop = useDerivedValue(() =>
        Number.isNaN(heroWinY.get()) || containerHeight.get() <= 0
            ? HERO_REST_TOP_FALLBACK
            : heroWinY.get() - (windowHeight - containerHeight.get())
    );
    const isDark = useIsDark();
    const router = useRouter();
    const accountCreateRoute = useAccountCreateRoute();

    /**
     * The one bottom surface. It rests on the keypad — the amount is the first
     * thing a create is for, and the first thing a returning user reaches for on
     * an edit — and every other step is entered from it and returns to it.
     */
    const [stage, setStage] = useState<StagePosition>({ forward: true, step: "amount" });
    const stageStep = stage.step;
    const goStage = (step: StageStep, forward: boolean) => {
        // Unconditional: no step arrives focused, so a keyboard still standing here
        // was raised by the step or the note field being left behind, and it would
        // cover the one arriving. A no-op when nothing is focused.
        Keyboard.dismiss();
        setStage({ forward, step });
    };
    /** Opens a step. The arriving body travels in from the right. */
    const enterStep = (step: StageStep) => goStage(step, true);
    /** Returns to a step already behind us, which travels the other way. */
    const leaveTo = (step: StageStep) => goStage(step, false);
    const {
        handleCurrencyChange,
        handleDateChange,
        handleRateSuggestion,
        handleRateTextChange,
        handleRateTypeChange,
        openRateStep,
    } = useTransactionRateControls({
        currency,
        date,
        exchangeRateType,
        initialRateFromProvider: isProviderRate(initial?.exchangeRate, exchangeRateType),
        onStage: goStage,
        setCurrency: (next) => form.setFieldValue("txCurrency", next),
        setDate: (next) => form.setFieldValue("date", next),
        setRateText: (next) => form.setFieldValue("exchangeRateText", next),
        setRateType: (next) => form.setFieldValue("exchangeRateType", next),
        stageStep,
    });
    const favouriteCurrencies = useFavouriteCurrencies(db);
    const toggleFavourite = useToggleFavouriteCurrency(db);
    const selectCategory = (picked: Category) => {
        form.setFieldValue("category", picked);
        form.setFieldValue("pendingCategory", null);
        setCategorySource("user");
        markTouched("category");
        setCategoryError(false);
    };
    const tagSheetRef = useRef<BottomSheetModal>(null);
    const splitSheetRef = useRef<BottomSheetModal>(null);
    const {
        allocations: splitAllocations,
        openSplit,
        setAllocations: setSplitAllocations,
    } = useSplitDraft(db, mode, initial);
    const allAccounts = useAccounts(db);
    const recentNames = useRecentMerchants(db, income);
    const allTags = useTags(db);
    const savedTagIds = useTagIdsFor(db, initial?.id ?? null);
    const [tagsSource, setTagsSource] = useState<FieldSource>("initial");
    /** Until the user or a suggestion touches them, the row's tags are the saved
     * ones — the form field is still the empty array it mounted with. */
    const effectiveTagIdsOf = (tagIds: readonly string[]) => (tagsSource === "initial" ? savedTagIds : tagIds);
    const tagLabelsOf = (tagIds: readonly string[], pendingTagNames: readonly string[]) => {
        const labels = [
            ...allTags.filter((tag) => effectiveTagIdsOf(tagIds).includes(tag.id)).map((tag) => tag.name),
            ...pendingTagNames,
        ];
        return labels.length > 0 ? labels.join(", ") : null;
    };
    const tagCountOf = (tagIds: readonly string[], pendingTagNames: readonly string[]) =>
        allTags.filter((tag) => effectiveTagIdsOf(tagIds).includes(tag.id)).length + pendingTagNames.length;
    const tagLabel = (count: number) => t("transaction.sentence.set.tag", { count });
    const splitLabel = (count: number) => t("transaction.sentence.set.split", { count });
    const repeatChipLabel = () => {
        if (recurringType === RECURRING_TYPE.daily) {
            return t("transaction.sentence.set.repeatDaily");
        }
        if (recurringType === RECURRING_TYPE.weekly) {
            return t("transaction.sentence.set.repeatWeekly");
        }
        if (recurringType === RECURRING_TYPE.yearly) {
            return t("transaction.sentence.set.repeatYearly");
        }
        return t("transaction.sentence.set.repeatMonthly");
    };
    const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
    const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const amountShakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const categoriesForNamespace = useCategoriesByNamespace(db, income);
    // Shape only — the names, and what sits under what. No figures leave here.
    const categoryTree = useMemo(() => {
        const named = categoriesForNamespace.filter((candidate) => candidate.name != null);
        // SAFETY: `named` is filtered to rows with a non-null name just above; the
        // column itself is nullable.
        return named
            .filter((candidate) => candidate.parentId == null)
            .map((parent) => ({
                // SAFETY on both lines: `named` is filtered to rows with a non-null name
                // just above; the column itself is nullable.
                children: named.filter((child) => child.parentId === parent.id).map((child) => child.name as string),
                name: parent.name as string,
            }));
    }, [categoriesForNamespace]);

    const resolveHistory = useCallback(
        (key: string, forIncome: boolean) => rememberedCategoryFor(db, key, forIncome),
        [db]
    );

    const resolveLocal = useCallback((suggestion: EnrichmentSuggestion): EnrichmentSuggestion => {
        let { categoryId, pendingCategory: suggestedCategory } = suggestion;
        if (categoryId == null && suggestedCategory != null) {
            const matchedCategory = latest.current.categories.find(
                (candidate) => candidate.name === suggestedCategory?.name
            );
            if (matchedCategory != null) {
                categoryId = matchedCategory.id;
                suggestedCategory = null;
            }
        }
        const resolvedTagIds: string[] = [...suggestion.tagIds];
        const pendingTagNames: string[] = [];
        for (const tagName of suggestion.pendingTagNames) {
            const matchedTag = findTagByName(latest.current.allTags, tagName);
            if (matchedTag == null) {
                pendingTagNames.push(tagName);
            } else {
                resolvedTagIds.push(matchedTag.id);
            }
        }
        return {
            ...suggestion,
            categoryId,
            pendingCategory: suggestedCategory,
            pendingTagNames,
            tagIds: resolvedTagIds,
        };
    }, []);

    const logoRequestRef = useRef(0);
    /**
     * What the well held at the last commit, read at write time rather than
     * closed over — the seeding effect can fill it while a request is out.
     * Mirrored in an effect, not during render, which is a side effect the
     * compiler cannot follow.
     */
    const latest = useRef({
        allTags,
        categories: categoriesForNamespace,
        hasIdentity: false,
        identitySource,
        pickerOpen,
    });
    useEffect(() => {
        // oxlint-disable-next-line react/react-compiler -- `categories` and `allTags` come from data hooks, and the compiler treats anything holding them as owned by those hooks. Writing a ref inside an effect is exactly where a ref is meant to be written; the alias is what it cannot follow.
        latest.current = {
            allTags,
            categories: categoriesForNamespace,
            hasIdentity: Boolean(identity.emoji || identity.icon || identity.photoUri),
            identitySource,
            pickerOpen,
        };
    });

    /**
     * The user asked for this merchant to be looked up, on this row, and has
     * not typed a different name since. While it stands every guard that keeps
     * a suggestion off a field the user already filled is lifted, and the save
     * carries the answer to the merchant's other rows.
     */
    const forcedLookupRef = useRef(false);
    // Written here rather than at the call sites: the ref is read by the
    // memoised `attachLogo`, and the compiler only allows it to change inside a
    // hook's own callback.
    /**
     * The merchant and currency a requested lookup actually answered for.
     * The save carries to siblings only when this matches what is on screen:
     * a save before the answer lands, or after an answer of nothing, must not
     * hand the row's own old category to rows that had none.
     */
    const lookupAnsweredRef = useRef<{ currency: string | null; key: string } | null>(null);
    // The one place `lookupAnsweredRef` is set: the compiler allows a captured
    // ref to change inside a single hook's callback, not across two.
    const recordLookupAnswer = useCallback((answer: { currency: string | null; key: string } | null) => {
        lookupAnsweredRef.current = answer;
    }, []);
    const setForcedLookup = useCallback(
        (forced: boolean) => {
            forcedLookupRef.current = forced;
            if (forced) {
                touchedSinceLookupRef.current.clear();
                // A new ask starts unanswered: the previous answer must not let a
                // save carry while this one is still out.
                recordLookupAnswer(null);
            }
        },
        [recordLookupAnswer]
    );

    /**
     * The slots the user has filled since asking for the lookup. A late
     * answer may replace only what was left alone: a category picked while
     * the model was still out is a newer choice than the answer.
     */
    const touchedSinceLookupRef = useRef<Set<"category" | "identity" | "tags">>(new Set());
    const markTouched = useCallback((slot: "category" | "identity" | "tags") => {
        touchedSinceLookupRef.current.add(slot);
    }, []);
    /** The domain whose logo is in the well, when a suggestion put it there. */
    const suggestedDomainRef = useRef<string | null>(null);

    /**
     * A suggested logo stays replaceable: typing on past one merchant to another
     * has to move the image with the name, so only a real choice ("user") or an
     * open picker stops it. Each run takes a ticket, and a result that settles
     * after a newer one started is dropped rather than painted over it.
     */
    const attachLogo = useCallback(
        async (domain: string | null): Promise<boolean> => {
            const blocked = () =>
                latest.current.pickerOpen ||
                // A lookup the user asked for is a choice made now, over whatever
                // the well holds; only an open picker outranks it.
                ((!forcedLookupRef.current || touchedSinceLookupRef.current.has("identity")) &&
                    (latest.current.identitySource === "user" ||
                        // An emoji or photo carried in from `initial`/`copyOf` is a choice
                        // already made; only an empty well or an earlier suggestion moves.
                        (latest.current.identitySource === "initial" && latest.current.hasIdentity)));
            if (blocked()) {
                return false;
            }
            logoRequestRef.current += 1;
            const ticket = logoRequestRef.current;
            // The name the domain was found for. The transport rejects an answer
            // for a name the field has left, but this pipeline is awaited on its
            // own, and a rename during the next debounce would otherwise take
            // the previous merchant's logo.
            const askedFor = merchantKey(form.store.state.values.merchant);
            const stale = () =>
                ticket !== logoRequestRef.current ||
                merchantKey(form.store.state.values.merchant) !== askedFor ||
                blocked();
            // The new merchant resolved to nothing, so the previous merchant's
            // logo has to go with it — keeping it would caption this entry with
            // the wrong brand.
            const dropSuggested = () => {
                if (latest.current.identitySource === "suggested") {
                    setIdentitySource("initial");
                    setIdentity((previous) => ({
                        ...previous,
                        photoColor: null,
                        photoUri: null,
                    }));
                }
            };

            // A withdrawn domain (a currency change, a name with no answer) is
            // known now, and the drop must not wait on a fetch that has nothing
            // to fetch: a save in that gap would keep the wrong brand on the row.
            if (domain == null) {
                dropSuggested();
                return false;
            }
            const outcome = await fetchMerchantImage({
                domain,
                name: form.store.state.values.merchant,
                refresh: forcedLookupRef.current,
            });
            if (stale()) {
                return false;
            }
            if (outcome.kind !== "logo") {
                dropSuggested();
                return false;
            }
            // Required lazily so rendering this form does not pull Skia's downscaler
            // into the module graph, matching `domain/ids.ts`.
            // SAFETY: `require` is untyped; the path is a first-party module and the
            // asserted type is that same module's own.
            const photoStorage = require("@/lib/photo-storage") as typeof import("@/lib/photo-storage");
            let photoUri: string;
            try {
                photoUri = await photoStorage.persistLogoBytes(outcome.bytes);
            } catch {
                return false;
            }
            // Same tint the picker extracts for a chosen photo, so an auto-attached
            // logo colours the well and the curtain behind it rather than sitting on
            // the neutral fallback. An unreadable image costs the tint alone.
            const hues = await glowFromImage(photoUri);
            if (stale()) {
                // Nothing will name this file: the row moved on, or the form is
                // gone (the unmount bumps the ticket).
                try {
                    photoStorage.photoFiles.remove(photoUri.slice(photoUri.lastIndexOf("/") + 1));
                } catch {
                    // A file already gone is the outcome wanted.
                }
                return false;
            }
            suggestedDomainRef.current = domain;
            setIdentitySource("suggested");
            // A requested lookup puts the logo in place of an emoji or glyph, not
            // behind one; a lookup the form ran on its own only ever fills an
            // empty well, so there is nothing there to clear.
            const replacesChoice = forcedLookupRef.current && !touchedSinceLookupRef.current.has("identity");
            setIdentity((previous) => ({
                ...previous,
                emoji: replacesChoice ? null : previous.emoji,
                icon: replacesChoice ? null : previous.icon,
                photoColor: hues[0] ?? null,
                photoUri,
            }));
            return true;
        },
        [form, setIdentity]
    );
    // A logo still being fetched when the form closes has no row to land on.
    useEffect(
        () => () => {
            logoRequestRef.current += 1;
        },
        []
    );

    /*
     * Not wrapped in `useCallback`: it both reads and sets `categorySource` and
     * `tagsSource`, which the compiler could not reconcile with a hand-written
     * dependency list, so it declined to optimize the whole form. Its only
     * consumer reads it through the enrichment hook's committed snapshot rather
     * than a dependency array, so the identity is free to change.
     */
    const applySuggestion = (suggestion: EnrichmentSuggestion) => {
        // Read from the ref, not a flag in state: the curated tier answers in
        // the same tick the lookup is asked for, before a state change commits.
        const forced = forcedLookupRef.current;
        const answeredWithoutDomain =
            suggestion.categoryId != null ||
            suggestion.pendingCategory != null ||
            suggestion.tagIds.length > 0 ||
            suggestion.pendingTagNames.length > 0;
        const answered = answeredWithoutDomain || suggestion.domain != null;
        const answer = { currency, key: merchantKey(form.store.state.values.merchant) };
        // A domain alone is an answer only once its logo is on the row: a save
        // before then would carry to siblings a logo this row does not have.
        if (forced && answered && (suggestion.domain == null || answeredWithoutDomain)) {
            recordLookupAnswer(answer);
        }
        const touched = touchedSinceLookupRef.current;
        if ((forced && !touched.has("category")) || categorySource !== "user") {
            if (suggestion.categoryId != null) {
                const matchedCategory = getCategoryById(db, suggestion.categoryId);
                if (matchedCategory != null) {
                    form.setFieldValue("category", matchedCategory);
                    form.setFieldValue("pendingCategory", null);
                    setCategoryError(false);
                    setCategorySource("suggested");
                }
            } else if (suggestion.pendingCategory != null) {
                form.setFieldValue("category", null);
                form.setFieldValue("pendingCategory", suggestion.pendingCategory);
                setCategoryError(false);
                setCategorySource("suggested");
            } else if (categorySource === "suggested") {
                // This name has no answer, so the last one's category goes with it
                // rather than captioning an entry it has nothing to do with.
                form.setFieldValue("category", null);
                form.setFieldValue("pendingCategory", null);
                setCategorySource("initial");
            }
        }
        // Tags an edit opened with are the user's as much as a category is, but
        // they arrive by query rather than with `initial`, so the guard reads
        // them at apply time. A lookup the user asked for overrides them.
        const savedTagsStand = tagsSource === "initial" && savedTagIds.length > 0;
        if ((forced && !touched.has("tags")) || (tagsSource !== "user" && !savedTagsStand)) {
            if (suggestion.tagIds.length > 0 || suggestion.pendingTagNames.length > 0) {
                form.setFieldValue("tagIds", [...suggestion.tagIds]);
                form.setFieldValue("pendingTagNames", [...suggestion.pendingTagNames]);
                setTagsSource("suggested");
            } else if (tagsSource === "suggested") {
                form.setFieldValue("tagIds", []);
                form.setFieldValue("pendingTagNames", []);
                setTagsSource("initial");
            }
        }
        attachLogo(suggestion.domain)
            .then((landed) => {
                if (landed && forcedLookupRef.current && merchantKey(form.store.state.values.merchant) === answer.key) {
                    recordLookupAnswer(answer);
                }
            })
            .catch(() => undefined);
    };

    const locale = useLocaleTag();
    const regionCode = useRegionCode();
    const {
        lookupNow,
        onNameChange,
        pending: enriching,
    } = useTransactionEnrichment({
        categoryTree,
        currency,
        // An edit looks up too, but only what is empty: a saved category, tags
        // or identity read as the user's (see the source flags), so a renamed
        // merchant fills the gaps and nothing else.
        enabled: true,
        groundedLookup,
        income,
        initialName: nameSeed,
        locale,
        onSuggest: applySuggestion,
        regionCode,
        remoteEnabled: aiEnrichment,
        resolveHistory,
        resolveLocal,
    });
    // A field the user has already edited is theirs — it never dims, because
    // nothing arriving can change it.
    const categoryEnriching = enriching && categorySource !== "user";

    // The hook re-asks on its own when the currency or the side of the ledger
    // changes; that ask is the form's, not the user's, so the override and
    // the answer end here.
    const seenLookupScopeRef = useRef({ currency, income });
    useEffect(() => {
        const seen = seenLookupScopeRef.current;
        if (seen.currency === currency && seen.income === income) {
            return;
        }
        seenLookupScopeRef.current = { currency, income };
        setForcedLookup(false);
    }, [currency, income, setForcedLookup]);

    const lookUpMerchant = () => {
        setForcedLookup(true);
        haptics("light");
        lookupNow().catch(() => undefined);
    };

    /**
     * The looked-up answer, as saved on this row, applied to the merchant's
     * other rows in the same currency. Read back from the row rather than the
     * form, because a pending category is only given an id by the save.
     * `forCurrency` is the row's own column, null in the default currency,
     * so the siblings stored the same way are found.
     */
    const carryLookupToSiblings = async (
        savedId: string,
        forIncome: boolean,
        merchant: string,
        forCurrency: string | null
    ) => {
        const saved = getTransactionById(db, savedId);
        // Only what the lookup put on the row and the user left there: a
        // category or tags they chose since the tap are theirs, for this row.
        const touched = touchedSinceLookupRef.current;
        const carryCategory = categorySource === "suggested" && !touched.has("category");
        const carryTags = tagsSource === "suggested" && !touched.has("tags");
        const domain = identitySource === "suggested" && !touched.has("identity") ? suggestedDomainRef.current : null;
        const persistLogo =
            domain == null
                ? null
                : async () => {
                      const outcome = await fetchMerchantImage({ domain, name: merchant });
                      if (outcome.kind !== "logo") {
                          throw new Error("No logo to carry");
                      }
                      const imageUri = await photoStorage.persistLogoBytes(outcome.bytes);
                      return { imageColor: saved?.imageColor ?? null, imageUri };
                  };
        // SAFETY: untyped `require`, asserted to the module's own type; lazy
        // for the same reason as in `attachLogo`.
        const photoStorage = require("@/lib/photo-storage") as typeof import("@/lib/photo-storage");
        await applyMerchantToSiblings(db, {
            categoryId: carryCategory ? (saved?.categoryId ?? null) : null,
            currency: forCurrency,
            defaultCurrency: globalCurrency,
            discard: (imageUri) => {
                photoStorage.photoFiles.remove(imageUri.slice(imageUri.lastIndexOf("/") + 1));
            },
            excludeId: savedId,
            income: forIncome,
            key: merchantKey(merchant),
            persistLogo,
            tagIds: carryTags ? await tagIdsForQuery(db, savedId).then((rows) => rows.map((row) => row.tagId)) : [],
        });
    };

    useEffect(
        () => () => {
            if (shakeTimer.current != null) {
                clearTimeout(shakeTimer.current);
            }
            if (amountShakeTimer.current != null) {
                clearTimeout(amountShakeTimer.current);
            }
            if (doneTimer.current != null) {
                clearTimeout(doneTimer.current);
            }
        },
        []
    );

    // The draft is shared context, read by the fly-up hero and the picker route.
    // Skipped once the user has touched identity, so a stale `initial`/`copyOf`
    // reference re-rendering later never clobbers an in-progress choice.
    useEffect(() => {
        // Also skipped once a suggestion has filled the well: these deps change on
        // any `initial`/`copyOf` re-render, and re-seeding would wipe a logo that
        // is still correct for the name in the field.
        if (identitySource !== "initial") {
            return;
        }
        setIdentity({
            color: initial?.customColor ?? copyOf?.customColor ?? null,
            emoji: initial?.emoji ?? copyOf?.emoji ?? null,
            icon: initial?.icon ?? copyOf?.icon ?? null,
            photoColor: initial?.imageColor ?? null,
            photoUri: initial?.imageUri ?? null,
        });
    }, [
        identitySource,
        initial?.imageUri,
        initial?.emoji,
        setIdentity,
        initial?.imageColor,
        initial?.icon,
        initial?.customColor,
        copyOf?.emoji,
        copyOf?.icon,
        copyOf?.customColor,
    ]);

    const handleKindChange = (next: "once" | "subscription") => {
        const sub = next === "subscription";
        form.setFieldValue("isSubscription", sub);
        if (sub) {
            form.setFieldValue("recurringType", ensureRecurringType(recurringType));
        }
    };

    const handleTypeChange = (next: "expense" | "income") => {
        const nextIncome = next === "income";
        if (nextIncome !== income) {
            form.setFieldValue("income", nextIncome);
        }
    };

    /**
     * Naming a cadence IS the choice to repeat: the repeat step is the only place
     * a one-off becomes a subscription now, so the flag follows the cadence
     * rather than waiting for a switch that no longer exists.
     */
    const handleCadenceChange = (type: number) => {
        form.setFieldValue("recurringType", type);
        form.setFieldValue("coefficient", 1);
        form.setFieldValue("isSubscription", true);
    };

    // The same ladder the notifications setting runs, for the same reason: a lead
    // iOS will never deliver is a promise this row would go on repeating, so it is
    // put back to Off rather than left standing. Neither branch schedules anything
    // — the sweep that follows a save owns the pending requests.
    // Picking a lead here IS the intent behind the master switch, and this row is
    // the only place it is ever expressed — a ledger whose owner has never opened
    // the notifications screen would otherwise arm nothing.
    const armSubscriptionReminders = async () => {
        await setBoolSetting(db, "subscriptionReminders", true);
    };

    const confirmRemindersAllowed = async () => {
        const existing = await reminderPermission();
        if (enableReminderStep(existing) === "open-settings") {
            Alert.alert(t("settings.notifications.deniedTitle"), t("settings.notifications.deniedBody"), [
                { style: "cancel", text: t("settings.notifications.notNow") },
                {
                    onPress: openNotificationSettings,
                    text: t("settings.notifications.openSettings"),
                },
            ]);
            form.setFieldValue("leadDays", null);
            return;
        }
        if (existing === "granted") {
            await armSubscriptionReminders();
            return;
        }
        if ((await requestReminderPermission()) === "granted") {
            await armSubscriptionReminders();
            return;
        }
        form.setFieldValue("leadDays", null);
    };

    const handleLeadChange = (lead: number | null) => {
        form.setFieldValue("leadDays", lead);
        if (lead !== null) {
            confirmRemindersAllowed().catch((error) => {
                console.error("Reminder permission check failed", error);
            });
        }
    };

    const flagMissingCategory = () => {
        haptics("error");
        setCategoryError(true);
        setCategoryShake(true);
        shakeTimer.current = setTimeout(() => setCategoryShake(false), 500);
    };

    /**
     * Save is never `disabled`. A greyed-out button that swallows the tap leaves
     * the screen with no way to ask what is missing, so pressing it while the
     * entry is incomplete answers instead. Flagging only marks the word; the
     * caller decides where to land, because a save rejected for two reasons
     * must open the FIRST of them rather than whichever flagged last.
     */
    const flagMissingAmount = () => {
        haptics("error");
        setAmountError(true);
        setAmountShake(true);
        amountShakeTimer.current = setTimeout(() => setAmountShake(false), 500);
    };

    // The spring starts here, not from the picker route's mount effect, so the
    // hero launches on the tap frame instead of waiting for navigation to commit
    // the new screen.
    const openPicker = () => {
        // Or the note's keyboard is left standing over the picker about to be pushed.
        Keyboard.dismiss();
        setIdentitySource("user");
        markTouched("identity");
        setPickerOpen(true);
        router.push("/transactions/identity");
    };

    const ctaLabel = t(ctaKey(mode, isSubscription));

    const curtainHues = computeCurtainHues(
        {
            categoryColor: category?.color,
            foregroundColor: colors.foreground,
            identity,
            income,
            incomeColor: colors.income,
        },
        glowFromEmoji
    );
    const toastLabel = t(isSubscription ? "transaction.toast.subscriptionAdded" : "transaction.toast.added");

    const chosenCategoryTint = category?.income ? colors.income : (category?.color ?? colors.foreground);
    const categoryGlyphTint = category ? chosenCategoryTint : (pendingCategory?.color ?? colors.muted);

    const [noteOpen, setNoteOpen] = useState(notesSeed.length > 0);
    const [noteSummary, setNoteSummary] = useState(notesSeed);

    // Narrow subscription: reading this through `useAppSettings().state` would
    // re-render the whole form on every unrelated setting write.
    const coachSeen = useSettingBool("sentenceCoachSeen");
    const setSetting = useAppSettings().actions.setBool;
    // Editing an entry is not a first run: everything is already answered, so the
    // line would be teaching a screen the user is not being led through.
    const showCoach = mode === "create" && !coachSeen;
    const dismissCoach = () => setSetting("sentenceCoachSeen", true);

    const answered = (step: GuidedStep, amountNumber: number, merchant: string): boolean => {
        if (step === "amount") {
            return amountNumber > 0;
        }
        if (step === "merchant") {
            return merchant.trim() !== "";
        }
        if (step === "category") {
            return categoryLabel !== null;
        }
        return account != null;
    };

    /** The first fact still missing from `from` onwards, or null once none is. */
    const nextMissing = (amountNumber: number, merchant: string, from: number): GuidedStep | null =>
        GUIDED_STEPS.slice(from).find((step) => !answered(step, amountNumber, merchant)) ?? null;

    /** Every fact the entry cannot be saved without is answered. */
    const entryWhole = (amountNumber: number, merchant: string): boolean =>
        GUIDED_STEPS.every((step) => OPTIONAL_STEPS.has(step) || answered(step, amountNumber, merchant));

    /**
     * Where a resolved step hands over: the next fact the entry needs, and the
     * resting keypad once it needs none. Never nothing — a stage that closed on
     * its own answer is the empty bottom the whole surface replaced.
     */
    const advanceFrom = (step: StageStep, amountNumber: number, merchant: string): StageStep =>
        nextMissing(amountNumber, merchant, guidedIndex(step) + 1) ?? "amount";

    /** Hands a resolved step over. Falling back to the keypad is a return, not an advance. */
    const advance = (step: StageStep, amountNumber: number, merchant: string) => {
        const next = advanceFrom(step, amountNumber, merchant);
        goStage(next, next !== "amount");
    };

    /**
     * The stage's one button. It reads Save once the entry is whole, and walks
     * FORWARD from the step on screen otherwise — pressing it on the step it is
     * asking for IS the skip, so a backward target would put the ladder in a
     * loop between two unanswered facts.
     *
     * Running out of ladder submits rather than doing nothing: the button is
     * never disabled, and a submit is what makes a still-missing fact say so.
     */
    const stageFooter = (amountNumber: number, merchant: string): StageFooter => {
        const whole = entryWhole(amountNumber, merchant);
        // An unnamed merchant leaves a rung on the ladder that the label has
        // already declared unnecessary, so a whole entry submits from wherever it
        // is standing rather than walking on to an optional step.
        const onward = whole ? null : nextMissing(amountNumber, merchant, guidedIndex(stageStep) + 1);
        return {
            label: whole ? ctaLabel : t("common.next"),
            onPress: () => {
                if (onward === null) {
                    pressSubmit(form);
                    return;
                }
                enterStep(onward);
            },
            tone: "primary",
        };
    };

    const activeSlot: TransactionSentenceSlot = STEP_SLOTS[stageStep];

    /**
     * The name changing from the sentence's own inline field. `merchantSeed` is
     * deliberately left alone: it re-seeds that field, and re-seeding it
     * mid-keystroke would take the caret with it.
     */
    const handleMerchantChange = (next: string) => {
        setForcedLookup(false);
        form.setFieldValue("merchant", next);
        onNameChange(next);
    };

    /**
     * The name changing from the stage's merchant step — typed there, or taken
     * off one of its rows. The sentence's field is uncontrolled, so moving it
     * means re-seeding it.
     */
    const handleStageMerchantChange = (next: string) => {
        form.setFieldValue("merchantSeed", next);
        handleMerchantChange(next);
    };

    const sentenceLabels = {
        account: { blank: t("transaction.sentence.blank.account"), field: t("transaction.field.account") },
        // A zero in the entry's own currency rather than a noun: it states that a
        // number belongs here and what shape it takes, which "an amount" does not.
        amount: { blank: formatAmount(0, currency, true, language), field: t("transaction.field.amount") },
        category: { blank: t("transaction.sentence.blank.category"), field: t("transaction.field.category") },
        currency: { code: currency, field: t("transaction.sentence.currency") },
        kind: {
            switchLabel: t("transaction.sentence.kind.switch"),
            verb: t(income ? "transaction.sentence.kind.income" : "transaction.sentence.kind.expense"),
        },
        merchant: { field: t("transaction.field.name"), placeholder: t("transaction.sentence.blank.merchant") },
        // Uninterpolated on purpose: with no params `t` hands back the template
        // itself, which is what `parseSentence` reads the slot order out of.
        template: t(income ? "transaction.sentence.income" : "transaction.sentence.expense"),
        when: { field: t("transaction.field.date") },
    };

    const whenLabel = transactionWhenLabel(t, {
        date,
        interval: isSubscription ? intervalPhrase(t, recurringType, coefficient) : null,
        language,
        now: new Date(),
    });

    const categoryLabel = category?.name ?? pendingCategory?.name ?? null;
    const categoryTile =
        category || pendingCategory ? (
            <CategoryIcon color={categoryGlyphTint} name={category ? category.icon : pendingCategory?.icon} size={20} />
        ) : undefined;
    const accountTile = account ? (
        <CategoryIconTile
            color={account.imageColor ?? account.customColor ?? colors.foreground}
            emoji={account.emoji}
            icon={account.icon}
            imageUri={account.imageUri}
            size={20}
            type="solid"
        />
    ) : undefined;
    const hasIdentityMark = Boolean(identity.photoUri ?? identity.emoji ?? identity.icon);
    const merchantTile = hasIdentityMark ? (
        <CategoryIconTile
            color={identity.photoColor ?? identity.color ?? colors.foreground}
            emoji={identity.emoji}
            icon={identity.icon}
            imageUri={identity.photoUri}
            size={20}
            type="solid"
        />
    ) : undefined;

    /**
     * The stage's body for every step that is not the keypad, with the header it
     * sits under. Split from {@link renderStage} so each stays readable; the
     * container itself is written once.
     */
    // oxlint-disable-next-line complexity -- one branch per step of a single surface; splitting it per step would hide the fact that they are alternatives.
    const stageStepContent = (amountNumber: number, merchant: string): StageStepContent => {
        if (stageStep === "merchant") {
            return {
                body: (
                    <StepMerchant
                        accessibilityLabel={t("transaction.merchant.field")}
                        onChange={handleStageMerchantChange}
                        placeholder={t("transaction.field.namePlaceholder")}
                        recent={recentNames}
                        recentLabel={t("transaction.merchant.recent")}
                        // The remembered names are passed as the exclusion too: a
                        // merchant on both rows is one merchant, and the row the
                        // user has actually used is the one worth keeping.
                        suggestions={suggestMerchants(merchant, MERCHANT_SUGGESTION_LIMIT, recentNames)}
                        value={merchant}
                    />
                ),
                title: t("transaction.field.name"),
            };
        }
        if (stageStep === "category") {
            return {
                body: (
                    <StepCategory
                        categories={categoriesForNamespace}
                        onCreate={() => router.push("/settings/categories/create")}
                        onSelect={(picked) => {
                            selectCategory(picked);
                            advance("category", amountNumber, merchant);
                        }}
                        selectedId={category?.id ?? null}
                    />
                ),
                title: t("transaction.field.category"),
            };
        }
        if (stageStep === "account") {
            return {
                body: (
                    <StepAccount
                        accounts={allAccounts}
                        onSelect={(picked) => {
                            form.setFieldValue("account", picked);
                            advance("account", amountNumber, merchant);
                        }}
                        selectedId={account?.id ?? null}
                    />
                ),
                title: t("transaction.field.account"),
            };
        }
        if (stageStep === "currency") {
            return {
                body: (
                    <StepCurrency
                        favourites={favouriteCurrencies}
                        listMinHeight={currencyListHeight}
                        onSelect={(next) => {
                            handleCurrencyChange(next);
                            leaveTo("amount");
                        }}
                        onToggleFavourite={toggleFavourite}
                        searchPlaceholder={t("onboarding.currency.picker.searchPlaceholder")}
                        selected={currency}
                    />
                ),
                title: t("onboarding.currency.picker.title"),
            };
        }
        if (stageStep === "rate") {
            return {
                body: (
                    <StepRate
                        currency={currency}
                        labels={{
                            custom: t("transaction.rate.custom"),
                            editCustom: t("transaction.rate.editCustom"),
                            error: {
                                customRateRequired: t("transaction.rate.required"),
                                eurReferenceRequiresVes: t("transaction.rate.eurReferenceRequiresVes"),
                            },
                            eurReference: t("transaction.rate.eur_reference"),
                            official: t("transaction.rate.official"),
                            perUsd: t("transaction.rate.perUsd", { currency }),
                            requiredHint: t("transaction.rate.requiredHint"),
                            set: t("transaction.rate.set"),
                            title: t("transaction.rate.title"),
                            unavailable: t("transaction.rate.unavailable"),
                        }}
                        onEditCustom={openRateStep}
                        onSelectType={handleRateTypeChange}
                        onUseSuggestion={handleRateSuggestion}
                        resolvedOn={formatSentenceDate(date, language)}
                        selection={rateSelection}
                        suggestions={rateSuggestions}
                    >
                        {/* The rate is not money, so the keys are the entry's own
                            separator rather than the money preference's implied cents. */}
                        <AmountNumpad
                            code={`${currency}/USD`}
                            minorUnits={RATE_DISPLAY_DECIMALS}
                            mode="explicitSeparator"
                            onChange={handleRateTextChange}
                            showDisplay={false}
                            value={exchangeRateText}
                        />
                    </StepRate>
                ),
                title: t("transaction.rate.title"),
            };
        }
        if (stageStep === "when") {
            return {
                body: (
                    <StepWhen
                        date={date}
                        now={new Date()}
                        onPick={() => enterStep("date")}
                        onSelect={(next) => {
                            handleDateChange(next);
                            advance("when", amountNumber, merchant);
                        }}
                        pickLabel={t("transaction.sentence.when.pick")}
                    />
                ),
                title: t("transaction.field.date"),
            };
        }
        if (stageStep === "date") {
            // The wheel is continuous, so it does not hand over on a change the
            // way a named day does — the footer is the way on.
            return {
                body: <StepDate date={date} onChange={handleDateChange} withTime />,
                title: t("transaction.field.date"),
            };
        }
        if (stageStep === "endDate") {
            return {
                body: (
                    <StepDate
                        date={endDate}
                        onChange={(next) => {
                            form.setFieldValue("endDate", next);
                            form.setFieldValue("hasEndDate", true);
                        }}
                    />
                ),
                // The only way back to a schedule that never ends: a wheel can
                // name a day and nothing else.
                rightAction: {
                    label: t("common.never"),
                    onPress: () => {
                        form.setFieldValue("hasEndDate", false);
                        leaveTo("repeat");
                    },
                },
                title: t("transaction.field.ends"),
            };
        }
        return {
            body: (
                <StepRepeat
                    cadence={isSubscription ? recurringType : RECURRING_TYPE.none}
                    custom={coefficient !== 1}
                    customLabel={
                        coefficient === 1
                            ? undefined
                            : t("transaction.schedule.every", {
                                  interval: intervalPhrase(t, recurringType, coefficient),
                              })
                    }
                    endDate={hasEndDate ? endDate : null}
                    labels={{
                        ending: t("transaction.schedule.ending"),
                        starting: t("transaction.schedule.starting"),
                    }}
                    leadDays={leadDays}
                    onCadenceChange={handleCadenceChange}
                    onCustomPress={() => setScheduleSheetOpen(true)}
                    onEndDatePress={() => enterStep("endDate")}
                    onLeadChange={handleLeadChange}
                    onStartDatePress={() => enterStep("date")}
                    startDate={date}
                />
            ),
            title: t("transaction.field.schedule"),
        };
    };

    /**
     * The one surface pinned to the bottom, and the only thing that decides what
     * it shows. The amount step IS the keypad, which composes the stage itself;
     * every other step is a body inside one — including the rate step, which
     * renders the same keys as its own child once a custom rate is chosen.
     */
    const renderStage = (amountText: string, merchant: string) => {
        const amountNumber = numpadToNumber(amountText);
        if (stageStep === "amount") {
            return (
                <TransactionFormAmountPad
                    code={currency}
                    footer={stageFooter(amountNumber, merchant)}
                    forward={stage.forward}
                    label={t("transaction.field.amount")}
                    minorUnits={minorUnits}
                    onChange={(next) => {
                        form.setFieldValue("amount", next);
                        setAmountError(false);
                    }}
                    onCodePress={() => enterStep("currency")}
                    stepKey="amount"
                    value={amountText}
                />
            );
        }
        const { body, rightAction, title } = stageStepContent(amountNumber, merchant);
        return (
            <TransactionStage
                backLabel={t("common.back")}
                // A ledger with no account to pick has nothing this step can
                // answer, so the button leaves for the editor that mints one.
                footer={
                    stageStep === "account" && allAccounts.length === 0
                        ? {
                              label: t("transaction.account.create"),
                              onPress: () => router.push(accountCreateRoute),
                              tone: "primary",
                          }
                        : stageFooter(amountNumber, merchant)
                }
                forward={stage.forward}
                onBack={() => leaveTo("amount")}
                rightAction={rightAction}
                stepKey={stageStep}
                title={title}
            >
                {body}
            </TransactionStage>
        );
    };

    const clearIdentity = () => {
        setIdentitySource("user");
        markTouched("identity");
        setIdentity(EMPTY_DRAFT);
    };

    return (
        /**
         * Its own PortalProvider, not the app's: PanelUI hosts portalled content at
         * `PanelUIProvider`, which sits ABOVE `LocalDataProvider` in the root layout —
         * so a sheet mounted there loses the database and `useLocalData` throws out of
         * the keypad. A host inside this screen keeps the sheet under every provider
         * the form itself has.
         */
        <PortalProvider>
            <View
                className="flex-1"
                onLayout={(e) => {
                    containerHeight.set(e.nativeEvent.layout.height);
                }}
            >
                {/* The curtain is the Host's own BACKGROUND, not a sibling: a view stacked
			    before the Host would hide the scroll content from the header's
			    scroll-edge lookup. */}
                <Host
                    style={{
                        backgroundColor: colors.background,
                        experimental_backgroundImage: curtainGradient(curtainHues, isDark),
                        experimental_backgroundRepeat: "no-repeat",
                        // Confine every gradient layer to the top CURTAIN_HEIGHT and don't
                        // tile it, so below that band there is only the grouped grey.
                        experimental_backgroundSize: CURTAIN_LAYER_SIZE,
                        flex: 1,
                    }}
                >
                    {/* The blur goes on the SCROLL VIEW: blurring the `Host` would take the
				    curtain, which is its background, with it. */}
                    <ScrollView
                        modifiers={[
                            blur(pickerOpen ? FORM_BLUR_RADIUS : 0),
                            animation(pickerOpen ? FLY_UP : FLY_BACK, pickerOpen),
                            // The note is the one multiline field on this screen, so its
                            // return key writes a newline and cannot also put the keyboard
                            // away. A drag is the way out.
                            scrollDismissesKeyboard("immediately"),
                        ]}
                    >
                        <VStack
                            modifiers={[
                                padding({
                                    bottom: 40,
                                    horizontal: 20,
                                    top: saveFailure === null ? 0 : failureHeight,
                                }),
                            ]}
                            spacing={16}
                        >
                            <SubscribeFields
                                selector={(s) => ({
                                    amount: s.values.amount,
                                    merchantSeed: s.values.merchantSeed,
                                    pendingTagNames: s.values.pendingTagNames,
                                    tagIds: s.values.tagIds,
                                })}
                                store={form.store}
                            >
                                {({ amount, merchantSeed, pendingTagNames, tagIds }) => {
                                    const amountNumber = numpadToNumber(amount);
                                    const tagLabels = tagLabelsOf(tagIds, pendingTagNames);
                                    const tagCount = tagCountOf(tagIds, pendingTagNames);
                                    return (
                                        <RNHostView matchContents>
                                            <TransactionSentenceBody
                                                account={account?.name ?? null}
                                                accountTile={accountTile}
                                                amount={
                                                    amountNumber <= 0
                                                        ? null
                                                        : formatAmount(amountNumber, currency, true, language)
                                                }
                                                category={categoryLabel}
                                                categoryFlagged={categoryError}
                                                categoryPending={categoryEnriching}
                                                categoryShake={categoryShake}
                                                categoryTile={categoryTile}
                                                coach={
                                                    showCoach ? (
                                                        <Pressable
                                                            accessibilityLabel={t("transaction.sentence.coachDismiss")}
                                                            accessibilityRole="button"
                                                            onPress={dismissCoach}
                                                        >
                                                            <MetaLine
                                                                qualifier={t("transaction.sentence.coachDismiss")}
                                                                qualifierIsAction
                                                                statement={t("transaction.sentence.coach")}
                                                            />
                                                        </Pressable>
                                                    ) : undefined
                                                }
                                                contentWidth={contentWidth}
                                                activeSlot={activeSlot}
                                                // Gated on an amount as well as on the
                                                // currency: with nothing entered there is
                                                // nothing to convert, and the strip would
                                                // warn that a resolved rate had not been set.
                                                conversion={
                                                    converts && amountNumber > 0 ? (
                                                        <ConversionStrip
                                                            amount={amountNumber}
                                                            amountUsd={amountInUsd(amountNumber)}
                                                            currency={currency}
                                                            labels={{
                                                                notConverted: t("transaction.rate.notConverted"),
                                                                pendingBody: t("transaction.rate.pendingBody"),
                                                                setRate: t("transaction.rate.setRate"),
                                                            }}
                                                            language={language}
                                                            onPress={openRateStep}
                                                            rate={
                                                                rateInForce === null
                                                                    ? null
                                                                    : { source: rateSourceLabel, value: rateInForce }
                                                            }
                                                        />
                                                    ) : undefined
                                                }
                                                amountFlagged={amountError}
                                                amountShake={amountShake}
                                                extras={[
                                                    tagLabels === null
                                                        ? null
                                                        : t("transaction.sentence.extra.tags", { tags: tagLabels }),
                                                    splitAllocations.length === 0
                                                        ? null
                                                        : t("transaction.sentence.extra.split", {
                                                              parts: t("transaction.split.count", {
                                                                  count: splitAllocations.length,
                                                              }),
                                                          }),
                                                    noteSummary.length === 0
                                                        ? null
                                                        : t("transaction.sentence.extra.note", { note: noteSummary }),
                                                ].filter((line) => line !== null)}
                                                labels={sentenceLabels}
                                                merchant={merchantSeed.length === 0 ? null : merchantSeed}
                                                merchantTile={merchantTile}
                                                onAccountPress={() => enterStep("account")}
                                                onAmountPress={() => leaveTo("amount")}
                                                onCategoryPress={() => enterStep("category")}
                                                onCurrencyPress={() => enterStep("currency")}
                                                onKindPress={() => handleTypeChange(income ? "expense" : "income")}
                                                // The word is a way into its step as much as the
                                                // other facts are, and the step is what carries the
                                                // names this ledger already knows.
                                                onMerchantPress={() => enterStep("merchant")}
                                                onWhenPress={() => enterStep("when")}
                                                verbs={[
                                                    {
                                                        active: hasIdentityMark,
                                                        key: "icon",
                                                        label: t("transaction.sentence.add.icon"),
                                                        onPress: openPicker,
                                                        onRemove: clearIdentity,
                                                        removeAccessibilityLabel: t(
                                                            "transaction.identity.hero.removeLogo"
                                                        ),
                                                    },
                                                    {
                                                        active: tagLabels !== null,
                                                        key: "tags",
                                                        label:
                                                            tagCount === 0
                                                                ? t("transaction.sentence.add.tags")
                                                                : tagLabel(tagCount),
                                                        onPress: () => {
                                                            Keyboard.dismiss();
                                                            tagSheetRef.current?.present();
                                                        },
                                                    },
                                                    {
                                                        active: splitAllocations.length > 0,
                                                        disabled: amountNumber <= 0,
                                                        key: "split",
                                                        label:
                                                            splitAllocations.length === 0
                                                                ? t("transaction.sentence.add.split")
                                                                : splitLabel(splitAllocations.length),
                                                        onPress: () => {
                                                            // A sheet presents over the note's keyboard rather
                                                            // than under it, and the field it belongs to is gone
                                                            // from the screen by then.
                                                            Keyboard.dismiss();
                                                            openSplit(amountNumber, category?.id ?? null, minorUnits);
                                                            splitSheetRef.current?.present();
                                                        },
                                                    },
                                                    {
                                                        active: isSubscription,
                                                        key: "repeat",
                                                        label: isSubscription
                                                            ? repeatChipLabel()
                                                            : t("transaction.sentence.add.repeat"),
                                                        onPress: () => enterStep("repeat"),
                                                        // The step names cadences, not "never": the
                                                        // way back off a schedule is the chip's own
                                                        // ✕, which only a set chip draws.
                                                        onRemove: () => handleKindChange("once"),
                                                        removeAccessibilityLabel: t("transaction.schedule.stopRepeat"),
                                                    },
                                                    {
                                                        active: noteOpen || noteSummary.length > 0,
                                                        key: "note",
                                                        label: t("transaction.sentence.add.note"),
                                                        onPress: () => setNoteOpen((open) => !open),
                                                    },
                                                ]}
                                                when={whenLabel}
                                            />
                                        </RNHostView>
                                    );
                                }}
                            </SubscribeFields>

                            {noteOpen ? (
                                <RNHostView matchContents>
                                    <Animated.View entering={revealEntering()} style={{ width: contentWidth }}>
                                        <TextInput
                                            accessibilityLabel={t("transaction.field.notes")}
                                            className="text-body text-foreground min-h-24"
                                            defaultValue={notesSeed}
                                            multiline
                                            onChangeText={(next) => {
                                                notesRef.current = next;
                                            }}
                                            onEndEditing={() => setNoteSummary(notesRef.current)}
                                            placeholder={t("transaction.field.notesPlaceholder")}
                                            placeholderTextColor={colors.muted}
                                            textAlignVertical="top"
                                        />
                                    </Animated.View>
                                </RNHostView>
                            ) : null}
                        </VStack>
                    </ScrollView>
                </Host>

                {/* A strip under the header, not a floating pill: it is the Save button's
				    own line, and it must not be mistaken for a row of the form. */}
                <View
                    className="absolute right-0 left-0 px-5 pt-2"
                    onLayout={(e) => setFailureHeight(e.nativeEvent.layout.height)}
                    pointerEvents="none"
                    style={{
                        backgroundColor: saveFailure === null ? "transparent" : colors.background,
                        borderBottomColor: colors.separator,
                        borderBottomWidth: saveFailure === null ? 0 : StyleSheet.hairlineWidth,
                        // Under the nav bar, which this screen's root runs behind.
                        top: HEADER_HEIGHT,
                    }}
                >
                    <InlineFailure message={saveFailure} />
                </View>

                <SubscribeFields
                    selector={(s) => ({
                        busy: s.isSubmitting,
                        complete: numpadToNumber(s.values.amount) > 0,
                    })}
                    store={form.store}
                >
                    {({ busy, complete }) => (
                        <TransactionFormCta
                            blockedTint={colors.subtle}
                            busy={busy}
                            canSave={complete && !busy}
                            deleteLabel={t("common.delete")}
                            deleteTint={colors.danger}
                            lookupBusy={enriching}
                            lookupLabel={t("transaction.cta.lookup")}
                            onDelete={onDelete}
                            onLookup={mode === "edit" ? lookUpMerchant : undefined}
                            onPress={() => {
                                if (complete) {
                                    pressSubmit(form);
                                    return;
                                }
                                flagMissingAmount();
                                leaveTo("amount");
                            }}
                            saveLabel={ctaLabel}
                        />
                    )}
                </SubscribeFields>

                {showToast ? (
                    <Animated.View
                        entering={FadeInDown.springify()}
                        exiting={FadeOutDown}
                        pointerEvents="none"
                        style={{
                            alignItems: "center",
                            bottom: 90,
                            left: 0,
                            position: "absolute",
                            right: 0,
                        }}
                    >
                        <View
                            className="flex-row items-center gap-2 rounded-full"
                            style={{
                                backgroundColor: colors.surface,
                                borderColor: withAlpha(colors.foreground, 0.12),
                                borderWidth: 1,
                                paddingHorizontal: 18,
                                paddingVertical: 10,
                            }}
                        >
                            <SymbolView
                                name="checkmark"
                                size={15}
                                tintColor={colors.income}
                                type="monochrome"
                                weight="semibold"
                            />
                            <Text className="font-sans-semibold text-income text-subtitle">{toastLabel}</Text>
                        </View>
                    </Animated.View>
                ) : null}

                {celebrate && burstSeed !== 0 ? (
                    <Confetti height={windowHeight} seed={burstSeed} width={windowWidth} />
                ) : null}

                {/* The stage's merchant step edits the same string the sentence
				    does, and the software keyboard covers a surface docked to the
				    bottom of the screen. Only that step lifts: every other one is
				    what the keyboard is meant to uncover. */}
                <KeyboardAvoidingView behavior="padding" enabled={stageStep === "merchant"}>
                    <SubscribeFields
                        selector={(s) => ({ amount: s.values.amount, merchant: s.values.merchant })}
                        store={form.store}
                    >
                        {({ amount, merchant }) => renderStage(amount, merchant)}
                    </SubscribeFields>
                </KeyboardAvoidingView>

                <SplitSheet
                    allocations={splitAllocations}
                    code={currency}
                    db={db}
                    income={income}
                    minorUnits={minorUnitsFor(currency)}
                    onChange={setSplitAllocations}
                    ref={splitSheetRef}
                    total={numpadToNumber(form.store.state.values.amount)}
                />
                <SubscribeFields
                    selector={(s) => ({
                        pendingTagNames: s.values.pendingTagNames,
                        tagIds: s.values.tagIds,
                    })}
                    store={form.store}
                >
                    {({ tagIds, pendingTagNames }) => (
                        <TagPickerSheet
                            onCreate={async (createdTagName) => {
                                const id = await tagsRepo.ensureTag(db, createdTagName);
                                if (id) {
                                    setTagsSource("user");
                                    markTouched("tags");
                                    form.setFieldValue("tagIds", [...effectiveTagIdsOf(form.state.values.tagIds), id]);
                                    form.setFieldValue("pendingTagNames", (current) =>
                                        current.filter(
                                            (pendingName) => normalizeTagName(pendingName) !== createdTagName
                                        )
                                    );
                                }
                                return id;
                            }}
                            onToggle={(tagId) => {
                                setTagsSource("user");
                                markTouched("tags");
                                const current = effectiveTagIdsOf(form.state.values.tagIds);
                                form.setFieldValue(
                                    "tagIds",
                                    current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
                                );
                            }}
                            pendingTagNames={pendingTagNames}
                            ref={tagSheetRef}
                            selected={effectiveTagIdsOf(tagIds)}
                            tags={allTags}
                        />
                    )}
                </SubscribeFields>

                <SubscribeFields selector={(s) => ({ date: s.values.date })} store={form.store}>
                    {({ date: firstPaymentDate }) => (
                        <CustomScheduleSheet
                            firstPayment={firstPaymentDate}
                            onDone={(type, every) => {
                                form.setFieldValue("recurringType", type);
                                form.setFieldValue("coefficient", every);
                                form.setFieldValue("isSubscription", true);
                            }}
                            onOpenChange={setScheduleSheetOpen}
                            open={scheduleSheetOpen}
                            recurringCoefficient={coefficient}
                            recurringType={recurringType}
                        />
                    )}
                </SubscribeFields>

                <IdentityFlyUpLayer
                    color={identity.color}
                    containerHeight={containerHeight}
                    emoji={identity.emoji}
                    icon={identity.icon}
                    income={income}
                    onDismiss={router.back}
                    photoUri={identity.photoUri}
                    restTop={heroRestTop}
                    variant="transaction"
                />

                <PortalHost />
            </View>
        </PortalProvider>
    );
}

function oneYearFrom(date: Date): Date {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + 1);
    return d;
}
