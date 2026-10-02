import { View } from "react-native";

import { ROUNDED, Text, TextInput } from "@/components/text";
import { useColors } from "@/theme/use-colors";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

/** The same rule a filled value carries in the sentence above. */
const RULE_HEIGHT = 2;

/** Matches `MerchantSlot`, which writes the same string into the same column. */
const MAX_NAME_LENGTH = 50;

export interface StepMerchantProps {
    /**
     * Its own, not the sentence's: while this step is open both fields are on
     * screen, and one label on two inputs is an ambiguous target.
     */
    accessibilityLabel: string;
    /** Every edit: a keystroke in the field, or a whole name off one of the rows. */
    onChange: (next: string) => void;
    placeholder: string;
    /** Merchants this ledger has filed before, most recent first. */
    recent: readonly string[];
    recentLabel: string;
    /** Curated names matching what has been typed so far. */
    suggestions: readonly string[];
    /**
     * Controlled: the sentence's inline field edits the same string, and a step
     * holding its own copy would disagree with it the moment either is typed in.
     */
    value: string;
}

function toOptions(names: readonly string[]): StageOptionItem<string>[] {
    return names.map((name) => ({ id: name, label: name }));
}

/**
 * The stage's merchant step: the name, then what it could be.
 *
 * Nothing is focused on arrival. Most entries name a merchant this ledger
 * already knows, and a row of those is one tap with no keyboard between — the
 * field is for the ones it does not.
 */
export function StepMerchant({
    accessibilityLabel,
    onChange,
    placeholder,
    recent,
    recentLabel,
    suggestions,
    value,
}: StepMerchantProps) {
    const colors = useColors();
    const filled = value.length > 0;

    return (
        <View className="gap-4">
            <View>
                <TextInput
                    accessibilityLabel={accessibilityLabel}
                    autoCapitalize="words"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    maxLength={MAX_NAME_LENGTH}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.muted}
                    // Nothing follows it: the key ends the entry and puts the keyboard
                    // away, and "next" promised a field that is not there.
                    returnKeyType="done"
                    style={{
                        color: colors.foreground,
                        fontFamily: ROUNDED,
                        fontSize: 17,
                        padding: 0,
                        paddingBottom: 8,
                    }}
                    testID="stage-merchant-field"
                    value={value}
                />
                <View
                    className="rounded-full"
                    pointerEvents="none"
                    style={{
                        backgroundColor: filled ? colors.tint : colors.separator,
                        height: RULE_HEIGHT,
                    }}
                />
            </View>

            {suggestions.length === 0 ? null : (
                <View testID="stage-merchant-suggestions">
                    <StageOptionRow onSelect={onChange} options={toOptions(suggestions)} selectedId={value} />
                </View>
            )}

            {recent.length === 0 ? null : (
                <View className="gap-2" testID="stage-merchant-recent">
                    <Text className="text-footnote text-muted">{recentLabel}</Text>
                    <StageOptionRow onSelect={onChange} options={toOptions(recent)} selectedId={value} />
                </View>
            )}
        </View>
    );
}
