import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { CloseToolbar } from "@/components/close-toolbar";
import TransferEditor from "@/components/transfer-editor";
import { useTranslation } from "@/i18n/context";

export default function TransferCreateScreen() {
    const router = useRouter();
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
    const date = Number(params.date);
    const seed = {
        amount: amount > 0 ? amount : undefined,
        currency: params.currency,
        date: Number.isFinite(date) && date > 0 ? new Date(date) : undefined,
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

            <TransferEditor onDone={() => router.back()} seed={seed} />
        </>
    );
}
