import type { ReactNode } from "react";
import { View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

export interface MeasureStripCell {
    key: string;
    label: string;
    /** A string renders as the bold tabular figure; pass a node for amounts. */
    value: ReactNode;
}

export function MeasureStrip({ cells, className }: { cells: readonly MeasureStripCell[]; className?: string }) {
    return (
        <View className={cn("border-border border-y", className)}>
            <View className="flex-row">
                {cells.map((cell, index) => (
                    <View className={cn("flex-1", index > 0 && "pl-3.5")} key={cell.key}>
                        {index > 0 ? <View className="bg-border absolute inset-y-0 left-0 w-px" /> : null}
                        <View className="gap-0.75 py-2.5">
                            <MonoLabel numberOfLines={1}>{cell.label}</MonoLabel>
                            {typeof cell.value === "string" ? (
                                <Text
                                    className="font-sans-semibold text-body text-foreground"
                                    numberOfLines={1}
                                    style={TABULAR}
                                >
                                    {cell.value}
                                </Text>
                            ) : (
                                cell.value
                            )}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
