import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { restoreArchive } from "@/data/archive-core";
import type { Database } from "@/db/client";
import { archiveRowCount, parseArchive } from "@/domain/archive";
import type { ArchiveDocument } from "@/domain/archive";
import { useTranslation } from "@/i18n/context";
import { pickArchiveFile, TransferError } from "@/lib/data-transfer";
import { useColors } from "@/theme/use-colors";

export function RestoreData() {
    const db = useDatabase();
    return <RestoreDataContent db={db} />;
}

function RestoreDataContent({ db }: { db: Database }) {
    const colors = useColors();
    const router = useRouter();
    const t = useTranslation();
    const [busy, setBusy] = useState(false);

    const applyArchive = (document: ArchiveDocument) => {
        setBusy(true);
        restoreArchive(db, document)
            .then(() => router.back())
            .catch(() => {
                Alert.alert(t("settings.restore.failedTitle"), t("settings.restore.failedBody"));
            })
            .finally(() => setBusy(false));
    };

    // A restore replaces the ledger rather than adding to it, so it is confirmed
    // against a count the user can recognise — a file that turns out to hold two
    // rows is the one you want to catch before it lands, not after.
    const restore = () => {
        pickArchiveFile()
            .then((picked) => {
                if (picked == null) {
                    return;
                }
                const document = parseArchive(picked.text);
                if (document == null) {
                    Alert.alert(t("settings.restore.badArchiveTitle"), t("settings.restore.badArchiveBody"));
                    return;
                }
                Alert.alert(
                    t("settings.restore.confirmTitle"),
                    t("settings.restore.confirmBody", {
                        count: String(archiveRowCount(document)),
                    }),
                    [
                        { style: "cancel", text: t("common.cancel") },
                        {
                            onPress: () => applyArchive(document),
                            style: "destructive",
                            text: t("settings.restore.confirmAction"),
                        },
                    ]
                );
            })
            .catch((cause: unknown) => {
                Alert.alert(
                    t("settings.restore.failedTitle"),
                    cause instanceof TransferError ? t(cause.key) : t("settings.restore.failedBody")
                );
            });
    };

    return (
        <SettingsScreen footer={t("settings.restore.footer")}>
            <View className="gap-1 pt-6">
                <MonoLabel>{t("settings.restore.eyebrow")}</MonoLabel>
                <Text className="text-muted text-subtitle pb-4 leading-snug">{t("settings.restore.intro")}</Text>
            </View>

            <View className="pt-2">
                <Pressable
                    accessibilityRole="button"
                    className="bg-foreground h-14 items-center justify-center rounded-[28px] active:opacity-70"
                    disabled={busy}
                    onPress={restore}
                    style={busy ? { opacity: 0.4 } : undefined}
                >
                    {busy ? (
                        <ActivityIndicator color={colors.background} />
                    ) : (
                        <Text className="font-sans-semibold text-background text-callout">
                            {t("settings.restore.action")}
                        </Text>
                    )}
                </Pressable>
            </View>
        </SettingsScreen>
    );
}
