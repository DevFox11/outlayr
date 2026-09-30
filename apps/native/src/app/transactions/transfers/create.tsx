import { isPickableCurrency } from "@outlayr/money/currency";
import { Stack, useLocalSearchParams } from "expo-router";

import { CloseToolbar } from "@/components/close-toolbar";
import TransferEditor from "@/components/transfer-editor";
import { AMOUNT_CEILING } from "@/domain/numpad";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { useTranslation } from "@/i18n/context";

export default function TransferCreateScreen() {
    const { leave, setDirty } = useDiscardGuard();
    const t = useTranslation();
    // Set only by the voice screen, for a spoken transfer it could not write
    // itself (a cross-currency move, or an account it did not resolve).
    const params = useLocalSearchParams<{
        amount?: string;
        /** The currency `amount` was spoken in; see `TransferSeed`. */
        currency?: string;
        /** Epoch milliseconds. */
        date?: string;
        fromAccountId?: string;
        /** "1" when the voice draft named a source the ledger could not place. */
        fromUnresolved?: string;
        note?: string;
        toAccountId?: string;
        /** Likewise for the destination. */
        toUnresolved?: string;
    }>();
    const amount = Number(params.amount);
    const date = new Date(Number(params.date));
    const currencyKnown = params.currency === undefined || isPickableCurrency(params.currency);
    const seed = {
        amount: currencyKnown && amount > 0 && amount < AMOUNT_CEILING ? amount : undefined,
        currency: currencyKnown ? params.currency : undefined,
        date: date.getTime() > 0 ? date : undefined,
        fromAccountId: params.fromAccountId,
        fromUnresolved: params.fromUnresolved === "1",
        note: params.note,
        toAccountId: params.toAccountId,
        toUnresolved: params.toUnresolved === "1",
    };

    return (
        <>
            <Stack.Screen.Title>{t("transfers.title")}</Stack.Screen.Title>
            <CloseToolbar placement="right" />

            <TransferEditor onDirtyChange={setDirty} onDone={leave} seed={seed} />
        </>
    );
}
