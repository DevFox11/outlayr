import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/text";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

interface StepFeeProps<Id extends string> {
    charged: string | null;
    children?: ReactNode;
    labels: { charged: string; loggedAs: string };
    loggedAs: string;
    onLoggedAsPress: () => void;
    onSelect: (id: Id) => void;
    options: readonly StageOptionItem<Id>[];
    selectedId: Id;
}

export function StepFee<Id extends string>({
    charged,
    children,
    labels,
    loggedAs,
    onLoggedAsPress,
    onSelect,
    options,
    selectedId,
}: StepFeeProps<Id>) {
    return (
        <View className="gap-3">
            <StageOptionRow onSelect={onSelect} options={options} selectedId={selectedId} />
            {children}
            <View className="border-border flex-row border-t">
                <Pressable
                    accessibilityLabel={`${labels.loggedAs}, ${loggedAs}`}
                    accessibilityRole="button"
                    className="min-w-0 flex-1 pt-2.5 active:opacity-60"
                    onPress={onLoggedAsPress}
                    style={{ minHeight: 44 }}
                >
                    <Text className="text-eyebrow text-muted tracking-eyebrow font-mono uppercase">
                        {labels.loggedAs}
                    </Text>
                    <Text className="font-mono-medium text-callout text-foreground" numberOfLines={1}>
                        {loggedAs}
                    </Text>
                </Pressable>
                {charged === null ? null : (
                    <View className="border-border min-w-0 flex-1 border-l pt-2.5 pl-3.5" style={{ minHeight: 44 }}>
                        <Text className="text-eyebrow text-muted tracking-eyebrow font-mono uppercase">
                            {labels.charged}
                        </Text>
                        <Text className="font-mono-medium text-callout text-foreground tabular-nums">{charged}</Text>
                    </View>
                )}
            </View>
        </View>
    );
}
