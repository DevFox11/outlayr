import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { DatePicker, Host, HStack, Spacer, Toggle } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { AccountPickerSheet } from "@/components/account-picker-sheet";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { HeroNumber } from "@/components/amount-text";
import { useNumpadAmountField } from "@/components/form/numpad-amount-field";
import { Text } from "@/components/text";
import { useAccounts } from "@/data/accounts";
import { useGlobalCurrency } from "@/data/app-meta";
import { type SavingsGoal, savingsGoalsRepo } from "@/data/savings-goals-core";
import type { Database } from "@/db/client";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";

interface GoalFormProps {
	db: Database;
	initial?: SavingsGoal;
	onDone: () => void;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<View className="gap-1.5 pt-5">
			<Text className="font-mono text-micro text-muted uppercase tracking-micro">{label}</Text>
			{children}
		</View>
	);
}

/**
 * Creating or editing a goal.
 *
 * The account is required and not editable after creation: progress IS that
 * account's balance, so swapping it would silently restate every figure the
 * goal has ever shown.
 */
export function GoalForm({ db, onDone, initial }: GoalFormProps) {
	const t = useTranslation();
	const haptics = useHaptics();
	const accounts = useAccounts(db);
	const globalCurrency = useGlobalCurrency(db);
	const accountSheetRef = useRef<BottomSheetModal>(null);

	const [initialValues] = useState(() => ({
		accountId: initial?.accountId ?? accounts[0]?.id ?? "",
		hasTargetDate: initial?.targetDate != null,
		name: initial?.name ?? "",
		targetDate: initial?.targetDate ?? new Date(),
		targetText: numberToNumpad(initial?.targetAmount ?? 0, minorUnitsFor(initial?.currency ?? globalCurrency)),
	}));

	const form = useForm({
		defaultValues: initialValues,
		onSubmit: async ({ value }) => {
			const account = accounts.find((candidate) => candidate.id === value.accountId);
			if (account == null) {
				return;
			}
			const targetAmount = numpadToNumber(value.targetText);
			try {
				const input = {
					accountId: account.id,
					currency: account.currency,
					name: value.name.trim() || t("goals.form.defaultName"),
					targetAmount,
					targetDate: value.hasTargetDate ? value.targetDate : null,
				};
				if (initial) {
					await savingsGoalsRepo.update(db, initial.id, input);
				} else {
					await savingsGoalsRepo.create(db, input);
				}
				haptics("success");
				onDone();
			} catch (error) {
				console.error("Failed to save the goal", error);
				haptics("error");
				Alert.alert(t("goals.form.failedTitle"), t("goals.form.failedBody"));
			}
		},
	});

	const { name, accountId, targetText, hasTargetDate, targetDate } = useSelector(form.store, (s) => s.values);
	const account = useMemo(
		() => accounts.find((candidate) => candidate.id === accountId) ?? null,
		[accounts, accountId]
	);
	const currency = account?.currency ?? globalCurrency;

	const amountField = useNumpadAmountField({
		code: currency,
		minorUnits: minorUnitsFor(currency),
		onChange: (next) => form.setFieldValue("targetText", next),
		value: targetText,
	});

	const canSave = account != null && amountField.amount > 0;

	return (
		<View className="flex-1 bg-background">
			<KeyboardAwareScrollView
				bottomOffset={24}
				className="flex-1"
				contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				<Pressable
					accessibilityLabel={t("goals.form.targetA11y")}
					accessibilityRole="button"
					className="items-center py-8 active:opacity-70"
					onPress={amountField.present}
				>
					<HeroNumber
						amount={amountField.amount}
						code={currency}
						sign=""
						size={52}
						toneClass={amountField.amount > 0 ? "text-foreground" : "text-subtle"}
					/>
				</Pressable>

				<Field label={t("goals.form.name")}>
					<TextInput
						autoCapitalize="words"
						className="rounded-xl border border-border px-3 py-3 font-sans text-body text-foreground"
						onChangeText={(next) => form.setFieldValue("name", next)}
						placeholder={t("goals.form.defaultName")}
						placeholderTextColorClassName="accent-muted"
						returnKeyType="done"
						value={name}
					/>
				</Field>

				<Field label={t("goals.form.account")}>
					<Pressable
						accessibilityRole="button"
						className="flex-row items-center justify-between rounded-xl border border-border px-3 py-3 active:opacity-70"
						disabled={initial != null}
						onPress={() => accountSheetRef.current?.present()}
					>
						<Text className={initial ? "text-body text-muted" : "text-body text-foreground"}>
							{account?.name ?? t("goals.form.chooseAccount")}
						</Text>
					</Pressable>
					{initial ? <Text className="text-footnote text-muted">{t("goals.form.accountLocked")}</Text> : null}
				</Field>

				<Field label={t("goals.form.by")}>
					<Host style={{ height: 40 }}>
						<HStack>
							<Toggle isOn={hasTargetDate} onIsOnChange={(next) => form.setFieldValue("hasTargetDate", next)} />
							<Spacer />
							{hasTargetDate ? (
								<DatePicker
									displayedComponents={["date"]}
									modifiers={[datePickerStyle("compact"), labelsHidden()]}
									onDateChange={(next) => form.setFieldValue("targetDate", next)}
									selection={targetDate}
								/>
							) : null}
						</HStack>
					</Host>
					{hasTargetDate ? null : <Text className="text-footnote text-muted">{t("goals.form.noDateNote")}</Text>}
				</Field>

				<Pressable
					accessibilityRole="button"
					className={`mt-8 items-center rounded-xl py-4 ${canSave ? "bg-foreground" : "bg-surface"}`}
					disabled={!canSave}
					onPress={() => form.handleSubmit()}
				>
					<Text className={canSave ? "font-sans-semibold text-background text-body" : "text-body text-muted"}>
						{initial ? t("goals.form.save") : t("goals.form.create")}
					</Text>
				</Pressable>
			</KeyboardAwareScrollView>

			<AmountEntrySheet {...amountField.sheetProps} />
			<AccountPickerSheet
				db={db}
				onCreate={() => accountSheetRef.current?.dismiss()}
				onSelect={(picked) => {
					if (picked) {
						form.setFieldValue("accountId", picked.id);
					}
					accountSheetRef.current?.dismiss();
				}}
				ref={accountSheetRef}
				selectedId={accountId}
			/>
		</View>
	);
}
