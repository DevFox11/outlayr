import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import {
	Button,
	DatePicker,
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
	Toggle,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui";
import {
	Animation,
	animation,
	background,
	blur,
	buttonStyle,
	contentShape,
	controlSize,
	datePickerStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	labelsHidden,
	lineLimit,
	multilineTextAlignment,
	offset,
	onGeometryChange,
	overlay,
	padding,
	pickerStyle,
	shapes,
	strokeBorder,
	tag,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Alert, useColorScheme, useWindowDimensions, View } from "react-native";
import Animated, {
	FadeInDown,
	FadeOutDown,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { Confetti } from "@/components/confetti";
import { menuTint } from "@/components/native/styles";
import {
	useIdentityDraft,
	useIdentityFlyUp,
} from "@/contexts/identity-draft-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { type Category, getCategoryById } from "@/data/categories";
import { setBoolSetting, useBoolSetting } from "@/data/settings";
import {
	backfillRecurring,
	type Transaction,
	transactionsRepo,
} from "@/data/transactions";
import type { Database } from "@/db/client";
import { CONFETTI_FLIGHT_MS } from "@/domain/confetti";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import {
	RECURRING_TYPE,
	SELECTABLE_RECURRING_TYPES,
} from "@/domain/recurrence";
import { enableReminderStep } from "@/domain/reminder";
import {
	type LeadLabelKey,
	leadLabelKey,
	normalizeLead,
	REMINDER_LEAD_OPTIONS,
} from "@/domain/subscription-reminder";
import { type TranslateFn, type TranslationKey, useTranslation } from "@/i18n";
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
import { AmountEntrySheet } from "./amount-entry-sheet";
import { CategoryIcon } from "./category-icon";
import {
	CategoryPickerSheet,
	type CategoryPickerSheetRef,
} from "./category-picker-sheet";
import {
	CustomScheduleSheet,
	type CustomScheduleSheetRef,
	intervalPhrase,
} from "./custom-schedule-sheet";
import { CURTAIN_LAYER_SIZE, curtainGradient } from "./identity-curtain";
import { IdentityFlyUpLayer } from "./identity-fly-up";
import { IdentityHero } from "./identity-hero";
import { LinearGradient } from "./styled";
import { Text } from "./text";

/**
 * Swift's `IdentityHero.topPadding` (24) less 6pt: expo-router's native header
 * centres its title 4pt higher than SwiftUI's, and the RN hero sits 2pt lower in
 * the scroll content, so an identical 24 leaves the icon reading 6pt low.
 */
const HERO_TOP_PADDING = 18;
const HERO_BOTTOM_PADDING = 28;
/**
 * Only reached if `onGeometryChange` never fires; a real measurement always
 * supersedes it. A 70pt nav-bar scroll inset plus {@link HERO_TOP_PADDING}.
 */
const HERO_REST_TOP_FALLBACK = 88;

const ROW = [padding({ horizontal: 16 }), frame({ minHeight: 50 })];
/**
 * For the rows that ARE buttons: a `.plain` Button hit-tests only its drawn
 * glyphs, so without a content shape the `Spacer` gap mid-row is dead and a tap
 * anywhere but directly on the label or value silently does nothing.
 *
 * Deliberately NOT applied to every row — a greedy rect over the Name,
 * date/time or toggle rows would swallow the taps meant for the control
 * living inside them.
 */
const TAP_ROW = [...ROW, contentShape(shapes.rectangle())];
const CARD_SHAPE = shapes.roundedRectangle({
	cornerRadius: 12,
	roundedCornerStyle: "continuous",
});

const BODY = font({ textStyle: "body", design: "rounded" });
const BODY_MEDIUM = font({
	textStyle: "body",
	design: "rounded",
	weight: "medium",
});
const BODY_SEMIBOLD = font({
	textStyle: "body",
	design: "rounded",
	weight: "semibold",
});
const CAPTION = font({ textStyle: "caption", design: "rounded" });

const rowLabel = foregroundStyle({ type: "hierarchical", style: "secondary" });
const tertiary = foregroundStyle({ type: "hierarchical", style: "tertiary" });

const MORPH = Animation.easeInOut({ duration: 0.25 });
const SHAKE = Animation.easeInOut({ duration: 0.1 }).repeat({ repeatCount: 5 });
const FORM_BLUR_RADIUS = 8;
/**
 * MUST track `LAUNCH_SPRING`/`RETURN_SPRING` in the fly-up context — the hero is
 * a Reanimated view and the blur is a SwiftUI one, so nothing but this pairing
 * keeps them on the same curve. Directional because the return is the snappier
 * of the two; one shared curve leaves the blur clearing ~200ms after the hero is
 * home and the sheet has gone.
 */
const FLY_UP = Animation.spring({ response: 0.4, dampingFraction: 0.85 });
const FLY_BACK = Animation.spring({ response: 0.29, dampingFraction: 0.98 });

const CADENCE_LABEL_KEY: Record<number, TranslationKey> = {
	[RECURRING_TYPE.daily]: "transaction.cadence.daily",
	[RECURRING_TYPE.weekly]: "transaction.cadence.weekly",
	[RECURRING_TYPE.monthly]: "transaction.cadence.monthly",
	[RECURRING_TYPE.yearly]: "transaction.cadence.yearly",
};

/**
 * A SwiftUI `tag()` set has to be one type, and Off is the absence of a lead
 * rather than a count of days — so it rides along as a sentinel and is turned
 * back into `null` the instant the selection arrives. A -1 that escaped that
 * boundary would reach `normalizeLead`, which clamps it to 0 and so arms a
 * reminder on the due day for the owner who just switched reminders off.
 */
const LEAD_OFF_TAG = -1;

/**
 * Only names what this screen calls each phrasing. Which phrasing a lead reads
 * as stays with {@link leadLabelKey}, including the counted fallback a lead the
 * picker never offered needs — one restored from another device. Several domain
 * keys therefore share a string: "2 days before" and "5 days before" are the
 * same counted form.
 */
const LEAD_LABEL_KEY: Record<LeadLabelKey, TranslationKey> = {
	"settings.notifications.leadOff": "transaction.remind.off",
	"settings.notifications.leadSameDay": "transaction.remind.sameDay",
	"settings.notifications.leadOneDay": "transaction.remind.dayBefore",
	"settings.notifications.leadTwoDays": "transaction.remind.daysBefore",
	"settings.notifications.leadThreeDays": "transaction.remind.daysBefore",
	"settings.notifications.leadOneWeek": "transaction.remind.weekBefore",
	"settings.notifications.leadDaysBefore": "transaction.remind.daysBefore",
};

function leadLabel(t: TranslateFn, lead: number | null): string {
	return t(LEAD_LABEL_KEY[leadLabelKey(lead)], { count: lead });
}

function ctaKey(mode: "create" | "edit", isSubscription: boolean) {
	if (mode === "edit") {
		return "transaction.cta.save";
	}
	return isSubscription
		? "transaction.cta.addSubscription"
		: "transaction.cta.add";
}

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
		initial?.currency ?? null,
	);
	const currency = txCurrency ?? globalCurrency;
	const minorUnits = minorUnitsFor(currency);

	const name = useNativeState(initial?.note ?? seed?.note ?? "");
	const notes = useNativeState(initial?.details ?? "");

	// Seeded from the live schedule, not `onceRecurring`: that flag stays true on
	// every occurrence the back-fill materialized, so reading it here opens a
	// settled charge as an active subscription and re-projects the whole schedule
	// on save. Exactly one row in a chain carries `recurringType > 0` — the one
	// that is genuinely still charging.
	const [isSubscription, setIsSubscription] = useState(
		(initial?.recurringType ?? RECURRING_TYPE.none) !== RECURRING_TYPE.none,
	);
	// Seeded synchronously so an edit renders with its category already resolved.
	const [category, setCategory] = useState<Category | null>(() =>
		initial?.categoryId ? getCategoryById(db, initial.categoryId) : null,
	);
	const [income, setIncome] = useState(
		category?.income ?? initial?.income ?? seed?.income ?? false,
	);
	const [amount, setAmount] = useState(() => {
		const amountSeed = initial?.amount ?? seed?.amount;
		return amountSeed == null
			? ""
			: numberToNumpad(amountSeed, minorUnitsFor(currency));
	});
	const [date, setDate] = useState(() =>
		initial ? new Date(initial.date) : new Date(),
	);
	const { draft: identity, setDraft: setIdentity } = useIdentityDraft();
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
	const celebrate = useBoolSetting(db, "confetti");
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
	const scheduleSheetRef = useRef<CustomScheduleSheetRef>(null);
	const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
	useEffect(() => {
		setIdentity({
			emoji: initial?.emoji ?? null,
			icon: initial?.icon ?? null,
			photoUri: initial?.imageUri ?? null,
			photoColor: initial?.imageColor ?? null,
			color: initial?.customColor ?? null,
		});
	}, [
		initial?.imageUri,
		initial?.emoji,
		setIdentity,
		initial?.imageColor,
		initial?.icon,
		initial?.customColor,
	]);

	const amountNumber = numpadToNumber(amount);
	const canSave = amountNumber > 0 && !saving;

	const handleKindChange = (next: "once" | "subscription") => {
		const sub = next === "subscription";
		setIsSubscription(sub);
		if (sub && recurringType === RECURRING_TYPE.none) {
			setRecurringType(RECURRING_TYPE.monthly);
		}
	};

	const handleTypeChange = (next: "expense" | "income") => {
		const nextIncome = next === "income";
		if (nextIncome !== income) {
			setIncome(nextIncome);
			setCategory(null);
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
		const lead = next === LEAD_OFF_TAG ? null : normalizeLead(next);
		setLeadDays(lead);
		if (lead !== null) {
			confirmRemindersAllowed().catch((error) => {
				console.error("Reminder permission check failed", error);
			});
		}
	};

	const handleSelectCategory = (picked: Category) => {
		setCategory(picked);
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
		if (!category) {
			flagMissingCategory();
			return;
		}
		setSaving(true);
		haptics("success");
		const input = {
			amount: amountNumber,
			income,
			categoryId: category.id,
			note: name.value,
			details: notes.value,
			date,
			currency: txCurrency,
			icon: identity.icon,
			emoji: identity.emoji,
			customColor: identity.color,
			imageUri: identity.photoUri,
			imageColor: identity.photoColor,
			onceRecurring: isSubscription,
			recurringType: isSubscription ? recurringType : RECURRING_TYPE.none,
			recurringCoefficient: isSubscription ? Math.max(1, coefficient) : 1,
			recurringEndDate: isSubscription && hasEndDate ? endDate : null,
			reminderLeadDays: isSubscription ? leadDays : null,
		};
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

	const identityEmpty = !identity.emoji && !identity.icon && !identity.photoUri;
	const curtainTint =
		identity.color ??
		identity.photoColor ??
		(income ? colors.income : (category?.color ?? colors.foreground));
	const curtainHues = identityEmpty
		? null
		: identity.emoji
			? [...glowFromEmoji(identity.emoji).slice(0, 2), curtainTint]
			: identity.photoUri
				? [identity.photoColor ?? curtainTint]
				: [curtainTint];
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
		: colors.muted;

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
						<VStack
							modifiers={[
								// FIRST in the array on purpose: modifiers reduce in order
								// (`View+ModifierArray.swift`), so this reads the UNPADDED
								// stack — the hero ring's own top — and the paddings below
								// then wrap it. Move it after them and the twin rests
								// HERO_TOP_PADDING too high, ghosting through the crossfade.
								onGeometryChange((frame) => {
									heroWinY.value = frame.y;
								}),
								padding({ top: HERO_TOP_PADDING }),
								padding({ bottom: HERO_BOTTOM_PADDING }),
							]}
						>
							<RNHostView matchContents>
								{/* An unconstrained RN view stretches to the whole Host, so
								    `matchContents` reports the FULL screen width back to
								    SwiftUI — the VStack then overflows its own horizontal
								    padding and drags every sibling card out to the screen
								    edge with it. */}
								<View style={{ width: contentWidth, alignItems: "center" }}>
									<IdentityHero
										color={identity.color}
										emoji={identity.emoji}
										floatProgress={floatProgress}
										icon={identity.icon}
										income={income}
										onPress={openPicker}
										onReset={() =>
											setIdentity({
												emoji: null,
												icon: null,
												photoUri: null,
												photoColor: null,
												color: null,
											})
										}
										photoUri={identity.photoUri}
										variant="transaction"
									/>
								</View>
							</RNHostView>
						</VStack>

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

							<Divider modifiers={hairline} />

							<Button
								modifiers={[buttonStyle("plain")]}
								onPress={() => amountSheetRef.current?.present()}
							>
								<HStack modifiers={TAP_ROW}>
									<SwiftText modifiers={[BODY, rowLabel]}>
										{t("transaction.field.amount")}
									</SwiftText>
									<Spacer />
									<SwiftText
										modifiers={[BODY_MEDIUM, foregroundStyle(amountColor)]}
									>
										{formatAmount(amountNumber, currency)}
									</SwiftText>
									<SwiftText modifiers={[CAPTION, tertiary]}>
										{currency}
									</SwiftText>
								</HStack>
							</Button>
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
									{category ? (
										<RNHostView matchContents>
											<View style={{ width: 18, height: 18 }}>
												<CategoryIcon
													color={categoryGlyphTint}
													name={category.icon}
													size={18}
												/>
											</View>
										</RNHostView>
									) : null}
									<SwiftText
										modifiers={[
											BODY,
											foregroundStyle(
												category ? colors.foreground : colors.muted,
											),
										]}
									>
										{category
											? category.name
											: t("transaction.category.choose")}
									</SwiftText>
									<Image
										color={colors.muted}
										size={12}
										systemName="chevron.up.chevron.down"
									/>
								</HStack>
							</HStack>
						</Button>

						<VStack
							modifiers={[...card, animation(MORPH, isSubscription)]}
							spacing={0}
						>
							{isSubscription ? (
								<>
									<HStack modifiers={ROW}>
										<SwiftText modifiers={[BODY, rowLabel]}>
											{t("transaction.field.schedule")}
										</SwiftText>
										<Spacer />
										<Menu
											label={
												<HStack spacing={4}>
													<SwiftText
														modifiers={[
															BODY,
															foregroundStyle(colors.foreground),
														]}
													>
														{t("transaction.schedule.every", {
															interval: intervalPhrase(
																t,
																recurringType,
																coefficient,
															),
														})}
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
												label={t("transaction.field.schedule")}
												onSelectionChange={handleScheduleChange}
												selection={recurringType}
											>
												{SELECTABLE_RECURRING_TYPES.map((type) => (
													<SwiftText key={type} modifiers={[tag(type)]}>
														{t(
															CADENCE_LABEL_KEY[type] ??
																"transaction.cadence.monthly",
														)}
													</SwiftText>
												))}
											</Picker>
											<Button
												label={t("transaction.schedule.customOption")}
												onPress={() => scheduleSheetRef.current?.present()}
											/>
										</Menu>
									</HStack>

									<Divider modifiers={hairline} />

									<HStack modifiers={ROW}>
										<SwiftText modifiers={[BODY, rowLabel]}>
											{t("transaction.field.firstPayment")}
										</SwiftText>
										<Spacer />
										<DatePicker
											displayedComponents={["date"]}
											modifiers={[datePickerStyle("compact"), labelsHidden()]}
											onDateChange={setDate}
											selection={date}
										/>
									</HStack>

									<Divider modifiers={hairline} />

									<HStack modifiers={ROW}>
										<SwiftText modifiers={[BODY, rowLabel]}>
											{t("transaction.field.endDate")}
										</SwiftText>
										<Spacer />
										<Toggle
											isOn={hasEndDate}
											modifiers={[tint(colors.income), labelsHidden()]}
											onIsOnChange={setHasEndDate}
										/>
									</HStack>

									{hasEndDate ? (
										<>
											<Divider modifiers={hairline} />
											<HStack modifiers={ROW}>
												<SwiftText modifiers={[BODY, rowLabel]}>
													{t("transaction.field.ends")}
												</SwiftText>
												<Spacer />
												<DatePicker
													displayedComponents={["date"]}
													modifiers={[
														datePickerStyle("compact"),
														labelsHidden(),
													]}
													onDateChange={setEndDate}
													selection={endDate}
												/>
											</HStack>
										</>
									) : null}

									<Divider modifiers={hairline} />

									{/* Label outside the Menu, as on the Schedule row above. */}
									<HStack modifiers={ROW}>
										<SwiftText modifiers={[BODY, rowLabel]}>
											{t("transaction.field.remind")}
										</SwiftText>
										<Spacer />
										<Menu
											label={
												<HStack spacing={4}>
													<SwiftText
														modifiers={[
															BODY,
															foregroundStyle(colors.foreground),
														]}
													>
														{leadLabel(t, leadDays)}
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
												label={t("transaction.field.remind")}
												onSelectionChange={handleLeadChange}
												selection={leadDays ?? LEAD_OFF_TAG}
											>
												<SwiftText modifiers={[tag(LEAD_OFF_TAG)]}>
													{t("transaction.remind.off")}
												</SwiftText>
												{REMINDER_LEAD_OPTIONS.map((lead) => (
													<SwiftText key={lead} modifiers={[tag(lead)]}>
														{leadLabel(t, lead)}
													</SwiftText>
												))}
											</Picker>
										</Menu>
									</HStack>
								</>
							) : (
								<>
									<HStack modifiers={ROW}>
										<SwiftText modifiers={[BODY, rowLabel]}>
											{t("transaction.field.date")}
										</SwiftText>
										<Spacer />
										<DatePicker
											displayedComponents={["date"]}
											modifiers={[datePickerStyle("compact"), labelsHidden()]}
											onDateChange={setDate}
											selection={date}
										/>
									</HStack>

									<Divider modifiers={hairline} />

									<HStack modifiers={ROW}>
										<SwiftText modifiers={[BODY, rowLabel]}>
											{t("transaction.field.time")}
										</SwiftText>
										<Spacer />
										<DatePicker
											displayedComponents={["hourAndMinute"]}
											modifiers={[datePickerStyle("compact"), labelsHidden()]}
											onDateChange={setDate}
											selection={date}
										/>
									</HStack>
								</>
							)}
						</VStack>

						<VStack
							alignment="leading"
							modifiers={[padding({ all: 16 }), ...card]}
							spacing={8}
						>
							<HStack>
								<SwiftText modifiers={[BODY, rowLabel]}>
									{t("transaction.field.notes")}
								</SwiftText>
								<Spacer />
							</HStack>
							<TextField
								axis="vertical"
								modifiers={[
									BODY,
									foregroundStyle(colors.foreground),
									lineLimit({ min: 3, max: 6 }),
								]}
								placeholder={t("transaction.field.notesPlaceholder")}
								text={notes}
							/>
						</VStack>
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
					{/* No `matchContents` — the Host must take the full available width
					    so the button's Spacer-flanked label can stretch across it,
					    standing in for Swift's `.frame(maxWidth: .infinity)`. */}
					<Host style={{ height: 50 }}>
						<Button
							modifiers={[
								buttonStyle("borderedProminent"),
								controlSize("large"),
								tint(colors.foreground),
								foregroundStyle(colors.background),
								disabled(!canSave),
							]}
							onPress={handleSave}
						>
							<HStack>
								<Spacer />
								<SwiftText modifiers={[BODY_SEMIBOLD]}>{ctaLabel}</SwiftText>
								<Spacer />
							</HStack>
						</Button>
					</Host>
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
			<CategoryPickerSheet
				db={db}
				income={income}
				onSelect={handleSelectCategory}
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
