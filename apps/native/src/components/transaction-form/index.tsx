import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import {
	Button,
	Divider,
	Host,
	HStack,
	Image,
	Menu,
	Picker,
	RNHostView,
	ScrollView,
	Spacer,
	Text as SwiftText,
	TextField,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui";
import {
	animation,
	background,
	blur,
	buttonStyle,
	foregroundStyle,
	multilineTextAlignment,
	offset,
	overlay,
	padding,
	pickerStyle,
	strokeBorder,
	tag,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, useColorScheme, useWindowDimensions, View } from "react-native";
import Animated, {
	FadeInDown,
	FadeOutDown,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { Confetti } from "@/components/confetti";
import { menuTint } from "@/components/native/styles";
import { useAppSettings } from "@/contexts/display-settings-context";
import {
	useIdentityDraft,
	useIdentityFlyUp,
} from "@/contexts/identity-draft-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	type Category,
	ensureCategoryByName,
	getCategoryById,
	useCategoriesByNamespace,
} from "@/data/categories";
import { setBoolSetting } from "@/data/settings";
import { tagsRepo, useTagIdsFor, useTags } from "@/data/tags";
import {
	backfillRecurring,
	type Transaction,
	transactionsRepo,
} from "@/data/transactions";
import type { Database } from "@/db/client";
import { CONFETTI_FLIGHT_MS } from "@/domain/confetti";
import { computeCurtainHues } from "@/domain/curtain-hues";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import {
	ensureRecurringType,
	RECURRING_TYPE,
	SELECTABLE_RECURRING_TYPES,
} from "@/domain/recurrence";
import { enableReminderStep } from "@/domain/reminder";
import {
	normalizeLead,
	REMINDER_LEAD_OPTIONS,
	resolveLeadSelection,
} from "@/domain/subscription-reminder";
import { findTagByName, normalizeTagName } from "@/domain/tags";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import {
	cadenceLabel,
	ctaKey,
	leadLabel,
} from "@/domain/transaction-form-labels";
import { buildTransactionInput } from "@/domain/transaction-form-save";
import {
	type EnrichmentSuggestion,
	type PendingCategory,
	useTransactionEnrichment,
} from "@/hooks/use-transaction-enrichment";
import { useTranslation } from "@/i18n";
import {
	openNotificationSettings,
	reminderPermission,
	requestReminderPermission,
} from "@/lib/reminders";
import { syncSubscriptionReminders } from "@/lib/subscription-reminder-sync";
import { useHaptics } from "@/lib/use-haptics";
import { glowFromEmoji } from "@/theme/glow";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { AmountEntrySheet } from "../amount-entry-sheet";
import { CategoryIcon } from "../category-icon";
import {
	CategoryPickerSheet,
	type CategoryPickerSheetRef,
} from "../category-picker-sheet";
import {
	CustomScheduleSheet,
	type CustomScheduleSheetRef,
	intervalPhrase,
} from "../custom-schedule-sheet";
import { CURTAIN_LAYER_SIZE, curtainGradient } from "../identity-curtain";
import { IdentityFlyUpLayer } from "../identity-fly-up";
import { LinearGradient } from "../styled";
import { TagPickerSheet } from "../tag-picker-sheet";
import { Text } from "../text";
import { TransactionFormAmountSection } from "./amount-section";
import { TransactionFormCta } from "./cta";
import { TransactionFormDetailsSection } from "./details-section";
import { TransactionFormIdentitySection } from "./identity-section";
import { TransactionFormScheduleSection } from "./schedule-section";
import {
	BODY,
	CAPTION,
	CARD_SHAPE,
	ENRICHING,
	FLY_BACK,
	FLY_UP,
	FORM_BLUR_RADIUS,
	ROW,
	rowLabel,
	SHAKE,
	TAP_ROW,
} from "./style";

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

/**
 * What an outside surface — a quick action, a widget, an App Intent — can put in
 * the form before the user sees it: a suggestion the user still confirms, never
 * identity, recurrence or category.
 */
export interface TransactionSeed {
	income?: boolean;
	amount?: number;
	note?: string;
}

interface TransactionFormProps {
	db: Database;
	mode: "create" | "edit";
	initial?: Transaction;
	/** Ignored when `initial` is present — an edit is never seeded. */
	seed?: TransactionSeed;
	/**
	 * The charge this create is repeating, from a row's own `Log again`. It may
	 * carry category and identity where {@link TransactionSeed} may not: these
	 * values came off a row inside the ledger that the user confirmed once
	 * already, not from a surface outside the app guessing at intent. It carries
	 * no date and no schedule, so the copy lands today and stays a one-off.
	 */
	copyOf?: LogAgainDraft;
	onDone: () => void;
}

/**
 * The add/edit transaction form.
 *
 * Hand-built cards over a `ScrollView` rather than an inset-grouped `List`:
 * SwiftUI's `List` imposes its own section spacing, corner radius and row
 * insets, none of which are settable.
 */
export function TransactionForm({
	db,
	mode,
	initial,
	seed,
	copyOf,
	onDone,
}: TransactionFormProps) {
	const colors = useColors();
	const haptics = useHaptics();
	const t = useTranslation();
	const { width: windowWidth, height: windowHeight } = useWindowDimensions();
	/** Swift's `.padding(.horizontal, 20)` content box. */
	const contentWidth = windowWidth - 40;
	const globalCurrency = useGlobalCurrency(db);
	const [txCurrency, setTxCurrency] = useState<string | null>(
		initial?.currency ?? copyOf?.currency ?? null,
	);
	const currency = txCurrency ?? globalCurrency;
	const minorUnits = minorUnitsFor(currency);

	const name = useNativeState(
		initial?.note ?? copyOf?.note ?? seed?.note ?? "",
	);
	const notes = useNativeState(initial?.details ?? copyOf?.details ?? "");

	// Seeded from the live schedule, not `onceRecurring`: that flag stays true on
	// every occurrence the back-fill materialized, so reading it here opens a
	// settled charge as an active subscription and re-projects the whole schedule
	// on save. Exactly one row in a chain carries `recurringType > 0` — the one
	// that is genuinely still charging.
	const [isSubscription, setIsSubscription] = useState(
		(initial?.recurringType ?? RECURRING_TYPE.none) !== RECURRING_TYPE.none,
	);
	// Seeded synchronously so an edit renders with its category already resolved.
	const [category, setCategory] = useState<Category | null>(() => {
		const sourceId = initial?.categoryId ?? copyOf?.categoryId;
		return sourceId ? getCategoryById(db, sourceId) : null;
	});
	// Separated from a plain "touched" flag so a later suggestion can still
	// replace an earlier one: only a human edit ("user") locks a field.
	type FieldSource = "initial" | "suggested" | "user";
	// A category carried in from `copyOf` is a deliberate choice, not a blank
	// slot an enrichment suggestion is free to fill.
	const [categorySource, setCategorySource] = useState<FieldSource>(() =>
		category !== null ? "user" : "initial",
	);
	const [pendingCategory, setPendingCategory] =
		useState<PendingCategory | null>(null);
	const [income, setIncome] = useState(
		category?.income ??
			initial?.income ??
			copyOf?.income ??
			seed?.income ??
			false,
	);
	const [amount, setAmount] = useState(() => {
		const amountSeed = initial?.amount ?? copyOf?.amount ?? seed?.amount;
		return amountSeed == null
			? ""
			: numberToNumpad(amountSeed, minorUnitsFor(currency));
	});
	const [date, setDate] = useState(() =>
		initial ? new Date(initial.date) : new Date(),
	);
	const { draft: identity, setDraft: setIdentity } = useIdentityDraft();
	const [identityTouched, setIdentityTouched] = useState(false);
	const { pickerOpen, setPickerOpen, floatProgress } = useIdentityFlyUp();
	const [recurringType, setRecurringType] = useState(
		initial?.recurringType && initial.recurringType !== RECURRING_TYPE.none
			? initial.recurringType
			: RECURRING_TYPE.monthly,
	);
	const [coefficient, setCoefficient] = useState(
		initial?.recurringCoefficient ?? 1,
	);
	const [hasEndDate, setHasEndDate] = useState(
		initial?.recurringEndDate != null,
	);
	const [endDate, setEndDate] = useState(() =>
		initial?.recurringEndDate
			? new Date(initial.recurringEndDate)
			: oneYearFrom(new Date()),
	);
	const [leadDays, setLeadDays] = useState<number | null>(
		normalizeLead(initial?.reminderLeadDays ?? null),
	);
	const [categoryError, setCategoryError] = useState(false);
	const [categoryShake, setCategoryShake] = useState(false);
	const [saving, setSaving] = useState(false);
	const [showToast, setShowToast] = useState(false);
	const celebrate = useAppSettings().state.bool("confetti");
	const aiEnrichment = useAppSettings().state.bool("aiEnrichment");
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
		Number.isNaN(heroWinY.value) || containerHeight.value <= 0
			? HERO_REST_TOP_FALLBACK
			: heroWinY.value - (windowHeight - containerHeight.value),
	);
	const scheme = useColorScheme();
	const isDark = scheme === "dark";
	const router = useRouter();

	const amountSheetRef = useRef<BottomSheetModal>(null);
	const categorySheetRef = useRef<CategoryPickerSheetRef>(null);
	const tagSheetRef = useRef<BottomSheetModal>(null);
	const allTags = useTags(db);
	const savedTagIds = useTagIdsFor(db, initial?.id ?? null);
	// Seeded from the row and then owned by the form, so toggling a tag does not
	// write until the entry is saved — the same contract every other field keeps.
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [tagsSource, setTagsSource] = useState<FieldSource>("initial");
	const [pendingTagNames, setPendingTagNames] = useState<readonly string[]>([]);
	const effectiveTagIds = tagsSource === "initial" ? savedTagIds : tagIds;
	const selectedTagLabels = [
		...allTags
			.filter((tag) => effectiveTagIds.includes(tag.id))
			.map((tag) => tag.name),
		...pendingTagNames,
	];
	const selectedTagNames =
		selectedTagLabels.length > 0 ? selectedTagLabels.join(", ") : null;
	const scheduleSheetRef = useRef<CustomScheduleSheetRef>(null);
	const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const categoriesForNamespace = useCategoriesByNamespace(db, income);
	const knownCategoryNames = useMemo(
		() =>
			categoriesForNamespace
				.map((candidate) => candidate.name)
				.filter((name): name is string => name != null),
		[categoriesForNamespace],
	);
	const categoriesRef = useRef(categoriesForNamespace);
	useEffect(() => {
		categoriesRef.current = categoriesForNamespace;
	}, [categoriesForNamespace]);
	const tagsRef = useRef(allTags);
	useEffect(() => {
		tagsRef.current = allTags;
	}, [allTags]);

	const resolveLocal = useCallback(
		(suggestion: EnrichmentSuggestion): EnrichmentSuggestion => {
			let categoryId = suggestion.categoryId;
			let pendingCategory = suggestion.pendingCategory;
			if (categoryId == null && pendingCategory != null) {
				const matchedCategory = categoriesRef.current.find(
					(candidate) => candidate.name === pendingCategory?.name,
				);
				if (matchedCategory != null) {
					categoryId = matchedCategory.id;
					pendingCategory = null;
				}
			}
			const resolvedTagIds: string[] = [...suggestion.tagIds];
			const pendingTagNames: string[] = [];
			for (const tagName of suggestion.pendingTagNames) {
				const matchedTag = findTagByName(tagsRef.current, tagName);
				if (matchedTag != null) {
					resolvedTagIds.push(matchedTag.id);
				} else {
					pendingTagNames.push(tagName);
				}
			}
			return {
				...suggestion,
				categoryId,
				pendingCategory,
				tagIds: resolvedTagIds,
				pendingTagNames,
			};
		},
		[],
	);

	const applySuggestion = useCallback(
		(suggestion: EnrichmentSuggestion) => {
			if (categorySource !== "user") {
				if (suggestion.categoryId != null) {
					const matchedCategory = getCategoryById(db, suggestion.categoryId);
					if (matchedCategory != null) {
						setCategory(matchedCategory);
						setPendingCategory(null);
						setCategoryError(false);
						setCategorySource("suggested");
					}
				} else if (suggestion.pendingCategory != null) {
					setCategory(null);
					setPendingCategory(suggestion.pendingCategory);
					setCategoryError(false);
					setCategorySource("suggested");
				}
			}
			if (
				tagsSource !== "user" &&
				(suggestion.tagIds.length > 0 || suggestion.pendingTagNames.length > 0)
			) {
				setTagIds([...suggestion.tagIds]);
				setPendingTagNames([...suggestion.pendingTagNames]);
				setTagsSource("suggested");
			}
		},
		[categorySource, tagsSource, db],
	);

	const { onNameChange, pending: enriching } = useTransactionEnrichment({
		enabled: mode === "create",
		income,
		knownCategoryNames,
		onSuggest: applySuggestion,
		remoteEnabled: aiEnrichment,
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
		[],
	);

	// The draft is shared context, read by the fly-up hero and the picker route.
	// Skipped once the user has touched identity, so a stale `initial`/`copyOf`
	// reference re-rendering later never clobbers an in-progress choice.
	useEffect(() => {
		if (identityTouched) {
			return;
		}
		setIdentity({
			emoji: initial?.emoji ?? copyOf?.emoji ?? null,
			icon: initial?.icon ?? copyOf?.icon ?? null,
			photoUri: initial?.imageUri ?? null,
			photoColor: initial?.imageColor ?? null,
			color: initial?.customColor ?? copyOf?.customColor ?? null,
		});
	}, [
		identityTouched,
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

	const amountNumber = numpadToNumber(amount);
	const canSave = amountNumber > 0 && !saving;

	const handleKindChange = (next: "once" | "subscription") => {
		const sub = next === "subscription";
		setIsSubscription(sub);
		if (sub) {
			setRecurringType(ensureRecurringType(recurringType));
		}
	};

	const handleTypeChange = (next: "expense" | "income") => {
		const nextIncome = next === "income";
		if (nextIncome !== income) {
			setIncome(nextIncome);
			setCategory(null);
			setPendingCategory(null);
			setCategorySource("initial");
		}
	};

	// Custom intervals come from the stepper sheet, not from this menu.
	const handleScheduleChange = (type: number) => {
		setRecurringType(type);
		setCoefficient(1);
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
			Alert.alert(
				t("settings.notifications.deniedTitle"),
				t("settings.notifications.deniedBody"),
				[
					{ style: "cancel", text: t("settings.notifications.notNow") },
					{
						onPress: openNotificationSettings,
						text: t("settings.notifications.openSettings"),
					},
				],
			);
			setLeadDays(null);
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
		setLeadDays(null);
	};

	const handleLeadChange = (next: number) => {
		const lead = resolveLeadSelection(next, LEAD_OFF_TAG);
		setLeadDays(lead);
		if (lead !== null) {
			confirmRemindersAllowed().catch((error) => {
				console.error("Reminder permission check failed", error);
			});
		}
	};

	const handleSelectCategory = (picked: Category) => {
		setCategory(picked);
		setPendingCategory(null);
		setCategorySource("user");
		setCategoryError(false);
		categorySheetRef.current?.dismiss();
	};

	const flagMissingCategory = () => {
		haptics("error");
		setCategoryError(true);
		setCategoryShake(true);
		shakeTimer.current = setTimeout(() => setCategoryShake(false), 500);
	};

	const handleSave = async () => {
		if (amountNumber <= 0) {
			return;
		}
		const pending = pendingCategory;
		if (!category && !pending) {
			flagMissingCategory();
			return;
		}
		setSaving(true);
		haptics("success");

		let categoryId: string;
		if (category) {
			categoryId = category.id;
		} else if (pending) {
			try {
				categoryId = await ensureCategoryByName(
					db,
					pending.name,
					income,
					pending.icon,
					pending.color,
				);
			} catch (error) {
				console.error("Failed to create the pending category", error);
				setSaving(false);
				flagMissingCategory();
				return;
			}
		} else {
			setSaving(false);
			flagMissingCategory();
			return;
		}

		const input = buildTransactionInput({
			amount: amountNumber,
			income,
			categoryId,
			note: name.value,
			details: notes.value,
			date,
			currency: txCurrency,
			icon: identity.icon,
			emoji: identity.emoji,
			customColor: identity.color,
			imageUri: identity.photoUri,
			imageColor: identity.photoColor,
			isSubscription,
			recurringType,
			coefficient,
			hasEndDate,
			endDate,
			leadDays,
		});
		let id: string;
		try {
			if (mode === "edit" && initial) {
				await transactionsRepo.update(db, initial.id, input);
				id = initial.id;
			} else {
				id = await transactionsRepo.create(db, input);
			}
		} catch (error) {
			console.error("Failed to save transaction", error);
			// Nothing was written, so the retry is the same tap again — but say so
			// first: un-dimming the CTA in silence is indistinguishable from having
			// missed the button.
			haptics("error");
			setSaving(false);
			Alert.alert(
				t("transaction.save.failedTitle"),
				t("transaction.save.failedBody"),
			);
			return;
		}
		// The row is COMMITTED from here down, so no failure below may re-enable the
		// CTA: a second tap runs `create` again, which mints a fresh id rather than
		// rewriting this row, and the ledger ends up with two subscriptions — each
		// walked forward into its own chain of charges by the next sweep.
		if (tagsSource !== "initial") {
			// After the row exists, because the link points at it. A failure here
			// costs the tags, not the entry, so it is reported rather than thrown.
			try {
				const materializedTagIds = [...effectiveTagIds];
				for (const tagName of pendingTagNames) {
					const tagId = await tagsRepo.ensureTag(db, tagName);
					if (tagId != null && !materializedTagIds.includes(tagId)) {
						materializedTagIds.push(tagId);
					}
				}
				await tagsRepo.setTagsFor(db, id, materializedTagIds);
			} catch (error) {
				console.error("Failed to save tags", error);
				Alert.alert(
					t("transaction.tags.failedTitle"),
					t("transaction.tags.failedBody"),
				);
			}
		}
		let scheduleFailed = false;
		if (isSubscription) {
			try {
				await backfillRecurring(db, id);
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
			// Dismissed from the alert's own button rather than alongside it: an
			// alert raised as the modal route is being torn down has no presenter
			// left and never appears, which is the silence this replaces.
			Alert.alert(
				t("transaction.save.scheduleFailedTitle"),
				t("transaction.save.scheduleFailedBody"),
				[{ text: t("common.done"), onPress: onDone }],
			);
			return;
		}
		if (mode === "edit") {
			onDone();
		} else {
			setShowToast(true);
			// The form owns the celebration, so it has to outlive its own
			// dismissal: Swift fired the cannon on the screen behind the sheet,
			// which has no equivalent here without hoisting state out of the
			// route.
			if (celebrate) {
				setBurstSeed(Date.now());
			}
			doneTimer.current = setTimeout(
				onDone,
				celebrate ? CONFETTI_FLIGHT_MS : 600,
			);
		}
	};

	// The spring starts here, not from the picker route's mount effect, so the
	// hero launches on the tap frame instead of waiting for navigation to commit
	// the new screen.
	const openPicker = () => {
		setIdentityTouched(true);
		setPickerOpen(true);
		router.push("/transaction/identity");
	};

	const ctaLabel = t(ctaKey(mode, isSubscription));

	const amountColor =
		amountNumber > 0
			? income
				? colors.income
				: colors.foreground
			: colors.muted;

	const curtainHues = computeCurtainHues(
		{
			categoryColor: category?.color,
			foregroundColor: colors.foreground,
			identity,
			income,
			incomeColor: colors.income,
		},
		glowFromEmoji,
	);
	const toastLabel = t(
		isSubscription
			? "transaction.toast.subscriptionAdded"
			: "transaction.toast.added",
	);

	const card = [background(colors.surface, CARD_SHAPE)];
	const hairline = [
		overlay({ color: withAlpha(colors.foreground, 0.08) }),
		padding({ leading: 16 }),
	];
	const categoryGlyphTint = category
		? category.income
			? colors.income
			: (category.color ?? colors.foreground)
		: (pendingCategory?.color ?? colors.muted);

	const cadenceOptions = SELECTABLE_RECURRING_TYPES.map((type) => ({
		type,
		label: cadenceLabel(t, type),
	}));
	const leadOptions = REMINDER_LEAD_OPTIONS.map((lead) => ({
		lead,
		label: leadLabel(t, lead),
	}));

	return (
		<View
			onLayout={(e) => {
				containerHeight.value = e.nativeEvent.layout.height;
			}}
			style={{ flex: 1 }}
		>
			{/* The curtain is the Host's own BACKGROUND, not a sibling: a view stacked
			    before the Host would hide the scroll content from the header's
			    scroll-edge lookup. */}
			<Host
				style={{
					flex: 1,
					backgroundColor: colors.groupedBackground,
					experimental_backgroundImage: curtainGradient(curtainHues, isDark),
					// Confine every gradient layer to the top CURTAIN_HEIGHT and don't
					// tile it, so below that band there is only the grouped grey.
					experimental_backgroundSize: CURTAIN_LAYER_SIZE,
					experimental_backgroundRepeat: "no-repeat",
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
					<VStack
						modifiers={[padding({ horizontal: 20, bottom: 120 })]}
						spacing={18}
					>
						<TransactionFormIdentitySection
							color={identity.color}
							contentWidth={contentWidth}
							emoji={identity.emoji}
							floatProgress={floatProgress}
							heroWinY={heroWinY}
							icon={identity.icon}
							income={income}
							onPress={openPicker}
							onReset={() => {
								setIdentityTouched(true);
								setIdentity({
									emoji: null,
									icon: null,
									photoUri: null,
									photoColor: null,
									color: null,
								});
							}}
							photoUri={identity.photoUri}
						/>

						<Picker
							label=""
							modifiers={[pickerStyle("segmented")]}
							onSelectionChange={(next) =>
								handleKindChange(next as "once" | "subscription")
							}
							selection={isSubscription ? "subscription" : "once"}
						>
							<SwiftText modifiers={[tag("once")]}>
								{t("transaction.kind.once")}
							</SwiftText>
							<SwiftText modifiers={[tag("subscription")]}>
								{t("transaction.kind.subscription")}
							</SwiftText>
						</Picker>

						<VStack modifiers={card} spacing={0}>
							<HStack modifiers={ROW}>
								<SwiftText modifiers={[BODY, rowLabel]}>
									{t("transaction.field.name")}
								</SwiftText>
								<TextField
									maxLength={50}
									modifiers={[BODY, multilineTextAlignment("trailing")]}
									onTextChange={onNameChange}
									placeholder={t("transaction.field.namePlaceholder")}
									text={name}
								/>
							</HStack>

							<Divider modifiers={hairline} />

							{/* The label sits OUTSIDE the Menu so it stays a plain secondary
							    Text like every other row label — a label inside the menu
							    inherits the control's accent tint. */}
							<HStack modifiers={ROW}>
								<SwiftText modifiers={[BODY, rowLabel]}>
									{t("transaction.field.type")}
								</SwiftText>
								<Spacer />
								<Menu
									label={
										<HStack spacing={4}>
											<SwiftText
												modifiers={[BODY, foregroundStyle(colors.foreground)]}
											>
												{t(income ? "common.income" : "common.expense")}
											</SwiftText>
											<Image
												color={colors.muted}
												size={12}
												systemName="chevron.up.chevron.down"
											/>
										</HStack>
									}
									modifiers={[menuTint]}
								>
									<Picker
										label={t("transaction.field.type")}
										onSelectionChange={(next) =>
											handleTypeChange(next as "expense" | "income")
										}
										selection={income ? "income" : "expense"}
									>
										<SwiftText modifiers={[tag("expense")]}>
											{t("common.expense")}
										</SwiftText>
										<SwiftText modifiers={[tag("income")]}>
											{t("common.income")}
										</SwiftText>
									</Picker>
								</Menu>
							</HStack>

							<TransactionFormAmountSection
								currency={currency}
								hairline={hairline}
								label={t("transaction.field.amount")}
								onPress={() => amountSheetRef.current?.present()}
								value={formatAmount(amountNumber, currency)}
								valueColor={amountColor}
							/>
						</VStack>

						<Button
							modifiers={[
								buttonStyle("plain"),
								...card,
								...(categoryError
									? [
											strokeBorder({
												color: colors.danger,
												style: { lineWidth: 1.5 },
												shape: "roundedRectangle",
												cornerRadius: 12,
											}),
										]
									: []),
								offset({ x: categoryShake ? -5 : 0 }),
								animation(SHAKE, categoryShake),
							]}
							onPress={() => categorySheetRef.current?.present()}
						>
							<VStack spacing={0}>
								<HStack modifiers={TAP_ROW} spacing={12}>
									<SwiftText
										modifiers={[
											BODY,
											categoryError ? foregroundStyle(colors.danger) : rowLabel,
										]}
									>
										{t("transaction.field.category")}
									</SwiftText>
									<Spacer />
									<HStack spacing={5}>
										{category || pendingCategory ? (
											<RNHostView matchContents>
												<View style={{ width: 18, height: 18 }}>
													<CategoryIcon
														color={categoryGlyphTint}
														name={
															category ? category.icon : pendingCategory?.icon
														}
														size={18}
													/>
												</View>
											</RNHostView>
										) : null}
										<SwiftText
											modifiers={[
												BODY,
												foregroundStyle(
													categoryEnriching
														? withAlpha(colors.muted, 0.45)
														: category || pendingCategory
															? colors.foreground
															: colors.muted,
												),
												animation(ENRICHING, categoryEnriching),
											]}
										>
											{category
												? category.name
												: (pendingCategory?.name ??
													t("transaction.category.choose"))}
										</SwiftText>
										<Image
											color={colors.muted}
											size={12}
											systemName="chevron.up.chevron.down"
										/>
									</HStack>
								</HStack>
								{pendingCategory ? (
									<HStack
										modifiers={[
											padding({ leading: 16, trailing: 16, bottom: 10 }),
										]}
										spacing={0}
									>
										<Spacer />
										<SwiftText
											modifiers={[CAPTION, foregroundStyle(colors.muted)]}
										>
											{t("transaction.category.willBeCreated")}
										</SwiftText>
									</HStack>
								) : null}
							</VStack>
						</Button>

						<Button
							modifiers={[buttonStyle("plain"), ...card]}
							onPress={() => tagSheetRef.current?.present()}
						>
							<HStack modifiers={TAP_ROW} spacing={12}>
								<SwiftText modifiers={[BODY, rowLabel]}>
									{t("transaction.field.tags")}
								</SwiftText>
								<Spacer />
								<HStack spacing={5}>
									<SwiftText
										modifiers={[
											BODY,
											foregroundStyle(
												tagsEnriching
													? withAlpha(colors.muted, 0.45)
													: selectedTagNames
														? colors.foreground
														: colors.muted,
											),
											animation(ENRICHING, tagsEnriching),
										]}
									>
										{selectedTagNames ?? t("transaction.tags.none")}
									</SwiftText>
									<Image
										color={colors.muted}
										size={12}
										systemName="chevron.up.chevron.down"
									/>
								</HStack>
							</HStack>
						</Button>

						<TransactionFormScheduleSection
							cadenceOptions={cadenceOptions}
							card={card}
							customScheduleLabel={t("transaction.schedule.customOption")}
							date={date}
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
							onDateChange={setDate}
							onEndDateChange={setEndDate}
							onHasEndDateChange={setHasEndDate}
							onLeadChange={handleLeadChange}
							onOpenCustomSchedule={() => scheduleSheetRef.current?.present()}
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

						<TransactionFormDetailsSection
							card={card}
							foregroundColor={colors.foreground}
							notes={notes}
							notesLabel={t("transaction.field.notes")}
							notesPlaceholder={t("transaction.field.notesPlaceholder")}
						/>
					</VStack>
				</ScrollView>
			</Host>

			<View
				className="absolute right-0 bottom-0 left-0"
				pointerEvents="box-none"
			>
				<LinearGradient
					className="absolute inset-0"
					colors={
						[
							withAlpha(colors.groupedBackground, 0),
							colors.groupedBackground,
						] as const
					}
					locations={[0, 0.45] as const}
					pointerEvents="none"
				/>
				<View className="px-5 pt-9 pb-safe-offset-3">
					<TransactionFormCta
						canSave={canSave}
						labelColor={colors.background}
						label={ctaLabel}
						onPress={handleSave}
						tintColor={colors.foreground}
					/>
				</View>
			</View>

			{showToast ? (
				<Animated.View
					entering={FadeInDown.springify()}
					exiting={FadeOutDown}
					pointerEvents="none"
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: 90,
						alignItems: "center",
					}}
				>
					<View
						className="flex-row items-center gap-2 rounded-full"
						style={{
							paddingHorizontal: 18,
							paddingVertical: 10,
							backgroundColor: colors.surface,
							borderWidth: 1,
							borderColor: withAlpha(colors.foreground, 0.12),
						}}
					>
						<SymbolView
							name="checkmark"
							size={15}
							tintColor={colors.income}
							type="monochrome"
							weight="semibold"
						/>
						<Text className="font-sans-semibold text-income text-subtitle">
							{toastLabel}
						</Text>
					</View>
				</Animated.View>
			) : null}

			{celebrate && burstSeed !== 0 ? (
				<Confetti height={windowHeight} seed={burstSeed} width={windowWidth} />
			) : null}

			<AmountEntrySheet
				code={currency}
				minorUnits={minorUnits}
				onChange={setAmount}
				onCurrencyChange={setTxCurrency}
				onDone={() => amountSheetRef.current?.dismiss()}
				ref={amountSheetRef}
				toneClass={income ? "text-income" : "text-foreground"}
				value={amount}
			/>
			<TagPickerSheet
				onCreate={async (name) => {
					const id = await tagsRepo.ensureTag(db, name);
					if (id) {
						setTagsSource("user");
						setTagIds([...effectiveTagIds, id]);
						setPendingTagNames((current) =>
							current.filter(
								(pendingName) => normalizeTagName(pendingName) !== name,
							),
						);
					}
					return id;
				}}
				onToggle={(tagId) => {
					setTagsSource("user");
					setTagIds(
						effectiveTagIds.includes(tagId)
							? effectiveTagIds.filter((id) => id !== tagId)
							: [...effectiveTagIds, tagId],
					);
				}}
				pendingTagNames={pendingTagNames}
				ref={tagSheetRef}
				selected={effectiveTagIds}
				tags={allTags}
			/>

			<CategoryPickerSheet
				db={db}
				income={income}
				onSelect={handleSelectCategory}
				pendingCategory={pendingCategory}
				ref={categorySheetRef}
				selectedId={category?.id ?? null}
			/>
			<CustomScheduleSheet
				onDone={(type, every) => {
					setRecurringType(type);
					setCoefficient(every);
				}}
				recurringCoefficient={coefficient}
				recurringType={recurringType}
				ref={scheduleSheetRef}
			/>

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
		</View>
	);
}

function oneYearFrom(date: Date): Date {
	const d = new Date(date);
	d.setFullYear(d.getFullYear() + 1);
	return d;
}
