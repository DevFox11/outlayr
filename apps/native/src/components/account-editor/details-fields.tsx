import type { Ref } from "react";
import { Pressable, View } from "react-native";
import type { TextInputInstance } from "react-native";

import { OutlinedSelectField, OutlinedTextField } from "@/components/material/outlined-field";
import { SwitchRow } from "@/components/material/switch-row";
import { Text } from "@/components/text";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

const SIGN_TARGET = 48;
const PRESSED_ALPHA = 0.1;

interface AccountDetailsFieldsProps {
    balanceEditA11y: string;
    balanceLabel: string;
    balanceSignA11y: string;
    /** Already formatted for the active language and currency, without its sign. */
    balanceValue: string;
    currencyCode: string;
    currencyLabel: string;
    kindLabel: string;
    /** True when this account is money owed rather than money held. */
    liability: boolean;
    name: string;
    nameFieldRef?: Ref<TextInputInstance>;
    nameLabel: string;
    namePlaceholder: string;
    negative: boolean;
    onBalancePress: () => void;
    onCurrencyPress: () => void;
    onNameChange: (name: string) => void;
    onSubmitName: () => void;
    /** Omitted for a person, whose kind is not an asset or a liability, which hides the row. */
    onToggleLiability?: (next: boolean) => void;
    onToggleSign: () => void;
}

/**
 * The account form as Material 3 outlined fields (Direction B, mock row 4),
 * for the Android editor (`index.android.tsx`); the iOS one is the SwiftUI
 * `details-section.tsx`. The switch draws through Compose, so only Android
 * renders this.
 *
 * Name, a Currency field that opens the currency sheet, the "Money I owe"
 * switch, and a Balance field whose sign toggles in place and whose amount
 * opens the keypad sheet.
 */
export function AccountDetailsFields({
    balanceEditA11y,
    balanceLabel,
    balanceSignA11y,
    balanceValue,
    currencyCode,
    currencyLabel,
    kindLabel,
    liability,
    name,
    nameFieldRef,
    nameLabel,
    namePlaceholder,
    negative,
    onBalancePress,
    onCurrencyPress,
    onNameChange,
    onSubmitName,
    onToggleLiability,
    onToggleSign,
}: AccountDetailsFieldsProps) {
    const m3 = useMaterialColors();
    return (
        <View className="gap-4">
            <OutlinedTextField
                autoCapitalize="words"
                label={nameLabel}
                onChangeText={onNameChange}
                onSubmitEditing={onSubmitName}
                placeholder={namePlaceholder}
                ref={nameFieldRef}
                returnKeyType="done"
                value={name}
            />

            <OutlinedSelectField
                accessibilityValue={currencyCode}
                label={currencyLabel}
                onPress={onCurrencyPress}
                value={
                    <Text className="text-body font-sans" style={{ color: m3.onSurface }}>
                        {currencyCode}
                    </Text>
                }
            />

            {/* A card and an overdrawn current account both read as a negative
			    balance; this is the only thing that tells them apart. */}
            {onToggleLiability ? <SwitchRow label={kindLabel} onChange={onToggleLiability} value={liability} /> : null}

            <OutlinedSelectField
                accessibilityHint={balanceEditA11y}
                accessibilityValue={`${negative ? "−" : "+"}${balanceValue}`}
                dropdown={false}
                label={balanceLabel}
                leading={
                    <Pressable
                        accessibilityLabel={balanceSignA11y}
                        accessibilityRole="button"
                        android_ripple={{ borderless: true, color: withAlpha(m3.onSurface, PRESSED_ALPHA) }}
                        className="items-center justify-center"
                        onPress={onToggleSign}
                        style={{ height: SIGN_TARGET, width: SIGN_TARGET }}
                    >
                        <Text
                            className="text-body font-mono"
                            style={{ color: negative ? m3.onSurface : m3.onSurfaceVariant }}
                        >
                            {negative ? "−" : "+"}
                        </Text>
                    </Pressable>
                }
                onPress={onBalancePress}
                value={
                    <Text className="text-body font-mono" numberOfLines={1} style={{ color: m3.onSurface }}>
                        {balanceValue}
                    </Text>
                }
            />
        </View>
    );
}
