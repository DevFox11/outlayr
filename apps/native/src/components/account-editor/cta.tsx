import { Button, Host, HStack, Spacer, Text as SwiftText } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, disabled, tint } from "@expo/ui/swift-ui/modifiers";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";

import { BODY_SEMIBOLD, CTA_HEIGHT } from "@/components/editor-style";

interface AccountEditorCtaProps {
    canSave: boolean;
    label: string;
    onPress: () => void;
    tintColor: string;
    underPicker: ViewModifier[];
}

export function AccountEditorCta({ label, canSave, tintColor, underPicker, onPress }: AccountEditorCtaProps) {
    return (
        <Host style={{ height: CTA_HEIGHT }}>
            <Button
                modifiers={[
                    buttonStyle("borderedProminent"),
                    controlSize("large"),
                    tint(tintColor),
                    disabled(!canSave),
                    ...underPicker,
                ]}
                onPress={onPress}
            >
                <HStack>
                    <Spacer />
                    <SwiftText modifiers={[BODY_SEMIBOLD]}>{label}</SwiftText>
                    <Spacer />
                </HStack>
            </Button>
        </Host>
    );
}
