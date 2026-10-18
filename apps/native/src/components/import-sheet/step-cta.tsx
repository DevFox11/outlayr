import { Button } from "panelui-native/components/button";
import { useState } from "react";
import { AccessibilityInfo } from "react-native";

import { BusyText } from "@/components/busy-text";
import { cn } from "@/components/tw";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

interface StepCtaProps {
    busy?: boolean;
    busyLabel?: string;
    className?: string;
    confirmLabel?: string;
    disabled?: boolean;
    label: string;
    onPress: () => void;
    testID?: string;
}

export function StepCta({
    label,
    confirmLabel,
    onPress,
    disabled = false,
    busy = false,
    busyLabel,
    className,
    testID,
}: StepCtaProps) {
    const t = useTranslation();
    const { primaryForeground } = useColors();
    const [armedFor, setArmedFor] = useState<string | null>(null);
    const armed = confirmLabel !== undefined && armedFor === confirmLabel;
    const shownLabel = armed && confirmLabel !== undefined ? confirmLabel : label;

    function handlePress() {
        if (busy) {
            return;
        }
        if (confirmLabel === undefined) {
            onPress();
            return;
        }
        if (armed) {
            setArmedFor(null);
            onPress();
            return;
        }
        setArmedFor(confirmLabel);
        AccessibilityInfo.announceForAccessibility(confirmLabel);
    }

    return (
        <Button
            accessibilityHint={armed ? t("common.confirmHint") : undefined}
            className={cn("rounded-full", className)}
            disabled={disabled}
            fullWidth
            onPress={handlePress}
            testID={testID}
            variant="primary"
        >
            {busy && busyLabel !== undefined ? (
                <BusyText className="text-[16px] font-medium" color={primaryForeground}>
                    {busyLabel}
                </BusyText>
            ) : (
                shownLabel
            )}
        </Button>
    );
}
