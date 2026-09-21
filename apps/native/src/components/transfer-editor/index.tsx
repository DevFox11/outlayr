import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";

import { InlineFailure } from "@/components/form/inline-failure";
import { Text } from "@/components/text";
import { TransactionFormAmountPad } from "@/components/transaction-form/amount-pad";
import { MetaLine } from "@/components/transaction-form/stage/meta-line";
import { TransactionStage } from "@/components/transaction-form/stage/stage";
import { StageOptionRow } from "@/components/transaction-form/stage/stage-options";
import { StepAccount } from "@/components/transaction-form/stage/step-account";
import { StepCategory } from "@/components/transaction-form/stage/step-category";
import { StepDate } from "@/components/transaction-form/stage/step-date";
import { StepWhen } from "@/components/transaction-form/stage/step-when";
import { useDatabase } from "@/contexts/local-data-context";
import { useCategoriesByNamespace } from "@/data/categories";
import { rememberFeeCategory, transfersRepo } from "@/data/transfers-core";
import { formatSignedAmount } from "@/domain/account-display";
import { formatAmount, numberLocale } from "@/domain/money";
import { transactionWhenLabel } from "@/domain/transaction-form-labels";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { blockPrompt, formatRate, gapPrompt } from "./prompts";
import { TransferSentence } from "./transfer-sentence";
import type { TransferSentenceSlot } from "./transfer-sentence";
import { RATE_DISPLAY_DECIMALS, useTransferDraft } from "./use-transfer-draft";
import type { TransferSeed } from "./use-transfer-draft";

type Step = Exclude<TransferSentenceSlot, "feeSide"> | "date";

interface TransferEditorProps {
    onDone: () => void;
    seed?: TransferSeed & { note?: string };
}

