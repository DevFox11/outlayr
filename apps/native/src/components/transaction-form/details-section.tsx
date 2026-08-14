import { Button, Divider, HStack, Image, Spacer, Text as SwiftText, TextField, VStack } from "@expo/ui/swift-ui";
import type { useNativeState } from "@expo/ui/swift-ui";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
import { buttonStyle, foregroundStyle, lineLimit, padding } from "@expo/ui/swift-ui/modifiers";
import { Note01Icon, Wallet01Icon } from "@hugeicons-pro/core-stroke-rounded";
import type { ReactNode } from "react";

import { TransactionFormRowIcon } from "./row-icon";
import { BODY, rowLabel, TAP_ROW } from "./style";

interface TransactionFormDetailsSectionProps {
    accountLabel: string;
    accountName: string | null;
    accountNoneLabel: string;
    accountTile?: ReactNode;
    card: ViewModifier[];
    foregroundColor: string;
    hairline: ViewModifier[];
    mutedColor: string;
    notes: ReturnType<typeof useNativeState<string>>;
    notesLabel: string;
    notesPlaceholder: string;
    onAccountPress: () => void;
}

export function TransactionFormDetailsSection({
    accountLabel,
    accountName,
    accountNoneLabel,
    accountTile,
    onAccountPress,
    notesLabel,
    notesPlaceholder,
    notes,
    foregroundColor,
    mutedColor,
    hairline,
    card,
}: TransactionFormDetailsSectionProps) {
    return (
        <VStack modifiers={card} spacing={0}>
            <Button modifiers={[buttonStyle("plain")]} onPress={onAccountPress}>
                <HStack modifiers={TAP_ROW} spacing={12}>
                    <TransactionFormRowIcon color={mutedColor} icon={Wallet01Icon} />
                    <SwiftText modifiers={[BODY, rowLabel]}>{accountLabel}</SwiftText>
                    <Spacer />
                    <HStack spacing={5}>
                        {accountName ? accountTile : null}
                        <SwiftText modifiers={[BODY, foregroundStyle(accountName ? foregroundColor : mutedColor)]}>
                            {accountName ?? accountNoneLabel}
                        </SwiftText>
                        <Image color={mutedColor} size={12} systemName="chevron.up.chevron.down" />
                    </HStack>
                </HStack>
            </Button>
            <Divider modifiers={hairline} />
            <VStack alignment="leading" modifiers={[padding({ vertical: 14 })]} spacing={8}>
                <HStack spacing={12}>
                    <TransactionFormRowIcon color={mutedColor} icon={Note01Icon} />
                    <SwiftText modifiers={[BODY, rowLabel]}>{notesLabel}</SwiftText>
                    <Spacer />
                </HStack>
                <TextField
                    axis="vertical"
                    modifiers={[BODY, foregroundStyle(foregroundColor), lineLimit({ max: 6, min: 3 })]}
                    placeholder={notesPlaceholder}
                    text={notes}
                />
            </VStack>
        </VStack>
    );
}
