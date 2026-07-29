import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { currencyDisplayFor } from "@outlayr/money";
import { useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { CurrencyPickerSheet } from "@/components/currency-picker-sheet";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { completeOnboarding } from "@/data/onboarding";
import type { Database } from "@/db/client";

export default function OnboardingCurrencyScreen() {
	const db = useDatabase();
	return <OnboardingCurrency db={db} />;
}

function OnboardingCurrency({ db }: { db: Database }) {
	const stored = useGlobalCurrency(db);
	const [picked, setPicked] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const sheet = useRef<BottomSheetModal>(null);

	const code = picked ?? stored;
	const display = currencyDisplayFor(code);

	const confirm = () => {
		setSaving(true);
		// Nothing navigates on success: the write settles the root guard, which
		// swaps this stack for the tabs. Pushing as well would race it.
		completeOnboarding(db, code).catch(() => {
			setSaving(false);
			Alert.alert(
				"Could not save",
				"Outlayr could not record your currency. Try again.",
			);
		});
	};

	return (
		<View className="flex-1 bg-background px-6 pt-safe-offset-14 pb-safe-offset-5">
			<View className="gap-2">
				<MonoLabel>Currency</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-title">
					What are your numbers in?
				</Text>
				<Text className="text-muted text-subtitle">
					Outlayr converts between currencies to total your ledger, so it has to
					know what your entries already mean. It asks once rather than guessing
					— a guess it later froze into your records could not be undone.
				</Text>
			</View>

			<View className="flex-1 justify-center">
				<Pressable
					accessibilityHint="Opens the currency list"
					accessibilityRole="button"
					className="flex-row items-center gap-4 border-border border-y py-5 active:opacity-60"
					onPress={() => sheet.current?.present()}
				>
					<Text className="w-9 text-center text-muted text-title">
						{display.symbol}
					</Text>
					<View className="flex-1 gap-0.5">
						<Text className="font-sans-semibold text-foreground text-headline">
							{code}
						</Text>
						<Text className="text-muted text-subtitle" numberOfLines={1}>
							{display.name}
						</Text>
					</View>
					<MonoLabel>Change</MonoLabel>
				</Pressable>

				<Text className="pt-4 text-footnote text-muted">
					You can change this later in Settings.
				</Text>
			</View>

			<Pressable
				accessibilityRole="button"
				className="items-center rounded-full bg-accent px-7 py-3.5 active:opacity-80 disabled:opacity-50"
				disabled={saving}
				onPress={confirm}
			>
				<Text className="font-sans-semibold text-accent-foreground text-body">
					{saving ? "Saving…" : "Start"}
				</Text>
			</Pressable>

			<CurrencyPickerSheet
				onSelect={(next) => {
					setPicked(next);
					sheet.current?.dismiss();
				}}
				ref={sheet}
				selected={code}
			/>
		</View>
	);
}
