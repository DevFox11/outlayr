import { Pressable, View } from "react-native";
import { useLocalData } from "@/contexts/local-data-context";
import { useTranslation } from "@/i18n";
import { Text } from "./text";

/**
 * Terminal surface for a database that failed to open, migrate or seed. It
 * replaces the navigator entirely: with no usable file there is no screen that
 * could render meaningfully, and the splash must not hang forever either.
 */
export function LocalDataError() {
	const { error, status, retry } = useLocalData();
	const t = useTranslation();
	const retrying = status !== "error";

	return (
		<View className="flex-1 items-center justify-center bg-background px-8">
			<Text className="pb-2 font-sans-semibold text-foreground text-title">
				{t("transaction.localData.title")}
			</Text>
			<Text className="pb-5 text-center text-muted text-subtitle">
				{t("transaction.localData.body")}
			</Text>

			<Pressable
				accessibilityRole="button"
				accessibilityState={{ disabled: retrying }}
				disabled={retrying}
				onPress={retry}
				className="rounded-xl bg-accent px-6 py-3 active:opacity-80 disabled:opacity-50"
			>
				<Text className="font-sans-semibold text-accent-foreground text-body">
					{t(retrying ? "transaction.localData.retrying" : "common.retry")}
				</Text>
			</Pressable>

			{error ? (
				<Text className="pt-6 text-center text-label text-muted">
					{error.message}
				</Text>
			) : null}
		</View>
	);
}
