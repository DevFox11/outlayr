import { useState } from "react";
import { Pressable, View } from "react-native";

import { BusyText } from "@/components/busy-text";
import { SettingsSection } from "@/components/list/list-row";
import { MonoLabel } from "@/components/mono-label";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { buildArchive } from "@/data/archive-core";
import { downloadEveryPhoto } from "@/data/photo-sync-core";
import { isSyncEnabled } from "@/data/sync-outbox-core";
import { useTransactionCount } from "@/data/transactions";
import { exportFileName, exportTransactionsCsv } from "@/data/transfer-core";
import { archiveFileName, serializeArchive } from "@/domain/archive";
import { CSV_HEADER } from "@/domain/transaction-csv";
import type { TranslationKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import { photoTransport } from "@/lib/convex";
import { shareFile, TransferError } from "@/lib/data-transfer";
import { notifyFailure } from "@/lib/notify";
import { photoFiles, storedPhotosBase64 } from "@/lib/photo-storage";
import { useColors } from "@/theme/use-colors";

/**
 * What a transaction row holds that the eight columns cannot carry (`details`,
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
    const colors = useColors();
    const t = useTranslation();
    const count = useTransactionCount(db);
    const [busy, setBusy] = useState<"archive" | "csv" | null>(null);

    // The archive is the one that can be restored from; the CSV is for
    // spreadsheets. Kept as separate actions rather than a format toggle so the
    // difference is legible before the file is written, not after — but the two
    // differ only in what they build and what they call it, so the busy flag and
    // the failure report are written once.
    const runExport = (
        kind: "archive" | "csv",
        build: () => Promise<string>,
        name: string,
        mime: string,
        shareTitle: TranslationKey
    ) => {
        setBusy(kind);
        build()
            .then((payload) => {
                setBusy(null);
                return shareFile(payload, name, mime, t(shareTitle));
            })
            .catch((cause: unknown) => {
                notifyFailure({
                    body: cause instanceof TransferError ? t(cause.key) : t("settings.export.failedBody"),
                    title: t("settings.export.failedTitle"),
                });
            })
            .finally(() => setBusy(null));
    };

    const runArchive = () =>
        runExport(
            "archive",
            async () => {
                if (await isSyncEnabled(db)) {
                    await downloadEveryPhoto(db, photoFiles, photoTransport()).catch((cause: unknown) => {
                        console.warn("[outlayr] fetching missing photos before export failed", cause);
                    });
                }
                // ponytail: the whole archive is one in-memory string with photos as base64; stream it to a zip if ledgers outgrow 512px JPEGs
                return serializeArchive(await buildArchive(db, new Date(), storedPhotosBase64()));
            },
            archiveFileName(new Date()),
            "application/json",
            "settings.export.archiveShareTitle"
        );

    const run = () =>
        runExport(
            "csv",
            () => exportTransactionsCsv(db),
            exportFileName(new Date()),
            "text/csv",
            "settings.export.shareTitle"
        );

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
                    disabled={busy !== null || count === 0}
                    onPress={run}
                    style={(busy !== null && busy !== "csv") || count === 0 ? { opacity: 0.4 } : undefined}
                >
                    {busy === "csv" ? (
                        <BusyText className="font-sans-semibold text-callout" color={colors.background}>
                            {t("settings.export.preparing")}
                        </BusyText>
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
                    disabled={busy !== null}
                    onPress={runArchive}
                    style={busy === "csv" ? { opacity: 0.4 } : undefined}
                >
                    {busy === "archive" ? (
                        <BusyText className="text-body flex-1" color={colors.foreground}>
                            {t("settings.export.preparingArchive")}
                        </BusyText>
                    ) : (
                        <Text className="text-body text-foreground flex-1">{t("settings.export.archiveAction")}</Text>
                    )}
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
