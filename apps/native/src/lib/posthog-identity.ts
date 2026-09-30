import { useEffect } from "react";

import { useAuthSession } from "@/lib/auth-session";
import { posthog } from "@/lib/posthog";

export function usePostHogIdentity() {
    const { accountId, gate } = useAuthSession();
    useEffect(() => {
        const client = posthog;
        if (client === null) {
            return;
        }
        if (accountId !== null) {
            client.identify(accountId);
            return;
        }
        if (gate !== "signed-out") {
            return;
        }
        let live = true;
        void client.ready().then(() => {
            if (live && client.getDistinctId() !== client.getAnonymousId()) {
                client.reset();
            }
        });
        return () => {
            live = false;
        };
    }, [accountId, gate]);
}
