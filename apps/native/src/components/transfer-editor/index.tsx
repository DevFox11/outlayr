import { Host } from "@expo/ui";
import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { ScrollView, Text as SwiftText, useNativeState, VStack } from "@expo/ui/swift-ui";
import {
    font,
    foregroundStyle,
    kerning,
    overlay,
    padding,
    scrollDismissesKeyboard,
    textCase,
} from "@expo/ui/swift-ui/modifiers";
import { useNavigation, useRouter } from "expo-router";
import { Button } from "panelui-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountPickerSheet } from "@/components/account-picker-sheet";
import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { CTA_BOTTOM_PADDING, CTA_HEIGHT } from "@/components/editor-style";
import { useDatabase } from "@/contexts/local-data-context";
import { rememberFeeCategory, transfersRepo } from "@/data/transfers-core";
import { formatSignedAmount } from "@/domain/account-display";
import { currencySymbol, formatAmount } from "@/domain/money";
import { numpadToNumber } from "@/domain/numpad";
import { useLanguage, useTranslation } from "@/i18n/context";
import { LARGE_ONLY, TRANSFER_DETENT } from "@/lib/sheet-detents";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

import { TransferEditorAmountPad } from "./amount-pad";
import { TransferEditorDetailsCard } from "./details-card";
import { TransferEditorHero } from "./hero";
import { blockPrompt, formatRate, gapPrompt } from "./prompts";
import { TransferEditorSlip } from "./slip";
import { RATE_DISPLAY_DECIMALS, useTransferDraft } from "./use-transfer-draft";

const KICKER = font({ family: "GeistMono-Regular", size: 11, textStyle: "caption2" });

