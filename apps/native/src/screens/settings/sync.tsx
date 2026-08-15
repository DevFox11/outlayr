import { eq } from "drizzle-orm";
import { useState } from "react";
import { View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { AccountRow } from "@/components/settings/account-row";
import { LinkRow, SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { META_KEYS } from "@/data/app-meta-core";
import { runAdoption } from "@/data/ledger-adoption";
import { useLiveQuery } from "@/data/live-query";
import { setSyncEnabled } from "@/data/sync-outbox-core";
import { useSyncStatus } from "@/data/use-sync-status";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { formatDayHeader, formatTime } from "@/domain/dates";
import type { AdoptionActions } from "@/domain/ledger-adoption";
import { effectiveCapabilityStatus, ownsSyncSwitch, syncPresentation } from "@/domain/sync-status";
import { useLanguage, useTranslation } from "@/i18n/context";
import { adoptionEngine } from "@/lib/adoption-engine";
import { useAuthSession } from "@/lib/auth-session";
import { cloudRuntime } from "@/lib/cloud-runtime";
import { useLedgerAdoption } from "@/lib/ledger-adoption";
import { notifyFailure } from "@/lib/notify";

/**
 * Switching back on goes through the adoption path rather than a bespoke push.
 * The switch is only offered to a device that has already reconciled with the
 * account, so what is owed is the backlog the triggers never queued while the
 * gate was shut — and `runAdoption` opens the gate before it queues, which is
 * the ordering `enqueueAllForSync` warns about.
 */
const RESUME: AdoptionActions = {
    pushLocal: true,
    wipeAccount: false,
    wipeLocal: false,
};

export function Sync() {
    const db = useDatabase();
    return <SyncSettings db={db} />;
}

function SyncSettings({ db }: { db: Database }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const { accountId } = useAuthSession();
    const { status } = useLedgerAdoption();
    const { pending, syncedAt } = useSyncStatus(db);
    const enabled = useSyncEnabled(db);
    const { use24Hour } = useDisplaySettings().state;
    const [busy, setBusy] = useState(false);

    const capability = effectiveCapabilityStatus({
        accountId,
        cloud: cloudRuntime === null ? "unconfigured" : "configured",
        local: false,
        pending,
        syncEnabled: enabled,
        syncedAt,
    });
    const owned = ownsSyncSwitch(capability.kind, status);
    const presentation = syncPresentation(capability.kind, enabled);

    const toggle = (next: boolean) => {
        setBusy(true);
        const work =
            next && accountId ? runAdoption(db, adoptionEngine(db), RESUME, accountId) : setSyncEnabled(db, false);
        work.catch((cause: unknown) => {
            console.error("Sync switch failed", cause);
            notifyFailure({ body: t("settings.sync.failedBody"), title: t("settings.sync.failedTitle") });
        }).finally(() => setBusy(false));
    };

    return (
        <SettingsScreen>
            <View className="gap-1.5 pt-6">
                <MonoLabel>{t("settings.sync.eyebrow")}</MonoLabel>
                <Text className="font-sans-semibold text-foreground text-title">{t(presentation.title)}</Text>
                <Text className="text-muted text-subtitle pt-1 leading-snug">{t(presentation.detail)}</Text>
            </View>

            <SettingsSection
                footer={t(owned ? "settings.sync.footer" : "settings.sync.needsAccount")}
                title={t("settings.sync.section")}
            >
                <AccountRow />
                {owned ? (
                    <ToggleRow icon="Cloud" onValueChange={toggle} title={t("settings.sync.toggle")} value={enabled} />
                ) : null}
            </SettingsSection>

            {busy ? <Text className="text-muted text-subtitle pt-2">{t("settings.sync.working")}</Text> : null}

            {capability.kind === "active" ? (
                <SettingsSection title={t("settings.sync.statusSection")}>
                    <LinkRow icon="Cloud" title={t("settings.sync.waiting")} value={String(capability.pending)} />
                    <LinkRow
                        icon="CalendarClock"
                        title={t("settings.sync.lastSynced")}
                        value={
                            capability.syncedAt == null
                                ? t("settings.sync.neverSynced")
                                : `${formatDayHeader(capability.syncedAt, undefined, language)} ${formatTime(capability.syncedAt, use24Hour, language)}`
                        }
                    />
                </SettingsSection>
            ) : null}
        </SettingsScreen>
    );
}

/**
 * Read live rather than through `isSyncEnabled`: the switch has to follow the
 * write the moment it lands, and the gate is a row like any other.
 */
function useSyncEnabled(db: Database): boolean {
    const rows = useLiveQuery(appMeta, () => db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.syncEnabled)));
    return rows[0]?.value === "1";
}
