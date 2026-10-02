import { useRouter } from "expo-router";

import { LinkRow } from "@/components/list/list-row";
import { projectLimit } from "@/domain/usage-limits";
import { useTickingNow, useUsageLimits } from "@/hooks/use-usage-limits";
import { useTranslation } from "@/i18n/context";
import { useAuthSession } from "@/lib/auth-session";

export function UsageRow() {
    const { accountId } = useAuthSession();
    return accountId === null ? null : <SignedInUsageRow />;
}

function SignedInUsageRow() {
    const router = useRouter();
    const t = useTranslation();
    const limits = useUsageLimits();
    const now = useTickingNow(false);
    return (
        <LinkRow
            icon="DashboardSpeed01"
            onPress={() => router.push("/settings/usage")}
            title={t("nav.settings.usage")}
            value={limits ? t("settings.usage.left", { count: projectLimit(limits.captures, now).left }) : undefined}
        />
    );
}
