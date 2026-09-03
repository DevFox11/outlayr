import { useLocalSearchParams } from "expo-router";

import { NewTransaction } from "@/screens/transaction/new";

export default function NewTransactionScreen() {
    // `income`/`amount`/`note` are set by the surfaces that open this screen
    // from outside the bundle — the "Log Income" quick action, or a Siri intent
    // handing off a draft. `categoryId`/`accountId`/`currency`/`date` come only
    // from the voice screen, whose draft this ledger already resolved by name.
    // `from` is the opposite direction: a row already on the ledger asking to be
    // logged again, which is why it may fill in the fields a suggestion from
    // outside may not.
    const {
        income,
        amount,
        note,
        from,
        categoryId,
        accountId,
        accountUnresolved,
        currency,
        date,
        details,
        recurringCoefficient,
        recurringType,
    } = useLocalSearchParams<{
        accountId?: string;
        /** "1" when the voice draft named an account the ledger could not place. */
        accountUnresolved?: string;
        amount?: string;
        categoryId?: string;
        currency?: string;
        /** Epoch milliseconds. */
        date?: string;
        details?: string;
        from?: string;
        income?: string;
        note?: string;
        /** A spoken subscription: the stored `recurringType` and its multiplier. */
        recurringCoefficient?: string;
        recurringType?: string;
    }>();

    return (
        <NewTransaction
            accountId={accountId}
            accountUnresolved={accountUnresolved}
            amount={amount}
            categoryId={categoryId}
            currency={currency}
            date={date}
            details={details}
            from={from}
            income={income}
            note={note}
            recurringCoefficient={recurringCoefficient}
            recurringType={recurringType}
        />
    );
}
