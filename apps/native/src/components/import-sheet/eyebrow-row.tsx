import { View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { cn } from "@/components/tw";

interface EyebrowRowProps {
    className?: string;
    label: string;
    value?: string;
}

export function EyebrowRow({ label, value, className }: EyebrowRowProps) {
    return (
        <View className={cn("gap-1.25", className)}>
            <View className="flex-row items-baseline justify-between gap-2">
                <MonoLabel numberOfLines={1}>{label}</MonoLabel>
                {value == null ? null : <MonoLabel numberOfLines={1}>{value}</MonoLabel>}
            </View>
            <View className="bg-border h-px" />
        </View>
    );
}