export default function TransferEditor({ onDone }: { onDone: () => void }) {
    const db = useDatabase();
    const router = useRouter();
    const navigation = useNavigation();
    const t = useTranslation();
    const { language } = useLanguage();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const contentWidth = windowWidth - 40;
    const draft = useTransferDraft(db);
    const noteState = useNativeState("");
    const [saving, setSaving] = useState(false);

    const fromSheet = useRef<BottomSheetModal>(null);
    const toSheet = useRef<BottomSheetModal>(null);
    const [pad, setPad] = useState<"arrived" | "fee" | "rate" | "sent" | null>(null);
    const [listOpen, setListOpen] = useState(false);
    const feeCategorySheet = useRef<BottomSheetModal>(null);

    const present = (ref: React.RefObject<BottomSheetModal | null>) => {
        Keyboard.dismiss();
        setListOpen(true);
        ref.current?.present();
    };

    const anyPickerOpen = pad !== null || listOpen;

    const [typing, setTyping] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener("keyboardWillShow", () => setTyping(true));
        const hide = Keyboard.addListener("keyboardWillHide", () => setTyping(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    const ctaHidden = anyPickerOpen || typing;

    useEffect(() => {
        navigation.setOptions({
            sheetAllowedDetents: anyPickerOpen ? LARGE_ONLY : [TRANSFER_DETENT, 1],
        });
    }, [navigation, anyPickerOpen]);

    const openPad = (next: "arrived" | "fee" | "rate" | "sent") => {
        Keyboard.dismiss();
        setPad(next);
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
            onDone();
        } catch (error) {
            setSaving(false);
            Alert.alert(t("transfers.title"), error instanceof Error ? error.message : String(error));
        }
    };

    const gap = blockPrompt(draft, t) ?? gapPrompt(draft, t);

    const chooseLabel = t("transfers.selectAccount");

    return (
        <View style={{ backgroundColor: colors.background, flex: 1 }}>
            <Host style={{ flex: 1 }}>
                <ScrollView modifiers={[scrollDismissesKeyboard("immediately")]}>
                    <VStack
                        modifiers={[
                            padding({
                                bottom: CTA_HEIGHT + CTA_BOTTOM_PADDING + insets.bottom + 24,
                                horizontal: 20,
                                top: 6,
                            }),
                        ]}
                        spacing={16}
                    >
                        <TransferEditorHero
                            arrivedA11y={t("transfers.a11y.editArrival")}
                            arrivedLabel={
                                draft.crossCurrency && draft.arrived !== null
                                    ? t("transfers.arrives", {
                                          amount: formatAmount(draft.arrived, draft.toCurrency, true, language),
                                      })
                                    : null
                            }
                            chipColor={withAlpha(colors.transfer, 0.12)}
                            contentWidth={contentWidth}
                            minorUnits={draft.fromDecimals}
                            mutedColor={colors.muted}
                            onArrivedPress={() => {
                                draft.pinArrival();
                                openPad("arrived");
                            }}
                            onRateTypeChange={draft.setRateType}
                            onSentPress={() => openPad("sent")}
                            rateOptions={draft.rateOptions.map((option) => ({
                                // SAFETY: every `rateOptions` member has a `transfers.rate.*` entry; the
                                // literal names one of them so the template resolves to a real key.
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
                            <SwiftText
                                modifiers={[KICKER, kerning(1.2), textCase("uppercase"), foregroundStyle(colors.muted)]}
                            >
                                {t("transfers.movement")}
                            </SwiftText>
                            <VStack spacing={0}>
                                <TransferEditorSlip
                                    addFeeLabel={t("transfers.addFee")}
                                    cardColor={colors.background}
                                    feeFill={withAlpha(colors.foreground, 0.07)}
                                    feeSideLabel={t(
                                        draft.feeSide === "destination"
                                            ? "transfers.fee.destination"
                                            : "transfers.fee.source"
                                    )}
                                    feeValue={
                                        draft.fee > 0
                                            ? formatAmount(draft.fee, draft.feeCurrency, true, language)
                                            : null
                                    }
                                    from={{
                                        balance: formatSignedAmount(
                                            draft.fromBalance,
                                            draft.fromCurrency,
                                            true,
                                            language
                                        ),
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
                                    onFeePress={() => openPad("fee")}
                                    onFeeSideToggle={draft.toggleFeeSide}
                                    onRatePress={() => {
                                        if (draft.rateType === "custom") {
                                            openPad("rate");
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
                                        balance: formatSignedAmount(draft.toBalance, draft.toCurrency, true, language),
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
                    </VStack>
                </ScrollView>
            </Host>

            {/* Pinned to the container's bottom, which a presented picker shrinks —
			    left mounted it lands mid-screen across the slip. */}
            <View
                pointerEvents={ctaHidden ? "none" : "auto"}
                style={{
                    bottom: insets.bottom + CTA_BOTTOM_PADDING,
                    left: 20,
                    opacity: ctaHidden ? 0 : 1,
                    position: "absolute",
                    right: 20,
                }}
            >
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

            <AccountPickerSheet
                allowNone={false}
                db={db}
                onCreate={() => router.push("/settings/accounts/create")}
                onDismiss={() => setListOpen(false)}
                onSelect={(account) => {
                    draft.chooseFrom(account);
                    fromSheet.current?.dismiss();
                }}
                ref={fromSheet}
                selectedId={draft.from?.id ?? null}
            />
            <AccountPickerSheet
                allowNone={false}
                db={db}
                onCreate={() => router.push("/settings/accounts/create")}
                onDismiss={() => setListOpen(false)}
                onSelect={(account) => {
                    draft.chooseTo(account);
                    toSheet.current?.dismiss();
                }}
                ref={toSheet}
                selectedId={draft.to?.id ?? null}
            />
            <TransferEditorAmountPad
                code={draft.fromCurrency}
                minorUnits={draft.fromDecimals}
                onChange={draft.setSent}
                onOpenChange={(next) => !next && setPad(null)}
                open={pad === "sent"}
                value={draft.sentText}
            />
            <TransferEditorAmountPad
                code={draft.toCurrency}
                minorUnits={draft.toDecimals}
                onChange={draft.setArrived}
                onOpenChange={(next) => !next && setPad(null)}
                open={pad === "arrived"}
                value={draft.arrivedText}
            />
            <TransferEditorAmountPad
                code={draft.toCurrency}
                minorUnits={RATE_DISPLAY_DECIMALS}
                mode="explicitSeparator"
                onChange={draft.setCustomRate}
                onOpenChange={(next) => !next && setPad(null)}
                open={pad === "rate"}
                value={draft.customRatePadText}
            />
            <TransferEditorAmountPad
                code={draft.feeCurrency}
                minorUnits={draft.feeDecimals}
                onChange={draft.setFee}
                onOpenChange={(next) => {
                    if (next) {
                        return;
                    }
                    setPad(null);
                    if (numpadToNumber(draft.feeText) > 0 && !draft.feeCategoryId) {
                        setListOpen(true);
                        feeCategorySheet.current?.present();
                    }
                }}
                open={pad === "fee"}
                value={draft.feeText}
            />
            <CategoryPickerSheet
                db={db}
                income={false}
                onDismiss={() => setListOpen(false)}
                onSelect={(category) => {
                    draft.setFeeCategoryId(category.id);
                    feeCategorySheet.current?.dismiss();
                }}
                ref={feeCategorySheet}
                selectedId={draft.feeCategoryId}
            />
        </View>
    );
}
