import { Host } from "@expo/ui";
import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { RNHostView, Text as SwiftText, useNativeState, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, kerning, overlay, padding, textCase } from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { Button } from "panelui-native";
import { useRef, useState } from "react";
import { Alert, Keyboard, useWindowDimensions, View } from "react-native";

import { AccountPickerSheet } from "@/components/account-picker-sheet";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { useDatabase } from "@/contexts/local-data-context";
import { rememberFeeCategory, transfersRepo } from "@/data/transfers-core";
import { formatSignedAmount } from "@/domain/account-display";
import { currencySymbol, formatAmount } from "@/domain/money";
import { numpadToNumber } from "@/domain/numpad";
import { useTranslation } from "@/i18n/context";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { TransferEditorDetailsCard } from "./details-card";
import { TransferEditorHero } from "./hero";
import { TransferEditorSlip } from "./slip";
import { RATE_DISPLAY_DECIMALS, useTransferDraft } from "./use-transfer-draft";

const CTA_GAP = 16;
const CTA_BLOCK_HEIGHT = CTA_GAP + 44;

const KICKER = font({ family: "GeistMono-Regular", size: 11, textStyle: "caption2" });

function formatRate(rate: number | null): string {
	return rate === null ? "—" : rate.toFixed(RATE_DISPLAY_DECIMALS);
}

