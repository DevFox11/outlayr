import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { AccessibilityInfo, Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";

import { InlineFailure } from "@/components/form/inline-failure";
import { Text } from "@/components/text";
import { TransactionFormAmountPad } from "@/components/transaction-form/amount-pad";
import { TransactionFormCta } from "@/components/transaction-form/cta";
import { MetaLine } from "@/components/transaction-form/stage/meta-line";
import { TransactionStage } from "@/components/transaction-form/stage/stage";
import { StepAccount } from "@/components/transaction-form/stage/step-account";
import { StepDate } from "@/components/transaction-form/stage/step-date";
import { StepRate } from "@/components/transaction-form/stage/step-rate";
import { StepWhen } from "@/components/transaction-form/stage/step-when";
import { useDisplaySettings, useSettingNumber } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { transfersRepo } from "@/data/transfers-core";
import type { SavedTransfer, TransferInput } from "@/data/transfers-core";
import { formatSignedAmount } from "@/domain/account-display";
import { formatSentenceDate } from "@/domain/dates";
import { formatAmount, numberLocale } from "@/domain/money";
import { applyNumpadKey, numpadMode } from "@/domain/numpad";
import type { NumpadKey, NumpadMode } from "@/domain/numpad";
import { rateAge } from "@/domain/rate-age";
import {
    formatRateFigure,
    pairUnitSymbols,
    quotePairRate,
    RATE_ENTRY_DECIMALS,
    rateEntryText,
} from "@/domain/transaction-entry-rate";
import { quotedByBcv, rateNameKey, rateSourceWordKey, transactionWhenLabel } from "@/domain/transaction-form-labels";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useLanguage, useTranslation } from "@/i18n/context";
import { freshEntries } from "@/lib/fresh-entries";
import { notifySaved } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

import { blockPrompt, formatRate, gapPrompt } from "./prompts";
import { TransferSentence } from "./transfer-sentence";
import type { TransferSentenceSlot } from "./transfer-sentence";
import { useTransferDraft } from "./use-transfer-draft";
import type { TransferSeed } from "./use-transfer-draft";

type Step = Exclude<TransferSentenceSlot, "feeSide"> | "date";

type TransferEditorProps = {
    onDelete?: () => void;
    onDirtyChange?: (dirty: boolean) => void;
    onDone: () => void;
} & ({ saved: SavedTransfer; seed?: never } | { saved?: never; seed?: TransferSeed & { note?: string } });

