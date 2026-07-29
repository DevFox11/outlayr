import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { DatePicker, Host, HStack, Spacer } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";
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
import { MonoLabel } from "@/components/mono-label";
import { SegmentedControl } from "@/components/segmented-control";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useGlobalCurrency } from "@/data/app-meta";
import { budgetsRepo } from "@/data/budgets";
import type { Category } from "@/data/categories";
import type { Database } from "@/db/client";
import { BUDGET_TYPE, startOfPeriod } from "@/domain/budget-math";
import { minorUnitsFor } from "@/domain/money";
import { numpadToNumber } from "@/domain/numpad";

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
}

/** Overall budgets are a singleton — saving re-points the existing one. */
export function BudgetForm({ db, onDone }: BudgetFormProps) {
	const currency = useGlobalCurrency(db);
	const minorUnits = minorUnitsFor(currency);

	const [kind, setKind] = useState<Kind>("overall");
	const [category, setCategory] = useState<Category | null>(null);
	const [amount, setAmount] = useState("");
	const [name, setName] = useState("");
	const [period, setPeriod] = useState<Period>("month");
	const [startDate, setStartDate] = useState<Date | null>(null);
	const [missingCategory, setMissingCategory] = useState(false);
	const [saving, setSaving] = useState(false);

	const amountSheetRef = useRef<BottomSheetModal>(null);
	const categorySheetRef = useRef<CategoryPickerSheetRef>(null);
	const shakeX = useSharedValue(0);
	const shakeStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: shakeX.value }],
	}));

	const amountNumber = numpadToNumber(amount);
	const canSave =
		amountNumber > 0 && (kind === "overall" || category != null) && !saving;
	const defaultName =
		kind === "overall" ? "Overall Budget" : (category?.name ?? "Budget");

	// Untouched, the picker shows the anchor the repo would pick anyway.
	const periodStart = useMemo(
		() => startOfPeriod(new Date(), PERIOD_TYPE[period]),
		[period],
	);
	// The window rolls forward from the stored anchor, so an older date is lost.
	const backdateRange = useMemo(
		() => ({ start: periodStart, end: new Date() }),
		[periodStart],
	);

	const shake = () => {
		shakeX.value = withSequence(
			withTiming(-8, { duration: 45 }),
			withTiming(8, { duration: 45 }),
			withTiming(-6, { duration: 45 }),
			withTiming(0, { duration: 45 }),
		);
	};

	const handleSelectCategory = (picked: Category) => {
		setCategory(picked);
		setMissingCategory(false);
		categorySheetRef.current?.dismiss();
	};

	const handleSave = async () => {
		if (amountNumber <= 0) {
			return;
		}
		const type = PERIOD_TYPE[period];
		if (kind === "category" && !category) {
			setMissingCategory(true);
			shake();
			Vibration.vibrate(40);
			return;
		}
		setSaving(true);
		try {
			if (kind === "overall") {
				await budgetsRepo.createMainBudget(db, {
					amount: amountNumber,
					type,
					name,
					startDate,
				});
			} else if (category) {
				await budgetsRepo.createBudget(db, {
					categoryId: category.id,
					amount: amountNumber,
					type,
					name,
					startDate,
				});
			}
			onDone();
		} catch (error) {
			console.error("Failed to save budget", error);
			setSaving(false);
		}
	};

	return (
		<View className="flex-1 bg-background">
			<KeyboardAwareScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
				bottomOffset={24}
			>
				<SegmentedControl
					options={[
						{ label: "Overall", value: "overall" },
						{ label: "Category", value: "category" },
					]}
					value={kind}
					onChange={(next) => setKind(next as Kind)}
				/>

				<Pressable
					className="items-center py-8 active:opacity-70"
					onPress={() => amountSheetRef.current?.present()}
					accessibilityRole="button"
					accessibilityLabel="Edit amount"
				>
					<HeroNumber
						amount={amountNumber}
						code={currency}
						sign=""
						toneClass={amountNumber > 0 ? "text-foreground" : "text-subtle"}
						size={52}
					/>
				</Pressable>

				<Field label="NAME">
					<TextInput
						className="rounded-xl border border-border px-3 py-3 font-sans text-body text-foreground"
						value={name}
						onChangeText={setName}
						placeholder={defaultName}
						placeholderTextColorClassName="accent-muted"
						autoCapitalize="words"
						returnKeyType="done"
					/>
				</Field>

				{kind === "category" ? (
					<Field label="CATEGORY">
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
											icon={category.icon}
											size={28}
										/>
										<Text className="flex-1 text-body text-foreground">
											{category.name}
										</Text>
									</>
								) : (
									<Text className="flex-1 text-body text-muted">
										Select a category
									</Text>
								)}
								<Text className="text-headline text-subtle">{"›"}</Text>
							</Pressable>
						</Animated.View>
					</Field>
				) : null}

				<Field label="PERIOD">
					<SegmentedControl
						options={[
							{ label: "Day", value: "day" },
							{ label: "Week", value: "week" },
							{ label: "Month", value: "month" },
							{ label: "Year", value: "year" },
						]}
						value={period}
						onChange={(next) => setPeriod(next as Period)}
					/>
				</Field>

				<Field label="STARTS">
					<Host style={{ height: 40 }}>
						<HStack>
							<DatePicker
								displayedComponents={["date"]}
								modifiers={[datePickerStyle("compact"), labelsHidden()]}
								onDateChange={setStartDate}
								range={backdateRange}
								selection={startDate ?? periodStart}
							/>
							<Spacer />
						</HStack>
					</Host>
				</Field>

				<Pressable
					className={cn(
						"mt-4 items-center rounded-xl py-3.5",
						canSave ? "bg-accent active:opacity-80" : "bg-surface",
					)}
					disabled={!canSave}
					onPress={handleSave}
					accessibilityRole="button"
				>
					<Text
						className={cn(
							"font-sans-semibold text-body",
							canSave ? "text-accent-foreground" : "text-subtle",
						)}
					>
						Create budget
					</Text>
				</Pressable>
			</KeyboardAwareScrollView>

			<AmountEntrySheet
				ref={amountSheetRef}
				value={amount}
				minorUnits={minorUnits}
				code={currency}
				onChange={setAmount}
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
