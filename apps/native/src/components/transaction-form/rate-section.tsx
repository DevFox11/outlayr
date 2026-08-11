import { RNHostView } from "@expo/ui/swift-ui";
import type { EntryRateType } from "@outlayr/money/rates";
import { Pressable, View } from "react-native";
import type { TransactionRateSuggestions } from "@/data/transaction-entry-rates";
import { type TransactionEntryRate, transactionRateOptions } from "@/domain/transaction-entry-rate";
import { useColors } from "@/theme/use-colors";
import { Text } from "../text";
import { cn } from "../tw";

export interface TransactionFormRateLabels {
	currentSuggestion: string;
	custom: string;
	editCustom: string;
	eurReference: string;
	official: string;
	pendingBody: string;
	pendingTitle: string;
	perUsd: string;
	priorCustomDate: (date: Date) => string;
	priorCustomSuggestion: string;
	required: string;
	requiredHint: string;
	title: string;
	useSuggestion: string;
}

interface TransactionFormRateSectionProps {
	currency: string;
	error: string | null;
	labels: TransactionFormRateLabels;
	onEditCustom: () => void;
	onSelectType: (type: EntryRateType) => void;
	onUseSuggestion: (rate: number, type: EntryRateType) => void;
	pending: boolean;
	selection: TransactionEntryRate;
	suggestions: TransactionRateSuggestions;
}

const labelFor = (type: EntryRateType, labels: TransactionFormRateLabels): string => {
	if (type === "eur_reference") {
		return labels.eurReference;
	}
	return type === "custom" ? labels.custom : labels.official;
};

function SuggestionButton({
	label,
	rate,
	rateType,
	unit,
	useLabel,
	onPress,
}: {
	label: string;
	onPress: (rate: number, type: EntryRateType) => void;
	rate: number;
	rateType: EntryRateType;
	unit: string;
	useLabel: string;
}) {
	const display = `${rate} ${unit}`;
	return (
		<Pressable
			accessibilityLabel={`${label}. ${useLabel}: ${display}`}
			accessibilityRole="button"
			className="flex-row items-center justify-between gap-3 border-border border-t py-2.5 active:opacity-60"
			onPress={() => onPress(rate, rateType)}
			style={{ minHeight: 44 }}
		>
			<View className="min-w-0 flex-1">
				<Text className="font-mono text-eyebrow text-muted uppercase tracking-eyebrow">{label}</Text>
				<Text className="font-sans-medium text-callout text-foreground">{display}</Text>
			</View>
			<Text className="font-sans-semibold text-income text-subtitle">{useLabel}</Text>
		</Pressable>
	);
}

export function TransactionFormRateSection({
	currency,
	selection,
	suggestions,
	labels,
	error,
	pending,
	onSelectType,
	onUseSuggestion,
	onEditCustom,
}: TransactionFormRateSectionProps) {
	const colors = useColors();
	const options = transactionRateOptions(currency);
	if (options.length === 0) {
		return null;
	}

	return (
		<RNHostView matchContents>
			<View className="gap-3 py-1">
				<View className="flex-row items-center justify-between gap-3">
					<Text className="font-mono text-eyebrow text-muted uppercase tracking-eyebrow">{labels.title}</Text>
					<View className="flex-row flex-wrap justify-end gap-1.5">
						{options.map((type) => {
							const selected = type === selection.exchangeRateType;
							const label = labelFor(type, labels);
							return (
								<Pressable
									accessibilityLabel={label}
									accessibilityRole="button"
									accessibilityState={{ selected }}
									className={cn(
										"rounded-full border px-3 py-1.5 active:opacity-60",
										selected ? "border-income bg-income/10" : "border-border"
									)}
									key={type}
									onPress={() => onSelectType(type)}
									style={{ minHeight: 44 }}
								>
									<Text className={cn("font-sans-semibold text-subtitle", selected ? "text-income" : "text-muted")}>
										{label}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</View>

				{pending ? (
					<View className="gap-1 border-warning border-l-2 py-1 pl-3">
						<Text className="font-sans-semibold text-callout" style={{ color: colors.warning }}>
							{labels.pendingTitle}
						</Text>
						<Text accessibilityLiveRegion="polite" className="text-muted text-subtitle">
							{labels.pendingBody}
						</Text>
					</View>
				) : null}

				{selection.exchangeRateType === "custom" ? (
					<View className="gap-1">
						<Pressable
							accessibilityHint={labels.requiredHint}
							accessibilityLabel={labels.editCustom}
							accessibilityRole="button"
							className="flex-row items-center justify-between border-border border-y py-2.5 active:opacity-60"
							onPress={onEditCustom}
							style={{ minHeight: 44 }}
						>
							<Text className="font-sans-medium text-callout text-foreground">
								{selection.exchangeRate == null ? labels.editCustom : `${selection.exchangeRate} ${labels.perUsd}`}
							</Text>
							<Text className="font-sans-semibold text-income text-subtitle">{labels.editCustom}</Text>
						</Pressable>
						{error ? <Text className="text-danger text-subtitle">{error}</Text> : null}
						{error ? <Text className="text-footnote text-muted">{labels.requiredHint}</Text> : null}
					</View>
				) : null}

				{suggestions.official == null ? null : (
					<SuggestionButton
						label={`${labels.currentSuggestion} · ${labels.official}`}
						onPress={onUseSuggestion}
						rate={suggestions.official}
						rateType="official"
						unit={labels.perUsd}
						useLabel={labels.useSuggestion}
					/>
				)}
				{suggestions.eurReference == null ? null : (
					<SuggestionButton
						label={`${labels.currentSuggestion} · ${labels.eurReference}`}
						onPress={onUseSuggestion}
						rate={suggestions.eurReference}
						rateType="eur_reference"
						unit={labels.perUsd}
						useLabel={labels.useSuggestion}
					/>
				)}
				{suggestions.priorCustom == null ? null : (
					<SuggestionButton
						label={`${labels.priorCustomSuggestion} · ${labels.custom} · ${labels.priorCustomDate(suggestions.priorCustom.date)}`}
						onPress={onUseSuggestion}
						rate={suggestions.priorCustom.rate}
						rateType="custom"
						unit={labels.perUsd}
						useLabel={labels.useSuggestion}
					/>
				)}
			</View>
		</RNHostView>
	);
}
