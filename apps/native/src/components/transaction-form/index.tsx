import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import {
    Button,
    Divider,
    Host,
    HStack,
    Image,
    RNHostView,
    ScrollView,
    Spacer,
    Text as SwiftText,
    TextField,
    Toggle,
    useNativeState,
    VStack,
} from "@expo/ui/swift-ui";
import {
    animation,
    blur,
    buttonStyle,
    foregroundStyle,
    labelsHidden,
    multilineTextAlignment,
    offset,
    overlay,
    padding,
    strokeBorder,
    tint,
} from "@expo/ui/swift-ui/modifiers";
import { PieChartIcon, RepeatIcon, Tag01Icon, TagsIcon, TextIcon } from "@hugeicons-pro/core-stroke-rounded";
import { ENTRY_RATE_TYPES } from "@outlayr/money/rates";
import type { EntryRateType } from "@outlayr/money/rates";
import { useField, useForm, useSelector } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PortalHost, PortalProvider } from "panelui-native";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, useColorScheme, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { Confetti } from "@/components/confetti";
import { useCategoryPickerField } from "@/components/form/category-picker-field";
import { shallowEqual } from "@/components/form/shallow-equal";
import { holdSubmitting, pressSubmit } from "@/components/form/submit-guard";
import { SubscribeFields } from "@/components/form/subscribe-fields";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useIdentityDraft, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { getAccountById, getLastUsedAccount, rememberLastUsedAccount } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import { useCategoriesByNamespace } from "@/data/categories";
import { ensureCategoryByName, getCategoryById } from "@/data/categories-core";
import { rememberedCategoryFor } from "@/data/merchant-history-core";
import { ratesRevision, subscribeRatesRevision } from "@/data/rates-revision";
import { backfillRecurring } from "@/data/recurrence-backfill";
import { setBoolSetting } from "@/data/settings-core";
import { splitsRepo } from "@/data/splits-core";
import { useTagIdsFor, useTags } from "@/data/tags";
import { tagsRepo } from "@/data/tags-core";
import { transactionRateSuggestions } from "@/data/transaction-entry-rates";
import { transactionsRepo } from "@/data/transactions-core";
import type { Transaction, TransactionInput } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { firstAvailableColor } from "@/domain/category-color";
import { FALLBACK_EXPENSE_ICON, FALLBACK_INCOME_ICON, iconKeysMatching } from "@/domain/category-icon-catalog";
import { CONFETTI_FLIGHT_MS } from "@/domain/confetti";
import { computeCurtainHues } from "@/domain/curtain-hues";
import { amountParts, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { ensureRecurringType, RECURRING_TYPE, SELECTABLE_RECURRING_TYPES } from "@/domain/recurrence";
import { enableReminderStep } from "@/domain/reminder";
import type { Allocation } from "@/domain/split";
import { isRealSplit } from "@/domain/split-draft";
import { normalizeLead, REMINDER_LEAD_OPTIONS, resolveLeadSelection } from "@/domain/subscription-reminder";
import { findTagByName, normalizeTagName } from "@/domain/tags";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import { isTransactionRateNeeded, transactionRateError } from "@/domain/transaction-entry-rate";
import { cadenceLabel, ctaKey, leadLabel } from "@/domain/transaction-form-labels";
import { buildTransactionInput } from "@/domain/transaction-form-save";
import { isMissingCategory, transactionFormErrors } from "@/domain/transaction-form-validate";
import { useLocaleTag } from "@/hooks/use-locale-tag";
import { useRegionCode } from "@/hooks/use-region-code";
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

import { AccountPickerSheet } from "../account-picker-sheet";
import { CategoryIcon } from "../category-icon";
import { CategoryIconTile } from "../category-icon-tile";
import { CategoryPickerSheet } from "../category-picker-sheet";
import { CurrencyPickerSheet } from "../currency-picker-sheet";
import { CustomScheduleSheet, intervalPhrase } from "../custom-schedule-sheet";
import { CURTAIN_LAYER_SIZE, curtainGradient } from "../identity-curtain";
import { IdentityFlyUpLayer } from "../identity-fly-up";
import { SplitSheet } from "../split-sheet";
import { TagPickerSheet } from "../tag-picker-sheet";
import { Text } from "../text";
import { TransactionFormAmountHero } from "./amount-hero";
import { TransactionFormAmountPad } from "./amount-pad";
import { TransactionFormCta } from "./cta";
import { TransactionFormDetailsSection } from "./details-section";
import { TransactionFormIdentitySection } from "./identity-section";
import { TransactionFormRateSection } from "./rate-section";
import { TransactionFormRowIcon } from "./row-icon";
import { TransactionFormScheduleSection } from "./schedule-section";
import { BODY, CAPTION, ENRICHING, FLY_BACK, FLY_UP, FORM_BLUR_RADIUS, ROW, rowLabel, SHAKE, TAP_ROW } from "./style";
import { useSplitDraft } from "./use-split-draft";

/**
 * Only reached if `onGeometryChange` never fires; a real measurement always
 * supersedes it. A 70pt nav-bar scroll inset plus the hero section's own top
 * padding.
 */
const HERO_REST_TOP_FALLBACK = 88;

/**
 * A SwiftUI `tag()` set has to be one type, and Off is the absence of a lead
 * rather than a count of days — so it rides along as a sentinel and is turned
 * back into `null` the instant the selection arrives. A -1 that escaped that
 * boundary would reach `normalizeLead`, which clamps it to 0 and so arms a
 * reminder on the due day for the owner who just switched reminders off.
 */
const LEAD_OFF_TAG = -1;

const RATE_DISPLAY_DECIMALS = 4;

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
 * What an outside surface — a quick action, a widget, an App Intent — can put in
 * the form before the user sees it: a suggestion the user still confirms, never
 * identity, recurrence or category.
 */
export interface TransactionSeed {
    amount?: number;
    income?: boolean;
    note?: string;
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

function seedAccount(db: Database, initial: Transaction | undefined) {
    if (!initial) {
        return getLastUsedAccount(db);
    }
    return initial.accountId ? getAccountById(db, initial.accountId) : null;
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

function selectedRateError(currency: string, exchangeRate: number | null, exchangeRateType: EntryRateType | null) {
    if (currency === "USD" || exchangeRateType == null) {
        return null;
    }
    return transactionRateError(currency, { exchangeRate, exchangeRateType });
}

function transactionRateViewState({
    currency,
    exchangeRateText,
    exchangeRateType,
    amountUsd,
    requiredLabel,
}: {
    amountUsd: number | null | undefined;
    currency: string;
    exchangeRateText: string;
    exchangeRateType: EntryRateType | null;
    requiredLabel: string;
}) {
    const exchangeRate = exchangeRateText === "" ? null : numpadToNumber(exchangeRateText);
    const error = selectedRateError(currency, exchangeRate, exchangeRateType) === null ? null : requiredLabel;
    return {
        error,
        pending: isTransactionRateNeeded({ amountUsd, exchangeRate, exchangeRateType }),
        selection: { exchangeRate, exchangeRateType: exchangeRateType ?? "official" },
    };
}

interface TransactionRateControlsOptions {
    currency: string;
    date: Date;
    exchangeRateType: EntryRateType | null;
    initialRateFromProvider: boolean;
    setAmountPadOpen: (open: boolean) => void;
    setCurrency: (currency: string) => void;
    setDate: (date: Date) => void;
    setRateText: (rateText: string) => void;
    setRateType: (rateType: EntryRateType | null) => void;
}

function useTransactionRateControls({
    currency,
    date,
    exchangeRateType,
    initialRateFromProvider,
    setAmountPadOpen,
    setCurrency,
    setDate,
    setRateText,
    setRateType,
}: TransactionRateControlsOptions) {
    const rateFromSuggestion = useRef(initialRateFromProvider);
    const [ratePadOpen, setRatePadOpen] = useState(false);

    const handleRateTypeChange = (next: EntryRateType) => {
        setAmountPadOpen(false);
        rateFromSuggestion.current = false;
        setRateType(next);
        setRateText("");
        setRatePadOpen(next === "custom");
    };

    const handleRateSuggestion = (rate: number, type: EntryRateType) => {
        rateFromSuggestion.current = true;
        setRateType(type);
        setRateText(rateToEntryText(rate));
        setRatePadOpen(false);
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
            setRatePadOpen(false);
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

    const openCustomRatePad = () => {
        setAmountPadOpen(false);
        setRatePadOpen(true);
    };

    return {
        handleCurrencyChange,
        handleDateChange,
        handleRateSuggestion,
        handleRateTextChange,
        handleRateTypeChange,
        openCustomRatePad,
        ratePadOpen,
        setRatePadOpen,
    };
}

interface CategoryRowProps {
    category: ReturnType<typeof getCategoryById>;
    enriching: boolean;
    error: boolean;
    glyphTint: string;
    labelTint: string;
    onPress: () => void;
    pendingCategory: PendingCategory | null;
    shake: boolean;
}

/**
 * Sits beside Tags rather than inside the Category row: the Category row is a
 * SwiftUI tree, and a variable number of parts inside it would fight the Host's
 * sizing for no gain the user can see.
 */
function TransactionFormSplitRow({
    allocations,
    onPress,
}: {
    allocations: readonly Allocation[];
    onPress: () => void;
}) {
    const colors = useColors();
    const t = useTranslation();
    const split = isRealSplit(allocations);

    return (
        <Button modifiers={[buttonStyle("plain")]} onPress={onPress}>
            <HStack modifiers={TAP_ROW} spacing={12}>
                <TransactionFormRowIcon color={colors.muted} icon={PieChartIcon} />
                <SwiftText modifiers={[BODY, rowLabel]}>{t("transaction.split.row")}</SwiftText>
                <Spacer />
                <HStack spacing={5}>
                    <SwiftText modifiers={[BODY, foregroundStyle(split ? colors.foreground : colors.muted)]}>
                        {split
                            ? t("transaction.split.count", { count: allocations.length })
                            : t("transaction.tags.none")}
                    </SwiftText>
                    <Image color={colors.muted} size={12} systemName="chevron.up.chevron.down" />
                </HStack>
            </HStack>
        </Button>
    );
}

function TransactionFormCategoryRow({
    category,
    enriching,
    error,
    glyphTint,
    labelTint,
    onPress,
    pendingCategory,
    shake,
}: CategoryRowProps) {
    const colors = useColors();
    const t = useTranslation();
    const errorBorder = error
        ? [
              strokeBorder({
                  color: colors.danger,
                  cornerRadius: 12,
                  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- the key is @expo/ui's strokeBorder option name
                  shape: "roundedRectangle",
                  style: { lineWidth: 1.5 },
              }),
          ]
        : [];
    const chosen = category ?? pendingCategory;
    const label = chosen ? chosen.name : t("transaction.category.choose");
    const pendingNote = pendingCategory?.parentName
        ? t("transaction.category.willBeCreatedUnder", { parent: pendingCategory.parentName })
        : t("transaction.category.willBeCreated");

    return (
        <Button
            modifiers={[buttonStyle("plain"), ...errorBorder, offset({ x: shake ? -5 : 0 }), animation(SHAKE, shake)]}
            onPress={onPress}
        >
            <VStack spacing={0}>
                <HStack modifiers={TAP_ROW} spacing={12}>
                    <TransactionFormRowIcon color={error ? colors.danger : colors.muted} icon={Tag01Icon} />
                    <SwiftText modifiers={[BODY, error ? foregroundStyle(colors.danger) : rowLabel]}>
                        {t("transaction.field.category")}
                    </SwiftText>
                    <Spacer />
                    <HStack spacing={5}>
                        {category || pendingCategory ? (
                            <RNHostView matchContents>
                                <View style={{ height: 18, width: 18 }}>
                                    <CategoryIcon
                                        color={glyphTint}
                                        name={category ? category.icon : pendingCategory?.icon}
                                        size={18}
                                    />
                                </View>
                            </RNHostView>
                        ) : null}
                        <SwiftText modifiers={[BODY, foregroundStyle(labelTint), animation(ENRICHING, enriching)]}>
                            {label}
                        </SwiftText>
                        <Image color={colors.muted} size={12} systemName="chevron.up.chevron.down" />
                    </HStack>
                </HStack>
                {pendingCategory ? (
                    <HStack modifiers={[padding({ bottom: 10 })]} spacing={0}>
                        <Spacer />
                        <SwiftText modifiers={[CAPTION, foregroundStyle(colors.muted)]}>{pendingNote}</SwiftText>
                    </HStack>
                ) : null}
            </VStack>
        </Button>
    );
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
    const globalCurrency = useGlobalCurrency(db);

    const name = useNativeState(initial?.note ?? copyOf?.note ?? seed?.note ?? "");
    const notes = useNativeState(initial?.details ?? copyOf?.details ?? "");

    const { draft: identity, setDraft: setIdentity } = useIdentityDraft();
    const [identitySource, setIdentitySource] = useState<FieldSource>("initial");
    const { pickerOpen, setPickerOpen, floatProgress } = useIdentityFlyUp();

    // Frozen at mount: `useForm` re-applies changed `defaultValues` on every
    // render while untouched, and `date`/`endDate` are `new Date()` here — an
    // inline object would silently re-seed both to "now" every render.
    // oxlint-disable-next-line complexity -- the seed has to reconcile initial, copyOf and seed across category, currency and rate in one pass, because `useForm` only reads it once
    const [initialValues] = useState(() => {
        const sourceId = initial?.categoryId ?? copyOf?.categoryId;
        const seedCategory = sourceId ? getCategoryById(db, sourceId) : null;
        const currencySeed = initial?.currency ?? copyOf?.currency ?? null;
        const amountSeed = initial?.amount ?? copyOf?.amount ?? seed?.amount;
        const effectiveCurrency = currencySeed ?? globalCurrency;
        // SAFETY: three of the fields below start empty and are filled as the form
        // is used, so each initial literal has to carry the type the field will end
        // up holding rather than the empty one it starts as.
        return {
            account: seedAccount(db, initial),
            amount: amountSeed == null ? "" : numberToNumpad(amountSeed, minorUnitsFor(currencySeed ?? globalCurrency)),
            category: seedCategory,
            coefficient: initial?.recurringCoefficient ?? 1,
            date: initial ? new Date(initial.date) : new Date(),
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
            isSubscription: (initial?.recurringType ?? RECURRING_TYPE.none) !== RECURRING_TYPE.none,
            leadDays: normalizeLead(initial?.reminderLeadDays ?? null),
            pendingCategory: null as PendingCategory | null,
            pendingTagNames: [] as readonly string[],
            recurringType:
                initial?.recurringType && initial.recurringType !== RECURRING_TYPE.none
                    ? initial.recurringType
                    : RECURRING_TYPE.monthly,
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
                amount: numpadToNumber(value.amount),
                categoryId,
                coefficient: value.coefficient,
                currency: value.txCurrency,
                customColor: identity.color,
                date: value.date,
                details: notes.value,
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
                note: name.value,
                recurringType: value.recurringType,
            });
            let savedId: string;
            try {
                savedId = await persistTransaction(db, mode, initial, input);
            } catch (error) {
                console.error("Failed to save transaction", error);
                // Nothing was written, so the retry is the same tap again — but say so
                // first: un-dimming the CTA in silence is indistinguishable from having
                // missed the button.
                haptics("error");
                Alert.alert(t("transaction.save.failedTitle"), t("transaction.save.failedBody"));
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
            // After the row exists, for the same reason tags are: the parts point at
            // it. A single part is stored as no split at all, which is what keeps an
            // entry attributed by its own `categoryId` rather than by an equivalent
            // row saying the same thing.
            try {
                await splitsRepo.setSplit(
                    db,
                    savedId,
                    numpadToNumber(value.amount),
                    isRealSplit(splitAllocations) ? splitAllocations : []
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
            if (isMissingCategory(value)) {
                flagMissingCategory();
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
        exchangeRateText,
        exchangeRateType,
    } = useSelector(
        form.store,
        (s) => ({
            account: s.values.account,
            category: s.values.category,
            coefficient: s.values.coefficient,
            date: s.values.date,
            exchangeRateText: s.values.exchangeRateText,
            exchangeRateType: s.values.exchangeRateType,
            income: s.values.income,
            isSubscription: s.values.isSubscription,
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
    const rateViewState = transactionRateViewState({
        amountUsd: initial?.amountUsd,
        currency,
        exchangeRateText,
        exchangeRateType,
        requiredLabel: t("transaction.rate.required"),
    });

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
    const scheme = useColorScheme();
    const isDark = scheme === "dark";
    const router = useRouter();

    // Open on arrival for a new entry: the amount is the first thing a create is
    // for. An edit already has one, so it starts closed and the rest is visible.
    const [padOpen, setPadOpen] = useState(mode === "create");
    const {
        handleCurrencyChange,
        handleDateChange,
        handleRateSuggestion,
        handleRateTextChange,
        handleRateTypeChange,
        openCustomRatePad,
        ratePadOpen,
        setRatePadOpen,
    } = useTransactionRateControls({
        currency,
        date,
        exchangeRateType,
        initialRateFromProvider: isProviderRate(initial?.exchangeRate, exchangeRateType),
        setAmountPadOpen: setPadOpen,
        setCurrency: (next) => form.setFieldValue("txCurrency", next),
        setDate: (next) => form.setFieldValue("date", next),
        setRateText: (next) => form.setFieldValue("exchangeRateText", next),
        setRateType: (next) => form.setFieldValue("exchangeRateType", next),
    });
    const currencySheetRef = useRef<BottomSheetModal>(null);
    const {
        present: presentCategoryPicker,
        ref: categoryPickerRef,
        select: selectCategory,
    } = useCategoryPickerField((picked) => {
        form.setFieldValue("category", picked);
        form.setFieldValue("pendingCategory", null);
        setCategorySource("user");
        setCategoryError(false);
    });
    const createCategoryNamed = useCallback(
        async (categoryName: string) => {
            const siblings = latest.current.categories;
            const used = new Set(
                siblings.map((sibling) => sibling.color).filter((color): color is string => color != null)
            );
            const fallbackIcon = income ? FALLBACK_INCOME_ICON : FALLBACK_EXPENSE_ICON;
            try {
                const id = await ensureCategoryByName(
                    db,
                    categoryName,
                    income,
                    iconKeysMatching(categoryName)[0] ?? fallbackIcon,
                    firstAvailableColor(used)
                );
                const created = getCategoryById(db, id);
                if (created != null) {
                    selectCategory(created);
                }
            } catch (error) {
                console.error("Failed to create the category", error);
            }
        },
        [db, income, selectCategory]
    );
    const tagSheetRef = useRef<BottomSheetModal>(null);
    const splitSheetRef = useRef<BottomSheetModal>(null);
    const {
        allocations: splitAllocations,
        openSplit,
        setAllocations: setSplitAllocations,
    } = useSplitDraft(db, mode, initial);
    const accountSheetRef = useRef<BottomSheetModal>(null);
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
    const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
    const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
     * A suggested logo stays replaceable: typing on past one merchant to another
     * has to move the image with the name, so only a real choice ("user") or an
     * open picker stops it. Each run takes a ticket, and a result that settles
     * after a newer one started is dropped rather than painted over it.
     */
    const attachLogo = useCallback(
        async (domain: string | null) => {
            const blocked = () =>
                latest.current.identitySource === "user" ||
                latest.current.pickerOpen ||
                // An emoji or photo carried in from `initial`/`copyOf` is a choice
                // already made; only an empty well or an earlier suggestion moves.
                (latest.current.identitySource === "initial" && latest.current.hasIdentity);
            if (blocked()) {
                return;
            }
            logoRequestRef.current += 1;
            const ticket = logoRequestRef.current;
            const stale = () => ticket !== logoRequestRef.current || blocked();

            const outcome = await fetchMerchantImage({
                domain,
                name: name.value,
            });
            if (stale()) {
                return;
            }
            if (outcome.kind !== "logo") {
                // The new merchant resolved to nothing, so the previous merchant's
                // logo has to go with it — keeping it would caption this entry with
                // the wrong brand.
                if (latest.current.identitySource === "suggested") {
                    setIdentitySource("initial");
                    setIdentity((previous) => ({
                        ...previous,
                        photoColor: null,
                        photoUri: null,
                    }));
                }
                return;
            }
            let photoUri: string;
            try {
                // Required lazily so rendering this form does not pull Skia's downscaler
                // into the module graph, matching `domain/ids.ts`.
                // SAFETY: `require` is untyped; the path is a first-party module and the
                // asserted type is that same module's own.
                const photoStorage = require("@/lib/photo-storage") as typeof import("@/lib/photo-storage");
                photoUri = await photoStorage.persistLogoBytes(outcome.bytes);
            } catch {
                return;
            }
            // Same tint the picker extracts for a chosen photo, so an auto-attached
            // logo colours the well and the curtain behind it rather than sitting on
            // the neutral fallback. An unreadable image costs the tint alone.
            const hues = await glowFromImage(photoUri);
            if (stale()) {
                return;
            }
            setIdentitySource("suggested");
            setIdentity((previous) => ({
                ...previous,
                photoColor: hues[0] ?? null,
                photoUri,
            }));
        },
        [name, setIdentity]
    );

    /*
     * Not wrapped in `useCallback`: it both reads and sets `categorySource` and
     * `tagsSource`, which the compiler could not reconcile with a hand-written
     * dependency list, so it declined to optimize the whole form. Its only
     * consumer reads it through the enrichment hook's committed snapshot rather
     * than a dependency array, so the identity is free to change.
     */
    const applySuggestion = (suggestion: EnrichmentSuggestion) => {
        if (categorySource !== "user") {
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
        if (tagsSource !== "user") {
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
        attachLogo(suggestion.domain).catch(() => undefined);
    };

    const locale = useLocaleTag();
    const regionCode = useRegionCode();
    const { onNameChange, pending: enriching } = useTransactionEnrichment({
        categoryTree,
        enabled: mode === "create",
        groundedLookup,
        income,
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
    const tagsEnriching = enriching && tagsSource !== "user";

    useEffect(
        () => () => {
            if (shakeTimer.current != null) {
                clearTimeout(shakeTimer.current);
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

    // Custom intervals come from the stepper sheet, not from this menu.
    const handleScheduleChange = (type: number) => {
        form.setFieldValue("recurringType", type);
        form.setFieldValue("coefficient", 1);
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

    const handleLeadChange = (next: number) => {
        const lead = resolveLeadSelection(next, LEAD_OFF_TAG);
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

    // The spring starts here, not from the picker route's mount effect, so the
    // hero launches on the tap frame instead of waiting for navigation to commit
    // the new screen.
    const openPicker = () => {
        setIdentitySource("user");
        setPickerOpen(true);
        router.push("/transactions/identity");
    };

    const ctaLabel = t(ctaKey(mode, isSubscription));

    const amountColorFor = (amountNumber: number) => {
        if (amountNumber <= 0) {
            return colors.muted;
        }
        return income ? colors.income : colors.foreground;
    };

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

    const hairline = [overlay({ color: withAlpha(colors.foreground, 0.08) })];
    const chosenCategoryTint = category?.income ? colors.income : (category?.color ?? colors.foreground);
    const categoryGlyphTint = category ? chosenCategoryTint : (pendingCategory?.color ?? colors.muted);
    const settledCategoryLabelTint = category || pendingCategory ? colors.foreground : colors.muted;
    const categoryLabelTint = categoryEnriching ? withAlpha(colors.muted, 0.45) : settledCategoryLabelTint;

    const cadenceOptions = SELECTABLE_RECURRING_TYPES.map((type) => ({
        label: cadenceLabel(t, type),
        type,
    }));
    const leadOptions = REMINDER_LEAD_OPTIONS.map((lead) => ({
        label: leadLabel(t, lead),
        lead,
    }));

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
                        ]}
                    >
                        <VStack modifiers={[padding({ bottom: 40, horizontal: 20 })]} spacing={16}>
                            <TransactionFormIdentitySection
                                color={identity.color}
                                contentWidth={contentWidth}
                                emoji={identity.emoji}
                                floatProgress={floatProgress}
                                heroWinY={heroWinY}
                                icon={identity.icon}
                                income={income}
                                onPress={() => {
                                    setPadOpen(false);
                                    openPicker();
                                }}
                                onReset={() => {
                                    setIdentitySource("user");
                                    setIdentity({
                                        color: null,
                                        emoji: null,
                                        icon: null,
                                        photoColor: null,
                                        photoUri: null,
                                    });
                                }}
                                photoUri={identity.photoUri}
                            />

                            <form.Subscribe selector={(s) => s.values.amount}>
                                {(amount) => {
                                    const amountNumber = numpadToNumber(amount);
                                    return (
                                        <TransactionFormAmountHero
                                            amount={amountNumber}
                                            amountColor={amountColorFor(amountNumber)}
                                            chipColor={withAlpha(colors.foreground, 0.08)}
                                            contentWidth={contentWidth}
                                            currency={currency}
                                            expenseLabel={t("common.expense")}
                                            income={income}
                                            incomeLabel={t("common.income")}
                                            minorUnits={minorUnits}
                                            mutedColor={colors.muted}
                                            onCurrencyPress={() => currencySheetRef.current?.present()}
                                            onPress={() => setPadOpen(true)}
                                            onTypeChange={handleTypeChange}
                                            symbol={amountParts(amountNumber, currency, true, language).symbol}
                                        />
                                    );
                                }}
                            </form.Subscribe>

                            <TransactionFormRateSection
                                currency={currency}
                                error={rateViewState.error}
                                labels={{
                                    currentSuggestion: t("transaction.rate.currentSuggestion"),
                                    custom: t("transaction.rate.custom"),
                                    editCustom: t("transaction.rate.editCustom"),
                                    eurReference: t("transaction.rate.eur_reference"),
                                    official: t("transaction.rate.official"),
                                    pendingBody: t("transaction.rate.pendingBody"),
                                    pendingTitle: t("transaction.rate.pendingTitle"),
                                    perUsd: t("transaction.rate.perUsd", { currency }),
                                    priorCustomDate: (priorDate) =>
                                        t("transaction.rate.priorCustomDate", { date: priorDate.toLocaleDateString() }),
                                    priorCustomSuggestion: t("transaction.rate.priorCustomSuggestion"),
                                    required: t("transaction.rate.required"),
                                    requiredHint: t("transaction.rate.requiredHint"),
                                    title: t("transaction.rate.title"),
                                    useSuggestion: t("transaction.rate.useSuggestion"),
                                }}
                                onEditCustom={openCustomRatePad}
                                onSelectType={handleRateTypeChange}
                                onUseSuggestion={handleRateSuggestion}
                                pending={rateViewState.pending}
                                selection={rateViewState.selection}
                                suggestions={rateSuggestions}
                            />

                            <VStack spacing={0}>
                                <HStack modifiers={ROW} spacing={12}>
                                    <TransactionFormRowIcon color={colors.muted} icon={RepeatIcon} />
                                    <SwiftText modifiers={[BODY, rowLabel]}>
                                        {t("transaction.kind.subscription")}
                                    </SwiftText>
                                    <Spacer />
                                    <Toggle
                                        isOn={isSubscription}
                                        modifiers={[tint(colors.income), labelsHidden()]}
                                        onIsOnChange={(next) => handleKindChange(next ? "subscription" : "once")}
                                    />
                                </HStack>

                                <Divider modifiers={hairline} />

                                <HStack modifiers={ROW} spacing={12}>
                                    <TransactionFormRowIcon color={colors.muted} icon={TextIcon} />
                                    <SwiftText modifiers={[BODY, rowLabel]}>{t("transaction.field.name")}</SwiftText>
                                    <TextField
                                        maxLength={50}
                                        modifiers={[BODY, multilineTextAlignment("trailing")]}
                                        onFocusChange={(focused) => focused && setPadOpen(false)}
                                        onTextChange={onNameChange}
                                        placeholder={t("transaction.field.namePlaceholder")}
                                        text={name}
                                    />
                                </HStack>

                                <Divider modifiers={hairline} />

                                <TransactionFormCategoryRow
                                    category={category}
                                    enriching={categoryEnriching}
                                    error={categoryError}
                                    glyphTint={categoryGlyphTint}
                                    labelTint={categoryLabelTint}
                                    onPress={() => {
                                        setPadOpen(false);
                                        presentCategoryPicker();
                                    }}
                                    pendingCategory={pendingCategory}
                                    shake={categoryShake}
                                />

                                <Divider modifiers={hairline} />

                                <Button
                                    modifiers={[buttonStyle("plain")]}
                                    onPress={() => {
                                        setPadOpen(false);
                                        tagSheetRef.current?.present();
                                    }}
                                >
                                    <HStack modifiers={TAP_ROW} spacing={12}>
                                        <TransactionFormRowIcon color={colors.muted} icon={TagsIcon} />
                                        <SwiftText modifiers={[BODY, rowLabel]}>
                                            {t("transaction.field.tags")}
                                        </SwiftText>
                                        <Spacer />
                                        <HStack spacing={5}>
                                            <SubscribeFields
                                                selector={(s) => ({
                                                    pendingTagNames: s.values.pendingTagNames,
                                                    tagIds: s.values.tagIds,
                                                })}
                                                store={form.store}
                                            >
                                                {({ tagIds, pendingTagNames }) => {
                                                    const selectedTagNames = tagLabelsOf(tagIds, pendingTagNames);
                                                    const settledTagsLabelTint = selectedTagNames
                                                        ? colors.foreground
                                                        : colors.muted;
                                                    return (
                                                        <SwiftText
                                                            modifiers={[
                                                                BODY,
                                                                foregroundStyle(
                                                                    tagsEnriching
                                                                        ? withAlpha(colors.muted, 0.45)
                                                                        : settledTagsLabelTint
                                                                ),
                                                                animation(ENRICHING, tagsEnriching),
                                                            ]}
                                                        >
                                                            {selectedTagNames ?? t("transaction.tags.none")}
                                                        </SwiftText>
                                                    );
                                                }}
                                            </SubscribeFields>
                                            <Image
                                                color={colors.muted}
                                                size={12}
                                                systemName="chevron.up.chevron.down"
                                            />
                                        </HStack>
                                    </HStack>
                                </Button>

                                <Divider modifiers={hairline} />

                                <TransactionFormSplitRow
                                    allocations={splitAllocations}
                                    onPress={() => {
                                        setPadOpen(false);
                                        openSplit(numpadToNumber(form.store.state.values.amount), category?.id ?? null);
                                        splitSheetRef.current?.present();
                                    }}
                                />

                                <Divider modifiers={hairline} />

                                <SubscribeFields
                                    selector={(s) => ({
                                        date: s.values.date,
                                        endDate: s.values.endDate,
                                        hasEndDate: s.values.hasEndDate,
                                        leadDays: s.values.leadDays,
                                    })}
                                    store={form.store}
                                >
                                    {({ date: scheduleDate, endDate, hasEndDate, leadDays }) => (
                                        <TransactionFormScheduleSection
                                            cadenceOptions={cadenceOptions}
                                            card={[]}
                                            customScheduleLabel={t("transaction.schedule.customOption")}
                                            date={scheduleDate}
                                            dateLabel={t("transaction.field.date")}
                                            endDate={endDate}
                                            endDateLabel={t("transaction.field.endDate")}
                                            endsLabel={t("transaction.field.ends")}
                                            firstPaymentLabel={t("transaction.field.firstPayment")}
                                            foregroundColor={colors.foreground}
                                            hairline={hairline}
                                            hasEndDate={hasEndDate}
                                            incomeColor={colors.income}
                                            isSubscription={isSubscription}
                                            leadDays={leadDays}
                                            leadOffLabel={t("transaction.remind.off")}
                                            leadOffTag={LEAD_OFF_TAG}
                                            leadOptions={leadOptions}
                                            mutedColor={colors.muted}
                                            onDateChange={handleDateChange}
                                            onEndDateChange={(next) => form.setFieldValue("endDate", next)}
                                            onHasEndDateChange={(next) => form.setFieldValue("hasEndDate", next)}
                                            onLeadChange={handleLeadChange}
                                            onOpenCustomSchedule={() => setScheduleSheetOpen(true)}
                                            onScheduleChange={handleScheduleChange}
                                            recurringType={recurringType}
                                            remindLabel={t("transaction.field.remind")}
                                            remindMenuLabel={leadLabel(t, leadDays)}
                                            scheduleLabel={t("transaction.field.schedule")}
                                            scheduleMenuLabel={t("transaction.schedule.every", {
                                                interval: intervalPhrase(t, recurringType, coefficient),
                                            })}
                                            timeLabel={t("transaction.field.time")}
                                        />
                                    )}
                                </SubscribeFields>

                                <Divider modifiers={hairline} />

                                <TransactionFormDetailsSection
                                    accountLabel={t("transaction.field.account")}
                                    accountName={account?.name ?? null}
                                    accountNoneLabel={t("transaction.account.none")}
                                    accountTile={
                                        account ? (
                                            <RNHostView matchContents>
                                                <View style={{ height: 18, width: 18 }}>
                                                    <CategoryIconTile
                                                        color={
                                                            account.imageColor ??
                                                            account.customColor ??
                                                            colors.foreground
                                                        }
                                                        emoji={account.emoji}
                                                        icon={account.icon}
                                                        imageUri={account.imageUri}
                                                        size={18}
                                                        type="solid"
                                                    />
                                                </View>
                                            </RNHostView>
                                        ) : undefined
                                    }
                                    card={[]}
                                    foregroundColor={colors.foreground}
                                    hairline={hairline}
                                    mutedColor={colors.muted}
                                    notes={notes}
                                    notesLabel={t("transaction.field.notes")}
                                    notesPlaceholder={t("transaction.field.notesPlaceholder")}
                                    onAccountPress={() => accountSheetRef.current?.present()}
                                />
                            </VStack>
                        </VStack>
                    </ScrollView>
                </Host>

                <form.Subscribe selector={(s) => numpadToNumber(s.values.amount) > 0 && !s.isSubmitting}>
                    {(canSave) => (
                        <TransactionFormCta
                            canSave={canSave}
                            deleteLabel={t("common.delete")}
                            deleteTint={colors.danger}
                            onDelete={onDelete}
                            onPress={() => pressSubmit(form)}
                            saveLabel={ctaLabel}
                        />
                    )}
                </form.Subscribe>

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

                <form.Subscribe selector={(s) => s.values.amount}>
                    {(amount) => (
                        <TransactionFormAmountPad
                            code={currency}
                            income={income}
                            minorUnits={minorUnits}
                            onChange={(next) => form.setFieldValue("amount", next)}
                            onOpenChange={setPadOpen}
                            open={padOpen}
                            value={amount}
                        />
                    )}
                </form.Subscribe>

                <form.Subscribe selector={(s) => s.values.exchangeRateText}>
                    {(rateText) => (
                        <TransactionFormAmountPad
                            code={`${currency}/USD`}
                            income={false}
                            minorUnits={RATE_DISPLAY_DECIMALS}
                            mode="explicitSeparator"
                            onChange={handleRateTextChange}
                            onOpenChange={setRatePadOpen}
                            open={ratePadOpen}
                            value={rateText}
                        />
                    )}
                </form.Subscribe>

                <CurrencyPickerSheet
                    onSelect={(next) => {
                        handleCurrencyChange(next);
                        currencySheetRef.current?.dismiss();
                    }}
                    ref={currencySheetRef}
                    selected={currency}
                />
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

                <AccountPickerSheet
                    db={db}
                    onCreate={() => {
                        accountSheetRef.current?.dismiss();
                        router.push("/settings/accounts/create");
                    }}
                    onSelect={(picked) => form.setFieldValue("account", picked)}
                    ref={accountSheetRef}
                    selectedId={account?.id ?? null}
                />

                <CategoryPickerSheet
                    db={db}
                    income={income}
                    onCreate={createCategoryNamed}
                    onSelect={selectCategory}
                    pendingCategory={pendingCategory}
                    ref={categoryPickerRef}
                    selectedId={category?.id ?? null}
                />
                <SubscribeFields selector={(s) => ({ date: s.values.date })} store={form.store}>
                    {({ date: firstPaymentDate }) => (
                        <CustomScheduleSheet
                            firstPayment={firstPaymentDate}
                            onDone={(type, every) => {
                                form.setFieldValue("recurringType", type);
                                form.setFieldValue("coefficient", every);
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
