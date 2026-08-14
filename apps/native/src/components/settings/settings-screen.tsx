import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import { Text } from "@/components/text";

export function SettingsScreen({ children, footer }: { children: ReactNode; footer?: string }) {
    return (
        <ScrollView
            className="bg-background flex-1"
            contentContainerClassName="px-5 pb-safe-offset-10"
            contentInsetAdjustmentBehavior="automatic"
        >
            {children}
            {footer ? <Text className="text-muted text-subtitle pt-8 text-center">{footer}</Text> : null}
        </ScrollView>
    );
}
