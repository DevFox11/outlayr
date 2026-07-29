import { HugeiconsIcon } from "@hugeicons/react-native";
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { type BudgetWindow, budgetWindowLabel } from "@/domain/budget-math";
import { useColors } from "@/theme/use-colors";

interface BudgetPeriodStepperProps {
	window: BudgetWindow;
	type: number;
	/** 0 is the running window; negative counts closed windows behind it. */
	offset: number;
	/** How many closed windows the ledger reaches back through. */
	maxBack: number;
	onStep: (offset: number) => void;
}

/** Ports Swift's `BudgetStepperView`: browse the windows behind the running one. */
export function BudgetPeriodStepper({
	window,
	type,
	offset,
	maxBack,
	onStep,
}: BudgetPeriodStepperProps) {
	return (
		<View className="flex-row items-center justify-between">
			<StepButton
				accessibilityLabel="Previous period"
				disabled={offset <= -maxBack}
				onPress={() => onStep(offset - 1)}
			>
				<ArrowGlyph back />
			</StepButton>

			<MonoLabel className="text-foreground">
				{budgetWindowLabel(window, type)}
			</MonoLabel>

			<StepButton
				accessibilityLabel="Next period"
				disabled={offset >= 0}
				onPress={() => onStep(offset + 1)}
			>
				<ArrowGlyph />
			</StepButton>
		</View>
	);
}

function StepButton({
	accessibilityLabel,
	disabled,
	onPress,
	children,
}: {
	accessibilityLabel: string;
	disabled: boolean;
	onPress: () => void;
	children: ReactNode;
}) {
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			className="size-9 items-center justify-center active:opacity-60"
			disabled={disabled}
			hitSlop={6}
			onPress={onPress}
			style={{ opacity: disabled ? 0.3 : 1 }}
		>
			{children}
		</Pressable>
	);
}

function ArrowGlyph({ back = false }: { back?: boolean }) {
	const colors = useColors();
	return (
		<HugeiconsIcon
			color={colors.foreground}
			icon={back ? ArrowLeft01Icon : ArrowRight01Icon}
			size={18}
			strokeWidth={2}
		/>
	);
}
