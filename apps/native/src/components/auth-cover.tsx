import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";
import { useAuthSession } from "@/lib/auth-session";
import { useLedgerAdoption } from "@/lib/ledger-adoption";
import { useColors } from "@/theme/use-colors";

/**
 * Holds an opaque cover over `children` rather than swapping them out, the same
 * shape `AppLockGate` uses and for the same reason: a navigator unmounted mid-
 * restore loses its stack.
 *
 * It covers the two moments where the router has been told the user is signed
 * out but the app does not yet know that is true — a session being read with no
 * cached copy to answer from, and an account whose ledger has not been
 * reconciled with this device's yet.
 */
export function AuthCover({ children }: { children: ReactNode }) {
	const { gate } = useAuthSession();
	const { status } = useLedgerAdoption();
	const covered = gate === "restoring" || status === "resolving";

	return (
		<View className="flex-1">
			{children}
			{covered ? <RestoringScreen /> : null}
		</View>
	);
}

function RestoringScreen() {
	const colors = useColors();
	const t = useTranslation();
	return (
		<View className="absolute inset-0 items-center justify-center gap-4 bg-background px-8">
			<ActivityIndicator color={colors.subtle} />
			<Text className="text-muted text-subtitle">{t("auth.restoring.title")}</Text>
		</View>
	);
}
