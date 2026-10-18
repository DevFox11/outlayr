import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import AccountEditor from "@/components/account-editor";
import { CloseToolbar } from "@/components/close-toolbar";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";

export default function AccountCreateScreen() {
    const [createRoute] = useState(useAccountCreateRoute());
    // Set by the Debts screen's "+", for a company, card or loan.
    const { kind } = useLocalSearchParams<{ kind?: string }>();

    // The route is externally addressable through the app's URL scheme, so the
    // cap cannot live only in the callers that push it.
    if (createRoute === "/paywall") {
        return <Redirect href="/paywall" />;
    }

    return (
        <>
            <CloseToolbar placement="right" />

            <AccountEditor liability={kind === "liability"} mode="create" />
        </>
    );
}
