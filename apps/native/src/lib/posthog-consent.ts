import { useEffect } from "react";

import { useLocalData } from "@/contexts/local-data-context";
import { useBoolSetting } from "@/data/settings";
import { posthog } from "@/lib/posthog";

export function useAnalyticsConsent() {
    const { db } = useLocalData();
    const share = useBoolSetting(db, "shareAnalytics");
    useEffect(() => {
        if (posthog === null || db === null) {
            return;
        }
        void (share ? posthog.optIn() : posthog.optOut());
    }, [db, share]);
}
