import { HugeiconsIcon } from "@hugeicons/react-native";
import { Cancel01Icon, CheckIcon, MinusSignIcon, PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import { NumberFlow } from "number-flow-react-native";
import { BottomSheet, Button, cn, Tabs } from "panelui-native";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { formatChargeDate } from "@/domain/dates";
import {
	MAX_INTERVAL,
	RECURRING_TYPE,
	type ScheduledCharge,
	SELECTABLE_RECURRING_TYPES,
	schedulePreview,
} from "@/domain/recurrence";
import type { TranslationKey } from "@/i18n/catalog";
import { type TranslateFn, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";

const PREVIEW_COUNT = 3;

/** One row's half of the swap: out, then the new date, then back in. */
const SWAP = {
	duration: 80,
	easing: Easing.bezier(0.2, 0.9, 0.25, 1),
} as const;
/**
 * Exactly one row's full out-and-back, so the next row does not start until the
 * last has landed. Anything shorter overlaps their dim windows: measured on
 * device, 55ms emptied all three rows at once and 90ms still emptied two.
 */
const RIPPLE_STAGGER_MS = SWAP.duration * 2;

const SENTENCE = "font-sans-medium text-[30px] text-foreground leading-9";
const SENTENCE_SIZE = 30;
/** Half the count's roll: two things moving at one speed read as one thing. */
const UNIT_FADE_MS = 170;

/**
 * NumberFlow gives each digit an `overflow: hidden` slot sized to the advance
 * width it measures from a one-glyph line, and SF Pro Rounded's round digits
 * carry ink past that advance — so 2, 3 and 6 rendered with a flat slice down
 * their right side while 1, which has slack, looked correct. Tracking widens
 * the measured advance, and the slot is cut from it.
 *
 * 5 at 30px, from pixel-measuring the "6": its ink was 45px wide with the right
 * edge landing on one x for 34 of its 64 rows — a cut — and comes out 50px wide
 * with that edge spread across four x values, which is a curve. 2 was not enough.
 *
 * Changing it alone looks like it does nothing: the library caches metrics under
 * `fontFamily:fontSize:variant:weight`, which letterSpacing is not part of, so
 * Fast Refresh keeps serving the stale width. Reload the app fully.
 */
const COUNT_TRACKING = 5;

const UNIT_TITLE_KEY: Record<number, TranslationKey> = {
	[RECURRING_TYPE.daily]: "transaction.cadence.days",
	[RECURRING_TYPE.weekly]: "transaction.cadence.weeks",
	[RECURRING_TYPE.monthly]: "transaction.cadence.months",
	[RECURRING_TYPE.yearly]: "transaction.cadence.years",
};

const UNIT_NOUN_KEY: Record<number, { readonly one: TranslationKey; readonly many: TranslationKey }> = {
	[RECURRING_TYPE.daily]: {
		many: "transaction.unit.days",
		one: "transaction.unit.day",
	},
	[RECURRING_TYPE.weekly]: {
		many: "transaction.unit.weeks",
		one: "transaction.unit.week",
	},
	[RECURRING_TYPE.monthly]: {
		many: "transaction.unit.months",
		one: "transaction.unit.month",
	},
	[RECURRING_TYPE.yearly]: {
		many: "transaction.unit.years",
		one: "transaction.unit.year",
	},
};

const INTERVAL_KEY: Record<number, { readonly one: TranslationKey; readonly many: TranslationKey }> = {
	[RECURRING_TYPE.daily]: {
		many: "transaction.interval.days",
		one: "transaction.interval.day",
	},
	[RECURRING_TYPE.weekly]: {
		many: "transaction.interval.weeks",
		one: "transaction.interval.week",
	},
	[RECURRING_TYPE.monthly]: {
		many: "transaction.interval.months",
		one: "transaction.interval.month",
	},
	[RECURRING_TYPE.yearly]: {
		many: "transaction.interval.years",
		one: "transaction.interval.year",
	},
};

/**
 * The "day" / "3 months" fragment both `Every {interval}` and
 * `Repeats every {interval}` embed. Composed rather than written out per cadence
 * because English and Spanish take the same shape here, and the count is a plain
 * integer the caller already clamped — no locale number formatting is involved.
 */
export function intervalPhrase(t: TranslateFn, type: number, coefficient: number): string {
	const n = Math.max(1, Math.round(coefficient));
	const keys = INTERVAL_KEY[type] ?? INTERVAL_KEY[RECURRING_TYPE.monthly];
	return n <= 1 ? t(keys.one) : t(keys.many, { count: n });
}

function unitNoun(t: TranslateFn, type: number, coefficient: number): string {
	const keys = UNIT_NOUN_KEY[type] ?? UNIT_NOUN_KEY[RECURRING_TYPE.monthly];
	return coefficient <= 1 ? t(keys.one) : t(keys.many);
}

function normalizeSchedule(type: number, coefficient: number) {
	return {
		coefficient: Math.min(MAX_INTERVAL, Math.max(1, Math.round(coefficient))),
		type: type === RECURRING_TYPE.none ? RECURRING_TYPE.monthly : type,
	};
}

function chargeKey(charges: readonly ScheduledCharge[]): string {
	return charges.map((c) => `${c.date.getTime()}:${c.clamped}`).join("|");
}

/**
 * Holds the charges on screen while they hand over one row at a time.
 *
 * The rows are staggered rather than swapped together so the eye reads the
 * schedule re-walking forward from the first payment, and each row's new date
 * lands at the midpoint of its own fade — no frame ever shows a date the sheet
 * is not about to keep.
 */
function useRippledCharges(charges: readonly ScheduledCharge[], ready: RefObject<boolean>) {
	const [shown, setShown] = useState<readonly ScheduledCharge[]>(charges);
	const [swapping, setSwapping] = useState<readonly boolean[]>([]);
	/*
	 * Committed only once every row has landed. Deriving it from `shown` mid-swap
	 * reads a half-updated schedule, and an intermediate set with no clamped row
	 * hides the note, shrinks the sheet, then grows it again a beat later — the
	 * one height change here, played twice, in the middle of the motion.
	 */
	const [noteVisible, setNoteVisible] = useState(() => charges.some((charge) => charge.clamped));
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const next = chargeKey(charges);
	const current = chargeKey(shown);

	useEffect(() => {
		if (next === current) {
			return;
		}
		for (const timer of timers.current) {
			clearTimeout(timer);
		}
		timers.current = [];

		const clamped = charges.some((charge) => charge.clamped);
		if (!ready.current) {
			setShown(charges);
			setSwapping([]);
			setNoteVisible(clamped);
			return;
		}

		charges.forEach((_, index) => {
			timers.current.push(
				setTimeout(() => {
					setSwapping((prev) => withAt(prev, index, true));
					timers.current.push(
						setTimeout(() => {
							setShown((prev) => withAt(prev, index, charges[index]));
							setSwapping((prev) => withAt(prev, index, false));
						}, SWAP.duration)
					);
				}, index * RIPPLE_STAGGER_MS)
			);
		});
		timers.current.push(
			setTimeout(() => setNoteVisible(clamped), (charges.length - 1) * RIPPLE_STAGGER_MS + SWAP.duration * 2)
		);
	}, [next, current, charges, ready]);

	useEffect(
		() => () => {
			for (const timer of timers.current) {
				clearTimeout(timer);
			}
		},
		[]
	);

	return { noteVisible, shown, swapping };
}

function withAt<T>(list: readonly T[], index: number, value: T): T[] {
	const copy = [...list];
	copy[index] = value;
	return copy;
}

interface CustomScheduleSheetProps {
	firstPayment: Date;
	onDone: (recurringType: number, recurringCoefficient: number) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	recurringCoefficient: number;
	recurringType: number;
}

/**
 * Edits are LOCAL until Done, so Cancel leaves the form's schedule untouched.
 */
export function CustomScheduleSheet({
	open,
	recurringType,
	recurringCoefficient,
	firstPayment,
	onOpenChange,
	onDone,
}: CustomScheduleSheetProps) {
	const t = useTranslation();
	const colors = useColors();
	const seeded = normalizeSchedule(recurringType, recurringCoefficient);
	const [type, setType] = useState(seeded.type);
	const [coefficient, setCoefficient] = useState(seeded.coefficient);
	const [wasOpen, setWasOpen] = useState(open);
	/*
	 * The dates re-seed on the open edge, and rippling them there would play our
	 * motion underneath the platform's own presentation. Armed a tick after the
	 * sheet is up, so the first ripple the user sees is one they asked for.
	 */
	const rippleReady = useRef(false);

	/*
	 * Re-seeded during render on the closed→open edge, not in an effect: the sheet
	 * stays mounted across opens, so a form edit made while it was closed has to
	 * land — and landing it a frame later would draw the previous schedule first.
	 * Re-seeding on every prop change instead would fight the user mid-edit, since
	 * Done is what pushes these values back up to the form.
	 */
	if (open !== wasOpen) {
		setWasOpen(open);
		rippleReady.current = false;
		if (open) {
			const next = normalizeSchedule(recurringType, recurringCoefficient);
			setType(next.type);
			setCoefficient(next.coefficient);
		}
	}

	const unitWord = unitNoun(t, type, coefficient);

	const charges = useMemo(
		() => schedulePreview(firstPayment, type, coefficient, PREVIEW_COUNT),
		[firstPayment, type, coefficient]
	);
	const { shown, swapping, noteVisible } = useRippledCharges(charges, rippleReady);

	useEffect(() => {
		if (!open) {
			return;
		}
		const armed = setTimeout(() => {
			rippleReady.current = true;
		}, 0);
		return () => clearTimeout(armed);
	}, [open]);

	const close = useCallback(() => onOpenChange(false), [onOpenChange]);

	const done = useCallback(() => {
		onDone(type, coefficient);
		onOpenChange(false);
	}, [onDone, onOpenChange, type, coefficient]);

	const pickType = useCallback((next: string) => setType(Number(next)), []);
	const stepUp = useCallback(() => setCoefficient((c) => Math.min(MAX_INTERVAL, c + 1)), []);
	const stepDown = useCallback(() => setCoefficient((c) => Math.max(1, c - 1)), []);

	return (
		<BottomSheet native onOpenChange={onOpenChange} open={open}>
			<BottomSheet.Content className="pt-0" size="auto">
				<View className="flex-row items-center justify-between py-1">
					<Button
						accessibilityLabel={t("common.cancel")}
						className="rounded-full"
						onPress={close}
						size="icon"
						variant="secondary"
					>
						<HugeiconsIcon color={colors.foreground} icon={Cancel01Icon} size={22} />
					</Button>

					<Text accessibilityRole="header" className="font-medium text-foreground text-lg">
						{t("transaction.schedule.customTitle")}
					</Text>

					<Button accessibilityLabel={t("common.done")} className="rounded-full" onPress={done} size="icon">
						<HugeiconsIcon color={colors.accentForeground} icon={CheckIcon} size={22} />
					</Button>
				</View>

				{/*
				 * A row rather than one Text with nested spans: NumberFlow is a view and
				 * cannot live inside a Text, and the unit needs its own node to cross-fade.
				 * `items-baseline` is what keeps the three pieces sitting on one line.
				 */}
				<View
					className="h-9 flex-row items-center gap-2"
					style={{ marginBottom: 16, marginTop: 12 }}
					testID="schedule-sentence"
				>
					<Text className={SENTENCE}>{t("transaction.schedule.everyLabel")}</Text>
					<StepButton
						accessibilityLabel={t("transaction.schedule.fewer")}
						disabled={coefficient <= 1}
						icon={MinusSignIcon}
						onStep={stepDown}
					/>
					<NumberFlow
						style={{
							color: colors.foreground,
							fontFamily: "SFProRounded-Bold",
							fontSize: SENTENCE_SIZE,
							// The family name alone left the count rendering at the same
							// weight as the words either side of it; only this selects bold.
							fontWeight: "700",
							letterSpacing: COUNT_TRACKING,
						}}
						// Shortest path per digit. Left to auto-detect, a drop from 12 to 3
						// spins the units column down through 9, 8, 7 — so the sentence
						// visibly reads "every 9 months", a schedule nobody chose.
						trend={0}
						value={coefficient}
					/>
					<StepButton
						accessibilityLabel={t("transaction.schedule.more")}
						disabled={coefficient >= MAX_INTERVAL}
						icon={PlusSignIcon}
						onStep={stepUp}
					/>
					{/*
					 * Pinned to the line's height with the words stacked absolutely inside
					 * it. Reanimated keeps an exiting view mounted, and two words in normal
					 * flow would double this box for the length of the cross-fade — which
					 * re-measures RNHostView and makes the whole platform sheet re-settle.
					 */}
					<View className="h-9 flex-1">
						<Animated.View
							className="absolute top-0 left-0"
							entering={FadeIn.duration(UNIT_FADE_MS)}
							exiting={FadeOut.duration(UNIT_FADE_MS)}
							key={unitWord}
						>
							<Text className={SENTENCE}>{unitWord}</Text>
						</Animated.View>
					</View>
				</View>

				{/*
				 * `pill`, never `segmented`: PanelUI's segmented track paints its list
				 * `bg-muted`, which is a surface wash in their theme and the secondary
				 * TEXT colour in ours — it comes out a dark slab.
				 */}
				<Tabs
					defaultValue={String(RECURRING_TYPE.monthly)}
					onValueChange={pickType}
					value={String(type)}
					variant="pill"
				>
					<Tabs.List>
						{SELECTABLE_RECURRING_TYPES.map((option) => (
							<Tabs.Trigger key={option} value={String(option)}>
								{t(UNIT_TITLE_KEY[option] ?? "transaction.cadence.months")}
							</Tabs.Trigger>
						))}
					</Tabs.List>
				</Tabs>

				<View className="mt-5 rounded-2xl bg-background p-4">
					<MonoLabel className="pb-2">{t("transaction.schedule.nextCharges")}</MonoLabel>
					<ChargeRow date={firstPayment} first tag={t("transaction.schedule.firstPaymentTag")} />
					{shown.map((charge, index) => (
						<ChargeRow
							date={charge.date}
							// biome-ignore lint/suspicious/noArrayIndexKey: three fixed slots the dates hand over inside; keying by date would remount the row and lose its swap
							key={index}
							last={index === shown.length - 1}
							swapping={swapping[index] === true}
							tag={charge.clamped ? t("transaction.schedule.shortMonthTag") : undefined}
							tinted={charge.clamped}
						/>
					))}
					{noteVisible ? (
						<Text className="mt-2 border-separator border-t pt-3 text-footnote text-muted">
							{t("transaction.schedule.shortMonthNote")}
						</Text>
					) : null}
				</View>
			</BottomSheet.Content>
		</BottomSheet>
	);
}

const STEP_ICON_SIZE = 18;

/** Held down, a step waits this long before it starts repeating. */
const HOLD_DELAY_MS = 350;
/** And then repeats this often — 1 to 30 in about two seconds. */
const HOLD_REPEAT_MS = 70;

interface StepButtonProps {
	accessibilityLabel: string;
	disabled: boolean;
	icon: typeof PlusSignIcon;
	onStep: () => void;
}

/**
 * Nudges the count inside the sentence.
 *
 * It repeats while held, which is what lets one pair of buttons cover the whole
 * range: without it, reaching 30 is 29 taps, and that is the gap the row of
 * preset chips used to fill.
 */
function StepButton({ icon, onStep, disabled, accessibilityLabel }: StepButtonProps) {
	const colors = useColors();
	const held = useRef<{
		delay?: ReturnType<typeof setTimeout>;
		repeat?: ReturnType<typeof setInterval>;
	}>({});

	const release = useCallback(() => {
		if (held.current.delay) {
			clearTimeout(held.current.delay);
		}
		if (held.current.repeat) {
			clearInterval(held.current.repeat);
		}
		held.current = {};
	}, []);

	useEffect(() => release, [release]);

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			// `bg-background`, not `bg-surface-secondary`: the sheet's own surface is
			// within a couple of values of it, so a secondary fill left these as bare
			// glyphs floating in the sentence with nothing to aim at.
			className={
				disabled
					? "h-9 w-9 items-center justify-center rounded-full bg-background opacity-40"
					: "h-9 w-9 items-center justify-center rounded-full bg-background active:opacity-60"
			}
			disabled={disabled}
			hitSlop={6}
			// On press-in, not on press: a stepper that waits for the finger to lift
			// feels a beat behind, and the hold has to start from the same moment.
			onPressIn={() => {
				onStep();
				held.current.delay = setTimeout(() => {
					held.current.repeat = setInterval(onStep, HOLD_REPEAT_MS);
				}, HOLD_DELAY_MS);
			}}
			onPressOut={release}
		>
			<HugeiconsIcon color={colors.foreground} icon={icon} size={STEP_ICON_SIZE} strokeWidth={2.4} />
		</Pressable>
	);
}

interface ChargeRowProps {
	date: Date;
	first?: boolean;
	last?: boolean;
	/** This row's date is mid-handover and is not currently true. */
	swapping?: boolean;
	tag?: string;
	tinted?: boolean;
}

function ChargeRow({ date, tag, first = false, last = false, tinted = false, swapping = false }: ChargeRowProps) {
	// Transform and opacity only: neither reaches layout, so the row never
	// re-measures and the platform sheet never re-settles under the motion.
	const dateStyle = useAnimatedStyle(() => ({
		opacity: withTiming(swapping ? 0 : 1, SWAP),
		transform: [{ translateY: withTiming(swapping ? 5 : 0, SWAP) }],
	}));
	const dotStyle = useAnimatedStyle(() => ({
		opacity: withTiming(swapping ? 0.35 : 1, SWAP),
	}));

	return (
		<View className="min-h-9.5 flex-row items-center gap-3">
			{/* The rule is drawn before the dot so the dot covers it; an unfilled
			    dot is a ring, and a line crossing its middle reads as a strikethrough. */}
			<View className="w-5.5 items-center justify-center self-stretch">
				{last ? null : <View className="absolute top-1/2 bottom-0 w-[1.5px] bg-separator" />}
				{first ? null : <View className="absolute top-0 bottom-1/2 w-[1.5px] bg-separator" />}
				<Animated.View
					className={cn(
						"size-2.25 rounded-full",
						first ? "bg-foreground" : "border-[1.5px] border-muted bg-background"
					)}
					style={first ? undefined : dotStyle}
				/>
			</View>
			<Animated.View className="flex-1 flex-row items-center gap-3" style={first ? undefined : dateStyle}>
				<Text className={tinted ? "font-sans-semibold text-foreground text-subtitle" : "text-foreground text-subtitle"}>
					{formatChargeDate(date)}
				</Text>
				{tag == null ? null : <Text className="text-label text-muted">{tag}</Text>}
			</Animated.View>
		</View>
	);
}
