import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { DatePicker, Host, HStack, Spacer, Toggle } from "@expo/ui/swift-ui";
import {
	datePickerStyle,
	labelsHidden,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useStore } from "@tanstack/react-form";
import { useMemo, useRef, useState } from "react";
import { Pressable, TextInput, Vibration, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { HeroNumber } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import {
	CategoryPickerSheet,
	type CategoryPickerSheetRef,
} from "@/components/category-picker-sheet";
import { useAppForm } from "@/components/form/create-app-form";
import { pressSubmit, reportSaveFailure } from "@/components/form/submit-guard";
import { MonoLabel } from "@/components/mono-label";
import { SegmentedControl } from "@/components/segmented-control";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { type Budget, budgetsRepo } from "@/data/budgets";
import { type Category, getCategoryById } from "@/data/categories";
import type { Database } from "@/db/client";
import { BUDGET_TYPE, startOfPeriod } from "@/domain/budget-math";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

type Kind = "overall" | "category";
type Period = "day" | "week" | "month" | "year";

const PERIOD_TYPE: Record<Period, number> = {
	day: BUDGET_TYPE.day,
	week: BUDGET_TYPE.week,
	month: BUDGET_TYPE.month,
	year: BUDGET_TYPE.year,
};

interface BudgetFormProps {
	db: Database;
	onDone: () => void;
	/**
	 * The row an edit re-writes. Its kind is fixed: a per-category budget cannot
	 * become the overall singleton without orphaning its own row.
	 */
	initial?: Budget;
}

const PERIOD_BY_TYPE: Record<number, Period> = {
	[BUDGET_TYPE.day]: "day",
	[BUDGET_TYPE.week]: "week",
	[BUDGET_TYPE.month]: "month",
	[BUDGET_TYPE.year]: "year",
};

/** Overall budgets are a singleton — saving re-points the existing one. */
export function BudgetForm({ db, onDone, initial }: BudgetFormProps) {
	const t = useTranslation();
	const currency = useGlobalCurrency(db);
	const minorUnits = minorUnitsFor(currency);
	const { state: settings } = useAppSettings();
	const calendar = useMemo(
		() => ({
			firstWeekday: settings.number("firstWeekday"),
			firstDayOfMonth: settings.number("firstDayOfMonth"),
		}),
		[settings],
	);

	const colors = useColors();
	const [missingCategory, setMissingCategory] = useState(false);

	const amountSheetRef = useRef<BottomSheetModal>(null);
	const categorySheetRef = useRef<CategoryPickerSheetRef>(null);
	const shakeX = useSharedValue(0);
	const shakeStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: shakeX.value }],
	}));

	const shake = () => {
		shakeX.value = withSequence(
			withTiming(-8, { duration: 45 }),
			withTiming(8, { duration: 45 }),
			withTiming(-6, { duration: 45 }),
			withTiming(0, { duration: 45 }),
		);
	};

	const [initialValues] = useState(() => ({
		kind: (initial ? "category" : "overall") as Kind,
		category: initial?.categoryId
			? getCategoryById(db, initial.categoryId)
			: null,
		amount: initial ? numberToNumpad(initial.amount, minorUnits) : "",
		name: initial?.name ?? "",
		period: (initial
			? (PERIOD_BY_TYPE[initial.type] ?? "month")
			: "month") as Period,
		startDate: initial?.startDate ?? null,
		rollover: initial?.rollover ?? false,
	}));

	const form = useAppForm({
		defaultValues: initialValues,
		onSubmit: async ({ value }) => {
			const amountNumber = numpadToNumber(value.amount);
			if (amountNumber <= 0) {
				return;
			}
			const type = PERIOD_TYPE[value.period];
			if (value.kind === "category" && !value.category) {
				setMissingCategory(true);
				shake();
				Vibration.vibrate(40);
				return;
			}
			try {
				if (initial) {
					if (value.category) {
						await budgetsRepo.updateBudget(db, initial.id, {
							categoryId: value.category.id,
							amount: amountNumber,
							type,
							name: value.name,
							startDate: value.startDate,
							rollover: value.rollover,
						});
					}
				} else if (value.kind === "overall") {
					await budgetsRepo.createMainBudget(db, {
						amount: amountNumber,
						type,
						name: value.name,
						startDate: value.startDate,
						rollover: value.rollover,
					});
				} else if (value.category) {
					await budgetsRepo.createBudget(db, {
						categoryId: value.category.id,
						amount: amountNumber,
						type,
						name: value.name,
						startDate: value.startDate,
						rollover: value.rollover,
					});
				}
				onDone();
			} catch (error) {
				reportSaveFailure({
					title: t("budgets.save.failedTitle"),
					body: t("budgets.save.failedBody"),
					log: "Failed to save budget",
					cause: error,
				});
			}
		},
	});

	const { kind, category, amount, name, period, startDate, rollover } =
		useStore(form.store, (s) => s.values);
	const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

	const amountNumber = numpadToNumber(amount);
	const canSave =
		amountNumber > 0 &&
		(kind === "overall" || category != null) &&
		!isSubmitting;
	const defaultName =
		kind === "overall"
			? t("budgets.form.defaultOverall")
			: (category?.name ?? t("budgets.form.defaultName"));

	// Untouched, the picker shows the anchor the repo would pick anyway.
	const periodStart = useMemo(
		() => startOfPeriod(new Date(), PERIOD_TYPE[period], calendar),
		[period, calendar],
	);
	// The window rolls forward from the stored anchor, so an older date is lost —
	// except one an existing budget already runs on, which the picker must be
	// able to show or SwiftUI clamps the selection out from under the edit.
	const backdateRange = useMemo(() => {
		const anchor = initial?.startDate;
		const start =
			anchor && anchor.getTime() < periodStart.getTime() ? anchor : periodStart;
		return { start, end: new Date() };
	}, [periodStart, initial]);

	const handleSelectCategory = (picked: Category) => {
		form.setFieldValue("category", picked);
		setMissingCategory(false);
		categorySheetRef.current?.dismiss();
	};

	return (
		<View className="flex-1 bg-background">
			<KeyboardAwareScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
				bottomOffset={24}
			>
				{initial ? null : (
					<SegmentedControl
						options={[
							{ label: t("budgets.form.kindOverall"), value: "overall" },
							{ label: t("budgets.form.kindCategory"), value: "category" },
						]}
						value={kind}
						onChange={(next) => form.setFieldValue("kind", next as Kind)}
					/>
				)}

				<Pressable
					className="items-center py-8 active:opacity-70"
					onPress={() => amountSheetRef.current?.present()}
					accessibilityRole="button"
					accessibilityLabel={t("budgets.form.amountA11y")}
				>
					<HeroNumber
						amount={amountNumber}
						code={currency}
						sign=""
						toneClass={amountNumber > 0 ? "text-foreground" : "text-subtle"}
						size={52}
					/>
				</Pressable>

				<Field label={t("budgets.form.name")}>
					<TextInput
						className="rounded-xl border border-border px-3 py-3 font-sans text-body text-foreground"
						value={name}
						onChangeText={(next) => form.setFieldValue("name", next)}
						placeholder={defaultName}
						placeholderTextColorClassName="accent-muted"
						autoCapitalize="words"
						returnKeyType="done"
					/>
				</Field>

				{kind === "category" ? (
					<Field label={t("budgets.form.category")}>
						<Animated.View style={shakeStyle}>
							<Pressable
								className={cn(
									"flex-row items-center gap-3 rounded-xl border px-3 py-3 active:opacity-70",
									missingCategory ? "border-danger" : "border-border",
								)}
								onPress={() => categorySheetRef.current?.present()}
								accessibilityRole="button"
							>
								{category ? (
									<>
										<CategoryIconTile
											color={category.color ?? "#767676"}
											emoji={category.emoji}
											icon={category.icon}
											size={28}
										/>
										<Text className="flex-1 text-body text-foreground">
											{category.name}
										</Text>
									</>
								) : (
									<Text className="flex-1 text-body text-muted">
										{t("budgets.form.selectCategory")}
									</Text>
								)}
								<Text className="text-headline text-subtle">{"›"}</Text>
							</Pressable>
						</Animated.View>
					</Field>
				) : null}

				<Field label={t("budgets.form.period")}>
					<SegmentedControl
						options={[
							{ label: t("budgets.form.periodDay"), value: "day" },
							{ label: t("budgets.form.periodWeek"), value: "week" },
							{ label: t("budgets.form.periodMonth"), value: "month" },
							{ label: t("budgets.form.periodYear"), value: "year" },
						]}
						value={period}
						onChange={(next) => form.setFieldValue("period", next as Period)}
					/>
				</Field>

				<Field label={t("budgets.form.starts")}>
					<Host style={{ height: 40 }}>
						<HStack>
							<DatePicker
								displayedComponents={["date"]}
								modifiers={[datePickerStyle("compact"), labelsHidden()]}
								onDateChange={(next) => form.setFieldValue("startDate", next)}
								range={backdateRange}
								selection={startDate ?? periodStart}
							/>
							<Spacer />
						</HStack>
					</Host>
				</Field>

				<Field label={t("budgets.form.rollover")}>
					<Host style={{ height: 40 }}>
						<HStack>
							<Toggle
								isOn={rollover}
								modifiers={[tint(colors.income), labelsHidden()]}
								onIsOnChange={(next) => form.setFieldValue("rollover", next)}
							/>
							<Spacer />
						</HStack>
					</Host>
					<Text className="pt-1 text-footnote text-muted leading-snug">
						{t("budgets.form.rolloverNote")}
					</Text>
				</Field>

				<Pressable
					className={cn(
						"mt-4 items-center rounded-xl py-3.5",
						canSave ? "bg-accent active:opacity-80" : "bg-surface",
					)}
					disabled={!canSave}
					onPress={() => pressSubmit(form)}
					accessibilityRole="button"
				>
					<Text
						className={cn(
							"font-sans-semibold text-body",
							canSave ? "text-accent-foreground" : "text-subtle",
						)}
					>
						{initial ? t("budgets.form.save") : t("budgets.form.create")}
					</Text>
				</Pressable>
			</KeyboardAwareScrollView>

			<AmountEntrySheet
				ref={amountSheetRef}
				value={amount}
				minorUnits={minorUnits}
				code={currency}
				onChange={(next) => form.setFieldValue("amount", next)}
				onDone={() => amountSheetRef.current?.dismiss()}
			/>
			<CategoryPickerSheet
				ref={categorySheetRef}
				db={db}
				income={false}
				selectedId={category?.id ?? null}
				onSelect={handleSelectCategory}
			/>
		</View>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<View className="mb-4">
			<View className="mb-2">
				<MonoLabel>{label}</MonoLabel>
			</View>
			{children}
		</View>
	);
}
