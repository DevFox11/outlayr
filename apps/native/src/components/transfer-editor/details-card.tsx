import { DatePicker, Divider, HStack, Spacer, Text as SwiftText, TextField, VStack } from "@expo/ui/swift-ui";
import type { useNativeState } from "@expo/ui/swift-ui";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
import { datePickerStyle, foregroundStyle, labelsHidden, lineLimit, padding } from "@expo/ui/swift-ui/modifiers";
import { Calendar03Icon, StickyNote01Icon } from "@hugeicons-pro/core-stroke-rounded";

import { TransactionFormRowIcon } from "@/components/transaction-form/row-icon";
import { BODY, ROW, rowLabel } from "@/components/transaction-form/style";

interface TransferEditorDetailsCardProps {
    dateLabel: string;
    hairline: ViewModifier[];
    mutedColor: string;
    noteLabel: string;
    notePlaceholder: string;
    noteState: ReturnType<typeof useNativeState<string>>;
    onDateChange: (date: Date) => void;
    selectedDate: Date;
    tintColor: string;
}

export function TransferEditorDetailsCard({
    dateLabel,
    noteLabel,
    notePlaceholder,
    noteState,
    mutedColor,
    hairline,
    selectedDate,
    tintColor,
    onDateChange,
}: TransferEditorDetailsCardProps) {
    return (
        <VStack spacing={0}>
            <Divider modifiers={hairline} />

            <HStack modifiers={ROW} spacing={12}>
                <TransactionFormRowIcon color={mutedColor} icon={Calendar03Icon} />
                <SwiftText modifiers={[BODY, rowLabel]}>{dateLabel}</SwiftText>
                <Spacer />
                <DatePicker
                    displayedComponents={["date"]}
                    modifiers={[datePickerStyle("compact"), labelsHidden()]}
                    onDateChange={onDateChange}
                    selection={selectedDate}
                />
            </HStack>

            <Divider modifiers={hairline} />

            <VStack alignment="leading" modifiers={[padding({ vertical: 14 })]} spacing={8}>
                <HStack spacing={12}>
                    <TransactionFormRowIcon color={mutedColor} icon={StickyNote01Icon} />
                    <SwiftText modifiers={[BODY, rowLabel]}>{noteLabel}</SwiftText>
                    <Spacer />
                </HStack>
                <TextField
                    axis="vertical"
                    modifiers={[BODY, foregroundStyle(tintColor), lineLimit({ max: 5, min: 2 })]}
                    placeholder={notePlaceholder}
                    text={noteState}
                />
            </VStack>
        </VStack>
    );
}
