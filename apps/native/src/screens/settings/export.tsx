import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { buildArchive } from "@/data/archive-core";
import { useTransactionCount } from "@/data/transactions";
import { exportFileName, exportTransactionsCsv } from "@/data/transfer-core";
import type { Database } from "@/db/client";
import { archiveFileName, serializeArchive } from "@/domain/archive";
import { CSV_HEADER } from "@/domain/transaction-csv";
import type { TranslationKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import { shareText, TransferError } from "@/lib/data-transfer";
import { notifyFailure } from "@/lib/notify";
import { useColors } from "@/theme/use-colors";

/**
 * What a transaction row holds that the six columns cannot carry (`details`,
 * `imageUri`, `emoji`/`icon`/`customColor`, the `recurring*` schedule). Named on
 * the screen because a CSV exported "to be safe" is otherwise taken for a
 * backup, and a restore from it silently comes back thinner.
 */
const OMITTED = [
    "settings.export.omittedDetails",
    "settings.export.omittedPhotos",
    "settings.export.omittedLook",
    "settings.export.omittedRecurrence",
] as const satisfies readonly TranslationKey[];

export function ExportData() {
    const db = useDatabase();
    return <ExportDataContent db={db} />;
}

function ExportDataContent({ db }: { db: Database }) {
    const colors = useColors();
    const t = useTranslation();
    const count = useTransactionCount(db);
    const [busy, setBusy] = useState(false);

    // The archive is the one that can be restored from; the CSV is for
    // spreadsheets. Kept as separate actions rather than a format toggle so the
    // difference is legible before the file is written, not after.
    const runArchive = () => {
        setBusy(true);
        buildArchive(db, new Date())
            .then((document) =>
                shareText(
                    serializeArchive(document),
                    archiveFileName(new Date()),
                    "application/json",
                    t("settings.export.archiveShareTitle")
                )
            )
            .catch((cause: unknown) => {
                notifyFailure({
                    body: cause instanceof TransferError ? t(cause.key) : t("settings.export.failedBody"),
                    title: t("settings.export.failedTitle"),
                });
            })
            .finally(() => setBusy(false));
    };

    const run = () => {
        setBusy(true);
        exportTransactionsCsv(db)
            .then((csv) => shareText(csv, exportFileName(new Date()), "text/csv", t("settings.export.shareTitle")))
            .catch((cause: unknown) => {
                notifyFailure({
                    body: cause instanceof TransferError ? t(cause.key) : t("settings.export.failedBody"),
                    title: t("settings.export.failedTitle"),
                });
            })
            .finally(() => setBusy(false));
    };

    return (
        <SettingsScreen footer={t("settings.export.footer")}>
            <View className="gap-1 pt-6">
                <MonoLabel>{t("settings.export.ready")}</MonoLabel>
                <Text className="font-sans-semibold text-foreground text-hero tabular-nums">{count}</Text>
                <Text className="text-muted text-subtitle">
                    {count === 1 ? t("settings.export.transaction") : t("settings.export.transactions")}
                </Text>
            </View>

            <View className="pt-6">
                <Pressable
                    accessibilityRole="button"
                    className="bg-foreground h-14 items-center justify-center rounded-[28px] active:opacity-70"
                    disabled={busy || count === 0}
                    onPress={run}
                    style={busy || count === 0 ? { opacity: 0.4 } : undefined}
                >
                    {busy ? (
                        <ActivityIndicator color={colors.background} />
                    ) : (
                        <Text className="font-sans-semibold text-background text-callout">
                            {t("settings.export.action")}
                        </Text>
                    )}
                </Pressable>
            </View>

            <SettingsSection footer={t("settings.export.archiveNote")} title={t("settings.export.archiveTitle")}>
                <Pressable
                    accessibilityRole="button"
                    className="border-border flex-row items-center border-b py-3 active:opacity-70"
                    disabled={busy}
                    onPress={runArchive}
                >
                    <Text className="text-body text-foreground flex-1">{t("settings.export.archiveAction")}</Text>
                </Pressable>
            </SettingsSection>

            <SettingsSection footer={t("settings.export.columnsNote")} title={t("settings.export.columns")}>
                {CSV_HEADER.map((column) => (
                    <View className="border-border flex-row items-center border-b py-3" key={column}>
                        <Text className="text-body text-foreground flex-1">{column}</Text>
                    </View>
                ))}
            </SettingsSection>

            <SettingsSection footer={t("settings.export.omittedNote")} title={t("settings.export.omitted")}>
                {OMITTED.map((key) => (
                    <View className="border-border flex-row items-center border-b py-3" key={key}>
                        <Text className="text-body text-muted flex-1">{t(key)}</Text>
                    </View>
                ))}
            </SettingsSection>
        </SettingsScreen>
    );
}
