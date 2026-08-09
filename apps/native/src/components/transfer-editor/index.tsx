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
import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { CTA_BOTTOM_PADDING, CTA_HEIGHT } from "@/components/editor-style";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useTransferRates } from "@/data/transfer-rates";
import { lastFeeCategoryId, rememberFeeCategory, transfersRepo } from "@/data/transfers-core";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { marketRateFor, rateTypeOptions } from "@/domain/transfer-rate-options";
import {
	type FeeSide,
	solveTransfer,
	type TransferValues,
	transferGap,
	transferLegs,
} from "@/domain/transfer-reconcile";
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
	const [feeText, setFeeText] = useState("");
	const [feeSide, setFeeSide] = useState<FeeSide>("source");
	const [feeCategoryId, setFeeCategoryId] = useState<string | null>(() => lastFeeCategoryId(db));
	const [customRateText, setCustomRateText] = useState("");
	// The last market type looked at, so `custom` seeds from the rate that was on
	// screen rather than always snapping back to official.
	const [marketType, setMarketType] = useState<EntryRateType>("official");
	const [date, setDate] = useState(() => new Date());
	const noteState = useNativeState("");
	const [saving, setSaving] = useState(false);

	const fromSheet = useRef<BottomSheetModal>(null);
	const toSheet = useRef<BottomSheetModal>(null);
	const sentSheet = useRef<BottomSheetModal>(null);
	const arrivedSheet = useRef<BottomSheetModal>(null);
	const rateSheet = useRef<BottomSheetModal>(null);
	const feeSheet = useRef<BottomSheetModal>(null);
	const feeCategorySheet = useRef<BottomSheetModal>(null);

	const from = accounts.find((account) => account.id === fromId) ?? null;
	const to = accounts.find((account) => account.id === toId) ?? null;
	const fromCurrency = from?.currency ?? "USD";
	const toCurrency = to?.currency ?? "USD";
	const crossCurrency = fromCurrency !== toCurrency;

	const rates = useTransferRates(db, [fromCurrency, toCurrency], rateType === "custom" ? marketType : rateType);
	const marketRate = useMemo(
		() => marketRateFor(fromCurrency, toCurrency, date, rates),
		[fromCurrency, toCurrency, date, rates]
	);
	// Derived rather than copied into state when the type switches: the native
	// Picker holds the first render's `onSelectionChange`, so a `marketRate` read
	// inside it is frozen at whatever the rate was when the screen mounted.
	const customRate = customRateText === "" ? marketRate : numpadToNumber(customRateText);

	function selectedRate(): number | null {
		if (!crossCurrency) {
			return 1;
		}
		return rateType === "custom" ? customRate : marketRate;
	}

	const rate = selectedRate();
	const toDecimals = minorUnitsFor(toCurrency);
	const fromDecimals = minorUnitsFor(fromCurrency);
	const feeDecimals = feeSide === "destination" ? toDecimals : fromDecimals;
	const feeCurrency = feeSide === "destination" ? toCurrency : fromCurrency;
	const fee = numpadToNumber(feeText);

	const sent = numpadToNumber(sentText);
	const shape = { fee, feeSide, rate: rate ?? 0, sent };
	const derivedArrival = solveTransfer({ ...shape, arrived: 0 }, "arrived", toDecimals);
	const arrived = arrivalPinned ? numpadToNumber(arrivedText) : (derivedArrival ?? 0);
	const values: TransferValues = { ...shape, arrived };
	const gapAmount = arrivalPinned ? transferGap(values, toDecimals) : 0;
	const legs = transferLegs(values, fromDecimals, toDecimals);
	const effectiveRate = legs === null ? rate : legs.exchangeRate;

	// The pad opens on the live market rate so a custom rate is an edit rather
	// than a fresh entry, without ever writing that rate into state.
	const customRatePadText =
		customRateText === "" && marketRate !== null ? numberToNumpad(marketRate, RATE_DISPLAY_DECIMALS) : customRateText;

	const options = useMemo(
		() => rateTypeOptions(crossCurrency ? toCurrency : fromCurrency),
		[crossCurrency, toCurrency, fromCurrency]
	);

	const canSave = !saving && from !== null && to !== null && from.id !== to.id && sent > 0 && legs !== null;

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
		if (!(canSave && from && to && effectiveRate && legs)) {
			return;
		}
		setSaving(true);
		try {
			await transfersRepo.create(db, {
				date,
				exchangeRate: effectiveRate,
				exchangeRateType: crossCurrency ? rateType : null,
				fee:
					fee > 0
						? {
								amount: fee,
								categoryId: feeCategoryId,
								note: t("transfers.fee.note", { from: from.name, to: to.name }),
								side: feeSide,
							}
						: undefined,
				fromAccountId: from.id,
				fromAmount: legs.fromAmount,
				fromCurrency,
				note: noteState.value,
				toAccountId: to.id,
				toAmount: legs.toAmount,
				toCurrency,
			});
			if (fee > 0 && feeCategoryId) {
				await rememberFeeCategory(db, feeCategoryId);
			}
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

	// Resolved on the destination side whatever the current one is: the gap is a
	// destination-currency figure, so it lands there exactly. Carrying it to the
	// source means dividing by the rate and rounding to source cents, which
	// leaves a residual gap the user cannot clear. The side stays switchable.
	const resolveAsFee = () => {
		const solved = solveTransfer({ ...values, feeSide: "destination" }, "fee", toDecimals);
		if (solved !== null && solved > 0) {
			setFeeSide("destination");
			setFeeText(numberToNumpad(solved, toDecimals));
		}
	};

	const resolveAsRate = () => {
		const solved = solveTransfer(values, "rate", RATE_DISPLAY_DECIMALS);
		if (solved !== null) {
			setRateType("custom");
			setCustomRateText(numberToNumpad(solved, RATE_DISPLAY_DECIMALS));
			setArrivalPinned(false);
		}
	};

	const gapFee = solveTransfer({ ...values, feeSide: "destination" }, "fee", toDecimals);
	const gapRate = solveTransfer(values, "rate", RATE_DISPLAY_DECIMALS);
	const gap =
		gapAmount === 0 || gapFee === null || gapRate === null
			? null
			: {
					feeLabel: t("transfers.gap.itsAFee"),
					message: t("transfers.gap.unaccounted", { amount: formatAmount(Math.abs(gapAmount), toCurrency) }),
					onFee: resolveAsFee,
					onRate: resolveAsRate,
					rateLabel: t("transfers.gap.rateWas", { rate: formatRate(gapRate) }),
				};

	return (
		<View style={{ backgroundColor: SYSTEM_COLORS.groupedBackground, flex: 1 }}>
			<View style={{ flex: 1, paddingBottom: CTA_HEIGHT + CTA_BOTTOM_PADDING + insets.bottom }}>
				<Host style={{ flex: 1 }}>
					<Form modifiers={[listStyle("insetGrouped"), scrollContentBackground("hidden")]}>
						<TransferEditorSlip
							addFeeLabel={t("transfers.addFee")}
							arrivedLabel={
								crossCurrency ? t("transfers.arrives", { amount: formatAmount(arrived, toCurrency) }) : null
							}
							crossCurrency={crossCurrency}
							dateLabel={t("transfers.field.date")}
							feeLabel={t("transfers.field.fee")}
							feeSide={feeSide}
							feeSideOptions={[
								{ label: t("transfers.fee.source"), value: "source" },
								{ label: t("transfers.fee.destination"), value: "destination" },
							]}
							feeValue={fee > 0 ? formatAmount(fee, feeCurrency) : null}
							fromLabel={t("transfers.field.from")}
							fromName={from?.name ?? t("transfers.selectAccount")}
							gap={gap}
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
							onFeePress={() => present(feeSheet)}
							onFeeSideChange={(side) => {
								setFeeSide(side);
								setArrivalPinned(false);
							}}
							onFromPress={() => present(fromSheet)}
							onRatePress={() => {
								if (rateType === "custom") {
									present(rateSheet);
								}
							}}
							onRateTypeChange={(next) => {
								setRateType(next);
								if (next !== "custom") {
									setMarketType(next);
								}
								setArrivalPinned(false);
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
							warnColor={colors.expense}
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
				code={feeCurrency}
				minorUnits={feeDecimals}
				onChange={(next) => {
					setFeeText(next);
					setArrivalPinned(false);
				}}
				onDone={() => {
					feeSheet.current?.dismiss();
					if (numpadToNumber(feeText) > 0 && !feeCategoryId) {
						feeCategorySheet.current?.present();
					}
				}}
				ref={feeSheet}
				value={feeText}
			/>
			<CategoryPickerSheet
				db={db}
				income={false}
				onSelect={(category) => {
					setFeeCategoryId(category.id);
					feeCategorySheet.current?.dismiss();
				}}
				ref={feeCategorySheet}
				selectedId={feeCategoryId}
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
				value={customRatePadText}
			/>
		</View>
	);
}
