import type { ReactNode } from "react";
import { View } from "react-native";

import { BusyText } from "@/components/busy-text";
import { useLongWait } from "@/hooks/use-long-wait";
import { useTranslation } from "@/i18n/context";
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
    const covered = useAuthCovered();

    return (
        <View className="flex-1">
            {children}
            {covered ? <RestoringScreen /> : null}
        </View>
    );
}

export function useAuthCovered(): boolean {
    const { gate } = useAuthSession();
    const { status } = useLedgerAdoption();
    return gate === "restoring" || status === "resolving";
}

function RestoringScreen() {
    const colors = useColors();
    const t = useTranslation();
    const slow = useLongWait(true);
    return (
        <View className="bg-background absolute inset-0 items-center justify-center px-8">
            {slow ? (
                <BusyText className="text-subtitle" color={colors.muted}>
                    {t("auth.restoring.title")}
                </BusyText>
            ) : null}
        </View>
    );
}
