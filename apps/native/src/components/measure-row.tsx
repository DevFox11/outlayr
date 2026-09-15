import { View } from "react-native";

import { MonoLabel } from "./mono-label";
import { Text } from "./text";
import { cn } from "./tw";

export interface Measure {
    key: string;
    /** One short word, so every cell fits across the narrowest phone. */
    label: string;
    /** Already formatted. These are quantities, not movements, so they carry no sign. */
    value: string;
}

interface MeasureRowProps {
    measures: readonly Measure[];
}

/**
 * A row of figures under a hero, ruled the way `LedgerHead` rules its own.
 *
 * Split from that component rather than sharing it: a ledger cell is a movement
 * and always states its direction, while these are standing quantities — a limit
 * and a rate of spend — where a leading `+` would be noise.
 */
export function MeasureRow({ measures }: MeasureRowProps) {
    return (
        <View>
            <View className="bg-border h-px w-full" />
            <View className="flex-row">
                {measures.map((measure, index) => (
                    <View className={cn("flex-1 gap-0.75 py-2.5", index > 0 && "pl-3.5")} key={measure.key}>
                        {/* Absolute so the rule spans the taller of the columns rather
						    than only its own content. */}
                        {index > 0 ? <View className="bg-border absolute inset-y-0 left-0 w-px" /> : null}
                        <MonoLabel>{measure.label}</MonoLabel>
                        <Text className="font-sans-semibold text-body text-foreground tabular-nums" numberOfLines={1}>
                            {measure.value}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
