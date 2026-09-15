import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useLocalData } from "@/contexts/local-data-context";
import { closeDatabase } from "@/db/client";
import { useTranslation } from "@/i18n/context";

import { resumePersistedCloudDeletion } from "./deletion-resume";
import { createDeviceResetGate } from "./device-data-reset";

export function DeviceResetRecovery({ children }: { children: ReactNode }) {
    const { db, retry } = useLocalData();
    const t = useTranslation();
    const [error, setError] = useState<Error | null>(null);
    const [ready, setReady] = useState(false);

    const recover = useCallback(async () => {
        setError(null);
        try {
            if (db === null) {
                throw new Error("Local database is unavailable for device reset");
            }
            const database = db;
            // Set only if the sweep actually reached the sqlite store, which it
            // does only when a reset marker was waiting. Every ordinary launch
            // recovers nothing, and reopening then would publish
            // `status: "opening"` on a database that was just opened — which
            // un-gates this component in `_layout`, remounts it, and recovers
            // nothing again, forever.
            let closed = false;
            const result = await createDeviceResetGate({
                // Close only. `retry()` belongs after the whole sweep, not inside
                // it: it publishes `status: "opening"`, which un-gates this
                // component in `_layout` and starts a reopen that races the
                // `deleteDatabaseAsync` one line below `closeDatabase` — either
                // the delete loses to a locked file, or the reopen re-seeds a
                // ledger while the remaining stores are still being erased. The
                // sibling path in `settings/account` closes the same way.
                closeDatabase: async () => {
                    closed = true;
                    await closeDatabase(database);
                },
                completeCloudDeletion: async () => {
                    await resumePersistedCloudDeletion({ clearOnComplete: false, required: true });
                },
            }).recover();
            if (result.failures.length > 0) {
                throw new Error(`Device cleanup incomplete: ${result.failures.join(", ")}`);
            }
            if (closed) {
                // The database file is gone, so the provider is holding a handle
                // to nothing until this reopens it.
                retry();
            }
            setReady(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause : new Error(String(cause)));
        }
    }, [db, retry]);

    useEffect(() => {
        // oxlint-disable-next-line react/react-compiler -- an async bootstrap: `recover` awaits the cleanup and reports the outcome, so both writes land well after this effect returns.
        recover();
    }, [recover]);

    if (error) {
        return (
            <View className="bg-background flex-1 items-center justify-center px-8">
                <Text className="font-sans-semibold text-foreground text-title pb-2">
                    {t("settings.account.resetFailedTitle")}
                </Text>
                <Text className="text-muted text-subtitle pb-4 text-center">{error.message}</Text>
                <Pressable accessibilityRole="button" className="bg-accent rounded-full px-6 py-3" onPress={recover}>
                    <Text className="font-sans-semibold text-accent-foreground text-subtitle">{t("common.retry")}</Text>
                </Pressable>
            </View>
        );
    }

    return ready ? children : null;
}
