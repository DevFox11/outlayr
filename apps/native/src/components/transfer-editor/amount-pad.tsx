import { BottomSheet } from "panelui-native";

import { AmountNumpad } from "@/components/amount-numpad";

interface TransferEditorAmountPadProps {
    code: string;
    minorUnits: number;
    onChange: (next: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    value: string;
}

/**
 * PanelUI's sheet, not `AmountEntrySheet`: an `@expo/ui` `BottomSheetModal`
 * presented from this screen takes the whole formSheet down with it, leaving
 * the numpad floating over the tab behind.
 */
export function TransferEditorAmountPad({
    open,
    value,
    minorUnits,
    code,
    onChange,
    onOpenChange,
}: TransferEditorAmountPadProps) {
    return (
        <BottomSheet native onOpenChange={onOpenChange} open={open}>
            <BottomSheet.Content size="auto">
                <AmountNumpad
                    code={code}
                    minorUnits={minorUnits}
                    onChange={onChange}
                    showDisplay={false}
                    value={value}
                />
            </BottomSheet.Content>
        </BottomSheet>
    );
}