export default function TransferEditor() {
	const db = useDatabase();
	const router = useRouter();
	const t = useTranslation();
	const colors = useColors();
	const { width: windowWidth } = useWindowDimensions();
	const contentWidth = windowWidth - 40;
	const draft = useTransferDraft(db);
	const noteState = useNativeState("");
	const [saving, setSaving] = useState(false);

	const fromSheet = useRef<BottomSheetModal>(null);
	const toSheet = useRef<BottomSheetModal>(null);
	const sentSheet = useRef<BottomSheetModal>(null);
	const arrivedSheet = useRef<BottomSheetModal>(null);
	const rateSheet = useRef<BottomSheetModal>(null);
	const feeSheet = useRef<BottomSheetModal>(null);
	const feeCategorySheet = useRef<BottomSheetModal>(null);

	const present = (ref: React.RefObject<BottomSheetModal | null>) => {
		Keyboard.dismiss();
		ref.current?.present();
	};

	const save = async () => {
		const { from, to, legs, effectiveRate, fee, feeSide, feeCategoryId, crossCurrency, rateType, date } = draft;
		if (!(draft.canSave && from && to && legs && effectiveRate) || saving) {
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
				fromCurrency: draft.fromCurrency,
				note: noteState.value,
				toAccountId: to.id,
				toAmount: legs.toAmount,
				toCurrency: draft.toCurrency,
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

	const gap =
		draft.gapAmount === 0 || draft.gapFee === null || draft.gapRate === null
			? null
			: {
					feeLabel: t("transfers.gap.itsAFee"),
					message: t("transfers.gap.unaccounted", {
						amount: formatAmount(Math.abs(draft.gapAmount), draft.toCurrency),
					}),
					onFee: draft.resolveAsFee,
					onRate: draft.resolveAsRate,
					rateLabel: t("transfers.gap.rateWas", { rate: formatRate(draft.gapRate) }),
				};

	const chooseLabel = t("transfers.selectAccount");

	return (
		<View className="pt-safe" style={{ backgroundColor: colors.background }}>
			<Host matchContents>
				<VStack modifiers={[padding({ horizontal: 20 })]} spacing={16}>
					<TransferEditorHero
						arrivedA11y={t("transfers.a11y.editArrival")}
						arrivedLabel={
							draft.crossCurrency
								? t("transfers.arrives", { amount: formatAmount(draft.arrived, draft.toCurrency) })
								: null
						}
						chipColor={withAlpha(colors.transfer, 0.12)}
						contentWidth={contentWidth}
						minorUnits={draft.fromDecimals}
						mutedColor={colors.muted}
						onArrivedPress={() => {
							draft.pinArrival();
							present(arrivedSheet);
						}}
						onRateTypeChange={draft.setRateType}
						onSentPress={() => present(sentSheet)}
						rateOptions={draft.rateOptions.map((option) => ({
							label: t(`transfers.rate.${option}` as "transfers.rate.official"),
							value: option,
						}))}
						rateType={draft.rateType}
						sent={draft.sent}
						symbol={currencySymbol(draft.fromCurrency)}
						tintColor={colors.foreground}
						transferColor={colors.transfer}
					/>

					<VStack alignment="leading" spacing={7}>
						<SwiftText modifiers={[KICKER, kerning(1.2), textCase("uppercase"), foregroundStyle(colors.muted)]}>
							{t("transfers.movement")}
						</SwiftText>
						<VStack spacing={0}>
							<TransferEditorSlip
								addFeeLabel={t("transfers.addFee")}
								cardColor={colors.background}
								feeFill={withAlpha(colors.foreground, 0.07)}
								feeSideLabel={t(draft.feeSide === "destination" ? "transfers.fee.destination" : "transfers.fee.source")}
								feeValue={draft.fee > 0 ? formatAmount(draft.fee, draft.feeCurrency) : null}
								from={{
									balance: formatSignedAmount(draft.fromBalance, draft.fromCurrency),
									currency: draft.fromCurrency,
									emoji: draft.from?.emoji ?? null,
									kicker: t("transfers.field.from"),
									name: draft.from?.name ?? chooseLabel,
									onPress: () => present(fromSheet),
									tint: colors.foreground,
								}}
								gap={gap}
								mutedColor={colors.muted}
								mutedFill={withAlpha(colors.foreground, 0.05)}
								onFeePress={() => present(feeSheet)}
								onFeeSideToggle={draft.toggleFeeSide}
								onRatePress={() => {
									if (draft.rateType === "custom") {
										present(rateSheet);
									}
								}}
								onSwap={draft.swap}
								rateValue={
									draft.crossCurrency
										? `${formatRate(draft.effectiveRate)} ${draft.toCurrency}/${draft.fromCurrency}`
										: null
								}
								showRate={draft.crossCurrency}
								stemColor={withAlpha(colors.transfer, 0.35)}
								surfaceColor={colors.surface}
								swapA11y={t("transfers.a11y.swap")}
								tintColor={colors.foreground}
								to={{
									balance: formatSignedAmount(draft.toBalance, draft.toCurrency),
									currency: draft.toCurrency,
									emoji: draft.to?.emoji ?? null,
									kicker: t("transfers.field.to"),
									name: draft.to?.name ?? chooseLabel,
									onPress: () => present(toSheet),
									tint: colors.foreground,
								}}
								transferColor={colors.transfer}
								warnColor={colors.overBudget}
							/>
						</VStack>
					</VStack>

					<TransferEditorDetailsCard
						dateLabel={t("transfers.field.date")}
						hairline={[overlay({ color: withAlpha(colors.foreground, 0.08) })]}
						mutedColor={colors.muted}
						noteLabel={t("transfers.field.note")}
						notePlaceholder={t("transfers.notePlaceholder")}
						noteState={noteState}
						onDateChange={draft.setDate}
						selectedDate={draft.date}
						tintColor={colors.foreground}
					/>

					<RNHostView matchContents>
						<View style={{ height: CTA_BLOCK_HEIGHT, paddingTop: CTA_GAP, width: contentWidth }}>
							<Button
								className="rounded-full"
								disabled={!(draft.canSave && !saving)}
								fullWidth
								onPress={save}
								size="md"
								variant="primary"
							>
								{t("transfers.save")}
							</Button>
						</View>
					</RNHostView>
				</VStack>
			</Host>

			<AccountPickerSheet
				db={db}
				onCreate={() => router.push("/settings/accounts/create")}
				onSelect={(account) => {
					draft.chooseFrom(account);
					fromSheet.current?.dismiss();
				}}
				ref={fromSheet}
				selectedId={draft.from?.id ?? null}
			/>
			<AccountPickerSheet
				db={db}
				onCreate={() => router.push("/settings/accounts/create")}
				onSelect={(account) => {
					draft.chooseTo(account);
					toSheet.current?.dismiss();
				}}
				ref={toSheet}
				selectedId={draft.to?.id ?? null}
			/>
			<AmountEntrySheet
				code={draft.fromCurrency}
				minorUnits={draft.fromDecimals}
				onChange={draft.setSent}
				onDone={() => sentSheet.current?.dismiss()}
				ref={sentSheet}
				value={draft.sentText}
			/>
			<AmountEntrySheet
				code={draft.toCurrency}
				minorUnits={draft.toDecimals}
				onChange={draft.setArrived}
				onDone={() => arrivedSheet.current?.dismiss()}
				ref={arrivedSheet}
				value={draft.arrivedText}
			/>
			<AmountEntrySheet
				code={draft.feeCurrency}
				minorUnits={draft.feeDecimals}
				onChange={draft.setFee}
				onDone={() => {
					feeSheet.current?.dismiss();
					if (numpadToNumber(draft.feeText) > 0 && !draft.feeCategoryId) {
						feeCategorySheet.current?.present();
					}
				}}
				ref={feeSheet}
				value={draft.feeText}
			/>
			<CategoryPickerSheet
				db={db}
				income={false}
				onSelect={(category) => {
					draft.setFeeCategoryId(category.id);
					feeCategorySheet.current?.dismiss();
				}}
				ref={feeCategorySheet}
				selectedId={draft.feeCategoryId}
			/>
			<AmountEntrySheet
				code={draft.toCurrency}
				minorUnits={RATE_DISPLAY_DECIMALS}
				onChange={draft.setCustomRate}
				onDone={() => rateSheet.current?.dismiss()}
				ref={rateSheet}
				value={draft.customRatePadText}
			/>
		</View>
	);
}
