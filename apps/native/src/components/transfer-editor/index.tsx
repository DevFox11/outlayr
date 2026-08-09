import { Host } from "@expo/ui";
import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Form, useNativeState } from "@expo/ui/swift-ui";
import { listStyle, scrollContentBackground } from "@expo/ui/swift-ui/modifiers";
import type { EntryRateType } from "@outlayr/money/rates";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Keyboard, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountPickerSheet } from "@/components/account-picker-sheet";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { CTA_BOTTOM_PADDING, CTA_HEIGHT } from "@/components/editor-style";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useTransferRates } from "@/data/transfer-rates";
import { transfersRepo } from "@/data/transfers-core";
import { formatAmount, minorUnitsFor, roundToMinorUnits } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { marketRateFor, rateTypeOptions } from "@/domain/transfer-rate-options";
import { useTranslation } from "@/i18n/context";
import { SYSTEM_COLORS, useColors } from "@/theme/use-colors";
import { TransferEditorCta } from "./cta";
import { TransferEditorSlip } from "./slip";

const RATE_DISPLAY_DECIMALS = 4;

function formatRate(rate: number | null): string {
	return rate === null ? "—" : rate.toFixed(RATE_DISPLAY_DECIMALS);
}

export default function TransferEditor() {
	const db = useDatabase();
	const router = useRouter();
	const t = useTranslation();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	const accounts = useAccounts(db);

	const [fromId, setFromId] = useState<string | null>(accounts[0]?.id ?? null);
	const [toId, setToId] = useState<string | null>(accounts[1]?.id ?? null);
	const [sentText, setSentText] = useState("");
	const [arrivedText, setArrivedText] = useState("");
	const [arrivalPinned, setArrivalPinned] = useState(false);
	const [rateType, setRateType] = useState<EntryRateType>("official");
	const [customRateText, setCustomRateText] = useState("");
	const [date, setDate] = useState(() => new Date());
	const noteState = useNativeState("");
	const [saving, setSaving] = useState(false);

	const fromSheet = useRef<BottomSheetModal>(null);
	const toSheet = useRef<BottomSheetModal>(null);
	const sentSheet = useRef<BottomSheetModal>(null);
	const arrivedSheet = useRef<BottomSheetModal>(null);
	const rateSheet = useRef<BottomSheetModal>(null);

	const from = accounts.find((account) => account.id === fromId) ?? null;
	const to = accounts.find((account) => account.id === toId) ?? null;
	const fromCurrency = from?.currency ?? "USD";
	const toCurrency = to?.currency ?? "USD";
	const crossCurrency = fromCurrency !== toCurrency;

	const rates = useTransferRates(db, [fromCurrency, toCurrency], rateType);
	const marketRate = useMemo(
		() => marketRateFor(fromCurrency, toCurrency, date, rates),
		[fromCurrency, toCurrency, date, rates]
	);
	const customRate = numpadToNumber(customRateText);

	function selectedRate(): number | null {
		if (!crossCurrency) {
			return 1;
		}
		return rateType === "custom" ? customRate : marketRate;
	}

	const rate = selectedRate();

	const sent = numpadToNumber(sentText);
	const derivedArrival = rate === null || rate <= 0 ? null : roundToMinorUnits(sent * rate, toCurrency);
	const arrived = arrivalPinned ? numpadToNumber(arrivedText) : (derivedArrival ?? 0);
	const effectiveRate = arrivalPinned && sent > 0 ? arrived / sent : rate;

	const options = useMemo(
		() => rateTypeOptions(crossCurrency ? toCurrency : fromCurrency),
		[crossCurrency, toCurrency, fromCurrency]
	);

	const canSave =
		!saving && from !== null && to !== null && from.id !== to.id && sent > 0 && arrived > 0 && effectiveRate !== null;

	const chooseFrom = (account: Account | null) => {
		if (account) {
			if (account.id === toId) {
				setToId(fromId);
			}
			setFromId(account.id);
			setArrivalPinned(false);
		}
		fromSheet.current?.dismiss();
	};

	const chooseTo = (account: Account | null) => {
		if (account) {
			if (account.id === fromId) {
				setFromId(toId);
			}
			setToId(account.id);
			setArrivalPinned(false);
		}
		toSheet.current?.dismiss();
	};

	const swap = () => {
		setFromId(toId);
		setToId(fromId);
		setArrivalPinned(false);
	};

	const save = async () => {
		if (!(canSave && from && to && effectiveRate)) {
			return;
		}
		setSaving(true);
		try {
			await transfersRepo.create(db, {
				date,
				exchangeRate: effectiveRate,
				exchangeRateType: crossCurrency ? rateType : null,
				fromAccountId: from.id,
				fromAmount: sent,
				fromCurrency,
				note: noteState.value,
				toAccountId: to.id,
				toAmount: arrived,
				toCurrency,
			});
			router.back();
		} catch (error) {
			setSaving(false);
			Alert.alert(t("transfers.title"), error instanceof Error ? error.message : String(error));
		}
	};

	const present = (ref: React.RefObject<BottomSheetModal | null>) => {
		Keyboard.dismiss();
		ref.current?.present();
	};

	return (
		<View style={{ backgroundColor: SYSTEM_COLORS.groupedBackground, flex: 1 }}>
			<View style={{ flex: 1, paddingBottom: CTA_HEIGHT + CTA_BOTTOM_PADDING + insets.bottom }}>
				<Host style={{ flex: 1 }}>
					<Form modifiers={[listStyle("insetGrouped"), scrollContentBackground("hidden")]}>
						<TransferEditorSlip
							arrivedLabel={
								crossCurrency ? t("transfers.arrives", { amount: formatAmount(arrived, toCurrency) }) : null
							}
							crossCurrency={crossCurrency}
							dateLabel={t("transfers.field.date")}
							fromLabel={t("transfers.field.from")}
							fromName={from?.name ?? t("transfers.selectAccount")}
							mutedColor={colors.muted}
							noteLabel={t("transfers.field.note")}
							notePlaceholder={t("transfers.notePlaceholder")}
							noteState={noteState}
							onArrivedPress={() => {
								setArrivedText(numberToNumpad(arrived, minorUnitsFor(toCurrency)));
								setArrivalPinned(true);
								present(arrivedSheet);
							}}
							onDateChange={setDate}
							onFromPress={() => present(fromSheet)}
							onRatePress={() => {
								if (rateType === "custom") {
									present(rateSheet);
								}
							}}
							onRateTypeChange={(next) => {
								setRateType(next);
								setArrivalPinned(false);
								if (next === "custom" && customRateText === "") {
									setCustomRateText(numberToNumpad(marketRate ?? 0, RATE_DISPLAY_DECIMALS));
								}
							}}
							onSentPress={() => present(sentSheet)}
							onSwap={swap}
							onToPress={() => present(toSheet)}
							rateLabel={t("transfers.field.rate")}
							rateOptions={options.map((option) => ({
								label: t(`transfers.rate.${option}` as "transfers.rate.official"),
								value: option,
							}))}
							rateType={rateType}
							rateUnit={t("transfers.rate.perUnit", { base: fromCurrency, quote: toCurrency })}
							rateValue={formatRate(effectiveRate)}
							selectedDate={date}
							sentLabel={formatAmount(sent, fromCurrency)}
							swapA11y={t("transfers.a11y.swap")}
							tintColor={colors.foreground}
							toLabel={t("transfers.field.to")}
							toName={to?.name ?? t("transfers.selectAccount")}
						/>
					</Form>
				</Host>
			</View>

			<View style={{ bottom: insets.bottom + CTA_BOTTOM_PADDING, left: 16, position: "absolute", right: 16 }}>
				<TransferEditorCta canSave={canSave} label={t("transfers.save")} onPress={save} tintColor={colors.foreground} />
			</View>

			<AccountPickerSheet
				db={db}
				onCreate={() => router.push("/settings/accounts/create")}
				onSelect={chooseFrom}
				ref={fromSheet}
				selectedId={fromId}
			/>
			<AccountPickerSheet
				db={db}
				onCreate={() => router.push("/settings/accounts/create")}
				onSelect={chooseTo}
				ref={toSheet}
				selectedId={toId}
			/>
			<AmountEntrySheet
				code={fromCurrency}
				minorUnits={minorUnitsFor(fromCurrency)}
				onChange={(next) => {
					setSentText(next);
					setArrivalPinned(false);
				}}
				onDone={() => sentSheet.current?.dismiss()}
				ref={sentSheet}
				value={sentText}
			/>
			<AmountEntrySheet
				code={toCurrency}
				minorUnits={minorUnitsFor(toCurrency)}
				onChange={setArrivedText}
				onDone={() => arrivedSheet.current?.dismiss()}
				ref={arrivedSheet}
				value={arrivedText}
			/>
			<AmountEntrySheet
				code={toCurrency}
				minorUnits={RATE_DISPLAY_DECIMALS}
				onChange={(next) => {
					setCustomRateText(next);
					setArrivalPinned(false);
				}}
				onDone={() => rateSheet.current?.dismiss()}
				ref={rateSheet}
				value={customRateText}
			/>
		</View>
	);
}
