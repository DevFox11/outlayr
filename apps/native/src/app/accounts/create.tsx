import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import AccountEditor from "@/components/account-editor";
import { CloseToolbar } from "@/components/close-toolbar";
import { useAccountCaps } from "@/hooks/use-pro-gate";

export default function AccountCreateScreen() {
    const [caps] = useState(useAccountCaps());
    // Set by the Debts screen's "+", for a company, card or loan, and by the account step's installment apps.
    const { kind } = useLocalSearchParams<{ kind?: string }>();

    // The route is externally addressable through the app's URL scheme, so the
    // cap cannot live only in the callers that push it. A liability may still be
    // an installment app, which the editor caps on its own once it is named.
    if (caps.accounts && (kind !== "liability" || caps.installmentApps)) {
        return <Redirect href="/paywall" />;
    }

    return (
        <>
            <CloseToolbar placement="right" />

            <AccountEditor liability={kind === "liability"} mode="create" />
        </>
    );
}
