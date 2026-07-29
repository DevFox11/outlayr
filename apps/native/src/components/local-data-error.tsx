import { Pressable, View } from "react-native";
import { useLocalData } from "@/contexts/local-data-context";
import { Text } from "./text";

/**
 * Terminal surface for a database that failed to open, migrate or seed. It
 * replaces the navigator entirely: with no usable file there is no screen that
 * could render meaningfully, and the splash must not hang forever either.
 */
export function LocalDataError() {
	const { error, status, retry } = useLocalData();
	const retrying = status !== "error";

	return (
		<View className="flex-1 items-center justify-center bg-background px-8">
			<Text className="pb-2 font-sans-semibold text-foreground text-title">
				Something Went Wrong
			</Text>
			<Text className="pb-5 text-center text-muted text-subtitle">
				Outlayr could not open your data. This is often temporary — try again
				first. Your ledger is still on this device.
			</Text>

			<Pressable
				disabled={retrying}
				onPress={retry}
				className="rounded-xl bg-accent px-6 py-3 active:opacity-80 disabled:opacity-50"
			>
				<Text className="font-sans-semibold text-accent-foreground text-body">
					{retrying ? "Trying…" : "Try Again"}
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