export default function TransferEditor({ onDone, seed }: TransferEditorProps) {
    const db = useDatabase();
    const router = useRouter();
    const accountCreateRoute = useAccountCreateRoute();
    const t = useTranslation();
    const { language } = useLanguage();
    const colors = useColors();
    const draft = useTransferDraft(db, seed);
    const categories = useCategoriesByNamespace(db, false);
    const noteRef = useRef(seed?.note ?? "");
    const savingRef = useRef(false);
    const [saving, setSaving] = useState(false);
    const [saveFailure, setSaveFailure] = useState<string | null>(null);
    const [flagged, setFlagged] = useState<TransferSentenceSlot | null>(null);

    const missing = (): Step | null => {
        if (draft.from === null) {
            return "from";
        }
        if (draft.to === null || draft.to.id === draft.from.id) {
            return "to";
        }
        if (draft.sent <= 0) {
            return "amount";
        }
        if (draft.block?.kind === "rate") {
            return "rate";
        }
        return draft.block?.kind === "fee" ? "fee" : null;
    };

    const [step, setStep] = useState<Step>(() => missing() ?? "amount");
    const [forward, setForward] = useState(true);
    const [fresh, setFresh] = useState(true);

    const enter = (next: Step, direction = true) => {
        if (next === "rate" && draft.rateType !== "custom") {
            draft.setRateType("custom");
        }
        if (next === "arrives") {
            draft.pinArrival();
        }
        Keyboard.dismiss();
        setForward(direction);
        setFresh(true);
        setStep(next);
    };

    const typed = (apply: (text: string) => void) => (text: string) => {
        setFresh(false);
        setFlagged(null);
        apply(text);
    };

    const save = async () => {
        const { from, to, legs, effectiveRate, fee, feeSide, feeCategoryId, crossCurrency, rateType, date } = draft;
        if (!(draft.canSave && from && to && legs && effectiveRate) || savingRef.current) {
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setSaveFailure(null);
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
                note: noteRef.current,
                toAccountId: to.id,
                toAmount: legs.toAmount,
                toCurrency: draft.toCurrency,
            });
            if (fee > 0 && feeCategoryId) {
                await rememberFeeCategory(db, feeCategoryId).catch((error) => {
                    console.error("Failed to remember the fee category", error);
                });
            }
            onDone();
        } catch (error) {
            console.error("Failed to save the transfer", error);
            savingRef.current = false;
            setSaving(false);
            setSaveFailure(t("transfers.save.failed"));
        }
    };

    const onFooter = () => {
        if ((step === "from" || step === "to") && draft.accounts.length === 0) {
            router.push(accountCreateRoute);
            return;
        }
        if (step === "fee" && draft.fee > 0 && !draft.feeCategoryId) {
            enter("feeCategory");
            return;
        }
        if (draft.canSave) {
            save();
            return;
        }
        const next = missing() ?? "amount";
        setFlagged(next === "date" ? "when" : next);
        enter(next);
    };

    const onSlotPress = (slot: TransferSentenceSlot) => {
        setFlagged(null);
        if (slot === "feeSide") {
            draft.toggleFeeSide();
            return;
        }
        enter(slot);
    };

    const feeCategoryName =
        categories
            .flatMap((parent) => [parent, ...parent.children])
            .find((category) => category.id === draft.feeCategoryId)?.name ?? null;
    const typingRate = step === "rate" && !fresh;
    const quoted = draft.quotedRate === null ? null : formatRate(draft.quotedRate);
    const rateLabel = typingRate ? draft.customRatePadText.replace(".", numberLocale().decimal) || null : quoted;
    const feeSideAccount = draft.feeSide === "destination" ? draft.to : draft.from;
    const pairCode = `${draft.toCurrency}/${draft.fromCurrency}`;
    const gap = blockPrompt(draft, t) ?? gapPrompt(draft, t);
    const footer = {
        label: draft.canSave ? t("transfers.save") : t("common.next"),
        onPress: onFooter,
        tone: draft.canSave && !saving ? "primary" : "muted",
    } as const;
    const back = step === "amount" ? {} : { backLabel: t("common.back"), onBack: () => enter("amount", false) };

    const pads = {
        amount: {
            code: draft.fromCurrency,
            label: t("transfers.field.sent"),
            minorUnits: draft.fromDecimals,
            onChange: draft.setSent,
            value: draft.sentText,
        },
        arrives: {
            code: draft.toCurrency,
            label: t("transfers.field.arrives"),
            minorUnits: draft.toDecimals,
            onChange: draft.setArrived,
            value: draft.arrivedText,
        },
        fee: {
            code: draft.feeCurrency,
            label: t("transfers.field.fee"),
            minorUnits: draft.feeDecimals,
            onChange: draft.setFee,
            value: draft.feeText,
        },
        rate: {
            code: pairCode,
            label: t("transfers.field.rate"),
            minorUnits: RATE_DISPLAY_DECIMALS,
            mode: "explicitSeparator",
            onChange: draft.setCustomRate,
            value: draft.customRatePadText,
        },
    } as const;

    const renderStage = () => {
        if (step === "amount" || step === "arrives" || step === "fee" || step === "rate") {
            const pad = pads[step];
            return (
                <TransactionFormAmountPad
                    {...pad}
                    {...back}
                    footer={footer}
                    forward={forward}
                    onChange={typed(pad.onChange)}
                    stepKey={step}
                    value={fresh ? "" : pad.value}
                />
            );
        }
        const body = () => {
            if (step === "from" || step === "to") {
                return (
                    <StepAccount
                        accounts={draft.accounts}
                        allowNone={false}
                        onSelect={(account) => {
                            (step === "from" ? draft.chooseFrom : draft.chooseTo)(account);
                            enter("amount");
                        }}
                        selectedId={(step === "from" ? draft.from : draft.to)?.id ?? null}
                    />
                );
            }
            if (step === "rateType") {
                return (
                    <StageOptionRow
                        onSelect={(next) => {
                            draft.setRateType(next);
                            enter(next === "custom" ? "rate" : "amount");
                        }}
                        options={draft.rateOptions.map((option) => ({
                            id: option,
                            // SAFETY: every `rateOptions` member has a `transfers.rate.*` entry.
                            label: t(`transfers.rate.${option}` as "transfers.rate.official"),
                        }))}
                        selectedId={draft.rateType}
                    />
                );
            }
            if (step === "feeCategory") {
                return (
                    <StepCategory
                        categories={categories}
                        onSelect={(category) => {
                            draft.setFeeCategoryId(category.id);
                            enter("amount");
                        }}
                        selectedId={draft.feeCategoryId}
                    />
                );
            }
            if (step === "when") {
                return (
                    <StepWhen
                        date={draft.date}
                        now={new Date()}
                        onPick={() => enter("date")}
                        onSelect={(next) => {
                            draft.setDate(next);
                            enter("amount");
                        }}
                        pickLabel={t("transaction.sentence.when.pick")}
                    />
                );
            }
            return <StepDate date={draft.date} onChange={draft.setDate} />;
        };
        const titles = {
            date: t("transfers.field.date"),
            feeCategory: t("transfers.field.feeCategory"),
            from: t("transfers.field.from"),
            rateType: t("transfers.field.rateType"),
            to: t("transfers.field.to"),
            when: t("transfers.field.date"),
        } as const;
        return (
            <TransactionStage
                backLabel={t("common.back")}
                footer={footer}
                forward={forward}
                onBack={() => enter("amount", false)}
                stepKey={step}
                title={titles[step]}
            >
                {body()}
            </TransactionStage>
        );
    };

    const ledger = [
        { account: draft.from, after: draft.fromBalance - draft.sent, before: draft.fromBalance },
        { account: draft.to, after: draft.toBalance + (draft.arrived ?? 0), before: draft.toBalance },
    ];

    return (
        <View className="bg-background flex-1" collapsable={false}>
            {/* react-native-screens resizes a ScrollView on a formSheet's first-child chain to the whole sheet. */}
            <View collapsable={false} />
            <View className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-4 px-5 pt-2 pb-10"
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                >
                    <TransferSentence
                        activeSlot={step === "date" ? "when" : step}
                        crossCurrency={draft.crossCurrency}
                        flaggedSlot={flagged}
                        hasFee={draft.fee > 0}
                        onSlotPress={onSlotPress}
                        values={{
                            amount:
                                draft.sent > 0 ? formatAmount(draft.sent, draft.fromCurrency, true, language) : null,
                            arrives:
                                draft.arrived !== null && draft.arrived > 0
                                    ? formatAmount(draft.arrived, draft.toCurrency, true, language)
                                    : null,
                            fee: draft.fee > 0 ? formatAmount(draft.fee, draft.feeCurrency, true, language) : null,
                            feeCategory: feeCategoryName,
                            feeSide: feeSideAccount?.name ?? null,
                            from: draft.from?.name ?? null,
                            rate: rateLabel,
                            // SAFETY: every `rateOptions` member has a `transfers.rate.*` entry.
                            rateType: t(`transfers.rate.${draft.rateType}` as "transfers.rate.official"),
                            to: draft.to?.name ?? null,
                            when: transactionWhenLabel(t, {
                                date: draft.date,
                                interval: null,
                                language,
                                now: new Date(),
                            }),
                        }}
                    />

                    {gap ? (
                        <View className="gap-2">
                            <MetaLine statement={gap.message} tone={draft.block === null ? "warning" : "danger"} />
                            <View className="flex-row flex-wrap gap-x-5 gap-y-2">
                                {gap.feeLabel && gap.onFee ? (
                                    <Pressable
                                        accessibilityRole="button"
                                        hitSlop={10}
                                        onPress={() => {
                                            gap.onFee?.();
                                            if (!draft.feeCategoryId) {
                                                enter("feeCategory");
                                            }
                                        }}
                                    >
                                        <Text className="text-subtitle text-tint font-sans-semibold">
                                            {gap.feeLabel}
                                        </Text>
                                    </Pressable>
                                ) : null}
                                {gap.rateLabel && gap.onRate ? (
                                    <Pressable accessibilityRole="button" hitSlop={10} onPress={gap.onRate}>
                                        <Text className="text-subtitle text-tint font-sans-semibold">
                                            {gap.rateLabel}
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    <View className="border-separator border-t">
                        {ledger.map(({ account, after, before }) =>
                            account ? (
                                <View
                                    className="border-separator flex-row justify-between gap-3 border-b py-2.5"
                                    key={account.id}
                                >
                                    <Text className="text-label text-muted font-mono">{account.name}</Text>
                                    <Text className="text-label text-foreground font-mono">
                                        {after === before
                                            ? formatSignedAmount(before, account.currency, true, language)
                                            : `${formatSignedAmount(before, account.currency, true, language)} → ${formatSignedAmount(after, account.currency, true, language)}`}
                                    </Text>
                                </View>
                            ) : null
                        )}
                    </View>

                    <TextInput
                        accessibilityLabel={t("transfers.field.note")}
                        className="text-body text-foreground min-h-12"
                        defaultValue={seed?.note ?? ""}
                        multiline
                        onChangeText={(next) => {
                            noteRef.current = next;
                        }}
                        placeholder={t("transfers.field.note")}
                        placeholderTextColor={colors.muted}
                        textAlignVertical="top"
                    />
                </ScrollView>
            </View>

            <View className="px-5">
                <InlineFailure message={saveFailure} />
            </View>
            {renderStage()}
        </View>
    );
}
