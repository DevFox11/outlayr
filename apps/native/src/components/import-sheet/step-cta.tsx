import { Button } from "panelui-native";
import { useState } from "react";
import { AccessibilityInfo } from "react-native";

import { cn } from "@/components/tw";

interface StepCtaProps {
	busy?: boolean;
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
	className,
	testID,
}: StepCtaProps) {
	const [armedFor, setArmedFor] = useState<string | null>(null);
	const armed = confirmLabel !== undefined && armedFor === confirmLabel;

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
			accessibilityHint={armed ? "Double tap to confirm" : undefined}
			className={cn("rounded-full", className)}
			disabled={disabled}
			fullWidth
			loading={busy}
			onPress={handlePress}
			testID={testID}
			variant="primary"
		>
			{armed ? confirmLabel : label}
		</Button>
	);
}
