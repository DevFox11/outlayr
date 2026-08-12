import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalData } from "@/contexts/local-data-context";
import { closeDatabase } from "@/db/client";
import { useTranslation } from "@/i18n/context";
import { resumePersistedCloudDeletion } from "./deletion-resume";
import { createDeviceResetGate } from "./device-data-reset";

export async function retryBeforeClosingDatabase(retry: () => void, close: () => Promise<void>): Promise<void> {
	retry();
	await close();
}

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
			const result = await createDeviceResetGate({
				closeDatabase: async () => await retryBeforeClosingDatabase(retry, async () => await closeDatabase(database)),
				completeCloudDeletion: async () => {
					await resumePersistedCloudDeletion({ clearOnComplete: false, required: true });
				},
			}).recover();
			if (result.failures.length > 0) {
				throw new Error(`Device cleanup incomplete: ${result.failures.join(", ")}`);
			}
			setReady(true);
		} catch (cause) {
			setError(cause instanceof Error ? cause : new Error(String(cause)));
		}
	}, [db, retry]);

	useEffect(() => {
		recover();
	}, [recover]);

	if (error) {
		return (
			<View className="flex-1 items-center justify-center bg-background px-8">
				<Text className="pb-2 font-sans-semibold text-foreground text-title">
					{t("settings.account.resetFailedTitle")}
				</Text>
				<Text className="pb-4 text-center text-muted text-subtitle">{error.message}</Text>
				<Pressable accessibilityRole="button" className="rounded-full bg-accent px-6 py-3" onPress={recover}>
					<Text className="font-sans-semibold text-accent-foreground text-subtitle">{t("common.retry")}</Text>
				</Pressable>
			</View>
		);
	}

	return ready ? children : null;
}
