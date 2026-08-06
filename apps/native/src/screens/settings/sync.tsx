import { eq } from "drizzle-orm";
import { useState } from "react";
import { Alert, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { AccountRow } from "@/components/settings/account-row";
import {
	LinkRow,
	SettingsSection,
	ToggleRow,
} from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { META_KEYS } from "@/data/app-meta";
import { runAdoption } from "@/data/ledger-adoption";
import { useLiveQuery } from "@/data/live-query";
import { setSyncEnabled } from "@/data/sync-outbox-core";
import { useSyncStatus } from "@/data/use-sync-status";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { formatDayHeader, formatTime } from "@/domain/dates";
import type { AdoptionActions } from "@/domain/ledger-adoption";
import { useTranslation } from "@/i18n";
import { adoptionEngine } from "@/lib/adoption-engine";
import { useAuthSession } from "@/lib/auth-session";
import { useLedgerAdoption } from "@/lib/ledger-adoption";

/**
 * Switching back on goes through the adoption path rather than a bespoke push.
 * The switch is only offered to a device that has already reconciled with the
 * account, so what is owed is the backlog the triggers never queued while the
 * gate was shut — and `runAdoption` opens the gate before it queues, which is
 * the ordering `enqueueAllForSync` warns about.
 */
const RESUME: AdoptionActions = {
	pushLocal: true,
	wipeLocal: false,
	wipeAccount: false,
};

export function Sync() {
	const db = useDatabase();
	return <SyncSettings db={db} />;
}

function SyncSettings({ db }: { db: Database }) {
	const t = useTranslation();
	const { accountId } = useAuthSession();
	const { status } = useLedgerAdoption();
	const { pending, syncedAt } = useSyncStatus(db);
	const enabled = useSyncEnabled(db);
	const { use24Hour } = useDisplaySettings().state;
	const [busy, setBusy] = useState(false);

	// The switch is the user's to hold only once the two ledgers have been
	// reconciled; until then the adoption cover owns that decision, and offering
	// a plain "on" here would push a local ledger over an account's without
	// anybody having chosen it.
	const owned = accountId != null && status === "settled";

	const toggle = (next: boolean) => {
		setBusy(true);
		const work = next
			? runAdoption(db, adoptionEngine(db), RESUME)
			: setSyncEnabled(db, false);
		work
			.catch((error: unknown) => {
				console.error("Sync switch failed", error);
				Alert.alert(
					t("settings.sync.failedTitle"),
					t("settings.sync.failedBody"),
				);
			})
			.finally(() => setBusy(false));
	};

	return (
		<SettingsScreen>
			<View className="gap-1.5 pt-6">
				<MonoLabel>{t("settings.sync.eyebrow")}</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-title">
					{t(enabled ? "settings.sync.on" : "settings.sync.off")}
				</Text>
				<Text className="pt-1 text-muted text-subtitle leading-snug">
					{t(enabled ? "settings.sync.onDetail" : "settings.sync.offDetail")}
				</Text>
			</View>

			<SettingsSection
				footer={t(
					owned ? "settings.sync.footer" : "settings.sync.needsAccount",
				)}
				title={t("settings.sync.section")}
			>
				<AccountRow />
				{owned ? (
					<ToggleRow
						icon="Cloud"
						onValueChange={toggle}
						title={t("settings.sync.toggle")}
						value={enabled}
					/>
				) : null}
			</SettingsSection>

			{busy ? (
				<Text className="pt-2 text-muted text-subtitle">
					{t("settings.sync.working")}
				</Text>
			) : null}

			<SettingsSection title={t("settings.sync.statusSection")}>
				<LinkRow
					icon="Cloud"
					title={t("settings.sync.waiting")}
					value={String(pending)}
				/>
				<LinkRow
					icon="CalendarClock"
					title={t("settings.sync.lastSynced")}
					value={
						syncedAt == null
							? t("settings.sync.neverSynced")
							: `${formatDayHeader(syncedAt)} ${formatTime(syncedAt, use24Hour)}`
					}
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}

/**
 * Read live rather than through `isSyncEnabled`: the switch has to follow the
 * write the moment it lands, and the gate is a row like any other.
 */
function useSyncEnabled(db: Database): boolean {
	const rows = useLiveQuery(appMeta, () =>
		db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.syncEnabled)),
	);
	return rows[0]?.value === "1";
}
