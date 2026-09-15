import { Redirect } from "expo-router";
import { useState } from "react";

import AccountEditor from "@/components/account-editor";
import { CloseToolbar } from "@/components/close-toolbar";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";

export default function AccountCreateScreen() {
    // Latched: the route is live (store resolution, account count) and a later flip would replace the open form.
    const [createRoute] = useState(useAccountCreateRoute());

    // The route is externally addressable through the app's URL scheme, so the
    // cap cannot live only in the callers that push it.
    if (createRoute === "/paywall") {
        return <Redirect href="/paywall" />;
    }

    return (
        <>
            <CloseToolbar placement="right" />

            <AccountEditor mode="create" />
        </>
    );
}