export default function TransferEditor({ onDelete, onDirtyChange, onDone, saved, seed }: TransferEditorProps) {
    const db = useDatabase();
    const router = useRouter();
    const accountCreateRoute = useAccountCreateRoute();
    const t = useTranslation();
    const { language } = useLanguage();
    const colors = useColors();
    const haptics = useHaptics();
    const entryMode = numpadMode(useSettingNumber("numberEntryType"));
    const { use24Hour } = useDisplaySettings().state;
    const draft = useTransferDraft(db, seed, saved);
    const initialNote = saved?.note ?? seed?.note ?? "";
    const noteRef = useRef(initialNote);
    const [noteFilled, setNoteFilled] = useState(initialNote !== "");
    const savingRef = useRef(false);
    const [saving, setSaving] = useState(false);
    const [saveFailure, setSaveFailure] = useState<string | null>(null);
    const [flagged, setFlagged] = useState<TransferSentenceSlot | null>(null);

    const gap = blockPrompt(draft, t, language) ?? gapPrompt(draft, t, language);

    const missing = () => {
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
        if (draft.block?.kind === "fee") {
            return "fee";
        }
        return !draft.crossCurrency && draft.gapAmount !== 0 ? "arrives" : null;
    };

    const [step, setStep] = useState<Step>(() => missing() ?? "amount");
    const [forward, setForward] = useState(true);
    const [fresh, setFresh] = useState(true);
    const freshRef = useRef(true);

    const enter = (next: Step, direction = true) => {
        if (next === "rate" && draft.rateType !== "custom") {
            draft.setRateType("custom");
        }
        if (next === "arrives") {
            draft.pinArrival();
        }
        Keyboard.dismiss();
        setForward(direction);
        freshRef.current = true;
        setFresh(true);
        setStep(next);
    };

    const touch = () => onDirtyChange?.(true);

    const typed =
        (pad: { minorUnits: number; mode?: NumpadMode; onChange: (text: string) => void; value: string }) =>
        (text: string, key: NumpadKey) => {
            const trimsEntry = freshRef.current && key === "back";
            freshRef.current = false;
            setFresh(false);
            setFlagged(null);
            touch();
            pad.onChange(trimsEntry ? applyNumpadKey(pad.value, "back", pad.minorUnits, pad.mode ?? entryMode) : text);
        };

    const save = async () => {
        const { from, to, legs, effectiveRate, fee, feeSide, crossCurrency, rateType, date } = draft;
        if (!(draft.canSave && from && to && legs && effectiveRate) || savingRef.current) {
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setSaveFailure(null);
        const storedRateType = rateType === "binance" ? "custom" : rateType;
        const input: TransferInput = {
            date,
            exchangeRate: effectiveRate,
            exchangeRateType: crossCurrency ? storedRateType : null,
            fee:
                fee > 0
                    ? {
                          amount: fee,
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
        };
        try {
            if (saved) {
                await transfersRepo.update(db, saved.id, input);
            } else {
                freshEntries.mark(await transfersRepo.create(db, input));
                notifySaved({
                    actionLabel: t("transfers.saved.another"),
                    onActionPress: () => router.push("/transactions/transfers/create"),
                    title: t("transfers.saved.title", {
                        amount: formatAmount(draft.sent, draft.fromCurrency, true, language),
                        to: to.name,
                    }),
                });
            }
            haptics("success");
            onDone();
        } catch (error) {
            console.error("Failed to save the transfer", error);
            haptics("error");
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
        if (draft.canSave) {
            save();
            return;
        }
        const next = missing() ?? "amount";
        haptics("error");
        setFlagged(next);
        const field = next === "from" || next === "to" ? next : "sent";
        const refusal = next === "rate" || next === "fee" || next === "arrives" ? gap?.message : undefined;
        AccessibilityInfo.announceForAccessibility(
            refusal ?? t("transfers.a11y.missing", { field: t(`transfers.field.${field}`) })
        );
        enter(next);
    };

    const resolveGap = (resolve: () => void) => () => {
        touch();
        resolve();
    };

    const onSlotPress = (slot: TransferSentenceSlot) => {
        setFlagged(null);
        if (slot === "feeSide") {
            touch();
            draft.toggleFeeSide();
            return;
        }
        enter(slot);
    };

    const typingRate = step === "rate" && !fresh;
    const rateUnit = t(
        "transaction.rate.unit",
        pairUnitSymbols(draft.fromCurrency, draft.toCurrency, draft.rateInverse)
    );
    const rateFigure = typingRate
        ? draft.customRatePadText.replace(".", numberLocale(language).decimal) || null
        : formatRate(draft, draft.quotedRate, language);
    const rateLabel = rateFigure === null ? null : `${rateFigure} ${rateUnit}`;
    const feeSideAccount = draft.feeSide === "destination" ? draft.to : draft.from;
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
            code: rateUnit,
            label: t("transfers.field.rate"),
            minorUnits: RATE_ENTRY_DECIMALS,
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
                    onChange={typed(pad)}
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
                            touch();
                            (step === "from" ? draft.chooseFrom : draft.chooseTo)(account);
                            enter("amount");
                        }}
                        selectedId={(step === "from" ? draft.from : draft.to)?.id ?? null}
                    />
                );
            }
            if (step === "rateType") {
                return (
                    <StepRate
                        onSelect={(next) => {
                            touch();
                            const prior = draft.priorCustomRate;
                            if (next === "custom" && draft.rateType !== "custom" && prior !== null) {
                                draft.setCustomRate(rateEntryText(quotePairRate(draft.rateInverse, prior.rate)));
                            }
                            draft.setRateType(next);
                            enter(next === "custom" ? "rate" : "amount");
                        }}
                        options={draft.rateOptions.map((type) => {
                            const shared = {
                                name: t(rateNameKey(type, quotedByBcv(draft.fromCurrency, draft.toCurrency))),
                                type,
                                unit: rateUnit,
                            };
                            if (type === "custom") {
                                const prior = draft.priorCustomRate;
                                return {
                                    ...shared,
                                    detail:
                                        prior === null
                                            ? t("transaction.rate.typeHint")
                                            : t("transaction.rate.lastUsed", {
                                                  date: formatSentenceDate(prior.date, language),
                                                  rate: formatRateFigure(
                                                      quotePairRate(draft.rateInverse, prior.rate),
                                                      language
                                                  ),
                                              }),
                                    figure:
                                        draft.rateType === "custom"
                                            ? formatRate(draft, draft.quotedRate, language)
                                            : null,
                                    placeholder: t("transaction.rate.type"),
                                };
                            }
                            const source = draft.rateSources[type];
                            return {
                                ...shared,
                                ...rateAge(t, {
                                    entryDate: draft.date,
                                    fetchedAt: source?.fetchedAt ?? null,
                                    language,
                                    now: new Date(),
                                    rateDate: source?.date ?? null,
                                    use24Hour,
                                }),
                                figure: formatRate(draft, draft.marketRates[type], language),
                                placeholder: t("transaction.rate.unavailable"),
                            };
                        })}
                        selected={draft.rateType}
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
                            touch();
                            draft.setDate(next);
                            enter("amount");
                        }}
                        pickLabel={t("transaction.sentence.when.pick")}
                    />
                );
            }
            return (
                <StepDate
                    date={draft.date}
                    onChange={(next) => {
                        touch();
                        draft.setDate(next);
                    }}
                />
            );
        };
        const titles = {
            date: t("transfers.field.date"),
            from: t("transfers.field.from"),
            rateType: t("transaction.rate.title"),
            to: t("transfers.field.to"),
            when: t("transfers.field.date"),
        } as const;
        const toAmount = () => enter("amount", false);
        return (
            <TransactionStage
                backLabel={t("common.back")}
                footer={step === "rateType" ? { label: t("common.done"), onPress: toAmount, tone: "primary" } : footer}
                forward={forward}
                onBack={toAmount}
                stepKey={step}
                title={titles[step]}
            >
                {body()}
            </TransactionStage>
        );
    };

    const ledger = [
        { account: draft.from, after: draft.fromBalanceAfter, before: draft.fromBalance },
        { account: draft.to, after: draft.toBalanceAfter, before: draft.toBalance },
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
                        customRate={draft.rateType === "custom"}
                        figures={{
                            amount: { amount: draft.sent, code: draft.fromCurrency },
                            arrives:
                                draft.arrived === null ? undefined : { amount: draft.arrived, code: draft.toCurrency },
                            fee: { amount: draft.fee, code: draft.feeCurrency },
                        }}
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
                            feeSide: feeSideAccount?.name ?? null,
                            from: draft.from?.name ?? null,
                            rate: rateLabel,
                            rateType: t(
                                rateSourceWordKey(draft.rateType, quotedByBcv(draft.fromCurrency, draft.toCurrency))
                            ),
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
                                    <Pressable accessibilityRole="button" hitSlop={10} onPress={resolveGap(gap.onFee)}>
                                        <Text className="text-subtitle text-tint font-sans-semibold">
                                            {gap.feeLabel}
                                        </Text>
                                    </Pressable>
                                ) : null}
                                {gap.rateLabel && gap.onRate ? (
                                    <Pressable accessibilityRole="button" hitSlop={10} onPress={resolveGap(gap.onRate)}>
                                        <Text className="text-subtitle text-tint font-sans-semibold">
                                            {gap.rateLabel}
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    <View className="border-separator border-t">
                        {ledger.map(({ account, after, before }) => {
                            if (account === null) {
                                return null;
                            }
                            const balance = formatSignedAmount(before, account.currency, true, language);
                            const next =
                                draft.legs === null || after === before
                                    ? null
                                    : formatSignedAmount(after, account.currency, true, language);
                            return (
                                <View
                                    accessibilityLabel={
                                        next === null
                                            ? t("transfers.a11y.balance", { account: account.name, balance })
                                            : t("transfers.a11y.balanceChange", {
                                                  account: account.name,
                                                  after: next,
                                                  before: balance,
                                              })
                                    }
                                    accessible
                                    className="border-separator flex-row justify-between gap-3 border-b py-2.5"
                                    key={account.id}
                                >
                                    <Text className="text-label text-muted font-mono">{account.name}</Text>
                                    <Text className="text-label text-foreground font-mono">
                                        {next === null ? balance : `${balance} → ${next}`}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    <TextInput
                        accessibilityLabel={noteFilled ? t("transfers.field.note") : undefined}
                        className="text-body text-foreground min-h-12"
                        defaultValue={initialNote}
                        multiline
                        onChangeText={(next) => {
                            noteRef.current = next;
                            setNoteFilled(next !== "");
                            touch();
                        }}
                        placeholder={t("transfers.field.note")}
                        placeholderTextColor={colors.muted}
                        textAlignVertical="top"
                    />
                </ScrollView>
            </View>

            <TransactionFormCta
                deleteLabel={t("transfers.delete.row")}
                deleteTint={colors.danger}
                onDelete={onDelete}
                save={{
                    blockedTint: colors.subtle,
                    busy: saving,
                    label: t("transfers.save"),
                    onPress: onFooter,
                    ready: draft.canSave,
                }}
            />
            <View className="px-5">
                <InlineFailure message={saveFailure} />
            </View>
            {renderStage()}
        </View>
    );
}
